// util.js — 공용 헬퍼
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function normUrl(u) {
  u = (u || "").trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : "https://" + u;
}
export function optionLink(o) {
  return o.url ? normUrl(o.url) : "https://map.kakao.com/?q=" + encodeURIComponent(o.name);
}

// 갤러리 사진을 받아 축소 → JPEG dataURL (저장 용량 절약)
// iOS의 HEIC/대용량 사진은 createImageBitmap 경로가 더 안정적이라 그걸 먼저 시도한다.
export async function fileToDownscaledDataURL(file, maxDim = 1280, quality = 0.82) {
  const draw = (src, w, h) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(src, 0, 0, w, h);
    return c.toDataURL("image/jpeg", quality);
  };
  const fit = (w, h) => {
    if (w > h && w > maxDim) return [maxDim, Math.round((h * maxDim) / w)];
    if (h > maxDim) return [Math.round((w * maxDim) / h), maxDim];
    return [w, h];
  };

  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      const [w, h] = fit(bmp.width, bmp.height);
      const out = draw(bmp, w, h);
      if (bmp.close) bmp.close();
      return out;
    } catch (e) { /* 아래 폴백으로 */ }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const [w, h] = fit(img.naturalWidth || img.width, img.naturalHeight || img.height);
      const out = draw(img, w, h);
      URL.revokeObjectURL(url);
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지를 읽지 못했어요 (지원되지 않는 형식일 수 있어요)")); };
    img.src = url;
  });
}

// 사진 촬영일 자동 추출: EXIF DateTimeOriginal → "YYYY-MM-DD".
// 없거나 실패하면 파일 수정일로 대체. 절대 throw 하지 않음.
export function readPhotoDate(file) {
  const ymd = (ms) => { const d = new Date(ms || Date.now()); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => { let r = null; try { r = parseExifDate(fr.result); } catch (e) {} resolve(r || ymd(file.lastModified)); };
    fr.onerror = () => resolve(ymd(file.lastModified));
    try { fr.readAsArrayBuffer(file.slice(0, 256 * 1024)); } catch (e) { resolve(ymd(file.lastModified)); }
  });
}
function parseExifDate(buf) {
  const v = new DataView(buf), len = v.byteLength;
  if (len < 4 || v.getUint16(0) !== 0xFFD8) return null; // JPEG SOI
  let off = 2;
  while (off + 4 <= len) {
    const marker = v.getUint16(off);
    if (marker === 0xFFE1) { // APP1
      const start = off + 4;
      if (v.getUint32(start) !== 0x45786966) return null; // "Exif"
      const tiff = start + 6;
      const little = v.getUint16(tiff) === 0x4949;
      const ifd0 = tiff + v.getUint32(tiff + 4, little);
      const es0 = readEntries(v, ifd0, little);
      const exifPtr = es0.find((e) => e.tag === 0x8769);
      let date = null;
      if (exifPtr) date = getDate(v, tiff + v.getUint32(exifPtr.valOff, little), tiff, little);
      if (!date) date = getDate(v, ifd0, tiff, little);
      return date;
    }
    if (marker === 0xFFDA || (marker & 0xFF00) !== 0xFF00) break;
    off += 2 + v.getUint16(off + 2);
  }
  return null;
}
function readEntries(v, ifd, little) {
  const n = v.getUint16(ifd, little), out = [];
  for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; out.push({ tag: v.getUint16(e, little), valOff: e + 8 }); }
  return out;
}
function getDate(v, ifd, tiff, little) {
  const es = readEntries(v, ifd, little);
  const e = es.find((x) => x.tag === 0x9003) || es.find((x) => x.tag === 0x9004) || es.find((x) => x.tag === 0x0132);
  if (!e) return null;
  const off = tiff + v.getUint32(e.valOff, little);
  let s = ""; for (let i = 0; i < 19; i++) { const c = v.getUint8(off + i); if (!c) break; s += String.fromCharCode(c); }
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
