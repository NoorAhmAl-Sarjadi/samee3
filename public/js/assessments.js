// Isolated assessment UI. Every answer is persisted on the server, not localStorage.
const s={access:null,catalog:null,items:[],record:null,programId:'portage',childId:'',domainIndex:0,goalIndex:0,loading:false,saving:false,libraryMode:false,library:null,libraryPage:0,libraryProgram:'portage',importing:false,editGoalId:null,importStatus:'',importSummary:'',librarySearch:'',sourceVerified:false,staffPermissions:[]}
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]))
const niceDate=x=>x?new Date(x.endsWith?.('Z')?x:x.replace(' ','T')+'Z').toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'}):'—'
const statusName={draft:'جارٍ التقييم',completed:'بانتظار الاعتماد',approved:'معتمدة'}
const sourceStatus={paid_checklist:'البنود الأصلية تتطلب ترخيصًا',official_free_resources:'مواد رسمية مجانية جزئية',framework_resources:'إطار تدريبي؛ لا توجد قائمة أهداف موحّدة كاملة',independent_original:'بنك عربي مستقل'}
const ratings=[['mastered','متقن'],['assisted','بمساعدة'],['not_mastered','غير متقن'],['not_tested','لم يتم تقييمه'],['not_applicable','غير منطبق']]
const domains=()=>s.record?.domains||[]
const goals=()=>domains().flatMap(d=>d.goals)
const answerMap=()=>new Map((s.record?.answers||[]).map(a=>[a.goal_id,a]))
const countDone=()=>s.record?.answers.length||0
const totalGoals=()=>goals().length
export function assessmentAccess(){return s.access}
export function assessmentSelectChild(id){s.childId=id;s.record=null}
export async function assessmentAccessLoad(api){const access=await api('/assessments/access');s.access=access;return access}
export async function assessmentPlatformLoad(api){s.loading=true;try{s.catalog=await api('/assessments/catalog');s.items=[];s.record=null;s.libraryMode=true;s.libraryPage=0;await loadLibrary(api)}finally{s.loading=false}}
export async function assessmentsLoad(api){s.loading=true;try{
 const [cat,history,staff]=await Promise.all([api('/assessments/catalog'),api('/assessments'),s.access?.can_delegate?api('/assessments/settings'):Promise.resolve(null)])
 s.catalog=cat;s.items=history.items;s.staffPermissions=staff?.specialists||[]
 if(!cat.programs.some(p=>p.id===s.programId))s.programId='portage'
 }finally{s.loading=false}}
const header=(h,txt)=>`<div class="page-head"><div><h1>${safe(h)}</h1><p>${safe(txt)}</p></div><div class="page-actions"><button class="btn btn-outline" data-action="assess-home">${'←'} البرامج والتقييمات</button></div></div>`
const action=(label,key,klass='primary',attrs='')=>`<button type="button" class="btn btn-${klass}" data-action="assess-${key}" ${attrs}>${label}</button>`
const empty=txt=>`<div class="assessment-muted">${safe(txt)}</div>`
const settingView=()=>!s.access?.can_delegate?'':`<section class="panel assessment-setting">
 <div class="panel-head"><div><h2>تحديد الأخصائيين المسموح لهم بالتقييم</h2>
 <p>مدير المركز والمشرف يمكنهما اختيار الأخصائيين المصرّح لهم بإجراء التقييمات، كل أخصائي على حدة.</p></div><span class="tag gray">${s.staffPermissions.filter(x=>x.can_evaluate).length} مخوّل</span></div>
 <p class="muted text-small">الأخصائي غير المخوّل يستطيع تنزيل خطط الأطفال المسندين إليه بعد اعتمادها فقط، بصيغتي Word وPDF. الأخصائي المخوّل يقيّم الأطفال المسندين إليه، لكن اعتماد الخطة للمدير والمشرف فقط.</p>
 <div class="assessment-delegation-list">${s.staffPermissions.length?s.staffPermissions.map(x=>`<label class="assessment-switch assessment-staff-switch">
 <input type="checkbox" data-assess-specialist-id="${safe(x.id)}" ${x.can_evaluate?'checked':''}>
 <span><strong>${safe(x.name)}</strong><small>${safe(x.email)} • ${x.can_evaluate?'مصرح له بالتقييم':'تحميل الخطط المعتمدة فقط'}</small></span>
 </label>`).join(''):empty('لا يوجد أخصائيون نشطون. أضف أخصائيًا من قسم فريق العمل أولًا.')}</div></section>`
const uploadPrograms=['portage','help','lovaas','vbmapp','abllsr','esdm']
const libraryStats=(p)=>{const a=s.catalog?.approved_by_program||[];return {approved:Number(a.find(x=>x.program_id===p&&x.review_status==='approved')?.total||0),pending:Number(a.find(x=>x.program_id===p&&x.review_status==='pending')?.total||0)}}
const countsText=p=>{const c=libraryStats(p);return c.approved?`${c.approved} بندًا متاحًا للتقييم${c.pending?' • '+c.pending+' غير مفعّل':''}`:c.pending?`${c.pending} بندًا محفوظًا؛ يحتاج تفعيلًا واحدًا من مدير المنصة`:'لم تُحمّل بيانات البرنامج بعد'}
async function loadLibrary(api){s.library=await api('/assessments/library?program_id='+encodeURIComponent(s.libraryProgram)+'&page='+s.libraryPage+'&q='+encodeURIComponent(s.librarySearch||''))}
function libraryView(owner=false){
 const programs=(s.catalog?.programs||[]).filter(x=>uploadPrograms.includes(x.id))
 const items=s.library?.items||[]
 const totalPending=(s.catalog?.approved_by_program||[]).filter(x=>uploadPrograms.includes(x.program_id)&&x.review_status==='pending').reduce((n,x)=>n+Number(x.total),0)
 const flagged=(s.catalog?.approved_by_program||[]).filter(x=>uploadPrograms.includes(x.program_id)&&x.review_status==='approved').reduce((n,x)=>n+Number(x.flagged||0),0)
 return `${header('إعدادات أهداف البرامج','جميع المراكز تستخدم مكتبة واحدة؛ تعديل أهدافها يخص مدير المنصة فقط')}
 ${owner?`<section class="panel assessment-setting"><div class="panel-head"><div><h2>تشغيل البرامج الستة</h2><p>لا تحتاج إلى مراجعة كل هدف أو اعتماده منفردًا. إذا كانت البيانات مستوردة من قبل، فعّلها بضغطة واحدة. وإن لم تكن مستوردة، ارفع ملف JSON الخاص مرة واحدة فقط.</p></div><span class="tag gray">6 برامج</span></div>
 <label class="assessment-switch"><input type="checkbox" id="assessment-source-rights"><span><b>أؤكد حقي في إتاحة المحتوى للمراكز</b> وأعلم أن الأهداف المستخرجة من مستندات Word تتطلب التحقق من دقة النصوص وحقوق الاستخدام، وأن إتاحتها لا يعني التحقق العلمي منها.</span></label>
 ${totalPending?`<div class="assessment-actions">${action('تفعيل '+totalPending+' بندًا محفوظًا لجميع المراكز','library-publish','primary')}</div>`:''}
 <label class="field">استيراد ملف البرامج الخاص (مرة واحدة فقط)<input id="assessment-import-file" type="file" accept=".json,application/json" ${s.importing?'disabled':''}></label>
 <p class="muted text-small">لا ترفع بيانات البرامج إلى مستودع GitHub العام. عند الاستيراد ستتاح البنود تلقائيًا للمراكز. يمكن تعديل أي بند من الأسفل في أي وقت، دون تغيير التقييمات السابقة.</p>
 <p class="assessment-import-status" aria-live="polite">${safe(s.importStatus||'اختر ملف البرامج JSON من الحزمة الخاصة؛ سيبدأ استيراده وتفعيله دون مراجعة الأهداف واحدًا واحدًا.')}</p>
 ${s.importSummary?`<p class="muted">${safe(s.importSummary)}</p>`:''}</section>`:''}
 <section class="panel"><div class="panel-head"><div><h2>تعديل أهداف البرامج</h2><p>ابحث عن مهارة، وعدّل نصها أو اسم مجالها، ثم احفظ. اسم مدير المنصة وتاريخ التعديل محفوظان.</p></div><span class="tag gray">${Number(s.libraryPage)+1} صفحة</span></div>
 <div class="assessment-domain-picker">${programs.map(pr=>`<button class="assessment-domain ${pr.id===s.libraryProgram?'active':''}" data-action="assess-library-program" data-id="${safe(pr.id)}">${safe(pr.name)}<small>${safe(countsText(pr.id))}</small></button>`).join('')}</div>
 <p class="muted">${safe(countsText(s.libraryProgram))}</p>
 ${flagged?`<p class="assessment-attention">تنبيه: هناك ${flagged} بندًا مُتاحًا رغم وجود تحذيرات في النص المصدر. يمكن البحث عنها وتصحيحها من هنا. لا تعتبر هذه البنود محققة علميًا بمجرد تفعيلها.</p>`:''}
 <div class="assessment-actions assessment-library-search"><input id="assessment-library-search" type="search" placeholder="ابحث في نص الهدف أو المجال أو رقم البند" value="${safe(s.librarySearch)}">${action('بحث','library-search','outline')}${s.librarySearch?action('مسح البحث','library-clear','outline'):''}</div>
 ${items.length?items.map(it=>{const flags=JSON.parse(it.review_flags||'[]');return `<article class="assessment-plan-goal assessment-review-goal"><div><strong>${safe(it.domain_name)}</strong> <span class="tag ${it.review_status==='approved'?'':'gray'}">${it.review_status==='approved'?'متاح للتقييم':'غير مفعّل'}</span> ${flags.length?'<span class="tag gray">يحتاج تصحيحًا لغويًا</span>':''}</div>
 <small>المصدر: ${safe(it.source_file)}${it.source_paragraph?' — فقرة '+it.source_paragraph:''}${it.source_number?' — البند '+safe(it.source_number):''}</small>
 ${flags.length?`<p class="assessment-review-warning">ملاحظات على النص: ${safe(flags.join('؛ '))}</p>`:''}
 <label class="field">المجال<input id="domain-${safe(it.goal_id)}" value="${safe(it.domain_name)}" maxlength="260"></label>
 <label class="field">نص الهدف<textarea id="review-${safe(it.goal_id)}" rows="2" maxlength="1800">${safe(it.title)}</textarea></label>
 <div class="assessment-actions">${action('حفظ تعديل الهدف','library-edit','primary',`data-goal="${safe(it.goal_id)}"`)}${action('سجل التعديلات','library-history','outline',`data-goal="${safe(it.goal_id)}"`)}</div></article>`}).join(''):empty('لا توجد نتائج. جرّب اسم مهارة آخر، أو استورد ملف البيانات الخاص.')}
 <div class="assessment-actions">${action('الصفحة السابقة','library-prev','outline',s.libraryPage<=0?'disabled':'')}${action('الصفحة التالية','library-next','outline',s.library?.has_more?'':'disabled')}</div></section>`
}
export function assessmentPage({children=[],owner=false,manager=false,globalAdmin=false}={}){
 if(s.loading)return header('التقييمات والخطط','جارٍ تحميل البرامج والنتائج...')
 if(!s.catalog)return header('التقييمات والخطط','افتح القسم لتحميل قائمة البرامج')
 if(globalAdmin)return libraryView(true)
 if(s.record)return assessmentDetail({manager})
 const programs=s.catalog.programs.filter(p=>uploadPrograms.includes(p.id)),selected=programs.find(p=>p.id===s.programId)||programs[0]
 const activeChildren=children.filter(c=>c.active),canEvaluate=Boolean(s.access?.can_evaluate)
 if(!s.childId||!activeChildren.some(c=>c.id===s.childId))s.childId=activeChildren[0]?.id||''
 return `${header('التقييمات والخطط الفردية','اختر البرنامج ثم الطفل وابدأ التقييم؛ جميع النتائج تحفظ بصورة آمنة')}
 <div class="assessment-disclaimer">${safe(s.catalog.notice)} لا تستخدم المكتبة الحالية لإصدار نتيجة مقننة باسم أي برنامج.</div>
 ${settingView()}
 
 ${canEvaluate?`<section class="panel"><div class="panel-head"><div><h2>اختر البرنامج</h2><p>البرامج المعتمدة مركزيًا فقط. لا يلزم استيراد أي ملفات من مدير المركز.</p></div><span class="tag gray">${programs.length} برامج</span></div>
 <h3 class="assessment-library-title">البرامج الستة المتاحة من مكتبة المنصة</h3><div class="assessment-programs">${programs.filter(p=>uploadPrograms.includes(p.id)).map(p=>`<button type="button" class="assessment-program ${p.id===selected.id?'selected':''}" data-action="assess-program" data-id="${safe(p.id)}"><strong>${safe(p.name)}</strong><span>${safe(p.kind)}</span><small>${uploadPrograms.includes(p.id)?countsText(p.id):p.domainIds.length+' مجالات من البنك العربي المستقل'}</small></button>`).join('')}</div>
 <div class="assessment-select"><div><h3>${safe(selected.name)}</h3><p class="assessment-source-status">${safe(sourceStatus[selected.sourceProfile?.status]||'المحتوى قيد التحقق')}</p><p><strong>محاور منشورة لدى الجهة الرسمية:</strong> ${(selected.sourceProfile?.topics||[]).map(safe).join('، ')}</p><p><strong>المجالات المرجعية المساعدة للتصنيف:</strong> ${selected.domainIds.map(id=>s.catalog.domains.find(d=>d.id===id)?.name).filter(Boolean).map(safe).join('، ')}</p><p class="muted text-small">${safe(selected.sourceProfile?.note||'')}</p><div class="assessment-source-links">${(selected.sourceProfile?.resources||[]).map(link=>`<a href="${safe(link.url)}" rel="noopener noreferrer" target="_blank">↗ ${safe(link.name)}</a>`).join('')}</div><p class="muted text-small">${safe(countsText(selected.id))}. ${uploadPrograms.includes(selected.id)?'يوفر مدير المنصة محتوى هذا البرنامج مركزيًا؛ تظهر الأهداف المتاحة للمراكز تلقائيًا ويمكن تعديلها من إعداداته.':'تُستخدم أهداف مكتبة تأهيل + المستقلة مع توضيح المصدر.'}</p></div>
 <label class="field">الطفل المراد تقييمه<select id="assessment-child-select" ${!activeChildren.length?'disabled':''}>${activeChildren.map(c=>`<option value="${safe(c.id)}" ${c.id===s.childId?'selected':''}>${safe(c.name)} — ${safe(c.code)}</option>`).join('')}</select></label>
 ${action('بدء تقييم جديد','start','primary',!activeChildren.length||(uploadPrograms.includes(selected.id)&&libraryStats(selected.id).approved===0)?'disabled title="أهداف البرنامج غير متاحة بعد"':'')}
 </div></section>`:`<section class="panel"><h2>خطط الأطفال المعتمدة</h2><p class="muted">يمكنك تنزيل خطة أي طفل مسند إليك بصيغة Word أو فتح نسخة للطباعة والحفظ PDF. لإجراء تقييم جديد اطلب من مدير المركز أو المشرف تفعيل صلاحيتك بالاسم.</p></section>`}
 <section class="panel"><div class="panel-head"><div><h2>${canEvaluate?'آخر التقييمات المسجلة':'الخطط المتاحة للتحميل'}</h2><p>عرض التقييم الأخير واستكمال المسودات وملفات الخطط السابقة</p></div><span class="tag gray">${s.items.length} تقييم</span></div>
 ${s.items.length?`<div class="assessment-history">${s.items.map(x=>`<article class="assessment-history-row"><div><strong>${safe(x.child_name)} — ${safe(x.program_name)}</strong><div class="muted text-small">المقيم: ${safe(x.assessor_name)} • ${niceDate(x.created_at)}</div></div><div class="assessment-history-actions"><span class="tag ${x.status==='approved'?'':'gray'}">${safe(statusName[x.status]||x.status)}</span>${canEvaluate?action(x.status==='draft'?'استكمال':'عرض الخطة','open','outline',`data-id="${safe(x.id)}"`):''}${x.status==='approved'?`<a class="btn btn-outline" href="/api/assessments/${encodeURIComponent(x.id)}/docx" download="taheel-plan.docx">⬇ Word</a><a class="btn btn-outline" href="/api/assessments/${encodeURIComponent(x.id)}/pdf" target="_blank" rel="noopener noreferrer">حفظ PDF</a>`:''}</div></article>`).join('')}</div>`:empty('لم تسجّل تقييمات بعد')}
 </section>`
}
function assessmentDetail({manager=false}={}){
 const {assessment:a,child,program}=s.record,ds=domains(),domain=ds[s.domainIndex]||ds[0]
 const plan=a.plan
 if(a.status!=='draft')return `${header('نتائج التقييم والخطة',`${child.name} — ${program.name}`)}
 <section class="panel"><div class="panel-head"><h2>الخطة ${a.status==='approved'?'المعتمدة':'المقترحة'}</h2><span class="tag ${a.status==='approved'?'':'gray'}">${safe(statusName[a.status])}</span></div>
 <div class="assessment-summary-grid"><div>إجمالي الأهداف<strong>${plan?.total||0}</strong></div><div>متقن<strong>${plan?.mastered||0}</strong></div><div>بمساعدة<strong>${plan?.assisted||0}</strong></div><div>غير متقن<strong>${plan?.not_mastered||0}</strong></div></div>
 <div class="assessment-plan">${(plan?.domains||[]).map(d=>`<div class="assessment-plan-domain"><h3>${safe(d.name)} <span class="tag gray">${d.goals.length} هدف يحتاج تدخلًا</span></h3>${d.goals.length?d.goals.map((g,i)=>`<div class="assessment-plan-goal"><b>${i+1}. ${safe(g.title)}</b><small>${g.rating==='assisted'?'بمساعدة':'غير متقن'}${g.note?' — '+safe(g.note):''}</small>
 ${g.objective?`<p class="assessment-plan-result"><strong>الهدف السلوكي:</strong> ${safe(g.objective)}</p>`:''}
 ${g.baseline?`<p class="assessment-plan-result"><strong>خط الأساس:</strong> ${safe(g.baseline)}</p>`:''}
 ${g.mastery?`<p class="assessment-plan-result"><strong>معيار الإتقان:</strong> ${safe(g.mastery)}</p>`:''}
 ${a.status==='completed'&&manager?`<div class="assessment-actions">${action(s.editGoalId===g.id?'إغلاق التحرير':'تحرير تفاصيل الهدف','edit-plan','outline',`data-goal="${safe(g.id)}"`)}</div>${s.editGoalId===g.id?`<div class="assessment-plan-edit">
 ${[['baseline','خط الأساس الحالي: عدد المحاولات، السياق، ومستوى المساعدة'],['objective','الهدف قصير المدى بصياغة سلوكية قابلة للقياس'],['mastery','معيار الإتقان مثل 80% عبر 3 جلسات حسب تقييم المختص'],['method','طريقة القياس: محاولات صحيحة / مدة / تكرار'],['strategy','أنشطة واستراتيجيات تدريب مناسبة للطفل'],['priority','أولوية الهدف'],['review_date','تاريخ المراجعة'],['assigned_specialist','اسم الأخصائي المكلف بتنفيذ الهدف']].map(([field,label])=>`<label class="field">${label}${field==='priority'?`<select data-plan-field="priority"><option ${g.priority==='عالية'?'selected':''}>عالية</option><option ${g.priority==='متوسطة'?'selected':''}>متوسطة</option><option ${g.priority==='منخفضة'?'selected':''}>منخفضة</option></select>`:field==='review_date'?`<input type="date" data-plan-field="${field}" value="${safe(g[field]||'')}">`:`<textarea data-plan-field="${field}" rows="2" maxlength="950">${safe(g[field]||'')}</textarea>`}</label>`).join('')}
 <p class="muted text-small">كل تعديل يُسجل باسم صاحب الحساب وتاريخه، ولا يمكن تغيير اسم منفذ التعديل في السجل.</p>${action('حفظ التعديلات باسم المستخدم الحالي','plan-save','primary',`data-goal="${safe(g.id)}"`)}</div>`:''}`:''}</div>`).join(''):'<p class="muted">لم يتم تحديد أهداف تدريبية بهذا المجال.</p>'}</div>`).join('')}</div>
 <div class="assessment-actions">${a.status==='completed'&&manager?action('اعتماد الخطة بعد المراجعة','approve','primary'):''}<a class="btn btn-outline" href="/api/assessments/${encodeURIComponent(a.id)}/docx" download="taheel-plan.docx">⬇ تحميل الخطة Word</a><a class="btn btn-outline" href="/api/assessments/${encodeURIComponent(a.id)}/pdf" target="_blank" rel="noopener noreferrer">حفظ PDF / طباعة</a></div>
 <div class="assessment-edit-log"><h3>سجل التعديلات الموثّق</h3>${(s.record.history||[]).slice(0,12).map(h=>`<p><b>${safe(h.actor_name)}</b> • ${safe(h.action)} • ${niceDate(h.created_at)}</p>`).join('')||'<p>لا توجد تعديلات مسجلة بعد.</p>'}</div><p class="muted text-small">الخطة لا تُعتمد إلا بعد تحديد الأهداف القابلة للقياس وخط الأساس ومعيار الإتقان وطريقة القياس وموعد المراجعة لكل مهارة تحتاج تدخلاً.</p></section>`
 const answers=answerMap(), current=domain?.goals[s.goalIndex],selected=answers.get(current?.id)
 const pct=totalGoals()?Math.round(countDone()/totalGoals()*100):0
 return `${header('تقييم ${program.name}',`${child.name} • آخر تعديل ${niceDate(a.updated_at)}`)}
 <div class="assessment-disclaimer">التقييم محفوظ على الخادم بعد كل إجابة. ${['center-reviewed-v1','platform-reviewed-v1','platform-uploaded-v2'].includes(a.catalog_version)?'هذه نسخة ثابتة من الأهداف المرفوعة؛ التفعيل لا يعني مراجعة علمية، وليست درجة معيارية رسمية للبرنامج.':'هذه المهارات من بنك تأهيل + العربي المستقل وليست بنودًا رسمية من '+safe(program.name)+'؛ لا تستخرج منها درجات البرنامج المعيارية.'}</div>
 <section class="panel"><div class="assessment-progress-head"><b>التقدم الكلي: ${countDone()} من ${totalGoals()} هدف</b><strong>${pct}%</strong></div><div class="assessment-progress-track"><div style="width:${pct}%"></div></div>
 <div class="assessment-domain-picker">${ds.map((d,i)=>{const done=d.goals.filter(g=>answers.has(g.id)).length;return `<button type="button" class="assessment-domain ${i===s.domainIndex?'active':''}" data-action="assess-domain" data-index="${i}"><b>${safe(d.name)}</b><small>${done}/${d.goals.length}</small></button>`}).join('')}</div></section>
 <section class="panel assessment-question"><div class="assessment-progress-head"><h2>${safe(domain?.name)}</h2><span class="tag gray">هدف ${s.goalIndex+1} من ${domain?.goals.length||0}</span></div>
 <div class="assessment-goal">${safe(current?.title||'')}</div>${current?.reviewFlags?.length?`<p class="assessment-review-warning">تنبيه: هذا البند يحتوي على ملاحظات في نص المصدر؛ يرجى التحقق من عبارته قبل الاعتماد على نتيجته.</p>`:''}<div class="assessment-goal-meta">${current?.sourceNumber?'البند '+safe(current.sourceNumber)+' • ':''}${current?.ageLabel?safe(current.ageLabel)+' • ':''}${current?.sourceParagraph?'الفقرة '+current.sourceParagraph+' من المستند • ':''}${safe(current?.sourceFile||'')}</div>
 <div class="assessment-ratings">${ratings.map(([v,label])=>`<button type="button" class="assessment-rating ${selected?.rating===v?'active':''}" data-action="assess-rate" data-rating="${v}" ${s.saving?'disabled':''}>${safe(label)}</button>`).join('')}</div>
 <label class="field">ملاحظة اختيارية على هذا الهدف<textarea id="assessment-goal-note" rows="2" maxlength="450" placeholder="مستوى المساعدة، الظروف، أمثلة الأداء...">${safe(selected?.note||'')}</textarea></label>
 <div class="assessment-actions">${action('السابق','prev','outline',s.domainIndex===0&&s.goalIndex===0?'disabled':'')}${action('حفظ وانتقال للتالي','next','primary',!selected?'disabled':'')}</div>
 </section>
 ${countDone()===totalGoals()?`<section class="panel assessment-finish"><h3>اكتمل تقييم جميع الأهداف</h3><p class="muted">يمكنك مراجعة إجاباتك، ثم إنشاء مسودة الخطة. لا يمكن تعديل التقييم بعد إنهائه.</p>${action('إنهاء التقييم وإنشاء الخطة','finalize')}</section>`:''}`
}
async function save(api,goalId,rating,note){if(s.saving)return false;s.saving=true;try{
 await api('/assessments/'+s.record.assessment.id+'/answer','PATCH',{goal_id:goalId,rating,note});
 const answers=s.record.answers,idx=answers.findIndex(a=>a.goal_id===goalId)
 const result={goal_id:goalId,rating,note};if(idx>=0)answers[idx]=result;else answers.push(result)
 s.record.assessment.updated_at=new Date().toISOString();return true
}finally{s.saving=false}}
async function saveCurrent(api){const goal=domains()[s.domainIndex]?.goals[s.goalIndex];if(!goal)return true;const answer=answerMap().get(goal.id);if(!answer)return false;const note=(document.querySelector('#assessment-goal-note')?.value||'').trim();if(note!==answer.note)return save(api,goal.id,answer.rating,note);return true}
function step(delta){let di=s.domainIndex,gi=s.goalIndex+delta;if(gi>=domains()[di].goals.length){di=Math.min(di+1,domains().length-1);gi=di===s.domainIndex?domains()[di].goals.length-1:0}else if(gi<0){di=Math.max(0,di-1);gi=di===s.domainIndex?0:domains()[di].goals.length-1}s.domainIndex=di;s.goalIndex=gi}
export async function assessmentAction(el,{api,notice,render,children,manager,owner,platformAdmin=false}){
 const action=el.dataset.action;if(!action?.startsWith('assess-'))return false
 if(s.saving)return true
 switch(action){
  case 'assess-home':s.record=null;s.editGoalId=null;s.libraryMode=false;if(platformAdmin)await assessmentPlatformLoad(api);else await assessmentsLoad(api);break
  case 'assess-library-open':s.libraryMode=true;s.libraryPage=0;await loadLibrary(api);break
  case 'assess-library-program':s.libraryProgram=el.dataset.id;s.libraryPage=0;await loadLibrary(api);break
  case 'assess-library-prev':s.libraryPage=Math.max(0,s.libraryPage-1);await loadLibrary(api);break
  case 'assess-library-next':s.libraryPage++;await loadLibrary(api);break
  case 'assess-library-search':s.librarySearch=(document.getElementById('assessment-library-search')?.value||'').trim();s.libraryPage=0;await loadLibrary(api);break
  case 'assess-library-clear':s.librarySearch='';s.libraryPage=0;await loadLibrary(api);break
  case 'assess-library-edit':{
   const id=el.dataset.goal
   const title=document.getElementById('review-'+id)?.value||''
   const domain_name=document.getElementById('domain-'+id)?.value||''
   const r=await api('/assessments/library/edit','PATCH',{program_id:s.libraryProgram,goal_id:id,title,domain_name})
   await loadLibrary(api);notice(r.unchanged?'لا توجد تغييرات':'تم حفظ الهدف باسم '+r.updated_by+' — التقييمات السابقة لم تتغير');break
  }
  case 'assess-library-history':{
   const r=await api('/assessments/library/edits?program_id='+encodeURIComponent(s.libraryProgram)+'&goal_id='+encodeURIComponent(el.dataset.goal))
   const lines=(r.history||[]).map(h=>`${h.actor_name} — ${h.changed_at}\nالسابق: ${h.old_title}\nالجديد: ${h.new_title}`)
   alert(lines.length?lines.join('\n\n──────────\n\n'):'لم يجر تعديل على هذا الهدف بعد');break
  }
  case 'assess-library-publish':{
   if(!document.getElementById('assessment-source-rights')?.checked)throw Error('أكّد حق إتاحة المحتوى والعلم بملاحظات النصوص أولًا')
   if(!confirm('تفعيل البنود المستوردة لجميع المراكز مباشرة؟ تبقى تحذيرات النصوص ظاهرة ويصبح تعديل الأهداف اختياريًا.'))break
   const result=await api('/assessments/library/publish','POST',{program_id:'all',usage_rights_confirmed:true,source_quality_acknowledged:true})
   s.catalog=await api('/assessments/catalog');await loadLibrary(api)
   notice('تم تفعيل '+result.published+' بندًا لجميع المراكز. يمكنك تعديل الأهداف من الإعدادات متى شئت.');break
  }
  case 'assess-edit-plan':s.editGoalId=s.editGoalId===el.dataset.goal?null:el.dataset.goal;break
  case 'assess-plan-save':{
    const fields={}
    for(const node of document.querySelectorAll('[data-plan-field]'))fields[node.dataset.planField]=node.value
    const r=await api('/assessments/'+s.record.assessment.id+'/plan','PATCH',{goal_id:el.dataset.goal,fields})
    s.record=await api('/assessments/'+s.record.assessment.id)
    s.editGoalId=null
    notice('حُفظت الخطة مع اسم وتاريخ من أجرى التعديل');break
  }
  case 'assess-program':s.programId=el.dataset.id;break
  case 'assess-start':{
   if(!s.access?.can_evaluate)throw Error('غير مصرح لك بإجراء التقييم')
   if(!s.childId)throw Error('اختر طفلًا أولًا')
   const result=await api('/assessments','POST',{child_id:s.childId,program_id:s.programId})
   s.record=await api('/assessments/'+result.id);s.editGoalId=null;s.domainIndex=0;s.goalIndex=0;notice('تم إنشاء التقييم وسيُحفظ كل هدف تلقائيًا');break
  }
  case 'assess-open':s.record=await api('/assessments/'+el.dataset.id);s.editGoalId=null;s.domainIndex=0;s.goalIndex=0;break
  case 'assess-domain':await saveCurrent(api);s.domainIndex=Number(el.dataset.index);s.goalIndex=0;break
  case 'assess-rate':{
   const goal=domains()[s.domainIndex].goals[s.goalIndex],note=document.querySelector('#assessment-goal-note')?.value?.trim()||''
   await save(api,goal.id,el.dataset.rating,note);notice('تم حفظ التقييم');break
  }
  case 'assess-prev':await saveCurrent(api);step(-1);break
  case 'assess-next':if(!await saveCurrent(api))throw Error('حدد مستوى المهارة أولًا');step(1);break
  case 'assess-finalize':{
   await saveCurrent(api)
   if(!confirm('هل تريد إنهاء التقييم وإنشاء الخطة؟ لن تستطيع تعديل الإجابات بعد الإنهاء.'))break
   await api('/assessments/'+s.record.assessment.id+'/finalize','POST');s.record=await api('/assessments/'+s.record.assessment.id);notice('تم إنشاء مسودة الخطة بنجاح');break
  }
  case 'assess-approve':{
   if(!confirm('هل تمت مراجعة الأهداف والخطة وتريد اعتمادها؟'))break
   await api('/assessments/'+s.record.assessment.id+'/approve','POST');s.record=await api('/assessments/'+s.record.assessment.id);notice('تم اعتماد الخطة');break
  }
 }
 render();if(['assess-home','assess-start','assess-open','assess-domain','assess-prev','assess-next'].includes(action))window.scrollTo({top:0,behavior:'auto'});return true
}
export async function assessmentChange(el,{api,notice,render}){
 if(el.id==='assessment-import-file'){
  const file=el.files?.[0];if(!file)return true
  if(s.importing)return true
  const name=file.name||''
  if(!/\.json$/i.test(name))throw Error('ملف البيانات المطلوب بصيغة JSON؛ فك ضغط مكتبة البرامج الخاصة أولًا واختر ملف Private_Programs_SIX_2026-10-17.json، وليس ملف ZIP أو Word')
  if(file.size>7_000_000)throw Error('ملف المصدر كبير جدًا (الحد 7 ميجابايت)')
  let payload
  try{payload=JSON.parse(await file.text())}catch{throw Error('لا يمكن قراءة ملف JSON؛ تأكد من فك الضغط واختيار الملف الصحيح')}
  if(!payload?.programs||typeof payload.programs!=='object'||Array.isArray(payload.programs))throw Error('صيغة ملف البنود غير مدعومة')
  const queue=[]
  const summary=[]
  for(const [pid,program] of Object.entries(payload.programs)){
   if(!uploadPrograms.includes(pid))continue
   let programCount=0
   for(const domain of program?.domains||[]){
    if(!domain?.id||!domain?.name||!Array.isArray(domain.goals))throw Error('بيانات مجال ناقصة في برنامج '+pid)
    const items=domain.goals.map(g=>({...g,domain_id:domain.id,domain_name:domain.name}))
    for(let i=0;i<items.length;i+=40)queue.push({pid,sourceFile:domain.source_file||program.filename||pid+'.docx',items:items.slice(i,i+40)})
    programCount+=items.length
   }
   if(programCount)summary.push(`${pid}: ${programCount}`)
  }
  const total=queue.reduce((n,b)=>n+b.items.length,0)
  if(!total)throw Error('الملف لا يحتوي على أهداف للبرامج الستة؛ اختر ملف البيانات الخاص المرسل مع التحديث')
  if(!document.getElementById('assessment-source-rights')?.checked)throw Error('أكّد امتلاك حق إتاحة المحتوى والعلم بملاحظات الجودة قبل الاستيراد')
  if(!confirm(`تم العثور على ${total} بندًا في ${summary.length} برامج. ستُتاح للمراكز مباشرة بعد الاستيراد مع إبقاء تحذيرات الأخطاء في النصوص. هل تبدأ؟`))return true
  s.importing=true;el.disabled=true
  let count=0,finished=0,part=''
  const progressText=message=>{s.importStatus=message;const n=document.querySelector('.assessment-import-status');if(n)n.textContent=message}
  progressText(`جاري استيراد 0 من ${total} بندًا — برجاء إبقاء الصفحة مفتوحة`)
  try{
   for(const batch of queue){
    part=`${batch.pid} • الدفعة ${finished+1} من ${queue.length}`
    progressText(`جاري الاستيراد ${count} / ${total} • ${part}`)
    let succeeded=false
    for(let attempt=0;attempt<3&&!succeeded;attempt++){
     try{
      const result=await api('/assessments/library/import','POST',{program_id:batch.pid,source_file:batch.sourceFile,items:batch.items,publish:true,usage_rights_confirmed:true,source_quality_acknowledged:true})
      if(!result?.ok||result.received!==batch.items.length)throw Error('الخادم لم يؤكد حفظ الدفعة كاملة')
      succeeded=true
     }catch(err){
      if(attempt===2||![0,429,502,503,504].includes(Number(err.status||0)))throw err
      await new Promise(resolve=>setTimeout(resolve,(attempt+1)*700))
     }
    }
    count+=batch.items.length;finished++
    progressText(`تم حفظ ${count} / ${total} بندًا • ${part}`)
   }
   s.libraryPage=0
   const [updatedCatalog]=await Promise.all([api('/assessments/catalog'),loadLibrary(api)])
   s.catalog=updatedCatalog
   s.importSummary=`اكتمل استيراد ${count} بندًا من ${summary.length} برامج. قد تكون بعض البنود محفوظة من محاولة سابقة. يمكن الآن تعديل النصوص من إعدادات مدير المنصة.`
   progressText(`اكتمل الاستيراد بنجاح: ${count} / ${total} بندًا`)
   notice(`تم استيراد وتفعيل ${count} بندًا. يمكنك تعديل الأهداف من الإعدادات.`)
  }catch(err){
   s.importSummary=`تم تأكيد ${count} من ${total} بندًا قبل توقف الاستيراد. لا تُحذف البنود المحفوظة؛ أعد اختيار الملف لاستكماله دون تكرار.`
   progressText(`توقف الاستيراد عند ${part}: ${err.message||'خطأ غير معروف'}`)
   notice(`فشل استيراد دفعة ${part}: ${err.message||'خطأ غير معروف'}`,true)
   try{s.catalog=await api('/assessments/catalog');await loadLibrary(api)}catch{}
  }finally{s.importing=false;el.disabled=false;el.value='';render()}
  return true
 }

 if(el.id==='assessment-child-select'){s.childId=el.value;return true}
 if(el.matches('[data-assess-specialist-id]')){
  if(!s.access?.can_delegate)throw Error('غير مسموح بتعديل صلاحيات الأخصائيين')
  const allowed=el.checked,id=el.dataset.assessSpecialistId
  el.disabled=true
  try{
   await api('/assessments/settings','PATCH',{specialist_id:id,can_evaluate:allowed})
   const result=await api('/assessments/settings')
   s.staffPermissions=result.specialists||[]
   notice(allowed?'تم السماح للأخصائي بإجراء التقييمات':'تم إيقاف التقييم للأخصائي مع الإبقاء على تحميل الخطط المعتمدة')
   render()
  }catch(err){el.checked=!allowed;el.disabled=false;throw err}
  return true
 }
 if(el.id==='assessment-goal-note'&&s.record?.assessment.status==='draft'){
  const goal=domains()[s.domainIndex].goals[s.goalIndex],old=answerMap().get(goal.id)
  if(old){await save(api,goal.id,old.rating,el.value.trim());notice('تم حفظ الملاحظة')}
  return true
 }
 return false
}
