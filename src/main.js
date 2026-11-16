// Application élève : joueur → monde → liste (carte) → étape, plus révisions et trésor.
import { el, vider, remplir, sprite, icone, fenetre } from './ui.js';
import { AVATARS, teinter } from './sprites.js';
import { jouer, basculerMuet, estMuet } from './sons.js';
import { dire, taire } from './voix.js';
import {
  chargerPourEleve, couleurDe, ETAPES, etapesDisponibles, modeApercu, CLE_APERCU,
} from './donnees.js';
import * as P from './profils.js';
import { boutonEcouter, finDeNiveau } from './jeu.js';
import { monterLoupe } from './activites/loupe.js';
import { monterPieges } from './activites/pieges.js';
import { monterFlash } from './activites/flash.js';
import { monterDictee } from './activites/dictee.js';
import { monterBoss } from './activites/boss.js';
import { melanger, graine } from './lib/texte.js';

const MOTEURS = { loupe: monterLoupe, pieges: monterPieges, flash: monterFlash, dictee: monterDictee, boss: monterBoss };
const MAX_REVISION = 12;

let contenu = null;
let nettoyage = null;
const racine = document.getElementById('app');

// ---------------------------------------------------------------------------
// Coque « console »
// ---------------------------------------------------------------------------
const boutonSon = el('button', {
  class: 'console-son',
  'aria-label': 'Activer ou couper les sons',
  onclick: () => { basculerMuet(); majBoutonSon(); jouer('choisir'); },
});
function majBoutonSon() {
  remplir(boutonSon, icone(estMuet() ? 'muet' : 'son', 26));
  boutonSon.setAttribute('aria-pressed', String(estMuet()));
}

const boutonRetour = el('button', { class: 'btn-retour', onclick: () => retour() }, icone('retour', 20), el('span', {}, 'Retour'));
const filAriane = el('nav', { class: 'fil', 'aria-label': 'Où suis-je ?' });
const puceJoueur = el('button', { class: 'puce-joueur', onclick: () => { jouer('choisir'); aller([]); }, 'aria-label': 'Changer de joueur' });
const vue = el('main', { class: 'vue', tabindex: '-1' });
const bandeauApercu = el('div', { class: 'bandeau-apercu', hidden: true },
  'Aperçu enseignant : les listes non validées sont visibles. ',
  el('button', { onclick: () => { sessionStorage.removeItem(CLE_APERCU); location.hash = '#/studio'; } }, 'Revenir au studio'));

racine.append(
  el('div', { class: 'console' },
    el('div', { class: 'console-haut' },
      el('span', { class: 'led', 'aria-hidden': 'true' }),
      el('span', { class: 'marque' }, 'MOTS ', el('b', {}, 'EN QUÊTE')),
      boutonSon),
    el('div', { class: 'ecran' },
      bandeauApercu,
      el('header', { class: 'barre' }, boutonRetour, filAriane, puceJoueur),
      vue),
    el('div', { class: 'console-bas', 'aria-hidden': 'true' },
      el('span', { class: 'croix' }), el('span', { class: 'fentes' }, el('i'), el('i'), el('i')),
      el('span', { class: 'ab' }, el('i', {}, 'B'), el('i', {}, 'A')))),
);
majBoutonSon();

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const route = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
function aller(chemin) { location.hash = `#/${chemin.map(encodeURIComponent).join('/')}`; }

function retour() {
  const r = route();
  jouer('retour');
  if (r[0] === 'm') {
    if (r.length >= 5) return aller(r.slice(0, 4)); // étape → carte
    if (r.length >= 4) return aller(r.slice(0, 2)); // carte → listes
    return aller(['mondes']);                      // listes → mondes
  }
  if (r[0] === 'revision' || r[0] === 'tresor') return aller(['mondes']);
  return aller([]);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.querySelector('.fenetre-fond')) retour();
});

async function afficher() {
  if (route()[0] === 'studio') {
    nettoyage?.(); nettoyage = null;
    const { monterStudio } = await import('./studio/studio.js');
    document.body.classList.add('mode-studio');
    remplir(racine, el('div', { id: 'studio' }));
    monterStudio(document.getElementById('studio'));
    return;
  }
  if (document.body.classList.contains('mode-studio')) { location.reload(); return; }

  taire();
  nettoyage?.();
  nettoyage = null;
  document.querySelectorAll('.fenetre-fond').forEach((f) => f.remove());
  bandeauApercu.hidden = !modeApercu();
  if (!contenu) {
    remplir(vue, el('p', { class: 'chargement' }, 'Chargement…'));
    try { contenu = await chargerPourEleve(); } catch (e) {
      remplir(vue, el('div', { class: 'erreur' }, 'Le contenu n\'a pas pu être chargé. ', e.message));
      return;
    }
  }
  const r = route();
  vider(vue);
  vue.scrollTop = 0;
  vue.focus({ preventScroll: true });
  document.documentElement.style.removeProperty('--p-fond');
  majPuce();

  if (modeApercu() && !P.joueurActif()) P.choisirJoueur(P.INVITE);
  if (!r.length) return ecranAccueil();
  if (!P.joueurActif()) return aller([]);
  if (r[0] === 'mondes') return ecranMondes();
  if (r[0] === 'revision') return ecranRevision();
  if (r[0] === 'tresor') return ecranTresor();
  if (r[0] !== 'm') return aller([]);

  const [, idM, , idL, etape] = r;
  const monde = contenu.parcours.find((m) => String(m.id) === idM);
  if (!monde) return aller(['mondes']);
  appliquerCouleur(monde);
  if (!idL) return ecranListes(monde);
  const index = monde.listes.findIndex((l) => l.id === idL);
  const liste = monde.listes[index];
  if (!liste) return aller(['m', idM]);
  if (!etape) return ecranCarte(monde, liste, index);
  if (!MOTEURS[etape] || !etapeOuverte(monde, liste, etape)) return aller(['m', idM, 'l', idL]);
  ecranEtape(monde, liste, index, etape);
}

function appliquerCouleur(monde) {
  const c = couleurDe(monde);
  document.documentElement.style.setProperty('--p-fond', c.fond);
  document.documentElement.style.setProperty('--p-sombre', c.sombre);
  document.documentElement.style.setProperty('--p-clair', c.clair);
}

function majFil(elements) {
  vider(filAriane);
  boutonRetour.hidden = route().length === 0;
  elements.forEach((e, i) => {
    if (i) filAriane.append(el('span', { class: 'fil-sep', 'aria-hidden': 'true' }, '›'));
    filAriane.append(el('span', { class: i === elements.length - 1 ? 'fil-ici' : '' }, e));
  });
}

function majPuce() {
  const j = P.joueurActif();
  puceJoueur.hidden = !j || route().length === 0;
  if (j) remplir(puceJoueur, sprite(j.avatar, { taille: 30 }), el('span', {}, j.nom));
}

// ---------------------------------------------------------------------------
// Accueil : titre + choix du joueur
// ---------------------------------------------------------------------------
function ecranAccueil() {
  majFil([]);
  const histoire = 'Le Mange-Lettres a volé les lettres des mots de la semaine. À toi de les retrouver !';
  const liste = el('div', { class: 'joueurs' });
  let gestion = false;

  function dessiner() {
    remplir(liste,
      P.joueurs().map((j) => el('div', { class: 'joueur-wrap' },
        el('button', {
          class: 'carte-joueur',
          onclick: () => { jouer('choisir'); P.choisirJoueur(j.id); aller(['mondes']); },
          onpointerenter: () => jouer('deplacer'),
        }, sprite(j.avatar, { taille: 64 }), el('span', {}, j.nom)),
        gestion ? el('button', {
          class: 'joueur-suppr', 'aria-label': `Supprimer ${j.nom}`,
          onclick: () => { if (confirm(`Supprimer ${j.nom} et sa progression sur cet appareil ?`)) { P.supprimerJoueur(j.id); dessiner(); } },
        }, '✕') : null)),
      el('button', { class: 'carte-joueur nouveau', onclick: nouveauJoueur }, el('span', { class: 'plus' }, '+'), el('span', {}, 'Nouveau joueur')));
  }
  dessiner();

  vue.append(
    el('div', { class: 'titre-jeu' },
      el('div', { class: 'logo' },
        el('h1', {}, el('span', {}, 'MOTS'), el('span', {}, 'EN QUÊTE')),
        el('p', { class: 'histoire' }, histoire, ' ', boutonEcouter(histoire, { taille: 'petit' }))),
      sprite('boss', { taille: 120, classe: 'logo-boss' })),
    el('h2', { class: 'titre-section' }, 'Qui joue ?'),
    liste,
    el('div', { class: 'accueil-pied' },
      el('button', { class: 'btn-px', onclick: () => { P.choisirJoueur(P.INVITE); aller(['mondes']); } }, 'Jouer sans enregistrer'),
      P.joueurs().length ? el('button', { class: 'lien', onclick: () => { gestion = !gestion; dessiner(); } }, 'Gérer les joueurs') : null),
    el('p', { class: 'note' }, 'La progression reste sur cet appareil. Rien n\'est envoyé sur Internet.'));
}

function nouveauJoueur() {
  let avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const champ = el('input', { class: 'champ-nom', maxlength: 16, placeholder: 'Ton prénom ou ton pseudo', 'aria-label': 'Ton prénom ou ton pseudo', autocomplete: 'off' });
  const choix = el('div', { class: 'choix-avatars', role: 'radiogroup', 'aria-label': 'Choisis ton personnage' });
  const dessiner = () => remplir(choix, AVATARS.map((a) => el('button', {
    class: `avatar ${a === avatar ? 'choisi' : ''}`, role: 'radio', 'aria-checked': String(a === avatar), 'aria-label': a,
    onclick: () => { avatar = a; jouer('deplacer'); dessiner(); },
  }, sprite(a, { taille: 56 }))));
  dessiner();
  const valider = () => {
    if (!champ.value.trim()) { champ.focus(); return; }
    P.creerJoueur(champ.value, avatar);
    jouer('debloque');
    fermer();
    aller(['mondes']);
  };
  champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') valider(); });
  const { fermer } = fenetre(el('div', { class: 'form-joueur' },
    el('h2', {}, 'Nouveau joueur'),
    champ,
    el('p', {}, 'Choisis ton personnage :'),
    choix,
    el('div', { class: 'boutons' },
      el('button', { class: 'btn-px', onclick: () => fermer() }, 'Annuler'),
      el('button', { class: 'btn-px btn-principal', onclick: valider }, 'C\'est parti ▶'))));
  setTimeout(() => champ.focus(), 60);
}

// ---------------------------------------------------------------------------
// Mondes
// ---------------------------------------------------------------------------
function ecranMondes() {
  majFil(['Mondes']);
  const aRevoir = P.motsARevoir(contenu).length;
  const gemmes = P.contenuCoffre(contenu).filter((x) => x.boite >= P.MAITRISE).length;
  vue.append(
    el('div', { class: 'entete-ecran' },
      el('h1', {}, 'Choisis ton monde'),
      boutonEcouter('Choisis ton monde.')),
    el('div', { class: 'raccourcis' },
      el('button', { class: `raccourci ${aRevoir ? 'alerte-douce' : ''}`, onclick: () => { jouer('choisir'); aller(['revision']); } },
        sprite('coffre', { taille: 48 }),
        el('span', {}, el('b', {}, 'Coffre à révisions'), el('small', {}, aRevoir ? `${aRevoir} mot${aRevoir > 1 ? 's' : ''} t'attend${aRevoir > 1 ? 'ent' : ''} !` : 'Rien à réviser aujourd\'hui'))),
      el('button', { class: 'raccourci', onclick: () => { jouer('choisir'); aller(['tresor']); } },
        sprite('gemme', { taille: 40 }),
        el('span', {}, el('b', {}, 'Mon trésor'), el('small', {}, `${gemmes} mot${gemmes > 1 ? 's' : ''} maîtrisé${gemmes > 1 ? 's' : ''}`)))),
    el('div', { class: 'grille-mondes' },
      contenu.parcours.map((m) => {
        const c = couleurDe(m);
        const n = m.listes.length;
        const max = n * ETAPES.length * 3;
        const gagnees = P.totalEtoiles(m.listes, ETAPES);
        return el('button', {
          class: 'carte-monde',
          style: { '--c': c.fond, '--cs': c.sombre, '--cc': c.clair },
          disabled: n === 0,
          onclick: () => { jouer('choisir'); aller(['m', String(m.id)]); },
          onpointerenter: () => jouer('deplacer'),
        },
        el('span', { class: 'cm-etiquette' }, 'Monde'),
        el('span', { class: 'cm-numero' }, String(m.id)),
        el('span', { class: 'cm-nom' }, m.nom && !/^monde \d+$/i.test(m.nom) ? m.nom : ''),
        el('span', { class: 'cm-info' }, n ? [sprite('etoile', { taille: 18 }), ` ${gagnees} / ${max}`] : 'Bientôt'));
      })),
  );
}

// ---------------------------------------------------------------------------
// Listes d'un monde
// ---------------------------------------------------------------------------
function ecranListes(monde) {
  majFil([nomMonde(monde)]);
  vue.append(
    el('div', { class: 'entete-ecran' },
      el('h1', {}, nomMonde(monde)),
      el('p', {}, 'Choisis ta liste de mots.'), boutonEcouter('Choisis ta liste de mots.')),
    el('ol', { class: 'grille-listes' },
      monde.listes.map((l, i) => {
        const nb = ETAPES.reduce((s, e) => s + (P.etoiles(l.id, e.cle) || 0), 0);
        const bossVaincu = P.etoiles(l.id, 'boss') != null;
        return el('li', {},
          el('button', {
            class: 'carte-liste',
            onclick: () => { jouer('choisir'); aller(['m', String(monde.id), 'l', l.id]); },
            onpointerenter: () => jouer('deplacer'),
          },
          el('span', { class: 'cl-numero' }, String(i + 1).padStart(2, '0')),
          el('span', { class: 'cl-corps' },
            el('span', { class: 'cl-titre' }, l.titre || `Liste ${i + 1}`),
            el('span', { class: 'cl-mots' }, `${l.mots.length} mots`),
            el('span', { class: 'cl-etoiles' }, sprite('etoile', { taille: 16 }), ` ${nb} / ${ETAPES.length * 3}`, bossVaincu ? sprite('couronne', { taille: 20, classe: 'cl-couronne' }) : null)),
          !l.valide ? el('span', { class: 'cl-brouillon' }, 'non validée') : null));
      })),
  );
}

const nomMonde = (m) => m.nom || `Monde ${m.id}`;

// ---------------------------------------------------------------------------
// Carte d'une liste : 5 étapes à débloquer
// ---------------------------------------------------------------------------
function etatsEtapes(monde, liste) {
  const dispo = etapesDisponibles(liste);
  const libre = monde.reglages?.deblocage === 'libre' || modeApercu();
  let precedenteFaite = true;
  return ETAPES.map((e) => {
    const ferme = !dispo[e.cle];
    const n = P.etoiles(liste.id, e.cle);
    const ouvert = !ferme && (libre || precedenteFaite);
    if (!ferme) precedenteFaite = n != null;
    return { ...e, ferme, ouvert, etoiles: n };
  });
}

function etapeOuverte(monde, liste, cle) {
  return etatsEtapes(monde, liste).find((e) => e.cle === cle)?.ouvert;
}

// Positions des étapes sur la carte (en % de la largeur et de la hauteur).
const POSITIONS = [[9, 60], [29, 27], [50, 58], [71, 25], [90, 52]];

function ecranCarte(monde, liste, index) {
  majFil([nomMonde(monde), liste.titre || `Liste ${index + 1}`]);
  const etats = etatsEtapes(monde, liste);
  const courante = etats.findIndex((e) => e.ouvert && e.etoiles == null);
  const ici = courante >= 0 ? courante : etats.map((e) => e.ouvert).lastIndexOf(true);
  let debloque = null;
  try { debloque = sessionStorage.getItem('mq-debloque'); sessionStorage.removeItem('mq-debloque'); } catch { /* rien */ }
  const j = P.joueurActif();

  const chemin = POSITIONS.map(([x, y]) => `${x},${y}`).join(' ');
  const carte = el('div', { class: 'carte' },
    el('div', { class: 'carte-decor', 'aria-hidden': 'true', html: decorCarte(chemin) }),
    etats.map((e, k) => {
      const [x, y] = POSITIONS[k];
      const etat = e.ferme ? 'ferme' : !e.ouvert ? 'verrouille' : e.etoiles != null ? 'fait' : 'ouvert';
      return el('div', { class: `noeud noeud-${etat} ${e.cle === 'boss' ? 'noeud-boss' : ''} ${debloque === e.cle ? 'vient-de-debloquer' : ''}`, style: { left: `${x}%`, top: `${y}%` } },
        k === ici && j ? el('span', { class: 'noeud-joueur' }, sprite(j.avatar, { taille: 40 })) : null,
        el('button', {
          class: 'noeud-bouton',
          disabled: !e.ouvert,
          'aria-label': `${e.nom}. ${e.ferme ? 'Étape fermée par la maîtresse ou le maître.' : !e.ouvert ? 'Étape verrouillée : termine l\'étape d\'avant.' : e.aide}`,
          onclick: () => { jouer('choisir'); aller(['m', String(monde.id), 'l', liste.id, e.cle]); },
          onpointerenter: () => e.ouvert && jouer('deplacer'),
        },
        sprite(e.ouvert || e.ferme ? e.sprite : 'cadenas', { taille: e.cle === 'boss' && e.ouvert ? 50 : 40 })),
        el('span', { class: 'noeud-nom' }, `${k + 1}. ${e.nom}`),
        el('span', { class: 'noeud-etoiles', 'aria-label': e.etoiles != null ? `${e.etoiles} étoile(s)` : '' },
          [0, 1, 2].map((s) => sprite('etoile', { taille: 16, lignes: e.etoiles != null && s < e.etoiles ? null : teinter('etoile', { y: 'd', w: 'd' }) }))));
    }));
  if (debloque) setTimeout(() => jouer('debloque'), 250);

  const prochaine = etats[ici];
  vue.append(
    el('div', { class: 'entete-ecran' },
      el('p', { class: 'surtitre' }, `${nomMonde(monde)} · Liste ${index + 1}`),
      el('h1', {}, liste.titre || `Liste ${index + 1}`)),
    el('div', { class: 'mots-liste' }, liste.mots.map((m) => el('button', { class: 'puce-mot', onclick: () => dire(m.mot, { vitesse: 0.8 }) }, m.mot))),
    carte,
    prochaine?.ouvert ? el('div', { class: 'boutons' },
      el('button', { class: 'btn-px btn-principal grand', onclick: () => { jouer('choisir'); aller(['m', String(monde.id), 'l', liste.id, prochaine.cle]); } },
        prochaine.etoiles == null ? `Jouer : ${prochaine.nom} ▶` : 'Rejouer une étape ▶'),
      boutonEcouter(prochaine.aide)) : null,
  );
}

/** Décor de la carte : étoiles, nuages, collines en pixels, et chemin en pointillés. */
function decorCarte(points) {
  const alea = graine('decor');
  let px = '';
  for (let k = 0; k < 40; k++) px += `<rect x="${Math.floor(alea() * 160)}" y="${Math.floor(alea() * 34)}" width="1" height="1" fill="#fff1e8" opacity="${(0.3 + alea() * 0.6).toFixed(2)}"/>`;
  const nuage = (x, y) => `<g fill="#83769c" opacity=".55"><rect x="${x + 2}" y="${y}" width="8" height="2"/><rect x="${x}" y="${y + 2}" width="14" height="2"/><rect x="${x + 4}" y="${y + 4}" width="12" height="2"/></g>`;
  const collines = (base, amplitude, phase, couleur) => {
    let r = '';
    for (let x = 0; x < 160; x += 4) {
      const h = Math.round(base + amplitude * Math.sin((x + phase) / 17) + (amplitude / 2) * Math.sin((x + phase) / 7));
      r += `<rect x="${x}" y="${70 - h}" width="4" height="${h}" style="fill:${couleur}"/>`;
    }
    return r;
  };
  return `<svg viewBox="0 0 160 70" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges">
      ${px}${nuage(14, 8)}${nuage(96, 4)}${nuage(128, 16)}
      ${collines(20, 5, 0, 'color-mix(in srgb, var(--p-sombre) 55%, #1d2b53)')}
      ${collines(11, 4, 40, 'var(--p-sombre)')}
      <rect x="0" y="66" width="160" height="4" fill="#1a1226" opacity=".5"/>
    </svg>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points="${points}" fill="none" stroke="#1a1226" vector-effect="non-scaling-stroke" style="stroke-width:16px" stroke-linejoin="bevel"/>
      <polyline points="${points}" fill="none" stroke="#ffccaa" vector-effect="non-scaling-stroke" style="stroke-width:8px" stroke-dasharray="12 10" stroke-linejoin="bevel"/>
    </svg>`;
}

// ---------------------------------------------------------------------------
// Une étape
// ---------------------------------------------------------------------------
function ecranEtape(monde, liste, index, cle) {
  const e = ETAPES.find((x) => x.cle === cle);
  majFil([nomMonde(monde), liste.titre || `Liste ${index + 1}`, e.nom]);
  const zone = el('section', { class: `etape etape-${cle}` });
  vue.append(zone);
  const versCarte = () => aller(['m', String(monde.id), 'l', liste.id]);
  nettoyage = MOTEURS[cle](zone, {
    liste,
    monde,
    saisie: monde.reglages?.saisie || 'clavier',
    terminer: (stats) => {
      const avant = etatsEtapes(monde, liste);
      const suivante = ETAPES.slice(ETAPES.indexOf(e) + 1).find((x) => !avant.find((a) => a.cle === x.cle).ferme);
      const dejaOuverte = suivante && avant.find((a) => a.cle === suivante.cle).ouvert;
      finDeNiveau({
        ...stats,
        listeId: liste.id,
        etape: cle,
        suivante: suivante ? () => aller(['m', String(monde.id), 'l', liste.id, suivante.cle]) : null,
        rejouer: () => afficher(),
        carte: () => {
          if (suivante && !dejaOuverte) { try { sessionStorage.setItem('mq-debloque', suivante.cle); } catch { /* rien */ } }
          versCarte();
        },
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Coffre à révisions (répétition espacée)
// ---------------------------------------------------------------------------
function etageresCoffre() {
  const tout = P.contenuCoffre(contenu);
  return el('div', { class: 'etageres', 'aria-label': 'Les boîtes du coffre' },
    [1, 2, 3, 4, 5].map((b) => {
      const n = tout.filter((x) => x.boite === b).length;
      return el('div', { class: 'etagere' },
        el('span', { class: 'etagere-num' }, `Boîte ${b}`),
        el('span', { class: 'etagere-n' }, String(n)),
        el('span', { class: 'etagere-rythme' }, b === 1 ? 'chaque jour' : `${P.INTERVALLES[b]} jours`));
    }),
    el('div', { class: 'etagere etagere-gemmes' }, sprite('gemme', { taille: 28 }), el('span', { class: 'etagere-n' }, String(tout.filter((x) => x.boite >= P.MAITRISE).length)), el('span', { class: 'etagere-rythme' }, 'maîtrisés')));
}

function ecranRevision() {
  majFil(['Coffre à révisions']);
  const dus = P.motsARevoir(contenu);
  const coffre = P.contenuCoffre(contenu);
  const explication = 'Les mots reviennent de moins en moins souvent : chaque jour, puis tous les 2, 4, 8 et 16 jours. Réussi du premier coup, un mot monte d\'une boîte. Raté, il retourne dans la boîte 1.';

  const commencer = (elements, libre) => {
    vider(vue);
    const zone = el('section', { class: 'etape etape-revision' });
    vue.append(zone);
    const promus = [];
    nettoyage = monterDictee(zone, {
      liste: null,
      elements,
      titre: libre ? 'Révision libre' : 'Révisions du jour',
      saisie: 'clavier',
      onResultat: (listeId, item, ok) => {
        if (libre) return;
        const b = P.reviser(listeId, item.mot, ok);
        if (b >= P.MAITRISE) promus.push(item.mot);
      },
      terminer: ({ reussis, total, aRevoir }) => {
        jouer('victoire');
        const { fermer } = fenetre(el('div', { class: 'fin' },
          el('p', { class: 'fin-titre' }, 'RÉVISIONS FINIES !'),
          sprite('coffre', { taille: 96 }),
          el('p', { class: 'fin-score' }, `${reussis} mot${reussis > 1 ? 's' : ''} sur ${total} du premier coup`),
          promus.length ? el('div', { class: 'fin-gemmes' }, el('p', {}, 'Nouvelles gemmes :'), el('ul', {}, promus.map((m) => el('li', {}, sprite('gemme', { taille: 22 }), m)))) : null,
          aRevoir.length ? el('div', { class: 'fin-revoir' }, el('p', {}, 'Ils reviendront demain :'), el('ul', {}, aRevoir.map((m) => el('li', {}, m)))) : null,
          el('div', { class: 'boutons' },
            el('button', { class: 'btn-px btn-principal', onclick: () => { fermer(); aller(['mondes']); } }, 'Retour aux mondes'))),
        { classe: 'fenetre-fin', fermable: false });
      },
    });
  };

  const elementsDe = (liste) => liste.map((x) => ({ item: x.item, listeId: x.liste.id }));
  const libres = coffre.filter((x) => x.boite < P.MAITRISE);

  vue.append(
    el('div', { class: 'entete-ecran' },
      el('h1', {}, 'Coffre à révisions'),
      el('p', {}, explication), boutonEcouter(explication)),
    etageresCoffre(),
    dus.length
      ? el('div', { class: 'panneau-revision' },
        sprite('coffre', { taille: 72, classe: 'coffre-ouvert' }),
        el('p', { class: 'grand-texte' }, `${dus.length} mot${dus.length > 1 ? 's' : ''} à réviser aujourd'hui`),
        dus.length > MAX_REVISION ? el('p', {}, `On en fait ${MAX_REVISION} maintenant, les autres ensuite.`) : null,
        el('button', { class: 'btn-px btn-principal grand', onclick: () => { jouer('choisir'); commencer(elementsDe(dus.slice(0, MAX_REVISION)), false); } }, 'Ouvrir le coffre ▶'))
      : el('div', { class: 'panneau-revision' },
        sprite('coffre', { taille: 72 }),
        el('p', { class: 'grand-texte' }, coffre.length ? 'Rien à réviser aujourd\'hui. Reviens demain !' : 'Ton coffre est vide.'),
        el('p', {}, coffre.length ? 'Tu peux quand même t\'entraîner : la révision libre ne change pas les boîtes.' : 'Termine la Dictée radio ou le Boss d\'une liste : ses mots viendront se ranger ici.'),
        libres.length ? el('button', { class: 'btn-px', onclick: () => commencer(elementsDe(melanger(libres).slice(0, 8)), true) }, 'Révision libre ▶') : null),
  );
}

// ---------------------------------------------------------------------------
// Trésor : les mots maîtrisés deviennent des gemmes
// ---------------------------------------------------------------------------
const TEINTES_GEMMES = ['b', 'G', 'p', 'o', 'y', 'r', 'l'];

function ecranTresor() {
  majFil(['Mon trésor']);
  const tout = P.contenuCoffre(contenu);
  const gemmes = tout.filter((x) => x.boite >= P.MAITRISE);
  const enCours = tout.filter((x) => x.boite < P.MAITRISE).sort((a, b) => b.boite - a.boite);
  vue.append(
    el('div', { class: 'entete-ecran' },
      el('h1', {}, 'Mon trésor'),
      el('p', {}, gemmes.length ? `${gemmes.length} mot${gemmes.length > 1 ? 's' : ''} maîtrisé${gemmes.length > 1 ? 's' : ''} !` : 'Un mot devient une gemme quand il a passé les 5 boîtes du coffre.')),
    gemmes.length ? el('ul', { class: 'gemmes' }, gemmes.map((g, k) => el('li', {},
      sprite('gemme', { taille: 44, lignes: teinter('gemme', { b: TEINTES_GEMMES[k % TEINTES_GEMMES.length] }) }),
      el('button', { class: 'gemme-mot', onclick: () => dire(g.item.mot, { vitesse: 0.8 }) }, g.item.mot)))) : el('div', { class: 'tresor-vide' }, sprite('gemme', { taille: 72, lignes: teinter('gemme', { b: 'd', w: 'g', n: 'k' }) })),
    enCours.length ? el('h2', { class: 'titre-section' }, 'En route vers le trésor') : null,
    enCours.length ? el('ul', { class: 'en-route' }, enCours.map((x) => el('li', {},
      el('span', { class: 'er-mot' }, x.item.mot),
      el('span', { class: 'er-boites', 'aria-label': `Boîte ${x.boite} sur 5` }, [1, 2, 3, 4, 5].map((b) => el('i', { class: b <= x.boite ? 'plein' : '' })))))) : null,
  );
}

window.addEventListener('hashchange', afficher);
afficher();
