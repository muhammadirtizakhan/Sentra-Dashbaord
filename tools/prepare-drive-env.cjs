'use strict';
// Run locally ONLY. The generated file contains secrets and must not be committed.
const fs=require('node:fs'),path=require('node:path');
try{
 const tokenPath=process.argv[2];
 if(!tokenPath)throw new Error('Pass the path to your existing google-drive-token.json');
 const token=JSON.parse(fs.readFileSync(path.resolve(tokenPath),'utf8'));
 const names={GOOGLE_DRIVE_CLIENT_ID:'client_id',GOOGLE_DRIVE_CLIENT_SECRET:'client_secret',GOOGLE_DRIVE_REFRESH_TOKEN:'refresh_token'};
 const lines=Object.entries(names).map(([name,field])=>{
  const value=token[field];if(typeof value!=='string'||!value||/[\r\n]/.test(value))throw new Error('Missing or invalid '+field+'; use the newly authorized token file');
  return name+'='+value;
 });
 const dir=path.resolve(__dirname,'../.private');fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const file=path.join(dir,'drive-vercel.env');fs.writeFileSync(file,lines.join('\n')+'\n',{mode:0o600});
 console.log('Created private ENV file: '+file);
 console.log('Copy these three values into Vercel Dashboard project settings. Do not share this file or commit it.');
}catch(e){console.error('Could not prepare Drive settings: '+(e.code||e.message));process.exitCode=1;}
