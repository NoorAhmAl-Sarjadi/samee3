import { doc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore'
import { CURRICULUM_VERSION, coursesInLevel, normalizeLearningName, type LevelId } from './curriculum'
export type LearningCertificate = { levelId: LevelId; name: string; serial: string; courseIds: string[]; issuedAt?: { toDate?: () => Date }; issuedDate?: string }
/** One immutable document per account and level. Firestore rules enforce the same invariant. */
export async function issueCertificate(store: Firestore, uid: string, level: LevelId, enteredName: string): Promise<LearningCertificate> {
  const name = normalizeLearningName(enteredName)
  if (name.length < 2) throw new Error('اكتب الاسم كاملًا قبل إصدار الشهادة.')
  const ref = doc(store, 'users', uid, 'libraryCertificates', level)
  const progressRef = doc(store, 'users', uid, 'libraryProgress', 'state')
  const courseIds = coursesInLevel(level).map((book) => book.id)
  const serial = `SM3-${level.slice(0,3).toUpperCase()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`
  return runTransaction(store, async (tx) => {
    const existing = await tx.get(ref)
    const progress = await tx.get(progressRef)
    if (existing.exists()) return existing.data() as LearningCertificate
    const completed: unknown = progress.data()?.completedBookIds
    if (progress.data()?.version !== CURRICULUM_VERSION || !Array.isArray(completed) || courseIds.length !== 8 || !courseIds.every((id) => completed.includes(id))) throw new Error('أكمل كتب المستوى واحفظ التقدم على حسابك أولًا.')
    tx.set(ref, { levelId: level, name, serial, courseIds, curriculumVersion: CURRICULUM_VERSION, issuedAt: serverTimestamp() })
    return { levelId: level, name, serial, courseIds, issuedDate: new Date().toISOString().slice(0,10) }
  })
}
