export type HumanHadithAudio = {
  /** Direct HTTPS URL to an exact recording of this hadith. */
  url: string
  /** Label shown in the player. */
  label?: string
  /** Optional segment start in seconds if the file contains multiple items. */
  startSeconds?: number
  /** Optional segment end in seconds if the file contains multiple items. */
  endSeconds?: number
  /** Optional source/license page for internal auditing. */
  sourceUrl?: string
}

/**
 * Exact human recordings only.
 *
 * IMPORTANT:
 * - Do not put a whole-book/chapter MP3 here unless exact timestamps are known.
 * - Do not add a public URL unless redistribution/embedding is permitted.
 * - Key format: "bookId:hadithNumber".
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