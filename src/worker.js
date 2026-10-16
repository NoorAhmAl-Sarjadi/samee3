
import {allow,centerPublic,constantEquals,derivePassword,email,error,isManager,json,makePassword,month,nowISO,password,sha256,str,userPublic,uuid,validDate} from './security.js'
import {databaseFromEnv} from './turso.js'
import {assessmentRoute} from './assessments.js'

const COOKIE = 'taheel_session'
const MAX_IMAGE = 1_500_000
const q = (db,sql,...args)=>db.prepare(sql).bind(...args)
const query = async (db,sql,...args)=>(await q(db,sql,...args).all()).results||[]
const one = (db,sql,...args)=>q(db,sql,...args).first()
const run = (db,sql,...args)=>q(db,sql,...args).run()
const ensure = (condition,message='لا يمكن تنفيذ الطلب',code=400)=>{if(!condition)throw error(message,code)}
const text = (value,max=120,required=false)=>str(value,max,required)
const normIso = s=>{const d=new Date(s);ensure(!Number.isNaN(d.valueOf()),'تاريخ أو وقت غير صحيح');return d.toISOString()}

async function parseBody(req){
  ensure((req.headers.get('content-type')||'').includes('application/json'),'نوع الطلب غير مدعوم',415)
  const raw=await req.text();ensure(raw.length<=25000,'الطلب كبير جدًا',413)
  try{return JSON.parse(raw)}catch{throw error('صيغة البيانات غير صحيحة')}
}

function cookieHeaders(req,token='',clear=false){
  const secure=new URL(req.url).protocol==='https:'?'; Secure':''
  return {'set-cookie':`${COOKIE}=${clear?'':token}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${clear?'0':'604800'}`}
}

function authCookie(req){
  const m=(req.headers.get('cookie')||'').match(/(?:^|;\s*)taheel_session=([a-f0-9]{64})(?:;|$)/)
  return m?.[1]||''
}

async function signedIn(req,env){
  const token=authCookie(req)
  if(!token)return null
  const tokenHash=await sha256(token)
  const user=await one(env.DB,`SELECT u.*,c.active center_active,COALESCE(p.gender,'male') gender,COALESCE(p.employee_code,'') employee_code FROM auth_sessions s JOIN users u ON u.id=s.user_id LEFT JOIN centers c ON c.id=u.center_id LEFT JOIN staff_profiles p ON p.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?`,tokenHash,Date.now())
  if(!user||!user.active||(user.center_id&&!user.center_active))return null
  return user
}

async function audit(env,user,action,type,id){
  await run(env.DB,'INSERT INTO audit_logs(id,center_id,actor_id,action,target_type,target_id) VALUES(?,?,?,?,?,?)',uuid(),user.center_id||null,user.id,action,type,id)
}

async function enforceRate(env,ip,emailValue){
  const key=(await sha256(ip+'|'+emailValue)).slice(0,40)
  const time=Math.floor(Date.now()/1000)
  const row=await one(env.DB,'SELECT failed,window_start FROM login_limits WHERE id=?',key)
  if(row&&time-row.window_start<900&&row.failed>=8)throw error('محاولات كثيرة، حاول بعد 15 دقيقة',429)
  return async failed=>{
    if(!failed){
      await run(env.DB,'DELETE FROM login_limits WHERE id=?',key)
      return
    }
    if(!row||time-row.window_start>=900){
      await run(env.DB,'INSERT INTO login_limits(id,failed,window_start) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET failed=1,window_start=excluded.window_start',key,time)
    }else{
      await run(env.DB,'UPDATE login_limits SET failed=failed+1 WHERE id=?',key)
    }
  }
}

async function verifyChild(env,user,id){
  ensure(user.center_id,'حساب المركز غير متاح',403)
  const c=await one(env.DB,'SELECT * FROM children WHERE id=? AND center_id=?',id,user.center_id)
  ensure(c,'هذا الطفل غير موجود في مركزك',404)
  if(user.role==='specialist'){
    const a=await one(env.DB,'SELECT child_id FROM assignments WHERE center_id=? AND child_id=? AND specialist_id=?',user.center_id,id,user.id)
    ensure(a,'هذا الطفل غير مسند إليك',403)
  }
  return c
}

function profile(user,center){
  return {user:userPublic(user),center:centerPublic(center)}
}


// Additional tables are created safely on first relevant API call; existing centers,
// users, children, and sessions are never dropped or overwritten.
let extrasPromise = null
async function ensureExtras(db) {
  if (!extrasPromise) {
    extrasPromise = (async () => {
      await run(db, `CREATE TABLE IF NOT EXISTS staff_profiles (
        user_id TEXT PRIMARY KEY REFERENCES users(id),
        center_id TEXT NOT NULL REFERENCES centers(id),
        gender TEXT NOT NULL DEFAULT 'male' CHECK(gender IN ('male','female')),
        employee_code TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`)
      await run(db, `CREATE TABLE IF NOT EXISTS session_revisions (
        id TEXT PRIMARY KEY,
        center_id TEXT NOT NULL REFERENCES centers(id),
        session_id TEXT NOT NULL REFERENCES session_records(id),
        edited_by TEXT NOT NULL REFERENCES users(id),
        reason TEXT NOT NULL DEFAULT '',
        before_json TEXT NOT NULL,
        after_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`)
      await run(db, `CREATE INDEX IF NOT EXISTS idx_session_revision ON session_revisions(center_id,session_id,created_at)`)
      await run(db, `CREATE TABLE IF NOT EXISTS session_reviews (
        session_id TEXT PRIMARY KEY REFERENCES session_records(id),
        center_id TEXT NOT NULL REFERENCES centers(id),
        status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','needs_review','archived')),
        note TEXT NOT NULL DEFAULT '',
        updated_by TEXT NOT NULL REFERENCES users(id),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`)
      await run(db, `CREATE TABLE IF NOT EXISTS session_numbers (
        session_id TEXT PRIMARY KEY REFERENCES session_records(id),
        center_id TEXT NOT NULL REFERENCES centers(id),
        session_number INTEGER NOT NULL CHECK(session_number BETWEEN 1 AND 25)
      )`)
      await run(db, `CREATE TABLE IF NOT EXISTS case_notes (
        id TEXT PRIMARY KEY,
        center_id TEXT NOT NULL REFERENCES centers(id),
        child_id TEXT NOT NULL REFERENCES children(id),
        author_id TEXT NOT NULL REFERENCES users(id),
        note TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`)
      await run(db, `CREATE INDEX IF NOT EXISTS idx_case_notes ON case_notes(center_id,child_id,created_at)`)
    })().catch(e=>{ extrasPromise = null; throw e })
  }
  return extrasPromise
}
const sessionFields = ['started_at','ended_at','duration_minutes','goals','activities','child_response','notes','next_plan']
const snapshot = record => ({...Object.fromEntries(sessionFields.map(key=>[key,record[key]])),session_number:Number(record.session_number||0)})
async function permittedSession(env,user,id) {
  ensure(user.center_id,'هذا السجل غير متاح',403)
  const session=await one(env.DB,'SELECT * FROM session_records WHERE id=? AND center_id=?',id,user.center_id)
  ensure(session,'الجلسة غير موجودة',404)
  if(user.role==='specialist') {
    ensure(session.specialist_id===user.id,'لا يمكنك الوصول لجلسات غيرك',403)
    await verifyChild(env,user,session.child_id)
  } else {
    allow(user,['center_admin','supervisor'])
  }
  const number=await one(env.DB,'SELECT session_number FROM session_numbers WHERE session_id=? AND center_id=?',id,user.center_id)
  return {...session,session_number:Number(number?.session_number||0)}
}
function sessionInput(b) {
  const sessionNumber=Number(b.session_number)
  ensure(Number.isInteger(sessionNumber)&&sessionNumber>=1&&sessionNumber<=25,'اختر رقم الجلسة من 1 إلى 25')
  const start=normIso(b.started_at),end=normIso(b.ended_at)
  const diff=(Date.parse(end)-Date.parse(start))/60000
  ensure(diff>=1&&diff<=480,'مدة الجلسة يجب أن تكون بين دقيقة و8 ساعات')
  ensure(Date.parse(start)<Date.now()+300000,'لا يمكن تسجيل جلسة مستقبلية')
  return {session_number:sessionNumber,started_at:start,ended_at:end,duration_minutes:Math.round(diff),goals:text(b.goals,3000,true),
    activities:text(b.activities,2500),child_response:text(b.child_response,2500),notes:text(b.notes,3500),next_plan:text(b.next_plan,2500)}
}

async function handle(req,env){
  const url=new URL(req.url)
  const path=url.pathname
  const method=req.method.toUpperCase()

  if(!path.startsWith('/api/'))return env.ASSETS.fetch(req)

  const databaseConfigured=Boolean(env.DB||(env.TURSO_URL&&env.TURSO_TOKEN))

  if(path==='/api/status'&&method==='GET'){
    const missing=[]
    if(!env.DB){
      if(!env.TURSO_URL)missing.push('TURSO_URL')
      if(!env.TURSO_TOKEN)missing.push('TURSO_TOKEN')
    }
    if(!env.AUTH_PEPPER)missing.push('AUTH_PEPPER')

    if(missing.length){
      return json({ok:false,error:'إعدادات الخادم غير مكتملة',missing},503)
    }

    try{
      const db=databaseFromEnv(env)
      await db.prepare('SELECT 1 AS healthy').first()
      return json({ok:true,app:'تأهيل +',database:'connected'})
    }catch(err){
      console.error('Turso connection failed:',err?.message||'unknown')
      return json({ok:false,error:'تعذر الاتصال بقاعدة البيانات',code:'DATABASE_CONNECTION_FAILED'},503)
    }
  }

  if(!databaseConfigured)throw error('لم يتم ضبط قاعدة البيانات',503)
  if(!env.AUTH_PEPPER)throw error('مفتاح الأمان غير مضبوط',503)

  env={...env,DB:databaseFromEnv(env)}

  if(!['GET','POST','PATCH','PUT'].includes(method)){
    return json({error:'طريقة غير مدعومة'},405)
  }

  if(method!=='GET'){
    const origin=req.headers.get('origin')
    if(origin&&origin!==url.origin)throw error('مصدر الطلب غير مسموح',403)
    const site=req.headers.get('sec-fetch-site')
    if(site==='cross-site')throw error('الطلب غير مسموح',403)
  }

  if((path==='/api/auth/login'&&method==='POST')||authCookie(req)) await ensureExtras(env.DB)

  if(path==='/api/auth/login'&&method==='POST'){
    const body=await parseBody(req)
    const mail=email(body.email)
    const pwd=String(body.password||'')
    const onFail=await enforceRate(env,req.headers.get('cf-connecting-ip')||'local',mail)
    const user=await one(env.DB,`SELECT u.*,c.active AS center_active,COALESCE(p.gender,'male') gender,COALESCE(p.employee_code,'') employee_code FROM users u LEFT JOIN centers c ON c.id=u.center_id LEFT JOIN staff_profiles p ON p.user_id=u.id WHERE u.email=?`,mail)
    const computed=user?.password_salt
      ?await derivePassword(pwd,user.password_salt,env.AUTH_PEPPER)
      :await derivePassword(pwd,'00000000000000000000000000000000',env.AUTH_PEPPER)

    if(!user||!constantEquals(computed,user.password_hash)){
      await onFail(true)
      throw error('البريد الإلكتروني أو كلمة المرور غير صحيحين',401)
    }

    if(!user.active||(user.center_id&&!user.center_active)){
      throw error('الحساب موقوف؛ تواصل مع الإدارة',403)
    }

    await onFail(false)
    const token=crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,'')
    await run(env.DB,'INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',await sha256(token),user.id,Date.now()+604800000)
    const center=user.center_id?await one(env.DB,'SELECT * FROM centers WHERE id=?',user.center_id):null
    return json(profile(user,center),200,cookieHeaders(req,token))
  }

  const user=await signedIn(req,env)
  ensure(user,'يرجى تسجيل الدخول أولًا',401)

  if(path==='/api/auth/logout'&&method==='POST'){
    const tok=authCookie(req)
    if(tok)await run(env.DB,'DELETE FROM auth_sessions WHERE token_hash=?',await sha256(tok))
    return json({ok:true},200,cookieHeaders(req,'',true))
  }

  if(path==='/api/auth/me'&&method==='GET'){
    const center=user.center_id?await one(env.DB,'SELECT * FROM centers WHERE id=?',user.center_id):null
    return json(profile(user,center))
  }

  if(path==='/api/auth/change-password'&&method==='POST'){
    const b=await parseBody(req)
    ensure(String(b.current||'').length,'أدخل كلمة المرور الحالية')
    const match=await derivePassword(String(b.current),user.password_salt,env.AUTH_PEPPER)
    ensure(constantEquals(match,user.password_hash),'كلمة المرور الحالية غير صحيحة',403)
    const {salt,hash}=await makePassword(password(b.next),env.AUTH_PEPPER)
    await run(env.DB,'UPDATE users SET password_salt=?,password_hash=?,must_change_password=0 WHERE id=?',salt,hash,user.id)
    await run(env.DB,'DELETE FROM auth_sessions WHERE user_id=? AND token_hash<>?',user.id,await sha256(authCookie(req)))
    await audit(env,user,'change_password','user',user.id)
    return json({ok:true})
  }

  ensure(!user.must_change_password,'يجب تغيير كلمة المرور المؤقتة أولًا',403)

  if(path.startsWith('/api/assessments'))return assessmentRoute(req,env,user,path,method)

  if(path==='/api/centers'&&method==='GET'){
    allow(user,['superadmin'])
    const rows=await query(env.DB,`SELECT c.*,
      (SELECT COUNT(*) FROM users u WHERE u.center_id=c.id) staff_count,
      (SELECT COUNT(*) FROM children ch WHERE ch.center_id=c.id) children_count,
      (SELECT COUNT(*) FROM session_records s WHERE s.center_id=c.id) sessions_count
      FROM centers c ORDER BY c.created_at DESC LIMIT 200`)
    return json({items:rows.map(c=>({...centerPublic(c),staff_count:c.staff_count,children_count:c.children_count,sessions_count:c.sessions_count}))})
  }

  if(path==='/api/centers'&&method==='POST'){
    allow(user,['superadmin'])
    const b=await parseBody(req)
    const name=text(b.name,120,true)
    const mail=email(b.email)
    const managerName=text(b.manager_name,120,true)
    const phone=text(b.phone,25)
    const raw=password(b.password)
    const {salt,hash}=await makePassword(raw,env.AUTH_PEPPER)
    const id=uuid()
    const ownerId=uuid()

    await env.DB.batch([
      q(env.DB,'INSERT INTO centers(id,name,email,phone) VALUES(?,?,?,?)',id,name,mail,phone),
      q(env.DB,"INSERT INTO users(id,center_id,email,name,password_hash,password_salt,role) VALUES(?,?,?,?,?,?,'center_admin')",ownerId,id,mail,managerName,hash,salt),
      q(env.DB,'INSERT INTO audit_logs(id,center_id,actor_id,action,target_type,target_id) VALUES(?,?,?,?,?,?)',uuid(),null,user.id,'create_center','center',id)
    ])
    return json({id,ok:true},201)
  }

  const centerStatus=path.match(/^\/api\/centers\/([^/]+)\/status$/)

  if(centerStatus&&method==='PATCH'){
    allow(user,['superadmin'])
    const b=await parseBody(req)
    const id=centerStatus[1]
    ensure(typeof b.active==='boolean','الحالة غير صحيحة')
    const r=await run(env.DB,'UPDATE centers SET active=? WHERE id=?',b.active?1:0,id)
    ensure(r.meta.changes,'المركز غير موجود',404)
    if(!b.active)await run(env.DB,'DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE center_id=?)',id)
    await audit(env,user,b.active?'activate_center':'suspend_center','center',id)
    return json({ok:true})
  }

  const resetCenterMatch=path.match(/^\/api\/centers\/([^/]+)\/reset-password$/)

  if(resetCenterMatch&&method==='POST'){
    allow(user,['superadmin'])
    const b=await parseBody(req)
    const id=resetCenterMatch[1]
    const account=await one(env.DB,"SELECT id FROM users WHERE center_id=? AND role='center_admin'",id)
    ensure(account,'مدير المركز غير موجود',404)
    const {salt,hash}=await makePassword(password(b.password),env.AUTH_PEPPER)

    await env.DB.batch([
      q(env.DB,'UPDATE users SET password_hash=?,password_salt=?,must_change_password=1 WHERE id=?',hash,salt,account.id),
      q(env.DB,'DELETE FROM auth_sessions WHERE user_id=?',account.id)
    ])
    await audit(env,user,'reset_center_password','center',id)
    return json({ok:true})
  }

  if(path==='/api/center'&&method==='PATCH'){
    allow(user,['center_admin'])
    const b=await parseBody(req)
    const name=text(b.name,120,true)
    const phone=text(b.phone,25)
    await run(env.DB,'UPDATE centers SET name=?,phone=? WHERE id=?',name,phone,user.center_id)
    await audit(env,user,'edit_center','center',user.center_id)
    return json({ok:true})
  }

  if(path==='/api/staff'&&method==='GET'){
    allow(user,['center_admin','supervisor'])
    const rows=await query(env.DB,`SELECT u.id,u.center_id,u.name,u.email,u.role,u.specialty,u.phone,u.active,u.must_change_password,u.photo_key,COALESCE(p.gender,'male') gender,COALESCE(p.employee_code,'') employee_code FROM users u LEFT JOIN staff_profiles p ON p.user_id=u.id WHERE u.center_id=? ORDER BY u.created_at DESC LIMIT 500`,user.center_id)
    return json({items:rows.map(userPublic)})
  }

  if(path==='/api/staff'&&method==='POST'){
    allow(user,['center_admin','supervisor'])
    const b=await parseBody(req)
    const role=b.role==='supervisor'?'supervisor':'specialist'
    if(role==='supervisor')allow(user,['center_admin'])
    const mail=email(b.email)
    const name=text(b.name,120,true)
    const phone=text(b.phone,25)
    const specialty=role==='specialist'?text(b.specialty,100,true):''
    const pwd=password(b.password)
    const {salt,hash}=await makePassword(pwd,env.AUTH_PEPPER)
    const id=uuid()
    const gender=b.gender==='female'?'female':'male',employeeCode=text(b.employee_code||'',40)
    await env.DB.batch([
      q(env.DB,'INSERT INTO users(id,center_id,email,name,password_hash,password_salt,role,specialty,phone) VALUES(?,?,?,?,?,?,?,?,?)',id,user.center_id,mail,name,hash,salt,role,specialty,phone),
      q(env.DB,'INSERT INTO staff_profiles(user_id,center_id,gender,employee_code) VALUES(?,?,?,?)',id,user.center_id,gender,employeeCode)
    ])
    await audit(env,user,'create_staff','user',id)
    return json({id,ok:true},201)
  }

  const staffMatch=path.match(/^\/api\/staff\/([^/]+)$/)

  if(staffMatch&&method==='PATCH'){
    allow(user,['center_admin','supervisor'])
    const id=staffMatch[1]
    const b=await parseBody(req)
    const target=await one(env.DB,'SELECT * FROM users WHERE id=? AND center_id=?',id,user.center_id)
    ensure(target,'العضو غير موجود',404)
    ensure(target.role==='specialist'||(target.role==='supervisor'&&user.role==='center_admin'),'لا يمكن تعديل هذا الحساب',403)
    const name=text(b.name??target.name,120,true)
    const specialty=target.role==='specialist'?text(b.specialty??target.specialty,100,true):''
    const phone=text(b.phone??target.phone,25)
    const mail=b.email===undefined?target.email:email(b.email)
    const gender=b.gender==='female'?'female':'male'
    const employeeCode=text(b.employee_code||'',40)
    const active=typeof b.active==='boolean'?(b.active?1:0):target.active
    await env.DB.batch([
      q(env.DB,'UPDATE users SET name=?,email=?,specialty=?,phone=?,active=? WHERE id=? AND center_id=?',name,mail,specialty,phone,active,id,user.center_id),
      q(env.DB,`INSERT INTO staff_profiles(user_id,center_id,gender,employee_code) VALUES(?,?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET gender=excluded.gender,employee_code=excluded.employee_code`,id,user.center_id,gender,employeeCode)
    ])
    if(!active)await run(env.DB,'DELETE FROM auth_sessions WHERE user_id=?',id)
    await audit(env,user,'edit_staff','user',id)
    return json({ok:true})
  }

  const resetMatch=path.match(/^\/api\/staff\/([^/]+)\/reset-password$/)

  if(resetMatch&&method==='POST'){
    allow(user,['center_admin'])
    const id=resetMatch[1]
    const b=await parseBody(req)
    const target=await one(env.DB,'SELECT * FROM users WHERE id=? AND center_id=?',id,user.center_id)
    ensure(target&&['specialist','supervisor'].includes(target.role),'الحساب غير متاح',404)
    const {salt,hash}=await makePassword(password(b.password),env.AUTH_PEPPER)

    await env.DB.batch([
      q(env.DB,'UPDATE users SET password_hash=?,password_salt=?,must_change_password=1 WHERE id=? AND center_id=?',hash,salt,id,user.center_id),
      q(env.DB,'DELETE FROM auth_sessions WHERE user_id=?',id)
    ])
    await audit(env,user,'reset_staff_password','user',id)
    return json({ok:true})
  }

  if(path==='/api/children'&&method==='GET'){
    ensure(user.center_id,'غير متاح',403)
    const rows=user.role==='specialist'
      ?await query(env.DB,`SELECT c.* FROM children c JOIN assignments a ON c.id=a.child_id AND a.center_id=c.center_id WHERE c.center_id=? AND a.specialist_id=? ORDER BY c.name LIMIT 1000`,user.center_id,user.id)
      :await query(env.DB,'SELECT * FROM children WHERE center_id=? ORDER BY created_at DESC LIMIT 1000',user.center_id)
    return json({items:user.role==='specialist'?rows.map(c=>({...c,guardian_name:'',guardian_phone:''})):rows})
  }

  if(path==='/api/children'&&method==='POST'){
    allow(user,['center_admin','supervisor'])
    const b=await parseBody(req)
    const values={
      code:text(b.code,50,true),
      name:text(b.name,120,true),
      birth_date:text(b.birth_date,10),
      guardian_name:text(b.guardian_name,120),
      guardian_phone:text(b.guardian_phone,25),
      diagnosis:text(b.diagnosis,500),
      iq_score:text(b.iq_score,30),
      case_summary:text(b.case_summary,6000)
    }
    if(values.birth_date)ensure(validDate(values.birth_date),'تاريخ الميلاد غير صحيح')
    const id=uuid()
    await run(env.DB,`INSERT INTO children(id,center_id,code,name,birth_date,guardian_name,guardian_phone,diagnosis,iq_score,case_summary,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,id,user.center_id,...Object.values(values),user.id)
    await audit(env,user,'create_child','child',id)
    return json({id,ok:true},201)
  }

  const childMatch=path.match(/^\/api\/children\/([^/]+)$/)

  if(childMatch&&method==='GET'){
    const child=await verifyChild(env,user,childMatch[1])
    const tests=await query(env.DB,'SELECT * FROM child_tests WHERE center_id=? AND child_id=? ORDER BY test_date DESC,created_at DESC',user.center_id,child.id)
    const assignmentRows=await query(env.DB,'SELECT a.specialist_id,u.name,u.specialty FROM assignments a JOIN users u ON u.id=a.specialist_id WHERE a.center_id=? AND a.child_id=?',user.center_id,child.id)

    const childSessions=user.role==='specialist'
      ?await query(env.DB,`SELECT s.id,COALESCE((SELECT sn.session_number FROM session_numbers sn WHERE sn.session_id=s.id AND sn.center_id=s.center_id),0) session_number,s.started_at,s.ended_at,s.duration_minutes,s.goals,s.activities,s.child_response,s.notes,s.next_plan,u.name specialist_name FROM session_records s JOIN users u ON u.id=s.specialist_id WHERE s.center_id=? AND s.child_id=? AND s.specialist_id=? ORDER BY s.started_at DESC LIMIT 150`,user.center_id,child.id,user.id)
      :await query(env.DB,`SELECT s.id,COALESCE((SELECT sn.session_number FROM session_numbers sn WHERE sn.session_id=s.id AND sn.center_id=s.center_id),0) session_number,s.started_at,s.ended_at,s.duration_minutes,s.goals,s.activities,s.child_response,s.notes,s.next_plan,u.name specialist_name FROM session_records s JOIN users u ON u.id=s.specialist_id WHERE s.center_id=? AND s.child_id=? ORDER BY s.started_at DESC LIMIT 150`,user.center_id,child.id)

    const internalNotes=user.role==='specialist'?[]:await query(env.DB,`SELECT n.id,n.note,n.created_at,u.name author_name FROM case_notes n JOIN users u ON u.id=n.author_id WHERE n.center_id=? AND n.child_id=? ORDER BY n.created_at DESC LIMIT 100`,user.center_id,child.id)
    return json({
      child:user.role==='specialist'?{...child,guardian_name:'',guardian_phone:''}:child,
      tests,
      assignments:assignmentRows,
      sessions:childSessions,
      internal_notes:internalNotes
    })
  }

  if(childMatch&&method==='PATCH'){
    allow(user,['center_admin','supervisor'])
    const existing=await verifyChild(env,user,childMatch[1])
    const b=await parseBody(req)
    const values={
      code:text(b.code??existing.code,50,true),
      name:text(b.name??existing.name,120,true),
      birth_date:text(b.birth_date??existing.birth_date,10),
      guardian_name:text(b.guardian_name??existing.guardian_name,120),
      guardian_phone:text(b.guardian_phone??existing.guardian_phone,25),
      diagnosis:text(b.diagnosis??existing.diagnosis,500),
      iq_score:text(b.iq_score??existing.iq_score,30),
      case_summary:text(b.case_summary??existing.case_summary,6000)
    }
    if(values.birth_date)ensure(validDate(values.birth_date),'تاريخ الميلاد غير صحيح')
    const active=typeof b.active==='boolean'?(b.active?1:0):existing.active
    await run(env.DB,'UPDATE children SET code=?,name=?,birth_date=?,guardian_name=?,guardian_phone=?,diagnosis=?,iq_score=?,case_summary=?,active=?,updated_at=? WHERE id=? AND center_id=?',...Object.values(values),active,nowISO(),existing.id,user.center_id)
    await audit(env,user,'edit_child','child',existing.id)
    return json({ok:true})
  }

  const testMatch=path.match(/^\/api\/children\/([^/]+)\/tests$/)

  if(testMatch&&method==='POST'){
    allow(user,['center_admin','supervisor'])
    const child=await verifyChild(env,user,testMatch[1])
    const b=await parseBody(req)
    const name=text(b.test_name,160,true)
    const result=text(b.result,500,true)
    const date=text(b.test_date,10)
    const notes=text(b.notes,2500)
    if(date)ensure(validDate(date),'التاريخ غير صحيح')
    const id=uuid()
    await run(env.DB,'INSERT INTO child_tests(id,center_id,child_id,test_name,result,test_date,notes,created_by) VALUES(?,?,?,?,?,?,?,?)',id,user.center_id,child.id,name,result,date,notes,user.id)
    await audit(env,user,'add_test','child',child.id)
    return json({id,ok:true},201)
  }

  const internalNoteMatch=path.match(/^\/api\/children\/([^/]+)\/internal-notes$/)
  if(internalNoteMatch&&method==='POST'){
    allow(user,['center_admin','supervisor'])
    const child=await verifyChild(env,user,internalNoteMatch[1]),b=await parseBody(req)
    const note=text(b.note,2000,true),id=uuid()
    await run(env.DB,'INSERT INTO case_notes(id,center_id,child_id,author_id,note) VALUES(?,?,?,?,?)',id,user.center_id,child.id,user.id,note)
    await audit(env,user,'add_internal_note','child',child.id)
    return json({ok:true,id},201)
  }

  const assignmentMatch=path.match(/^\/api\/children\/([^/]+)\/assignments$/)

  if(assignmentMatch&&method==='PUT'){
    allow(user,['center_admin','supervisor'])
    const child=await verifyChild(env,user,assignmentMatch[1])
    const b=await parseBody(req)
    ensure(Array.isArray(b.specialist_ids)&&b.specialist_ids.length<=100,'تحديد الأخصائيين غير صحيح')
    const unique=[...new Set(b.specialist_ids.map(String))]
    if(unique.length){
      const placeholders=unique.map(()=>'?').join(',')
      const valid=await query(env.DB,`SELECT id FROM users WHERE center_id=? AND role='specialist' AND active=1 AND id IN (${placeholders})`,user.center_id,...unique)
      ensure(valid.length===unique.length,'اختر أخصائيين نشطين من المركز نفسه')
    }
    const statements=[
      q(env.DB,'DELETE FROM assignments WHERE center_id=? AND child_id=?',user.center_id,child.id),
      ...unique.map(id=>q(env.DB,'INSERT INTO assignments(center_id,child_id,specialist_id,assigned_by) VALUES(?,?,?,?)',user.center_id,child.id,id,user.id))
    ]
    await env.DB.batch(statements)
    await audit(env,user,'assign_specialists','child',child.id)
    return json({ok:true})
  }

  if(path==='/api/sessions'&&method==='GET'){
    ensure(user.center_id,'غير متاح',403)
    const m=month(url.searchParams.get('month')||new Date().toISOString().slice(0,7))
    const next=new Date(m+'-01T00:00:00.000Z')
    next.setUTCMonth(next.getUTCMonth()+1)
    const args=[user.center_id,m+'-01T00:00:00.000Z',next.toISOString()]
    const sql=`SELECT s.*,COALESCE(sn.session_number,0) session_number,c.name child_name,u.name specialist_name,u.specialty specialist_specialty,COALESCE(rv.status,'completed') status,COALESCE(rv.note,'') review_note,COALESCE((SELECT COUNT(*) FROM session_revisions sr WHERE sr.session_id=s.id AND sr.center_id=s.center_id),0) revision_count
      FROM session_records s JOIN children c ON c.id=s.child_id JOIN users u ON u.id=s.specialist_id LEFT JOIN session_reviews rv ON rv.session_id=s.id AND rv.center_id=s.center_id
      LEFT JOIN session_numbers sn ON sn.session_id=s.id AND sn.center_id=s.center_id
      WHERE s.center_id=? AND s.started_at>=? AND s.started_at<?`
    const rows=user.role==='specialist'
      ?await query(env.DB,sql+` AND s.specialist_id=? AND EXISTS(SELECT 1 FROM assignments a WHERE a.center_id=s.center_id AND a.child_id=s.child_id AND a.specialist_id=?) ORDER BY s.started_at DESC LIMIT 1500`,...args,user.id,user.id)
      :await query(env.DB,sql+' ORDER BY s.started_at DESC LIMIT 1500',...args)
    return json({items:rows})
  }

  if(path==='/api/sessions'&&method==='POST'){
    allow(user,['specialist'])
    const b=await parseBody(req)
    const child=await verifyChild(env,user,text(b.child_id,60,true))
    ensure(child.active,'ملف الطفل مؤرشف',403)
    const values=sessionInput(b),id=uuid()
    await env.DB.batch([
      q(env.DB,`INSERT INTO session_records(id,center_id,child_id,specialist_id,
        started_at,ended_at,duration_minutes,goals,activities,child_response,notes,next_plan)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,id,user.center_id,child.id,user.id,...sessionFields.map(k=>values[k])),
      q(env.DB,'INSERT INTO session_numbers(session_id,center_id,session_number) VALUES(?,?,?)',id,user.center_id,values.session_number)
    ])
    await audit(env,user,'create_session','session',id)
    return json({ok:true,id},201)
  }

  const sessionHistory=path.match(/^\/api\/sessions\/([^/]+)\/history$/)
  if(sessionHistory&&method==='GET'){
    const target=await permittedSession(env,user,sessionHistory[1])
    const items=await query(env.DB,`SELECT r.id,r.reason,r.before_json,r.after_json,r.created_at,u.name editor_name
      FROM session_revisions r JOIN users u ON u.id=r.edited_by
      WHERE r.center_id=? AND r.session_id=? ORDER BY r.created_at DESC LIMIT 100`,user.center_id,target.id)
    return json({items:items.map(x=>({...x,before:JSON.parse(x.before_json),after:JSON.parse(x.after_json),before_json:undefined,after_json:undefined}))})
  }

  const reviewMatch=path.match(/^\/api\/sessions\/([^/]+)\/review$/)
  if(reviewMatch&&method==='PATCH'){
    allow(user,['center_admin','supervisor'])
    const target=await permittedSession(env,user,reviewMatch[1]),b=await parseBody(req)
    ensure(['completed','needs_review','archived'].includes(b.status),'حالة الجلسة غير صحيحة')
    const note=text(b.note||'',1500)
    await run(env.DB,`INSERT INTO session_reviews(session_id,center_id,status,note,updated_by,updated_at)
      VALUES(?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET status=excluded.status,note=excluded.note,
      updated_by=excluded.updated_by,updated_at=excluded.updated_at`,target.id,user.center_id,b.status,note,user.id,nowISO())
    await audit(env,user,'review_session','session',target.id)
    return json({ok:true})
  }

  const sessionMatch=path.match(/^\/api\/sessions\/([^/]+)$/)
  if(sessionMatch&&method==='PATCH'){
    allow(user,['specialist'])
    const old=await permittedSession(env,user,sessionMatch[1])
    const review=await one(env.DB,'SELECT status FROM session_reviews WHERE session_id=? AND center_id=?',old.id,user.center_id)
    ensure(review?.status!=='archived','الجلسة مؤرشفة ولا يمكن تعديلها',403)
    const b=await parseBody(req)
    const currentRevision=await one(env.DB,'SELECT COUNT(*) AS total FROM session_revisions WHERE center_id=? AND session_id=?',user.center_id,old.id)
    ensure(Number(b.expected_revision)===Number(currentRevision?.total||0),'تم تعديل الجلسة في مكان آخر. حدّث الصفحة وحاول مرة أخرى.',409)
    const values=sessionInput(b),reason=text(b.reason||'',500,true)
    const before=snapshot(old)
    await env.DB.batch([
      q(env.DB,`UPDATE session_records SET started_at=?,ended_at=?,duration_minutes=?,goals=?,activities=?,child_response=?,notes=?,next_plan=?
        WHERE id=? AND center_id=? AND specialist_id=?`,...sessionFields.map(k=>values[k]),old.id,user.center_id,user.id),
      q(env.DB,`INSERT INTO session_numbers(session_id,center_id,session_number) VALUES(?,?,?)
        ON CONFLICT(session_id) DO UPDATE SET session_number=excluded.session_number`,old.id,user.center_id,values.session_number),
      q(env.DB,`INSERT INTO session_revisions(id,center_id,session_id,edited_by,reason,before_json,after_json)
        VALUES(?,?,?,?,?,?,?)`,uuid(),user.center_id,old.id,user.id,reason,JSON.stringify(before),JSON.stringify(values)),
      q(env.DB,'INSERT INTO audit_logs(id,center_id,actor_id,action,target_type,target_id) VALUES(?,?,?,?,?,?)',uuid(),user.center_id,user.id,'edit_session','session',old.id)
    ])
    return json({ok:true})
  }

  if(path==='/api/reports'&&method==='GET'){
    allow(user,['center_admin','supervisor'])
    const m=month(url.searchParams.get('month')||new Date().toISOString().slice(0,7))
    const end=new Date(m+'-01T00:00:00Z')
    end.setUTCMonth(end.getUTCMonth()+1)
    const rows=await query(env.DB,`SELECT u.id,u.name,u.specialty,u.active,COUNT(s.id) session_count,
      COALESCE(SUM(s.duration_minutes),0) minutes,COUNT(DISTINCT s.child_id) children_count,
      SUM(CASE WHEN substr(s.started_at,1,10)=? THEN 1 ELSE 0 END) today_count
      FROM users u LEFT JOIN session_records s ON s.specialist_id=u.id AND s.center_id=u.center_id AND s.started_at>=? AND s.started_at<?
      AND NOT EXISTS(SELECT 1 FROM session_reviews rv WHERE rv.center_id=s.center_id AND rv.session_id=s.id AND rv.status='archived')
      WHERE u.center_id=? AND u.role='specialist' GROUP BY u.id ORDER BY session_count DESC,u.name`,new Date().toISOString().slice(0,10),m+'-01T00:00:00.000Z',end.toISOString(),user.center_id)
    return json({items:rows,month:m})
  }

  if(path==='/api/audit'&&method==='GET'){
    allow(user,['center_admin'])
    const rows=await query(env.DB,`SELECT l.id,l.action,l.target_type,l.created_at,u.name actor_name FROM audit_logs l LEFT JOIN users u ON u.id=l.actor_id WHERE l.center_id=? ORDER BY l.created_at DESC LIMIT 60`,user.center_id)
    return json({items:rows})
  }

  const mediaUpload=path==='/api/media/upload'&&method==='POST'

  if(mediaUpload){
    ensure(env.MEDIA,'يجب تفعيل خدمة تخزين الصور R2 أولًا',503)
    const form=await req.formData()
    const file=form.get('file')
    const kind=String(form.get('kind')||'')
    const id=String(form.get('id')||'')

    ensure(file&&typeof file.arrayBuffer==='function','اختر صورة',400)
    ensure(file.size>0&&file.size<=MAX_IMAGE,'الحد الأقصى للصورة 1.5 ميجابايت',413)

    const mime=file.type
    ensure(['image/jpeg','image/png','image/webp'].includes(mime),'صيغة الصورة غير مسموحة')
    const bytes=new Uint8Array(await file.arrayBuffer())
    let valid=false

    if(mime==='image/jpeg')valid=bytes[0]===255&&bytes[1]===216&&bytes[2]===255
    if(mime==='image/png')valid=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71
    if(mime==='image/webp')valid=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'
    ensure(valid,'الصورة غير صالحة')

    let old=null
    let key=null

    if(kind==='center'){
      allow(user,['center_admin'])
      const c=await one(env.DB,'SELECT logo_key FROM centers WHERE id=?',user.center_id)
      old=c?.logo_key
      key=`center/${user.center_id}/${uuid()}`
      await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}})
      await run(env.DB,'UPDATE centers SET logo_key=? WHERE id=?',key,user.center_id)
    }else if(kind==='staff'){
      throw error('تم إيقاف رفع الصور الشخصية؛ تستخدم المنصة صورًا رمزية تلقائية',403)
      ensure(user.role==='center_admin'||user.role==='supervisor'||id===user.id,'لا تملك صلاحية تعديل الصورة',403)
      const target=await one(env.DB,'SELECT * FROM users WHERE id=? AND center_id=?',id,user.center_id)
      ensure(target,'العضو غير موجود',404)
      if(id!==user.id){
        ensure(isManager(user),'لا تملك صلاحية',403)
        ensure(target.role==='specialist'||(user.role==='center_admin'&&target.role==='supervisor'),'لا تملك صلاحية تعديل هذا الحساب',403)
      }
      old=target.photo_key
      key=`staff/${user.center_id}/${id}/${uuid()}`
      await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}})
      await run(env.DB,'UPDATE users SET photo_key=? WHERE id=? AND center_id=?',key,id,user.center_id)
    }else{
      throw error('نوع الصورة غير صحيح')
    }

    if(old){
      try{await env.MEDIA.delete(old)}catch{}
    }

    await audit(env,user,'upload_image',kind,id||user.center_id)
    return json({ok:true})
  }

  const media=path.match(/^\/api\/media\/(center|staff)\/([a-f0-9-]{36})$/)

  if(media&&method==='GET'){
    ensure(env.MEDIA,'تخزين الصور غير متاح',503)
    const [_,kind,id]=media
    let key=null

    if(kind==='center'){
      ensure(user.role==='superadmin'||id===user.center_id,'الصورة غير متاحة',403)
      key=(await one(env.DB,'SELECT logo_key FROM centers WHERE id=?',id))?.logo_key
    }else{
      const target=await one(env.DB,'SELECT center_id,photo_key FROM users WHERE id=?',id)
      ensure(target&&target.center_id===user.center_id,'الصورة غير متاحة',403)
      key=target.photo_key
    }

    ensure(key,'الصورة غير موجودة',404)
    const object=await env.MEDIA.get(key)
    ensure(object,'الصورة غير موجودة',404)

    return new Response(object.body,{
      headers:{
        'content-type':object.httpMetadata?.contentType||'image/jpeg',
        'cache-control':'private, max-age=120',
        'x-content-type-options':'nosniff',
        'content-security-policy':"default-src 'none'; sandbox"
      }
    })
  }

  return json({error:'المسار غير موجود'},404)
}

export default {
  async fetch(req,env){
    try{
      return await handle(req,env)
    }catch(e){
      if(e.message?.includes('UNIQUE constraint failed'))return json({error:'هذا البريد أو رقم الملف مُسجل بالفعل'},409)
      if(e.message?.includes('FOREIGN KEY constraint failed'))return json({error:'السجل المرتبط غير موجود'},409)
      if(e.status)return json({error:e.message},e.status)
      console.error('Unhandled API error:',e)
      return json({error:'حدث خطأ في الخادم. تحقق من إعداد الخدمات وحاول لاحقًا.'},500)
    }
  }
}
