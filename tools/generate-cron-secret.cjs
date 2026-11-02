'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=path.resolve(__dirname,'../.private');fs.mkdirSync(dir,{recursive:true,mode:0o700});
const file=path.join(dir,'cron-secret.env');
try {fs.writeFileSync(file,'CRON_SECRET='+crypto.randomBytes(32).toString('hex')+'\n',{mode:0o600,flag:'wx'});console.log('Saved: '+file);}
catch(e){if(e.code==='EEXIST')console.log('Existing secret preserved: '+file);else throw e;}
