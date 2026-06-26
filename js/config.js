// ============================================================
// config.js — 키를 여기만 채우면 카카오맵 + Firebase 동기화가 켜짐.
// 비워두면(PASTE_ 그대로면) 자동으로 기본 모드로 동작:
//   지도   → OpenStreetMap(Leaflet)
//   저장   → 이 기기 안에서만(공유 X)
// ============================================================

export const CONFIG = {
  // ── 1) 카카오맵 ────────────────────────────────────────────
  // https://developers.kakao.com → 내 애플리케이션 → 앱 만들기
  //   · [앱 키]의 "JavaScript 키"를 아래에 붙여넣기
  //   · [플랫폼 > Web]에 사용할 도메인 등록 (예: http://localhost:5173 그리고 배포 주소)
  kakaoJsKey: "PASTE_KAKAO_JS_KEY",

  // ── 2) Firebase (둘이 실시간 공유) ─────────────────────────
  // https://console.firebase.google.com → 프로젝트 생성 → 웹 앱(</>) 추가
  //   · 표시되는 firebaseConfig 값을 아래에 그대로 붙여넣기
  //   · 좌측 메뉴 [Firestore Database] → 데이터베이스 만들기 (테스트 모드로 시작 가능)
  firebase: {
    apiKey: "PASTE_FIREBASE_API_KEY",
    authDomain: "PASTE.firebaseapp.com",
    projectId: "PASTE_PROJECT_ID",
    appId: "PASTE_APP_ID",
  },

  // 둘이 같은 값을 쓰면 같은 여행 데이터를 공유함 (원하는 문자열로)
  tripId: "our-east-coast-trip",
};

// ── 활성화 여부 판단 (PASTE_ 로 시작하면 비활성) ──
export const KAKAO_ON =
  !!CONFIG.kakaoJsKey && !CONFIG.kakaoJsKey.startsWith("PASTE");
export const FIREBASE_ON =
  !!CONFIG.firebase?.apiKey && !CONFIG.firebase.apiKey.startsWith("PASTE");
