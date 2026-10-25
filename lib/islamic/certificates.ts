import { doc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore'
import { CURRICULUM_VERSION, coursesInLevel, normalizeLearningName, type LevelId } from './curriculum'
export type LearningCertificate = { levelId: LevelId; name: string; serial: string; courseIds: string[]; issuedAt?: { toDate?: () => Date }; issuedDate?: string }
export function learningError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code).replace(/^firestore\//,'') : ''
  if (code === 'permission-denied') return 'صلاحيات Firestore تمنع حفظ التقدم أو الشهادة. يلزم نشر ملف firestore.rules الخاص بسميع في مشروع Firebase samee3-fb475، ثم إعادة المحاولة.'
  if (code === 'unauthenticated') return 'انتهت جلسة الحساب. سجّل الخروج ثم الدخول مرة أخرى.'
  if (['unavailable','deadline-exceeded','aborted'].includes(code)) return 'تعذر الاتصال بسجل الشهادات. تأكد من الإنترنت وأعد المحاولة؛ سيُعاد استخدام الشهادة نفسها إذا اكتمل الإصدار.'
  if (code === 'failed-precondition') return 'قاعدة Firestore غير جاهزة للعملية. تحقق من إنشاء Cloud Firestore وتطبيق القواعد المرفقة.'
  return error instanceof Error ? error.message : 'تعذر حفظ الشهادة. أعد المحاولة.'
}
/** A transaction and matching rules guarantee one immutable certificate per level. */
export async function issueCertificate(store: Firestore, uid: string, level: LevelId, enteredName: string): Promise<LearningCertificate> {
  const name = normalizeLearningName(enteredName)
  if (name.length < 2) throw new Error('اكتب الاسم كاملًا قبل إصدار الشهادة.')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('اتصل بالإنترنت لإصدار الشهادة وربطها بحسابك.')
  const ref = doc(store,'users',uid,'libraryCertificates',level), progressRef = doc(store,'users',uid,'libraryProgress','state')
  const courseIds = coursesInLevel(level).map((book)=>book.id)
  const bytes = new Uint8Array(4); crypto.getRandomValues(bytes)
  const serial = `SM3-${level.slice(0,3).toUpperCase()}-${Array.from(bytes,(value)=>value.toString(16).padStart(2,'0')).join('').toUpperCase()}`
  try {
    return await runTransaction(store,async(tx)=>{
      const existing=await tx.get(ref)
      if(existing.exists())return existing.data() as LearningCertificate
      const progress=await tx.get(progressRef), completed:unknown=progress.data()?.completedBookIds
      if(progress.data()?.version!==CURRICULUM_VERSION || !Array.isArray(completed) || courseIds.length!==8 || !courseIds.every((id)=>completed.includes(id)))throw new Error('أكمل كتب المستوى واحفظ التقدم على حسابك أولًا.')
      tx.set(ref,{levelId:level,name,serial,courseIds,curriculumVersion:CURRICULUM_VERSION,issuedAt:serverTimestamp()})
      return {levelId:level,name,serial,courseIds,issuedDate:new Date().toISOString().slice(0,10)}
    })
  } catch(error) { throw new Error(learningError(error)) }
}