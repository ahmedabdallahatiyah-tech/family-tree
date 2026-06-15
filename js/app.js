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

function count(n) { let c = 1; n.children && n.children.forEach(ch => c += count(ch)); return c; }
function maxDepth(n) { let m = n.depth || 0; n.children && n.children.forEach(ch => m = Math.max(m, maxDepth(ch))); return m; }
function allNames(n) { let a = [n.name]; n.children && n.children.forEach(c => a = a.concat(allNames(c))); return a; }
function filterTree(n, t) {
  if (!t) return n;
  const tl = t.toLowerCase();
  const m = n.name.toLowerCase().includes(tl);
  let f = [];
  n.children && n.children.forEach(c => { const r = filterTree(c, t); r && f.push(r); });
  return (m || f.length > 0) ? { ...n, children: f } : null;
}

// Exact element positions from tree.svg design
const TRUNK = [[500,1260],[500,1222],[500,1184],[500,1146],[500,1108],[500,1070],[500,1032]];
const FRUIT = [
  [120,800],[85,710],[880,800],[915,710],
  [150,600],[105,490],[85,390],[850,600],[895,490],[915,390],
  [230,300],[295,200],[350,160],[770,300],[705,200],[650,160],
  [140,965],[95,765],[860,965],[905,765],
  [210,705],[145,505],[790,705],[855,505],
  [250,780],[350,680],[450,600],[750,780],[650,680],[550,600],
  [300,580],[700,580],[380,460],[620,460],[420,360],[580,360]
];
const LEAF = [
  [150,950],[120,870],[85,800],[55,740],[48,630],[100,680],[160,1000],[200,900],[140,900],[80,850],
  [850,950],[880,870],[915,800],[945,740],[952,630],[900,680],[840,1000],[800,900],[860,900],[920,850],
  [150,600],[105,490],[85,390],[210,705],[175,605],[145,505],
  [850,600],[895,490],[915,390],[790,705],[825,605],[855,505],
  [230,300],[295,200],[350,160],[770,300],[705,200],[650,160],[492,210],[508,210],
  [300,700],[700,700],[350,550],[650,550],[400,400],[600,400],
  [180,1000],[140,920],[100,840],[70,770],
  [820,1000],[860,920],[900,840],[930,770],
  [165,640],[120,530],[835,640],[880,530],
  [245,340],[305,230],[755,340],[695,230],
  [490,240],[510,240]
];

function assignPositions(root) {
  const all = [root];
  for (let i = 0; i < all.length; i++) {
    if (all[i].children) all[i].children.forEach(c => all.push(c));
  }
  // Root stays at base
  root._x = 500; root._y = 1315;
  // Separate by depth priority
  const byDepth = {};
  all.forEach(n => { if (n === root) return; const d = n.depth || 1; if (!byDepth[d]) byDepth[d] = []; byDepth[d].push(n); });
  let ti = 0, fi = 0, li = 0;
  // Gen 1 → trunk
  if (byDepth[1]) byDepth[1].forEach(n => { if (ti < TRUNK.length) { n._x = TRUNK[ti][0]; n._y = TRUNK[ti][1]; ti++; } });
  // Gens 2-3 → fruit
  for (let d = 2; d <= 3; d++) {
    if (byDepth[d]) byDepth[d].forEach(n => { if (fi < FRUIT.length) { n._x = FRUIT[fi][0]; n._y = FRUIT[fi][1]; fi++; } });
  }
  // Remaining fruit positions → gen 4+
  if (fi < FRUIT.length) {
    for (let d = 4; d <= 9; d++) {
      if (byDepth[d]) byDepth[d].forEach(n => { if (fi < FRUIT.length) { n._x = FRUIT[fi][0]; n._y = FRUIT[fi][1]; fi++; } });
    }
  }
  // All remaining → leaves
  for (let d = 1; d <= 9; d++) {
    if (byDepth[d]) byDepth[d].forEach(n => { if (!n._x && li < LEAF.length) { n._x = LEAF[li][0]; n._y = LEAF[li][1]; li++; } });
  }
}

async function loadData() {
  const sb = document.getElementById('statusBar');
  sb.textContent = 'جاري التحميل...';
  sb.className = 'status-bar loading';

  try {
    const r = await fetch(DATA_FILE + '?t=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    treeData = await r.json();
    if (!treeData || !treeData.name) throw new Error('بيانات غير صالحة');
    const t = count(treeData);
    if (t < 5) throw new Error('بيانات غير مكتملة');
    localStorage.setItem('cache', JSON.stringify(treeData));
    assignPositions(treeData);
    document.getElementById('totalCount').textContent = t;
    document.getElementById('genCount').textContent = maxDepth(treeData);
    sb.textContent = '✓ آخر تحديث: ' + new Date().toLocaleString('ar-SA');
    sb.className = 'status-bar success';
    await loadSvg();
  } catch (e) {
    console.error(e);
    sb.textContent = '⚠ ' + e.message;
    sb.className = 'status-bar error';
    const c = localStorage.getItem('cache');
    if (c) {
      try { treeData = JSON.parse(c); assignPositions(treeData); await loadSvg(); } catch(e2) {}
    }
  }
}

async function loadSvg() {
  if (!treeData) return;
  const container = document.getElementById('treeView');
  container.innerHTML = '<svg viewBox="0 0 1000 1400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"></svg>';
  const svg = container.querySelector('svg');

  const r = await fetch('tree.svg?t=' + Date.now());
  const txt = await r.text();
  const m = txt.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  svg.innerHTML = m ? m[1] : txt;

  const total = count(treeData), depth = maxDepth(treeData);
  svg.querySelectorAll('text').forEach(t => {
    if (t.textContent.includes('إجمالي')) t.textContent = 'إجمالي أفراد العائلة: ' + total + ' فرداً';
    if (t.textContent.includes('Family Tree')) t.textContent = depth + ' أجيال · ' + total + ' فرداً';
  });

  addLabels(svg);
  setupViewer(container, svg);
}

function addLabels(svg) {
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g');
  g.id = 'nameLabels';

  function add(name, x, y, depth) {
    const el = document.createElementNS(ns, 'text');
    el.setAttribute('x', x); el.setAttribute('y', y);
    el.setAttribute('text-anchor', 'middle');
    el.setAttribute('dominant-baseline', 'central');
    el.setAttribute('font-family', 'Traditional Arabic, Arial');
    el.setAttribute('font-size', depth <= 1 ? '9' : '7');
    el.setAttribute('font-weight', depth <= 1 ? 'bold' : 'normal');
    if (depth <= 1) el.setAttribute('fill', '#FFFCF5');
    else if (depth <= 3) el.setAttribute('fill', '#4E342E');
    else el.setAttribute('fill', '#1B5E20');
    el.textContent = name;
    const wrap = document.createElementNS(ns, 'g');
    wrap.dataset.name = name; wrap.dataset.depth = depth || '0';
    wrap.appendChild(el);
    g.appendChild(wrap);
  }

  function walk(n) {
    if (n.name !== 'سايل' && n._x && n._y) add(n.name, n._x, n._y, n.depth);
    if (n.children) n.children.forEach(walk);
  }
  walk(treeData);
  svg.appendChild(g);
}

function setupViewer(container, svg) {
  const vb = [0, 0, 1000, 1400];
  function update() {
    svg.setAttribute('viewBox', vb.join(' '));
    const el = document.getElementById('zoomLevel');
    if (el) el.textContent = Math.round(1400 / vb[3] * 100) + '%';
  }

  container.onwheel = (e) => {
    e.preventDefault();
    const r = container.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width, my = (e.clientY - r.top) / r.height;
    const f = e.deltaY > 0 ? 1.12 : 0.88;
    const nw = Math.max(300, Math.min(8000, vb[2] * f)), nh = nw * 1.4;
    const cx = vb[0] + mx * vb[2], cy = vb[1] + my * vb[3];
    vb[0] = cx - mx * nw; vb[1] = cy - my * nh;
    vb[2] = nw; vb[3] = nh; update();
  };

  let pan = false, px, py, vbx, vby;
  container.onmousedown = (e) => { pan = true; px = e.clientX; py = e.clientY; vbx = vb[0]; vby = vb[1]; container.style.cursor = 'grabbing'; };
  window.onmousemove = (e) => { if (!pan) return; vb[0] = vbx - (e.clientX - px) / container.clientWidth * vb[2]; vb[1] = vby - (e.clientY - py) / container.clientHeight * vb[3]; update(); };
  window.onmouseup = () => { pan = false; container.style.cursor = 'grab'; };
  container.ontouchstart = (e) => { if (e.touches.length === 1) { pan = true; px = e.touches[0].clientX; py = e.touches[0].clientY; vbx = vb[0]; vby = vb[1]; } };
  container.ontouchmove = (e) => { if (pan && e.touches.length === 1) { vb[0] = vbx - (e.touches[0].clientX - px) / container.clientWidth * vb[2]; vb[1] = vby - (e.touches[0].clientY - py) / container.clientHeight * vb[3]; update(); } };
  container.ontouchend = () => { pan = false; };

  window.zoomIn = () => { vb[2] /= 1.4; vb[3] /= 1.4; update(); };
  window.zoomOut = () => { vb[2] *= 1.4; vb[3] *= 1.4; update(); };
  window.resetView = () => { vb[0]=0; vb[1]=0; vb[2]=1000; vb[3]=1400; update(); };
}

function performSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  const term = input.value.trim();
  if (!term || !treeData) return;
  const r = allNames(filterTree(treeData, term));
  const sb = document.getElementById('statusBar');
  if (r.length > 1) { sb.textContent = '🔍 ' + (r.length - 1) + ' نتيجة'; sb.className = 'status-bar search'; }
  else { sb.textContent = '🔍 لا توجد نتائج'; sb.className = 'status-bar error'; }
  document.querySelectorAll('#nameLabels g').forEach(el => {
    const m = el.dataset.name === term;
    el.style.opacity = (!term || m) ? '1' : '0.1';
    el.style.filter = m ? 'drop-shadow(0 0 5px #FFD700)' : 'none';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setInterval(loadData, REFRESH_MS);
  document.getElementById('searchBtn').onclick = performSearch;
  document.getElementById('searchInput').onkeyup = (e) => {
    if (e.key === 'Enter') performSearch();
    if (!e.target.value) {
      document.querySelectorAll('#nameLabels g').forEach(el => { el.style.opacity = '1'; el.style.filter = 'none'; });
      document.getElementById('statusBar').textContent = '✓'; document.getElementById('statusBar').className = 'status-bar success';
    }
  };
  document.getElementById('zoomInBtn').onclick = () => window.zoomIn && window.zoomIn();
  document.getElementById('zoomOutBtn').onclick = () => window.zoomOut && window.zoomOut();
  document.getElementById('resetBtn').onclick = () => window.resetView && window.resetView();
  document.getElementById('refreshBtn').onclick = loadData;
  document.getElementById('fullscreenBtn').onclick = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); };
});
