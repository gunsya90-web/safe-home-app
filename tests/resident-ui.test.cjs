const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let chromium;
try { ({ chromium } = require('playwright')); } catch {}

test('입주민 위치 확인, 입력 유지, 3상태 지원정보와 저장 성공/실패 요약', { skip: !chromium && 'Playwright가 필요합니다 (NODE_PATH로 설치 경로 지정)' }, async t => {
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,body)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(body);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/resident.html`);
 await page.locator('#apt').fill('행복아파트');await page.locator('#dong').fill('101');await page.locator('#ho').fill('501');
 assert.equal(await page.locator('#confirm-location').count(),0);
 await page.locator('#ho').fill('502');assert.match(await page.locator('#location-form button[type=submit]').innerText(),/101동 502호/);
 await page.locator('#location-form button[type=submit]').click();
 async function answers(){await page.locator('[data-answer="아래층"]').click();await page.locator('[data-answer="없음"]').click();await page.getByText('현재 위치 · 인원 · 이동 도움 (선택)',{exact:true}).click();}
 await answers();await page.locator('#current-place').fill('안방');await page.locator('#resident-count').fill('3');await page.locator('#resident-help').selectOption('yes');
 await page.locator('#update').click();await answers();
 assert.equal(await page.locator('#current-place').inputValue(),'안방');assert.equal(await page.locator('#resident-count').inputValue(),'3');assert.equal(await page.locator('#resident-help').inputValue(),'yes');
 await page.locator('#restart').click();assert.equal(await page.locator('#ho').inputValue(),'502');assert.equal(await page.locator('#confirm-location').count(),0);
 await page.locator('#location-form button[type=submit]').click();await answers();
 assert.equal(await page.locator('#resident-help').inputValue(),'yes');
 await page.evaluate(()=>{window.submitted=[];const original=SAFEHOME.store.submitReport;SAFEHOME.store.submitReport=p=>{submitted.push(p);return original(p);};});
 await page.locator('#resident-count').fill('1.5');await page.locator('#save').click();assert.equal(await page.evaluate(()=>submitted.length),0);
 await page.locator('#resident-count').fill('3');await page.locator('#save').click();
 assert.equal(await page.evaluate(()=>submitted.at(-1).hasVulnerable),true);
 let summary=await page.locator('#resident-last-saved').textContent();assert.match(summary,/502호.*안방.*3명.*이동 도움 필요/);assert.match(summary,/실제 119 접수·전송이 아닙니다/);
 await page.locator('#resident-help').selectOption('no');await page.locator('#save').click();assert.equal(await page.evaluate(()=>submitted.at(-1).hasVulnerable),false);
 await page.locator('#resident-help').selectOption('unknown');await page.locator('#save').click();assert.equal(await page.evaluate(()=>submitted.at(-1).hasVulnerable),null);
 summary=await page.locator('#resident-last-saved').textContent();
 await page.evaluate(()=>{SAFEHOME.store.submitReport=()=>null;});await page.locator('#current-place').fill('발코니');await page.locator('#save').click();assert.equal(await page.locator('#resident-last-saved').textContent(),summary);
 await page.reload();assert.equal(await page.locator('#resident-last-saved').textContent(),summary);assert.equal(await page.locator('#confirm-location').count(),0);
 assert.deepEqual(errors,[]);
});
