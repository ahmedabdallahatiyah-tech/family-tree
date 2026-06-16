/* ===== شجرة العجمان - التطبيق الرئيسي ===== */

// ====== 1. البيانات الأصلية والمتغيرات ======
const DATA_URL = 'data.json';
let TREE_DATA = null;
let svg, zg, zm, iT, root; // globals used by spec
let allNodes = [];
let isDark = false;
let audioCtx = null;
const sectorMap = { 'حفيظ': 'left', 'فالح': 'center', 'صعب': 'right' };
const GOLD = '#D4A017', WOOD = '#5D4037', LEAF_GREEN = '#2E7D32';

// ====== 2. دوال مساعدة ======
function gid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function count(n) { let c = 1; if (n.children) n.children.forEach(ch => c += count(ch)); return c; }
function maxDepth(n, d) { d = d || 0; let m = d; if (n.children) n.children.forEach(ch => m = Math.max(m, maxDepth(ch, d+1))); return m; }
function allNames(n) { let a = [n.name]; if (n.children) n.children.forEach(c => a = a.concat(allNames(c))); return a; }
function findNode(n, name) { if (n.data.name === name) return n; if (n.children) for (const c of n.children) { const r = findNode(c, name); if (r) return r; } return null; }
function filterTree(n, t) {
  if (!t) return n; const tl = t.toLowerCase();
  const m = n.data.name.toLowerCase().includes(tl);
  let f = []; if (n.children) n.children.forEach(c => { const r = filterTree(c, t); if (r) f.push(r); });
  return (m || f.length > 0) ? { ...n, children: f } : null;
}

function updateDate() {
  const now = new Date();
  document.getElementById('dateDisplay').textContent = now.toLocaleDateString('ar-SA', { weekday:'short', year:'numeric', month:'short', day:'numeric' });
}

function toast(msg, duration) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('visible');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('visible'), duration || 2500);
}

// ====== 3. تحويل البيانات إلى هرمي (toHier) ======
function toHier(data) {
  return d3.hierarchy(data, d => d.children);
}

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
        if (!n) {
          const b = (function getB(p) { return p.branch || (p.parent ? getB(p.parent) : p.name); })(parent);
          n = { id: gid(), name, children: [], depth: pd + 1, parent, branch: b };
          parent.children.push(n);
        }
        anc[lv] = n; parent = n; pd = lv;
      }
    }
  }
  return root;
}

// ====== 4. بناء الشجرة (buildTree) ======
function buildTree() {
  if (!TREE_DATA) return;

  const container = document.getElementById('mainSvg');
  const width = container.clientWidth || 1200;
  const height = container.clientHeight || 800;
  const cx = width / 2, cy = height - 80;

  // Clear
  d3.select(container).selectAll('*').remove();

  svg = d3.select(container)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Defs
  const defs = svg.append('defs');
  defs.append('radialGradient').attr('id','skyGrad')
    .attr('cx','50%').attr('cy','60%').attr('r','60%')
    .append('stop').attr('offset','0%').attr('stop-color','#87CEEB');
  defs.select('#skyGrad').append('stop').attr('offset','100%').attr('stop-color','#E0F7FA');
  defs.append('linearGradient').attr('id','grassGrad').attr('x1','0').attr('y1','0').attr('x2','0').attr('y2','1')
    .append('stop').attr('offset','0%').attr('stop-color','#4CAF50');
  defs.select('#grassGrad').append('stop').attr('offset','100%').attr('stop-color','#2E7D32');
  defs.append('linearGradient').attr('id','trunkGrad').attr('x1','0').attr('y1','0').attr('x2','1').attr('y2','0')
    .append('stop').attr('offset','0%').attr('stop-color','#4E342E');
  defs.select('#trunkGrad').append('stop').attr('offset','50%').attr('stop-color','#6D4C41');
  defs.select('#trunkGrad').append('stop').attr('offset','100%').attr('stop-color','#3E2723');
  defs.append('filter').attr('id','gGlow')
    .append('feGaussianBlur').attr('stdDeviation','2').attr('result','blur');
  defs.select('#gGlow').append('feMerge')
    .append('feMergeNode').attr('in','blur').nextElementSibling && defs.select('#gGlow').select('feMerge').append('feMergeNode').attr('in','SourceGraphic');

  // Zoom group
  zg = svg.append('g').attr('id','zoomGroup');

  // ===== BACKGROUND =====
  // Sky
  zg.append('rect').attr('width',width).attr('height',height).attr('fill','url(#skyGrad)');
  // Hills
  const hills = zg.append('g').attr('opacity','0.15');
  hills.append('ellipse').attr('cx',width*0.2).attr('cy',height-60).attr('rx',width*0.4).attr('ry',140).attr('fill','#3E8E41');
  hills.append('ellipse').attr('cx',width*0.8).attr('cy',height-40).attr('rx',width*0.5).attr('ry',120).attr('fill','#388E3C');
  hills.append('ellipse').attr('cx',width*0.5).attr('cy',height-30).attr('rx',width*0.6).attr('ry',100).attr('fill','#2E7D32');
  // Grass
  zg.append('rect').attr('x',0).attr('y',height-25).attr('width',width).attr('height',25).attr('fill','url(#grassGrad)');

  // ===== BUILD HIERARCHY =====
  root = toHier(TREE_DATA);
  const totalPeople = count(TREE_DATA);
  const gens = maxDepth(TREE_DATA);

  // D3 cluster layout
  const radius = Math.min(width, height) * 0.38;
  const cluster = d3.cluster()
    .size([Math.PI * 0.8, radius])
    .separation((a, b) => (a.data.depth + b.data.depth) * 0.08);

  cluster(root);

  // ===== REMAP SECTORS =====
  // Sector mapping: حفيظ(left:150-210°), فالح(center:70-150°), صعب(right:350-70°)
  // Convert d3 angle (0=right, π/2=down) to SVG layout (root at bottom, up=up)
  // In d3 cluster: x=angle (radians), y=radius
  // Root gets x=Math.PI/2 (pointing up)
  root.x = Math.PI / 2;

  function remapSector(node) {
    if (!node.children) return;
    const branch = node.data.branch || node.data.name;
    const isRoot = node.data.name === 'سايل';

    node.children.forEach((ch, i) => {
      const chBranch = ch.data.branch || ch.data.name;
      const n = node.children.length;
      let angle;

      if (isRoot) {
        // Assign sector based on branch name
        const sector = sectorMap[ch.data.name] || 'center';
        if (sector === 'left') angle = 2.8 + (i / (n + 1)) * 0.5;       // ~160-190°
        else if (sector === 'right') angle = 0.4 + (i / (n + 1)) * 0.5; // ~23-57°
        else angle = 1.4 + (i / (n + 1)) * 0.6;                         // ~80-114°
      } else {
        // Children spread relative to parent
        const spread = 0.5 + (n > 1 ? 0.3 : 0);
        const start = node.x - spread / 2;
        angle = start + (i / (n - 1 || 1)) * spread;
      }

      ch.x = angle;
      remapSector(ch);
    });
  }
  remapSector(root);

  // Min angular gap adjustment for leaf nodes
  function adjustLeafGaps(node) {
    if (!node.children) return;
    adjustLeafGaps.cache = adjustLeafGaps.cache || {};
    const leaves = node.children.filter(c => !c.children || c.children.length === 0);
    if (leaves.length > 1) {
      leaves.sort((a, b) => a.x - b.x);
      let minGap = 0.04;
      for (let i = 1; i < leaves.length; i++) {
        const gap = leaves[i].x - leaves[i-1].x;
        if (gap < minGap) {
          const adjust = (minGap - gap) / 2;
          leaves[i].x += adjust;
          leaves[i-1].x -= adjust;
        }
      }
    }
    node.children.forEach(adjustLeafGaps);
  }
  adjustLeafGaps(root);

  // Recalculate internal node x as average of children
  function avgChildrenX(node) {
    if (!node.children || node.children.length === 0) return;
    node.children.forEach(avgChildrenX);
    node.x = d3.mean(node.children, d => d.x);
  }
  avgChildrenX(root);

  // Convert to cartesian
  function toCart(node) {
    const cx2 = cx, cy2 = cy;
    const px = cx2 + node.y * Math.sin(node.x);
    const py = cy2 - node.y * Math.cos(node.x);
    node.px = px; node.py = py;
    if (node.children) node.children.forEach(toCart);
  }
  toCart(root);
  // Root position
  root.px = cx; root.py = cy;

  // ===== TRUNK =====
  const trunkG = zg.append('g');
  // Main trunk (trapezoid)
  trunkG.append('path')
    .attr('d', `M${cx-14},${cy} L${cx-6},${cy-140} L${cx+6},${cy-140} L${cx+14},${cy} Z`)
    .attr('fill', 'url(#trunkGrad)');
  // Trunk rings
  for (let r = 20; r < 140; r += 18) {
    trunkG.append('ellipse')
      .attr('cx', cx).attr('cy', cy - r)
      .attr('rx', 12 - r * 0.04).attr('ry', 4)
      .attr('fill', 'none').attr('stroke', '#3E2723').attr('stroke-width', 0.8).attr('opacity', 0.4);
  }
  // Roots at base
  for (let s = -1; s <= 1; s += 2) {
    trunkG.append('path')
      .attr('d', `M${cx + s*12},${cy} Q${cx + s*40},${cy+10} ${cx + s*60},${cy+5}`)
      .attr('fill', 'none').attr('stroke', '#4E342E').attr('stroke-width', 3).attr('stroke-linecap', 'round');
  }

  // ===== ALL NODES COLLECTION =====
  allNodes = [];
  function collect(n) { allNodes.push(n); if (n.children) n.children.forEach(collect); }
  collect(root);

  // ===== BRANCHES =====
  const branchG = zg.append('g').attr('id','branches');
  function drawBranches(node) {
    if (!node.children) return;
    node.children.forEach(ch => {
      // Quadratic bezier from parent to child
      const mx = (node.px + ch.px) / 2;
      const my = (node.py + ch.py) / 2 - 20;
      branchG.append('path')
        .attr('d', `M${node.px},${node.py-10} Q${mx},${my} ${ch.px},${ch.py}`)
        .attr('fill', 'none').attr('stroke', '#6D4C41').attr('stroke-width', Math.max(0.8, 2.5 - ch.data.depth * 0.2))
        .attr('stroke-linecap', 'round').attr('opacity', '0.7');
      drawBranches(ch);
    });
  }
  drawBranches(root);

  // ===== NODES (circles/leaves) AND LABELS =====
  const nodeG = zg.append('g').attr('id','nodes');

  allNodes.forEach(n => {
    if (n.data.name === 'سايل') {
      // Root label at base of trunk
      nodeG.append('text')
        .attr('x', n.px).attr('y', n.py + 22)
        .attr('text-anchor', 'middle').attr('fill', GOLD)
        .attr('font-family', 'Amiri, serif').attr('font-size', '10').attr('font-weight', 'bold')
        .text(n.data.name);
      return;
    }

    const isLeaf = !n.children || n.children.length === 0;
    const depth = n.data.depth || 0;
    const isTop = depth <= 1;
    const isMid = depth > 1 && depth <= 3;

    // Node shape
    const g = nodeG.append('g')
      .attr('class', 'tree-node')
      .attr('data-name', n.data.name)
      .attr('data-depth', depth)
      .attr('transform', `translate(${n.px},${n.py})`);

    let shape;
    if (isTop) {
      // Golden circle for top-level
      shape = g.append('circle').attr('r', 6).attr('fill', GOLD).attr('stroke', '#b8860b').attr('stroke-width', 1);
      g.append('circle').attr('r', 3).attr('fill', '#FFFCF5').attr('opacity', 0.6);
    } else if (isMid || !isLeaf) {
      // Brown circle for intermediate
      shape = g.append('circle').attr('r', 4.5).attr('fill', '#8D6E63').attr('stroke', '#6D4C41').attr('stroke-width', 0.8);
    } else {
      // Leaf shape for leaf nodes
      const leafSize = 5 + Math.random() * 2;
      shape = g.append('path')
        .attr('d', `M0,0 C-4,-3 -5,-10 -2,-14 C2,-10 3,-3 0,0 Z`)
        .attr('fill', isDark ? '#1B5E20' : LEAF_GREEN)
        .attr('stroke', isDark ? '#0D3B0F' : '#1B5E20')
        .attr('stroke-width', 0.5)
        .attr('transform', `rotate(${Math.random()*30-15}) scale(${leafSize/6})`);
    }

    // Label
    const fontSize = isTop ? 8 : (isLeaf ? 6.5 : 7);
    const labelColor = isTop ? GOLD : (isLeaf ? (isDark ? '#81C784' : '#1B5E20') : '#4E342E');
    g.append('text')
      .attr('dy', isTop ? -10 : -9)
      .attr('text-anchor', 'middle')
      .attr('fill', labelColor)
      .attr('font-family', 'Amiri, serif')
      .attr('font-size', fontSize)
      .attr('font-weight', isTop ? 'bold' : 'normal')
      .text(n.data.name);

    // Interactive: hover tooltip
    g.style('cursor', 'pointer');
    g.on('mouseenter', (e) => showTooltip(e, n));
    g.on('mousemove', (e) => moveTooltip(e));
    g.on('mouseleave', hideTooltip);
    g.on('click', (e) => { e.stopPropagation(); focusNode(n); });

    // Store ref
    n._g = g;
    n._shape = shape;
  });

  // ===== LEGEND =====
  document.getElementById('totalCount').textContent = totalPeople;
  document.getElementById('genCount').textContent = gens;

  // ===== ZOOM =====
  const zoom = d3.zoom()
    .scaleExtent([0.3, 5])
    .on('zoom', (event) => {
      zg.attr('transform', event.transform);
    });
  svg.call(zoom);
  svg.on('click', () => { hideTooltip(); });

  // Initial zoom to fit
  svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(1));

  // Birds animation
  addBirds(width, height);

  window._zoom = zoom;
  toast('🌳 تم بناء شجرة العجمان بنجاح', 2000);
}

// ====== 5. TOOLTIP ======
function showTooltip(event, node) {
  const d = node.data;
  const tip = document.getElementById('tooltip');
  document.getElementById('ttName').textContent = d.name;
  document.getElementById('ttGen').textContent = d.depth || 0;
  document.getElementById('ttBranch').textContent = d.branch || '—';
  document.getElementById('ttFather').textContent = d.parent ? d.parent.data.name : '—';
  document.getElementById('ttChildren').textContent = d.children ? d.children.length : 0;
  document.getElementById('ttDesc').textContent = count(d) - 1;
  tip.classList.add('visible');
  moveTooltip(event);
}

function moveTooltip(event) {
  const tip = document.getElementById('tooltip');
  tip.style.left = (event.clientX + 16) + 'px';
  tip.style.top = (event.clientY - 10) + 'px';
  // Keep in bounds
  const r = tip.getBoundingClientRect();
  if (r.right > window.innerWidth) tip.style.left = (event.clientX - r.width - 16) + 'px';
  if (r.bottom > window.innerHeight) tip.style.top = (event.clientY - r.height + 10) + 'px';
}

function hideTooltip() {
  document.getElementById('tooltip').classList.remove('visible');
}

// ====== 6. FOCUS NODE (search result) ======
function focusNode(node) {
  if (!node || !node._g) return;
  // Highlight
  d3.selectAll('.tree-node').style('opacity', 0.15);
  node._g.style('opacity', 1);
  // Highlight ancestors
  let p = node;
  while (p.parent) { p = p.parent; if (p._g) p._g.style('opacity', 1); }
  // Highlight children
  function highChildren(n) { if (n._g) n._g.style('opacity', 1); if (n.children) n.children.forEach(highChildren); }
  if (node.children) node.children.forEach(highChildren);

  toast('🔍 ' + node.data.name, 2000);
}

function unFocusAll() {
  d3.selectAll('.tree-node').style('opacity', 1);
}

// ====== 7. SEARCH ======
function performSearch() {
  const input = document.getElementById('searchInput');
  const term = input.value.trim();
  if (!term || !TREE_DATA) return;

  const all = allNames(TREE_DATA);
  const matches = all.filter(n => n.includes(term));
  const exact = all.filter(n => n === term);

  if (matches.length === 0) {
    toast('🔍 لا توجد نتائج لـ "' + term + '"', 2000);
    unFocusAll();
    return;
  }

  toast('🔍 ' + matches.length + ' نتيجة', 2000);

  // Find exact match first
  if (exact.length > 0) {
    const node = findNode(root, exact[0]);
    if (node) focusNode(node);
  } else {
    // Highlight all matches
    d3.selectAll('.tree-node').style('opacity', 0.08);
    matches.forEach(name => {
      const n = findNode(root, name);
      if (n && n._g) n._g.style('opacity', 1);
    });
  }
}

// ====== 8. DARK MODE ======
function toggleDark() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('darkModeBtn').textContent = isDark ? '☀️' : '🌙';
  // Rebuild tree with new colors
  buildTree();
  toast(isDark ? '🌙 الوضع الليلي' : '☀️ الوضع النهاري', 1500);
}

// ====== 9. BIRDS ANIMATION ======
function addBirds(w, h) {
  const bg = zg.select('rect').node();
  if (!bg) return;
  const birdG = zg.append('g').attr('id', 'birds').attr('opacity', 0.3);

  for (let i = 0; i < 5; i++) {
    const bx = 100 + Math.random() * (w - 200);
    const by = 30 + Math.random() * 100;
    const b = birdG.append('path')
      .attr('d', `M${bx},${by} Q${bx+8},${by-6} ${bx+16},${by} Q${bx+8},${by-4} ${bx},${by}`)
      .attr('fill', 'none').attr('stroke', '#555').attr('stroke-width', 1.2);

    animateBird(b, bx, by, w);
  }
}

function animateBird(el, x, y, w) {
  const speed = 3000 + Math.random() * 4000;
  const dy = (Math.random() - 0.5) * 60;

  el.transition()
    .duration(speed)
    .attr('transform', `translate(${w * 0.3},${dy})`)
    .attr('opacity', 0)
    .transition()
    .duration(0)
    .attr('transform', `translate(${-w * 0.1},${dy})`)
    .attr('opacity', 0.3)
    .transition()
    .duration(speed)
    .attr('transform', `translate(0,0)`)
    .on('end', () => animateBird(el, x, y, w));
}

// ====== 10. CSV UPLOAD ======
function handleCSVUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const csvData = e.target.result;
      TREE_DATA = parseCSV(csvData);
      localStorage.setItem('customData', JSON.stringify(TREE_DATA));
      buildTree();
      toast('📂 تم تحميل البيانات الجديدة', 2000);
    } catch(err) {
      toast('⚠ خطأ في قراءة الملف: ' + err.message, 3000);
    }
  };
  reader.readAsText(file);
}

// ====== 11. SAVE PNG ======
function savePNG() {
  toast('📷 جاري حفظ الصورة...', 1500);
  const container = document.getElementById('mainSvg');
  const svgData = new XMLSerializer().serializeToString(container);
  const canvas = document.createElement('canvas');
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * 2; canvas.height = rect.height * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  const img = new Image();
  const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  img.onload = () => {
    ctx.drawImage(img, 0, 0, rect.width, rect.height);
    URL.revokeObjectURL(url);
    const a = document.createElement('a');
    a.download = 'شجرة_العجمان.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
    toast('✅ تم حفظ الصورة', 1500);
  };
  img.onerror = () => toast('⚠ فشل حفظ الصورة، جرب الطباعة بدلاً', 2000);
  img.src = url;
}

// ====== 12. PRINT ======
function printTree() {
  document.getElementById('printDate').textContent = new Date().toLocaleDateString('ar-SA');
  document.getElementById('printHeader').style.display = 'block';
  window.print();
  setTimeout(() => document.getElementById('printHeader').style.display = 'none', 500);
}

// ====== 13. LOAD DATA ======
async function loadData() {
  try {
    const r = await fetch(DATA_URL + '?t=' + Date.now());
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (!data || !data.name) throw new Error('بيانات غير صالحة');
    TREE_DATA = data;

    // Add parent/branch refs
    (function addRefs(n, p, b) {
      n.parent = p; n.branch = n.branch || b || n.name;
      if (n.children) n.children.forEach(c => addRefs(c, n, n.branch));
    })(TREE_DATA, null, TREE_DATA.name === 'سايل' ? 'القبيلة' : TREE_DATA.name);

    buildTree();
  } catch (e) {
    console.error(e);
    toast('⚠ فشل تحميل البيانات: ' + e.message, 3000);
    // Try cache
    const c = localStorage.getItem('cache');
    if (c) {
      try { TREE_DATA = JSON.parse(c); buildTree(); toast('📦 تم تحميل من المخبأ', 2000); } catch(e2) {}
    }
  }
}

// ====== 14. WELCOME OVERLAY ======
document.addEventListener('DOMContentLoaded', () => {
  updateDate();
  setInterval(updateDate, 60000);

  document.getElementById('enterBtn').onclick = () => {
    document.getElementById('welcomeOverlay').classList.add('hidden');
    loadData();
  };

  // Event binding
  document.getElementById('searchBtn').onclick = performSearch;
  document.getElementById('searchInput').onkeyup = (e) => {
    if (e.key === 'Enter') performSearch();
    if (!e.target.value) unFocusAll();
  };
  document.getElementById('resetZoomBtn').onclick = () => {
    if (window._zoom) {
      d3.select('#mainSvg').transition().duration(500)
        .call(window._zoom.transform, d3.zoomIdentity);
      unFocusAll();
    }
  };
  document.getElementById('darkModeBtn').onclick = toggleDark;
  document.getElementById('savePngBtn').onclick = savePNG;
  document.getElementById('printBtn').onclick = printTree;
  document.getElementById('fullscreenBtn').onclick = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };
  document.getElementById('csvUpload').onchange = (e) => {
    if (e.target.files[0]) handleCSVUpload(e.target.files[0]);
  };

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'f') { e.preventDefault(); document.getElementById('searchInput').focus(); }
    if (e.key === 'Escape') { unFocusAll(); hideTooltip(); }
  });
});
