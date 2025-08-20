/* Team Roster PWA - Admin + Viewer
   Storage: localStorage for draft; shareable read-only link encodes roster JSON in URL hash.
   Premium gate: free up to 15 employees.
*/
const PREMIUM_LIMIT = 15;
const STATE_KEY = 'trp_state_v1';
const ROLE_KEY = 'trp_role_v1';

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const state = {
  employees: [],       // {id,name,role}
  patterns: [],        // {id,name,time}
  weekStartISO: startOfWeek(new Date()).toISOString(),
  assignments: {},     // {employeeId: {isoDate: patternId}}
  premium: false
};

function uid(){ return Math.random().toString(36).slice(2,9) }

function startOfWeek(d){
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun..6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start
  x.setDate(x.getDate() + diff);
  x.setHours(0,0,0,0);
  return x;
}
function fmtDate(d){ return d.toISOString().slice(0,10) }
function load(){
  const raw = localStorage.getItem(STATE_KEY);
  if(raw){
    try{
      const saved = JSON.parse(raw);
      Object.assign(state, saved);
    }catch(e){ console.warn('bad state', e) }
  }else{
    // onboarding defaults (endowment effect)
    state.employees = [
      {id:uid(), name:'Alex', role:'Supervisor'},
      {id:uid(), name:'Sam', role:'Cashier'},
      {id:uid(), name:'Riley', role:'Stock'}
    ];
    state.patterns = [
      {id:uid(), name:'Early', time:'08:00–16:00'},
      {id:uid(), name:'Late', time:'12:00–20:00'},
      {id:uid(), name:'Off', time:'—'}
    ];
  }
  const role = localStorage.getItem(ROLE_KEY) || 'admin';
  $('#roleSelect').value = role;
}
function save(){
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  updateProgress();
}
function setRole(r){
  localStorage.setItem(ROLE_KEY, r);
  document.body.dataset.role = r;
  const isViewer = r === 'viewer' || location.hash.startsWith('#view=');
  $('#adminPanel').style.display = isViewer ? 'none' : '';
  $('#viewerInfo').hidden = !isViewer;
}
function render(){
  // header week label
  const ws = new Date(state.weekStartISO);
  $('#weekLabel span').textContent = ws.toDateString();
  // table head
  const thead = $('#rosterTable thead');
  thead.innerHTML = '';
  const trh = document.createElement('tr');
  trh.innerHTML = '<th>Employee</th>';
  for(let i=0;i<7;i++){
    const d=new Date(ws); d.setDate(d.getDate()+i);
    const th = document.createElement('th');
    th.textContent = d.toLocaleDateString(undefined,{weekday:'short', day:'numeric'});
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  // body
  const tbody = $('#rosterTable tbody');
  tbody.innerHTML='';
  state.employees.forEach(emp=>{
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    name.innerHTML = '<div class="row"><strong>'+escapeHtml(emp.name)+'</strong><span class="pill">'+escapeHtml(emp.role||'')+'</span></div>';
    tr.appendChild(name);
    for(let i=0;i<7;i++){
      const d=new Date(ws); d.setDate(d.getDate()+i);
      const iso=fmtDate(d);
      const td=document.createElement('td');
      const assign = (state.assignments[emp.id]||{})[iso];
      const pat = state.patterns.find(p=>p.id===assign);
      td.textContent = pat ? pat.name : '—';
      if(document.body.dataset.role!=='viewer'){
        td.tabIndex=0;
        td.addEventListener('click', ()=>choosePattern(emp.id, iso, td));
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  renderEmployees();
  renderPatterns();
  updatePremiumBanner();
  updateProgress();
}
function renderEmployees(){
  const ul=$('#employeeList'); ul.innerHTML='';
  state.employees.forEach(emp=>{
    const li=document.createElement('li');
    li.innerHTML = '<span><strong>'+escapeHtml(emp.name)+'</strong> <span class="pill">'+escapeHtml(emp.role||'')+'</span></span>';
    const del=document.createElement('button'); del.className='btn ghost tiny'; del.textContent='Remove';
    del.onclick=()=>{ state.employees = state.employees.filter(e=>e.id!==emp.id); save(); render(); };
    li.appendChild(del);
    ul.appendChild(li);
  });
}
function renderPatterns(){
  const ul=$('#patternList'); ul.innerHTML='';
  state.patterns.forEach(p=>{
    const li=document.createElement('li');
    li.innerHTML = '<span><strong>'+escapeHtml(p.name)+'</strong> <span class="pill">'+escapeHtml(p.time)+'</span></span>';
    const del=document.createElement('button'); del.className='btn ghost tiny'; del.textContent='Remove';
    del.onclick=()=>{ state.patterns = state.patterns.filter(x=>x.id!==p.id); save(); render(); };
    ul.appendChild(li);
  });
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])) }

function choosePattern(empId, iso, cell){
  // Modal selector
  const dlg = $('#modal'); $('#modalTitle').textContent='Assign pattern';
  const body = $('#modalBody'); body.innerHTML='';
  state.patterns.forEach(p=>{
    const b=document.createElement('button');
    b.className='btn ghost'; b.style.margin='4px'; b.textContent=p.name+' ('+p.time+')';
    b.onclick=()=>{ 
      state.assignments[empId] = state.assignments[empId]||{};
      state.assignments[empId][iso]=p.id; save(); render(); dlg.close(); 
    };
    body.appendChild(b);
  });
  dlg.showModal();
}

function updatePremiumBanner(){
  const over = state.employees.length > PREMIUM_LIMIT && !state.premium;
  $('#premiumNotice').hidden = !over;
}
function updateProgress(){
  // very rough "setup" progress meter
  let score = 0;
  if(state.employees.length>=3) score+=40;
  if(state.patterns.length>=3) score+=30;
  if(Object.keys(state.assignments).length>0) score+=30;
  $('#progressBar').style.width = Math.min(100, score)+'%';
}

// Week nav
$('#prevWeek').onclick=()=>{ const d=new Date(state.weekStartISO); d.setDate(d.getDate()-7); state.weekStartISO=d.toISOString(); save(); render(); }
$('#nextWeek').onclick=()=>{ const d=new Date(state.weekStartISO); d.setDate(d.getDate()+7); state.weekStartISO=d.toISOString(); save(); render(); }
$('#todayWeek').onclick=()=>{ state.weekStartISO=startOfWeek(new Date()).toISOString(); save(); render(); }

// Forms
$('#addEmployeeForm').addEventListener('submit', e=>{
  e.preventDefault();
  const name = $('#empName').value.trim();
  const role = $('#empRole').value.trim();
  if(!name) return;
  if(state.employees.length >= PREMIUM_LIMIT && !state.premium){
    updatePremiumBanner();
    toast('Free plan limit reached. Upgrade to add more than '+PREMIUM_LIMIT+'.');
    return;
  }
  state.employees.push({id:uid(), name, role});
  $('#empName').value=''; $('#empRole').value='';
  save(); render();
});
$('#addPatternForm').addEventListener('submit', e=>{
  e.preventDefault();
  const name=$('#patName').value.trim(); const time=$('#patTime').value.trim();
  if(!name||!time) return;
  state.patterns.push({id:uid(), name, time});
  $('#patName').value=''; $('#patTime').value='';
  save(); render();
});

// Role handling
$('#roleSelect').addEventListener('change', e=>{ setRole(e.target.value); render(); });

// Menu
$('#menuBtn').onclick=()=>{
  const m=$('#menuList');
  const open=m.hasAttribute('hidden')?false:true;
  if(open){ m.setAttribute('hidden',''); $('#menuBtn').setAttribute('aria-expanded','false'); }
  else { m.removeAttribute('hidden'); $('#menuBtn').setAttribute('aria-expanded','true'); }
};
document.addEventListener('click', e=>{
  if(!e.target.closest('.menu')) $('#menuList').setAttribute('hidden','');
});

$('#btnPrint').onclick=()=>{ window.print() };

$('#btnShare').onclick=()=>{
  const link = buildViewLink();
  const text = encodeURIComponent('Team rota: '+link);
  const url = 'https://wa.me/?text='+text;
  if(navigator.share){
    navigator.share({title:'Team rota', text:'Team rota', url:link}).catch(()=>window.open(url,'_blank'));
  }else{
    window.open(url,'_blank');
  }
};

$('#btnDownload').onclick=()=>{
  // Use print-to-PDF with clean print styles
  window.print();
};

$('#btnExport').onclick=()=>{
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  downloadURL(url, 'team-roster.json');
};

$('#btnImport').onclick=()=>{
  const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json';
  inp.onchange=()=>{
    const f=inp.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        const s=JSON.parse(rd.result);
        Object.assign(state, s);
        save(); render();
        toast('Import successful');
      }catch(e){ alert('Invalid JSON'); }
    };
    rd.readAsText(f);
  };
  inp.click();
};

$('#btnShareLink').onclick=()=>{
  const link = buildViewLink();
  navigator.clipboard.writeText(link).then(()=>toast('View link copied'));
};

$('#publishBtn').onclick=()=>{
  const link = buildViewLink();
  showModal('Publish viewer link', '<p>Share this read‑only link with your team:</p><p><code>'+escapeHtml(link)+'</code></p>');
};

function buildViewLink(){
  // Build read-only link with encoded JSON
  const view = {
    employees: state.employees,
    patterns: state.patterns,
    weekStartISO: state.weekStartISO,
    assignments: state.assignments
  };
  const json = JSON.stringify(view);
  const encoded = btoa(unescape(encodeURIComponent(json))); // base64
  const url = location.origin + location.pathname + '#view=' + encoded;
  return url;
}

function initViewerFromHash(){
  if(location.hash.startsWith('#view=')){
    const encoded = location.hash.slice(6);
    try{
      const json = decodeURIComponent(escape(atob(encoded)));
      const view = JSON.parse(json);
      // Replace state but lock editing
      state.employees = view.employees||[];
      state.patterns = view.patterns||[];
      state.weekStartISO = view.weekStartISO || startOfWeek(new Date()).toISOString();
      state.assignments = view.assignments||{};
      document.body.dataset.role='viewer';
      $('#roleSelect').value='viewer';
      $('#viewerInfo').hidden=false;
    }catch(e){
      console.warn('Bad view link', e);
    }
  }
}

// Onboarding
$('#dismissOnboarding').onclick=()=>$('#onboarding').style.display='none';

// Toast
function toast(msg){
  let t = document.createElement('div');
  t.className='toast';
  t.textContent=msg;
  Object.assign(t.style,{position:'fixed',bottom:'20px',left:'50%',transform:'translateX(-50%)',background:'#0f172a',color:'white',padding:'10px 14px',border:'1px solid #223049',borderRadius:'10px',zIndex:9999});
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 2000);
}

// Modal helper
function showModal(title, html){
  const dlg=$('#modal');
  $('#modalTitle').textContent=title;
  $('#modalBody').innerHTML=html;
  dlg.showModal();
}

// PWA install + offline
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt=e;
  $('#btnInstall').hidden=false;
});
$('#btnInstall').onclick=async()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  $('#btnInstall').hidden=true;
  deferredPrompt=null;
};

window.addEventListener('load', ()=>{
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js');
  }
  load();
  initViewerFromHash();
  setRole(localStorage.getItem(ROLE_KEY)||'admin');
  render();
  $('#year').textContent = new Date().getFullYear();
  updateOfflineBadge();
});

function updateOfflineBadge(){
  const badge=$('#offlineBadge');
  function sync(){ badge.hidden = navigator.onLine; }
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  sync();
}

function downloadURL(url, filename){
  const a=document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
}
