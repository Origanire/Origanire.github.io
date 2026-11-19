// Calcul du réseau my_torch, sans DOM : utilisé par la démo, le réseau du premier écran et les tests Node.

export const PIECES = 'PNBRQKpnbrqk';
export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function parseBoard(fen) {
  const [board, side = 'w'] = fen.trim().split(/\s+/);
  const rows = board.split('/');
  if (rows.length !== 8) throw new Error('il faut 8 rangées');
  const squares = [];
  for (const row of rows) {
    const line = [];
    for (const c of row) {
      if (/[1-8]/.test(c)) for (let i = 0; i < +c; i++) line.push(null);
      else if (PIECES.includes(c)) line.push(c);
      else throw new Error(`caractère « ${c} » inconnu`);
    }
    if (line.length !== 8) throw new Error('une rangée ne fait pas 8 cases');
    squares.push(line);
  }
  if (side !== 'w' && side !== 'b') throw new Error('le trait doit être w ou b');
  return { squares, side };
}

export function boardToFen({ squares, side }) {
  const rows = squares.map(line => {
    let out = '', empty = 0;
    for (const c of line) {
      if (!c) { empty++; continue; }
      if (empty) { out += empty; empty = 0; }
      out += c;
    }
    return out + (empty || '');
  });
  return `${rows.join('/')} ${side} - - 0 1`;
}

// Même encodage que src/clean/fen.py : 12 plans 8x8 one-hot, puis le trait.
export function encode({ squares, side }) {
  const x = new Float32Array(769);
  squares.forEach((line, rank) => line.forEach((c, file) => {
    if (c) x[PIECES.indexOf(c) * 64 + rank * 8 + file] = 1;
  }));
  if (side === 'w') x[768] = 1;
  return x;
}

export function buildModel(meta, buffer) {
  const all = new Float32Array(buffer);
  const t = {};
  for (const layer of meta.layers) {
    const size = layer.shape.reduce((a, b) => a * b, 1);
    t[layer.name] = { data: all.subarray(layer.offset, layer.offset + size), shape: layer.shape };
  }
  return { meta, t };
}

function dense(input, w, b, relu) {
  const [rows, cols] = w.shape;
  const out = Float32Array.from(b.data);
  for (let i = 0; i < rows; i++) {
    const v = input[i];
    if (v === 0) continue;
    const base = i * cols;
    for (let j = 0; j < cols; j++) out[j] += v * w.data[base + j];
  }
  if (relu) for (let j = 0; j < cols; j++) if (out[j] < 0) out[j] = 0;
  return out;
}

export function forward({ t }, x) {
  const h1 = dense(x, t.weights_0, t.bias_0, true);
  const h2 = dense(h1, t.weights_1, t.bias_1, true);
  const logits = dense(h2, t.weights_2, t.bias_2, false);
  const max = Math.max(...logits);
  const exps = Array.from(logits, v => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return { h1, h2, probs: exps.map(v => v / sum) };
}

// Indices des k neurones dont l'activation varie le plus sur un ensemble de positions, triés.
export function pickVaryingNeurons(activations, k) {
  const n = activations[0].length;
  const variance = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    let mean = 0;
    for (const a of activations) mean += a[j];
    mean /= activations.length;
    for (const a of activations) variance[j] += (a[j] - mean) ** 2;
  }
  return [...variance.keys()].sort((a, b) => variance[b] - variance[a] || a - b).slice(0, k).sort((a, b) => a - b);
}

// Pour chaque neurone source affiché, ses k liens positifs les plus forts vers les neurones cibles affichés.
export function topLinks(w, fromIdx, toIdx, k) {
  const cols = w.shape[1];
  const links = [];
  for (const from of fromIdx) {
    toIdx
      .map(to => ({ from, to, weight: w.data[from * cols + to] }))
      .filter(l => l.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, k)
      .forEach(l => links.push(l));
  }
  return links;
}
