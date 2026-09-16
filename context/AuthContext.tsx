'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, User } from 'firebase/auth'

// إنشاء سياق (Context) لحفظ بيانات المستخدم
const AuthContext = createContext<{ user: User | null; loading: boolean }>({
  user: null,
  loading: true,
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // مراقبة حالة تسجيل الدخول من فايربيس
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

// دالة مخصصة لاستخدام بيانات المستخدم في أي صفحة بسهولة
export const useAuth = () => useContext(AuthContext)
