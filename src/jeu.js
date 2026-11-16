// Briques communes aux étapes : cadre, mot en couleurs, saisie, fin de niveau.
import { el, remplir, ajouter, sprite, icone, fenetre, bulle } from './ui.js';
import { teinter } from './sprites.js';
import { jouer } from './sons.js';
import { dire } from './voix.js';
import { syllabesSures, SEPARATEUR } from './lib/ortho.js';
import { graine, melanger } from './lib/texte.js';
import { calculerEtoiles, enregistrerEtoiles } from './profils.js';
import { aligner, verdict } from './lib/ortho.js';

const ACCENTS = ['é', 'è', 'ê', 'à', 'â', 'ç', 'ù', 'û', 'î', 'ï', 'ô', 'ë', 'œ'];

// ---------------------------------------------------------------------------
// Bouton « écouter »
// ---------------------------------------------------------------------------
export function boutonEcouter(phrase, { taille = '', libelle = null } = {}) {
  return el('button', {
    class: `btn-ecouter ${taille}`,
    type: 'button',
    'aria-label': `Écouter : ${phrase}`,
    onclick: (e) => { e.stopPropagation(); dire(phrase); },
  }, icone('son', taille === 'petit' ? 18 : 22), libelle ? el('span', {}, libelle) : null);
}

/** Les trois façons d'entendre un mot. */
export function commandesEcoute(item, { grand = true } = {}) {
  return el('div', { class: 'ecoute' },
    el('button', { class: `btn-son ${grand ? 'grand' : ''}`, type: 'button', onclick: () => dire(item.mot, { vitesse: 0.8 }) },
      icone('son', grand ? 34 : 24), el('span', {}, 'Écouter')),
    el('button', { class: 'btn-px', type: 'button', onclick: () => dire(item.mot, { vitesse: 0.45 }) }, icone('lent', 22), 'Lentement'),
    item.phrase ? el('button', { class: 'btn-px', type: 'button', onclick: () => dire(item.phrase, { vitesse: 0.85 }) }, icone('phrase', 22), 'Dans une phrase') : null);
}

// ---------------------------------------------------------------------------
// Cadre d'une étape : titre, consigne, barre de progression, combo
// ---------------------------------------------------------------------------
export function cadre(zone, { titre, consigne, spriteNom }) {
  const progression = el('div', { class: 'hud-progression', 'aria-hidden': 'true' });
  const compteur = el('span', { class: 'hud-compteur' });
  const combo = el('span', { class: 'hud-combo', 'aria-live': 'polite' });
  const scene = el('div', { class: 'scene' });
  ajouter(zone,
    el('header', { class: 'etape-entete' },
      spriteNom ? sprite(spriteNom, { taille: 44, classe: 'etape-sprite' }) : null,
      el('div', {},
        el('h2', {}, titre),
        el('p', { class: 'consigne' }, consigne, ' ', boutonEcouter(consigne, { taille: 'petit' })))),
    el('div', { class: 'hud' }, compteur, progression, combo),
    scene);

  let serie = 0;
  return {
    scene,
    /** ici : indice de l'élément en cours ; resultats[k] : true (premier coup), false, ou rien. */
    majProgression(ici, total, resultats = []) {
      const faits = resultats.filter((r) => r != null).length;
      compteur.textContent = `${Math.min(faits + 1, total)}/${total}`;
      remplir(progression, Array.from({ length: total }, (_, k) => el('i', {
        class: resultats[k] === true ? 'ok' : resultats[k] === false ? 'ko' : k === ici ? 'ici' : '',
      })));
    },
    /** À appeler après chaque réponse : true = juste du premier coup. */
    serie(reussi) {
      if (!reussi) { serie = 0; combo.textContent = ''; return; }
      serie++;
      if (serie >= 2) {
        combo.textContent = `COMBO ×${serie}`;
        combo.classList.remove('pop'); void combo.offsetWidth; combo.classList.add('pop');
        if (serie % 3 === 0) { jouer('combo'); bulle(`×${serie} !`, scene, 'bulle-combo'); }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Mot en couleurs : syllabes alternées, lettres pièges, trous
// ---------------------------------------------------------------------------
export function lettresDuMot(item) {
  const syl = syllabesSures(item.mot, item.syllabes).split(SEPARATEUR);
  const out = [];
  let i = 0;
  syl.forEach((s, k) => [...s].forEach((c) => {
    out.push({ c, i, s: k, piege: item.pieges.includes(i), blanc: /[\s'’-]/.test(c) });
    i++;
  }));
  return out;
}

/**
 * pieges : 'visible' (surlignés), 'souligne', 'aucun'
 * trous  : indices des lettres remplacées par des cases vides
 */
export function motColore(item, { pieges = 'visible', trous = [], cliquable = false, onLettre = null, couleurs = true } = {}) {
  const lettres = lettresDuMot(item);
  const ensembleTrous = new Set(trous);
  const spans = lettres.map((l) => {
    const classes = ['lettre'];
    if (couleurs && !l.blanc) classes.push(l.s % 2 ? 'syl-b' : 'syl-a');
    if (l.blanc) classes.push('blanc');
    if (l.piege && pieges !== 'aucun') classes.push(`piege-${pieges}`);
    if (ensembleTrous.has(l.i)) classes.push('trou');
    const attrs = { class: classes.join(' '), 'data-i': l.i };
    if (cliquable && !l.blanc) {
      return el('button', { ...attrs, type: 'button', onclick: (e) => onLettre?.(l, e.currentTarget) }, l.c);
    }
    return el('span', attrs, ensembleTrous.has(l.i) ? '' : l.c);
  });
  const boite = el('div', { class: 'mot-colore', lang: 'fr' }, spans);
  return {
    el: boite,
    spans,
    lettres,
    /** Remplit les trous dans l'ordre avec le texte tapé. */
    remplirTrous(texte) {
      const t = [...texte];
      let k = 0;
      spans.forEach((s, idx) => {
        if (!ensembleTrous.has(lettres[idx].i)) return;
        s.textContent = t[k] || '';
        s.classList.toggle('rempli', Boolean(t[k]));
        k++;
      });
    },
    reveler(classe = 'revele') {
      spans.forEach((s, idx) => {
        if (ensembleTrous.has(lettres[idx].i)) { s.textContent = lettres[idx].c; s.classList.add(classe); }
      });
    },
  };
}

/** Le mot juste, lettres à revoir marquées (jamais la forme fautive de l'élève). */
export function motCorrige(item, alignement) {
  const lettres = lettresDuMot(item);
  return el('div', { class: 'mot-colore corrige', lang: 'fr' },
    lettres.map((l, k) => el('span', {
      class: `lettre ${l.blanc ? 'blanc' : (l.s % 2 ? 'syl-b' : 'syl-a')} ${alignement?.lettres[k] && !alignement.lettres[k].ok && !l.blanc ? 'a-revoir' : ''}`,
    }, l.c)));
}

/** Cases des lettres bien placées (sans donner les autres). */
export function lettresBienPlacees(alignement) {
  return el('div', { class: 'indice-cases', 'aria-hidden': 'true' },
    el('span', { class: 'indice-titre' }, 'Lettres déjà bien placées :'),
    el('span', { class: 'cases' }, alignement.lettres.map((x) => el('i', { class: x.ok ? 'ok' : '' }, x.ok ? x.l : ''))));
}

// ---------------------------------------------------------------------------
// Saisie : clavier de l'appareil ou étiquettes-lettres
// ---------------------------------------------------------------------------
const CONFUSIONS = {
  a: 'e', e: 'éa', é: 'eè', è: 'éê', ê: 'è', o: 'au', u: 'o', i: 'y', y: 'i', s: 'zc', z: 's', c: 'sk',
  k: 'c', q: 'k', m: 'n', n: 'm', t: 'd', d: 't', p: 'b', b: 'p', f: 'v', v: 'f', g: 'j', j: 'g', l: 'l', r: 'r', h: 'h',
};

function distracteurs(cible, nb, alea) {
  const lettres = [...cible.toLowerCase()].filter((c) => /\p{L}/u.test(c));
  const pool = [...new Set(lettres.flatMap((c) => [...(CONFUSIONS[c] || '')]))];
  const choisis = melanger(pool, alea).slice(0, nb);
  const secours = 'aeiorstnlu';
  let k = 0;
  while (choisis.length < nb && k < secours.length) { if (!choisis.includes(secours[k])) choisis.push(secours[k]); k++; }
  return choisis;
}

/**
 * creerSaisie({ cible, mode: 'clavier'|'etiquettes', onValider, onChange })
 * Renvoie { el, valeur(), vider(), focus(), bloquer(bool), mode }.
 */
export function creerSaisie({ cible, mode = 'clavier', onValider, onChange, nbDistracteurs = 2, etiquette = 'Écris le mot ici' }) {
  if (mode === 'etiquettes') return saisieEtiquettes({ cible, onValider, onChange, nbDistracteurs });
  const champ = el('input', {
    class: 'champ-mot', type: 'text', autocomplete: 'off', autocapitalize: 'off',
    autocorrect: 'off', spellcheck: 'false', 'aria-label': etiquette, enterkeyhint: 'done', lang: 'fr',
  });
  champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onValider?.(champ.value); } });
  champ.addEventListener('input', () => onChange?.(champ.value));
  const accents = el('div', { class: 'accents', role: 'group', 'aria-label': 'Lettres avec accent' },
    ACCENTS.map((a) => el('button', {
      class: 'touche', type: 'button',
      onclick: () => {
        if (champ.disabled) return;
        const d = champ.selectionStart ?? champ.value.length;
        const f = champ.selectionEnd ?? d;
        champ.value = champ.value.slice(0, d) + a + champ.value.slice(f);
        champ.focus();
        champ.setSelectionRange(d + 1, d + 1);
        onChange?.(champ.value);
      },
    }, a)));
  return {
    mode: 'clavier',
    el: el('div', { class: 'saisie saisie-clavier' }, champ, accents),
    valeur: () => champ.value,
    vider: () => { champ.value = ''; onChange?.(''); },
    focus: () => setTimeout(() => champ.focus({ preventScroll: true }), 30),
    bloquer: (b) => { champ.disabled = b; accents.classList.toggle('eteint', b); },
    marquer: (classe) => { champ.classList.remove('juste', 'faux'); if (classe) champ.classList.add(classe); },
    secouer: () => { champ.classList.remove('secoue'); void champ.offsetWidth; champ.classList.add('secoue'); },
    selectionner: () => champ.select(),
  };
}

function saisieEtiquettes({ cible, onValider, onChange, nbDistracteurs }) {
  const alea = graine(`etiquettes|${cible}`);
  const caracteres = [...cible];
  const estLettre = (c) => !/[\s'’-]/.test(c);
  const places = caracteres.map((c) => ({ fixe: estLettre(c) ? null : c, lettre: null, tuile: null }));
  const tuilesLettres = melanger([...caracteres.filter(estLettre).map((c) => c.toLowerCase()), ...distracteurs(cible, nbDistracteurs, alea)], alea);
  let bloque = false;

  const rangee = el('div', { class: 'cases-saisie', 'aria-label': 'Ta réponse' });
  const reserve = el('div', { class: 'tuiles', role: 'group', 'aria-label': 'Étiquettes-lettres' });
  const tuiles = tuilesLettres.map((l) => el('button', { class: 'tuile', type: 'button', onclick: (e) => poser(e.currentTarget) }, l));
  reserve.append(...tuiles);

  function dessiner() {
    remplir(rangee, places.map((p, k) => (p.fixe != null
      ? el('span', { class: 'case-fixe' }, p.fixe === ' ' ? ' ' : p.fixe)
      : el('button', { class: `case-saisie ${p.lettre ? 'pleine' : ''}`, type: 'button', 'aria-label': p.lettre ? `Retirer ${p.lettre}` : 'Case vide', onclick: () => retirer(k) }, p.lettre || ''))));
    onChange?.(valeur());
  }
  function poser(tuile) {
    if (bloque || tuile.disabled) return;
    const libre = places.find((p) => p.fixe == null && !p.lettre);
    if (!libre) return;
    libre.lettre = tuile.textContent;
    libre.tuile = tuile;
    tuile.disabled = true;
    jouer('tic');
    dessiner();
  }
  function retirer(k) {
    if (bloque) return;
    const p = places[k];
    if (!p.lettre) return;
    p.tuile.disabled = false;
    p.lettre = null; p.tuile = null;
    dessiner();
  }
  function effacerDerniere() {
    for (let k = places.length - 1; k >= 0; k--) if (places[k].lettre) { retirer(k); return; }
  }
  function valeur() { return places.map((p) => p.fixe ?? p.lettre ?? '').join(''); }

  const conteneur = el('div', { class: 'saisie saisie-etiquettes', tabindex: '-1' },
    rangee, reserve,
    el('div', { class: 'tuiles-outils' }, el('button', { class: 'btn-px petit', type: 'button', onclick: effacerDerniere }, '⌫ Effacer')));
  // Clavier physique : une lettre tapée prend l'étiquette correspondante.
  conteneur.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onValider?.(valeur()); return; }
    if (e.key === 'Backspace') { e.preventDefault(); effacerDerniere(); return; }
    const t = tuiles.find((x) => !x.disabled && x.textContent === e.key.toLowerCase());
    if (t) { e.preventDefault(); poser(t); }
  });
  dessiner();
  return {
    mode: 'etiquettes',
    el: conteneur,
    valeur,
    vider: () => { places.forEach((p) => { if (p.tuile) p.tuile.disabled = false; p.lettre = null; p.tuile = null; }); dessiner(); },
    focus: () => setTimeout(() => conteneur.focus({ preventScroll: true }), 30),
    bloquer: (b) => { bloque = b; conteneur.classList.toggle('eteint', b); },
    marquer: (classe) => { rangee.classList.remove('juste', 'faux'); if (classe) rangee.classList.add(classe); },
    secouer: () => { rangee.classList.remove('secoue'); void rangee.offsetWidth; rangee.classList.add('secoue'); },
    selectionner: () => {},
  };
}

/** Bouton qui bascule clavier / étiquettes pendant l'étape. */
export function bascule(modeInitial, onChange) {
  let mode = modeInitial;
  const b = el('button', { class: 'btn-bascule', type: 'button' });
  const maj = () => {
    remplir(b, mode === 'clavier' ? '🔤 Étiquettes' : '⌨ Clavier');
    b.setAttribute('aria-label', mode === 'clavier' ? 'Utiliser les étiquettes-lettres' : 'Utiliser le clavier');
  };
  b.addEventListener('click', () => { mode = mode === 'clavier' ? 'etiquettes' : 'clavier'; maj(); jouer('choisir'); onChange(mode); });
  maj();
  return { el: b, mode: () => mode };
}

// ---------------------------------------------------------------------------
// Fin de niveau
// ---------------------------------------------------------------------------
export function finDeNiveau({ listeId, etape, titre = 'NIVEAU RÉUSSI !', reussis, total, aRevoir = [], suivante, rejouer, carte, extra = null }) {
  const n = calculerEtoiles(reussis, total);
  const { record, premiereFois } = enregistrerEtoiles(listeId, etape, n);
  jouer('victoire');
  const rangee = el('div', { class: 'fin-etoiles' },
    [0, 1, 2].map((k) => el('span', { class: 'fin-etoile', style: { '--d': `${0.35 + k * 0.35}s` } },
      sprite('etoile', { taille: 64, lignes: k < n ? null : teinter('etoile', { y: 'd', w: 'g' }) }))));
  [0, 1, 2].forEach((k) => { if (k < n) setTimeout(() => jouer('etoile'), 450 + k * 350); });
  const { fermer } = fenetre(el('div', { class: 'fin' },
    el('p', { class: 'fin-titre' }, titre),
    rangee,
    el('p', { class: 'fin-score' }, `${reussis} mot${reussis > 1 ? 's' : ''} sur ${total} du premier coup`),
    record && !premiereFois ? el('p', { class: 'fin-record' }, 'NOUVEAU RECORD !') : null,
    extra,
    aRevoir.length ? el('div', { class: 'fin-revoir' },
      el('p', {}, 'À retravailler :'),
      el('ul', {}, aRevoir.map((m) => el('li', {}, m)))) : null,
    el('div', { class: 'boutons' },
      rejouer ? el('button', { class: 'btn-px', onclick: () => { fermer(); rejouer(); } }, '↻ Rejouer') : null,
      el('button', { class: 'btn-px', onclick: () => { fermer(); carte(); } }, 'Carte'),
      suivante ? el('button', { class: 'btn-px btn-principal', onclick: () => { fermer(); suivante(); } }, 'Étape suivante ▶') : null)),
  { classe: 'fenetre-fin', fermable: false });
  return n;
}

/** Fait défiler l'écran pour que l'élément soit visible (écrans de tablette peu hauts). */
export function voir(noeud) {
  setTimeout(() => noeud.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 60);
}

// ---------------------------------------------------------------------------
// Exercice d'écriture : 2 essais, puis le modèle est montré et l'élève recopie.
// Le retour est immédiat ; la forme fautive n'est jamais réaffichée.
// ---------------------------------------------------------------------------
/**
 * exerciceEcriture(conteneur, {
 *   cible, mode, onMode(mode),          // texte attendu, mode de saisie
 *   onChange(valeur),                    // ex. remplir les trous du mot
 *   indice(alignement),                  // élément d'aide après le 1er essai faux (facultatif)
 *   modele(alignement),                  // élément montrant le mot juste avant la copie
 *   reecouter(),                         // relance l'écoute après une erreur (facultatif)
 *   onJuste(), fin(premierCoup),
 * })
 */
export function exerciceEcriture(conteneur, opts) {
  const { cible } = opts;
  let mode = opts.mode || 'clavier';
  let essais = 0;
  let copie = false;
  let termine = false;
  let attente = null;

  const zoneSaisie = el('div', { class: 'zone-saisie' });
  const message = el('div', { class: 'message', 'aria-live': 'polite' });
  const aide = el('div', { class: 'aide' });
  const btnValider = el('button', { class: 'btn-px btn-principal', type: 'button', onclick: () => valider() }, 'Valider ✓');
  const boutons = el('div', { class: 'boutons' }, btnValider);
  const choixMode = bascule(mode, (m) => { mode = m; opts.onMode?.(m); construire(); saisie.focus(); });
  let saisie;

  function construire() {
    saisie = creerSaisie({ cible, mode, onValider: () => valider(), onChange: opts.onChange });
    remplir(zoneSaisie, saisie.el);
  }

  function valider() {
    if (termine) return;
    const v = saisie.valeur();
    const r = verdict(v, cible);
    if (r === 'vide') { saisie.focus(); return; }
    if (r === 'juste') {
      termine = true;
      saisie.marquer('juste');
      saisie.bloquer(true);
      jouer('juste');
      const premierCoup = essais === 0 && !copie;
      remplir(message, el('span', { class: 'msg-ok' }, premierCoup ? 'Bravo, c\'est juste !' : copie ? 'Bien recopié !' : 'C\'est juste maintenant !'));
      if (premierCoup) bulle('+1', conteneur, 'bulle-ok');
      opts.onJuste?.(premierCoup);
      remplir(boutons, el('button', { class: 'btn-px btn-principal', type: 'button', onclick: () => continuer(premierCoup) }, 'Suivant ▶'));
      boutons.querySelector('button').focus({ preventScroll: true });
      voir(boutons);
      attente = setTimeout(() => continuer(premierCoup), premierCoup ? 1300 : 1800);
      return;
    }
    const alignement = aligner(v, cible);
    saisie.secouer();
    if (copie) {
      jouer('presque');
      remplir(message, el('span', { class: 'msg-ko' }, 'Regarde bien le modèle et recopie-le lettre par lettre.'));
      saisie.vider();
      saisie.focus();
      return;
    }
    essais++;
    if (essais === 1) {
      jouer('presque');
      remplir(message, el('span', { class: 'msg-ko' }, r === 'accent' ? 'Presque ! Vérifie les accents.' : 'Pas tout à fait. Écoute encore et corrige.'));
      remplir(aide, opts.indice ? opts.indice(alignement) : null);
      voir(conteneur);
      opts.reecouter?.();
      saisie.selectionner();
      saisie.focus();
      return;
    }
    jouer('faux');
    copie = true;
    remplir(message, el('span', { class: 'msg-ko' }, 'Voici le mot. Regarde-le bien, puis recopie-le.'));
    remplir(aide, opts.modele(alignement));
    saisie.vider();
    saisie.focus();
    voir(conteneur);
    opts.reecouter?.();
  }

  let parti = false;
  function continuer(premierCoup) {
    clearTimeout(attente);
    if (parti) return;
    parti = true;
    opts.fin(premierCoup);
  }

  construire();
  conteneur.classList.add('exercice');
  remplir(conteneur,
    aide,
    el('div', { class: 'ligne-saisie' }, zoneSaisie, choixMode.el),
    message, boutons);
  saisie.focus();
  return { annuler: () => clearTimeout(attente), focus: () => saisie.focus() };
}

/**
 * Parcourt une liste d'éléments ; un élément raté repasse une fois en fin de file
 * (le revoir un peu plus tard aide à le retenir).
 * jouerElement(element, k, finir(premierCoup)) ; terminer({ reussis, total, aRevoir, resultats })
 */
export function fileDeMots({ c, elements, jouerElement, terminer, nom = (x) => x.mot }) {
  const file = elements.map((e, k) => ({ e, k, repasse: false }));
  const resultats = [];
  let position = 0;
  function suivant() {
    if (position >= file.length) {
      const reussis = resultats.filter((r) => r === true).length;
      terminer({ reussis, total: elements.length, resultats, aRevoir: elements.filter((_, k) => resultats[k] === false).map(nom) });
      return;
    }
    const entree = file[position];
    c.majProgression(entree.k, elements.length, resultats);
    jouerElement(entree.e, entree.k, (premierCoup) => {
      if (!entree.repasse) {
        resultats[entree.k] = premierCoup;
        c.serie(premierCoup);
        if (!premierCoup) file.push({ ...entree, repasse: true });
      }
      position++;
      suivant();
    }, entree.repasse);
  }
  suivant();
}
