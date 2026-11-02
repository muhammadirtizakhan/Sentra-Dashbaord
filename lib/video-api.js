'use strict';
const fs = require('node:fs');
const {Readable} = require('node:stream');
const {pipeline} = require('node:stream/promises');
const {gunzipSync} = require('node:zlib');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createDriveClient(env=process.env, fetcher=fetch) {
  let cached, pending;
  async function accessToken() {
    if (cached && cached.until>Date.now()+60000) return cached.token;
    if (pending) return pending;
    pending=(async()=>{
      const hasEnv=env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET && env.GOOGLE_DRIVE_REFRESH_TOKEN;
      const c=!hasEnv && env.GOOGLE_DRIVE_TOKEN_FILE ? JSON.parse(fs.readFileSync(env.GOOGLE_DRIVE_TOKEN_FILE,'utf8')) : {};
      const client_id=env.GOOGLE_DRIVE_CLIENT_ID || c.client_id;
      const client_secret=env.GOOGLE_DRIVE_CLIENT_SECRET || c.client_secret;
      const refresh_token=env.GOOGLE_DRIVE_REFRESH_TOKEN || c.refresh_token;
      if(!client_id || !client_secret || !refresh_token) throw new Error('DRIVE_NOT_CONFIGURED');
      const r=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id,client_secret,refresh_token,grant_type:'refresh_token'}),signal:AbortSignal.timeout(20000)});
      if(!r.ok) throw new Error('DRIVE_REAUTHORIZE');
      const d=await r.json(); if(!d.access_token) throw new Error('DRIVE_REAUTHORIZE');
      cached={token:d.access_token,until:Date.now()+Number(d.expires_in||3600)*1000}; return cached.token;
    })();
    try{return await pending;}finally{pending=null;}
  }
  return {async media(id, range, signal) {
    if(!/^[\w-]+$/.test(id||'')) throw new Error('INVALID_MEDIA_ID');
    const headers={Authorization:'Bearer '+await accessToken()}; if(range) headers.Range=range;
    return fetcher('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{headers,signal});
  }};
}

async function limitedBody(r, limit) {
 const chunks=[];let n=0;
 for await(const chunk of r.body){n+=chunk.length;if(n>limit){throw new Error('DETECTIONS_TOO_LARGE');}chunks.push(Buffer.from(chunk));}
 return Buffer.concat(chunks);
}
function parseFrames(buffer){
 const raw=gunzipSync(buffer,{maxOutputLength:100*1024*1024}).toString('utf8');
 const rows=raw.split('\n').filter(Boolean).map(s=>JSON.parse(s));
 if(rows.some(r=>!Number.isFinite(r.t)||!(r.w>0)||!(r.h>0)||!Array.isArray(r.boxes)))throw new Error('INVALID_DETECTIONS');
 return rows.sort((a,b)=>a.t-b.t);
}
function attachVideoRoutes(app,db,{drive=createDriveClient(),device=process.env.SENTRA_DEVICE_ID,authorizeSource}={}){
 const cache=new Map(); const inflight=new Map();
 async function record(id,req){
  if(!UUID.test(id))return null;
  if(authorizeSource&&!await authorizeSource(req,id))return null;
  let q=db.from('video_sources').select('id,camera_name,duration_sec,recording_start,time_basis').eq('id',id);
  if(device&&!authorizeSource) q=q.eq('device_id',device);
  const s=await q.maybeSingle();if(s.error)throw s.error;if(!s.data)return null;
  const m=await db.from('sentra_video_media').select('status,detections_status,video_file_id,detections_file_id,error_code').eq('source_id',id).maybeSingle();
  if(m.error)throw m.error;
  return {source:s.data,media:m.data};
 }
 async function handler(req,res,next){
  if(!db)return res.status(503).json({ok:false,error:'Database not configured'});
  try{req.mediaRecord=await record(req.params.id,req);if(!req.mediaRecord)return res.status(404).json({ok:false,error:'Video source not found'});next();}catch{res.status(503).json({ok:false,error:'Video metadata unavailable. Check migration and server credentials.'});}
 }
 app.get('/api/videos/:id',handler,(req,res)=>{
   const {source,media}=req.mediaRecord;
   res.set('Cache-Control','no-store').json({ok:true,sourceId:source.id,name:source.camera_name,duration:Number(source.duration_sec),recordingStart:source.recording_start,timeBasis:source.time_basis,status:media?.status||'not_uploaded',detectionsStatus:media?.detections_status||'not_available',errorCode:media?.error_code||null,streamUrl:media?.status==='ready'&&media.video_file_id?`/api/videos/${source.id}/stream`:null,detectionsUrl:media?.detections_status==='ready'&&media.detections_file_id?`/api/videos/${source.id}/detections`:null});
 });
 app.get('/api/videos/:id/stream',handler,async(req,res)=>{
   const m=req.mediaRecord.media;
   if(m?.status!=='ready'||!m.video_file_id)return res.status(409).json({ok:false,error:'Video is not ready'});
   const range=req.headers.range;
   if(range&&!/^bytes=(?:\d+-\d*|-\d+)$/.test(range))return res.sendStatus(416);
   const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),30000);
   res.on('close',()=>controller.abort());
   try{
    const r=await drive.media(m.video_file_id,range,controller.signal);clearTimeout(timer);
    if(r.status===416){const cr=r.headers.get('content-range');if(cr)res.set('Content-Range',cr);return res.sendStatus(416);}
    if(![200,206].includes(r.status)){await r.body?.cancel();return res.status(502).json({ok:false,error:'Drive media unavailable'});}
    res.status(r.status).set({'Content-Type':'video/mp4','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});
    for(const name of ['content-length','content-range']){const v=r.headers.get(name);if(v)res.set(name,v);}
    await pipeline(Readable.fromWeb(r.body),res);
   }catch{if(!res.headersSent&&!res.destroyed)res.status(502).json({ok:false,error:'Video stream unavailable. Check Drive authorization.'});else res.destroy();}
   finally{clearTimeout(timer);}
 });
 app.get('/api/videos/:id/detections',handler,async(req,res)=>{
   const m=req.mediaRecord.media;
   if(m?.detections_status!=='ready'||!m.detections_file_id)return res.status(409).json({ok:false,error:'Detection data is not ready'});
   const from=Number(req.query.from||0),to=Number(req.query.to||from+15);
   if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<from||to-from>30)return res.status(400).json({ok:false,error:'Request a window of up to 30 seconds'});
   try{
    const id=m.detections_file_id;
    let entry=cache.get(id);
    if(!entry||entry.until<Date.now()){
     if(!inflight.has(id))inflight.set(id,(async()=>{
       const r=await drive.media(id,null,AbortSignal.timeout(30000));if(!r.ok)throw new Error('DRIVE_UNAVAILABLE');
       const rows=parseFrames(await limitedBody(r,25*1024*1024));
       const value={rows,until:Date.now()+30000};cache.set(id,value);
       while(cache.size>2)cache.delete(cache.keys().next().value);
       return value;
     })());
     try{entry=await inflight.get(id);}finally{inflight.delete(id);}
    }
    res.set('Cache-Control','private, no-store').json({ok:true,maxGap:0.5,frames:entry.rows.filter(r=>r.t>=Math.max(0,from-0.5)&&r.t<=to)});
   }catch{res.status(502).json({ok:false,error:'Detection playback data unavailable'});}
 });
}
module.exports={attachVideoRoutes,createDriveClient,parseFrames,limitedBody};
