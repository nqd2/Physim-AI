import { launchBrowser, webUrl, apiUrl, artifact, blockLearningRequests, requestLocation } from './browser-support.mjs';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
const checks=[],findings=[],pageErrors=[],report={startedAt:new Date().toISOString(),webUrl,apiUrl,checks,findings,pageErrors};
const browser=await launchBrowser();
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
await blockLearningRequests(context,report);
report.layoutSkipped=process.env.PHYSIM_SKIP_LAYOUT==='1';
page.setDefaultTimeout(25000);page.on('pageerror',e=>pageErrors.push(e.message));report.failedRequests=[];page.on('requestfailed',r=>report.failedRequests.push({url:requestLocation(r.url()),error:r.failure()?.errorText}));
const pass=name=>{checks.push(name);console.log('PASS',name)},button=name=>page.getByRole('button',{name}),state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('physim.mobile.v1')||'null'));
const tabRoutes={'Trang chủ':'/','Quét đề':'/scan','Thư viện':'/library','Ôn tập':'/review','Cài đặt':'/settings'};
const tab=async name=>{const item=page.getByRole('tab',{name,exact:true}),target=new URL(tabRoutes[name],webUrl).href;if(page.url()===target)return;await item.click();await page.waitForURL(target);};
async function settings(url){await tab('Cài đặt');await page.getByLabel('Địa chỉ server',{exact:true}).fill(url);await button(/Lưu và kiểm tra kết nối/).click();}
async function layout(route,width){
 await page.evaluate(()=>{for(const el of document.querySelectorAll('*'))if(el.scrollTop)el.scrollTop=0;return document.fonts.ready});
 const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,height:window.innerHeight}));
 if(dimensions.scroll>dimensions.width+1)findings.push({route,width,kind:'horizontal-overflow',...dimensions});
 const navigation=page.getByRole('tablist');
 if(await navigation.count()){
  const bounds=await navigation.boundingBox();
  if(!bounds||bounds.x< -1||bounds.x+bounds.width>dimensions.width+1||bounds.y< -1||bounds.y+bounds.height>dimensions.height+1)findings.push({route,width,kind:'clipped-navigation',bounds});
 }
 await page.screenshot({path:artifact(`physim-${route}-${width}.png`)});
 const lastAction=page.getByRole('button').last();
 if(await lastAction.count()){
  await lastAction.scrollIntoViewIfNeeded();
  const reachable=await lastAction.evaluate(element=>{const bounds=element.getBoundingClientRect(),hit=document.elementFromPoint(bounds.x+bounds.width/2,bounds.y+bounds.height/2);return Boolean(hit&&(element===hit||element.contains(hit)));});
  if(!reachable)findings.push({route,width,kind:'last-action-covered',label:await lastAction.innerText()});
 }
}
try{
 const health=await fetch(`${apiUrl}/api/v1/health`,{signal:AbortSignal.timeout(10000)}).then(r=>r.json());assert.equal(health.ok,true);report.liveAiConfigured=health.ai.configured;
 await page.goto(webUrl,{waitUntil:'networkidle'});await page.getByRole('tab',{name:'Trang chủ',exact:true}).waitFor();assert.equal(await page.getByRole('tab').count(),5);await tab('Quét đề');await button('Mở bài Dòng điện thay đổi thế nào?').waitFor();assert.equal(await page.getByRole('button',{name:/^Mở bài /}).count(),6);pass('six Vietnamese sample lessons without OpenAI');
 await settings(apiUrl);await page.getByText(/Đã kết nối\./).waitFor();assert.equal((await state()).settings.serverUrl,apiUrl);pass('health check and persistent server settings');
 await settings('javascript:alert(1)');await page.getByText('Nhập địa chỉ server bắt đầu bằng http:// hoặc https://.').waitFor();assert.equal((await state()).settings.serverUrl,apiUrl);pass('unsafe server URL rejected');
 await settings(apiUrl);await page.getByText(/Đã kết nối\./).waitFor();
 await page.getByLabel('Giảm chuyển động',{exact:true}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('physim.mobile.v1')).settings.reduceMotion===true);await page.reload({waitUntil:'networkidle'});assert.equal((await state()).settings.reduceMotion,true);pass('reduced motion preference persists across reload');
 await page.route('**/api/v1/simulations',r=>r.abort());await tab('Thư viện');await button('Thử lại').waitFor();await page.unroute('**/api/v1/simulations');await button('Thử lại').click();await page.getByText('74 mô phỏng phù hợp').waitFor();pass('catalog network error and retry');
 await page.getByLabel('Tìm mô phỏng',{exact:true}).fill('ohms-law');await page.getByText('1 mô phỏng phù hợp').waitFor();assert.equal(await page.getByRole('button',{name:/^Mở mô phỏng /}).count(),1);await button('Xóa tìm kiếm').click();await page.getByText('74 mô phỏng phù hợp').waitFor();pass('74 catalog entries and search');
 for(const[width,height]of(report.layoutSkipped?[]:[[320,640],[390,844],[768,1024]])){await page.setViewportSize({width,height});for(const[name,file]of[['Trang chủ','home'],['Quét đề','scan'],['Thư viện','library'],['Ôn tập','review'],['Cài đặt','settings']]){await tab(name);await layout(file,width);}}if(!report.layoutSkipped)pass('five primary screens inspected at 320,390,768');
 await page.setViewportSize({width:390,height:844});await tab('Quét đề');await button('Mở bài Dòng điện thay đổi thế nào?').focus();await page.keyboard.press('Enter');await page.waitForURL(/\/lab\//);
 const sessionId=page.url().split('/lab/')[1];await page.getByText('Đã mở đúng cấu hình của phiên học.').waitFor({timeout:70000});assert.ok((await state()).sessions[sessionId]);pass('keyboard opens Ohm and applies live PhET config');
 await page.getByRole('radio').nth(1).click();await button(/Chạy và đối chiếu/).click();await page.getByText(/I = 4,5\/500 = 0,009 A = 9 mA/).waitFor();
 const measured=(await state()).sessions[sessionId].measurements.at(-1);assert.equal(measured.values.voltage,4.5);assert.equal(measured.values.resistance,500);pass('step01 prediction and real simulation measurement');
 await button(/Tiếp tục lý giải/).click();await button(/Mở gợi ý 1/).click();await page.getByText('Ghi riêng U = 4,5 V và R = 500 Ω. Đại lượng cần tìm là I.').waitFor();await page.reload({waitUntil:'networkidle'});await page.getByText('Đã mở đúng cấu hình của phiên học.').waitFor({timeout:70000});assert.equal((await state()).sessions[sessionId].step,1);assert.equal((await state()).sessions[sessionId].hintCount,1);pass('step02 hints and session survive reload');
 await button(/Thử giải thích lại/).click();const expected=['resistance','voltage','ratio','current'];
 for(let index=0;index<expected.length;index++){let current=(await state()).sessions[sessionId].causalOrder.indexOf(expected[index]);while(current>index){await button(`Đưa mắt xích ${current+1} lên`).click();current--;}}
 await page.getByLabel('Câu giải thích của bạn',{exact:true}).fill('Giữ R không đổi, U tăng gấp đôi nên I = U/R tăng gấp đôi.');await button(/Đối chiếu bài mẫu/).click();await page.getByText(/Chuỗi nhân quả khớp thứ tự tham khảo/).waitFor();assert.equal((await state()).sessions[sessionId].teachFeedback.correct,true);pass('step03 reorder and authored teach-back feedback');
 await button(/Thử một điều kiện mới/).click();await page.getByRole('radio').nth(2).click();await button(/Kiểm chứng biến thể/).click();await page.getByText(/I = 9\/500 = 0,018 A = 18 mA/).waitFor();await button(/Lưu thẻ ôn tập$/).click();await page.getByText('Đã lưu thẻ và cấu hình mô phỏng trên thiết bị.').waitFor();
 const card=(await state()).cards[0];assert.equal(card.config.values.voltage,9);assert.equal(card.config.values.resistance,500);assert.ok(card.version);assert.equal(card.config.version,card.version);pass('step04 actual variant and version-pinned card');
 for(const[width,height]of(report.layoutSkipped?[]:[[320,640],[390,844],[768,1024]])){await page.setViewportSize({width,height});await layout('lab',width);}
 await button(/Xem lịch ôn tập/).click();await button(/^Hiện câu trả lời$/).click();await button(/^Chấm mức nhớ 5$/).click();const rated=(await state()).cards[0];assert.equal(rated.repetitions,1);assert.equal(rated.intervalDays,1);assert.ok(Date.parse(rated.dueAt)>Date.now());
 await page.reload({waitUntil:'networkidle'});await button(/Mở lại cấu hình mô phỏng/).click();await page.getByText('Đã mở đúng cấu hình của phiên học.').waitFor({timeout:70000});
 const reopened=(await state()).sessions[page.url().split('/lab/')[1]];assert.equal(reopened.version,card.version);assert.deepEqual(reopened.config,card.config);
 const frame=page.frames().find(f=>f!==page.mainFrame()&&f.url().includes('/simulations/'));assert.ok(frame);const live=await frame.evaluate(()=>{const m=window.phet.joist.sim.screens[0].model;return{voltage:m.voltageProperty.value,resistance:m.resistanceProperty.value};});assert.equal(live.voltage,9);assert.equal(live.resistance,500);pass('SM2 rating persists and review reopens exact live config');
 const oldFrameUrl=await page.locator('iframe').getAttribute('src');await frame.evaluate(()=>{setTimeout(()=>location.reload(),0);});await page.waitForFunction(old=>document.querySelector('iframe')?.getAttribute('src')!==old,oldFrameUrl);await page.locator('iframe').contentFrame().locator('body').waitFor({state:'attached'});const iframeElement=await page.locator('iframe').elementHandle();const reloadedFrame=await iframeElement.contentFrame();assert.ok(reloadedFrame);await reloadedFrame.waitForFunction(()=>{const m=window.phet?.joist?.sim?.screens?.[0]?.model;return m?.voltageProperty?.value===9&&m?.resistanceProperty?.value===500;},undefined,{timeout:70000});pass('iframe document reload rotates loadId and reapplies saved config');
 await page.goto(`${webUrl}/lab/${sessionId}`,{waitUntil:'networkidle'});await page.getByText('Đã mở đúng cấu hình của phiên học.').waitFor({timeout:70000});await button(/Lưu thẻ ôn tập$/).click();await page.getByText('Đã lưu thẻ và cấu hình mô phỏng trên thiết bị.').waitFor();const resaved=(await state()).cards.find(c=>c.id===card.id);for(const field of ['repetitions','intervalDays','easeFactor','dueAt','lastReviewedAt','createdAt'])assert.equal(resaved[field],rated[field]);pass('resaving original lesson preserves existing SM2 schedule');
 assert.deepEqual(report.unexpectedLearningRequests,[]);assert.deepEqual(pageErrors,[]);assert.deepEqual(findings,[]);pass(report.layoutSkipped?'no uncaught browser exceptions (layout skipped)':'no uncaught browser exceptions or horizontal overflow');
}catch(error){report.frames=[];for(const f of page.frames()){try{report.frames.push({url:f.url(),details:await f.evaluate(()=>({ready:document.readyState,bridge:!!window.physimBridge,phet:!!window.phet,sim:!!window.phet?.joist?.sim,model:!!window.phet?.joist?.sim?.screens?.[0]?.model,body:document.body?.innerText.slice(0,150)}))});}catch{}}report.error=error.message;console.error(error);await page.screenshot({path:artifact('physim-ui-failure.png')}).catch(()=>{});process.exitCode=1;}
finally{report.completedAt=new Date().toISOString();await fs.writeFile(artifact('physim-ui-report.json'),JSON.stringify(report,null,2)+'\n');await context.close();await browser.close();}
