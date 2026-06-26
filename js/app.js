// ============================================================
// app.js — UI (지도→지역→코스 상세→편집폼, 다녀옴/진행도, 입장퀴즈)
// ============================================================

import { store } from "./store.js";
import { esc, optionLink } from "./util.js";
import { initMap, refreshMarkers, regionCount } from "./map.js";

const $ = (s) => document.querySelector(s);
const showScreen = (id) =>
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));

const current = { regionId: null, regionName: "", planId: null };
let formCancel = () => goMap();

// ============================================================
// 내비게이션
// ============================================================
function goMap() {
  current.regionId = null; current.planId = null;
  showScreen("s-map"); refreshMarkers(); updateProgress();
}
function goRegion(regionId, regionName) {
  current.regionId = regionId; current.regionName = regionName; current.planId = null;
  renderRegion(); showScreen("s-region");
}
function goDetail(planId) {
  current.planId = planId; renderDetail(); showScreen("s-detail");
}

// ============================================================
// 지역 화면 (다녀옴 토글 + 코스 목록)
// ============================================================
function planRow(p) {
  const left = store.planUndecided(p);
  const meta = `${esc(p.days)} · ${left === 0 ? "다 정함" : "미정 " + left}`;
  return `<button class="plan-row" data-plan="${p.id}">
      <span class="pr-title">${esc(p.title)}</span><span class="pr-meta">${meta}</span></button>`;
}
function renderRegion() {
  const id = current.regionId;
  $("#region-title").textContent = current.regionName;
  const visited = store.isVisited(id);
  const plans = store.plansFor(id);
  const body = $("#region-body");
  body.innerHTML = `
    <button class="visit-toggle ${visited ? "on" : ""}" id="visit-toggle">
      ${visited ? "다녀온 곳 — 해제" : "다녀왔어요"}</button>
    <div class="region-plans">
      ${plans.length ? plans.map(planRow).join("") : `<div class="empty">아직 코스가 없어요.<br><b>＋ 새 코스</b>로 시작해요.</div>`}
    </div>
    <button class="act primary wide" id="region-add">＋ 새 코스 만들기</button>`;

  $("#visit-toggle").onclick = async () => {
    const nv = !store.isVisited(id);
    await store.setVisited(id, nv);
    refreshMarkers(); renderRegion(); updateProgress();
    if (nv && store.visitedCount() === regionCount()) celebrate();
  };
  $("#region-add").onclick = () => goPlanForm(null);
  body.querySelectorAll("[data-plan]").forEach((el) => (el.onclick = () => goDetail(el.dataset.plan)));
}

// ============================================================
// 상세 (일정표)
// ============================================================
function noteRow(it) {
  return `<div class="note-row"><span class="nt-time">${esc(it.time)}</span><span class="nt-label">${esc(it.label)}</span></div>`;
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
    ? `<div class="opt-thumb has" data-act="view"><img data-photo="${op.id}" alt=""></div>`
    : `<div class="opt-thumb empty" data-act="addphoto"><span>사진<br>추가</span></div>`;
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
        <button class="mini" data-act="edit-opt">편집</button>
        <button class="mini del" data-act="del-opt">삭제</button>
      </div>
    </div>
  </div>`;
}
function slotBlock(it) {
  const state = it.selectedId ? `<span class="slot-state ok">선택됨</span>` : `<span class="slot-state">미정</span>`;
  const opts = it.options.map((op) => optCard(it, op)).join("");
  return `<div class="slot" data-item="${it.id}">
    <div class="slot-head">
      <div class="slot-when">${it.time ? `<span class="slot-time">${esc(it.time)}</span>` : ""}<span class="slot-label">${esc(it.label)}</span></div>
      ${state}
    </div>
    ${opts || `<div class="slot-empty">장소 미정 — 선택지를 추가해봐요.</div>`}
    <div class="slot-actions">
      <button class="add-opt" data-act="add-opt">＋ 선택지 추가</button>
      <button class="mini" data-act="edit-item">일정편집</button>
      <button class="mini del" data-act="del-item">삭제</button>
    </div>
  </div>`;
}
function renderDetail() {
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
  const groupsHtml = groups.map((g) => `
    <div class="day"><div class="day-head">${esc(g.name) || "일정"}</div>
      ${g.items.map((it) => (it.kind === "note" ? noteRow(it) : slotBlock(it))).join("")}
    </div>`).join("");

  $("#detail-body").innerHTML = `
    <div class="plan-actions">
      <button class="act primary" data-act="add-item">＋ 일정 추가</button>
      <button class="act" data-act="edit-plan">코스 편집</button>
      <button class="act danger" data-act="del-plan">삭제</button>
    </div>
    ${groupsHtml || `<div class="empty">아직 일정이 없어요.<br><b>＋ 일정 추가</b>로 시작해요.</div>`}`;
  wireDetail(plan);
  loadThumbs();
}
function wireDetail(plan) {
  const rid = current.regionId, pid = current.planId;
  const body = $("#detail-body");
  body.querySelector('[data-act="add-item"]').onclick = () => goItemForm(null);
  body.querySelector('[data-act="edit-plan"]').onclick = () => goPlanForm(pid);
  body.querySelector('[data-act="del-plan"]').onclick = async () => {
    if (confirm(`'${plan.title}' 코스를 삭제할까요?`)) { await store.deletePlan(rid, pid); goRegion(rid, current.regionName); }
  };
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
      on("del-opt", async () => { if (confirm("이 선택지를 삭제할까요?")) { await store.deleteOption(rid, pid, itemId, optId); renderDetail(); } });
      on("addphoto", () => pickPhoto(itemId, optId));
      on("view", () => openLightbox(itemId, optId));
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
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "image/*";
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    try { await store.setPhoto(current.regionId, current.planId, itemId, optId, f); renderDetail(); }
    catch (e) { alert("사진 처리 실패: " + e.message); }
  };
  inp.click();
}
async function openLightbox(itemId, optId) {
  const d = await store.getPhoto(optId);
  const box = document.createElement("div");
  box.className = "lightbox";
  box.innerHTML = `<div class="lb-inner"><img src="${d || ""}" alt="">
    <div class="lb-bar"><button data-a="chg">사진 변경</button><button data-a="del" class="del">삭제</button><button data-a="close">닫기</button></div></div>`;
  document.body.appendChild(box);
  const close = () => box.remove();
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  box.querySelector('[data-a="close"]').onclick = close;
  box.querySelector('[data-a="chg"]').onclick = () => { close(); pickPhoto(itemId, optId); };
  box.querySelector('[data-a="del"]').onclick = async () => {
    if (confirm("사진을 삭제할까요?")) { await store.deletePhoto(current.regionId, current.planId, itemId, optId); close(); renderDetail(); }
  };
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
  const p = editing ? store.plan(rid, planId) : { title: "", days: "" };
  const back = () => (editing ? goDetail(planId) : goRegion(rid, current.regionName));
  openForm(editing ? "코스 편집" : "새 코스",
    `<label class="fld"><span>코스 이름</span><input id="f-title" type="text" placeholder="예) 강릉 2박3일" value="${esc(p.title)}"></label>
     <label class="fld"><span>기간 (선택)</span><input id="f-days" type="text" placeholder="예) 2박3일 · 7/16~18" value="${esc(p.days)}"></label>`,
    async () => {
      const title = $("#f-title").value.trim(); if (!title) return alert("코스 이름을 입력해줘.");
      const days = $("#f-days").value;
      if (editing) { await store.updatePlan(rid, planId, { title, days }); goDetail(planId); }
      else { const np = await store.addPlan(rid, { title, days }); goDetail(np.id); }
    }, back);
}
function goItemForm(itemId) {
  const rid = current.regionId, pid = current.planId, editing = !!itemId;
  const it = editing ? store.item(rid, pid, itemId) : { group: "", time: "", label: "", kind: "place" };
  const back = () => goDetail(pid);
  const [ts, te] = (it.time || "").split("~").map((s) => (s || "").trim());
  openForm(editing ? "일정 편집" : "일정 추가",
    `<div class="fld"><span>종류</span><div class="seg-group" id="f-kind">
        <button type="button" class="seg ${it.kind === "place" ? "on" : ""}" data-kind="place">장소(선택지)</button>
        <button type="button" class="seg ${it.kind === "note" ? "on" : ""}" data-kind="note">단순 일정</button></div></div>
     <label class="fld"><span>그룹 / 날짜</span><input id="f-group" type="text" placeholder="예) 7/17 (목)  또는  숙소" value="${esc(it.group)}"></label>
     <div class="fld"><span>시간 (선택)</span><div class="time-row">
        <input id="f-ts" type="time" value="${esc(ts || "")}"><span class="time-sep">~</span><input id="f-te" type="time" value="${esc(te || "")}"></div></div>
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
function updateProgress() {
  const total = regionCount(), done = store.visitedCount();
  const fill = $("#prog-fill"), txt = $("#prog-txt");
  if (fill) fill.style.width = (total ? (done / total) * 100 : 0) + "%";
  if (txt) txt.textContent = `${done} / ${total || "…"}`;
}
function celebrate() { const c = $("#celebrate"); if (c) c.classList.remove("hide"); }
function onRemoteChange() {
  const active = document.querySelector(".screen.active");
  updateProgress();
  if (!active) return;
  if (active.id === "s-map") refreshMarkers();
  else if (active.id === "s-region") renderRegion();
  else if (active.id === "s-detail") renderDetail();
}

// ============================================================
// 부팅 + 입장 퀴즈
// ============================================================
const PASS_KEY = "trip-pass";
const ANS = "7JaR67O07Jyk";
const checkAnswer = (v) => { try { return btoa(unescape(encodeURIComponent((v || "").trim()))) === ANS; } catch (e) { return false; } };

async function startApp() {
  await store.load();
  store.subscribe(onRemoteChange);
  await initMap({ onOpenRegion: goRegion, onReady: updateProgress });
  updateProgress();
}
function setupGate() {
  const gate = $("#gate");
  if (localStorage.getItem(PASS_KEY) === "1") { gate.classList.add("hide"); startApp(); return; }
  const input = $("#gate-input"), err = $("#gate-err"), card = gate.querySelector(".gate-card");
  const submit = () => {
    if (checkAnswer(input.value)) { try { localStorage.setItem(PASS_KEY, "1"); } catch (e) {} gate.classList.add("hide"); startApp(); }
    else { err.textContent = "땡! 다시 생각해봐 😝"; card.classList.remove("gate-shake"); void card.offsetWidth; card.classList.add("gate-shake"); input.select(); }
  };
  $("#gate-go").onclick = submit;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  setTimeout(() => input.focus(), 100);
}

document.querySelector("#s-region .back").addEventListener("click", goMap);
document.querySelector("#s-detail .back").addEventListener("click", () => goRegion(current.regionId, current.regionName));
document.querySelector("#s-form .back").addEventListener("click", () => formCancel());
document.querySelector("#cel-close").addEventListener("click", () => $("#celebrate").classList.add("hide"));
setupGate();
