(() => {
  const panel = document.createElement('article');
  panel.className = 'panel cloud-panel';
  panel.innerHTML = `<div class="panel-heading"><div><h3>Google Sheets backup & sync</h3><span id="cloud-status" role="status">Local only · Connect Google to load or save online.</span></div><button id="cloud-settings">⚙ Settings</button></div><div class="cloud-actions"><button id="cloud-connect">Connect Google</button><button id="cloud-load" disabled>Load from Google</button><button id="cloud-save" disabled>Save to Google</button><button id="cloud-disconnect" disabled>Log out</button><button id="json-export">Download full backup</button><label class="import-label">Restore backup<input type="file" id="json-import" accept=".json,application/json"></label></div><p>Cloud data loads automatically after a refresh while your Google session is active. Saving uploads all months. Use one device at a time.</p>`;
  document.querySelector('.stats').before(panel);
  const dialog = document.createElement('dialog');
  dialog.innerHTML = `<form id="cloud-config-form"><div class="modal-heading"><h2>Storage settings</h2><button type="button" id="cloud-close">×</button></div><p>Google sign-in is protected by this site’s secure server. Choose the private spreadsheet used for your backup.</p><label>Spreadsheet URL or ID<input id="cloud-sheet" required></label><p>Authorized redirect URI: <strong id="cloud-origin"></strong></p><p>The app creates a PocketData tab. Do not edit that tab manually.</p><div class="setup-steps">1. Save sheet → 2. Connect Google → 3. Return here automatically</div><div id="settings-status" class="settings-status" role="status">Enter your spreadsheet details to get started.</div><div class="settings-buttons"><button class="primary">Save settings</button><button type="button" id="settings-connect">Connect Google</button><button type="button" id="settings-test" disabled>Check connection</button><button type="button" id="settings-load" disabled>Load data & open dashboard</button></div><p>On a new, empty spreadsheet, use Save to Google for your first upload. Local saving works without Google.</p><button type="button" id="settings-local">Continue with local data</button></form>`;
  document.body.append(dialog);
  let config = {}, token = '', expires = 0, baseline, busy = false, localSnapshot = '';
  try {config = JSON.parse(localStorage.getItem('pocket-google-config')) || {}} catch {}
  const status = msg => { $('cloud-status').textContent = msg; $('settings-status').textContent = msg; };
  const snapshot = () => JSON.stringify(data);
  function controls(){const connected=!!token&&Date.now()<expires; ['cloud-load','cloud-save','cloud-disconnect','settings-test','settings-load'].forEach(id=>$(id).disabled=busy||!connected);$('cloud-connect').disabled=busy;$('settings-connect').disabled=busy;$('cloud-close').disabled=busy;$('settings-local').disabled=busy;$('cloud-settings').disabled=busy}
  function disconnect(message='Disconnected · Data remains saved on this device.'){token='';expires=0;baseline=undefined;controls();status(message);}
  async function serverAuth(action) {
    const res=await fetch('/api/google-auth',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Requested-With':'XmlHttpRequest'},body:JSON.stringify({action})});
    let body={};try{body=await res.json()}catch{}
    if(!res.ok){const error=Error(body.error||'Google session request failed.');error.status=res.status;throw error}
    return body;
  }
  async function refreshAccessToken(){const auth=await serverAuth('refresh');token=auth.access_token;expires=Date.now()+Number(auth.expires_in)*1000-30000;controls();return token}
  async function api(path='',options={},retry=true) {
    if(!token||Date.now()>=expires)await refreshAccessToken();
    const res=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(config.sheet)+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}});
    const body=await res.json();
    if(res.status===401&&retry){token='';expires=0;await refreshAccessToken();return api(path,options,false)}
    if(!res.ok)throw Error(body.error?.message||'Google request failed ('+res.status+').');
    return body;
  }
  async function readCloud(){
    const meta=await api('?fields=sheets.properties.title');
    if(!meta.sheets?.some(s=>s.properties.title==='PocketData'))return null;
    const result=await api('/values/'+encodeURIComponent("'PocketData'!A:A")+'?valueRenderOption=UNFORMATTED_VALUE');
    if(!result.values?.length)return null;
    if(result.values[0][0]!=='pocket-backup-v1')throw Error('PocketData contains unrecognized data. Use a different blank spreadsheet.');
    const raw=result.values.slice(1).map(r=>r[0]||'').join('');
    validate(JSON.parse(raw));return raw;
  }
  function validate(d){
    if(!d||!['INR','USD','GBP','EUR'].includes(d.currency)||!d.balances||Array.isArray(d.balances)||typeof d.balances!=='object'||!Array.isArray(d.expenses))throw Error('Invalid Pocket backup.');
    for(const [m,n] of Object.entries(d.balances))if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)||!Number.isFinite(n)||n<0)throw Error('Invalid monthly balance.');
    const ids=new Set();for(const e of d.expenses){if(!e||typeof e.id!=='string'||ids.has(e.id)||typeof e.name!=='string'||typeof e.details!=='string'||!cats.includes(e.category)||!Number.isFinite(e.amount)||e.amount<=0||!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(e.date)||Number.isNaN(Date.parse(e.date))||typeof e.refundable!=='boolean'||typeof e.received!=='boolean')throw Error('Invalid expense in backup.');ids.add(e.id);}
    return d;
  }
  async function run(fn){if(busy)return;busy=true;controls();try{await fn()}catch(e){status('Not synced · '+e.message);toast(e.message)}finally{busy=false;controls()}}
  $('cloud-settings').onclick=()=>{$('cloud-sheet').value=config.sheet||'';$('cloud-origin').textContent=location.origin+'/api/google-auth';status(token?'Connected · Your session will be restored when you reopen this site.':'Save your spreadsheet, then connect Google.');dialog.showModal()};
  $('cloud-close').onclick=()=>dialog.close();
  $('cloud-config-form').onsubmit=e=>{e.preventDefault();const raw=$('cloud-sheet').value.trim(),sheet=raw.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1]||raw;if(!/^[-\w]+$/.test(sheet)){toast('Enter a valid spreadsheet URL or ID.');return}try{localStorage.setItem('pocket-google-config',JSON.stringify({sheet}));config={sheet};status('Settings saved · Click Connect Google next.');toast('Spreadsheet settings saved')}catch{toast('Could not save connection settings.')}};
  $('cloud-connect').onclick=()=>{
    if(!config.sheet){$('cloud-settings').click();return}
    location.assign('/api/google-auth?action=start');
  };
  $('settings-connect').onclick=()=>{if(($('cloud-sheet').value.trim().match(/\/spreadsheets\/d\/([\w-]+)/)?.[1]||$('cloud-sheet').value.trim())!==config.sheet){status('Save your edited spreadsheet before connecting.');return}$('cloud-connect').click()};
  $('settings-test').onclick=()=>run(async()=>{status('Checking spreadsheet access…');const marker='__pocket_write_access_test__';await api(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{findReplace:{find:marker,replacement:marker,allSheets:true,matchCase:true,matchEntireCell:true}}]})});const raw=await readCloud();status(raw===null?'Connection works · Spreadsheet is writable and empty. Continue to the dashboard, then Save to Google.':'Connection works · Read and write access confirmed. Click Load data & open dashboard.');});
  $('settings-load').onclick=async()=>{await $('cloud-load').onclick();if($('cloud-status').textContent.startsWith('Loaded from Google'))dialog.close()};
  $('settings-local').onclick=()=>dialog.close();
  $('cloud-disconnect').onclick=()=>run(async()=>{status('Logging out of Google sync…');await serverAuth('logout');disconnect('Logged out · Cloud data will not load until you connect again.');toast('Logged out of Google sync')});
  async function loadCloud(confirmReplace=true){status('Reading Google Sheets…');const raw=await readCloud();if(raw===null){baseline=null;localSnapshot=snapshot();status('Spreadsheet is empty · Save to Google to upload this device’s data.');return}if(confirmReplace&&!confirm('Replace all months on this device with the Google backup? Download a full backup first if you want to keep local-only changes.')){status('Load cancelled.');return}const next=validate(JSON.parse(raw));localStorage.setItem('pocket-v1',JSON.stringify(next));data=next;$('currency').value=data.currency;render();baseline=raw;localSnapshot=snapshot();status('Loaded from Google · '+new Date().toLocaleTimeString())}
  $('cloud-load').onclick=()=>run(()=>loadCloud(true));
  $('cloud-save').onclick=()=>run(async()=>{status('Checking Google Sheets…');const current=await readCloud();if(baseline!==undefined&&current!==baseline)throw Error('Cloud data changed on another device. Download your local backup, then load cloud data before saving.');if(baseline===undefined&&current!==null&&!confirm('Google already has data. Replace ALL its months with this device’s data? Cancel and choose Load from Google to keep the cloud version.')){status('Upload cancelled.');return}if(current===null&&!confirm('Upload all monthly balances and expenses from this device to Google Sheets?')){status('Upload cancelled.');return}const raw=snapshot();validate(JSON.parse(raw));let meta=await api('?fields=sheets.properties.title');if(!meta.sheets?.some(s=>s.properties.title==='PocketData'))await api(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{addSheet:{properties:{title:'PocketData'}}}]})});const values=[['pocket-backup-v1'],...(raw.match(/[\s\S]{1,30000}/g)||['']).map(s=>[s])];const oldRows=current===null?1:1+Math.ceil(current.length/30000);while(values.length<oldRows)values.push(['']);await api('/values/'+encodeURIComponent("'PocketData'!A1")+'?valueInputOption=RAW',{method:'PUT',body:JSON.stringify({values})});baseline=raw;localSnapshot=raw;status('Saved to Google · '+new Date().toLocaleTimeString());});
  $('json-export').onclick=()=>{const url=URL.createObjectURL(new Blob([snapshot()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='pocket-full-backup-'+localDate(new Date())+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  $('json-import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>10000000)throw Error('Backup file is too large.');const next=validate(JSON.parse(await file.text()));if(!confirm('Replace all local months with this backup?'))return;localStorage.setItem('pocket-v1',JSON.stringify(next));data=next;$('currency').value=data.currency;render();status('Backup restored locally · Save to Google when ready.');toast('Backup restored')}catch(err){toast(err.message)}finally{e.target.value=''}};
  const originalPersist=persist;persist=function(){const ok=originalPersist();if(ok)status('Saved on this device · Changes have not been uploaded. Click Save to Google.');return ok};
  window.addEventListener('beforeunload',e=>{if(token&&localSnapshot!==snapshot()){e.preventDefault();e.returnValue=''}});
  controls();
  (async()=>{try{status('Checking Google session…');await refreshAccessToken();await run(()=>loadCloud(false));const params=new URLSearchParams(location.search);if(params.has('google'))history.replaceState(null,'',location.pathname)}catch(e){if(e.status===401)status('Local only · Connect Google to load or save online.');else status('Google sync unavailable · '+e.message)}})();
})();
