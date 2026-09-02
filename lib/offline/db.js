'use client'

/**
 * The small piece of IndexedDB this app needs.
 *
 * Hand-rolled rather than pulling in a wrapper: two object stores and four
 * operations do not justify a dependency, and this codebase has kept its
 * dependency list short deliberately.
 *
 * Every call resolves rather than rejecting. A queued action is a
 * best-effort convenience — if the browser refuses storage (private mode,
 * a quota, an embedded webview), the caller falls back to the plain online
 * path and the person is told. Nothing here may be the reason a tanod
 * cannot file something.
 */

const DB_NAME = 'bh360-offline'
const DB_VERSION = 1

export const OUTBOX = 'outbox'
export const SNAPSHOTS = 'snapshots'

let dbPromise = null

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    let request
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      return resolve(null)
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(OUTBOX)) {
        // autoIncrement gives the queue its order for free: a lower key was
        // enqueued earlier, which is the order it has to replay in.
        db.createObjectStore(OUTBOX, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(SNAPSHOTS)) {
        db.createObjectStore(SNAPSHOTS, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
  return dbPromise
}

function run(storeName, mode, fn) {
  return openDb().then(db => {
    if (!db) return null
    return new Promise(resolve => {
      let tx
      try {
        tx = db.transaction(storeName, mode)
      } catch {
        return resolve(null)
      }
      const store = tx.objectStore(storeName)
      let result = null
      try {
        const request = fn(store)
        if (request) request.onsuccess = () => { result = request.result }
      } catch {
        return resolve(null)
      }
      tx.oncomplete = () => resolve(result)
      tx.onerror = () => resolve(null)
      tx.onabort = () => resolve(null)
    })
  })
}

export const put = (store, value) => run(store, 'readwrite', s => s.put(value))
export const get = (store, key) => run(store, 'readonly', s => s.get(key))
export const all = (store) => run(store, 'readonly', s => s.getAll()).then(rows => rows || [])
export const del = (store, key) => run(store, 'readwrite', s => s.delete(key))
export const clear = (store) => run(store, 'readwrite', s => s.clear())

/** Signing out must not leave the next person's rows on a shared phone. */
export async function clearAll() {
  await clear(OUTBOX)
  await clear(SNAPSHOTS)
}

/** Testing seam — lets a suite hand in a fake store. */
export function __setDbPromise(p) { dbPromise = p }
