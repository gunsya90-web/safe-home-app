const {bodyOf}=require('../kapt/collect.cjs');
function inspect(text,contentType=''){
 let data;try{data=JSON.parse(text);return {data};}catch{}
 const format=/^\s*</.test(text)?(/<html[\s>]|<!doctype html/i.test(text)?'HTML':'XML'):'기타';
 const match=text.match(/<(?:resultCode|returnReasonCode)>\s*(\d{1,3})\s*<\//i);
 const code=match?match[1]:null;
 const e=Error('JSON 대신 '+format+' 응답');e.responseInfo={format,contentType:/json/i.test(contentType)?'json':/xml/i.test(contentType)?'xml':/html/i.test(contentType)?'html':'other',characters:text.length,apiCode:code};if(code)e.apiCode=code;return {error:e};
}
async function request(url,{fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){for(let attempt=0;attempt<3;attempt++){let r;try{r=await fetcher(url,{signal:AbortSignal.timeout(20000),redirect:'error'});}catch(e){if(attempt<2){await sleep(2000*(attempt+1));continue;}throw Error(e.name==='TimeoutError'?'요청 시간 초과':'네트워크 연결 실패');}if(!r.ok){if((r.status===429||r.status>=500)&&attempt<2){await sleep(3000*(attempt+1));continue;}throw Error('HTTP '+r.status);}let parsed;try{parsed=inspect(await r.text(),r.headers?.get('content-type')||'');}catch{throw Error('응답 본문 읽기 실패');}if(parsed.error){if(!parsed.error.apiCode&&attempt<2){await sleep(3000*(attempt+1));continue;}throw parsed.error;}return bodyOf(parsed.data);}}
function diagnostic(e){const allowed=['요청 시간 초과','네트워크 연결 실패','응답 본문 읽기 실패','JSON 해석 실패','JSON 대신 HTML 응답','JSON 대신 XML 응답','JSON 대신 기타 응답','목록 건수 확인 필요','페이지 누락','중복 페이지 또는 행 확인 필요','전체 건수 불일치','예상과 다른 API 응답 구조: header 없음','성공 응답에 body 없음'];if(/^\d{1,3}$/.test(String(e.apiCode)))return 'API 코드 '+e.apiCode;if(allowed.includes(e.message)||/^HTTP \d{3}$/.test(e.message))return e.message;return '분류되지 않은 로컬 오류';}
module.exports={request,diagnostic,inspect};
