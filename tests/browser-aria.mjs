import { launchBrowser, webUrl, apiUrl, artifact, blockLearningRequests } from './browser-support.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await launchBrowser();
const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),checks=[],report={startedAt:new Date().toISOString(),webUrl,apiUrl,checks};
await blockLearningRequests(page.context(),report);
try{
 await page.goto(webUrl,{waitUntil:'networkidle'});
 await page.getByRole('tablist').waitFor();assert.equal(await page.getByRole('tab').count(),5);assert.equal(await page.getByRole('tab',{name:'Trang chủ',exact:true}).getAttribute('aria-selected'),'true');
 if(apiUrl!==webUrl){await page.getByRole('tab',{name:'Cài đặt',exact:true}).click();await page.getByLabel('Địa chỉ server',{exact:true}).fill(apiUrl);await page.getByRole('button',{name:/Lưu và kiểm tra kết nối/}).click();await page.getByText(/Đã kết nối\./).waitFor();}
 await page.getByRole('tab',{name:'Thư viện',exact:true}).click();await page.getByRole('radiogroup').waitFor();assert.equal(await page.getByRole('tab',{name:'Thư viện',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await page.getByRole('radio',{name:'Tất cả',exact:true}).getAttribute('aria-checked'),'true');checks.push('tablist selection and chapter filter checked state exposed');
 await page.getByRole('tab',{name:'Quét đề',exact:true}).click();await page.getByRole('button',{name:'Mở bài Dòng điện thay đổi thế nào?',exact:true}).click();await page.getByRole('radio').nth(1).click();assert.equal(await page.getByRole('radio').nth(1).getAttribute('aria-checked'),'true');assert.equal(await page.locator('[aria-expanded="true"]').count(),1);checks.push('prediction checked state and active step expanded state exposed');
 assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);checks.push('browser reduced-motion preference active');
 assert.deepEqual(report.unexpectedLearningRequests,[]);
}catch(error){report.error=error.message;process.exitCode=1;}finally{report.completedAt=new Date().toISOString();await writeFile(artifact('physim-aria-report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify(report));}
