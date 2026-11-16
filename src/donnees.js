// Chargement du contenu : mondes (parcours) → listes de mots → étapes.
// Les élèves lisent le fichier publié ; le studio travaille sur un brouillon local.
import { syllabesSures } from './lib/ortho.js';
import { formeDictee, jetons } from './lib/texte.js';

export const CLE_BROUILLON = 'mq-studio-brouillon';
export const CLE_APERCU = 'mq-apercu';

export const COULEURS = {
  vert: { fond: '#00e436', sombre: '#005c2b', clair: '#b8f5c9' },
  jaune: { fond: '#ffec27', sombre: '#6b5d00', clair: '#fff7b8' },
  orange: { fond: '#ffa300', sombre: '#7a3e00', clair: '#ffe0a8' },
  bleu: { fond: '#29adff', sombre: '#123f7a', clair: '#c4e8ff' },
  rose: { fond: '#ff77a8', sombre: '#7e2553', clair: '#ffd3e4' },
  lavande: { fond: '#a99bd0', sombre: '#3c2f63', clair: '#e3dcf6' },
};

/** Les 5 étapes d'une liste, dans l'ordre de l'apprentissage. */
export const ETAPES = [
  { cle: 'loupe', nom: 'Loupe', sprite: 'loupe', aide: 'Observe chaque mot et trouve ses lettres pièges.' },
  { cle: 'pieges', nom: 'Pièges', sprite: 'pieges', aide: 'Complète les lettres qui manquent.' },
  { cle: 'flash', nom: 'Photo-Flash', sprite: 'flash', aide: 'Regarde le mot, il se cache : écris-le de mémoire.' },
  { cle: 'dictee', nom: 'Dictée radio', sprite: 'dictee', aide: 'Écoute le mot sans le voir, puis écris-le.' },
  { cle: 'boss', nom: 'Le Boss', sprite: 'couronne', aide: 'Écris les mots dans les phrases pour battre le Mange-Lettres.' },
];

export const REGLAGES = {
  niveau: 'CE2',
  deblocage: 'progressif', // ou 'libre'
  saisie: 'clavier',       // ou 'etiquettes'
  nbPhrasesBoss: 5,
};

export function couleurDe(monde) {
  return COULEURS[monde?.couleur] || COULEURS.vert;
}

export function modeApercu() {
  try { return sessionStorage.getItem(CLE_APERCU) === '1'; } catch { return false; }
}

export function lireBrouillon() {
  try {
    const b = localStorage.getItem(CLE_BROUILLON);
    return b ? JSON.parse(b) : null;
  } catch { return null; }
}

export async function chargerPublie() {
  const r = await fetch(`/contenu/parcours.json?v=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Contenu introuvable (${r.status}).`);
  return r.json();
}

/** Contenu vu par l'élève : seulement les listes validées, sauf en mode aperçu du studio. */
export async function chargerPourEleve() {
  const apercu = modeApercu();
  const source = (apercu && lireBrouillon()) || await chargerPublie();
  return {
    ...source,
    parcours: (source.parcours || []).map((m) => ({
      ...m,
      reglages: { ...REGLAGES, ...(m.reglages || {}) },
      listes: (m.listes || []).filter((l) => apercu || l.valide).map(preparerListe),
    })),
  };
}

/** Complète une liste pour le jeu : syllabes sûres, pièges en indices, phrases du boss. */
export function preparerListe(liste) {
  const mots = (liste.mots || []).filter((m) => m?.mot?.trim()).map((m) => {
    const mot = m.mot.trim();
    return {
      mot,
      syllabes: syllabesSures(mot, m.syllabes),
      pieges: (m.pieges || []).filter((i) => Number.isInteger(i) && i >= 0 && i < mot.length),
      astuce: m.astuce || '',
      famille: m.famille || '',
      phrase: m.phrase || '',
    };
  });
  return { ...liste, mots, etapes: { ...(liste.etapes || {}) } };
}

/**
 * Phrases du boss avec les mots de la liste à compléter.
 * Renvoie [{ phrase, morceaux: [{ type, v, cible? }] }] — seules les phrases contenant au moins un mot.
 */
export function phrasesBoss(liste, max = 5) {
  const cibles = new Map(liste.mots.map((m) => [formeDictee(m.mot), m]));
  const sources = (liste.phrases || []).filter(Boolean);
  const candidates = sources.length ? sources : liste.mots.map((m) => m.phrase).filter(Boolean);
  const out = [];
  for (const phrase of candidates) {
    const morceaux = jetons(phrase).map((j) => {
      if (j.type !== 'mot') return j;
      const nu = j.v.replace(/'$/, '');
      const item = cibles.get(formeDictee(nu));
      return item ? { ...j, cible: item, apostrophe: j.v.endsWith("'") } : j;
    });
    if (morceaux.some((m) => m.cible)) out.push({ phrase, morceaux });
    if (out.length >= max) break;
  }
  return out;
}

export function etapesDisponibles(liste) {
  const actif = (cle) => liste.etapes?.[cle] !== false;
  const aMots = liste.mots.length > 0;
  return {
    loupe: aMots && actif('loupe'),
    pieges: aMots && actif('pieges'),
    flash: aMots && actif('flash'),
    dictee: aMots && actif('dictee'),
    boss: aMots && actif('boss') && phrasesBoss(liste, 1).length > 0,
  };
}
