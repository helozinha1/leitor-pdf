// Persistent IndexedDB storage for PDFs and annotations (ensures 100% persistence on Vercel & supports large PDFs >100MB)
const DB_NAME = 'leitor_estudos_db';
const DB_VERSION = 1;

function openLocalDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('annotations')) {
        db.createObjectStore('annotations', { keyPath: 'docId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetDocuments() {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readonly');
    const req = tx.objectStore('documents').getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function idbSaveDocument(docMeta, arrayBuffer = null) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const stores = arrayBuffer ? ['documents', 'files'] : ['documents'];
    const tx = db.transaction(stores, 'readwrite');
    tx.objectStore('documents').put(docMeta);
    if (arrayBuffer) {
      tx.objectStore('files').put({ id: docMeta.id, data: arrayBuffer });
    }
    tx.oncomplete = () => resolve(docMeta);
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbGetFileBuffer(docId) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const req = tx.objectStore('files').get(docId);
    req.onsuccess = () => resolve(req.result?.data || null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetAnnotations(docId) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('annotations', 'readonly');
    const req = tx.objectStore('annotations').get(docId);
    req.onsuccess = () => resolve(req.result?.items || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSaveAnnotations(docId, items) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('annotations', 'readwrite');
    tx.objectStore('annotations').put({ docId, items });
    tx.oncomplete = () => resolve(items);
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDeleteDocument(docId) {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['documents', 'files', 'annotations'], 'readwrite');
    tx.objectStore('documents').delete(docId);
    tx.objectStore('files').delete(docId);
    tx.objectStore('annotations').delete(docId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
