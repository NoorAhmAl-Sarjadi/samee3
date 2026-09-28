import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const errors = []

const mustExist = [
  'app/mushaf/page.tsx',
  'app/api/quran/route.ts',
  'app/api/mushaf-svg/route.ts',
  'app/api/audio-timing/route.ts',
  'app/api/reciters/route.ts',
  'public/manifest.json',
  'public/sw.js',
  'package.json',
  'tsconfig.json',
]
for (const rel of mustExist) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`Missing required file: ${rel}`)
}

const mushaf = fs.readFileSync(path.join(root, 'app/mushaf/page.tsx'), 'utf8')
const surahBlock = mushaf.match(/const SURAH_LIST = \[(.*?)\n\]\n\nfunction isRiwaya/s)
if (!surahBlock) errors.push('SURAH_LIST block not found')
else {
  const ids = [...surahBlock[1].matchAll(/"id":\s*(\d+)/g)].map((m) => Number(m[1]))
  const unique = [...new Set(ids)]
  if (unique.length !== 114 || unique.some((n) => n < 1 || n > 114)) {
    errors.push(`SURAH_LIST must contain exactly 114 unique IDs; found ${unique.length}`)
  }
}

for (const rel of ['app/mushaf/page.tsx','app/api/quran/route.ts','app/api/mushaf-svg/route.ts','public/sw.js']) {
  const content = fs.readFileSync(path.join(root, rel), 'utf8')
  if (/^(<<<<<<< |======= |>>>>>>>)/m.test(content)) errors.push(`Merge conflict markers found in ${rel}`)
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
for (const key of ['dev','build','start','typecheck']) {
  if (!pkg.scripts?.[key]) errors.push(`Missing package script: ${key}`)
}

if (errors.length) {
  console.error('SAMEE3 validation failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('SAMEE3 validation passed.')
