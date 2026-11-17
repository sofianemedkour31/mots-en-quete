import test from 'node:test';
import assert from 'node:assert/strict';
import { construireMessages, nettoyer, preparerPointsLoupe } from '../api/_lib/generation.js';
import handler from '../api/albert.js';

const demande = { titre: 'Les mots', mots: ['bateau', 'gâteau'], reglages: { nbPhrasesBoss: 2 } };
const pointsLoupe = preparerPointsLoupe(demande.mots, [
  { mot: 'bateau', indices: [5, 3, 4, 99, 3] },
  { mot: 'gâteau', indices: [1, 3, 4, 5] },
]);

test('les demandes par activité ne réclament que les champs utiles', () => {
  const pieges = construireMessages({ ...demande, mode: 'pieges' })[1].content;
  const boss = construireMessages({ ...demande, mode: 'boss' })[1].content;
  const loupe = construireMessages({ ...demande, mode: 'loupe', pointsLoupe })[1].content;
  assert.match(pieges, /"pieges"/);
  assert.doesNotMatch(pieges, /"syllabes"|"phrases"/);
  assert.match(boss, /"phrases"/);
  assert.doesNotMatch(boss, /"syllabes"|"pieges"/);
  assert.match(loupe, /"syllabes"/);
  assert.doesNotMatch(loupe, /"phrases"|"pieges"/);
  assert.match(loupe, /"debut":3,"lettres":"eau"/);
  assert.deepEqual(pointsLoupe[1].points, [{ debut: 1, lettres: 'â' }, { debut: 3, lettres: 'eau' }]);
});

test('le nettoyage conserve seulement les données de l’activité demandée', () => {
  const pieges = nettoyer({ mots: [
    { mot: 'bateau', pieges: ['eau'] },
    { mot: 'gâteau', pieges: ['â'] },
  ] }, { ...demande, mode: 'pieges' });
  assert.deepEqual(pieges.mots[0], { mot: 'bateau', pieges: [3, 4, 5] });
  assert.deepEqual(pieges.phrases, []);
  assert.equal(pieges.alertes.length, 0);

  const boss = nettoyer({ phrases: ['Le bateau passe devant le gâteau.'] }, { ...demande, mode: 'boss' });
  assert.deepEqual(boss.mots, []);
  assert.deepEqual(boss.phrases, ['Le bateau passe devant le gâteau.']);

  const loupe = nettoyer({ mots: [
    { mot: 'bateau', syllabes: 'ba/teau', astuces: [
      { debut: 3, lettres: 'eau', texte: 'Pense au groupe eau.' },
      { debut: 0, lettres: 'b', texte: 'Astuce hors sélection.' },
    ], famille: 'bateaux', phrase: 'Le bateau avance.' },
    { mot: 'gâteau', syllabes: 'gâ/teau', astuces: [
      { debut: 1, lettres: 'â', texte: 'Retiens l’accent circonflexe.' },
      { debut: 3, lettres: 'eau', texte: 'Pense au groupe eau.' },
    ], famille: '', phrase: 'Le gâteau est bon.' },
  ] }, { ...demande, mode: 'loupe', pointsLoupe });
  assert.equal(loupe.mots[0].syllabes, 'ba/teau');
  assert.equal(Object.hasOwn(loupe.mots[0], 'pieges'), false);
  assert.equal(loupe.mots[0].astuce, 'Pense au groupe eau.');
  assert.equal(loupe.mots[1].astuce, "Retiens l'accent circonflexe. Pense au groupe eau.");

  const sansPoint = nettoyer({ mots: [{ mot: 'bateau', astuce: 'Astuce inventée.', famille: 'bateaux' }] }, { mots: ['bateau'], mode: 'loupe' });
  assert.equal(sansPoint.mots[0].astuce, '');
  assert.equal(sansPoint.mots[0].famille, '');
});

function reponse() {
  return {
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('l’API renvoie uniquement les éléments demandés pour chaque activité', async () => {
  const avant = { code: process.env.STUDIO_CODE, mock: process.env.ALBERT_MOCK };
  process.env.STUDIO_CODE = 'code-test';
  process.env.ALBERT_MOCK = '1';
  try {
    for (const mode of ['pieges', 'boss']) {
      const res = reponse();
      await handler({ method: 'POST', headers: { 'x-studio-code': 'code-test' }, body: { ...demande, mode } }, res);
      assert.equal(res.code, 200);
      assert.equal(mode === 'boss' ? res.body.mots.length : res.body.phrases.length, 0);
      assert.equal(mode === 'boss' ? res.body.phrases.length : res.body.mots.length, 2);
    }
  } finally {
    if (avant.code === undefined) delete process.env.STUDIO_CODE; else process.env.STUDIO_CODE = avant.code;
    if (avant.mock === undefined) delete process.env.ALBERT_MOCK; else process.env.ALBERT_MOCK = avant.mock;
  }
});

test('la Loupe exige une sélection et n’utilise que les lettres surlignées', async () => {
  const avant = { code: process.env.STUDIO_CODE, mock: process.env.ALBERT_MOCK };
  process.env.STUDIO_CODE = 'code-test';
  process.env.ALBERT_MOCK = '1';
  try {
    const sansSelection = reponse();
    await handler({ method: 'POST', headers: { 'x-studio-code': 'code-test' }, body: { ...demande, mode: 'loupe' } }, sansSelection);
    assert.equal(sansSelection.code, 400);

    const res = reponse();
    await handler({ method: 'POST', headers: { 'x-studio-code': 'code-test' }, body: {
      ...demande, mode: 'loupe', selectionLoupe: [{ mot: 'bateau', indices: [3, 4, 5] }],
    } }, res);
    assert.equal(res.code, 200);
    assert.match(res.body.mots[0].astuce, /eau/);
    assert.equal(res.body.mots[1].astuce, '');
    assert.equal(Object.hasOwn(res.body.mots[0], 'pieges'), false);
  } finally {
    if (avant.code === undefined) delete process.env.STUDIO_CODE; else process.env.STUDIO_CODE = avant.code;
    if (avant.mock === undefined) delete process.env.ALBERT_MOCK; else process.env.ALBERT_MOCK = avant.mock;
  }
});

test('une réponse tronquée d’Albert est signalée sans erreur 500', async () => {
  const avant = { code: process.env.STUDIO_CODE, key: process.env.ALBERT_API_KEY, model: process.env.ALBERT_MODEL, fetch: globalThis.fetch };
  process.env.STUDIO_CODE = 'code-test';
  process.env.ALBERT_API_KEY = 'cle-test';
  process.env.ALBERT_MODEL = 'gpt-oss-120b';
  let requete;
  globalThis.fetch = async (_url, options) => {
    requete = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{"mots": [' } }] }) };
  };
  try {
    const res = reponse();
    await handler({ method: 'POST', headers: { 'x-studio-code': 'code-test' }, body: { ...demande, mode: 'pieges' } }, res);
    assert.equal(res.code, 502);
    assert.match(res.body.erreur, /limite de sortie/);
    assert.equal(requete.max_completion_tokens, 3500);
    assert.equal(requete.reasoning_effort, 'low');
  } finally {
    for (const [nom, valeur] of Object.entries({ STUDIO_CODE: avant.code, ALBERT_API_KEY: avant.key, ALBERT_MODEL: avant.model })) {
      if (valeur === undefined) delete process.env[nom]; else process.env[nom] = valeur;
    }
    globalThis.fetch = avant.fetch;
  }
});
