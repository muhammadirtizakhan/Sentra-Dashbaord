const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Compile all classic scripts in ONE context: catches duplicate global const declarations.
const context=vm.createContext({document:{addEventListener(){},querySelector(){return null}},window:{addEventListener(){}},navigator:{},console});
for(const name of ['video-search.js','notifications.js'])vm.runInContext(fs.readFileSync(__dirname+'/../public/'+name,'utf8'),context);
const {createApp}=require('../lib/application');
const app=createApp();const server=app.listen(0,'127.0.0.1',async()=>{try{
const base='http://127.0.0.1:'+server.address().port;
let r=await fetch(base+'/api/bootstrap');assert.equal(r.status,503);
r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://wrong.example'},body:'{}'});assert.equal(r.status,403);
const {createApp:adminApp}=require('../../admin/lib/application');const a=adminApp();const other=a.listen(0,'127.0.0.1');await new Promise(r=>other.once('listening',r));
r=await fetch('http://127.0.0.1:'+other.address().port+'/api/company-admin/session');assert.equal(r.status,401);other.close();
console.log('PASS script isolation, dashboard missing-config denial, cross-origin rejection, separate admin authentication');
}catch(e){console.error(e);process.exitCode=1;}finally{server.close();}});
