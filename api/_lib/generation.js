// Prompt envoyé à Albert et vérification de sa réponse.
import { propre, figureDans } from '../../src/lib/texte.js';
import { syllaber, indicesDepuis, piegesAuto, astuceAuto, SEPARATEUR } from '../../src/lib/ortho.js';

export const REGLAGES_DEFAUT = { niveau: 'CE2', nbPhrasesBoss: 5 };

export const MODES_ALBERT = ['complet', 'loupe', 'pieges', 'boss'];

export function construireMessages({ titre, mots, reglages, mode = 'complet' }) {
  const r = { ...REGLAGES_DEFAUT, ...(reglages || {}) };
  r.nbPhrasesBoss = Math.min(10, Math.max(1, Math.trunc(Number(r.nbPhrasesBoss) || 5)));
  const systeme = [
    'Tu es un professeur des écoles français, spécialiste de l\'enseignement de l\'orthographe lexicale.',
    'Tu prépares la révision d\'une liste de mots de dictée pour des élèves de 7 à 10 ans, dont certains en difficulté.',
    'Tu t\'appuies sur la morphologie (mots de la même famille), les correspondances graphèmes-phonèmes et les régularités du français.',
    'Tu réponds uniquement avec un objet JSON valide, sans texte autour, sans balises de code.',
  ].join(' ');

  const contexte = `Niveau des élèves : ${r.niveau}.
Titre de la liste : ${titre || '(sans titre)'}
Mots (à recopier exactement, dans cet ordre) :
${mots.map((m) => `- ${m}`).join('\n')}`;
  const reglePieges = '- "pieges" : la liste des lettres ou groupes de lettres difficiles, recopiés tels qu\'ils sont dans le mot : lettres muettes, consonnes doubles, graphies rares ou concurrentes, accents. 1 à 3 pièges maximum. Liste vide si le mot s\'écrit comme il se prononce.';
  const couverture = mots.length <= r.nbPhrasesBoss * 3
    ? 'Tous les mots de la liste doivent apparaître au moins une fois.'
    : 'Utilise autant de mots différents de la liste que possible, sans dépasser 3 mots par phrase.';
  const consignesBoss = `Donne exactement ${r.nbPhrasesBoss} phrases courtes (8 à 15 mots) pour une dictée finale. Chaque phrase contient 1 à 3 mots de la liste, exactement sous leur forme (pas de pluriel ni de conjugaison différente). ${couverture} Les autres mots des phrases doivent être simples et fréquents.`;

  let consignes;
  if (mode === 'boss') {
    consignes = `${contexte}\n\n${consignesBoss}\n\nFormat attendu : {"phrases": ["…"]}`;
  } else if (mode === 'pieges') {
    consignes = `${contexte}\n\nPour chaque mot, donne :\n- "mot" : le mot exactement comme ci-dessus.\n${reglePieges}\n\nFormat attendu : {"mots": [{"mot": "…", "pieges": ["…"]}]}`;
  } else {
    consignes = `${contexte}

Pour chaque mot, donne :
- "mot" : le mot exactement comme ci-dessus.
- "syllabes" : le mot découpé en syllabes écrites, séparées par « / », selon la convention de l'école (pom/me, ta/ble, ba/teau). En recollant les morceaux, on doit retrouver exactement le mot.
${mode === 'complet' ? reglePieges : ''}
- "astuce" : une phrase courte (20 mots maximum), adressée à l'élève, qui explique comment se souvenir du piège. Privilégie une raison (mot de la même famille, règle simple, analogie avec un mot connu) plutôt qu'un « il faut le savoir ».
- "famille" : 1 à 3 mots de la même famille qui justifient l'orthographe (par exemple « petite, petitesse » pour petit), séparés par des virgules. Chaîne vide s'il n'y en a pas d'utile.
- "phrase" : une phrase simple de 6 à 12 mots qui contient le mot exactement sous cette forme, avec un vocabulaire connu des élèves.
${mode === 'complet' ? `\n${consignesBoss}` : ''}

Format attendu : ${mode === 'complet'
    ? '{"mots": [{"mot": "…", "syllabes": "…/…", "pieges": ["…"], "astuce": "…", "famille": "…", "phrase": "…"}], "phrases": ["…"]}'
    : '{"mots": [{"mot": "…", "syllabes": "…/…", "astuce": "…", "famille": "…", "phrase": "…"}]}'}`;
  }

  return [
    { role: 'system', content: systeme },
    { role: 'user', content: consignes },
  ];
}

/** Extrait le premier objet JSON d'une réponse (tolère les balises ```json). */
export function lireJson(contenu) {
  if (contenu && typeof contenu === 'object') return contenu;
  const s = String(contenu || '').replace(/```(?:json)?/gi, '').trim();
  const debut = s.indexOf('{');
  const fin = s.lastIndexOf('}');
  if (debut < 0 || fin <= debut) throw new Error('Réponse d\'Albert illisible (pas de JSON).');
  return JSON.parse(s.slice(debut, fin + 1));
}

/** Vérifie et nettoie la proposition d'Albert. La liste de mots de l'enseignant fait foi. */
export function nettoyer(brut, { mots, reglages, mode = 'complet' }) {
  const r = { ...REGLAGES_DEFAUT, ...(reglages || {}) };
  r.nbPhrasesBoss = Math.min(10, Math.max(1, Math.trunc(Number(r.nbPhrasesBoss) || 5)));
  const alertes = [];
  const proposes = new Map((Array.isArray(brut.mots) ? brut.mots : [])
    .filter((x) => x && typeof x === 'object')
    .map((x) => [propre(x.mot).toLocaleLowerCase('fr-FR'), x]));

  const sortie = mode === 'boss' ? [] : mots.map((mot) => {
    const p = proposes.get(mot.toLocaleLowerCase('fr-FR')) || {};
    if (!p.mot) alertes.push(`« ${mot} » : Albert ne l'a pas traité, proposition automatique.`);

    let syllabes = propre(p.syllabes).replace(/\s*[-|·]\s*/g, SEPARATEUR).replace(/\s*\/\s*/g, SEPARATEUR);
    if (syllabes.split(SEPARATEUR).join('') !== mot) {
      if (p.syllabes) alertes.push(`« ${mot} » : découpage en syllabes corrigé automatiquement.`);
      syllabes = syllaber(mot);
    }

    const morceaux = Array.isArray(p.pieges) ? p.pieges : typeof p.pieges === 'string' ? p.pieges.split(',') : [];
    let pieges = indicesDepuis(mot, morceaux);
    if (!p.mot) pieges = piegesAuto(mot);
    else if (morceaux.length && !pieges.length) {
      alertes.push(`« ${mot} » : lettres pièges introuvables dans le mot, proposition automatique.`);
      pieges = piegesAuto(mot);
    }
    if (mode === 'pieges') return { mot, pieges };

    let phrase = propre(p.phrase);
    if (phrase && !figureDans(mot, phrase)) {
      alertes.push(`« ${mot} » : la phrase ne contient pas le mot, retirée.`);
      phrase = '';
    }
    const proposition = {
      mot,
      syllabes,
      astuce: propre(p.astuce).slice(0, 220) || astuceAuto(mot),
      famille: propre(p.famille).slice(0, 80),
      phrase,
    };
    return mode === 'complet' ? { ...proposition, pieges } : proposition;
  });

  const phrases = [];
  if (mode === 'complet' || mode === 'boss') {
    for (const ph of Array.isArray(brut.phrases) ? brut.phrases : []) {
      const t = propre(ph);
      if (!t) continue;
      if (!mots.some((m) => figureDans(m, t))) { alertes.push(`Boss : « ${t} » ne contient aucun mot de la liste, retirée.`); continue; }
      phrases.push(t);
    }
    const absents = mots.filter((m) => !phrases.some((p) => figureDans(m, p)));
    if (phrases.length && absents.length && mots.length <= r.nbPhrasesBoss * 3) alertes.push(`Boss : ces mots n'apparaissent dans aucune phrase : ${absents.join(', ')}.`);
    if (phrases.length < r.nbPhrasesBoss) alertes.push(`Boss : ${phrases.length} phrase(s) au lieu de ${r.nbPhrasesBoss}.`);
  }

  return { mots: sortie, phrases, alertes };
}
