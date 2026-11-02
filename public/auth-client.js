'use strict';
const form=document.querySelector('#account-form');
if(form){
 if(location.search.includes('changed=1'))document.querySelector('#auth-message').textContent='Password updated. Sign in with your new password.';
 form.addEventListener('submit',async e=>{
  e.preventDefault();const button=form.querySelector('button[type="submit"]'),message=document.querySelector('#auth-message');button.disabled=true;message.textContent='';
  try{
   const data=Object.fromEntries(new FormData(form));
   if(data.confirm!==undefined&&data.confirm!==data.password)throw new Error('Passwords do not match');delete data.confirm;
   const r=await fetch('/api/auth/'+form.dataset.action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),credentials:'same-origin'});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Sign-in failed');location.assign('/app');
  }catch(err){message.textContent=err.message;}finally{button.disabled=false;}
 });
}

const requestForm=document.querySelector('#invitation-request-form');
if(requestForm){document.querySelector('#request-invite-toggle').onclick=()=>{requestForm.hidden=!requestForm.hidden;if(!requestForm.hidden)requestForm.querySelector('input').focus();};requestForm.onsubmit=async e=>{e.preventDefault();const button=requestForm.querySelector('button'),message=document.querySelector('#invitation-request-message');button.disabled=true;try{const r=await fetch('/api/invitations/request',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(requestForm)))});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');message.textContent=d.message;requestForm.reset();}catch(err){message.textContent=err.message;}finally{button.disabled=false;}};}
