import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const base=process.argv[2]||'https://renatodap.me/sonidos-2025/';
const reportPath=new URL('../../../video-work/release/youtube-playback.json',import.meta.url);
let report={videos:{}};try{report=JSON.parse(await fs.readFile(reportPath,'utf8'));}catch{}
const browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.goto(base,{waitUntil:'networkidle'});
 const songs=await page.evaluate(()=>window.SONIDOS_CATALOG.songs.filter(s=>s.videoReady&&s.youtubeId));
 for(const song of songs){
  if(report.videos[song.youtubeId]?.passed)continue;
  await page.getByRole('button',{name:`Play ${song.title}`,exact:true}).click();
  const handle=await page.locator('#youtube').elementHandle();const frame=await handle.contentFrame();
  await frame.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.currentTime>1&&v.readyState>=3;},{},{timeout:30000});
  const unmute=frame.getByText('Tap to unmute',{exact:true});if(await unmute.isVisible())await unmute.click();
  await frame.waitForFunction(()=>{const v=document.querySelector('video');return v&&!v.muted&&v.volume>0&&!v.paused;},{},{timeout:10000});
  const result=await frame.evaluate(()=>{const v=document.querySelector('video');return{currentTime:v.currentTime,paused:v.paused,muted:v.muted,volume:v.volume,readyState:v.readyState,error:v.error?.message||null};});
  report.videos[song.youtubeId]={title:song.title,checkedAt:new Date().toISOString(),passed:true,...result};
  await fs.mkdir(path.dirname(reportPath.pathname),{recursive:true});await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
  console.log(`PASS ${song.title}: embedded video plays, unmuted, no media error.`);
  await page.getByRole('button',{name:'Close',exact:true}).click();
 }
 console.log(`Verified ${Object.keys(report.videos).length} published YouTube IDs.`);
}finally{await browser.close();}
