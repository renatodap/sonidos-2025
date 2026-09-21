import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='https://renatodap.me/sonidos-2025/';
const b=await chromium.launch();
const c=await b.newContext({viewport:{width:390,height:844}});
const p=await c.newPage();
try {
 await p.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
 await p.waitForFunction(()=>window.SONIDOS_CATALOG?.songs);
 const old=await p.evaluate(()=>window.SONIDOS_CATALOG.songs.find(s=>s.label==='creep').audio);
 await p.getByRole('button',{name:'Audio',exact:true}).click();
 await p.getByRole('button',{name:'Save offline Creep',exact:true}).click();
 await p.getByRole('button',{name:'Remove offline copy of Creep',exact:true}).waitFor({timeout:90000});
 console.log('SAVED pre-cover Creep',old);
 let changed=false;
 for(let n=0;n<90;n++){
  const response=await p.request.get(new URL('catalog.js',base).href);
  if(response.ok()){
   const body=await response.text();
   const prefix='window.SONIDOS_CATALOG = ';
   if(body.startsWith(prefix)){
    const d=JSON.parse(body.slice(prefix.length).trim().replace(/;$/,''));
    const song=d.songs.find(s=>s.label==='creep');
    if(song.audio!==old){assert.ok(song.audioAliases.includes(old));changed=true;break;}
   }
  }
  await new Promise(r=>setTimeout(r,10000));
 }
 assert.ok(changed,'Final cover catalog did not appear within15minutes');
 await p.reload({waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.SONIDOS_CATALOG?.songs);
 const current=await p.evaluate(()=>window.SONIDOS_CATALOG.songs.find(s=>s.label==='creep').audio);
 await p.getByRole('button',{name:'Audio',exact:true}).click();
 await p.getByRole('button',{name:'Remove offline copy of Creep',exact:true}).waitFor();
 await p.evaluate(()=>navigator.serviceWorker.ready);
 await c.setOffline(true);await p.reload({waitUntil:'domcontentloaded'});
 await p.getByRole('button',{name:'Audio',exact:true}).click();
 await p.getByRole('button',{name:'Saved offline',exact:true}).click();
 await p.getByRole('button',{name:'Play Creep',exact:true}).click();
 await p.waitForFunction(()=>document.querySelector('#audio').currentTime>1,{},{timeout:30000});
 const playback=await p.locator('#audio').evaluate(a=>({time:a.currentTime,duration:a.duration,src:a.currentSrc,error:a.error?.message||null}));
 assert.match(playback.src,/^blob:/);assert.equal(playback.error,null);
 const report={passed:true,checkedAt:new Date().toISOString(),oldAudio:old,newAudio:current,offlinePlayback:playback,physicalIPhoneTested:false};
 await fs.writeFile(new URL('../../../video-work/release/cover-migration-playback.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log('PASS real saved Creep retained across cover publication and offline reload');
}finally{await c.close();await b.close()}
