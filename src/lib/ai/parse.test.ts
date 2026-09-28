import { describe, it, expect, vi, afterEach } from 'vitest'
import { filterToMenu, parseFoodText } from './parse'
import type { MenuItem } from './diet'

const MENU: MenuItem[] = [
  { id: 1, name: 'Roti', category: 'grain', servingLabel: '1 medium', kcal: 120, proteinG: 3.5, carbsG: 25, fatG: 1.5 },
  { id: 2, name: 'Chicken curry', category: 'protein', servingLabel: '1 cup', kcal: 240, proteinG: 26, carbsG: 6, fatG: 12 },
]

function reply(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
    }),
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('filterToMenu', () => {
  it('keeps entries whose food is in the menu', () => {
    expect(filterToMenu([{ foodId: 1, servings: 2, mealSlot: 'lunch' }], MENU)).toHaveLength(1)
  })

  it('drops entries whose food is not in the menu', () => {
    const out = filterToMenu(
      [
        { foodId: 1, servings: 2, mealSlot: 'lunch' },
        { foodId: 99, servings: 1, mealSlot: 'lunch' },
      ],
      MENU,
    )
    expect(out).toEqual([{ foodId: 1, servings: 2, mealSlot: 'lunch' }])
  })

  it('clamps servings into the 0.25-20 range', () => {
    expect(filterToMenu([{ foodId: 1, servings: 0, mealSlot: 'lunch' }], MENU)[0].servings).toBe(0.25)
    expect(filterToMenu([{ foodId: 1, servings: 500, mealSlot: 'lunch' }], MENU)[0].servings).toBe(20)
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterToMenu([{ foodId: 99, servings: 1, mealSlot: 'lunch' }], MENU)).toEqual([])
  })
})

describe('parseFoodText', () => {
  it('returns an empty draft when AI is unavailable', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    expect(await parseFoodText('two rotis', MENU, 'lunch')).toEqual([])
  })

  it('returns an empty draft for blank input without calling the API', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc')
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(await parseFoodText('   ', MENU, 'lunch')).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('maps a good response onto menu entries', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      reply({ entries: [{ foodId: 1, servings: 2, mealSlot: 'lunch' }] }),
    ))

    expect(await parseFoodText('two rotis', MENU, 'lunch')).toEqual([
      { foodId: 1, servings: 2, mealSlot: 'lunch' },
    ])
  })

  it('silently drops hallucinated food ids', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      reply({ entries: [{ foodId: 777, servings: 1, mealSlot: 'lunch' }] }),
    ))

    expect(await parseFoodText('pizza', MENU, 'lunch')).toEqual([])
  })

  it('keeps the valid entries when only some ids are hallucinated', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      reply({
        entries: [
          { foodId: 1, servings: 2, mealSlot: 'lunch' },
          { foodId: 777, servings: 1, mealSlot: 'lunch' },
        ],
      }),
    ))

    expect(await parseFoodText('two rotis and a pizza', MENU, 'lunch')).toEqual([
      { foodId: 1, servings: 2, mealSlot: 'lunch' },
    ])
  })

  it('returns an empty draft when the model finds no match', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ entries: [] })))

    expect(await parseFoodText('sushi', MENU, 'lunch')).toEqual([])
  })

  it('returns an empty draft rather than throwing on a network failure', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'abc')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(parseFoodText('two rotis', MENU, 'lunch')).resolves.toEqual([])
  })
})
