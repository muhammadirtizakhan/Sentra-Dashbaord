const crypto=require('node:crypto');
class Query{
 constructor(db,t){this.db=db;this.t=t;this.filters=[];this.orders=[];this.action='select';this.values=null;this.from=0;this.to=Infinity;this.singleMode=false;}
 select(){this.returning=true;return this;}eq(k,v){this.filters.push(r=>this.get(r,k)===v);return this;}gt(k,v){this.filters.push(r=>this.get(r,k)>v);return this;}in(k,a){this.filters.push(r=>a.includes(this.get(r,k)));return this;}get(r,k){if(k==='cctv_events.video_source_id')return this.db.tables.cctv_events.find(e=>e.id===r.event_id)?.video_source_id;return r[k];}
 order(k,o={}){this.orders.push([k,o.ascending!==false]);return this;}limit(n){this.to=this.from+n-1;return this;}range(a,b){this.from=a;this.to=b;return this;}maybeSingle(){this.singleMode=true;return this;}single(){this.singleMode=true;return this;}insert(v){this.action='insert';this.values=v;return this;}upsert(v){this.action='upsert';this.values=v;return this;}update(v){this.action='update';this.values=v;return this;}delete(){this.action='delete';return this;}
 or(s){const m=s.match(/created_at.gt.([^,]+),and\(created_at.eq.[^,]+,id.gt.([^\)]+)\)/);if(!m)throw new Error('unsupported cursor');this.filters.push(r=>r.created_at>m[1]||(r.created_at===m[1]&&r.id>m[2]));return this;}
 then(resolve,reject){try{
 let rows=this.db.tables[this.t];if(!rows)throw new Error('Unknown table '+this.t);
 if(this.action==='insert'||this.action==='upsert'){
  const list=Array.isArray(this.values)?this.values:[this.values];rows=list.map(v=>{
   const existing=this.action==='upsert'?this.db.tables[this.t].find(r=>this.t==='sentra_user_devices'?r.user_id===v.user_id&&r.device_id===v.device_id:false):null;
   if(existing){Object.assign(existing,v);return existing;}
   const item={id:crypto.randomUUID(),created_at:new Date().toISOString(),...v};this.db.tables[this.t].push(item);return item;
  });
 }else{
  rows=rows.filter(r=>this.filters.every(f=>f(r)));
  if(this.action==='update')rows.forEach(r=>Object.assign(r,this.values));
  if(this.action==='delete')this.db.tables[this.t]=this.db.tables[this.t].filter(r=>!rows.includes(r));
 }
 rows=[...rows].sort((a,b)=>{for(const [k,asc]of this.orders){if(this.get(a,k)<this.get(b,k))return asc?-1:1;if(this.get(a,k)>this.get(b,k))return asc?1:-1;}return 0;}).slice(this.from,this.to+1);
 return Promise.resolve({data:this.singleMode?rows[0]||null:rows,error:null}).then(resolve,reject);
 }catch(e){return Promise.resolve({data:null,error:{message:e.message}}).then(resolve,reject);}}
}
function mockDB(tables){return {tables,limits:new Map(),from(t){return new Query(this,t);},storage:{from(bucket){return {createSignedUrl:async p=>({data:{signedUrl:'https://test.supabase.co/'+bucket+'/'+p},error:null})};}},async rpc(name,p){
 if(name==='sentra_take_limit'){const n=(this.limits.get(p.p_key)||0)+1;this.limits.set(p.p_key,n);return {data:n<=p.p_max,error:null};}
 if(name==='sentra_register_invite'){
  const inv=this.tables.sentra_dashboard_invites.find(x=>x.token_hash===p.p_token&&x.email===p.p_email&&!x.used_at&&x.expires_at>new Date().toISOString());
  if(!inv||this.tables.sentra_dashboard_users.some(u=>u.email===p.p_email))return {data:null,error:{message:'invalid invitation'}};
  inv.used_at=new Date().toISOString();const user={id:crypto.randomUUID(),email:p.p_email,name:p.p_name,password_hash:p.p_password,timezone:'Asia/Karachi',disabled:false};this.tables.sentra_dashboard_users.push(user);this.tables.sentra_user_devices.push(...inv.devices.map(device_id=>({user_id:user.id,device_id})));return {data:user.id,error:null};
 }
 if(name==='sentra_change_password'){const u=this.tables.sentra_dashboard_users.find(u=>u.id===p.p_user&&u.password_hash===p.p_old&&!u.disabled);if(!u)return {data:false,error:null};u.password_hash=p.p_new;this.tables.sentra_dashboard_sessions=this.tables.sentra_dashboard_sessions.filter(s=>s.user_id!==u.id);return {data:true,error:null};}
 if(name==='sentra_claim_push')return {data:[],error:null};throw new Error('Unsupported RPC '+name);
 }};}
module.exports={mockDB};
