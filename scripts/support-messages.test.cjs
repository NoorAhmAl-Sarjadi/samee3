const { before, after, beforeEach, test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing')
const { doc, getDoc, getDocs, collection, collectionGroup, setDoc, updateDoc, writeBatch, Timestamp, serverTimestamp } = require('firebase/firestore')
const load = require('./load-ts.cjs')
const { sendSupportMessage, markSupportMessagesRead, normalizeSupportMessage, sortSupportMessages, recoverSupportConversations, subscribeSupportMessages } = load('lib/support-messages.ts')
let env
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-samee3',firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync('firestore.rules','utf8')}})})
after(async()=>{if(env)await env.cleanup()})
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{for(const id of ['admin','admin2'])await setDoc(doc(c.firestore(),'users',id),{role:'admin',status:'active'})})})
const user=(id='learner')=>env.authenticatedContext(id,{email:id+'@example.test'}).firestore()
const send=(db,side='user',body='رسالة تجريبية',senderId=side==='admin'?'admin':'learner')=>sendSupportMessage(db,{threadId:'learner',senderId,senderName:side==='admin'?'إدارة سميع':'طالب علم',side,body,userName:'طالب علم',userEmail:'learner@example.test'})
const rows=async db=>sortSupportMessages((await getDocs(collection(db,'conversations','learner','messages'))).docs.map(d=>normalizeSupportMessage(d.id,d.data(),'learner')))

test('user message and inbox summary reach the server atomically and the active admin can read both',async()=>{
 const db=user(),id=await send(db),admin=user('admin')
 const summary=(await getDoc(doc(admin,'conversations','learner'))).data();assert.equal(summary.lastMessageId,id);assert.equal(summary.unreadForAdmin,true)
 assert.equal((await getDocs(collection(admin,'conversations'))).size,1)
 const message=(await getDoc(doc(admin,'conversations','learner','messages',id))).data();assert.equal(message.text,'رسالة تجريبية');assert(message.createdAt.isEqual(summary.updatedAt))
 await assertFails(getDoc(doc(user('other'),'conversations','learner','messages',id)))
})
test('standalone messages and new summaries without their matching message are rejected',async()=>{
 const db=user();await assertFails(setDoc(doc(db,'conversations','learner','messages','orphan'),{senderId:'learner',senderName:'طالب علم',text:'غير ظاهرة',createdAt:serverTimestamp(),read:false}))
 await assertFails(setDoc(doc(db,'conversations','learner'),{userId:'learner',userName:'طالب علم',userEmail:'learner@example.test',lastMessage:'بلا رسالة',lastMessageId:'missing',lastSenderId:'learner',updatedAt:serverTimestamp(),unreadForAdmin:true,unreadForUser:false}))
 assert.equal((await getDocs(collection(user('admin'),'conversations'))).size,0)
})
test('legacy summary fields remain intact and missing identity is safely normalized on a new send',async()=>{
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'conversations','learner'),{userName:'اسم قديم',userEmail:'learner@example.test',lastMessage:'قديم',lastSenderId:'learner',unreadForAdmin:false,unreadForUser:false,createdAt:Timestamp.fromMillis(1000),legacyLabel:'محفوظ',updatedAt:Timestamp.fromMillis(1000)}))
 const db=user();await send(db);const summary=(await getDoc(doc(db,'conversations','learner'))).data();assert.equal(summary.userId,'learner');assert.equal(summary.legacyLabel,'محفوظ');assert.equal(summary.createdAt.toMillis(),1000)
 await assertFails(updateDoc(doc(db,'conversations','learner'),{legacyLabel:'تلاعب',updatedAt:serverTimestamp()}))
 await assertFails(updateDoc(doc(db,'conversations','learner'),{userEmail:'another@example.test',updatedAt:serverTimestamp()}))
})
test('an admin read of message A does not clear a newer unread message B even when the text repeats',async()=>{
 const db=user(),admin=user('admin');await send(db,'user','نفس النص');const first=await rows(admin)
 await send(db,'user','نفس النص');const before=(await getDoc(doc(admin,'conversations','learner'))).data()
 await markSupportMessagesRead(admin,'learner','admin',first)
 assert.equal((await getDoc(doc(admin,'conversations','learner'))).data().unreadForAdmin,true)
 await markSupportMessagesRead(admin,'learner','admin',await rows(admin))
 const after=(await getDoc(doc(admin,'conversations','learner'))).data();assert.equal(after.unreadForAdmin,false);assert(after.updatedAt.isEqual(before.updatedAt))
})
test('admin replies reach the user and only the recipient side can acknowledge them',async()=>{
 const db=user(),admin=user('admin');await send(db);const id=await send(admin,'admin','رد الإدارة')
 await assertFails(updateDoc(doc(admin,'conversations','learner','messages',id),{read:true}))
 await assertFails(updateDoc(doc(user('admin2'),'conversations','learner','messages',id),{read:true}))
 await markSupportMessagesRead(db,'learner','user',await rows(db))
 assert.equal((await getDoc(doc(db,'conversations','learner','messages',id))).data().read,true)
 assert.equal((await getDoc(doc(db,'conversations','learner'))).data().unreadForUser,false)
})
test('stale duplicate read receipts from two administrators remain idempotent',async()=>{
 await send(user());const first=await rows(user('admin'))
 await markSupportMessagesRead(user('admin'),'learner','admin',first)
 await assertSucceeds(markSupportMessagesRead(user('admin2'),'learner','admin',first))
})
test('more than500 unread messages are acknowledged in bounded batches',async()=>{
 const stamp=Timestamp.fromMillis(Date.now()-1000)
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore()
  for(let offset=0;offset<501;offset+=300){const b=writeBatch(db);for(let i=offset;i<Math.min(501,offset+300);i++)b.set(doc(db,'conversations','learner','messages','m'+String(i).padStart(4,'0')),{senderId:'learner',senderName:'طالب',text:'رسالة '+i,createdAt:stamp,read:false});await b.commit()}
  await setDoc(doc(db,'conversations','learner'),{userId:'learner',userName:'طالب',userEmail:'learner@example.test',lastMessage:'رسالة 500',lastSenderId:'learner',lastMessageId:'m0500',updatedAt:stamp,unreadForAdmin:true,unreadForUser:false})
 })
 const admin=user('admin');await markSupportMessagesRead(admin,'learner','admin',await rows(admin));assert((await rows(admin)).every(r=>r.read));assert.equal((await getDoc(doc(admin,'conversations','learner'))).data().unreadForAdmin,false)
})
test('explicit admin recovery restores orphan history without rewriting messages or duplicating threads',async()=>{
 const old=Timestamp.fromMillis(Date.now()-5000),latest=Timestamp.fromMillis(Date.now()-2000)
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();await setDoc(doc(db,'users','learner'),{name:'صاحب المحادثة',email:'learner@example.test'})
  await setDoc(doc(db,'conversations','learner','messages','old'),{senderId:'learner',senderName:'قديم',text:'الأقدم',createdAt:old,read:false})
  await setDoc(doc(db,'conversations','learner','messages','latest'),{senderUid:'learner',name:'قديم',message:'الرسالة المخفية',timestamp:latest,read:false})
 })
 const admin=user('admin');assert.equal((await getDocs(collection(admin,'conversations'))).size,0)
 const result=await recoverSupportConversations(admin);assert.equal(result.recovered,1)
 const summary=(await getDoc(doc(admin,'conversations','learner'))).data();assert.equal(summary.lastMessage,'الرسالة المخفية');assert.equal(summary.lastMessageId,'latest');assert(summary.updatedAt.isEqual(latest))
 assert.equal((await getDoc(doc(admin,'conversations','learner','messages','latest'))).data().createdAt,undefined)
 assert.equal((await recoverSupportConversations(admin)).recovered,0)
 await markSupportMessagesRead(admin,'learner','admin',await rows(admin));assert.equal((await getDoc(doc(admin,'conversations','learner'))).data().unreadForAdmin,false)
})
test('normal users and disabled administrators cannot recover or scan everybody\'s messages',async()=>{
 await send(user());await assertFails(getDocs(collectionGroup(user(),'messages')))
 await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users','disabled'),{role:'admin',status:'disabled'}))
 await assertFails(getDocs(collectionGroup(user('disabled'),'messages')))
 await assertFails(recoverSupportConversations(user('disabled')))
})
test('a live admin listener observes an acknowledged user send',async()=>{
 const admin=user('admin');let unsubscribe
 const observed=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Live listener timed out')),10000);unsubscribe=subscribeSupportMessages(admin,'learner',(items,cached)=>{if(!cached&&items.some(r=>r.text==='رسالة مباشرة')){clearTimeout(timer);resolve(items)}},reject)})
 try{await send(user(),'user','رسالة مباشرة');const items=await observed;assert.equal(items[0].pending,false)}finally{unsubscribe?.()}
})
