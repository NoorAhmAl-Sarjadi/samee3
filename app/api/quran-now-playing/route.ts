import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { NextRequest, NextResponse } from 'next/server'

import {
  RIWAYAT,
  type RiwayaId,
} from '@/lib/quran/Samee3DataAdapter'

export const runtime = 'nodejs'

type AyahText = {
  number: number
  text: string
}

type SourceAyah = {
  number?: unknown
  text?: unknown
  surah?: unknown
}

type SourceObject = {
  data?: unknown
  ayahs?: unknown
  surahs?: unknown
  id?: unknown
}

function serialize(
  value: unknown,
  surah: number,
): AyahText[] {
  let payload = value

  for (
    let depth = 0;
    depth < 5 && payload && !Array.isArray(payload);
    depth++
  ) {
    const object = payload as SourceObject

    if (Array.isArray(object.surahs)) {
      payload = object.surahs.find(
        (item: SourceObject) =>
          Number(item.id) === surah,
      )
    } else if (Array.isArray(object.ayahs)) {
      payload = object.ayahs
    } else if (object.data != null) {
      payload = object.data
    } else {
      break
    }
  }

  if (!Array.isArray(payload) || !payload.length) {
    throw new Error('Missing surah text')
  }

  const rows = payload
    .map((item: SourceAyah) => {
      if (
        item.surah != null &&
        Number(item.surah) !== surah
      ) {
        throw new Error('Surah mismatch')
      }

      if (
        !Number.isInteger(Number(item.number)) ||
        Number(item.number) < 1 ||
        typeof item.text !== 'string' ||
        !item.text.trim()
      ) {
        throw new Error('Invalid ayah')
      }

      return {
        number: Number(item.number),
        text: item.text.trim(),
      }
    })
    .sort((a, b) => a.number - b.number)

  if (
    rows.some(
      (row, index) => row.number !== index + 1,
    )
  ) {
    throw new Error('Invalid ayah numbering')
  }

  return rows
}

async function load(
  riwaya: RiwayaId,
  mushafId: number,
  surah: number,
) {
  if (riwaya === 'sousi' || riwaya === 'bazzi') {
    const file = join(
      process.cwd(),
      'data',
      'mushaf',
      `${riwaya}.text.json.gz`,
    )

    const bytes = await readFile(file)

    return serialize(
      JSON.parse(
        gunzipSync(bytes).toString('utf8'),
      ),
      surah,
    )
  }

  const response = await fetch(
    `https://api.quranpedia.net/v1/mushafs/${mushafId}/${surah}`,
    {
      headers: {
        Accept: 'application/json',
      },
      cache: 'force-cache',
      signal: AbortSignal.timeout(10000),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Quran source HTTP ${response.status}`,
    )
  }

  return serialize(
    await response.json(),
    surah,
  )
}

export async function GET(request: NextRequest) {
  const riwaya =
    request.nextUrl.searchParams.get('riwaya')

  const surah = Number(
    request.nextUrl.searchParams.get('surah'),
  )

  const definition = RIWAYAT.find(
    (item) => item.id === riwaya,
  )

  if (
    !definition ||
    !Number.isInteger(surah) ||
    surah < 1 ||
    surah > 114
  ) {
    return NextResponse.json(
      {
        error: 'الرواية أو رقم السورة غير صحيح.',
      },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  try {
    const ayahs = await load(
      definition.id,
      definition.mushafId,
      surah,
    )

    return NextResponse.json(
      {
        riwaya: definition.id,
        surah,
        ayahs,
      },
      {
        headers: {
          'Cache-Control':
            'public, max-age=86400, s-maxage=604800',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    )
  } catch {
    return NextResponse.json(
      {
        error:
          'تعذر تحميل نص هذه الرواية حاليًا.',
      },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    )
  }
}