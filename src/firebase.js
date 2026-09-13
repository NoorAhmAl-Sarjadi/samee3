import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, updateProfile } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBFFMauXqzuAlgodtODtVew3fokR8SlokA',
  authDomain: 'samee3-fb475.firebaseapp.com',
  projectId: 'samee3-fb475',
  storageBucket: 'samee3-fb475.firebasestorage.app',
  messagingSenderId: '664276567806',
  appId: '1:664276567806:web:f7a97eea7b64d58a23c7af',
  measurementId: 'G-JXP351V8QW'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const watchAuth = cb => onAuthStateChanged(auth, cb);
export const login = (email,password) => signInWithEmailAndPassword(auth,email,password);
export const register = async (email,password,name='') => {
  const cred = await createUserWithEmailAndPassword(auth,email,password);
  if (name) await updateProfile(cred.user,{displayName:name});
  await ensureUser(cred.user);
  return cred.user;
};
export const resetPassword = email => sendPasswordResetEmail(auth,email);
export const logout = () => signOut(auth);

export async function ensureUser(user){
  if(!user) return;
  await setDoc(doc(db,'users',user.uid),{
    uid:user.uid,
    email:user.email || null,
    displayName:user.displayName || null,
    updatedAt:serverTimestamp()
  },{merge:true});
}
export async function isAdmin(uid){
  if(!uid) return false;
  try{
    const snap = await getDoc(doc(db,'admins',uid));
    return snap.exists() && snap.data()?.active === true;
  }catch{return false;}
}
export async function getSiteConfig(){
  try{
    const snap = await getDoc(doc(db,'content','site'));
    return snap.exists() ? snap.data() : null;
  }catch{return null;}
}
export async function setSiteConfig(uid,data){
  if(!await isAdmin(uid)) throw new Error('غير مصرح');
  return setDoc(doc(db,'content','site'),{...data,updatedAt:serverTimestamp()},{merge:true});
}
export async function getUserSettings(uid){
  try{
    const snap = await getDoc(doc(db,'users',uid,'settings','app'));
    return snap.exists() ? snap.data() : null;
  }catch{return null;}
}
export async function setUserSettings(uid,data){
  return setDoc(doc(db,'users',uid,'settings','app'),{...data,updatedAt:serverTimestamp()},{merge:true});
}
export async function saveBookmark(uid,item){
  return setDoc(doc(db,'users',uid,'bookmarks',String(item.id)),{...item,updatedAt:serverTimestamp()},{merge:true});
}
export async function removeBookmark(uid,id){return deleteDoc(doc(db,'users',uid,'bookmarks',String(id)));}
export async function listBookmarks(uid){
  try{
    const snap = await getDocs(query(collection(db,'users',uid,'bookmarks'),orderBy('updatedAt','desc')));
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  }catch{return [];}
}
export { app, auth, db };
