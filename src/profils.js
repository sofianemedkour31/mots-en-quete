// Joueurs et progression, enregistrés uniquement sur cet appareil (localStorage).
// Rien n'est envoyé sur Internet. Le mode « invité » ne garde rien.
//
// Coffre à révisions (boîtes de Leitner) : un mot travaillé entre dans la boîte 1.
// Réussi du premier coup en révision, il monte d'une boîte et revient plus tard ;
// raté, il retourne en boîte 1. Après la boîte 5, il devient une gemme (mot maîtrisé).

const CLE = 'mq-joueurs';
export const INTERVALLES = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 }; // jours avant le prochain passage
export const MAITRISE = 6;
export const INVITE = 'invite';

let etat = lire();
let memoireInvite = nouvellesDonnees();

function nouvellesDonnees() { return { etoiles: {}, coffre: {}, vus: {} }; }

function lire() {
  try {
    const e = JSON.parse(localStorage.getItem(CLE));
    if (e && Array.isArray(e.joueurs)) return e;
  } catch { /* rien */ }
  return { actif: null, joueurs: [], donnees: {} };
}

function sauver() {
  try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* stockage plein ou interdit */ }
}

/** Numéro du jour local (change à minuit). */
export function jour(date = Date.now()) {
  const d = new Date(date);
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

// --- Joueurs -----------------------------------------------------------------
export function joueurs() { return etat.joueurs; }
export function joueurActif() {
  if (etat.actif === INVITE) return { id: INVITE, nom: 'Invité', avatar: 'robot' };
  return etat.joueurs.find((j) => j.id === etat.actif) || null;
}
export function choisirJoueur(id) {
  etat.actif = id;
  if (id === INVITE) memoireInvite = nouvellesDonnees();
  sauver();
}
export function creerJoueur(nom, avatar) {
  const j = { id: `j${Date.now().toString(36)}`, nom: String(nom).trim().slice(0, 16) || 'Joueur', avatar };
  etat.joueurs.push(j);
  etat.donnees[j.id] = nouvellesDonnees();
  etat.actif = j.id;
  sauver();
  return j;
}
export function supprimerJoueur(id) {
  etat.joueurs = etat.joueurs.filter((j) => j.id !== id);
  delete etat.donnees[id];
  if (etat.actif === id) etat.actif = null;
  sauver();
}

function donnees() {
  if (etat.actif === INVITE || !etat.actif) return memoireInvite;
  etat.donnees[etat.actif] ||= nouvellesDonnees();
  const d = etat.donnees[etat.actif];
  d.etoiles ||= {}; d.coffre ||= {}; d.vus ||= {};
  return d;
}

// --- Étoiles -----------------------------------------------------------------
const cleEtape = (listeId, etape) => `${listeId}|${etape}`;
export function etoiles(listeId, etape) { return donnees().etoiles[cleEtape(listeId, etape)] ?? null; }
export function enregistrerEtoiles(listeId, etape, n) {
  const d = donnees();
  const k = cleEtape(listeId, etape);
  const ancien = d.etoiles[k] ?? -1;
  d.etoiles[k] = Math.max(ancien, n);
  sauver();
  return { record: n > ancien, premiereFois: ancien < 0 };
}
export function totalEtoiles(listes, etapes) {
  let t = 0;
  for (const l of listes) for (const e of etapes) t += etoiles(l.id, e.cle) || 0;
  return t;
}

/** 3 étoiles : ≥ 90 % du premier coup ; 2 : ≥ 60 % ; 1 : terminé. */
export function calculerEtoiles(reussis, total) {
  if (!total) return 3;
  const r = reussis / total;
  return r >= 0.9 ? 3 : r >= 0.6 ? 2 : 1;
}

// --- Coffre à révisions -------------------------------------------------------
const cleMot = (listeId, mot) => `${listeId}|${mot}`;

/** Après une dictée ou le boss : le mot entre dans le coffre (boîte 1) s'il n'y est pas. */
export function entrerAuCoffre(listeId, mot, reussi) {
  const d = donnees();
  const k = cleMot(listeId, mot);
  if (!d.coffre[k]) d.coffre[k] = { b: 1, p: jour() + 1 };
  else if (!reussi && d.coffre[k].b < MAITRISE) d.coffre[k] = { b: 1, p: jour() + 1 };
  sauver();
}

/** Résultat d'une révision. Renvoie la nouvelle boîte. */
export function reviser(listeId, mot, reussi) {
  const d = donnees();
  const k = cleMot(listeId, mot);
  const actuel = d.coffre[k] || { b: 1, p: jour() };
  let b;
  if (reussi) b = Math.min(actuel.b + 1, MAITRISE);
  else b = 1;
  d.coffre[k] = { b, p: jour() + (INTERVALLES[b] || 30) };
  sauver();
  return b;
}

export function boite(listeId, mot) { return donnees().coffre[cleMot(listeId, mot)]?.b || 0; }

/** Mots dont la date de révision est arrivée. */
export function motsARevoir(contenu) {
  const d = donnees();
  const aujourdhui = jour();
  const out = [];
  for (const monde of contenu.parcours) {
    for (const liste of monde.listes) {
      for (const item of liste.mots) {
        const c = d.coffre[cleMot(liste.id, item.mot)];
        if (c && c.b < MAITRISE && c.p <= aujourdhui) out.push({ monde, liste, item, boite: c.b });
      }
    }
  }
  return out.sort((a, b) => a.boite - b.boite);
}

/** Tous les mots du coffre, avec leur boîte (pour l'écran Trésor). */
export function contenuCoffre(contenu) {
  const d = donnees();
  const out = [];
  for (const monde of contenu.parcours) {
    for (const liste of monde.listes) {
      for (const item of liste.mots) {
        const c = d.coffre[cleMot(liste.id, item.mot)];
        if (c) out.push({ monde, liste, item, boite: c.b, prochaine: c.p });
      }
    }
  }
  return out;
}

export function marquerVu(cle) { const d = donnees(); d.vus[cle] = 1; sauver(); }
export function dejaVu(cle) { return Boolean(donnees().vus[cle]); }
