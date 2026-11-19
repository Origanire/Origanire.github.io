// Schémas d'architecture des projets principaux, tirés des README de chaque dépôt.
// `compact` : la bande courte affichée sur la carte ; le schéma complet s'affiche dans la fenêtre du projet.

export const DIAGRAMS = {
  sensai: {
    width: 860, height: 240,
    nodes: [
      { id: 'msg', label: 'Message\ndu viewer', short: 'Message', x: 70, y: 120 },
      { id: 'guard', label: 'Garde-fous\n(injection)', short: 'Garde-fous', x: 190, y: 120 },
      { id: 'route', label: 'Routeur', x: 310, y: 120 },
      { id: 'faq', label: 'FAQ de la\nchaîne (RAG)', x: 430, y: 42 },
      { id: 'web', label: 'Recherche\nweb', x: 430, y: 120 },
      { id: 'mem', label: 'Mémoire\ndu viewer', x: 430, y: 198 },
      { id: 'llm', label: 'Modèle local\n(Ollama)', short: 'LLM local', x: 550, y: 120 },
      { id: 'mask', label: 'Masquage des\ndonnées perso', x: 670, y: 120 },
      { id: 'out', label: 'Réponse\ndans le chat', short: 'Réponse', x: 790, y: 120 },
    ],
    edges: [['msg', 'guard'], ['guard', 'route'], ['route', 'faq'], ['route', 'web'], ['route', 'mem'],
      ['faq', 'llm'], ['web', 'llm'], ['mem', 'llm'], ['llm', 'mask'], ['mask', 'out']],
    compact: ['msg', 'guard', 'llm', 'out'],
  },
  my_torch: {
    width: 860, height: 240,
    nodes: [
      { id: 'fen', label: 'Position\nFEN', short: 'Position', x: 90, y: 120 },
      { id: 'enc', label: 'Encodage\n769 valeurs', short: '769', x: 260, y: 120 },
      { id: 'h1', label: 'Couche 512\nReLU, dropout', short: '512', x: 430, y: 120 },
      { id: 'h2', label: 'Couche 256\nReLU, dropout', short: '256', x: 600, y: 120 },
      { id: 'out', label: 'Softmax\n5 états', short: '5 états', x: 770, y: 120 },
    ],
    edges: [['fen', 'enc'], ['enc', 'h1'], ['h1', 'h2'], ['h2', 'out']],
    compact: ['fen', 'enc', 'h1', 'h2', 'out'],
  },
  cvrie: {
    width: 860, height: 240,
    nodes: [
      { id: 'img', label: 'Radio-\ngraphie', short: 'Image', x: 70, y: 120 },
      { id: 'pad', label: 'Recadrage\n224 px', x: 190, y: 120 },
      { id: 'dense', label: 'DenseNet-121\n(gelé)', short: 'DenseNet', x: 310, y: 120 },
      { id: 'feat', label: '1 024 carac-\ntéristiques', x: 430, y: 120 },
      { id: 'scale', label: 'Standardi-\nsation', x: 550, y: 120 },
      { id: 'lr', label: 'Régression\nlogistique', short: 'Classifieur', x: 670, y: 120 },
      { id: 'out', label: 'Score\net seuil', short: 'Score', x: 790, y: 120 },
    ],
    edges: [['img', 'pad'], ['pad', 'dense'], ['dense', 'feat'], ['feat', 'scale'], ['scale', 'lr'], ['lr', 'out']],
    compact: ['img', 'dense', 'lr', 'out'],
  },
  'r-type': {
    width: 860, height: 240,
    nodes: [
      { id: 'clients', label: 'Clients\n(4 joueurs)', short: 'Clients', x: 90, y: 100 },
      { id: 'udp', label: 'Protocole\nUDP binaire', short: 'UDP', x: 260, y: 100 },
      { id: 'server', label: 'Serveur\n60 ticks/s', short: 'Serveur', x: 430, y: 100 },
      { id: 'ecs', label: 'ECS : jeu en\nJSON + Python', short: 'ECS', x: 600, y: 100 },
      { id: 'snap', label: 'Snapshots\ndelta', short: 'Snapshots', x: 770, y: 100 },
    ],
    edges: [['clients', 'udp'], ['udp', 'server'], ['server', 'ecs'], ['ecs', 'snap'], ['snap', 'clients']],
    compact: ['clients', 'udp', 'server', 'snap'],
  },
};

const NS = 'http://www.w3.org/2000/svg';
const BOX = { w: 108, h: 50 };
const el = (name, attrs = {}, parent) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.append(node);
  return node;
};

// Chemin d'un lien : droit d'un bord de pastille à l'autre, ou courbe par-dessous pour un retour en arrière.
function edgePath(a, b, w = BOX.w, h = BOX.h) {
  if (b.x < a.x) {
    const y = Math.max(a.y, b.y) + h / 2 + 46;
    return `M${a.x} ${a.y + h / 2} C${a.x} ${y} ${b.x} ${y} ${b.x} ${b.y + h / 2}`;
  }
  const sx = a.x + w / 2, ex = b.x - w / 2 - 6;
  if (a.y === b.y) return `M${sx} ${a.y} L${ex} ${b.y}`;
  const mx = (sx + ex) / 2;
  return `M${sx} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${ex} ${b.y}`;
}

function addFlow(svg, path, i, animate) {
  if (!animate) return;
  const dot = el('circle', { r: 3.5, class: 'dg-dot' }, svg);
  el('animateMotion', { dur: '2.4s', repeatCount: 'indefinite', begin: `-${(i * 0.3 + 0.1).toFixed(1)}s`, path: path.getAttribute('d') }, dot);
}

// large=true : schéma complet avec libellés détaillés ; sinon bande compacte pour la carte.
export function renderDiagram(id, { large = false } = {}) {
  const d = DIAGRAMS[id];
  const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let nodes, edges, width, height, box;
  if (large) {
    ({ nodes, edges, width, height } = d);
    box = BOX;
  } else {
    width = 480; height = 300;
    const step = (width - 24) / d.compact.length;
    box = { w: step - 16, h: 62 };
    nodes = d.compact.map((cid, i) => ({ ...d.nodes.find(n => n.id === cid), x: 12 + step * (i + 0.5), y: 160 }));
    nodes.forEach(n => { n.label = n.short; });
    edges = nodes.slice(1).map((n, i) => [nodes[i].id, n.id]);
    if (id === 'r-type') edges.push([nodes.at(-1).id, nodes[0].id]);
  }
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, class: `dg${large ? ' dg-large' : ''}`, role: 'img', 'aria-label': `Architecture : ${nodes.map(n => n.label.replace(/\n/g, ' ')).join(', ')}` });
  const defs = el('defs', {}, svg);
  const marker = el('marker', { id: `arrow-${id}-${large ? 'l' : 'c'}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
  el('path', { d: 'M0 0 L10 5 L0 10 z', class: 'dg-arrow' }, marker);
  if (!large) el('text', { x: 14, y: 30, class: 'dg-title' }, svg).textContent = 'Architecture';
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const links = el('g', {}, svg);
  edges.forEach(([from, to], i) => {
    const path = el('path', { d: edgePath(byId[from], byId[to], box.w, box.h), class: 'dg-edge', 'marker-end': `url(#${marker.id})` }, links);
    addFlow(svg, path, i, animate);
  });
  for (const n of nodes) {
    const g = el('g', { class: 'dg-node' }, svg);
    el('rect', { x: n.x - box.w / 2, y: n.y - box.h / 2, width: box.w, height: box.h, rx: 10 }, g);
    const lines = n.label.split('\n');
    lines.forEach((line, i) => {
      el('text', { x: n.x, y: n.y + 5 + (i - (lines.length - 1) / 2) * 16, 'text-anchor': 'middle' }, g).textContent = line;
    });
  }
  // Les points ne tournent que lorsque le schéma est à l'écran.
  if (animate && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations()));
    io.observe(svg);
  }
  return svg;
}

// Ordre de lecture des étapes (niveaux en largeur depuis le premier nœud) : sert aux versions HTML pour téléphone.
export function stepsInOrder(id) {
  const { nodes, edges } = DIAGRAMS[id];
  const level = { [nodes[0].id]: 0 };
  const queue = [nodes[0].id];
  while (queue.length) {
    const cur = queue.shift();
    for (const [from, to] of edges) {
      if (from === cur && !(to in level)) { level[to] = level[cur] + 1; queue.push(to); }
    }
  }
  return nodes
    .map((n, i) => ({ id: n.id, label: n.label.replace(/-\n/g, '').replace(/\n/g, ' '), short: n.short, level: level[n.id] ?? 0, i }))
    .sort((a, b) => a.level - b.level || a.i - b.i);
}

// Bande compacte en HTML (cartes) : les étapes s'allument tour à tour.
export function renderChips(id) {
  const d = DIAGRAMS[id];
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  wrap.setAttribute('role', 'img');
  const labels = d.compact.map(c => d.nodes.find(n => n.id === c).short);
  wrap.setAttribute('aria-label', `Architecture : ${labels.join(', ')}`);
  wrap.innerHTML = `<span class="chips-title">Architecture</span><div class="chips-row">${labels
    .map((l, i) => `<span class="step"><span class="chip" style="--i:${i};--n:${labels.length}">${l}</span>${i < labels.length - 1 ? '<span class="chip-arrow" aria-hidden="true">→</span>' : ''}</span>`)
    .join('')}</div>`;
  return wrap;
}

// Liste verticale de toutes les étapes (fenêtre de détail sur téléphone).
export function renderSteps(id) {
  const ol = document.createElement('ol');
  ol.className = 'steps';
  let last = -1;
  for (const s of stepsInOrder(id)) {
    const li = document.createElement('li');
    if (s.level === last) li.className = 'same-level';
    li.textContent = s.label;
    ol.append(li);
    last = s.level;
  }
  return ol;
}
