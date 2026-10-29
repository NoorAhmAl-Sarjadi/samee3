import {
  collection, collectionGroup, doc, documentId, getDoc, getDocsFromServer,
  limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, startAfter,
  Timestamp, writeBatch, type Firestore, type QueryDocumentSnapshot, type Unsubscribe,
} from 'firebase/firestore'

export type SupportMessage = {
  id: string; senderId: string; senderName: string; text: string
  read: boolean; createdAt: Timestamp | null; pending: boolean
}
export type MessageSide = 'user' | 'admin'
const text = (value: unknown, maximum: number, fallback = '') => typeof value === 'string' && value.trim() ? value.trim().slice(0, maximum) : fallback

export function messageTimestamp(value: unknown): Timestamp | null {
  if (value instanceof Timestamp) return value
  if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
    const v = value as { seconds: unknown; nanoseconds: unknown }
    if (typeof v.seconds === 'number' && typeof v.nanoseconds === 'number') {
      try { return new Timestamp(v.seconds, v.nanoseconds) } catch { return null }
    }
  }
  const milliseconds = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN
  if (!Number.isFinite(milliseconds)) return null
  try { return Timestamp.fromMillis(milliseconds) } catch { return null }
}
export function normalizeSupportMessage(id: string, data: Record<string, unknown>, threadId: string, pending = false): SupportMessage {
  const sender = text(data.senderId || data.senderUid || data.sender, 128)
  return {
    id, senderId: sender === 'user' ? threadId : sender,
    senderName: text(data.senderName || data.name, 100, 'مستخدم مصحف سميع'),
    text: text(data.text || data.message, 5000), read: data.read === true,
    createdAt: messageTimestamp(data.createdAt ?? data.timestamp ?? data.sentAt), pending,
  }
}
export function sortSupportMessages(rows: SupportMessage[]): SupportMessage[] {
  return rows.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
    || (a.createdAt?.nanoseconds || 0) - (b.createdAt?.nanoseconds || 0) || a.id.localeCompare(b.id))
}
export function incomingSupportMessage(message: SupportMessage, threadId: string, side: MessageSide): boolean {
  return !message.pending && Boolean(message.senderId) && (side === 'admin' ? message.senderId === threadId : message.senderId !== threadId)
}
export function supportMessageError(error: unknown, administrator = false): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code).replace(/^firestore\//, '') : ''
  if (code === 'permission-denied') return administrator
    ? 'رفضت صلاحيات الرسائل العملية. يجب نشر قواعد Firestore المرافقة، وحساب الإدارة يحتاج role = admin وحالة نشطة في مستند المستخدم.'
    : 'لم تسمح خدمة الرسائل بهذه العملية. أعد تسجيل الدخول ثم حاول مجددًا؛ رسالتك لم تُؤكد على الخادم.'
  if (code === 'unauthenticated') return 'انتهت جلسة تسجيل الدخول. سجّل الدخول مجددًا ثم أعد المحاولة.'
  if (['unavailable', 'deadline-exceeded'].includes(code)) return 'تعذر الاتصال بخادم الرسائل. النص محفوظ في خانة الكتابة؛ أعد المحاولة عند عودة الاتصال.'
  if (code === 'resource-exhausted') return 'خدمة الرسائل وصلت إلى حد الاستخدام مؤقتًا. حاول لاحقًا.'
  return 'تعذر إتمام عملية الرسائل. راجع الاتصال ثم أعد المحاولة.'
}
export function subscribeSupportMessages(db: Firestore, threadId: string, next: (rows: SupportMessage[], fromCache: boolean) => void, error: (cause: Error) => void, reader?: MessageSide): Unsubscribe {
  // A createdAt order excludes older messages that stored timestamp/sentAt.
  // Read this one private subcollection and sort its compatible timestamps locally.
  let active = true, processing = false, receiptsPaused = false, queued: SupportMessage[] | null = null
  const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible'
  const drain = async () => {
    if (processing || !reader || receiptsPaused || !visible()) return
    processing = true
    try {
      while (active && queued && visible()) { const rows = queued; queued = null; await markSupportMessagesRead(db, threadId, reader, rows) }
    } catch (cause) { queued = null; receiptsPaused = true; if (active) error(cause instanceof Error ? cause : new Error('Read receipt failed')) }
    finally { processing = false }
  }
  const resume = () => { if (active && visible()) void drain() }
  if (reader && typeof document !== 'undefined') document.addEventListener('visibilitychange', resume)
  const unsubscribe = onSnapshot(collection(db, 'conversations', threadId, 'messages'), { includeMetadataChanges: true }, (snapshot) => {
    if (!active) return
    const rows = sortSupportMessages(snapshot.docs.map((item) => normalizeSupportMessage(item.id, item.data({ serverTimestamps: 'estimate' }), threadId, item.metadata.hasPendingWrites)))
    next(rows, snapshot.metadata.fromCache)
    if (reader && !snapshot.metadata.fromCache) { queued = rows; void drain() }
  }, error)
  return () => { active = false; queued = null; if (reader && typeof document !== 'undefined') document.removeEventListener('visibilitychange', resume); unsubscribe() }
}
export async function sendSupportMessage(db: Firestore, args: {
  threadId: string; senderId: string; senderName: string; side: MessageSide; body: string
  userName: string; userEmail: string
}): Promise<string> {
  const body = args.body.trim()
  if (!body || body.length > 5000) throw new Error('الحد الأقصى للرسالة 5000 حرف.')
  if (!args.threadId || !args.senderId || args.threadId.includes('/') || (args.side === 'user' && args.threadId !== args.senderId)) throw new Error('بيانات المحادثة غير صحيحة.')
  const thread = doc(db, 'conversations', args.threadId), message = doc(collection(thread, 'messages'))
  const batch = writeBatch(db)
  batch.set(thread, {
    userId: args.threadId, userName: text(args.userName, 100, 'مستخدم مصحف سميع'), userEmail: text(args.userEmail, 320),
    lastMessage: body, lastSenderId: args.senderId, lastMessageId: message.id, updatedAt: serverTimestamp(),
    unreadForAdmin: args.side === 'user', unreadForUser: args.side === 'admin',
  }, { merge: true })
  batch.set(message, { senderId: args.senderId, senderName: text(args.senderName, 100, 'مستخدم مصحف سميع'), text: body, createdAt: serverTimestamp(), read: false })
  // Resolution means a server acknowledgement, not merely a local snapshot.
  await batch.commit()
  return message.id
}
function sameTime(a: unknown, b: unknown) {
  const left = messageTimestamp(a), right = messageTimestamp(b)
  return Boolean(left && right && left.seconds === right.seconds && left.nanoseconds === right.nanoseconds)
}
export async function markSupportMessagesRead(db: Firestore, threadId: string, side: MessageSide, visible: SupportMessage[]): Promise<void> {
  const incoming = visible.filter((row) => !row.read && incomingSupportMessage(row, threadId, side))
  for (let offset = 0; offset < incoming.length; offset += 350) {
    const batch = writeBatch(db)
    for (const row of incoming.slice(offset, offset + 350)) batch.update(doc(db, 'conversations', threadId, 'messages', row.id), { read: true })
    await batch.commit()
  }
  if (!visible.length) return
  const flag = side === 'admin' ? 'unreadForAdmin' : 'unreadForUser'
  await runTransaction(db, async (transaction) => {
    const thread = doc(db, 'conversations', threadId), snapshot = await transaction.get(thread)
    if (!snapshot.exists()) return
    const data = snapshot.data()
    if (data[flag] !== true) return
    const candidate = typeof data.lastMessageId === 'string' ? visible.find((row) => row.id === data.lastMessageId) : visible[visible.length - 1]
    if (!candidate || !incomingSupportMessage(candidate, threadId, side) || data.lastSenderId !== candidate.senderId || data.lastMessage !== candidate.text) return
    // Keep a newer unseen message unread, including an identical repeated text.
    if (candidate.createdAt && !sameTime(data.updatedAt, candidate.createdAt)) return
    if (!candidate.createdAt && data.lastMessageId !== candidate.id) return
    // Reading must not reorder the inbox or change the message's revision time.
    transaction.update(thread, { [flag]: false })
  })
}

/** Explicit administrator recovery of messages saved by older clients without a parent summary. */
export async function recoverSupportConversations(db: Firestore, progress?: (scanned: number, recovered: number) => void, signal?: AbortSignal): Promise<{ scanned: number; recovered: number }> {
  let cursor: QueryDocumentSnapshot | undefined, scanned = 0, recovered = 0
  const candidates = new Map<string, SupportMessage>()
  do {
    if (signal?.aborted) throw new Error('أُوقفت مراجعة المحادثات.')
    const base = collectionGroup(db, 'messages')
    const page = await getDocsFromServer(cursor ? query(base, orderBy(documentId()), startAfter(cursor), limit(250)) : query(base, orderBy(documentId()), limit(250)))
    for (const item of page.docs) {
      scanned++
      const parts = item.ref.path.split('/')
      if (parts.length !== 4 || parts[0] !== 'conversations') continue
      const row = normalizeSupportMessage(item.id, item.data(), parts[1])
      if (!row.text || !row.senderId) continue
      const old = candidates.get(parts[1])
      if (!old || (row.createdAt?.toMillis() || 0) >= (old.createdAt?.toMillis() || 0)) candidates.set(parts[1], row)
    }
    progress?.(scanned, recovered)
    cursor = page.docs.length === 250 ? page.docs[page.docs.length - 1] : undefined
  } while (cursor)
  for (const [threadId, last] of candidates) {
    if (signal?.aborted) throw new Error('أُوقفت مراجعة المحادثات.')
    const thread = doc(db, 'conversations', threadId)
    if ((await getDoc(thread)).exists()) continue
    const owner = await getDoc(doc(db, 'users', threadId)), identity = owner.data() || {}
    const created = await runTransaction(db, async (transaction) => {
      if ((await transaction.get(thread)).exists()) return false
      transaction.set(thread, {
        userId: threadId, userName: text(identity.name || identity.displayName, 100, last.senderId === threadId ? last.senderName : 'مستخدم مصحف سميع'),
        userEmail: text(identity.email, 320), lastMessage: last.text, lastSenderId: last.senderId, lastMessageId: last.id,
        updatedAt: last.createdAt || Timestamp.now(), unreadForAdmin: last.senderId === threadId && !last.read, unreadForUser: last.senderId !== threadId && !last.read,
      })
      return true
    })
    if (created) recovered++
    progress?.(scanned, recovered)
  }
  return { scanned, recovered }
}