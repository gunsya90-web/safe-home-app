const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
let chromium;try{({chromium}=require('playwright'));}catch{}
test('상황실: 출처·시각·후속통화·긴급경과·작성중 입력·안전 확인', {skip:!chromium}, async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{try{const file=path.join(root,new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/situation.html');
 await page.locator('#desk-actor').fill('상황실검증');await page.locator('#sample').click();
 await page.evaluate(()=>{const s=SAFEHOME.store,i=s.listIncidents().find(i=>!i.closed);s.sendMessage({incidentId:i.id,actor:'담당',recipient:'현장 전체',body:'긴급 확인',urgent:true});s.recordCall({incidentId:i.id,ho:'2503',actor:'담당',outcome:'noanswer',note:'부재 확인'});});
 assert.match(await page.locator('#desk-alerts').innerText(),/긴급 미확인 1건/);assert.match(await page.locator('#desk-alerts').innerText(),/부재·재연락 1건/);
 await page.locator('#show-tasks').click();assert.match(await page.locator('#desk-tasks').innerText(),/부재/);
 await page.locator('#message-body').fill('작성중 메시지');await page.locator('#recipient').fill('구조2팀');await page.locator('#open-call').click();await page.locator('#call-note').fill('작성중 통화');
 await page.evaluate(()=>{const s=SAFEHOME.store,i=s.listIncidents().find(i=>!i.closed);s.recordCall({incidentId:i.id,ho:'2503',actor:'담당',outcome:'connected',note:'재통화 연결'});});
 assert.equal(await page.locator('#message-body').inputValue(),'작성중 메시지');assert.equal(await page.locator('#recipient').inputValue(),'구조2팀');assert.equal(await page.locator('#call-note').inputValue(),'작성중 통화');assert.match(await page.locator('#desk-alerts').innerText(),/부재·재연락 0건/);
 await page.locator('#call-close').click();page.once('dialog',d=>d.dismiss());await page.locator('[data-queue="pending"]').click();assert.equal(await page.locator('#message-body').inputValue(),'작성중 메시지');assert.match(await page.locator('#event-title').innerText(),/상황실 아파트/);
 await page.locator('#open-status').click();await page.locator('[data-new-status="safe"]').click();await page.locator('#confirm-safe').click();assert.equal(await page.locator('#safe-method').isVisible(),true);await page.locator('#safe-method').fill('구조팀 무전으로 잔류 0명 확인');await page.locator('#confirm-safe').click();
 const info=await page.locator('#unit-info').innerText();assert.match(info,/상황실 판단/);assert.match(info,/입주민 신고/);assert.match(info,/판단 기록 시각/);
 const stored=await page.evaluate(()=>{const s=SAFEHOME.store,i=s.listIncidents().find(i=>!i.closed);return {u:s.getUnit('2503',i.id),r:s.getReportByAddress(i.apt,i.dong,'2503',i.id)};});assert.equal(stored.u.fieldObservation.remaining,0);assert.equal(stored.r.status,'danger');
 assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
});
