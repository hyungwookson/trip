// ============================================================
// store.js — 상태 + 저장소 + 사진저장 + CRUD
//
//  데이터(plans/votes)   →  Firebase 있으면 Firestore(실시간), 없으면 localStorage
//  사진(option별 1장)     →  Firebase 있으면 Firestore 'photos', 없으면 IndexedDB
//
//  votes/photos 는 option.id 기준.  selectedId 가 null 이면 "미정".
// ============================================================

import { SEED } from "./data.js";
import { CONFIG, FIREBASE_ON } from "./config.js";
import { fileToDownscaledDataURL } from "./util.js";

const stateData = { plans: {}, votes: {}, visited: {}, albums: {}, photoMeta: {} };
const clone = (x) => JSON.parse(JSON.stringify(x));
export const genId = () => Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

let onChangeCb = null;
const photoCache = new Map();

// ---- Firebase 핸들 (데이터/사진 공용) ----
let fbHandles = null;
async function initFirebase() {
  if (fbHandles) return fbHandles;
  const appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const authMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const app = appMod.initializeApp(CONFIG.firebase);
  const db = fs.getFirestore(app);
  const auth = authMod.getAuth(app);
  fbHandles = { fs, db, authMod, auth };
  return fbHandles;
}

// ============================================================
// 데이터 백엔드
// ============================================================
function firebaseData() {
  let ref, fs;
  return {
    async init() {
      const h = await initFirebase(); fs = h.fs;
      ref = fs.doc(h.db, "trips", CONFIG.tripId);
      const snap = await fs.getDoc(ref);
      if (snap.exists()) { const d = snap.data(); stateData.plans = d.plans || {}; stateData.votes = d.votes || {}; stateData.visited = d.visited || {}; stateData.albums = d.albums || {}; stateData.photoMeta = d.photoMeta || {}; }
      else { stateData.plans = clone(SEED); stateData.votes = {}; stateData.visited = {}; stateData.albums = {}; stateData.photoMeta = {}; await fs.setDoc(ref, { plans: stateData.plans, votes: stateData.votes, visited: stateData.visited, albums: stateData.albums, photoMeta: stateData.photoMeta }); }
      fs.onSnapshot(ref, (s) => {
        if (!s.exists()) return;
        const d = s.data(); stateData.plans = d.plans || {}; stateData.votes = d.votes || {}; stateData.visited = d.visited || {}; stateData.albums = d.albums || {}; stateData.photoMeta = d.photoMeta || {};
        if (onChangeCb) onChangeCb();
      });
    },
    async persist() { await fs.setDoc(ref, { plans: stateData.plans, votes: stateData.votes, visited: stateData.visited, albums: stateData.albums, photoMeta: stateData.photoMeta }); },
  };
}
function localData() {
  const KEY = "trip-data-v3";
  return {
    async init() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) { const d = JSON.parse(raw); stateData.plans = d.plans || {}; stateData.votes = d.votes || {}; stateData.visited = d.visited || {}; stateData.albums = d.albums || {}; stateData.photoMeta = d.photoMeta || {}; return; }
      } catch (e) {}
      stateData.plans = clone(SEED); stateData.votes = {}; stateData.visited = {}; stateData.albums = {}; stateData.photoMeta = {}; await this.persist();
    },
    async persist() {
      try { localStorage.setItem(KEY, JSON.stringify({ plans: stateData.plans, votes: stateData.votes, visited: stateData.visited, albums: stateData.albums, photoMeta: stateData.photoMeta })); }
      catch (e) { console.warn("저장 실패(용량 초과 가능):", e); }
    },
  };
}

// ============================================================
// 사진 백엔드
// ============================================================
function firebasePhoto() {
  return {
    async get(id) { const { fs, db } = await initFirebase(); const s = await fs.getDoc(fs.doc(db, "photos", id)); return s.exists() ? s.data().data : null; },
    async set(id, dataUrl) { const { fs, db } = await initFirebase(); await fs.setDoc(fs.doc(db, "photos", id), { data: dataUrl }); },
    async del(id) { const { fs, db } = await initFirebase(); await fs.deleteDoc(fs.doc(db, "photos", id)); },
  };
}
function idbPhoto() {
  const DB = "tripPhotos", STORE = "photos"; let dbp = null;
  const open = () => (dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const run = (mode, fn) => open().then((db) => new Promise((res, rej) => {
    const st = db.transaction(STORE, mode).objectStore(STORE); const rq = fn(st);
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  }));
  return {
    get: (id) => run("readonly", (st) => st.get(id)).then((v) => v || null),
    set: (id, dataUrl) => run("readwrite", (st) => st.put(dataUrl, id)),
    del: (id) => run("readwrite", (st) => st.delete(id)),
  };
}

const dataBackend = FIREBASE_ON ? firebaseData() : localData();
const photoBackend = FIREBASE_ON ? firebasePhoto() : idbPhoto();

// ============================================================
// 공개 API
// ============================================================
export const store = {
  mode: FIREBASE_ON ? "firebase" : "local",
  firebaseEnabled: FIREBASE_ON,
  async load() { await dataBackend.init(); await this._normalize(); },
  async _normalize() {
    let changed = false;
    for (const sid in stateData.plans)
      for (const p of (stateData.plans[sid] || [])) {
        for (const it of (p.items || [])) {
          if (!Array.isArray(it.memories)) { it.memories = []; }
          for (const op of (it.options || [])) {
            if (Array.isArray(op.memories) && op.memories.length) { it.memories.push(...op.memories); op.memories = []; changed = true; }
          }
        }
        // 구버전: 통합 "숙소" 그룹 → 각 날짜에 숙소 일정으로 복제 (원본 "숙소" 그룹은 제거)
        const stayItems = (p.items || []).filter((it) => it.group === "숙소");
        const dayGroups = [...new Set((p.items || []).filter((it) => it.group && it.group !== "숙소").map((it) => it.group))];
        if (stayItems.length && dayGroups.length) {
          const dupes = [];
          for (const day of dayGroups)
            for (const s of stayItems)
              dupes.push({
                id: genId(), group: day, time: s.time || "숙박", label: "숙소", kind: "place", selectedId: null, memories: [],
                options: (s.options || []).map((o) => ({ id: genId(), name: o.name, memo: o.memo || "", url: o.url || "", lat: o.lat || "", lng: o.lng || "", hasPhoto: false })),
              });
          p.items = (p.items || []).filter((it) => it.group !== "숙소").concat(dupes);
          changed = true;
        }
      }
    if (changed) { try { await this._persist(); } catch (e) {} }
  },
  subscribe(cb) { onChangeCb = cb; },
  _persist() { return dataBackend.persist(); },

  // ---- 구글 로그인 / 주인 확인 ----
  async initAuth() {
    const { authMod, auth } = await initFirebase();
    try { await authMod.getRedirectResult(auth); } catch (e) { console.error("redirect result:", e); }
  },
  async onUserChanged(cb) { const { authMod, auth } = await initFirebase(); authMod.onAuthStateChanged(auth, cb); },
  async signInGoogle() {
    const h = fbHandles || await initFirebase();
    const provider = new h.authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const ua = navigator.userAgent || "";
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) { await h.authMod.signInWithRedirect(h.auth, provider); return null; } // iOS: 리다이렉트(ITP 안정)
    try {
      const res = await h.authMod.signInWithPopup(h.auth, provider);
      return res.user;
    } catch (e) {
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(e.code)) {
        await h.authMod.signInWithRedirect(h.auth, provider); return null;
      }
      throw e;
    }
  },
  async signOutUser() { const { authMod, auth } = await initFirebase(); await authMod.signOut(auth); },
  isOwner(u) {
    const list = (CONFIG.owners || []).map((e) => e.toLowerCase());
    return !!(u && u.email && list.includes(u.email.toLowerCase()));
  },

  // ---- plan ----
  plansFor(spotId) { return stateData.plans[spotId] || []; },
  plan(spotId, planId) { return this.plansFor(spotId).find((p) => p.id === planId) || null; },
  async addPlan(spotId, { title, days, year }) {
    const p = { id: genId(), title: title.trim(), days: (days || "").trim(), year: year || new Date().getFullYear(), items: [] };
    (stateData.plans[spotId] ||= []).push(p); await this._persist(); return p;
  },
  async updatePlan(spotId, planId, patch) { const p = this.plan(spotId, planId); if (p) { Object.assign(p, patch); await this._persist(); } return p; },
  async deletePlan(spotId, planId) {
    const list = stateData.plans[spotId] || [];
    const p = list.find((x) => x.id === planId);
    if (p) for (const it of p.items) await this._purgeItem(it);
    stateData.plans[spotId] = list.filter((x) => x.id !== planId);
    await this._persist();
  },

  // ---- item(슬롯) ----
  item(spotId, planId, itemId) { const p = this.plan(spotId, planId); return p ? p.items.find((i) => i.id === itemId) || null : null; },
  async addItem(spotId, planId, { group, time, label, kind }) {
    const p = this.plan(spotId, planId); if (!p) return null;
    const it = { id: genId(), group: (group || "").trim(), time: (time || "").trim(), label: label.trim(), kind: kind || "place", selectedId: null, options: [], memories: [] };
    p.items.push(it); await this._persist(); return it;
  },
  async updateItem(spotId, planId, itemId, patch) { const it = this.item(spotId, planId, itemId); if (it) { Object.assign(it, patch); await this._persist(); } return it; },
  async deleteItem(spotId, planId, itemId) {
    const p = this.plan(spotId, planId); if (!p) return;
    const it = p.items.find((i) => i.id === itemId);
    if (it) await this._purgeItem(it);
    p.items = p.items.filter((i) => i.id !== itemId); await this._persist();
  },

  // ---- option(선택지) ----
  option(spotId, planId, itemId, optId) { const it = this.item(spotId, planId, itemId); return it ? it.options.find((o) => o.id === optId) || null : null; },
  async addOption(spotId, planId, itemId, { name, memo, url, lat, lng }) {
    const it = this.item(spotId, planId, itemId); if (!it) return null;
    const op = { id: genId(), name: name.trim(), memo: (memo || "").trim(), url: (url || "").trim(), lat: lat || "", lng: lng || "", hasPhoto: false };
    it.options.push(op); await this._persist(); return op;
  },
  async updateOption(spotId, planId, itemId, optId, patch) { const op = this.option(spotId, planId, itemId, optId); if (op) { Object.assign(op, patch); await this._persist(); } return op; },
  async deleteOption(spotId, planId, itemId, optId) {
    const it = this.item(spotId, planId, itemId); if (!it) return;
    const op = it.options.find((o) => o.id === optId);
    it.options = it.options.filter((o) => o.id !== optId);
    if (it.selectedId === optId) it.selectedId = null;
    await this._purgeOption(op); await this._persist();
  },
  async selectOption(spotId, planId, itemId, optId) {
    const it = this.item(spotId, planId, itemId); if (!it) return;
    it.selectedId = it.selectedId === optId ? null : optId; // 다시 누르면 해제
    await this._persist();
  },
  async _purgeOne(id) { photoCache.delete(id); delete stateData.photoMeta[id]; try { await photoBackend.del(id); } catch (e) {} },
  async _purgeItem(it) {
    if (!it) return;
    for (const op of (it.options || [])) await this._purgeOption(op);
    for (const m of (it.memories || [])) await this._purgeOne(m);
  },
  async _purgeOption(op) {
    if (!op) return;
    delete stateData.votes[op.id];
    await this._purgeOne(op.id);                              // 대표 사진
    for (const m of (op.memories || [])) await this._purgeOne(m); // (구버전 호환)
  },

  // ---- vote(선택지별, 둘이 공통) ----
  getVote(optId) { return stateData.votes[optId] || 0; },
  async setVote(optId, val) { stateData.votes[optId] = stateData.votes[optId] === val ? 0 : val; await this._persist(); return stateData.votes[optId]; },

  // ---- photo(선택지별 1장) ----
  async getPhoto(optId) {
    if (photoCache.has(optId)) return photoCache.get(optId);
    let d = null; try { d = await photoBackend.get(optId); } catch (e) {}
    photoCache.set(optId, d); return d;
  },
  async setPhoto(spotId, planId, itemId, optId, file) {
    const dataUrl = await fileToDownscaledDataURL(file);
    await photoBackend.set(optId, dataUrl); photoCache.set(optId, dataUrl);
    const op = this.option(spotId, planId, itemId, optId); if (op) { op.hasPhoto = true; await this._persist(); }
  },
  async deletePhoto(spotId, planId, itemId, optId) {
    try { await photoBackend.del(optId); } catch (e) {} photoCache.delete(optId);
    const op = this.option(spotId, planId, itemId, optId); if (op) { op.hasPhoto = false; await this._persist(); }
  },

  // ---- 추억 사진(일정/슬롯 단위, 여러 장) ----
  async addItemMemory(spotId, planId, itemId, file) {
    const it = this.item(spotId, planId, itemId); if (!it) return null;
    const id = genId();
    const dataUrl = await fileToDownscaledDataURL(file);
    await photoBackend.set(id, dataUrl); photoCache.set(id, dataUrl);
    (it.memories ||= []).push(id);
    await this._persist();
    return id;
  },
  async deleteItemMemory(spotId, planId, itemId, memId) {
    const it = this.item(spotId, planId, itemId); if (!it) return;
    it.memories = (it.memories || []).filter((m) => m !== memId);
    await this._purgeOne(memId);
    await this._persist();
  },

  // ---- 다녀옴(지역 단위) ----
  isVisited(spotId) { return !!stateData.visited[spotId]; },
  async setVisited(spotId, val) {
    if (val) stateData.visited[spotId] = true; else delete stateData.visited[spotId];
    await this._persist();
  },
  visitedCount() { return Object.keys(stateData.visited).filter((k) => stateData.visited[k]).length; },

  // ---- 사진 정보(장소/날짜/메모) ----
  getPhotoMeta(id) { return stateData.photoMeta[id] || {}; },
  async setPhotoMeta(id, m) {
    stateData.photoMeta[id] = { place: (m.place || "").trim(), date: m.date || "", memo: (m.memo || "").trim() };
    await this._persist();
  },

  // ---- 지역 추억 앨범(계획 없이도 그 지역에 바로) ----
  regionPhotos(regionId) { return stateData.albums[regionId] || []; },
  regionPhotoCount(regionId) {
    let n = (stateData.albums[regionId] || []).length;
    for (const p of (stateData.plans[regionId] || []))
      for (const it of p.items) { n += (it.memories || []).length; for (const op of it.options) if (op.hasPhoto) n++; }
    return n;
  },
  async addRegionPhoto(regionId, file) {
    const id = genId();
    const dataUrl = await fileToDownscaledDataURL(file);
    await photoBackend.set(id, dataUrl); photoCache.set(id, dataUrl);
    (stateData.albums[regionId] ||= []).push(id);
    await this._persist();
    return id;
  },
  async deleteRegionPhoto(regionId, photoId) {
    stateData.albums[regionId] = (stateData.albums[regionId] || []).filter((p) => p !== photoId);
    await this._purgeOne(photoId);
    await this._persist();
  },

  // ---- 미정(아직 안 정한 장소) 카운트 ----
  planUndecided(plan) { return plan.items.filter((it) => it.kind === "place" && !it.selectedId).length; },
  spotTotals(spotId) {
    let places = 0, undecided = 0;
    this.plansFor(spotId).forEach((p) => p.items.forEach((it) => {
      if (it.kind === "place") { places++; if (!it.selectedId) undecided++; }
    }));
    return { places, undecided };
  },
};
