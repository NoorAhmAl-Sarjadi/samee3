import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBFFMauXqzuAlgodtODtVew3fokR8SlokA",
  authDomain: "samee3-fb475.firebaseapp.com",
  projectId: "samee3-fb475",
  storageBucket: "samee3-fb475.firebasestorage.app",
  messagingSenderId: "664276567806",
  appId: "1:664276567806:web:f7a97eea7b64d58a23c7af",
  measurementId: "G-JXP351V8QW"
};

// تشغيل فايربيس مرة واحدة فقط لتجنب الأخطاء
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

// تشغيل الإحصائيات في المتصفح فقط
let analytics;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) analytics = getAnalytics(app);
  });
}

export { app, auth, db, analytics };
