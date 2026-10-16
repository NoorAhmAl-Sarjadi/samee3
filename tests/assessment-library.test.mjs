import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import worker from '../src/worker.js'
import {sha256} from '../src/security.js'
function memoryDb(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'))
 return {prepare(sql){return {bind(...args){const st=sqlite.prepare(sql);return {async first(){return st.get(...args)||null},async all(){return {results:st.all(...args)}},async run(){return {meta:{changes:st.run(...args).changes}}}}}}},async batch(items){sqlite.exec('BEGIN');try{const output=[];for(const item of items)output.push(await item.run());sqlite.exec('COMMIT');return output}catch(e){sqlite.exec('ROLLBACK');throw e}}}
}
function caller(db,token){return async(path,method='GET',data)=>{const headers={origin:'https://taheel.test',cookie:'taheel_session='+token};let body;if(data!==undefined){headers['content-type']='application/json';body=JSON.stringify(data)}const res=await worker.fetch(new Request('https://taheel.test/api'+path,{method,headers,body}),{DB:db,AUTH_PEPPER:'ef'.repeat(32)});return (res.headers.get('content-type')||'').includes('application/json')?{status:res.status,...await res.json()}:{status:res.status,bytes:new Uint8Array(await res.arrayBuffer())}}}
async function seed(db,center,role){const id=randomUUID(),token=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');await db.prepare('INSERT INTO users(id,center_id,email,name,password_hash,password_salt,role,must_change_password) VALUES(?,?,?,?,?,?,?,0)').bind(id,center,`${id}@example.test`,role,'hash','a'.repeat(32),role).run();await db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha256(token),id,Date.now()+3600000).run();return {id,call:caller(db,token)}}
test('PDF source library requires internal review and freezes goals per assessment',async()=>{
 const db=memoryDb(),center=randomUUID(),otherCenter=randomUUID();for(const id of [center,otherCenter])await db.prepare('INSERT INTO centers(id,name,email) VALUES(?,?,?)').bind(id,'مركز تجريبي',`${id}@example.test`).run()
 const mgr=await seed(db,center,'center_admin'),spec=await seed(db,center,'specialist'),other=await seed(db,otherCenter,'center_admin'),platform=await seed(db,null,'superadmin')
 const child=randomUUID();await db.prepare('INSERT INTO children(id,center_id,code,name,created_by) VALUES(?,?,?,?,?)').bind(child,center,'1','طفل',mgr.id).run()
 const items=[{id:'portage-001',domain_id:'portage-1',domain_name:'التقليد',title:'تقليد التصفيق باليدين',source_page:2,source_number:'1'}, {id:'portage-002',domain_id:'portage-1',domain_name:'التقليد',title:'تقليد الحركات الكبرى بتوجيه',source_page:2,source_number:'2'}]
 let r=await spec.call('/assessments/library?program_id=portage');assert.equal(r.status,403)
 r=await platform.call('/assessments/library/import','POST',{program_id:'portage',source_file:'بورتاج.pdf',items});assert.equal(r.status,200)
 r=await platform.call('/assessments/library?program_id=portage');assert.equal(r.items.length,2);assert.equal(r.items[0].review_status,'pending')
 r=await other.call('/assessments/library?program_id=portage');assert.equal(r.status,403)
 r=await platform.call('/assessments/library/review','PATCH',{program_id:'portage',goal_id:'portage-001',title:'تقليد التصفيق باليدين بصورة مستقلة',approved:true});assert.equal(r.status,400)
 r=await platform.call('/assessments/library/review','PATCH',{program_id:'portage',goal_id:'portage-001',title:'تقليد التصفيق باليدين بصورة مستقلة',approved:true,usage_rights_confirmed:true});assert.equal(r.status,200)
 r=await mgr.call('/assessments/catalog');assert.equal(r.approved_by_program.find(x=>x.program_id==='portage').total,1)
 r=await mgr.call('/assessments','POST',{child_id:child,program_id:'portage'});assert.equal(r.status,201);const aId=r.id
 r=await mgr.call('/assessments/'+aId);assert.equal(r.assessment.catalog_version,'platform-uploaded-v2');assert.equal(r.domains.length,1);assert.equal(r.domains[0].goals.length,1);assert.equal(r.domains[0].goals[0].title,'تقليد التصفيق باليدين بصورة مستقلة');assert.equal(r.domains[0].goals[0].sourcePage,2)
 await platform.call('/assessments/library/review','PATCH',{program_id:'portage',goal_id:'portage-001',title:'نص تم تغييره بعد بدء التقييم',approved:false})
 r=await mgr.call('/assessments/'+aId);assert.equal(r.domains[0].goals[0].title,'تقليد التصفيق باليدين بصورة مستقلة')
 r=await mgr.call('/assessments/'+aId+'/answer','PATCH',{goal_id:'portage-001',rating:'not_mastered'});assert.equal(r.status,200)
 r=await mgr.call('/assessments/'+aId+'/finalize','POST');assert.equal(r.status,200);assert.equal(r.plan.domains[0].goals[0].sourcePage,2)
 r=await mgr.call('/assessments/'+aId+'/docx');assert.equal(r.status,200)
})
