# 건축HUB 동·층 후보 수집

공식 명세: https://www.data.go.kr/data/15134735/openapi.do

같은 터미널의 DAEGU_API_SERVICE_KEY를 이용한다. 기본 실행은 K-apt 수집 단지가 위치한 첫 법정동 1곳의 표제부(getBrTitleInfo)·층별개요(getBrFlrOulnInfo)를 수집한다. _type=json을 명시한다. 실제 인증·응답 검증 후 --all로 법정동 전체를 확대할 수 있다.

법정동 범위에는 다른 건물이 포함된다. 결과는 미연결 후보이며 대장PK·주소·동명 등의 실제 필드를 검증해야 한다. 층별개요 행은 용도·구조에 따라 같은 층에 여러 행이 있을 수 있으며 행 수를 층수로 사용하지 않는다. 최고층수로 층·호수를 생성하지 않는다. 기존 사건·세대 데이터에 자동 적용하지 않는다.

결과는 private-data/building-hub/latest.json 및 시각별 파일이다. 웹으로 공개되지 않는다. API 오류 시 해당 법정동·작업이 실패로 기록된다. 실서버 응답 검증 전 준비 도구다.

전유부 getBrExposInfo 수집을 추가했다. 공식 명세의 dongNm(동명칭), hoNm(호명칭), flrNo(층번호), mgmBldrgstPk(관리건축물대장PK)를 원문 보존한다. 최초 표제부·층별개요 요청은 실패했으며 실제 호수 수신은 아직 미확인이다.
