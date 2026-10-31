
#!/usr/bin/env node
'use strict'
/**
 * Carefully patches SAMEE3's existing surah index and visual-ayahs components.
 * Only writes after every expected anchor is present; never replaces whole pages.
 * For unknown/reworked page versions it FAILS without touching the originals.
 */
const fs = require('node:fs')
const path = require('node:path')
const base = process.cwd()
const FILES = {
  index: 'app/surahs/page.tsx',
  config: 'lib/samee3-visual-config.ts',
  visual: 'app/visual-ayahs/page.tsx',
}
const MARK = 'SAMEE3_ALAFASY_COLLECTED_INDEX_VISUAL_V1'
function must(src, match, desc) {
  if (!src.includes(match)) throw new Error(`${desc}: expected source anchor not found: ${match.slice(0, 85)}`)
}
function once(src, search, replacement, desc) {
  must(src, search, desc)
  if (src.split(search).length !== 2) throw new Error(`${desc}: ambiguous source anchor: ${search.slice(0, 65)}`)
  return src.replace(search, replacement)
}
function applyIndex(src) {
  if (src.includes(MARK)) return src
  const id = FILES.index
  // The existing index links to /mushaf with an encoded `reciter` selection.
  must(src, 'reciter=${encodeURIComponent(c)}', id)
  must(src, "const[c,setC]", id)
  src = once(src,
    '<option value="ar.alafasy">',
    `{/* ${MARK}: The collected recording is available in Hafs only. */}{r === 'hafs' && <option value="9000123">مشاري العفاسي – مصحف مجمع</option>}<option value="ar.alafasy">`, id)
  // Prevent carrying the Hafs-only option into another riwaya.
  src = once(src,
    'reciter=${encodeURIComponent(c)}',
    'reciter=${encodeURIComponent(r === \'hafs\' ? c : c === \'9000123\' ? \'ar.alafasy\' : c)}', id)
  return src
}
function applyConfig(src) {
  if (src.includes(MARK)) return src
  const id = FILES.config
  must(src, 'export const READERS:', id)
  return once(src,
    "  { id: 'afasy', name: 'مشاري راشد العفاسي' },",
    "  { id: 'afasy', name: 'مشاري راشد العفاسي' },\n" +
    `  { id: 'alafasy-collected', name: 'مشاري العفاسي – مصحف مجمع' }, // ${MARK}`,
    id)
}
function applyVisual(src) {
  if (src.includes(MARK)) return src
  const id = FILES.visual
  must(src, "'use client'", id)
  src = once(src, "'use client'\n",
    "'use client'\n" +
    `// ${MARK}\n` +
    "import { ALAFASY_COLLECTED_VISUAL_ID, loadCollectedVisualClip } from '@/lib/samee3-collected-visual'\n", id)
  src = once(src,
    'type Prepared = {\n  verses: Verse[]\n  buffers: AudioBuffer[]\n  starts: number[]\n  duration: number\n}',
    'type Prepared = {\n  verses: Verse[]\n  buffers: AudioBuffer[]\n  starts: number[]\n  duration: number\n  stream?: { url: string; startSeconds: number }\n}', id)
  src = once(src,
    '  const audioContext = useRef<AudioContext | null>(null)',
    '  const audioContext = useRef<AudioContext | null>(null)\n' +
    '  const collectedAudioRef = useRef<HTMLAudioElement | null>(null)\n' +
    '  const collectedAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null)', id)
  src = once(src,
    '    if (player.playing && audioContext.current) {\n      player.position = Math.max(0, audioContext.current.currentTime - player.begin)\n    }',
    '    if (player.playing && preparedRef.current?.stream && collectedAudioRef.current) {\n' +
    '      const clip = preparedRef.current\n' +
    '      player.position = Math.max(0, Math.min(clip.duration, collectedAudioRef.current.currentTime - clip.stream!.startSeconds))\n' +
    '    } else if (player.playing && audioContext.current) {\n' +
    '      player.position = Math.max(0, audioContext.current.currentTime - player.begin)\n' +
    '    }', id)
  src = once(src, '    playbackSources.current = []\n    if (reset)',
    '    playbackSources.current = []\n    collectedAudioRef.current?.pause()\n    if (reset)', id)
  src = once(src, '  async function prepareAudio() {',
    `  // Shared streaming element: seek into the original surah instead of decoding it in RAM.\n` +
    `  function collectedElement(prep: Prepared, context: AudioContext): HTMLAudioElement {\n` +
    `    if (!prep.stream) throw new Error('لا توجد تلاوة مجمعة مجهزة.')\n` +
    `    const target = new URL(prep.stream.url, window.location.href).href\n` +
    `    if (!collectedAudioRef.current || collectedAudioRef.current.src !== target) {\n` +
    `      collectedAudioRef.current?.pause()\n` +
    `      collectedAudioSourceRef.current?.disconnect()\n` +
    `      const audio = new Audio()\n` +
    `      audio.crossOrigin = 'anonymous'\n` +
    `      audio.preload = 'auto'\n` +
    `      audio.src = prep.stream.url\n` +
    `      collectedAudioRef.current = audio\n` +
    `      const source = context.createMediaElementSource(audio)\n` +
    `      source.connect(context.destination)\n` +
    `      collectedAudioSourceRef.current = source\n` +
    `    }\n` +
    `    return collectedAudioRef.current\n` +
    `  }\n\n` +
    `  async function seekCollected(audio: HTMLAudioElement, target: number): Promise<void> {\n` +
    `    if (audio.readyState < 1) {\n` +
    `      await new Promise<void>((resolve, reject) => {\n` +
    `        const done = () => { clearTimeout(timer); audio.removeEventListener('loadedmetadata', ok); audio.removeEventListener('error', bad) }\n` +
    `        const ok = () => { done(); resolve() }\n` +
    `        const bad = () => { done(); reject(new Error('تعذّر فتح ملف تسجيل العفاسي المجمع.')) }\n` +
    `        const timer = window.setTimeout(bad, 20000)\n` +
    `        audio.addEventListener('loadedmetadata', ok)\n` +
    `        audio.addEventListener('error', bad)\n` +
    `        audio.load()\n` +
    `      })\n` +
    `    }\n` +
    `    audio.currentTime = target\n` +
    `    if (audio.seeking) {\n` +
    `      await new Promise<void>(resolve => {\n` +
    `        const finish = () => { clearTimeout(timer); audio.removeEventListener('seeked', finish); resolve() }\n` +
    `        const timer = window.setTimeout(finish, 8000)\n` +
    `        audio.addEventListener('seeked', finish)\n` +
    `      })\n` +
    `    }\n` +
    `  }\n\n` +
    '  async function prepareAudio() {', id)
  src = once(src, '      const buffers: AudioBuffer[] = []',
    `      if (reader === ALAFASY_COLLECTED_VISUAL_ID) {\n` +
    `        const clip = await loadCollectedVisualClip(surah, chosenVerses.map(v => v.number), controller.signal)\n` +
    `        if (id !== requestId.current) return\n` +
    `        const created: Prepared = {\n` +
    `          verses: chosenVerses, buffers: [], starts: clip.starts, duration: clip.duration,\n` +
    `          stream: { url: clip.url, startSeconds: clip.startSeconds },\n` +
    `        }\n` +
    `        preparedRef.current = created\n` +
    `        setPrepared(created)\n` +
    `        setPosition(0)\n` +
    `        playback.current.position = 0\n` +
    `        setTab(3)\n` +
    `        return\n` +
    `      }\n` +
    `      const buffers: AudioBuffer[] = []`, id)
  src = once(src, '      const offset = player.position\n      const base = context.currentTime + .08',
    `      const offset = player.position\n` +
    `      if (prep.stream) {\n` +
    `        const audio = collectedElement(prep, context)\n` +
    `        await seekCollected(audio, prep.stream.startSeconds + offset)\n` +
    `        await audio.play()\n` +
    `        player.begin = context.currentTime - offset\n` +
    `        player.playing = true\n` +
    `        setPlaying(true)\n` +
    `        await videoRef.current?.play().catch(() => {})\n` +
    `        return\n` +
    `      }\n` +
    `      const base = context.currentTime + .08`, id)
  src = once(src,
    '          if (exportTime.current === null && player.playing && audioContext.current) {\n            second = Math.max(0, audioContext.current.currentTime - player.begin)\n          }',
    `          if (exportTime.current === null && player.playing && prep?.stream && collectedAudioRef.current) {\n` +
    `            second = Math.max(0, collectedAudioRef.current.currentTime - prep.stream.startSeconds)\n` +
    `          } else if (exportTime.current === null && player.playing && audioContext.current) {\n` +
    `            second = Math.max(0, audioContext.current.currentTime - player.begin)\n` +
    `          }`, id)
  src = once(src,
    `            verseProgress: prep && prep.buffers[index]?.duration\n              ? (second - prep.starts[index]) / prep.buffers[index].duration\n              : 0,`,
    `            verseProgress: prep && prep.stream\n` +
    `              ? Math.max(0, Math.min(1, (second - prep.starts[index]) /\n` +
    `                Math.max(.01, (prep.starts[index + 1] ?? prep.duration) - prep.starts[index])))\n` +
    `              : prep && prep.buffers[index]?.duration\n` +
    `                ? (second - prep.starts[index]) / prep.buffers[index].duration\n` +
    `                : 0,`, id)
  src = once(src,
    `      destination = context.createMediaStreamDestination()\n      recordedStream`,
    `      destination = context.createMediaStreamDestination()\n` +
    `      if (prep.stream) {\n` +
    `        const audio = collectedElement(prep, context)\n` +
    `        await seekCollected(audio, prep.stream.startSeconds)\n` +
    `        collectedAudioSourceRef.current?.connect(destination)\n` +
    `      }\n` +
    `      recordedStream`, id)
  src = once(src,
    `        mediaRecorder.start(400)\n        const audioStart = context.currentTime + .12\n        prep.buffers.forEach((buffer, index) => {`,
    `        mediaRecorder.start(400)\n` +
    `        if (prep.stream) {\n` +
    `          void collectedAudioRef.current!.play().catch(() => fail(new Error('تعذّر تشغيل صوت العفاسي أثناء التصدير.')))\n` +
    `        }\n` +
    `        const audioStart = context.currentTime + (prep.stream ? 0 : .12)\n` +
    `        prep.buffers.forEach((buffer, index) => {`, id)
  src = once(src,
    `          const seconds = Math.max(0, context.currentTime - audioStart)`,
    `          const seconds = prep.stream && collectedAudioRef.current\n` +
    `            ? Math.max(0, collectedAudioRef.current.currentTime - prep.stream.startSeconds)\n` +
    `            : Math.max(0, context.currentTime - audioStart)`, id)
  src = once(src,
    `      destination?.disconnect()\n      playback.current.position = 0`,
    `      if (prep.stream) {\n` +
    `        collectedAudioRef.current?.pause()\n` +
    `        if (destination) {\n` +
    `          try { collectedAudioSourceRef.current?.disconnect(destination) } catch { /* no connection */ }\n` +
    `        }\n` +
    `      }\n` +
    `      destination?.disconnect()\n      playback.current.position = 0`, id)
  return src
}
const originals = Object.fromEntries(Object.entries(FILES).map(([key, name]) => {
  const full = path.join(base, name)
  if (!fs.existsSync(full)) throw new Error(`Missing ${name}; run from SAMEE3 repository root`)
  return [key, fs.readFileSync(full, 'utf8')]
}))
for (const f of ['lib/samee3-collected-visual.ts', 'app/api/alafasy-timings/[surah]/route.ts', 'app/api/alafasy-audio/[surah]/route.ts']) {
  if (!fs.existsSync(path.join(base, f))) throw new Error(`Missing existing prerequisite: ${f}`)
}
// Prepare every patch FIRST; on a mismatch all original pages stay untouched.
const updated = {
  index: applyIndex(originals.index),
  config: applyConfig(originals.config),
  visual: applyVisual(originals.visual),
}
for (const [key, name] of Object.entries(FILES)) {
  if (updated[key] !== originals[key]) {
    fs.writeFileSync(path.join(base, name), updated[key], 'utf8')
    console.log(`Updated ${name}`)
  } else console.log(`Already integrated: ${name}`)
}
console.log('SAMEE3 collected Alafasy index + visual ayahs patch applied.')