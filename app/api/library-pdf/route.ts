import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const HOSTS = new Set(['assets.usul.ai','d1.islamhouse.com','shamela.org','archive.org','www.archive.org','books.islamway.net','files.islamhouse.com'])
function allowed(value: string): URL | null {
  try {
    const url = new URL(value)
    if (value.length > 3000 || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) return null
    if (!HOSTS.has(url.hostname) && !/^ia[0-9]+\.us\.archive\.org$/.test(url.hostname) && !/^dn[0-9]+\.ca\.archive\.org$/.test(url.hostname)) return null
    return url
  } catch { return null }
}
export async function GET(request: NextRequest) {
  let url = allowed(request.nextUrl.searchParams.get('url') || '')
  if (!url) return NextResponse.json({error:'مصدر PDF غير مسموح. اختر الملف من جهازك.'},{status:400})
  const range = request.headers.get('range')
  if (range && !/^bytes=(?:[0-9]+-[0-9]*|-[0-9]+)$/.test(range)) return NextResponse.json({error:'Invalid Range'},{status:416})
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const cancel = () => controller.abort()
  const reset = () => { clearTimeout(timer); timer = setTimeout(cancel,25000) }
  const clean = () => { clearTimeout(timer); request.signal.removeEventListener('abort',cancel) }
  request.signal.addEventListener('abort',cancel,{once:true}); if(request.signal.aborted) cancel()
  let response: Response | null = null
  try {
    for(let step=0;step<=4;step++) {
      reset()
      const referer = url.hostname === 'shamela.org' ? `https://shamela.org/pdf/${url.pathname.split('/').at(-1)?.replace(/_gen\.pdf$/,'')}` : url.origin + '/'
      response = await fetch(url,{signal:controller.signal,redirect:'manual',cache:'no-store',headers:{Referer:referer,'User-Agent':'Mozilla/5.0 (compatible; SAMEE3)',Accept:'application/pdf',...(range?{Range:range}:{})}})
      if(![301,302,303,307,308].includes(response.status))break
      const location=response.headers.get('location');await response.body?.cancel()
      if(!location || step===4)throw new Error('Redirect limit')
      const target=allowed(new URL(location,url).href);if(!target)throw new Error('Untrusted redirect');url=target
    }
    if(!response)throw new Error('No response')
    if(response.status===416) { clean(); return new NextResponse(null,{status:416,headers:{'Content-Range':response.headers.get('content-range')||'bytes */0'}}) }
    const mime=(response.headers.get('content-type')||'').split(';')[0]
    if(![200,206].includes(response.status) || !response.body || !['application/pdf','application/octet-stream','binary/octet-stream'].includes(mime))throw new Error('Not a PDF')
    const length=Number(response.headers.get('content-length')||0)
    if(length>120*1024*1024)throw new Error('File too large')
    const headers=new Headers({'Content-Type':'application/pdf','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff','Content-Disposition':`${request.nextUrl.searchParams.get('download')==='1'?'attachment':'inline'}; filename="samee3-book.pdf"`})
    for(const key of ['content-length','content-range','accept-ranges','etag','last-modified']) { const value=response.headers.get(key);if(value)headers.set(key,value) }
    const reader=response.body.getReader();let bytes=0
    const stream=new ReadableStream<Uint8Array>({
      async pull(output) {
        try { reset();const item=await reader.read();if(item.done){clean();output.close();return}bytes+=item.value.byteLength;if(bytes>120*1024*1024)throw new Error('File too large');output.enqueue(item.value) }
        catch(error){clean();controller.abort();output.error(error)}
      },
      async cancel(){clean();controller.abort();await reader.cancel().catch(()=>{})},
    })
    return new NextResponse(stream,{status:response.status,headers})
  } catch {
    clean();controller.abort();await response?.body?.cancel().catch(()=>{})
    return NextResponse.json({error:'تعذر جلب نسخة PDF من الناشر.'},{status:502,headers:{'Cache-Control':'no-store'}})
  }
}