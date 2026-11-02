(function(){
'use strict';

// Application confirmation: keyboard accessible, text-only content, no browser confirm().
let activeConfirmation = false;
function confirmAction({title, message, confirmLabel}) {
  if (activeConfirmation) return Promise.resolve(false);
  activeConfirmation = true;
  const previousFocus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'sentra-confirm';
  dialog.setAttribute('aria-labelledby', 'sentra-confirm-title');
  dialog.setAttribute('aria-describedby', 'sentra-confirm-message');
  const heading = document.createElement('h2');
  heading.id = 'sentra-confirm-title'; heading.textContent = title;
  const description = document.createElement('p');
  description.id = 'sentra-confirm-message'; description.textContent = message;
  const actions = document.createElement('div'); actions.className = 'sentra-confirm-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.className = 'sentra-confirm-cancel'; cancel.textContent = 'Cancel';
  const accept = document.createElement('button');
  accept.type = 'button'; accept.className = 'sentra-confirm-accept'; accept.textContent = confirmLabel;
  actions.append(cancel, accept); dialog.append(heading, description, actions); document.body.append(dialog);
  return new Promise(resolve => {
    let accepted = false;
    dialog.addEventListener('close', () => {
      dialog.remove(); activeConfirmation = false;
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve(accepted);
    }, {once:true});
    cancel.onclick = () => dialog.close();
    accept.onclick = () => { accepted = true; dialog.close(); };
    dialog.addEventListener('click', e => {
      const r = dialog.getBoundingClientRect();
      if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dialog.close();
    });
    try { dialog.showModal(); cancel.focus(); }
    catch { dialog.remove(); activeConfirmation = false; resolve(false); }
  });
}

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state=window.SENTRA={ok:false,events:[],alerts:[],timeline:[],investigations:[],cameras:[],rules:[],metrics:{},daily:{labels:[],total:[],relevant:[]},tz:'Asia/Karachi',source:null,workspaceReset:false,user:null};
const api=window.sentraAPI=async(url,options={})=>{const r=await fetch(url,{cache:'no-store',credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});if(r.status===401){location.replace('/login');throw new Error('Session expired');}let d;try{d=await r.json();}catch{throw new Error('Server returned an unexpected response');}if(!r.ok||!d.ok)throw new Error(d.error||'Request failed');return d;};
const post=(url,body,method='POST')=>api(url,{method,body:JSON.stringify(body)});
const fmt=(d,full=false)=>new Intl.DateTimeFormat('en-GB',{timeZone:state.tz,...(full?{dateStyle:'medium',timeStyle:'short'}:{timeStyle:'medium'})}).format(new Date(d));
const badge=s=>`<span class="badge ${/high|active|open/i.test(s)?'badge-red':/medium|pending/i.test(s)?'badge-orange':'badge-green'}">${esc(s)}</span>`;
const view=id=>`<button class="btn btn-secondary btn-sm" data-event="${esc(id)}">View</button>`;
let refreshGeneration=0,refreshBusy=false,history=[],feedCursor=null,feedStarted=false,lastDeepLink='',feedFailures=0;
const seen=new Set();
function announce(message){const n=document.createElement('div');n.className='sentra-toast';n.textContent=message;$('#toast-stack').append(n);setTimeout(()=>n.remove(),7000);}
window.sentraToast=announce;
function error(message){$('#page-error').textContent=message;$('#page-error').hidden=!message;}
function route(){const [name,query='']=(location.hash.slice(1)||'dashboard').split('?');const known=$(`[data-page="${CSS.escape(name)}"].page-section`)?name:'dashboard';$$('.page-section').forEach(s=>s.classList.toggle('hidden',s.dataset.page!==known));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===known));document.body.dataset.page=known;document.body.classList.remove('mobile-nav-open');$('#mobile-menu-toggle')?.setAttribute('aria-expanded','false');if(known==='history')renderHistory();const alert=new URLSearchParams(query).get('alert');if(alert&&lastDeepLink!==alert){lastDeepLink=alert;openAlert(alert).catch(e=>announce(e.message));}}
state.navigate=page=>{location.hash=page;};
function shell(){
 const nav=[['dashboard','house','Dashboard'],['investigations','briefcase','Investigations'],['cctv-events','video','CCTV Events'],['alerts','bell','Alerts'],['history','clock-rotate-left','History'],['video-search','magnifying-glass','Video Search'],['event-timeline','timeline','Event Timeline'],['reports','file-lines','Reports'],['settings','gear','Settings']];
 $('#global-topbar-slot').innerHTML=`<button id="mobile-menu-toggle" class="mobile-menu-toggle" aria-label="Open menu" aria-expanded="false"><i class="fa-solid fa-bars"></i></button><a class="brand" href="/app#dashboard"><img src="/assets/icon.svg" width="38" height="38" alt=""><div><div class="brand-name">SENTRA</div><div class="brand-tagline">AI CCTV Investigation Support</div></div></a><div class="topbar-search"><i class="fa-solid fa-magnifying-glass"></i><input id="global-search-input" placeholder="Search events…"></div><div class="topbar-right"><a class="icon-btn" href="#alerts" aria-label="Alerts"><i class="fa-solid fa-bell"></i><span id="topbar-bell-badge" class="icon-btn-badge">0</span></a><a href="#settings" class="user-chip"><span class="user-avatar"><i class="fa-solid fa-user"></i></span><div><p class="user-name"></p><p class="user-role">Company workspace</p></div></a><button class="icon-btn" id="logout-btn" aria-label="Log out"><i class="fa-solid fa-right-from-bracket"></i></button></div>`;
 $('#sidebar-slot').innerHTML=`<nav class="sidebar-nav">${nav.map(([p,i,t])=>`<a href="#${p}" class="nav-item" data-page="${p}"><span class="nav-icon"><i class="fa-solid fa-${i}"></i></span><span>${t}</span>${p==='alerts'?'<span id="sidebar-alert-badge" class="nav-badge">0</span>':''}</a>`).join('')}</nav><div class="sidebar-footer"><div class="status-pill"><span class="status-dot"></span><div><p id="connection-label">Connecting…</p><p class="text-muted">Private company workspace</p></div></div></div>`;
 $('#mobile-menu-toggle').onclick=()=>{const open=document.body.classList.toggle('mobile-nav-open');$('#mobile-menu-toggle').setAttribute('aria-expanded',String(open));};
 $('#global-search-input').addEventListener('input',e=>{$('#mainSearch').value=e.target.value;location.hash='investigations';renderTables();});
 $('#logout-btn').onclick=logout;profileUI();
}
function profileUI(){if(!state.user)return;$$('.user-name').forEach(e=>e.textContent=state.user.name);$('#profile-name').value=state.user.name;$('#profile-email').value=state.user.email;const zones=[...new Set([state.user.timezone,'Asia/Karachi','UTC','Asia/Dubai','Europe/London','America/New_York'])];$('#profile-timezone').innerHTML=zones.map(z=>`<option ${z===state.user.timezone?'selected':''}>${esc(z)}</option>`).join('');}
function fill(selector,first,values){const el=$(selector);if(!el)return;const old=el.value;el.innerHTML=`<option value="">${first}</option>`+values.map(v=>`<option>${esc(v)}</option>`).join('');if([...el.options].some(o=>o.value===old))el.value=old;}
function resetDates(){for(const s of ['#dateRange','#dateRangeCctv','#date-filter','#search-date','#timeline-date'])if($(s))$(s).value='';}
function badges(){const n=state.alerts.filter(a=>a.status==='Open').length;for(const s of ['#topbar-bell-badge','#sidebar-alert-badge'])if($(s))$(s).textContent=n;}
function renderDashboard(){const m=state.metrics;$$('[data-page="dashboard"] .card-value').forEach((e,i)=>e.textContent=[m.totalEvents,m.relevant,m.activeAlerts,m.videosAnalyzed,m.investigations][i]??0);$$('.stat-sub').forEach(e=>{if(e.textContent.includes('Since'))e.textContent='Loaded scope · last 7 days';});const tbody=$('.recent-events-table tbody');if(tbody)tbody.innerHTML=state.events.slice(0,6).map(e=>`<tr><td>${esc(e.start)}</td><td>${esc(e.name)}</td><td>${esc(e.camera)}</td><td>${badge(e.status)}</td></tr>`).join('')||'<tr><td colspan="4">No events in this scope</td></tr>';const latest=state.events[0];const feed=$('.cctv-feed-panel');if(feed)feed.innerHTML='<h3 class="panel-title">Latest event evidence</h3>'+(latest?`<button class="evidence-thumb" data-image="/api/snapshot/${encodeURIComponent(latest.id)}"><img src="/api/snapshot/${encodeURIComponent(latest.id)}" alt="Latest recorded evidence"></button>${view(latest.id)}`:'<p>No recorded evidence in this scope.</p>');const max=Math.max(1,...state.daily.total);$('#barChart').innerHTML=state.daily.labels.map((d,i)=>`<div class="bar-group"><div class="bar bar-total" style="height:${100*state.daily.total[i]/max}%" title="${esc(d)} · ${state.daily.total[i]}"></div><div class="bar bar-relevant" style="height:${100*state.daily.relevant[i]/max}%"></div></div>`).join('');$('.bar-labels')?.remove();$('#barChart').insertAdjacentHTML('afterend',`<div class="bar-labels">${state.daily.labels.map(d=>`<span>${esc(d)}</span>`).join('')}</div>`);}
function renderTables(){
 const q=$('#mainSearch').value.toLowerCase(),type=$('#eventType').value,status=$('#statusFilter').value,date=$('#dateRange').value;
 const inv=state.investigations.filter(e=>(!q||[e.id,e.name,e.camera].join(' ').toLowerCase().includes(q))&&(!type||type===e.name)&&(!status||status===e.status)&&(!date||date===e.date));
 $('#investigationsTable tbody').innerHTML=inv.map(e=>`<tr><td>${esc(e.id)}</td><td>${esc(e.name)}</td><td>${esc(e.date+' '+e.time)}</td><td>${esc(e.camera)}</td><td>${badge(e.status)}</td><td>${view(e.eventId)}</td></tr>`).join('')||'<tr><td colspan="6">No matching events</td></tr>';
 const cam=$('#cameraFilter').value,ct=$('#eventTypeFilter').value,cs=$('#cctvStatusFilter').value,cd=$('#dateRangeCctv').value,from=$('#timeFrom').value,to=$('#timeTo').value;
 const ev=state.events.filter(e=>{const time=fmt(e.startIso).slice(0,5);return (!cam||cam===e.camera)&&(!ct||ct===e.name)&&(!cs||cs===e.status)&&(!cd||cd===e.date)&&(!from||time>=from)&&(!to||time<=to);});
 $('#eventsTable tbody').innerHTML=ev.map((e,i)=>`<tr><td>${i+1}</td><td>${esc(e.name)}</td><td>${esc(e.start)}</td><td>${esc(e.end)}</td><td>${esc(e.camera)}</td><td>${esc(e.personId)}</td><td>${esc(e.vehicleId)}</td><td>${badge(e.status)}</td><td>${view(e.id)}</td></tr>`).join('')||'<tr><td colspan="9">No matching events</td></tr>';
}
function renderAlerts(){const sev=$('#severity-filter').value,status=$('#status-filter').value,date=$('#date-filter').value,time=$('#time-filter').value;
 const a=state.alerts.filter(x=>(/all/i.test(sev)||!sev||x.severity===sev)&&(/all/i.test(status)||!status||x.status===status)&&(!date||date===x.date)&&(!time||x.time.startsWith(time)));
 $('#alerts-table-body').innerHTML=a.map(x=>`<tr><td>${esc(x.code)}</td><td>${esc(x.time)}</td><td>${esc(x.name)}</td><td>${badge(x.severity)}</td><td>${badge(x.status)}</td><td><button class="btn btn-secondary btn-sm" data-alert="${esc(x.id)}">View</button></td></tr>`).join('')||'<tr><td colspan="6">No matching alerts</td></tr>';badges();}
function renderTimeline(){const sec=$('.page-section[data-page="event-timeline"]'),f=[...sec.querySelectorAll('.timeline-filters-row .filter-select')],rows=state.timeline.filter(x=>(!f[0]?.value||f[0].value===x.isoDate)&&(!f[1]?.value||/all/i.test(f[1].value)||f[1].value===x.camera)&&(!f[2]?.value||/all/i.test(f[2].value)||f[2].value===x.eventType));const box=sec.querySelector('.timeline-container');box.innerHTML=rows.map((x,i)=>`<button class="timeline-item" data-timeline="${state.timeline.indexOf(x)}"><span class="timeline-dot"></span><span class="timeline-time">${esc(x.time)}</span><span class="timeline-desc">${esc(x.desc)}</span><span class="timeline-cam">${esc(x.camera)}</span><span class="timeline-tag ${x.tagClass}">${esc(x.tag)}</span></button>`).join('')||'<p>No matching timeline entries.</p>';timelinePreview(rows[0]);}
function timelinePreview(x){const sec=$('.page-section[data-page="event-timeline"]'),preview=sec.querySelector('.preview-screen');preview.innerHTML=x?`<button class="evidence-thumb" data-image="/api/snapshot/${encodeURIComponent(x.eventId)}"><img src="/api/snapshot/${encodeURIComponent(x.eventId)}" alt="Recorded event evidence"></button><div class="preview-timestamp">${esc(x.previewTime)}</div>`:'<p>No event evidence selected.</p>';sec.querySelector('.related-event-card').innerHTML=x?`<h3>${esc(x.relatedTitle)}</h3><p>${esc(x.relatedTime)}</p><p>${esc(x.metadata)}</p>${view(x.eventId)}`:'<p>Select an event.</p>';}
let reports=[];
function renderReports(filter='all'){
 const dates=[...new Set(state.events.map(e=>e.date))];
 reports=dates.flatMap(date=>[{id:'event:'+date,type:'event',name:'Event & alert summary · '+date,date},{id:'investigation:'+date,type:'investigation',name:'Investigation review · '+date,date}]);
 if(filter!=='all')reports=reports.filter(r=>r.type===filter);
 $('#reports-table-body').innerHTML=reports.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.type==='event'?'Event summary':'Investigation review'}</td><td>${esc(r.date)}</td><td><button class="btn btn-secondary btn-sm" data-report="${esc(r.id)}">Download CSV</button></td></tr>`).join('');$('#reports-empty').classList.toggle('hidden',reports.length>0);
}
function csv(value){const s=String(value??'');return '"'+(/^[=+@\-\t\r]/.test(s)?"'":'')+s.replaceAll('"','""')+'"';}
function downloadReport(id){
 const report=reports.find(r=>r.id===id);if(!report)return;const {date,type}=report;
 const rows=type==='investigation'?[['Code','Name','Date','Time','Camera','Severity','Status'],...state.investigations.filter(e=>e.date===date).map(e=>[e.id,e.name,e.date,e.time,e.camera,e.severity,e.status])]:[['Kind','Code','Name','Date','Time','Severity','Status','Camera'],...state.events.filter(e=>e.date===date).map(e=>['Event',e.code,e.name,e.date,e.start,e.severity,e.status,e.camera]),...state.alerts.filter(a=>a.date===date).map(a=>['Alert',a.code,a.name,a.date,a.time,a.severity,a.status,a.camera])];
 const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(csv).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`SENTRA-${type}-${date}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function resetStorageKey(){return 'sentra-workspace-reset:'+state.user.id;}
function rememberReset(value){try{if(value)sessionStorage.setItem(resetStorageKey(),'1');else sessionStorage.removeItem(resetStorageKey());}catch{}}
function resetWorkspace(notify=true){
 ++refreshGeneration;refreshBusy=false;state.workspaceReset=true;state.source=null;rememberReset(true);
 for(const key of ['events','alerts','timeline','investigations','cameras'])state[key]=[];
 state.metrics={totalEvents:0,relevant:0,activeAlerts:0,videosAnalyzed:history.length,investigations:0};
 state.daily={labels:[],total:[],relevant:[]};resetDates();
 for(const id of ['mainSearch','global-search-input','time-filter','search-time-from','search-time-to','jump-time-input'])if($('#'+id))$('#'+id).value='';
 $('#timeFrom').value='00:00';$('#timeTo').value='23:59';
 for(const id of ['eventType','eventTypeFilter','statusFilter','cctvStatusFilter','cameraFilter','timeline-camera','timeline-type','severity-filter','status-filter'])if($('#'+id))$('#'+id).selectedIndex=0;
 for(const id of ['detail-dialog','image-dialog'])if($('#'+id).open)$('#'+id).close();
 $('#detail-content').innerHTML='';$('#evidence-full').removeAttribute('src');
 renderDashboard();renderTables();renderAlerts();renderTimeline();renderReports();error('');
 $('#scope-label').textContent='Workspace reset — load a recording from History or resume live updates';$('#resume-live').hidden=false;
 document.dispatchEvent(new CustomEvent('sentra:data',{detail:{scopeChanged:true}}));
 if(notify)announce('Workspace reset. History and recordings are preserved.');
}
async function refreshData(scopeChanged=false){
 if(state.workspaceReset)return;
 if(refreshBusy&&!scopeChanged)return;const g=++refreshGeneration;refreshBusy=true;
 try{const d=await api('/api/bootstrap'+(state.source?'?source='+encodeURIComponent(state.source):''));if(g!==refreshGeneration)return;
 for(const key of ['events','alerts','timeline','investigations','cameras','rules'])state[key]=d[key]||[];Object.assign(state,{tz:d.tz,metrics:d.metrics,daily:d.daily,ok:true});
 if(scopeChanged)resetDates();fill('#eventType','All Types',[...new Set(state.events.map(e=>e.name))]);fill('#eventTypeFilter','All Types',[...new Set(state.events.map(e=>e.name))]);fill('#statusFilter','All Status',[...new Set(state.events.map(e=>e.status))]);fill('#cctvStatusFilter','All Status',[...new Set(state.events.map(e=>e.status))]);fill('#cameraFilter','All Cameras',state.cameras);
 fill('#timeline-camera','All Cameras',state.cameras);fill('#timeline-type','All Types',[...new Set(state.timeline.map(t=>t.eventType))]);
 renderDashboard();renderTables();renderAlerts();renderTimeline();renderReports();renderRules();$('#connection-label').textContent='Connected to database';$('#sync-label').textContent='Updated '+fmt(new Date());error('');
 $('#scope-label').textContent=state.source?'Recording: '+(history.find(s=>s.id===state.source)?.camera_name||state.source):'All assigned recordings';$('#resume-live').hidden=!state.source;
 document.dispatchEvent(new CustomEvent('sentra:data',{detail:{scopeChanged}}));
 }catch(e){if(g!==refreshGeneration)return;error(e.message);$('#connection-label').textContent='Connection interrupted';throw e;}finally{if(g===refreshGeneration)refreshBusy=false;}
}
async function loadHistory(){history=(await api('/api/history')).sources;renderHistory();if(state.workspaceReset){state.metrics.videosAnalyzed=history.length;renderDashboard();}}
function renderHistory(){const query=($('#history-search').value||'').toLowerCase();$('#history-list').innerHTML=history.filter(s=>(s.camera_name+' '+s.device_id).toLowerCase().includes(query)).map(s=>`<article class="card history-card"><div><span class="eyebrow">${esc(s.source_type)}</span><h2>${esc(s.camera_name)}</h2><p>${esc(fmt(s.created_at,true))} · ${Math.round(Number(s.duration_sec)||0)} sec</p><p class="text-muted">Device: ${esc(s.device_id)}</p><p>${badge(s.status)} · Video ${esc(s.media?.status||'not uploaded')} · Boxes ${esc(s.media?.detections_status||'not available')}</p></div><button class="btn btn-primary" data-load-source="${esc(s.id)}">Load recording</button></article>`).join('')||'<p>No recordings match. If access was just granted, refresh this page.</p>';}
async function setSource(id){const previous=state.source,wasReset=state.workspaceReset;state.workspaceReset=false;rememberReset(false);state.source=id;try{await refreshData(true);location.hash='dashboard';}catch(e){state.source=previous;if(wasReset)resetWorkspace(false);throw e;}}
function showDetail(html){$('#detail-content').innerHTML=html;$('#detail-dialog').showModal();}
async function openEvent(id){const g=refreshGeneration;const {event:e,steps}=await api('/api/events/'+encodeURIComponent(id));if(g!==refreshGeneration)return;const images=Array.isArray(e.evidence_paths)?e.evidence_paths:[];
 showDetail(`<span class="eyebrow">${esc(e.event_code)}</span><h2>${esc(e.event_name)}</h2><p>${esc(e.description||'')}</p><p>${esc(fmt(e.start_time,true))} · Video offset ${e.video_offset_sec==null?'unavailable':esc(e.video_offset_sec)+'s'}</p><p>${badge(e.alert_level)} ${badge(e.status)}</p><div class="evidence-grid">${(images.length?images:[null]).map((p,i)=>{const url=e.snapshot+(p?'?image='+encodeURIComponent(p):'');return `<button class="evidence-thumb" data-image="${esc(url)}"><img src="${esc(url)}" alt="${['Start','Peak','End'][i]||'Event'} evidence"><span>${['Start','Peak','End'][i]||'Evidence'}</span></button>`;}).join('')}</div><ol>${steps.map(s=>`<li>${esc(fmt(s.step_time))} — ${esc(s.description)}</li>`).join('')}</ol><div class="action-row"><button class="btn btn-primary" data-watch="${esc(e.id)}">Watch detection</button><button class="btn btn-secondary" data-review="${esc(e.id)}">Mark reviewed</button></div>`);
}
async function openAlert(id){const g=refreshGeneration;const {alert:a}=await api('/api/alerts/'+encodeURIComponent(id));if(g!==refreshGeneration)return;showDetail(`<h2>${esc(a.alert_title)}</h2><p>${esc(fmt(a.alert_time,true))}</p><p>${badge(a.alert_level)} ${badge(a.is_acknowledged?'Resolved':'Open')}</p><div class="action-row"><button class="btn btn-primary" data-ack="${esc(a.id)}" data-ack-value="${!a.is_acknowledged}">${a.is_acknowledged?'Reopen':'Acknowledge'}</button>${a.event_id?view(a.event_id):''}</div>`);}
const ruleDescriptions=[['Person entry & restricted areas','Identify people and activity inside configured monitoring zones.'],['Object tracking','Maintain person/vehicle identities across observed frames.'],['Person–vehicle proximity','Flag configured proximity between people and vehicles.'],['Vehicle interaction/contact','Highlight observed interaction cues for review.'],['Loitering & repeated movement','Identify configured dwell time and repeated movement patterns.'],['Vehicle movement & departure','Detect movement/departure based on observed track history.'],['Gathering','Flag configured multi-person gatherings.'],['Parking','Assess configured parking and stationary-vehicle conditions.'],['Time-based activity','Apply time windows only when the recording clock is known.']];
function renderRules(){$('#rule-catalog').innerHTML=ruleDescriptions.map(([n,d])=>`<article><h3>${n}</h3><p>${d}</p></article>`).join('');$('#rule-status').innerHTML=state.rules.length?state.rules.map(r=>`<p>${badge(r.enabled?'Reported enabled':'Reported disabled')} ${esc(r.name)} · ${esc(r.window)}</p>`).join(''):'<p>No rule configuration has been synced from Python yet.</p>';}
async function systemInfo(){const {system:s}=await api('/api/system');$('#system-details').innerHTML=`<dt>System</dt><dd>${esc(s.name)}</dd><dt>Company</dt><dd>${esc(s.company)}</dd><dt>Assigned devices</dt><dd>${esc(state.devices.join(', ')||'None — contact company')}</dd>`;$('#retention-note').textContent=s.retention;$('#team-details').innerHTML=`<h3>${esc(s.company)}</h3>`+(s.team.length?'<ul>'+s.team.map(n=>`<li>${esc(n)}</li>`).join('')+'</ul>':'<p class="text-muted">Team member names will be added by the company.</p>');}
async function logout(){try{await window.sentraDisableNotifications?.();}catch{}try{await post('/api/auth/logout',{});location.replace('/login');}catch(e){announce('Logout could not complete. '+e.message);}}
function bind(){
 const reset=document.createElement('button');reset.id='reset-dashboard';reset.type='button';reset.className='btn btn-secondary';reset.textContent='Reset dashboard';reset.style.cssText='min-height:44px;margin:4px;white-space:normal';
 $('#resume-live').before(reset);reset.onclick=async()=>{if(await confirmAction({title:'Reset dashboard?',message:'Clear the current workspace? Saved history, recordings and your video count will remain.',confirmLabel:'Reset dashboard'}))resetWorkspace();};

 window.addEventListener('hashchange',route);document.addEventListener('click',async e=>{const b=e.target.closest('button,[data-navigate]');if(!b)return;try{
 if(b.dataset.navigate)location.hash=b.dataset.navigate;
 if(b.dataset.event)await openEvent(b.dataset.event);
 if(b.dataset.alert)await openAlert(b.dataset.alert);
 if(b.dataset.timeline)timelinePreview(state.timeline[Number(b.dataset.timeline)]);
 if(b.dataset.report)downloadReport(b.dataset.report);
 if(b.dataset.image){$('#evidence-full').src=b.dataset.image;$('#image-dialog').showModal();}
 if(b.dataset.loadSource)await setSource(b.dataset.loadSource);
 if(b.dataset.review){await post('/api/events/'+b.dataset.review,{status:'Reviewed'},'PATCH');$('#detail-dialog').close();await refreshData();}
 if(b.dataset.ack){await post('/api/alerts/'+b.dataset.ack,{acknowledged:b.dataset.ackValue==='true'},'PATCH');$('#detail-dialog').close();await refreshData();}
 if(b.dataset.watch){const g=refreshGeneration;const {event:v}=await api('/api/events/'+b.dataset.watch);if(g!==refreshGeneration)return;if(state.source!==v.video_source_id)await setSource(v.video_source_id);$('#detail-dialog').close();location.hash='video-search';document.dispatchEvent(new CustomEvent('sentra:watch',{detail:{eventId:v.id}}));}
 }catch(err){announce(err.message);}});
 $('#detail-close').onclick=()=>$('#detail-dialog').close();$('#image-close').onclick=()=>$('#image-dialog').close();
 for(const id of ['searchBtn','applyFiltersBtn'])$('#'+id).onclick=renderTables;
 $('#resetBtn').onclick=()=>{$('#mainSearch').value='';$('#dateRange').value='';$('#eventType').value='';$('#statusFilter').value='';renderTables();};
 $('#btn-apply-filters').onclick=renderAlerts;$('#btn-reset-filters').onclick=()=>{$('#date-filter').value='';$('#time-filter').value='';$('#severity-filter').selectedIndex=0;$('#status-filter').selectedIndex=0;renderAlerts();};
 $$('[data-page="event-timeline"] .filter-select').forEach(e=>e.addEventListener('change',renderTimeline));
 $('#history-search').oninput=renderHistory;$('#resume-live').onclick=()=>setSource(null).catch(e=>announce(e.message));
 $('#settings-logout').onclick=logout;$('#generate-report-btn').onclick=()=>{renderReports();announce('Reports reflect the currently loaded recording scope.');};
 $$('#reports-tabs button').forEach(b=>b.onclick=()=>{$$('#reports-tabs button').forEach(x=>x.classList.toggle('active',x===b));renderReports(b.dataset.filter||'all');});
 $('#newInvestigationBtn').onclick=()=>{location.hash='cctv-events';announce('Open an event to review its evidence and mark it reviewed.');};
 $('#profile-form').onsubmit=async e=>{e.preventDefault();try{const d=await post('/api/profile',{name:$('#profile-name').value,timezone:$('#profile-timezone').value},'PATCH');state.user=d.user;profileUI();await refreshData();await loadHistory();$('#profile-result').textContent='Profile saved.';}catch(err){$('#profile-result').textContent=err.message;}};
 $('#password-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);if(f.get('password')!==f.get('confirm')){$('#password-result').textContent='New passwords do not match.';return;}try{await post('/api/profile/password',{currentPassword:f.get('currentPassword'),password:f.get('password')});location.replace('/login?changed=1');}catch(err){$('#password-result').textContent=err.message;}};
}
async function pollAlerts(){
 if(!state.user)return;
 try{const q=feedCursor?'?cursor='+encodeURIComponent(feedCursor.time)+'&last='+feedCursor.id:'';const d=await api('/api/alerts/feed'+q);
 for(const a of d.alerts){if(feedStarted&&!seen.has(a.id)){
 announce(`${a.alert_level}: ${a.alert_title}`);document.dispatchEvent(new CustomEvent('sentra:alert',{detail:a}));
 if(!state.workspaceReset&&!state.source&&!state.alerts.some(x=>x.id===a.id)){state.alerts.unshift({id:a.id,code:'New alert',time:fmt(a.alert_time),name:a.alert_title,severity:a.alert_level,status:a.is_acknowledged?'Resolved':'Open',date:new Intl.DateTimeFormat('en-CA',{timeZone:state.tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(a.alert_time)),eventId:a.event_id,camera:''});renderAlerts();}
 }seen.add(a.id);}
 feedStarted=true;if(d.cursor)feedCursor=d.cursor;feedFailures=0;
 if(seen.size>10000){const keep=[...seen].slice(-5000);seen.clear();keep.forEach(x=>seen.add(x));}
 }catch{feedFailures++;$('#sync-label').textContent='Live alert connection interrupted; retrying…';}
 setTimeout(pollAlerts,Math.min(30000,1000*2**Math.min(feedFailures,5)));
}
(async()=>{try{
 const me=await api('/api/auth/me');state.user=me.user;state.devices=me.devices;shell();bind();resetDates();try{state.workspaceReset=sessionStorage.getItem(resetStorageKey())==='1';}catch{}await loadHistory();if(state.workspaceReset)resetWorkspace(false);else await refreshData();await systemInfo();$('.app-shell').hidden=false;route();
 document.dispatchEvent(new CustomEvent('sentra:ready'));
 setInterval(()=>refreshData().then(loadHistory).catch(()=>{}),60000);pollAlerts();
 setInterval(()=>{const now=new Date();$('#currentDate').textContent=new Intl.DateTimeFormat('en',{dateStyle:'medium',timeZone:state.tz}).format(now);$('#currentTime').textContent=fmt(now);},1000);
 }catch(e){$('.app-shell').hidden=false;error(e.message);}})();

})();
