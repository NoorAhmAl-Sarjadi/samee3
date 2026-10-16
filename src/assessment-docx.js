// Safe RTL Word generator, dependency-free on Cloudflare Workers.
// The export contains the observed inventory item, and separately the reviewed IEP target.
const enc=s=>new TextEncoder().encode(s)
const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
const u16=(v,n,x)=>{v[n]=x&255;v[n+1]=(x>>>8)&255}
const u32=(v,n,x)=>{u16(v,n,x);u16(v,n+2,x>>>16)}
const crcTable=Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0})
const crc=b=>{let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function zip(files){const l=[],c=[];let offset=0;for(const [filename,contents] of Object.entries(files)){const fn=enc(filename),v=enc(contents),sum=crc(v),p=new Uint8Array(30+fn.length+v.length);u32(p,0,0x04034b50);u16(p,4,20);u32(p,14,sum);u32(p,18,v.length);u32(p,22,v.length);u16(p,26,fn.length);p.set(fn,30);p.set(v,30+fn.length);l.push(p);const q=new Uint8Array(46+fn.length);u32(q,0,0x02014b50);u16(q,4,20);u16(q,6,20);u32(q,16,sum);u32(q,20,v.length);u32(q,24,v.length);u16(q,28,fn.length);u32(q,42,offset);q.set(fn,46);c.push(q);offset+=p.length}const d=c.reduce((a,b)=>a+b.length,0),end=new Uint8Array(22);u32(end,0,0x06054b50);u16(end,8,c.length);u16(end,10,c.length);u32(end,12,d);u32(end,16,offset);const bytes=new Uint8Array(offset+d+22);let i=0;for(const v of [...l,...c,end]){bytes.set(v,i);i+=v.length}return bytes}
const font=`<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:rtl/>`
function para(text,{size=23,bold=false,color='253C46',align='right',before=0,after=110,fill='',border='',keep=false}={}){
 const pr=`<w:bidi/><w:jc w:val="${align}"/><w:spacing w:before="${before}" w:after="${after}" w:line="340" w:lineRule="auto"/>${keep?'<w:keepNext/>':''}${fill?`<w:shd w:fill="${fill}" w:val="clear"/>`:''}${border?`<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="8" w:color="${border}"/></w:pBdr>`:''}`
 return `<w:p><w:pPr>${pr}</w:pPr><w:r><w:rPr>${font}${bold?'<w:b/>':''}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`
}
const head=x=>para(x,{size:29,bold:true,color:'116D72',before:270,after:180,border:'C9DDD8',keep:true})
const item=x=>para(x,{size:22,after:120})
const info=(title,value)=>para(title+'  '+(value||'لم يُحدد بعد'),{size:21,color:value?'274451':'7D8C91',after:90})
const status={mastered:'متقن باستقلالية',assisted:'يؤدي بمساعدة',not_mastered:'غير متقن',not_tested:'لم يتم التقييم',not_applicable:'غير منطبق'}
const val=(g,k)=>String(g[k]||'').trim()
export function createAssessmentDocx(plan,meta){
 const {child,center,program,assessor,assessment,lastEditor,reviewer}=meta
 const approved=assessment.status==='approved'
 const content=[
  para('تأهيل +  |  '+center.name,{size:29,color:'116D72',bold:true,align:'center',after:65}),
  para('الخطة التربوية الفردية',{size:38,bold:true,align:'center',after:90}),
  para('تقرير الاحتياجات وأهداف التدخل القابلة للقياس',{size:24,align:'center',color:'536B76',after:165}),
  para(approved?'خطة معتمدة من المركز':'مسودة تحتاج إلى مراجعة واعتماد المشرف',{size:22,bold:true,align:'center',color:approved?'138264':'A26D27',fill:approved?'EBF8F1':'FFF6E9',after:200}),
  head('أولًا | بيانات الطفل والتقييم'),
  info('اسم الطفل:',child.name),info('رمز الطفل:',child.code),info('تاريخ الميلاد:',child.birth_date||'غير مسجل'),
  info('المركز:',center.name),info('البرنامج/الإطار:',program.name),
  info('تاريخ التقييم:',assessment.created_at?.slice(0,10)),
  info('الأخصائي القائم بالتقييم:',assessor?.name),
  info('آخر من عدّل التقييم أو الخطة:',lastEditor?.actor_name||assessor?.name),
  info('تاريخ آخر تعديل:',lastEditor?.created_at?.slice(0,16)||assessment.updated_at?.slice(0,16)),
  ...(approved?[info('اعتمدها:',reviewer?.name||'المشرف/المدير'),info('تاريخ الاعتماد:',assessment.approved_at?.slice(0,10))]:[]),
  para('مصدر البنود: مستندات المركز التي راجعها المسؤول. النتائج ليست درجات معيارية رسمية إلا عند تطبيق الأداة وتصحيحها وفق دليلها المعتمد.',{size:19,color:'677F88',after:190}),
  head('ثانيًا | ملخص مستويات الأداء'),
  item(`عدد البنود المقيمة: ${plan.total}   •   متقن: ${plan.mastered}   •   بمساعدة: ${plan.assisted}   •   غير متقن: ${plan.not_mastered}   •   غير مقيَّم أو غير منطبق: ${plan.unrated}`),
  item(`الاحتياجات المرشحة للتدخل: ${(plan.domains||[]).reduce((a,d)=>a+d.goals.length,0)} مهارة موزعة على ${(plan.domains||[]).filter(d=>d.goals.length).length} مجالات`),
  para('ملاحظة علمية: وجود بند غير متقن لا يعني تلقائيًا ملاءمته للتدريب الآن. يجب مراعاة العمر النمائي، ودافعية الطفل، والمتطلبات السابقة، وأولويات الأسرة، ونتائج الملاحظة المباشرة.',{size:19,color:'6E8391',after:185}),
  head('ثالثًا | الأهداف التدريبية حسب المجالات')
 ]
 for(const domain of plan.domains||[]){
  content.push(para(domain.name,{size:25,bold:true,color:'185F63',before:260,after:120,fill:'EAF5F2',keep:true}))
  if(!domain.goals.length){content.push(para('لا توجد في هذا المجال مهارات مُرشَّحة للتدخل بناءً على الإجابات المسجلة.',{size:20,color:'687A83'}));continue}
  content.push(para(`عدد المهارات التي تحتاج إلى دعم: ${domain.goals.length}`,{size:20,color:'5D7181',after:110}))
  for(const [index,g] of domain.goals.entries()){
   content.push(para(`${index+1}. ${g.title}`,{size:23,bold:true,color:'203F4C',before:170,after:80,keep:true}))
   content.push(info('مستوى الأداء المسجل:',status[g.rating]||g.rating))
   if(g.note)content.push(info('ملاحظات الأداء:',g.note))
   if(g.reviewFlags?.length)content.push(para('تنبيه: نص هذه المهارة في المرجع المرفوع عليه ملاحظات قراءة. يُرجى التحقق من العبارة قبل اعتماد الهدف التدريبي.',{size:19,color:'A06622',after:110}))
   if(g.ageLabel)content.push(info('الفئة/العمر المرجعي بالمستند:',g.ageLabel))
   if(g.sourceFile)content.push(para(`مرجع البند: ${g.sourceFile}${g.sourceNumber?' • رقم '+g.sourceNumber:''}${g.sourceParagraph?' • الفقرة '+g.sourceParagraph:g.sourcePage?' • ص '+g.sourcePage:''}`,{size:18,color:'788B94',after:110}))
   content.push(info('خط الأساس:',val(g,'baseline')))
   content.push(info('الهدف قصير المدى القابل للقياس:',val(g,'objective')))
   content.push(info('معيار الإتقان:',val(g,'mastery')))
   content.push(info('أسلوب القياس:',val(g,'method')))
   content.push(info('استراتيجيات التدريب:',val(g,'strategy')))
   content.push(info('الأولوية:',val(g,'priority')))
   content.push(info('الأخصائي المكلف بالتنفيذ:',val(g,'assigned_specialist')))
   content.push(info('تاريخ المراجعة:',val(g,'review_date')))
  }
 }
 content.push(head('رابعًا | المتابعة والمراجعة'))
 content.push(item('يُسجَّل الأداء بالمحاولات والمساعدة ومستوى الاستقلالية، وتُقارن النتائج بخط الأساس ومعيار الإتقان لكل هدف. ويُعاد ترتيب الأولويات عند المراجعة الدورية.'))
 content.push(head('خامسًا | توثيق واعتماد الفريق'))
 content.push(para('اسم الأخصائي القائم بالتعديل: '+(lastEditor?.actor_name||assessor?.name||'_______________')))
 content.push(para('توقيع الأخصائي: ________________________    تاريخ التوقيع: _______________'))
 content.push(para('توقيع المشرف/مدير المركز: ________________________'))
 content.push(para('ملاحظة: هذا المستند أداة للتخطيط التربوي، وليس تشخيصًا طبيًا أو تقرير درجات معيارية معتمدًا عن ناشر البرنامج.',{size:19,color:'7D8890',before:170}))
 const body=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${content.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="1150" w:bottom="950" w:left="1150"/><w:footerReference w:type="default" r:id="rId2" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></w:sectPr></w:body></w:document>`
 const footer=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:bidi/><w:jc w:val="center"/></w:pPr><w:r><w:rPr>${font}<w:color w:val="81969D"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">تأهيل +  |  وثيقة داخلية سرية  •  صفحة </w:t></w:r><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>`
 return zip({
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>',
  '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/_rels/document.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>',
  'word/footer1.xml':footer,'word/document.xml':body
 })
}
