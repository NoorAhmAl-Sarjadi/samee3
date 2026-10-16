import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import worker from '../src/worker.js'
import {sha256} from '../src/security.js'
import {WORD_INVENTORY_PROGRAMS} from '../src/assessment-catalog.js'

const allowed=['portage','help','lovaas','vbmapp','abllsr','esdm']
const retired=['teacch','carolina']
function dbFactory(){
 const sqlite=new DatabaseSync(':memory:')
 sqlite.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'))
 return {prepare(sql){return {bind(...a){const st=sqlite.prepare(sql);return {first:async()=>st.get(...a)||null,all:async()=>({results:st.all(...a)}),run:async()=>({meta:{changes:st.run(...a).changes}})}}}},async batch(commands){sqlite.exec('BEGIN');try{const result=[];for(const c of commands)result.push(await c.run());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}}
}
async function person(db,center_id,role){
 const id=randomUUID(),token=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','')
 await db.prepare('INSERT INTO users(id,center_id,email,name,password_hash,password_salt,role,must_change_password) VALUES(?,?,?,?,?,?,?,0)').bind(id,center_id,id+'@test.local','اختبار','hash','a'.repeat(32),role).run()
 await db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha256(token),id,Date.now()+3600000).run()
 return {id,call:async(path,method='GET',body)=>{const headers={cookie:'taheel_session='+token,origin:'https://taheel.test'};if(body)headers['content-type']='application/json';const res=await worker.fetch(new Request('https://taheel.test/api'+path,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db,AUTH_PEPPER:'33'.repeat(32)});return {status:res.status,...await res.json()}}}
}
test('only six supported programs, retired sources rejected, historical assessments preserved',async()=>{
 assert.deepEqual([...WORD_INVENTORY_PROGRAMS],allowed)
 const db=dbFactory(),center=randomUUID()
 await db.prepare('INSERT INTO centers(id,name,email) VALUES(?,?,?)').bind(center,'مركز',center+'@local.test').run()
 const root=await person(db,null,'superadmin'),manager=await person(db,center,'center_admin')
 const child=randomUUID(),historic=randomUUID()
 await db.prepare('INSERT INTO children(id,center_id,code,name,created_by) VALUES(?,?,?,?,?)').bind(child,center,'Z1','طفل',manager.id).run()
 // Simulate a previous deployment that had imported both retired programs.
 for(const pid of retired){
  await db.prepare('INSERT INTO assessment_global_library_items(program_id,goal_id,domain_id,domain_name,title,source_file,review_status) VALUES(?,?,?,?,?,?,?)').bind(pid,pid+'-g00001',pid+'-d0001','المجال','هدف قديم','file.docx','approved').run()
  await db.prepare('INSERT INTO assessment_library_items(center_id,program_id,goal_id,domain_id,domain_name,title,source_file,source_page) VALUES(?,?,?,?,?,?,?,?)').bind(center,pid,pid+'-g00001',pid+'-d0001','المجال','هدف قديم','file.docx',1).run()
 }
 await db.prepare('INSERT INTO assessment_records(id,center_id,child_id,program_id,catalog_version,created_by,status) VALUES(?,?,?,?,?,?,?)').bind(historic,center,child,'teacch','old-v1',manager.id,'approved').run()
 await db.prepare('INSERT INTO assessment_catalog_snapshots(assessment_id,domains_json) VALUES(?,?)').bind(historic,JSON.stringify([{id:'old',name:'قديم',goals:[{id:'teacch-g00001',title:'هدف محفوظ'}]}])).run()
 const cat=await manager.call('/assessments/catalog')
 assert.equal(cat.status,200);assert.deepEqual(new Set(cat.programs.map(x=>x.id)),new Set(allowed))
 for(const pid of retired){
  const a=await root.call('/assessments/library?program_id='+pid);assert.equal(a.status,400)
  const b=await root.call('/assessments/library/import','POST',{program_id:pid,source_file:'file.docx',items:[{id:pid+'-g00002',domain_id:pid+'-d0001',domain_name:'مجال',title:'هدف جديد',source_page:1}],publish:true,usage_rights_confirmed:true,source_quality_acknowledged:true});assert.equal(b.status,400)
  const c=await manager.call('/assessments','POST',{child_id:child,program_id:pid});assert.equal(c.status,409)
  const x=await db.prepare('SELECT COUNT(*) AS n FROM assessment_global_library_items WHERE program_id=?').bind(pid).first();assert.equal(x.n,0)
  const y=await db.prepare('SELECT COUNT(*) AS n FROM assessment_library_items WHERE program_id=?').bind(pid).first();assert.equal(y.n,0)
 }
 const saved=await db.prepare('SELECT * FROM assessment_records WHERE id=?').bind(historic).first();assert.equal(saved.program_id,'teacch')
 const snap=await db.prepare('SELECT domains_json FROM assessment_catalog_snapshots WHERE assessment_id=?').bind(historic).first();assert.match(snap.domains_json,/هدف محفوظ/)
})
