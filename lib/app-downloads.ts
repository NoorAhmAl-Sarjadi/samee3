export type MacDownload = {
  id: 'apple-silicon' | 'intel'; assetName: string; versionName: string; minimumOS: string
  bytes: number; sha256: string; available: boolean; url: string | null
}
export type AppDownloads = { macos: MacDownload[] }
export type DownloadConfig = {
  repository: string; releaseTag: string
  macos: Omit<MacDownload, 'available' | 'url'>[]
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }
export function parseDownloadConfig(raw: unknown): DownloadConfig {
  if (!record(raw) || typeof raw.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw.repository)
    || typeof raw.releaseTag !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(raw.releaseTag)
    || !Array.isArray(raw.macos) || raw.macos.length !== 2) throw new Error('Invalid application download configuration')
  const ids = new Set<string>()
  const macos = raw.macos.map((item) => {
    if (!record(item) || !['apple-silicon', 'intel'].includes(String(item.id)) || ids.has(String(item.id))
      || typeof item.assetName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.zip$/.test(item.assetName)
      || typeof item.versionName !== 'string' || !/^\d+\.\d+\.\d+$/.test(item.versionName)
      || typeof item.minimumOS !== 'string' || !/^\d+\.\d+(?:\.\d+)?$/.test(item.minimumOS)
      || typeof item.bytes !== 'number' || !Number.isSafeInteger(item.bytes) || item.bytes < 1 || item.bytes >= 2 * 1024 ** 3
      || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('Invalid Mac download entry')
    ids.add(String(item.id))
    return { id: item.id as MacDownload['id'], assetName: item.assetName, versionName: item.versionName, minimumOS: item.minimumOS, bytes: item.bytes, sha256: item.sha256 }
  })
  return { repository: raw.repository, releaseTag: raw.releaseTag, macos }
}
export function resolveDownloads(config: DownloadConfig, release: unknown): AppDownloads {
  const assets = record(release) && release.draft !== true && Array.isArray(release.assets) ? release.assets : []
  return { macos: config.macos.map((item) => {
    const url = `https://github.com/${config.repository}/releases/download/${config.releaseTag}/${item.assetName}`
    const available = assets.some((asset) => record(asset) && asset.name === item.assetName && asset.state === 'uploaded'
      && asset.size === item.bytes && asset.browser_download_url === url
      && (asset.digest == null || asset.digest === `sha256:${item.sha256}`))
    return { ...item, available, url: available ? url : null }
  }) }
}
export function parseAppDownloads(raw: unknown): AppDownloads | null {
  if (!record(raw) || !Array.isArray(raw.macos) || raw.macos.length !== 2) return null
  try {
    const config = parseDownloadConfig({ repository: 'PSYMOHAMEDABOZAID/samee3', releaseTag: 'samee3-apps', macos: raw.macos })
    return { macos: config.macos.map((item, index) => {
      const source = raw.macos as unknown[]; const value = source[index]
      if (!record(value) || typeof value.available !== 'boolean') throw new Error('Invalid release state')
      const url = value.url
      if (value.available && (typeof url !== 'string' || !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/releases\/download\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\.zip$/.test(url))) throw new Error('Invalid release URL')
      return { ...item, available: value.available, url: value.available ? url as string : null }
    }) }
  } catch { return null }
}