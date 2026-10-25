'use client'

import { issueCertificate, learningError, type LearningCertificate } from './certificates'
export type { LearningCertificate } from './certificates'
import { useCallback, useEffect, useState } from 'react'
import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { CURRICULUM_VERSION, LEARNING_COURSES, type LevelId } from './curriculum'

type Action = { completed: boolean; at: number }
type LocalState = { completed: string[]; pending: Record<string, Action> }
const PREFIX = 'samee3_learning_v1:'
const EVENT = 'samee3-learning-updated'
const inFlight = new Map<string, Promise<void>>()
const validIds = new Set(LEARNING_COURSES.map((book) => book.id))
const cleanIds = (value: unknown): string[] => Array.isArray(value) ? Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && validIds.has(id)))) : []
function readLocal(owner: string): LocalState {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFIX + owner) || '{}'), pending: Record<string, Action> = {}
    for (const [id, value] of Object.entries(raw.pending || {})) {
      const action = value as Action
      if (validIds.has(id) && typeof action.completed === 'boolean' && Number.isFinite(action.at)) pending[id] = action
    }
    return { completed: cleanIds(raw.completed), pending }
  } catch { return { completed: [], pending: {} } }
}
function persist(owner: string, state: LocalState) {
  localStorage.setItem(PREFIX + owner, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent(EVENT, { detail: owner }))
}
function applyActions(ids: string[], pending: LocalState['pending']) {
  const next = new Set(ids)
  Object.entries(pending).forEach(([id, action]) => action.completed ? next.add(id) : next.delete(id))
  return Array.from(next)
}
async function flush(uid: string): Promise<void> {
  if (!navigator.onLine) throw new Error('التقدم محفوظ على الجهاز وسيُزامَن عند عودة الاتصال.')
  const active = inFlight.get(uid)
  if (active) { await active; if (Object.keys(readLocal(uid).pending).length) return flush(uid); return }
  const promise = (async () => {
    const before = readLocal(uid)
    if (!Object.keys(before.pending).length) return
    const ref = doc(db, 'users', uid, 'libraryProgress', 'state')
    const completed = await runTransaction(db, async (tx) => {
      const remote = await tx.get(ref)
      const next = applyActions(cleanIds(remote.data()?.completedBookIds), before.pending)
      tx.set(ref, { version: CURRICULUM_VERSION, completedBookIds: next, updatedAt: serverTimestamp() })
      return next
    })
    const latest = readLocal(uid)
    Object.entries(before.pending).forEach(([id, action]) => { if (latest.pending[id]?.at === action.at) delete latest.pending[id] })
    persist(uid, { completed: applyActions(completed, latest.pending), pending: latest.pending })
  })()
  inFlight.set(uid, promise)
  try { await promise } finally { inFlight.delete(uid) }
}

export function useLearningProgress() {
  const { user, profile, loading } = useAuth()
  const owner = user?.uid || 'guest'
  const [state, setState] = useState<LocalState>({ completed: [], pending: {} })
  const [stateOwner, setStateOwner] = useState('')
  const [certificates, setCertificates] = useState<Partial<Record<LevelId, LearningCertificate>>>({})
  const [ready, setReady] = useState(false)
  const [cloudReady, setCloudReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (loading) return
    let alive = true
    setStateOwner(owner); setState(readLocal(owner)); setCertificates({}); setReady(true); setCloudReady(!user); setError('')
    const refresh = () => { if (alive) setState(readLocal(owner)) }
    const sync = () => { if (user) void flush(user.uid).catch((e: unknown) => { if (alive) setError(learningError(e)) }) }
    const changed = (event: Event) => { if (!(event instanceof CustomEvent) || event.detail === owner) refresh() }
    window.addEventListener(EVENT, changed); window.addEventListener('storage', refresh); window.addEventListener('online', sync)
    const unsubs: Array<() => void> = []
    if (user) {
      unsubs.push(onSnapshot(doc(db, 'users', user.uid, 'libraryProgress', 'state'), { includeMetadataChanges: true }, (snapshot) => {
        if (!alive || snapshot.metadata.hasPendingWrites) return
        const local = readLocal(owner)
        const merged = { completed: applyActions(cleanIds(snapshot.data()?.completedBookIds), local.pending), pending: local.pending }
        try { persist(owner, merged) } catch { setState(merged); setError('مساحة تخزين المتصفح غير متاحة.') }
        setCloudReady(!snapshot.metadata.fromCache)
      }, () => { if (alive) { setCloudReady(false); setError('تعذر الاتصال بسجل التقدم. تأكد من اتصالك وصلاحيات حسابك.') } }))
      unsubs.push(onSnapshot(collection(db, 'users', user.uid, 'libraryCertificates'), (snapshot) => {
        if (!alive) return
        const next: Partial<Record<LevelId, LearningCertificate>> = {}
        snapshot.forEach((item) => { const data = item.data() as LearningCertificate; if (['beginner', 'intermediate', 'advanced'].includes(item.id)) next[item.id as LevelId] = data })
        setCertificates(next)
      }, () => { if (alive) setError('تعذر قراءة سجل الشهادات. يلزم تطبيق قواعد Firestore المرفقة.') }))
      sync()
    }
    return () => { alive = false; unsubs.forEach((off) => off()); window.removeEventListener(EVENT, changed); window.removeEventListener('storage', refresh); window.removeEventListener('online', sync) }
  }, [loading, owner, user?.uid])
  const toggle = useCallback(async (id: string) => {
    if (loading || busy || !validIds.has(id)) return
    setBusy(true); setError('')
    try {
      const local = readLocal(owner), completed = !local.completed.includes(id)
      local.pending[id] = { completed, at: Date.now() + Math.random() }
      local.completed = applyActions(local.completed, local.pending)
      persist(owner, local)
      if (user) await flush(user.uid)
    } catch (e) { setError(learningError(e)) }
    finally { setBusy(false) }
  }, [loading, busy, owner, user?.uid])
  const importGuest = useCallback(async () => {
    if (!user || loading || busy) return
    setBusy(true); setError('')
    try {
      const guest = readLocal('guest'), local = readLocal(owner)
      guest.completed.forEach((id) => { local.pending[id] = { completed: true, at: Date.now() + Math.random() } })
      local.completed = applyActions(local.completed, local.pending)
      persist(owner, local)
      await flush(user.uid)
      persist('guest', { completed: [], pending: {} })
    } catch(e) { setError(learningError(e)) }
    finally { setBusy(false) }
  }, [user?.uid, owner, loading, busy])
  const issue = useCallback(async (level: LevelId, enteredName: string): Promise<LearningCertificate> => {
    if (!user) throw new Error('سجّل الدخول لحفظ الشهادة باسمك.')
    try {
      await flush(user.uid)
      const certificate = await issueCertificate(db, user.uid, level, enteredName)
      setCertificates((old) => ({ ...old, [level]: certificate }))
      return certificate
    } catch (error) { throw new Error(learningError(error)) }
  }, [user?.uid])
  return { completed: stateOwner === owner ? state.completed : [], pending: stateOwner === owner ? Object.keys(state.pending).length : 0, certificates: stateOwner === owner ? certificates : {}, ready: !loading && ready && stateOwner === owner, cloudReady, busy, error, toggle, issue, importGuest, guestAvailable: ready && typeof window !== 'undefined' && readLocal('guest').completed.length > 0, user, profile }
}