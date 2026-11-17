// Relais vers l'API Albert : la clé reste côté serveur, jamais dans le navigateur.
import { construireMessages, lireJson, nettoyer, MODES_ALBERT, preparerPointsLoupe } from './_lib/generation.js';
import { codeValide, refuser, corps } from './_lib/acces.js';
import { propre } from '../src/lib/texte.js';
import { analyser, difficultes } from '../src/lib/ortho.js';

const BASE = (process.env.ALBERT_BASE_URL || 'https://albert.api.etalab.gouv.fr/v1').replace(/\/$/, '');
let modeleEnCache = null;

async function choisirModele(cle) {
  if (process.env.ALBERT_MODEL) return process.env.ALBERT_MODEL;
  if (modeleEnCache) return modeleEnCache;
  const r = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${cle}` } });
  if (!r.ok) throw new Error(`Albert : liste des modèles indisponible (${r.status}).`);
  const { data = [] } = await r.json();
  const texte = data.filter((m) => m.type === 'text-generation');
  const prefere = texte.find((m) => /large/i.test(m.id)) || texte[0];
  if (!prefere) throw new Error('Albert : aucun modèle de génération de texte disponible.');
  modeleEnCache = prefere.id;
  return modeleEnCache;
}

async function appelerAlbert(messages, mode) {
  const cle = process.env.ALBERT_API_KEY;
  if (!cle) throw Object.assign(new Error('La clé ALBERT_API_KEY n\'est pas configurée sur Vercel.'), { statut: 500 });
  const model = await choisirModele(cle);
  const budgets = { complet: 7000, loupe: 7000, pieges: 3500, boss: 3500 };
  const envoyer = (avecFormat) => fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_completion_tokens: budgets[mode],
      ...(/gpt-oss/i.test(model) ? { reasoning_effort: 'low' } : {}),
      ...(avecFormat ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  let r = await envoyer(true);
  // Certains modèles refusent response_format : on réessaie sans.
  if (r.status === 400 || r.status === 422) r = await envoyer(false);
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 300);
    throw Object.assign(new Error(`Albert a répondu ${r.status}. ${detail}`), { statut: 502 });
  }
  const json = await r.json();
  const choix = json.choices?.[0];
  if (choix?.finish_reason === 'length') {
    const conseil = mode === 'complet' ? 'Essayez de générer une activité à la fois.' : 'Essayez avec moins de mots dans la liste.';
    throw Object.assign(new Error(`Albert a atteint sa limite de sortie. ${conseil}`), { statut: 502 });
  }
  return { contenu: choix?.message?.content || '', model };
}

/** Réponse simulée pour tester sans clé (ALBERT_MOCK=1) : règles automatiques + phrases génériques. */
function simulation(mots, reglages, pointsLoupe = []) {
  const n = reglages?.nbPhrasesBoss || 5;
  const gabarits = ['Aujourd\'hui, je pense au mot {a}.', 'Dans mon cahier, j\'écris {a} et {b}.', 'La maîtresse dit {a} en souriant.'];
  const phrases = [];
  for (let k = 0; k < Math.min(n, mots.length); k++) {
    phrases.push(gabarits[k % gabarits.length].replace('{a}', mots[k]).replace('{b}', mots[(k + 1) % mots.length]));
  }
  return JSON.stringify({
    mots: mots.map((m) => {
      const a = analyser(m);
      const points = pointsLoupe.find((x) => x.mot === m)?.points || [];
      return { mot: m, syllabes: a.syllabes, pieges: difficultes(m).map((d) => d.lettres), astuce: a.astuce, astuces: points.map((p) => ({ ...p, texte: `Retiens « ${p.lettres} » dans « ${m} ».` })), famille: '', phrase: `Voici le mot ${m} dans une phrase.` };
    }),
    phrases,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return refuser(res, 405, 'Méthode non autorisée.');
  if (!codeValide(req)) return refuser(res, 401, 'Code studio incorrect.');
  let donnees;
  try { donnees = await corps(req); } catch { return refuser(res, 400, 'Requête illisible.'); }
  const { titre = '', reglages = {}, mode = 'complet' } = donnees;
  if (!MODES_ALBERT.includes(mode)) return refuser(res, 400, 'Activité inconnue.');
  const mots = [...new Set((Array.isArray(donnees.mots) ? donnees.mots : []).map(propre).filter(Boolean))];
  if (!mots.length) return refuser(res, 400, 'La liste ne contient aucun mot.');
  if (mots.length > 30) return refuser(res, 400, 'La liste est trop longue (30 mots maximum).');
  if (mots.some((m) => m.length > 40)) return refuser(res, 400, 'Un des mots est trop long.');
  const pointsLoupe = mode === 'loupe' ? preparerPointsLoupe(mots, donnees.selectionLoupe) : [];
  if (mode === 'loupe' && !pointsLoupe.some((x) => x.points.length)) {
    return refuser(res, 400, 'Surlignez au moins une lettre difficile dans les mots avant de générer la Loupe.');
  }

  try {
    let contenu; let model = 'simulation';
    if (process.env.ALBERT_MOCK === '1') contenu = simulation(mots, reglages, pointsLoupe);
    else ({ contenu, model } = await appelerAlbert(construireMessages({ titre, mots, reglages, mode, pointsLoupe }), mode));
    let brut;
    try { brut = lireJson(contenu); }
    catch { return refuser(res, 502, 'Albert a renvoyé une réponse illisible. Réessayez ou choisissez une autre activité.'); }
    if (!brut || typeof brut !== 'object' || (mode === 'boss' ? !Array.isArray(brut.phrases) : !Array.isArray(brut.mots))) {
      return refuser(res, 502, 'Albert a renvoyé un format incomplet. Réessayez cette activité.');
    }
    const resultat = nettoyer(brut, { mots, reglages, mode, pointsLoupe });
    res.status(200).json({ ...resultat, model });
  } catch (e) {
    refuser(res, e.statut || 500, e.message || 'Erreur inconnue.');
  }
}
