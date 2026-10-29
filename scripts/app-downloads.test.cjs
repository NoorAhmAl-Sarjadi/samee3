const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')
const load=require('./load-ts.cjs')
const {parseDownloadConfig,resolveDownloads,parseAppDownloads}=load('lib/app-downloads.ts')
const config=parseDownloadConfig(JSON.parse(fs.readFileSync('public/app-downloads.json','utf8')))
const asset=file=>({name:file.assetName,state:'uploaded',size:file.bytes,digest:'sha256:'+file.sha256,browser_download_url:`https://github.com/${config.repository}/releases/download/${config.releaseTag}/${file.assetName}`})
test('download buttons stay disabled until matching release assets actually exist',()=>{
 for(const value of [null,{assets:[]},{draft:true,assets:config.macos.map(asset)}])assert(resolveDownloads(config,value).macos.every(f=>!f.available&&f.url===null))
})
test('published binaries with matching size and fingerprints resolve to the intended public download URLs',()=>{
 const result=resolveDownloads(config,{draft:false,assets:config.macos.map(asset)})
 assert(result.macos.every(f=>f.available));assert.deepEqual(JSON.parse(JSON.stringify(parseAppDownloads(result))),JSON.parse(JSON.stringify(result)))
})
test('wrong, unfinished or substituted release assets cannot enable a download',()=>{
 const file=config.macos[0],base=asset(file)
 for(const patch of [{size:1},{digest:'sha256:'+'0'.repeat(64)},{state:'new'},{name:'source.zip'},{browser_download_url:'https://evil.example/app.zip'}])assert.equal(resolveDownloads(config,{assets:[{...base,...patch}]}).macos[0].available,false)
})
test('each Mac architecture can become available independently',()=>{
 const result=resolveDownloads(config,{assets:[asset(config.macos[0])]});assert.equal(result.macos[0].available,true);assert.equal(result.macos[1].available,false)
})
test('configuration rejects remote-host injection, malformed tags, duplicate IDs and unsafe filenames',()=>{
 for(const patch of [{repository:'https://evil.example/a'},{releaseTag:'../private'},{macos:[config.macos[0],config.macos[0]]},{macos:[{...config.macos[0],assetName:'../app.zip'},config.macos[1]]}])assert.throws(()=>parseDownloadConfig({...config,...patch}))
})
test('browser response parsing rejects active downloads with executable or lookalike URLs',()=>{
 const value=resolveDownloads(config,{assets:config.macos.map(asset)})
 for(const url of ['javascript:alert(1)','https://github.com.evil.example/x.zip','//github.com/a/b/app.zip'])assert.equal(parseAppDownloads({...value,macos:[{...value.macos[0],url},value.macos[1]]}),null)
})
test('legacy message timestamps remain visible and delivery pending state is separate from read status',()=>{
 const {normalizeSupportMessage,sortSupportMessages,incomingSupportMessage}=load('lib/support-messages.ts')
 const a=normalizeSupportMessage('a',{sender:'user',message:'رسالة قديمة',timestamp:1000},'owner')
 const b=normalizeSupportMessage('b',{senderId:'admin',text:'رد',sentAt:2000,read:false},'owner',true)
 assert.equal(a.senderId,'owner');assert.equal(a.createdAt.toMillis(),1000);assert.equal(a.text,'رسالة قديمة')
 assert.deepEqual(sortSupportMessages([b,a]).map(m=>m.id),['a','b']);assert.equal(incomingSupportMessage(b,'owner','user'),false)
})

test('Windows setup availability requires the exact published EXE, size and digest; Mac assets stay independent',()=>{
 const cfg=parseDownloadConfig({...config,windows:[{id:'x64',assetName:'Samee3-Windows-1.0.0-x64-Setup.exe',versionName:'1.0.0',minimumOS:'10',bytes:123456,sha256:'1'.repeat(64)}]})
 assert.equal(resolveDownloads(cfg,null).windows[0].available,false)
 const release={assets:[asset(cfg.windows[0])]};const result=resolveDownloads(cfg,release)
 assert.equal(result.windows[0].available,true);assert(result.macos.every(f=>!f.available));assert.deepEqual(parseAppDownloads(result),result)
 for(const patch of [{size:3},{digest:'sha256:'+'2'.repeat(64)},{state:'new'},{name:'source.zip'},{browser_download_url:'https://github.com/other/repo/file.exe'}])assert.equal(resolveDownloads(cfg,{assets:[{...asset(cfg.windows[0]),...patch}]}).windows[0].available,false)
})
test('Windows configuration rejects ZIPs, unsupported CPU IDs, duplicate entries and invalid sizes',()=>{
 const entry={id:'x64',assetName:'Samee3-Windows-1.0.0-x64-Setup.exe',versionName:'1.0.0',minimumOS:'10',bytes:123456,sha256:'1'.repeat(64)}
 for(const patch of [{assetName:'../setup.exe'},{assetName:'windows.zip'},{id:'ia32'},{bytes:0},{sha256:''}])assert.throws(()=>parseDownloadConfig({...config,windows:[{...entry,...patch}]}))
 assert.throws(()=>parseDownloadConfig({...config,windows:[entry,entry]}))
})
test('older Mac-only metadata remains compatible and active Windows URLs cannot be swapped',()=>{
 const old={...config};delete old.windows;assert.deepEqual(parseDownloadConfig(old).windows,[])
 const cfg=parseDownloadConfig({...config,windows:[{id:'x64',assetName:'Samee3-Windows-1.0.0-x64-Setup.exe',versionName:'1.0.0',minimumOS:'10',bytes:123456,sha256:'1'.repeat(64)}]})
 const value=resolveDownloads(cfg,{assets:[asset(cfg.windows[0])]})
 for(const url of ['javascript:alert(1)','https://github.com.evil.test/a.exe',value.windows[0].url.replace('Samee3-Windows-1.0.0-x64-Setup.exe','another.exe')])assert.equal(parseAppDownloads({...value,windows:[{...value.windows[0],url}]}),null)
 const result=resolveDownloads(parseDownloadConfig(old),null);delete result.windows;assert.deepEqual(parseAppDownloads(result).windows,[])
})
