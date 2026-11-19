// Bande de preuves : les vrais chiffres, écrits en clair dans le HTML, puis animés de 0 à leur valeur.

export function formatProof(value, { decimals = 0, suffix = '' } = {}) {
  return value.toFixed(decimals).replace('.', ',') + suffix;
}

const easeOut = t => 1 - (1 - t) ** 3;

function countUp(node, { value, decimals, suffix, duration = 900 }) {
  const start = performance.now();
  const step = now => {
    const t = Math.min(1, (now - start) / duration);
    node.textContent = formatProof(value * easeOut(t), { decimals, suffix });
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function mountProofs(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const { value, decimals, suffix } = e.target.dataset;
    countUp(e.target, { value: +value, decimals: +decimals, suffix: suffix || '' });
  }), { threshold: 0.6 });
  root.querySelectorAll('[data-proof]').forEach(n => io.observe(n));
}
