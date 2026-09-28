// SQLite has no array column type, so list-valued fields (Food.tags,
// Profile.allergies, FormSession.feedbackTags) are stored as comma-separated
// strings. These helpers are the only place that encoding is known.

export function parseTags(csv: string): string[] {
  return csv
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

export function serializeTags(tags: string[]): string {
  return tags.join(',')
}

/**
 * True when the stored tag list contains any of `wanted`.
 * An empty `wanted` is false, so a user with no allergies excludes nothing.
 */
export function hasAnyTag(csv: string, wanted: string[]): boolean {
  if (wanted.length === 0) return false
  const have = new Set(parseTags(csv))
  return wanted.some((w) => have.has(w.trim()))
}
