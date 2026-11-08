# K-apt 대구 수집 시작

## 1. 사용자 준비
아래 두 서비스는 2026-11-06 개발계정 승인을 확인했다. 중복 신청하지 않는다. 승인 처리일·로컬 키 설정·실응답은 미검증이다.
- 단지 목록: https://www.data.go.kr/data/15057332/openapi.do
- 기본·상세정보: https://www.data.go.kr/data/15058453/openapi.do

키를 채팅이나 소스에 붙여 넣지 않는다. 맥 터미널에서 다음을 실행하고 입력창에 Decoding 인증키를 입력한다. 입력값은 화면에 표시되지 않으며 파일에 저장하지 않는다.

```sh
cd /Users/macmoning/Documents/ChatGPT/세이프홈
read -s 'DAEGU_API_SERVICE_KEY?공공데이터 인증키: '
export DAEGU_API_SERVICE_KEY
/Users/macmoning/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node tools/kapt/collect.cjs --district 27170 --limit 10
unset DAEGU_API_SERVICE_KEY
```

위 read 문법은 맥 기본 zsh용이다. Node.js 22 이상이면 node 명령으로 대체할 수 있다. 패키지 설치는 필요 없다. 기본 범위는 서구 10개 단지이며 전체 수집이 아니다. 다른 대구 구·군은 공식 법정동 시군구코드를 확인해 --district 값으로 지정한다.

## 2. 결과 검토
- private-data/kapt/latest.json과 시각별 원본을 저장한다. Git 및 웹서버 공개 경로에서 제외된다.
- http://127.0.0.1:4174/data-review.html 에서 latest.json을 선택한다. 추가로 자료조사 폴더 review/access_review.geojson 및 review/reb_identifiers_daegu.json을 열 수 있다.
- 수집한 기본·상세 응답과 시설 원본값, 누락·실패 목록을 확인한다.
- 아직 실서버 인증 조회를 검증하지 않았다. 서비스 변경·응답 형식 차이가 있으면 실패를 표시하고 가짜 자료로 대체하지 않는다.
- 기존 tools/daegu-import는 동·호 후보 수집용 별도 도구다. 이번 도구는 단지·시설 검토용이며 동·호를 추정하거나 기존 앱 상태를 변경하지 않는다.

## 3. 피난시설 필드 확인
K-apt 공식 관리시설 화면에는 경량칸막이, 옥상 대피 가능여부, 세대내 대피공간, 옥상문 자동개폐장치, 피난안전구역, 박공지붕, 공기안전매트, 권상기실, 하향식피난구 항목이 있다.
https://www.k-apt.go.kr/kaptinfo/openKaptMng.do

화면의 항목이 공개 API에도 포함된다는 의미는 아니다. 첫 응답의 실제 필드·의미를 확인한 뒤 매핑 JSON을 만든다. 예: {"경량칸막이":"실제로_확인한_API필드"}. --mapping 파일경로로 전달한다. 영문 필드명을 추정하여 자동 매핑하지 않는다. 별도 매핑이 없으면 정확히 일치하는 한글 필드만 보존한다. 없는 항목은 null/미제공이며 미설치로 바꾸지 않는다.

API에 피난시설 항목이 없다면 K-apt의 공식 다운로드 제공 범위를 확인하거나 기관에 제공을 요청한다. 승인된 공식 자료를 받기 전까지 시설 수집 완료로 취급하지 않는다. 단지 자료를 모든 세대에 일괄 적용하지 않는다.

## 다음 연결 단계
1. 인증 조회로 응답 구조·시설 필드 확인
2. 동·호 목록과 단지코드 연결 검증
3. 검토자·근거를 입력해 단지 참고자료함에 저장·내보내기. 운영 세대 시설 반영은 아직 별도이며 자동 적용하지 않음
4. 공통 DB·권한·기기 간 동기화 구축

진행 중 사건의 시설 스냅샷과 현장 점검값은 자동 수집 자료로 덮어쓰지 않는다.

## 2026-11-06 요청 오류 수정
사용자 첫 실행은 HTTP 400으로 실패했다. 공식 페이지의 Swagger를 확인해 목록 AptListService4/getSigunguAptList4, 기본·상세 AptBasisInfoServiceV5/getAphusBassInfoV5 및 getAphusDtlInfoV5로 수정했다. 직접 header/body 및 response 래퍼 응답을 모두 지원한다. 이 수정만으로 실제 인증 성공을 확인한 것은 아니다. 재시도는 --limit 1로 먼저 수행한다.
