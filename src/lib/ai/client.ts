import type { ZodType } from 'zod'

// The ONLY place FitAI makes a network call to a language model.
//
// Swapping provider (Groq, Claude, a local Ollama instance) means replacing
// callOnce; no calling code changes. A hand-rolled fetch is used rather than
// an SDK so there is no dependency whose major version can shift mid-project.

export type JsonSchema = Record<string, unknown>

const MODEL = 'gemini-2.0-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export function isAiEnabled(): boolean {
  return (process.env.GEMINI_API_KEY ?? '').trim().length > 0
}

type Args<T> = {
  prompt: string
  zodSchema: ZodType<T>
  jsonSchema: JsonSchema
  /** Builds the follow-up prompt when the first attempt fails validation. */
  retryPrompt?: (problem: string) => string
}

/** One request. Returns parsed JSON, or null for any failure at all. */
async function callOnce(prompt: string, jsonSchema: JsonSchema): Promise<unknown | null> {
  const key = (process.env.GEMINI_API_KEY ?? '').trim()

  let response: Response
  try {
    // The key goes in the query string, never the body.
    response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          // The provider enforces this shape, so malformed JSON is rare
          // before our own Zod check even runs.
          responseSchema: jsonSchema,
          temperature: 0.7,
        },
      }),
    })
  } catch {
    return null // network failure, DNS, timeout
  }

  if (!response.ok) return null // rate limit, bad key, provider outage

  try {
    const body = await response.json()
    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') return null
    return JSON.parse(text)
  } catch {
    return null // malformed body, or text that is not JSON
  }
}

/**
 * Returns a schema-valid result, or null. NEVER throws.
 *
 * A null result means "use the deterministic fallback" — every caller must
 * handle it, which is what lets FitAI work with no API key at all.
 */
export async function generateStructured<T>({
  prompt,
  zodSchema,
  jsonSchema,
  retryPrompt,
}: Args<T>): Promise<T | null> {
  if (!isAiEnabled()) return null

  const first = await callOnce(prompt, jsonSchema)

  if (first !== null) {
    const parsed = zodSchema.safeParse(first)
    if (parsed.success) return parsed.data

    // Valid JSON, wrong shape: tell the model exactly what was wrong.
    const problem = parsed.error.issues[0]?.message ?? 'schema mismatch'
    const followUp = retryPrompt
      ? retryPrompt(problem)
      : `${prompt}\n\nYour previous reply was rejected: ${problem}. Return valid JSON matching the schema exactly.`

    const second = await callOnce(followUp, jsonSchema)
    if (second === null) return null
    const retry = zodSchema.safeParse(second)
    return retry.success ? retry.data : null
  }

  // Transport-level failure: retry the original prompt once in case it was
  // a transient blip.
  const second = await callOnce(prompt, jsonSchema)
  if (second === null) return null
  const parsed = zodSchema.safeParse(second)
  return parsed.success ? parsed.data : null
}
