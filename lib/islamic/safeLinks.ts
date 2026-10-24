/** External links must be absolute HTTPS URLs. Protect Firestore-configurable href/src from unsafe schemes. */
export function safeIslamicLibraryLink(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
    return url.toString()
  } catch { return null }
}
