// ============================================================
// app.js — UI (지도→지역→코스 상세→편집폼, 다녀옴/진행도, 입장퀴즈)
// ============================================================

import { store } from "./store.js";
import { esc, optionLink, readPhotoDate } from "./util.js";
import { initMap, refreshMarkers, regionCount, regionName } from "./map.js";

const $ = (s) => document.querySelector(s);
const showScreen = (id) =>
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));

const current = { regionId: null, regionName: "", planId: null };
let formCancel = () => goMap();

// ---- 현재 화면 기억 (새로고침해도 유지) ----
const NAV_KEY = "trip-nav";
function saveNav(screen) {
  try {
    localStorage.setItem(NAV_KEY, JSON.stringify({
      screen, regionId: current.regionId, regionName: current.regionName, planId: current.planId,
    }));
  } catch (e) {}
}
function restoreNav() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(NAV_KEY) || "null"); } catch (e) {}
  if (!s || !s.screen || s.screen === "s-map") return false;
  if (s.screen === "s-detail" && s.regionId && s.planId && store.plan(s.regionId, s.planId)) {
    current.regionId = s.regionId; current.regionName = s.regionName || "";
    goDetail(s.planId); return true;
  }
  if (s.screen === "s-region" && s.regionId) {
    goRegion(s.regionId, s.regionName || ""); return true;
  }
  return false;
}

// ---- 모션 헬퍼 ----
function applyStagger(sel, root) {
  (root || document).querySelectorAll(sel).forEach((el, i) => {
    el.style.setProperty("--d", (i * 0.05).toFixed(2) + "s");
    el.classList.add("rise");
  });
}
function heartBurst(anchorEl) {
  const r = anchorEl.getBoundingClientRect();
  const h = document.createElement("div");
  h.className = "heart-burst"; h.textContent = "♥";
  h.style.left = r.left + r.width / 2 + "px";
  h.style.top = r.top + r.height / 2 + "px";
  document.body.appendChild(h);
  setTimeout(() => h.remove(), 950);
}
function spawnPetals() {
  const c = $("#celebrate"); if (!c) return;
  clearPetals();
  for (let i = 0; i < 16; i++) {
    const s = document.createElement("span");
    s.className = "petal"; s.textContent = "♥";
    s.style.left = (Math.random() * 100).toFixed(1) + "%";
    s.style.fontSize = (12 + Math.random() * 16).toFixed(0) + "px";
    s.style.opacity = (0.5 + Math.random() * 0.45).toFixed(2);
    s.style.animationDelay = (Math.random() * 2.4).toFixed(2) + "s";
    s.style.animationDuration = (3.6 + Math.random() * 2.6).toFixed(2) + "s";
    c.appendChild(s);
  }
}
function clearPetals() { document.querySelectorAll("#celebrate .petal").forEach((p) => p.remove()); }

// ============================================================
// 내비게이션
// ============================================================
function goMap() {
  current.regionId = null; current.planId = null;
  showScreen("s-map"); refreshMarkers(); updateProgress(); saveNav("s-map");
}
function goRegion(regionId, regionName) {
  current.regionId = regionId; current.regionName = regionName; current.planId = null;
  renderRegion(true); showScreen("s-region"); saveNav("s-region");
}
function goDetail(planId) {
  current.planId = planId; renderDetail(true); showScreen("s-detail"); saveNav("s-detail");
}

// ============================================================
// 지역 화면 (다녀옴 토글 + 코스 목록)
// ============================================================
function planRow(p) {
  const left = store.planUndecided(p);
  const year = p.year || new Date().getFullYear();
  const parts = [String(year), p.days, left === 0 ? "다 정함" : "미정 " + left].filter(Boolean);
  const meta = parts.map(esc).join(" · ");
  return `<button class="plan-row" data-plan="${p.id}">
      <span class="pr-title">${esc(p.title)}</span><span class="pr-meta">${meta}</span></button>`;
}
function renderRegion(animate) {
  const id = current.regionId;
  $("#region-title").textContent = current.regionName;
  const visited = store.isVisited(id);
  const plans = store.plansFor(id);
  const photos = store.regionPhotos(id);
  const body = $("#region-body");
  const albumThumbs = photos.map((pid) => {
    const pl = store.getPhotoMeta(pid).place;
    return `<div class="mem-thumb" data-rphoto="${pid}"><img data-photo="${pid}" alt="">${pl ? `<span class="ph-cap">${esc(pl)}</span>` : ""}</div>`;
  }).join("");
  body.innerHTML = `
    <button class="visit-toggle ${visited ? "on" : ""}" id="visit-toggle">
      ${visited ? "다녀온 곳 — 해제" : "다녀왔어요"}</button>
    <div class="album">
      <div class="album-head">이곳의 추억${photos.length ? ` <span class="mem-count">${photos.length}</span>` : ""}</div>
      <div class="mem-strip">${albumThumbs}<button class="mem-add" data-act="addrphoto">＋</button></div>
      ${photos.length ? "" : `<div class="album-hint">계획 없이 다녀온 곳도, 사진부터 남겨요.</div>`}
    </div>
    <div class="region-sub">여행 코스</div>
    <div class="region-plans">
      ${plans.length ? plans.map(planRow).join("") : `<div class="empty">아직 코스가 없어요.<br><b>＋ 새 코스</b>로 시작해요.</div>`}
    </div>
    <button class="act primary wide" id="region-add">＋ 새 코스 만들기</button>`;

  const toggle = $("#visit-toggle");
  toggle.onclick = async () => {
    const nv = !store.isVisited(id);
    await store.setVisited(id, nv);
    refreshMarkers(); updateProgress();
    if (nv) { toggle.classList.add("pop"); heartBurst(toggle); }
    renderRegion(false);
    if (nv && store.visitedCount() === regionCount()) celebrate();
  };
  body.querySelector('[data-act="addrphoto"]').onclick = () => pickRegionPhoto(id);
  body.querySelectorAll("[data-rphoto]").forEach((el) => {
    const pid = el.dataset.rphoto;
    el.onclick = () => openLightbox(pid, { onDelete: () => store.deleteRegionPhoto(id, pid) });
  });
  $("#region-add").onclick = () => goPlanForm(null);
  body.querySelectorAll("[data-plan]").forEach((el) => (el.onclick = () => goDetail(el.dataset.plan)));
  loadThumbs();
  if (animate) applyStagger(".plan-row", body);
}
// ---- 진행 표시 / 완료 토스트 ----
let busyCount = 0;
function showBusy(text) {
  busyCount++;
  let el = $("#busy");
  if (!el) {
    el = document.createElement("div");
    el.id = "busy";
    el.innerHTML = `<div class="busy-card"><div class="spinner"></div><div class="busy-text"></div></div>`;
    document.body.appendChild(el);
  }
  el.querySelector(".busy-text").textContent = text || "올리는 중…";
  el.classList.add("on");
}
function setBusyText(text) { const el = $("#busy"); if (el) el.querySelector(".busy-text").textContent = text; }
function hideBusy() {
  busyCount = Math.max(0, busyCount - 1);
  if (busyCount === 0) { const el = $("#busy"); if (el) el.classList.remove("on"); }
}
function toast(text) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = text;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("on"));
  setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 300); }, 2200);
}

// 갤러리에서 사진 고르기 (여러 장 가능)
//  · iOS: accept="image/*" 가 가장 호환이 좋음 (구체 MIME 나열 시 HEIC가 회색 처리돼 못 고름)
//  · Android: 구체 타입을 나열해야 사진 선택기(갤러리)가 확실히 뜸
const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const IMG_ACCEPT = IS_IOS
  ? "image/*"
  : "image/jpeg,image/png,image/heic,image/heif,image/webp,image/gif,image/*";
let uploading = false;
function pickImages(onFiles) {
  if (uploading) return;                 // 업로드 중엔 중복 선택 차단
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = IMG_ACCEPT;
  inp.multiple = true;
  inp.style.position = "fixed";
  inp.style.left = "-9999px";
  document.body.appendChild(inp);
  inp.onchange = async () => {
    const files = Array.from(inp.files || []);
    inp.remove();
    if (!files.length) return;
    uploading = true;
    showBusy(files.length > 1 ? `사진 올리는 중… (0/${files.length})` : "사진 올리는 중…");
    try {
      await onFiles(files);
      toast(files.length > 1 ? `사진 ${files.length}장 올렸어요` : "사진을 올렸어요");
    } catch (e) {
      console.error(e);
      alert("사진 처리 실패: " + (e.message || e));
    } finally {
      hideBusy(); uploading = false;
    }
  };
  inp.click();
}
function pickRegionPhoto(regionId) {
  pickImages(async (files) => {
    let lastId = null, lastMeta = null, i = 0;
    for (const f of files) {
      if (files.length > 1) setBusyText(`사진 올리는 중… (${++i}/${files.length})`);
      const date = await readPhotoDate(f);
      const id = await store.addRegionPhoto(regionId, f);
      const meta = { place: current.regionName, date, memo: "" };
      await store.setPhotoMeta(id, meta);
      lastId = id; lastMeta = meta;
    }
    renderRegion(false);
    if (files.length === 1 && lastId)
      metaSheet(lastMeta, async (m) => { await store.setPhotoMeta(lastId, m); renderRegion(false); });
  });
}

// ============================================================
// 상세 (일정표)
// ============================================================
function parseStart(t) {
  const m = (t || "").match(/(\d{1,2}):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : Infinity;
}
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const isPlaceLike = (it) => it.kind === "place" || it.kind === "stay";
const toHM = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
function durText(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h && m ? `${h}시간 ${m}분` : h ? `${h}시간` : `${m}분`;
}
function itemRange(it) {
  const parts = (it.time || "").split("~").map((s) => s.trim());
  const s = parts[0] && /^\d{1,2}:\d{2}$/.test(parts[0]) ? (+parts[0].split(":")[0]) * 60 + (+parts[0].split(":")[1]) : null;
  if (s == null) return null;
  const e = parts[1] && /^\d{1,2}:\d{2}$/.test(parts[1]) ? (+parts[1].split(":")[0]) * 60 + (+parts[1].split(":")[1]) : s;
  return { s, e: Math.max(e, s) };
}
function formatDay(name, year) {
  if (!name) return "일정";
  const m = name.match(/^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*(.*)$/);
  if (m && year) {
    const mo = +m[1], d = +m[2];
    const mm = String(mo).padStart(2, "0"), dd = String(d).padStart(2, "0");
    const dt = new Date(year, mo - 1, d); // 로컬 기준(UTC 밀림 없음)
    const valid = dt.getFullYear() === year && dt.getMonth() === mo - 1 && dt.getDate() === d;
    let rest = (m[3] || "").trim().replace(/^\(\s*[일월화수목금토]\s*\)\s*/, ""); // 잘못 적힌 요일 제거
    const wd = valid ? ` (${WEEKDAY[dt.getDay()]})` : "";
    return `${year}.${mm}.${dd}${wd}${rest ? " " + rest : ""}`;
  }
  return name; // 날짜 형태 아니면(예: 숙소) 그대로
}
function noteRow(it) {
  return `<div class="note-row" data-item="${it.id}">
    <span class="nt-time">${esc(it.time)}</span>
    <span class="nt-label">${esc(it.label)}</span>
    <span class="nt-edit"><button class="mini" data-act="edit-item">편집</button><button class="mini del" data-act="del-item">삭제</button></span>
  </div>`;
}
function navHref(op) {
  if (op.lat && op.lng)
    return { href: `tmap://route?goalname=${encodeURIComponent(op.name)}&goalx=${op.lng}&goaly=${op.lat}`, ext: false };
  return { href: "https://map.kakao.com/?q=" + encodeURIComponent(op.name), ext: true };
}
function optCard(it, op) {
  const sel = it.selectedId === op.id;
  const v = store.getVote(op.id);
  const nav = navHref(op);
  const thumb = op.hasPhoto
    ? `<div class="opt-thumb has" data-act="view"><img data-photo="${op.id}" alt=""><span class="thumb-tag">대표</span></div>`
    : `<div class="opt-thumb empty" data-act="addphoto"><span>대표<br>사진</span></div>`;
  return `<div class="opt-card ${sel ? "sel" : ""}" data-opt="${op.id}">
    <div class="opt-top">
      ${thumb}
      <div class="opt-main">
        <div class="opt-name">${esc(op.name)}${sel ? '<span class="pick">선택</span>' : ""}</div>
        ${op.memo ? `<div class="opt-memo">${esc(op.memo)}</div>` : ""}
        <div class="opt-links">
          <a class="lk" href="${esc(optionLink(op))}" target="_blank" rel="noopener">리뷰</a>
          <a class="lk nav" href="${esc(nav.href)}" ${nav.ext ? 'target="_blank" rel="noopener"' : ""}>길찾기</a>
        </div>
      </div>
    </div>
    <div class="opt-foot">
      <button class="vbtn up ${v === 1 ? "on" : ""}" data-act="up">좋아</button>
      <button class="vbtn down ${v === -1 ? "on" : ""}" data-act="down">별로</button>
      <button class="sel-btn ${sel ? "on" : ""}" data-act="select">${sel ? "선택됨" : "이걸로"}</button>
      <div class="opt-edit">
        <button class="mini" data-act="move-opt">옮기기</button>
        <button class="mini" data-act="edit-opt">편집</button>
        <button class="mini del" data-act="del-opt">삭제</button>
      </div>
    </div>
  </div>`;
}
// 확정된 장소 슬롯인가? (후보가 있으면 선택해야, 후보 없는 장소는 그 자체로 확정)
function slotConfirmed(it) {
  return isPlaceLike(it) && (it.options.length === 0 || !!it.selectedId);
}
function slotMemoryBlock(it) {
  if (!slotConfirmed(it)) return "";
  const mems = it.memories || [];
  const thumbs = mems.map((m) => {
    const pl = store.getPhotoMeta(m).place;
    return `<div class="mem-thumb" data-mem="${m}"><img data-photo="${m}" alt="">${pl ? `<span class="ph-cap">${esc(pl)}</span>` : ""}</div>`;
  }).join("");
  return `<div class="memories slot-mem">
    <div class="mem-label">우리 추억${mems.length ? ` <span class="mem-count">${mems.length}</span>` : ""}</div>
    <div class="mem-strip">${thumbs}<button class="mem-add" data-act="addmem">＋</button></div>
  </div>`;
}
function slotBlock(it) {
  const state = it.selectedId ? `<span class="slot-state ok">선택됨</span>` : `<span class="slot-state">미정</span>`;
  const opts = it.options.map((op) => optCard(it, op)).join("");
  return `<div class="slot" data-item="${it.id}">
    <div class="slot-head">
      <div class="slot-when">${it.time ? `<span class="slot-time">${esc(it.time)}</span>` : ""}<span class="slot-label">${it.kind === "stay" && viewMode !== "stay" ? `<span class="stay-tag">숙소</span>` : ""}${esc(it.label)}</span></div>
      ${state}
    </div>
    ${opts || `<div class="slot-empty">장소 미정 — 선택지를 추가해봐요.</div>`}
    ${slotMemoryBlock(it)}
    <div class="slot-actions">
      <button class="add-opt" data-act="add-opt">＋ 선택지 추가</button>
      <button class="mini" data-act="edit-item">일정편집</button>
      <button class="mini del" data-act="del-item">삭제</button>
    </div>
  </div>`;
}
let viewMode = "all"; // all | undec | stay
function isUndecided(it) { return isPlaceLike(it) && !(it.options.length === 0 || it.selectedId); }
function gapRow(mins, from, to, group) {
  return `<button type="button" class="gap-row" data-gap="1" data-g="${esc(group || "")}" data-s="${esc(toHM(from))}" data-e="${esc(toHM(to))}">
    <span class="gap-time">${esc(toHM(from))}~${esc(toHM(to))}</span>
    <span class="gap-text">비어있음 · ${esc(durText(mins))}</span>
    <span class="gap-add">＋ 채우기</span></button>`;
}
function dayRows(items, group) {
  const out = [];
  let prevEnd = null;
  items.forEach((it) => {
    const r = itemRange(it);
    if (r && prevEnd != null && r.s - prevEnd >= 30) out.push(gapRow(r.s - prevEnd, prevEnd, r.s, group));
    out.push(it.kind === "note" ? noteRow(it) : slotBlock(it));
    if (r) prevEnd = Math.max(prevEnd ?? r.e, r.e);
  });
  return out.join("");
}
function renderDetail(animate) {
  const plan = store.plan(current.regionId, current.planId);
  if (!plan) return goRegion(current.regionId, current.regionName);
  $("#detail-eyebrow").textContent = current.regionName;
  $("#detail-title").textContent = plan.title;

  const groups = [];
  plan.items.forEach((it) => {
    let g = groups.find((x) => x.name === it.group);
    if (!g) { g = { name: it.group, items: [] }; groups.push(g); }
    g.items.push(it);
  });
  groups.forEach((g) => g.items.sort((a, b) => {
    const sa = parseStart(a.time), sb = parseStart(b.time);
    return sa === sb ? 0 : sa - sb;
  }));
  const planYear = plan.year || new Date().getFullYear();
  const left = store.planUndecided(plan);
  const complete = left === 0 && plan.items.some(isPlaceLike);
  const stays = plan.items.filter((it) => it.kind === "stay");
  const stayLeft = stays.filter(isUndecided).length;

  const groupsHtml = groups.map((g) => {
    let items = g.items;
    if (viewMode === "undec") items = items.filter(isUndecided);
    else if (viewMode === "stay") items = items.filter((it) => it.kind === "stay");
    if (!items.length) return "";
    const inner = viewMode === "all" ? dayRows(items, g.name) : items.map(slotBlock).join("");
    return `<div class="day"><div class="day-head">${esc(formatDay(g.name, planYear))}</div>${inner}</div>`;
  }).join("");

  const filterBar = `<div class="filter-bar">
      <button class="fbtn ${viewMode === "all" ? "on" : ""}" data-f="all">전체</button>
      <button class="fbtn ${viewMode === "undec" ? "on" : ""}" data-f="undec">미정만${left ? ` <span class="fcount">${left}</span>` : ""}</button>
      <button class="fbtn ${viewMode === "stay" ? "on" : ""}" data-f="stay">숙소${stayLeft ? ` <span class="fcount">${stayLeft}</span>` : ""}</button>
      ${complete ? `<button class="act primary sm" data-act="final">완성 일정표</button>` : ""}
    </div>`;

  const emptyMsg = viewMode === "undec" ? "미정인 일정이 없어요.<br><b>다 정했어요!</b>"
    : viewMode === "stay" ? "숙소 일정이 없어요.<br><b>＋ 일정 추가</b>에서 종류를 <b>숙소</b>로 만들어요."
    : "아직 일정이 없어요.<br><b>＋ 일정 추가</b>로 시작해요.";

  $("#detail-body").innerHTML = `
    <div class="plan-actions">
      <button class="act primary" data-act="add-item">＋ 일정 추가</button>
      <button class="act" data-act="edit-plan">코스 편집</button>
      <button class="act danger" data-act="del-plan">삭제</button>
    </div>
    ${filterBar}
    ${groupsHtml || `<div class="empty">${emptyMsg}</div>`}`;
  wireDetail(plan);
  loadThumbs();
  $("#detail-body").querySelectorAll(".fbtn").forEach((b) => b.onclick = () => {
    viewMode = b.dataset.f; renderDetail(false);
  });
  const fin = $("#detail-body").querySelector('[data-act="final"]');
  if (fin) fin.onclick = () => showFinal(plan, planYear);
  if (animate) applyStagger(".day", $("#detail-body"));
}
function wireDetail(plan) {
  const rid = current.regionId, pid = current.planId;
  const body = $("#detail-body");
  body.querySelector('[data-act="add-item"]').onclick = () => goItemForm(null);
  body.querySelector('[data-act="edit-plan"]').onclick = () => goPlanForm(pid);
  body.querySelector('[data-act="del-plan"]').onclick = async () => {
    if (confirm(`'${plan.title}' 코스를 삭제할까요?`)) { await store.deletePlan(rid, pid); goRegion(rid, current.regionName); }
  };
  body.querySelectorAll('[data-gap]').forEach((g) => {
    g.onclick = () => gapSheet(g.dataset.g, g.dataset.s, g.dataset.e);
  });
  body.querySelectorAll(".note-row").forEach((nr) => {
    const itemId = nr.dataset.item;
    nr.querySelector('[data-act="edit-item"]').onclick = () => goItemForm(itemId);
    nr.querySelector('[data-act="del-item"]').onclick = async () => {
      if (confirm("이 일정을 삭제할까요?")) { await store.deleteItem(rid, pid, itemId); renderDetail(); }
    };
  });
  body.querySelectorAll(".slot").forEach((slot) => {
    const itemId = slot.dataset.item;
    slot.querySelector('[data-act="add-opt"]').onclick = () => goOptionForm(itemId, null);
    slot.querySelector('[data-act="edit-item"]').onclick = () => goItemForm(itemId);
    slot.querySelector('[data-act="del-item"]').onclick = async () => {
      if (confirm("이 일정을 삭제할까요?")) { await store.deleteItem(rid, pid, itemId); renderDetail(); }
    };
    slot.querySelectorAll(".opt-card").forEach((card) => {
      const optId = card.dataset.opt;
      const on = (act, fn) => { const el = card.querySelector(`[data-act="${act}"]`); if (el) el.onclick = fn; };
      on("up", async () => { await store.setVote(optId, 1); renderDetail(); });
      on("down", async () => { await store.setVote(optId, -1); renderDetail(); });
      on("select", async () => { await store.selectOption(rid, pid, itemId, optId); renderDetail(); });
      on("edit-opt", () => goOptionForm(itemId, optId));
      on("move-opt", () => moveSheet(itemId, optId));
      on("del-opt", async () => { if (confirm("이 선택지를 삭제할까요?")) { await store.deleteOption(rid, pid, itemId, optId); renderDetail(); } });
      on("addphoto", () => pickPhoto(itemId, optId));
      on("view", () => openLightbox(optId, {
        onChange: () => pickPhoto(itemId, optId),
        onDelete: () => store.deletePhoto(rid, pid, itemId, optId),
      }));
    });
    // 슬롯(확정된 일정) 단위 추억 사진
    const addmem = slot.querySelector('.slot-mem [data-act="addmem"]');
    if (addmem) addmem.onclick = () => pickItemMemory(itemId);
    slot.querySelectorAll('.slot-mem .mem-thumb').forEach((mt) => {
      const memId = mt.dataset.mem;
      mt.onclick = () => openLightbox(memId, { onDelete: () => store.deleteItemMemory(rid, pid, itemId, memId) });
    });
  });
}
function loadThumbs() {
  document.querySelectorAll("img[data-photo]").forEach(async (img) => {
    const d = await store.getPhoto(img.dataset.photo); if (d) img.src = d;
  });
}

// ============================================================
// 사진 (갤러리 + 라이트박스)
// ============================================================
function pickPhoto(itemId, optId) {
  pickImages(async (files) => {
    await store.setPhoto(current.regionId, current.planId, itemId, optId, files[0]);
    renderDetail(false);
  });
}
function pickItemMemory(itemId) {
  pickImages(async (files) => {
    const it = store.item(current.regionId, current.planId, itemId);
    const selOpt = it && it.selectedId ? it.options.find((o) => o.id === it.selectedId) : null;
    const place = (selOpt && selOpt.name) || (it && it.label) || current.regionName;
    let lastId = null, lastMeta = null, i = 0;
    for (const f of files) {
      if (files.length > 1) setBusyText(`사진 올리는 중… (${++i}/${files.length})`);
      const date = await readPhotoDate(f);
      const id = await store.addItemMemory(current.regionId, current.planId, itemId, f);
      const meta = { place, date, memo: "" };
      await store.setPhotoMeta(id, meta);
      lastId = id; lastMeta = meta;
    }
    renderDetail(false);
    if (files.length === 1 && lastId)
      metaSheet(lastMeta, async (m) => { await store.setPhotoMeta(lastId, m); renderDetail(false); });
  });
}
function moveSheet(fromItemId, optId) {
  const rid = current.regionId, pid = current.planId;
  const plan = store.plan(rid, pid); if (!plan) return;
  const op = store.option(rid, pid, fromItemId, optId);
  const planYear = plan.year || new Date().getFullYear();

  // 옮길 수 있는 대상 = 장소(선택지) 일정, 자기 자신 제외 · 날짜/시간순
  const targets = (plan.items || [])
    .filter((x) => isPlaceLike(x) && x.id !== fromItemId)
    .sort((a, b) => {
      const ga = String(a.group || ""), gb = String(b.group || "");
      if (ga !== gb) return ga.localeCompare(gb, "ko");
      const sa = parseStart(a.time), sb = parseStart(b.time);
      return sa === sb ? 0 : sa - sb;
    });

  const box = document.createElement("div");
  box.className = "sheet";
  const rows = targets.length
    ? targets.map((t) => `<button type="button" class="mv-row" data-to="${t.id}">
         <span class="mv-day">${esc(formatDay(t.group, planYear))}</span>
         <span class="mv-main"><span class="mv-time">${esc(t.time || "—")}</span><span class="mv-label">${esc(t.label)}</span></span>
       </button>`).join("")
    : `<div class="dp-empty">옮길 수 있는 다른 장소 일정이 없어요.</div>`;
  box.innerHTML = `<div class="sheet-card">
    <div class="sheet-title">어디로 옮길까?</div>
    <div class="mv-sub">${esc((op && op.name) || "선택지")}</div>
    <div class="mv-list">${rows}</div>
    <div class="form-actions"><button class="act" data-a="cancel">취소</button></div>
  </div>`;
  document.body.appendChild(box);
  const close = () => box.remove();
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  box.querySelector('[data-a="cancel"]').onclick = close;
  box.querySelectorAll(".mv-row").forEach((r) => {
    r.onclick = async () => {
      await store.moveOption(rid, pid, fromItemId, optId, r.dataset.to);
      close(); renderDetail(false);
    };
  });
}
// ============================================================
// 완성 일정표 (확정된 일정만 한눈에)
// ============================================================
function showFinal(plan, planYear) {
  const groups = [];
  plan.items.forEach((it) => {
    let g = groups.find((x) => x.name === it.group);
    if (!g) { g = { name: it.group, items: [] }; groups.push(g); }
    g.items.push(it);
  });
  groups.forEach((g) => g.items.sort((a, b) => {
    const sa = parseStart(a.time), sb = parseStart(b.time);
    return sa === sb ? 0 : sa - sb;
  }));

  const dayHtml = groups.map((g) => {
    let prevEnd = null;
    const rows = g.items.map((it) => {
      const r = itemRange(it);
      let gap = "";
      if (r && prevEnd != null && r.s - prevEnd >= 30)
        gap = `<div class="fin-gap">${esc(toHM(prevEnd))}~${esc(toHM(r.s))} · 비어있음 ${esc(durText(r.s - prevEnd))}</div>`;
      if (r) prevEnd = Math.max(prevEnd ?? r.e, r.e);

      if (it.kind === "note")
        return `${gap}<div class="fin-row note"><span class="fin-time">${esc(it.time || "—")}</span>
          <span class="fin-body"><span class="fin-label">${esc(it.label)}</span></span></div>`;

      const place = it.selectedId ? it.options.find((o) => o.id === it.selectedId) : null;
      const nav = place ? navHref(place) : null;
      return `${gap}<div class="fin-row ${it.kind === "stay" ? "stay" : ""}"><span class="fin-time">${esc(it.time || "—")}</span>
        <span class="fin-body">
          <span class="fin-label">${it.kind === "stay" ? `<span class="stay-tag">숙소</span>` : ""}${esc(it.label)}</span>
          ${place ? `<span class="fin-place">${esc(place.name)}</span>` : `<span class="fin-place none">장소 미지정</span>`}
          ${place && place.memo ? `<span class="fin-memo">${esc(place.memo)}</span>` : ""}
          ${place ? `<span class="fin-links">
              <a class="lk" href="${esc(optionLink(place))}" target="_blank" rel="noopener">리뷰</a>
              <a class="lk nav" href="${esc(nav.href)}" ${nav.ext ? 'target="_blank" rel="noopener"' : ""}>길찾기</a>
            </span>` : ""}
        </span></div>`;
    }).join("");
    return `<div class="fin-day"><div class="fin-dayhead">${esc(formatDay(g.name, planYear))}</div>${rows}</div>`;
  }).join("");

  const box = document.createElement("div");
  box.className = "final";
  box.innerHTML = `<div class="fin-inner">
      <div class="fin-top">
        <div>
          <div class="fin-eyebrow">완성된 일정표</div>
          <div class="fin-title">${esc(plan.title)}</div>
          <div class="fin-sub">${esc(current.regionName)}${plan.days ? " · " + esc(plan.days) : ""}</div>
        </div>
        <button class="fin-close" data-a="close">✕</button>
      </div>
      ${dayHtml || `<div class="dp-empty">일정이 없어요.</div>`}
    </div>`;
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector('[data-a="close"]').onclick = close;
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
}

// 빈 시간 채우기: 무엇으로 채울지 먼저 고르기
function gapSheet(group, start, end) {
  const box = document.createElement("div");
  box.className = "sheet";
  box.innerHTML = `<div class="sheet-card">
    <div class="sheet-title">빈 시간 채우기</div>
    <div class="mv-sub">${esc(group)} · ${esc(start)}~${esc(end)}</div>
    <div class="mv-list">
      <button type="button" class="mv-row" data-k="place">
        <span class="mv-day">장소</span>
        <span class="mv-main"><span class="mv-label">후보를 여러 개 넣고 골라요</span></span></button>
      <button type="button" class="mv-row" data-k="stay">
        <span class="mv-day">숙소</span>
        <span class="mv-main"><span class="mv-label">이 날 묵을 곳을 정해요</span></span></button>
      <button type="button" class="mv-row" data-k="note">
        <span class="mv-day">단순 일정</span>
        <span class="mv-main"><span class="mv-label">이동·기상 같은 메모만</span></span></button>
    </div>
    <div class="form-actions"><button class="act" data-a="cancel">취소</button></div>
  </div>`;
  document.body.appendChild(box);
  const close = () => box.remove();
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  box.querySelector('[data-a="cancel"]').onclick = close;
  box.querySelectorAll(".mv-row").forEach((r) => {
    r.onclick = () => { close(); goItemForm(null, { kind: r.dataset.k, group, ts: start, te: end }); };
  });
}

function metaSheet({ place = "", date = "", memo = "" }, onSave) {
  const box = document.createElement("div");
  box.className = "sheet";
  box.innerHTML = `<div class="sheet-card">
    <div class="sheet-title">사진 정보</div>
    <label class="fld"><span>장소</span><input id="m-place" type="text" value="${esc(place)}" placeholder="예) 통영 동피랑 벽화마을"></label>
    <label class="fld"><span>날짜</span><input id="m-date" type="date" value="${esc(date)}"></label>
    <label class="fld"><span>한마디 (선택)</span><input id="m-memo" type="text" value="${esc(memo)}" placeholder="예) 여기 회 진짜 미쳤음"></label>
    <div class="form-actions"><button class="act" data-a="cancel">취소</button><button class="act primary" data-a="save">저장</button></div>
  </div>`;
  document.body.appendChild(box);
  const close = () => box.remove();
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  box.querySelector('[data-a="cancel"]').onclick = close;
  box.querySelector('[data-a="save"]').onclick = async () => {
    await onSave({ place: box.querySelector("#m-place").value, date: box.querySelector("#m-date").value, memo: box.querySelector("#m-memo").value });
    close();
  };
  setTimeout(() => box.querySelector("#m-place").focus(), 60);
}
function fmtDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || "") ? s.replace(/-/g, ".") : (s || ""); }
async function openLightbox(photoId, { onChange, onDelete } = {}) {
  const d = await store.getPhoto(photoId);
  const meta = store.getPhotoMeta(photoId);
  const box = document.createElement("div");
  box.className = "lightbox";
  const cap = (meta.place || meta.date || meta.memo) ? `<div class="lb-cap">
      ${meta.place ? `<div class="lb-place">${esc(meta.place)}</div>` : ""}
      ${meta.date ? `<div class="lb-date">${esc(fmtDate(meta.date))}</div>` : ""}
      ${meta.memo ? `<div class="lb-memo">${esc(meta.memo)}</div>` : ""}
    </div>` : "";
  const chgBtn = onChange ? `<button data-a="chg">사진 변경</button>` : "";
  const delBtn = onDelete ? `<button data-a="del" class="del">삭제</button>` : "";
  box.innerHTML = `<div class="lb-inner"><img src="${d || ""}" alt="">
    ${cap}
    <div class="lb-bar"><button data-a="meta">정보 편집</button>${chgBtn}${delBtn}<button data-a="close">닫기</button></div></div>`;
  document.body.appendChild(box);
  const close = () => box.remove();
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  box.querySelector('[data-a="close"]').onclick = close;
  box.querySelector('[data-a="meta"]').onclick = () =>
    metaSheet(store.getPhotoMeta(photoId), async (m) => { await store.setPhotoMeta(photoId, m); close(); rerenderCurrent(); });
  if (onChange) box.querySelector('[data-a="chg"]').onclick = () => { close(); onChange(); };
  if (onDelete) box.querySelector('[data-a="del"]').onclick = async () => {
    if (confirm("사진을 삭제할까요?")) { await onDelete(); close(); rerenderCurrent(); }
  };
}
function rerenderCurrent() {
  const a = document.querySelector(".screen.active"); if (!a) return;
  if (a.id === "s-region") renderRegion(false);
  else if (a.id === "s-detail") renderDetail(false);
}

// ============================================================
// 편집 폼
// ============================================================
function openForm(title, innerHTML, onSubmit, onCancel) {
  formCancel = onCancel;
  $("#form-title").textContent = title;
  $("#form-body").innerHTML = innerHTML + `
    <div class="form-actions"><button class="act" id="form-cancel">취소</button><button class="act primary" id="form-save">저장</button></div>`;
  $("#form-cancel").onclick = onCancel;
  $("#form-save").onclick = onSubmit;
  showScreen("s-form");
}
function segToggle(sel) {
  $(sel).querySelectorAll(".seg").forEach((b) =>
    b.addEventListener("click", () => { $(sel).querySelectorAll(".seg").forEach((x) => x.classList.remove("on")); b.classList.add("on"); }));
}

function goPlanForm(planId) {
  const rid = current.regionId, editing = !!planId;
  const p = editing ? store.plan(rid, planId) : { title: "", days: "", year: new Date().getFullYear() };
  const back = () => (editing ? goDetail(planId) : goRegion(rid, current.regionName));
  openForm(editing ? "코스 편집" : "새 코스",
    `<label class="fld"><span>코스 이름</span><input id="f-title" type="text" placeholder="예) 강릉 2박3일" value="${esc(p.title)}"></label>
     <label class="fld"><span>연도</span><input id="f-year" type="number" inputmode="numeric" placeholder="${new Date().getFullYear()}" value="${esc(String(p.year || new Date().getFullYear()))}">
       <span class="hint">날짜 일정 앞에 이 연도가 함께 표시돼요.</span></label>
     <label class="fld"><span>기간 (선택)</span><input id="f-days" type="text" placeholder="예) 2박3일 · 7/16~18" value="${esc(p.days)}"></label>`,
    async () => {
      const title = $("#f-title").value.trim(); if (!title) return alert("코스 이름을 입력해줘.");
      const days = $("#f-days").value;
      const year = parseInt($("#f-year").value, 10) || new Date().getFullYear();
      if (editing) { await store.updatePlan(rid, planId, { title, days, year }); goDetail(planId); }
      else { const np = await store.addPlan(rid, { title, days, year }); goDetail(np.id); }
    }, back);
}
function hm(t) { const m = (t || "").match(/^(\d{1,2}):(\d{2})$/); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function parseRange(time) {
  const parts = (time || "").split("~").map((s) => s.trim());
  const s = hm(parts[0]); if (s == null) return null;
  const e = parts[1] ? hm(parts[1]) : s;
  return { s, e: e == null ? s : e };
}
function rangesClash(a, b) {
  if (!a || !b) return false;
  const ae = a.e === a.s ? a.s + 1 : a.e, be = b.e === b.s ? b.s + 1 : b.e;
  return a.s < be && b.s < ae;
}
function goItemForm(itemId, prefill) {
  const rid = current.regionId, pid = current.planId, editing = !!itemId;
  const it = editing ? store.item(rid, pid, itemId)
    : { group: (prefill && prefill.group) || "", time: "", label: "", kind: (prefill && prefill.kind) || "place" };
  const back = () => goDetail(pid);
  let [ts, te] = (it.time || "").split("~").map((s) => (s || "").trim());
  if (!editing && prefill) { ts = prefill.ts || ""; te = prefill.te || ""; }
  const groups = [...new Set((store.plan(rid, pid).items || []).map((x) => x.group).filter(Boolean))];
  const chips = groups.length
    ? `<div class="grp-chips">${groups.map((g) => `<button type="button" class="grp-chip ${g === it.group ? "on" : ""}" data-g="${esc(g)}">${esc(g)}</button>`).join("")}</div>`
    : "";
  openForm(editing ? "일정 편집" : "일정 추가",
    `<div class="fld"><span>종류</span><div class="seg-group" id="f-kind">
        <button type="button" class="seg ${it.kind === "place" ? "on" : ""}" data-kind="place">장소</button>
        <button type="button" class="seg ${it.kind === "stay" ? "on" : ""}" data-kind="stay">숙소</button>
        <button type="button" class="seg ${it.kind === "note" ? "on" : ""}" data-kind="note">단순 일정</button></div></div>
     <div class="fld"><span>날짜 / 그룹</span>${chips}
        <input id="f-group" type="text" placeholder="예) 7/17 (목)  또는  숙소" value="${esc(it.group)}">
        <span class="hint">기존 날짜를 누르거나 새로 입력하면 돼요.</span></div>
     <div class="fld"><span>시간 (선택)</span><div class="time-row">
        <input id="f-ts" type="time" value="${esc(ts || "")}"><span class="time-sep">~</span><input id="f-te" type="time" value="${esc(te || "")}"></div>
        <span class="hint">시간을 넣으면 그 날짜 안에서 시간순으로 자동 정렬돼요.</span></div>
     <div class="fld"><span>그 날짜 일정</span><div id="day-preview" class="day-preview"></div></div>
     <label class="fld"><span>내용</span><input id="f-label" type="text" placeholder="예) 오후 전시" value="${esc(it.label)}"></label>`,
    async () => {
      const label = $("#f-label").value.trim(); if (!label) return alert("내용을 입력해줘.");
      const s = $("#f-ts").value, e = $("#f-te").value;
      const time = s && e ? `${s}~${e}` : s || e || "";
      const data = { kind: $("#f-kind .seg.on")?.dataset.kind || "place", group: $("#f-group").value, time, label };
      if (editing) await store.updateItem(rid, pid, itemId, data); else await store.addItem(rid, pid, data);
      goDetail(pid);
    }, back);
  segToggle("#f-kind");

  const updatePreview = () => {
    const group = $("#f-group").value.trim();
    const box = $("#day-preview"); if (!box) return;
    const entered = parseRange(($("#f-ts").value && $("#f-te").value) ? `${$("#f-ts").value}~${$("#f-te").value}` : $("#f-ts").value || "");
    const rows = (store.plan(rid, pid).items || [])
      .filter((x) => x.group === group && x.id !== itemId)
      .sort((a, b) => { const sa = parseStart(a.time), sb = parseStart(b.time); return sa === sb ? 0 : sa - sb; });
    if (!group) { box.innerHTML = `<div class="dp-empty">날짜를 고르면 그날 일정이 여기 보여요.</div>`; return; }
    if (!rows.length) { box.innerHTML = `<div class="dp-empty">이 날짜엔 다른 일정이 없어요.</div>`; return; }
    box.innerHTML = rows.map((x) => {
      const clash = entered && rangesClash(entered, parseRange(x.time));
      return `<div class="dp-row ${clash ? "clash" : ""}"><span class="dp-time">${esc(x.time || "—")}</span><span class="dp-label">${esc(x.label)}</span>${clash ? `<span class="dp-warn">겹침</span>` : ""}</div>`;
    }).join("");
  };
  document.querySelectorAll(".grp-chip").forEach((c) => c.onclick = () => {
    $("#f-group").value = c.dataset.g;
    document.querySelectorAll(".grp-chip").forEach((x) => x.classList.remove("on"));
    c.classList.add("on");
    updatePreview();
  });
  ["#f-group", "#f-ts", "#f-te"].forEach((sel) => { const el = $(sel); if (el) el.addEventListener("input", updatePreview); });
  updatePreview();
}
function goOptionForm(itemId, optId) {
  const rid = current.regionId, pid = current.planId, editing = !!optId;
  const op = editing ? store.option(rid, pid, itemId, optId) : { name: "", memo: "", url: "" };
  const back = () => goDetail(pid);
  openForm(editing ? "선택지 편집" : "선택지 추가",
    `<label class="fld"><span>장소 이름</span><input id="f-name" type="text" placeholder="예) 강릉 로맨스 인 강문" value="${esc(op.name)}"></label>
     <label class="fld"><span>메모 (선택)</span><input id="f-memo" type="text" placeholder="예) 여기어때 ★9.7 / 오션뷰" value="${esc(op.memo)}"></label>
     <label class="fld"><span>리뷰 링크 (선택)</span><input id="f-url" type="url" placeholder="비우면 카카오맵 검색으로 연결" value="${esc(op.url)}">
       <span class="hint">‘길찾기’는 장소 이름으로 카카오맵 검색을 열어줘요. 거기서 길찾기 → 티맵 선택 가능.</span></label>`,
    async () => {
      const name = $("#f-name").value.trim(); if (!name) return alert("장소 이름을 입력해줘.");
      const data = { name, memo: $("#f-memo").value, url: $("#f-url").value };
      if (editing) await store.updateOption(rid, pid, itemId, optId, data); else await store.addOption(rid, pid, itemId, data);
      goDetail(pid);
    }, back);
}

// ============================================================
// 진행도 / 축하 / 원격변경
// ============================================================
const STEPS = 14;
function footSVG() {
  return `<svg viewBox="0 0 20 28" fill="currentColor" aria-hidden="true">
    <ellipse cx="10" cy="18.5" rx="6" ry="8.5"/>
    <circle cx="5.6" cy="7.5" r="1.6"/><circle cx="9.4" cy="5.3" r="1.9"/><circle cx="13.4" cy="7" r="1.6"/>
  </svg>`;
}
function updateProgress() {
  const total = regionCount(), done = store.visitedCount();
  const txt = $("#prog-txt"); if (txt) txt.textContent = `${done} / ${total || "…"}`;
  const trail = $("#prog-trail"); if (!trail) return;
  if (trail.childElementCount !== STEPS) {
    trail.innerHTML = "";
    for (let i = 0; i < STEPS; i++) { const s = document.createElement("span"); s.className = "step"; s.innerHTML = footSVG(); trail.appendChild(s); }
  }
  const lit = total ? Math.round((done / total) * STEPS) : 0;
  trail.querySelectorAll(".step").forEach((s, i) => s.classList.toggle("on", i < lit));
}
function celebrate() { const c = $("#celebrate"); if (c) { c.classList.remove("hide"); spawnPetals(); } }
function onRemoteChange() {
  const active = document.querySelector(".screen.active");
  updateProgress();
  if (!active) return;
  if (active.id === "s-map") refreshMarkers();
  else if (active.id === "s-region") renderRegion();
  else if (active.id === "s-detail") renderDetail();
}

// ============================================================
// 알림 (상대가 바꾼 것)
// ============================================================
let notifs = [];       // {id, text, region, rid, pid, itemId, ts, read}
let notifOpen = false;

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}
function onRemoteEvents(events) {
  events.forEach((e) => {
    notifs.unshift({
      id: Math.random().toString(36).slice(2),
      text: e.text, region: regionName(e.rid),
      rid: e.rid, pid: e.pid || null, itemId: e.itemId || null,
      ts: Date.now(), read: false,
    });
  });
  notifs = notifs.slice(0, 40);
  renderBell();
}
function unreadCount() { return notifs.filter((n) => !n.read).length; }
function renderBell() {
  document.querySelectorAll(".bell").forEach((b) => {
    const n = unreadCount();
    b.classList.toggle("has", n > 0);
    const badge = b.querySelector(".bell-badge");
    if (badge) { badge.textContent = n > 99 ? "99+" : n; badge.style.display = n ? "flex" : "none"; }
  });
  const panel = $("#notif-panel");
  if (panel && notifOpen) panel.innerHTML = notifListHTML();
}
function notifListHTML() {
  if (!notifs.length) return `<div class="nt-empty">새로운 소식이 없어요.</div>`;
  return `<div class="nt-head"><span>알림</span><button class="nt-clear" data-a="clear">모두 읽음</button></div>` +
    notifs.map((n) => `<button type="button" class="nt-item ${n.read ? "" : "new"}" data-n="${n.id}">
      <span class="nt-region">${esc(n.region || "")}</span>
      <span class="nt-text">${esc(n.text)}</span>
      <span class="nt-time">${esc(timeAgo(n.ts))}</span>
    </button>`).join("");
}
function toggleNotif(force) {
  notifOpen = force != null ? force : !notifOpen;
  let panel = $("#notif-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "notif-panel";
    document.body.appendChild(panel);
    document.addEventListener("click", (e) => {
      if (notifOpen && !panel.contains(e.target) && !e.target.closest(".bell")) toggleNotif(false);
    });
  }
  panel.classList.toggle("open", notifOpen);
  if (notifOpen) {
    panel.innerHTML = notifListHTML();
    panel.querySelector('[data-a="clear"]')?.addEventListener("click", () => {
      notifs.forEach((n) => (n.read = true)); renderBell();
    });
    panel.querySelectorAll("[data-n]").forEach((el) => el.onclick = () => {
      const n = notifs.find((x) => x.id === el.dataset.n); if (!n) return;
      n.read = true; toggleNotif(false); renderBell();
      jumpTo(n);
    });
  }
}
function jumpTo(n) {
  const rname = regionName(n.rid);
  if (n.pid && store.plan(n.rid, n.pid)) {
    current.regionId = n.rid; current.regionName = rname;
    goDetail(n.pid);
    if (n.itemId) setTimeout(() => {
      const el = document.querySelector(`.slot[data-item="${n.itemId}"], .note-row[data-item="${n.itemId}"]`);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); }
    }, 260);
  } else {
    goRegion(n.rid, rname);
  }
}

// ============================================================
// 부팅 + 입장 퀴즈
// ============================================================
const PASS_KEY = "trip-pass";
const ANS = "7JaR67O07Jyk";
const checkAnswer = (v) => { try { return btoa(unescape(encodeURIComponent((v || "").trim()))) === ANS; } catch (e) { return false; } };

let appStarted = false;
function showFatal(msg) {
  let el = document.getElementById("fatal");
  if (!el) {
    el = document.createElement("div");
    el.id = "fatal";
    document.body.appendChild(el);
  }
  el.textContent = "⚠ " + msg;
  el.style.display = "block";
}
async function startApp() {
  if (appStarted) return;
  try {
    await store.load();
    store.subscribe(onRemoteChange);
    store.subscribeEvents(onRemoteEvents);
    await initMap({ onOpenRegion: goRegion, onReady: updateProgress });
    updateProgress();
    document.querySelectorAll(".bell").forEach((b) => b.onclick = (e) => { e.stopPropagation(); toggleNotif(); });
    renderBell();
    appStarted = true;
    restoreNav();   // 새로고침 전 화면으로 복귀
  } catch (e) {
    console.error("startApp 실패:", e);
    showFatal("불러오기 실패: " + (e.code || e.message || e));
  }
}

// 퀴즈 통과 후: Firebase면 구글 로그인(주인만 통과), 아니면 바로 시작
async function afterGate() {
  $("#gate").classList.add("hide");
  if (!store.firebaseEnabled) { startApp(); return; }
  const login = $("#login"), btn = $("#login-go"), err = $("#login-err");
  // 로그인 화면을 미리 띄우지 않음 → 자동로그인 시 깜빡임 없음
  try { await store.initAuth(); }
  catch (e) {
    console.error(e);
    login.classList.remove("hide");
    err.textContent = "인증 오류: " + (e.code || e.message || e);
    return;
  }
  store.onUserChanged(async (user) => {
    if (appStarted) return;
    if (user && store.isOwner(user)) { login.classList.add("hide"); startApp(); }
    else if (user && !store.isOwner(user)) {
      login.classList.remove("hide");
      err.textContent = "허용된 계정이 아니에요 (" + (user.email || "") + ")";
      await store.signOutUser();
    } else {
      login.classList.remove("hide"); // 로그인 안 된 상태에서만 버튼 노출
    }
  });
  btn.onclick = async () => {
    err.textContent = "";
    try { await store.signInGoogle(); }
    catch (e) { console.error(e); err.textContent = "로그인 실패: " + (e.code || e.message || ""); }
  };
}

function setupGate() {
  const gate = $("#gate");
  if (localStorage.getItem(PASS_KEY) === "1") { afterGate(); return; }
  const input = $("#gate-input"), err = $("#gate-err"), card = gate.querySelector(".gate-card");
  const submit = () => {
    if (checkAnswer(input.value)) { try { localStorage.setItem(PASS_KEY, "1"); } catch (e) {} afterGate(); }
    else { err.textContent = "땡! 다시 생각해봐 😝"; card.classList.remove("gate-shake"); void card.offsetWidth; card.classList.add("gate-shake"); input.select(); }
  };
  $("#gate-go").onclick = submit;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  setTimeout(() => input.focus(), 100);
}

document.querySelector("#s-region .back").addEventListener("click", goMap);
document.querySelector("#s-detail .back").addEventListener("click", () => goRegion(current.regionId, current.regionName));
document.querySelector("#s-form .back").addEventListener("click", () => formCancel());
document.querySelector("#cel-close").addEventListener("click", () => { $("#celebrate").classList.add("hide"); clearPetals(); });
setupGate();
