import { unstable_cache } from 'next/cache'
import rawConfig from '@/public/app-downloads.json'
import { parseDownloadConfig, resolveDownloads } from '@/lib/app-downloads'

const config = parseDownloadConfig(rawConfig)
// Cache missing releases too: visitors must not exhaust the public GitHub API
// while the owner has not uploaded an asset yet. This cache needs no token.
const downloads = unstable_cache(async () => {
  try {
    const response = await fetch(`https://api.github.com/repos/${config.repository}/releases/tags/${config.releaseTag}`, {
      cache: 'no-store', signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Samee3-App-Downloads' },
    })
    return resolveDownloads(config, response.ok ? await response.json() : null)
  } catch { return resolveDownloads(config, null) }
}, ['samee3-desktop-downloads-v2', JSON.stringify(config)], { revalidate: 300 })

export async function GET() {
  return Response.json(await downloads(), { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}