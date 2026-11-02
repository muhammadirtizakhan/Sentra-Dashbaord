import {createClient} from '@supabase/supabase-js';
import {createPush} from '../../../lib/push';
import {createCronHandler} from '../../../lib/push-cron';
export const config = {api:{bodyParser:false},maxDuration:60};
let push;
function getPush(){
 if(!push){
  const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_KEY,{auth:{persistSession:false}});
  push=createPush(db);
 }
 return push;
}
export default createCronHandler({getPush});
