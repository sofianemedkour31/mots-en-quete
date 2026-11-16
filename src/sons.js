// Petits sons de console, générés à la volée (aucun fichier audio).
let ctx = null;
let muet = (() => { try { return localStorage.getItem('mq-muet') === '1'; } catch { return false; } })();

export function estMuet() { return muet; }
export function basculerMuet() {
  muet = !muet;
  try { localStorage.setItem('mq-muet', muet ? '1' : '0'); } catch { /* stockage indisponible */ }
  return muet;
}

function note(freq, debut, duree, { type = 'square', volume = 0.05, glisse = null } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t0 = ctx.currentTime + debut;
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glisse) o.frequency.exponentialRampToValueAtTime(glisse, t0 + duree);
  g.gain.setValueAtTime(volume, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + duree + 0.02);
}

function bruit(debut, duree, volume = 0.05) {
  const n = Math.floor(ctx.sampleRate * duree);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource();
  const g = ctx.createGain();
  s.buffer = buf;
  g.gain.value = volume;
  s.connect(g).connect(ctx.destination);
  s.start(ctx.currentTime + debut);
}

const MOTIFS = {
  deplacer: () => note(660, 0, 0.04, { volume: 0.03 }),
  tic: () => note(990, 0, 0.03, { volume: 0.03 }),
  choisir: () => { note(523, 0, 0.06); note(784, 0.06, 0.08); },
  retour: () => { note(523, 0, 0.05); note(392, 0.05, 0.08); },
  juste: () => { note(659, 0, 0.07); note(784, 0.07, 0.07); note(1047, 0.14, 0.14); },
  presque: () => { note(440, 0, 0.08, { type: 'triangle', volume: 0.08 }); note(392, 0.09, 0.12, { type: 'triangle', volume: 0.08 }); },
  faux: () => { note(220, 0, 0.12, { type: 'triangle', volume: 0.09 }); note(185, 0.12, 0.18, { type: 'triangle', volume: 0.09 }); },
  trouve: () => { note(880, 0, 0.06); note(1175, 0.06, 0.1); },
  combo: () => { [784, 988, 1175, 1568].forEach((f, i) => note(f, i * 0.05, 0.07, { volume: 0.04 })); },
  coup: () => { bruit(0, 0.12, 0.08); note(330, 0, 0.18, { glisse: 80, volume: 0.06 }); },
  rire: () => { [300, 260, 300, 240].forEach((f, i) => note(f, i * 0.08, 0.07, { type: 'sawtooth', volume: 0.03 })); },
  cacher: () => note(1200, 0, 0.25, { type: 'triangle', glisse: 200, volume: 0.05 }),
  etoile: () => { note(1319, 0, 0.08); note(1760, 0.08, 0.14); },
  debloque: () => { [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.07, 0.1)); },
  victoire: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => note(f, i * 0.1, 0.13)); },
  explosion: () => { bruit(0, 0.5, 0.1); note(200, 0, 0.5, { glisse: 40, volume: 0.06 }); },
};

export function jouer(nom) {
  if (muet || !MOTIFS[nom]) return;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    MOTIFS[nom]();
  } catch { /* audio indisponible : on ignore */ }
}
