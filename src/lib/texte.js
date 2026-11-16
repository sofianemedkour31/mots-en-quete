// Outils de traitement du texte, partagés par l'application et la fonction Albert.

/** Retire les accents : « Élève » → « Eleve ». */
export function sansAccents(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Apostrophes et espaces homogènes. */
export function propre(s) {
  return String(s ?? '')
    .replace(/[’‘ʼ`´]/g, "'")
    .replace(/ | /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Forme comparable pour la dictée : minuscules, apostrophes droites, accents conservés. */
export function formeDictee(s) {
  return propre(s).toLocaleLowerCase('fr-FR');
}

/** Liste des mots d'un texte (minuscules). */
export function motsDuTexte(texte) {
  const t = propre(texte).toLocaleLowerCase('fr-FR');
  return t.split(/[^a-zàâäçéèêëîïôöùûüÿœæ'-]+/i)
    .flatMap((m) => m.split("'"))
    .map((m) => m.replace(/^-+|-+$/g, ''))
    .filter(Boolean);
}

/** Le mot (ou l'expression) figure-t-il tel quel dans la phrase ? */
export function figureDans(mot, texte) {
  const cible = formeDictee(mot);
  if (!cible) return false;
  if (/[\s'-]/.test(cible)) return formeDictee(texte).includes(cible);
  return motsDuTexte(texte).includes(cible);
}

/**
 * Découpe une phrase en morceaux { type: 'mot'|'sep', v } en gardant tout le texte.
 * Les apostrophes restent attachées au mot qui les précède (« l' »).
 */
export function jetons(phrase) {
  const out = [];
  const re = /([A-Za-zÀ-ÖØ-öø-ÿŒœÆæ0-9]+(?:-[A-Za-zÀ-ÖØ-öø-ÿŒœÆæ0-9]+)*'?)|([^A-Za-zÀ-ÖØ-öø-ÿŒœÆæ0-9]+)/g;
  let r;
  const p = propre(phrase);
  while ((r = re.exec(p))) {
    if (r[1]) out.push({ type: 'mot', v: r[1] });
    else out.push({ type: 'sep', v: r[2] });
  }
  return out;
}

/** Générateur pseudo-aléatoire reproductible. */
export function graine(chaine) {
  let h = 1779033703 ^ chaine.length;
  for (let i = 0; i < chaine.length; i++) {
    h = Math.imul(h ^ chaine.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function melanger(tableau, alea = Math.random) {
  const t = tableau.slice();
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}
