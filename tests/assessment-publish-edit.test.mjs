import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import worker from '../src/worker.js'
import {sha256} from '../src/security.js'

const dbFactory=()=>{
 const sqlite=new DatabaseSync(':memory:')
 sqlite.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'))
 return {prepare(sql){return {bind(...args){const st=sqlite.prepare(sql);return {first:async()=>st.get(...args)||null,all:async()=>({results:st.all(...args)}),run:async()=>({meta:{changes:st.run(...args).changes}})}}}},async batch(commands){sqlite.exec('BEGIN');try{const out=[];for(const c of commands)out.push(await c.run());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}}}
}
async function person(db,centerId,role,name){
 const id=randomUUID(),token=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','')
 await db.prepare('INSERT INTO users(id,center_id,email,name,password_hash,password_salt,role,must_change_password) VALUES(?,?,?,?,?,?,?,0)').bind(id,centerId,id+'@taheel.test',name,'hash','a'.repeat(32),role).run()
 await db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha256(token),id,Date.now()+3600000).run()
 const call=async(path,method='GET',body)=>{
  const headers={cookie:'taheel_session='+token,origin:'https://taheel.test'}
  if(body)headers['content-type']='application/json'
  const res=await worker.fetch(new Request('https://taheel.test/api'+path,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db,AUTH_PEPPER:'33'.repeat(32)})
  return {status:res.status,...await res.json()}
 }
 return {id,call}
}
const terms=[
 {id:'help-g00001',domain_id:'help-d001',domain_name:'المعرفي',title:'استجابة الطفل لمثير مألوف',source_paragraph:2,source_page:1,source_number:'1',review_flags:[]},
 {id:'help-g00002',domain_id:'help-d001',domain_name:'المعرفي',title:'الصددوت المتكرر',source_paragraph:3,source_page:1,source_number:'2',review_flags:['مراجعة تكرار حروف']}
]
const confirmRights={usage_rights_confirmed:true,source_quality_acknowledged:true}
test('one-time activation, edit with author history, cross-center shared catalog, historical snapshots',async()=>{
 const db=dbFactory(),centerA=randomUUID(),centerB=randomUUID()
 for(const id of [centerA,centerB])await db.prepare('INSERT INTO centers(id,name,email) VALUES(?,?,?)').bind(id,'مركز',id+'@test.local').run()
 const platform=await person(db,null,'superadmin','المدير العام')
 const manager=await person(db,centerA,'center_admin','مدير المركز')
 const other=await person(db,centerB,'center_admin','مدير مركز آخر')
 const child=randomUUID()
 await db.prepare('INSERT INTO children(id,center_id,code,name,created_by) VALUES(?,?,?,?,?)').bind(child,centerA,'202','طفل',manager.id).run()
 let r=await platform.call('/assessments/library/import','POST',{program_id:'help',source_file:'help.docx',items:terms,publish:true})
 assert.equal(r.status,400)
 r=await platform.call('/assessments/library/import','POST',{program_id:'help',source_file:'help.docx',items:terms,publish:true,...confirmRights})
 assert.equal(r.status,200);assert.equal(r.published,true)
 const managerCatalog=await manager.call('/assessments/catalog')
 assert.equal(managerCatalog.approved_by_program.find(x=>x.program_id==='help').total,2)
 const managerDenied=await manager.call('/assessments/library/edit','PATCH',{program_id:'help',goal_id:terms[0].id,title:'بديل',domain_name:'المعرفي'})
 assert.equal(managerDenied.status,403)
 r=await other.call('/assessments/catalog');assert.equal(r.approved_by_program.find(x=>x.program_id==='help').total,2)
 r=await manager.call('/assessments','POST',{child_id:child,program_id:'help'});assert.equal(r.status,201)
 const oldId=r.id
 r=await manager.call('/assessments/'+oldId);assert.equal(r.domains[0].goals[0].title,terms[0].title)
 r=await platform.call('/assessments/library/edit','PATCH',{program_id:'help',goal_id:terms[0].id,title:'استجابة الطفل لمثير مألوف مستقلًا',domain_name:'المعرفي'})
 assert.equal(r.status,200);assert.equal(r.updated_by,'المدير العام')
 r=await platform.call('/assessments/library/edits?program_id=help&goal_id=help-g00001')
 assert.equal(r.status,200);assert.equal(r.history[0].actor_name,'المدير العام')
 r=await platform.call('/assessments/library?program_id=help&q='+encodeURIComponent('مستقلًا'))
 assert.equal(r.status,200);assert.equal(r.items.length,1);assert.equal(r.items[0].goal_id,terms[0].id)
 r=await manager.call('/assessments/'+oldId);assert.equal(r.domains[0].goals[0].title,terms[0].title)
 r=await manager.call('/assessments','POST',{child_id:child,program_id:'help'});assert.equal(r.status,201)
 r=await manager.call('/assessments/'+r.id);assert.equal(r.domains[0].goals[0].title,'استجابة الطفل لمثير مألوف مستقلًا')
 assert.equal(r.domains[0].goals[1].reviewFlags.length,1)
})
test('already imported pending library is activated all at once, with source warning retained',async()=>{
 const db=dbFactory(),platform=await person(db,null,'superadmin','مدير المنصة')
 let r=await platform.call('/assessments/library/import','POST',{program_id:'help',source_file:'help.docx',items:terms})
 assert.equal(r.status,200)
 r=await platform.call('/assessments/library/publish','POST',{program_id:'all'})
 assert.equal(r.status,400)
 r=await platform.call('/assessments/library/publish','POST',{program_id:'all',...confirmRights})
 assert.equal(r.status,200);assert.equal(r.published,2)
 r=await platform.call('/assessments/library?program_id=help')
 assert.equal(r.items[0].review_status,'approved');assert.equal(JSON.parse(r.items[1].review_flags).length,1)
 r=await platform.call('/assessments/library/publish','POST',{program_id:'all',...confirmRights})
 assert.equal(r.published,0)
})
