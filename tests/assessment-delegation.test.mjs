import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'
import worker from '../src/worker.js'
import {sha256} from '../src/security.js'

function database(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'))
 return {prepare(sql){return{bind(...args){const statement=db.prepare(sql);return{async run(){return{meta:{changes:statement.run(...args).changes}}},async first(){return statement.get(...args)||null},async all(){return{results:statement.all(...args)}}}}}},async batch(list){db.exec('BEGIN');try{const results=[];for(const item of list)results.push(await item.run());db.exec('COMMIT');return results}catch(err){db.exec('ROLLBACK');throw err}}}
}
async function account(db,center,role){
 const id=randomUUID(),token=(randomUUID()+randomUUID()).replaceAll('-','')
 await db.prepare('INSERT INTO users(id,center_id,email,name,password_hash,password_salt,role,must_change_password) VALUES(?,?,?,?,?,?,?,0)').bind(id,center,`${id}@taheel.test`,role,'hash','a'.repeat(32),role).run()
 await db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await sha256(token),id,Date.now()+3600000).run()
 const call=async(path,method='GET',data)=>{
  const headers={cookie:'taheel_session='+token,origin:'https://taheel.test'};if(data!==undefined)headers['content-type']='application/json'
  const res=await worker.fetch(new Request('https://taheel.test/api'+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)}),{DB:db,AUTH_PEPPER:'a'.repeat(64)})
  const type=res.headers.get('content-type')||''
  return type.includes('application/json')?{status:res.status,...await res.json()}:{status:res.status,type,headers:res.headers,body:await res.text()}
 }
 return {id,call}
}
test('Specialists: individual delegation only; cross-center isolation; approved Word and printable PDF remain downloadable',async()=>{
 const db=database(),center=randomUUID(),otherCenter=randomUUID()
 for(const id of [center,otherCenter])await db.prepare('INSERT INTO centers(id,name,email) VALUES(?,?,?)').bind(id,'المركز',id+'@test.local').run()
 const admin=await account(db,center,'center_admin'),supervisor=await account(db,center,'supervisor')
 const specA=await account(db,center,'specialist'),specB=await account(db,center,'specialist')
 const outside=await account(db,otherCenter,'center_admin'),platform=await account(db,null,'superadmin')
 const child=randomUUID(),otherChild=randomUUID()
 await db.prepare('INSERT INTO children(id,center_id,code,name,created_by) VALUES(?,?,?,?,?)').bind(child,center,'C-1','طفل المركز',admin.id).run()
 await db.prepare('INSERT INTO children(id,center_id,code,name,created_by) VALUES(?,?,?,?,?)').bind(otherChild,center,'C-2','طفل آخر',admin.id).run()
 await db.prepare('INSERT INTO assignments(center_id,child_id,specialist_id,assigned_by) VALUES(?,?,?,?)').bind(center,child,specA.id,admin.id).run()
 await db.prepare('INSERT INTO assignments(center_id,child_id,specialist_id,assigned_by) VALUES(?,?,?,?)').bind(center,child,specB.id,admin.id).run()
 let r=await platform.call('/assessments/library/import','POST',{program_id:'portage',source_file:'portage.docx',items:[{id:'portage-g1',domain_id:'portage-d1',domain_name:'المجال المعرفي',title:'مطابقة شكلين',source_page:1,source_number:'1',review_flags:[]}]});assert.equal(r.status,200)
 r=await platform.call('/assessments/library/review/bulk','POST',{program_id:'portage',goal_ids:['portage-g1'],usage_rights_confirmed:true,checked_against_source:true});assert.equal(r.status,200)
 // The old global specialist setting must not authorize everyone.
 await db.prepare('INSERT INTO assessment_settings(center_id,specialist_enabled) VALUES(?,1)').bind(center).run()
 r=await specA.call('/assessments/access');assert.equal(r.can_evaluate,false)
 r=await specA.call('/assessments','POST',{child_id:child,program_id:'portage'});assert.equal(r.status,403)
 r=await admin.call('/assessments/settings');assert.equal(r.specialists.length,2)
 r=await supervisor.call('/assessments/settings','PATCH',{specialist_id:specA.id,can_evaluate:true});assert.equal(r.status,200)
 r=await outside.call('/assessments/settings','PATCH',{specialist_id:specA.id,can_evaluate:true});assert.equal(r.status,404)
 r=await specA.call('/assessments/access');assert.equal(r.can_evaluate,true)
 r=await specB.call('/assessments/access');assert.equal(r.can_evaluate,false)
 r=await specA.call('/assessments','POST',{child_id:child,program_id:'portage'});assert.equal(r.status,201);const assessment=r.id
 r=await specA.call('/assessments','POST',{child_id:otherChild,program_id:'portage'});assert.equal(r.status,403)
 r=await specB.call('/assessments/'+assessment);assert.equal(r.status,403)
 r=await specB.call('/assessments');assert.equal(r.items.length,0)
 r=await specA.call('/assessments/'+assessment+'/answer','PATCH',{goal_id:'portage-g1',rating:'not_mastered'});assert.equal(r.status,200)
 r=await specA.call('/assessments/'+assessment+'/finalize','POST');assert.equal(r.status,200)
 r=await specB.call('/assessments/'+assessment+'/docx');assert.equal(r.status,403)
 r=await admin.call('/assessments/'+assessment+'/plan','PATCH',{goal_id:'portage-g1',fields:{baseline:'0 من 5',objective:'تطابق شكلين في 4 من 5 فرص',mastery:'80% عبر 3 جلسات',method:'تسجيل المحاولات',review_date:'2026-12-01'}});assert.equal(r.status,200)
 r=await supervisor.call('/assessments/'+assessment+'/approve','POST');assert.equal(r.status,200)
 r=await specB.call('/assessments');assert.equal(r.items.length,1)
 r=await specB.call('/assessments/'+assessment+'/docx');assert.equal(r.status,200)
 r=await specB.call('/assessments/'+assessment+'/pdf');assert.equal(r.status,200);assert.equal(r.type,'text/html; charset=utf-8')
 assert.match(r.body,/خطة معتمدة/);assert.match(r.body,/حفظ \/ طباعة PDF/)
 assert.ok(r.headers.get('content-security-policy'))
 r=await outside.call('/assessments/'+assessment+'/pdf');assert.equal(r.status,404)
 r=await admin.call('/assessments/settings','PATCH',{specialist_id:specA.id,can_evaluate:false});assert.equal(r.status,200)
 r=await specA.call('/assessments/access');assert.equal(r.can_evaluate,false)
 r=await specA.call('/assessments','POST',{child_id:child,program_id:'portage'});assert.equal(r.status,403)
 r=await specA.call('/assessments/'+assessment+'/docx');assert.equal(r.status,200)
})
