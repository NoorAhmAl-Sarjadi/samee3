'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Archive,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Square,
  Download,
  HardDriveDownload,
  Loader2,
  Mic2,
  Moon,
  Search,
  Smartphone,
  Sun,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react'

const LOGO_URL = 'https://i.ibb.co/MyfNtDp9/8-F026-C85-439-E-4-C5-B-A8-AB-4-ED92-E0-DFB14.png'

const surahsList = [
{ id: 1, name: 'الفاتحة', type: 'مكية', ayahs: 7, startPage: 1 },
  { id: 2, name: 'البقرة', type: 'مدنية', ayahs: 286, startPage: 2 },
  { id: 3, name: 'آل عمران', type: 'مدنية', ayahs: 200, startPage: 50 },
  { id: 4, name: 'النساء', type: 'مدنية', ayahs: 176, startPage: 77 },
  { id: 5, name: 'المائدة', type: 'مدنية', ayahs: 120, startPage: 106 },
  { id: 6, name: 'الأنعام', type: 'مكية', ayahs: 165, startPage: 128 },
  { id: 7, name: 'الأعراف', type: 'مكية', ayahs: 206, startPage: 151 },
  { id: 8, name: 'الأنفال', type: 'مدنية', ayahs: 75, startPage: 177 },
  { id: 9, name: 'التوبة', type: 'مدنية', ayahs: 129, startPage: 187 },
  { id: 10, name: 'يونس', type: 'مكية', ayahs: 109, startPage: 208 },
  { id: 11, name: 'هود', type: 'مكية', ayahs: 123, startPage: 221 },
  { id: 12, name: 'يوسف', type: 'مكية', ayahs: 111, startPage: 235 },
  { id: 13, name: 'الرعد', type: 'مدنية', ayahs: 43, startPage: 249 },
  { id: 14, name: 'إبراهيم', type: 'مكية', ayahs: 52, startPage: 255 },
  { id: 15, name: 'الحجر', type: 'مكية', ayahs: 99, startPage: 262 },
  { id: 16, name: 'النحل', type: 'مكية', ayahs: 128, startPage: 267 },
  { id: 17, name: 'الإسراء', type: 'مكية', ayahs: 111, startPage: 282 },
  { id: 18, name: 'الكهف', type: 'مكية', ayahs: 110, startPage: 293 },
  { id: 19, name: 'مريم', type: 'مكية', ayahs: 98, startPage: 305 },
  { id: 20, name: 'طه', type: 'مكية', ayahs: 135, startPage: 312 },
  { id: 21, name: 'الأنبياء', type: 'مكية', ayahs: 112, startPage: 322 },
  { id: 22, name: 'الحج', type: 'مدنية', ayahs: 78, startPage: 332 },
  { id: 23, name: 'المؤمنون', type: 'مكية', ayahs: 118, startPage: 342 },
  { id: 24, name: 'النور', type: 'مدنية', ayahs: 64, startPage: 350 },
  { id: 25, name: 'الفرقان', type: 'مكية', ayahs: 77, startPage: 359 },
  { id: 26, name: 'الشعراء', type: 'مكية', ayahs: 227, startPage: 367 },
  { id: 27, name: 'النمل', type: 'مكية', ayahs: 93, startPage: 377 },
  { id: 28, name: 'القصص', type: 'مكية', ayahs: 88, startPage: 385 },
  { id: 29, name: 'العنكبوت', type: 'مكية', ayahs: 69, startPage: 396 },
  { id: 30, name: 'الروم', type: 'مكية', ayahs: 60, startPage: 404 },
  { id: 31, name: 'لقمان', type: 'مكية', ayahs: 34, startPage: 411 },
  { id: 32, name: 'السجدة', type: 'مكية', ayahs: 30, startPage: 415 },
  { id: 33, name: 'الأحزاب', type: 'مدنية', ayahs: 73, startPage: 418 },
  { id: 34, name: 'سبأ', type: 'مكية', ayahs: 54, startPage: 428 },
  { id: 35, name: 'فاطر', type: 'مكية', ayahs: 45, startPage: 434 },
  { id: 36, name: 'يس', type: 'مكية', ayahs: 83, startPage: 440 },
  { id: 37, name: 'الصافات', type: 'مكية', ayahs: 182, startPage: 446 },
  { id: 38, name: 'ص', type: 'مكية', ayahs: 88, startPage: 453 },
  { id: 39, name: 'الزمر', type: 'مكية', ayahs: 75, startPage: 458 },
  { id: 40, name: 'غافر', type: 'مكية', ayahs: 85, startPage: 467 },
  { id: 41, name: 'فصلت', type: 'مكية', ayahs: 54, startPage: 477 },
  { id: 42, name: 'الشورى', type: 'مكية', ayahs: 53, startPage: 483 },
  { id: 43, name: 'الزخرف', type: 'مكية', ayahs: 89, startPage: 489 },
  { id: 44, name: 'الدخان', type: 'مكية', ayahs: 59, startPage: 496 },
  { id: 45, name: 'الجاثية', type: 'مكية', ayahs: 37, startPage: 499 },
  { id: 46, name: 'الأحقاف', type: 'مكية', ayahs: 35, startPage: 502 },
  { id: 47, name: 'محمد', type: 'مدنية', ayahs: 38, startPage: 507 },
  { id: 48, name: 'الفتح', type: 'مدنية', ayahs: 29, startPage: 511 },
  { id: 49, name: 'الحجرات', type: 'مدنية', ayahs: 18, startPage: 515 },
  { id: 50, name: 'ق', type: 'مكية', ayahs: 45, startPage: 518 },
  { id: 51, name: 'الذاريات', type: 'مكية', ayahs: 60, startPage: 520 },
  { id: 52, name: 'الطور', type: 'مكية', ayahs: 49, startPage: 523 },
  { id: 53, name: 'النجم', type: 'مكية', ayahs: 62, startPage: 526 },
  { id: 54, name: 'القمر', type: 'مكية', ayahs: 55, startPage: 528 },
  { id: 55, name: 'الرحمن', type: 'مدنية', ayahs: 78, startPage: 531 },
  { id: 56, name: 'الواقعة', type: 'مكية', ayahs: 96, startPage: 534 },
  { id: 57, name: 'الحديد', type: 'مدنية', ayahs: 29, startPage: 537 },
  { id: 58, name: 'المجادلة', type: 'مدنية', ayahs: 22, startPage: 542 },
  { id: 59, name: 'الحشر', type: 'مدنية', ayahs: 24, startPage: 545 },
  { id: 60, name: 'الممتحنة', type: 'مدنية', ayahs: 13, startPage: 549 },
  { id: 61, name: 'الصف', type: 'مدنية', ayahs: 14, startPage: 551 },
  { id: 62, name: 'الجمعة', type: 'مدنية', ayahs: 11, startPage: 553 },
  { id: 63, name: 'المنافقون', type: 'مدنية', ayahs: 11, startPage: 554 },
  { id: 64, name: 'التغابن', type: 'مدنية', ayahs: 18, startPage: 556 },
  { id: 65, name: 'الطلاق', type: 'مدنية', ayahs: 12, startPage: 558 },
  { id: 66, name: 'التحريم', type: 'مدنية', ayahs: 12, startPage: 560 },
  { id: 67, name: 'الملك', type: 'مكية', ayahs: 30, startPage: 562 },
  { id: 68, name: 'القلم', type: 'مكية', ayahs: 52, startPage: 564 },
  { id: 69, name: 'الحاقة', type: 'مكية', ayahs: 52, startPage: 566 },
  { id: 70, name: 'المعارج', type: 'مكية', ayahs: 44, startPage: 568 },
  { id: 71, name: 'نوح', type: 'مكية', ayahs: 28, startPage: 570 },
  { id: 72, name: 'الجن', type: 'مكية', ayahs: 28, startPage: 572 },
  { id: 73, name: 'المزمل', type: 'مكية', ayahs: 20, startPage: 574 },
  { id: 74, name: 'المدثر', type: 'مكية', ayahs: 56, startPage: 575 },
  { id: 75, name: 'القيامة', type: 'مكية', ayahs: 40, startPage: 577 },
  { id: 76, name: 'الإنسان', type: 'مدنية', ayahs: 31, startPage: 578 },
  { id: 77, name: 'المرسلات', type: 'مكية', ayahs: 50, startPage: 580 },
  { id: 78, name: 'النبأ', type: 'مكية', ayahs: 40, startPage: 582 },
  { id: 79, name: 'النازعات', type: 'مكية', ayahs: 46, startPage: 583 },
  { id: 80, name: 'عبس', type: 'مكية', ayahs: 42, startPage: 585 },
  { id: 81, name: 'التكوير', type: 'مكية', ayahs: 29, startPage: 586 },
  { id: 82, name: 'الانفطار', type: 'مكية', ayahs: 19, startPage: 587 },
  { id: 83, name: 'المطففين', type: 'مكية', ayahs: 36, startPage: 587 },
  { id: 84, name: 'الانشقاق', type: 'مكية', ayahs: 25, startPage: 589 },
  { id: 85, name: 'البروج', type: 'مكية', ayahs: 22, startPage: 590 },
  { id: 86, name: 'الطارق', type: 'مكية', ayahs: 17, startPage: 591 },
  { id: 87, name: 'الأعلى', type: 'مكية', ayahs: 19, startPage: 591 },
  { id: 88, name: 'الغاشية', type: 'مكية', ayahs: 26, startPage: 592 },
  { id: 89, name: 'الفجر', type: 'مكية', ayahs: 30, startPage: 593 },
  { id: 90, name: 'البلد', type: 'مكية', ayahs: 20, startPage: 594 },
  { id: 91, name: 'الشمس', type: 'مكية', ayahs: 15, startPage: 595 },
  { id: 92, name: 'الليل', type: 'مكية', ayahs: 21, startPage: 595 },
  { id: 93, name: 'الضحى', type: 'مكية', ayahs: 11, startPage: 596 },
  { id: 94, name: 'الشرح', type: 'مكية', ayahs: 8, startPage: 596 },
  { id: 95, name: 'التين', type: 'مكية', ayahs: 8, startPage: 597 },
  { id: 96, name: 'العلق', type: 'مكية', ayahs: 19, startPage: 597 },
  { id: 97, name: 'القدر', type: 'مكية', ayahs: 5, startPage: 598 },
  { id: 98, name: 'البينة', type: 'مدنية', ayahs: 8, startPage: 598 },
  { id: 99, name: 'الزلزلة', type: 'مدنية', ayahs: 8, startPage: 599 },
  { id: 100, name: 'العاديات', type: 'مكية', ayahs: 11, startPage: 599 },
  { id: 101, name: 'القارعة', type: 'مكية', ayahs: 11, startPage: 600 },
  { id: 102, name: 'التكاثر', type: 'مكية', ayahs: 8, startPage: 600 },
  { id: 103, name: 'العصر', type: 'مكية', ayahs: 3, startPage: 601 },
  { id: 104, name: 'الهمزة', type: 'مكية', ayahs: 9, startPage: 601 },
  { id: 105, name: 'الفيل', type: 'مكية', ayahs: 5, startPage: 601 },
  { id: 106, name: 'قريش', type: 'مكية', ayahs: 4, startPage: 602 },
  { id: 107, name: 'الماعون', type: 'مكية', ayahs: 7, startPage: 602 },
  { id: 108, name: 'الكوثر', type: 'مكية', ayahs: 3, startPage: 602 },
  { id: 109, name: 'الكافرون', type: 'مكية', ayahs: 6, startPage: 603 },
  { id: 110, name: 'النصر', type: 'مدنية', ayahs: 3, startPage: 603 },
  { id: 111, name: 'المسد', type: 'مكية', ayahs: 5, startPage: 603 },
  { id: 112, name: 'الإخلاص', type: 'مكية', ayahs: 4, startPage: 604 },
  { id: 113, name: 'الفلق', type: 'مكية', ayahs: 5, startPage: 604 },
  { id: 114, name: 'الناس', type: 'مكية', ayahs: 6, startPage: 604 }
]

const RIWAYAT = [
  { id: 'hafs', label: 'حفص عن عاصم', keywords: ['حفص', 'عاصم'] },
  { id: 'warsh', label: 'ورش عن نافع', keywords: ['ورش', 'نافع'] },
  { id: 'qalun', label: 'قالون عن نافع', keywords: ['قالون', 'نافع'] },
  { id: 'douri', label: 'الدوري عن أبي عمرو', keywords: ['الدوري', 'أبي عمرو', 'ابي عمرو'] },
  { id: 'shubah', label: 'شعبة عن عاصم', keywords: ['شعبة', 'شعبه', 'عاصم'] },
  { id: 'sousi', label: 'السوسي عن أبي عمرو', keywords: ['السوسي', 'أبي عمرو', 'ابي عمرو'] },
  { id: 'bazzi', label: 'البزي عن ابن كثير', keywords: ['البزي', 'ابن كثير'] },
] as const

type RiwayaId = (typeof RIWAYAT)[number]['id']
type FilterType = 'all' | 'مكية' | 'مدنية'
type PanelType = 'surahs' | 'juz' | null

type ApiMoshaf = {
  id?: number
  name?: string
  server?: string
  surah_total?: number
  moshaf_type?: number
  surah_list?: string
}

type ApiReciter = {
  id: number
  name: string
  moshaf?: ApiMoshaf[]
}

type ApiRiwaya = {
  id: number
  name: string
}

type Reciter = {
  id: string
  apiId: number
  label: string
  moshaf: ApiMoshaf
}

type OfflinePackage = {
  key: string
  riwayaId: RiwayaId
  reciterApiId: number
  reciterLabel: string
  moshafId: number | null
  server: string
  surahIds: number[]
  downloadedSurahIds: number[]
  status: 'complete' | 'partial'
  downloadedAt: string
}

const OFFLINE_PACKAGES_KEY = 'samee3_offline_packages_v1'
const OFFLINE_AUDIO_CACHE = 'samee3-quran-audio-v1'


function pad3(value: number) {
  return String(value).padStart(3, '0')
}

function getOfflinePackageKey(riwayaId: RiwayaId, reciterApiId: number, moshafId?: number) {
  return `${riwayaId}:${reciterApiId}:${moshafId ?? 'default'}`
}

function readOfflinePackages(): OfflinePackage[] {
  try {
    const raw = localStorage.getItem(OFFLINE_PACKAGES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(
        (item) =>
          !!item &&
          typeof item.key === 'string' &&
          typeof item.riwayaId === 'string' &&
          typeof item.reciterApiId === 'number' &&
          typeof item.reciterLabel === 'string' &&
          typeof item.server === 'string' &&
          Array.isArray(item.surahIds),
      )
      .map((item) => {
        const downloadedSurahIds = Array.isArray(item.downloadedSurahIds)
          ? item.downloadedSurahIds
          : item.surahIds

        const status =
          item.status === 'partial' || item.status === 'complete'
            ? item.status
            : 'complete'

        return {
          key: String(item.key),
          riwayaId: item.riwayaId as RiwayaId,
          reciterApiId: Number(item.reciterApiId),
          reciterLabel: String(item.reciterLabel),
          moshafId:
            typeof item.moshafId === 'number' ? item.moshafId : null,
          server: String(item.server),
          surahIds: Array.isArray(item.surahIds)
            ? item.surahIds
                .map(Number)
                .filter((id: number) => Number.isInteger(id) && id >= 1 && id <= 114)
            : [],
          downloadedSurahIds: downloadedSurahIds
            .map(Number)
            .filter((id: number) => Number.isInteger(id) && id >= 1 && id <= 114),
          status,
          downloadedAt: String(item.downloadedAt || ''),
        } satisfies OfflinePackage
      })
  } catch {
    return []
  }
}

function writeOfflinePackages(packages: OfflinePackage[]) {
  try {
    localStorage.setItem(OFFLINE_PACKAGES_KEY, JSON.stringify(packages))
  } catch {
    // تجاهل فشل التخزين المحلي
  }
}

type SearchMatch = {
  number: number
  numberInSurah: number
  text: string
  page?: number
  juz?: number
  surah?: { number: number; name: string }
}

const JUZ_LIST = [
  { number: 1, page: 1, surah: 1, ayah: 1 },
  { number: 2, page: 22, surah: 2, ayah: 142 },
  { number: 3, page: 42, surah: 2, ayah: 253 },
  { number: 4, page: 62, surah: 3, ayah: 92 },
  { number: 5, page: 82, surah: 4, ayah: 24 },
  { number: 6, page: 102, surah: 5, ayah: 83 },
  { number: 7, page: 122, surah: 6, ayah: 111 },
  { number: 8, page: 142, surah: 7, ayah: 88 },
  { number: 9, page: 162, surah: 8, ayah: 41 },
  { number: 10, page: 182, surah: 9, ayah: 93 },
  { number: 11, page: 202, surah: 10, ayah: 26 },
  { number: 12, page: 222, surah: 11, ayah: 6 },
  { number: 13, page: 242, surah: 12, ayah: 53 },
  { number: 14, page: 262, surah: 15, ayah: 1 },
  { number: 15, page: 282, surah: 17, ayah: 1 },
  { number: 16, page: 302, surah: 18, ayah: 75 },
  { number: 17, page: 322, surah: 21, ayah: 1 },
  { number: 18, page: 342, surah: 23, ayah: 1 },
  { number: 19, page: 362, surah: 25, ayah: 21 },
  { number: 20, page: 382, surah: 27, ayah: 56 },
  { number: 21, page: 402, surah: 29, ayah: 45 },
  { number: 22, page: 422, surah: 33, ayah: 31 },
  { number: 23, page: 442, surah: 36, ayah: 28 },
  { number: 24, page: 462, surah: 39, ayah: 32 },
  { number: 25, page: 482, surah: 41, ayah: 47 },
  { number: 26, page: 502, surah: 46, ayah: 1 },
  { number: 27, page: 522, surah: 51, ayah: 31 },
  { number: 28, page: 542, surah: 58, ayah: 1 },
  { number: 29, page: 562, surah: 67, ayah: 1 },
  { number: 30, page: 582, surah: 78, ayah: 1 },
] as const

function toArabicNumber(value: number) {
  return String(value).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])
}

function normalizeArabic(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
}

type JuzRange = {
  number: number
  startSurah: number
  startAyah: number
  endSurah: number
  endAyah: number
}

function getJuzRange(juzNumber: number): JuzRange | null {
  const index = JUZ_LIST.findIndex((item) => item.number === juzNumber)
  if (index < 0) return null

  const start = JUZ_LIST[index]
  const next = JUZ_LIST[index + 1]

  if (!next) {
    const lastSurah = surahsList.find((item) => item.id === 114)
    return {
      number: start.number,
      startSurah: start.surah,
      startAyah: start.ayah,
      endSurah: 114,
      endAyah: lastSurah?.ayahs || 6,
    }
  }

  if (next.ayah > 1) {
    return {
      number: start.number,
      startSurah: start.surah,
      startAyah: start.ayah,
      endSurah: next.surah,
      endAyah: next.ayah - 1,
    }
  }

  const previousSurah = surahsList.find((item) => item.id === next.surah - 1)

  return {
    number: start.number,
    startSurah: start.surah,
    startAyah: start.ayah,
    endSurah: Math.max(1, next.surah - 1),
    endAyah: previousSurah?.ayahs || 1,
  }
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff

  for (let index = 0; index < data.length; index += 1) {
    crc ^= data[index]

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }

  return (crc ^ 0xffffffff) >>> 0
}

function writeU16(value: number) {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
  ])
}

function writeU32(value: number) {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ])
}

function concatUint8Arrays(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(total)

  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return result
}

async function compressForZip(data: Uint8Array) {
  if (typeof CompressionStream !== 'function') {
    return { data, method: 0 as const }
  }

  try {
    const CompressionStreamCtor = CompressionStream as unknown as new (
      format: string,
    ) => CompressionStream

    try {
      const rawStream = new CompressionStreamCtor('deflate-raw')
      const writer = rawStream.writable.getWriter()
      const rawInputBuffer = new ArrayBuffer(data.byteLength)
      new Uint8Array(rawInputBuffer).set(data)
      await writer.write(rawInputBuffer)
      await writer.close()

      const compressed = new Uint8Array(await new Response(rawStream.readable).arrayBuffer())

      if (compressed.length < data.length) {
        return { data: compressed, method: 8 as const }
      }
    } catch {
      // بعض المتصفحات لا تدعم deflate-raw، فنجرّب deflate الطبيعي ثم ننزع غلاف zlib.
    }

    const zlibStream = new CompressionStreamCtor('deflate')
    const zlibWriter = zlibStream.writable.getWriter()
    const zlibInputBuffer = new ArrayBuffer(data.byteLength)
    new Uint8Array(zlibInputBuffer).set(data)
    await zlibWriter.write(zlibInputBuffer)
    await zlibWriter.close()

    const wrapped = new Uint8Array(
      await new Response(zlibStream.readable).arrayBuffer(),
    )

    // ZIP يحتاج stream خام DEFLATE، بينما format=deflate يعيد zlib wrapper.
    if (wrapped.length > 6) {
      const raw = wrapped.slice(2, -4)
      if (raw.length < data.length) {
        return { data: raw, method: 8 as const }
      }
    }
  } catch {
    // نكمل بملف ZIP صحيح حتى لو لم يتوفر الضغط الأصلي.
  }

  return { data, method: 0 as const }
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
}

async function buildZipBlob(
  entries: Array<{ name: string; data: Uint8Array }>,
  signal: AbortSignal,
) {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    if (signal.aborted) {
      throw new DOMException('تم إيقاف إنشاء الملف المضغوط', 'AbortError')
    }

    const nameBytes = new TextEncoder().encode(entry.name)
    const crc = crc32(entry.data)
    const packed = await compressForZip(entry.data)
    const flags = 0x0800

    const localHeader = concatUint8Arrays([
      writeU32(0x04034b50),
      writeU16(20),
      writeU16(flags),
      writeU16(packed.method),
      writeU16(0),
      writeU16(0),
      writeU32(crc),
      writeU32(packed.data.length),
      writeU32(entry.data.length),
      writeU16(nameBytes.length),
      writeU16(0),
      nameBytes,
    ])

    localParts.push(localHeader, packed.data)

    const centralHeader = concatUint8Arrays([
      writeU32(0x02014b50),
      writeU16(20),
      writeU16(20),
      writeU16(flags),
      writeU16(packed.method),
      writeU16(0),
      writeU16(0),
      writeU32(crc),
      writeU32(packed.data.length),
      writeU32(entry.data.length),
      writeU16(nameBytes.length),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU16(0),
      writeU32(0),
      writeU32(offset),
      nameBytes,
    ])

    centralParts.push(centralHeader)
    offset += localHeader.length + packed.data.length
  }

  const centralDirectory = concatUint8Arrays(centralParts)
  const localData = concatUint8Arrays(localParts)

  const endRecord = concatUint8Arrays([
    writeU32(0x06054b50),
    writeU16(0),
    writeU16(0),
    writeU16(entries.length),
    writeU16(entries.length),
    writeU32(centralDirectory.length),
    writeU32(localData.length),
    writeU16(0),
  ])

  return new Blob([localData, centralDirectory, endRecord], {
    type: 'application/zip',
  })
}

function getRiwaya(id: RiwayaId) {
  return RIWAYAT.find((item) => item.id === id) || RIWAYAT[0]
}

function matchesRemoteRiwaya(remoteName: string, local: typeof RIWAYAT[number]) {
  const name = normalizeArabic(remoteName)
  const first = normalizeArabic(local.keywords[0])

  if (local.id === 'hafs' || local.id === 'shubah') {
    return name.includes(first) && name.includes(normalizeArabic('عاصم'))
  }

  if (local.id === 'warsh' || local.id === 'qalun') {
    return name.includes(first) && name.includes(normalizeArabic('نافع'))
  }

  if (local.id === 'douri' || local.id === 'sousi') {
    return name.includes(first)
  }

  if (local.id === 'bazzi') {
    return name.includes(first)
  }

  return name.includes(first)
}

function getMoshaf(reciter: ApiReciter, local: typeof RIWAYAT[number]) {
  const list = Array.isArray(reciter.moshaf) ? reciter.moshaf : []

  // لا نأخذ أول مصحف كبديل؛ لأن ذلك قد يعرض قارئًا لا يملك الرواية المختارة.
  return (
    list.find((item) => {
      const name = normalizeArabic(String(item.name || ''))
      return local.keywords.some((keyword) =>
        name.includes(normalizeArabic(keyword)),
      )
    }) || null
  )
}

function parseSurahList(value?: string) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 114)
}

export default function QuranIndexPage() {
  const [riwaya, setRiwaya] = useState<RiwayaId>('hafs')
  const [riwayaSearch, setRiwayaSearch] = useState('')
  const [reciterSearch, setReciterSearch] = useState('')
  const [reciterOpen, setReciterOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [panel, setPanel] = useState<PanelType>(null)

  const [apiRiwayat, setApiRiwayat] = useState<ApiRiwaya[]>([])
  const [reciters, setReciters] = useState<Reciter[]>([])
  const [selectedReciter, setSelectedReciter] = useState<Reciter | null>(null)
  const [recitersLoading, setRecitersLoading] = useState(false)
  const [recitersError, setRecitersError] = useState('')
  const selectedReciterApiIdRef = useRef<number | null>(null)

  const [ayahResults, setAyahResults] = useState<SearchMatch[]>([])
  const [ayahSearching, setAyahSearching] = useState(false)
  const [ayahSearchError, setAyahSearchError] = useState('')

  const [offlinePackages, setOfflinePackages] = useState<OfflinePackage[]>([])
  const [offlineDownloading, setOfflineDownloading] = useState(false)
  const [offlineDownloadProgress, setOfflineDownloadProgress] = useState(0)
  const [offlineDownloadLabel, setOfflineDownloadLabel] = useState('')
  const [offlineError, setOfflineError] = useState('')

  const [deviceDownloading, setDeviceDownloading] = useState(false)
  const [deviceDownloadProgress, setDeviceDownloadProgress] = useState(0)
  const [deviceDownloadLabel, setDeviceDownloadLabel] = useState('')

  const [surahOfflineDownloading, setSurahOfflineDownloading] = useState<number | null>(null)
  const [surahDeviceDownloading, setSurahDeviceDownloading] = useState<number | null>(null)

  const offlineAbortRef = useRef<AbortController | null>(null)
  const deviceAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    try {
      const savedRiwaya = localStorage.getItem('samee3_selected_riwaya_v2') as RiwayaId | null
      const savedReciter = localStorage.getItem('samee3_selected_reciter_v2')

      if (savedRiwaya && RIWAYAT.some((item) => item.id === savedRiwaya)) {
        setRiwaya(savedRiwaya)
      }

      if (savedReciter) {
        const parsed = JSON.parse(savedReciter) as Partial<Reciter>
        if (parsed?.apiId) {
          selectedReciterApiIdRef.current = Number(parsed.apiId)
        }
      }
    } catch {
      // تجاهل أخطاء التخزين المحلي
    }
  }, [])

  useEffect(() => {
    setOfflinePackages(readOfflinePackages())
  }, [])

  const loadRiwayat = useCallback(async () => {
    try {
      const response = await fetch('https://mp3quran.net/api/v3/riwayat?language=ar', {
        cache: 'no-store',
      })

      if (!response.ok) throw new Error('Failed to load riwayat')

      const payload = await response.json()
      setApiRiwayat(Array.isArray(payload?.riwayat) ? payload.riwayat : [])
    } catch (error) {
      console.error('Riwayat load error:', error)
      setApiRiwayat([])
      setRecitersError('تعذر الاتصال بمصدر الروايات الصوتية الآن.')
    }
  }, [])

  useEffect(() => {
    void loadRiwayat()
  }, [loadRiwayat])

  const loadRecitersForRiwaya = useCallback(async (riwayaId: RiwayaId) => {
    const localRiwaya = getRiwaya(riwayaId)
    const downloadedForRiwaya = offlinePackages.filter(
      (item) => item.riwayaId === riwayaId,
    )

    setRecitersLoading(true)

    const createOfflineReciters = (): Reciter[] =>
      downloadedForRiwaya.map((pkg) => ({
        id: `offline-${pkg.key}`,
        apiId: pkg.reciterApiId,
        label: pkg.reciterLabel,
        moshaf: {
          id: pkg.moshafId ?? undefined,
          name: `${localRiwaya.label} — محفوظ دون اتصال`,
          server: pkg.server,
          surah_total: pkg.surahIds.length,
          moshaf_type: undefined,
          surah_list: pkg.surahIds.join(','),
        },
      }))

    // عند انقطاع الإنترنت نستطيع إظهار القارئ المحفوظ محليًا دون الحاجة للمصدر.
    if (!apiRiwayat.length) {
      const offlineReciters = createOfflineReciters()
      setReciters(offlineReciters)
      setSelectedReciter((current) =>
        current && offlineReciters.some((item) => item.id === current.id)
          ? current
          : offlineReciters[0] || null,
      )
      setRecitersLoading(false)
      if (!offlineReciters.length) {
        setRecitersError('لا توجد بيانات قراء محفوظة لهذا الجهاز في وضع عدم الاتصال.')
      }
      return
    }

    const remoteRiwaya = apiRiwayat.find((item) => matchesRemoteRiwaya(item.name, localRiwaya))

    setRecitersError('')
    setReciters([])
    setSelectedReciter(null)
    setPanel(null)

    try {
      if (!remoteRiwaya) {
        throw new Error(`No source rewaya id for ${localRiwaya.label}`)
      }

      const response = await fetch(
        `https://mp3quran.net/api/v3/reciters?language=ar&rewaya=${remoteRiwaya.id}`,
        { cache: 'no-store' },
      )

      if (!response.ok) throw new Error('Failed to load reciters for rewaya')

      const payload = await response.json()
      const sourceReciters: ApiReciter[] = Array.isArray(payload?.reciters)
        ? payload.reciters
        : []

      const nextReciters = sourceReciters
        .map((item) => {
          const moshaf = getMoshaf(item, localRiwaya)
          if (!moshaf?.server || !moshaf?.surah_list) return null

          const reciter: Reciter = {
            id: `mp3quran-${item.id}-${moshaf.id ?? riwayaId}`,
            apiId: Number(item.id),
            label: String(item.name || `قارئ ${item.id}`),
            moshaf,
          }

          return reciter
        })
        .filter((item): item is Reciter => item !== null)

      for (const pkg of downloadedForRiwaya) {
        const exists = nextReciters.some(
          (item) =>
            item.apiId === pkg.reciterApiId &&
            (item.moshaf.id ?? null) === pkg.moshafId,
        )

        if (!exists) {
          nextReciters.push({
            id: `offline-${pkg.key}`,
            apiId: pkg.reciterApiId,
            label: pkg.reciterLabel,
            moshaf: {
              id: pkg.moshafId ?? undefined,
              name: `${localRiwaya.label} — محفوظ دون اتصال`,
              server: pkg.server,
              surah_total: pkg.surahIds.length,
              moshaf_type: undefined,
              surah_list: pkg.surahIds.join(','),
            },
          })
        }
      }

      const uniqueReciters = Array.from(
        new Map(nextReciters.map((item) => [`${item.apiId}-${item.moshaf.id ?? riwayaId}`, item])).values(),
      )

      uniqueReciters.sort((a, b) => {
        const aDownloaded = offlinePackages.some(
          (item) =>
            item.riwayaId === riwayaId &&
            item.reciterApiId === a.apiId &&
            item.moshafId === (a.moshaf.id ?? null),
        )
        const bDownloaded = offlinePackages.some(
          (item) =>
            item.riwayaId === riwayaId &&
            item.reciterApiId === b.apiId &&
            item.moshafId === (b.moshaf.id ?? null),
        )

        if (aDownloaded && !bDownloaded) return -1
        if (!aDownloaded && bDownloaded) return 1

        const priority = [
          'مشاري',
          'العفاسي',
          'الحصري',
          'المنشاوي',
          'ماهر',
          'عبد الباسط',
          'السديس',
          'الدوسري',
          'الشريم',
        ]

        const ai = priority.findIndex((name) => normalizeArabic(a.label).includes(normalizeArabic(name)))
        const bi = priority.findIndex((name) => normalizeArabic(b.label).includes(normalizeArabic(name)))

        if (ai !== -1 && bi === -1) return -1
        if (ai === -1 && bi !== -1) return 1
        if (ai !== -1 && bi !== -1 && ai !== bi) return ai - bi

        return a.label.localeCompare(b.label, 'ar')
      })

      setReciters(uniqueReciters)

      if (uniqueReciters.length) {
        const restored = selectedReciterApiIdRef.current != null
          ? uniqueReciters.find((item) => item.apiId === selectedReciterApiIdRef.current)
          : undefined

        const initial = restored || uniqueReciters[0]
        setSelectedReciter(initial)
        selectedReciterApiIdRef.current = initial.apiId

        try {
          localStorage.setItem('samee3_selected_reciter_v2', JSON.stringify(initial))
        } catch {}
      } else {
        setRecitersError('لا توجد تسجيلات لهذه الرواية في المصدر حاليًا.')
      }
    } catch (error) {
      console.error('Reciters by riwaya error:', error)
      setRecitersError('تعذر تحميل القراء الخاصين بهذه الرواية حاليًا.')
    } finally {
      setRecitersLoading(false)
    }
  }, [apiRiwayat, offlinePackages])

  useEffect(() => {
    void loadRecitersForRiwaya(riwaya)
  }, [apiRiwayat, loadRecitersForRiwaya, offlinePackages, riwaya])

  const handleRiwayaChange = (value: RiwayaId) => {
    setRiwaya(value)
    setPanel(null)
    setReciterOpen(false)
    setReciterSearch('')
    try {
      localStorage.setItem('samee3_selected_riwaya_v2', value)
    } catch {}
  }

  const handleReciterChange = (value: Reciter) => {
    selectedReciterApiIdRef.current = value.apiId
    setSelectedReciter(value)
    setReciterSearch(value.label)
    setReciterOpen(false)
    try {
      localStorage.setItem('samee3_selected_reciter_v2', JSON.stringify(value))
    } catch {}
  }

  const filteredRiwayat = useMemo(() => {
    const term = normalizeArabic(riwayaSearch)
    const result = RIWAYAT.filter((item) => !term || normalizeArabic(item.label).includes(term))
    const current = result.find((item) => item.id === riwaya)
    return current ? [current, ...result.filter((item) => item.id !== riwaya)] : result
  }, [riwaya, riwayaSearch])

  const isReciterDownloaded = (item: Reciter) =>
    offlinePackages.some(
      (pkg) =>
        pkg.riwayaId === riwaya &&
        pkg.reciterApiId === item.apiId &&
        pkg.moshafId === (item.moshaf.id ?? null) &&
        pkg.downloadedSurahIds.length > 0,
    )

  const filteredReciters = useMemo(() => {
    const term = normalizeArabic(reciterSearch)

    const result = reciters.filter((item) =>
      !term || normalizeArabic(item.label).includes(term),
    )

    result.sort((a, b) => {
      const aDownloaded = isReciterDownloaded(a)
      const bDownloaded = isReciterDownloaded(b)

      if (aDownloaded && !bDownloaded) return -1
      if (!aDownloaded && bDownloaded) return 1

      const aStarts = term && normalizeArabic(a.label).startsWith(term)
      const bStarts = term && normalizeArabic(b.label).startsWith(term)

      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1

      return a.label.localeCompare(b.label, 'ar')
    })

    if (
      selectedReciter &&
      !result.some((item) => item.id === selectedReciter.id) &&
      (!term || normalizeArabic(selectedReciter.label).includes(term))
    ) {
      return [selectedReciter, ...result]
    }

    return result
  }, [reciterSearch, reciters, selectedReciter, offlinePackages, riwaya])

  const availableSurahIds = useMemo(() =>
    selectedReciter ? parseSurahList(selectedReciter.moshaf.surah_list) : [],
    [selectedReciter],
  )

  const selectedOfflinePackage = useMemo(() => {
    if (!selectedReciter) return null

    return (
      offlinePackages.find(
        (item) =>
          item.riwayaId === riwaya &&
          item.reciterApiId === selectedReciter.apiId &&
          item.moshafId === (selectedReciter.moshaf.id ?? null),
      ) || null
    )
  }, [offlinePackages, riwaya, selectedReciter])

  const selectedOfflineCount = selectedOfflinePackage?.downloadedSurahIds.length || 0
  const selectedOfflineTotal = selectedOfflinePackage?.surahIds.length || availableSurahIds.length
  const selectedOfflineComplete =
    !!selectedOfflinePackage &&
    selectedOfflinePackage.status === 'complete' &&
    selectedOfflineCount >= selectedOfflineTotal

  const getAudioUrl = (surahId: number) => {
    const server = selectedReciter?.moshaf.server || ''
    const normalizedServer = server.endsWith('/') ? server : `${server}/`
    return `${normalizedServer}${pad3(surahId)}.mp3`
  }

  const saveBlobToDevice = (blob: Blob, filename: string) => {
    const blobUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = filename
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)
  }

  const downloadSurahToDevice = async (surahId: number) => {
    if (!selectedReciter || surahDeviceDownloading != null || deviceDownloading) return

    const audioUrl = getAudioUrl(surahId)
    if (!audioUrl) return

    setOfflineError('')
    setSurahDeviceDownloading(surahId)
    setDeviceDownloadLabel(`جاري تنزيل سورة ${surahsList.find((item) => item.id === surahId)?.name || surahId}...`)

    try {
      const response = await fetch(audioUrl, {
        cache: 'no-store',
        mode: 'cors',
      })

      if (!response.ok) {
        throw new Error(`تعذر تنزيل السورة ${surahId}`)
      }

      const blob = await response.blob()
      const surahName = surahsList.find((item) => item.id === surahId)?.name || `السورة ${surahId}`
      saveBlobToDevice(
        blob,
        `${pad3(surahId)} - ${sanitizeFilename(surahName)}.mp3`,
      )
      setDeviceDownloadLabel(`تم تنزيل سورة ${surahName} على الجهاز.`)
    } catch (error) {
      console.error('Single surah device download error:', error)
      setOfflineError('تعذر تنزيل السورة على الجهاز. تحقق من الاتصال ومصدر الصوت.')
    } finally {
      setSurahDeviceDownloading(null)
    }
  }

  const downloadSurahOffline = async (surahId: number) => {
    if (!selectedReciter || surahOfflineDownloading != null || offlineDownloading) return

    if (!selectedReciter.moshaf.server) {
      setOfflineError('لا يوجد مصدر صوتي صالح لهذه السورة.')
      return
    }

    const audioUrl = getAudioUrl(surahId)
    setOfflineError('')
    setSurahOfflineDownloading(surahId)

    try {
      if (typeof window === 'undefined' || !('caches' in window)) {
        throw new Error('Cache Storage غير متاح في هذا المتصفح.')
      }

      const response = await fetch(audioUrl, {
        cache: 'no-store',
        mode: 'cors',
      })

      if (!response.ok) {
        throw new Error(`تعذر حفظ السورة ${surahId}`)
      }

      const cache = await caches.open(OFFLINE_AUDIO_CACHE)
      await cache.put(audioUrl, response.clone())

      const key = getOfflinePackageKey(
        riwaya,
        selectedReciter.apiId,
        selectedReciter.moshaf.id,
      )
      const previous = offlinePackages.find((item) => item.key === key)
      const surahIds = parseSurahList(selectedReciter.moshaf.surah_list)
      const already = new Set<number>(previous?.downloadedSurahIds || [])
      already.add(surahId)

      const pkg: OfflinePackage = {
        key,
        riwayaId: riwaya,
        reciterApiId: selectedReciter.apiId,
        reciterLabel: selectedReciter.label,
        moshafId: selectedReciter.moshaf.id ?? null,
        server: selectedReciter.moshaf.server || '',
        surahIds,
        downloadedSurahIds: Array.from(already).sort((a, b) => a - b),
        status: surahIds.length > 0 && surahIds.every((id) => already.has(id))
          ? 'complete'
          : 'partial',
        downloadedAt: new Date().toISOString(),
      }

      const nextPackages = [
        ...offlinePackages.filter((item) => item.key !== key),
        pkg,
      ]

      writeOfflinePackages(nextPackages)
      setOfflinePackages(nextPackages)
      setOfflineDownloadProgress(Math.round((pkg.downloadedSurahIds.length / Math.max(1, surahIds.length)) * 100))
      setOfflineDownloadLabel(`تم حفظ سورة ${surahsList.find((item) => item.id === surahId)?.name || surahId} دون اتصال.`)
    } catch (error) {
      console.error('Single surah offline error:', error)
      setOfflineError('تعذر حفظ السورة دون اتصال. تحقق من الاتصال ثم أعد المحاولة.')
    } finally {
      setSurahOfflineDownloading(null)
    }
  }

  const isSurahOfflineDownloaded = (surahId: number) =>
    !!selectedOfflinePackage?.downloadedSurahIds.includes(surahId)

  const cancelOfflineDownload = () => {
    offlineAbortRef.current?.abort()
  }

  const cancelDeviceDownload = () => {
    deviceAbortRef.current?.abort()
  }

  const removeOfflinePackage = async (pkg: OfflinePackage) => {
    try {
      if ('caches' in window) {
        const cache = await caches.open(OFFLINE_AUDIO_CACHE)
        const server = pkg.server.endsWith('/') ? pkg.server : `${pkg.server}/`

        for (const surahId of pkg.downloadedSurahIds) {
          const audioUrl = `${server}${pad3(surahId)}.mp3`
          await cache.delete(audioUrl)
        }
      }

      const nextPackages = offlinePackages.filter(
        (item) => item.key !== pkg.key,
      )

      writeOfflinePackages(nextPackages)
      setOfflinePackages(nextPackages)

      if (
        selectedReciter &&
        pkg.reciterApiId === selectedReciter.apiId &&
        pkg.riwayaId === riwaya
      ) {
        setOfflineDownloadProgress(0)
        setOfflineDownloadLabel('تمت إزالة النسخة المحفوظة من هذا الجهاز.')
      }
    } catch (error) {
      console.error('Remove offline package error:', error)
      setOfflineError('تعذر إزالة النسخة المحفوظة حاليًا.')
    }
  }

  const downloadSelectedReciterToDevice = async () => {
    if (!selectedReciter || deviceDownloading) return

    const surahIds = parseSurahList(selectedReciter.moshaf.surah_list)

    if (!surahIds.length) {
      setOfflineError('لا توجد ملفات صوتية متاحة لهذا القارئ في الرواية المختارة.')
      return
    }

    if (!selectedReciter.moshaf.server) {
      setOfflineError('لا يوجد مصدر صوتي صالح لهذا القارئ.')
      return
    }

    setOfflineError('')
    setDeviceDownloading(true)
    setDeviceDownloadProgress(0)
    setDeviceDownloadLabel('جاري تجهيز ملف ZIP...')

    const controller = new AbortController()
    deviceAbortRef.current = controller

    try {
      const entries: Array<{ name: string; data: Uint8Array }> = []

      for (let index = 0; index < surahIds.length; index += 1) {
        if (controller.signal.aborted) {
          throw new DOMException('تم إيقاف تنزيل الملف المضغوط', 'AbortError')
        }

        const surahId = surahIds[index]
        const surahName =
          surahsList.find((item) => item.id === surahId)?.name || `السورة ${surahId}`

        setDeviceDownloadLabel(
          `جاري جلب ${surahName} (${toArabicNumber(index + 1)} من ${toArabicNumber(surahIds.length)})...`,
        )

        const response = await fetch(getAudioUrl(surahId), {
          cache: 'no-store',
          mode: 'cors',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`تعذر جلب ${surahName}`)
        }

        const data = new Uint8Array(await response.arrayBuffer())
        entries.push({
          name: `${pad3(surahId)} - ${sanitizeFilename(surahName)}.mp3`,
          data,
        })

        setDeviceDownloadProgress(
          Math.round(((index + 1) / surahIds.length) * 70),
        )
      }

      setDeviceDownloadLabel('جاري ضغط ملفات التلاوة في ملف ZIP واحد...')

      const zipBlob = await buildZipBlob(entries, controller.signal)

      if (controller.signal.aborted) {
        throw new DOMException('تم إيقاف تنزيل الملف المضغوط', 'AbortError')
      }

      setDeviceDownloadProgress(95)

      const filename =
        `${sanitizeFilename(selectedReciter.label)} - ${sanitizeFilename(getRiwaya(riwaya).label)}.zip`

      saveBlobToDevice(zipBlob, filename)
      setDeviceDownloadProgress(100)
      setDeviceDownloadLabel('تم تنزيل المصحف كاملًا في ملف ZIP واحد.')
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') {
        setDeviceDownloadLabel('تم إيقاف تجهيز ملف ZIP.')
      } else {
        console.error('ZIP download error:', error)
        setOfflineError(
          'تعذر إنشاء ملف ZIP. قد يمنع المتصفح تحميل الملفات أو قد يتعذر الوصول إلى مصدر الصوت.',
        )
      }
    } finally {
      deviceAbortRef.current = null
      setDeviceDownloading(false)
    }
  }

  const downloadSelectedReciterOffline = async () => {
    if (!selectedReciter || offlineDownloading) return

    if (!selectedReciter.moshaf.server) {
      setOfflineError('لا يوجد رابط صوتي صالح لهذا القارئ في المصدر.')
      return
    }

    const surahIds = parseSurahList(selectedReciter.moshaf.surah_list)

    if (!surahIds.length) {
      setOfflineError('لا توجد سور متاحة للتحميل لهذا القارئ في الرواية المختارة.')
      return
    }

    setOfflineError('')
    setOfflineDownloading(true)
    setOfflineDownloadProgress(0)
    setOfflineDownloadLabel('تهيئة الحفظ داخل مصحف سميع...')

    const controller = new AbortController()
    offlineAbortRef.current = controller

    const server = selectedReciter.moshaf.server.endsWith('/')
      ? selectedReciter.moshaf.server
      : `${selectedReciter.moshaf.server}/`

    const key = getOfflinePackageKey(
      riwaya,
      selectedReciter.apiId,
      selectedReciter.moshaf.id,
    )

    const previous = offlinePackages.find((item) => item.key === key)
    const alreadyDownloaded = new Set<number>(
      previous?.downloadedSurahIds || [],
    )

    try {
      if (typeof window === 'undefined' || !('caches' in window)) {
        throw new Error('Cache Storage غير متاح في هذا المتصفح.')
      }

      const cache = await caches.open(OFFLINE_AUDIO_CACHE)

      for (let index = 0; index < surahIds.length; index += 1) {
        if (controller.signal.aborted) {
          throw new DOMException('تم إيقاف الحفظ', 'AbortError')
        }

        const surahId = surahIds[index]
        const audioUrl = `${server}${pad3(surahId)}.mp3`

        if (alreadyDownloaded.has(surahId)) {
          setOfflineDownloadProgress(
            Math.round(((index + 1) / surahIds.length) * 100),
          )
          continue
        }

        setOfflineDownloadLabel(
          `جاري حفظ ${surahsList.find((item) => item.id === surahId)?.name || `السورة ${surahId}`}...`,
        )

        let response: Response

        try {
          response = await fetch(audioUrl, {
            cache: 'no-store',
            mode: 'cors',
            signal: controller.signal,
          })
        } catch (error) {
          if ((error as DOMException)?.name === 'AbortError') throw error

          response = await fetch(audioUrl, {
            cache: 'no-store',
            mode: 'no-cors',
            signal: controller.signal,
          })
        }

        if (!response.ok && response.type !== 'opaque') {
          throw new Error(`فشل حفظ السورة رقم ${surahId}`)
        }

        await cache.put(audioUrl, response.clone())
        alreadyDownloaded.add(surahId)

        setOfflineDownloadProgress(
          Math.round(((index + 1) / surahIds.length) * 100),
        )
      }

      const complete = surahIds.every((id) => alreadyDownloaded.has(id))

      const pkg: OfflinePackage = {
        key,
        riwayaId: riwaya,
        reciterApiId: selectedReciter.apiId,
        reciterLabel: selectedReciter.label,
        moshafId: selectedReciter.moshaf.id ?? null,
        server,
        surahIds,
        downloadedSurahIds: Array.from(alreadyDownloaded),
        status: complete ? 'complete' : 'partial',
        downloadedAt: new Date().toISOString(),
      }

      const nextPackages = [
        ...offlinePackages.filter((item) => item.key !== pkg.key),
        pkg,
      ]

      writeOfflinePackages(nextPackages)
      setOfflinePackages(nextPackages)
      setOfflineDownloadProgress(100)
      setOfflineDownloadLabel(
        complete
          ? 'تم حفظ تلاوة القارئ كاملة داخل مصحف سميع لتعمل دون اتصال.'
          : 'تم حفظ الجزء المكتمل من التلاوة ويمكنك متابعة الحفظ لاحقًا.',
      )
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') {
        const downloadedSurahIds = Array.from(alreadyDownloaded)

        if (downloadedSurahIds.length) {
          const pkg: OfflinePackage = {
            key,
            riwayaId: riwaya,
            reciterApiId: selectedReciter.apiId,
            reciterLabel: selectedReciter.label,
            moshafId: selectedReciter.moshaf.id ?? null,
            server,
            surahIds,
            downloadedSurahIds,
            status: 'partial',
            downloadedAt: new Date().toISOString(),
          }

          const nextPackages = [
            ...offlinePackages.filter((item) => item.key !== pkg.key),
            pkg,
          ]

          writeOfflinePackages(nextPackages)
          setOfflinePackages(nextPackages)
        }

        setOfflineDownloadLabel(
          downloadedSurahIds.length
            ? `تم إيقاف الحفظ. حُفظت ${toArabicNumber(downloadedSurahIds.length)} سورة ويمكن استكمالها لاحقًا.`
            : 'تم إيقاف الحفظ.',
        )
      } else {
        console.error('Offline Quran download error:', error)
        setOfflineError(
          'تعذر إكمال الحفظ. تحقق من الاتصال ومصدر الصوت ثم أعد المحاولة.',
        )
      }
    } finally {
      offlineAbortRef.current = null
      setOfflineDownloading(false)
    }
  }


  const filteredSurahs = useMemo(() => {
    return surahsList.filter((surah) => {
      const isAvailable = availableSurahIds.includes(surah.id)
      const matchesFilter = filter === 'all' || surah.type === filter
      return isAvailable && matchesFilter
    })
  }, [availableSurahIds, filter])

  useEffect(() => {
    const term = normalizeArabic(query)

    if (term.length < 2) {
      setAyahResults([])
      setAyahSearching(false)
      setAyahSearchError('')
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setAyahSearching(true)
      setAyahSearchError('')

      try {
        const response = await fetch(
          `https://api.alquran.cloud/v1/search/${encodeURIComponent(term)}/all/quran-uthmani`,
          {
            signal: controller.signal,
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          },
        )

        const payload = await response.json().catch(() => null)

        if (!response.ok || payload?.code !== 200) {
          throw new Error(
            typeof payload?.status === 'string'
              ? payload.status
              : 'Ayah search failed',
          )
        }

        const rawMatches = Array.isArray(payload?.data?.matches)
          ? payload.data.matches
          : []

        // لا نعتمد على نتائج المصدر وحدها؛ نتحقق أن كلمة البحث موجودة
        // فعلًا داخل نص الآية حتى لا تظهر سورة/آية لا علاقة لها بالبحث.
        const verifiedMatches = rawMatches.filter((match: SearchMatch) => {
          if (
            !match ||
            typeof match.text !== 'string' ||
            typeof match.numberInSurah !== 'number' ||
            !match.surah ||
            typeof match.surah.number !== 'number'
          ) {
            return false
          }

          return normalizeArabic(match.text).includes(term)
        })

        // تأكيد رقم الصفحة. عادةً يأتي من نتيجة البحث، وإذا غاب نجيبه
        // من مرجع الآية نفسه حتى لا نعود إلى الصفحة الأولى.
        const firstMatches = verifiedMatches.slice(0, 30)
        const hydrated = await Promise.all(
          firstMatches.map(async (match: SearchMatch) => {
            if (Number.isFinite(match.page) && Number(match.page) >= 1) {
              return match
            }

            try {
              const reference = `${match.surah?.number}:${match.numberInSurah}`
              const ayahResponse = await fetch(
                `https://api.alquran.cloud/v1/ayah/${encodeURIComponent(reference)}/quran-uthmani`,
                {
                  signal: controller.signal,
                  cache: 'no-store',
                  headers: { Accept: 'application/json' },
                },
              )

              const ayahPayload = await ayahResponse.json().catch(() => null)
              const page = Number(ayahPayload?.data?.page)

              return Number.isFinite(page) && page > 0
                ? { ...match, page }
                : match
            } catch (error) {
              if ((error as Error).name === 'AbortError') throw error
              return match
            }
          }),
        )

        if (!hydrated.length) {
          setAyahResults([])
          setAyahSearchError('لا توجد آيات مطابقة لهذه الكلمة.')
          return
        }

        setAyahResults(hydrated)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Ayah search error:', error)
          setAyahResults([])
          setAyahSearchError(
            'تعذر البحث في الآيات الآن. جرّب كلمة أخرى أو أعد المحاولة بعد قليل.',
          )
        }
      } finally {
        if (!controller.signal.aborted) setAyahSearching(false)
      }
    }, 350)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const getMushafHref = (
    page: number,
    surahId: number,
    ayah?: number,
    juzNumber?: number,
  ) => {
    if (!selectedReciter) return '/mushaf'

    const params = new URLSearchParams({
      page: String(page || 1),
      riwaya,
      surah: String(surahId),
      reciter: selectedReciter.id,
      reciterName: selectedReciter.label,
      reciterSource: 'mp3quran',
      reciterId: String(selectedReciter.apiId),
      autoplay: '1',
    })

    if (selectedReciter.moshaf.id != null) {
      params.set('moshafId', String(selectedReciter.moshaf.id))
    }

    if (ayah) {
      params.set('ayah', `${surahId}:${ayah}`)
    }

    if (juzNumber) {
      const range = getJuzRange(juzNumber)
      if (range) {
        params.set('juz', String(range.number))
        params.set(
          'juzStart',
          `${range.startSurah}:${range.startAyah}`,
        )
        params.set(
          'juzEnd',
          `${range.endSurah}:${range.endAyah}`,
        )
      }
    }

    return `/mushaf?${params.toString()}`
  }

  const openMushaf = (
    page: number,
    surahId: number,
    ayah?: number,
    juzNumber?: number,
  ) => {
    if (!selectedReciter) return
    window.location.href = getMushafHref(page, surahId, ayah, juzNumber)
  }

  const makkiyaCount = surahsList.filter((item) => item.type === 'مكية').length
  const madaniyaCount = surahsList.filter((item) => item.type === 'مدنية').length

  return (
    <main dir="rtl" className="min-h-screen bg-[#F7F4EC] pb-32 text-[#0F172A]">
      <section className="relative z-50 overflow-visible bg-gradient-to-br from-[#0F525A] via-[#176F78] to-[#0A3940] text-white">
        <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[#D97706]/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 pb-5 pt-3 sm:px-7 sm:pb-6">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              aria-label="الرئيسية"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/8 text-white backdrop-blur-xl transition hover:bg-white/12"
            >
              <ArrowLeft size={19} />
            </Link>

            <div className="flex flex-col items-center">
              <img
                src={LOGO_URL}
                alt="مصحف سميع"
                className="h-24 w-24 object-cover object-center [clip-path:circle(44%_at_50%_50%)] drop-shadow-[0_8px_18px_rgba(0,0,0,0.14)] sm:h-28 sm:w-28"
              />
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">فهرس السور</h1>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/15 bg-white/8 text-[#F59E0B]">
              <BookOpen size={20} />
            </div>
          </div>

          <p className="mx-auto mt-2 max-w-2xl text-center text-xs font-medium leading-6 text-white/70 sm:text-sm">
            اختر الرواية ثم القارئ، وبعدها اضغط السور أو الأجزاء للانتقال مباشرة إلى موضع المصحف الفعلي.
          </p>

          <div className="mx-auto mt-3 grid max-w-4xl gap-2.5 md:grid-cols-2">
            <div className="rounded-[20px] border border-white/10 bg-white/[0.07] p-2.5 backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-black">
                  <BookOpen size={16} className="text-[#F59E0B]" />
                  الرواية
                </span>
                <span className="text-[10px] font-bold text-white/40">بحث واختيار</span>
              </div>

              <div className="relative">
                <select
                  value={riwaya}
                  onChange={(event) => handleRiwayaChange(event.target.value as RiwayaId)}
                  className="w-full appearance-none rounded-2xl border border-white/15 bg-white px-4 py-2.5 text-sm font-black text-[#175E67] outline-none focus:ring-2 focus:ring-[#F59E0B]/10"
                >
                  {filteredRiwayat.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#D97706]" />
              </div>

              <div className="relative mt-2">
                <Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#0284C7]" />
                <input
                  value={riwayaSearch}
                  onChange={(event) => setRiwayaSearch(event.target.value)}
                  placeholder="ابحث عن الرواية"
                  className="w-full rounded-xl border border-white/10 bg-white/90 py-2.5 pr-9 text-xs font-bold text-[#175E67] outline-none placeholder:text-slate-400 focus:border-[#F59E0B]/40 focus:ring-2 focus:ring-[#F59E0B]/10"
                />
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/[0.07] p-2.5 backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-black">
                  <Mic2 size={16} className="text-[#F59E0B]" />
                  القارئ
                </span>
                <span className="text-[10px] font-bold text-white/40">
                  {reciters.length ? `${toArabicNumber(reciters.length)} متاح` : 'حسب الرواية'}
                </span>
              </div>

              <div className="relative">
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#0284C7]" />
                  <input
                    value={reciterSearch}
                    onFocus={() => setReciterOpen(true)}
                    onChange={(event) => {
                      setReciterSearch(event.target.value)
                      setReciterOpen(true)
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setReciterOpen(false), 160)
                    }}
                    placeholder={selectedReciter?.label || 'اضغط للبحث عن القارئ'}
                    disabled={recitersLoading}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={reciterOpen}
                    aria-controls="samee3-reciter-listbox"
                    className="w-full rounded-2xl border border-white/15 bg-white py-3 pr-9 pl-10 text-sm font-black text-[#175E67] outline-none placeholder:text-slate-400 focus:border-[#F59E0B]/40 focus:ring-2 focus:ring-[#F59E0B]/10 disabled:opacity-60"
                  />
                  <ChevronDown
                    size={18}
                    className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#D97706] transition-transform ${reciterOpen ? 'rotate-180' : ''}`}
                  />
                  {reciterSearch && (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setReciterSearch('')
                        setReciterOpen(true)
                      }}
                      className="absolute left-10 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                      aria-label="مسح بحث القارئ"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {reciterOpen && (
                  <div
                    id="samee3-reciter-listbox"
                    role="listbox"
                    className="absolute right-0 top-full z-[100] mt-2 max-h-[min(18rem,45vh)] w-full overflow-y-auto overscroll-contain rounded-2xl border border-[#E8E5DC] bg-white p-1.5 shadow-[0_22px_45px_rgba(15,23,42,0.24)]"
                  >
                    {filteredReciters.length ? (
                      filteredReciters.map((item) => {
                        const selected = selectedReciter?.id === item.id
                        const downloaded = isReciterDownloaded(item)

                        return (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onPointerDown={(event) => event.preventDefault()}
                            onClick={() => {
                              handleReciterChange(item)
                              setReciterSearch(item.label)
                              setReciterOpen(false)
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-right transition ${
                              selected
                                ? 'bg-[#EAF7FB] text-[#175E67]'
                                : 'text-slate-700 hover:bg-[#F7F4EC]'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-black">{item.label}</span>
                              <span className="mt-1 block text-[9px] font-bold text-slate-400">
                                {downloaded ? 'تم تحميله على هذا الجهاز' : getRiwaya(riwaya).label}
                              </span>
                            </span>

                            <span className="flex shrink-0 items-center gap-1.5">
                              {downloaded && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">
                                  <CheckCircle2 size={11} />
                                  تم تحميله
                                </span>
                              )}
                              {selected && <CheckCircle2 size={16} className="text-[#0284C7]" />}
                            </span>
                          </button>
                        )
                      })
                    ) : (
                      <div className="px-3 py-8 text-center text-xs font-bold text-slate-400">
                        {recitersLoading ? 'جاري تحميل القراء...' : 'لا يوجد قارئ بهذه الكتابة'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {recitersLoading && (
            <div className="mx-auto mt-3 flex max-w-4xl items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/7 px-4 py-2.5 text-xs font-bold text-white/75">
              <Loader2 size={15} className="animate-spin" />
              جاري جلب القراء المتوفرين لهذه الرواية...
            </div>
          )}

          {recitersError && (
            <div className="mx-auto mt-3 max-w-4xl rounded-2xl border border-red-200/20 bg-red-500/10 px-4 py-2.5 text-center text-xs font-bold text-white/85">
              {recitersError}
            </div>
          )}
        </div>
      </section>


      <section className="relative z-0 mx-auto mt-4 max-w-6xl px-4 sm:px-7">
        <div className="rounded-[26px] border border-[#E9E2D4] bg-white p-3 shadow-[0_10px_32px_rgba(56,40,20,0.07)] sm:p-4">
          <div className="relative">
            <Search size={20} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#0284C7]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث عن آية"
              className="w-full rounded-2xl border border-[#E6E0D2] bg-[#FCFBF8] py-4 pr-12 pl-12 text-sm font-bold outline-none focus:border-[#0284C7]/40 focus:ring-4 focus:ring-[#0284C7]/8"
              aria-label="البحث داخل الآيات فقط"
              dir="rtl"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/5 text-slate-500"
                aria-label="مسح البحث"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {[
              ['all', 'كل السور', BookOpen],
              ['مكية', `مكية • ${makkiyaCount}`, Sun],
              ['مدنية', `مدنية • ${madaniyaCount}`, Moon],
            ].map(([value, label, Icon]) => {
              const active = filter === value
              const IconComponent = Icon as typeof BookOpen
              return (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => setFilter(value as FilterType)}
                  className={`shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-black transition ${active ? 'bg-[#0284C7] text-white shadow-sm' : 'bg-[#F7F4EC] text-slate-500 hover:bg-[#EAF7FB] hover:text-[#0284C7]'}`}
                >
                  <IconComponent size={15} />
                  {String(label)}
                </button>
              )
            })}
          </div>

          {ayahSearching && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#F0FAFD] px-3 py-2 text-xs font-bold text-[#0284C7]">
              <Loader2 size={15} className="animate-spin" />
              جاري البحث داخل الآيات...
            </div>
          )}

          {!ayahSearching && query.trim().length >= 2 && ayahSearchError && (
            <div className="mt-3 rounded-xl border border-[#E9E2D4] bg-[#FCFBF8] px-3 py-2.5 text-xs font-bold text-slate-500">
              {ayahSearchError}
            </div>
          )}

          {!ayahSearching && ayahResults.length > 0 && (
            <div className="mt-3 rounded-2xl border border-[#D8EAF0] bg-[#F5FCFE] p-3">
              <div className="mb-2 text-xs font-black">الآيات المطابقة</div>
              <div className="grid gap-2 md:grid-cols-2">
                {ayahResults.map((match) => (
                  <Link
                    key={`${match.number}-${match.numberInSurah}`}
                    href={getMushafHref(
                      match.page || 1,
                      match.surah?.number || 1,
                      match.numberInSurah,
                    )}
                    className="rounded-xl border border-white bg-white p-3 transition hover:shadow-sm"
                  >
                    <div className="text-[10px] font-black text-[#0284C7]">
                      {match.surah?.name || 'القرآن الكريم'} · الآية {toArabicNumber(match.numberInSurah)} · الصفحة {toArabicNumber(match.page || 1)}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-7">{match.text}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-6xl px-4 sm:px-7">
        <div className="rounded-[28px] border border-[#E9E2D4] bg-white p-3 shadow-[0_12px_45px_rgba(56,40,20,0.10)] sm:p-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPanel(panel === 'surahs' ? null : 'surahs')}
              className={`flex min-h-[120px] items-center justify-between rounded-[22px] border px-4 py-5 text-right transition ${panel === 'surahs' ? 'border-[#0284C7]/30 bg-[#EAF7FB]' : 'border-[#ECE4D5] bg-[#FCFBF8] hover:border-[#0284C7]/20'}`}
            >
              <div>
                <p className="text-xl font-black">السور</p>
                <p className="mt-2 text-[10px] font-bold text-slate-400">اضغط لإظهار السور المتاحة</p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F5F9] text-[#0284C7]"><BookOpen size={25} /></span>
            </button>

            <button
              type="button"
              onClick={() => setPanel(panel === 'juz' ? null : 'juz')}
              className={`flex min-h-[120px] items-center justify-between rounded-[22px] border px-4 py-5 text-right transition ${panel === 'juz' ? 'border-[#D97706]/30 bg-[#FFF7E8]' : 'border-[#ECE4D5] bg-[#FCFBF8] hover:border-[#D97706]/20'}`}
            >
              <div>
                <p className="text-xl font-black">الأجزاء</p>
                <p className="mt-2 text-[10px] font-bold text-slate-400">ثلاثون جزءًا • اضغط لعرضها</p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF0D9] text-[#D97706]"><BookOpen size={25} /></span>
            </button>
          </div>

          {panel === 'surahs' && (
            <div className="mt-3 overflow-hidden rounded-[22px] border border-[#E9E2D4] bg-[#FCFBF8]">
              <div className="border-b border-[#EEE7DA] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black">السور المتاحة للقارئ</h3>
                    <p className="mt-1 text-[10px] font-bold text-slate-400">
                      {selectedReciter ? `السور المسجلة فعليًا لـ ${selectedReciter.label} في ${getRiwaya(riwaya).label}` : 'اختر الرواية والقارئ أولًا'}
                    </p>
                  </div>
                  <button type="button" onClick={() => setPanel(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-slate-500" aria-label="إغلاق السور"><X size={15} /></button>
                </div>
                <div className="mt-3 rounded-xl border border-[#D8EAF0] bg-[#F0FAFD] px-3 py-2 text-[11px] font-bold leading-6 text-[#25636B]">
                  اختر الرواية والقارئ أولًا؛ هذه القائمة تعرض فقط السور الموجودة فعلًا في تسجيلات القارئ لهذه الرواية.
                </div>
              </div>

              <div className="max-h-[55vh] overflow-y-auto p-3">
                {selectedReciter ? (
                  filteredSurahs.length ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredSurahs.map((surah) => {
                        const offlineReady = isSurahOfflineDownloaded(surah.id)
                        const thisOffline = surahOfflineDownloading === surah.id
                        const thisDevice = surahDeviceDownloading === surah.id

                        return (
                          <div
                            key={surah.id}
                            className="group rounded-2xl border border-[#E9E2D4] bg-white p-2.5 transition hover:-translate-y-0.5 hover:border-[#0284C7]/35 hover:shadow-sm"
                          >
                            <button
                              type="button"
                              onClick={() => openMushaf(surah.startPage, surah.id)}
                              className="flex w-full items-center justify-between gap-3 text-right"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F9FE] text-sm font-black text-[#0284C7]">
                                  {toArabicNumber(surah.id)}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-black">سورة {surah.name}</span>
                                  <span className="mt-1 block text-[9px] font-bold text-slate-400">
                                    {surah.type} · صفحة {toArabicNumber(surah.startPage)}
                                  </span>
                                </span>
                              </div>
                              <ChevronLeft size={16} className="shrink-0 text-[#D97706]" />
                            </button>

                            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-[#F0ECE4] pt-2">
                              <button
                                type="button"
                                onClick={() => void downloadSurahToDevice(surah.id)}
                                disabled={thisDevice || surahDeviceDownloading != null || deviceDownloading}
                                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[#F2E2C5] bg-[#FFFCF6] px-2 py-2 text-[10px] font-black text-[#B45309] transition hover:bg-[#FFF5E8] disabled:cursor-not-allowed disabled:opacity-50"
                                title="تنزيل السورة على الهاتف"
                              >
                                {thisDevice ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Smartphone size={14} />
                                )}
                                الجهاز
                              </button>

                              <button
                                type="button"
                                onClick={() => void downloadSurahOffline(surah.id)}
                                disabled={offlineReady || thisOffline || surahOfflineDownloading != null || offlineDownloading}
                                className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[10px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                  offlineReady
                                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                    : 'border-[#D8EAF0] bg-[#F5FCFE] text-[#0369A1] hover:bg-[#EAF7FB]'
                                }`}
                                title={offlineReady ? 'السورة محفوظة دون اتصال' : 'حفظ السورة دون اتصال'}
                              >
                                {thisOffline ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : offlineReady ? (
                                  <CheckCircle2 size={14} />
                                ) : (
                                  <WifiOff size={14} />
                                )}
                                {offlineReady ? 'محفوظة' : 'دون نت'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-sm font-bold text-slate-400">لا توجد سور مطابقة للبحث أو الفلتر.</div>
                  )
                ) : (
                  <div className="py-10 text-center text-sm font-bold text-slate-400">اختر الرواية والقارئ لعرض السور الفعلية المتاحة له.</div>
                )}
              </div>
            </div>
          )}

          {panel === 'juz' && (
            <div className="mt-3 overflow-hidden rounded-[22px] border border-[#E9E2D4] bg-[#FCFBF8]">
              <div className="border-b border-[#EEE7DA] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="font-black">الأجزاء الثلاثون</h3><p className="mt-1 text-[10px] font-bold text-slate-400">اضغط على الجزء لفتح بدايته الفعلية في المصحف.</p></div>
                  <button type="button" onClick={() => setPanel(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-slate-500" aria-label="إغلاق الأجزاء"><X size={15} /></button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-10">
                {JUZ_LIST.map((juz) => (
                  <button key={juz.number} type="button" onClick={() => openMushaf(juz.page, juz.surah, juz.ayah, juz.number)} className="rounded-2xl border border-[#E9E2D4] bg-white px-2 py-3 text-center transition hover:border-[#D97706]/35 hover:bg-[#FFF9EF]">
                    <span className="block text-sm font-black text-[#D97706]">الجزء {toArabicNumber(juz.number)}</span>
                    <span className="mt-1 block text-[9px] font-bold text-slate-400">صفحة {toArabicNumber(juz.page)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-7">
        <div className="relative overflow-hidden rounded-[30px] border border-[#D8EAF0] bg-gradient-to-br from-white to-[#F3FBFD] p-5 shadow-[0_12px_35px_rgba(2,132,199,0.08)] sm:p-6">
          <div className="pointer-events-none absolute -left-16 -top-16 h-36 w-36 rounded-full bg-[#0284C7]/5 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-10 h-40 w-40 rounded-full bg-[#D97706]/8 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF7FB] text-[#0284C7]">
                  <HardDriveDownload size={23} />
                </span>
                <div>
                  <h2 className="text-lg font-black text-[#0F172A]">تحميل المصحف للقارئ</h2>
                  <p className="mt-1 text-xs font-bold leading-6 text-slate-400">
                    حمّل تلاوة القارئ المختار كاملة في ملف ZIP واحد على جهازك، أو احفظها داخل مصحف سميع للعمل دون إنترنت.
                  </p>
                </div>
              </div>

              {selectedOfflinePackage && (
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-black ${
                    selectedOfflineComplete
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  <CheckCircle2 size={14} />
                  {selectedOfflineComplete
                    ? 'تم تحميله'
                    : `محفوظ ${toArabicNumber(selectedOfflineCount)} من ${toArabicNumber(selectedOfflineTotal)}`}
                </span>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-[#F2E2C5] bg-[#FFFCF6] p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF0D9] text-[#D97706]">
                    <Archive size={20} />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-[#0F172A]">تنزيل المصحف كملف ZIP</h3>
                    <p className="mt-1 text-[10px] font-bold leading-5 text-slate-400">
                      جميع سور القارئ والرواية في ملف واحد، باسم منظم وجاهز للحفظ على الهاتف أو الكمبيوتر.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void downloadSelectedReciterToDevice()}
                  disabled={!selectedReciter || deviceDownloading || offlineDownloading}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#D97706] px-4 py-3 text-xs font-black text-white shadow-[0_8px_22px_rgba(217,119,6,0.18)] transition hover:-translate-y-0.5 hover:bg-[#B45309] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deviceDownloading ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      جاري إنشاء ZIP {toArabicNumber(deviceDownloadProgress)}٪
                    </>
                  ) : (
                    <>
                      <Download size={17} />
                      تنزيل المصحف كاملًا ZIP
                    </>
                  )}
                </button>

                {deviceDownloading && (
                  <button
                    type="button"
                    onClick={cancelDeviceDownload}
                    className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-2.5 text-xs font-black text-red-700 transition hover:bg-red-100"
                  >
                    <Square size={16} />
                    إيقاف إنشاء ZIP
                  </button>
                )}
              </div>

              <div className="rounded-[22px] border border-[#D8EAF0] bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF7FB] text-[#0284C7]">
                    <WifiOff size={20} />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-[#0F172A]">حفظ المصحف دون اتصال</h3>
                    <p className="mt-1 text-[10px] font-bold leading-5 text-slate-400">
                      يحفظ السور داخل مساحة تخزين الموقع، مع استكمال التحميل لاحقًا بدون إعادة الملفات المكتملة.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void downloadSelectedReciterOffline()}
                  disabled={!selectedReciter || offlineDownloading || deviceDownloading}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#0284C7] px-4 py-3 text-xs font-black text-white shadow-[0_8px_22px_rgba(2,132,199,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0369A1] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {offlineDownloading ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      جاري الحفظ {toArabicNumber(offlineDownloadProgress)}٪
                    </>
                  ) : selectedOfflineComplete ? (
                    <>
                      <CheckCircle2 size={17} />
                      محفوظ ويعمل دون اتصال
                    </>
                  ) : selectedOfflinePackage ? (
                    <>
                      <Download size={17} />
                      استكمال الحفظ
                    </>
                  ) : (
                    <>
                      <Download size={17} />
                      حفظ تلاوة القارئ دون اتصال
                    </>
                  )}
                </button>

                {offlineDownloading && (
                  <button
                    type="button"
                    onClick={cancelOfflineDownload}
                    className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-2.5 text-xs font-black text-red-700 transition hover:bg-red-100"
                  >
                    <Square size={16} />
                    إيقاف الحفظ
                  </button>
                )}
              </div>
            </div>

            {(offlineDownloading || deviceDownloading || offlineDownloadLabel || deviceDownloadLabel) && (
              <div className="rounded-2xl border border-[#E8E5DC] bg-[#FCFBF8] p-4">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
                  <span className="truncate">
                    {deviceDownloading
                      ? deviceDownloadLabel
                      : offlineDownloading
                        ? offlineDownloadLabel
                        : deviceDownloadLabel || offlineDownloadLabel}
                  </span>
                  <span className="shrink-0 font-black text-[#0284C7]">
                    {toArabicNumber(
                      deviceDownloading
                        ? deviceDownloadProgress
                        : offlineDownloadProgress,
                    )}
                    ٪
                  </span>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#0284C7] transition-all duration-300"
                    style={{
                      width: `${
                        deviceDownloading
                          ? deviceDownloadProgress
                          : offlineDownloadProgress
                      }%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-[10px] font-bold leading-5 text-slate-400">
                  {deviceDownloading
                    ? 'يتم إنشاء ملف ZIP واحد فقط بدل تنزيل عشرات الملفات المنفصلة.'
                    : offlineDownloading
                      ? 'يمكن إيقاف الحفظ في أي وقت، وستبقى السور المكتملة ويمكن استكمال الباقي لاحقًا.'
                      : 'التحميل على الجهاز = ملف ZIP واحد، والحفظ دون نت = تشغيل مباشر من داخل مصحف سميع.'}
                </p>
              </div>
            )}

            {selectedOfflinePackage && (
              <div className="flex flex-col gap-2 rounded-2xl border border-[#E8E5DC] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs font-bold leading-6 text-slate-500">
                  <span className="font-black text-[#175E67]">
                    {selectedOfflinePackage.reciterLabel}
                  </span>
                  {' · '}
                  {getRiwaya(riwaya).label}
                  {' · '}
                  {selectedOfflineCount}/{selectedOfflineTotal} سورة محفوظة
                </div>

                <button
                  type="button"
                  onClick={() => void removeOfflinePackage(selectedOfflinePackage)}
                  disabled={offlineDownloading || deviceDownloading}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  إزالة النسخة المحفوظة
                </button>
              </div>
            )}

            {offlineError && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold leading-6 text-red-700">
                {offlineError}
              </div>
            )}

            <div className="rounded-2xl border border-[#D8EAF0] bg-[#F5FCFE] px-4 py-3 text-[10px] font-bold leading-6 text-[#4B6670]">
              <span className="font-black text-[#175E67]">حالة القارئ:</span>{' '}
              {selectedOfflinePackage
                ? selectedOfflineComplete
                  ? 'هذه التلاوة محفوظة بالكامل داخل مصحف سميع، وستظهر أولًا في قائمة القراء مع وسم «تم تحميله».'
                  : `تم حفظ ${toArabicNumber(selectedOfflineCount)} من ${toArabicNumber(selectedOfflineTotal)} سورة، ويمكن متابعة الحفظ لاحقًا.`
                : 'لم يتم حفظ تلاوة هذا القارئ على الجهاز بعد.'}
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}