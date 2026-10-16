import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import worker from '../src/worker.js'
import {sha256} from '../src/security.js'

function memoryDb(){
 const sqlite=new DatabaseSync(':memory:')
 sqlite.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'))
 return {prepare(sql){return {bind(...args){const stmt=sqlite.prepare(sql);return {async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){return {meta:{changes:stmt.run(...args).changes}}}}}}},async batch(items){sqlite.exec('BEGIN');try{const res=[];for(const item of items)res.push(await item.run());sqlite.exec('COMMIT');return res}catch(e){sqlite.exec('ROLLBACK');throw e}}}
}
function callWith(db,token){return async(path,method='GET',data)=>{const h={origin:'https://taheel.test',cookie:'taheel_session='+token};let body;if(data!==undefined){h['content-type']='application/json';body=JSON.stringify(data)}const res=await worker.fetch(new Request('https://taheel.test/api'+path,{method,headers:h,body}),{DB:db,AUTH_PEPPER:'ef'.repeat(32)});const type=res.headers.get('content-type')||'';return type.includes('application/json')?{status:res.status,...await res.json()}:{status:res.status,res}}}
async function seed(db,centerId,role){
 const userId=randomUUID(),token=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','')
 await db.prepare('INSERT INTO users(id,center_id,email,name,password_hash,password_salt,role,must_change_password) VALUES(?,?,?,?,?,?,?,0)').bind(userId,centerId,`${userId}@example.test`,role,'foo','a'.repeat(32),role).run()
 await db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha256(token),userId,Date.now()+3600000).run()
 return {userId,call:callWith(db,token)}
}

test('Assessments: manager/supervisor delegation, assigned downloads, snapshots and Word/PDF export',async()=>{
 const db=memoryDb(),centerId=randomUUID(),otherCenter=randomUUID()
 for(const id of [centerId,otherCenter])await db.prepare('INSERT INTO centers(id,name,email) VALUES(?,?,?)').bind(id,'مركز تجريبي',`${id}@example.test`).run()
 const mgr=await seed(db,centerId,'center_admin'),spec=await seed(db,centerId,'specialist'),supervisor=await seed(db,centerId,'supervisor'),other=await seed(db,otherCenter,'center_admin')
 const childId=randomUUID()
 await db.prepare('INSERT INTO children(id,center_id,code,name,created_by) VALUES(?,?,?,?,?)').bind(childId,centerId,'CH-TEST','الطفل التجريبي',mgr.userId).run()
 let r=await mgr.call('/assessments/access');assert.equal(r.status,200);assert.equal(r.can_evaluate,true);assert.equal(r.can_delegate,true)
 r=await spec.call('/assessments/catalog');assert.equal(r.status,200)
 r=await spec.call('/assessments/access');assert.equal(r.can_evaluate,false);assert.equal(r.can_download,true)
 r=await other.call('/assessments');assert.equal(r.items.length,0)
 r=await mgr.call('/assessments/catalog');assert.equal(r.status,200);assert.equal(r.programs.length,6);assert.ok(r.domains.length>=10)
 r=await mgr.call('/assessments','POST',{child_id:childId,program_id:'unified'});assert.equal(r.status,409)
 assert.ok(!(await mgr.call('/assessments/catalog')).programs.some(p=>p.id==='unified'))
 // Historic unified assessments stay readable while new ones are disabled.
 const id=randomUUID()
 await db.prepare('INSERT INTO assessment_records(id,center_id,child_id,program_id,catalog_version,created_by) VALUES(?,?,?,?,?,?)').bind(id,centerId,childId,'unified','legacy-original-catalog',mgr.userId).run()
 r=await other.call('/assessments/'+id);assert.equal(r.status,404)
 r=await mgr.call('/assessments/'+id);assert.equal(r.status,200)
 const allGoals=r.domains.flatMap(d=>d.goals)
 assert.ok(allGoals.length>=50)
 r=await mgr.call('/assessments/'+id+'/finalize','POST');assert.equal(r.status,409)
 r=await mgr.call('/assessments/'+id+'/answer','PATCH',{goal_id:'fake-goal',rating:'mastered'});assert.equal(r.status,400)
 await mgr.call('/assessments/'+id+'/answer','PATCH',{goal_id:allGoals[0].id,rating:'not_mastered',note:'يحتاج دعمًا'})
 for(const goal of allGoals.slice(1)){
  r=await mgr.call('/assessments/'+id+'/answer','PATCH',{goal_id:goal.id,rating:'mastered'});assert.equal(r.status,200)
 }
 r=await mgr.call('/assessments/'+id+'/finalize','POST');assert.equal(r.status,200)
 assert.equal(r.plan.not_mastered,1);assert.equal(r.plan.mastered,allGoals.length-1)
 r=await mgr.call('/assessments/'+id+'/answer','PATCH',{goal_id:allGoals[0].id,rating:'mastered'});assert.equal(r.status,409)
 r=await mgr.call('/assessments/'+id+'/docx');assert.equal(r.status,200)
 assert.equal(r.res.headers.get('content-type'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
 const zipped=new Uint8Array(await r.res.arrayBuffer());assert.equal(String.fromCharCode(...zipped.slice(0,2)),'PK');assert.ok(zipped.length>1000)
 r=await supervisor.call('/assessments/'+id+'/approve','POST');assert.equal(r.status,409)
 r=await mgr.call('/assessments/'+id+'/plan','PATCH',{goal_id:allGoals[0].id,fields:{baseline:'1 من 5 فرص بصورة مستقلة',objective:'أن يطابق صورتين متشابهتين في 4 من 5 محاولات مستقلة',mastery:'80% في 3 جلسات متتالية',method:'تسجيل المحاولات الصحيحة خلال الجلسة',strategy:'نمذجة وتلقين متدرج وتعميم',priority:'عالية',review_date:'2026-11-16',assigned_specialist:'أخصائي الطفل'}});assert.equal(r.status,200)
 r=await mgr.call('/assessments/'+id);assert.ok(r.history.find(h=>h.action==='تعديل هدف الخطة'&&h.actor_name==='center_admin'))
 r=await supervisor.call('/assessments/'+id+'/approve','POST');assert.equal(r.status,200)
 r=await mgr.call('/assessments/'+id);assert.equal(r.assessment.status,'approved')
 r=await spec.call('/assessments/'+id);assert.equal(r.status,403)
 r=await mgr.call('/assessments/settings');assert.equal(r.status,200);assert.equal(r.specialists.length,1)
 r=await mgr.call('/assessments/settings','PATCH',{specialist_id:spec.userId,can_evaluate:true});assert.equal(r.status,200)
 r=await spec.call('/assessments/access');assert.equal(r.can_evaluate,true)
 r=await spec.call('/assessments/'+id);assert.equal(r.status,403) // child not assigned
 await db.prepare('INSERT INTO assignments(center_id,child_id,specialist_id,assigned_by) VALUES(?,?,?,?)').bind(centerId,childId,spec.userId,mgr.userId).run()
 r=await spec.call('/assessments/'+id);assert.equal(r.status,200)
 r=await spec.call('/assessments','POST',{child_id:childId,program_id:'pecs'});assert.equal(r.status,409)
 r=await supervisor.call('/assessments/settings','PATCH',{specialist_id:spec.userId,can_evaluate:false});assert.equal(r.status,200)
 r=await spec.call('/assessments/access');assert.equal(r.can_evaluate,false);assert.equal(r.can_download,true)
 r=await spec.call('/assessments/'+id);assert.equal(r.status,403) // download-only specialists cannot inspect details
 r=await spec.call('/assessments');assert.equal(r.status,200);assert.ok(r.items.find(x=>x.id===id))
 r=await spec.call('/assessments/'+id+'/docx');assert.equal(r.status,200)
 r=await spec.call('/assessments/'+id+'/pdf');assert.equal(r.status,200)
 assert.equal(r.res.headers.get('content-type'),'text/html; charset=utf-8')
 assert.match(await r.res.text(),/حفظ \/ طباعة PDF/)
 r=await spec.call('/assessments','POST',{child_id:childId,program_id:'portage'});assert.equal(r.status,403)
 r=await other.call('/assessments/settings','PATCH',{specialist_id:spec.userId,can_evaluate:true});assert.equal(r.status,404)
 r=await other.call('/assessments/'+id+'/approve','POST');assert.equal(r.status,404)
})
