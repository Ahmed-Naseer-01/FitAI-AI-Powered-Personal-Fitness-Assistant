import type { ZodType } from 'zod'

// The ONLY place FitAI makes a network call to a language model.
//
// Swapping provider (Groq, Claude, a local Ollama instance) means replacing
// callOnce; no calling code changes. A hand-rolled fetch is used rather than
// an SDK so there is no dependency whose major version can shift mid-project.

export type JsonSchema = Record<string, unknown>

// Verified available 2026-09. Older 2.x models are refused for new API keys.
// Tried in order: the free tier overloads often enough that a second model
// is a better answer than dropping straight to the offline planner.
// GEMINI_MODEL in .env overrides the whole chain with a single model.
const MODEL_CHAIN = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash']

// Free-tier flash models are frequently overloaded. A transient 503 or 429
// deserves a short wait and another try, not an immediate drop to the
// deterministic fallback.
// 429 is deliberately NOT here. The free tier's limit is 20 requests per day
// PER MODEL, so retrying the same model cannot succeed and only burns the
// deadline — but the next model in the chain has its own allowance.
const TRANSIENT_STATUSES = new Set([500, 502, 503, 504])
// One retry per model.
const BACKOFF_MS = [700]

// These two caps are what keep a slow provider from holding the UI hostage.
// Measured against the live free tier, a single request to an overloaded
// reasoning model took 47 seconds to return six tokens; six such attempts
// made a plan take 86 seconds. Better to give up and plan offline.
// A healthy call with a 60-food menu returns in roughly 6-10 seconds, so 10
// is generous for one attempt and 15 bounds the whole exchange. Past that the
// offline planner is a better answer than a longer spinner.
const REQUEST_TIMEOUT_MS = 10_000
const TOTAL_DEADLINE_MS = 15_000

function models(): string[] {
  const override = (process.env.GEMINI_MODEL ?? '').trim()
  return override ? [override] : MODEL_CHAIN
}

function endpoint(model: string): string {
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
async function callOnce(
  prompt: string,
  jsonSchema: JsonSchema,
  deadline: number,
): Promise<unknown | null> {
  const key = (process.env.GEMINI_API_KEY ?? '').trim()

  for (const model of models()) {
    for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt += 1) {
      if (Date.now() >= deadline) return null

      // Never wait longer than the deadline allows, even on the first try.
      const budget = Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now())
      if (budget <= 0) return null

      const outcome = await attemptCall(key, model, prompt, jsonSchema, budget)
      if (outcome.kind === 'ok') return outcome.value
      // A retired or unavailable model: move on to the next one immediately.
      if (outcome.kind === 'unavailable') break
      if (outcome.kind === 'fatal') return null

      if (attempt < BACKOFF_MS.length && Date.now() + BACKOFF_MS[attempt] < deadline) {
        await sleep(BACKOFF_MS[attempt])
      }
    }
    // Every attempt on this model failed transiently; try the next model.
  }

  return null
}

type Outcome =
  | { kind: 'ok'; value: unknown }
  | { kind: 'fatal' }        // will never succeed: bad key, bad request
  | { kind: 'unavailable' }  // this model is gone: try the next one
  | { kind: 'transient' }    // overloaded: wait and retry

async function attemptCall(
  key: string,
  model: string,
  prompt: string,
  jsonSchema: JsonSchema,
  timeoutMs: number,
): Promise<Outcome> {
  // An overloaded model can hold a connection open far longer than a user
  // will wait, so abort rather than block.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    // The key goes in the query string, never the body.
    response = await fetch(`${endpoint(model)}?key=${encodeURIComponent(key)}`, {
      signal: controller.signal,
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
    return { kind: 'transient' } // network blip, DNS, or our own abort
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    if (TRANSIENT_STATUSES.has(response.status)) return { kind: 'transient' }
    // 404: model retired or not available to this key.
    // 429: this model's daily quota is gone.
    // Either way the next model in the chain may still work. 400/403 never will.
    if (response.status === 404 || response.status === 429) return { kind: 'unavailable' }
    return { kind: 'fatal' }
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

  // One deadline covers the whole exchange, corrective retry included, so a
  // caller can promise the user a bounded wait.
  const deadline = Date.now() + TOTAL_DEADLINE_MS

  // callOnce already handles transport failures, overload and the model
  // chain, so reaching null here means the provider is genuinely unusable.
  const first = await callOnce(prompt, jsonSchema, deadline)
  if (first === null) return null

  const parsed = zodSchema.safeParse(first)
  if (parsed.success) return parsed.data

  // Valid JSON, wrong shape: tell the model exactly what was wrong and
  // give it one corrective attempt.
  const problem = parsed.error.issues[0]?.message ?? 'schema mismatch'
  const followUp = retryPrompt
    ? retryPrompt(problem)
    : `${prompt}\n\nYour previous reply was rejected: ${problem}. Return valid JSON matching the schema exactly.`

  const second = await callOnce(followUp, jsonSchema, deadline)
  if (second === null) return null

  const retry = zodSchema.safeParse(second)
  return retry.success ? retry.data : null
}
