'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShieldCheck,
  LockKeyhole,
  Loader2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

interface AdminGateProps {
  children: React.ReactNode
}

export default function AdminGate({ children }: AdminGateProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.replace('/auth')
      return
    }

    const checkAdmin = async () => {
      setCheckingAdmin(true)
      setError('')

      try {
        const userRef = doc(db, 'users', user.uid)
        const snapshot = await getDoc(userRef)

        if (!snapshot.exists()) {
          setIsAdmin(false)
          return
        }

        const data = snapshot.data()
        const role = String(data?.role || '').trim().toLowerCase()

        // يقبل فقط الدور الصريح "admin".
        setIsAdmin(role === 'admin')
      } catch (err) {
        console.error('Admin permission check error:', err)
        setIsAdmin(false)
        setError('تعذر التحقق من صلاحيات الإدارة حاليًا.')
      } finally {
        setCheckingAdmin(false)
      }
    }

    void checkAdmin()
  }, [loading, user, router])

  if (loading || checkingAdmin) {
    return (
      <div
        className="min-h-screen bg-gray-50 flex items-center justify-center p-6"
        dir="rtl"
      >
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center w-full max-w-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#075640]/10 flex items-center justify-center">
            <Loader2
              size={28}
              className="text-[#075640] animate-spin"
            />
          </div>

          <h1 className="font-black text-gray-900 mt-5">
            جاري التحقق من الصلاحيات
          </h1>

          <p className="text-sm text-gray-400 leading-7 mt-2">
            لحظة واحدة، يتم التأكد من أن الحساب يملك صلاحية الإدارة.
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!isAdmin) {
    return (
      <div
        className="min-h-screen bg-mushaf-paper flex items-center justify-center p-6"
        dir="rtl"
      >
        <div className="w-full max-w-md bg-white rounded-3xl border border-red-100 shadow-sm p-7 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-50 flex items-center justify-center">
            {error ? (
              <AlertTriangle
                size={30}
                className="text-red-500"
              />
            ) : (
              <LockKeyhole
                size={30}
                className="text-red-500"
              />
            )}
          </div>

          <h1 className="text-xl font-black text-gray-900 mt-5">
            الوصول إلى لوحة الإدارة غير متاح
          </h1>

          <p className="text-sm text-gray-500 leading-7 mt-3">
            هذا الحساب لا يملك دور الإدارة المطلوب لدخول هذه الصفحة.
          </p>

          {error && (
            <p className="mt-4 rounded-2xl bg-red-50 text-red-600 text-xs font-bold leading-6 p-3">
              {error}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              type="button"
              onClick={() => router.replace('/')}
              className="flex-1 rounded-2xl bg-[#075640] text-white py-3.5 font-black text-sm flex items-center justify-center gap-2"
            >
              <ArrowRight size={17} />
              العودة للتطبيق
            </button>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs font-bold text-gray-500 flex items-center justify-center gap-2">
              <ShieldCheck size={16} className="text-[#c6a15a]" />
              محمي بصلاحيات Firebase
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
