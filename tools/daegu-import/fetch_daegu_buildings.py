"""
대구 지역 공동주택(아파트) 아파트명·동·호 목록을 공공데이터포털 API로 받아,
SAFE-HOME 관리자 화면의 "아파트 정보 일괄 등록(CSV)" 패널에 그대로 붙여넣을 수 있는
CSV(헤더 없음, 아파트명,동,호)로 변환하는 스크립트.

## 준비물 (직접 하셔야 하는 부분 — 이 스크립트가 대신 해줄 수 없습니다)
1. https://www.data.go.kr 회원가입
2. 아래 세 서비스를 각각 "활용신청"하고 승인(보통 자동, 몇 분~1~2시간)을 기다린 뒤
   마이페이지에서 서비스키(인증키)를 복사합니다.
   - 국토교통부_공동주택 단지 목록제공 서비스 (getSigunguAptList3)
   - 국토교통부_공동주택 기본 정보제공 서비스 (getAphusBassInfoV4)
   - 국토교통부_건축물대장정보 서비스 (전유부 조회 — 동명칭/호명칭)
3. `pip install pandas requests xmltodict` 로 라이브러리를 설치합니다.
4. 서비스키는 코드에 직접 적지 않고, 실행 직전에 환경변수로만 넘깁니다(이 저장소는 공개
   저장소라서, 키를 파일에 적어두면 커밋될 때 그대로 공개됩니다):

   ```bash
   # Windows PowerShell (반드시 "PowerShell" 앱에서 — Python 인터프리터(>>>)나 Colab 아님)
   $env:DAEGU_API_SERVICE_KEY = "발급받은_서비스키"
   python fetch_daegu_buildings.py
   ```

   조회할 대구 구/군은 아래 SIGUNGU_CODES에서 필요한 것만 남겨도 됩니다.
5. 실행이 끝나면 같은 폴더에 daegu_buildings.csv가 생기는데, 이 파일 내용을
   그대로 복사해서 관리자 화면의 CSV 붙여넣기 칸에 넣으면 됩니다.

## 보안 주의사항
- 서비스키는 **절대 이 파일이나 다른 코드 파일에 직접 적어서 커밋하지 마세요.** 이 저장소는
  GitHub Pages로 배포되는 공개 저장소라, 커밋 이력에 남으면 누구나 볼 수 있습니다.
- 위 환경변수 방식으로 실행하면 키가 파일에 전혀 남지 않습니다.
- 서비스키를 이미 어딘가(채팅, 메모 앱, 캡처 이미지, 노트북 셀 등)에 노출했다면,
  data.go.kr 마이페이지에서 키를 재발급(기존 키 폐기)하는 걸 권장합니다.

## 동작 방식 (3단계)
1. "공동주택 단지 목록제공 서비스"(getSigunguAptList3)로 구/군마다 등록된 단지 목록
   (단지코드 kaptCode, 단지명 kaptName, 법정동코드 bjdCode)을 페이지 단위로 받아온다.
2. 그 단지코드로 "공동주택 기본 정보제공 서비스"(getAphusBassInfoV4)를 불러 정확한
   주소(도로명주소/지번주소)와 법정동코드를 받아온다 — 1단계는 단지명만 주고 정확한
   번지(지번)는 안 줘서, 이 단계가 꼭 필요합니다.
3. 그 주소(법정동코드 + 번지)로 건축물대장 "전유부" 조회를 걸어 실제 동명칭(dongNm)/
   호명칭(hoNm) 목록을 받아온다.

이 스크립트는 데이터 요청 시점에 Swagger 문서에서 실제 확인한 필드명(kaptCode, kaptName,
bjdCode 등)으로 작성했지만, 2·3단계 응답 필드명 일부는 API 설명 문구를 바탕으로 한 최선의
추정입니다. 실행 중 "예상과 다른 응답" 로그가 뜨면 그 원문을 보고 알려주시면 바로 고칠 수
있습니다 — 단지 하나가 실패해도 전체가 멈추지 않고 계속 진행됩니다.

- 소방시설현황·평면도는 이 파이프라인에 포함되지 않습니다(요청하신 대로 제외). 새로 등록된
  건물은 SAFE-HOME 관리자 화면에서 "확인 필요" 상태로 시작하고, 건물별 "소방시설 점검 링크"로
  나중에 채우면 됩니다.
"""

import os
import re
import sys
import time
import urllib.parse

try:
    import pandas as pd
    import requests
    import xmltodict
except ImportError:
    sys.exit("먼저 설치하세요: pip install pandas requests xmltodict")

# 서비스키는 파일에 직접 적지 않고 환경변수로만 받는다.
SERVICE_KEY = os.environ.get("DAEGU_API_SERVICE_KEY", "")

# 대구 8개 구/군의 법정동코드 앞 5자리(시군구코드) — 통계청 표준 법정동코드 기준.
# 지금은 서구만 조회하도록 좁혀뒀습니다. 다른 구/군도 다시 받고 싶으면 아래 주석 처리된
# 줄들을 되살리면 됩니다.
SIGUNGU_CODES = {
    "서구": "27170",
    # "중구": "27110",
    # "동구": "27140",
    # "남구": "27200",
    # "북구": "27230",
    # "수성구": "27260",
    # "달서구": "27290",
    # "달성군": "27710",
}

APT_LIST_URL = "http://apis.data.go.kr/1613000/AptListService3/getSigunguAptList3"
APT_BASIS_URL = "http://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4"
EXPOS_INFO_URL = "http://apis.data.go.kr/1613000/BldRgstHubService/getBrExposInfo"  # 전유부(동/호명칭) 조회
REQUEST_TIMEOUT_SEC = 15  # 이 시간 안에 응답이 없으면 포기하고 다음으로 넘어간다(무한 대기 방지)
OUTPUT_CSV = "daegu_seogu_buildings.csv"  # 서구만 받으므로 기존 daegu_buildings.csv(대구 전체)는 그대로 남겨둔다
REQUEST_INTERVAL_SEC = 1.0  # 공공데이터포털 초당 호출 제한 방지용 최소 대기시간
RETRY_BACKOFF_SEC = [2, 5, 10]  # 요청이 실패하면(대부분 순간적인 호출 제한) 이만큼 기다렸다가 재시도
PAGE_SIZE = 100
# ─────────────────────────────────────────────────────────────────────

# data.go.kr 서비스키는 "Encoding"(이미 %XX로 인코딩된 값)과 "Decoding"(원본 값) 두 형태로
# 발급되는데, 마이페이지에서 어느 쪽을 복사했는지에 따라 requests에 넘기는 방식이 달라야 한다.
# - Decoding 키는 requests의 params=에 넣어 자동 인코딩되게 해야 하고,
# - Encoding 키는 이미 인코딩되어 있으므로 URL에 그대로 붙여야 한다(안 그러면 이중 인코딩되어 403).
# 어떤 키를 받았는지 코드가 알 수 없으므로, 둘 다 시도해보고 성공한 방식을 API(base_url)별로 기억해 재사용한다.
_working_key_mode = {}
_printed_samples = set()  # API별로 첫 응답 원문을 한 번씩만 출력해서 진단에 쓴다


def _call_once(base_url, extra_params, sample_tag):
    """한 번만 호출해본다(재시도는 call_data_go_kr에서 감싼다)."""
    cached_mode = _working_key_mode.get(base_url)
    modes = [cached_mode] if cached_mode else ["raw", "params"]
    last_error = None
    for mode in modes:
        try:
            if mode == "raw":
                query = urllib.parse.urlencode(extra_params)
                url = f"{base_url}?serviceKey={SERVICE_KEY}&{query}"
                resp = requests.get(url, timeout=REQUEST_TIMEOUT_SEC)
            else:
                params = dict(extra_params, serviceKey=SERVICE_KEY)
                resp = requests.get(base_url, params=params, timeout=REQUEST_TIMEOUT_SEC)
            resp.raise_for_status()
            raw_text = resp.text
            data = resp.json()
        except Exception as e:
            last_error = f"({mode}) {e}"
            continue

        if sample_tag not in _printed_samples:
            print(f"  [진단:{sample_tag}] 최초 응답 원문(mode={mode}): {raw_text[:500]}")
            _printed_samples.add(sample_tag)

        payload = data.get("response", data) if isinstance(data, dict) else {}
        header = payload.get("header") if isinstance(payload, dict) else None
        body = payload.get("body") if isinstance(payload, dict) else None
        if not isinstance(body, dict):
            last_error = f"({mode}) 예상과 다른 응답 구조: {raw_text[:300]}"
            continue
        if isinstance(header, dict):
            result_code = str(header.get("resultCode", "")).strip()
            if result_code and result_code not in ("00", "0"):
                last_error = f"({mode}) resultCode={result_code!r} resultMsg={header.get('resultMsg')!r}"
                continue

        _working_key_mode[base_url] = mode  # 이 API에서 통한 방식을 기억해서 다음부터는 바로 이걸로 시도
        return body, None

    return None, last_error


def call_data_go_kr(base_url, extra_params, sample_tag):
    """공공데이터포털 REST API 공용 호출기.
    - Encoding/Decoding 키 두 방식을 모두 시도한다(API(base_url)마다 서버가 달라 통하는 방식이
      다를 수 있으므로, 성공한 방식은 base_url별로 따로 기억해 재사용한다).
    - 응답이 {"header":...,"body":...}로 오든 {"response":{"header":...,"body":...}}로 오든 둘 다 받아들인다.
    - 실패하면(대부분 순간적인 초당 호출 제한) 잠깐 기다렸다가 몇 번 더 시도해본다.
    - 성공하면 (body_dict, None)을, 끝내 실패하면 (None, 에러메시지)를 돌려준다.
    """
    body, err = _call_once(base_url, extra_params, sample_tag)
    if body is not None:
        return body, None
    for wait_sec in RETRY_BACKOFF_SEC:
        time.sleep(wait_sec)
        body, err = _call_once(base_url, extra_params, sample_tag)
        if body is not None:
            return body, None
    return None, err


def fetch_apt_list_page(sigungu_code, page_no):
    """1단계: 이 시군구에 등록된 공동주택 단지 목록을 한 페이지(page_no) 가져온다."""
    body, err = call_data_go_kr(
        APT_LIST_URL,
        {"sigunguCode": sigungu_code, "pageNo": str(page_no), "numOfRows": str(PAGE_SIZE), "_type": "json"},
        "단지목록",
    )
    if body is None:
        print(f"  [단지 목록 API 요청 실패] {err}")
        return [], 0

    total_count = int(body.get("totalCount", 0) or 0)
    items = body.get("items")
    if items in (None, "", []):
        return [], total_count
    if isinstance(items, dict):
        # 결과가 1건이면 리스트가 아니라 dict 하나로 오는 API들이 있어 방어적으로 처리
        items = items.get("item", items)
        if isinstance(items, dict):
            items = [items]
    return items, total_count


def fetch_all_apt_list(sigungu_name, sigungu_code):
    """페이지를 넘겨가며 이 시군구의 모든 단지를 모은다."""
    all_items = []
    page = 1
    while True:
        items, total = fetch_apt_list_page(sigungu_code, page)
        time.sleep(REQUEST_INTERVAL_SEC)
        if not items:
            break
        all_items.extend(items)
        print(f"[단지 목록] {sigungu_name} {page}페이지 · 누적 {len(all_items)}/{total or '?'}건")
        if total and len(all_items) >= total:
            break
        if len(items) < PAGE_SIZE:
            break
        page += 1
    return all_items


def fetch_apt_basis_info(kapt_code):
    """2단계: 단지코드로 정확한 주소(도로명주소/지번주소)와 법정동코드를 받아온다."""
    body, err = call_data_go_kr(APT_BASIS_URL, {"kaptCode": kapt_code}, "기본정보")
    if body is None:
        return None, err
    item = body.get("item") or body.get("items")
    if isinstance(item, list):
        item = item[0] if item else None
    return item, None


def guess_bun_ji(addr_text):
    """주소 문자열에서 번지를 최대한 뽑아본다. 예: '...123-4' → bun=123, ji=4."""
    if not addr_text:
        return "", ""
    matches = re.findall(r"(\d+)(?:-(\d+))?", str(addr_text))
    if not matches:
        return "", ""
    # 마지막으로 나오는 숫자 패턴이 보통 번지(도로명 뒤 건물번호이거나 지번의 본번-부번)다.
    bun, ji = matches[-1]
    return bun, ji


def _call_once_xml(base_url, extra_params, sample_tag):
    """전유부 API는 XML로만 응답하므로(다른 API들의 JSON용 _call_once와 별도), XML 전용으로 호출한다.
    항상 timeout을 걸어서, 서버가 응답을 안 주더라도 절대 무한정 기다리지 않는다."""
    cached_mode = _working_key_mode.get(base_url)
    modes = [cached_mode] if cached_mode else ["raw", "params"]
    last_error = None
    for mode in modes:
        try:
            if mode == "raw":
                query = urllib.parse.urlencode(extra_params)
                url = f"{base_url}?serviceKey={SERVICE_KEY}&{query}"
                resp = requests.get(url, timeout=REQUEST_TIMEOUT_SEC)
            else:
                params = dict(extra_params, serviceKey=SERVICE_KEY)
                resp = requests.get(base_url, params=params, timeout=REQUEST_TIMEOUT_SEC)
            resp.raise_for_status()
            raw_text = resp.text
            data = xmltodict.parse(raw_text)
        except Exception as e:
            last_error = f"({mode}) {e}"
            continue

        if sample_tag not in _printed_samples:
            print(f"  [진단:{sample_tag}] 최초 응답 원문(mode={mode}): {raw_text[:500]}")
            _printed_samples.add(sample_tag)

        response = data.get("response") if isinstance(data, dict) else None
        if not isinstance(response, dict):
            last_error = f"({mode}) 예상과 다른 응답 구조: {raw_text[:300]}"
            continue
        header = response.get("header") or {}
        result_code = str(header.get("resultCode", "")).strip()
        if result_code and result_code not in ("00", "0"):
            last_error = f"({mode}) resultCode={result_code!r} resultMsg={header.get('resultMsg')!r}"
            continue

        _working_key_mode[base_url] = mode
        return response.get("body") or {}, None

    return None, last_error


EXPOS_PAGE_SIZE = 100  # 이 API는 numOfRows를 크게 요청해도 서버가 한 페이지당 최대 100건으로 잘라서 주는 것으로 확인됨


def _fetch_units_page(sigungu_code, bdong_code, bun, ji, page_no):
    """전유부 한 페이지(최대 EXPOS_PAGE_SIZE건)를 가져온다. 실패하면(대부분 순간적인 호출 제한) 재시도한다."""
    params = {
        "numOfRows": str(EXPOS_PAGE_SIZE), "pageNo": str(page_no),
        "sigunguCd": sigungu_code, "bjdongCd": bdong_code,
    }
    if bun:
        params["bun"] = str(bun).zfill(4)
    if ji:
        params["ji"] = str(ji).zfill(4)

    body, err = _call_once_xml(EXPOS_INFO_URL, params, "전유부")
    if body is None:
        for wait_sec in RETRY_BACKOFF_SEC:
            time.sleep(wait_sec)
            body, err = _call_once_xml(EXPOS_INFO_URL, params, "전유부")
            if body is not None:
                break
    return body, err


def fetch_units(sigungu_code, bdong_code, bun, ji):
    """3단계: 특정 지번(번지)의 전유부(동명칭/호명칭) 전체를 가져온다.
    한 단지가 EXPOS_PAGE_SIZE세대보다 많으면(대부분의 아파트가 그렇다) 여러 페이지에 걸쳐 나뉘어
    오므로, totalCount에 도달할 때까지 또는 마지막 페이지(반환 건수가 페이지 크기보다 적음)까지 계속 가져온다."""
    all_rows = []
    page_no = 1
    while True:
        body, err = _fetch_units_page(sigungu_code, bdong_code, bun, ji, page_no)
        if body is None:
            if page_no == 1:
                print(f"    [전유부 조회 실패] {sigungu_code}/{bdong_code}/{bun}-{ji}: {err}")
                return []
            break  # 이미 앞선 페이지는 모아뒀으니 그것만이라도 쓴다

        items = body.get("items")
        rows = []
        if items:
            rows = items.get("item") if isinstance(items, dict) else items
            if isinstance(rows, dict):
                rows = [rows]
        if isinstance(rows, list):
            all_rows.extend(rows)

        total_count = int(body.get("totalCount", 0) or 0)
        if not rows or len(all_rows) >= total_count or len(rows) < EXPOS_PAGE_SIZE:
            break
        page_no += 1
        time.sleep(REQUEST_INTERVAL_SEC)

    return all_rows


def find_key(d, keywords):
    for k in d.keys():
        if any(kw in k for kw in keywords):
            return k
    return None


def main():
    if not SERVICE_KEY:
        sys.exit("DAEGU_API_SERVICE_KEY 환경변수가 설정되지 않았습니다. 위 안내를 참고하세요.")

    rows = []
    skipped = 0
    for sigungu_name, sigungu_code in SIGUNGU_CODES.items():
        complexes = fetch_all_apt_list(sigungu_name, sigungu_code)
        print(f"  → {sigungu_name} 단지 {len(complexes)}개 확인, 주소·세대(호) 조회 시작")

        for idx, c in enumerate(complexes, 1):
            apt_name = str(c.get("kaptName", "")).strip()
            kapt_code = str(c.get("kaptCode", "")).strip()
            fallback_bjd_code = str(c.get("bjdCode", "")).strip()
            print(f"  [{idx}/{len(complexes)}] {apt_name} 처리 중...")
            if not apt_name or not kapt_code:
                skipped += 1
                continue

            basis, err = fetch_apt_basis_info(kapt_code)
            time.sleep(REQUEST_INTERVAL_SEC)
            if not basis:
                print(f"    [기본정보 조회 실패] {apt_name}: {err}")
                skipped += 1
                continue

            bjd_col = find_key(basis, ["bjdCode", "법정동코드"])
            addr_col = find_key(basis, ["doroJuso", "kaptAddr", "도로명주소", "지번주소", "법정동주소"])
            bjd_code = str(basis.get(bjd_col, "") if bjd_col else fallback_bjd_code).strip()
            addr_text = basis.get(addr_col, "") if addr_col else ""
            if not bjd_code or len(bjd_code) < 10:
                skipped += 1
                continue

            sgg_code = bjd_code[:5]
            bdong_code = bjd_code[5:]
            bun, ji = guess_bun_ji(addr_text)
            if not bun:
                skipped += 1
                continue

            units = fetch_units(sgg_code, bdong_code, bun, ji)
            time.sleep(REQUEST_INTERVAL_SEC)
            if not units:
                skipped += 1
                continue

            dong_key = find_key(units[0], ["동명칭", "dongNm"])
            ho_key = find_key(units[0], ["호명칭", "hoNm"])
            if not dong_key or not ho_key:
                print(f"    전유부 필드를 찾지 못했습니다({apt_name}). 실제 필드 목록: {list(units[0].keys())}")
                skipped += 1
                continue

            found = 0
            for u in units:
                dong = str(u.get(dong_key, "")).strip()
                ho = str(u.get(ho_key, "")).strip()
                if dong and ho:
                    rows.append({"apt": apt_name, "dong": dong, "ho": ho})
                    found += 1
            if found:
                print(f"    ✓ {apt_name}: {found}세대")

    print(f"\n건너뛴 단지 {skipped}개 (주소를 못 구했거나 전유부 조회 실패)")

    if not rows:
        sys.exit("가져온 데이터가 없습니다. 위 로그(오류 메시지, 실패 사유)를 확인해주세요.")

    out = pd.DataFrame(rows).drop_duplicates()
    out.to_csv(OUTPUT_CSV, index=False, header=False, encoding="utf-8-sig")
    print(f"완료: {len(out)}행 → {OUTPUT_CSV}")
    print("이 파일 내용을 SAFE-HOME 관리자 화면의 '아파트 정보 일괄 등록(CSV)' 칸에 붙여넣으세요.")


if __name__ == "__main__":
    main()
