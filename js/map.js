// ============================================================
// map.js — 전국 시·군·구 코로플레스 + 진행중 지역 마커 (Leaflet)
//   · 대한민국 영역으로 지도 고정 (밖으로 못 나감)
//   · 코스가 있는 지역에 마커: 미정 개수(확정 대기) / ♥(다 정함)
//   · 면 색 = 다녀옴(진한 로즈) / 코스있음(옅은 로즈) / 아직(연회색)
// ============================================================

import { store } from "./store.js";

let H = {};
let map = null, geoLayer = null, markerLayer = null, total = 0;

const C_VISITED = "#ef6f87";
const C_PLANNED = "#f6c2cf";
// 안 간 지역: 인접끼리 구분되도록 옅은 톤을 코드 해시로 번갈아
const PLAIN_TINTS = ["#ecdbe0", "#e4cfd6", "#f1e1e5", "#e7d3da", "#eed8de"];
function plainTint(code) {
  let h = 0; for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  return PLAIN_TINTS[h % PLAIN_TINTS.length];
}

const KOREA_BOUNDS = L.latLngBounds([32.9, 124.4], [39.0, 132.2]);

function styleFor(feat) {
  const id = feat.properties.code;
  const visited = store.isVisited(id);
  const planned = store.plansFor(id).length > 0;
  const fill = visited ? C_VISITED : planned ? C_PLANNED : plainTint(id);
  const op = visited ? 0.88 : planned ? 0.78 : 0.82;
  return { fillColor: fill, fillOpacity: op, color: "#ffffff", weight: 1.1, opacity: 1 };
}
function hoverOn(e) {
  const l = e.target;
  l.setStyle({ weight: 2.8, color: "#ffffff", fillOpacity: 0.95 });
  if (l.bringToFront) l.bringToFront();
  if (map) map.getContainer().style.cursor = "pointer";
}
function hoverOff(e) { if (geoLayer) geoLayer.resetStyle(e.target); if (map) map.getContainer().style.cursor = ""; }

function buildMarkers() {
  markerLayer.clearLayers();
  geoLayer.eachLayer((l) => {
    const code = l.feature.properties.code;
    const name = l.feature.properties.name;
    const plans = store.plansFor(code);
    if (!plans.length) return; // 코스 없는 지역은 마커 없음
    const undecided = plans.reduce((n, p) => n + store.planUndecided(p), 0);
    const pending = undecided > 0;
    const html = `<div class="regmark ${pending ? "" : "done"}">${pending ? undecided : "♥"}</div>`;
    const m = L.marker(l.getBounds().getCenter(), {
      icon: L.divIcon({ className: "", html, iconSize: [26, 26], iconAnchor: [13, 13] }),
      zIndexOffset: 1000,
    });
    m.bindTooltip(name, { permanent: true, direction: "top", offset: [0, -14], className: "reg-tip" });
    m.on("click", () => H.onOpenRegion(code, name));
    markerLayer.addLayer(m);
  });
}

export async function initMap(handlers) {
  H = handlers;
  map = L.map("map", {
    preferCanvas: true, zoomControl: false, attributionControl: false,
    maxBoundsViscosity: 1.0,
  }).setView([36.5, 127.8], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map);
  L.control.attribution({ position: "bottomleft", prefix: false }).addAttribution("© OpenStreetMap").addTo(map);

  const res = await fetch("data/sigungu.json");
  const gj = await res.json();
  total = gj.features.length;

  geoLayer = L.geoJSON(gj, {
    style: styleFor,
    onEachFeature: (feat, layer) => layer.on({
      mouseover: hoverOn,
      mouseout: hoverOff,
      click: () => H.onOpenRegion(feat.properties.code, feat.properties.name),
    }),
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
  buildMarkers();

  map.fitBounds(geoLayer.getBounds(), { padding: [8, 8] });
  map.setMaxBounds(KOREA_BOUNDS);      // 한국 밖으로 못 나감
  map.setMinZoom(map.getZoom());        // 더 줌아웃해서 세계지도로 못 빠짐
  setTimeout(() => map.invalidateSize(), 60);
  if (H.onReady) H.onReady();
}

export function refreshMarkers() {
  if (geoLayer) geoLayer.setStyle(styleFor);
  if (markerLayer) buildMarkers();
}
export function regionCount() { return total; }
