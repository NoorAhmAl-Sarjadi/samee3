import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, deleteDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyBFFMauXqzuAlgodtODtVew3fokR8SlokA',
  authDomain: 'samee3-fb475.firebaseapp.com',
  projectId: 'samee3-fb475',
  storageBucket: 'samee3-fb475.firebasestorage.app',
  messagingSenderId: '664276567806',
  appId: '1:664276567806:web:f7a97eea7b64d58a23c7af',
  measurementId: 'G-JXP351V8QW'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const firebaseApi = { doc, getDoc, setDoc, updateDoc, collection, addDoc, deleteDoc, getDocs, query, orderBy, limit, serverTimestamp, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, onAuthStateChanged };

export async function isAdmin(uid){
  if(!uid) return false;
  const snap = await getDoc(doc(db,'admins',uid));
  return snap.exists() && snap.data()?.active === true;
}

export async function ensureUserProfile(user){
  const ref = doc(db,'users',user.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()) await setDoc(ref,{uid:user.uid,email:user.email||'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
}

export async function cloudSaveUser(uid, key, value){
  if(!uid) return;
  await setDoc(doc(db,'users',uid),{[key]:value,updatedAt:serverTimestamp()},{merge:true});
}

export async function cloudSaveList(uid, bucket, item){
  if(!uid) return null;
  return addDoc(collection(db,'users',uid,bucket),{...item,createdAt:serverTimestamp()});
}

export async function cloudLoadList(uid,bucket){
  if(!uid) return [];
  const ref=collection(db,'users',uid,bucket);
  const snap=await getDocs(ref);
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
