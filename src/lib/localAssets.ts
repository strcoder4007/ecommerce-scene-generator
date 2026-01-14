export type AssetType = "background" | "model";

export type LocalAsset = {
  id: string;
  title: string;
  theme?: string | null;
  ethnicity?: string | null;
  tags: string[];
  image_url: string; // data URL
  mime_type: string;
  created_at: string;
};

const DB_NAME = "ecommerce-scene-generator";
const DB_VERSION = 1;
const STORE_BACKGROUNDS = "backgrounds";
const STORE_MODELS = "models";

function storeName(assetType: AssetType): string {
  return assetType === "background" ? STORE_BACKGROUNDS : STORE_MODELS;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_BACKGROUNDS)) {
        db.createObjectStore(STORE_BACKGROUNDS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_MODELS)) {
        db.createObjectStore(STORE_MODELS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function listAssets(assetType: AssetType): Promise<LocalAsset[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName(assetType), "readonly");
    const store = tx.objectStore(storeName(assetType));
    const records = await requestToPromise(store.getAll());
    const list = (records as LocalAsset[]).slice();
    list.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    return list;
  } finally {
    db.close();
  }
}

export async function upsertAsset(assetType: AssetType, asset: LocalAsset): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName(assetType), "readwrite");
    const store = tx.objectStore(storeName(assetType));
    await requestToPromise(store.put(asset));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function deleteAsset(assetType: AssetType, id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName(assetType), "readwrite");
    const store = tx.objectStore(storeName(assetType));
    await requestToPromise(store.delete(id));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function clearAssets(assetType: AssetType): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(storeName(assetType), "readwrite");
    const store = tx.objectStore(storeName(assetType));
    await requestToPromise(store.clear());
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function parseTags(raw: string): string[] {
  return (raw || "")
    .split(/[;,]/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  }
}

