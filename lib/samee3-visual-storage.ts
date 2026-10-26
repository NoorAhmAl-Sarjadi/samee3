/** Store a downloaded Mixkit MP4 locally in the user's browser, avoiding any API key. */
const DB='samee3-visual-clips-v1'
const STORE='videos'

const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{
  if(typeof indexedDB==='undefined')return reject(Error('التخزين المحلي غير متاح'))
  const r=indexedDB.open(DB,1)
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)}
  r.onsuccess=()=>resolve(r.result)
  r.onerror=()=>reject(r.error||Error('تعذّر فتح التخزين'))
})
export async function saveClip(id:string,blob:Blob):Promise<void>{
  const db=await open()
  try{await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite')
    tx.objectStore(STORE).put(blob,id)
    tx.oncomplete=()=>resolve()
    tx.onerror=()=>reject(tx.error||Error('تعذّر حفظ الفيديو'))
  })}finally{db.close()}
}
export async function readClip(id:string):Promise<Blob|null>{
  const db=await open()
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(id)
    r.onsuccess=()=>resolve(r.result instanceof Blob?r.result:null)
    r.onerror=()=>reject(r.error||Error('تعذّر قراءة الفيديو'))
  })}finally{db.close()}
}
export async function clipKeys():Promise<string[]>{
  const db=await open()
  try{return await new Promise((resolve,reject)=>{
    const r=db.transaction(STORE,'readonly').objectStore(STORE).getAllKeys()
    r.onsuccess=()=>resolve(r.result.map(String))
    r.onerror=()=>reject(r.error||Error('تعذّر استعراض القوالب'))
  })}finally{db.close()}
}
export async function removeClip(id:string):Promise<void>{
  const db=await open()
  try{await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete=()=>resolve()
    tx.onerror=()=>reject(tx.error||Error('تعذّر الحذف'))
  })}finally{db.close()}
}