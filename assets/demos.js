// Démos jouables du portfolio. Tout s'exécute dans le navigateur : aucune donnée n'est envoyée.
import { START, parseBoard, boardToFen, encode, buildModel, forward } from './net.js?v=5';
import { DIAGRAMS, renderDiagram, renderSteps } from './diagrams.js?v=5';

const dialog = document.getElementById('demo');
const titleEl = dialog.querySelector('.demo-title');
const bodyEl = dialog.querySelector('.demo-body');
const DEMOS = {};
let opener = null;

const html = (strings, ...values) => strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ''), '');

/* ---------------------------------------------------------------- fenêtre */

function mountDemo(name, root) {
  return DEMOS[name].open(root).catch(err => {
    root.innerHTML = `<p class="demo-error">La démo n'a pas pu se charger (${err.message}).</p>`;
  });
}

function showDialog(title) {
  titleEl.textContent = title;
  bodyEl.replaceChildren();
  opener = document.activeElement;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('.box').scrollTop = 0;
}

function openDemo(name) {
  showDialog(DEMOS[name].title);
  mountDemo(name, bodyEl);
}

function projectDetail(p) {
  const media = p.video
    ? `<video class="shot" src="${p.video}" poster="${p.poster}" controls muted playsinline preload="metadata"></video>`
    : p.img ? `<img class="shot" src="${p.img}" alt="${p.alt}">` : '';
  const code = p.link
    ? `<a class="btn${p.demo ? '' : ' dark'}" href="${p.link[0]}" target="_blank" rel="noopener">${p.link[1]}</a>`
    : '<span class="ctx">Code non public pour l’instant, disponible sur demande.</span>';
  return html`
    <div class="detail">
      <div class="detail-head"><p>${p.pitch}</p></div>
      <div class="detail-cols">
        <div>
          <h4>Mon rôle</h4>
          <p class="ctx">${p.role}</p>
          <h4 style="margin-top:20px">Résultats</h4>
          <ul>${p.results.map(r => `<li>${r}</li>`).join('')}</ul>
        </div>
        <div>
          <h4>Comment c'est construit</h4>
          <p class="ctx">${p.desc}</p>
          <ul style="margin-top:12px">${p.points.map(r => `<li>${r}</li>`).join('')}</ul>
          <div class="stack">${p.stack.map(s => `<span>${s}</span>`).join('')}</div>
        </div>
      </div>
      ${DIAGRAMS[p.id] ? `<div class="dg-panel" data-diagram-large="${p.id}"></div>` : ''}
      <div class="detail-links">${code}</div>
      ${p.demo ? '' : `<div class="detail-media">${media}</div>`}
      ${p.demo ? '<section class="detail-demo" aria-label="Démo en direct"></section>' : ''}
    </div>`;
}

function openProject(id) {
  const p = (window.PROJECTS || []).find(x => x.id === id);
  if (!p) return;
  showDialog(p.name);
  bodyEl.innerHTML = projectDetail(p);
  history.replaceState(null, '', `#projet-${id}`);
  bodyEl.querySelectorAll('[data-diagram-large]').forEach(n => n.replaceChildren(renderDiagram(n.dataset.diagramLarge, { large: true }), renderSteps(n.dataset.diagramLarge)));
  // La démo se lance d'elle-même dans la fenêtre du projet.
  if (p.demo) mountDemo(p.demo, bodyEl.querySelector('.detail-demo'));
}

// Nettoyage à la fermeture : appelé directement par nos boutons et, en plus, par l'événement « close » (touche Échap).
function onClosed() {
  bodyEl.replaceChildren();
  if (/^#(projet|demo)-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  if (opener && document.contains(opener)) opener.focus();
  opener = null;
}
const closeDialog = () => { if (dialog.open) dialog.close(); onClosed(); };
dialog.querySelector('.demo-close').addEventListener('click', closeDialog);
dialog.addEventListener('click', e => { if (e.target === dialog) closeDialog(); });
dialog.addEventListener('close', () => { if (opener !== null || bodyEl.childElementCount) onClosed(); });

document.addEventListener('click', e => {
  const demo = e.target.closest('[data-demo]');
  if (demo) { openDemo(demo.dataset.demo); return; }
  const project = e.target.closest('[data-project]');
  if (project) { openProject(project.dataset.project); return; }
  // Clic n'importe où sur une carte (hors liens et boutons) : ouvre le projet.
  const card = e.target.closest('.card');
  if (card && !e.target.closest('a, button')) {
    const open = card.querySelector('[data-project]');
    if (open) openProject(open.dataset.project);
  }
});

const fromHash = () => {
  const project = location.hash.match(/^#projet-(.+)$/);
  const demo = location.hash.match(/^#demo-(.+)$/);
  if (project) openProject(decodeURIComponent(project[1]));
  else if (demo && DEMOS[demo[1]]) openDemo(demo[1]);
};
window.addEventListener('hashchange', fromHash);

/* ---------------------------------------------------------------- my_torch */

// Les pièces d'échecs sont le contenu de l'échiquier, pas une décoration.
const GLYPH = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙', k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }; // taste-skill-ignore: chess pieces are board content
const LABELS_FR = ['Rien', 'Échec par les blancs', 'Échec par les noirs', 'Mat par les blancs', 'Mat par les noirs'];

let torchModel = null;

async function loadTorchModel() {
  if (torchModel) return torchModel;
  const [meta, buffer] = await Promise.all([
    fetch('demos/my_torch/model.json').then(r => r.json()),
    fetch('demos/my_torch/weights.bin').then(r => r.arrayBuffer()),
  ]);
  torchModel = buildModel(meta, buffer);
  return torchModel;
}

const predict = state => forward(torchModel, encode(state)).probs;

DEMOS.my_torch = {
  title: 'my_torch - en direct',
  async open(root) {
    root.innerHTML = '<p class="demo-loading">Chargement du réseau (2,1 Mo)…</p>';
    const { meta } = await loadTorchModel();
    let state = parseBoard(START);
    let expected = null;
    let tool = 'Q';

    root.innerHTML = html`
      <p class="demo-intro">Le vrai réseau entraîné (769 → 512 → 256 → 5), exécuté dans ton navigateur.
        Il n'applique aucune règle d'échecs : il a appris à reconnaître échecs et mats sur 650 718 positions.
        Pose des pièces, change le trait, ou tire une position du jeu de test.</p>
      <div class="chess">
        <div>
          <div class="board" role="grid" aria-label="Échiquier modifiable"></div>
          <div class="palette" role="toolbar" aria-label="Pièce à poser"></div>
        </div>
        <div class="chess-side">
          <div class="row-actions">
            <button class="mini" data-act="sample">Position du jeu de test</button>
            <button class="mini" data-act="start">Départ</button>
            <button class="mini" data-act="clear">Vider</button>
          </div>
          <div class="side-toggle" role="radiogroup" aria-label="Trait">
            <button class="mini" data-side="w">Trait aux blancs</button>
            <button class="mini" data-side="b">Trait aux noirs</button>
          </div>
          <label class="fen">FEN <input spellcheck="false" autocomplete="off"></label>
          <p class="fen-error" role="alert"></p>
          <div class="bars" aria-live="polite"></div>
          <p class="verdict" aria-live="polite"></p>
        </div>
      </div>`;

    const boardEl = root.querySelector('.board');
    const paletteEl = root.querySelector('.palette');
    const fenInput = root.querySelector('.fen input');
    const fenError = root.querySelector('.fen-error');
    const barsEl = root.querySelector('.bars');
    const verdictEl = root.querySelector('.verdict');

    const tools = [...'KQRBNP', ...'kqrbnp', ''];
    paletteEl.innerHTML = tools.map(p => `<button class="tool" data-tool="${p}" aria-label="${p ? 'Poser ' + p : 'Gomme'}">${p ? GLYPH[p] + '︎' : '<svg class="eraser" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l5 5-9.5 9.5H6L3.5 16a1.5 1.5 0 0 1 0-2.1zM10 9l5 5M6 18.5h14"/></svg>'}</button>`).join('');

    const render = () => {
      boardEl.innerHTML = state.squares.map((line, r) => line.map((c, f) => {
        const dark = (r + f) % 2 === 1;
        return `<button class="sq${dark ? ' dark' : ''}${c && c === c.toUpperCase() ? ' white' : ''}" data-r="${r}" data-f="${f}" aria-label="${'abcdefgh'[f]}${8 - r} ${c || 'vide'}">${c ? GLYPH[c] + '︎' : ''}</button>`;
      }).join('')).join('');
      paletteEl.querySelectorAll('.tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === tool));
      root.querySelectorAll('[data-side]').forEach(b => b.setAttribute('aria-pressed', b.dataset.side === state.side));
      fenInput.value = boardToFen(state);
      fenError.textContent = '';
      const probs = predict(state);
      const best = probs.indexOf(Math.max(...probs));
      barsEl.innerHTML = probs.map((p, i) => html`
        <div class="bar${i === best ? ' best' : ''}">
          <span>${LABELS_FR[i]}</span>
          <span class="track"><span style="width:${(p * 100).toFixed(1)}%"></span></span>
          <b>${(p * 100).toFixed(1)} %</b>
        </div>`).join('');
      if (expected === null) verdictEl.textContent = '';
      else verdictEl.innerHTML = best === expected
        ? `<svg class="mark ok" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Réponse attendue : ${LABELS_FR[expected]}`
        : `<svg class="mark ko" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg> Réponse attendue : ${LABELS_FR[expected]}. Le réseau se trompe environ une fois sur douze.`;
    };

    boardEl.addEventListener('click', e => {
      const sq = e.target.closest('.sq');
      if (!sq) return;
      const r = +sq.dataset.r, f = +sq.dataset.f;
      state.squares[r][f] = state.squares[r][f] === tool ? null : (tool || null);
      expected = null;
      render();
    });
    paletteEl.addEventListener('click', e => {
      const b = e.target.closest('.tool');
      if (!b) return;
      tool = b.dataset.tool;
      render();
    });
    root.querySelector('.chess-side').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.side) state.side = b.dataset.side;
      if (b.dataset.act === 'start') { state = parseBoard(START); expected = null; }
      if (b.dataset.act === 'clear') { state = parseBoard('8/8/8/8/8/8/8/8 w'); expected = null; }
      if (b.dataset.act === 'sample') {
        const s = meta.samples[Math.floor(Math.random() * meta.samples.length)];
        state = parseBoard(s.fen);
        expected = s.label;
      }
      if (b.dataset.side) expected = null;
      render();
    });
    fenInput.addEventListener('change', () => {
      try { state = parseBoard(fenInput.value); expected = null; render(); }
      catch (err) { fenError.textContent = `FEN invalide : ${err.message}.`; }
    });
    render();
  },
};

/* ---------------------------------------------------------------- CVRIE */

const ORT_VERSION = '1.20.1';
let cvrieModel = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('chargement de ' + src));
    document.head.append(s);
  });
}

async function loadCvrie(progress) {
  if (cvrieModel) return cvrieModel;
  if (!window.ort) await loadScript(`https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort.min.js`);
  window.ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
  const clf = await fetch('demos/cvrie/classifier.json').then(r => r.json());
  const response = await fetch('demos/cvrie/densenet121_xrv.onnx');
  const total = +response.headers.get('content-length') || 28158185;
  const reader = response.body.getReader();
  const chunks = []; let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); received += value.length;
    progress(received / total);
  }
  const bytes = new Uint8Array(received); let pos = 0;
  for (const c of chunks) { bytes.set(c, pos); pos += c.length; }
  const session = await window.ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
  cvrieModel = { clf, session };
  return cvrieModel;
}

// Arrondi de Python (au pair le plus proche), utilisé par ImageOps.pad.
const pyRound = x => {
  const f = Math.floor(x), d = x - f;
  return d > 0.5 || (d === 0.5 && f % 2 !== 0) ? f + 1 : f;
};

// Rééchantillonnage Lanczos identique à celui de Pillow (Resample.c), en niveaux de gris 8 bits.
const PRECISION = 22;
const sinc = x => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const lanczos = x => (x > -3 && x < 3 ? sinc(x) * sinc(x / 3) : 0);

function coefficients(inSize, outSize) {
  const scale = inSize / outSize;
  const filterscale = Math.max(scale, 1);
  const support = 3 * filterscale;
  const list = [];
  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    const ss = 1 / filterscale;
    const xmin = Math.max(0, Math.trunc(center - support + 0.5));
    const xmax = Math.min(inSize, Math.trunc(center + support + 0.5)) - xmin;
    const k = []; let ww = 0;
    for (let x = 0; x < xmax; x++) { const w = lanczos((x + xmin - center + 0.5) * ss); k.push(w); ww += w; }
    const kk = k.map(w => {
      const v = (ww !== 0 ? w / ww : w) * (1 << PRECISION);
      return v < 0 ? Math.trunc(-0.5 + v) : Math.trunc(0.5 + v);
    });
    list.push({ xmin, kk });
  }
  return list;
}

const clip8 = v => (v <= 0 ? 0 : v >= 255 ? 255 : v);

function resample(src, w, h, tw, th) {
  let cur = src, cw = w;
  if (tw !== w) {
    const cs = coefficients(w, tw), out = new Uint8ClampedArray(tw * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < tw; x++) {
      const { xmin, kk } = cs[x]; let ss = 1 << (PRECISION - 1);
      for (let i = 0; i < kk.length; i++) ss += cur[y * cw + xmin + i] * kk[i];
      out[y * tw + x] = clip8(Math.floor(ss / (1 << PRECISION)));
    }
    cur = out; cw = tw;
  }
  if (th !== h) {
    const cs = coefficients(h, th), out = new Uint8ClampedArray(cw * th);
    for (let y = 0; y < th; y++) {
      const { xmin, kk } = cs[y];
      for (let x = 0; x < cw; x++) {
        let ss = 1 << (PRECISION - 1);
        for (let i = 0; i < kk.length; i++) ss += cur[(xmin + i) * cw + x] * kk[i];
        out[y * cw + x] = clip8(Math.floor(ss / (1 << PRECISION)));
      }
    }
    cur = out;
  }
  return cur;
}

// Reproduit image_views()[0] : niveaux de gris, ImageOps.pad vers 224x224 (fond noir), puis [-1024, 1024].
function toTensor(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8ClampedArray(w * h);
  // Conversion "L" de Pillow : (R*19595 + G*38470 + B*7471 + 0x8000) >> 16
  for (let i = 0; i < gray.length; i++) gray[i] = (rgba[4 * i] * 19595 + rgba[4 * i + 1] * 38470 + rgba[4 * i + 2] * 7471 + 0x8000) >> 16;

  let tw = 224, th = 224, ox = 0, oy = 0;
  if (w / h > 1) { th = pyRound(h / w * 224); oy = pyRound((224 - th) * 0.5); }
  else if (w / h < 1) { tw = pyRound(w / h * 224); ox = pyRound((224 - tw) * 0.5); }
  const small = resample(gray, w, h, tw, th);

  const out = new Float32Array(224 * 224).fill(-1024);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    out[(y + oy) * 224 + x + ox] = (small[y * tw + x] / 255 * 2 - 1) * 1024;
  }
  return out;
}

function checkImage(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  if (Math.min(w, h) < 128) return 'Image trop petite : au moins 128 × 128 pixels.';
  if (w / h < 0.65 || w / h > 1.5) return 'Cadrage incompatible : il faut une radiographie thoracique de face complète.';
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
  const d = x.getImageData(0, 0, 64, 64).data; let spread = 0;
  for (let i = 0; i < d.length; i += 4) spread += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
  if (spread / (d.length / 4) > 8) return 'Image en couleur : importe une radiographie en niveaux de gris.';
  return null;
}

async function scoreImage(img) {
  const { clf, session } = cvrieModel;
  const input = new window.ort.Tensor('float32', toTensor(img), [1, 1, 224, 224]);
  const started = performance.now();
  const result = await session.run({ image: input });
  const f = result.features.data;
  let z = clf.intercept;
  for (let i = 0; i < f.length; i++) z += ((f[i] - clf.mean[i]) / clf.scale[i]) * clf.coef[i];
  return { score: 1 / (1 + Math.exp(-z)), ms: Math.round(performance.now() - started) };
}

const loadImage = src => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img); img.onerror = () => reject(new Error('image illisible'));
  img.src = src;
});

DEMOS.cvrie = {
  title: 'CVRIE - en direct',
  async open(root) {
    root.innerHTML = html`
      <p class="demo-intro">Le vrai modèle de CVRIE : l'encodeur DenseNet-121 (exporté en ONNX) puis le classifieur entraîné,
        exécutés dans ton navigateur. Aucune image ne quitte ton appareil.</p>
      <p class="demo-warn"><b>Prototype de recherche, pas un outil médical.</b> Le résultat ne permet pas de savoir
        si une personne a un cancer.</p>
      <div class="demo-loading cv-progress">Chargement du modèle (28 Mo) <span class="track"><span></span></span></div>`;
    const bar = root.querySelector('.cv-progress .track span');
    const { clf } = await loadCvrie(p => { bar.style.width = `${Math.round(p * 100)}%`; });

    root.querySelector('.cv-progress').remove();
    root.insertAdjacentHTML('beforeend', html`
      <div class="xray">
        <div>
          <div class="xray-view"><img alt="Radiographie analysée"></div>
          <p class="xray-credit">Exemples : LIDC-IDRI (TCIA), CC BY 3.0, Armato et al. Patients du jeu de test, jamais vus à l'entraînement.</p>
        </div>
        <div class="xray-side">
          <div class="thumbs" role="list">${clf.samples.map((s, i) => html`
            <button class="thumb" data-i="${i}" role="listitem" aria-label="Exemple ${i + 1}"><img src="demos/cvrie/${s.file}" alt=""></button>`).join('')}
          </div>
          <label class="mini upload">Importer ma radiographie<input type="file" accept="image/png,image/jpeg" hidden></label>
          <div class="gauge" aria-live="polite">
            <div class="gauge-track"><span class="gauge-fill"></span><span class="gauge-mark" style="left:${(clf.threshold * 100).toFixed(1)}%"></span></div>
            <div class="gauge-legend"><span>0</span><span>seuil ${clf.threshold.toFixed(2)}</span><span>1</span></div>
          </div>
          <p class="xray-result" aria-live="polite"></p>
          <p class="xray-expected"></p>
        </div>
      </div>`);

    const view = root.querySelector('.xray-view img');
    const fill = root.querySelector('.gauge-fill');
    const resultEl = root.querySelector('.xray-result');
    const expectedEl = root.querySelector('.xray-expected');

    const run = async (src, sample) => {
      root.querySelectorAll('.thumb').forEach(t => t.setAttribute('aria-pressed', sample && t.dataset.i == clf.samples.indexOf(sample)));
      resultEl.textContent = 'Analyse…'; expectedEl.textContent = '';
      const img = await loadImage(src);
      view.src = src;
      const problem = checkImage(img);
      if (problem) { resultEl.textContent = problem; fill.style.width = '0'; return; }
      const { score, ms } = await scoreImage(img);
      const positive = score >= clf.threshold;
      fill.style.width = `${(score * 100).toFixed(1)}%`;
      fill.classList.toggle('pos', positive);
      resultEl.innerHTML = `Score ${score.toFixed(3)} : classe <b>${positive ? '« nodule malin »' : '« bénin ou sans nodule »'}</b> <span class="muted">(${ms} ms)</span>`;
      if (sample) {
        const truth = sample.label === 'malignant';
        expectedEl.innerHTML = truth === positive
          ? `<svg class="mark ok" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg> Diagnostic connu : ${truth ? 'nodule malin' : 'bénin'}.`
          : `<svg class="mark ko" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg> Diagnostic connu : ${truth ? 'nodule malin' : 'bénin'}. Le modèle se trompe ici, comme sur environ 30 % du test.`;
      }
    };

    root.querySelector('.thumbs').addEventListener('click', e => {
      const t = e.target.closest('.thumb'); if (!t) return;
      const s = clf.samples[+t.dataset.i];
      run(`demos/cvrie/${s.file}`, s).catch(err => { resultEl.textContent = err.message; });
    });
    root.querySelector('.upload input').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 20e6) { resultEl.textContent = 'Image trop lourde (20 Mo maximum).'; return; }
      run(URL.createObjectURL(file), null).catch(err => { resultEl.textContent = err.message; });
    });
    const first = clf.samples.find(s => s.label === 'malignant' && s.score_python >= clf.threshold) || clf.samples[0];
    await run(`demos/cvrie/${first.file}`, first);
  },
};

// Lien direct partageable : origanire.github.io/#projet-my_torch
fromHash();

export { DEMOS, parseBoard, predict, loadTorchModel, loadCvrie, scoreImage, loadImage };
