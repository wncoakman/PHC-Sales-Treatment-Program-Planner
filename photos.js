// Plant photos live in IndexedDB (localStorage is too small for images); the landscape keeps only their ids.
// Photos are shrunk to a JPEG of at most MAX_SIDE pixels before saving.

const DB = "phc-photos", STORE = "photos", MAX_SIDE = 1600, QUALITY = 0.8;

let dbPromise;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

/** Shrinks an image file (camera or library) to a JPEG blob, upright per its EXIF orientation. */
export async function shrinkPhoto(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read that image"))), "image/jpeg", QUALITY));
}

export async function savePhoto(blob) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  await run("readwrite", (s) => s.put(blob, id));
  return id;
}

export const getPhoto = (id) => run("readonly", (s) => s.get(id));
export const deletePhotos = (ids) => ids.length ? run("readwrite", (s) => { ids.forEach((id) => s.delete(id)); }) : Promise.resolve();
export const clearPhotos = () => run("readwrite", (s) => s.clear());

/** A photo as a data URL with its pixel size, for the PDF. */
export async function photoForPdf(id) {
  const blob = await getPhoto(id);
  if (!blob) return null;
  const bmp = await createImageBitmap(blob);
  const size = { width: bmp.width, height: bmp.height };
  bmp.close?.();
  const dataUrl = await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
  return { dataUrl, ...size };
}
