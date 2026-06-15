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

function count(n) { let c = 1; if (n.children) for (const ch of n.children) c += count(ch); return c; }
function maxDepth(n) { let m = n.depth || 0; if (n.children) for (const ch of n.children) m = Math.max(m, maxDepth(ch)); return m; }
function allNames(n, arr) { arr = arr || []; arr.push(n.name); if (n.children) n.children.forEach(c => allNames(c, arr)); return arr; }

function filterTree(n, t) {
  if (!t) return n;
  const tl = t.toLowerCase();
  const match = n.name.toLowerCase().includes(tl);
  let filtered = [];
  if (n.children) n.children.forEach(c => { const f = filterTree(c, t); if (f) filtered.push(f); });
  return (match || filtered.length > 0) ? { ...n, children: filtered } : null;
}

const TREE_POS = {
  trunk: [
    { x: 500, y: 1260 }, { x: 500, y: 1222 }, { x: 500, y: 1184 },
    { x: 500, y: 1146 }, { x: 500, y: 1108 }, { x: 500, y: 1070 },
    { x: 500, y: 1032 }
  ],
  canopy: [
    { x: 120, y: 800 }, { x: 85, y: 710 }, { x: 48, y: 630 },
    { x: 880, y: 800 }, { x: 915, y: 710 }, { x: 952, y: 630 },
    { x: 150, y: 600 }, { x: 105, y: 490 }, { x: 85, y: 390 },
    { x: 850, y: 600 }, { x: 895, y: 490 }, { x: 915, y: 390 },
    { x: 230, y: 300 }, { x: 295, y: 200 }, { x: 350, y: 160 },
    { x: 770, y: 300 }, { x: 705, y: 200 }, { x: 650, y: 160 },
    { x: 250, y: 780 }, { x: 350, y: 680 }, { x: 450, y: 600 },
    { x: 550, y: 600 }, { x: 650, y: 680 }, { x: 750, y: 780 },
    { x: 300, y: 580 }, { x: 700, y: 580 },
    { x: 380, y: 460 }, { x: 620, y: 460 },
    { x: 420, y: 360 }, { x: 580, y: 360 },
    { x: 492, y: 210 }, { x: 508, y: 210 },
  ]
};

let posIndex = 0;
function assignPos(n, depth) {
  if (n.name === 'سايل' && n.depth === 0) { n._px = 500; n._py = 1315; }
  if (!n.children || n.children.length === 0) return;
  for (const ch of n.children) {
    if (ch.depth === 1 && posIndex < TREE_POS.trunk.length) {
      ch._px = TREE_POS.trunk[posIndex].x;
      ch._py = TREE_POS.trunk[posIndex].y;
      posIndex++;
    } else if (posIndex < TREE_POS.trunk.length + TREE_POS.canopy.length) {
      const ci = posIndex - 7;
      if (ci >= 0 && ci < TREE_POS.canopy.length) {
        ch._px = TREE_POS.canopy[ci].x;
        ch._py = TREE_POS.canopy[ci].y;
      } else {
        ch._px = 500 + Math.random() * 200 - 100;
        ch._py = 800 + Math.random() * 400;
      }
      posIndex++;
    } else {
      ch._px = 500 + Math.random() * 800 - 400;
      ch._py = 400 + Math.random() * 600;
    }
    assignPos(ch, ch.depth);
  }
}

function degToRad(d) { return d * Math.PI / 180; }

let svgTemplate = null;
async function loadSvgTemplate() {
  if (svgTemplate) return svgTemplate;
  const resp = await fetch(TREE_SVG_URL);
  const text = await resp.text();
  const parser = new DOMParser();
  svgTemplate = parser.parseFromString(text, 'image/svg+xml').documentElement;
  return svgTemplate;
}

async function loadData() {
  const sb = document.getElementById('statusBar');
  sb.textContent = 'جاري تحميل البيانات...';
  sb.className = 'status-bar loading';

  try {
    const resp = await fetch(DATA_FILE + '?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    treeData = await resp.json();
    if (!treeData.name) throw new Error('بيانات غير صالحة');
    if (count(treeData) < 5) throw new Error('بيانات غير مكتملة');
    localStorage.setItem('cache', JSON.stringify(treeData));
    await render();
    sb.textContent = '✓ آخر تحديث: ' + new Date().toLocaleString('ar-SA');
    sb.className = 'status-bar success';
  } catch (e) {
    sb.textContent = '⚠ ' + e.message;
    sb.className = 'status-bar error';
    const c = localStorage.getItem('cache');
    if (c) {
      treeData = JSON.parse(c);
      await render();
      sb.textContent = '📦 تم تحميل البيانات المخزنة';
      sb.className = 'status-bar warning';
    }
  }
}

async function render() {
  if (!treeData) return;
  const container = document.getElementById('treeView');
  container.innerHTML = '';

  try {
    const svg = await loadSvgTemplate();
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', '100%');
    clone.setAttribute('height', '100%');

    // Assign positions
    posIndex = 0;
    assignPos(treeData);

    // Add a group for name overlays
    const defs = clone.querySelector('defs') || clone.querySelector('svg > defs');
    const namesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    namesGroup.setAttribute('id', 'names-layer');

    // Place names on the tree
    function placeNames(node) {
      if (node.name === 'سايل' && node.depth === 0) {
        // Skip root - it doesn't need a label on the tree
      } else if (node._px && node._py) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const depth = node.depth || 1;
        const colors = ['#D4A017', '#CD7F32', '#4CAF50', '#388E3C', '#2E7D32', '#1B5E20', '#0D3B0F'];

        // Background circle
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bg.setAttribute('cx', node._px);
        bg.setAttribute('cy', node._py);
        const r = depth <= 2 ? 8 : 6;
        bg.setAttribute('r', r);
        bg.setAttribute('fill', colors[Math.min(depth, colors.length - 1)]);
        bg.setAttribute('opacity', '0.85');

        // Name text
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', node._px);
        text.setAttribute('y', node._py);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('fill', '#FFFCF5');
        text.setAttribute('font-family', 'Traditional Arabic, Arial');
        text.setAttribute('font-size', depth <= 2 ? '8' : '7');
        text.textContent = node.name.length > 6 ? node.name.substring(0, 5) + '..' : node.name;

        // Connection line to parent
        if (node._ppx && node._ppy && ((node._ppx !== node._px) || (node._ppy !== node._py))) {
          const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          ln.setAttribute('x1', node._ppx);
          ln.setAttribute('y1', node._ppy);
          ln.setAttribute('x2', node._px);
          ln.setAttribute('y2', node._py);
          ln.setAttribute('stroke', '#8D6E63');
          ln.setAttribute('stroke-width', '1');
          ln.setAttribute('opacity', '0.3');
          namesGroup.appendChild(ln);
        }

        g.appendChild(bg);
        g.appendChild(text);
        namesGroup.appendChild(g);
      }
      if (node.children) node.children.forEach(placeNames);
    }

    // Track parent positions for connection lines
    function trackParent(node, px, py) {
      if (node.children) {
        for (const ch of node.children) {
          if (ch._px && ch._py) {
            ch._ppx = node._px || px;
            ch._ppy = node._py || py;
          }
          trackParent(ch, ch._px || px, ch._py || py);
        }
      }
    }
    trackParent(treeData, 500, 1315);

    // Also set parent for root children
    if (treeData.children) {
      for (const ch of treeData.children) {
        ch._ppx = 500;
        ch._ppy = 1315;
      }
    }

    placeNames(treeData);

    // Update title with actual data
    const total = count(treeData);
    const depth = maxDepth(treeData);
    const titleEl = clone.querySelector('text:first-of-type');
    const bottomTexts = clone.querySelectorAll('text');
    bottomTexts.forEach(t => {
      if (t.textContent.includes('إجمالي')) {
        t.textContent = 'إجمالي أفراد العائلة: ' + total + ' فرداً';
      }
    });

    // Update generation labels
    const genLabels = clone.querySelectorAll('text[font-weight="bold"]');
    const genSuffix = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];

    // Update subtitle
    const subEl = clone.querySelector('text[font-size="14"]');
    if (subEl) {
      subEl.textContent = depth + ' أجيال · ' + total + ' فرداً';
    }

    // Insert names layer before the title (at the end)
    const rootSvg = clone.tagName === 'svg' ? clone : clone.querySelector('svg');
    if (rootSvg) {
      rootSvg.appendChild(namesGroup);
    } else {
      clone.appendChild(namesGroup);
    }

    container.appendChild(clone);

    // Update stats
    document.getElementById('totalCount').textContent = total;
    document.getElementById('genCount').textContent = depth;

    // Setup interaction
    setupZoom(container, clone);
  } catch (e) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#3E2723">خطأ في تحميل الشجرة: ' + e.message + '</div>';
  }
}

function setupZoom(container, svg) {
  let scale = 1;
  const vb = [0, 0, 1000, 1400];
  svg.setAttribute('viewBox', vb.join(' '));

  function update() {
    svg.setAttribute('viewBox', vb.join(' '));
    document.getElementById('zoomLevel').textContent = Math.round(1400 / vb[3] * 100) + '%';
  }

  container.onwheel = (e) => {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const factor = e.deltaY > 0 ? 1.15 : 0.85;
    const newW = Math.max(200, Math.min(10000, vb[2] * factor));
    const newH = newW * 1400 / 1000;
    const cx = vb[0] + mx * vb[2];
    const cy = vb[1] + my * vb[3];
    vb[0] = cx - mx * newW;
    vb[1] = cy - my * newH;
    vb[2] = newW;
    vb[3] = newH;
    update();
  };

  let pan = false, px, py, vbx, vby;
  container.onmousedown = (e) => {
    if (e.target === container || e.target.tagName === 'svg') {
      pan = true; px = e.clientX; py = e.clientY;
      vbx = vb[0]; vby = vb[1];
      container.style.cursor = 'grabbing';
    }
  };
  window.onmousemove = (e) => {
    if (pan) {
      const dx = (e.clientX - px) / container.clientWidth * vb[2];
      const dy = (e.clientY - py) / container.clientHeight * vb[3];
      vb[0] = vbx - dx; vb[1] = vby - dy;
      update();
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
      const dx = (e.touches[0].clientX - px) / container.clientWidth * vb[2];
      const dy = (e.touches[0].clientY - py) / container.clientHeight * vb[3];
      vb[0] = vbx - dx; vb[1] = vby - dy;
      update();
    }
  };
  container.ontouchend = () => { pan = false; };

  window.zoomIn = () => {
    vb[2] /= 1.4; vb[3] /= 1.4;
    vb[0] += vb[2] * 0.2; vb[1] += vb[3] * 0.2;
    update();
  };
  window.zoomOut = () => {
    vb[0] -= vb[2] * 0.1; vb[1] -= vb[3] * 0.1;
    vb[2] *= 1.4; vb[3] *= 1.4;
    update();
  };
  window.resetZoom = () => {
    vb[0] = 0; vb[1] = 0; vb[2] = 1000; vb[3] = 1400;
    update();
  };
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
  loadData();
  setInterval(loadData, REFRESH_MS);
  document.getElementById('searchBtn').onclick = performSearch;
  document.getElementById('searchInput').onkeyup = (e) => { if (e.key === 'Enter') performSearch(); };
  document.getElementById('zoomInBtn').onclick = () => window.zoomIn && zoomIn();
  document.getElementById('zoomOutBtn').onclick = () => window.zoomOut && zoomOut();
  document.getElementById('resetBtn').onclick = () => window.resetZoom && resetZoom();
  document.getElementById('refreshBtn').onclick = () => loadData();
  document.getElementById('fullscreenBtn').onclick = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };
}

document.addEventListener('DOMContentLoaded', init);
