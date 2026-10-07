'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import {
  doc,
  getDoc,
} from 'firebase/firestore'
import {
  auth,
  db,
} from '@/lib/firebase'

/* =========================================================
   بيانات المستخدم المحفوظة في Firestore
========================================================= */

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

  khatmaDays?: number
  khatmaStartDate?: string

  [key: string]: unknown
}

/* =========================================================
   قيمة الـ Context
========================================================= */

interface AuthContextValue {
  user: FirebaseUser | null
  profile: UserProfile | null
  loading: boolean
  isAdmin: boolean
}

/* =========================================================
   القيمة الافتراضية
========================================================= */

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
})

/* =========================================================
   Provider
========================================================= */

export function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!mounted) return

        /*
         * أولًا نحفظ حالة Firebase Authentication
         */
        setUser(currentUser)

        /*
         * لا يوجد مستخدم مسجل
         */
        if (!currentUser) {
          setProfile(null)
          setLoading(false)
          return
        }

        try {
          /*
           * جلب بيانات المستخدم من:
           *
           * users/{uid}
           */
          const userRef = doc(
            db,
            'users',
            currentUser.uid,
          )

          const userSnapshot = await getDoc(userRef)

          if (!mounted) return

          if (userSnapshot.exists()) {
            const data = userSnapshot.data()

            const firestoreName =
              typeof data.name === 'string'
                ? data.name.trim()
                : ''

            const firestoreDisplayName =
              typeof data.displayName === 'string'
                ? data.displayName.trim()
                : ''

            /*
             * أولوية الاسم:
             *
             * 1. name في Firestore
             * 2. displayName في Firestore
             * 3. displayName في Firebase Auth
             * 4. الجزء قبل @
             */
            const finalName =
              firestoreName ||
              firestoreDisplayName ||
              currentUser.displayName?.trim() ||
              currentUser.email?.split('@')[0] ||
              'مستخدم مصحف سميع'

            const rawRole = data.role

            const finalRole: 'user' | 'admin' =
              rawRole === 'admin'
                ? 'admin'
                : 'user'

            const nextProfile: UserProfile = {
              ...data,

              uid: currentUser.uid,

              name: finalName,

              displayName:
                firestoreDisplayName ||
                currentUser.displayName?.trim() ||
                finalName,

              email:
                typeof data.email === 'string' &&
                data.email.trim()
                  ? data.email.trim()
                  : currentUser.email || '',

              role: finalRole,
            }

            setProfile(nextProfile)
          } else {
            /*
             * في حالة وجود حساب Firebase Auth
             * ولكن لا يوجد مستند users حتى الآن.
             *
             * ننشئ Profile مؤقت من بيانات Auth
             * بدون الكتابة إلى Firestore هنا.
             */
            const fallbackName =
              currentUser.displayName?.trim() ||
              currentUser.email?.split('@')[0] ||
              'مستخدم مصحف سميع'

            const fallbackProfile: UserProfile = {
              uid: currentUser.uid,

              name: fallbackName,

              displayName: currentUser.displayName?.trim() ||
                fallbackName,

              email: currentUser.email || '',

              role: 'user',
            }

            setProfile(fallbackProfile)
          }
        } catch (error) {
          console.error(
            'Failed to load user profile:',
            error,
          )

          /*
           * حتى لو فشل Firestore،
           * لا نُخرج المستخدم من الحساب.
           *
           * نستخدم بيانات Firebase Auth كحل احتياطي.
           */
          const fallbackName =
            currentUser.displayName?.trim() ||
            currentUser.email?.split('@')[0] ||
            'مستخدم مصحف سميع'

          if (!mounted) return

          setProfile({
            uid: currentUser.uid,

            name: fallbackName,

            displayName:
              currentUser.displayName?.trim() ||
              fallbackName,

            email: currentUser.email || '',

            role: 'user',
          })
        } finally {
          if (mounted) {
            setLoading(false)
          }
        }
      },
    )

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  /* =======================================================
     معرفة هل المستخدم Admin
  ======================================================= */

  const isAdmin =
    profile?.role === 'admin'

  /* =======================================================
     القيمة النهائية للـ Context
  ======================================================= */

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      isAdmin,
    }),
    [
      user,
      profile,
      loading,
      isAdmin,
    ],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

/* =========================================================
   Hook
========================================================= */

export function useAuth() {
  return useContext(AuthContext)
}
