'use strict';
const {UUID,one,pages}=require('./data');
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
function dataRoutes(app,db,{sourceFor,eventFor,alertFor,sourceQuery,alertQuery,buildBootstrap}){
 app.get('/api/bootstrap',wrap(async(req,res)=>res.json({...await buildBootstrap(req),selectedSource:req.query.source||null})));
 app.get('/api/history',wrap(async(req,res)=>{
 if(!req.devices.length)return res.json({ok:true,sources:[]});
 const sources=await pages(()=>sourceQuery(req,'id,camera_name,device_id,source_type,status,duration_sec,created_at,recording_start,time_basis').order('created_at',{ascending:false}).order('id'));
 const media={};for(let i=0;i<sources.length;i+=150){const rows=await one(db.from('sentra_video_media').select('source_id,status,detections_status').in('source_id',sources.slice(i,i+150).map(s=>s.id)));for(const r of rows)media[r.source_id]={status:r.status,detections_status:r.detections_status};}
 res.json({ok:true,sources:sources.map(s=>({...s,media:media[s.id]||null}))});
 }));
 app.get('/api/events/:id',wrap(async(req,res)=>{const e=await eventFor(req,req.params.id);if(!e)return res.status(404).json({ok:false,error:'Event not found'});const steps=await pages(()=>db.from('event_timeline').select('*').eq('event_id',e.id).order('step_order'));res.json({ok:true,event:{...e,snapshot:'/api/snapshot/'+e.id},steps});}));
 app.patch('/api/events/:id',wrap(async(req,res)=>{const e=await eventFor(req,req.params.id);if(!e)return res.sendStatus(404);if(req.body.status!=='Reviewed')return res.status(400).json({ok:false,error:'Only review status can be changed here'});await one(db.from('cctv_events').update({status:'Reviewed'}).eq('id',e.id));res.json({ok:true});}));
 app.get('/api/alerts/feed',wrap(async(req,res)=>{
 if(!req.devices.length)return res.json({ok:true,alerts:[],cursor:null});
 let q=alertQuery(req,'id,event_id,alert_title,alert_level,alert_time,is_acknowledged,created_at');
 const cursor=req.query.cursor,last=req.query.last;
 if(cursor){if(!/^\d{4}-\d{2}-\d{2}T[0-9:.+-]+Z?$/.test(cursor)||!Number.isFinite(Date.parse(cursor))||!UUID.test(last||''))return res.status(400).json({ok:false,error:'Invalid cursor'});q=q.or(`created_at.gt.${cursor},and(created_at.eq.${cursor},id.gt.${last})`).order('created_at').order('id');}
 else q=q.order('created_at',{ascending:false}).order('id',{ascending:false});
 const rows=await one(q.limit(100));if(!cursor)rows.reverse();const tail=rows.at(-1);res.json({ok:true,alerts:rows,cursor:tail?{time:tail.created_at,id:tail.id}:null,more:!!cursor&&rows.length===100});
 }));
 app.get('/api/alerts/:id',wrap(async(req,res)=>{if(!UUID.test(req.params.id)||!req.devices.length)return res.sendStatus(404);const a=await alertFor(req,req.params.id);if(!a)return res.sendStatus(404);res.json({ok:true,alert:a});}));
 app.patch('/api/alerts/:id',wrap(async(req,res)=>{if(!UUID.test(req.params.id)||!req.devices.length)return res.sendStatus(404);const a=await alertFor(req,req.params.id);if(!a)return res.sendStatus(404);await one(db.from('cctv_alerts').update({is_acknowledged:!!req.body.acknowledged,acknowledged_at:req.body.acknowledged?new Date().toISOString():null}).eq('id',a.id));res.json({ok:true});}));
 app.get('/api/snapshot/:id',wrap(async(req,res)=>{
 const e=await eventFor(req,req.params.id);if(!e)return res.sendStatus(404);
 const images=[...(Array.isArray(e.evidence_paths)?e.evidence_paths:[]),e.snapshot_object,e.snapshot_path].filter(Boolean),requested=req.query.image;
 if(requested&&!images.includes(requested))return res.sendStatus(404);
 for(const raw of requested?[requested]:images){const bucket=e.snapshot_bucket||process.env.SUPABASE_BUCKET||'evidence';let p=String(raw).replace(/^\/+/, '');if(p.startsWith(bucket+'/'))p=p.slice(bucket.length+1);const r=await db.storage.from(bucket).createSignedUrl(p,300);if(!r.error&&r.data?.signedUrl)return res.redirect(r.data.signedUrl);}res.sendStatus(404);
 }));
}
module.exports={dataRoutes};
