// Étape 4 — Dictée radio : le mot est seulement entendu, jamais montré avant la réponse.
// C'est le rappel le plus exigeant ; les mots travaillés entrent dans le coffre à révisions.
import { el, remplir } from '../ui.js';
import { dire, taire, voixDisponible } from '../voix.js';
import { cadre, commandesEcoute, motCorrige, lettresBienPlacees, exerciceEcriture, fileDeMots } from '../jeu.js';
import { entrerAuCoffre } from '../profils.js';

/**
 * Sert aussi aux révisions : elements = [{ item, listeId }], titre et sprite modifiables.
 */
export function monterDictee(zone, { liste, saisie, terminer, elements = null, titre = 'Dictée radio', onResultat = null }) {
  const consigne = 'Écoute le mot, puis écris-le. Tu peux le réécouter autant de fois que tu veux.';
  const c = cadre(zone, { titre, consigne, spriteNom: 'dictee' });
  const liste2 = elements || liste.mots.map((item) => ({ item, listeId: liste.id }));
  let mode = saisie;
  let exo = null;
  if (!voixDisponible()) c.scene.before(el('p', { class: 'alerte' }, 'La voix n\'est pas disponible sur cet appareil : demande à un adulte de dicter les mots.'));

  fileDeMots({
    c,
    elements: liste2,
    nom: (x) => x.item.mot,
    terminer,
    jouerElement({ item, listeId }, k, finir, repasse) {
      const zoneExo = el('div');
      remplir(c.scene,
        el('div', { class: 'radio' }, el('span', { class: 'radio-ondes', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), commandesEcoute(item)),
        repasse ? el('p', { class: 'sous-consigne' }, 'Ce mot revient : montre que tu t\'en souviens !') : null,
        zoneExo);
      exo = exerciceEcriture(zoneExo, {
        cible: item.mot,
        mode,
        onMode: (m) => { mode = m; },
        reecouter: () => dire(item.mot, { vitesse: 0.7 }),
        indice: (al) => lettresBienPlacees(al),
        modele: (al) => el('div', { class: 'modele' }, el('span', {}, 'Le mot s\'écrit :'), motCorrige(item, al)),
        fin: (premierCoup) => {
          taire();
          if (!repasse) {
            if (onResultat) onResultat(listeId, item, premierCoup);
            else entrerAuCoffre(listeId, item.mot, premierCoup);
          }
          finir(premierCoup);
        },
      });
      setTimeout(() => dire(item.mot, { vitesse: 0.8 }), 350);
    },
  });
  return () => { exo?.annuler(); taire(); };
}
