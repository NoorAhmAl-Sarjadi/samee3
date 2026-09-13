import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

export const firebaseConfig={
 apiKey:'AIzaSyBFFMauXqzuAlgodtODtVew3fokR8SlokA',
 authDomain:'samee3-fb475.firebaseapp.com',
 projectId:'samee3-fb475',
 storageBucket:'samee3-fb475.firebasestorage.app',
 messagingSenderId:'664276567806',
 appId:'1:664276567806:web:f7a97eea7b64d58a23c7af',
 measurementId:'G-JXP351V8QW'
};
export const firebaseApp=initializeApp(firebaseConfig);
export const auth=getAuth(firebaseApp);
export const db=initializeFirestore(firebaseApp,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})});
