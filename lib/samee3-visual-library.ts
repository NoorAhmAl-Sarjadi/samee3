export type Scene = {
  id: string
  name: string
  group: string
  source: string
  emoji: string
  tint: string
  fileName?: string
  videoURL?: string
}

// A real, openly reusable CC0 test clip. All other backgrounds are the
// exact video files that users upload, not placeholder scene descriptions.
export const SCENES: Scene[] = [{
  id: 'flowers-demo',
  name: 'زهور متحركة — تجربة',
  group: 'تجربة',
  source: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/video',
  emoji: '🌸',
  tint: '#936d86',
}]

export const GROUPS = ['الكل', 'تجربة']

/** Keep the original filename, including spaces, Arabic, and extensions. */
export function sceneFromFile(
  filename: string,
  origin: 'repository' | 'local'
): Scene {
  const title = filename
    .replace(/\.(mp4|webm)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || filename

  const repository = origin === 'repository'
  return {
    id: (repository ? 'repo:' : 'local:') + filename,
    name: title,
    group: repository ? 'المرفوعة للموقع' : 'المحفوظة على الجهاز',
    source: repository
      ? 'https://github.com/NoorAhmAl-Sarjadi/samee3/blob/main/public/visual-backgrounds/' + encodeURIComponent(filename)
      : 'https://pixabay.com/videos/search/vertical/',
    emoji: '🎞️',
    tint: '#295e69',
    fileName: filename,
    videoURL: repository
      ? '/visual-backgrounds/' + encodeURIComponent(filename)
      : undefined,
  }
}
