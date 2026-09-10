/* ---------- Visits ---------- */
const visitsList = document.getElementById('visitsList');

function makeRouteRow(onChange, sectors){
  const row = document.createElement('div');
  row.className = 'route-row';
  row.innerHTML = `
    <input type="text" class="route-name" placeholder="Route name" />
    <input type="text" class="route-grade mono" placeholder="Grade" />
    <select class="route-sector">${sectorOptionsHTML(sectors)}</select>
    <input type="text" class="route-comment" placeholder="Comment" />
    <button type="button" aria-label="Remove route">×</button>`;
  row.querySelector('button').addEventListener('click', () => { row.remove(); onChange(); });
  return row;
}

function makeVisitBlock(onChange, getSectors, includeApproach){
  getSectors = getSectors || (() => []);
  const block = document.createElement('div');
  block.className = 'visit-block';
  block.innerHTML = `
    <div class="visit-head">
      <span class="visit-num"></span>
      <button type="button" aria-label="Remove visit">×</button>
    </div>
    <div class="visit-row">
      <input type="date" class="visit-date" />
    </div>
    <div class="visit-with-group">
      <div class="person-chip-list"></div>
      <div class="add-person-row">
        <input type="text" class="add-person-input" placeholder="+ add someone new" />
        <button type="button" class="add-person-btn">Add</button>
      </div>
    </div>
    <textarea class="visit-summary" placeholder="Summary of the visit (optional)"></textarea>
    ${includeApproach ? `
    <div class="visit-approach">
      <textarea class="visit-avvicinamento" placeholder="Avvicinamento — how to reach the start (optional)"></textarea>
      <textarea class="visit-discesa" placeholder="Discesa — how to get down (optional)"></textarea>
    </div>` : ''}
    <div class="routes-list"></div>
    <button type="button" class="btn-add-route">+ Add route</button>`;
  renderPersonChips(block, []);
  block.querySelector('.person-chip-list').addEventListener('change', onChange);
  const addInput = block.querySelector('.add-person-input');
  const addBtn = block.querySelector('.add-person-btn');
  const doAddPerson = () => { addNewPerson(addInput.value, block); addInput.value = ''; onChange(); };
  addBtn.addEventListener('click', doAddPerson);
  addInput.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); doAddPerson(); } });
  block.querySelector('.routes-list').appendChild(makeRouteRow(onChange, getSectors()));
  block.querySelector('.btn-add-route').addEventListener('click', () => {
    block.querySelector('.routes-list').appendChild(makeRouteRow(onChange, getSectors()));
    onChange();
  });
  block.querySelector('.visit-head button').addEventListener('click', () => {
    const container = block.parentElement;
    block.remove();
    renumberVisits(container);
    onChange();
  });
  return block;
}

function personChipMarkup(name, checked){
  return `<label class="person-chip"><input type="checkbox" value="${esc(name)}" ${checked?'checked':''}/>${esc(name)}</label>`;
}
function renderPersonChips(block, selected){
  block.querySelector('.person-chip-list').innerHTML = PEOPLE.map(name => personChipMarkup(name, selected.includes(name))).join('');
}
function getSelectedPeople(block){
  return [...block.querySelectorAll('.person-chip input:checked')].map(cb => cb.value);
}
function addNewPerson(rawName, currentBlock){
  const name = rawName.trim();
  if(name && !PEOPLE.includes(name)) PEOPLE.push(name);
  document.querySelectorAll('.visit-with-group').forEach(group => {
    const block = group.closest('.visit-block');
    const selected = getSelectedPeople(block);
    if(block === currentBlock && name && !selected.includes(name)) selected.push(name);
    renderPersonChips(block, selected);
  });
  populatePersonFilterOptions();
}

function renumberVisits(container){
  [...container.querySelectorAll('.visit-block')].forEach((b, i) => {
    b.querySelector('.visit-num').textContent = `Visit ${i+1}`;
  });
}

function fillVisitBlock(block, visit, onChange, getSectors){
  getSectors = getSectors || (() => []);
  const sectors = getSectors();
  block.querySelector('.visit-date').value = visit.date || '';
  renderPersonChips(block, visit.with || []);
  block.querySelector('.visit-summary').value = visit.summary || '';
  const avvicinamentoEl = block.querySelector('.visit-avvicinamento');
  if(avvicinamentoEl) avvicinamentoEl.value = visit.avvicinamento || '';
  const discesaEl = block.querySelector('.visit-discesa');
  if(discesaEl) discesaEl.value = visit.discesa || '';
  const routesList = block.querySelector('.routes-list');
  routesList.innerHTML = '';
  const routes = (visit.routes && visit.routes.length) ? visit.routes : [{}];
  routes.forEach(r => {
    const row = makeRouteRow(onChange, sectors);
    row.querySelector('.route-name').value = r.name || '';
    row.querySelector('.route-grade').value = r.grade || '';
    row.querySelector('.route-comment').value = r.comment || '';
    if(r.sector) row.querySelector('.route-sector').value = r.sector;
    routesList.appendChild(row);
  });
}

function fillVisitsList(container, visits, onChange, getSectors, includeApproach){
  container.innerHTML = '';
  const list = (visits && visits.length) ? visits : [{}];
  list.forEach(v => {
    const block = makeVisitBlock(onChange, getSectors, includeApproach);
    fillVisitBlock(block, v, onChange, getSectors);
    container.appendChild(block);
  });
  renumberVisits(container);
}

function resetVisits(container, onChange, getSectors, includeApproach){
  fillVisitsList(container, [], onChange, getSectors, includeApproach);
}

document.getElementById('addVisitBtn').addEventListener('click', () => {
  visitsList.appendChild(makeVisitBlock(noop, () => collectSectors(sectorsList), getSelectedTypes().includes('multipitch')));
  renumberVisits(visitsList);
});

document.getElementById('typeGroup').addEventListener('change', () => {
  const currentVisits = collectVisits(visitsList);
  fillVisitsList(visitsList, currentVisits, noop, () => collectSectors(sectorsList), getSelectedTypes().includes('multipitch'));
});

function collectVisits(container){
  return [...container.querySelectorAll('.visit-block')].map(block => {
    const date = block.querySelector('.visit-date').value.trim();
    const withPeople = getSelectedPeople(block);
    const summary = block.querySelector('.visit-summary').value.trim();
    const avvicinamento = block.querySelector('.visit-avvicinamento')?.value.trim() || '';
    const discesa = block.querySelector('.visit-discesa')?.value.trim() || '';
    const routes = [...block.querySelectorAll('.route-row')].map(row => {
      const name = row.querySelector('.route-name').value.trim();
      const grade = row.querySelector('.route-grade').value.trim();
      const sector = row.querySelector('.route-sector').value.trim();
      const comment = row.querySelector('.route-comment').value.trim();
      const r = {};
      if(name) r.name = name;
      if(grade) r.grade = grade;
      if(sector) r.sector = sector;
      if(comment) r.comment = comment;
      return r;
    }).filter(r => Object.keys(r).length > 0);

    const visit = {};
    if(date) visit.date = date;
    if(withPeople.length) visit.with = withPeople;
    if(summary) visit.summary = summary;
    if(avvicinamento) visit.avvicinamento = avvicinamento;
    if(discesa) visit.discesa = discesa;
    if(routes.length) visit.routes = routes;
    return visit;
  }).filter(v => Object.keys(v).length > 0);
}

/* ---------- Add-visit flow (for places already loaded from crags.js) ---------- */
const visitOverlay  = document.getElementById('visitOverlay');
const visitAddList  = document.getElementById('visitAddList');
const visitModalSub = document.getElementById('visitModalSub');
const addVisitBtn2  = document.getElementById('addVisitBtn2');
let visitTargetCrag = null, editingVisitIndex = null;

function openVisitModal(crag){
  closeModal(); closePicker();
  visitTargetCrag = crag;
  editingVisitIndex = null;
  document.getElementById('visitModalTitle').textContent = 'Add a visit';
  visitModalSub.textContent = `Add a visit to "${crag.name}". It'll be included next time you download crags.js.`
    + ((crag.sectors && crag.sectors.length) ? '' : ' No sectors defined yet — edit the place to add some.');
  resetVisits(visitAddList, noop, () => (visitTargetCrag && visitTargetCrag.sectors) || [], typeIncludes(crag.type, 'multipitch'));
  addVisitBtn2.style.display = '';
  visitOverlay.classList.add('show');
}
function openEditVisitModal(crag, index){
  closeModal(); closePicker(); closeVisitsView();
  visitTargetCrag = crag;
  editingVisitIndex = index;
  document.getElementById('visitModalTitle').textContent = 'Edit visit';
  visitModalSub.textContent = `Editing a visit to "${crag.name}".`;
  visitAddList.innerHTML = '';
  const getSectors = () => (visitTargetCrag && visitTargetCrag.sectors) || [];
  const block = makeVisitBlock(noop, getSectors, typeIncludes(crag.type, 'multipitch'));
  fillVisitBlock(block, crag.visits[index], noop, getSectors);
  visitAddList.appendChild(block);
  renumberVisits(visitAddList);
  addVisitBtn2.style.display = 'none';
  visitOverlay.classList.add('show');
}
function closeVisitModal(){
  visitOverlay.classList.remove('show');
  visitTargetCrag = null;
  editingVisitIndex = null;
}
addVisitBtn2.addEventListener('click', () => {
  visitAddList.appendChild(makeVisitBlock(noop, () => (visitTargetCrag && visitTargetCrag.sectors) || [], visitTargetCrag ? typeIncludes(visitTargetCrag.type, 'multipitch') : false));
  renumberVisits(visitAddList);
});
document.getElementById('saveVisitBtn').addEventListener('click', () => {
  const visits = collectVisits(visitAddList);
  if(!visits.length){ alert('Fill in at least a date, who you were with, or a route first.'); return; }
  if(editingVisitIndex !== null){
    visitTargetCrag.visits[editingVisitIndex] = visits[0];
  } else {
    visitTargetCrag.visits = (visitTargetCrag.visits || []).concat(visits);
  }
  closeVisitModal();
  render(document.getElementById('search').value);
});
document.getElementById('visitCloseBtn').addEventListener('click', closeVisitModal);

/* ---------- Visits browser (view/edit/delete per visit) ---------- */
const visitsViewOverlay = document.getElementById('visitsViewOverlay');
const visitsViewTitle   = document.getElementById('visitsViewTitle');
const visitsViewSub     = document.getElementById('visitsViewSub');
const visitsTabs        = document.getElementById('visitsTabs');
const visitDetail       = document.getElementById('visitDetail');
const visitDetailActions = document.querySelector('.visit-detail-actions');
let visitsViewCrag = null, visitsViewIndex = null;

function renderVisitDetail(v){
  const metaParts = [v.date, v.with && v.with.length && `with ${v.with.join(', ')}`].filter(Boolean);
  const meta = metaParts.length ? `<div class="visit-meta">${esc(metaParts.join(' · '))}</div>` : '';
  const summary = v.summary ? `<div class="description">${esc(v.summary)}</div>` : '';
  const approach = [
    v.avvicinamento && `<div class="description"><b>Avvicinamento:</b> ${esc(v.avvicinamento)}</div>`,
    v.discesa && `<div class="description"><b>Discesa:</b> ${esc(v.discesa)}</div>`
  ].filter(Boolean).join('');
  const routes = (v.routes||[]).map(r => {
    const bits = [r.sector && `<span class="mono">[${esc(r.sector)}]</span>`, r.name && `<b>${esc(r.name)}</b>`, r.grade && esc(r.grade), r.comment && esc(r.comment)].filter(Boolean);
    return `<li>${bits.join(' — ')}</li>`;
  }).join('');
  visitDetail.innerHTML = meta + summary + approach + (routes ? `<ul>${routes}</ul>` : '<div class="empty">No routes logged for this visit.</div>');
}

function openVisitsView(crag, targetIndex){
  closeModal(); closePicker(); closeVisitModal();
  visitsViewCrag = crag;
  visitsViewTitle.textContent = crag.name;
  const visits = crag.visits || [];
  visitsViewSub.textContent = `${visits.length} visit${visits.length===1?'':'s'} logged`;
  visitsTabs.innerHTML = '';
  visits.forEach((v, i) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'visit-tab';
    tab.textContent = v.date || `Visit ${i+1}`;
    tab.addEventListener('click', () => {
      [...visitsTabs.children].forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      visitsViewIndex = i;
      renderVisitDetail(v);
    });
    visitsTabs.appendChild(tab);
  });
  if(visits.length){
    const idx = (targetIndex!==undefined && targetIndex>=0 && targetIndex<visits.length) ? targetIndex : 0;
    visitsTabs.children[idx].classList.add('active');
    visitsViewIndex = idx;
    renderVisitDetail(visits[idx]);
    visitDetailActions.style.display = '';
  } else {
    visitsViewIndex = null;
    visitDetail.innerHTML = '<div class="empty">No visits logged yet.</div>';
    visitDetailActions.style.display = 'none';
  }
  visitsViewOverlay.classList.add('show');
}
function closeVisitsView(){
  visitsViewOverlay.classList.remove('show');
  visitsViewCrag = null;
  visitsViewIndex = null;
}
document.getElementById('editVisitBtn').addEventListener('click', () => {
  if(visitsViewCrag && visitsViewIndex !== null) openEditVisitModal(visitsViewCrag, visitsViewIndex);
});
document.getElementById('deleteVisitBtn').addEventListener('click', () => {
  if(!visitsViewCrag || visitsViewIndex === null) return;
  if(!confirm("Delete this visit? This can't be undone (unless you skip downloading crags.js after).")) return;
  visitsViewCrag.visits.splice(visitsViewIndex, 1);
  render(document.getElementById('search').value);
  if(visitsViewCrag.visits.length) openVisitsView(visitsViewCrag);
  else closeVisitsView();
});
document.getElementById('visitsViewCloseBtn').addEventListener('click', closeVisitsView);
visitsViewOverlay.addEventListener('click', e => { if(e.target===visitsViewOverlay) closeVisitsView(); });

/* ---------- Go ---------- */
resetVisits(visitsList, noop);
render();
