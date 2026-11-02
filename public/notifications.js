(function(){
'use strict';
let foregroundEnabled=false;
const consentKey=()=> 'sentra-notifications-'+window.SENTRA.user.id;
let registration=null,subscription=null,pushConfig=null,backgroundReady=false,installPrompt=null;
const statusText=t=>{const node=document.querySelector('#notification-status');if(node)node.textContent=t;};
const api=(...a)=>window.sentraAPI(...a);
const send=(url,body)=>api(url,{method:'POST',body:JSON.stringify(body)});
function decodeKey(s){return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function ensureWorker(){if(!isSecureContext||!('serviceWorker'in navigator))throw new Error('Use HTTPS (or this computer’s localhost) with a supported browser.');registration=await navigator.serviceWorker.register('/service-worker.js',{scope:'/'});registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Notification worker activation timed out. Reload and try again.')),15000))]);return registration;}
async function enable(){
 if(!('Notification'in window))throw new Error('Notifications are not supported in this browser.');
 // Permission is requested directly from this user click, before any unrelated network calls.
 const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Permission not allowed. Enable notifications in your browser’s site settings.');
 foregroundEnabled=true;localStorage.setItem(consentKey(),'enabled');
 await ensureWorker();pushConfig=await api('/api/push/config');
 if(!pushConfig.configured||!('PushManager'in window)){backgroundReady=false;statusText('Desktop foreground notifications enabled. Company must configure VAPID keys and run the push worker for app-closed delivery.');return;}
 subscription=await registration.pushManager.getSubscription();
 if(subscription&&subscription.options.applicationServerKey){const expected=decodeKey(pushConfig.publicKey),actual=new Uint8Array(subscription.options.applicationServerKey);if(expected.length!==actual.length||expected.some((x,i)=>x!==actual[i])){await subscription.unsubscribe();subscription=null;}}
 if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(pushConfig.publicKey)});
 try{await send('/api/push/subscribe',{subscription:subscription.toJSON()});}catch(e){backgroundReady=false;throw e;}
 backgroundReady=true;statusText('Background push subscribed on this browser. Use Send test, then close the tab and test a new backend alert.');
}
window.sentraDisableNotifications=async()=>{
 foregroundEnabled=false;localStorage.setItem(consentKey(),'disabled');
 if(!registration&&'serviceWorker'in navigator)registration=await navigator.serviceWorker.getRegistration('/');
 if(registration)subscription=await registration.pushManager.getSubscription();
 if(subscription){await send('/api/push/unsubscribe',{endpoint:subscription.endpoint});await subscription.unsubscribe();subscription=null;}
 backgroundReady=false;statusText('Notifications disabled for this browser subscription.');
};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;const b=document.querySelector('#install-app');if(b)b.hidden=false;});
document.addEventListener('sentra:ready',async()=>{
 const handle=fn=>async(event)=>{const b=event?.currentTarget;if(b)b.disabled=true;try{await fn();}catch(e){statusText(e.message);}finally{if(b)b.disabled=false;}};
 document.querySelector('#enable-notifications').onclick=handle(enable);
 document.querySelector('#disable-notifications').onclick=handle(window.sentraDisableNotifications);
 document.querySelector('#test-notification').onclick=handle(async()=>{
  if(!('Notification'in window)||Notification.permission!=='granted')throw new Error('Enable notifications first.');await ensureWorker();
  if(backgroundReady&&subscription){await send('/api/push/test',{endpoint:subscription.endpoint});statusText('Test sent through the push service. Check your system notification tray.');}
  else{await registration.showNotification('SENTRA desktop test',{body:'Foreground notification permission works. Background delivery needs the company push setup.',icon:'/assets/icon-192.png',tag:'sentra-test',data:{url:'/app#settings'}});statusText('Desktop test shown. This does not verify background push delivery.');}
 });
 document.querySelector('#install-app').onclick=handle(async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;document.querySelector('#install-app').hidden=true;});
 try{
  if(!('Notification'in window)){statusText('Use a browser with Web Notifications support.');return;}
  statusText('Browser permission: '+Notification.permission+'. Press Enable notifications to opt in.');
  foregroundEnabled=localStorage.getItem(consentKey())==='enabled';
  if(Notification.permission==='granted'&&foregroundEnabled){
   await ensureWorker();pushConfig=await api('/api/push/config');subscription=await registration.pushManager.getSubscription();
   if(pushConfig.configured&&subscription){await send('/api/push/subscribe',{subscription:subscription.toJSON()});backgroundReady=true;statusText('Background subscription active. The company push worker must stay online.');}
   else statusText('Foreground permission is enabled. Press Enable notifications to finish background setup.');
  }
 }catch(e){statusText(e.message);}
});
document.addEventListener('sentra:alert',async e=>{
 if(!('Notification'in window)||Notification.permission!=='granted'||backgroundReady||!foregroundEnabled)return;
 try{await ensureWorker();const a=e.detail;await registration.showNotification('SENTRA · '+a.alert_level,{body:a.alert_title,icon:'/assets/icon-192.png',tag:'sentra-'+a.id,renotify:false,data:{url:'/app#alerts?alert='+a.id}});}catch{/* Visible in-app toast remains available. */}
});

})();
