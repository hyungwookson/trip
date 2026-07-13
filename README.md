# 우리가 채워가는 지도

전국 시·군·구(250개)를 면으로 그린 지도. 다녀온 지역이 로즈색으로 칠해지고,
다 채우면 축하 화면이 떠요. 지역마다 코스·장소·사진·평가를 직접 넣을 수 있어요.

## 동작
- 지도에서 **지역(면)을 탭** → 그 지역 화면(다녀왔어요 토글 + 코스 목록)
- **다녀왔어요** → 그 지역이 로즈색으로 칠해짐 (둘이 공유)
- 코스 안에서 일정·선택지·사진·평가 추가/편집 (선택지 카드의 사진칸 = 갤러리 업로드)
- 하단 진행도 바: **다녀온 지역 N / 250**
- 색: 진한 로즈=다녀옴, 옅은 로즈=코스 있음, 연한 회색=아직

## 폴더
```
trip/
├─ index.html
├─ css/styles.css
├─ data/sigungu.json   전국 시군구 경계 (출처: github.com/southkorea/southkorea-maps, 단순화)
└─ js/
   ├─ config.js   Firebase 키 (비우면 이 기기에만 저장)
   ├─ data.js     첫 실행용 강릉(코드 32030) 예시 코스
   ├─ util.js     헬퍼 + 사진 축소
   ├─ store.js    저장/사진/CRUD/다녀옴
   ├─ map.js      Leaflet 코로플레스 (시군구 면 색칠)
   └─ app.js      UI
```

## 보기 / 배포
ES 모듈 + 경계 파일을 fetch 하므로 더블클릭 X. 로컬은 `python -m http.server 5173` → http://localhost:5173.
배포는 폴더째 GitHub Pages / Vercel 에 올리면 됨 (data/sigungu.json 포함).

## 저장
- 키 없음: 데이터=localStorage, 사진=IndexedDB (이 브라우저에만 유지, 공유 X)
- Firebase 키 넣으면: Firestore 실시간 공유 + 사진 photos 컬렉션. (config.js 참고)

## 참고
- 지도 단위는 시군구. 광역(17개)으로 바꾸려면 더 단순한 경계 파일로 교체하면 됨.
- 코로플레스는 Leaflet 기준이라 카카오맵 SDK 경로는 이 버전에선 사용 안 함.
- 처음부터 다시: 콘솔에서 localStorage.clear() + IndexedDB 'tripPhotos' 삭제.
