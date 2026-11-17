// Analyse orthographique d'un mot : syllabes écrites, lettres pièges, astuce.
// Sert de proposition automatique (studio, simulation d'Albert) : l'enseignant relit toujours.
// Utilisé aussi pour comparer la réponse de l'élève au mot juste.
import { formeDictee, sansAccents } from './texte.js';

const VOYELLES = 'aàâäeéèêëiîïoôöuùûüyÿœæ';
export const estVoyelle = (c) => VOYELLES.includes(String(c).toLowerCase());
const DIGRAMMES = ['ch', 'ph', 'gn', 'th', 'rh'];
const GROUPES = new Set(['bl', 'cl', 'fl', 'gl', 'pl', 'br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr', 'vr']);
export const SEPARATEUR = '/';

// ---------------------------------------------------------------------------
// Syllabes écrites (convention de l'école : pom/me, ta/ble, an/ni/ver/sai/re)
// ---------------------------------------------------------------------------
function unites(p) {
  const m = p.toLowerCase();
  const u = [];
  let i = 0;
  while (i < m.length) {
    const deux = m.slice(i, i + 2);
    if ((deux === 'qu' || deux === 'gu') && i + 2 < m.length && estVoyelle(m[i + 2])) { u.push({ t: 'C', d: i, f: i + 2 }); i += 2; continue; }
    if (DIGRAMMES.includes(deux)) { u.push({ t: 'C', d: i, f: i + 2 }); i += 2; continue; }
    if (estVoyelle(m[i])) {
      let j = i + 1;
      while (j < m.length && estVoyelle(m[j])) j++;
      u.push({ t: 'V', d: i, f: j });
      i = j;
      continue;
    }
    u.push({ t: 'C', d: i, f: i + 1 });
    i++;
  }
  return u;
}

function syllaberPartie(p) {
  if (!p) return p;
  const u = unites(p);
  const noyaux = u.map((x, k) => (x.t === 'V' ? k : -1)).filter((k) => k >= 0);
  if (noyaux.length < 2) return p;
  const coupes = [];
  for (let n = 0; n < noyaux.length - 1; n++) {
    const a = noyaux[n];
    const b = noyaux[n + 1];
    const cons = u.slice(a + 1, b);
    if (!cons.length) continue;
    let debut;
    if (cons.length === 1) debut = a + 1;
    else {
      const derniere = cons[cons.length - 1];
      const avant = cons[cons.length - 2];
      const paire = p.slice(avant.d, derniere.f).toLowerCase();
      if (derniere.f - derniere.d > 1) debut = b - 1;
      else if (avant.f - avant.d === 1 && GROUPES.has(paire)) debut = b - 2;
      else debut = b - 1;
    }
    coupes.push(u[debut].d);
  }
  let out = '';
  let prec = 0;
  for (const c of coupes) { out += p.slice(prec, c) + SEPARATEUR; prec = c; }
  return out + p.slice(prec);
}

/** « anniversaire » → « an/ni/ver/sai/re ». Les espaces, apostrophes et traits d'union sont gardés. */
export function syllaber(mot) {
  return String(mot).split(/([\s'’-]+)/).map((part, k) => (k % 2 ? part : syllaberPartie(part))).join('');
}

/** Vérifie que la découpe correspond au mot ; sinon renvoie la découpe automatique. */
export function syllabesSures(mot, syllabes) {
  const s = String(syllabes || '').trim();
  if (s && s.split(SEPARATEUR).join('') === mot) return s;
  return syllaber(mot);
}

// ---------------------------------------------------------------------------
// Lettres pièges
// ---------------------------------------------------------------------------
const MESSAGES = {
  double: (l) => `Attention : deux « ${l} ».`,
  muette: (l) => 'tsdx'.includes(l) ? `Attention au ${l} muet à la fin.` : `Le « ${l} » de la fin ne s'entend pas : cherche un mot de la même famille.`,
  eau: () => 'Le son [o] s\'écrit « eau ».',
  au: () => 'Le son [o] s\'écrit « au ».',
  ai: (l) => `Le son [è] s'écrit « ${l} ».`,
  ph: () => 'Le son [f] s\'écrit « ph ».',
  th: () => 'Dans « th », le h ne s\'entend pas.',
  h: () => 'Le « h » ne s\'entend pas.',
  mbp: () => 'On écrit « m » devant b et p.',
  cedille: () => 'La cédille fait le son [s].',
  accent: (l) => `Attention à l'accent sur le ${l}.`,
  majuscule: () => 'Attention à la majuscule.',
  eMuet: () => 'Le e final ne se prononce pas.',
  sz: () => 'Le s fait le son [z] car il est entre deux voyelles.',
  cDoux: () => 'Le c fait le son [s] car il est devant e, i ou y.',
  gDoux: () => 'Le g fait le son [j] car il est devant e, i ou y.',
};
const PRIORITAIRES = new Set(['double', 'muette', 'eau', 'au', 'ai', 'ph', 'h', 'accent', 'majuscule', 'mbp', 'cedille']);

/** Repère les difficultés probables d'un mot. Renvoie [{ type, indices, lettres }]. */
export function difficultes(mot) {
  const m = String(mot).toLowerCase();
  const n = m.length;
  const out = [];
  const pris = new Set();
  const ajouter = (type, indices) => {
    const libres = indices.filter((i) => !pris.has(i));
    if (!libres.length) return;
    indices.forEach((i) => pris.add(i));
    out.push({ type, indices, lettres: indices.map((i) => mot[i]).join('') });
  };
  let r;
  const re = (motif, type, f = (x) => x) => {
    const e = new RegExp(motif, 'g');
    while ((r = e.exec(m))) {
      const indices = Array.from({ length: r[0].length }, (_, k) => r.index + k);
      ajouter(type, f(indices, r));
    }
  };
  re('eau', 'eau');
  re('au', 'au');
  re('ai|ei', 'ai');
  re('ph', 'ph');
  re('th', 'th', (ix) => [ix[1]]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === m[i + 1] && /[bcdfgklmnprstz]/.test(m[i])) ajouter('double', [i, i + 1]);
  }
  for (let i = 0; i < n; i++) {
    const c = m[i];
    if (c === 'h' && (i === 0 || !'cpstrg'.includes(m[i - 1]))) ajouter('h', [i]);
    if (c === 'ç') ajouter('cedille', [i]);
    if ('àâäéèêëîïôöùûüÿ'.includes(c)) ajouter('accent', [i]);
    if ((i === 0 || /[\s'’-]/.test(mot[i - 1]))
      && mot[i] !== mot[i].toLocaleLowerCase('fr-FR') && mot[i] === mot[i].toLocaleUpperCase('fr-FR')) ajouter('majuscule', [i]);
    if (c === 'm' && 'bp'.includes(m[i + 1] || '') && estVoyelle(m[i - 1] || '')) ajouter('mbp', [i]);
  }
  // Lettre muette finale (chat, gros, long, sirop) et e muet après voyelle (amie, joie).
  const fin = m[n - 1];
  if (n >= 3 && 'tdsxpzg'.includes(fin) && !(fin === 's' && m[n - 2] === 's')) ajouter('muette', [n - 1]);
  if (n >= 3 && fin === 'e' && estVoyelle(m[n - 2]) && !'éè'.includes(m[n - 2])) ajouter('eMuet', [n - 1]);
  for (let i = 1; i < n - 1; i++) {
    if (m[i] === 's' && estVoyelle(m[i - 1]) && estVoyelle(m[i + 1])) ajouter('sz', [i]);
    if (m[i] === 'c' && 'eiyéèê'.includes(m[i + 1])) ajouter('cDoux', [i]);
    if (m[i] === 'g' && 'eiyéèê'.includes(m[i + 1]) && m[i - 1] !== 'g') ajouter('gDoux', [i]);
  }
  // Trop de pièges = plus de pièges : on garde les plus utiles.
  const nbLettres = new Set(out.flatMap((d) => d.indices)).size;
  if (nbLettres > Math.ceil(n * 0.6)) return out.filter((d) => PRIORITAIRES.has(d.type));
  return out;
}

export function piegesAuto(mot) {
  return [...new Set(difficultes(mot).flatMap((d) => d.indices))].sort((a, b) => a - b);
}

/** Découpe les lettres sélectionnées en unités orthographiques, avec correction possible. */
export function pointsLoupe(mot, selection, groupesManuels) {
  const lettres = [...mot];
  const minuscules = [...mot.toLocaleLowerCase('fr-FR')];
  const indices = [...new Set((Array.isArray(selection) ? selection : [])
    .filter((i) => Number.isInteger(i) && i >= 0 && i < lettres.length))].sort((a, b) => a - b);
  const creerPoint = (groupe) => ({ debut: groupe[0], lettres: groupe.map((i) => lettres[i]).join('') });
  const valide = Array.isArray(groupesManuels) && groupesManuels.length > 0
    && groupesManuels.every((g) => Array.isArray(g) && g.length > 0 && g.every((i, k) =>
      Number.isInteger(i) && (k === 0 || i === g[k - 1] + 1)))
    && JSON.stringify(groupesManuels.flat()) === JSON.stringify(indices);
  if (valide) return groupesManuels.map(creerPoint);

  const graphies = difficultes(mot)
    .filter((d) => d.indices.length > 1 && d.indices.every((i) => indices.includes(i)))
    .sort((a, b) => b.indices.length - a.indices.length);
  for (let i = 0; i < minuscules.length - 1; i++) {
    const groupe = minuscules.slice(i, i + 2).join('');
    const suivante = minuscules[i + 2] || '';
    if (['an', 'en'].includes(groupe) && (!suivante || (!estVoyelle(suivante) && !'nm'.includes(suivante)))
      && indices.includes(i) && indices.includes(i + 1)) {
      graphies.push({ indices: [i, i + 1] });
    }
  }
  const points = [];
  for (let k = 0; k < indices.length;) {
    const i = indices[k];
    const graphie = graphies.find((d) => d.indices[0] === i && d.indices.every((n, j) => indices[k + j] === n));
    const groupe = graphie ? graphie.indices : [i];
    points.push(creerPoint(groupe));
    k += groupe.length;
  }
  return points;
}

/** Formulations approuvées par l'enseignant pour les pièges sans ambiguïté. */
export function regleLoupe(mot, point) {
  const lettres = [...mot.toLocaleLowerCase('fr-FR')];
  const debut = point.debut;
  const cible = point.lettres.toLocaleLowerCase('fr-FR');
  const messages = [];
  const types = [];
  const ajouter = (type, texte) => { types.push(type); messages.push(texte); };
  if ([...point.lettres].some((c) => c !== c.toLocaleLowerCase('fr-FR') && c === c.toLocaleUpperCase('fr-FR'))) {
    ajouter('majuscule', 'Attention à la majuscule.');
  }
  for (const accentuee of [...cible].filter((c) => /[àâäéèêëîïôöùûüÿ]/.test(c))) {
    ajouter('accent', `Attention à l'accent sur le ${accentuee}.`);
  }
  if (cible === 'u' && lettres[debut - 1] === 'q' && /[eéèêëiîïy]/.test(lettres[debut + 1] || '')) {
    ajouter('u_apres_q', 'Après la lettre q, il y a un "u" muet.');
  }
  if (cible === 'e' && debut === lettres.length - 1 && lettres.length >= 3) {
    ajouter('e_final', 'Le e final ne se prononce pas.');
  }
  if (cible.length === 2 && cible[0] === cible[1] && /[bcdfghjklmnpqrstvwxz]/.test(cible[0])) {
    ajouter('consonne_double', 'Attention à la double consonne.');
  }
  if ((cible === 'an' || cible === 'en') && (!lettres[debut + 2]
    || (!estVoyelle(lettres[debut + 2]) && !'nm'.includes(lettres[debut + 2])))) {
    ajouter(cible, cible === 'an' ? 'Le an de quarante (40).' : 'Le en de trente (30).');
  }
  if (cible.length === 1 && debut === lettres.length - 1 && /[tsdx]/.test(cible)) {
    ajouter('finale_muette', `Attention au ${cible} muet à la fin.`);
  } else if (cible === 's' && lettres[debut - 1] !== 's' && lettres[debut + 1] !== 's'
    && lettres[debut - 1] !== 'h' && lettres[debut + 1] !== 'h') {
    ajouter('s_contextuel', estVoyelle(lettres[debut - 1]) && estVoyelle(lettres[debut + 1])
      ? 'Le s fait le son [z] car il est entre deux voyelles.'
      : 'Le s fait le son [s] car il n’est pas entre deux voyelles.');
  } else if (cible === 'c' && lettres[debut + 1] && !['h', 'c'].includes(lettres[debut + 1])) {
    ajouter('c_contextuel', /[eéèêëiîïy]/.test(lettres[debut + 1])
      ? 'Le c fait le son [s] car il est devant e, i ou y.'
      : 'Le c fait le son [k] car il n’est pas devant e, i ou y.');
  } else if (cible === 'g' && lettres[debut + 1] && !['n', 'h'].includes(lettres[debut + 1])) {
    ajouter('g_contextuel', /[eéèêëiîïy]/.test(lettres[debut + 1])
      ? 'Le g fait le son [j] car il est devant e, i ou y.'
      : 'Le g fait le son [g] car il n’est pas devant e, i ou y.');
  }
  return messages.length ? { type: types.join('+'), texte: messages.join(' ') } : null;
}

export function astuceAuto(mot) {
  const d = difficultes(mot);
  if (!d.length) return 'Ce mot s\'écrit comme il se prononce : écoute bien chaque syllabe.';
  return d.slice(0, 2).map((x) => MESSAGES[x.type](x.type === 'double' ? x.lettres[0] : x.lettres)).join(' ');
}

/** Proposition complète pour un mot (studio, simulation). */
export function analyser(mot) {
  return { mot, syllabes: syllaber(mot), pieges: piegesAuto(mot), astuce: astuceAuto(mot), famille: '', phrase: '' };
}

/** Convertit des morceaux (« eau », « t ») en indices de lettres dans le mot. */
export function indicesDepuis(mot, morceaux) {
  const m = String(mot).toLowerCase();
  const out = new Set();
  for (const brut of morceaux || []) {
    if (Number.isInteger(brut)) { if (brut >= 0 && brut < m.length) out.add(brut); continue; }
    const p = String(brut || '').toLowerCase().trim();
    if (!p || p.length > m.length) continue;
    // Une seule lettre : la dernière occurrence (souvent la lettre muette finale) ; sinon la première.
    const pos = p.length === 1 ? m.lastIndexOf(p) : m.indexOf(p);
    if (pos < 0) continue;
    for (let k = 0; k < p.length; k++) out.add(pos + k);
  }
  return [...out].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Comparaison réponse / mot juste
// ---------------------------------------------------------------------------

/**
 * Aligne la réponse sur le mot juste (distance d'édition).
 * Renvoie les lettres du mot juste, chacune marquée ok si l'élève l'a bien placée.
 * On ne montre jamais la forme fautive : seulement le mot juste, avec ses lettres à revoir.
 */
export function aligner(saisie, juste) {
  const a = [...formeDictee(saisie)];
  const b = [...formeDictee(juste)];
  const n = a.length;
  const m = b.length;
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  const ok = Array(m).fill(false);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1] && d[i][j] === d[i - 1][j - 1]) { ok[j - 1] = true; i--; j--; }
    else if (d[i][j] === d[i - 1][j - 1] + 1) { i--; j--; }
    else if (d[i][j] === d[i - 1][j] + 1) i--;
    else j--;
  }
  return { lettres: b.map((l, k) => ({ l, ok: ok[k] })), distance: d[n][m] };
}

/** 'juste' | 'accent' (seuls les accents diffèrent) | 'faux' | 'vide' */
export function verdict(saisie, juste) {
  const a = formeDictee(saisie);
  const b = formeDictee(juste);
  if (!a) return 'vide';
  if (a === b) return 'juste';
  if (sansAccents(a) === sansAccents(b)) return 'accent';
  return 'faux';
}
