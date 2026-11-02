const express=require('express');
const {createClient}=require('@supabase/supabase-js');
const {createAuth}=require('./auth');
let cached;
function createApp(database){
 const db=database||(process.env.SUPABASE_URL&&process.env.SUPABASE_KEY?createClient(process.env.SUPABASE_URL,process.env.SUPABASE_KEY,{auth:{persistSession:false}}):null);
 const app=express();app.disable('x-powered-by');app.use(express.json({limit:'16kb'}));
 app.use((req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});next();});
 const auth=createAuth(db);app.use('/api',auth.csrf);
auth.routes(app);
 app.post('/api/invitations/request',async(req,res,next)=>{try{
 if(!db)return res.status(503).json({ok:false,error:'Database not configured'});
 const email=String(req.body.email||'').trim().toLowerCase(),name=String(req.body.name||'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!name||name.length>80)return res.status(400).json({ok:false,error:'Enter your name and valid email.'});
 const {hash}=require('./auth');for(const [key,max,seconds] of [['invite-request-ip:'+req.ip,10,600],['invite-request-email:'+email,3,3600]]){const r=await db.rpc('sentra_take_limit',{p_key:hash(key),p_max:max,p_seconds:seconds});if(r.error)throw r.error;if(!r.data)return res.status(429).json({ok:false,error:'Too many requests. Try again later.'});}
 const r=await db.rpc('sentra_request_invitation',{p_email:email,p_name:name});if(r.error)throw r.error;
 res.json({ok:true,message:'Request submitted for company review. Your invitation will be emailed after approval.'});
 }catch(e){next(e);}});
 app.use('/api',auth.requireUser);
 const data=require('./data').createData(db);require('./routes').dataRoutes(app,db,data);require('./video-api').attachVideoRoutes(app,db,{authorizeSource:data.sourceFor});
 if(db)require('./push').createPush(db).routes(app,(req,res,next)=>next());
 app.get('/api/system',(req,res)=>res.json({ok:true,system:{name:'SENTRA',company:process.env.SENTRA_COMPANY_NAME||'Nexora Solvex',team:(process.env.SENTRA_TEAM_MEMBERS||'').split('|').filter(Boolean),retention:'No automatic deletion is enabled.',livePollSeconds:1,refreshSeconds:60}}));
app.use((err,req,res,next)=>{console.error('SENTRA request failed',{code:err.code,name:err.name});if(!res.headersSent)res.status(err.status||503).json({ok:false,error:err.status===404?err.message:'Request unavailable. Check configuration and connectivity.'});});return app;}
module.exports={createApp,getApp:()=>cached||(cached=createApp())};
