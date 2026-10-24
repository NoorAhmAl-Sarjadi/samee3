const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
let ts
try { ts = require('typescript') }
catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript') }
function loadTs(rel, globals={}) {
  const src = fs.readFileSync(path.join(__dirname,'..',rel), 'utf8')
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const exports = {}
  vm.runInNewContext(out, { exports, URL, Response, console, ...globals }, { filename: rel })
  return exports
}
const safe = loadTs('lib/islamic/safeLinks.ts').safeIslamicLibraryLink
assert.equal(safe('javascript:alert(1)'),null)
assert.equal(safe('data:text/html,<script>'),null)
assert.equal(safe('http://example.com'),null)
assert.equal(safe('https://name:pass@example.com/path'),null)
assert.equal(safe('https://example.org/read'),'https://example.org/read')
const catalog=loadTs('lib/islamic/sunniLibrary.ts')
const categories=new Set(catalog.SUNNI_LIBRARY_CATEGORIES.map(x=>x.id))
const books=catalog.SUNNI_LIBRARY_BOOKS
assert.equal(categories.size,catalog.SUNNI_LIBRARY_CATEGORIES.length)
assert.equal(new Set(books.map(x=>x.id)).size,books.length)
assert.ok(books.length>=25)
for(const book of books){
  assert.ok(categories.has(book.category), `unknown category ${book.id}`)
  assert.ok(book.title && book.author && book.description,`incomplete book: ${book.id}`)
  for(const key of ['readingUrl','sharhUrl','downloadUrl'])if(book[key]){
    assert.ok(safe(book[key]),`unsafe URL ${book.id}: ${key}`)
  }
}
class FakeRequest { constructor(input){ this.url=new URL(input,'https://samee3.test').href } }
const storage=new Map()
const fakeCache={
  match:async request=>storage.get(request.url)?.clone()||null,
  put:async(request,response)=>{storage.set(request.url,response.clone())},
  delete:async request=>storage.delete(request.url)
}
const fakeCaches={open:async()=>fakeCache}
const offline=loadTs('lib/islamic/libraryOffline.ts',{ window:{caches:fakeCaches}, caches:fakeCaches,Request:FakeRequest })
const makeContent=id=>({success:true,source:'quranpedia',book:{id},contents:[{text:'نص تجريبي للاختبار فقط',page:1}]})
;(async()=>{
  assert.equal(await offline.cacheLibraryBook('a',{}),false)
  assert.equal(await offline.cacheLibraryBook('a',{success:true,contents:[]}),false)
  assert.equal(await offline.cacheLibraryBook('a',makeContent('a')),true)
  const stored=await offline.readCachedLibraryBook('a')
  assert.equal(stored?.book.id,'a')
  assert.equal(await offline.readCachedLibraryBook('b'),null)
  assert.equal(await offline.removeCachedLibraryBook('a'),true)
  assert.equal(await offline.readCachedLibraryBook('a'),null)
  console.log(`PASS: ${books.length} library books, ${categories.size} categories, safe URL and offline cache tests`)
})().catch(e=>{console.error(e);process.exitCode=1})
