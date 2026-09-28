import type { ZodType } from 'zod'

// The ONLY place FitAI makes a network call to a language model.
//
// Swapping provider (Groq, Claude, a local Ollama instance) means replacing
// callOnce; no calling code changes. A hand-rolled fetch is used rather than
// an SDK so there is no dependency whose major version can shift mid-project.

export type JsonSchema = Record<string, unknown>

// Verified available 2026-09. Older 2.x models are refused for new API keys.
// Override with GEMINI_MODEL in .env to switch without a code change.
const DEFAULT_MODEL = 'gemini-3.8-flash'

// Free-tier flash models are frequently overloaded. A transient 503 or 429
// deserves a short wait and another try, not an immediate drop to the
// deterministic fallback.
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504])
const BACKOFF_MS = [600, 1800]

function endpoint(): string {
  const model = (process.env.GEMINI_MODEL ?? '').trim() || DEFAULT_MODEL
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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

/**
 * One logical request, retried on transient overload.
 * Returns parsed JSON, or null for any failure at all.
 */
async function callOnce(prompt: string, jsonSchema: JsonSchema): Promise<unknown | null> {
  const key = (process.env.GEMINI_API_KEY ?? '').trim()

  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt += 1) {
    const outcome = await attemptCall(key, prompt, jsonSchema)
    if (outcome.kind === 'ok') return outcome.value
    if (outcome.kind === 'fatal') return null
    // transient: wait and try again, unless that was the last attempt
    if (attempt < BACKOFF_MS.length) await sleep(BACKOFF_MS[attempt])
  }

  return null
}

type Outcome =
  | { kind: 'ok'; value: unknown }
  | { kind: 'fatal' }
  | { kind: 'transient' }

async function attemptCall(
  key: string,
  prompt: string,
  jsonSchema: JsonSchema,
): Promise<Outcome> {
  let response: Response
  try {
    // The key goes in the query string, never the body.
    response = await fetch(`${endpoint()}?key=${encodeURIComponent(key)}`, {
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
    return { kind: 'transient' } // network blip, DNS, timeout
  }

  if (!response.ok) {
    // 400 bad request and 403 bad key will never succeed; overload might.
    return TRANSIENT_STATUSES.has(response.status) ? { kind: 'transient' } : { kind: 'fatal' }
  }

  try {
    const body = await response.json()

    // Reasoning models interleave thought parts with the answer, so take the
    // first part that actually carries text rather than assuming parts[0].
    const parts: unknown[] = body?.candidates?.[0]?.content?.parts ?? []
    const text = parts
      .map((p) => (p as { text?: unknown })?.text)
      .find((t): t is string => typeof t === 'string' && t.trim().length > 0)

    if (text === undefined) return { kind: 'fatal' }
    return { kind: 'ok', value: JSON.parse(text) }
  } catch {
    return { kind: 'fatal' } // malformed body, or text that is not JSON
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
