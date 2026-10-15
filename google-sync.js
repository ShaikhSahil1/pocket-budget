(() => {
  const panel = document.createElement('article');
  panel.className = 'panel cloud-panel';
  panel.innerHTML = `<div class="panel-heading"><div><h3>Google Sheets backup & sync</h3><span id="cloud-status" role="status">Local only · Connect Google to load or save online.</span></div><button id="cloud-settings">⚙ Settings</button></div><div class="cloud-actions"><button id="cloud-connect">Connect Google</button><button id="cloud-load" disabled>Load from Google</button><button id="cloud-save" disabled>Save to Google</button><button id="cloud-disconnect" disabled>Disconnect</button><button id="json-export">Download full backup</button><label class="import-label">Restore backup<input type="file" id="json-import" accept=".json,application/json"></label></div><p>Manual sync: load before editing on another device, then save when finished. Saving uploads all months. Use one device at a time.</p>`;
  document.querySelector('.stats').before(panel);
  const dialog = document.createElement('dialog');
  dialog.innerHTML = `<form id="cloud-config-form"><div class="modal-heading"><h2>Storage settings</h2><button type="button" id="cloud-close">×</button></div><p>Use your own OAuth web client and a private spreadsheet. No API key or client secret is needed.</p><label>OAuth Client ID<input id="cloud-client" required placeholder="…apps.googleusercontent.com"></label><label>Spreadsheet URL or ID<input id="cloud-sheet" required></label><p>Authorized JavaScript origin: <strong id="cloud-origin"></strong></p><p>The app creates a PocketData tab. Do not edit that tab manually.</p><div class="setup-steps">1. Save details → 2. Connect → 3. Check → 4. Load</div><div id="settings-status" class="settings-status" role="status">Enter your Google details to get started.</div><div class="settings-buttons"><button class="primary">Save settings</button><button type="button" id="settings-connect">Connect Google</button><button type="button" id="settings-test" disabled>Check connection</button><button type="button" id="settings-load" disabled>Load data & open dashboard</button></div><p>On a new, empty spreadsheet, open the dashboard and use Save to Google for your first upload. Local saving works without Google.</p><button type="button" id="settings-local">Continue with local data</button></form>`;
  document.body.append(dialog);
  let config = {}, token = '', expires = 0, baseline, busy = false, localSnapshot = '';
  try {config = JSON.parse(localStorage.getItem('pocket-google-config')) || {}} catch {}
  const status = msg => { $('cloud-status').textContent = msg; $('settings-status').textContent = msg; };
  const snapshot = () => JSON.stringify(data);
  function controls(){const connected=!!token&&Date.now()<expires; ['cloud-load','cloud-save','cloud-disconnect','settings-test','settings-load'].forEach(id=>$(id).disabled=busy||!connected);$('cloud-connect').disabled=busy;$('settings-connect').disabled=busy;$('cloud-close').disabled=busy;$('settings-local').disabled=busy;$('cloud-settings').disabled=busy}
  function disconnect(){token='';expires=0;baseline=undefined;controls();status('Disconnected · Data remains saved on this device.');}
  async function api(path='',options={}) {
    if(!token||Date.now()>=expires){disconnect();throw Error('Google session expired. Connect Google again.');}
    const res=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(config.sheet)+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}});
    const body=await res.json();
    if(!res.ok){if(res.status===401)disconnect();throw Error(body.error?.message||'Google request failed ('+res.status+').');}
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
  $('cloud-settings').onclick=()=>{$('cloud-client').value=config.client||'';$('cloud-sheet').value=config.sheet||'';$('cloud-origin').textContent=location.origin;status(token?'Connected · Check connection, then load your data.':'Save your details, then connect Google.');dialog.showModal()};
  $('cloud-close').onclick=()=>dialog.close();
  $('cloud-config-form').onsubmit=e=>{e.preventDefault();const client=$('cloud-client').value.trim(),raw=$('cloud-sheet').value.trim(),sheet=raw.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1]||raw;if(!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(client)||!/^[-\w]+$/.test(sheet)){toast('Enter a valid Client ID and spreadsheet URL or ID.');return}try{localStorage.setItem('pocket-google-config',JSON.stringify({client,sheet}));config={client,sheet};disconnect();status('Settings saved · Click Connect Google next.');toast('Settings saved. Now connect Google.')}catch{toast('Could not save connection settings.')}};
  $('cloud-connect').onclick=()=>{
    if(!config.client||!config.sheet){$('cloud-settings').click();return}
    if(!window.google?.accounts?.oauth2){status('Google sign-in is still loading or blocked. Check your internet connection and retry.');return}
    const client=google.accounts.oauth2.initTokenClient({client_id:config.client,scope:'https://www.googleapis.com/auth/spreadsheets',callback:r=>{if(r.error){status('Authorization failed: '+r.error);return}token=r.access_token;expires=Date.now()+Number(r.expires_in)*1000-30000;baseline=undefined;controls();status('Connected · Load cloud data, or save this device’s data to Google.');setTimeout(controls,Math.max(0,expires-Date.now()));},error_callback:e=>status('Google authorization closed or blocked: '+e.type)});
    client.requestAccessToken({prompt:'select_account'});
  };
  $('settings-connect').onclick=()=>{if($('cloud-client').value.trim()!==config.client||($('cloud-sheet').value.trim().match(/\/spreadsheets\/d\/([\w-]+)/)?.[1]||$('cloud-sheet').value.trim())!==config.sheet){status('Save your edited settings before connecting.');return} $('cloud-connect').click()};
  $('settings-test').onclick=()=>run(async()=>{status('Checking spreadsheet access…');await api(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[]})});const raw=await readCloud();status(raw===null?'Connection works · Spreadsheet is writable and empty. Continue to the dashboard, then Save to Google.':'Connection works · Read and write access confirmed. Click Load data & open dashboard.');});
  $('settings-load').onclick=async()=>{await $('cloud-load').onclick();if($('cloud-status').textContent.startsWith('Loaded from Google'))dialog.close()};
  $('settings-local').onclick=()=>dialog.close();
  $('cloud-disconnect').onclick=disconnect;
  $('cloud-load').onclick=()=>run(async()=>{status('Reading Google Sheets…');const raw=await readCloud();if(raw===null){baseline=null;status('Spreadsheet is empty · Save to Google to upload this device’s data.');return}if(!confirm('Replace all months on this device with the Google backup? Download a full backup first if you want to keep local-only changes.')){status('Load cancelled.');return}const next=validate(JSON.parse(raw));localStorage.setItem('pocket-v1',JSON.stringify(next));data=next;$('currency').value=data.currency;render();baseline=raw;localSnapshot=snapshot();status('Loaded from Google · '+new Date().toLocaleTimeString());});
  $('cloud-save').onclick=()=>run(async()=>{status('Checking Google Sheets…');const current=await readCloud();if(baseline!==undefined&&current!==baseline)throw Error('Cloud data changed on another device. Download your local backup, then load cloud data before saving.');if(baseline===undefined&&current!==null&&!confirm('Google already has data. Replace ALL its months with this device’s data? Cancel and choose Load from Google to keep the cloud version.')){status('Upload cancelled.');return}if(current===null&&!confirm('Upload all monthly balances and expenses from this device to Google Sheets?')){status('Upload cancelled.');return}const raw=snapshot();validate(JSON.parse(raw));let meta=await api('?fields=sheets.properties.title');if(!meta.sheets?.some(s=>s.properties.title==='PocketData'))await api(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{addSheet:{properties:{title:'PocketData'}}}]})});const values=[['pocket-backup-v1'],...(raw.match(/[\s\S]{1,30000}/g)||['']).map(s=>[s])];const oldRows=current===null?1:1+Math.ceil(current.length/30000);while(values.length<oldRows)values.push(['']);await api('/values/'+encodeURIComponent("'PocketData'!A1")+'?valueInputOption=RAW',{method:'PUT',body:JSON.stringify({values})});baseline=raw;localSnapshot=raw;status('Saved to Google · '+new Date().toLocaleTimeString());});
  $('json-export').onclick=()=>{const url=URL.createObjectURL(new Blob([snapshot()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='pocket-full-backup-'+localDate(new Date())+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  $('json-import').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>10000000)throw Error('Backup file is too large.');const next=validate(JSON.parse(await file.text()));if(!confirm('Replace all local months with this backup?'))return;localStorage.setItem('pocket-v1',JSON.stringify(next));data=next;$('currency').value=data.currency;render();status('Backup restored locally · Save to Google when ready.');toast('Backup restored')}catch(err){toast(err.message)}finally{e.target.value=''}};
  const originalPersist=persist;persist=function(){const ok=originalPersist();if(ok)status('Saved on this device · Changes have not been uploaded. Click Save to Google.');return ok};
  window.addEventListener('beforeunload',e=>{if(token&&localSnapshot!==snapshot()){e.preventDefault();e.returnValue=''}});
  controls();
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onerror=()=>status('Google sign-in could not load. Local saving still works.');document.head.append(script);
})();
