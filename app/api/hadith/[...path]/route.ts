import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const revalidate = 0
const BASE = 'https://alfurqan.online/api/v1/hadith'
export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  if (!path.length || path.length > 5 || path.some((part) => !/^[a-zA-Z0-9_-]{1,100}$/.test(part))) return NextResponse.json({ error: 'مسار الحديث غير صالح.' }, { status: 400 })
  const url = new URL(`${BASE}/${path.map(encodeURIComponent).join('/')}`)
  new URL(request.url).searchParams.forEach((value, key) => { if (['page', 'limit', 'per_page', 'search', 'q'].includes(key) && value.length < 250) url.searchParams.set(key, value) })
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(18000) })
    if (!response.ok) return NextResponse.json({ error: 'تعذر تحميل الأحاديث من المصدر.' }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 })
    const payload: unknown = await response.json()
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: 'تعذر الاتصال بمصدر الأحاديث. حاول مجددًا أو افتح المحفوظ على جهازك.' }, { status: 502 }) }
}
