import { NextResponse } from 'next/server'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type VideoFile = { filename: string; size: number }
type GitHubFile = { name?: string; type?: string; size?: number }

function validFilename(name: string): boolean {
  return name.length > 0 && name.length <= 180 &&
    /\.(mp4|webm)$/i.test(name) &&
    !name.includes('/') && !name.includes('\\') &&
    !name.startsWith('.')
}

// Local development can inspect public/ directly. Serverless hosting may not
// bundle this directory: the GitHub listing below covers deployed Vercel apps.
async function localFiles(): Promise<VideoFile[]> {
  try {
    const folder = join(process.cwd(), 'public', 'visual-backgrounds')
    const names = await readdir(folder)
    const found = await Promise.all(names.filter(validFilename).map(async filename => {
      const item = await stat(join(folder, filename))
      return item.isFile() ? { filename, size: item.size } : null
    }))
    return found.filter((item): item is VideoFile => item !== null)
  } catch {
    return []
  }
}

async function githubFiles(): Promise<VideoFile[]> {
  const url = 'https://api.github.com/repos/NoorAhmAl-Sarjadi/samee3/contents/public/visual-backgrounds?ref=main'
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'samee3-visual-gallery',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    next: { revalidate: 180 },
    signal: AbortSignal.timeout(10000),
  })
  if (response.status === 404) return []
  if (!response.ok) throw new Error('تعذّر قراءة ملفات GitHub حاليًا.')
  const items: unknown = await response.json()
  if (!Array.isArray(items)) throw new Error('فهرس GitHub غير صالح.')
  return (items as GitHubFile[])
    .filter((item): item is GitHubFile & { name: string } =>
      item.type === 'file' && typeof item.name === 'string' && validFilename(item.name))
    .map(item => ({ filename: item.name, size: Number(item.size) || 0 }))
}

export async function GET() {
  const local = await localFiles()
  let remote: VideoFile[] = []
  let warning = ''
  try {
    remote = await githubFiles()
  } catch {
    warning = 'تعذّر تحديث قائمة GitHub؛ يمكنك تجربة تحديث المكتبة لاحقًا.'
  }
  const map = new Map<string, VideoFile>()
  for (const file of [...remote, ...local]) map.set(file.filename, file)
  const files = [...map.values()].sort((a, b) => a.filename.localeCompare(b.filename, 'ar'))
  return NextResponse.json({ files, warning }, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=180' },
  })
}