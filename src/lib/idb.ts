/**
 * Tiny IndexedDB key/value helper.
 *
 * Used to persist the picked Rocket League log FileSystemFileHandle across
 * sessions (handles are structured-cloneable but not JSON-serializable, so they
 * can't live in localStorage). One store, get/set only.
 */

const DB_NAME = "rl-tracker";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  if (typeof indexedDB === "undefined") {
    return undefined;
  }
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function idbDelete(key: string): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
