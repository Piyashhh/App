(() => {
  const $ = (id) => document.getElementById(id);

  const state = {
    rows: [],
    headers: [],
    currentIndex: -1,
    fileName: '',
    storageKey: '',
    audit: {},
    filter: 'all',
    search: ''
  };

  // Exact workbook schema, with a few safe fallbacks for future files.
  const COL = {
    code: ['Puja Code #', 'Puja Code', 'Puja ID'],
    name: ['Name of the Puja', 'Puja Name', 'Name'],
    club: ['Name of the Club', 'Club Name', 'Committee Name'],
    address: ['Address'],
    google: ['Google Maps URL', 'Google Maps Link', 'Google Map URL', 'Google Maps link'],
    d1lat: ['D1 Latitude'], d1lon: ['D1 Longitude'],
    d2lat: ['D2 Latitude'], d2lon: ['D2 Longitude'],
    d4lat: ['D4 Latitude'], d4lon: ['D4 Longitude'],
    d4google: ['D4 Gmaps Link', 'D4 Google Maps Link']
  };

  function findColumn(aliases) {
    const lower = state.headers.map(h => String(h).trim().toLowerCase());
    for (const alias of aliases) {
      const i = lower.indexOf(alias.toLowerCase());
      if (i >= 0) return state.headers[i];
    }
    return null;
  }

  function value(row, aliases) {
    const col = findColumn(aliases);
    return col ? row[col] : '';
  }

  function clean(v) {
    return v === null || v === undefined ? '' : String(v).trim();
  }

  function hasValue(v) {
    return clean(v) !== '';
  }

  function mapsFromCoords(lat, lon) {
    lat = clean(lat); lon = clean(lon);
    if (!lat || !lon) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat + ',' + lon)}`;
  }

  function stableKey(row, index) {
    const code = value(row, COL.code);
    if (hasValue(code)) return `code:${clean(code)}`;
    return `row:${index}|name:${clean(value(row, COL.name))}|address:${clean(value(row, COL.address))}`;
  }

  function candidatesFor(row) {
    const d1lat = value(row, COL.d1lat), d1lon = value(row, COL.d1lon);
    const d2lat = value(row, COL.d2lat), d2lon = value(row, COL.d2lon);
    const d4lat = value(row, COL.d4lat), d4lon = value(row, COL.d4lon);

    return [
      { id: 'Google Maps', label: 'Google Maps', url: clean(value(row, COL.google)), detail: clean(value(row, COL.google)) },
      { id: 'D1', label: 'D1', url: mapsFromCoords(d1lat, d1lon), detail: (hasValue(d1lat) && hasValue(d1lon)) ? `${clean(d1lat)}, ${clean(d1lon)}` : 'No D1 latitude/longitude' },
      { id: 'D2', label: 'D2', url: mapsFromCoords(d2lat, d2lon), detail: (hasValue(d2lat) && hasValue(d2lon)) ? `${clean(d2lat)}, ${clean(d2lon)}` : 'No D2 latitude/longitude' },
      { id: 'D4', label: 'D4', url: clean(value(row, COL.d4google)) || mapsFromCoords(d4lat, d4lon), detail: clean(value(row, COL.d4google)) ? 'Existing D4 Google Maps link' : ((hasValue(d4lat) && hasValue(d4lon)) ? `${clean(d4lat)}, ${clean(d4lon)}` : 'No D4 latitude/longitude') }
    ];
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function loadAudit() {
    try { state.audit = JSON.parse(localStorage.getItem(state.storageKey) || '{}'); }
    catch { state.audit = {}; }
  }

  function saveAudit() {
    localStorage.setItem(state.storageKey, JSON.stringify(state.audit));
  }

  function auditFor(index) {
    return state.audit[stableKey(state.rows[index], index)] || {};
  }

  function setMessage(text) {
    $('savedNote').textContent = text;
  }

  function updateSummary() {
    const done = Object.values(state.audit).filter(a => a && a.status).length;
    const total = state.rows.length;
    $('count').textContent = `${done} / ${total} audited`;
    const existing = $('progressWrap');
    if (existing) existing.querySelector('.progress > div').style.width = `${total ? (done / total) * 100 : 0}%`;
  }

  function filteredIndices() {
    const q = state.search.toLowerCase();
    return state.rows.map((row, i) => ({ row, i })).filter(({row, i}) => {
      const audit = auditFor(i);
      const text = Object.values(row).map(clean).join(' ').toLowerCase();
      if (q && !text.includes(q)) return false;
      if (state.filter === 'open' && audit.status) return false;
      if (state.filter === 'done' && !audit.status) return false;
      if (state.filter === 'corrected' && audit.status !== 'corrected') return false;
      return true;
    });
  }

  function renderList() {
    const list = $('entryList');
    const items = filteredIndices();
    list.innerHTML = '';

    if (!state.rows.length) {
      list.innerHTML = '<div class="empty">No Excel file loaded.</div>';
      updateSummary();
      return;
    }
    if (!items.length) {
      list.innerHTML = '<div class="empty">No matching entries.</div>';
      updateSummary();
      return;
    }

    items.forEach(({row, i}) => {
      const audit = auditFor(i);
      const name = clean(value(row, COL.name)) || 'Unnamed entry';
      const sub = [clean(value(row, COL.club)), clean(value(row, COL.code))].filter(Boolean).join(' · ');
      const btn = document.createElement('button');
      btn.className = `entry${i === state.currentIndex ? ' active' : ''}${audit.status ? ' done' : ''}`;
      btn.type = 'button';
      btn.innerHTML = `<div class="entry-number">${i + 1}</div><div><div class="entry-title">${escapeHtml(name)}</div>${sub ? `<div class="entry-sub">${escapeHtml(sub)}</div>` : ''}${audit.status ? `<div class="entry-status">✓ ${escapeHtml(audit.source || audit.status)}</div>` : ''}</div>`;
      btn.addEventListener('click', () => openEntry(i));
      list.appendChild(btn);
    });
    updateSummary();
  }

  function renderCandidates(row, audit) {
    const candidates = candidatesFor(row);
    $('candidateGrid').innerHTML = '';
    $('candidateSelect').innerHTML = '<option value="">Choose a candidate…</option>';

    candidates.forEach(c => {
      const available = !!c.url;
      const card = document.createElement('div');
      card.className = `candidate ${available ? 'available' : 'unavailable'}`;
      card.innerHTML = `<div class="candidate-main"><div class="candidate-name">${escapeHtml(c.label)}</div><div class="candidate-detail">${escapeHtml(c.detail)}</div></div>`;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'button candidate-open';
      open.textContent = available ? 'Open in Maps' : 'Unavailable';
      open.disabled = !available;
      if (available) open.addEventListener('click', () => window.open(c.url, '_blank', 'noopener,noreferrer'));
      card.appendChild(open);
      $('candidateGrid').appendChild(card);

      const option = document.createElement('option');
      option.value = c.label;
      option.textContent = available ? c.label : `${c.label} — unavailable`;
      option.disabled = !available;
      $('candidateSelect').appendChild(option);
    });

    $('candidateSelect').value = audit.source && ['Google Maps','D1','D2','D4'].includes(audit.source) ? audit.source : '';
    $('correctedLink').value = audit.correctedLink || '';
    const mode = audit.correctedLink ? 'corrected' : 'candidate';
    document.querySelectorAll('input[name="decision"]').forEach(r => r.checked = r.value === mode);
    setDecisionMode(mode);
  }

  function setDecisionMode(mode) {
    $('candidateSelectWrap').hidden = mode !== 'candidate';
    $('correctedWrap').hidden = mode !== 'corrected';
  }

  function openEntry(index) {
    state.currentIndex = index;
    const row = state.rows[index];
    const audit = auditFor(index);
    $('emptyDetail').hidden = true;
    $('detail').hidden = false;

    $('entryCode').textContent = clean(value(row, COL.code)) ? `Entry ${index + 1} · ${clean(value(row, COL.code))}` : `Entry ${index + 1}`;
    $('entryName').textContent = clean(value(row, COL.name)) || 'Unnamed entry';
    $('entryClub').textContent = clean(value(row, COL.club));
    $('entryAddress').textContent = clean(value(row, COL.address));
    $('candidateSelect').value = '';
    $('correctedLink').value = '';
    renderCandidates(row, audit);
    $('prevBtn').disabled = index <= 0;
    $('nextBtn').disabled = index >= state.rows.length - 1;
    $('saveBtn').disabled = false;
    setMessage(audit.status ? `Saved locally · ${new Date(audit.timestamp).toLocaleString()}` : 'Not yet audited');
    renderList();
  }

  function saveDecision(moveNext) {
    if (state.currentIndex < 0) return;
    const mode = document.querySelector('input[name="decision"]:checked')?.value;
    const key = stableKey(state.rows[state.currentIndex], state.currentIndex);
    const audit = auditFor(state.currentIndex);

    if (mode === 'candidate') {
      const source = $('candidateSelect').value;
      if (!source) { alert('Select the correct candidate location.'); return; }
      audit.status = 'verified';
      audit.source = source;
      audit.correctedLink = '';
    } else if (mode === 'corrected') {
      const corrected = $('correctedLink').value.trim();
      if (!corrected) { alert('Enter the correct Google Maps link.'); return; }
      audit.status = 'corrected';
      audit.source = 'Corrected link';
      audit.correctedLink = corrected;
    } else {
      alert('Choose a candidate or the corrected-link option.');
      return;
    }

    audit.timestamp = new Date().toISOString();
    state.audit[key] = audit;
    saveAudit();
    renderList();
    setMessage('Saved locally ✓');
    updateSummary();

    if (moveNext) {
      let next = -1;
      for (let i = state.currentIndex + 1; i < state.rows.length; i++) if (!auditFor(i).status) { next = i; break; }
      if (next < 0) for (let i = 0; i < state.rows.length; i++) if (!auditFor(i).status) { next = i; break; }
      if (next >= 0) openEntry(next);
      else alert('All entries are audited. Export the audited Excel.');
    }
  }

  function exportExcel() {
    if (!state.rows.length) return;
    const out = state.rows.map((row, i) => {
      const x = {...row};
      const a = auditFor(i);
      const candidates = candidatesFor(row);
      const chosen = candidates.find(c => c.label === a.source);
      x['Verified Location Source'] = a.source || '';
      x['Verified Google Maps Link'] = a.correctedLink || chosen?.url || '';
      x['Location Verification Status'] = a.status || '';
      x['Location Verified At'] = a.timestamp || '';
      return x;
    });
    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audited');
    const base = state.fileName.replace(/\.[^.]+$/, '');
    XLSX.writeFile(wb, `${base} - audited.xlsx`);
  }

  function clearAudit() {
    if (!state.storageKey || !confirm('Delete saved audit progress for this workbook on this device?')) return;
    localStorage.removeItem(state.storageKey);
    state.audit = {};
    renderList();
    if (state.currentIndex >= 0) openEntry(state.currentIndex);
  }

  function setupProgressUI() {
    const tools = document.querySelector('.list-tools');
    const wrap = document.createElement('div');
    wrap.id = 'progressWrap';
    wrap.style.width = '100%';
    wrap.innerHTML = '<div class="progress"><div style="width:0%"></div></div>';
    tools.parentElement.insertBefore(wrap, $('entryList'));
  }

  $('fileInput').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    state.fileName = file.name;
    const reader = new FileReader();
    reader.onload = ev => {
      const workbook = XLSX.read(ev.target.result, {type:'array'});
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      state.rows = XLSX.utils.sheet_to_json(worksheet, {defval:''});
      state.headers = state.rows.length ? Object.keys(state.rows[0]) : [];
      state.currentIndex = -1;
      state.storageKey = `puja-location-auditor:v3:${state.fileName}:${state.rows.length}:${state.headers.join('|')}`;
      loadAudit();
      $('searchInput').disabled = false;
      $('exportBtn').disabled = false;
      $('fileInfo').textContent = `${state.fileName} · ${state.rows.length} entries`;
      renderList();
      $('emptyDetail').hidden = false;
      $('detail').hidden = true;
    };
    reader.readAsArrayBuffer(file);
  });

  $('searchInput').addEventListener('input', e => { state.search = e.target.value; renderList(); });
  $('exportBtn').addEventListener('click', exportExcel);
  $('prevBtn').addEventListener('click', () => { if (state.currentIndex > 0) openEntry(state.currentIndex - 1); });
  $('nextBtn').addEventListener('click', () => { if (state.currentIndex < state.rows.length - 1) openEntry(state.currentIndex + 1); });
  $('saveBtn').addEventListener('click', () => saveDecision(false));
  document.querySelectorAll('input[name="decision"]').forEach(r => r.addEventListener('change', e => setDecisionMode(e.target.value)));

  setupProgressUI();
})();
