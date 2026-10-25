// Samee3 adapter for GT-SQR (SalehGNUTUX), AGPL-3.0.
// The original renderer and WebCodecs engine remain available via /api/gt-sqr/.
export const ENGINE_CSS = `
html,body{margin:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#102b24!important}
body>*{display:none!important}body>#preview{display:flex!important;position:fixed!important;inset:0!important;padding:0!important;align-items:center!important;justify-content:center!important;background:transparent!important;border:0!important}
#preview>.pbar-wrap,#fmt-lbl{display:none!important}#cw{max-height:none!important;max-width:none!important;box-shadow:none!important;border-radius:0!important;display:flex!important;width:100%!important;height:100%!important;padding:0!important;align-items:center!important;justify-content:center!important;overflow:hidden!important}
#cv{display:block!important;max-width:100%!important;max-height:100%!important;width:auto!important;height:auto!important;object-fit:contain!important;box-shadow:none!important;border-radius:0!important}
`

export const ENGINE_JS = String.raw`
(function(){
'use strict';
if(new URLSearchParams(location.search).get('engine')!=='1')return;
var booted=false, busy=false, prepared=null, active=null, sources=[], tick=0, backgroundUrl='', timeline=null, mediaSeq=0, preparing=0, backgroundCache=new Map();
var opts={color:'#fff9e9',accent:'#d3b77c',translationColor:'#eee8db',size:110,darkness:40,font:'amiri',signature:'مصحف سميع',frame:true,gc1:'#174d40',gc2:'#09231e',ratio:'9:16',quality:720};
function send(event,data,id){window.parent.postMessage({channel:'samee3-visual-v2',event:event,data:data||{},id:id},location.origin)}
function number(v,lo,hi,fallback){v=Number(v);return Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):fallback}
function set(id,value){var el=$(id);if(!el)return;if(el.tagName==='SELECT'&&!Array.from(el.options).some(function(o){return o.value===String(value)}))el.add(new Option(String(value),String(value)));if(el.type==='checkbox')el.checked=Boolean(value);else el.value=String(value)}
function radio(name,value){document.querySelectorAll('input[name="'+name+'"]').forEach(function(el){el.checked=el.value===value})}
function stop(){timeline=null;sources.forEach(function(node){try{node.onended=null;node.stop();node.disconnect()}catch(_){}});sources=[];pausePlayer();clearInterval(tick);tick=0;if(S.bgVid)S.bgVid.pause()}
function elapsed(){return prepared?prepared.starts[S.currentAya]+S.elapsed:0}
function at(t){var i=prepared.starts.length-1;while(i>0&&t<prepared.starts[i])i--;S.currentAya=i;S.elapsed=Math.max(0,t-prepared.starts[i]);S.bgMotionT=t}
function frame(t){at(Math.max(0,Math.min(t,prepared.duration-.001)));drawFrame(t)}
function view(){if(!prepared)return;send('playback',{playing:S.playing,time:Math.min(prepared.duration,elapsed()),duration:prepared.duration})}
function style(value){
 if(busy)return;Object.assign(opts,value||{});opts.size=number(opts.size,65,145,110);opts.darkness=number(opts.darkness,0,80,40);
 ['color','accent','translationColor','gc1','gc2'].forEach(function(k){if(!/^#[0-9a-f]{6}$/i.test(opts[k]))opts[k]='#ffffff'});
 set('txt-col',opts.color);set('orn-col',opts.accent);set('sname-col',opts.accent);set('gold-col',opts.accent);set('trans-col',opts.translationColor);set('gc1',opts.gc1);set('gc2',opts.gc2);set('dim',opts.darkness);set('fsize',opts.size);set('lh',1.8);set('sname-on',true);set('sname-y',5);set('sname-size',80);set('wave-on',false);set('wm-on',false);set('vtitle-on',false);set('fx-gold',opts.frame);set('fx-vig',false);set('basmala-on',false);set('aya-gap',0);set('rec-vol',100);set('export-fps',25);set('export-vbr',opts.quality===1080?5:3);set('trans-dur',.25);set('tfs',55);
 radio('orn','none');radio('te','shadow');radio('tanim','none');radio('tpos','center');radio('fmt',['9:16','1:1','16:9'].includes(opts.ratio)?opts.ratio:'9:16');radio('bgm','static');radio('font',(S.allFonts.find(function(f){return f.id===opts.font})||S.allFonts[0]).css);
 set('export-res',opts.ratio==='1:1'?opts.quality:Math.round(opts.quality*16/9));applyCanvasSize();if(!S.playing&&!busy){S.elapsed=Math.max(.3,S.elapsed);drawFrame(1)}
}
function catalog(){return {chapters:S.surahs.map(function(s){return {id:s.number,name:s.name,count:s.numberOfAyahs}}),reciters:S.reciters.filter(function(r){return !r.folder.startsWith('warsh/')}).map(function(r){return {id:r.id,name:r.name}}),fonts:S.allFonts.filter(function(f){return ['Amiri Quran','Uthmanic Hafs','Scheherazade New (Quranic SIL)'].includes(f.name)}).map(function(f){return {id:f.id,name:f.name}})}}
async function waitFor(test,ms){var start=Date.now();while(!test()){if(Date.now()-start>ms)throw Error('استغرق تحميل المحرر وقتًا طويلًا. أعد المحاولة.');await new Promise(function(r){setTimeout(r,80)})}}
async function prepare(data,id){
 var gen=++preparing;stop();prepared=null;send('invalidated');
 var chapter=S.surahs.find(function(s){return s.number===Number(data.surah)}),reader=S.reciters.find(function(r){return r.id===data.reciter&&!r.folder.startsWith('warsh/')});
 if(!chapter||!reader||!Number.isInteger(data.from)||!Number.isInteger(data.to)||data.from<1||data.to<data.from||data.to>chapter.numberOfAyahs||data.to-data.from>=10)throw Error('اختر نطاقًا صحيحًا حتى ١٠ آيات.');
 if(!['none','en.sahih','fr.hamidullah'].includes(data.translation))throw Error('الترجمة غير مدعومة.');
 set('surah-sel',data.surah);set('from-aya',data.from);set('to-aya',data.to);set('trans-sel',data.translation);set('basmala-on',false);radio('reciter',data.reciter);
 await loadVerses();if(gen!==preparing)return;
 if(S.verses.length!==data.to-data.from+1||S.verses.some(function(v,i){return v.numberInSurah!==data.from+i}))throw Error('تعذر جلب الآيات المختارة. تحقق من الاتصال.');
 if(data.translation!=='none'&&(!S.translations.length||S.translations.some(function(t){return !t})))throw Error('تعذر تحميل الترجمة. جرّب بدون ترجمة.');
 var context=await resumeAudioCtx(),buffers=[],starts=[],duration=0;
 for(var i=0;i<S.verses.length;i++){
  send('preparing',{current:i+1,total:S.verses.length},id);
  var response=await fetch(ayaAudioUrl(reader.folder,data.surah,S.verses[i]),{signal:AbortSignal.timeout(25000),cache:'force-cache'});
  if(!response.ok)throw Error('تعذر تحميل تلاوة '+reader.name+'. جرّب قارئًا آخر.');
  var bytes=await response.arrayBuffer();if(bytes.byteLength>12*1024*1024)throw Error('ملف التلاوة كبير جدًا.');
  var buffer=await context.decodeAudioData(bytes);if(gen!==preparing)return;starts.push(duration);duration+=buffer.duration;buffers.push(buffer);
  if(duration>90)throw Error('اختر آيات مدتها أقل من ٩٠ ثانية لتصديرها على الهاتف.');
 }
 prepared={buffers:buffers,starts:starts,duration:duration,reader:reader.name,surah:data.surah,from:data.from,to:data.to};S.ayaDurations=buffers.map(function(b){return b.duration});S.currentAya=0;S.elapsed=0;drawFrame(1);
 send('prepared',{duration:duration,count:buffers.length,chapter:chapter.name,reciter:reader.name},id);view();
}
async function play(){
 if(!prepared||busy)return;if(S.playing){stop();view();return}
 var context=await resumeAudioCtx(),offset=Math.max(0,Math.min(elapsed(),prepared.duration));if(offset>=prepared.duration-.03)offset=0;var start=context.currentTime+.06;
 prepared.buffers.forEach(function(b,i){if(prepared.starts[i]+b.duration<=offset)return;var node=context.createBufferSource();node.buffer=b;node.connect(context.destination);node.start(start+Math.max(0,prepared.starts[i]-offset),Math.max(0,offset-prepared.starts[i]));sources.push(node)});
 timeline={context:context,start:start,offset:offset};S.playing=true;if(S.bgVid)await S.bgVid.play().catch(function(){});tick=setInterval(function(){var t=Math.max(0,offset+context.currentTime-start);at(Math.min(t,prepared.duration-.001));if(t>=prepared.duration){stop();at(0);S.elapsed=.5;drawFrame(1)}view()},120);view();
}
function disposeBackground(){if(S.bgVid){S.bgVid.pause();S.bgVid.removeAttribute('src');S.bgVid.load()}S.bgVid=null;S.bgVidNext=null;S.bgVidItems=[];S.bgImg=null;if(backgroundUrl)URL.revokeObjectURL(backgroundUrl);backgroundUrl=''}
async function background(data,id){
 var seq=++mediaSeq;stop();disposeBackground();radio('bgt','gradient');if(!data.file&&!data.asset){send('background',{},id);return}
 var blob=data.file||backgroundCache.get(data.asset);
 if(!blob){var response=await fetch('/api/gt-sqr/backgrounds/'+encodeURIComponent(data.asset),{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('تعذر تحميل الخلفية. اختر أخرى أو ارفع ملفًا من جهازك.');blob=await response.blob()}
 if(!(blob instanceof Blob)||blob.size>30*1024*1024||!/^image\/(jpeg|png|webp|avif)$|^video\/(mp4|webm|quicktime)$/.test(blob.type))throw Error('اختر صورة أو فيديو صالحًا أصغر من ٣٠ ميجابايت.');
 if(!data.file&&data.asset)backgroundCache.set(data.asset,blob);
 var url=URL.createObjectURL(blob),isVideo=blob.type.startsWith('video/'),element=isVideo?document.createElement('video'):new Image();
 if(isVideo){element.muted=true;element.loop=true;element.playsInline=true;element.preload='auto'}
 try{await new Promise(function(resolve,reject){var timer=setTimeout(function(){reject(Error('تعذر فتح الخلفية. جرّب ملفًا آخر.'))},20000);element[isVideo?'onloadeddata':'onload']=function(){clearTimeout(timer);resolve()};element.onerror=function(){clearTimeout(timer);reject(Error('صيغة الخلفية غير مدعومة في متصفحك.'))};element.src=url;if(isVideo)element.load()});if(seq!==mediaSeq){URL.revokeObjectURL(url);return}backgroundUrl=url;if(isVideo){S.bgVid=element;S.bgVidItems=[{vid:element,file:blob,url:url,dur:element.duration,name:'Samee3',hidden:false,trimStart:0,trimEnd:element.duration}];radio('bgt','video')}else{S.bgImg=element;radio('bgt','image')}drawFrame(1);send('background',{},id)}catch(error){URL.revokeObjectURL(url);throw error}
}
async function fallback(context,job){
 var recording;var canvas=$('cv'),types=['video/mp4;codecs="avc1.42E01F,mp4a.40.2"','video/mp4;codecs="avc1,mp4a.40.2"','video/webm;codecs="vp8,opus"','video/webm;codecs="vp9,opus"'];
 var mime=types.find(function(t){return typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(t)});if(!mime||!canvas.captureStream)throw Error('التصدير غير مدعوم في هذا المتصفح. استخدم إصدارًا حديثًا.');
 var dest=context.createMediaStreamDestination(),capture=canvas.captureStream(25),stream=new MediaStream(capture.getVideoTracks().concat(dest.stream.getAudioTracks())),nodes=[],timer,watch;
 try{return await new Promise(function(resolve,reject){
  var chunks=[],recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:opts.quality===1080?5000000:3000000,audioBitsPerSecond:128000});
  recording=recorder;job.abort=function(){reject(new DOMException('تم الإلغاء','AbortError'));if(recorder.state!=='inactive')recorder.stop()};
  recorder.ondataavailable=function(e){if(e.data.size)chunks.push(e.data)};recorder.onerror=function(){reject(Error('تعذر إكمال الفيديو. جرّب جودة 720p.'))};recorder.onstop=function(){if(!job.canceled)resolve(new Blob(chunks,{type:mime.split(';')[0]}))};
  frame(0);recorder.start(500);var start=context.currentTime+.08;
  prepared.buffers.forEach(function(b,i){var node=context.createBufferSource();node.buffer=b;node.connect(dest);node.start(start+prepared.starts[i]);nodes.push(node)});
  function update(){if(job.canceled)return;var t=Math.max(0,context.currentTime-start);frame(t);send('progress',{value:Math.min(1,t/prepared.duration)});if(context.state!=='running'){reject(Error('توقف الصوت. أعد الإنشاء مع إبقاء الصفحة مفتوحة.'));return}if(t>=prepared.duration+.1){recorder.stop();return}timer=setTimeout(update,40)}
  timer=setTimeout(update,10);watch=setTimeout(function(){reject(Error('انتهت مهلة إنشاء الفيديو.'))},(prepared.duration+20)*1000);
 })}finally{clearTimeout(timer);clearTimeout(watch);if(recording&&recording.state!=='inactive')try{recording.stop()}catch(_){}nodes.forEach(function(n){try{n.stop();n.disconnect()}catch(_){}});stream.getTracks().forEach(function(t){t.stop()});capture.getTracks().forEach(function(t){t.stop()});dest.disconnect()}
}
async function exportVideo(id){
 if(!prepared)throw Error('جهّز الآيات أولًا.');stop();busy=true;var job={canceled:false};active=job;S.exporting=true;var blob;
 try{
  var context=await resumeAudioCtx();await document.fonts.ready;
  if(typeof isWebCodecsSupported==='function'&&isWebCodecsSupported()){
   try{var result=await startWebExportV2({canvas:$('cv'),drawFrame:drawFrame,setStateForTime:at,totalDuration:prepared.duration,fps:25,audioBuffers:prepared.buffers,ayaStarts:prepared.starts,bgBuffer:null,bgGain:0,bgLoop:false,recGain:1,bgVideo:S.bgVid,codecKey:'mp4-h264',videoBitrate:opts.quality===1080?5:3,audioBitrate:'128k',cancelRef:job,onProgress:function(p){send('progress',{value:Math.min(1,p/100)},id)}});blob=result.blob;}catch(error){if(job.canceled)throw error;S._exportingV2=false;blob=await fallback(context,job);}
  }else blob=await fallback(context,job);
  if(job.canceled)return;if(!blob||blob.size<1000)throw Error('لم يتكوّن فيديو صالح.');
  blob=new Blob([blob],{type:blob.type.split(';')[0]});send('result',{blob:blob,name:'samee3-'+prepared.surah+'-'+prepared.from+'-'+prepared.to+(blob.type.includes('mp4')?'.mp4':'.webm')},id);
 }catch(error){if(!job.canceled)throw error}finally{busy=false;active=null;S.exporting=false;S.playing=false;S._exportingV2=false;if(S.bgVid){S.bgVid.pause();S.bgVid.playbackRate=1}S.currentAya=0;S.elapsed=0;drawFrame(1);view();if(job.canceled)send('canceled',{},id)}
}
function cancel(){preparing++;if(active){active.canceled=true;if(active.abort)active.abort()}stop();S.exporting=false}
function start(){
 if(booted)return;if(S.surahs.length!==114){send('error',{message:'تعذر تحميل السور. تحقق من الاتصال واضغط إعادة المحاولة.'});return}booted=true;S.reciters=S.reciters.filter(function(r){return !r.folder.startsWith('warsh/')}).concat([{id:'basit_h',name:'عبد الباسط عبد الصمد',folder:'Abdul_Basit_Murattal_64kbps'},{id:'hudhaify',name:'علي الحذيفي',folder:'Hudhaify_128kbps'}]);renderReciters();radio('reciter','husary');var preview=$('preview');document.body.appendChild(preview);
 FMT_SIZES['9:16']={w:1080,h:1920};FMT_SIZES['16:9']={w:1920,h:1080};$('fsize').min='10';$('tfs').min='10';
 cancelAnimationFrame(S.rafId);
 var original=drawFrame,fitKey='',fitSize=110,fitTrans=55;
 drawFrame=function(t){
  var canvas=$('cv'),context=canvas.getContext('2d'),font=fontVal(),size=opts.size,text=S.verses[S.currentAya]?.text||'',translation=S.translations[S.currentAya]||'';
  function rows(text,size){context.font=size+'px '+font;var count=1,line='';text.split(/\s+/).forEach(function(w){if(context.measureText(line+' '+w).width>canvas.width*.8){count++;line=w}else line+=' '+w});return count}
  var key=[text,translation,canvas.width,canvas.height,opts.size,opts.font].join('|');if(key!==fitKey){
  while(size>15&&rows(text,canvas.width*.062*size/100)*canvas.width*.062*size/100*1.8>canvas.height*(translation?.30:.46))size-=3;
  set('fsize',size);var transSize=55;while(transSize>12&&rows(translation,canvas.width*.03*transSize/100*1.6)*canvas.width*.03*transSize/100*1.6*1.4>canvas.height*.15)transSize-=3;fitKey=key;fitSize=size;fitTrans=transSize;}set('fsize',fitSize);set('tfs',fitTrans);original(t);set('fsize',opts.size);
  context.save();context.textAlign='center';context.direction='rtl';context.fillStyle=opts.color;context.font='bold '+canvas.width*.028+'px Tajawal';context.fillText('القارئ '+(prepared?prepared.reader:(S.reciters.find(function(r){return r.id===radioVal('reciter')})||S.reciters[0]).name),canvas.width/2,canvas.height*.865);context.strokeStyle=opts.accent;context.beginPath();context.moveTo(canvas.width*.35,canvas.height*.89);context.lineTo(canvas.width*.65,canvas.height*.89);context.stroke();context.font=canvas.width*.024+'px Tajawal';context.fillStyle=opts.accent;context.fillText(String(opts.signature??'مصحف سميع').slice(0,60),canvas.width/2,canvas.height*.93);context.restore();
 };
 if(window.PIO)window.PIO.deliverFile=async function(blob,name){return {method:'samee3',path:name,bytes:blob.size}};
 window.samee3StudioUnlock=function(){return resumeAudioCtx()};
 style(opts);(function render(t){if(!busy&&S.playing){if(timeline)at(Math.max(0,Math.min(prepared.duration-.001,timeline.offset+timeline.context.currentTime-timeline.start)));drawFrame(t/1000)}S.rafId=requestAnimationFrame(render)})(0);send('ready',catalog());
}
window.addEventListener('message',function(event){
 if(event.source!==window.parent||event.origin!==location.origin||event.data?.channel!=='samee3-visual-v2')return;
 var m=event.data;if(m.action==='hello'){if(booted)send('ready',catalog());return}if(!booted)return;
 if(m.action==='cancel'||m.action==='stop'){cancel();return}
 if(busy){send('error',{message:'انتظر اكتمال إنشاء الفيديو.'},m.id);return}
 Promise.resolve().then(async function(){switch(m.action){case 'style':style(m.data);break;case 'prepare':await prepare(m.data,m.id);break;case 'play':await play();break;case 'restart':stop();if(prepared){at(0);S.elapsed=.5;drawFrame(1);view()}break;case 'background':await background(m.data,m.id);break;case 'invalidate':preparing++;stop();prepared=null;send('invalidated');break;case 'export':await exportVideo(m.id);break;}}).catch(function(error){send('error',{message:error.message||'تعذر إكمال العملية.'},m.id)});
});
window.addEventListener('pagehide',cancel);document.addEventListener('visibilitychange',function(){if(document.hidden){if(busy){cancel();send('error',{message:'توقف الإنشاء عند مغادرة الصفحة. اترك الشاشة مفتوحة وأعد المحاولة.'})}else stop()}});
waitFor(function(){return typeof samee3Ready!=='undefined'&&samee3Ready},60000).then(start).catch(function(e){send('error',{message:e.message})});
})();
`
// END OF SAMEE3 GT ENGINE
