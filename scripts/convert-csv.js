const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, 'data.csv');
const JSON_PATH = path.join(__dirname, '..', 'data.json');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n').filter(l => l.trim());
  const root = { id: generateId(), name: 'سايل', children: [], depth: 0 };
  const ancestors = {};

  for (const line of lines) {
    const cells = line.split(',').map(c => c.trim());
    let parent = root;
    let parentDepth = -1;

    for (let level = 0; level < cells.length; level++) {
      const name = cells[level];
      if (!name) {
        if (ancestors[level]) { parent = ancestors[level]; parentDepth = level; }
        continue;
      }
      if (level === 0 && name === 'سايل') {
        ancestors[0] = root; parent = root; parentDepth = 0;
        continue;
      }
      if (level === 0) {
        let node = root.children.find(c => c.name === name);
        if (!node) {
          node = { id: generateId(), name, children: [], depth: 1 };
          root.children.push(node);
        }
        ancestors[0] = root; ancestors[1] = node; parent = node; parentDepth = 1;
        continue;
      }
      if (parent && parent.children) {
        let node = parent.children.find(c => c.name === name);
        if (!node) {
          node = { id: generateId(), name, children: [], depth: parentDepth + 1 };
          parent.children.push(node);
        }
        ancestors[level] = node; parent = node; parentDepth = level;
      }
    }
  }
  return root;
}

function countNodes(node) {
  let count = 1;
  if (node.children) for (const c of node.children) count += countNodes(c);
  return count;
}

try {
  const csvText = fs.readFileSync(CSV_PATH, 'utf-8');
  const tree = parseCSV(csvText);
  const total = countNodes(tree);
  fs.writeFileSync(JSON_PATH, JSON.stringify(tree, null, 2), 'utf-8');
  console.log('✅ تم تحويل البيانات بنجاح');
  console.log(`📊 إجمالي الأفراد: ${total}`);
  console.log(`📁 تم حفظ الملف: ${JSON_PATH}`);
} catch (err) {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
}
