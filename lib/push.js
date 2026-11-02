'use strict';
const {hash}=require('./auth');
function validSubscription(s){
 try{const u=new URL(s.endpoint);if(u.protocol!=='https:'||u.username||u.password||u.port||s.endpoint.length>2048)return false;
 const hosts=['fcm.googleapis.com','updates.push.services.mozilla.com'];
 if(!hosts.includes(u.hostname)&&!u.hostname.endsWith('.notify.windows.com'))return false;
 return /^[\w-]+$/.test(s.keys?.p256dh||'')&&/^[\w-]+$/.test(s.keys?.auth||'')&&Buffer.from(s.keys.p256dh,'base64url').length===65&&Buffer.from(s.keys.auth,'base64url').length===16;
 }catch{return false;}
}
function pushConfigured(env=process.env){return !!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT);}
function createPush(db,env=process.env,sender){
 if(!sender && pushConfigured(env))sender=require('web-push');
 if(pushConfigured(env))sender.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
 let busy=false;
 async function send(subscription,payload){return sender.sendNotification(subscription,JSON.stringify(payload),{TTL:3600,urgency:'high',timeout:10000});}
 async function tick(limit=12){
  if(busy||!pushConfigured(env))return;busy=true;
  try{
   const jobs=await db.rpc('sentra_claim_push',{p_limit:Math.max(1,Math.min(12,Number.isInteger(limit)?limit:12))});if(jobs.error)throw jobs.error;
   const items=jobs.data||[];
   for(let i=0;i<items.length;i+=4)await Promise.all(items.slice(i,i+4).map(async j=>{
    const sub=await db.from('sentra_push_subscriptions').select('*').eq('id',j.subscription_id).maybeSingle();
    if(sub.error)throw sub.error;if(!sub.data)return;
    const user=await db.from('sentra_dashboard_users').select('disabled').eq('id',sub.data.user_id).maybeSingle();
    const alert=await db.from('cctv_alerts').select('device_id,event_id').eq('id',j.alert_id).maybeSingle();
    if(user.error||alert.error)throw new Error('Permission check unavailable');
    let device=alert.data?.device_id, owner=null;
    if(alert.data?.event_id){
     const e=await db.from('cctv_events').select('device_id,video_source_id').eq('id',alert.data.event_id).maybeSingle();if(e.error)throw e.error;
     if(e.data?.video_source_id){const source=await db.from('video_sources').select('device_id,owner_user_id').eq('id',e.data.video_source_id).maybeSingle();if(source.error)throw source.error;owner=source.data?.owner_user_id;device=source.data?.device_id;}
    }
    const membership=device?await db.from('sentra_user_devices').select('device_id').eq('user_id',sub.data.user_id).eq('device_id',device).maybeSingle():{data:null};
    if(membership.error)throw membership.error;
    if(!user.data||user.data.disabled||!membership.data||owner!==sub.data.user_id){await db.from('sentra_push_jobs').update({status:'failed',lease_until:null}).eq('id',j.id);return;}
    try{
     await send(sub.data.subscription,j.payload);
     const r=await db.from('sentra_push_jobs').update({status:'done',lease_until:null}).eq('id',j.id);if(r.error)throw r.error;
     await db.from('sentra_push_subscriptions').update({last_error:null}).eq('id',sub.data.id);
    }catch(e){
     if([404,410].includes(e.statusCode))await db.from('sentra_push_subscriptions').delete().eq('id',sub.data.id);
     else{await db.from('sentra_push_jobs').update({status:j.attempts>=8?'failed':'pending',lease_until:null,next_attempt_at:new Date(Date.now()+Math.min(300,2**j.attempts)*1000).toISOString()}).eq('id',j.id);await db.from('sentra_push_subscriptions').update({last_error:'Delivery failed; retry queued'}).eq('id',sub.data.id);}
    }
   }));
  }finally{busy=false;}
 }
 function routes(app,requireUser){
  app.get('/api/push/config',requireUser,(req,res)=>res.json({ok:true,configured:pushConfigured(env),publicKey:env.VAPID_PUBLIC_KEY||null}));
  app.post('/api/push/subscribe',requireUser,async(req,res,next)=>{try{
   if(!pushConfigured(env))return res.status(503).json({ok:false,error:'Background push is not configured yet. Desktop foreground notifications can still be tested.'});
   const s=req.body.subscription;if(!validSubscription(s))return res.status(400).json({ok:false,error:'Unsupported or invalid push subscription'});
   const h=hash(s.endpoint);
   const existing=await db.from('sentra_push_subscriptions').select('user_id').eq('endpoint_hash',h).maybeSingle();if(existing.error)throw existing.error;
   if(existing.data&&existing.data.user_id!==req.user.id)return res.status(409).json({ok:false,error:'This browser subscription belongs to another account. Disable it in this browser and enable again.'});
   const count=await db.from('sentra_push_subscriptions').select('id').eq('user_id',req.user.id);if(count.error)throw count.error;
   if(!existing.data&&count.data.length>=10)return res.status(400).json({ok:false,error:'Device limit reached. Contact your company.'});
   const payload={user_id:req.user.id,endpoint_hash:h,subscription:{endpoint:s.endpoint,keys:s.keys},last_error:null};
   const r=existing.data?await db.from('sentra_push_subscriptions').update(payload).eq('endpoint_hash',h).eq('user_id',req.user.id):await db.from('sentra_push_subscriptions').insert(payload);if(r.error)throw r.error;
   res.json({ok:true,endpointHash:h});
  }catch(e){next(e);}});
  app.post('/api/push/unsubscribe',requireUser,async(req,res,next)=>{try{const r=await db.from('sentra_push_subscriptions').delete().eq('user_id',req.user.id).eq('endpoint_hash',hash(req.body.endpoint||''));if(r.error)throw r.error;res.json({ok:true});}catch(e){next(e);}});
  app.post('/api/push/test',requireUser,async(req,res,next)=>{try{
   if(!pushConfigured(env))return res.status(503).json({ok:false,error:'Set VAPID keys and subject on the dashboard server first.'});
   const limited=await db.rpc('sentra_take_limit',{p_key:'push-test:'+req.user.id,p_max:5,p_seconds:600});if(limited.error)throw limited.error;if(!limited.data)return res.status(429).json({ok:false,error:'Test limit reached. Try again later.'});
   const sub=await db.from('sentra_push_subscriptions').select('subscription').eq('user_id',req.user.id).eq('endpoint_hash',hash(req.body.endpoint||'')).maybeSingle();if(sub.error)throw sub.error;
   if(!sub.data)return res.status(400).json({ok:false,error:'Enable background notifications first'});
   await send(sub.data.subscription,{id:'test-'+Date.now(),title:'SENTRA notification test',body:'Your browser can receive security alerts.',url:'/app#settings'});
   res.json({ok:true});
  }catch(e){next(e);}});
 }
 return {tick,routes,send};
}
module.exports={createPush,validSubscription,pushConfigured};
