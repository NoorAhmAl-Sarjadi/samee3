/** Accept only a local application path, including after URL normalization. */
export function safeReturnPath(value: string | null, fallback = '/profile'): string {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback
  try {
    const base = 'https://samee3.invalid'
    const url = new URL(value, base)
    if (url.origin !== base || /^\/auth(?:\/|$)/.test(url.pathname)) return fallback
    return url.pathname + url.search + url.hash
  } catch { return fallback }
}