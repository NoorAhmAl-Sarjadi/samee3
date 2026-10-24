const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const zlib = require('node:zlib')
const load = require('./load-ts.cjs')
const { seekAudioBeforePlay, activeAyahAt } = load('lib/quran/playback.ts')
class FakeAudio extends EventTarget {
 constructor(){super();this.readyState=0;this.duration=1000;this.seeking=false;this.position=0}
 get currentTime(){return this.position}
 set currentTime(value){if(this.readyState<1)throw new Error('No metadata');this.position=value;this.seeking=value>0;setTimeout(()=>{this.seeking=false;this.dispatchEvent(new Event('seeked'))},3)}
}
test('slow metadata never resets a requested ayah to the beginning',async()=>{
 const audio=new FakeAudio();const waiting=seekAudioBeforePlay(audio,137.5,()=>true,2500)
 setTimeout(()=>{audio.readyState=1;audio.dispatchEvent(new Event('loadedmetadata'))},1100)
 await waiting;assert.equal(audio.currentTime,137.5)
})
test('seek rejects unavailable timing and cancelled operations',async()=>{
 const audio=new FakeAudio();await assert.rejects(seekAudioBeforePlay(audio,20,()=>true,15))
 audio.readyState=1;await assert.rejects(seekAudioBeforePlay(audio,20,()=>false,50),{name:'AbortError'})
 await assert.rejects(seekAudioBeforePlay(audio,1500,()=>true,50))
})
test('all 1208 local page entries are readable and every glyph resolves',()=>{
 const index=require('../data/mushaf/index.json')
 for(const riwaya of ['sousi','bazzi']){
  const pack=fs.readFileSync(`data/mushaf/${riwaya}.pack`)
  const glyphs=JSON.parse(zlib.gunzipSync(fs.readFileSync(`data/mushaf/${riwaya}.glyphs.gz`)))
  assert.equal(index[riwaya].length,604)
  for(const [i,entry]of index[riwaya].entries()){
   const svg=zlib.gunzipSync(pack.subarray(entry.offset,entry.offset+entry.length)).toString()
   assert.ok(svg.startsWith('<svg'),`${riwaya}:${i+1}`);assert.ok(svg.trim().endsWith('</svg>'))
   assert.ok(entry.width>100&&entry.height>100)
   for(const id of svg.match(/g[0-9a-f]{20}/g)||[])assert.ok(glyphs[id],`Missing ${riwaya}:${id}`)
   assert.ok(!/<script\b|onload=/i.test(svg))
  }
  const text=JSON.parse(zlib.gunzipSync(fs.readFileSync(`data/mushaf/${riwaya}.text.json.gz`)))
  assert.equal(text.surahs.length,114)
  const pages=new Set(text.surahs.flatMap(s=>s.ayahs.map(a=>a.page_number)))
  for(let page=1;page<=604;page++)assert.ok(pages.has(page),`Missing ${riwaya} page ${page}`)
 }
})
test('each learning level contains all eight unique categories',()=>{
 const { LEARNING_LEVELS,LEARNING_COURSES,coursesInLevel,youtubeEmbed }=load('lib/islamic/curriculum.ts')
 assert.equal(LEARNING_COURSES.length,24)
 assert.equal(new Set(LEARNING_COURSES.map(x=>x.id)).size,24)
 for(const level of LEARNING_LEVELS){const books=coursesInLevel(level.id);assert.equal(books.length,8);assert.equal(new Set(books.map(x=>x.category)).size,8)}
 assert.equal(youtubeEmbed('https://evil.test/watch?v=abcdefghijk'),null)
 assert.equal(youtubeEmbed('javascript:alert(1)'),null)
 assert.ok(youtubeEmbed('https://www.youtube.com/playlist?list=PL12345678901234').includes('/videoseries?list='))
})
test('long card text is paginated without dropping words',async()=>{
 const ctx={font:'',measureText:(text)=>({width:[...text].length*22})}
 const document={fonts:{load:async()=>[],ready:Promise.resolve()},createElement:()=>({getContext:()=>ctx})}
 const {prepareCardPages,DEFAULT_CARD_OPTIONS}=load('lib/share-card.ts',{document})
 const text=Array.from({length:900},(_,i)=>`كلمة${i}`).join(' ')
 const pages=await prepareCardPages({kind:'hadith',title:'عنوان موثق',text,reference:'مرجع الحديث'},{...DEFAULT_CARD_OPTIONS,format:'square',fontSize:42})
 assert.ok(pages.length>1)
 assert.equal(pages.flatMap(p=>p.lines.map(l=>l.text)).join(' '),text)
 assert.ok(pages.every(p=>p.height===1080))
})
test('bundled adhkar are the complete source snapshot with unchanged text',()=>{
 const {createHash}=require('node:crypto')
 const raw=fs.readFileSync('public/data/adhkar.json')
 const provenance=require('../public/data/adhkar-source.json')
 assert.equal(createHash('sha256').update(raw).digest('hex'),provenance.sha256)
 const corpus=JSON.parse(raw),{parseAdhkarCategories}=load('lib/adhkar-catalog.ts')
 const parsed=parseAdhkarCategories(corpus)
 assert.equal(parsed.length,132);assert.equal(parsed.flatMap(x=>x.array).length,267)
 for(let i=0;i<corpus.length;i++) for(let j=0;j<corpus[i].array.length;j++) assert.equal(parsed[i].array[j].text,corpus[i].array[j].text.trim())
})

test('seeking to an exact timing boundary highlights the new ayah immediately',()=>{
 const timings=[{ayah:1,start_time:0,end_time:137500},{ayah:5,start_time:137500,end_time:220000},{ayah:6,start_time:220000,end_time:300000}]
 assert.equal(activeAyahAt(timings,137.49),1)
 assert.equal(activeAyahAt(timings,137.5),5)
 assert.equal(activeAyahAt(timings,220),6)
 assert.equal(activeAyahAt([],0),null)
 assert.equal(activeAyahAt(timings,NaN),null)
})
test('tafsir follows published references when a riwaya merges Hafs ayahs',()=>{
 const {tafsirReferences}=load('lib/quran/tafsir-reference.ts')
 for(const riwaya of ['sousi','bazzi']){
  const mushaf=JSON.parse(zlib.gunzipSync(fs.readFileSync(`data/mushaf/${riwaya}.text.json.gz`)))
  const opening=mushaf.surahs[1].ayahs[0],sixth=mushaf.surahs[1].ayahs.find(a=>a.number===5)
  assert.deepEqual(tafsirReferences({numberInSurah:opening.number,hafsNumbers:opening.number_in_hafs}),[1,2])
  assert.deepEqual(tafsirReferences({numberInSurah:sixth.number,hafsNumbers:sixth.number_in_hafs}),[6])
 }
 assert.deepEqual(tafsirReferences({numberInSurah:255}),[255])
})

test('Quran page API retains the full published tafsir mapping',async()=>{
 const {NextRequest}=require('next/server'),{GET}=load('app/api/quran/route.ts')
 for(const riwaya of ['sousi','bazzi']){
  const opening=await (await GET(new NextRequest(`http://localhost/api/quran?riwaya=${riwaya}&page=2`))).json()
  const first=opening.ayahs.find(a=>a.surah.number===2&&a.numberInSurah===1)
  assert.deepEqual(first.hafsNumbers,[1,2])
  const page=await (await GET(new NextRequest(`http://localhost/api/quran?riwaya=${riwaya}&page=3`))).json()
  assert.deepEqual(page.ayahs[0].hafsNumbers,[6])
 }
})
