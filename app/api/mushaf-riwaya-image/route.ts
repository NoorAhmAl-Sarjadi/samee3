import { NextRequest, NextResponse } from 'next/server'
import { open, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import index from '@/data/mushaf/index.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const glyphCache = new Map<string, Promise<Record<string, string>>>()
function glyphs(riwaya: 'sousi' | 'bazzi') {
  let cached = glyphCache.get(riwaya)
  if (!cached) {
    cached = readFile(join(process.cwd(), 'data', 'mushaf', `${riwaya}.glyphs.gz`)).then((data) => JSON.parse(gunzipSync(data).toString('utf8')) as Record<string,string>)
    glyphCache.set(riwaya, cached)
    cached.catch(() => glyphCache.delete(riwaya))
  }
  return cached
}
export async function GET(request: NextRequest) {
  const riwaya = request.nextUrl.searchParams.get('riwaya'), page = Number(request.nextUrl.searchParams.get('page'))
  if ((riwaya !== 'sousi' && riwaya !== 'bazzi') || !Number.isInteger(page) || page < 1 || page > 604) return NextResponse.json({ error: 'الرواية أو الصفحة غير صالحة.' }, { status: 400 })
  const entry = index[riwaya][page - 1]
  try {
    const file = await open(join(process.cwd(), 'data', 'mushaf', `${riwaya}.pack`), 'r')
    const data = Buffer.alloc(entry.length)
    try {
      const { bytesRead } = await file.read(data, 0, entry.length, entry.offset)
      if (bytesRead !== entry.length) throw new Error('Incomplete local page')
    } finally { await file.close() }
    let svg = gunzipSync(data).toString('utf8')
    const shapes = await glyphs(riwaya)
    const used = Array.from(new Set(svg.match(/g[0-9a-f]{20}/g) || []))
    const definitions = used.map((key) => { if (!shapes[key]) throw new Error('Missing glyph'); return shapes[key] }).join('')
    svg = svg.replace('<defs>', `<defs>${definitions}`)
    return new NextResponse(svg, { headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'X-Samee3-Page': String(page), 'X-Samee3-Riwaya': riwaya,
    } })
  } catch (error) {
    console.error('Local riwaya page:', riwaya, page, error)
    return NextResponse.json({ error: 'تعذر فتح الصفحة المحلية. أعد المحاولة.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
