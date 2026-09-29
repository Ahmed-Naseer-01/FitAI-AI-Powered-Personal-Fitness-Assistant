import { describe, it, expect, vi, afterEach } from 'vitest'
import { z } from 'zod'
import { generateStructured, isAiEnabled } from './client'

const schema = z.object({ answer: z.number() })
const jsonSchema = {
  type: 'object',
  properties: { answer: { type: 'number' } },
  required: ['answer'],
}

/** Shapes a fake Gemini response whose candidate text is `text`. */
function geminiReply(text: string, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('isAiEnabled', () => {
  it('is false with no key', () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    expect(isAiEnabled()).toBe(false)
  })

  it('is false for a whitespace-only key', () => {
    vi.stubEnv('GEMINI_API_KEY', '   ')
    expect(isAiEnabled()).toBe(false)
  })

  it('is true with a key', () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    expect(isAiEnabled()).toBe(true)
  })
})

describe('generateStructured', () => {
  it('returns null without an API key and makes no network call', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('parses and validates a good response', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply('{"answer": 42}')))

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toEqual({
      answer: 42,
    })
  })

  it('never puts the API key in the request body', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'super-secret-key')
    const fetchSpy = vi.fn().mockResolvedValue(geminiReply('{"answer": 1}'))
    vi.stubGlobal('fetch', fetchSpy)

    await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })
    const [, init] = fetchSpy.mock.calls[0]
    expect(String(init.body)).not.toContain('super-secret-key')
  })

  it('sends the JSON schema so the provider enforces the response shape', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    const fetchSpy = vi.fn().mockResolvedValue(geminiReply('{"answer": 1}'))
    vi.stubGlobal('fetch', fetchSpy)

    await generateStructured({ prompt: 'hello', zodSchema: schema, jsonSchema })
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema).toEqual(jsonSchema)
    expect(body.contents[0].parts[0].text).toBe('hello')
  })

  it('returns null when every model returns a server error', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply('{}', false)))

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toBeNull()
  }, 20000)

  it('returns null on unparseable JSON', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply('not json at all')))

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toBeNull()
  })

  it('returns null on a network error rather than throwing', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    await expect(
      generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema }),
    ).resolves.toBeNull()
  }, 20000)

  it('returns null when the response has no candidate text', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ candidates: [] }),
    }))

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toBeNull()
  })

  it('retries once when the first response fails Zod, then succeeds', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(geminiReply('{"answer": "not a number"}'))
      .mockResolvedValueOnce(geminiReply('{"answer": 7}'))
    vi.stubGlobal('fetch', fetchSpy)

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toEqual({
      answer: 7,
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('feeds the validation problem back into the retry prompt', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(geminiReply('{"answer": "nope"}'))
      .mockResolvedValueOnce(geminiReply('{"answer": 3}'))
    vi.stubGlobal('fetch', fetchSpy)

    await generateStructured({
      prompt: 'base prompt',
      zodSchema: schema,
      jsonSchema,
      retryPrompt: (problem) => `RETRY because ${problem}`,
    })

    const secondBody = JSON.parse(fetchSpy.mock.calls[1][1].body)
    expect(secondBody.contents[0].parts[0].text).toContain('RETRY because')
  })

  it('gives up after the retry and returns null', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    const fetchSpy = vi.fn().mockResolvedValue(geminiReply('{"answer": "still wrong"}'))
    vi.stubGlobal('fetch', fetchSpy)

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})

describe('response parsing robustness', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('finds the answer when a reasoning part precedes it', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [
              { thoughtSignature: 'EsoEC...' },
              { text: '{"answer": 42}' },
            ],
          },
        }],
      }),
    }))

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toEqual({
      answer: 42,
    })
  })

  it('handles a part carrying both text and a thought signature', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: { parts: [{ text: '{"answer": 7}', thoughtSignature: 'abc' }] },
        }],
      }),
    }))

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toEqual({
      answer: 7,
    })
  })

  it('ignores empty text parts', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '   ' }, { text: '{"answer": 5}' }] } }],
      }),
    }))

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toEqual({
      answer: 5,
    })
  })
})

describe('transient failure handling', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  function status(code: number) {
    return { ok: false, status: code, json: async () => ({}) }
  }

  it('retries a 503 and succeeds on a later attempt', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(status(503))
      .mockResolvedValueOnce(geminiReply('{"answer": 9}'))
    vi.stubGlobal('fetch', fetchSpy)

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toEqual({
      answer: 9,
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  }, 15000)

  it('moves to the next model on a 429 rather than retrying the exhausted one', async () => {
    // The free tier's quota is per model per day, so a retry cannot succeed
    // but the next model has its own allowance.
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(status(429))
      .mockResolvedValueOnce(geminiReply('{"answer": 3}'))
    vi.stubGlobal('fetch', fetchSpy)

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toEqual({
      answer: 3,
    })
    expect(String(fetchSpy.mock.calls[1][0])).toContain('gemini-3.7-flash')
  }, 15000)

  it('gives up quickly when every model is rate limited', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    const fetchSpy = vi.fn().mockResolvedValue(status(429))
    vi.stubGlobal('fetch', fetchSpy)

    const started = Date.now()
    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toBeNull()

    // One attempt per model, no backoff waits at all.
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('gives up immediately on a 403, which will never succeed', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'bad-key')
    const fetchSpy = vi.fn().mockResolvedValue(status(403))
    vi.stubGlobal('fetch', fetchSpy)

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toBeNull()
    // Fatal: no retry, no other model.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('moves to the next model on a 404 instead of retrying the dead one', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    const fetchSpy = vi.fn().mockResolvedValue(status(404))
    vi.stubGlobal('fetch', fetchSpy)

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toBeNull()
    // One attempt on each of the three models, no backoff waits.
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('falls through to a second model when the first is overloaded', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(status(503)) // model 1, attempt 1
      .mockResolvedValueOnce(status(503)) // model 1, attempt 2
      .mockResolvedValueOnce(geminiReply('{"answer": 11}')) // model 2
    vi.stubGlobal('fetch', fetchSpy)

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toEqual({
      answer: 11,
    })
    expect(String(fetchSpy.mock.calls[2][0])).toContain('gemini-3.7-flash')
  }, 15000)

  it('gives up after exhausting every model on persistent overload', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    const fetchSpy = vi.fn().mockResolvedValue(status(503))
    vi.stubGlobal('fetch', fetchSpy)

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toBeNull()
    // 3 models x 2 attempts each.
    expect(fetchSpy).toHaveBeenCalledTimes(6)
  }, 20000)

  it('uses only the single overridden model when GEMINI_MODEL is set', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.5-flash-lite')
    const fetchSpy = vi.fn().mockResolvedValue(status(503))
    vi.stubGlobal('fetch', fetchSpy)

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(2) // one model, two attempts
    for (const call of fetchSpy.mock.calls) {
      expect(String(call[0])).toContain('gemini-3.5-flash-lite')
    }
  }, 15000)

  it('honours GEMINI_MODEL when set', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    vi.stubEnv('GEMINI_MODEL', 'gemini-3.5-flash-lite')
    const fetchSpy = vi.fn().mockResolvedValue(geminiReply('{"answer": 1}'))
    vi.stubGlobal('fetch', fetchSpy)

    await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })
    expect(String(fetchSpy.mock.calls[0][0])).toContain('gemini-3.5-flash-lite')
  })

  it('starts with the first model in the chain by default', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    const fetchSpy = vi.fn().mockResolvedValue(geminiReply('{"answer": 1}'))
    vi.stubGlobal('fetch', fetchSpy)

    await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })
    expect(String(fetchSpy.mock.calls[0][0])).toContain('gemini-3.8-flash')
  })
})

describe('latency guards', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('aborts a request that hangs past the per-request timeout', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')

    // A server that never responds until aborted.
    const fetchSpy = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const started = Date.now()
    const result = await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })
    const elapsed = Date.now() - started

    expect(result).toBeNull()
    // Bounded by the total deadline, not by however long the server hangs.
    expect(elapsed).toBeLessThan(28_000)
  }, 40_000)

  it('passes an abort signal on every request', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    const fetchSpy = vi.fn().mockResolvedValue(geminiReply('{"answer": 1}'))
    vi.stubGlobal('fetch', fetchSpy)

    await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })
    expect(fetchSpy.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('still returns fast when the provider is healthy', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply('{"answer": 5}')))

    const started = Date.now()
    await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })
    expect(Date.now() - started).toBeLessThan(500)
  })
})
