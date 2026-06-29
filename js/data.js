// ============================================================
// data.js — 전국 시·군·구는 data/sigungu.json(경계)에서 옴.
// 첫 실행용 예시 코스 (강릉시 = 코드 32030).
//
// item(일정/슬롯): { id, group, time, label, kind:"place"|"note",
//   selectedId, options:[ {id,name,memo,url,lat,lng,hasPhoto} ], memories:[ photoId ] }
//  · 대표 사진(hasPhoto) = 선택지(후보)별 참고용
//  · 우리 추억(memories) = 일정(슬롯)에 붙고, 확정된 장소에만 표시
//  · 숙소도 그냥 날짜별 일정 (특별 그룹 아님)
// ============================================================

const o = (id, name, memo, url) => ({ id, name, memo: memo || "", url: url || "", lat: "", lng: "", hasPhoto: false });
const stay = (n) => [
  o("stay" + n + "-1", "강릉 로맨스 인 강문", "여기어때 ★9.7", "https://www.yeogi.com/share?type=domestic&productId=62270&categoryId=3&checkIn=2026-07-16&checkOut=2026-07-18&personal=2"),
  o("stay" + n + "-2", "SL호텔 강릉", "여기어때 ★9.2", "https://www.yeogi.com/share?type=domestic&productId=69744&categoryId=2&checkIn=2026-07-16&checkOut=2026-07-18&personal=2"),
  o("stay" + n + "-3", "강릉 머뭄 풀빌라펜션", "여기어때 ★9.8", "https://www.yeogi.com/share?type=domestic&productId=89011&categoryId=3&checkIn=2026-07-16&checkOut=2026-07-18&personal=2"),
];

export const SEED = {
  "32030": [   // 강릉시
    {
      id: "gn-plan",
      title: "강릉 2박3일",
      days: "2박3일 · 7/16~18",
      items: [
        // ── 7/16 (수) ──
        { id: "it-716-1", group: "7/16 (수)", time: "17:00~17:20", label: "퇴근 후 숙소로 출발", kind: "note", selectedId: null, options: [] },
        { id: "it-716-2", group: "7/16 (수)", time: "20:30~21:30", label: "숙소 도착", kind: "note", selectedId: null, options: [] },
        { id: "it-716-3", group: "7/16 (수)", time: "22:00~24:00", label: "늦은 저녁 & 음주", kind: "place", selectedId: null, options: [] },
        { id: "it-716-stay", group: "7/16 (수)", time: "숙박", label: "1박 숙소", kind: "place", selectedId: null, options: stay(1) },

        // ── 7/17 (목) ──
        { id: "it-717-1", group: "7/17 (목)", time: "09:00", label: "기상", kind: "note", selectedId: null, options: [] },
        { id: "it-717-2", group: "7/17 (목)", time: "10:00~11:30", label: "오전 (컨디션 따라 선택)", kind: "place", selectedId: null, options: [
          o("o-717m1", "장칼국수", "해장 Ver · 장소 미정"),
          o("o-717m2", "강릉 중앙시장 투어", "멀쩡 Ver · 여고시절 떡볶이"),
        ]},
        { id: "it-717-3", group: "7/17 (목)", time: "12:00~13:00", label: "강릉 카페", kind: "place", selectedId: null, options: [] },
        { id: "it-717-4", group: "7/17 (목)", time: "13:00~15:00", label: "오후 전시 (날씨 따라 선택)", kind: "place", selectedId: null, options: [
          o("o-717a1", "강릉 아르떼 뮤지엄", "더운 날 Ver · 실내 미디어아트", "https://m.blog.naver.com/rambo3/224324838400"),
          o("o-717a2", "하슬라 아트월드", "시원·추운 날 Ver · 바다정원+미술관", "https://m.blog.naver.com/baram1178/224325726630"),
        ]},
        { id: "it-717-5", group: "7/17 (목)", time: "15:00~17:00", label: "강릉 아라나비", kind: "place", selectedId: null, options: [
          o("o-717b1", "아라나비 (하늘자전거 & 짚라인)", "", "https://m.blog.naver.com/haha4798/224313520751"),
        ]},
        { id: "it-717-6", group: "7/17 (목)", time: "17:00~18:00", label: "숙소 도착", kind: "note", selectedId: null, options: [] },
        { id: "it-717-7", group: "7/17 (목)", time: "18:00~23:00", label: "저녁식사 & 해변산책", kind: "place", selectedId: null, options: [] },
        { id: "it-717-stay", group: "7/17 (목)", time: "숙박", label: "2박 숙소", kind: "place", selectedId: null, options: stay(2) },

        // ── 7/18 (금) ──
        { id: "it-718-1", group: "7/18 (금)", time: "09:00", label: "기상", kind: "note", selectedId: null, options: [] },
        { id: "it-718-2", group: "7/18 (금)", time: "10:00", label: "체크아웃", kind: "note", selectedId: null, options: [] },
        { id: "it-718-3", group: "7/18 (금)", time: "10:00~11:30", label: "해물뚝배기 해장", kind: "place", selectedId: null, options: [] },
        { id: "it-718-4", group: "7/18 (금)", time: "11:30~", label: "집으로", kind: "note", selectedId: null, options: [] },
      ],
    },
  ],
};
