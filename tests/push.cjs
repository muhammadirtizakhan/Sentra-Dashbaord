const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');const {mockDB}=require('./mock-db'),{createPush}=require('../lib/push');
(async()=>{
 const events={},notifications=[],opened=[];
 const self={location:{origin:'https://sentra.example'},skipWaiting(){},clients:{claim(){},matchAll:async()=>[],openWindow:async url=>opened.push(url)},registration:{showNotification:async(...a)=>notifications.push(a)},addEventListener:(name,fn)=>events[name]=fn};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/service-worker.js'),'utf8'),{self,URL});
 let pending;events.push({data:{json:()=>({id:'a1',title:'Security alert',body:'Observed activity',url:'/app#alerts?alert=a1'})},waitUntil:p=>pending=p});await pending;assert.equal(notifications.length,1);assert.equal(notifications[0][1].tag,'sentra-a1');
 events.notificationclick({notification:{close(){},data:notifications[0][1].data},waitUntil:p=>pending=p});await pending;assert.equal(opened[0],'https://sentra.example/app#alerts?alert=a1');
 events.push({data:{json:()=>({id:'a2',url:'https://evil.example'})},waitUntil:p=>pending=p});await pending;assert.equal(notifications[1][1].data.url,'/app#alerts');
 const tables={sentra_push_subscriptions:[{id:'s1',user_id:'u1',subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/test'}}],sentra_dashboard_users:[{id:'u1',disabled:false}],cctv_alerts:[{id:'a1',device_id:'d1',event_id:'e1'}],cctv_events:[{id:'e1',device_id:'d1',video_source_id:'v1'}],video_sources:[{id:'v1',device_id:'d1',owner_user_id:'u1'}],sentra_user_devices:[{user_id:'u1',device_id:'d1'}],sentra_push_jobs:[{id:'j1',subscription_id:'s1',alert_id:'a1',payload:{title:'Alert'},attempts:1,status:'sending'}]};
 const db=mockDB(tables);db.rpc=async()=>({data:tables.sentra_push_jobs.filter(x=>x.status==='sending'),error:null});let sent=0,mode='ok';
 const push=createPush(db,{VAPID_PUBLIC_KEY:'p',VAPID_PRIVATE_KEY:'s',VAPID_SUBJECT:'mailto:team@example.com'},{setVapidDetails(){},sendNotification:async()=>{sent++;if(mode==='gone')throw {statusCode:410};if(mode==='retry')throw {statusCode:503};return {statusCode:201};}});
 await push.tick();assert.equal(sent,1);assert.equal(tables.sentra_push_jobs[0].status,'done');
 tables.sentra_push_jobs[0].status='sending';tables.video_sources[0].owner_user_id='another-user';await push.tick();assert.equal(sent,1);assert.equal(tables.sentra_push_jobs[0].status,'failed');tables.video_sources[0].owner_user_id='u1';
 tables.sentra_push_jobs[0].status='sending';tables.sentra_dashboard_users[0].disabled=true;await push.tick();assert.equal(sent,1);assert.equal(tables.sentra_push_jobs[0].status,'failed');
 tables.sentra_dashboard_users[0].disabled=false;tables.sentra_push_jobs[0].status='sending';mode='retry';await push.tick();assert.equal(tables.sentra_push_jobs[0].status,'pending');assert(tables.sentra_push_jobs[0].next_attempt_at);
 tables.sentra_push_jobs[0].status='sending';mode='gone';await push.tick();assert.equal(db.tables.sentra_push_subscriptions.length,0);
 console.log('PASS push: service-worker display and safe deep link with no open page; worker dispatch, disabled-account suppression, transient retry and expired-subscription cleanup (transport mocked)');
})().catch(e=>{console.error(e);process.exitCode=1});
