'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Check, Download, ExternalLink, Film, Loader2, Pause,
  Play, RefreshCcw, Share2, Upload, Volume2, X,
} from 'lucide-react'
import { GROUPS, SCENES, sceneFromFile, type Scene } from '@/lib/samee3-visual-library'
import { clipKeys, readClip, saveClip } from '@/lib/samee3-visual-storage'

type Surah = { id: number; name: string; count: number }
type Verse = { number: number; text: string }
type Prepared = { verses: Verse[]; buffers: AudioBuffer[]; starts: number[]; duration: number }
type MadeVideo = { blob: Blob; url: string; filename: string }

const names = 'الفاتحة|البقرة|آل عمران|النساء|المائدة|الأنعام|الأعراف|الأنفال|التوبة|يونس|هود|يوسف|الرعد|إبراهيم|الحجر|النحل|الإسراء|الكهف|مريم|طه|الأنبياء|الحج|المؤمنون|النور|الفرقان|الشعراء|النمل|القصص|العنكبوت|الروم|لقمان|السجدة|الأحزاب|سبأ|فاطر|يس|الصافات|ص|الزمر|غافر|فصلت|الشورى|الزخرف|الدخان|الجاثية|الأحقاف|محمد|الفتح|الحجرات|ق|الذاريات|الطور|النجم|القمر|الرحمن|الواقعة|الحديد|المجادلة|الحشر|الممتحنة|الصف|الجمعة|المنافقون|التغابن|الطلاق|التحريم|الملك|القلم|الحاقة|المعارج|نوح|الجن|المزمل|المدثر|القيامة|الإنسان|المرسلات|النبأ|النازعات|عبس|التكوير|الانفطار|المطففين|الانشقاق|البروج|الطارق|الأعلى|الغاشية|الفجر|البلد|الشمس|الليل|الضحى|الشرح|التين|العلق|القدر|البينة|الزلزلة|العاديات|القارعة|التكاثر|العصر|الهمزة|الفيل|قريش|الماعون|الكوثر|الكافرون|النصر|المسد|الإخلاص|الفلق|الناس'.split('|')
const counts = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6]
const fallbackSurahs: Surah[] = names.map((name, i) => ({ id: i + 1, name, count: counts[i] }))
const READERS = [
  { id: 'husary', name: 'محمود خليل الحصري' },
  { id: 'afasy', name: 'مشاري راشد العفاسي' },
  { id: 'minshawy', name: 'محمد صديق المنشاوي' },
  { id: 'basit', name: 'عبد الباسط عبد الصمد' },
  { id: 'maher', name: 'ماهر المعيقلي' },
  { id: 'sudais', name: 'عبد الرحمن السديس' },
]
const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold disabled:opacity-45'
const primary = btn + ' bg-[#245343] text-white'
const secondary = btn + ' border border-[#e0d9c8] bg-white text-[#2a5446]'
const input = 'mt-2 w-full rounded-2xl border border-[#e1d9c7] bg-white p-3 text-sm outline-none focus:border-[#aa8c4f]'
const panel = 'rounded-[26px] border border-[#e6dfd1] bg-white p-5 shadow-sm'
const ar = (v: number) => v.toLocaleString('ar-EG', { useGrouping: false })
const timerLabel = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

async function api<T>(params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const res = await fetch('/api/visual-ayahs?' + new URLSearchParams(params), { signal, cache: 'no-store' })
  const body = await res.json()
  if (!res.ok) throw Error(typeof body.error === 'string' ? body.error : 'تعذر تحميل البيانات')
  return body as T
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const rows: string[] = []; let row = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const attempt = row ? row + ' ' + word : word
    if (row && ctx.measureText(attempt).width > maxWidth) { rows.push(row); row = word }
    else row = attempt
  }
  if (row) rows.push(row)
  return rows
}
function hushAudio() {
  document.querySelectorAll<HTMLAudioElement>('audio').forEach(a => a.pause())
  const w = window as Window & { __samee3PersistentAudio?: HTMLAudioElement & { __samee3Continue?: boolean } }
  if (w.__samee3PersistentAudio) { w.__samee3PersistentAudio.__samee3Continue = false; w.__samee3PersistentAudio.pause() }
}

export default function VisualAyahsPage() {
  const [step, setStep] = useState(1)
  const [group, setGroup] = useState('الكل')
  const [scene, setScene] = useState<Scene>(SCENES[0])
  const [repositoryScenes, setRepositoryScenes] = useState<Scene[]>([])
  const [localScenes, setLocalScenes] = useState<Scene[]>([])
  const [galleryBusy, setGalleryBusy] = useState(false)
  const [galleryMessage, setGalleryMessage] = useState('')
  const [galleryRevision, setGalleryRevision] = useState(0)
  const [cached, setCached] = useState<string[]>([])
  const [sceneRevision, setSceneRevision] = useState(0)
  const [backgroundReady, setBackgroundReady] = useState(false)
  const [backgroundStatus, setBackgroundStatus] = useState('')
  const [surahs, setSurahs] = useState<Surah[]>(fallbackSurahs)
  const [surah, setSurah] = useState(13)
  const [verses, setVerses] = useState<Verse[]>([])
  const [verseLoading, setVerseLoading] = useState(true)
  const [verseError, setVerseError] = useState('')
  const [verseRetry, setVerseRetry] = useState(0)
  const [start, setStart] = useState(28)
  const [end, setEnd] = useState(28)
  const [reader, setReader] = useState('husary')
  const [busy, setBusy] = useState<'idle' | 'prepare' | 'export'>('idle')
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [result, setResult] = useState<MadeVideo | null>(null)
  const [ratio, setRatio] = useState<'9:16' | '1:1' | '16:9'>('9:16')
  const [quality, setQuality] = useState(720)
  const [shade, setShade] = useState(45)
  const [signature, setSignature] = useState('مصحف سميع')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const sourcesRef = useRef<AudioBufferSourceNode[]>([])
