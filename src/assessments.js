import {CATALOG_VERSION,PROGRAMS,DOMAINS,WORD_INVENTORY_PROGRAMS,programById,programForSavedRecord,programDomains} from './assessment-catalog.js'
import {createAssessmentDocx} from './assessment-docx.js'
import {createAssessmentPrintHtml} from './assessment-pdf.js'
import {sourceProfileFor} from './assessment-sources.js'
import {error,json,uuid} from './security.js'

const exec = (db,sql,...args)=>db.prepare(sql).bind(...args).run()
const rows = async (db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results||[]
const one = (db,sql,...args)=>db.prepare(sql).bind(...args).first()
const must=(v,msg,code=400)=>{if(!v)throw error(msg,code)}
const isManager=user=>['center_admin','supervisor'].includes(user.role)
const schemaCache=new Map()
const UPLOADED_PROGRAMS=new Set(WORD_INVENTORY_PROGRAMS)
// Only explicitly configured programs are active. Archived records are preserved separately.
const ACTIVE_PLACEHOLDERS=WORD_INVENTORY_PROGRAMS.map(()=>'?').join(',')
const editablePlanFields=['baseline','objective','mastery','method','strategy','review_date','priority','assigned_specialist']
export async function ensureAssessmentSchema(db,key=db){
 if(!schemaCache.has(key)){
  const ready=(async()=>{
   await exec(db,`CREATE TABLE IF NOT EXISTS assessment_settings (center_id TEXT PRIMARY KEY REFERENCES centers(id),specialist_enabled INTEGER NOT NULL DEFAULT 0 CHECK(specialist_enabled IN (0,1)))`)
   // Per-user delegation is separate from the legacy all-specialists switch.
   // The switch is deliberately ignored for evaluation authorization.
   await exec(db,`CREATE TABLE IF NOT EXISTS assessment_specialist_permissions (
      center_id TEXT NOT NULL REFERENCES centers(id), specialist_id TEXT NOT NULL REFERENCES users(id),
      can_evaluate INTEGER NOT NULL DEFAULT 0 CHECK(can_evaluate IN (0,1)),
      changed_by TEXT REFERENCES users(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(center_id,specialist_id))`)
   await exec(db,`CREATE TABLE IF NOT EXISTS assessment_records (
      id TEXT PRIMARY KEY,center_id TEXT NOT NULL REFERENCES centers(id),child_id TEXT NOT NULL REFERENCES children(id),program_id TEXT NOT NULL,
      catalog_version TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','completed','approved')),
      plan_json TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finalized_at TEXT,approved_at TEXT,approved_by TEXT REFERENCES users(id),revision INTEGER NOT NULL DEFAULT 0)`)
   try{await exec(db,'ALTER TABLE assessment_records ADD COLUMN revision INTEGER NOT NULL DEFAULT 0')}catch(e){if(!/duplicate column name/i.test(String(e)))throw e}
   await exec(db,`CREATE INDEX IF NOT EXISTS idx_assessments_center_child ON assessment_records(center_id,child_id,created_at DESC)`)
   await exec(db,`CREATE TABLE IF NOT EXISTS assessment_answers (
      assessment_id TEXT NOT NULL REFERENCES assessment_records(id),goal_id TEXT NOT NULL,
      rating TEXT NOT NULL CHECK(rating IN ('mastered','assisted','not_mastered','not_tested','not_applicable')),
      note TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(assessment_id,goal_id))`)
   await exec(db,`CREATE TABLE IF NOT EXISTS assessment_library_items (
      center_id TEXT NOT NULL REFERENCES centers(id),program_id TEXT NOT NULL,goal_id TEXT NOT NULL,
      domain_id TEXT NOT NULL,domain_name TEXT NOT NULL,title TEXT NOT NULL,
      source_file TEXT NOT NULL,source_page INTEGER NOT NULL DEFAULT 0,source_number TEXT NOT NULL DEFAULT '',
      source_paragraph INTEGER NOT NULL DEFAULT 0,source_section TEXT NOT NULL DEFAULT '',age_label TEXT NOT NULL DEFAULT '',review_flags TEXT NOT NULL DEFAULT '[]',
      review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved')),
      reviewed_by TEXT, reviewed_at TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(center_id,program_id,goal_id))`)
   for(const [column,definition] of Object.entries({source_paragraph:'INTEGER NOT NULL DEFAULT 0',source_section:"TEXT NOT NULL DEFAULT ''",age_label:"TEXT NOT NULL DEFAULT ''",review_flags:"TEXT NOT NULL DEFAULT '[]'"})){
     try{await exec(db,`ALTER TABLE assessment_library_items ADD COLUMN ${column} ${definition}`)}catch(e){if(!/duplicate column name/i.test(String(e)))throw e}
   }
   // One reviewed catalog belongs to the platform, never to a tenant center.
   await exec(db,`CREATE TABLE IF NOT EXISTS assessment_global_library_items (
      program_id TEXT NOT NULL,goal_id TEXT NOT NULL,domain_id TEXT NOT NULL,domain_name TEXT NOT NULL,title TEXT NOT NULL,
      source_file TEXT NOT NULL,source_page INTEGER NOT NULL DEFAULT 0,source_number TEXT NOT NULL DEFAULT '',
      source_paragraph INTEGER NOT NULL DEFAULT 0,source_section TEXT NOT NULL DEFAULT '',age_label TEXT NOT NULL DEFAULT '',review_flags TEXT NOT NULL DEFAULT '[]',
      review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved')),
      reviewed_by TEXT REFERENCES users(id),reviewed_at TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(program_id,goal_id))`)
   await exec(db,`CREATE INDEX IF NOT EXISTS idx_assessment_global_library ON assessment_global_library_items(program_id,review_status)`)
   await exec(db,`CREATE TABLE IF NOT EXISTS assessment_edit_history (id TEXT PRIMARY KEY,assessment_id TEXT NOT NULL REFERENCES assessment_records(id),center_id TEXT NOT NULL REFERENCES centers(id),actor_id TEXT NOT NULL REFERENCES users(id),actor_name TEXT NOT NULL,action TEXT NOT NULL,goal_id TEXT NOT NULL DEFAULT '',details_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
   await exec(db,`CREATE INDEX IF NOT EXISTS idx_assessment_edit_history ON assessment_edit_history(assessment_id,created_at)`)
   await exec(db,`CREATE INDEX IF NOT EXISTS idx_assessment_library_program ON assessment_library_items(center_id,program_id,review_status)`)
   await exec(db,`CREATE TABLE IF NOT EXISTS assessment_library_changes (
      id TEXT PRIMARY KEY,program_id TEXT NOT NULL,goal_id TEXT NOT NULL,actor_id TEXT NOT NULL REFERENCES users(id),
      actor_name TEXT NOT NULL,old_title TEXT NOT NULL,new_title TEXT NOT NULL,old_domain TEXT NOT NULL,new_domain TEXT NOT NULL,
      changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)` )
   await exec(db,`CREATE INDEX IF NOT EXISTS idx_assessment_library_changes ON assessment_library_changes(program_id,goal_id,changed_at DESC)` )
   await exec(db,`CREATE TABLE IF NOT EXISTS assessment_catalog_snapshots (
      assessment_id TEXT PRIMARY KEY REFERENCES assessment_records(id),domains_json TEXT NOT NULL)`)
   // Remove all earlier seed catalogs and discontinued program content (not just renamed entries).
   // NEVER delete assessment records/answers/plans or their historical snapshots.
   await exec(db,`DELETE FROM assessment_global_library_items WHERE program_id NOT IN (${ACTIVE_PLACEHOLDERS})`,...WORD_INVENTORY_PROGRAMS)
   await exec(db,`DELETE FROM assessment_library_items WHERE program_id NOT IN (${ACTIVE_PLACEHOLDERS})`,...WORD_INVENTORY_PROGRAMS)
  })().catch(e=>{schemaCache.delete(key);throw e})
  schemaCache.set(key,ready)
 }
 await schemaCache.get(key)
}
async function parse(req){must((req.headers.get('content-type')||'').includes('application/json'),'يجب إرسال JSON',415);const raw=await req.text();must(raw.length<=110000,'الطلب كبير جدًا',413);try{return JSON.parse(raw)}catch{throw error('بيانات غير صالحة')}}
async function canEvaluate(db,user){
 if(isManager(user))return true
 if(user.role!=='specialist'||!user.center_id)return false
 const permission=await one(db,`SELECT can_evaluate FROM assessment_specialist_permissions
   WHERE center_id=? AND specialist_id=?`,user.center_id,user.id)
 return Number(permission?.can_evaluate||0)===1
}
async function canUse(db,user){
 must(user.center_id&&user.role!=='superadmin','ليس لديك صلاحية التقييمات',403)
 must(isManager(user)||user.role==='specialist','ليس لديك صلاحية التقييمات',403)
 return true // Specialists may always download approved plans for their assigned children.
}
async function requireEvaluator(db,user){
 must(await canEvaluate(db,user),'لا تملك صلاحية إجراء التقييم. اطلب من مدير المركز أو المشرف اختيار حسابك.',403)
}
async function accessibleChild(db,user,id){
 const child=await one(db,'SELECT id,name,code,birth_date,active FROM children WHERE id=? AND center_id=?',id,user.center_id)
 must(child,'ملف الطفل غير موجود في مركزك',404)
 if(user.role==='specialist'){
  const assigned=await one(db,'SELECT 1 AS ok FROM assignments WHERE center_id=? AND child_id=? AND specialist_id=?',user.center_id,id,user.id)
  must(assigned,'هذا الطفل غير مسند إليك',403)
 }
 return child
}
async function recordFor(db,user,id){
 const a=await one(db,'SELECT * FROM assessment_records WHERE id=? AND center_id=?',id,user.center_id)
 must(a,'التقييم غير موجود في المركز',404)
 const child=await accessibleChild(db,user,a.child_id)
 if(user.role==='specialist'&&a.status!=='approved'){
   must(a.created_by===user.id&&await canEvaluate(db,user),'يمكنك تنزيل الخطط المعتمدة فقط',403)
 }
 return {a,child}
}
function viewRecord(r){const {plan_json,...rest}=r;return {...rest,plan:plan_json?JSON.parse(plan_json):null}}
function makePlan(a,answers,chosenDomains){
 const byId=new Map(answers.map(x=>[x.goal_id,x]))
 const domains=chosenDomains.map(domain=>({id:domain.id,name:domain.name,goals:domain.goals.flatMap(goal=>{
  const answer=byId.get(goal.id)
  return answer&&['not_mastered','assisted'].includes(answer.rating)?[{id:goal.id,title:goal.title,rating:answer.rating,note:answer.note,sourcePage:goal.sourcePage,sourceParagraph:goal.sourceParagraph,sourceFile:goal.sourceFile,sourceNumber:goal.sourceNumber,ageLabel:goal.ageLabel,sourceSection:goal.sourceSection,reviewFlags:goal.reviewFlags||[],baseline:'',objective:'',mastery:'',method:'',strategy:'',review_date:'',priority:'متوسطة',assigned_specialist:''}]:[]
 })}))
 let mastered=0,assisted=0,not_mastered=0,unrated=0
 for(const domain of chosenDomains)for(const goal of domain.goals){
  const rating=byId.get(goal.id)?.rating
  if(rating==='mastered')mastered++
  else if(rating==='assisted')assisted++
  else if(rating==='not_mastered')not_mastered++
  else if(rating==='not_tested'||rating==='not_applicable')unrated++
 }
 return {version:a.catalog_version,total:mastered+assisted+not_mastered+unrated,mastered,assisted,not_mastered,unrated,domains}
}
// Each assessment takes a permanent snapshot of its approved goals.
// Editing the center library later never silently changes an ongoing evaluation.
async function domainsForRecord(db,a){
 const snap=await one(db,'SELECT domains_json FROM assessment_catalog_snapshots WHERE assessment_id=?',a.id)
 // Legacy unified assessments were stored without frozen snapshots in very early versions.
 // Preserve read access to their original results without ever listing those sample goals for new evaluations.
 return snap?JSON.parse(snap.domains_json):a.program_id==='unified'?DOMAINS:programDomains(a.program_id)
}
async function approvedGlobalDomains(db,programId){
 const items=await rows(db,`SELECT goal_id,domain_id,domain_name,title,source_page,source_paragraph,source_section,age_label,source_file,source_number,review_flags
   FROM assessment_global_library_items WHERE program_id=? AND review_status='approved'
   ORDER BY domain_id,source_paragraph,goal_id`,programId)
 const ds=[];const byId=new Map()
 for(const item of items){
  let d=byId.get(item.domain_id)
  if(!d){d={id:item.domain_id,name:item.domain_name,goals:[]};byId.set(d.id,d);ds.push(d)}
  d.goals.push({id:item.goal_id,title:item.title,sourcePage:item.source_page,sourceParagraph:item.source_paragraph,sourceSection:item.source_section,ageLabel:item.age_label,sourceNumber:item.source_number,sourceFile:item.source_file,reviewFlags:JSON.parse(item.review_flags||'[]')})
 }
 return ds
}
async function handleLibrary(req,db,user,path,method){
 must(user.role==='superadmin','مكتبة البرامج المركزية متاحة لمدير المنصة العام فقط',403)
 const base='/api/assessments/library',url=new URL(req.url)
 if(path===base&&method==='GET'){
  const programId=String(url.searchParams.get('program_id')||'')
  if(!programId){
   const summary=await rows(db,`SELECT program_id,review_status,COUNT(*) total FROM assessment_global_library_items GROUP BY program_id,review_status ORDER BY program_id`)
   return json({summary})
  }
  must(UPLOADED_PROGRAMS.has(programId),'البرنامج غير متاح')
  const page=Math.min(10000,Math.max(0,Number(url.searchParams.get('page')||0)|0))
  const search=String(url.searchParams.get('q')||'').trim().slice(0,120)
  const like='%'+search.replace(/[\%_]/g,'\\$&')+'%'
  const where=search?" AND (title LIKE ? ESCAPE '\\' OR domain_name LIKE ? ESCAPE '\\' OR source_number LIKE ? ESCAPE '\\')":''
  const items=await rows(db,`SELECT program_id,goal_id,domain_id,domain_name,title,source_file,source_page,source_paragraph,source_section,age_label,source_number,review_flags,review_status,reviewed_at
    FROM assessment_global_library_items WHERE program_id=?${where} ORDER BY source_file,source_paragraph,domain_id,goal_id LIMIT 100 OFFSET ?`,programId,...(search?[like,like,like]:[]),page*100)
  return json({items,page,has_more:items.length===100})
 }
 if(path===base+'/import'&&method==='POST'){
  must(user.role==='superadmin','استيراد المحتوى لمدير المنصة فقط',403)
  const b=await parse(req)
  must(UPLOADED_PROGRAMS.has(String(b.program_id||'')),'هذا البرنامج غير متاح لاستيراد البنود')
  must(Array.isArray(b.items)&&b.items.length>=1&&b.items.length<=55,'أرسل من 1 إلى 55 بندًا في الدفعة')
  const autoPublish=b.publish===true
  if(autoPublish)must(b.usage_rights_confirmed===true&&b.source_quality_acknowledged===true,'تفعيل المكتبة يتطلب تأكيد حقوق الاستخدام والعلم بملاحظات جودة النص')
  const sf=String(b.source_file||'').trim().slice(0,160)
  must(sf.length>0,'حدد اسم المستند المصدر')
  const prepared=b.items.map((it,i)=>{
   const id=String(it.id||''),dn=String(it.domain_name||'').trim(),di=String(it.domain_id||''),title=String(it.title||'').trim()
   const page=Number(it.source_page)
   must(/^[a-zA-Z0-9_-]{3,100}$/.test(id),'معرف بند غير صحيح في الصف '+(i+1))
   must(/^[a-zA-Z0-9_-]{3,100}$/.test(di),'معرف مجال غير صحيح')
   must(dn.length>=2&&dn.length<=260,'اسم المجال غير صالح')
   must(title.length>=3&&title.length<=1800,'نص البند غير صالح')
   must(Number.isSafeInteger(page)&&page>=0&&page<=10000,'رقم صفحة المصدر غير صالح')
   const para=Number(it.source_paragraph||0)
   must(Number.isSafeInteger(para)&&para>=0&&para<=200000,'موقع الفقرة غير صالح')
   const flags=Array.isArray(it.review_flags)?it.review_flags.map(v=>String(v).slice(0,140)).slice(0,5):[]
   return {id,di,dn,title,page,para,section:String(it.section||'').slice(0,500),age:String(it.age_label||'').slice(0,140),flags,num:String(it.source_number||'').slice(0,50)}
  })
  // Idempotent imports; reviewed items cannot be overwritten by uploading the source again.
  await db.batch(prepared.map(it=>db.prepare(`INSERT INTO assessment_global_library_items(program_id,goal_id,domain_id,domain_name,title,source_file,source_page,source_paragraph,source_section,age_label,review_flags,source_number,review_status,reviewed_by,reviewed_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,CASE WHEN ?='approved' THEN CURRENT_TIMESTAMP ELSE NULL END)
     ON CONFLICT(program_id,goal_id) DO UPDATE SET
       review_status=CASE WHEN excluded.review_status='approved' THEN 'approved' ELSE assessment_global_library_items.review_status END,
       reviewed_by=CASE WHEN excluded.review_status='approved' THEN excluded.reviewed_by ELSE assessment_global_library_items.reviewed_by END,
       reviewed_at=CASE WHEN excluded.review_status='approved' THEN CURRENT_TIMESTAMP ELSE assessment_global_library_items.reviewed_at END`).bind(b.program_id,it.id,it.di,it.dn,it.title,sf,it.page,it.para,it.section,it.age,JSON.stringify(it.flags),it.num,autoPublish?'approved':'pending',autoPublish?user.id:null,autoPublish?'approved':'pending')))
  return json({ok:true,received:prepared.length,published:autoPublish,program_id:b.program_id})
 }
 if(path===base+'/publish'&&method==='POST'){
  const b=await parse(req)
  must(b.usage_rights_confirmed===true&&b.source_quality_acknowledged===true,'تفعيل البرامج يتطلب تأكيد امتلاك حق استخدامها وإدراك أن بعض النصوص تحتاج تصحيحًا')
  const programId=String(b.program_id||'all')
  must(programId==='all'||UPLOADED_PROGRAMS.has(programId),'البرنامج غير مدعوم')
  const filter=programId==='all'?" AND program_id IN ('portage','help','lovaas','vbmapp','abllsr','esdm')":' AND program_id=?'
  const before=await rows(db,`SELECT program_id,COUNT(*) count FROM assessment_global_library_items WHERE review_status='pending'${filter} GROUP BY program_id`,...(programId==='all'?[]:[programId]))
  const result=await exec(db,`UPDATE assessment_global_library_items SET review_status='approved',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE review_status='pending'${filter}`,user.id,...(programId==='all'?[]:[programId]))
  await exec(db,'INSERT INTO audit_logs(id,center_id,actor_id,action,target_type,target_id) VALUES(?,?,?,?,?,?)',uuid(),null,user.id,'publish_uploaded_assessment_catalog','assessment_program',programId)
  return json({ok:true,published:result?.meta?.changes||0,programs:before})
 }
 if(path===base+'/edit'&&method==='PATCH'){
  const b=await parse(req)
  const programId=String(b.program_id||''),goalId=String(b.goal_id||'')
  must(UPLOADED_PROGRAMS.has(programId)&&/^[a-zA-Z0-9_-]{3,100}$/.test(goalId),'البرنامج أو الهدف غير صالح')
  const existing=await one(db,'SELECT title,domain_id,domain_name,review_status FROM assessment_global_library_items WHERE program_id=? AND goal_id=?',programId,goalId)
  must(existing,'الهدف غير موجود',404)
  const title=String(b.title||'').trim(),domainName=String(b.domain_name||'').trim()
  must(title.length>=3&&title.length<=1800,'نص الهدف يجب أن يكون من 3 إلى 1800 حرف')
  must(domainName.length>=2&&domainName.length<=260,'اسم المجال غير صالح')
  const domainId=domainName===existing.domain_name?existing.domain_id:'custom-'+[...domainName].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,2166136261).toString(16)
  if(title===existing.title&&domainName===existing.domain_name)return json({ok:true,unchanged:true})
  await exec(db,`UPDATE assessment_global_library_items SET title=?,domain_id=?,domain_name=?,updated_at=CURRENT_TIMESTAMP
     WHERE program_id=? AND goal_id=?`,title,domainId,domainName,programId,goalId)
  await exec(db,`INSERT INTO assessment_library_changes(id,program_id,goal_id,actor_id,actor_name,old_title,new_title,old_domain,new_domain)
     VALUES(?,?,?,?,?,?,?,?,?)`,uuid(),programId,goalId,user.id,user.name,existing.title,title,existing.domain_name,domainName)
  await exec(db,'INSERT INTO audit_logs(id,center_id,actor_id,action,target_type,target_id) VALUES(?,?,?,?,?,?)',uuid(),null,user.id,'edit_platform_assessment_goal','assessment_goal',goalId)
  return json({ok:true,updated_by:user.name})
 }
 if(path===base+'/edits'&&method==='GET'){
  const programId=String(url.searchParams.get('program_id')||''),goalId=String(url.searchParams.get('goal_id')||'')
  must(UPLOADED_PROGRAMS.has(programId)&&/^[a-zA-Z0-9_-]{3,100}$/.test(goalId),'البرنامج أو الهدف غير صالح')
  const history=await rows(db,'SELECT actor_name,old_title,new_title,old_domain,new_domain,changed_at FROM assessment_library_changes WHERE program_id=? AND goal_id=? ORDER BY changed_at DESC LIMIT 30',programId,goalId)
  return json({history})
 }
 if(path===base+'/review'&&method==='PATCH'){
  const b=await parse(req)
  must(UPLOADED_PROGRAMS.has(String(b.program_id||'')),'البرنامج غير متاح')
  const id=String(b.goal_id||'')
  must(/^[a-zA-Z0-9_-]{3,100}$/.test(id),'معرف البند غير صالح')
  const existing=await one(db,'SELECT goal_id,domain_id,domain_name,review_flags FROM assessment_global_library_items WHERE program_id=? AND goal_id=?',b.program_id,id)
  must(existing,'البند غير موجود',404)
  const title=String(b.title||'').trim()
  const domainName=String(b.domain_name||existing.domain_name).trim()
  const domainId=String(b.domain_id||existing.domain_id)
  must(domainName.length>=2&&domainName.length<=260,'اسم المجال غير صالح')
  must(/^[a-zA-Z0-9_-]{3,100}$/.test(domainId),'معرّف المجال غير صالح')
  must(title.length>=3&&title.length<=1800,'نص المهارة من 3 إلى 1800 حرف')
  must(b.approved===false||b.approved===true,'حدد حالة المراجعة')
  must(!b.approved||b.usage_rights_confirmed===true,'اعتماد البنود يحتاج تأكيد الحق في إتاحتها لجميع المراكز')
  if(b.approved){const flags=JSON.parse(existing.review_flags||'[]');must(!flags.length||b.human_verified===true,'يلزم تدقيق نص هذا البند المشكوك فيه والرجوع إلى المستند',409)}
  await exec(db,`UPDATE assessment_global_library_items SET title=?,domain_id=?,domain_name=?,review_status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE program_id=? AND goal_id=?`,title,domainId,domainName,b.approved?'approved':'pending',user.id,b.program_id,id)
  await exec(db,'INSERT INTO audit_logs(id,center_id,actor_id,action,target_type,target_id) VALUES(?,?,?,?,?,?)',uuid(),null,user.id,b.approved?'approve_library_goal':'review_library_goal','assessment_goal',id)
  return json({ok:true})
 }
 if(path===base+'/review/bulk'&&method==='POST'){
  must(user.role==='superadmin','الاعتماد الجماعي لمدير المنصة فقط',403)
  const b=await parse(req)
  must(UPLOADED_PROGRAMS.has(String(b.program_id||'')),'البرنامج غير متاح')
  must(b.usage_rights_confirmed===true&&b.checked_against_source===true,'يلزم تأكيد مراجعة المصدر وحق إتاحة البنود لجميع المراكز',400)
  const ids=Array.isArray(b.goal_ids)?[...new Set(b.goal_ids.map(String))]:[]
  must(ids.length>=1&&ids.length<=100,'اختر من 1 إلى 100 بند في الدفعة')
  const items=await rows(db,`SELECT goal_id,review_flags FROM assessment_global_library_items WHERE program_id=? AND goal_id IN (${ids.map(()=>'?').join(',')})`,b.program_id,...ids)
  must(items.length===ids.length,'بعض البنود غير موجودة في مكتبة المنصة',404)
  must(items.every(it=>JSON.parse(it.review_flags||'[]').length===0),'تحتوي الدفعة على بنود تحتاج تصحيحًا فرديًا أولًا',409)
  await db.batch(ids.map(id=>db.prepare(`UPDATE assessment_global_library_items SET review_status='approved',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE program_id=? AND goal_id=?`).bind(user.id,b.program_id,id)))
  await exec(db,'INSERT INTO audit_logs(id,center_id,actor_id,action,target_type,target_id) VALUES(?,?,?,?,?,?)',uuid(),null,user.id,'approve_library_batch','assessment_program',b.program_id)
  return json({ok:true,approved:ids.length})
 }
 return json({error:'مسار مكتبة البنود غير موجود'},404)
}
export async function assessmentRoute(req,env,user,path,method){
 const db=env.DB
 await ensureAssessmentSchema(db,env.TURSO_URL||env.DB)
 if(path==='/api/assessments/access'&&method==='GET'){
  if(user.role==='superadmin')return json({enabled:true,can_manage_library:true,can_manage:false,can_evaluate:false,can_download:false,can_delegate:false})
  await canUse(db,user)
  const can_evaluate=await canEvaluate(db,user)
  return json({enabled:true,can_manage:isManager(user),can_evaluate,can_download:true,can_delegate:isManager(user)})
 }
 if(path==='/api/assessments/settings'&&method==='GET'){
  must(isManager(user),'إدارة صلاحيات التقييم للمدير والمشرف فقط',403)
  const specialists=await rows(db,`SELECT u.id,u.name,u.email,u.active,
    COALESCE(p.can_evaluate,0) can_evaluate, p.changed_by,p.updated_at
    FROM users u LEFT JOIN assessment_specialist_permissions p
    ON p.center_id=u.center_id AND p.specialist_id=u.id
    WHERE u.center_id=? AND u.role='specialist' AND u.active=1 ORDER BY u.name,u.id`,user.center_id)
  return json({specialists:specialists.map(x=>({...x,can_evaluate:Boolean(x.can_evaluate)}))})
 }
 if(path==='/api/assessments/settings'&&method==='PATCH'){
  must(isManager(user),'المدير أو المشرف فقط يمكنهما اختيار الأخصائيين المخولين بالتقييم',403)
  const b=await parse(req)
  must(typeof b.specialist_id==='string'&&b.specialist_id.length<160&&typeof b.can_evaluate==='boolean','حدد الأخصائي والصلاحية')
  const specialist=await one(db,`SELECT id,name FROM users WHERE id=? AND center_id=? AND role='specialist' AND active=1`,b.specialist_id,user.center_id)
  must(specialist,'الأخصائي غير موجود أو ليس نشطًا في مركزك',404)
  await exec(db,`INSERT INTO assessment_specialist_permissions(center_id,specialist_id,can_evaluate,changed_by)
    VALUES(?,?,?,?) ON CONFLICT(center_id,specialist_id) DO UPDATE SET
    can_evaluate=excluded.can_evaluate,changed_by=excluded.changed_by,updated_at=CURRENT_TIMESTAMP`,user.center_id,specialist.id,b.can_evaluate?1:0,user.id)
  await exec(db,'INSERT INTO audit_logs(id,center_id,actor_id,action,target_type,target_id) VALUES(?,?,?,?,?,?)',uuid(),user.center_id,user.id,b.can_evaluate?'allow_specialist_assessment':'revoke_specialist_assessment','user',specialist.id)
  return json({ok:true,specialist_id:specialist.id,can_evaluate:b.can_evaluate})
 }
 if(path.startsWith('/api/assessments/library'))return handleLibrary(req,db,user,path,method)
 if(user.role!=='superadmin')await canUse(db,user)
 else must(path==='/api/assessments/catalog'&&method==='GET','حساب مدير المنصة لا يصل إلى بيانات الأطفال',403)
 if(path==='/api/assessments/catalog'&&method==='GET'){
  const counts=await rows(db,`SELECT program_id,review_status,COUNT(*) total,SUM(CASE WHEN review_flags<>'[]' THEN 1 ELSE 0 END) flagged FROM assessment_global_library_items WHERE program_id IN (${ACTIVE_PLACEHOLDERS}) GROUP BY program_id,review_status`,...WORD_INVENTORY_PROGRAMS)
  return json({version:CATALOG_VERSION,programs:PROGRAMS.map(p=>({...p,sourceProfile:sourceProfileFor(p.id)})),approved_by_program:counts,notice:'البرامج الستة متاحة من مستندات Word المرفوعة. تفعيل البنود لا يعني مراجعتها علميًا أو إتاحة درجات معيارية رسمية؛ راجع جودة النص وحقوق النشر قبل الاستخدام.'})
 }
 if(path==='/api/assessments'&&method==='GET'){
  const childId=new URL(req.url).searchParams.get('child_id')
  if(childId)await accessibleChild(db,user,childId)
  const args=[user.center_id]
  let filter='a.center_id=?'
  if(user.role==='specialist'){
   filter+=` AND EXISTS(SELECT 1 FROM assignments x WHERE x.center_id=a.center_id AND x.child_id=a.child_id AND x.specialist_id=?)`
   args.push(user.id)
   if(await canEvaluate(db,user)){
    filter+=` AND (a.status='approved' OR (a.created_by=? AND a.status IN ('draft','completed')))`
    args.push(user.id)
   }else filter+=` AND a.status='approved'`
  }
  // Previous sample evaluations remain in the database as history, but no longer clutter the live list.
  filter+=` AND a.program_id IN (${ACTIVE_PLACEHOLDERS})`;args.push(...WORD_INVENTORY_PROGRAMS)
  if(childId){filter+=' AND a.child_id=?';args.push(childId)}
  const items=await rows(db,`SELECT a.id,a.child_id,a.program_id,a.status,a.created_at,a.updated_at,a.finalized_at,a.approved_at,a.created_by,c.name child_name,u.name assessor_name
    FROM assessment_records a JOIN children c ON c.id=a.child_id JOIN users u ON u.id=a.created_by WHERE ${filter} ORDER BY a.created_at DESC LIMIT 350`,...args)
  return json({items:items.map(x=>({...x,program_name:programById(x.program_id)?.name||x.program_id}))})
 }
 if(path==='/api/assessments'&&method==='POST'){
  await requireEvaluator(db,user)
  const b=await parse(req)
  const child=await accessibleChild(db,user,String(b.child_id||''))
  must(child.active,'ملف الطفل غير نشط',403)
  const p=programById(String(b.program_id||''));must(p&&UPLOADED_PROGRAMS.has(p.id),'هذا التقييم القديم متوقف، اختر أحد البرامج الستة المتاحة',409)
  const id=uuid()
  const imported=await approvedGlobalDomains(db,p.id)
  must(imported.length>0,'البرنامج لم يعتمد مدير المنصة بنوده بعد. يرجى التواصل مع إدارة تأهيل +',409)
  const snapshot=imported.length?imported:null
  await exec(db,`INSERT INTO assessment_records(id,center_id,child_id,program_id,catalog_version,created_by) VALUES(?,?,?,?,?,?)`,id,user.center_id,child.id,p.id,snapshot?'platform-uploaded-v2':CATALOG_VERSION,user.id)
  if(snapshot)await exec(db,'INSERT INTO assessment_catalog_snapshots(assessment_id,domains_json) VALUES(?,?)',id,JSON.stringify(snapshot))
  await exec(db,'INSERT INTO audit_logs(id,center_id,actor_id,action,target_type,target_id) VALUES(?,?,?,?,?,?)',uuid(),user.center_id,user.id,'create_assessment','assessment',id)
  return json({ok:true,id},201)
 }
 const matched=path.match(/^\/api\/assessments\/([^/]+)(?:\/(answer|finalize|approve|docx|pdf|plan|history))?$/)
 if(!matched)return json({error:'مسار التقييم غير موجود'},404)
 const {a,child}=await recordFor(db,user,matched[1]);const cmd=matched[2]||''
 if(!cmd&&method==='GET'){
  await requireEvaluator(db,user)
  const [answers,history]=await Promise.all([rows(db,`SELECT goal_id,rating,note,updated_at FROM assessment_answers WHERE assessment_id=?`,a.id),rows(db,'SELECT actor_name,action,goal_id,created_at FROM assessment_edit_history WHERE assessment_id=? ORDER BY created_at DESC,rowid DESC LIMIT 80',a.id)])
  return json({history,assessment:viewRecord(a),child,answers,program:programForSavedRecord(a.program_id),domains:await domainsForRecord(db,a),version:a.catalog_version})
 }
 if(cmd==='answer'&&method==='PATCH'){
  await requireEvaluator(db,user)
  must(a.status==='draft','التقييم مكتمل ولا يقبل التعديل؛ ابدأ تقييمًا جديدًا',409)
  must(a.created_by===user.id||isManager(user),'لا يمكنك تعديل تقييم مستخدم آخر',403)
  const assignedDomains=await domainsForRecord(db,a)
  const b=await parse(req)
  const goalId=String(b.goal_id||'');must(assignedDomains.some(d=>d.goals.some(g=>g.id===goalId)),'الهدف غير موجود في نسخة التقييم')
  must(['mastered','assisted','not_mastered','not_tested','not_applicable'].includes(b.rating),'حالة المهارة غير صالحة')
  const note=String(b.note||'').trim();must(note.length<=450,'الملاحظة طويلة جدًا')
  await exec(db,`INSERT INTO assessment_answers(assessment_id,goal_id,rating,note) VALUES(?,?,?,?)
    ON CONFLICT(assessment_id,goal_id) DO UPDATE SET rating=excluded.rating,note=excluded.note,updated_at=CURRENT_TIMESTAMP`,a.id,goalId,b.rating,note)
  await exec(db,'UPDATE assessment_records SET updated_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=?',a.id)
  await exec(db,'INSERT INTO assessment_edit_history(id,assessment_id,center_id,actor_id,actor_name,action,goal_id,details_json) VALUES(?,?,?,?,?,?,?,?)',uuid(),a.id,user.center_id,user.id,user.name,'تحديث تقييم مهارة',goalId,JSON.stringify({rating:b.rating,note}))
  return json({ok:true,goal_id:goalId,rating:b.rating})
 }
 if(cmd==='finalize'&&method==='POST'){
  await requireEvaluator(db,user)
  must(a.status==='draft','هذا التقييم مكتمل بالفعل',409)
  must(a.created_by===user.id||isManager(user),'لا يمكنك إنهاء تقييم مستخدم آخر',403)
  const assignedDomains=await domainsForRecord(db,a)
  const answers=await rows(db,'SELECT goal_id,rating,note FROM assessment_answers WHERE assessment_id=?',a.id)
  const total=assignedDomains.reduce((sum,x)=>sum+x.goals.length,0)
  must(answers.length===total,`لا يزال هناك ${total-answers.length} هدفًا دون تقييم. أكملها أو اختر لم يتم التقييم.`,409)
  const plan=makePlan(a,answers,assignedDomains)
  await exec(db,'INSERT INTO assessment_edit_history(id,assessment_id,center_id,actor_id,actor_name,action,details_json) VALUES(?,?,?,?,?,?,?)',uuid(),a.id,user.center_id,user.id,user.name,'إنشاء مسودة الخطة',JSON.stringify({goals:plan.not_mastered+plan.assisted}))
  await exec(db,`UPDATE assessment_records SET status='completed',plan_json=?,finalized_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=? AND status='draft'`,JSON.stringify(plan),a.id)
  await exec(db,'INSERT INTO audit_logs(id,center_id,actor_id,action,target_type,target_id) VALUES(?,?,?,?,?,?)',uuid(),user.center_id,user.id,'finalize_assessment','assessment',a.id)
  return json({ok:true,plan})
 }
 if(cmd==='history'&&method==='GET'){
  await requireEvaluator(db,user)
  const history=await rows(db,'SELECT actor_name,action,goal_id,created_at FROM assessment_edit_history WHERE assessment_id=? ORDER BY created_at DESC,rowid DESC LIMIT 200',a.id)
  return json({history})
 }
 if(cmd==='plan'&&method==='PATCH'){
  must(isManager(user),'تعديل الخطة بعد التقييم للمشرف أو المدير فقط',403)
  must(a.status==='completed','الخطة المعتمدة لا تعدل؛ أنشئ تقييمًا جديدًا أو راجع الإدارة',409)
  const b=await parse(req)
  const goalId=String(b.goal_id||'')
  const changes=b.fields
  must(changes&&typeof changes==='object'&&!Array.isArray(changes),'حقول الهدف غير صحيحة')
  must(Object.keys(changes).length>0&&Object.keys(changes).every(k=>editablePlanFields.includes(k)),'حقول غير مدعومة')
  const plan=JSON.parse(a.plan_json||'null')
  must(plan,'الخطة غير موجودة',404)
  const goal=plan.domains.flatMap(d=>d.goals).find(g=>g.id===goalId)
  must(goal,'الهدف غير موجود في الخطة',404)
  const before={}
  for(const [k,v] of Object.entries(changes)){
   must(typeof v==='string'&&v.length<=950,'محتوى الحقل غير صحيح')
   if(k==='priority')must(['عالية','متوسطة','منخفضة'].includes(v),'الأولوية غير صالحة')
   if(k==='review_date'&&v)must(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v)),'تاريخ المراجعة غير صالح')
   before[k]=goal[k]||'';goal[k]=v.trim()
  }
  const result=await exec(db,`UPDATE assessment_records SET plan_json=?,updated_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=? AND center_id=? AND status='completed' AND revision=?`,JSON.stringify(plan),a.id,user.center_id,a.revision)
  must(result?.meta?.changes===1,'تم تعديل الخطة في جلسة أخرى، أعد فتحها قبل الحفظ',409)
  await exec(db,'INSERT INTO assessment_edit_history(id,assessment_id,center_id,actor_id,actor_name,action,goal_id,details_json) VALUES(?,?,?,?,?,?,?,?)',uuid(),a.id,user.center_id,user.id,user.name,'تعديل هدف الخطة',goalId,JSON.stringify({before,after:changes}))
  return json({ok:true,plan})
 }
 if(cmd==='approve'&&method==='POST'){
  must(isManager(user),'اعتماد الخطة للمشرف أو المدير فقط',403)
  must(a.status==='completed','يجب إنهاء التقييم قبل اعتماد الخطة',409)
  const plan=JSON.parse(a.plan_json||'null')
  const objectives=(plan?.domains||[]).flatMap(d=>d.goals)
  must(objectives.every(g=>g.objective?.trim()&&g.baseline?.trim()&&g.mastery?.trim()&&g.method?.trim()&&g.review_date?.trim()),'راجع الأهداف وحدد خط الأساس والهدف القابل للقياس ومعيار الإتقان وطريقة القياس وتاريخ المراجعة لكل هدف قبل الاعتماد',409)
  await exec(db,`UPDATE assessment_records SET status='approved',approved_by=?,approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=? AND center_id=? AND status='completed'`,user.id,a.id,user.center_id)
  await exec(db,'INSERT INTO assessment_edit_history(id,assessment_id,center_id,actor_id,actor_name,action) VALUES(?,?,?,?,?,?)',uuid(),a.id,user.center_id,user.id,user.name,'اعتماد الخطة')
  await exec(db,'INSERT INTO audit_logs(id,center_id,actor_id,action,target_type,target_id) VALUES(?,?,?,?,?,?)',uuid(),user.center_id,user.id,'approve_assessment','assessment',a.id)
  return json({ok:true})
 }
 if((cmd==='docx'||cmd==='pdf')&&method==='GET'){
  must(user.role==='specialist'?a.status==='approved':a.status==='completed'||a.status==='approved',
    'الخطة متاحة للتنزيل بعد اعتمادها من المدير أو المشرف',409)
  const [assessor,center,lastEditor,reviewer]=await Promise.all([
   one(db,'SELECT name FROM users WHERE id=? AND center_id=?',a.created_by,user.center_id),
   one(db,'SELECT name FROM centers WHERE id=?',user.center_id),
   one(db,'SELECT actor_name,created_at FROM assessment_edit_history WHERE assessment_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1',a.id),
   a.approved_by?one(db,'SELECT name FROM users WHERE id=? AND center_id=?',a.approved_by,user.center_id):Promise.resolve(null)
  ])
  const meta={child,center,program:programForSavedRecord(a.program_id),assessor,assessment:a,lastEditor,reviewer}
  if(cmd==='pdf'){
   // Browser-native Print > Save as PDF preserves Arabic glyph shaping without a paid PDF service.
   // This endpoint serves a print-ready HTML view, not a binary application/pdf response.
   const html=createAssessmentPrintHtml(JSON.parse(a.plan_json),meta)
   return new Response(html,{status:200,headers:{
    'content-type':'text/html; charset=utf-8','cache-control':'private, no-store',
    'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
    'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-taheel-print-v1'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
   }})
  }
  const bytes=createAssessmentDocx(JSON.parse(a.plan_json),meta)
  return new Response(bytes,{status:200,headers:{'content-type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','content-disposition':`attachment; filename="assessment-${a.id}.docx"`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}})
 }
 return json({error:'هذه العملية غير مدعومة'},405)
}
