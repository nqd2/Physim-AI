import { launchBrowser, webUrl, apiUrl, artifact, blockLearningRequests } from './browser-support.mjs';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { deflateSync } from 'node:zlib';

const reportPath=artifact('physim-photo-errors-report.json');
const report={startedAt:new Date().toISOString(),webUrl,apiUrl,checks:[],skipped:[],requests:[],pageErrors:[],notes:[
  'Uses one isolated browser context and one page at width 390. File upload uses a generated valid 2x2 PNG fixture.',
  'Unreadable and no_simulation replies are Playwright route mocks, not live OpenAI results. The network error is a route abort.',
  'Every learning request is fulfilled with an explicit test response or aborted. No image request is forwarded to the server or OpenAI.'
]};
let browser,context,page,mode='blocked',scenario='setup',routeError=null;
const pass=(name,evidence)=>{report.checks.push({name,evidence});console.log('PASS',name);};
const button=name=>page.getByRole('button',{name});
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('physim.mobile.v1')||'null'));
const sessionCount=async()=>Object.keys((await state())?.sessions||{}).length;
const unreadable={status:'unreadable',message:'Ảnh mờ trong kiểm thử giả lập. Hãy chụp lại toàn bộ đề trong điều kiện đủ sáng.',transcription:'',facts:[],misconceptions:[],hints:[],simulationConfig:null};
const noSimulation={status:'no_simulation',message:'Đề đọc được nhưng chưa có mô phỏng phù hợp.',transcription:'Một vật trượt trên mặt phẳng nghiêng. Hãy xác định các lực tác dụng lên vật.',facts:[{label:'Khối lượng',value:'2',unit:'kg'}],misconceptions:['Không nhầm trọng lực với lực ép lên mặt phẳng.'],hints:['Vẽ trọng lực, phản lực và ma sát trước khi chọn trục.','Chiếu các lực lên phương song song với mặt phẳng.'],simulationConfig:null};

function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,checksum]);}
function pngFixture(){const header=Buffer.alloc(13);header.writeUInt32BE(2,0);header.writeUInt32BE(2,4);header[8]=8;header[9]=6;const row=Buffer.from([0,30,50,80,255,220,180,100,255]);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.concat([row,row]))),chunk('IEND',Buffer.alloc(0))]);}
const fixture=pngFixture();

async function health(){const response=await fetch(`${apiUrl}/api/v1/health`,{signal:AbortSignal.timeout(10000)});assert.equal(response.ok,true,'Real health endpoint must be available');const data=await response.json();assert.equal(data.ok,true);assert.equal(typeof data.ai?.configured,'boolean');return data;}
async function assertNoPhotoPersisted(){const raw=await page.evaluate(()=>localStorage.getItem('physim.mobile.v1')||'');assert.equal(raw.includes(fixture.toString('base64')),false,'PNG bytes must not persist in localStorage');assert.equal(/"(?:base64|mimeType|image|photo)"\s*:/.test(raw),false,'Device state must not contain uploaded image fields');}
async function selectPhoto(){
  if(await button(/^Bỏ ảnh$/).count())await button(/^Bỏ ảnh$/).click();
  const chooser=page.waitForEvent('filechooser');
  await button(/Chọn ảnh từ thiết bị/).click();
  await (await chooser).setFiles({name:'physim-qa-tiny.png',mimeType:'image/png',buffer:fixture});
  await page.getByLabel('Ảnh đề bài đã chọn',{exact:true}).waitFor();
  await button(/Phân tích đề/).waitFor();
  await assertNoPhotoPersisted();
}
async function analyzeWithReply(nextMode){mode=nextMode;await button(/Phân tích đề/).click();}
async function assertStillScan(expectedCount){assert.equal(new URL(page.url()).pathname,new URL('/scan',webUrl).pathname);assert.equal(await sessionCount(),expectedCount);await button(/Phân tích đề/).waitFor();await assertNoPhotoPersisted();if(routeError)throw routeError;}

try{
  const initialHealth=await health();report.liveAiConfigured=initialHealth.ai.configured;
  browser=await launchBrowser();
  context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await blockLearningRequests(context,report);
  page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>report.pageErrors.push(error.message));
  page.on('request',request=>{if(request.url().includes('/ensure-ready')&&scenario==='no-simulation')routeError=new Error('Text-only analysis unexpectedly requested a simulation.');});
  await page.route('**/api/v1/learning/**',async route=>{
    try{
      const request=route.request();assert.equal(new URL(request.url()).pathname.endsWith('/learning/analyze-photo'),true,'Only analyze-photo is expected');assert.equal(request.method(),'POST');
      const body=request.postDataJSON();assert.match(body.sessionId,/^[a-zA-Z0-9_-]+$/);assert.equal(body.image.mimeType,'image/png');assert.deepEqual(Buffer.from(body.image.base64,'base64'),fixture);
      report.requests.push({scenario,mode,endpoint:'analyze-photo',imageMimeType:body.image.mimeType,imageBytes:fixture.length});
      if(mode==='unreadable'||mode==='no-simulation'){
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(mode==='unreadable'?unreadable:noSimulation)});return;
      }
      if(mode==='abort'){await route.abort('failed');return;}
      throw new Error(`Unexpected learning request while mode=${mode}`);
    }catch(error){routeError=error;await route.abort('blockedbyclient').catch(()=>{});}
  });
  await page.goto(webUrl,{waitUntil:'networkidle'});
  await page.getByRole('tab',{name:'Quét đề',exact:true}).click();
  await button(/Chọn ảnh từ thiết bị/).waitFor();
  await page.getByRole('tab',{name:'Cài đặt',exact:true}).click();
  await page.getByLabel('Địa chỉ server',{exact:true}).fill(apiUrl);
  await button(/Lưu và kiểm tra kết nối/).click();
  await page.getByText(/Đã kết nối\./).waitFor();
  await page.getByRole('tab',{name:'Quét đề',exact:true}).click();
  assert.equal(await sessionCount(),0,'Fresh context must not reuse main UI test sessions');
  scenario='upload';await selectPhoto();pass('PNG selected through the real browser file chooser and previewed',{kind:'real UI',pngBytes:fixture.length,photoPersisted:false});

  report.skipped.push({name:'Real missing-key request',reason:'This browser suite never forwards learning requests. Backend tests cover the missing-key response.'});

  scenario='unreadable';await selectPhoto();await analyzeWithReply('unreadable');
  await page.getByText(unreadable.message,{exact:true}).waitFor();await assertStillScan(0);
  pass('Unreadable reply asks for a retake and does not save a learning session',{kind:'mocked analyze-photo response',status:'unreadable'});
  await page.screenshot({path:artifact('physim-photo-unreadable.png')});

  scenario='network-abort';await selectPhoto();await analyzeWithReply('abort');
  await page.getByText('Không kết nối được máy chủ. Kiểm tra địa chỉ server trong Cài đặt và kết nối mạng.',{exact:true}).waitFor();await assertStillScan(0);
  pass('Aborted analysis request shows retry guidance and keeps the selected photo',{kind:'Playwright network abort',sessionCreated:false});

  scenario='no-simulation';await selectPhoto();await analyzeWithReply('no-simulation');
  await page.waitForURL(/\/lab\/photo-/);
  await page.getByText('Đề bài chưa có mô phỏng phù hợp. Bạn vẫn có thể học theo hướng dẫn bằng văn bản bên dưới.',{exact:true}).waitFor();
  await page.getByText(noSimulation.transcription,{exact:true}).waitFor();
  assert.equal(await page.locator('iframe').count(),0);assert.equal(await sessionCount(),1);
  const sessionId=decodeURIComponent(new URL(page.url()).pathname.split('/lab/')[1]);
  await page.waitForFunction(id=>Boolean(JSON.parse(localStorage.getItem('physim.mobile.v1')||'{}').sessions?.[id]),sessionId);
  const saved=(await state()).sessions[sessionId];assert.equal(saved.slug,'');assert.equal(saved.config,undefined);assert.equal(saved.analysis.status,'no_simulation');
  await button(/Tiếp tục lý giải/).click();await button(/Mở gợi ý 1/).click();await page.getByText(noSimulation.hints[0],{exact:true}).waitFor();
  await page.reload({waitUntil:'networkidle'});await page.getByText(noSimulation.hints[0],{exact:true}).waitFor();
  assert.equal((await state()).sessions[sessionId].hintCount,1);assert.equal(await page.locator('iframe').count(),0);await assertNoPhotoPersisted();
  pass('No-match reply opens a persisted text-only lesson with usable progressive hints',{kind:'mocked analyze-photo response',status:'no_simulation',savedSessions:1,photoPersisted:false});
  await page.screenshot({path:artifact('physim-photo-text-only.png')});
  if(routeError)throw routeError;assert.deepEqual(report.unexpectedLearningRequests,[]);assert.deepEqual(report.pageErrors,[]);pass('No uncaught page exceptions',{kind:'browser runtime'});
}catch(error){report.error=error.stack||error.message;console.error(error);process.exitCode=1;if(page)await page.screenshot({path:artifact('physim-photo-errors-failure.png')}).catch(()=>{});}
finally{report.completedAt=new Date().toISOString();await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');if(context)await context.close();if(browser)await browser.close();}
