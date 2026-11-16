// Petits outils d'interface : création d'éléments, pixel art, fenêtres.
import { SPRITES, PALETTE } from './sprites.js';

/** el('button', { class: 'x', onclick }, 'texte', autreElement) */
export function el(tag, attrs = {}, ...enfants) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith('--')) n.style.setProperty(p, val);
        else n.style[p] = val;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'html') n.innerHTML = v;
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  return ajouter(n, ...enfants);
}

export function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

/** Ajoute des enfants en ignorant null/false (append() écrirait « null »). */
export function ajouter(n, ...enfants) {
  for (const e of enfants.flat(Infinity)) {
    if (e == null || e === false) continue;
    n.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
  return n;
}

/** Vide puis remplit. */
export function remplir(n, ...enfants) { return ajouter(vider(n), ...enfants); }

// ---------------------------------------------------------------------------
// Pixel art en couleur (voir sprites.js)
// ---------------------------------------------------------------------------
/**
 * sprite('boss', { taille: 96 }) ; lignes : un dessin passé directement (variante teintée).
 * taille = largeur en pixels écran.
 */
export function sprite(nom, { taille = 48, lignes = null, classe = '', titre = null } = {}) {
  const dessin = lignes || SPRITES[nom];
  if (!dessin) return el('span');
  const h = dessin.length;
  const w = dessin[0].length;
  let rects = '';
  dessin.forEach((ligne, y) => {
    // Regroupe les pixels voisins de même couleur : moins de rectangles, rendu plus net.
    let x = 0;
    while (x < w) {
      const c = ligne[x];
      let fin = x + 1;
      while (fin < w && ligne[fin] === c) fin++;
      if (c !== '.' && PALETTE[c]) rects += `<rect x="${x}" y="${y}" width="${fin - x}" height="1.02" fill="${PALETTE[c]}"/>`;
      x = fin;
    }
  });
  const span = el('span', { class: `sprite ${classe}`, 'aria-hidden': titre ? null : 'true', role: titre ? 'img' : null, 'aria-label': titre });
  span.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${taille}" height="${Math.round(taille * h / w)}" shape-rendering="crispEdges">${rects}</svg>`;
  return span;
}

// ---------------------------------------------------------------------------
// Icônes d'interface monochromes (prennent la couleur du texte)
// '#' contour, 'o' remplissage.
// ---------------------------------------------------------------------------
const ICONES = {
  retour: [
    '....##....',
    '...#o#....',
    '..#oo#####',
    '.#oooooooo',
    '#ooooooooo',
    '.#oooooooo',
    '..#oo#####',
    '...#o#....',
    '....##....',
  ],
  son: [
    '.....#....',
    '....##..#.',
    '###o#..#..',
    '#oo##.#..#',
    '#oo##.#..#',
    '###o#..#..',
    '....##..#.',
    '.....#....',
  ],
  muet: [
    '.....#....',
    '....##....',
    '###o#.#..#',
    '#oo##..##.',
    '#oo##..##.',
    '###o#.#..#',
    '....##....',
    '.....#....',
  ],
  lent: [
    '..........',
    '...####...',
    '..#oooo#..',
    '.#oo##oo#.',
    '.#o#oo#o#.',
    '.#oo##oo#.',
    '##oooooo#.',
    '#.######..',
  ],
  phrase: [
    '##########',
    '#oooooooo#',
    '#o##o###o#',
    '#oooooooo#',
    '#o###o##o#',
    '#oooooooo#',
    '###.######',
    '..#.......',
  ],
};

export function icone(nom, taille = 24) {
  const lignes = ICONES[nom];
  if (!lignes) return el('span');
  const h = lignes.length;
  const w = lignes[0].length;
  let rects = '';
  lignes.forEach((ligne, y) => [...ligne].forEach((c, x) => {
    if (c === '#') rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="currentColor"/>`;
    if (c === 'o') rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="currentColor" opacity=".55"/>`;
  }));
  const span = el('span', { class: 'icone', 'aria-hidden': 'true' });
  span.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${taille}" height="${Math.round(taille * h / w)}" shape-rendering="crispEdges">${rects}</svg>`;
  return span;
}

/** Fenêtre superposée simple. Renvoie { fermer, boite }. */
export function fenetre(contenu, { classe = '', onFermer, fermable = true } = {}) {
  const fond = el('div', { class: `fenetre-fond ${classe}` });
  const boite = el('div', { class: 'fenetre', role: 'dialog', 'aria-modal': 'true' }, contenu);
  fond.append(boite);
  const fermer = () => { fond.remove(); document.removeEventListener('keydown', echap); onFermer?.(); };
  const echap = (e) => { if (e.key === 'Escape' && fermable) { e.stopPropagation(); fermer(); } };
  if (fermable) fond.addEventListener('click', (e) => { if (e.target === fond) fermer(); });
  document.addEventListener('keydown', echap);
  document.body.append(fond);
  setTimeout(() => boite.querySelector('button')?.focus({ preventScroll: true }), 50);
  return { fermer, boite };
}

/** Petit texte qui jaillit puis disparaît (combo, « +1 »…). */
export function bulle(texte, parent, classe = '') {
  const b = el('span', { class: `bulle ${classe}`, 'aria-hidden': 'true' }, texte);
  parent.append(b);
  setTimeout(() => b.remove(), 1100);
}

export const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
