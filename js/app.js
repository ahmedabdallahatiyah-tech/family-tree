const GOOGLE_SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTAgb_bYt1XcaC6AKpvLPpbugHMP_VhijT1t3GUshhv4IvJRPT01g1_LzTYN26ey6x1XeZAFngeP2yM/pub?output=csv';
const DATA_FILE = 'data.json';
const DATA_TIMESTAMP_FILE = 'data-timestamp.json';
const REFRESH_INTERVAL = 300000;
const CACHE_KEY = 'familyTreeData';
const CACHE_TIME_KEY = 'familyTreeTime';

let treeData = null;
let currentScale = 1;
let currentTranslate = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0, tx: 0, ty: 0 };

async function loadData() {
  showStatus('جاري تحميل البيانات...', 'loading');
  try {
    const resp = await fetch(DATA_FILE + '?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const json = await resp.json();
    if (!json.name) throw new Error('بيانات غير صالحة');
    treeData = json;
    const total = countNodes(json);
    if (total < 5) throw new Error('البيانات غير مكتملة');
    cacheData(json);
    renderTree(json);
    updateStats(json);
    const ts = await fetchDataTimestamp();
    showStatus('✓ آخر تحديث: ' + (ts || new Date().toLocaleString('ar-SA')), 'success');
    return json;
  } catch (err) {
    console.warn('فشل تحميل data.json:', err);
    const cached = loadCached();
    if (cached) {
      treeData = cached;
      renderTree(cached);
      updateStats(cached);
      showStatus('📦 تم تحميل البيانات المخزنة', 'warning');
      return cached;
    }
    showStatus('⚠ فشل تحميل البيانات', 'error');
    return null;
  }
}

async function fetchDataTimestamp() {
  try {
    const resp = await fetch(DATA_TIMESTAMP_FILE + '?t=' + Date.now());
    if (resp.ok) {
      const json = await resp.json();
      return json.updated || null;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function cacheData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
  } catch (e) { /* quota exceeded */ }
}

function loadCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

async function refreshData() {
  await loadData();
}

function showStatus(msg, type) {
  const el = document.getElementById('statusBar');
  if (el) { el.textContent = msg; el.className = 'status-bar ' + (type || ''); }
}

function updateStats(root) {
  const total = countNodes(root);
  const maxDepth = getMaxDepth(root);
  const genLabels = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع'];
  document.getElementById('totalCount').textContent = total.toLocaleString('ar-SA');
  document.getElementById('generationCount').textContent = genLabels[maxDepth] || maxDepth;
}

function renderTree(root) {
  const container = document.getElementById('treeContainer');
  container.innerHTML = '';
  if (!root || !root.children || root.children.length === 0) {
    container.innerHTML = '<div class="empty-state">لا توجد بيانات لعرضها</div>';
    return;
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.display = 'block';

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <filter id="shadow1" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.15)"/>
    </filter>
    <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(212,160,23,0.12)"/>
      <stop offset="100%" stop-color="rgba(212,160,23,0)"/>
    </radialGradient>`;
  svg.appendChild(defs);

  const mainG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  mainG.setAttribute('id', 'mainGroup');
  svg.appendChild(mainG);

  const zoomG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  zoomG.setAttribute('id', 'zoomGroup');
  mainG.appendChild(zoomG);

  const vSpacing = 130, hSpacing = 180, r = 20, pad = 80;
  const totalDepth = getMaxDepth(root);

  function layout(n, x, y) {
    if (!n.children || n.children.length === 0) {
      n._x = x; n._y = y; return 1;
    }
    const counts = n.children.map(c => layout(c, x, y + vSpacing));
    const total = counts.reduce((a, b) => a + b, 0);
    let cx = x - (total - 1) * hSpacing / 2;
    n.children.forEach((c, i) => {
      c._x = cx + (counts[i] - 1) * hSpacing / 2;
      c._y = y + vSpacing;
      cx += counts[i] * hSpacing;
    });
    n._x = x; n._y = y;
    return total;
  }

  layout(root, (totalDepth + 1) * hSpacing / 2, pad);

  function draw(n, parentEl) {
    if (n === root && n.children.length > 0) {
      n.children.forEach(c => draw(c, parentEl));
      return;
    }
    if (n._parentX !== undefined && n._parentY !== undefined && n._parentY < n._y) {
      const line = makeLine(n);
      parentEl.appendChild(line);
    }
    const depth = n.depth || 0;
    const colors = ['#D4A017','#CD7F32','#4CAF50','#43A047','#388E3C','#2E7D32','#1B5E20','#0D3B0F'];
    const color = colors[Math.min(depth, colors.length - 1)];

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'node-group');
    g.setAttribute('data-id', n.id);
    g.setAttribute('transform', `translate(${n._x}, ${n._y})`);
    g.style.cursor = 'pointer';

    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    glow.setAttribute('r', (r + 8).toString());
    glow.setAttribute('fill', 'url(#glowGrad)');
    glow.setAttribute('opacity', '0');
    g.appendChild(glow);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('r', r.toString());
    bg.setAttribute('fill', '#FFFCF5');
    bg.setAttribute('stroke', color);
    bg.setAttribute('stroke-width', '2.5');
    bg.setAttribute('filter', 'url(#shadow1)');
    g.appendChild(bg);

    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    inner.setAttribute('r', '5');
    inner.setAttribute('fill', 'none');
    inner.setAttribute('stroke', color);
    inner.setAttribute('stroke-width', '1.5');
    inner.setAttribute('opacity', '0.5');
    g.appendChild(inner);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('dominant-baseline', 'central');
    txt.setAttribute('fill', '#3E2723');
    txt.setAttribute('font-size', depth <= 3 ? '11' : '10');
    txt.setAttribute('font-family', 'Traditional Arabic, Arial');
    txt.setAttribute('font-weight', depth <= 2 ? 'bold' : 'normal');
    txt.setAttribute('transform', `translate(0, ${r + 16})`);
    txt.textContent = n.name;
    g.appendChild(txt);

    if (n.children && n.children.length > 0) {
      const btn = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      btn.setAttribute('r', '8');
      btn.setAttribute('fill', color);
      btn.setAttribute('stroke', color);
      btn.setAttribute('opacity', '0.85');
      btn.setAttribute('filter', 'url(#shadow1)');
      btn.setAttribute('class', 'expand-btn');
      btn.setAttribute('transform', `translate(0, ${-r - 12})`);

      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      icon.setAttribute('text-anchor', 'middle');
      icon.setAttribute('dominant-baseline', 'central');
      icon.setAttribute('fill', '#FFFCF5');
      icon.setAttribute('font-size', '10');
      icon.setAttribute('font-weight', 'bold');
      icon.setAttribute('transform', `translate(0, ${-r - 12})`);
      icon.setAttribute('class', 'expand-icon');
      icon.textContent = '◀';

      g.appendChild(btn);
      g.appendChild(icon);
      g.classList.add('collapsible');
      g.dataset.expanded = 'true';
    }

    g.addEventListener('mouseenter', () => { glow.setAttribute('opacity', '1'); bg.setAttribute('stroke-width', '3.5'); });
    g.addEventListener('mouseleave', () => { glow.setAttribute('opacity', '0'); bg.setAttribute('stroke-width', '2.5'); });
    g.addEventListener('click', (e) => { e.stopPropagation(); toggleChildren(g, n); });

    parentEl.appendChild(g);
    n._svgGroup = g;
    if (n.children) n.children.forEach(c => draw(c, parentEl));
  }

  draw(root, zoomG);

  const bbox = zoomG.getBBox();
  const rect = container.getBoundingClientRect();
  const sx = rect.width / (bbox.width + 100);
  const sy = rect.height / (bbox.height + 100);
  currentScale = Math.min(sx, sy, 2);
  currentTranslate = {
    x: (rect.width - bbox.width * currentScale) / 2 - bbox.x * currentScale,
    y: (rect.height - bbox.height * currentScale) / 2 - bbox.y * currentScale
  };
  applyTransform();

  container.appendChild(svg);
  setupPanZoom(container);
}

function makeLine(n) {
  const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l.setAttribute('x1', n._parentX.toString());
  l.setAttribute('y1', n._parentY.toString());
  l.setAttribute('x2', n._x.toString());
  l.setAttribute('y2', n._y.toString());
  l.setAttribute('stroke', '#8D6E63');
  l.setAttribute('stroke-width', '2');
  l.setAttribute('opacity', '0.4');
  l.setAttribute('stroke-linecap', 'round');
  return l;
}

function toggleChildren(g, node) {
  const exp = g.dataset.expanded === 'true';
  g.dataset.expanded = exp ? 'false' : 'true';
  const icon = g.querySelector('.expand-icon');
  if (icon) icon.textContent = exp ? '▶' : '◀';
  const ids = new Set();
  collectIds(node, ids);
  ids.forEach(id => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.style.display = exp ? 'none' : '';
  });
}

function collectIds(node, set) {
  set.add(node.id);
  if (node.children) node.children.forEach(c => collectIds(c, set));
}

function applyTransform() {
  const g = document.getElementById('mainGroup');
  if (g) g.setAttribute('transform', `translate(${currentTranslate.x}, ${currentTranslate.y}) scale(${currentScale})`);
  updateZoomLabel();
}

function updateZoomLabel() {
  const el = document.getElementById('zoomLevel');
  if (el) el.textContent = Math.round(currentScale * 100) + '%';
}

function setupPanZoom(container) {
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const d = e.deltaY > 0 ? 0.9 : 1.1;
    const ns = Math.max(0.2, Math.min(5, currentScale * d));
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    currentTranslate.x = mx - (mx - currentTranslate.x) * (ns / currentScale);
    currentTranslate.y = my - (my - currentTranslate.y) * (ns / currentScale);
    currentScale = ns;
    applyTransform();
  }, { passive: false });

  container.addEventListener('mousedown', (e) => {
    if (e.target === container || e.target.tagName === 'svg') {
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY, tx: currentTranslate.x, ty: currentTranslate.y };
      container.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      currentTranslate.x = panStart.tx + (e.clientX - panStart.x);
      currentTranslate.y = panStart.ty + (e.clientY - panStart.y);
      applyTransform();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) { isPanning = false; container.style.cursor = 'grab'; }
  });

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isPanning = true;
      panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: currentTranslate.x, ty: currentTranslate.y };
    }
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (isPanning && e.touches.length === 1) {
      currentTranslate.x = panStart.tx + (e.touches[0].clientX - panStart.x);
      currentTranslate.y = panStart.ty + (e.touches[0].clientY - panStart.y);
      applyTransform();
    }
  }, { passive: true });

  container.addEventListener('touchend', () => { isPanning = false; }, { passive: true });
}

function zoomIn() { currentScale = Math.min(5, currentScale * 1.3); applyTransform(); }
function zoomOut() { currentScale = Math.max(0.2, currentScale * 0.7); applyTransform(); }

function resetZoom() {
  const g = document.getElementById('zoomGroup');
  const container = document.getElementById('treeContainer');
  if (!g || !container) return;
  const bbox = g.getBBox();
  const rect = container.getBoundingClientRect();
  const sx = rect.width / (bbox.width + 100), sy = rect.height / (bbox.height + 100);
  currentScale = Math.min(sx, sy, 2);
  currentTranslate = {
    x: (rect.width - bbox.width * currentScale) / 2 - bbox.x * currentScale,
    y: (rect.height - bbox.height * currentScale) / 2 - bbox.y * currentScale
  };
  applyTransform();
}

function performSearch() {
  const input = document.getElementById('searchInput');
  const term = input.value.trim();
  if (!term || !treeData) { if (treeData) renderTree(treeData); return; }
  const filtered = filterTree(treeData, term);
  if (filtered && filtered.children && filtered.children.length > 0) {
    renderTree(filtered);
    showStatus('🔍 نتائج البحث عن "' + term + '"', 'search');
  } else {
    showStatus('🔍 لا توجد نتائج لـ "' + term + '"', 'error');
  }
}

function exportData() {
  if (!treeData) return;
  const blob = new Blob([JSON.stringify(treeData, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'family-tree-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showStatus('✓ تم تصدير البيانات', 'success');
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

function init() {
  loadData();
  setInterval(loadData, REFRESH_INTERVAL);
  document.getElementById('refreshBtn').addEventListener('click', refreshData);
  document.getElementById('searchBtn').addEventListener('click', performSearch);
  document.getElementById('searchInput').addEventListener('keyup', (e) => { if (e.key === 'Enter') performSearch(); });
  document.getElementById('zoomInBtn').addEventListener('click', zoomIn);
  document.getElementById('zoomOutBtn').addEventListener('click', zoomOut);
  document.getElementById('resetBtn').addEventListener('click', resetZoom);
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
  window.addEventListener('resize', resetZoom);
}

document.addEventListener('DOMContentLoaded', init);
