const DB_NAME = "nn-playground";
const STORE = "kv";

function openDatabase() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") {
            reject(new Error("This browser does not support IndexedDB."));
            return;
        }

        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function perform(mode, action) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = action(transaction.objectStore(STORE));

        transaction.oncomplete = () => {
            db.close();
            resolve(request.result);
        };
        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
        transaction.onabort = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

export const storageGet = (key) => perform("readonly", (store) => store.get(key));
export const storageSet = (key, value) => perform("readwrite", (store) => store.put(value, key));
export const storageDelete = (key) => perform("readwrite", (store) => store.delete(key));
