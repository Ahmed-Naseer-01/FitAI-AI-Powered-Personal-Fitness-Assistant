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

  it('returns null on a non-2xx response', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc123')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply('{}', false)))

    expect(await generateStructured({ prompt: 'x', zodSchema: schema, jsonSchema })).toBeNull()
  })

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
  })

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
