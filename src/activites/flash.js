// Étape 3 — Photo-Flash : regarder, cacher, écrire de mémoire, vérifier.
// Écrire le mot de mémoire (et non le recopier) est ce qui le fixe le mieux,
// à condition de corriger tout de suite.
import { el, remplir, sprite } from '../ui.js';
import { jouer } from '../sons.js';
import { dire, taire } from '../voix.js';
import { cadre, motColore, motCorrige, exerciceEcriture, fileDeMots } from '../jeu.js';

export function monterFlash(zone, { liste, saisie, terminer }) {
  const consigne = 'Regarde bien le mot. Quand tu l\'as photographié, il se cache : écris-le de mémoire.';
  const c = cadre(zone, { titre: 'Photo-Flash', consigne, spriteNom: 'flash' });
  let mode = saisie;
  let exo = null;

  fileDeMots({
    c,
    elements: liste.mots,
    terminer,
    jouerElement(item, k, finir, repasse) {
      const mot = motColore(item, { pieges: 'souligne' });
      const rideau = el('div', { class: 'rideau', 'aria-hidden': 'true' }, sprite('flash', { taille: 56 }), el('span', {}, 'Mot caché !'));
      const carte = el('div', { class: 'carte-mot flash' }, mot.el, rideau);
      const zoneExo = el('div');
      const btnPhoto = el('button', { class: 'btn-px btn-principal grand', type: 'button', onclick: cacher }, '📸 Je l\'ai photographié');

      remplir(c.scene,
        repasse ? el('p', { class: 'sous-consigne' }, 'On le revoit : regarde-le encore une fois.') : null,
        carte,
        el('div', { class: 'ecoute' },
          el('button', { class: 'btn-px', type: 'button', onclick: () => dire(item.mot, { vitesse: 0.8 }) }, '🔊 Écouter'),
          item.astuce ? el('button', { class: 'btn-px', type: 'button', onclick: () => dire(item.astuce) }, '💡 Astuce') : null),
        el('div', { class: 'boutons' }, btnPhoto),
        zoneExo);
      btnPhoto.focus({ preventScroll: true });
      setTimeout(() => dire(item.mot, { vitesse: 0.8 }), 300);

      function cacher() {
        taire();
        jouer('cacher');
        carte.classList.add('cache');
        btnPhoto.parentNode.remove();
        exo = exerciceEcriture(zoneExo, {
          cible: item.mot,
          mode,
          onMode: (m) => { mode = m; },
          reecouter: () => dire(item.mot, { vitesse: 0.75 }),
          indice: () => el('p', { class: 'sous-consigne' }, item.astuce ? `Astuce : ${item.astuce}` : 'Pense aux syllabes du mot.'),
          modele: (al) => el('div', { class: 'modele' }, el('span', {}, 'Les lettres surlignées sont à revoir :'), motCorrige(item, al)),
          onJuste: () => carte.classList.remove('cache'),
          fin: (premierCoup) => { taire(); finir(premierCoup); },
        });
      }
    },
  });
  return () => { exo?.annuler(); taire(); };
}
