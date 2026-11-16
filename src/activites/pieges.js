// Étape 2 — Pièges : le mot s'affiche avec des trous à la place des lettres difficiles.
// L'élève les retrouve de mémoire : un rappel ciblé, juste sur ce qui pose problème.
import { el, remplir } from '../ui.js';
import { dire, taire } from '../voix.js';
import { cadre, commandesEcoute, motColore, motCorrige, exerciceEcriture, fileDeMots, lettresDuMot } from '../jeu.js';

/** Lettres à cacher : les pièges, sinon la dernière syllabe (ou tout sauf la 1re lettre). */
export function trousPour(item) {
  if (item.pieges.length) return item.pieges;
  const lettres = lettresDuMot(item).filter((l) => !l.blanc);
  const derniere = Math.max(...lettres.map((l) => l.s));
  if (derniere > 0) return lettres.filter((l) => l.s === derniere).map((l) => l.i);
  return lettres.slice(1).map((l) => l.i);
}

export function monterPieges(zone, { liste, saisie, terminer }) {
  const consigne = 'Écoute le mot. Il manque des lettres : écris-les.';
  const c = cadre(zone, { titre: 'Pièges', consigne, spriteNom: 'pieges' });
  let mode = saisie;
  let exo = null;

  fileDeMots({
    c,
    elements: liste.mots,
    terminer,
    jouerElement(item, k, finir) {
      const trous = trousPour(item);
      const cible = trous.map((i) => item.mot[i]).join('');
      const mot = motColore(item, { pieges: 'aucun', trous });
      const zoneExo = el('div');
      remplir(c.scene,
        commandesEcoute(item),
        el('div', { class: 'carte-mot' }, mot.el),
        el('p', { class: 'sous-consigne' }, trous.length > 1 ? `Il manque ${trous.length} lettres.` : 'Il manque 1 lettre.'),
        zoneExo);
      exo = exerciceEcriture(zoneExo, {
        cible,
        mode,
        onMode: (m) => { mode = m; mot.remplirTrous(''); },
        onChange: (v) => mot.remplirTrous(v),
        reecouter: () => dire(item.mot, { vitesse: 0.7 }),
        modele: () => el('div', { class: 'modele' }, el('span', {}, 'Le mot complet :'), motCorrige(item)),
        onJuste: () => mot.reveler('juste'),
        fin: (premierCoup) => { taire(); finir(premierCoup); },
      });
      setTimeout(() => dire(item.mot, { vitesse: 0.8 }), 300);
    },
  });
  return () => { exo?.annuler(); taire(); };
}
