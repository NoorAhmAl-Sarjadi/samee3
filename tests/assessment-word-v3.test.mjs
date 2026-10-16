import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import worker from '../src/worker.js'
import {sha256} from '../src/security.js'
function dbFactory(){
 const sql=new DatabaseSync(':memory:')
 sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'))
 return {prepare(statement){return{bind(...args){const s=sql.prepare(statement);return{async first(){return s.get(...args)||null},async all(){return{results:s.all(...args)}},async run(){return{meta:{changes:s.run(...args).changes}}}}}}},async batch(commands){sql.exec('BEGIN');try{const results=[];for(const command of commands)results.push(await command.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}}
}
async function person(db,center,role,name){const id=randomUUID(),token=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');await db.prepare('INSERT INTO users(id,center_id,email,name,password_hash,password_salt,role,must_change_password) VALUES(?,?,?,?,?,?,?,0)').bind(id,center,`${id}@taheel.test`,name,'hash','a'.repeat(32),role).run();await db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha256(token),id,Date.now()+3_600_000).run();const call=async(path,method='GET',data)=>{const h={origin:'https://taheel.test',cookie:'taheel_session='+token};if(data)h['content-type']='application/json';const response=await worker.fetch(new Request('https://taheel.test/api'+path,{method,headers:h,body:data?JSON.stringify(data):undefined}),{DB:db,AUTH_PEPPER:'ea'.repeat(32)});if((response.headers.get('content-type')||'').includes('json'))return{status:response.status,...await response.json()};return{status:response.status,data:new Uint8Array(await response.arrayBuffer())}};return{id,call}}
test('Word catalogs: centrally managed and shared after review without fallback',async()=>{
 const db=dbFactory(),center=randomUUID(),externalCenter=randomUUID();for(const id of [center,externalCenter])await db.prepare('INSERT INTO centers(id,name,email) VALUES(?,?,?)').bind(id,'مركز اختبار',id+'@test.local').run()
 const admin=await person(db,center,'center_admin','مديرة المركز'),specialist=await person(db,center,'specialist','الأخصائية سمر'),outsider=await person(db,externalCenter,'center_admin','مدير آخر'),platform=await person(db,null,'superadmin','مدير المنصة')
 const child=randomUUID();await db.prepare('INSERT INTO children(id,center_id,code,name,created_by) VALUES(?,?,?,?,?)').bind(child,center,'T-23','طفل اختبار',admin.id).run()
 let r=await admin.call('/assessments','POST',{child_id:child,program_id:'abllsr'});assert.equal(r.status,409)
 r=await platform.call('/assessments/library/import','POST',{program_id:'abllsr',source_file:'ABLLS.docx',items:[
  {id:'abllsr-g00001',title:'أخذ المعزز حينما يعرض عليه',domain_id:'abllsr-d001',domain_name:'المجال A: التعاون',source_paragraph:4,source_page:0,source_number:'A1',review_flags:[]},
  {id:'abllsr-g00002',title:'المساعدة في استخدام اللعبة عند الحاجة',domain_id:'abllsr-d001',domain_name:'المجال A: التعاون',source_paragraph:5,source_page:0,source_number:'A2',review_flags:['مراجعة المحتوى على المصدر']}
 ]});assert.equal(r.status,200)
 assert.equal(JSON.parse((await platform.call('/assessments/library?program_id=abllsr')).items.find(x=>x.goal_id==='abllsr-g00002').review_flags).length,1)
 r=await outsider.call('/assessments/library?program_id=abllsr');assert.equal(r.status,403)
 r=await platform.call('/assessments/library/review/bulk','POST',{program_id:'abllsr',goal_ids:['abllsr-g00001','abllsr-g00002'],usage_rights_confirmed:true,checked_against_source:true});assert.equal(r.status,409)
 r=await platform.call('/assessments/library/review/bulk','POST',{program_id:'abllsr',goal_ids:['abllsr-g00001'],usage_rights_confirmed:true,checked_against_source:true});assert.equal(r.status,200)
 r=await admin.call('/assessments','POST',{child_id:child,program_id:'abllsr'});assert.equal(r.status,201);const assessmentId=r.id
 r=await admin.call('/assessments/'+assessmentId);assert.equal(r.domains.length,1);assert.equal(r.domains[0].goals.length,1);assert.equal(r.domains[0].goals[0].sourceParagraph,4)
 r=await admin.call(`/assessments/${assessmentId}/answer`,'PATCH',{goal_id:'abllsr-g00001',rating:'not_mastered',note:'يستجيب بمساعدة كلية'});assert.equal(r.status,200)
 r=await admin.call(`/assessments/${assessmentId}/finalize`,'POST');assert.equal(r.status,200)
 r=await admin.call(`/assessments/${assessmentId}/plan`,'PATCH',{goal_id:'abllsr-g00001',fields:{baseline:'0 من 5 محاولات',objective:'أن يؤدي المهارة بصورة مستقلة في 4 من 5 محاولات',mastery:'80% عبر 3 جلسات',method:'تسجيل الفرص والاستجابات',strategy:'تلقين متدرج وتلاشي',priority:'عالية',assigned_specialist:'الأخصائية سمر',review_date:'2026-11-20'}});assert.equal(r.status,200)
 r=await admin.call(`/assessments/${assessmentId}`);assert.ok(r.history.some(h=>h.actor_name==='مديرة المركز'&&h.action==='تعديل هدف الخطة'))
 r=await admin.call(`/assessments/${assessmentId}/approve`,'POST');assert.equal(r.status,200)
 r=await admin.call(`/assessments/${assessmentId}/docx`);assert.equal(r.status,200);assert.equal(String.fromCharCode(...r.data.slice(0,2)),'PK')
 r=await admin.call(`/assessments/${assessmentId}/plan`,'PATCH',{goal_id:'abllsr-g00001',fields:{objective:'معدل'}});assert.equal(r.status,409)
 r=await specialist.call(`/assessments/${assessmentId}`);assert.equal(r.status,403)
})
