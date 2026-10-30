#!/usr/bin/env node
'use strict'
/**
 * Safe, idempotent source integration for SAMEE3's existing large pages.
 * This script does not replace or truncate either original page.
 * Run on the SAMEE3 main branch after uploading lib/quran/alafasy-collected.ts.
 */
const fs = require('node:fs')
const path = require('node:path')
const root = process.cwd()
const files = ['app/audio/page.tsx', 'app/mushaf/page.tsx']
const MARKER = "from '@/lib/quran/alafasy-collected'"

function requireContains(source, search, file) {
  if (!source.includes(search)) throw new Error(`${file}: expected anchor not found: ${search.slice(0, 100)}`)
}
function replaceOnce(source, search, replacement, file) {
  requireContains(source, search, file)
  if (source.split(search).length !== 2) throw new Error(`${file}: anchor is not unique: ${search.slice(0, 100)}`)
  return source.replace(search, replacement)
}
function patchAudio(source) {
  const file = files[0]
  if (source.includes(MARKER)) {
    console.log(`${file}: already integrated; no changes`)
    return source
  }
  source = replaceOnce(source, "'use client'\n", "'use client'\nimport { collectedAlafasyLibraryReciter } from '@/lib/quran/alafasy-collected'\n", file)
  source = replaceOnce(source,
    '        nextReciters.sort((a, b) => {',
    `        // SAMEE3 COLLECTED ALAFASY: only expose this Hafs recording as a separate reciter.\n` +
    `        if (normalizeArabic(activeRiwaya.name).includes(normalizeArabic('حفص'))) {\n` +
    `          nextReciters.unshift(collectedAlafasyLibraryReciter(activeRiwaya.id))\n` +
    `        }\n` +
    '        nextReciters.sort((a, b) => {', file)
  // The popular-reciter sort has no entry for this dedicated recording; keep it first.
  source = replaceOnce(source,
    '        nextReciters.sort((a, b) => {\n          const aIndex',
    `        nextReciters.sort((a, b) => {\n` +
    `          if (a.id === 9000123) return -1\n` +
    `          if (b.id === 9000123) return 1\n` +
    `          const aIndex`, file)
  return source
}
function patchMushaf(source) {
  const file = files[1]
  if (source.includes(MARKER)) {
    console.log(`${file}: already integrated; no changes`)
    return source
  }
  const imports = `import {\n  ALAFASY_COLLECTED_RECITER_ID,\n  ALAFASY_COLLECTED_MOSHAF_ID,\n  collectedAlafasyMushafReciter,\n  loadCollectedAlafasyTimings,\n} from '@/lib/quran/alafasy-collected'\n`
  source = replaceOnce(source,
    "'use client'\n", "'use client'\n" + imports, file)

  source = replaceOnce(source,
    '    const savedReciters = readSavedReciterSources(riwayaId)',
    `    const savedReciters = riwayaId === 'hafs'\n` +
    `      ? [collectedAlafasyMushafReciter(), ...readSavedReciterSources(riwayaId).filter((item) => item.apiId !== ALAFASY_COLLECTED_RECITER_ID)]\n` +
    `      : readSavedReciterSources(riwayaId)`, file)

  const afterUnique = `      if (requestId !== recitersRequestRef.current) {\n        return unique\n      }`
  source = replaceOnce(source, afterUnique,
    `      // Keep the dedicated collected Mushaf distinct from the MP3Quran Alafasy reciter.\n` +
    `      if (riwayaId === 'hafs') unique.unshift(collectedAlafasyMushafReciter())\n` + afterUnique, file)

  source = replaceOnce(source,
    '      unique.sort((a,b) => Number(timed.has(b.moshafId || 0)) - Number(timed.has(a.moshafId || 0)))',
    `      unique.sort((a,b) =>\n` +
    `        Number(b.apiId === ALAFASY_COLLECTED_RECITER_ID) - Number(a.apiId === ALAFASY_COLLECTED_RECITER_ID) ||\n` +
    `        Number(timed.has(b.moshafId || 0)) - Number(timed.has(a.moshafId || 0)))`, file)

  source = replaceOnce(source,
    `    const cachedTimings = readCachedAyahTimings(surahNumber, readId)\n    if (cachedTimings.length) return cachedTimings`,
    `    const cachedTimings = readCachedAyahTimings(surahNumber, readId)\n` +
    `    if (readId === ALAFASY_COLLECTED_MOSHAF_ID) {\n` +
    `      if (cachedTimings.length || isBrowserOffline()) return cachedTimings\n` +
    `      try {\n` +
    `        const collected = await loadCollectedAlafasyTimings(surahNumber)\n` +
    `        if (collected.length) writeCachedAyahTimings(surahNumber, readId, collected)\n` +
    `        return collected\n` +
    `      } catch (error) {\n` +
    `        console.warn('SAMEE3 collected Alafasy timings unavailable', error)\n` +
    `        return [] as AyahTiming[] // Never use the other Alafasy recording's timings.\n` +
    `      }\n` +
    `    }\n` +
    `    if (cachedTimings.length) return cachedTimings`, file)

  source = replaceOnce(source,
    `      if (!activeReciter && !isBrowserOffline()) {\n        const payload = await fetchMushafJson(`,
    `      if (!activeReciter && targetRiwaya === 'hafs' && expectedReciter === ALAFASY_COLLECTED_RECITER_ID) {\n` +
    `        activeReciter = collectedAlafasyMushafReciter()\n` +
    `      }\n` +
    `      if (!activeReciter && !isBrowserOffline()) {\n        const payload = await fetchMushafJson(`, file)
  return source
}

const originals = files.map(file => {
  const absolutePath = path.join(root, file)
  if (!fs.existsSync(absolutePath)) throw new Error(`Missing ${file}; run from SAMEE3 repository root`)
  return fs.readFileSync(absolutePath, 'utf8')
})
if (!fs.existsSync(path.join(root, 'lib/quran/alafasy-collected.ts'))) {
  throw new Error('Missing lib/quran/alafasy-collected.ts; upload the package first')
}
// Validate both patches fully before touching either file (all-or-nothing preparation).
const patched = [patchAudio(originals[0]), patchMushaf(originals[1])]
patched.forEach((content, index) => {
  if (content !== originals[index]) {
    const file = path.join(root, files[index])
    fs.writeFileSync(file, content, 'utf8')
    console.log(`Updated ${files[index]} (${content.length} chars)`)
  }
})
console.log('SAMEE3 Alafasy collected integration completed.')
