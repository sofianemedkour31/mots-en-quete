import test from 'node:test';
import assert from 'node:assert/strict';
import { phrasesBoss, preparerListe } from '../src/donnees.js';

const ciblesDe = (mots, phrases) => phrasesBoss(preparerListe({
  mots: mots.map((mot) => ({ mot })),
  phrases,
})).map((p) => p.morceaux.filter((m) => m.cible).map((m) => m.cible.mot));

test('reconnaît les expressions dans les phrases du boss', () => {
  const cibles = ciblesDe(
    ['une mouche', 'le gâteau', 'le pique-nique', 'du salami', 'de la semoule'],
    [
      "Dans la cuisine, une mouche s'est posée sur le gâteau au chocolat.",
      'Le pique-nique comprend du pain, du fromage, du salami et des fruits.',
      'Après le repas, nous avons rangé de la semoule, une mouche et du salami.',
    ],
  );
  assert.deepEqual(cibles, [
    ['une mouche', 'le gâteau'],
    ['le pique-nique', 'du salami'],
    ['de la semoule', 'une mouche', 'du salami'],
  ]);
});

test('garde les mots simples et évite les sous-mots', () => {
  assert.deepEqual(ciblesDe(['pain', 'gâteau'], ['Les pains sont prêts.', 'Le gâteau est prêt.']), [['gâteau']]);
});

test('préfère une expression entière à un mot contenu dedans', () => {
  assert.deepEqual(ciblesDe(['gâteau', 'le gâteau'], ['Le gâteau est prêt.']), [['le gâteau']]);
  assert.deepEqual(ciblesDe(['école', "l'école"], ["L'école ouvre demain."]), [["l'école"]]);
});
