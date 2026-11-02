(function(){
/* =========================================================
   6. VIDEO SEARCH — actual media clock, source IDs and observed boxes
========================================================= */
document.addEventListener('sentra:ready', () => {
 const section=document.querySelector('.page-section[data-page="video-search"]');if(!section)return;
 const $=s=>section.querySelector(s);
 const video=$('#search-video'),canvas=$('#detection-canvas'),ctx=canvas.getContext('2d');
 const message=$('#video-status');
 let results=[],selected=null,source=null,metadata=null,generation=0,frames=[],frameWindow=-1,loadingWindow=-1,request=null,frameHandle=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clock=n=>{n=Math.max(0,Math.floor(Number(n)||0));return (n>=3600?String(Math.floor(n/3600)).padStart(2,'0')+':':'')+String(Math.floor(n/60)%60).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
 const notify=t=>{message.textContent=t;message.hidden=!t;};
 function clearBoxes(){ctx.clearRect(0,0,canvas.width,canvas.height);}
 function mapEvents(events){return events.map(e=>({...e,object:e.vehicleId!=='-'?'Vehicle':'Person'}));}
 function filtered(){
  const date=$('#search-date').value,from=$('#search-time-from').value,to=$('#search-time-to').value;
  const camera=$('#search-camera').value,object=$('#search-object').value;
  return results.filter(e=>{
   const d=new Date(e.startIso);const parts=new Intl.DateTimeFormat('en-GB',{timeZone:window.SENTRA.tz||'Asia/Karachi',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);
   const matchTime=from&&to&&from>to?(parts>=from||parts<=to):(!from||parts>=from)&&(!to||parts<=to);
   return (!date||date===e.date)&&matchTime&&(/^(all|all cameras)$/i.test(camera)||camera===e.camera)&&(/^(all|all objects)$/i.test(object)||object===e.object);
  });
 }
 function render(){
  const rows=filtered();$('#results-count-title').textContent=`Search Results (${rows.length})`;
  $('#results-list-container').innerHTML=rows.map(e=>`<button type="button" class="result-item${e.id===selected?.id?' active':''}" data-event-id="${esc(e.id)}"><span class="result-thumb-box"><i class="fa-solid fa-video"></i><span>${esc(e.camera)}</span></span><span class="result-info"><span class="result-time">${esc(e.start)}</span><span class="result-camera">${esc(e.camera)}</span><span class="result-event">${esc(e.name)}</span></span></button>`).join('')||'<p class="video-empty">No matching events.</p>';
  return rows;
 }
 function resetMedia(){
  $('#time-display-label').textContent='00:00 / 00:00';$('#progress-fill').style.width='0%';$('#player-timestamp').textContent='';$('#camera-title-overlay').textContent='No recording selected';$('#jump-time-input').value='';
  video.pause();video.removeAttribute('src');video.load();frames=[];frameWindow=-1;loadingWindow=-1;clearBoxes();
 }
 function progress(){
  const duration=Number.isFinite(video.duration)?video.duration:0;
  $('#time-display-label').textContent=`${clock(video.currentTime)} / ${clock(duration)}`;
  $('#progress-fill').style.width=duration?`${100*video.currentTime/duration}%`:'0%';
  $('#btn-play-pause i').className=video.paused?'fa-solid fa-play':'fa-solid fa-pause';
  if(selected)$('#player-timestamp').textContent=`${selected.timeBasis?.includes('unknown')?'Analysis date':'Date'} ${selected.date} · video ${clock(video.currentTime)}`;
 }
 async function getJSON(url,signal){const r=await fetch(url,{signal,cache:'no-store'});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Request failed');return d;}
 async function loadFrames(){
  if(!metadata?.detectionsUrl)return;
  const windowStart=Math.floor(video.currentTime/10)*10;
  if(frameWindow===windowStart||loadingWindow===windowStart)return;
  const g=generation;loadingWindow=windowStart;frames=[];clearBoxes();
  try{
   const d=await getJSON(metadata.detectionsUrl+`?from=${windowStart}&to=${windowStart+15}`,request?.signal);
   if(g!==generation||Math.floor(video.currentTime/10)*10!==windowStart)return;
   frames=d.frames;frameWindow=windowStart;draw(video.currentTime);
  }catch(e){if(g===generation&&e.name!=='AbortError')notify('Video available; detection data could not be loaded.');}
  finally{if(g===generation&&loadingWindow===windowStart)loadingWindow=-1;}
 }
 function draw(time){
  const rect=video.getBoundingClientRect();const vw=video.videoWidth,vh=video.videoHeight;
  if(!rect.width||!vw||!vh){clearBoxes();return;}
  const dpr=window.devicePixelRatio||1;
  const width=Math.round(rect.width*dpr),height=Math.round(rect.height*dpr);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);
  // Last actual sampled frame only, with a strict 500 ms expiry. No fabricated interpolation.
  let lo=0,hi=frames.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(frames[mid].t<=time)lo=mid+1;else hi=mid;}
  const row=frames[lo-1];if(!row||time-row.t>0.5||time<row.t)return;
  const scale=Math.min(rect.width/vw,rect.height/vh),ox=(rect.width-vw*scale)/2,oy=(rect.height-vh*scale)/2;
  for(const b of row.boxes){
   if(!Array.isArray(b.xyxy)||b.xyxy.length!==4||!b.xyxy.every(Number.isFinite))continue;
   const [x1,y1,x2,y2]=b.xyxy;if(x2<=x1||y2<=y1)continue;
   ctx.strokeStyle=b.label==='person'?'#35d98b':'#4d8dff';ctx.lineWidth=2;
   ctx.strokeRect(ox+x1*scale,oy+y1*scale,(x2-x1)*scale,(y2-y1)*scale);
   ctx.font='12px sans-serif';ctx.fillStyle=ctx.strokeStyle;
   ctx.fillText(`${b.label} #${b.id}`,ox+x1*scale,Math.max(14,oy+y1*scale-5));
  }
 }
 function frameLoop(_,meta){draw(meta.mediaTime);loadFrames();frameHandle=video.requestVideoFrameCallback(frameLoop);}
 if(video.requestVideoFrameCallback)frameHandle=video.requestVideoFrameCallback(frameLoop);
 async function select(e){
  if(!e)return;generation++;request?.abort();request=new AbortController();
  selected=e;source=e.videoSourceId;metadata=null;resetMedia();render();progress();
  $('#camera-title-overlay').textContent=e.camera+' · Recorded footage';
  if(!source){notify('This older event has no linked video source.');return;}
  if(e.videoOffsetSec==null||!Number.isFinite(e.videoOffsetSec)||e.videoOffsetSec<0){notify('This event has no reliable video offset; no timestamp was guessed.');return;}
  notify('Checking video upload…');await refreshMedia(true);
 }
 async function refreshMedia(initial=false){
  if(!source)return;const g=generation;
  try{
   const d=await getJSON(`/api/videos/${encodeURIComponent(source)}`,request?.signal);
   if(g!==generation)return;metadata=d;
   if(!d.streamUrl){notify(d.status==='not_uploaded'?'Video not uploaded. Older runs need a media backfill.':d.status==='failed'?'Video upload failed; retry from the Python uploader.':'Video uploading. Events and images remain available.');return;}
   notify(d.detectionsUrl?'':'Video ready; detection data is recording or uploading.');
   if(!video.getAttribute('src')){
    const seek=()=>{
     video.removeEventListener('loadedmetadata',seek);if(g!==generation)return;
     if(!Number.isFinite(video.duration)||selected.videoOffsetSec>video.duration){notify('Event offset is outside this video.');return;}
     video.currentTime=selected.videoOffsetSec;$('#jump-time-input').value=clock(selected.videoOffsetSec);progress();loadFrames();
    };
    video.addEventListener('loadedmetadata',seek,{once:true});video.src=d.streamUrl;video.load();
   }else loadFrames();
  }catch(e){if(g===generation&&e.name!=='AbortError')notify('Video service unavailable. Check dashboard credentials, Drive authorization and SQL migration.');}
 }
 $('#results-list-container').addEventListener('click',e=>{const b=e.target.closest('[data-event-id]');if(b)select(results.find(r=>r.id===b.dataset.eventId));});
 $('#btn-video-search').addEventListener('click',()=>{const rows=render();if(rows.length)select(rows[0]);else{generation++;request?.abort();selected=null;source=null;resetMedia();notify('No matching events.');}});
 $('#btn-play-pause').addEventListener('click',()=>{if(!video.src)return;if(video.paused)video.play().catch(()=>notify('Playback could not start. Check video authorization or format.'));else video.pause();});
 $('#btn-pause-only').addEventListener('click',()=>video.pause());
 $('#btn-volume').addEventListener('click',()=>{video.muted=!video.muted;$('#btn-volume i').className=video.muted?'fa-solid fa-volume-xmark':'fa-solid fa-volume-high';});
 $('#btn-download-video').addEventListener('click',()=>{if(!metadata?.streamUrl)return;const a=document.createElement('a');a.href=metadata.streamUrl;a.download=`sentra-${source}.mp4`;a.click();});
 const full=()=>{const el=$('.video-display');if(document.fullscreenElement)document.exitFullscreen();else el.requestFullscreen?.();};
 $('#btn-fullscreen-video').addEventListener('click',full);$('.player-actions .icon-btn').addEventListener('click',full);
 $('.progress-bar-container').addEventListener('click',e=>{if(!Number.isFinite(video.duration))return;const r=e.currentTarget.getBoundingClientRect();video.currentTime=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*video.duration;});
 $('#btn-jump-go').addEventListener('click',()=>{
  const raw=$('#jump-time-input').value.trim();const p=raw.split(':');
  if(!/^\d+:\d{2}(?::\d{2})?$/.test(raw)||p.slice(1).some(n=>Number(n)>59)){notify('Enter video offset as MM:SS or HH:MM:SS.');return;}
  const seconds=p.reduce((a,n)=>a*60+Number(n),0);
  if(!Number.isFinite(video.duration)||seconds>video.duration){notify('Time is outside the loaded video.');return;}
  video.currentTime=seconds;notify(metadata?.detectionsUrl?'':'Video ready; detections are not available yet.');
 });
 for(const event of ['timeupdate','seeked','loadedmetadata','play','pause','ended'])video.addEventListener(event,()=>{progress();draw(video.currentTime);loadFrames();});
 video.addEventListener('seeking',()=>{frames=[];frameWindow=-1;clearBoxes();});
 video.addEventListener('error',()=>{if(!source||window.SENTRA.workspaceReset)return;notify('Video could not load. Check Drive access and the server log; events and snapshots remain available.');});
 window.addEventListener('resize',()=>draw(video.currentTime));
 async function refresh(){
  try{
   const d=window.SENTRA;if(d.workspaceReset){selected=null;source=null;metadata=null;generation++;request?.abort();resetMedia();results=[];render();notify('Workspace reset. Load a recording from History.');return;}results=mapEvents(d.events||[]);window.SENTRA.events=d.events;
   const c=$('#search-camera'),value=c.value;c.innerHTML='<option value="ALL">All Cameras</option>'+(d.cameras||[]).map(n=>`<option>${esc(n)}</option>`).join('');if([...c.options].some(o=>o.value===value))c.value=value;
   const rows=render();
   if(!selected&&rows.length)await select(rows[0]);
   else if(selected&&!results.some(r=>r.id===selected.id)){selected=null;source=null;generation++;request?.abort();resetMedia();notify('Selected event was removed. Choose another result.');}
   else await refreshMedia();
  }catch{/* Existing event list remains available during a transient refresh failure. */}
 }
 results=mapEvents(window.SENTRA.events||[]);const rows=render();if(rows.length)select(rows[0]);else notify('No events available yet.');
 document.addEventListener('sentra:watch',async e=>{await refresh();const found=results.find(x=>x.id===e.detail.eventId);if(found)select(found);});
 document.addEventListener('sentra:data',e=>{if(e.detail?.scopeChanged){selected=null;source=null;generation++;request?.abort();metadata=null;resetMedia();} refresh();});
 setInterval(()=>{if(source&&!document.hidden&&!section.classList.contains('hidden'))refreshMedia();},10000);
});



})();
