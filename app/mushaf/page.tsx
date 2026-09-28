'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ChevronDown,
  ChevronUp,
  Headphones,
  List,
  Loader2,
  Pause,
  Play,
  Search,
  UserRound,
  X,
} from 'lucide-react'

type Riwaya =
  | 'hafs'
  | 'warsh'
  | 'qalun'
  | 'douri'
  | 'shubah'
  | 'bazzi'
  | 'sousi'

type SelectedAyah = {
  surah: number
  ayah: number
}

type TimingRow = {
  ayah: number
  start_time: number
  end_time: number
  polygon?: string | null
  page?: string | null
  x?: string | null
  y?: string | null
}

type TimingRead = {
  id: number
  name: string
  rewaya?: string
  folder_url?: string
  soar_count?: number
}

type AudioState = {
  surah: number
  ayah: number
  page: number
  riwaya: Riwaya
  reciter: string
  currentTime: number
  audioSrc: string
  savedAt: number
}

const LABELS: Record<Riwaya, string> = {
  hafs: 'حفص عن عاصم',
  warsh: 'ورش عن نافع',
  qalun: 'قالون عن نافع',
  douri: 'الدوري عن أبي عمرو',
  shubah: 'شعبة عن عاصم',
  bazzi: 'البزي عن ابن كثير',
  sousi: 'السوسي عن أبي عمرو',
}

const SVG: Partial<Record<Riwaya, string>> = {
  hafs: 'hafs-kfqc',
  warsh: 'warsh-kfqc',
  qalun: 'qalon-kfqc',
  douri: 'douri-kfqc',
  shubah: 'shubah-kfqc',
}

const RECITERS = [
  {
    id: 'ar.alafasy',
    name: 'مشاري العفاسي',
    aliases: ['مشاري العفاسي', 'مشاري راشد', 'العفاسي'],
  },
  {
    id: 'ar.husary',
    name: 'محمود خليل الحصري',
    aliases: ['محمود خليل الحصري', 'الحصري'],
  },
  {
    id: 'ar.minshawi',
    name: 'محمد صديق المنشاوي',
    aliases: ['محمد صديق المنشاوي', 'المنشاوي'],
  },
  {
    id: 'ar.abdulbasitmurattal',
    name: 'عبد الباسط عبد الصمد',
    aliases: ['عبد الباسط عبد الصمد', 'عبد الباسط'],
  },
  {
    id: 'ar.saoodshuraym',
    name: 'سعود الشريم',
    aliases: ['سعود الشريم', 'الشريم'],
  },
] as const

const SURAHS = [
  'الفاتحة',
  'البقرة',
  'آل عمران',
  'النساء',
  'المائدة',
  'الأنعام',
  'الأعراف',
  'الأنفال',
  'التوبة',
  'يونس',
  'هود',
  'يوسف',
  'الرعد',
  'إبراهيم',
  'الحجر',
  'النحل',
  'الإسراء',
  'الكهف',
  'مريم',
  'طه',
  'الأنبياء',
  'الحج',
  'المؤمنون',
  'النور',
  'الفرقان',
  'الشعراء',
  'النمل',
  'القصص',
  'العنكبوت',
  'الروم',
  'لقمان',
  'السجدة',
  'الأحزاب',
  'سبأ',
  'فاطر',
  'يس',
  'الصافات',
  'ص',
  'الزمر',
  'غافر',
  'فصلت',
  'الشورى',
  'الزخرف',
  'الدخان',
  'الجاثية',
  'الأحقاف',
  'محمد',
  'الفتح',
  'الحجرات',
  'ق',
  'الذاريات',
  'الطور',
  'النجم',
  'القمر',
  'الرحمن',
  'الواقعة',
  'الحديد',
  'المجادلة',
  'الحشر',
  'الممتحنة',
  'الصف',
  'الجمعة',
  'المنافقون',
  'التغابن',
  'الطلاق',
  'التحريم',
  'الملك',
  'القلم',
  'الحاقة',
  'المعارج',
  'نوح',
  'الجن',
  'المزمل',
  'المدثر',
  'القيامة',
  'الإنسان',
  'المرسلات',
  'النبأ',
  'النازعات',
  'عبس',
  'التكوير',
  'الانفطار',
  'المطففين',
  'الانشقاق',
  'البروج',
  'الطارق',
  'الأعلى',
  'الغاشية',
  'الفجر',
  'البلد',
  'الشمس',
  'الليل',
  'الضحى',
  'الشرح',
  'التين',
  'العلق',
  'القدر',
  'البينة',
  'الزلزلة',
  'العاديات',
  'القارعة',
  'التكاثر',
  'العصر',
  'الهمزة',
  'الفيل',
  'قريش',
  'الماعون',
  'الكوثر',
  'الكافرون',
  'النصر',
  'المسد',
  'الإخلاص',
  'الفلق',
  'الناس',
]

const LAST_AUDIO_KEY = 'samee3_last_mushaf_audio_v2'
const RIWAYA_KEY = 'samee3_selected_riwaya_v2'
const RECITER_KEY = 'samee3_selected_reciter_v2'
const TIMING_READS_KEY = 'samee3_timing_reads_v1'
const TIMING_READS_TTL = 1000 * 60 * 60 * 24 * 7

function clampPage(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(604, Math.max(1, Math.trunc(value)))
}

function normalizeName(value: string) {
  return value
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function getRiwayaKeywords(riwaya: Riwaya) {
  switch (riwaya) {
    case 'hafs':
      return ['حفص', "hafs"]
    case 'warsh':
      return ['ورش', "warsh"]
    case 'qalun':
      return ['قالون', "qalun"]
    case 'douri':
      return ['الدوري', 'الدورى', "douri"]
    case 'shubah':
      return ['شعبة', "shubah"]
    case 'bazzi':
      return ['البزي', "bazzi"]
    case 'sousi':
      return ['السوسي', 'السوسى', "sousi"]
    default:
      return []
  }
}

function getTimingReciterAliases(reciterId: string) {
  const item = RECITERS.find((entry) => entry.id === reciterId)
  return item?.aliases ?? []
}

function timingMatchesReciter(
  timingRead: TimingRead,
  reciterId: string,
  riwaya: Riwaya,
) {
  const readName = normalizeName(timingRead.name || '')
  const aliases = getTimingReciterAliases(reciterId).map(normalizeName)
  const reciterMatch = aliases.some((alias) => alias && readName.includes(alias))

  if (!reciterMatch) return false

  const fullRewaya = normalizeName(
    timingRead.rewaya || `${timingRead.name || ''}`,
  )
  const keywords = getRiwayaKeywords(riwaya).map(normalizeName)

  if (keywords.length === 0) return true
  return keywords.some((keyword) => fullRewaya.includes(keyword))
}

function toTimingRows(value: unknown): TimingRow[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      const row = item as Partial<TimingRow>
      const ayah = Number(row.ayah)
      const start = Number(row.start_time)
      const end = Number(row.end_time)

      if (!Number.isInteger(ayah) || ayah <= 0) return null
      if (!Number.isFinite(start) || !Number.isFinite(end)) return null
      if (end <= start) return null

      return {
        ayah,
        start_time: start,
        end_time: end,
        polygon:
          typeof row.polygon === 'string' ? row.polygon : row.polygon ?? null,
        page: typeof row.page === 'string' ? row.page : row.page ?? null,
        x: typeof row.x === 'string' ? row.x : row.x ?? null,
        y: typeof row.y === 'string' ? row.y : row.y ?? null,
      }
    })
    .filter((row): row is TimingRow => Boolean(row))
    .sort((a, b) => a.start_time - b.start_time)
}

function findTimingForTime(rows: TimingRow[], milliseconds: number) {
  if (rows.length === 0) return null

  const tolerance = 110
  let previous: TimingRow | null = null

  for (const row of rows) {
    const start = row.start_time
    const end = row.end_time

    if (
      milliseconds >= start - tolerance &&
      milliseconds < end + tolerance
    ) {
      return row
    }

    if (milliseconds >= start) {
      previous = row
      continue
    }

    break
  }

  return previous
}

function readStoredAudioState(): AudioState | null {
  try {
    const raw = localStorage.getItem(LAST_AUDIO_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AudioState>

    if (
      !Number.isInteger(parsed.surah) ||
      !Number.isInteger(parsed.ayah) ||
      typeof parsed.reciter !== 'string' ||
      typeof parsed.riwaya !== 'string'
    ) {
      return null
    }

    return {
      surah: Number(parsed.surah),
      ayah: Number(parsed.ayah),
      page: clampPage(Number(parsed.page ?? 1)),
      riwaya: parsed.riwaya as Riwaya,
      reciter: parsed.reciter,
      currentTime: Number(parsed.currentTime ?? 0),
      audioSrc: typeof parsed.audioSrc === 'string' ? parsed.audioSrc : '',
      savedAt: Number(parsed.savedAt ?? Date.now()),
    }
  } catch {
    return null
  }
}

function saveAudioState(state: AudioState) {
  try {
    localStorage.setItem(LAST_AUDIO_KEY, JSON.stringify(state))
  } catch {
    // Local storage can be unavailable in private browsing or strict environments.
  }
}

function saveSimplePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore storage failures without interrupting the reader.
  }
}

async function readTimingReads(): Promise<TimingRead[]> {
  try {
    const cachedRaw = localStorage.getItem(TIMING_READS_KEY)

    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as {
        savedAt?: number
        reads?: TimingRead[]
      }

      if (
        Array.isArray(cached.reads) &&
        typeof cached.savedAt === 'number' &&
        Date.now() - cached.savedAt < TIMING_READS_TTL
      ) {
        return cached.reads
      }
    }
  } catch {
    // Ignore malformed cache and refresh from source.
  }

  const response = await fetch(
    'https://mp3quran.net/api/v3/ayat_timing/reads',
    {
      cache: 'no-store',
    },
  )

  if (!response.ok) {
    throw new Error('timing reads request failed')
  }

  const json = (await response.json()) as unknown

  const reads = Array.isArray(json)
    ? (json as TimingRead[])
    : Array.isArray((json as { reads?: unknown[] })?.reads)
      ? ((json as { reads: TimingRead[] }).reads ?? [])
      : []

  const cleanReads = reads.filter(
    (read) =>
      Number.isInteger(Number(read?.id)) &&
      typeof read?.name === 'string' &&
      read.name.trim().length > 0,
  )

  try {
    localStorage.setItem(
      TIMING_READS_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        reads: cleanReads,
      }),
    )
  } catch {
    // Cache is optional.
  }

  return cleanReads
}

async function findCompatibleTimingRead(
  reciterId: string,
  riwaya: Riwaya,
): Promise<TimingRead | null> {
  const reads = await readTimingReads()

  const compatible = reads.find((read) =>
    timingMatchesReciter(read, reciterId, riwaya),
  )

  if (compatible) return compatible

  // A timing read from the same reciter but another riwaya is still more useful
  // than no timing at all; only use it as a documented fallback for highlighting.
  const reciterOnly = reads.find((read) => {
    const name = normalizeName(read.name || '')
    return getTimingReciterAliases(reciterId)
      .map(normalizeName)
      .some((alias) => alias && name.includes(alias))
  })

  return reciterOnly ?? null
}

async function fetchTimingsForSurah(
  surah: number,
  readId: number,
): Promise<TimingRow[]> {
  const response = await fetch(
    `https://mp3quran.net/api/v3/ayat_timing?surah=${encodeURIComponent(
      String(surah),
    )}&read=${encodeURIComponent(String(readId))}`,
    {
      cache: 'force-cache',
    },
  )

  if (!response.ok) {
    throw new Error('timing request failed')
  }

  return toTimingRows(await response.json())
}

function getSurahFromSvgElement(element: Element) {
  const value =
    element.getAttribute('surah') ??
    element.getAttribute('data-surah') ??
    element.getAttribute('data-sura')

  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : 0
}

function getAyahFromSvgElement(element: Element) {
  const value =
    element.getAttribute('ayah') ??
    element.getAttribute('data-ayah') ??
    element.getAttribute('data-aya')

  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : 0
}

function setSvgAyahVisual(
  element: SVGElement,
  active: boolean,
  interactive = true,
) {
  element.setAttribute('fill', '#0284C7')
  element.setAttribute(
    'fill-opacity',
    active ? '0.14' : '0',
  )
  element.setAttribute('stroke', '#0284C7')
  element.setAttribute(
    'stroke-opacity',
    active ? '0.42' : '0',
  )
  element.setAttribute(
    'stroke-width',
    active ? '0.85' : '0',
  )
  element.setAttribute('vector-effect', 'non-scaling-stroke')
  element.setAttribute('stroke-linejoin', 'round')
  element.setAttribute('stroke-linecap', 'round')
  element.style.transition =
    'fill-opacity 160ms ease-out, stroke-opacity 160ms ease-out, stroke-width 160ms ease-out'
  element.style.pointerEvents = interactive ? 'auto' : 'none'
  element.style.cursor = interactive ? 'pointer' : 'default'
}

function updateSvgHighlight(
  root: HTMLElement,
  selected: SelectedAyah | null,
) {
  const elements = root.querySelectorAll<SVGElement>(
    '.ayahPolygon, [data-ayah], [data-aya]',
  )

  elements.forEach((element) => {
    const surah = getSurahFromSvgElement(element)
    const ayah = getAyahFromSvgElement(element)

    const active =
      Boolean(selected) &&
      surah === selected?.surah &&
      ayah === selected?.ayah

    setSvgAyahVisual(element, active)
  })
}

export default function MushafPage() {
  const searchParams = useSearchParams()

  const urlPage = clampPage(Number(searchParams.get('page')) || 1)
  const urlRiwaya = (searchParams.get('riwaya') as Riwaya | null) ?? null
  const urlReciter = searchParams.get('reciter')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioGenerationRef = useRef(0)
  const timingsRequestRef = useRef(0)
  const lastHighlightedKeyRef = useRef('')
  const lastSavedAtRef = useRef(0)
  const activeTimingReadRef = useRef<TimingRead | null>(null)
  const activeTimingsRef = useRef<TimingRow[]>([])
  const activeAudioSurahRef = useRef(0)
  const mountedRef = useRef(false)

  const [page, setPage] = useState(urlPage)
  const [riwaya, setRiwaya] = useState<Riwaya>(
    urlRiwaya && urlRiwaya in LABELS ? urlRiwaya : 'hafs',
  )
  const [reciter, setReciter] = useState(
    urlReciter || 'ar.alafasy',
  )
  const [open, setOpen] = useState(false)
  const [svg, setSvg] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [text, setText] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<SelectedAyah | null>(null)
  const [activeAyah, setActiveAyah] = useState<SelectedAyah | null>(null)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [timingAvailable, setTimingAvailable] = useState<boolean | null>(
    null,
  )

  const selectedKey = selected
    ? `${selected.surah}:${selected.ayah}`
    : ''

  const activeKey = activeAyah
    ? `${activeAyah.surah}:${activeAyah.ayah}`
    : ''

  const reciterName = useMemo(() => {
    return (
      RECITERS.find((entry) => entry.id === reciter)?.name ??
      'القارئ المحدد'
    )
  }, [reciter])

  const currentDisplayAyah = activeAyah ?? selected

  const stopAudio = useCallback(
    (keepHighlight = true) => {
      audioGenerationRef.current += 1

      const audio = audioRef.current
      if (audio) {
        try {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
        } catch {
          // Ignore teardown errors.
        }
      }

      audioRef.current = null
      activeTimingReadRef.current = null
      activeTimingsRef.current = []
      activeAudioSurahRef.current = 0
      setIsPlaying(false)
      setIsLoadingAudio(false)
      setTimingAvailable(null)

      if (!keepHighlight) {
        setActiveAyah(null)
      }
    },
    [],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSvg('')
    setText([])
    setActiveAyah(null)
    setTimingAvailable(null)

    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 15000)

      if (SVG[riwaya]) {
        const response = await fetch(
          `/api/mushaf-svg?riwaya=${encodeURIComponent(
            riwaya,
          )}&page=${encodeURIComponent(String(page))}`,
          {
            cache: 'force-cache',
            signal: controller.signal,
          },
        )

        window.clearTimeout(timeout)

        if (!response.ok) {
          throw new Error('mushaf svg request failed')
        }

        const data = (await response.json()) as {
          svg?: string
        }

        setSvg(typeof data.svg === 'string' ? data.svg : '')
      } else {
        const response = await fetch(
          `/api/quran?riwaya=${encodeURIComponent(
            riwaya,
          )}&page=${encodeURIComponent(String(page))}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        window.clearTimeout(timeout)

        if (!response.ok) {
          throw new Error('quran request failed')
        }

        const data = (await response.json()) as {
          ayahs?: unknown[]
        }

        setText(Array.isArray(data.ayahs) ? data.ayahs : [])
      }
    } catch (loadError) {
      console.error('SAMEE3 mushaf page load:', loadError)
      setError('تعذر تحميل صفحة المصحف. أعد المحاولة.')
    } finally {
      setLoading(false)
    }
  }, [page, riwaya])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopAudio(false)
    }
  }, [stopAudio])

  useEffect(() => {
    const storedRiwaya = (() => {
      try {
        return localStorage.getItem(RIWAYA_KEY)
      } catch {
        return null
      }
    })()

    const storedReciter = (() => {
      try {
        return localStorage.getItem(RECITER_KEY)
      } catch {
        return null
      }
    })()

    const stored = readStoredAudioState()

    if (!urlRiwaya && storedRiwaya && storedRiwaya in LABELS) {
      setRiwaya(storedRiwaya as Riwaya)
    } else if (!urlRiwaya && stored?.riwaya in LABELS) {
      setRiwaya(stored.riwaya)
    }

    if (!urlReciter && storedReciter) {
      setReciter(storedReciter)
    } else if (!urlReciter && stored?.reciter) {
      setReciter(stored.reciter)
    }

    if (!searchParams.get('page') && stored) {
      setPage(clampPage(stored.page))
      setSelected({
        surah: stored.surah,
        ayah: stored.ayah,
      })
      setActiveAyah({
        surah: stored.surah,
        ayah: stored.ayah,
      })
    }
  }, [searchParams, urlReciter, urlRiwaya])

  useEffect(() => {
    void load()
    stopAudio(false)
  }, [load, stopAudio])

  useEffect(() => {
    if (!svg) return

    const root = document.getElementById('mushaf-svg')
    if (!root) return

    const elements = root.querySelectorAll<SVGElement>(
      '.ayahPolygon, [data-ayah], [data-aya]',
    )

    const cleanups: Array<() => void> = []

    elements.forEach((element) => {
      const surah = getSurahFromSvgElement(element)
      const ayah = getAyahFromSvgElement(element)

      if (!surah || !ayah) {
        return
      }

      setSvgAyahVisual(
        element,
        Boolean(
          activeAyah &&
            surah === activeAyah.surah &&
            ayah === activeAyah.ayah,
        ),
      )

      const onClick = () => {
        const clicked = { surah, ayah }

        if (audioRef.current) {
          try {
            audioRef.current.pause()
          } catch {
            // Ignore.
          }
          setIsPlaying(false)
        }

        setSelected(clicked)
        setActiveAyah(clicked)
      }

      element.addEventListener('click', onClick)
      cleanups.push(() =>
        element.removeEventListener('click', onClick),
      )
    })

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [svg, activeAyah])

  useEffect(() => {
    const root = document.getElementById('mushaf-svg')
    if (!root) return

    updateSvgHighlight(root, activeAyah ?? selected)
  }, [activeAyah, selected, svg])

  useEffect(() => {
    if (activeKey === lastHighlightedKeyRef.current) return
    lastHighlightedKeyRef.current = activeKey

    if (!activeAyah) return

    const now = Date.now()

    if (now - lastSavedAtRef.current < 850) {
      return
    }

    const audio = audioRef.current

    saveAudioState({
      surah: activeAyah.surah,
      ayah: activeAyah.ayah,
      page,
      riwaya,
      reciter,
      currentTime: audio?.currentTime ?? 0,
      audioSrc: audio?.src ?? '',
      savedAt: now,
    })

    lastSavedAtRef.current = now
  }, [activeAyah, activeKey, page, reciter, riwaya])

  const selectAyahFromText = useCallback(
    (surah: number, ayah: number) => {
      if (!Number.isInteger(surah) || !Number.isInteger(ayah)) {
        return
      }

      if (audioRef.current) {
        try {
          audioRef.current.pause()
        } catch {
          // Ignore.
        }
        setIsPlaying(false)
      }

      const next = { surah, ayah }
      setSelected(next)
      setActiveAyah(next)
    },
    [],
  )

  const loadTimingForSelected = useCallback(
    async (surah: number) => {
      const requestId = ++timingsRequestRef.current

      try {
        const read = await findCompatibleTimingRead(
          reciter,
          riwaya,
        )

        if (requestId !== timingsRequestRef.current) {
          return null
        }

        if (!read) {
          setTimingAvailable(false)
          return null
        }

        const rows = await fetchTimingsForSurah(
          surah,
          Number(read.id),
        )

        if (requestId !== timingsRequestRef.current) {
          return null
        }

        if (rows.length === 0) {
          setTimingAvailable(false)
          return null
        }

        activeTimingReadRef.current = read
        activeTimingsRef.current = rows
        activeAudioSurahRef.current = surah
        setTimingAvailable(true)

        return {
          read,
          rows,
        }
      } catch (timingError) {
        console.warn(
          'SAMEE3 ayah timing unavailable:',
          timingError,
        )
        if (requestId === timingsRequestRef.current) {
          setTimingAvailable(false)
        }
        return null
      }
    },
    [reciter, riwaya],
  )

  const createAudioElement = useCallback(
    (
      source: string,
      generation: number,
    ): Promise<HTMLAudioElement> => {
      return new Promise((resolve, reject) => {
        const audio = new Audio()
        audio.preload = 'auto'
        audio.src = source

        let settled = false

        const cleanup = () => {
          audio.removeEventListener('canplay', onCanPlay)
          audio.removeEventListener('error', onError)
          audio.removeEventListener(
            'loadedmetadata',
            onMetadata,
          )
        }

        const onCanPlay = () => {
          if (settled) return
          settled = true
          cleanup()

          if (generation !== audioGenerationRef.current) {
            reject(new Error('audio generation changed'))
            return
          }

          resolve(audio)
        }

        const onMetadata = () => {
          if (audio.readyState >= 2) {
            onCanPlay()
          }
        }

        const onError = () => {
          if (settled) return
          settled = true
          cleanup()
          reject(new Error('audio source failed'))
        }

        audio.addEventListener('canplay', onCanPlay)
        audio.addEventListener('loadedmetadata', onMetadata)
        audio.addEventListener('error', onError)

        window.setTimeout(() => {
          if (settled) return
          if (generation !== audioGenerationRef.current) {
            settled = true
            cleanup()
            reject(new Error('audio generation changed'))
            return
          }

          if (audio.readyState >= 2) {
            onCanPlay()
          } else {
            settled = true
            cleanup()
            reject(new Error('audio source timeout'))
          }
        }, 20000)

        audio.load()
      })
    },
    [],
  )

  const playSelectedAyah = useCallback(async () => {
    if (!selected) return

    const requested = selected
    const generation = ++audioGenerationRef.current

    setIsLoadingAudio(true)
    setError('')

    const existing = audioRef.current
    if (existing) {
      try {
        existing.pause()
        existing.removeAttribute('src')
        existing.load()
      } catch {
        // Ignore.
      }
      audioRef.current = null
    }

    try {
      const timing = await loadTimingForSelected(
        requested.surah,
      )

      if (generation !== audioGenerationRef.current) {
        return
      }

      let source = ''
      let startAtSeconds = 0

      if (timing?.read?.folder_url) {
        source = `${timing.read.folder_url.replace(
          /\/?$/,
          '/',
        )}${String(requested.surah).padStart(3, '0')}.mp3`

        const row = timing.rows.find(
          (item) => item.ayah === requested.ayah,
        )

        startAtSeconds = row
          ? Math.max(0, row.start_time / 1000)
          : 0
      } else {
        const response = await fetch(
          `https://api.alquran.cloud/v1/ayah/${encodeURIComponent(
            `${requested.surah}:${requested.ayah}`,
          )}/${encodeURIComponent(reciter)}`,
          {
            cache: 'no-store',
          },
        )

        if (!response.ok) {
          throw new Error('ayah audio request failed')
        }

        const data = (await response.json()) as {
          data?: {
            audio?: unknown
          }
        }

        if (typeof data?.data?.audio !== 'string') {
          throw new Error('ayah audio unavailable')
        }

        source = data.data.audio
        startAtSeconds = 0
        setTimingAvailable(false)
      }

      if (!source) {
        throw new Error('audio source missing')
      }

      const audio = await createAudioElement(
        source,
        generation,
      )

      if (generation !== audioGenerationRef.current) {
        try {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
        } catch {
          // Ignore.
        }
        return
      }

      audioRef.current = audio
      activeAudioSurahRef.current = requested.surah

      const initialTiming =
        timing?.rows.find(
          (item) => item.ayah === requested.ayah,
        ) ?? null

      setSelected(requested)
      setActiveAyah(requested)

      const updateActiveAyah = () => {
        if (generation !== audioGenerationRef.current) {
          return
        }

        const rows = activeTimingsRef.current
        const surah = activeAudioSurahRef.current

        if (rows.length === 0 || !surah) {
          return
        }

        const currentRow = findTimingForTime(
          rows,
          audio.currentTime * 1000,
        )

        if (!currentRow) return

        const next: SelectedAyah = {
          surah,
          ayah: currentRow.ayah,
        }

        setActiveAyah((previous) => {
          if (
            previous?.surah === next.surah &&
            previous?.ayah === next.ayah
          ) {
            return previous
          }
          return next
        })

        setSelected((previous) => {
          if (!audio.paused) return previous
          return previous
        })

        const now = Date.now()
        if (now - lastSavedAtRef.current >= 850) {
          saveAudioState({
            surah: next.surah,
            ayah: next.ayah,
            page,
            riwaya,
            reciter,
            currentTime: audio.currentTime,
            audioSrc: audio.src,
            savedAt: now,
          })
          lastSavedAtRef.current = now
        }
      }

      const onPlay = () => {
        if (generation !== audioGenerationRef.current) return
        setIsPlaying(true)
      }

      const onPause = () => {
        if (generation !== audioGenerationRef.current) return
        setIsPlaying(false)

        const current = activeAyah ?? requested

        saveAudioState({
          surah: current.surah,
          ayah: current.ayah,
          page,
          riwaya,
          reciter,
          currentTime: audio.currentTime,
          audioSrc: audio.src,
          savedAt: Date.now(),
        })
      }

      const onEnded = () => {
        if (generation !== audioGenerationRef.current) return
        setIsPlaying(false)

        const rows = activeTimingsRef.current
        const last = rows.at(-1)

        if (last) {
          const lastAyah = {
            surah: requested.surah,
            ayah: last.ayah,
          }

          setActiveAyah(lastAyah)
          setSelected(lastAyah)

          saveAudioState({
            surah: lastAyah.surah,
            ayah: lastAyah.ayah,
            page,
            riwaya,
            reciter,
            currentTime: audio.duration || 0,
            audioSrc: audio.src,
            savedAt: Date.now(),
          })
        } else {
          saveAudioState({
            surah: requested.surah,
            ayah: requested.ayah,
            page,
            riwaya,
            reciter,
            currentTime: audio.duration || audio.currentTime,
            audioSrc: audio.src,
            savedAt: Date.now(),
          })
        }
      }

      const onError = () => {
        if (generation !== audioGenerationRef.current) return
        setIsPlaying(false)
        setError(
          timing
            ? 'تعذر تشغيل التلاوة لهذا القارئ. جرّب مرة أخرى.'
            : 'تعذر تشغيل التلاوة الصوتية لهذا القارئ.',
        )
      }

      audio.addEventListener('play', onPlay)
      audio.addEventListener('playing', onPlay)
      audio.addEventListener('pause', onPause)
      audio.addEventListener('ended', onEnded)
      audio.addEventListener('timeupdate', updateActiveAyah)
      audio.addEventListener('progress', updateActiveAyah)
      audio.addEventListener('error', onError)

      if (initialTiming) {
        const safeStart = Math.max(
          0,
          initialTiming.start_time / 1000,
        )

        if (
          Number.isFinite(safeStart) &&
          audio.duration > safeStart
        ) {
          audio.currentTime = Math.min(
            safeStart,
            Math.max(0, audio.duration - 0.05),
          )
        } else {
          audio.currentTime = safeStart
        }
      } else {
        audio.currentTime = startAtSeconds
      }

      updateActiveAyah()

      await audio.play()

      if (generation !== audioGenerationRef.current) {
        try {
          audio.pause()
        } catch {
          // Ignore.
        }
        return
      }

      saveAudioState({
        surah: requested.surah,
        ayah: activeAyah?.ayah ?? requested.ayah,
        page,
        riwaya,
        reciter,
        currentTime: audio.currentTime,
        audioSrc: audio.src,
        savedAt: Date.now(),
      })
    } catch (audioError) {
      console.error(
        'SAMEE3 selected ayah audio:',
        audioError,
      )

      if (generation === audioGenerationRef.current) {
        setIsPlaying(false)
        setTimingAvailable(false)
        setError(
          'تعذر تشغيل التلاوة الآن. تأكد من الاتصال بالإنترنت ثم أعد المحاولة.',
        )
      }
    } finally {
      if (generation === audioGenerationRef.current) {
        setIsLoadingAudio(false)
      }
    }
  }, [
    activeAyah,
    createAudioElement,
    loadTimingForSelected,
    page,
    reciter,
    riwaya,
    selected,
  ])

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current

    if (audio && !audio.paused) {
      audio.pause()
      setIsPlaying(false)
      return
    }

    if (audio && audio.paused && audio.currentTime > 0) {
      try {
        await audio.play()
        setIsPlaying(true)
        return
      } catch {
        // Fall through to a clean source rebuild.
      }
    }

    await playSelectedAyah()
  }, [playSelectedAyah])

  const closeSelection = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause()
      } catch {
        // Ignore.
      }
      setIsPlaying(false)
    }

    setSelected(null)
    setActiveAyah(null)
  }, [])

  const goToPage = useCallback(
    (nextPage: number) => {
      const safe = clampPage(nextPage)
      setPage(safe)

      const stored = activeAyah ?? selected
      if (stored) {
        saveAudioState({
          surah: stored.surah,
          ayah: stored.ayah,
          page: safe,
          riwaya,
          reciter,
          currentTime: audioRef.current?.currentTime ?? 0,
          audioSrc: audioRef.current?.src ?? '',
          savedAt: Date.now(),
        })
      }
    },
    [activeAyah, reciter, riwaya, selected],
  )

  const searchSurah = useCallback(
    async (value: string) => {
      const query = value.trim()
      if (!query) return

      const index = SURAHS.findIndex(
        (name) => name.includes(query),
      )

      if (index < 0) return

      try {
        const edition = SVG[riwaya]

        if (edition) {
          const response = await fetch(
            `https://raw.githubusercontent.com/quran-ws/quran-svg/main/mushafs/${edition}/json/surah.json`,
            {
              cache: 'force-cache',
            },
          )

          if (response.ok) {
            const data = (await response.json()) as unknown
            const rows = Array.isArray(data) ? data : []

            const row = rows.find(
              (item) =>
                Number(
                  (item as { number?: unknown })?.number,
                ) ===
                index + 1,
            ) as { pageNumber?: unknown } | undefined

            const nextPage = Number(row?.pageNumber)

            if (
              Number.isInteger(nextPage) &&
              nextPage >= 1 &&
              nextPage <= 604
            ) {
              goToPage(nextPage)
              return
            }
          }
        }
      } catch {
        // Use a safe fallback below.
      }

      const fallbackPage = clampPage(
        Math.round(
          2 +
            (index / Math.max(1, SURAHS.length - 1)) *
              602,
        ),
      )

      goToPage(fallbackPage)
    },
    [goToPage, riwaya],
  )

  const selectedLabel = currentDisplayAyah
    ? `${currentDisplayAyah.surah}:${currentDisplayAyah.ayah}`
    : ''

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#eef4ef] pb-24"
    >
      <style jsx global>{`
        #mushaf-svg .ayahPolygon,
        #mushaf-svg [data-ayah],
        #mushaf-svg [data-aya] {
          transition:
            fill-opacity 160ms ease-out,
            stroke-opacity 160ms ease-out,
            stroke-width 160ms ease-out;
          vector-effect: non-scaling-stroke;
        }

        #mushaf-svg .ayahPolygon:hover,
        #mushaf-svg [data-ayah]:hover,
        #mushaf-svg [data-aya]:hover {
          fill-opacity: 0.07;
        }

        @media (prefers-reduced-motion: reduce) {
          #mushaf-svg .ayahPolygon,
          #mushaf-svg [data-ayah],
          #mushaf-svg [data-aya] {
            transition: none !important;
          }
        }
      `}</style>

      <div className="fixed top-2 left-1/2 z-50 -translate-x-1/2">
        <button
          type="button"
          aria-label={
            open ? 'إغلاق خيارات المصحف' : 'فتح خيارات المصحف'
          }
          onClick={() => setOpen((value) => !value)}
          className="flex h-7 w-11 items-center justify-center rounded-b-2xl border bg-white text-[#17624f] shadow-lg"
        >
          {open ? (
            <ChevronUp size={16} />
          ) : (
            <ChevronDown size={16} />
          )}
        </button>
      </div>

      {open && (
        <div className="fixed top-9 left-1/2 z-50 w-[94vw] max-w-xl -translate-x-1/2 rounded-3xl border border-[#d8c79c] bg-[#fbfaf4] p-4 shadow-2xl">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-[#123f35]">
              الرواية
              <select
                value={riwaya}
                onChange={(event) => {
                  const value =
                    event.target.value as Riwaya
                  setRiwaya(value)
                  saveSimplePreference(
                    RIWAYA_KEY,
                    value,
                  )
                }}
                className="mt-1 w-full rounded-xl border bg-white p-3"
              >
                {Object.entries(LABELS).map(
                  ([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="text-xs font-bold text-[#123f35]">
              القارئ
              <select
                value={reciter}
                onChange={(event) => {
                  const value = event.target.value
                  setReciter(value)
                  saveSimplePreference(
                    RECITER_KEY,
                    value,
                  )
                }}
                className="mt-1 w-full rounded-xl border bg-white p-3"
              >
                {RECITERS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="relative mt-3">
            <Search
              size={15}
              className="absolute right-3 top-3.5 text-gray-400"
            />
            <input
              aria-label="بحث عن سورة"
              placeholder="ابحث عن سورة"
              className="w-full rounded-xl border bg-white p-3 pr-9"
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                void searchSurah(event.currentTarget.value)
              }}
            />
          </div>

          <p className="mt-3 text-[10px] leading-5 text-gray-500">
            التمييز الصوتي يعتمد على توقيتات الآيات المتاحة
            للقارئ. عند عدم توفر توقيت متوافق، يستمر التشغيل
            بالصوت المتاح دون اختراع توقيت غير دقيق.
          </p>
        </div>
      )}

      <section className="flex flex-col items-center px-2 pt-9">
        <div className="mb-2 flex w-full max-w-[760px] items-center justify-between px-2 text-[11px] font-bold text-[#17624f]">
          <span>{LABELS[riwaya]}</span>
          <span>
            صفحة {page.toLocaleString('ar-EG')} / 604
          </span>
          <span>{reciterName}</span>
        </div>

        <div className="w-full max-w-[760px] rounded-[30px] bg-[#cdb77d] p-1.5 shadow-2xl">
          <div className="overflow-hidden rounded-[24px] border border-[#9f8956] bg-[#fbfaf3]">
            {loading ? (
              <div className="flex min-h-[620px] items-center justify-center">
                <Loader2
                  className="animate-spin text-[#17624f]"
                  size={34}
                />
              </div>
            ) : error ? (
              <div className="flex min-h-[620px] flex-col items-center justify-center gap-4 px-5 text-center font-bold">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => void load()}
                  className="rounded-xl bg-[#17624f] px-5 py-3 text-white"
                >
                  إعادة المحاولة
                </button>
              </div>
            ) : SVG[riwaya] ? (
              <div
                id="mushaf-svg"
                className="w-full [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                dangerouslySetInnerHTML={{
                  __html: svg,
                }}
              />
            ) : (
              <div className="bg-[#fbfaf3] p-5 sm:p-10">
                <div className="rounded-[22px] border border-[#d7c58f] bg-[#fffdf7] p-6 text-center shadow-inner sm:p-9">
                  <div className="mb-5 text-[10px] font-black text-[#9a7731]">
                    {LABELS[riwaya]}
                  </div>

                  <div className="font-uthmani text-[25px] leading-[2.5] text-[#171717] sm:text-[32px]">
                    {text.map((item, index) => {
                      const value = item as {
                        key?: string | number
                        text?: string
                        numberInSurah?: number
                        surah?: {
                          number?: number
                        }
                      }

                      const surahNumber = Number(
                        value?.surah?.number ?? 0,
                      )
                      const ayahNumber = Number(
                        value?.numberInSurah ?? 0,
                      )

                      const isActive =
                        Boolean(activeAyah) &&
                        activeAyah?.surah ===
                          surahNumber &&
                        activeAyah?.ayah === ayahNumber

                      return (
                        <button
                          key={
                            value?.key ??
                            `${surahNumber}:${ayahNumber}:${index}`
                          }
                          type="button"
                          data-ayah={ayahNumber}
                          data-surah={surahNumber}
                          onClick={() =>
                            selectAyahFromText(
                              surahNumber,
                              ayahNumber,
                            )
                          }
                          className={[
                            'inline rounded-lg px-0.5 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#0284C7]/30',
                            isActive
                              ? 'bg-[#0284C7]/10 text-[#0f172a]'
                              : 'hover:bg-[#dfeee9]',
                          ].join(' ')}
                        >
                          {value?.text ?? ''}
                          <span
                            className={
                              isActive
                                ? 'text-[#0284C7]'
                                : 'text-[#a4833d]'
                            }
                          >
                            {' '}
                            ﴿
                            {value?.numberInSurah}
                            ﴾
                          </span>
                          {' '}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex w-full max-w-[760px] items-center justify-between gap-2">
          <button
            type="button"
            disabled={page >= 604}
            onClick={() => goToPage(page + 1)}
            className="rounded-2xl border bg-white px-5 py-3 text-sm font-bold text-[#123f35] disabled:opacity-30"
          >
            التالي
          </button>

          <input
            aria-label="رقم الصفحة"
            type="number"
            min={1}
            max={604}
            value={page}
            onChange={(event) =>
              goToPage(
                clampPage(Number(event.target.value)),
              )
            }
            className="w-24 rounded-xl border bg-white py-3 text-center font-bold"
          />

          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            className="rounded-2xl border bg-white px-5 py-3 text-sm font-bold text-[#123f35] disabled:opacity-30"
          >
            السابق
          </button>
        </div>
      </section>

      {selected && (
        <div className="fixed bottom-16 left-1/2 z-40 w-[94vw] max-w-md -translate-x-1/2 rounded-3xl bg-[#123f35] p-4 text-white shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-white/60">
                الآية الحالية
              </p>
              <div className="mt-1 flex items-center gap-2">
                <b className="text-lg">
                  {selectedLabel}
                </b>
                {isPlaying && (
                  <span className="rounded-full bg-[#0284C7]/20 px-2 py-0.5 text-[9px] text-[#b9e9ff]">
                    تُتلى الآن
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-[10px] text-white/55">
                {reciterName}
              </p>
              {timingAvailable === true && (
                <p className="mt-1 text-[9px] text-white/45">
                  تمييز الآيات متزامن مع التلاوة
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={isLoadingAudio}
                onClick={() => void togglePlayPause()}
                className="flex items-center gap-2 rounded-xl bg-[#0284C7] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {isLoadingAudio ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : isPlaying ? (
                  <Pause size={17} />
                ) : (
                  <Play size={17} />
                )}
                {isLoadingAudio
                  ? 'جاري التجهيز'
                  : isPlaying
                    ? 'إيقاف مؤقت'
                    : 'استماع'}
              </button>

              <button
                type="button"
                aria-label="إغلاق الآية المحددة"
                onClick={closeSelection}
                className="rounded-xl bg-white/10 p-2"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-2 left-1/2 z-30 grid w-[94vw] max-w-md -translate-x-1/2 grid-cols-3 rounded-3xl bg-[#123f35] p-2 text-xs font-bold">
        <Link
          href="/"
          className="py-3 text-center text-white"
        >
          الرئيسية
        </Link>

        <Link
          href="/surahs"
          className="flex items-center justify-center gap-1 py-3 text-center text-[#e2c36f]"
        >
          <List size={15} />
          الفهرس
        </Link>

        <Link
          href="/profile"
          className="flex items-center justify-center gap-1 py-3 text-center text-white"
        >
          <UserRound size={15} />
          الحساب
        </Link>
      </nav>
    </main>
  )
}