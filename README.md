# SAFE-HOME

AFP(아파트 화재 안전 플랫폼) 데이터를 기반으로, 화재 발생 시 **입주민 · 119 종합상황실 · 현장 소방대원** 3자가
같은 정보를 실시간으로 공유하며 각자 최적의 행동을 결정하도록 돕는 의사결정 플랫폼 데모입니다.

빌드 도구 없이 순수 HTML/CSS/JavaScript로 작성되어 있어, 저장소를 그대로 GitHub Pages에 올리면 바로 동작합니다.

## 실행 방법

### 로컬에서 열어보기
`index.html`을 더블클릭해서 브라우저로 바로 열어도 기본 동작은 확인할 수 있습니다.
다만 **세대 간 실시간 동기화(localStorage 이벤트)** 는 브라우저가 파일을 `file://`로 열 때 탭마다
출처(origin)를 다르게 취급할 수 있어 불안정합니다. 정확히 확인하려면 간단한 정적 서버로 열어주세요.

```bash
# Node.js가 있다면
npx serve .

# Python이 있다면
python -m http.server 8080
```

그 다음 브라우저에서 같은 서버 주소로 탭을 2~3개 열어(예: 입주민 탭 / 119 상황실 탭) 입주민 화면에서
대피 안내를 진행하면, 다른 탭의 상황실·소방대원 화면에 실시간으로 반영되는 것을 확인할 수 있습니다.
(한 탭 안에서 상단 역할 탭을 눌러 전환해도 동일하게 반영됩니다.)

### GitHub Pages로 배포하기
1. 이 폴더 전체를 GitHub 저장소에 push 합니다.
2. 저장소 **Settings → Pages** 에서 Source를 `GitHub Actions`로 선택합니다.
   (이미 `.github/workflows/pages.yml`이 포함되어 있어 `main` 브랜치에 push할 때마다 자동 배포됩니다.)
3. 배포가 끝나면 `https://<계정>.github.io/<저장소명>/` 주소로 접속할 수 있습니다.

Actions 없이도, Settings → Pages에서 `Deploy from branch: main / (root)`를 선택하면 별도 빌드 없이 바로 서빙됩니다.

## 폴더 구조

```
safehome-app/
├─ index.html            앱 셸(상단바, 역할 탭, 뷰 컨테이너)
├─ manifest.webmanifest  PWA 매니페스트 (홈 화면에 설치 가능)
├─ sw.js                 오프라인 대비 앱 셸 캐시 서비스워커
├─ css/styles.css        전체 스타일
├─ icons/icon.svg         앱 아이콘
└─ js/
   ├─ data.js       질문 정의, AFP-Core/AFP-Search 목업 DB, 세대 그리드 생성
   ├─ ui.js         공용 DOM 유틸(아이콘 SVG, 토스트, 세대 현황 그리드 렌더러)
   ├─ store.js      3개 화면이 공유하는 상태 저장소 (localStorage + storage 이벤트 + BroadcastChannel)
   ├─ rules.js      Q1~Q5 답변과 AFP 정보로 대피 행동(A~G)을 판정하는 규칙 엔진
   ├─ resident.js   입주민 대피 안내 화면
   ├─ situation.js  119 종합상황실 대시보드
   ├─ firefighter.js 현장 소방대원 정보카드
   └─ app.js        역할 전환, 공통 상단바/진행바/SOS 버튼 제어
```

## 초안 대비 달라진 점

기존 단일 HTML 초안(`fire_evacuation_guide_safehome_v5.html`)을 검토한 뒤, 제공해주신 **흐름도 2.0**(공동주택
화재 발생 시 행동 안내 흐름도) 기준으로 아래와 같이 다시 설계했습니다.

- **질문 세분화**: Q1(화재 위치) 6지선다, Q2(연기·화염) 5단계, Q3(현관 대피) 6지선다로 흐름도와 동일하게 맞췄습니다.
  기존 초안은 Q2/Q3가 예/아니오 이진 선택이라 실제 판단 세밀도가 떨어졌습니다.
- **대피 결과 A~G 재정의**: 흐름도의 AFP 항목(하향식 피난구·대피공간·경량칸막이·옥상대피 등)에 "완강기"가 없어,
  초안에 있던 완강기(D) 단독 분기를 없애고 흐름도와 동일한 7개 결과(A 계단대피 / B 세대내대기 / C 대피공간이동 /
  D 하향식피난구 / E 경량칸막이 / F 구조요청 / G 옥상대피)로 통일했습니다.
- **AFP 보정 로직 통합**: 초안은 먼저 결과를 정하고 나중에 `applyAfpCorrection()`으로 덧씌우는 2단계 구조였는데,
  이 과정에서 로직을 追跡하기 어려웠습니다. 새 버전은 `rules.js`의 `decide()` 한 곳에서 AFP 설치 여부를 바로
  반영해 판단 근거(`notes[]`)를 함께 남기므로, 119/소방대원 화면에서 "왜 이 결론이 나왔는지" 그대로 보여줄 수 있습니다.
- **3자 화면 추가**: 기획서의 Resident / 119 Situation Room / Firefighter Protocol 개념을 반영해
  119 상황실 대시보드(신고 큐, 체크리스트, 실시간 세대 현황)와 현장 소방대원 정보카드
  (AFP-Search 기반 건물 특이사항, 구조 우선순위)를 새로 만들고, 입주민의 대피 진행 상황이
  실시간으로 두 화면에 반영되도록 공유 상태 저장소(`store.js`)를 도입했습니다.
- **PWA화**: 오프라인/네트워크 불안정 상황에서도 대피 안내가 열리도록 매니페스트와 서비스워커를 추가했습니다.

## 알아두어야 할 한계 (데모 범위)

- **AFP-Core/AFP-Search 데이터는 목업**입니다 (`js/data.js`의 `AFP_CORE`, `AFP_SEARCH`, `BUILDING`).
  실제 서비스에서는 K-apt 단지코드 API 및 소방청 AFP 데이터베이스와 연동되어야 합니다.
- **119 상황실 → 출동대 지령, 소방대원 처치 결과**는 실제 무선지령시스템이 아니라 화면상의 상태 표시(mock)입니다.
- **실시간 동기화는 같은 브라우저(localStorage 기준)** 로 제한됩니다. 여러 사용자가 서로 다른 기기에서 함께
  보려면 Firebase Realtime Database, Supabase 등 실제 백엔드로 `store.js`의 저장/구독 부분만 교체하면 됩니다.
