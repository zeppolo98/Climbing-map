/* ---------- Add-crag flow ---------- */
const addBtn = document.getElementById('addBtn');
const toast  = document.getElementById('toast');
const overlay= document.getElementById('overlay');
const form   = document.getElementById('cragForm');
let armed = false, tempMarker = null, editingCrag = null;

function resetModalToAddMode(){
  editingCrag = null;
  document.getElementById('modalTitle').textContent = 'Log a place';
  document.getElementById('dropBtn').textContent = 'Drop on map';
  document.getElementById('deleteCragBtn').style.display = 'none';
}

function openEditModal(crag){
  closePicker(); closeVisitModal(); closeVisitsView();
  editingCrag = crag;
  document.getElementById('modalTitle').textContent = 'Edit place';
  document.getElementById('dropBtn').textContent = 'Save changes';
  document.getElementById('deleteCragBtn').style.display = '';
  form.type.value = crag.type || 'crag';
  form.name.value = crag.name || '';
  form.lat.value = crag.lat;
  form.lng.value = crag.lng;
  form.parkingCoords.value = (crag.parkingLat!==undefined && crag.parkingLng!==undefined)
    ? `${crag.parkingLat}, ${crag.parkingLng}` : '';
  form.rock.value = crag.rock || '';
  const selectedExposition = expositionArray(crag.exposition);
  form.querySelectorAll('input[name="exposition"]').forEach(cb => cb.checked = selectedExposition.includes(cb.value));
  form.description.value = crag.description || '';
  form.link.value = crag.link || '';
  fillSectorsList(sectorsList, crag.sectors, onSectorsChanged);
  fillVisitsList(visitsList, crag.visits, noop, () => collectSectors(sectorsList), (crag.type || 'crag') === 'multipitch');
  if(tempMarker){ map.removeLayer(tempMarker); tempMarker = null; }
  syncTempMarker(crag.lat, crag.lng);
  overlay.classList.add('show');
  form.name.focus();
}

function arm(on){
  armed = on;
  addBtn.classList.toggle('armed', on);
  addBtn.textContent = on ? '✕ Cancel' : '+ Add a crag';
  toast.classList.toggle('show', on);
  map.getContainer().style.cursor = on ? 'crosshair' : '';
}
addBtn.addEventListener('click', () => { closePicker(); arm(!armed); });
document.addEventListener('keydown', e => { if(e.key==='Escape'){ arm(false); closePicker(); closeVisitsView(); }});

map.on('click', e => {
  if(!armed) return;
  arm(false);
  form.reset();
  resetModalToAddMode();
  fillSectorsList(sectorsList, [], onSectorsChanged);
  resetVisits(visitsList, noop, () => collectSectors(sectorsList), form.type.value === 'multipitch');
  form.lat.value = e.latlng.lat.toFixed(4);
  form.lng.value = e.latlng.lng.toFixed(4);
  syncTempMarker();
  overlay.classList.add('show');
  form.name.focus();
});

const coordPicker   = document.getElementById('coordPicker');
const pickerInput   = document.getElementById('pickerCoords');
const pickerHint    = document.getElementById('pickerHint');
const pickerNextBtn = document.getElementById('pickerNextBtn');
let pickerCoord = null;

function openPicker(){
  closeModal();
  arm(false);
  pickerInput.value = '';
  pickerHint.textContent = '';
  pickerCoord = null;
  pickerNextBtn.disabled = true;
  if(tempMarker){ map.removeLayer(tempMarker); tempMarker = null; }
  coordPicker.classList.add('show');
  pickerInput.focus();
}
function closePicker(){
  coordPicker.classList.remove('show');
  if(tempMarker){ map.removeLayer(tempMarker); tempMarker = null; }
}
document.getElementById('addByCoordsBtn').addEventListener('click', openPicker);
document.getElementById('coordPickerClose').addEventListener('click', closePicker);

pickerInput.addEventListener('input', () => {
  pickerCoord = parseCoordinates(pickerInput.value);
  pickerNextBtn.disabled = !pickerCoord;
  pickerHint.textContent = (!pickerCoord && pickerInput.value.trim())
    ? "Couldn't read that as one coordinate — mixing decimal degrees with minutes/seconds is ambiguous. Use either decimal (46.076245, 9.435389) or DMS (46°04'34.5\"N 9°26'07.4\"E), not both."
    : '';
  if(pickerCoord) syncTempMarker(pickerCoord.lat, pickerCoord.lng);
});

pickerNextBtn.addEventListener('click', () => {
  if(!pickerCoord) return;
  coordPicker.classList.remove('show');
  form.reset();
  resetModalToAddMode();
  fillSectorsList(sectorsList, [], onSectorsChanged);
  resetVisits(visitsList, noop, () => collectSectors(sectorsList), form.type.value === 'multipitch');
  form.lat.value = pickerCoord.lat.toFixed(6);
  form.lng.value = pickerCoord.lng.toFixed(6);
  overlay.classList.add('show');
  form.name.focus();
});

function syncTempMarker(lat, lng){
  if(lat===undefined || lng===undefined){
    lat = parseFloat(form.lat.value);
    lng = parseFloat(form.lng.value);
  }
  if(isNaN(lat) || isNaN(lng)) return;
  const latlng = [lat, lng];
  if(tempMarker){
    tempMarker.setLatLng(latlng);
    map.panTo(latlng);
  } else {
    tempMarker = L.marker(latlng, { icon:pinIcon(true) }).addTo(map);
    map.flyTo(latlng, Math.max(map.getZoom(), 11), { duration:.6 });
  }
}

function parseCoordinates(str){
  str = (str || '').trim();
  if(!str) return null;

  // Decimal pair: "46.076245, 9.435389" / "46.076245 9.435389" / "46.076245N, 9.435389E"
  let m = str.match(/^(-?\d+(?:\.\d+)?)\s*°?\s*([NSns])?\s*[,;\s]+\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EWew])?$/);
  if(m){
    let lat = parseFloat(m[1]), lng = parseFloat(m[3]);
    if(m[2] && /s/i.test(m[2])) lat = -Math.abs(lat);
    if(m[4] && /w/i.test(m[4])) lng = -Math.abs(lng);
    if(Math.abs(lat)<=90 && Math.abs(lng)<=180) return { lat, lng };
  }

  // DMS: "46°04'34.5"N 9°26'07.4"E" (minutes/seconds optional, order-independent).
  // Degrees must be a whole number when minutes/seconds are present — a decimal
  // degree value (e.g. "46.076245°") is already a complete coordinate on its own,
  // so combining it with extra minutes/seconds is ambiguous and gets rejected
  // rather than silently double-counted into the wrong spot.
  const dmsRe = /(\d+(?:\.\d+)?)\s*°\s*(?:(\d+(?:\.\d+)?)\s*['′]\s*)?(?:(\d+(?:\.\d+)?)\s*["″]\s*)?\s*([NSEWnsew])/g;
  const matches = [...str.matchAll(dmsRe)];
  if(matches.length >= 2){
    let lat = null, lng = null;
    for(const mm of matches){
      const hasMinSec = mm[2] !== undefined || mm[3] !== undefined;
      if(mm[1].includes('.') && hasMinSec) return null;
      const deg = parseFloat(mm[1]) || 0;
      const min = parseFloat(mm[2]) || 0;
      const sec = parseFloat(mm[3]) || 0;
      const hemi = mm[4].toUpperCase();
      let val = deg + min/60 + sec/3600;
      if(hemi==='S' || hemi==='W') val = -val;
      if(hemi==='N' || hemi==='S') lat = val; else lng = val;
    }
    if(lat!==null && lng!==null) return { lat, lng };
  }
  return null;
}

/* ---------- Sectors ---------- */
const sectorsList = document.getElementById('sectorsList');

function sectorOptionsHTML(sectors){
  return ['<option value="">— sector —</option>']
    .concat((sectors||[]).map(s => `<option value="${esc(s)}">${esc(s)}</option>`))
    .join('');
}

function makeSectorRow(onChange){
  const row = document.createElement('div');
  row.className = 'sector-row';
  row.innerHTML = `
    <input type="text" class="sector-name" placeholder="Sector name" />
    <button type="button" aria-label="Remove sector">×</button>`;
  row.querySelector('button').addEventListener('click', () => { row.remove(); onChange(); });
  row.querySelector('.sector-name').addEventListener('input', onChange);
  return row;
}

function fillSectorsList(container, sectors, onChange){
  container.innerHTML = '';
  (sectors || []).forEach(s => {
    const row = makeSectorRow(onChange);
    row.querySelector('.sector-name').value = s;
    container.appendChild(row);
  });
}

function collectSectors(container){
  return [...container.querySelectorAll('.sector-name')].map(i => i.value.trim()).filter(Boolean);
}

function onSectorsChanged(){
  refreshSectorOptions(visitsList, collectSectors(sectorsList));
}

function refreshSectorOptions(container, sectors){
  container.querySelectorAll('.route-sector').forEach(select => {
    const current = select.value;
    select.innerHTML = sectorOptionsHTML(sectors);
    if(sectors.includes(current)) select.value = current;
  });
}

document.getElementById('addSectorBtn').addEventListener('click', () => {
  sectorsList.appendChild(makeSectorRow(onSectorsChanged));
  onSectorsChanged();
});

function readForm(){
  const g = n => form[n].value.trim();
  const parking = parseCoordinates(g('parkingCoords'));
  const visits = collectVisits(visitsList);
  const exposition = [...form.querySelectorAll('input[name="exposition"]:checked')].map(cb => cb.value);
  const sectors = collectSectors(sectorsList);
  const o = { type:g('type'), name:g('name'),
              lat:parseFloat(g('lat')), lng:parseFloat(g('lng')),
              parkingLat: parking ? parking.lat : undefined,
              parkingLng: parking ? parking.lng : undefined,
              rock:g('rock'), exposition: exposition.length ? exposition : undefined,
              description:g('description'), link:g('link'),
              sectors: sectors.length ? sectors : undefined,
              visits: visits.length ? visits : undefined };
  Object.keys(o).forEach(k => (o[k]===''||o[k]===undefined) && delete o[k]);
  return o;
}
form.addEventListener('input', e => {
  if(e.target.name === 'lat' || e.target.name === 'lng') syncTempMarker();
});

document.getElementById('dropBtn').addEventListener('click', () => {
  const o = readForm();
  if(!o.name || isNaN(o.lat) || isNaN(o.lng)){ alert('Need at least a name and coordinates.'); return; }
  if(editingCrag){
    Object.keys(editingCrag).forEach(k => delete editingCrag[k]);
    Object.assign(editingCrag, o);
  } else {
    CRAGS.push(o);
  }
  if(tempMarker){ map.removeLayer(tempMarker); tempMarker = null; }
  render(document.getElementById('search').value);
  closeModal();
});

document.getElementById('deleteCragBtn').addEventListener('click', () => {
  if(!editingCrag) return;
  if(!confirm(`Delete "${editingCrag.name}" and all its visits? This can't be undone (unless you skip downloading crags.js after).`)) return;
  const idx = CRAGS.indexOf(editingCrag);
  if(idx !== -1) CRAGS.splice(idx, 1);
  closeModal();
  render(document.getElementById('search').value);
});

function closeModal(){
  overlay.classList.remove('show');
  if(tempMarker){ map.removeLayer(tempMarker); tempMarker = null; }
  editingCrag = null;
}
document.getElementById('cancelBtn').addEventListener('click', closeModal);
