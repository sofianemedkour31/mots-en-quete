// Studio enseignant : saisir une liste de mots, la compléter (Albert ou automatiquement),
// relire, valider, publier.
import { el, vider, remplir } from '../ui.js';
import { COULEURS, CLE_BROUILLON, CLE_APERCU, REGLAGES, ETAPES, chargerPublie, lireBrouillon, preparerListe, phrasesBoss } from '../donnees.js';
import { propre, figureDans } from '../lib/texte.js';
import { analyser, syllaber, pointsLoupe, SEPARATEUR } from '../lib/ortho.js';
import { dire } from '../voix.js';

const CLE_CODE = 'mq-studio-code';
const CLE_META = 'mq-studio-meta';
const NIVEAUX = ['CP', 'CE1', 'CE2', 'CM1', 'CM2', 'ULIS'];

export async function monterStudio(racine) {
  const lien = el('link', { rel: 'stylesheet', href: new URL('./studio.css', import.meta.url).href });
  document.head.append(lien);
  document.title = 'Studio — Mots en quête';

  let contenu = lireBrouillon();
  let meta = lireMeta();
  let publie = null;
  try { publie = await chargerPublie(); } catch { /* hors ligne : on garde le brouillon */ }
  if (!contenu) { contenu = structuredClone(publie || { version: 2, parcours: [] }); meta = { modifie: false }; }
  normaliser(contenu);

  let code = sessionStorage.getItem(CLE_CODE) || '';
  let statut = null; // { albert, publier }
  let mId = contenu.parcours[0]?.id;
  let lId = null;
  let enGeneration = false;

  // --- Squelette -----------------------------------------------------------
  const zoneConnexion = el('div', { class: 'st-connexion' });
  const pastilleEtat = el('span', { class: 'st-etat' });
  const zoneActions = el('div', { class: 'st-actions' });
  const onglets = el('nav', { class: 'st-onglets', 'aria-label': 'Mondes' });
  const colonne = el('aside', { class: 'st-colonne' });
  const editeur = el('section', { class: 'st-editeur' });
  const notif = el('div', { class: 'st-notif', role: 'status', 'aria-live': 'polite' });

  remplir(racine,
    el('header', { class: 'st-haut' },
      el('div', { class: 'st-titre' }, el('b', {}, 'Studio'), el('span', {}, 'Mots en quête')),
      pastilleEtat, zoneActions, zoneConnexion),
    onglets,
    el('div', { class: 'st-corps' }, colonne, editeur),
    notif);

  // --- Connexion (code studio) ----------------------------------------------
  function majConnexion() {
    if (statut) {
      remplir(zoneConnexion,
        el('span', { class: `st-badge ${statut.albert ? 'ok' : 'ko'}` }, statut.albert ? 'Albert connecté' : 'Albert non configuré'),
        el('button', { class: 'st-lien', onclick: () => { sessionStorage.removeItem(CLE_CODE); code = ''; statut = null; majConnexion(); majActions(); majEditeur(); } }, 'Se déconnecter'));
      return;
    }
    const champ = el('input', { type: 'password', placeholder: 'Code studio', 'aria-label': 'Code studio', autocomplete: 'current-password' });
    remplir(zoneConnexion, el('form', { class: 'st-form-code', onsubmit: (e) => { e.preventDefault(); verifierCode(champ.value); } },
      champ, el('button', { class: 'st-btn' }, 'Connecter Albert')));
  }

  async function verifierCode(valeur, silencieux = false) {
    try {
      const r = await fetch('/api/statut', { headers: { 'x-studio-code': valeur } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erreur || `Erreur ${r.status}`);
      code = valeur;
      statut = j;
      sessionStorage.setItem(CLE_CODE, valeur);
      if (!silencieux) notifier('Studio connecté.');
    } catch (e) {
      statut = null;
      if (!silencieux) notifier(e.message === 'Failed to fetch' ? 'Serveur injoignable.' : e.message, 'erreur');
    }
    majConnexion(); majActions(); majColonne(); majEditeur();
  }

  // --- Barre d'actions -------------------------------------------------------
  function majActions() {
    remplir(pastilleEtat, meta.modifie ? 'Modifications non publiées' : 'À jour');
    pastilleEtat.classList.toggle('modifie', Boolean(meta.modifie));
    const fichier = el('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: importer });
    remplir(zoneActions,
      el('button', { class: 'st-btn st-btn-clair', onclick: () => apercu() }, 'Voir côté élève'),
      el('button', { class: 'st-btn st-btn-clair', onclick: exporter }, 'Exporter le fichier'),
      el('button', { class: 'st-btn st-btn-clair', onclick: () => fichier.click() }, 'Importer'),
      fichier,
      statut?.publier ? el('button', { class: 'st-btn st-btn-fort', onclick: publier, disabled: !meta.modifie }, 'Publier pour les élèves') : null,
      el('button', { class: 'st-lien', onclick: repartirPublie, title: 'Abandonner le brouillon local' }, 'Recharger la version publiée'));
  }

  // --- Onglets des mondes ----------------------------------------------------
  function majOnglets() {
    remplir(onglets, contenu.parcours.map((m) => {
      const c = COULEURS[m.couleur] || COULEURS.vert;
      const nbV = m.listes.filter((l) => l.valide).length;
      return el('button', {
        class: `st-onglet ${m.id === mId ? 'actif' : ''}`,
        style: { '--c': c.fond, '--cs': c.sombre },
        onclick: () => { mId = m.id; lId = null; majOnglets(); majColonne(); majEditeur(); },
      }, el('span', { class: 'st-pastille' }), m.nom, el('small', {}, `${nbV}/${m.listes.length} validées`));
    }));
  }

  const mondeCourant = () => contenu.parcours.find((m) => m.id === mId);
  const listeCourante = () => mondeCourant()?.listes.find((l) => l.id === lId);

  // --- Colonne : réglages + listes -------------------------------------------
  function majColonne() {
    const m = mondeCourant();
    if (!m) { vider(colonne); return; }
    const r = m.reglages;
    const choix = (libelle, cle, options, aide = null) => el('label', { class: 'st-champ-court' }, libelle,
      el('select', { onchange: (e) => { r[cle] = e.target.value; sauver(); } },
        Object.entries(options).map(([k, v]) => el('option', { value: k, selected: r[cle] === k }, v))),
      aide ? el('small', {}, aide) : null);
    const sansContenu = m.listes.filter((l) => l.mots.length && l.mots.some((x) => !x.phrase));

    remplir(colonne,
      el('details', { class: 'st-reglages' },
        el('summary', {}, 'Réglages du monde'),
        el('label', { class: 'st-champ-court' }, 'Nom',
          el('input', { value: m.nom, onchange: (e) => { m.nom = e.target.value || m.nom; sauver(); majOnglets(); } })),
        el('label', { class: 'st-champ-court' }, 'Couleur',
          el('select', { onchange: (e) => { m.couleur = e.target.value; sauver(); majOnglets(); } },
            Object.keys(COULEURS).map((k) => el('option', { value: k, selected: m.couleur === k }, k)))),
        choix('Niveau visé', 'niveau', Object.fromEntries(NIVEAUX.map((n) => [n, n])), 'Albert adapte les phrases et les astuces.'),
        choix('Étapes', 'deblocage', { progressif: 'À débloquer dans l\'ordre', libre: 'Toutes ouvertes' }),
        choix('Saisie par défaut', 'saisie', { clavier: 'Clavier', etiquettes: 'Étiquettes-lettres' }, 'L\'élève peut toujours changer pendant le jeu.'),
        el('label', { class: 'st-champ-court' }, 'Phrases du boss (maximum)',
          el('input', { type: 'number', min: 1, max: 10, value: r.nbPhrasesBoss, onchange: (e) => { r.nbPhrasesBoss = Number(e.target.value) || 5; sauver(); } }))),
      el('div', { class: 'st-liste-entete' },
        el('h2', {}, `Listes (${m.listes.length})`),
        el('button', { class: 'st-btn', onclick: nouvelleListe }, '+ Liste')),
      el('ol', { class: 'st-liste' },
        m.listes.map((l, i) => el('li', { class: l.id === lId ? 'actif' : '' },
          el('button', { class: 'st-item', onclick: () => { lId = l.id; majColonne(); majEditeur(); } },
            el('span', { class: 'st-num' }, String(i + 1).padStart(2, '0')),
            el('span', { class: 'st-item-titre' }, l.titre || 'Sans titre'),
            pastilleListe(l)),
          el('span', { class: 'st-ordre' },
            el('button', { 'aria-label': 'Monter', disabled: i === 0, onclick: () => deplacer(i, -1) }, '↑'),
            el('button', { 'aria-label': 'Descendre', disabled: i === m.listes.length - 1, onclick: () => deplacer(i, 1) }, '↓'))))),
      sansContenu.length
        ? el('button', { class: 'st-btn st-btn-clair st-plein', disabled: !statut?.albert || enGeneration, onclick: genererTout },
          `Compléter avec Albert les ${sansContenu.length} liste(s) incomplète(s)`)
        : null);
  }

  function pastilleListe(l) {
    if (l.valide) return el('span', { class: 'st-statut valide' }, 'validée');
    if (l.mots.length) return el('span', { class: 'st-statut relire' }, `${l.mots.length} mots · à relire`);
    return el('span', { class: 'st-statut vide' }, 'vide');
  }

  function deplacer(i, d) {
    const l = mondeCourant().listes;
    [l[i], l[i + d]] = [l[i + d], l[i]];
    sauver(); majColonne();
  }

  function nouvelleListe() {
    const m = mondeCourant();
    const l = { id: `l-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, titre: '', valide: false, mots: [], phrases: [], etapes: {} };
    m.listes.push(l);
    lId = l.id;
    sauver(); majOnglets(); majColonne(); majEditeur();
    editeur.querySelector('input')?.focus();
  }

  // --- Éditeur de la liste ---------------------------------------------------
  function majEditeur() {
    const m = mondeCourant();
    const l = listeCourante();
    if (!l) {
      remplir(editeur, el('div', { class: 'st-vide' },
        el('h2', {}, m ? m.nom : 'Aucun monde'),
        el('p', {}, m?.listes.length ? 'Choisissez une liste, ou ajoutez-en une.' : 'Ce monde n\'a pas encore de liste. Ajoutez-en une avec « + Liste ».'),
        el('p', { class: 'st-aide' }, 'Chaque liste devient un niveau de 5 étapes pour l\'élève : Loupe, Pièges, Photo-Flash, Dictée radio et Boss.')));
      return;
    }
    const zoneMots = el('textarea', { rows: 6, placeholder: 'Un mot par ligne\nbateau\ngâteau\nchâteau', 'aria-label': 'Mots de la liste' }, l.mots.map((x) => x.mot).join('\n'));

    const btnAlbert = el('button', {
      class: 'st-btn st-btn-fort',
      disabled: !statut?.albert || enGeneration || !l.mots.length,
      onclick: () => generer(l),
    }, enGeneration ? 'Albert prépare la liste…' : 'Tout compléter avec Albert');
    const boutonActivite = (mode, libelle) => el('button', {
      class: 'st-btn st-btn-clair',
      disabled: !statut?.albert || enGeneration || !l.mots.length,
      onclick: () => generer(l, mode),
    }, libelle);

    remplir(editeur,
      el('div', { class: 'st-bloc' },
        el('label', { class: 'st-champ' }, 'Titre de la liste',
          el('input', { value: l.titre, placeholder: 'Ex. : Le son [o] : au, eau, ô', oninput: (e) => { l.titre = e.target.value; sauver(); majTitreListe(); } })),
        el('div', { class: 'st-deux' },
          el('label', { class: 'st-champ' }, el('span', {}, 'Mots de la liste ', el('small', {}, 'un par ligne, 6 à 12 conseillés')), zoneMots),
          el('div', { class: 'st-pile' },
            el('button', { class: 'st-btn', onclick: () => majMots(l, zoneMots.value) }, 'Mettre à jour les mots'),
            btnAlbert,
            el('p', { class: 'st-aide' }, 'Pour une longue liste, générez une activité à la fois : chaque réponse d’Albert sera plus courte.'),
            boutonActivite('loupe', 'Loupe · astuces ciblées'),
            el('p', { class: 'st-aide' }, 'Pour la Loupe, cliquez sur les lettres des mots ci-dessous. Vérifiez les points proposés et corrigez leur séparation si nécessaire.'),
            boutonActivite('pieges', 'Pièges · lettres difficiles'),
            boutonActivite('boss', 'Boss · phrases'),
            el('button', { class: 'st-btn st-btn-clair', disabled: !l.mots.length, onclick: () => remplirAuto(l) }, 'Remplir sans Albert'),
            !statut ? el('p', { class: 'st-aide' }, 'Entrez le code studio (en haut à droite) pour utiliser Albert.') : null,
            statut && !statut.albert ? el('p', { class: 'st-aide' }, 'La clé ALBERT_API_KEY n\'est pas configurée sur Vercel.') : null,
            el('p', { class: 'st-aide' }, 'Photo-Flash et Dictée radio utilisent directement les mots saisis. « Remplir sans Albert » propose des indices à partir de règles simples.'))),
        l._alertes?.length ? el('div', { class: 'st-alertes' },
          el('strong', {}, 'Points à vérifier :'),
          el('ul', {}, l._alertes.map((x) => el('li', {}, x))),
          el('button', { class: 'st-lien', onclick: () => { delete l._alertes; sauver(); majEditeur(); } }, 'Masquer')) : null),

      carte('mots', `Les mots (${l.mots.length})`, null, editeurMots(l)),
      carte('boss', 'Phrases du boss', null, editeurPhrases(l)),
      carte('etapes', 'Étapes proposées aux élèves', null, editeurEtapes(l)),

      el('div', { class: 'st-pied' },
        el('span', { class: `st-statut grand ${l.valide ? 'valide' : 'relire'}` }, l.valide ? 'Validée : visible par les élèves après publication' : 'Brouillon : invisible pour les élèves'),
        el('button', { class: 'st-btn st-btn-clair', onclick: () => apercu(l) }, 'Aperçu élève'),
        l.valide
          ? el('button', { class: 'st-btn st-btn-clair', onclick: () => { l.valide = false; sauver(); majOnglets(); majColonne(); majEditeur(); } }, 'Repasser en brouillon')
          : el('button', { class: 'st-btn st-btn-fort', onclick: () => valider(l) }, 'Valider cette liste'),
        el('button', { class: 'st-btn st-btn-danger', onclick: () => supprimer(l) }, 'Supprimer')),
    );
  }

  function majTitreListe() {
    const li = colonne.querySelector('.st-liste li.actif .st-item-titre');
    if (li) li.textContent = listeCourante()?.titre || 'Sans titre';
  }

  function carte(cle, titre, _activite, ...contenuCarte) {
    return el('section', { class: 'st-carte' },
      el('div', { class: 'st-carte-entete' },
        el('span', { class: `st-ico st-ico-${cle}` }),
        el('h3', { class: 'st-carte-titre' }, titre)),
      el('div', { class: 'st-carte-corps' }, contenuCarte));
  }

  /** Ajoute les nouveaux mots (pré-remplis automatiquement) et retire ceux qui ont disparu. */
  function majMots(l, texte) {
    const saisis = [...new Set(texte.split(/[\n,;]/).map((x) => propre(x)).filter(Boolean))];
    const anciens = new Map(l.mots.map((x) => [x.mot, x]));
    l.mots = saisis.map((mot) => anciens.get(mot) || analyser(mot));
    l.valide = false;
    sauver(); majOnglets(); majColonne(); majEditeur();
    notifier(`${l.mots.length} mot(s). Les nouveaux mots ont reçu une proposition automatique : relisez-la.`);
  }

  function remplirAuto(l) {
    for (const x of l.mots) {
      const a = analyser(x.mot);
      if (!x.syllabes) x.syllabes = a.syllabes;
      if (!x.pieges?.length) x.pieges = a.pieges;
      if (!x.astuce) x.astuce = a.astuce;
    }
    sauver(); majEditeur();
    notifier('Cases vides complétées. Les phrases et les mots de la même famille restent à écrire (ou à demander à Albert).');
  }

  function editeurMots(l) {
    if (!l.mots.length) return el('p', { class: 'st-aide' }, 'Tapez les mots dans la zone ci-dessus puis cliquez sur « Mettre à jour les mots ».');
    return el('div', { class: 'st-mots' },
      el('p', { class: 'st-aide' }, 'Cliquez sur les lettres d\'un mot pour marquer ou retirer les lettres pièges (en jaune). Les syllabes se séparent par une barre : ba/teau.'),
      l.mots.map((x, i) => {
        const syllOk = String(x.syllabes || '').split(SEPARATEUR).join('') === x.mot;
        const phraseOk = !x.phrase || figureDans(x.mot, x.phrase);
        const points = pointsLoupe(x.mot, x.pieges, x.groupesLoupe);
        const groupes = points.map((p) => [...p.lettres].map((_, k) => p.debut + k));
        const changerGroupes = (nouveaux) => {
          x.groupesLoupe = nouveaux;
          if (x.astucesLoupe?.length) { x.astucesLoupe = []; x.astuce = ''; }
          l.valide = false;
          sauver(); majEditeur();
        };
        const lettres = el('div', { class: 'st-lettres', role: 'group', 'aria-label': `Lettres pièges de ${x.mot}` },
          [...x.mot].map((c, k) => el('button', {
            class: `st-lettre ${x.pieges.includes(k) ? 'piege' : ''} ${/[\s'-]/.test(c) ? 'blanc' : ''}`,
            type: 'button',
            'aria-pressed': String(x.pieges.includes(k)),
            disabled: enGeneration,
            onclick: (e) => {
              x.pieges = x.pieges.includes(k) ? x.pieges.filter((n) => n !== k) : [...x.pieges, k].sort((a, b) => a - b);
              delete x.groupesLoupe;
              if (x.astucesLoupe?.length) { x.astucesLoupe = []; x.astuce = ''; }
              l.valide = false;
              e.currentTarget.classList.toggle('piege');
              e.currentTarget.setAttribute('aria-pressed', String(x.pieges.includes(k)));
              sauver(); majEditeur();
            },
          }, c)));
        const panneauPoints = points.length ? el('div', { class: 'st-points' },
          el('strong', {}, 'Points de la Loupe :'),
          points.map((p, j) => el('div', { class: 'st-point' },
            el('span', {}, `« ${p.lettres} »`),
            groupes[j].length > 1 ? [...p.lettres].slice(1).map((_, k) => el('button', {
              class: 'st-lien', type: 'button', disabled: enGeneration,
              onclick: () => changerGroupes([
                ...groupes.slice(0, j), groupes[j].slice(0, k + 1), groupes[j].slice(k + 1), ...groupes.slice(j + 1),
              ]),
            }, `Séparer après ${[...p.lettres][k]}`)) : null,
            points[j + 1]?.debut === p.debut + [...p.lettres].length ? el('button', {
              class: 'st-lien', type: 'button', disabled: enGeneration,
              onclick: () => changerGroupes([
                ...groupes.slice(0, j), [...groupes[j], ...groupes[j + 1]], ...groupes.slice(j + 2),
              ]),
            }, 'Fusionner avec le suivant') : null))) : null;
        const astuces = x.astucesLoupe?.length ? el('div', { class: 'st-astuces' },
          x.astucesLoupe.map((a) => el('div', { class: 'st-astuce' },
            el('label', {}, `Astuce pour « ${a.lettres} » `, a.aValider ? el('em', { class: 'st-warn' }, 'à valider') : null,
              el('input', { value: a.texte || '', oninput: (e) => {
                a.texte = e.target.value; a.aValider = true;
                x.astuce = x.astucesLoupe.map((t) => t.texte).filter(Boolean).join(' ');
                l.valide = false; sauver();
              }, onchange: () => majEditeur() })),
            a.aValider ? el('button', { class: 'st-mini st-valider-astuce', type: 'button', title: `Valider l'astuce pour ${a.lettres}`, 'aria-label': `Valider l'astuce pour ${a.lettres}`,
              onclick: () => { if (!a.texte?.trim()) return notifier('Écrivez une astuce avant de la valider.', 'erreur'); a.aValider = false; sauver(); majEditeur(); },
            }, 'Valider') : null))) : el('label', { class: 'st-champ-court' }, 'Astuce (dite à l\'élève)',
              el('input', { value: x.astuce || '', placeholder: 'Ex. : le t ne s\'entend pas : pense à petite.', oninput: (e) => { x.astuce = e.target.value; sauver(); } }));
        return el('div', { class: 'st-mot' },
          el('div', { class: 'st-mot-tete' },
            lettres,
            el('span', { class: 'st-outils' },
              el('button', { class: 'st-mini', title: 'Écouter', onclick: () => dire(x.mot, { vitesse: 0.8 }) }, '▶'),
              el('button', { class: 'st-mini', title: 'Monter', disabled: i === 0, onclick: () => { [l.mots[i - 1], l.mots[i]] = [l.mots[i], l.mots[i - 1]]; sauver(); majEditeur(); } }, '↑'),
              el('button', { class: 'st-mini', title: 'Retirer', onclick: () => { l.mots.splice(i, 1); sauver(); majEditeur(); } }, '✕'))),
          panneauPoints,
          el('div', { class: 'st-mot-champs' },
            el('label', { class: 'st-champ-court' }, el('span', {}, 'Syllabes ', !syllOk ? el('em', { class: 'st-warn' }, 'ne correspond pas au mot') : null),
              el('span', { class: 'st-avec-bouton' },
                el('input', { value: x.syllabes || '', placeholder: syllaber(x.mot), oninput: (e) => { x.syllabes = e.target.value.trim(); sauver(); }, onchange: () => majEditeur() }),
                el('button', { class: 'st-mini', title: 'Découpe automatique', onclick: () => { x.syllabes = syllaber(x.mot); sauver(); majEditeur(); } }, '↺'))),
            astuces,
            el('label', { class: 'st-champ-court' }, 'Même famille (facultatif)',
              el('input', { value: x.famille || '', placeholder: 'Ex. : petite, petitesse', oninput: (e) => { x.famille = e.target.value; sauver(); } })),
            el('label', { class: 'st-champ-court' }, el('span', {}, 'Phrase pour l\'entendre en contexte ', !phraseOk ? el('em', { class: 'st-warn' }, 'ne contient pas le mot') : null),
              el('input', { value: x.phrase || '', placeholder: 'Une phrase courte qui contient le mot', oninput: (e) => { x.phrase = e.target.value; sauver(); }, onchange: () => majEditeur() }))));
      }));
  }

  function editeurPhrases(l) {
    const apercuBoss = phrasesBoss(preparerListe(l), mondeCourant().reglages.nbPhrasesBoss);
    const sansMot = (l.phrases || []).filter((p) => p.trim() && !l.mots.some((x) => figureDans(x.mot, p)));
    return el('div', {},
      el('label', { class: 'st-champ' }, el('span', {}, 'Phrases ', el('small', {}, 'une par ligne ; les mots de la liste y deviennent des trous à compléter')),
        el('textarea', {
          rows: 4,
          placeholder: 'Le bateau passe devant le château.',
          onchange: (e) => { l.phrases = e.target.value.split('\n').map(propre).filter(Boolean); l.valide = false; sauver(); majEditeur(); },
        }, (l.phrases || []).join('\n'))),
      sansMot.length ? el('p', { class: 'st-warn' }, `Sans mot de la liste (ignorées) : ${sansMot.join(' / ')}`) : null,
      el('p', { class: 'st-aide' }, !(l.phrases || []).length
        ? 'Sans phrases ici, le boss utilise les phrases de chaque mot.'
        : `Le boss utilisera ${apercuBoss.length} phrase(s), soit ${apercuBoss.reduce((s, p) => s + p.morceaux.filter((x) => x.cible).length, 0)} mot(s) à écrire.`),
      apercuBoss.length ? el('ul', { class: 'st-apercu-boss' }, apercuBoss.map((p) => el('li', {},
        p.morceaux.map((x) => (x.cible ? el('span', { class: 'st-trou' }, x.v) : x.v))))) : null);
  }

  function editeurEtapes(l) {
    l.etapes ||= {};
    return el('div', { class: 'st-etapes' },
      ETAPES.map((e) => el('label', { class: 'st-etape' },
        el('input', { type: 'checkbox', checked: l.etapes[e.cle] !== false, onchange: (ev) => { l.etapes[e.cle] = ev.target.checked; sauver(); } }),
        el('span', {}, el('b', {}, e.nom), el('small', {}, e.aide)))),
      el('p', { class: 'st-aide' }, 'Une étape décochée est sautée : la suivante se débloque directement.'));
  }

  // --- Albert -----------------------------------------------------------------
  async function appelAlbert(l, mode = 'complet') {
    const r = await fetch('/api/albert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-studio-code': code },
      body: JSON.stringify({
        titre: l.titre, mots: l.mots.map((x) => x.mot), reglages: mondeCourant().reglages, mode,
        ...(mode === 'loupe' ? { selectionLoupe: l.mots.map((x) => ({ mot: x.mot, indices: x.pieges, groupes: x.groupesLoupe })) } : {}),
      }),
    });
    const j = await r.json().catch(() => ({ erreur: `Réponse illisible (${r.status}).` }));
    if (!r.ok) throw new Error(j.erreur || `Erreur ${r.status}`);
    return j;
  }

  function appliquer(l, resultat, mode = 'complet') {
    if (mode !== 'boss') {
      const parMot = new Map(resultat.mots.map((x) => [x.mot, x]));
      l.mots = l.mots.map((x) => {
        const proposition = parMot.get(x.mot) || {};
        if (mode === 'pieges') {
          const pieges = proposition.pieges || x.pieges;
          return JSON.stringify(pieges) === JSON.stringify(x.pieges) ? x
            : { ...x, pieges, groupesLoupe: undefined, astucesLoupe: [], astuce: '' };
        }
        return mode === 'complet' ? { ...x, ...proposition, groupesLoupe: undefined, astucesLoupe: [] }
          : { ...x, ...proposition };
      });
    }
    if ((mode === 'complet' || mode === 'boss') && resultat.phrases?.length) l.phrases = resultat.phrases;
    l._alertes = resultat.alertes;
    l.valide = false;
  }

  async function generer(l, mode = 'complet') {
    if (mode === 'loupe' && !l.mots.some((x) => x.pieges?.length)) {
      notifier('Surlignez au moins une lettre difficile dans les mots avant de générer la Loupe.', 'erreur');
      return;
    }
    const dejaRempli = mode === 'boss' ? l.phrases.length
      : mode === 'pieges' ? l.mots.some((x) => x.pieges?.length)
        : l.mots.some((x) => x.phrase || x.famille);
    const remplacement = mode === 'boss' ? 'les phrases du Boss'
      : mode === 'pieges' ? 'les lettres pièges'
        : mode === 'loupe' ? 'les syllabes, astuces et phrases de contexte' : 'les éléments de la liste et les phrases du Boss';
    if (dejaRempli && !confirm(`Remplacer ${remplacement} par la proposition d’Albert ?`)) return;
    enGeneration = true;
    majEditeur(); majColonne();
    try {
      const res = await appelAlbert(l, mode);
      appliquer(l, res, mode);
      sauver();
      notifier(`Génération terminée (${res.model}). Relisez la proposition avant de valider.`);
    } catch (e) {
      notifier(e.message, 'erreur');
    } finally {
      enGeneration = false;
      majOnglets(); majColonne(); majEditeur();
    }
  }

  async function genererTout() {
    const m = mondeCourant();
    const aFaire = m.listes.filter((l) => l.mots.length && l.mots.some((x) => !x.phrase));
    if (!aFaire.length) return;
    enGeneration = true;
    majColonne(); majEditeur();
    let ok = 0;
    for (const [k, l] of aFaire.entries()) {
      notifier(`Albert prépare la liste ${k + 1} / ${aFaire.length} : ${l.titre || 'sans titre'}…`);
      try { appliquer(l, await appelAlbert(l)); ok++; sauver(); majColonne(); } catch (e) {
        notifier(`« ${l.titre} » : ${e.message}`, 'erreur');
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    enGeneration = false;
    notifier(`${ok} liste(s) complétée(s). Relisez-les puis validez-les une par une.`);
    majOnglets(); majColonne(); majEditeur();
  }

  // --- Validation, aperçu, suppression ---------------------------------------
  function valider(l) {
    const manque = [];
    if (!l.titre.trim()) manque.push('le titre');
    if (l.mots.length < 2) manque.push('au moins 2 mots');
    const mauvaisesSyllabes = l.mots.filter((x) => String(x.syllabes || '').split(SEPARATEUR).join('') !== x.mot);
    if (mauvaisesSyllabes.length) manque.push(`des syllabes correctes pour : ${mauvaisesSyllabes.map((x) => x.mot).join(', ')}`);
    const astucesAValider = l.mots.filter((x) => x.astucesLoupe?.some((a) => a.aValider));
    if (astucesAValider.length) manque.push(`des astuces de la Loupe à valider pour : ${astucesAValider.map((x) => x.mot).join(', ')}`);
    if (manque.length) { notifier(`Il manque : ${manque.join(' ; ')}.`, 'erreur'); return; }
    const avertissements = [];
    const sansPhrase = l.mots.filter((x) => !x.phrase).length;
    if (sansPhrase) avertissements.push(`${sansPhrase} mot(s) sans phrase de contexte`);
    if (l.etapes?.boss !== false && !phrasesBoss(preparerListe(l), 1).length) avertissements.push('aucune phrase pour le boss (l\'étape sera fermée)');
    if (avertissements.length && !confirm(`À noter : ${avertissements.join(', ')}. Valider quand même ?`)) return;
    l.mots = l.mots.map((x) => ({ mot: x.mot, syllabes: x.syllabes, pieges: x.pieges || [], groupesLoupe: x.groupesLoupe, astucesLoupe: x.astucesLoupe, astuce: (x.astuce || '').trim(), famille: (x.famille || '').trim(), phrase: (x.phrase || '').trim() }));
    l.valide = true;
    delete l._alertes;
    sauver();
    notifier(statut?.publier ? 'Liste validée. Pensez à publier.' : 'Liste validée. Exportez le fichier pour la mettre en ligne.');
    majOnglets(); majColonne(); majEditeur();
  }

  function supprimer(l) {
    if (!confirm(`Supprimer « ${l.titre || 'cette liste'} » ?`)) return;
    const m = mondeCourant();
    m.listes = m.listes.filter((x) => x.id !== l.id);
    lId = null;
    sauver(); majOnglets(); majColonne(); majEditeur();
  }

  function apercu(l) {
    sessionStorage.setItem(CLE_APERCU, '1');
    location.hash = l ? `#/m/${mId}/l/${encodeURIComponent(l.id)}` : '#/';
  }

  // --- Sauvegarde, export, publication ---------------------------------------
  function sauver() {
    meta.modifie = true;
    try {
      localStorage.setItem(CLE_BROUILLON, JSON.stringify(contenu));
      localStorage.setItem(CLE_META, JSON.stringify(meta));
    } catch { notifier('Impossible d\'enregistrer le brouillon sur cet appareil.', 'erreur'); }
    remplir(pastilleEtat, 'Modifications non publiées');
    pastilleEtat.classList.add('modifie');
    zoneActions.querySelector('.st-btn-fort')?.removeAttribute('disabled');
  }

  function contenuPropre() {
    return JSON.parse(JSON.stringify(contenu, (k, v) => (k.startsWith('_') ? undefined : v)));
  }

  function exporter() {
    const blob = new Blob([`${JSON.stringify(contenuPropre(), null, 2)}\n`], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: 'parcours.json' });
    document.body.append(a); a.click(); a.remove();
    notifier('Fichier exporté. Remplacez public/contenu/parcours.json dans le projet puis redéployez.');
  }

  async function importer(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!Array.isArray(j.parcours)) throw new Error('Ce fichier ne contient pas de mondes.');
      if (!confirm('Remplacer tout le brouillon par ce fichier ?')) return;
      contenu = j; normaliser(contenu);
      mId = contenu.parcours[0]?.id; lId = null;
      sauver(); majOnglets(); majColonne(); majEditeur();
      notifier('Fichier importé.');
    } catch (err) { notifier(err.message, 'erreur'); }
    e.target.value = '';
  }

  async function publier() {
    if (!confirm('Publier cette version ? Les élèves verront toutes les listes validées.')) return;
    try {
      const r = await fetch('/api/publier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-studio-code': code },
        body: JSON.stringify({ contenu: contenuPropre() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erreur || `Erreur ${r.status}`);
      meta.modifie = false;
      localStorage.setItem(CLE_META, JSON.stringify(meta));
      majActions();
      notifier('Publié. La nouvelle version sera en ligne d\'ici une à deux minutes.');
    } catch (err) { notifier(err.message, 'erreur'); }
  }

  async function repartirPublie() {
    if (!confirm('Abandonner le brouillon de cet appareil et recharger la version publiée ?')) return;
    try { publie = await chargerPublie(); } catch (err) { notifier(err.message, 'erreur'); return; }
    contenu = structuredClone(publie); normaliser(contenu);
    meta = { modifie: false };
    localStorage.removeItem(CLE_BROUILLON);
    localStorage.setItem(CLE_META, JSON.stringify(meta));
    mId = contenu.parcours[0]?.id; lId = null;
    majActions(); majOnglets(); majColonne(); majEditeur();
    notifier('Version publiée rechargée.');
  }

  let minuterieNotif = null;
  function notifier(message, type = 'info') {
    remplir(notif, message);
    notif.className = `st-notif visible ${type}`;
    clearTimeout(minuterieNotif);
    minuterieNotif = setTimeout(() => notif.classList.remove('visible'), type === 'erreur' ? 9000 : 5000);
  }

  // --- Premier affichage ---
  majConnexion();
  majActions();
  majOnglets();
  majColonne();
  majEditeur();
  if (code) verifierCode(code, true);
}

// --- Utilitaires ---------------------------------------------------------------
function lireMeta() {
  try { return JSON.parse(localStorage.getItem(CLE_META)) || { modifie: false }; } catch { return { modifie: false }; }
}

/** Complète les champs manquants ; convertit aussi un ancien fichier « Parcours lecture ». */
function normaliser(c) {
  c.version = 2;
  c.parcours ||= [];
  const couleurs = ['vert', 'jaune', 'orange', 'bleu'];
  for (let n = 1; n <= 4; n++) {
    if (!c.parcours.find((m) => m.id === n)) c.parcours.push({ id: n, nom: `Monde ${n}`, couleur: couleurs[n - 1], listes: [] });
  }
  c.parcours.sort((a, b) => a.id - b.id);
  for (const m of c.parcours) {
    m.reglages = { ...REGLAGES, ...(m.reglages || {}) };
    if (/^parcours \d+$/i.test(m.nom || '')) m.nom = `Monde ${m.id}`;
    m.listes ||= [];
    // Ancien format : chaque texte devient une liste avec ses mots de dictée.
    if (Array.isArray(m.textes)) {
      for (const t of m.textes) {
        const mots = (t.activites?.dictee?.mots || []).map((x) => (typeof x === 'string' ? { mot: x } : x)).filter((x) => x.mot);
        if (mots.length) m.listes.push({ id: `l-${t.id}`, titre: t.titre || 'Liste importée', valide: false, mots: mots.map((x) => ({ ...analyser(x.mot), phrase: x.phrase || '' })), phrases: [], etapes: {} });
      }
      delete m.textes;
    }
    for (const l of m.listes) {
      l.titre ||= '';
      l.etapes ||= {};
      l.phrases ||= [];
      l.mots = (l.mots || []).map((x) => (typeof x === 'string' ? analyser(x) : { syllabes: '', pieges: [], astuce: '', famille: '', phrase: '', ...x }));
    }
  }
}
