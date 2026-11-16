// Étape 5 — Le Boss : des phrases dictées où il faut écrire les mots de la liste.
// Les mots sont retrouvés en contexte ; chaque mot écrit fait perdre de l'énergie au Mange-Lettres.
// Pas de « game over » : le boss finit toujours par être vaincu, seules les étoiles changent.
import { el, remplir, sprite, bulle, attendre } from '../ui.js';
import { jouer } from '../sons.js';
import { dire, taire } from '../voix.js';
import { cadre, motCorrige, lettresBienPlacees, exerciceEcriture } from '../jeu.js';
import { phrasesBoss } from '../donnees.js';
import { entrerAuCoffre } from '../profils.js';

export function monterBoss(zone, { liste, monde, saisie, terminer }) {
  const phrases = phrasesBoss(liste, monde.reglages?.nbPhrasesBoss || 5);
  const consigne = 'Écoute la phrase. Écris les mots qui manquent pour battre le Mange-Lettres !';
  const c = cadre(zone, { titre: 'Le Boss', consigne, spriteNom: 'couronne' });
  const cibles = phrases.flatMap((p, ip) => p.morceaux.map((m, im) => (m.cible ? { ip, im, item: m.cible } : null)).filter(Boolean));
  const total = cibles.length;
  let pv = total;
  let mode = saisie;
  let exo = null;
  let annule = false;
  const resultats = [];

  const jauge = el('span', { class: 'pv-remplissage' });
  const bossSprite = sprite('boss', { taille: 132, classe: 'boss-sprite' });
  const arene = el('div', { class: 'arene' },
    el('div', { class: 'boss-zone' }, bossSprite),
    el('div', { class: 'boss-infos' },
      el('p', { class: 'boss-nom' }, 'LE MANGE-LETTRES'),
      el('div', { class: 'pv', role: 'meter', 'aria-label': 'Énergie du boss', 'aria-valuemin': 0, 'aria-valuemax': total }, jauge),
      el('p', { class: 'boss-dit' }, 'Hé hé ! J\'ai mangé des lettres…')));
  const zonePhrase = el('div', { class: 'phrase-boss', lang: 'fr' });
  const zoneExo = el('div');
  const commandes = el('div', { class: 'ecoute' });
  remplir(c.scene, arene, zonePhrase, commandes, zoneExo);

  function majJauge() {
    jauge.style.width = `${(pv / total) * 100}%`;
    jauge.parentNode.setAttribute('aria-valuenow', pv);
  }
  majJauge();

  function dessinerPhrase(ip, actif) {
    const p = phrases[ip];
    remplir(zonePhrase, p.morceaux.map((m, im) => {
      if (!m.cible) return el('span', {}, m.v);
      const fait = cibles.find((x) => x.ip === ip && x.im === im);
      const k = cibles.indexOf(fait);
      if (resultats[k] != null) return el('span', { class: `trou-phrase rempli ${resultats[k] ? 'ok' : 'ko'}` }, m.v);
      return el('span', { class: `trou-phrase ${im === actif ? 'actif' : ''}`, style: { '--n': [...m.cible.mot].length } }, im === actif ? '?' : '');
    }));
  }

  async function jouerCible(k) {
    if (annule) return;
    if (k >= total) { victoire(); return; }
    const { ip, im, item } = cibles[k];
    c.majProgression(k, total, resultats);
    dessinerPhrase(ip, im);
    remplir(commandes,
      el('button', { class: 'btn-son', type: 'button', onclick: () => dire(phrases[ip].phrase, { vitesse: 0.85 }) }, '🔊 La phrase'),
      el('button', { class: 'btn-px', type: 'button', onclick: () => dire(item.mot, { vitesse: 0.75 }) }, 'Le mot seul'));
    exo = exerciceEcriture(zoneExo, {
      cible: item.mot,
      mode,
      onMode: (m) => { mode = m; },
      reecouter: () => dire(item.mot, { vitesse: 0.7 }),
      indice: (al) => lettresBienPlacees(al),
      modele: (al) => el('div', { class: 'modele' }, el('span', {}, 'Le mot s\'écrit :'), motCorrige(item, al)),
      onJuste: (premierCoup) => frapper(premierCoup),
      fin: (premierCoup) => {
        resultats[k] = premierCoup;
        c.serie(premierCoup);
        entrerAuCoffre(liste.id, item.mot, premierCoup);
        taire();
        jouerCible(k + 1);
      },
    });
    const nouvellePhrase = k === 0 || cibles[k - 1].ip !== ip;
    if (nouvellePhrase) setTimeout(() => dire(phrases[ip].phrase, { vitesse: 0.85 }), 400);
    else setTimeout(() => dire(item.mot, { vitesse: 0.8 }), 400);
  }

  function frapper(premierCoup) {
    pv = Math.max(0, pv - 1);
    majJauge();
    jouer('coup');
    bossSprite.classList.remove('touche'); void bossSprite.offsetWidth; bossSprite.classList.add('touche');
    bulle(premierCoup ? 'CRITIQUE !' : 'TOUCHÉ !', arene, 'bulle-coup');
    const dit = arene.querySelector('.boss-dit');
    dit.textContent = pv === 0 ? 'Nooon ! Mes lettres !' : premierCoup ? 'Aïe ! Tu connais ce mot !' : 'Ouille…';
  }

  async function victoire() {
    c.majProgression(total, total, resultats);
    remplir(zoneExo);
    remplir(commandes);
    arene.classList.add('vaincu');
    jouer('explosion');
    await attendre(1200);
    if (annule) return;
    const reussis = resultats.filter(Boolean).length;
    const aRevoir = [...new Set(cibles.filter((_, k) => !resultats[k]).map((x) => x.item.mot))];
    terminer({ reussis, total, aRevoir, titre: 'BOSS VAINCU !' });
  }

  // Le boss se moque gentiment quand on se trompe.
  zone.addEventListener('click', (e) => {
    if (e.target.closest?.('.btn-principal') && zoneExo.querySelector('.msg-ko')) {
      bossSprite.classList.remove('rit'); void bossSprite.offsetWidth; bossSprite.classList.add('rit');
    }
  });

  jouerCible(0);
  return () => { annule = true; exo?.annuler(); taire(); };
}
