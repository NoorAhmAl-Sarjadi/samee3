export type AndroidRelease = {
  available: boolean; versionCode: number; versionName: string; minSdk: number
  apkPath: string; sha256: string; bytes: number; notes: string[]
}

export function parseAndroidRelease(raw: unknown): AndroidRelease | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  if (value.available !== true) return null
  if (!Number.isSafeInteger(value.versionCode) || Number(value.versionCode) < 1 || typeof value.versionName !== 'string'
    || !/^\d+\.\d+\.\d+(?:[.-][a-zA-Z0-9]+)?$/.test(value.versionName)
    || typeof value.apkPath !== 'string' || !/^\/android\/[a-zA-Z0-9._-]+\.apk$/.test(value.apkPath)
    || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)
    || !Number.isSafeInteger(value.bytes) || Number(value.bytes) < 1000
    || !Number.isSafeInteger(value.minSdk) || Number(value.minSdk) < 26) return null
  return { available: true, versionCode: Number(value.versionCode), versionName: value.versionName,
    minSdk: Number(value.minSdk), apkPath: value.apkPath, sha256: value.sha256, bytes: Number(value.bytes),
    notes: Array.isArray(value.notes) ? value.notes.filter((item): item is string => typeof item === 'string').slice(0, 10) : [] }
}
