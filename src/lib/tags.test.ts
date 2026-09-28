import { describe, it, expect } from 'vitest'
import { parseTags, serializeTags, hasAnyTag } from './tags'

describe('parseTags', () => {
  it('splits a comma-separated string', () => {
    expect(parseTags('budget,gluten')).toEqual(['budget', 'gluten'])
  })

  it('returns an empty array for an empty string', () => {
    expect(parseTags('')).toEqual([])
  })

  it('trims whitespace and drops empty segments', () => {
    expect(parseTags(' budget , , gluten ')).toEqual(['budget', 'gluten'])
  })

  it('handles a single tag with no comma', () => {
    expect(parseTags('nuts')).toEqual(['nuts'])
  })
})

describe('serializeTags', () => {
  it('joins with commas', () => {
    expect(serializeTags(['budget', 'gluten'])).toBe('budget,gluten')
  })

  it('returns an empty string for an empty array', () => {
    expect(serializeTags([])).toBe('')
  })

  it('round-trips with parseTags', () => {
    const tags = ['dairy', 'high-protein']
    expect(parseTags(serializeTags(tags))).toEqual(tags)
  })
})

describe('hasAnyTag', () => {
  it('is true when any wanted tag is present', () => {
    expect(hasAnyTag('budget,gluten', ['gluten'])).toBe(true)
    expect(hasAnyTag('budget,gluten', ['nuts', 'budget'])).toBe(true)
  })

  it('is false when none are present', () => {
    expect(hasAnyTag('budget,gluten', ['nuts'])).toBe(false)
  })

  it('is false when the wanted list is empty', () => {
    // A user with no allergies must not have every food excluded.
    expect(hasAnyTag('budget,gluten', [])).toBe(false)
  })

  it('is false when the food has no tags', () => {
    expect(hasAnyTag('', ['nuts'])).toBe(false)
  })

  it('does not match on a partial tag name', () => {
    expect(hasAnyTag('gluten', ['glu'])).toBe(false)
  })
})
