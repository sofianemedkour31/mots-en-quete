// Étape 1 — Loupe : observer le mot, trouver soi-même les lettres pièges,
// comprendre pourquoi (astuce, mot de la même famille), puis « photographier » le mot.
// Attirer l'attention sur la partie difficile aide à la retenir.
import { el, remplir, bulle } from '../ui.js';
import { jouer } from '../sons.js';
import { dire, taire } from '../voix.js';
import { cadre, commandesEcoute, motColore, boutonEcouter, voir } from '../jeu.js';

export function monterLoupe(zone, { liste, terminer }) {
  const mots = liste.mots;
  const consigne = 'Écoute le mot. Touche les lettres pièges : celles qu\'on n\'entend pas, ou qui s\'écrivent d\'une façon surprenante.';
  const c = cadre(zone, { titre: 'Loupe', consigne, spriteNom: 'loupe' });
  let i = 0;
  let reussis = 0;
  const resultats = [];

  function afficher() {
    c.majProgression(i, mots.length, resultats);
    const item = mots[i];
    const aTrouver = new Set(item.pieges);
    let erreurs = 0;
    let fini = false;

    const message = el('div', { class: 'message', 'aria-live': 'polite' });
    const explication = el('div', { class: 'explication', hidden: true });
    const suite = el('div', { class: 'boutons' });
    const mot = motColore(item, {
      pieges: 'aucun',
      cliquable: aTrouver.size > 0,
      onLettre: (l, bouton) => {
        if (fini || bouton.classList.contains('trouve')) return;
        if (aTrouver.has(l.i)) {
          bouton.classList.add('trouve');
          aTrouver.delete(l.i);
          jouer('trouve');
          if (!aTrouver.size) terminerMot();
        } else {
          erreurs++;
          bouton.classList.remove('rate'); void bouton.offsetWidth; bouton.classList.add('rate');
          jouer('presque');
          remplir(message, el('span', { class: 'msg-doux' }, erreurs >= 3 ? 'Regarde : les pièges clignotent.' : 'Cette lettre-là s\'entend bien. Cherche encore !'));
          if (erreurs >= 3) montrerPieges();
        }
      },
    });

    function montrerPieges() {
      mot.spans.forEach((s, k) => { if (aTrouver.has(mot.lettres[k].i)) s.classList.add('indice'); });
    }

    function terminerMot() {
      fini = true;
      mot.spans.forEach((s, k) => { if (item.pieges.includes(mot.lettres[k].i)) s.classList.add('trouve'); });
      const premierCoup = erreurs === 0;
      resultats[i] = premierCoup;
      if (premierCoup) reussis++;
      c.serie(premierCoup);
      if (item.pieges.length) {
        bulle(premierCoup ? 'BIEN VU !' : 'TROUVÉ !', carteMot, 'bulle-ok');
        jouer('juste');
      }
      if (item.pieges.length) remplir(message);
      explication.hidden = false;
      remplir(explication,
        item.astuce ? el('p', { class: 'astuce' }, el('span', { class: 'astuce-titre' }, 'Astuce'), ' ', item.astuce, ' ', boutonEcouter(item.astuce, { taille: 'petit' })) : null,
        item.famille ? el('p', { class: 'famille' }, el('span', { class: 'astuce-titre' }, 'Même famille'), ' ', item.famille, ' ', boutonEcouter(item.famille, { taille: 'petit' })) : null,
        el('p', { class: 'photo' }, '📸 Ferme les yeux et revois le mot dans ta tête. Épelle-le tout bas.'));
      remplir(suite, el('button', {
        class: 'btn-px btn-principal',
        onclick: suivant,
      }, i + 1 < mots.length ? 'Mot suivant ▶' : 'Terminer ▶'));
      suite.querySelector('button').focus({ preventScroll: true });
      voir(suite);
    }

    const carteMot = el('div', { class: 'carte-mot' }, mot.el);
    remplir(c.scene,
      commandesEcoute(item),
      carteMot,
      message,
      explication,
      suite);

    if (!item.pieges.length) {
      // Mot régulier : rien à chercher, on observe les syllabes.
      remplir(message, el('span', { class: 'msg-doux' }, 'Pas de piège dans ce mot : il s\'écrit comme on l\'entend. Lis-le syllabe par syllabe.'));
      erreurs = 0;
      setTimeout(terminerMot, 0);
    }
    setTimeout(() => dire(item.mot, { vitesse: 0.8 }), 300);
  }

  function suivant() {
    taire();
    i++;
    if (i < mots.length) afficher();
    else terminer({ reussis, total: mots.length, aRevoir: mots.filter((_, k) => resultats[k] === false).map((m) => m.mot) });
  }

  afficher();
  return () => taire();
}
