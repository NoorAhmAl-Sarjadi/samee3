
'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import {
  doc,
  onSnapshot,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

/**
 * SAMEE3 – Firebase authentication and live user profile.
 * Path: context/AuthContext.tsx
 *
 * Reads users/{uid} in real time; never writes or changes roles.
 * A user with a missing/unreadable profile is never treated as admin.
 */

export interface UserProfile {
  uid: string
  name: string
  displayName: string
  email: string
  role: 'user' | 'admin'
  status?: string
  createdAt?: unknown
  lastLoginAt?: unknown
  updatedAt?: unknown
  lastReadPage?: number
  lastReadRiwayaId?: string
  lastReadSurahNumber?: number
  lastReadSurahName?: string
  lastReadJuz?: number
  lastReadAyahKey?: string
  lastReadAyahNumber?: number
  lastReadReciterId?: string
  lastReadReciterName?: string
  lastReadMoshafId?: number
  khatmaDays?: number
  khatmaStartDate?: string
  khatmaPagesPerDay?: number
  [key: string]: unknown
}

export type ProfileStatus =
  | 'loading'
  | 'ready'
  | 'missing'
  | 'unavailable'
  | 'signed-out'

interface AuthContextValue {
  user: FirebaseUser | null
  profile: UserProfile | null
  loading: boolean
  isAdmin: boolean
  profileStatus: ProfileStatus
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  profileStatus: 'loading',
})

const PROFILE_TIMEOUT_MS = 7000

function nameFrom(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, 100)
    : ''
}

function fallbackName(user: FirebaseUser): string {
  return (
    nameFrom(user.displayName) ||
    nameFrom(user.email?.split('@')[0]) ||
    'مستخدم مصحف سميع'
  )
}

function makeFallbackProfile(user: FirebaseUser): UserProfile {
  const name = fallbackName(user)

  return {
    uid: user.uid,
    name,
    displayName: name,
    email: user.email || '',
    role: 'user',
  }
}

function makeFirestoreProfile(
  user: FirebaseUser,
  data: DocumentData,
): UserProfile {
  const storedName = nameFrom(data.name)
  const storedDisplayName = nameFrom(data.displayName)
  const name =
    storedName || storedDisplayName || fallbackName(user)

  return {
    ...data,
    uid: user.uid,
    name,
    displayName:
      storedDisplayName || nameFrom(user.displayName) || name,
    email: user.email || nameFrom(data.email),
    role: data.role === 'admin' ? 'admin' : 'user',
  }
}

export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileStatus, setProfileStatus] =
    useState<ProfileStatus>('loading')

  useEffect(() => {
    let active = true
    let generation = 0
    let stopProfile: Unsubscribe | null = null
    let firstSnapshotTimer: number | null = null

    const stopPreviousProfile = () => {
      if (stopProfile) {
        stopProfile()
        stopProfile = null
      }

      if (firstSnapshotTimer !== null) {
        window.clearTimeout(firstSnapshotTimer)
        firstSnapshotTimer = null
      }
    }

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (currentUser) => {
        // Invalidate all callbacks belonging to an earlier login.
        generation += 1
        const thisGeneration = generation
        stopPreviousProfile()

        if (!active) return

        setUser(currentUser)

        if (!currentUser) {
          setProfile(null)
          setProfileStatus('signed-out')
          setLoading(false)
          return
        }

        const fallback = makeFallbackProfile(currentUser)
        setProfile(fallback)
        setProfileStatus('loading')
        setLoading(true)

        const isCurrentSession = () =>
          active && generation === thisGeneration

        // Avoid keeping every screen on an infinite loader when
        // Firestore is temporarily unreachable or the device is offline.
        firstSnapshotTimer = window.setTimeout(() => {
          firstSnapshotTimer = null

          if (!isCurrentSession()) return

          setProfileStatus((previous) =>
            previous === 'loading' ? 'unavailable' : previous,
          )
          setLoading(false)
          // Keep onSnapshot active: data can arrive after the timeout.
        }, PROFILE_TIMEOUT_MS)

        try {
          stopProfile = onSnapshot(
            doc(db, 'users', currentUser.uid),
            (snapshot) => {
              if (!isCurrentSession()) return

              if (firstSnapshotTimer !== null) {
                window.clearTimeout(firstSnapshotTimer)
                firstSnapshotTimer = null
              }

              if (snapshot.exists()) {
                setProfile(
                  makeFirestoreProfile(currentUser, snapshot.data()),
                )
                setProfileStatus('ready')
              } else {
                // A newly created Auth account can reach this state
                // before registration writes users/{uid}.
                // The listener will update as soon as it is created.
                setProfile(makeFallbackProfile(currentUser))
                setProfileStatus('missing')
              }

              setLoading(false)
            },
            (error) => {
              if (!isCurrentSession()) return

              console.error(
                'SAMEE3: Firestore profile listener failed:',
                error.code || 'unknown',
              )

              if (firstSnapshotTimer !== null) {
                window.clearTimeout(firstSnapshotTimer)
                firstSnapshotTimer = null
              }

              // Never keep a stale admin role when profile reads fail.
              setProfile(makeFallbackProfile(currentUser))
              setProfileStatus('unavailable')
              setLoading(false)
            },
          )
        } catch (error) {
          if (!isCurrentSession()) return

          console.error('SAMEE3: Unable to start profile listener', error)
          stopPreviousProfile()
          setProfile(fallback)
          setProfileStatus('unavailable')
          setLoading(false)
        }
      },
      (error) => {
        if (!active) return

        console.error('SAMEE3: Firebase Auth listener failed:', error.code || 'unknown')
        generation += 1
        stopPreviousProfile()
        setUser(null)
        setProfile(null)
        setProfileStatus('unavailable')
        setLoading(false)
      },
    )

    return () => {
      active = false
      generation += 1
      unsubscribeAuth()
      stopPreviousProfile()
    }
  }, [])

  const isAdmin = Boolean(
    user &&
      profile &&
      profile.uid === user.uid &&
      profileStatus === 'ready' &&
      profile.role === 'admin',
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      isAdmin,
      profileStatus,
    }),
    [user, profile, loading, isAdmin, profileStatus],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
