// ============================================================
// map.js — 전국 시·군·구 코로플레스 (Leaflet)
//   다녀온 지역 = 로즈색으로 칠해짐. 코스 있는 지역 = 옅은 칠.
//   지역 클릭 → onOpenRegion(code, name)
// ============================================================

import { store } from "./store.js";

let H = {};
let map = null, geoLayer = null, total = 0;

const C_VISITED = "#ef6f87";  // 다녀옴 (진한 로즈)
const C_PLANNED = "#f6c2cf";  // 코스 있음 (옅은 로즈)
const C_PLAIN   = "#ead9de";  // 아직 (연회색-로즈)

function styleFor(feat) {
  const id = feat.properties.code;
  const visited = store.isVisited(id);
  const planned = store.plansFor(id).length > 0;
  return {
    fillColor: visited ? C_VISITED : planned ? C_PLANNED : C_PLAIN,
    fillOpacity: visited ? 0.85 : planned ? 0.7 : 0.5,
    color: "#ffffff",
    weight: 0.7,
  };
}

export async function initMap(handlers) {
  H = handlers;
  map = L.map("map", { preferCanvas: true, zoomControl: false, attributionControl: false })
        .setView([36.5, 127.8], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(map);
  L.control.attribution({ position: "bottomleft", prefix: false }).addAttribution("© OpenStreetMap").addTo(map);

  const res = await fetch("data/sigungu.json");
  const gj = await res.json();
  total = gj.features.length;

  geoLayer = L.geoJSON(gj, {
    style: styleFor,
    onEachFeature: (feat, layer) => {
      layer.on("click", () => H.onOpenRegion(feat.properties.code, feat.properties.name));
    },
  }).addTo(map);

  map.fitBounds(geoLayer.getBounds(), { padding: [8, 8] });
  if (H.onReady) H.onReady();
}

export function refreshMarkers() { if (geoLayer) geoLayer.setStyle(styleFor); }
export function regionCount() { return total; }
