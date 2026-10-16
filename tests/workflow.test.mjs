import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import worker from '../src/worker.js'
import {makePassword} from '../src/security.js'

function d1(){
 const sql=new DatabaseSync(':memory:')
 sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'))
 return {
   prepare(text){return {
     bind(...args){const statement=sql.prepare(text);return {
       async first(){return statement.get(...args)||null},
       async all(){return {results:statement.all(...args)}},
       async run(){return {meta:{changes:statement.run(...args).changes}}}
     }}
   }},
   async batch(items){sql.exec('BEGIN');try{const results=[];for(const item of items)results.push(await item.run());sql.exec('COMMIT');return results}catch(err){sql.exec('ROLLBACK');throw err}}
 }
}
function testClient(env){
 const cookies={}
 return async function api(path,method='GET',body,as='main'){
   const headers={origin:'https://taheel.test'}
   if(cookies[as])headers.cookie=cookies[as]
   let payload
   if(body!==undefined){headers['content-type']='application/json';payload=JSON.stringify(body)}
   const res=await worker.fetch(new Request('https://taheel.test/api'+path,{method,headers,body:payload}),env)
   if(res.headers.has('set-cookie'))cookies[as]=res.headers.get('set-cookie').split(';')[0]
   const result=await res.json()
   return {status:res.status,...result}
 }
}
test('Full workflow: global owner / center manager / specialist / isolation / suspension',async()=>{
 const env={DB:d1(),AUTH_PEPPER:'9f'.repeat(32)}
 const hash=await makePassword('SuperSecurePass2026!',env.AUTH_PEPPER)
 await env.DB.prepare(`INSERT INTO users(id,email,name,password_hash,password_salt,role,must_change_password) VALUES(?,?,?,?,?,'superadmin',0)`)
   .bind(randomUUID(),'admin@taheel.test','مالك المنصة',hash.hash,hash.salt).run()
 const call=testClient(env)
 let r=await call('/auth/login','POST',{email:'admin@taheel.test',password:'SuperSecurePass2026!'},'owner')
 assert.equal(r.status,200)
 r=await call('/centers','POST',{name:'حكايات طفل',email:'center1@taheel.test',manager_name:'مدير الأول',phone:'01000000000',password:'CenterSecurePass2026!'},'owner')
 assert.equal(r.status,201)
 const firstCenter=r.id
 r=await call('/centers','POST',{name:'مركز آخر',email:'center2@taheel.test',manager_name:'مدير الثاني',phone:'01010000000',password:'CenterSecurePass2026!'},'owner')
 assert.equal(r.status,201)
 r=await call('/children','GET',undefined,'owner');assert.equal(r.status,403)
 r=await call('/sessions','GET',undefined,'owner');assert.equal(r.status,403)
 r=await call('/auth/login','POST',{email:'center1@taheel.test',password:'CenterSecurePass2026!'},'manager')
 assert.equal(r.status,200);assert.equal(r.user.must_change_password,true)
 r=await call('/staff','GET',undefined,'manager');assert.equal(r.status,403)
 r=await call('/auth/change-password','POST',{current:'CenterSecurePass2026!',next:'CenterNewSecurePass2026!'},'manager');assert.equal(r.status,200)
 r=await call('/staff','POST',{role:'specialist',email:'specialist@taheel.test',name:'محمد',specialty:'أخصائي تخاطب',phone:'01022222222',password:'SpecialistSecurePass2026!'},'manager');assert.equal(r.status,201)
 const specId=r.id
 r=await call('/staff/'+specId,'PATCH',{name:'محمد أحمد',email:'specialist@taheel.test',gender:'male',employee_code:'SP-12',specialty:'أخصائي تخاطب',phone:'01022222222'},'manager');assert.equal(r.status,200)
 r=await call('/staff','GET',undefined,'manager');assert.equal(r.items.find(x=>x.id===specId).employee_code,'SP-12')
 r=await call('/children','POST',{name:'طفل أول',code:'CH-001',diagnosis:'تأخر لغوي',guardian_name:'اسم سري',guardian_phone:'01066666666',iq_score:'90',case_summary:'بيانات طبية سرية'},'manager');assert.equal(r.status,201)
 const childId=r.id
 r=await call('/auth/login','POST',{email:'specialist@taheel.test',password:'SpecialistSecurePass2026!'},'specialist');assert.equal(r.status,200)
 r=await call('/auth/change-password','POST',{current:'SpecialistSecurePass2026!',next:'SpecialistNewPass2026!'},'specialist');assert.equal(r.status,200)
 r=await call('/children','GET',undefined,'specialist');assert.equal(r.items.length,0)
 r=await call('/children/'+childId,'GET',undefined,'specialist');assert.equal(r.status,403)
 r=await call('/children/'+childId+'/assignments','PUT',{specialist_ids:[specId]},'manager');assert.equal(r.status,200)
 r=await call('/children','GET',undefined,'specialist');assert.equal(r.items.length,1);assert.equal(r.items[0].guardian_phone,'')
 r=await call('/children/'+childId,'GET',undefined,'specialist');assert.equal(r.child.guardian_name,'')
 const end=new Date(Date.now()-1000).toISOString(),start=new Date(Date.now()-2701000).toISOString()
 r=await call('/sessions','POST',{child_id:childId,session_number:0,started_at:start,ended_at:end,goals:'اختبار الرقم'},'specialist');assert.equal(r.status,400)
 r=await call('/sessions','POST',{child_id:childId,session_number:26,started_at:start,ended_at:end,goals:'اختبار الرقم'},'specialist');assert.equal(r.status,400)
 r=await call('/sessions','POST',{child_id:childId,session_number:3,started_at:start,ended_at:end,goals:'تنمية التواصل البصري',activities:'صور ومطابقة',notes:'تجاوب جيد'},'specialist');assert.equal(r.status,201)
 const sessionId=r.id
 r=await call('/sessions','GET',undefined,'specialist');assert.equal(r.status,200);assert.equal(r.items.length,1);assert.equal(r.items[0].session_number,3)
 const initial=r.items[0];assert.equal(initial.revision_count,0)
 r=await call('/sessions/'+sessionId,'PATCH',{session_number:4,started_at:start,ended_at:end,goals:'تحسين التواصل البصري',activities:'تدريب مصور',child_response:'متحسن',notes:'مراجعة إضافية',next_plan:'جلسة متابعة',reason:'تصحيح صياغة الأهداف',expected_revision:0},'specialist');assert.equal(r.status,200)
 r=await call('/sessions/'+sessionId+'/history','GET',undefined,'specialist');assert.equal(r.items.length,1);assert.equal(r.items[0].before.goals,'تنمية التواصل البصري');assert.equal(r.items[0].before.session_number,3);assert.equal(r.items[0].after.session_number,4)
 r=await call('/sessions','GET',undefined,'specialist');assert.equal(r.items[0].session_number,4)
 r=await call('/sessions/'+sessionId,'PATCH',{session_number:5,started_at:start,ended_at:end,goals:'تعديل مكرر',reason:'مكرر',expected_revision:0},'specialist');assert.equal(r.status,409)
 r=await call('/sessions/'+sessionId+'/review','PATCH',{status:'needs_review',note:'تحتاج متابعة المشرف'},'manager');assert.equal(r.status,200)
 r=await call('/sessions','GET',undefined,'manager');assert.equal(r.items[0].status,'needs_review')
 r=await call('/children/'+childId+'/internal-notes','POST',{note:'خطة مراجعة خاصة'},'manager');assert.equal(r.status,201)
 r=await call('/children/'+childId,'GET',undefined,'manager');assert.equal(r.internal_notes.length,1)
 r=await call('/children/'+childId,'GET',undefined,'specialist');assert.deepEqual(r.internal_notes,[])
 r=await call('/sessions/'+sessionId+'/review','PATCH',{status:'archived',note:'تقرير ملغى مع بقائه في السجل'},'manager');assert.equal(r.status,200)
 r=await call('/sessions/'+sessionId,'PATCH',{session_number:5,started_at:start,ended_at:end,goals:'تعديل بعد الأرشفة',reason:'اختبار',expected_revision:1},'specialist');assert.equal(r.status,403)
 r=await call('/reports','GET',undefined,'manager');assert.equal(r.items[0].session_count,0)
 r=await call('/sessions/'+sessionId+'/review','PATCH',{status:'completed',note:''},'manager');assert.equal(r.status,200)
 r=await call('/reports','GET',undefined,'manager');assert.equal(r.items[0].session_count,1)
 r=await call('/children/'+childId,'GET',undefined,'manager');assert.equal(r.sessions.length,1);assert.equal(r.sessions[0].session_number,4)
 r=await call('/staff/'+specId,'PATCH',{active:false},'manager');assert.equal(r.status,200)
 r=await call('/auth/me','GET',undefined,'specialist');assert.equal(r.status,401)
 r=await call('/reports','GET',undefined,'manager');assert.equal(r.items[0].session_count,1)
 r=await call('/auth/login','POST',{email:'center2@taheel.test',password:'CenterSecurePass2026!'},'other')
 assert.equal(r.status,200)
 r=await call('/auth/change-password','POST',{current:'CenterSecurePass2026!',next:'CenterTwoPass2026!'},'other');assert.equal(r.status,200)
 r=await call('/children','GET',undefined,'other');assert.equal(r.items.length,0)
 r=await call('/children/'+childId,'GET',undefined,'other');assert.equal(r.status,404)
 r=await call('/sessions/'+sessionId+'/history','GET',undefined,'other');assert.equal(r.status,404)
 r=await call('/sessions/'+sessionId+'/review','PATCH',{status:'archived'},'other');assert.equal(r.status,404)

 r=await call('/centers/'+firstCenter+'/status','PATCH',{active:false},'owner');assert.equal(r.status,200)
 r=await call('/auth/me','GET',undefined,'manager');assert.equal(r.status,401)
})
