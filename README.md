# Mots en quête

Jeu de révision des mots de dictée, au look de console rétro.
Le Mange-Lettres a volé les lettres des mots de la semaine : l'élève les retrouve en 5 étapes, puis bat le boss.

| Étape | Ce que fait l'élève | Pourquoi |
|---|---|---|
| **1. Loupe** | Il écoute le mot, le voit découpé en syllabes de couleur et touche lui-même les lettres pièges. Il reçoit ensuite l'astuce et les mots de la même famille. | Porter l'attention sur la partie difficile du mot et la justifier (morphologie) aide à la retenir. |
| **2. Pièges** | Le mot s'affiche avec des trous à la place des pièges : il les complète. | C'est un rappel ciblé, juste sur ce qui pose problème. |
| **3. Photo-Flash** | Il regarde le mot. Le mot se cache, il l'écrit de mémoire, puis il vérifie. | Écrire de mémoire (rappel) fixe mieux que recopier. |
| **4. Dictée radio** | Il entend le mot sans le voir et l'écrit. | C'est le rappel le plus exigeant. Les mots entrent dans le coffre à révisions. |
| **5. Le Boss** | Il écoute des phrases et écrit les mots de la liste qui manquent. Chaque mot juste fait perdre de l'énergie au boss. | Les mots sont retrouvés en contexte. |

**Règles communes**
- La correction est immédiate.
- Au 1er essai faux, l'élève réécoute le mot (et voit les lettres déjà bien placées en dictée).
- Au 2e essai faux, le mot juste lui est montré, avec les lettres à revoir surlignées. Il le recopie, puis le mot revient en fin de série.
- La forme fautive n'est jamais réaffichée.
- Pas de chronomètre ni de « game over ». Les étoiles (1 à 3) dépendent des réussites du premier coup.

**Coffre à révisions.** Un mot travaillé en Dictée radio ou contre le Boss entre en boîte 1. En révision, réussi du premier coup, il monte d'une boîte : il revient 1, 2, 4, 8 puis 16 jours plus tard. Raté, il retourne en boîte 1. Après la boîte 5, il devient une gemme dans « Mon trésor ».

**Inclusion**
- Le mode **étiquettes-lettres** remplace le clavier : ce sont les lettres du mot et 2 lettres pièges. Il se règle par monde, et l'élève peut basculer pendant le jeu.
- Tout est lu à voix haute.
- La police Andika est utilisée pour les mots.
- Les animations sont coupées si l'appareil le demande.

**Joueurs.** Chaque élève choisit son personnage. La progression (étoiles, coffre) est enregistrée **seulement sur l'appareil** (localStorage), et rien n'est envoyé. Le mode « Jouer sans enregistrer » ne garde rien.

## Studio enseignant : `/#/studio`

1. Entrez le **code studio** (variable `STUDIO_CODE`).
2. Choisissez un monde, cliquez sur **+ Liste**, donnez un titre et tapez les mots, un par ligne. Cliquez ensuite sur **Mettre à jour les mots**. Chaque nouveau mot reçoit une proposition automatique : syllabes, lettres pièges et astuce.
3. **Compléter avec Albert** propose pour chaque mot :
   - les syllabes et les pièges ;
   - une astuce qui donne une raison ;
   - des mots de la même famille ;
   - une phrase de contexte.

   Il écrit aussi les phrases du boss. L'application vérifie sa réponse : les syllabes doivent recoller au mot, les pièges doivent exister dans le mot et chaque phrase doit contenir le mot.
4. Relisez. **Cliquez sur les lettres** d'un mot pour marquer ou retirer un piège. Les syllabes se séparent par `/` (ex. `ba/teau`).
5. Décochez si besoin une étape : elle est sautée.
6. Cliquez sur **Valider cette liste**, puis sur **Publier pour les élèves** (ou **Exporter le fichier**).

**Réglages du monde**
- niveau (utilisé par Albert) ;
- étapes à débloquer dans l'ordre ou toutes ouvertes ;
- saisie par défaut (clavier ou étiquettes) ;
- nombre de phrases du boss.

**Aperçu élève** ouvre toutes les étapes, sans enregistrer de progression.

Un ancien fichier `parcours.json` de « Parcours lecture » peut être importé : les mots de dictée de chaque texte deviennent une liste.

## Mise en ligne sur Vercel

1. Utilisez le dépôt [sofianemedkour31/mots-en-quete](https://github.com/sofianemedkour31/mots-en-quete) avec **ce dossier comme racine** (celui qui contient `package.json`, `vercel.json`, `api/` et `public/`), puis importez-le dans Vercel. Le préréglage **Vite** est détecté automatiquement. Si vous placez ce projet dans un sous-dossier d'un dépôt plus large, définissez ce sous-dossier comme **Root Directory** dans Vercel et adaptez le chemin `CHEMIN` dans `api/publier.js` avant d'activer la publication depuis le studio.
2. Dans **Settings → Environment Variables**, ajoutez :

| Variable | Rôle |
|---|---|
| `ALBERT_API_KEY` | Votre clé Albert (DINUM). Elle reste côté serveur. |
| `STUDIO_CODE` | Le code à saisir pour utiliser le studio. Il protège votre quota Albert. |
| `ALBERT_MODEL` | Facultatif. S'il est vide, le premier modèle « large » disponible est choisi. |
| `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH` | Facultatif : active le bouton **Publier**. `GITHUB_REPO` doit être au format `proprietaire/depot`, et `GITHUB_BRANCH` doit être la branche de production (par défaut `main`). Le jeton doit être *fine-grained*, limité au dépôt, avec le droit *Contents : Read and write*. |

3. Ajoutez les valeurs directement dans Vercel. Le fichier `.env` local est exclu de Git ; `.env.example` ne contient que les noms des variables. Redéployez après avoir configuré les variables.

## Tester sur votre ordinateur

Il vous faut Node.js 22 ou une version plus récente. Installez les dépendances avec `npm install`, puis vérifiez le build avec `npm run build`.

```bash
STUDIO_CODE=test ALBERT_MOCK=1 node scripts/serveur-local.mjs
```

Ouvrez ensuite http://localhost:5174. Avec `ALBERT_MOCK=1`, Albert est simulé : les règles automatiques sont utilisées, avec des phrases génériques. Vous pouvez aussi mettre ces variables dans un fichier `.env`.

## Structure

```
api/albert.js              relais vers Albert (clé côté serveur, contrôle du code studio)
api/_lib/generation.js     prompt envoyé à Albert + vérification de sa réponse
api/publier.js             écriture de parcours.json dans GitHub
public/contenu/parcours.json   tout le contenu (mondes, listes, mots)
src/main.js                navigation élève, carte, coffre, trésor
src/jeu.js                 briques communes : mot en couleurs, saisie, essais, fin de niveau
src/activites/             loupe, pièges, flash, dictée (+ révisions), boss
src/profils.js             joueurs, étoiles, coffre (boîtes de Leitner), sur l'appareil
src/lib/ortho.js           syllabes, lettres pièges, astuces automatiques, comparaison des réponses
src/sprites.js             pixel art (palette 16 couleurs)
src/studio/                studio enseignant
```

## Format du contenu

```json
{
  "version": 2,
  "parcours": [{
    "id": 1, "nom": "Monde 1", "couleur": "vert",
    "reglages": { "niveau": "CE2", "deblocage": "progressif", "saisie": "clavier", "nbPhrasesBoss": 5 },
    "listes": [{
      "id": "…", "titre": "Le son [o] : au, eau, ô", "valide": true,
      "mots": [{ "mot": "bateau", "syllabes": "ba/teau", "pieges": [3, 4, 5],
                 "astuce": "Le son [o] s'écrit « eau ».", "famille": "", "phrase": "Le bateau glisse sur la mer." }],
      "phrases": ["Le bateau passe devant le château."],
      "etapes": { "boss": true }
    }]
  }]
}
```

`pieges` contient les positions des lettres pièges dans le mot (la première lettre est la position 0).
