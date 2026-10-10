
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
 * SAMEE3 — Live authentication context.
 * Path: context/AuthContext.tsx
 *
 * Reads users/{uid}; never changes Firestore documents or roles.
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

export interface AuthContextValue {
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

const PROFILE_TIMEOUT_MS = 8000

function safeText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, 100)
    : ''
}

function fallbackProfile(user: FirebaseUser): UserProfile {
  const name =
    safeText(user.displayName) ||
    safeText(user.email?.split('@')[0]) ||
    'مستخدم مصحف سميع'

  return {
    uid: user.uid,
    name,
    displayName: name,
    email: user.email || '',
    role: 'user',
  }
}

function profileFromFirestore(
  user: FirebaseUser,
  data: DocumentData,
  serverVerified: boolean,
): UserProfile {
  const fallback = fallbackProfile(user)

  const name =
    safeText(data.name) ||
    safeText(data.displayName) ||
    fallback.name

  return {
    ...data,
    uid: user.uid,
    name,
    displayName:
      safeText(data.displayName) ||
      safeText(user.displayName) ||
      name,
    email:
      user.email ||
      (typeof data.email === 'string'
        ? data.email
        : ''),
    role:
      serverVerified && data.role === 'admin'
        ? 'admin'
        : 'user',
  }
}

export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [user, setUser] =
    useState<FirebaseUser | null>(null)

  const [profile, setProfile] =
    useState<UserProfile | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [profileStatus, setProfileStatus] =
    useState<ProfileStatus>('loading')

  useEffect(() => {
    let mounted = true
    let session = 0

    let unsubscribeProfile: Unsubscribe | null = null

    let timer:
      | ReturnType<typeof setTimeout>
      | null = null

    function stopProfile() {
      if (unsubscribeProfile) {
        unsubscribeProfile()
        unsubscribeProfile = null
      }

      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    const unsubscribeAuth = onAuthStateChanged(
      auth,

      (currentUser) => {
        session += 1

        const currentSession = session

        stopProfile()

        if (!mounted) return

        setUser(currentUser)

        if (!currentUser) {
          setProfile(null)
          setProfileStatus('signed-out')
          setLoading(false)
          return
        }

        const fallback =
          fallbackProfile(currentUser)

        setProfile(fallback)
        setProfileStatus('loading')
        setLoading(true)

        const isCurrent = () =>
          mounted &&
          session === currentSession

        // Prevent infinite loading when offline.
        timer = setTimeout(() => {
          timer = null

          if (!isCurrent()) return

          setProfileStatus((status) =>
            status === 'loading'
              ? 'unavailable'
              : status,
          )

          setLoading(false)
        }, PROFILE_TIMEOUT_MS)

        try {
          unsubscribeProfile = onSnapshot(
            doc(
              db,
              'users',
              currentUser.uid,
            ),

            {
              includeMetadataChanges: true,
            },

            (snapshot) => {
              if (!isCurrent()) return

              if (timer !== null) {
                clearTimeout(timer)
                timer = null
              }

              if (!snapshot.exists()) {
                setProfile(fallback)

                setProfileStatus(
                  snapshot.metadata.fromCache
                    ? 'unavailable'
                    : 'missing',
                )
              } else {
                const verified =
                  !snapshot.metadata.fromCache &&
                  !snapshot.metadata.hasPendingWrites

                setProfile(
                  profileFromFirestore(
                    currentUser,
                    snapshot.data(),
                    verified,
                  ),
                )

                setProfileStatus(
                  verified
                    ? 'ready'
                    : 'unavailable',
                )
              }

              setLoading(false)
            },

            (error) => {
              if (!isCurrent()) return

              console.error(
                'SAMEE3 Firestore profile error:',
                error,
              )

              if (timer !== null) {
                clearTimeout(timer)
                timer = null
              }

              setProfile(fallback)
              setProfileStatus('unavailable')
              setLoading(false)
            },
          )
        } catch (error) {
          if (!isCurrent()) return

          console.error(
            'SAMEE3 profile subscription error:',
            error,
          )

          stopProfile()

          setProfile(fallback)
          setProfileStatus('unavailable')
          setLoading(false)
        }
      },

      (error) => {
        if (!mounted) return

        // Firebase Auth reports an Error object.
        // Do not assume every error has a code property.
        console.error(
          'SAMEE3 Firebase Auth error:',
          error,
        )

        session += 1

        stopProfile()

        setUser(null)
        setProfile(null)
        setProfileStatus('unavailable')
        setLoading(false)
      },
    )

    return () => {
      mounted = false
      session += 1

      unsubscribeAuth()
      stopProfile()
    }
  }, [])

  const isAdmin = Boolean(
    user &&
      profile &&
      profile.uid === user.uid &&
      profileStatus === 'ready' &&
      profile.role === 'admin' &&
      profile.status !== 'disabled',
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      isAdmin,
      profileStatus,
    }),
    [
      user,
      profile,
      loading,
      isAdmin,
      profileStatus,
    ],
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
