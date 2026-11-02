'use strict';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
// No fetch cache: CCTV records, images, sessions and media stay network-only.
self.addEventListener('push',e=>{
 let data;try{data=e.data.json();}catch{data={title:'SENTRA alert',body:'Open SENTRA to review the latest activity.',id:'alert'};}
 const url=typeof data.url==='string'&&data.url.startsWith('/app#')?data.url:'/app#alerts';
 e.waitUntil(self.registration.showNotification(String(data.title||'SENTRA alert'),{body:String(data.body||'New security event'),icon:'/assets/icon-192.png',badge:'/assets/icon-192.png',tag:'sentra-'+String(data.id||'alert'),renotify:false,data:{url}}));
});
self.addEventListener('notificationclick',e=>{
 e.notification.close();const path=e.notification.data?.url||'/app#alerts';
 const target=new URL(path,self.location.origin);
 if(target.origin!==self.location.origin)return;
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  const existing=clients.find(c=>new URL(c.url).origin===self.location.origin&&new URL(c.url).pathname==='/app');
  if(existing){await existing.navigate(target.href);return existing.focus();}
  return self.clients.openWindow(target.href);
 }));
});
