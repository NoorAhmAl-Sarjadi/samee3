
'use strict'

/*
 * SAMEE3 — Collected Alafasy integration V2
 * Based on the current index and visual-ayahs source.
 * Updates existing files without replacing complete pages.
 *
 * The GitHub workflow must run npm run build
 * BEFORE committing modified files.
 */

const fs = require('node:fs')
const path = require('node:path')

const ROOT = process.cwd()
const MARK = 'SAMEE3_ALAFASY_COLLECTED_INDEX_VISUAL_V2'

const paths = {
  index: 'app/surahs/page.tsx',
  config: 'lib/samee3-visual-config.ts',
  visual: 'app/visual-ayahs/page.tsx',
}

function read(file) {
  const filename = path.join(ROOT, file)

  if (!fs.existsSync(filename)) {
    throw new Error('Missing required file: ' + file)
  }

  return fs.readFileSync(filename, 'utf8')
    .replace(/\r\n/g, '\n')
}

function replaceOne(source, original, replacement, label) {
  const first = source.indexOf(original)

  if (first < 0) {
    throw new Error(
      label + ': expected code not found. Nothing will be written.'
    )
  }

  if (source.indexOf(original, first + original.length) >= 0) {
    throw new Error(
      label + ': duplicate match. Nothing will be written.'
    )
  }

  return source.slice(0, first) +
    replacement +
    source.slice(first + original.length)
}

function insertBefore(source, anchor, addition, label) {
  return replaceOne(source, anchor, addition + anchor, label)
}

function patchIndex(source) {
  if (source.includes(MARK)) return source

  source = insertBefore(
    source,
    "const OFFLINE_PACKAGES_KEY =",
    `// ${MARK}
const COLLECTED_API_ID = 9000123
const COLLECTED_MOSHAF_ID = 900012301

function createCollectedReciter(): Reciter {
  return {
    id: '9000123-900012301',
    apiId: COLLECTED_API_ID,
    label: 'مشاري العفاسي – مصحف مجمع',
    moshaf: {
      id: COLLECTED_MOSHAF_ID,
      name: 'حفص عن عاصم – مصحف مجمع',
      rewaya_id: 1,
      server: window.location.origin + '/api/alafasy-audio/',
      surah_total: 114,
      surah_list: Array.from(
        { length: 114 },
        (_, index) => index + 1
      ).join(','),
    },
  }
}

`,
    'Index reader definition'
  )

  source = replaceOne(
    source,
    `      } catch {}
      return result
    }

    // عند انقطاع الإنترنت`,
    `      } catch {}

      if (
        riwayaId === 'hafs' &&
        !result.some(
          item => item.apiId === COLLECTED_API_ID &&
          item.moshaf.id === COLLECTED_MOSHAF_ID
        )
      ) {
        result.unshift(createCollectedReciter())
      }

      return result
    }

    // عند انقطاع الإنترنت`,
    'Index offline reader list'
  )

  source = insertBefore(
    source,
    `      const uniqueReciters = Array.from(`,
    `      // Keep the collected recording independent from MP3Quran.
      if (riwayaId === 'hafs') {
        nextReciters.unshift(createCollectedReciter())
      }

`,
    'Index online reader list'
  )

  return source
}

function patchConfig(source) {
  if (source.includes(MARK)) return source

  const original =
    "  { id: 'afasy', name: 'مشاري راشد العفاسي', folder: 'Alafasy_128kbps' },"

  return replaceOne(
    source,
    original,
    original + '\n' +
      "  { id: 'alafasy-collected', name: 'مشاري العفاسي – مصحف مجمع', folder: 'ALAFASY_COLLECTED' }, // " +
      MARK,
    'Visual reciter configuration'
  )
}

function patchVisual(source) {
  if (source.includes(MARK)) return source

  source = replaceOne(
    source,
    `type Prepared = {
  verses: Verse[]
  buffers: AudioBuffer[]
  starts: number[]
  duration: number
}`,
    `type Prepared = {
  verses: Verse[]
  buffers: AudioBuffer[]
  starts: number[]
  duration: number
  stream?: {
    url: string
    startSeconds: number
  }
}

// ${MARK}
type CollectedClip = {
  url: string
  startSeconds: number
  duration: number
  starts: number[]
}

async function loadCollectedVisualClip(
  surah: number,
  numbers: readonly number[],
  signal: AbortSignal
): Promise<CollectedClip> {
  if (
    !Number.isInteger(surah) ||
    surah < 1 ||
    surah > 114 ||
    !numbers.length ||
    numbers.length > MAX_AYAH_COUNT ||
    numbers.some(
      (number, index) =>
        !Number.isInteger(number) ||
        number < 1 ||
        (
          index > 0 &&
          number !== numbers[index - 1] + 1
        )
    )
  ) {
    throw new Error('اختر آيات صحيحة ومتتابعة.')
  }

  const response = await fetch(
    '/api/alafasy-timings/' + surah,
    {
      signal,
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    throw new Error(
      'تعذر تحميل توقيتات العفاسي المجمع.'
    )
  }

  const payload: unknown = await response.json()

  if (!Array.isArray(payload)) {
    throw new Error('صيغة ملف التوقيتات غير صحيحة.')
  }

  const rows = new Map<
    number,
    { start: number; end: number }
  >()

  for (const raw of payload) {
    if (
      !raw ||
      typeof raw !== 'object' ||
      Array.isArray(raw)
    ) {
      continue
    }

    const item = raw as Record<string, unknown>

    const ayah = Number(item.ayah)
    const start = Number(item.start_time)
    const end = Number(item.end_time)

    if (
      !Number.isInteger(ayah) ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start
    ) {
      throw new Error('توقيتات التسجيل غير صالحة.')
    }

    if (rows.has(ayah)) {
      throw new Error('يوجد توقيت مكرر للآية.')
    }

    rows.set(ayah, { start, end })
  }

  const selected = numbers.map(number => rows.get(number))

  if (selected.some(item => !item)) {
    throw new Error('لم يتم العثور على توقيت بعض الآيات.')
  }

  const times = selected as Array<{
    start: number
    end: number
  }>

  for (let index = 1; index < times.length; index++) {
    if (
      times[index].start <
      times[index - 1].end - 1000
    ) {
      throw new Error('توقيتات الآيات غير متتابعة.')
    }
  }

  const first = times[0].start
  const last = times[times.length - 1].end
  const duration = (last - first) / 1000

  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > MAX_DURATION_SECONDS
  ) {
    throw new Error(
      'مدة التلاوة تتجاوز الحد المتاح. اختر آيات أقل.'
    )
  }

  return {
    url:
      '/api/alafasy-audio/' +
      String(surah).padStart(3, '0') +
      '.mp3',
    startSeconds: first / 1000,
    duration,
    starts: times.map(
      item => (item.start - first) / 1000
    ),
  }
}`,
    'Visual prepared audio type'
  )

  source = replaceOne(
    source,
    `  const playbackSources =
    useRef<AudioBufferSourceNode[]>([])`,
    `  const playbackSources =
    useRef<AudioBufferSourceNode[]>([])

  const collectedAudioRef =
    useRef<HTMLAudioElement | null>(null)

  const collectedAudioNodeRef =
    useRef<MediaElementAudioSourceNode | null>(null)`,
    'Visual streaming references'
  )

  source = replaceOne(
    source,
    `      if (
        player.playing &&
        audioContext.current
      ) {
        player.position = Math.max(
          0,
          audioContext.current.currentTime -
            player.begin
        )
      }`,
    `      if (
        player.playing &&
        preparedRef.current?.stream &&
        collectedAudioRef.current
      ) {
        const clip = preparedRef.current
        player.position = Math.max(
          0,
          Math.min(
            clip.duration,
            collectedAudioRef.current.currentTime -
              clip.stream.startSeconds
          )
        )
      } else if (
        player.playing &&
        audioContext.current
      ) {
        player.position = Math.max(
          0,
          audioContext.current.currentTime -
            player.begin
        )
      }`,
    'Visual playback position'
  )

  source = replaceOne(
    source,
    `      playbackSources.current = []

      if (reset)`,
    `      playbackSources.current = []
      collectedAudioRef.current?.pause()

      if (reset)`,
    'Visual playback pause'
  )

  source = insertBefore(
    source,
    `  async function prepareAudio() {`,
    `  function collectedAudioElement(
    prep: Prepared,
    context: AudioContext
  ): HTMLAudioElement {
    if (!prep.stream) {
      throw new Error('التسجيل المجمع غير مجهز.')
    }

    const url = new URL(
      prep.stream.url,
      window.location.href
    ).href

    if (
      collectedAudioRef.current &&
      collectedAudioRef.current.src === url
    ) {
      return collectedAudioRef.current
    }

    collectedAudioRef.current?.pause()
    collectedAudioNodeRef.current?.disconnect()

    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.preload = 'auto'
    audio.src = url

    const node = context.createMediaElementSource(audio)
    node.connect(context.destination)

    collectedAudioRef.current = audio
    collectedAudioNodeRef.current = node

    return audio
  }

  async function seekCollectedAudio(
    audio: HTMLAudioElement,
    target: number
  ): Promise<void> {
    if (audio.readyState < 1) {
      await new Promise<void>((resolve, reject) => {
        let timer = 0

        const cleanup = () => {
          window.clearTimeout(timer)
          audio.removeEventListener('loadedmetadata', ready)
          audio.removeEventListener('error', failed)
        }

        const ready = () => {
          cleanup()
          resolve()
        }

        const failed = () => {
          cleanup()
          reject(
            new Error('تعذر تحميل صوت العفاسي المجمع.')
          )
        }

        timer = window.setTimeout(failed, 20000)

        audio.addEventListener('loadedmetadata', ready)
        audio.addEventListener('error', failed)

        audio.load()
      })
    }

    audio.currentTime = target

    if (audio.seeking) {
      await new Promise<void>((resolve, reject) => {
        let timer = 0

        const finish = () => {
          window.clearTimeout(timer)
          audio.removeEventListener('seeked', finish)
          audio.removeEventListener('error', failed)
          resolve()
        }

        const failed = () => {
          window.clearTimeout(timer)
          audio.removeEventListener('seeked', finish)
          audio.removeEventListener('error', failed)
          reject(
            new Error('تعذر الانتقال إلى الآية المطلوبة.')
          )
        }

        timer = window.setTimeout(failed, 12000)

        audio.addEventListener('seeked', finish)
        audio.addEventListener('error', failed)
      })
    }
  }

`,
    'Visual stream helpers'
  )

  source = replaceOne(
    source,
    `      const buffers: AudioBuffer[] = []
      const starts: number[] = []`,
    `      if (reader === 'alafasy-collected') {
        const clip = await loadCollectedVisualClip(
          surah,
          chosenVerses.map(verse => verse.number),
          controller.signal
        )

        if (id !== requestId.current) return

        const created: Prepared = {
          verses: chosenVerses,
          buffers: [],
          starts: clip.starts,
          duration: clip.duration,
          stream: {
            url: clip.url,
            startSeconds: clip.startSeconds,
          },
        }

        preparedRef.current = created
        setPrepared(created)

        setPosition(0)
        playback.current.position = 0
        setTab(3)
        return
      }

      const buffers: AudioBuffer[] = []
      const starts: number[] = []`,
    'Visual prepare collected recording'
  )

  source = replaceOne(
    source,
    `      const offset =
        player.position

      const base =`,
    `      const offset =
        player.position

      if (prep.stream) {
        const audio = collectedAudioElement(prep, context)

        await seekCollectedAudio(
          audio,
          prep.stream.startSeconds + offset
        )

        await audio.play()

        player.begin = context.currentTime - offset
        player.playing = true
        setPlaying(true)

        await loopEngine.current?.start()
        return
      }

      const base =`,
    'Visual streaming preview'
  )

  source = replaceOne(
    source,
    `          if (
            exportTime.current === null &&
            player.playing &&
            audioContext.current
          ) {
            second = Math.max(
              0,
              audioContext.current.currentTime -
                player.begin
            )
          }`,
    `          if (
            exportTime.current === null &&
            player.playing &&
            prep?.stream &&
            collectedAudioRef.current
          ) {
            second = Math.max(
              0,
              collectedAudioRef.current.currentTime -
                prep.stream.startSeconds
            )
          } else if (
            exportTime.current === null &&
            player.playing &&
            audioContext.current
          ) {
            second = Math.max(
              0,
              audioContext.current.currentTime -
                player.begin
            )
          }`,
    'Visual streaming progress'
  )

  source = replaceOne(
    source,
    `              verseProgress:
                prep &&
                prep.buffers[index]?.duration
                  ? (
                      second -
                      prep.starts[index]
                    ) /
                    prep.buffers[index].duration
                  : 0,`,
    `              verseProgress:
                prep?.stream
                  ? Math.max(
                      0,
                      Math.min(
                        1,
                        (second - prep.starts[index]) /
                        Math.max(
                          0.01,
                          (
                            prep.starts[index + 1] ??
                            prep.duration
                          ) - prep.starts[index]
                        )
                      )
                    )
                  : prep &&
                    prep.buffers[index]?.duration
                    ? (
                        second -
                        prep.starts[index]
                      ) /
                      prep.buffers[index].duration
                    : 0,`,
    'Visual verse highlighting'
  )

  source = replaceOne(
    source,
    `      destination =
        context.createMediaStreamDestination()

      recordedStream =`,
    `      destination =
        context.createMediaStreamDestination()

      if (prep.stream) {
        const audio = collectedAudioElement(
          prep,
          context
        )

        await seekCollectedAudio(
          audio,
          prep.stream.startSeconds
        )

        collectedAudioNodeRef.current?.disconnect()
        collectedAudioNodeRef.current?.connect(destination)
      }

      recordedStream =`,
    'Visual export audio routing'
  )

  source = replaceOne(
    source,
    `            mediaRecorder.start(250)

            const startedAt =
              context.currentTime +
              0.12`,
    `            mediaRecorder.start(250)

            if (prep.stream) {
              const audio = collectedAudioRef.current

              if (!audio) {
                fail('تسجيل العفاسي غير متاح.')
                return
              }

              void audio.play().catch(() => {
                fail('تعذر تشغيل العفاسي أثناء التصدير.')
              })
            }

            const startedAt =
              context.currentTime +
              (prep.stream ? 0 : 0.12)`,
    'Visual recorded audio start'
  )

  source = replaceOne(
    source,
    `                  const seconds =
                    Math.max(
                      0,
                      context.currentTime -
                        startedAt
                    )`,
    `                  const seconds =
                    prep.stream &&
                    collectedAudioRef.current
                      ? Math.max(
                          0,
                          collectedAudioRef.current.currentTime -
                            prep.stream.startSeconds
                        )
                      : Math.max(
                          0,
                          context.currentTime -
                            startedAt
                        )`,
    'Visual export timeline'
  )

  source = replaceOne(
    source,
    `                  if (
                    context.currentTime >=
                    finishAt + 0.18
                  ) {
                    stopRecording()
                  }`,
    `                  if (
                    prep.stream
                      ? seconds >= prep.duration
                      : context.currentTime >=
                        finishAt + 0.18
                  ) {
                    stopRecording()
                  }`,
    'Visual export stopping'
  )

  source = replaceOne(
    source,
    `      destination?.disconnect()

      playback.current.position = 0`,
    `      if (prep.stream) {
        collectedAudioRef.current?.pause()

        if (collectedAudioNodeRef.current) {
          try {
            collectedAudioNodeRef.current.disconnect()
            collectedAudioNodeRef.current.connect(
              context.destination
            )
          } catch {}
        }
      }

      destination?.disconnect()

      playback.current.position = 0`,
    'Visual export cleanup'
  )

  source = replaceOne(
    source,
    `      if (audioContext.current) {
        void audioContext.current
          .close()
          .catch(() => {})
      }`,
    `      collectedAudioRef.current?.pause()
      collectedAudioRef.current?.removeAttribute('src')
      collectedAudioNodeRef.current?.disconnect()

      if (audioContext.current) {
        void audioContext.current
          .close()
          .catch(() => {})
      }`,
    'Visual unmount cleanup'
  )

  return source
}

function main() {
  // Verify prerequisites BEFORE making any changes.
  for (const filename of [
    'app/api/alafasy-audio/[surah]/route.ts',
    'app/api/alafasy-timings/[surah]/route.ts',
  ]) {
    if (!fs.existsSync(path.join(ROOT, filename))) {
      throw new Error(
        'Missing prerequisite: ' + filename
      )
    }
  }

  const originals = {
    index: read(paths.index),
    config: read(paths.config),
    visual: read(paths.visual),
  }

  // Every transformation must succeed in memory first.
  const updated = {
    index: patchIndex(originals.index),
    config: patchConfig(originals.config),
    visual: patchVisual(originals.visual),
  }

  for (const [key, filename] of Object.entries(paths)) {
    if (!updated[key].includes(MARK)) {
      throw new Error(
        'Integration marker missing: ' + filename
      )
    }
  }

  // Nothing is written if any expected source anchor differs.
  for (const [key, filename] of Object.entries(paths)) {
    if (updated[key] !== originals[key]) {
      fs.writeFileSync(
        path.join(ROOT, filename),
        updated[key],
        'utf8'
      )

      console.log('UPDATED: ' + filename)
    } else {
      console.log('ALREADY UPDATED: ' + filename)
    }
  }

  console.log(
    'SAMEE3 collected Alafasy integration V2 applied.'
  )
  console.log(
    'Run npm run build before committing page changes.'
  )
}

try {
  main()
} catch (error) {
  console.error(
    'INTEGRATION STOPPED: ' +
    (error instanceof Error ? error.message : String(error))
  )
  process.exitCode = 1
}
