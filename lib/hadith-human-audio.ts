export type HumanHadithAudio = {
  url: string
  label?: string
  startSeconds?: number
  endSeconds?: number
  sourceUrl?: string
}

/**
 * Exact human recordings for individual hadiths.
 *
 * Key format:
 * `${bookId}:${hadithNumber}`
 *
 * Example:
 * "bukhari:1"
 *
 * Do not add audio URLs here unless the recording is verified
 * to correspond exactly to the requested hadith and is legally
 * reusable/embeddable.
 */
export const HUMAN_HADITH_AUDIO: Record<string, HumanHadithAudio> = {}

/**
 * Returns the verified human recording for a specific hadith,
 * or null when no exact recording is available.
 */
export function getHumanHadithAudio(
  bookId: string,
  hadithNumber: number,
): HumanHadithAudio | null {
  const key = `${bookId}:${hadithNumber}`

  return HUMAN_HADITH_AUDIO[key] || null
}