// ============================================================
// config.js — Firebase + 주인(구글 이메일) 화이트리스트
// ============================================================

export const CONFIG = {
  kakaoJsKey: "PASTE_KAKAO_JS_KEY", // 지금 지도는 Leaflet이라 안 써도 됨

  firebase: {
    apiKey: "AIzaSyDLEVkeT6zvxzrTSmYhkoAnVB62CnikCm4",
    authDomain: "trip-7bfff.firebaseapp.com",
    projectId: "trip-7bfff",
    appId: "1:920172536175:web:69dd2e036b5a89f961c89a",
  },

  tripId: "our-east-coast-trip", // 둘이 같은 값이면 같은 지도 공유

  // 이 구글 계정만 들어오고 편집 가능 (Firestore 규칙에도 똑같이 넣어야 함)
  owners: [
    "kh517sy7@gmail.com",
    "OWNER2@gmail.com",   // ← 상대 구글 이메일로 바꿔 넣기
  ],
};

export const KAKAO_ON =
  !!CONFIG.kakaoJsKey && !CONFIG.kakaoJsKey.startsWith("PASTE");
export const FIREBASE_ON =
  !!CONFIG.firebase?.apiKey && !CONFIG.firebase.apiKey.startsWith("PASTE");
