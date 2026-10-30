const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..'),
  cache = new Map()
function load(relative) {
  const filename = path.resolve(root, relative)
  if (cache.has(filename)) return cache.get(filename)
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const exports = {}
  cache.set(filename, exports)
  vm.runInNewContext(
    output,
    {
      exports,
      URL,
      console,
      require: (name) => load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))),
    },
    { filename },
  )
  return exports
}
const library = load('lib/islamic/managed-library.ts')
const { LEARNING_COURSES } = load('lib/islamic/curriculum.ts')
const original = LEARNING_COURSES.find((book) => book.videoUrl)

test('every original and curriculum book is editable, with curriculum resource precedence', () => {
  const books = library.mergeLibraryCatalog([])
  assert.equal(new Set(books.map((book) => book.id)).size, books.length)
  assert.ok(books.length >= LEARNING_COURSES.length)
  assert.equal(books.find((book) => book.id === original.id).videoUrl, original.videoUrl)
})
test('live fields replace original fields, including intentionally cleared links and text', () => {
  const book = library.mergeLibraryBook(original.id, {
    title: 'عنوان معدّل',
    author: 'مؤلف جديد',
    description: '',
    videoUrl: 'https://youtu.be/abcdefghijk',
    videoAuthor: 'شارح جديد',
    readingUrl: '',
    sharhUrl: '',
    downloadUrl: '',
    sharhTitle: '',
    deleted: true,
    level: 'متقدم',
    category: 'fiqh',
  })
  assert.equal(book.title, 'عنوان معدّل')
  assert.equal(book.description, '')
  assert.equal(book.readingUrl, '')
  assert.equal(book.sharhUrl, '')
  assert.equal(book.downloadUrl, '')
  assert.equal(book.videoUrl, 'https://youtu.be/abcdefghijk')
  assert.equal(book.videoAuthor, 'شارح جديد')
  assert.equal(book.sharhTitle, '')
  assert.equal(book.deleted, true)
  assert.equal(book.levelId, 'advanced')
  assert.equal(book.category, 'fiqh')
  assert.equal(
    library.studySources(book).some((source) => source.url === original.videoUrl),
    false,
  )
})
test('custom books resolve through the same model and unsafe links cannot become player sources', () => {
  const book = library.mergeLibraryBook('custom-book', {
    title: 'كتاب مضاف',
    author: 'مؤلف',
    description: 'وصف',
    readingUrl: 'javascript:alert(1)',
    videoUrl: 'https://evil.example/embed',
  })
  assert.equal(book.custom, true)
  assert.equal(book.readingUrl, '')
  assert.equal(library.studySources(book)[0].external, true)
  assert.equal(library.mergeLibraryBook('../invalid', { title: 'bad' }), null)
  assert.equal(library.mergeLibraryBook('unknown'), null)
})
test('clearing or replacing PDF editions never revives an original PDF', () => {
  const cleared = library.mergeLibraryBook(original.id, { downloadUrl: '' })
  assert.equal(cleared.pdfParts.length, 0)
  const replaced = library.mergeLibraryBook(original.id, { downloadUrl: 'https://example.org/new.pdf' })
  assert.equal(replaced.pdfParts[0].url, 'https://example.org/new.pdf')
  const parts = library.mergeLibraryBook(original.id, {
    pdfParts: [
      { label: 'الأول', url: 'https://example.org/1.pdf' },
      { label: 'unsafe', url: 'data:bad' },
    ],
  })
  assert.equal(parts.pdfParts.length, 1)
})
test('lesson edits and hide tombstones override original lessons by identity', () => {
  const lessons = library.mergeLessons(
    [
      { id: 'old-lesson', title: 'الأصلي', url: 'https://youtu.be/abcdefghijk', order: 1 },
      { id: 'keep', title: 'ثان', url: 'https://youtu.be/12345678901', order: 2 },
    ],
    [
      {
        id: 'old-lesson',
        data: { title: 'عنوان معدّل', url: 'https://youtu.be/98765432101', order: 3, allowSeeking: false },
      },
      { id: 'keep', data: { deleted: true } },
    ],
  )
  assert.equal(lessons.length, 2)
  assert.equal(lessons.find((lesson) => lesson.id === 'old-lesson').url, 'https://youtu.be/98765432101')
  assert.equal(lessons.find((lesson) => lesson.id === 'keep').deleted, true)
  const book = library.mergeLibraryBook(original.id, { videoUrl: '', videos: lessons })
  const sources = library.studySources(book)
  assert.equal(sources.length, 1)
  assert.equal(sources[0].lessons.length, 1)
})
test('book/library bulk revision overrides every previous individual exception', () => {
  const book = library.mergeLibraryBook(original.id, {
    lessonSeekDefault: false,
    lessonSpeedDefault: false,
    lessonPolicyRevision: 'bulk-2',
  })
  assert.equal(library.effectivePolicy(book, { allowSeeking: true, allowSpeed: true }).allowSeeking, false)
  assert.equal(
    library.effectivePolicy(book, { allowSeeking: true, allowSpeed: true, policyRevision: 'bulk-1' })
      .allowSpeed,
    false,
  )
  const override = library.effectivePolicy(book, {
    allowSeeking: true,
    allowSpeed: null,
    policyRevision: 'bulk-2',
  })
  assert.equal(override.allowSeeking, true)
  assert.equal(override.allowSpeed, false)
})
test('playlist overrides belong to the exact list and survive bulk permission resets', () => {
  const list = 'PL123456789012345',
    second = 'PL987654321098765'
  const book = library.mergeLibraryBook(original.id, {
    videoUrl: `https://youtube.com/playlist?list=${list}`,
    lessonSeekDefault: false,
    lessonSpeedDefault: false,
    lessonPolicyRevision: 'bulk-new',
    playlistPolicies: {
      [`${list}:1`]: {
        title: 'عنوان جديد',
        url: 'https://youtu.be/abcdefghijk',
        allowSeeking: true,
        policyRevision: 'old',
      },
      [`${list}:2`]: { deleted: true },
      [`${second}:1`]: { title: 'قائمة أخرى' },
    },
  })
  const lessons = library.playlistLessons(book, list, ['12345678901', '98765432101'])
  assert.equal(lessons.length, 1)
  assert.equal(lessons[0].title, 'عنوان جديد')
  assert.equal(lessons[0].url, 'https://youtu.be/abcdefghijk')
  assert.equal(library.effectivePolicy(book, lessons[0]).allowSeeking, false)
  assert.equal(library.playlistOverride(book, second, 1).title, 'قائمة أخرى')
})
test('legacy numbered policies apply to the main list only and current exceptions can inherit', () => {
  const list = 'PL123456789012345'
  const book = library.mergeLibraryBook(original.id, {
    videoUrl: `https://youtube.com/playlist?list=${list}`,
    lessonSeekDefault: false,
    playlistPolicies: { 1: { allowSeeking: true } },
  })
  assert.equal(library.effectivePolicy(book, library.playlistOverride(book, list, 1)).allowSeeking, true)
  assert.equal(library.playlistOverride(book, 'PL987654321098765', 1), undefined)
  assert.equal(library.effectivePolicy(book, { allowSeeking: null }).allowSeeking, false)
})
test('permission-only playlist edits retain the original video and generated title', () => {
  const list = 'PL123456789012345'
  const book = library.mergeLibraryBook(original.id, {
    videoUrl: `https://youtube.com/playlist?list=${list}`,
    playlistPolicies: { [`${list}:1`]: { title: '', url: '', allowSeeking: false } },
  })
  const lesson = library.playlistLessons(book, list, ['abcdefghijk'])[0]
  assert.equal(lesson.title, 'الدرس 1')
  assert.equal(lesson.url, 'https://www.youtube.com/watch?v=abcdefghijk')
  assert.equal(library.effectivePolicy(book, lesson).allowSeeking, false)
})
test('direct video URLs become sources while non-video external pages stay ordinary links', () => {
  assert.equal(library.validVideo('https://example.org/video.mp4?token=abc'), true)
  assert.equal(library.validVideo('https://example.org/read'), false)
  assert.equal(library.validVideo('http://example.org/video.mp4'), false)
  const book = library.mergeLibraryBook('direct', { title: 'شرح', videoUrl: 'https://example.org/video.mp4' })
  assert.equal(library.studySources(book)[0].key, 'file-primary-video')
})
