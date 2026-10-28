type QuranAudio = HTMLMediaElement & { __samee3Continue?: boolean; __samee3Serial?: number; __samee3Switching?: boolean }
let active: HTMLMediaElement | null = null
const bound = new WeakSet<HTMLMediaElement>()

function pause(audio: QuranAudio) {
  if ('__samee3Continue' in audio) {
    audio.__samee3Continue = false
    audio.__samee3Switching = false
    audio.__samee3Serial = Number(audio.__samee3Serial || 0) + 1
  }
  audio.pause()
}

/** Called only when a real audio track or a user-selected lesson starts. */
export function claimAudioFocus(media: HTMLMediaElement | null): void {
  const previous = active
  active = media
  if (previous && previous !== media) pause(previous)
  const quran = typeof window !== 'undefined'
    ? (window as Window & { __samee3PersistentAudio?: QuranAudio }).__samee3PersistentAudio : null
  if (quran && quran !== media && quran !== previous) pause(quran)
}

export function bindAudioFocus(media: HTMLMediaElement): void {
  if (bound.has(media)) return
  bound.add(media)
  media.addEventListener('play', () => claimAudioFocus(media))
}