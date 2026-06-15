const TREE_SVG_URL = 'tree.svg';
const DATA_FILE = 'data.json';
const REFRESH_MS = 300000;

let treeData = null;

function gid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n').filter(l => l.trim());
  const root = { id: gid(), name: 'سايل', children: [], depth: 0 };
  const anc = {};
  for (const line of lines) {
    const cells = line.split(',').map(c => c.trim());
    let parent = root, pd = -1;
    for (let lv = 0; lv < cells.length; lv++) {
      const name = cells[lv];
      if (!name) { if (anc[lv]) { parent = anc[lv]; pd = lv; } continue; }
      if (lv === 0 && name === 'سايل') { anc[0] = root; parent = root; pd = 0; continue; }
      if (lv === 0) {
        let n = root.children.find(c => c.name === name);
        if (!n) { n = { id: gid(), name, children: [], depth: 1 }; root.children.push(n); }
        anc[0] = root; anc[1] = n; parent = n; pd = 1; continue;
      }
      if (parent && parent.children) {
        let n = parent.children.find(c => c.name === name);
        if (!n) { n = { id: gid(), name, children: [], depth: pd + 1 }; parent.children.push(n); }
        anc[lv] = n; parent = n; pd = lv;
      }
    }
  }
  return root;
}

function count(n) { let c = 1; if (n.children) n.children.forEach(ch => c += count(ch)); return c; }
function maxDepth(n) { let m = n.depth || 0; if (n.children) n.children.forEach(ch => m = Math.max(m, maxDepth(ch))); return m; }
function allNames(n) { let a = [n.name]; if (n.children) n.children.forEach(c => a = a.concat(allNames(c))); return a; }

function filterTree(n, t) {
  if (!t) return n;
  const tl = t.toLowerCase();
  const match = n.name.toLowerCase().includes(tl);
  let filtered = [];
  if (n.children) n.children.forEach(c => { const f = filterTree(c, t); if (f) filtered.push(f); });
  return (match || filtered.length > 0) ? { ...n, children: filtered } : null;
}

const POS = {
  trunk: [[500,1260],[500,1222],[500,1184],[500,1146],[500,1108],[500,1070],[500,1032]],
  branch: [
    [120,800],[85,710],[48,630],[880,800],[915,710],[952,630],
    [150,600],[105,490],[85,390],[850,600],[895,490],[915,390],
    [230,300],[295,200],[350,160],[770,300],[705,200],[650,160],
    [250,780],[350,680],[450,600],[550,600],[650,680],[750,780],
    [300,580],[700,580],[380,460],[620,460],[420,360],[580,360],
    [492,210],[508,210],[180,1000],[820,1000],[160,920],[840,920]
  ]
};

let pi = 0;
function assignPos(n) {
  if (n.name === 'سايل' && n.depth === 0) { n._x = 500; n._y = 1315; }
  if (!n.children) return;
  n.children.forEach(ch => {
    if (ch.depth === 1 && pi < POS.trunk.length) {
      ch._x = POS.trunk[pi][0]; ch._y = POS.trunk[pi][1]; pi++;
    } else if (pi - POS.trunk.length < POS.branch.length) {
      const bi = pi - POS.trunk.length;
      if (bi >= 0 && bi < POS.branch.length) {
        ch._x = POS.branch[bi][0]; ch._y = POS.branch[bi][1];
      } else { ch._x = 500 + Math.random() * 400 - 200; ch._y = 600 + Math.random() * 400; }
      pi++;
    } else { ch._x = 500 + Math.random() * 600 - 300; ch._y = 400 + Math.random() * 600; }
    assignPos(ch);
  });
}

async function loadSvg() {
  const resp = await fetch(TREE_SVG_URL + '?t=' + Date.now());
  if (!resp.ok) throw new Error('فشل تحميل SVG');
  const text = await resp.text();
  const div = document.createElement('div');
  div.innerHTML = text;
  const svg = div.firstElementChild;
  if (!svg || svg.tagName !== 'svg') throw new Error('ملف SVG غير صالح');
  return svg;
}

async function loadData() {
  const sb = document.getElementById('statusBar');
  sb.textContent = 'جاري تحميل البيانات...';
  sb.className = 'status-bar loading';

  try {
    const resp = await fetch(DATA_FILE + '?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    treeData = await resp.json();
    if (!treeData || !treeData.name) throw new Error('بيانات غير صالحة');
    const t = count(treeData);
    if (t < 5) throw new Error('بيانات غير مكتملة');
    localStorage.setItem('cache', JSON.stringify(treeData));
    await render();
    document.getElementById('totalCount').textContent = t;
    document.getElementById('genCount').textContent = maxDepth(treeData);
    sb.textContent = '✓ آخر تحديث: ' + new Date().toLocaleString('ar-SA');
    sb.className = 'status-bar success';
  } catch (e) {
    console.error('loadData error:', e);
    sb.textContent = '⚠ ' + e.message;
    sb.className = 'status-bar error';
    const c = localStorage.getItem('cache');
    if (c) {
      try {
        treeData = JSON.parse(c);
        await render();
        document.getElementById('totalCount').textContent = count(treeData);
        document.getElementById('genCount').textContent = maxDepth(treeData);
        sb.textContent = '📦 تم تحميل البيانات المخزنة';
        sb.className = 'status-bar warning';
      } catch(e2) {}
    }
  }
}

async function render() {
  if (!treeData) return;
  const container = document.getElementById('treeView');
  container.innerHTML = '';

  const svg = await loadSvg();
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.display = 'block';

  // Assign positions
  pi = 0;
  assignPos(treeData);

  // Track parent positions for connection lines
  function trackParent(n, px, py) {
    n._px = px; n._py = py;
    if (n.children) n.children.forEach(c => {
      c._ppx = c._x || px;
      c._ppy = c._y || py;
      trackParent(c, c._x || px, c._y || py);
    });
  }
  trackParent(treeData, 500, 1315);

  // Add names overlay group
  const ns = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  ns.setAttribute('id', 'names-layer');

  function placeNode(n) {
    if (n._x && n._y && n.name !== 'سايل') {
      const dp = n.depth || 1;
      const colors = ['#D4A017','#CD7F32','#4CAF50','#388E3C','#2E7D32','#1B5E20','#0D3B0F'];
      const col = colors[Math.min(dp, colors.length - 1)];

      // Connection line to parent
      if (n._ppx && n._ppy && (n._ppx !== n._x || n._ppy !== n._y)) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', n._ppx); line.setAttribute('y1', n._ppy);
        line.setAttribute('x2', n._x); line.setAttribute('y2', n._y);
        line.setAttribute('stroke', '#8D6E63'); line.setAttribute('stroke-width', '1.2');
        line.setAttribute('opacity', '0.35');
        ns.appendChild(line);
      }

      // Name label
      const r = dp <= 2 ? 9 : 6;
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bg.setAttribute('cx', n._x); bg.setAttribute('cy', n._y);
      bg.setAttribute('r', r);
      bg.setAttribute('fill', col);
      bg.setAttribute('opacity', '0.9');

      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', n._x); txt.setAttribute('y', n._y);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'central');
      txt.setAttribute('fill', '#FFFCF5');
      txt.setAttribute('font-family', 'Traditional Arabic, Arial');
      txt.setAttribute('font-size', dp <= 2 ? '9' : '7');
      txt.setAttribute('font-weight', 'bold');
      txt.textContent = n.name;

      ns.appendChild(bg);
      ns.appendChild(txt);
    }
    if (n.children) n.children.forEach(placeNode);
  }

  placeNode(treeData);

  // Update title text
  const txts = svg.querySelectorAll('text');
  txts.forEach(t => {
    if (t.textContent.includes('إجمالي')) {
      t.textContent = 'إجمالي أفراد العائلة: ' + count(treeData) + ' فرداً';
    }
    if (t.textContent.includes('Family Tree')) {
      t.textContent = maxDepth(treeData) + ' أجيال · ' + count(treeData) + ' فرداً';
    }
  });

  // Update generation labels
  const genMap = ['الجد', 'الجيل الثاني', 'الجيل الثالث', 'الجيل الرابع', 'الجيل الخامس', 'الجيل السادس', 'الجيل السابع', 'الجيل الثامن', 'الجيل التاسع'];
  const boldTxts = svg.querySelectorAll('text[font-weight="bold"]');
  boldTxts.forEach(t => {
    const idx = genMap.indexOf(t.textContent.trim());
    if (idx >= 0 && idx < maxDepth(treeData)) {
      // Keep as is
    } else if (genMap.includes(t.textContent.trim()) && idx >= maxDepth(treeData)) {
      // Hide generations beyond max
      const parentG = t.closest('g') || t.parentElement;
      if (parentG) parentG.style.display = 'none';
    }
  });

  svg.appendChild(ns);
  container.appendChild(svg);

  // Setup zoom/pan
  const vb = [0, 0, 1000, 1400];
  svg.setAttribute('viewBox', vb.join(' '));

  function updateView() {
    svg.setAttribute('viewBox', vb.join(' '));
    document.getElementById('zoomLevel').textContent = Math.round(1400 / vb[3] * 100) + '%';
  }

  container.onwheel = (e) => {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const f = e.deltaY > 0 ? 1.15 : 0.85;
    const nw = Math.max(300, Math.min(10000, vb[2] * f));
    const nh = nw * 1400 / 1000;
    const cx = vb[0] + mx * vb[2], cy = vb[1] + my * vb[3];
    vb[0] = cx - mx * nw; vb[1] = cy - my * nh;
    vb[2] = nw; vb[3] = nh;
    updateView();
  };

  let pan = false, px, py, vbx, vby;
  container.onmousedown = (e) => {
    if (e.target === container || e.target.closest('svg') === svg) {
      pan = true; px = e.clientX; py = e.clientY;
      vbx = vb[0]; vby = vb[1];
      container.style.cursor = 'grabbing';
    }
  };
  window.onmousemove = (e) => {
    if (pan) {
      vb[0] = vbx - (e.clientX - px) / container.clientWidth * vb[2];
      vb[1] = vby - (e.clientY - py) / container.clientHeight * vb[3];
      updateView();
    }
  };
  window.onmouseup = () => { pan = false; container.style.cursor = 'grab'; };
  container.ontouchstart = (e) => {
    if (e.touches.length === 1) {
      pan = true; px = e.touches[0].clientX; py = e.touches[0].clientY;
      vbx = vb[0]; vby = vb[1];
    }
  };
  container.ontouchmove = (e) => {
    if (pan && e.touches.length === 1) {
      vb[0] = vbx - (e.touches[0].clientX - px) / container.clientWidth * vb[2];
      vb[1] = vby - (e.touches[0].clientY - py) / container.clientHeight * vb[3];
      updateView();
    }
  };
  container.ontouchend = () => { pan = false; };
}

function zoomIn() {
  const svg = document.querySelector('#treeView svg');
  if (!svg) return;
  const vb = svg.getAttribute('viewBox').split(' ').map(Number);
  vb[2] /= 1.4; vb[3] /= 1.4;
  vb[0] += vb[2] * 0.2; vb[1] += vb[3] * 0.2;
  svg.setAttribute('viewBox', vb.join(' '));
  document.getElementById('zoomLevel').textContent = Math.round(1400 / vb[3] * 100) + '%';
}

function zoomOut() {
  const svg = document.querySelector('#treeView svg');
  if (!svg) return;
  const vb = svg.getAttribute('viewBox').split(' ').map(Number);
  vb[0] -= vb[2] * 0.1; vb[1] -= vb[3] * 0.1;
  vb[2] *= 1.4; vb[3] *= 1.4;
  svg.setAttribute('viewBox', vb.join(' '));
  document.getElementById('zoomLevel').textContent = Math.round(1400 / vb[3] * 100) + '%';
}

function resetZoom() {
  const svg = document.querySelector('#treeView svg');
  if (svg) svg.setAttribute('viewBox', '0 0 1000 1400');
  document.getElementById('zoomLevel').textContent = '100%';
}

function performSearch() {
  const input = document.getElementById('searchInput');
  const term = input.value.trim();
  if (!term || !treeData) return;
  const results = allNames(filterTree(treeData, term));
  const sb = document.getElementById('statusBar');
  if (results.length > 1) {
    sb.textContent = '🔍 "' + term + '" - ' + (results.length - 1) + ' نتيجة';
    sb.className = 'status-bar search';
  } else {
    sb.textContent = '🔍 لا توجد نتائج';
    sb.className = 'status-bar error';
  }
}

function init() {
  loadData().catch(e => console.error('init error:', e));
  setInterval(() => loadData().catch(e => {}), REFRESH_MS);
  document.getElementById('searchBtn').onclick = performSearch;
  document.getElementById('searchInput').onkeyup = (e) => { if (e.key === 'Enter') performSearch(); };
  document.getElementById('zoomInBtn').onclick = zoomIn;
  document.getElementById('zoomOutBtn').onclick = zoomOut;
  document.getElementById('resetBtn').onclick = resetZoom;
  document.getElementById('refreshBtn').onclick = () => loadData();
  document.getElementById('fullscreenBtn').onclick = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };
}

document.addEventListener('DOMContentLoaded', init);
