/* ===== شجرة العجمان v2 - التطبيق المتكامل ===== */

// ====== 1. المتغيرات العمومية ======
let TREE_DATA = null, root, svg, zg, bgG, zoom;
let allNodes = [], isDark = false, selectedNode = null;

const SECTOR_GAP = 0.05;
const COLORS = ['#5D4037','#2a6018','#1a5080','#b03020','#704010','#5a30a0','#1a7050','#903050'];
const leafGrads = ['#4CAF50','#66BB6A','#81C784','#388E3C','#2E7D32','#43A047','#8BC34A','#558B2F'];

// ====== 2. دوال مساعدة ======
const gid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);
const count = n => { let c=1; if(n.children) n.children.forEach(ch=>c+=count(ch)); return c; };
const maxDepth = (n,d=0) => { let m=d; if(n.children) n.children.forEach(ch=>m=Math.max(m,maxDepth(ch,d+1))); return m; };
const allNames = n => { let a=[n.data.name]; if(n.children) n.children.forEach(c=>a=a.concat(allNames(c))); return a; };

function findNode(n,name) {
  if(n.data.name===name) return n;
  if(n.children) for(const c of n.children){const r=findNode(c,name);if(r)return r;}
  return null;
}

function getPath(node) {
  const p=[];
  let n=node;
  while(n){p.unshift(n.data.name);n=n.parent;}
  return p.join(' ← ');
}

// ====== 3. تحويل البيانات ======
function toHierStandard(data) {
  // Convert from array children format to nested-object format
  function convert(node) {
    const obj = {};
    if (node.children) node.children.forEach(c => { obj[c.name] = convert(c); });
    return obj;
  }
  const nested = {}; nested[data.name] = convert(data);
  return nested;
}

function toHier(name, obj) {
  const kids = Object.entries(obj).map(([k, v]) => toHier(k, v));
  return { name, children: kids.length ? kids : null };
}

// ====== 4. تحديث التاريخ ======
function updateDate() {
  document.getElementById('dateDisplay').textContent = new Date().toLocaleDateString('ar-SA', { weekday:'short', year:'numeric', month:'short', day:'numeric' });
}

function toast(msg, duration) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('visible');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('visible'), duration||2500);
}

// ====== 5. بناء الشجرة ======
function buildTree() {
  if (!TREE_DATA) return;

  const container = document.getElementById('mainSvg');
  const isMobile = window.innerWidth < 600;
  const W = container.clientWidth || 1200;
  const H = container.clientHeight || 800;
  const CX = W / 2, CY = isMobile ? H * 0.7 : H * 0.75;
  const RADIUS = Math.min(W, H) * (isMobile ? 0.85 : 0.88) * 0.4;

  // Clear
  d3.select(container).selectAll('*').remove();

  svg = d3.select(container)
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // ===== DEFS =====
  const defs = svg.append('defs');

  // Sky gradient
  defs.append('radialGradient').attr('id','skyG').attr('cx','50%').attr('cy','50%').attr('r','70%')
    .append('stop').attr('offset','0%').attr('stop-color','#B3E5FC');
  defs.select('#skyG').append('stop').attr('offset','100%').attr('stop-color','#E1F5FE');

  // Leaf gradients
  leafGrads.forEach((c,i) => {
    defs.append('linearGradient').attr('id',`leafG${i}`).attr('x1','0').attr('y1','0').attr('x2','0').attr('y2','1')
      .append('stop').attr('offset','0%').attr('stop-color',c);
    defs.select(`#leafG${i}`).append('stop').attr('offset','100%').attr('stop-color',darken(c,30));
  });

  // Node radial gradients
  COLORS.forEach((c,i) => {
    defs.append('radialGradient').attr('id',`nodeG${i}`).attr('cx','35%').attr('cy','35%').attr('r','65%')
      .append('stop').attr('offset','0%').attr('stop-color',lighten(c,40));
    defs.select(`#nodeG${i}`).append('stop').attr('offset','100%').attr('stop-color',c);
  });

  // Filters
  defs.append('filter').attr('id','srGlow')
    .append('feGaussianBlur').attr('stdDeviation','3').attr('result','blur');
  defs.select('#srGlow').append('feMerge')
    .append('feMergeNode').attr('in','blur');
  defs.select('#srGlow').select('feMerge').append('feMergeNode').attr('in','SourceGraphic');

  defs.append('filter').attr('id','barkF')
    .append('feTurbulence').attr('type','fractalNoise').attr('baseFrequency','0.05').attr('numOctaves','3');
  defs.select('#barkF').append('feColorMatrix').attr('type','matrix')
    .attr('values','0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0 0.15  0 0 0 0.3 0');

  defs.append('filter').attr('id','shadow')
    .append('feDropShadow').attr('dx','1').attr('dy','1').attr('stdDeviation','2').attr('flood-opacity','0.25');

  // ===== BACKGROUND (outside zoom) =====
  bgG = svg.append('g').attr('id','background');

  // Sky
  bgG.append('rect').attr('width',W).attr('height',H).attr('fill','url(#skyG)');

  // Clouds
  const cloudG = bgG.append('g').attr('opacity',0.3);
  for(let i=0;i<6;i++) {
    const cx = 100 + Math.random()*(W-200), cy = 30 + Math.random()*120;
    const g = cloudG.append('g').attr('transform',`translate(${cx},${cy})`);
    g.append('ellipse').attr('rx',40+Math.random()*30).attr('ry',12+Math.random()*8).attr('fill','#fff');
    g.append('ellipse').attr('cx',-15).attr('rx',25+Math.random()*20).attr('ry',10+Math.random()*6).attr('fill','#fff');
    g.append('ellipse').attr('cx',20).attr('rx',20+Math.random()*15).attr('ry',9+Math.random()*5).attr('fill','#fff');
  }

  // Hills
  const hillG = bgG.append('g').attr('opacity',0.12);
  hillG.append('ellipse').attr('cx',W*0.2).attr('cy',H-50).attr('rx',W*0.5).attr('ry',150).attr('fill','#388E3C');
  hillG.append('ellipse').attr('cx',W*0.8).attr('cy',H-30).attr('rx',W*0.6).attr('ry',120).attr('fill','#2E7D32');

  // Grass (inside zoom group to move with tree)
  const grassG = bgG.append('g').attr('id','grass');
  for(let i=0;i<200;i++) {
    const gx = Math.random()*W, gy = H-25+Math.random()*15;
    const gh = 8+Math.random()*20, gw = 1.5+Math.random()*2;
    grassG.append('path')
      .attr('d', `M${gx},${gy} Q${gx+Math.sin(i)*2},${gy-gh*0.5} ${gx+Math.sin(i*2)*1.5},${gy-gh}`)
      .attr('fill','none').attr('stroke',['#2E7D32','#388E3C','#4CAF50','#1B5E20'][i%4])
      .attr('stroke-width',gw).attr('stroke-linecap','round');
  }

  // Flowers
  for(let i=0;i<30;i++) {
    const fx = 30+Math.random()*(W-60), fy = H-30+Math.random()*15;
    const fc = ['#E91E63','#FF5722','#FF9800','#E040FB','#FF4081','#F44336','#FFD54F'][i%7];
    bgG.append('circle').attr('cx',fx).attr('cy',fy).attr('r',2+Math.random()*2).attr('fill',fc).attr('opacity',0.6);
  }

  // ===== ZOOM GROUP =====
  zg = svg.append('g').attr('id','zoomGroup');

  // ===== HIERARCHY =====
  const nested = toHierStandard(TREE_DATA);
  const hierData = toHier('سايل', nested['سايل']);
  root = d3.hierarchy(hierData);

  // Add branch info
  (function addMeta(n, parentBranch) {
    n.data.branch = n.data.branch || (n.depth === 1 ? n.data.name : parentBranch);
    if (n.children) n.children.forEach(c => addMeta(c, n.data.branch));
  })(root, 'القبيلة');

  const totalPeople = count(root);
  const gens = maxDepth(root);

  // ===== CLUSTER LAYOUT =====
  const cluster = d3.cluster().size([Math.PI, RADIUS]).separation((a,b)=>0.08*(a.data.depth+b.data.depth));
  cluster(root);

  // ===== REMAP SECTORS =====
  const sectorMap = { 'حفيظ': 2.5, 'فالح': 1.4, 'صعب': 0.4 };

  function remapSector(node, parentAngle) {
    if (!node.children) return;
    const isRoot = node.depth === 0;

    node.children.forEach((ch, i) => {
      let angle;
      if (isRoot && sectorMap[ch.data.name] !== undefined) {
        angle = sectorMap[ch.data.name] + (i * 0.1);
      } else {
        const spread = 0.4 + (node.children.length > 1 ? 0.2 : 0);
        const start = (parentAngle || node.x) - spread / 2;
        angle = start + (i / Math.max(node.children.length - 1, 1)) * spread;
      }
      ch.x = Math.max(0.05, Math.min(Math.PI - 0.05, angle));
      remapSector(ch, ch.x);
    });
  }
  remapSector(root, Math.PI/2);
  root.x = Math.PI / 2;

  // Min gap for leaves
  function fixGaps(n) {
    if (!n.children) return;
    const leaves = n.children.filter(c => !c.children || c.children.length === 0);
    if (leaves.length > 1) {
      leaves.sort((a,b)=>a.x-b.x);
      for(let i=1;i<leaves.length;i++) {
        if (leaves[i].x - leaves[i-1].x < 0.04) {
          leaves[i].x += 0.02; leaves[i-1].x -= 0.02;
        }
      }
    }
    n.children.forEach(fixGaps);
  }
  fixGaps(root);

  // Recalculate x as average of children
  function avgX(n) {
    if (!n.children || n.children.length === 0) return;
    n.children.forEach(avgX);
    n.x = d3.mean(n.children, d => d.x);
  }
  avgX(root);

  // ===== POLAR TO CARTESIAN =====
  const AO = Math.PI;
  allNodes = [];

  function toCart(node) {
    const px = CX + node.y * Math.cos(node.x + AO);
    const py = CY + node.y * Math.sin(node.x + AO);
    node.px = px; node.py = py;
    node._leaf = !node.children || node.children.length === 0;
    allNodes.push(node);
    if (node.children) node.children.forEach(toCart);
  }
  toCart(root);
  root.px = CX; root.py = CY;

  // ===== TRUNK =====
  const trunkG = zg.append('g');
  const tw = 12;
  trunkG.append('path')
    .attr('d', `M${CX-tw},${CY-10} L${CX-tw+2},${CY-130} L${CX+tw-2},${CY-130} L${CX+tw},${CY-10} Z`)
    .attr('fill','url(#nodeG0)').attr('filter','url(#shadow)');
  // Rings
  for(let r=18;r<130;r+=14) {
    trunkG.append('ellipse').attr('cx',CX).attr('cy',CY-r)
      .attr('rx',11 - r*0.04).attr('ry',3)
      .attr('fill','none').attr('stroke','#3E2723').attr('stroke-width',0.7).attr('opacity',0.3);
  }
  // Roots
  for(let s=-1;s<=1;s+=2) {
    trunkG.append('path')
      .attr('d', `M${CX+s*10},${CY-5} Q${CX+s*35},${CY+8} ${CX+s*55},${CY+3}`)
      .attr('fill','none').attr('stroke','#4E342E').attr('stroke-width',2.5).attr('stroke-linecap','round');
  }

  // ===== BRANCHES =====
  const branchG = zg.append('g').attr('id','branches');

  function drawBranches(node) {
    if (!node.children) return;
    node.children.forEach(ch => {
      const dx = ch.px - node.px, dy = ch.py - node.py;
      const cpx1 = node.px + dx*0.3, cpy1 = node.py + dy*0.3 - 20 - Math.random()*15;
      const cpx2 = node.px + dx*0.7, cpy2 = node.py + dy*0.7 - 15 - Math.random()*10;
      const dist = Math.sqrt(dx*dx+dy*dy);
      const w = Math.max(0.5, 3 - node.depth * 0.3);

      branchG.append('path')
        .attr('d', `M${node.px},${node.py-8} C${cpx1},${cpy1} ${cpx2},${cpy2} ${ch.px},${ch.py}`)
        .attr('fill','none').attr('stroke','#6D4C41').attr('stroke-width',w)
        .attr('stroke-linecap','round').attr('opacity',0.6);
      // Light edge for depth
      branchG.append('path')
        .attr('d', `M${node.px},${node.py-8} C${cpx1},${cpy1-2} ${cpx2},${cpy2-2} ${ch.px},${ch.py-1}`)
        .attr('fill','none').attr('stroke','#8D6E63').attr('stroke-width',Math.max(0.3,w*0.3))
        .attr('stroke-linecap','round').attr('opacity',0.2);

      drawBranches(ch);
    });
  }
  drawBranches(root);

  // ===== NODES =====
  const nodeG = zg.append('g').attr('id','nodes');
  const labelG = zg.append('g').attr('id','labels');

  allNodes.forEach(n => {
    if (n.data.name === 'سايل') {
      labelG.append('text')
        .attr('x',n.px).attr('y',n.py+20)
        .attr('text-anchor','middle').attr('fill','#D4A017')
        .attr('font-family','Amiri,serif').attr('font-size','11').attr('font-weight','bold')
        .text(n.data.name);
      return;
    }

    const depth = n.depth, isLeaf = n._leaf;
    const g = nodeG.append('g')
      .attr('class','tree-node').attr('data-name',n.data.name)
      .attr('transform',`translate(${n.px},${n.py})`)
      .style('cursor','pointer');

    if (isLeaf) {
      // Leaf shape with stem and veins
      const gi = Math.floor(Math.random() * leafGrads.length);
      const ls = 8 + Math.random() * 4;
      const rot = Math.random() * 40 - 20;
      g.append('path')
        .attr('d', `M0,0 C-6,-4 -8,-14 -3,-20 C3,-16 5,-6 0,0 Z`)
        .attr('fill', `url(#leafG${gi})`).attr('stroke','#1B5E20').attr('stroke-width',0.5)
        .attr('transform', `rotate(${rot}) scale(${ls/7})`);
      // Stem
      g.append('line').attr('x1',0).attr('y1',0).attr('x2',0).attr('y2',4)
        .attr('stroke','#5D4037').attr('stroke-width',1).attr('transform',`rotate(${rot})`);
      // Vein
      g.append('line').attr('x1',0).attr('y1',0).attr('x2',0).attr('y2',-14)
        .attr('stroke','#1B5E20').attr('stroke-width',0.4).attr('opacity',0.3)
        .attr('transform',`rotate(${rot})`);
      // Label
      labelG.append('text')
        .attr('x',n.px).attr('y',n.py-10)
        .attr('text-anchor','middle').attr('font-family','Amiri,serif')
        .attr('font-size','6.5').attr('fill','#1B5E20').text(n.data.name);
    } else {
      // Internal node: circle with gradient
      const r = Math.max(4, 11 - depth);
      g.append('circle').attr('r',r).attr('fill',`url(#nodeG${Math.min(depth,COLORS.length-1)})`)
        .attr('stroke','rgba(0,0,0,0.3)').attr('stroke-width',0.8);
      g.append('circle').attr('r',r*0.35).attr('fill','rgba(255,255,255,0.15)').attr('cx',-r*0.3).attr('cy',-r*0.3);
      // Label inside
      g.append('text')
        .attr('dy','0.3em').attr('text-anchor','middle').attr('font-family','Amiri,serif')
        .attr('font-size','5').attr('fill','#FFF').attr('font-weight','bold')
        .text(shortName(n.data.name,2));
      // Full name near
      labelG.append('text')
        .attr('x',n.px).attr('y',n.py+r+9)
        .attr('text-anchor','middle').attr('font-family','Amiri,serif')
        .attr('font-size','6').attr('fill','#4E342E').text(n.data.name);
    }

    // Hover & click
    g.on('mouseenter', (e) => showTooltip(e, n));
    g.on('mousemove', (e) => moveTooltip(e));
    g.on('mouseleave', hideTooltip);
    g.on('click', (e) => { e.stopPropagation(); focusNode(n); });
    n._g = g;
  });

  // ===== INFO =====
  document.getElementById('totalCount').textContent = totalPeople;
  document.getElementById('genCount').textContent = gens;

  // ===== ZOOM =====
  zoom = d3.zoom().scaleExtent([0.2,6]).on('zoom', (event) => {
    zg.attr('transform', event.transform);
  });
  svg.call(zoom);
  svg.on('click', hideTooltip);

  // Fit to view
  setTimeout(() => {
    svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(W*0.1,0).scale(1));
  }, 100);

  // ===== BIRDS =====
  for(let i=0;i<20;i++) addBird(W,H);

  toast('✅ تم بناء الشجرة', 1500);
}

function shortName(name, max) {
  if (name.length <= max) return name;
  return name.slice(0, max);
}

function lighten(c, p) {
  const h = parseInt(c.slice(1),16);
  const r = Math.min(255,(h>>16)+p);
  const g = Math.min(255,((h>>8)&0xFF)+p);
  const b = Math.min(255,(h&0xFF)+p);
  return `rgb(${r},${g},${b})`;
}
function darken(c, p) {
  const h = parseInt(c.slice(1),16);
  const r = Math.max(0,(h>>16)-p);
  const g = Math.max(0,((h>>8)&0xFF)-p);
  const b = Math.max(0,(h&0xFF)-p);
  return `rgb(${r},${g},${b})`;
}

// ====== 6. BIRDS ======
function addBird(W,H) {
  const bx = Math.random()*W, by = 30+Math.random()*80;
  const bird = bgG.append('g').attr('transform',`translate(${bx},${by})`).attr('opacity',0.3);
  const body = bird.append('path')
    .attr('d', `M-6,0 Q-3,-5 0,0 Q3,-5 6,0`)
    .attr('fill','none').attr('stroke','#444').attr('stroke-width',1.2).attr('stroke-linecap','round');

  function flap() {
    body.transition().duration(200).attr('transform','scale(1,0.6)')
      .transition().duration(200).attr('transform','scale(1,1.2)')
      .transition().duration(200).attr('transform','scale(1,0.8)')
      .transition().duration(200).attr('transform','scale(1,1)')
      .transition().duration(100).on('end', flap);
  }
  flap();

  // Slow drift
  const speed = 6000+Math.random()*8000;
  const tx = (Math.random()-0.5)*W*0.4;
  const ty = (Math.random()-0.5)*60;
  bird.transition().duration(speed).attr('transform',`translate(${bx+tx},${by+ty})`).attr('opacity',0.1)
    .transition().duration(speed).attr('transform',`translate(${bx},${by})`).attr('opacity',0.3)
    .transition().duration(speed).on('end', () => addBird(W,H));
  bird.node() && setTimeout(() => bird.remove(), speed*2);
}

// ====== 7. TOOLTIP ======
function showTooltip(event, node) {
  const d = node.data;
  const tip = document.getElementById('tooltip');
  const path = getPath(node);
  document.getElementById('ttName').textContent = d.name;
  document.getElementById('ttGen').textContent = d.depth || 0;
  document.getElementById('ttBranch').textContent = d.branch || '—';
  document.getElementById('ttFather').textContent = node.parent ? node.parent.data.name : '—';
  document.getElementById('ttChildren').textContent = d.children ? d.children.length : 0;
  document.getElementById('ttDesc').textContent = count(node) - 1;
  // Add path info
  const existing = tip.querySelector('.tt-path');
  if (existing) existing.remove();
  const pathEl = document.createElement('div');
  pathEl.className = 'tt-path'; pathEl.style.cssText = 'font-size:0.7rem;color:#8D6E63;margin-top:4px;border-top:1px solid #D4A01722;padding-top:4px;';
  pathEl.textContent = '↕ ' + path.slice(0,60) + (path.length>60?'...':'');
  tip.querySelector('.tt-name').after(pathEl);

  tip.classList.add('visible');
  moveTooltip(event);
}

function moveTooltip(event) {
  const tip = document.getElementById('tooltip');
  tip.style.left = (event.clientX+16)+'px'; tip.style.top = (event.clientY-10)+'px';
  const r = tip.getBoundingClientRect();
  if (r.right > window.innerWidth) tip.style.left = (event.clientX-r.width-16)+'px';
  if (r.bottom > window.innerHeight) tip.style.top = (event.clientY-r.height+10)+'px';
}
const hideTooltip = () => document.getElementById('tooltip').classList.remove('visible');

// ====== 8. FOCUS & SEARCH ======
function focusNode(node) {
  if (!node || !node._g) return;
  d3.selectAll('.tree-node').style('opacity',0.12);
  node._g.style('opacity',1).style('filter','url(#srGlow)');
  // Ancestors
  let p = node.parent;
  while(p){if(p._g){p._g.style('opacity',1);}p=p.parent;}
  // Children
  (function highChildren(n) {
    if (n._g) { n._g.style('opacity',1); if (n !== node) n._g.style('filter','url(#srGlow)'); }
    if (n.children) n.children.forEach(highChildren);
  })(node);

  // Zoom to node
  const W = document.getElementById('mainSvg').clientWidth;
  const H = document.getElementById('mainSvg').clientHeight;
  const scale = 2.5;
  const tx = W/2 - node.px*scale, ty = H/2 - node.py*scale;
  svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity.translate(tx,ty).scale(scale));

  toast('🔍 ' + node.data.name, 2000);
}

function unFocusAll() {
  d3.selectAll('.tree-node').style('opacity',1).style('filter','none');
  svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
}

function performSearch() {
  const input = document.getElementById('searchInput');
  const term = input.value.trim();
  if (!term || !root) return;

  const all = allNames(root);
  const exact = all.filter(n => n === term);

  if (exact.length > 0) {
    const node = findNode(root, exact[0]);
    if (node) focusNode(node);
    toast('🔍 ' + exact[0], 1500);
  } else {
    const matches = all.filter(n => n.includes(term));
    if (matches.length === 0) { toast('❌ لا توجد نتائج', 2000); unFocusAll(); return; }
    d3.selectAll('.tree-node').style('opacity',0.07);
    matches.forEach(name => {
      const n = findNode(root, name);
      if (n && n._g) n._g.style('opacity',1).style('filter','url(#srGlow)');
    });
    toast('🔍 ' + matches.length + ' نتيجة', 2000);
  }
}

// ====== 9. DARK MODE ======
function toggleDark() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('darkModeBtn').textContent = isDark ? '☀️' : '🌙';
  // Simple theme: just invert some colors via CSS
  if (isDark) {
    d3.select('#skyG').select('stop').attr('stop-color','#0d0d1a');
    d3.select('#skyG').selectAll('stop').filter(function(){return d3.select(this).attr('offset')==='100%';}).attr('stop-color','#1a1a2e');
    d3.selectAll('#branches path').attr('stroke','#8D6E63').attr('opacity',0.8);
    d3.selectAll('#labels text').attr('fill','#e0d5c1');
  } else {
    d3.select('#skyG').select('stop').attr('stop-color','#B3E5FC');
    d3.select('#skyG').selectAll('stop').filter(function(){return d3.select(this).attr('offset')==='100%';}).attr('stop-color','#E1F5FE');
    d3.selectAll('#branches path').attr('stroke','#6D4C41').attr('opacity',0.6);
    d3.selectAll('#labels text').attr('fill',function(){return this.textContent==='سايل'?'#D4A017':'#4E342E';});
  }
  toast(isDark ? '🌙 الوضع الليلي' : '☀️ الوضع النهاري', 1500);
}

// ====== 10. SAVE PNG ======
function savePNG() {
  toast('📷 جاري حفظ الصورة...', 1500);
  const svgEl = document.getElementById('mainSvg');
  const s = new XMLSerializer().serializeToString(svgEl);
  const c = document.createElement('canvas');
  const r = svgEl.getBoundingClientRect();
  c.width = r.width*2; c.height = r.height*2;
  const ctx = c.getContext('2d'); ctx.scale(2,2);
  const img = new Image();
  const b = new Blob([s],{type:'image/svg+xml;charset=utf-8'});
  const u = URL.createObjectURL(b);
  img.onload = () => {
    ctx.drawImage(img,0,0,r.width,r.height);
    URL.revokeObjectURL(u);
    const a = document.createElement('a');
    a.download = 'شجرة_العجمان.png'; a.href = c.toDataURL('image/png'); a.click();
    toast('✅ تم حفظ الصورة', 1500);
  };
  img.onerror = () => toast('⚠ فشل الحفظ، استخدم الطباعة', 2000);
  img.src = u;
}

// ====== 11. PRINT ======
function printTree() {
  document.getElementById('printDate').textContent = new Date().toLocaleDateString('ar-SA');
  document.getElementById('printHeader').style.display = 'block';
  window.print();
  setTimeout(() => document.getElementById('printHeader').style.display = 'none', 500);
}

// ====== 12. CSV UPLOAD ======
function handleCSVUpload(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = parseCSV(e.target.result);
      TREE_DATA = raw;
      localStorage.setItem('customData', JSON.stringify(TREE_DATA));
      buildTree();
      toast('📂 تم تحميل البيانات', 2000);
    } catch(err) { toast('⚠ خطأ: '+err.message, 3000); }
  };
  reader.readAsText(file);
}

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n').filter(l=>l.trim());
  const root = {id:gid(),name:'سايل',children:[],depth:0};
  const anc = {};
  for (const line of lines) {
    const cells = line.split(',').map(c=>c.trim());
    let parent=root,pd=-1;
    for(let lv=0;lv<cells.length;lv++){
      const name=cells[lv];
      if(!name){if(anc[lv]){parent=anc[lv];pd=lv;}continue;}
      if(lv===0&&name==='سايل'){anc[0]=root;parent=root;pd=0;continue;}
      if(lv===0){
        let n=root.children.find(c=>c.name===name);
        if(!n){n={id:gid(),name,children:[],depth:1};root.children.push(n);}
        anc[0]=root;anc[1]=n;parent=n;pd=1;continue;
      }
      if(parent&&parent.children){
        let n=parent.children.find(c=>c.name===name);
        if(!n){n={id:gid(),name,children:[],depth:pd+1};parent.children.push(n);}
        anc[lv]=n;parent=n;pd=lv;
      }
    }
  }
  return root;
}

// ====== 13. LOAD DATA ======
async function loadData() {
  try {
    const r = await fetch('data.json?t='+Date.now());
    if(!r.ok) throw new Error('HTTP '+r.status);
    const data = await r.json();
    if(!data||!data.name) throw new Error('بيانات غير صالحة');
    TREE_DATA = data;
    buildTree();
  } catch(e) {
    console.error(e);
    toast('⚠ فشل التحميل: '+e.message,3000);
    const c = localStorage.getItem('cache');
    if(c){try{TREE_DATA=JSON.parse(c);buildTree();toast('📦 من المخبأ',2000);}catch(e2){}}
  }
}

// ====== 14. INIT ======
document.addEventListener('DOMContentLoaded', () => {
  updateDate(); setInterval(updateDate, 60000);

  document.getElementById('enterBtn').onclick = () => {
    document.getElementById('welcomeOverlay').classList.add('hidden');
    loadData();
  };

  document.getElementById('searchBtn').onclick = performSearch;
  document.getElementById('searchInput').onkeyup = (e) => {
    if(e.key==='Enter') performSearch();
    if(!e.target.value) unFocusAll();
  };
  document.getElementById('resetZoomBtn').onclick = unFocusAll;
  document.getElementById('darkModeBtn').onclick = toggleDark;
  document.getElementById('savePngBtn').onclick = savePNG;
  document.getElementById('printBtn').onclick = printTree;
  document.getElementById('fullscreenBtn').onclick = () => {
    if(!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };
  document.getElementById('csvUpload').onchange = (e) => { if(e.target.files[0]) handleCSVUpload(e.target.files[0]); };
  document.addEventListener('keydown', (e) => {
    if(e.ctrlKey&&e.key==='f'){e.preventDefault();document.getElementById('searchInput').focus();}
    if(e.key==='Escape'){unFocusAll();hideTooltip();}
  });
});
