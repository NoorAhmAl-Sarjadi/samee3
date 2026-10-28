import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import {
  getFirestore,
  type Firestore,
} from 'firebase/firestore'
import {
  getAnalytics,
  isSupported,
  type Analytics,
} from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyBFFMauXqzuAlgodtODtVew3fokR8SlokA',
  authDomain: 'samee3-fb475.firebaseapp.com',
  projectId: 'samee3-fb475',
  storageBucket: 'samee3-fb475.firebasestorage.app',
  messagingSenderId: '664276567806',
  appId: '1:664276567806:web:f7a97eea7b64d58a23c7af',
  measurementId: 'G-JXP351V8QW',
}

// تشغيل Firebase مرة واحدة فقط
const app: FirebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig)

const auth: Auth = getAuth(app)
const db: Firestore = getFirestore(app)

// Analytics يعمل في المتصفح فقط
let analytics: Analytics | null = null

if (typeof window !== 'undefined') {
  let checkingAnalytics = false
  const isOnline = () => navigator.onLine !== false
  const startAnalytics = async () => {
    // Analytics is optional. Firebase Installations can reject during an
    // offline startup; it must never interrupt an already downloaded mushaf.
    if (analytics || checkingAnalytics || !isOnline()) return
    checkingAnalytics = true
    try {
      if (await isSupported() && isOnline()) analytics = getAnalytics(app)
    } catch (error) {
      console.warn('Firebase Analytics is not available:', error)
    } finally {
      checkingAnalytics = false
    }
  }
  void startAnalytics()
  window.addEventListener('online', () => { void startAnalytics() })
}

export {
  app,
  auth,
  db,
  analytics,
}