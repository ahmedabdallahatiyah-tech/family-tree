const DATA_URL = 'data.json';
const REFRESH_MS = 300000;
let treeData = null;

function gid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n').filter(l => l.trim());
  const root = { id: gid(), name: 'سايل', children: [], depth: 0, parent: null, branch: 'القبيلة' };
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
        if (!n) { n = { id: gid(), name, children: [], depth: 1, parent: root, branch: name }; root.children.push(n); }
        anc[0] = root; anc[1] = n; parent = n; pd = 1; continue;
      }
      if (parent && parent.children) {
        let n = parent.children.find(c => c.name === name);
        if (!n) { n = { id: gid(), name, children: [], depth: pd + 1, parent, branch: getBranch(parent) }; parent.children.push(n); }
        anc[lv] = n; parent = n; pd = lv;
      }
    }
  }
  return root;
  function getBranch(n) { return n.branch || (n.parent ? getBranch(n.parent) : n.name); }
}

function count(n) { let c = 1; if (n.children) n.children.forEach(ch => c += count(ch)); return c; }
function maxDepth(n) { let m = n.depth || 0; if (n.children) n.children.forEach(ch => m = Math.max(m, maxDepth(ch))); return m; }
function allNames(n) { let a = [n.name]; if (n.children) n.children.forEach(c => a = a.concat(allNames(c))); return a; }
function filterTree(n, t) {
  if (!t) return n;
  const tl = t.toLowerCase();
  const m = n.name.toLowerCase().includes(tl);
  let f = [];
  if (n.children) n.children.forEach(c => { const r = filterTree(c, t); if (r) f.push(r); });
  return (m || f.length > 0) ? { ...n, children: f } : null;
}
function findNode(n, name) {
  if (n.name === name) return n;
  if (n.children) for (const c of n.children) { const r = findNode(c, name); if (r) return r; }
  return null;
}
function bfs(n) { const r = [n], q = [n]; while (q.length) { const c = q.shift(); if (c.children) c.children.forEach(ch => { r.push(ch); q.push(ch); }); } return r; }
function dfs(n) { let r = [n]; if (n.children) n.children.forEach(c => r = r.concat(dfs(c))); return r; }

const TRUNK = [[500,1260],[500,1222],[500,1184],[500,1146],[500,1108],[500,1070],[500,1032]];
const FRUIT = [
  [120,800],[85,710],[880,800],[915,710],[150,600],[105,490],[85,390],[850,600],[895,490],[915,390],
  [230,300],[295,200],[350,160],[770,300],[705,200],[650,160],[140,965],[95,765],[860,965],[905,765],
  [210,705],[145,505],[790,705],[855,505],[250,780],[350,680],[450,600],[750,780],[650,680],[550,600],
  [300,580],[700,580],[380,460],[620,460],[420,360],[580,360]
];
const LEAF = [
  [150,950],[120,870],[85,800],[55,740],[48,630],[100,680],[160,1000],[200,900],[140,900],[80,850],
  [850,950],[880,870],[915,800],[945,740],[952,630],[900,680],[840,1000],[800,900],[860,900],[920,850],
  [150,600],[105,490],[85,390],[210,705],[175,605],[145,505],[850,600],[895,490],[915,390],[790,705],
  [825,605],[855,505],[230,300],[295,200],[350,160],[770,300],[705,200],[650,160],[492,210],[508,210],
  [300,700],[700,700],[350,550],[650,550],[400,400],[600,400],
  [180,1000],[140,920],[100,840],[70,770],[820,1000],[860,920],[900,840],[930,770],
  [165,640],[120,530],[835,640],[880,530],[245,340],[305,230],[755,340],[695,230],[490,240],[510,240]
];

function assignPositions(root) {
  const all = bfs(root);
  const byDepth = {};
  all.forEach(n => { if (n === root) return; const d = n.depth || 1; if (!byDepth[d]) byDepth[d] = []; byDepth[d].push(n); });
  root._x = 500; root._y = 1315;
  let ti = 0, fi = 0, li = 0;
  if (byDepth[1]) byDepth[1].forEach(n => { if (ti < TRUNK.length) { n._x = TRUNK[ti][0]; n._y = TRUNK[ti][1]; ti++; } });
  for (let d = 2; d <= 3; d++) if (byDepth[d]) byDepth[d].forEach(n => { if (fi < FRUIT.length) { n._x = FRUIT[fi][0]; n._y = FRUIT[fi][1]; fi++; } });
  for (let d = 4; d <= 9; d++) if (byDepth[d]) byDepth[d].forEach(n => { if (fi < FRUIT.length) { n._x = FRUIT[fi][0]; n._y = FRUIT[fi][1]; fi++; } });
  for (let d = 1; d <= 9; d++) if (byDepth[d]) byDepth[d].forEach(n => { if (!n._x && li < LEAF.length) { n._x = LEAF[li][0]; n._y = LEAF[li][1]; li++; } });
}

let selectedNode = null, interG = null, detailG = null;
let svgEl = null;

function showStatus(msg, cls) {
  const sb = document.getElementById('statusBar');
  sb.textContent = msg; sb.className = 'status-bar ' + cls;
}

async function loadData() {
  showStatus('جاري تحميل البيانات...', 'loading');
  try {
    const r = await fetch(DATA_URL + '?t=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    treeData = await r.json();
    if (!treeData || !treeData.name) throw new Error('بيانات غير صالحة');
    const t = count(treeData);
    if (t < 5) throw new Error('بيانات غير مكتملة');
    // Add parent refs if missing (for data from JSON)
    bfs(treeData).forEach(n => {
      if (n.children) n.children.forEach(c => { if (!c.parent) c.parent = n; if (!c.branch) c.branch = n.branch || n.name; });
    });
    localStorage.setItem('cache', JSON.stringify(treeData));
    assignPositions(treeData);
    document.getElementById('totalCount').textContent = t;
    document.getElementById('genCount').textContent = maxDepth(treeData);
    showStatus('✓ آخر تحديث: ' + new Date().toLocaleString('ar-SA'), 'success');
    await loadSvg();
  } catch (e) {
    console.error(e);
    showStatus('⚠ ' + e.message, 'error');
    const c = localStorage.getItem('cache');
    if (c) { try { treeData = JSON.parse(c); bfs(treeData).forEach(n => { if (n.children) n.children.forEach(c => { if (!c.parent) c.parent = n; }); }); assignPositions(treeData); await loadSvg(); } catch(e2) {} }
  }
}

async function loadSvg() {
  if (!treeData) return;
  const container = document.getElementById('treeView');
  container.innerHTML = '<svg viewBox="0 0 1000 1400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"></svg>';
  svgEl = container.querySelector('svg');

  try {
    const r = await fetch('tree.svg?t=' + Date.now());
    const txt = await r.text();
    const m = txt.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
    svgEl.innerHTML = m ? m[1] : txt;
  } catch(e) {
    showStatus('⚠ فشل تحميل الشجرة', 'error');
    return;
  }

  interG = document.createElementNS('http://www.w3.org/2000/svg', 'g'); interG.id = 'interactive';
  detailG = document.createElementNS('http://www.w3.org/2000/svg', 'g'); detailG.id = 'details';
  svgEl.appendChild(interG);
  svgEl.appendChild(detailG);

  const total = count(treeData), depth = maxDepth(treeData);
  svgEl.querySelectorAll('text').forEach(t => {
    if (t.textContent.includes('إجمالي')) t.textContent = 'إجمالي أفراد العائلة: ' + total + ' فرداً';
    if (t.textContent.includes('Family Tree')) t.textContent = depth + ' أجيال · ' + total + ' فرداً';
    if (t.textContent.includes('Family Tree') && total > 0) t.textContent = 'قبيلة العجمان · ' + depth + ' أجيال';
  });

  addLabels();
  setupViewer();
  setupGenNav();
}

function addLabels() {
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g'); g.id = 'nameLabels';

  function createLabel(name, x, y, depth) {
    const wrap = document.createElementNS(ns, 'g');
    wrap.dataset.name = name; wrap.dataset.depth = depth || '0';
    wrap.style.cursor = 'pointer';
    const el = document.createElementNS(ns, 'text');
    el.setAttribute('x', x); el.setAttribute('y', y);
    el.setAttribute('text-anchor', 'middle'); el.setAttribute('dominant-baseline', 'central');
    el.setAttribute('font-family', 'Traditional Arabic, Arial');
    el.setAttribute('font-size', depth <= 1 ? '9' : '7');
    el.setAttribute('font-weight', depth <= 1 ? 'bold' : 'normal');
    if (depth <= 1) el.setAttribute('fill', '#FFFCF5');
    else if (depth <= 3) el.setAttribute('fill', '#4E342E');
    else el.setAttribute('fill', '#1B5E20');
    el.textContent = name;
    wrap.appendChild(el);
    wrap.onclick = (e) => { e.stopPropagation(); selectNode(name); };
    wrap.onmouseenter = () => { if (!selectedNode || selectedNode.name !== name) el.setAttribute('fill', '#D4A017'); };
    wrap.onmouseleave = () => { if (!selectedNode || selectedNode.name !== name) restoreColor(wrap, el, depth); };
    g.appendChild(wrap);
  }

  function restoreColor(wrap, el, d) {
    if (d <= 1) el.setAttribute('fill', '#FFFCF5');
    else if (d <= 3) el.setAttribute('fill', '#4E342E');
    else el.setAttribute('fill', '#1B5E20');
  }

  bfs(treeData).forEach(n => {
    if (n.name === 'سايل') return;
    if (n._x && n._y) createLabel(n.name, n._x, n._y, n.depth);
  });

  // Root
  const rWrap = document.createElementNS(ns, 'g'); rWrap.dataset.name = 'سايل'; rWrap.style.cursor = 'pointer';
  const rEl = document.createElementNS(ns, 'text');
  rEl.setAttribute('x', 500); rEl.setAttribute('y', 1315);
  rEl.setAttribute('text-anchor', 'middle'); rEl.setAttribute('dominant-baseline', 'central');
  rEl.setAttribute('font-family', 'Traditional Arabic, Arial');
  rEl.setAttribute('fill', '#FFFCF5'); rEl.setAttribute('font-size', '7'); rEl.setAttribute('font-weight', 'bold');
  rEl.textContent = 'سايل';
  rWrap.appendChild(rEl);
  rWrap.onclick = (e) => { e.stopPropagation(); selectNode('سايل'); };
  rWrap.onmouseenter = () => rEl.setAttribute('fill', '#FFD54F');
  rWrap.onmouseleave = () => rEl.setAttribute('fill', '#FFFCF5');
  svgEl.appendChild(rWrap);

  // Insert labels before details so details draws on top
  svgEl.insertBefore(g, detailG);
}

function selectNode(name) {
  const node = findNode(treeData, name);
  if (!node) return;
  if (selectedNode && selectedNode.name === name) { deselectNode(); return; }
  deselectNode();
  selectedNode = node;

  // Highlight
  const labels = svgEl.querySelectorAll('#nameLabels g');
  labels.forEach(el => { const t = el.querySelector('text'); if (t) t.setAttribute('fill', el.dataset.name === name ? '#FFD700' : '#888'); });
  // Root highlight
  svgEl.querySelectorAll('[data-name="سايل"] text').forEach(t => t.setAttribute('fill', name === 'سايل' ? '#FFD700' : '#888'));

  showDetails(node);
}

function deselectNode() {
  if (interG) interG.innerHTML = '';
  if (detailG) detailG.innerHTML = '';
  selectedNode = null;
  const labels = svgEl.querySelectorAll('#nameLabels g');
  labels.forEach(el => {
    const t = el.querySelector('text'); if (!t) return;
    const d = parseInt(el.dataset.depth) || 0;
    if (d <= 1) t.setAttribute('fill', '#FFFCF5');
    else if (d <= 3) t.setAttribute('fill', '#4E342E');
    else t.setAttribute('fill', '#1B5E20');
  });
  svgEl.querySelectorAll('[data-name="سايل"] text').forEach(t => t.setAttribute('fill', '#FFFCF5'));
  document.getElementById('infoPanel').classList.remove('visible');
}

function showDetails(node) {
  const ns = 'http://www.w3.org/2000/svg';
  const px = node._x || 500, py = node._y || 1315;
  const isRoot = node.name === 'سايل';

  // Draw children connection lines (interactive expansion)
  if (node.children && node.children.length > 0) {
    const children = node.children;
    const angle = -30;
    const angleStep = children.length > 1 ? 60 / (children.length - 1) : 0;
    children.forEach((ch, i) => {
      const a = (angle + i * angleStep) * Math.PI / 180;
      const dist = 120 + Math.floor(i / 6) * 60;
      const cx = px + Math.sin(a) * dist;
      const cy = py - Math.cos(a) * dist * 0.7 - 30;

      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M${px},${py-10} Q${px},${(py+cy)/2} ${cx},${cy}`);
      path.setAttribute('stroke', '#A1887F'); path.setAttribute('stroke-width', '1'); path.setAttribute('fill', 'none');
      path.setAttribute('stroke-dasharray', '3,2'); path.setAttribute('opacity', '0.6');
      interG.appendChild(path);

      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('x', cx); txt.setAttribute('y', cy);
      txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('dominant-baseline', 'central');
      txt.setAttribute('font-family', 'Traditional Arabic, Arial');
      txt.setAttribute('font-size', '6.5'); txt.setAttribute('fill', '#5D4037');
      txt.setAttribute('font-weight', 'bold'); txt.style.cursor = 'pointer';
      txt.textContent = ch.name;
      interG.appendChild(txt);

      if (ch.children && ch.children.length > 0) {
        const hint = document.createElementNS(ns, 'text');
        hint.setAttribute('x', cx); hint.setAttribute('y', cy + 10);
        hint.setAttribute('text-anchor', 'middle'); hint.setAttribute('font-size', '4.5');
        hint.setAttribute('fill', '#A1887F'); hint.setAttribute('font-family', 'Traditional Arabic, Arial');
        hint.textContent = '◀ ' + ch.children.length + ' أبناء';
        interG.appendChild(hint);
      }
    });
  }

  // Info Panel (HTML overlay, positioned on the tree)
  const panel = document.getElementById('infoPanel');
  const info = document.getElementById('personInfo');
  const gen = node.depth !== undefined ? node.depth : (isRoot ? 0 : 1);
  const father = node.parent && node.parent.name ? node.parent.name : '—';
  const grandfather = node.parent && node.parent.parent && node.parent.parent.name ? node.parent.parent.name : '—';
  const childrenCount = node.children ? node.children.length : 0;
  const totalDesc = count(node) - 1;

  info.innerHTML = `
    <div class="p-name">${node.name}</div>
    <div class="p-divider"></div>
    <div class="p-row"><span class="p-label">الجيل</span><span class="p-val">${gen}</span></div>
    <div class="p-row"><span class="p-label">الفرع</span><span class="p-val">${node.branch || '—'}</span></div>
    <div class="p-row"><span class="p-label">الأب</span><span class="p-val">${father}</span></div>
    <div class="p-row"><span class="p-label">الجد</span><span class="p-val">${grandfather}</span></div>
    <div class="p-row"><span class="p-label">الأبناء</span><span class="p-val">${childrenCount}</span></div>
    <div class="p-row"><span class="p-label">النسل</span><span class="p-val">${totalDesc}</span></div>
    ${node.parent ? `<button class="p-nav-btn" onclick="selectNode('${node.parent.name}')">⬆ ${node.parent.name}</button>` : ''}
  `;
  panel.classList.add('visible');

  // Show gen nav hint
  const genInfo = document.getElementById('genNavInfo');
  genInfo.textContent = 'الجيل ' + gen + ' | ' + (node.branch || 'القبيلة');
}

function setupViewer() {
  const container = document.getElementById('treeView');
  const vb = [0, 0, 1000, 1400];
  function update() {
    svgEl.setAttribute('viewBox', vb.join(' '));
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
    vb[0] = cx - mx * nw; vb[1] = cy - my * nh; vb[2] = nw; vb[3] = nh; update();
  };
  let pan = false, px, py, vbx, vby;
  container.onmousedown = (e) => { pan = true; px = e.clientX; py = e.clientY; vbx = vb[0]; vby = vb[1]; container.style.cursor = 'grabbing'; };
  window.onmousemove = (e) => { if (!pan) return; vb[0] = vbx - (e.clientX - px) / container.clientWidth * vb[2]; vb[1] = vby - (e.clientY - py) / container.clientHeight * vb[3]; update(); };
  window.onmouseup = () => { pan = false; container.style.cursor = 'grab'; };
  container.ontouchstart = (e) => { if (e.touches.length === 1) { pan = true; px = e.touches[0].clientX; py = e.touches[0].clientY; vbx = vb[0]; vby = vb[1]; } };
  container.ontouchmove = (e) => { if (pan && e.touches.length === 1) { vb[0] = vbx - (e.touches[0].clientX - px) / container.clientWidth * vb[2]; vb[1] = vby - (e.touches[0].clientY - py) / container.clientHeight * vb[3]; update(); } };
  container.ontouchend = () => { pan = false; };
  container.onclick = (e) => { if (e.target === container || e.target.tagName === 'svg') deselectNode(); };
  window.zoomIn = () => { vb[2] /= 1.4; vb[3] /= 1.4; update(); };
  window.zoomOut = () => { vb[2] *= 1.4; vb[3] *= 1.4; update(); };
  window.resetView = () => { vb[0]=0; vb[1]=0; vb[2]=1000; vb[3]=1400; update(); };
}

function setupGenNav() {
  document.getElementById('upBtn').onclick = () => {
    if (selectedNode && selectedNode.parent) selectNode(selectedNode.parent.name);
    else showStatus('هذا أعلى جيل', 'warning');
  };
  document.getElementById('rootBtn').onclick = () => selectNode('سايل');
}

function performSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  const term = input.value.trim();
  if (!term || !treeData) return;
  const r = allNames(filterTree(treeData, term));
  if (r.length > 1) showStatus('🔍 ' + (r.length - 1) + ' نتيجة', 'search');
  else showStatus('🔍 لا توجد نتائج', 'error');
  document.querySelectorAll('#nameLabels g').forEach(el => {
    const m = el.dataset.name === term;
    el.style.opacity = (!term || m) ? '1' : '0.08';
    el.style.filter = m ? 'drop-shadow(0 0 6px #FFD700)' : 'none';
  });
  svgEl.querySelectorAll('[data-name="سايل"]').forEach(el => {
    el.style.opacity = (!term || term === 'سايل') ? '1' : '0.08';
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
      svgEl.querySelectorAll('[data-name="سايل"]').forEach(el => el.style.opacity = '1');
      showStatus('✓', 'success');
    }
  };
  document.getElementById('zoomInBtn').onclick = () => window.zoomIn && window.zoomIn();
  document.getElementById('zoomOutBtn').onclick = () => window.zoomOut && window.zoomOut();
  document.getElementById('resetBtn').onclick = () => window.resetView && window.resetView();
  document.getElementById('refreshBtn').onclick = loadData;
  document.getElementById('fullscreenBtn').onclick = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); };
  document.getElementById('closeInfo').onclick = deselectNode;
});
