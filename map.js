/* ---------- Map setup ---------- */
const map = L.map('map', { zoomControl:true }).setView([42.5, 12.5], 5); // starts on Italy

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom:19
}).addTo(map);

function pinIcon(variant){
  const cls = variant===true ? 'temp' : (variant || '');
  const html = `<div class="pin${cls?' '+cls:''}">
    <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="#C1372F"/>
      <circle cx="15" cy="15" r="6" fill="#F6F3EB"/>
    </svg></div>`;
  return L.divIcon({ html, className:'', iconSize:[30,40], iconAnchor:[15,40], popupAnchor:[0,-38] });
}

function typeArray(type){
  if(Array.isArray(type)) return type;
  return type ? [type] : [];
}
function typeIncludes(type, t){ return typeArray(type).includes(t); }
function typeLabelOne(t){ return t==='multipitch' ? 'Multipitch' : 'Crag'; }
function typeLabel(type){
  const arr = typeArray(type);
  return (arr.length ? arr : ['crag']).map(typeLabelOne).join(', ');
}

function popupHTML(c){
  const hasParking = c.parkingLat!==undefined && c.parkingLng!==undefined;
  const hasVisits = c.visits && c.visits.length > 0;
  const rows = [
    ['type', typeLabel(c.type)],
    ['coords', `${(+c.lat).toFixed(4)}, ${(+c.lng).toFixed(4)}`],
    c.rock && ['rock', c.rock],
    c.exposition && ['exposition', expositionLabel(c.exposition)],
    hasParking && ['parking', `${(+c.parkingLat).toFixed(4)}, ${(+c.parkingLng).toFixed(4)}`],
    c.sectors && c.sectors.length && ['sectors', c.sectors.join(', ')],
    c.multipitchRoutes && c.multipitchRoutes.length && ['multipitch routes', c.multipitchRoutes.map(r => r.name).filter(Boolean).join(', ')]
  ].filter(Boolean).map(([k,v]) => `<div class="row"><span>${k}</span><span>${esc(v)}</span></div>`).join('');
  return `<div class="pop">
    <h3>${esc(c.name)}</h3>
    ${rows}
    ${c.description ? `<div class="description">${esc(c.description)}</div>` : ''}
    <div class="pop-actions">
      ${hasVisits ? `<button type="button" class="btn-view-visits-popup">View visits (${c.visits.length})</button>` : ''}
      <button type="button" class="btn-add-visit-popup">+ Add visit</button>
      <button type="button" class="btn-edit-popup">Edit</button>
    </div>
    ${c.link ? `<a href="${esc(c.link)}" target="_blank" rel="noopener">Open guide ↗</a>` : ''}
  </div>`;
}
function esc(s){ return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function noop(){}

function expositionArray(exposition){
  if(Array.isArray(exposition)) return exposition;
  return exposition ? [exposition] : [];
}
function expositionLabel(exposition){
  return expositionArray(exposition).join(', ');
}

function downloadCragsFile(){
  const header = `/* =====================================================================\n   YOUR CRAGS — edit this list. Each entry is one place you've climbed.\n   Only name + lat + lng are required; the rest are optional flavour.\n   ===================================================================== */\n`;
  const peopleHeader = `\n/* People you've climbed with. Adding someone new in the "Add a visit" form\n   appends them here too — remember to re-download crags.js afterwards. */\n`;
  const content = header + `const CRAGS = ${JSON.stringify(CRAGS, null, 2)};\n`
    + peopleHeader + `const PEOPLE = ${JSON.stringify(PEOPLE, null, 2)};\n`;
  const blob = new Blob([content], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'crags.js';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  const btn = document.getElementById('downloadBtn');
  btn.textContent = 'Downloaded ✓';
  setTimeout(() => { btn.textContent = '⬇ Download crags.js'; }, 1600);
}
document.getElementById('downloadBtn').addEventListener('click', downloadCragsFile);

let markers = [];
let listMode = 'places';
let multipitchSubMarkers = [];

function clearMultipitchSubMarkers(){
  multipitchSubMarkers.forEach(m => map.removeLayer(m));
  multipitchSubMarkers = [];
}

function showMultipitchRoutePins(c){
  clearMultipitchSubMarkers();
  const routes = (c.multipitchRoutes || []).filter(r => r.lat!==undefined && r.lng!==undefined);
  if(!routes.length) return;
  routes.forEach(r => {
    const marker = L.marker([r.lat, r.lng], { icon:pinIcon('route') }).addTo(map);
    marker.bindPopup(`<div class="pop"><h3>${esc(r.name || 'Multipitch route')}</h3><div class="row"><span>part of</span><span>${esc(c.name)}</span></div></div>`);
    marker.on('click', e => L.DomEvent.stopPropagation(e));
    multipitchSubMarkers.push(marker);
  });
  const bounds = L.latLngBounds([[c.lat, c.lng], ...routes.map(r => [r.lat, r.lng])]);
  map.fitBounds(bounds, { padding:[60,60], maxZoom:16 });
}
map.on('click', () => clearMultipitchSubMarkers());

function render(filter=""){
  markers.forEach(m => map.removeLayer(m.marker));
  markers = [];
  clearMultipitchSubMarkers();
  const f = filter.trim().toLowerCase();

  const pinCrags = (listMode === 'visits')
    ? CRAGS
    : CRAGS.filter(c => !f || [c.name, c.rock, expositionLabel(c.exposition)].some(v => v && v.toLowerCase().includes(f)));

  pinCrags.forEach(c => {
    const marker = L.marker([c.lat, c.lng], { icon:pinIcon() }).addTo(map).bindPopup(popupHTML(c));
    if(typeIncludes(c.type, 'multipitch')){
      marker.on('click', e => { L.DomEvent.stopPropagation(e); showMultipitchRoutePins(c); });
    }
    markers.push({ marker, crag:c });
  });

  if(listMode === 'visits') renderVisitsList(f);
  else renderPlacesList(pinCrags);

  updateStats();
}

function renderPlacesList(shown){
  const listEl = document.getElementById('list');
  listEl.innerHTML = "";

  shown.forEach((c) => {
    const marker = markers.find(m => m.crag === c).marker;
    const card = document.createElement('div');
    card.className = 'card'; card.tabIndex = 0;
    card.innerHTML = `<h3>${esc(c.name)}</h3>
      <div class="meta">
        ${(typeArray(c.type).length ? typeArray(c.type) : ['crag']).map(t => `<span class="tagpill">${esc(typeLabelOne(t))}</span>`).join('')}
        ${c.rock?`<span class="tagpill">${esc(c.rock)}</span>`:''}
        ${c.exposition?`<span class="tagpill">${esc(expositionLabel(c.exposition))}</span>`:''}
        ${c.sectors&&c.sectors.length?`<span class="tagpill">${c.sectors.length} sector${c.sectors.length>1?'s':''}</span>`:''}
        ${c.visits&&c.visits.length?`<span class="tagpill">${c.visits.length} visit${c.visits.length>1?'s':''}</span>`:''}
      </div>
      <div class="card-actions">
        ${c.visits&&c.visits.length?`<button type="button" class="btn-view-visits-card">View visits</button>`:''}
        <button type="button" class="btn-add-visit-card">+ Add visit</button>
        <button type="button" class="btn-edit-card">Edit</button>
      </div>`;
    const go = () => {
      marker.openPopup();
      if(typeIncludes(c.type, 'multipitch')) showMultipitchRoutePins(c);
      else map.flyTo([c.lat,c.lng], 12, {duration:.8});
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); }});
    card.querySelector('.btn-add-visit-card').addEventListener('click', e => { e.stopPropagation(); openVisitModal(c); });
    card.querySelector('.btn-view-visits-card')?.addEventListener('click', e => { e.stopPropagation(); openVisitsView(c); });
    card.querySelector('.btn-edit-card').addEventListener('click', e => { e.stopPropagation(); openEditModal(c); });
    listEl.appendChild(card);
  });

  document.getElementById('list-count').textContent = shown.length;
}

function renderVisitsList(f){
  const listEl = document.getElementById('list');
  listEl.innerHTML = "";

  const allVisits = [];
  CRAGS.forEach(c => (c.visits||[]).forEach((v, i) => allVisits.push({ crag:c, visit:v, index:i })));
  allVisits.sort((a,b) => (b.visit.date||'').localeCompare(a.visit.date||''));

  const personFilter = document.getElementById('personFilter').value;
  const shown = allVisits.filter(({crag:c, visit:v}) => {
    if(personFilter && !(v.with||[]).includes(personFilter)) return false;
    if(!f) return true;
    const routeText = (v.routes||[]).map(r => [r.name,r.grade,r.sector,r.comment].filter(Boolean).join(' ')).join(' ');
    const haystack = [c.name, (v.with||[]).join(' '), v.summary, routeText].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(f);
  });

  shown.forEach(({crag:c, visit:v, index}) => {
    const routeGrades = (v.routes||[]).map(r => r.grade).filter(Boolean);
    const visitSectors = [...new Set((v.routes||[]).map(r => r.sector).filter(Boolean))];
    const card = document.createElement('div');
    card.className = 'card'; card.tabIndex = 0;
    card.innerHTML = `<h3>${esc(c.name)}</h3>
      <div class="meta">
        ${v.date?`<span class="tagpill mono">${esc(v.date)}</span>`:''}
        ${v.with&&v.with.length?`<span class="tagpill">with ${esc(v.with.join(', '))}</span>`:''}
        ${routeGrades.length?`<span class="tagpill">${routeGrades.length} route${routeGrades.length>1?'s':''}</span>`:''}
        ${visitSectors.length?`<span class="tagpill">${esc(visitSectors.join(', '))}</span>`:''}
      </div>
      ${v.summary?`<div class="visit-card-summary">${esc(v.summary)}</div>`:''}`;
    const go = () => {
      const entry = markers.find(m => m.crag === c);
      entry?.marker.openPopup();
      if(typeIncludes(c.type, 'multipitch')) showMultipitchRoutePins(c);
      else map.flyTo([c.lat,c.lng], 12, {duration:.8});
      openVisitsView(c, index);
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); }});
    listEl.appendChild(card);
  });

  document.getElementById('list-count').textContent = shown.length;
}

document.querySelectorAll('.list-mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if(listMode === tab.dataset.mode) return;
    listMode = tab.dataset.mode;
    document.querySelectorAll('.list-mode-tab').forEach(t => t.classList.toggle('active', t===tab));
    document.getElementById('list-head-label').textContent = listMode==='visits' ? 'Visits (chronological)' : 'Logbook';
    const searchInput = document.getElementById('search');
    searchInput.placeholder = listMode==='visits'
      ? 'Search by place, person, or route…' : 'Search by name or rock type…';
    searchInput.setAttribute('aria-label', listMode==='visits' ? 'Search visits' : 'Search places');
    document.getElementById('personFilterRow').style.display = listMode==='visits' ? '' : 'none';
    render(document.getElementById('search').value);
  });
});

function populatePersonFilterOptions(){
  const select = document.getElementById('personFilter');
  const current = select.value;
  select.innerHTML = '<option value="">Everyone</option>' +
    PEOPLE.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  if(PEOPLE.includes(current)) select.value = current;
}
populatePersonFilterOptions();
document.getElementById('personFilter').addEventListener('change', () => render(document.getElementById('search').value));

function updateStats(){
  document.getElementById('stat-total').textContent = CRAGS.length;
  document.getElementById('stat-crags').textContent = CRAGS.filter(c => !typeIncludes(c.type,'multipitch') || typeIncludes(c.type,'crag')).length;
  document.getElementById('stat-multipitch').textContent = CRAGS.filter(c => typeIncludes(c.type,'multipitch')).length;
}

document.getElementById('search').addEventListener('input', e => render(e.target.value));

map.on('popupopen', e => {
  const el = e.popup.getElement();
  if(!el) return;
  const entry = markers.find(m => m.marker === e.popup._source);
  if(!entry) return;

  const addBtn = el.querySelector('.btn-add-visit-popup');
  if(addBtn && !addBtn.dataset.bound){
    addBtn.dataset.bound = '1';
    addBtn.addEventListener('click', () => openVisitModal(entry.crag));
  }
  const viewBtn = el.querySelector('.btn-view-visits-popup');
  if(viewBtn && !viewBtn.dataset.bound){
    viewBtn.dataset.bound = '1';
    viewBtn.addEventListener('click', () => openVisitsView(entry.crag));
  }
  const editBtn = el.querySelector('.btn-edit-popup');
  if(editBtn && !editBtn.dataset.bound){
    editBtn.dataset.bound = '1';
    editBtn.addEventListener('click', () => openEditModal(entry.crag));
  }
});
