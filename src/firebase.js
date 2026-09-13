import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBFFMauXqzuAlgodtODtVew3fokR8SlokA',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'samee3-fb475.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'samee3-fb475',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'samee3-fb475.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '664276567806',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:664276567806:web:f7a97eea7b64d58a23c7af',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-JXP351V8QW'
};
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
export { app,auth,db };
export const watchAuth=(cb)=>onAuthStateChanged(auth,cb);
export const login=(email,password)=>signInWithEmailAndPassword(auth,email,password);
export const logout=()=>signOut(auth);
export async function register(email,password,name=''){
  const cred=await createUserWithEmailAndPassword(auth,email,password);
  if(name) await updateProfile(cred.user,{displayName:name});
  await ensureUser(cred.user); return cred.user;
}
export async function ensureUser(user){
  if(!user) return;
  await setDoc(doc(db,'users',user.uid),{uid:user.uid,email:user.email||null,displayName:user.displayName||null,updatedAt:serverTimestamp()},{merge:true});
}
export async function isAdmin(uid){
  if(!uid) return false;
  const s=await getDoc(doc(db,'admins',uid));
  return s.exists() && s.data()?.active===true;
}
export async function getSiteConfig(){const s=await getDoc(doc(db,'content','site')); return s.exists()?s.data():null;}
export async function setSiteConfig(uid,data){if(!(await isAdmin(uid))) throw new Error('غير مصرح'); return setDoc(doc(db,'content','site'),{...data,updatedAt:serverTimestamp()},{merge:true});}
export async function getUserSettings(uid){const s=await getDoc(doc(db,'users',uid,'settings','app'));return s.exists()?s.data():null;}
export async function setUserSettings(uid,data){return setDoc(doc(db,'users',uid,'settings','app'),{...data,updatedAt:serverTimestamp()},{merge:true});}
export async function saveBookmark(uid,item){return setDoc(doc(db,'users',uid,'bookmarks',String(item.id)),{...item,updatedAt:serverTimestamp()},{merge:true});}
export async function removeBookmark(uid,id){return deleteDoc(doc(db,'users',uid,'bookmarks',String(id)));}
export async function listBookmarks(uid){const s=await getDocs(query(collection(db,'users',uid,'bookmarks'),orderBy('updatedAt','desc')));return s.docs.map(d=>({id:d.id,...d.data()}));}
export async function saveNote(uid,item){return setDoc(doc(db,'users',uid,'notes',String(item.id)),{...item,updatedAt:serverTimestamp()},{merge:true});}
