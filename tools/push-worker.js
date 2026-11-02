require('dotenv').config({path:require('node:path').join(__dirname,'../.env.local')});
require('dotenv').config({path:require('node:path').join(__dirname,'../.env')});
const {createClient}=require('@supabase/supabase-js');
const {createPush,pushConfigured}=require('../lib/push');
if(!pushConfigured())throw new Error('Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT first');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_KEY,{auth:{persistSession:false}});
const push=createPush(db);
console.log('SENTRA push worker running. Keep this process online for background delivery.');
let stopped=false;
async function loop(){if(stopped)return;try{await push.tick();}catch(e){console.error('Push worker failed',{code:e.code||e.statusCode||'unknown',message:e.message||'Check database migrations and connectivity'});}setTimeout(loop,1000);}
loop();process.on('SIGINT',()=>{stopped=true;process.exit(0);});
