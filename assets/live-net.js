// Premier écran : le vrai réseau my_torch, calculé en direct sur les positions du jeu de test.
import { parseBoard, encode, buildModel, forward, pickVaryingNeurons, topLinks, PIECES } from './net.js?v=5';

const NS = 'http://www.w3.org/2000/svg';
const GLYPH = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }; // taste-skill-ignore: chess pieces are board content
const LABELS = ['Rien', 'Échec par les blancs', 'Échec par les noirs', 'Mat par les blancs', 'Mat par les noirs'];
const SHOWN = 24;
const W = 640, H = 330;
const BOARD = { x: 6, y: 70, cell: 23 };
const COL = { h1: 240, h2: 326, out: 404 };
const MARK = {
  ok: '<svg class="mark ok" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>',
  ko: '<svg class="mark ko" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

const el = (name, attrs = {}, parent) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.append(node);
  return node;
};
const neuronY = i => 24 + i * ((H - 48) / (SHOWN - 1));
const outY = i => 85 + i * 40;
const squareCenter = idx => {
  const sq = idx % 64;
  return [BOARD.x + (sq % 8) * BOARD.cell + BOARD.cell / 2, BOARD.y + Math.floor(sq / 8) * BOARD.cell + BOARD.cell / 2];
};

// Dessine la structure fixe : échiquier, colonnes de neurones, sorties. Rend les éléments à animer.
function drawSkeleton(svg) {
  const links = el('g', { class: 'ln-links' }, svg);
  const board = el('g', { class: 'ln-board' }, svg);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    el('rect', { x: BOARD.x + f * BOARD.cell, y: BOARD.y + r * BOARD.cell, width: BOARD.cell, height: BOARD.cell, class: (r + f) % 2 ? 'sq-d' : 'sq-l' }, board);
  }
  const pieces = el('g', { class: 'ln-pieces' }, svg);
  const col = (x, n, cls) => Array.from({ length: n }, (_, i) => el('circle', { cx: x, cy: neuronY(i), r: 4.5, class: cls }, svg));
  const h1 = col(COL.h1, SHOWN, 'n n1');
  const h2 = col(COL.h2, SHOWN, 'n n2');
  const out = LABELS.map((label, i) => {
    const g = el('g', { class: 'ln-out' }, svg);
    const dot = el('circle', { cx: COL.out, cy: outY(i), r: 6, class: 'n n3' }, g);
    const pct = el('text', { x: COL.out + 64, y: outY(i) + 5, class: 'ln-pct', 'text-anchor': 'end' }, g);
    const text = el('text', { x: COL.out + 72, y: outY(i) + 5, class: 'ln-label' }, g);
    text.textContent = label;
    pct.textContent = '';
    return { g, dot, pct };
  });
  for (const [x, t] of [[BOARD.x, 'entrée 769'], [COL.h1 - 20, '512'], [COL.h2 - 16, '256'], [COL.out - 8, '5']]) {
    el('text', { x, y: H - 2, class: 'ln-axis' }, svg).textContent = t;
  }
  return { links, pieces, h1, h2, out };
}

export function mountLiveNet(root, { interval = 4000 } = {}) {
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ln-svg', 'aria-hidden': 'true' });
  const caption = document.createElement('p');
  caption.className = 'ln-caption';
  caption.textContent = 'Chargement du réseau my_torch…';
  const outs = document.createElement('ol');
  outs.className = 'ln-outs';
  root.replaceChildren(svg, outs, caption);
  const parts = drawSkeleton(svg);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timer = null, visible = true, hovered = false, stopped = false, index = 0, data = null;

  const render = () => {
    const { model, samples, runs, idx1, idx2, max1, max2, links12, links23 } = data;
    const s = samples[index];
    const state = parseBoard(s.fen);
    const run = runs[index];
    // Échiquier
    parts.pieces.replaceChildren();
    state.squares.forEach((line, r) => line.forEach((c, f) => {
      if (!c) return;
      const t = el('text', { x: BOARD.x + f * BOARD.cell + BOARD.cell / 2, y: BOARD.y + r * BOARD.cell + 17, 'text-anchor': 'middle', class: c === c.toUpperCase() ? 'pc pc-w' : 'pc pc-b' }, parts.pieces);
      t.textContent = GLYPH[c] + '︎';
    }));
    // Liens : entrée active → neurones affichés (recalculés), puis couches fixes
    parts.links.replaceChildren();
    const x = encode(state);
    const active = [];
    for (let i = 0; i < 768; i++) if (x[i]) active.push(i);
    for (const l of topLinks(model.t.weights_0, active, idx1, 2)) {
      const [x, y] = squareCenter(l.from);
      el('line', { x1: x, y1: y, x2: COL.h1, y2: neuronY(idx1.indexOf(l.to)), class: 'lk lk0', style: `--a:${Math.min(1, run.h1[l.to] / max1[idx1.indexOf(l.to)])}` }, parts.links);
    }
    for (const l of links12) el('line', { x1: COL.h1, y1: neuronY(idx1.indexOf(l.from)), x2: COL.h2, y2: neuronY(idx2.indexOf(l.to)), class: 'lk lk1', style: `--a:${run.h1[l.from] / max1[idx1.indexOf(l.from)] || 0}` }, parts.links);
    for (const l of links23) el('line', { x1: COL.h2, y1: neuronY(idx2.indexOf(l.from)), x2: COL.out, y2: outY(l.to), class: 'lk lk2', style: `--a:${run.h2[l.from] / max2[idx2.indexOf(l.from)] || 0}` }, parts.links);
    // Neurones
    idx1.forEach((n, i) => parts.h1[i].style.setProperty('--a', run.h1[n] / max1[i] || 0));
    idx2.forEach((n, i) => parts.h2[i].style.setProperty('--a', run.h2[n] / max2[i] || 0));
    const best = run.probs.indexOf(Math.max(...run.probs));
    parts.out.forEach((o, i) => {
      o.dot.style.setProperty('--a', run.probs[i]);
      o.g.classList.toggle('best', i === best);
      o.pct.textContent = `${(run.probs[i] * 100).toFixed(1).replace('.', ',')} %`;
    });
    outs.innerHTML = run.probs.map((p, i) => `<li${i === best ? ' class="best"' : ''}><span>${LABELS[i]}</span><span>${(p * 100).toFixed(1).replace('.', ',')} %</span></li>`).join('');
    const right = best === s.label;
    caption.innerHTML = `769 → 512 → 256 → 5 · position ${index + 1}/${samples.length} · réponse attendue : ${LABELS[s.label]} ${right ? MARK.ok : MARK.ko}`;
  };

  const schedule = () => {
    clearTimeout(timer);
    if (stopped || reduce || hovered || !visible || document.hidden || !data) return;
    timer = setTimeout(() => { index = (index + 1) % data.samples.length; render(); schedule(); }, interval);
  };

  root.addEventListener('pointerenter', () => { hovered = true; schedule(); });
  root.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  root.addEventListener('focus', () => { hovered = true; schedule(); });
  root.addEventListener('blur', () => { hovered = false; schedule(); });
  // Si l'adresse porte déjà ce lien, on relance quand même l'ouverture de la démo.
  root.addEventListener('click', () => {
    if (location.hash === '#demo-my_torch') dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = 'demo-my_torch';
  });
  document.addEventListener('visibilitychange', schedule);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; schedule(); });
  io.observe(root);

  // Les poids (2,1 Mo) se chargent après l'affichage de la page.
  const load = async () => {
    try {
      const [meta, buffer] = await Promise.all([
        fetch('demos/my_torch/model.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        fetch('demos/my_torch/weights.bin').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }),
      ]);
      const model = buildModel(meta, buffer);
      const samples = meta.samples;
      const runs = samples.map(s => forward(model, encode(parseBoard(s.fen))));
      const idx1 = pickVaryingNeurons(runs.map(r => r.h1), SHOWN);
      const idx2 = pickVaryingNeurons(runs.map(r => r.h2), SHOWN);
      const max1 = idx1.map(n => Math.max(...runs.map(r => r.h1[n])));
      const max2 = idx2.map(n => Math.max(...runs.map(r => r.h2[n])));
      const links12 = topLinks(model.t.weights_1, idx1, idx2, 3);
      const links23 = topLinks(model.t.weights_2, idx2, [0, 1, 2, 3, 4], 1);
      // Commence par une position que le réseau classe juste, de préférence un échec ou un mat.
      index = Math.max(0, samples.findIndex((s, i) => s.label > 0 && runs[i].probs.indexOf(Math.max(...runs[i].probs)) === s.label));
      data = { model, samples, runs, idx1, idx2, max1, max2, links12, links23 };
      root.classList.add('ready');
      render();
      schedule();
    } catch {
      caption.textContent = 'Réseau my_torch : 769 → 512 → 256 → 5. Cliquer pour ouvrir la démo.';
    }
  };
  if (document.readyState === 'complete') setTimeout(load, 0);
  else addEventListener('load', () => setTimeout(load, 0), { once: true });

  return { stop() { stopped = true; clearTimeout(timer); io.disconnect(); document.removeEventListener('visibilitychange', schedule); } };
}

export { PIECES };
