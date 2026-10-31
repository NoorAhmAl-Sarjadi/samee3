
import catalog from './alafasy-riwayat-manifest.json'

type RiwayaLike = {
  id: number
  name: string
}

type MushafLike = {
  id: number
  name: string
  server: string
  surah_total: number
  rewaya_id: number
  moshaf_type: number
  surah_list: string
}

type ReciterLike = {
  id: number
  name: string
  moshaf: MushafLike[]
}

type AutoEntry = {
  key: string
  id: number
  name: string
  riwaya: string
  server: string
  surah_total: number
  surah_list: string
  source_url: string
}

const ALL_SURAHS = Array.from(
  { length: 114 },
  (_, i) => i + 1
).join(',')

const entries = (catalog.entries as AutoEntry[]).filter(
  entry => {
    if (!entry || !Number.isSafeInteger(entry.id)) {
      return false
    }

    if (
      typeof entry.riwaya !== 'string' ||
      typeof entry.server !== 'string' ||
      entry.surah_total !== 114 ||
      typeof entry.surah_list !== 'string'
    ) {
      return false
    }

    const numbers = entry.surah_list
      .split(',')
      .map(Number)

    return (
      numbers.length === 114 &&
      numbers.every(
        (number, index) => number === index + 1
      )
    )
  }
)

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function equalRiwaya(a: string, b: string): boolean {
  return normalize(a) === normalize(b)
}

export function extendRiwayatWithAlafasy<
  T extends RiwayaLike
>(
  riwayat: T[]
): RiwayaLike[] {
  const result: RiwayaLike[] = [...riwayat]
  let syntheticId = 930000

  for (const entry of entries) {
    const exists = result.some(
      r => equalRiwaya(r.name, entry.riwaya)
    )

    if (!exists) {
      result.push({
        id: ++syntheticId,
        name: entry.riwaya,
      })
    }
  }

  return result
}

export function alafasyFullMushafsForRiwaya(
  riwaya: RiwayaLike
): ReciterLike[] {
  return entries
    .filter(item =>
      equalRiwaya(item.riwaya, riwaya.name)
    )
    .map(item => ({
      id: item.id,

      name:
        `مشاري راشد العفاسي — مصحف الروايات — ${item.riwaya}`,

      moshaf: [
        {
          id: item.id,

          name:
            `مصحف الروايات — ${item.riwaya}` +
            (item.name ? ` (${item.name})` : ''),

          server: item.server,
          surah_total: 114,
          rewaya_id: riwaya.id,
          moshaf_type: 0,
          surah_list: ALL_SURAHS,
        },
      ],
    }))
}
