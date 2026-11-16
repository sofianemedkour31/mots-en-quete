// Pixel art de l'application. Chaque caractère est un pixel ; '.' est transparent.
// Palette inspirée des consoles 8 bits (16 couleurs), partagée par tous les dessins
// pour garder un rendu homogène.
export const PALETTE = {
  k: '#1a1226', // contour
  n: '#1d2b53', // nuit
  m: '#7e2553', // prune
  v: '#008751', // vert foncé
  B: '#ab5236', // brun
  d: '#5f574f', // gris foncé
  g: '#c2c3c7', // gris clair
  w: '#fff1e8', // blanc cassé
  r: '#ff004d', // rouge
  o: '#ffa300', // orange
  y: '#ffec27', // jaune
  G: '#00e436', // vert
  b: '#29adff', // bleu
  l: '#83769c', // lavande
  p: '#ff77a8', // rose
  s: '#ffccaa', // pêche
};

export const SPRITES = {
  // --- Le boss : le Mange-Lettres -------------------------------------------
  boss: [
    '....kkkkkkkk....',
    '..kkmmmmmmmmkk..',
    '.kmmppmmmmmmmmk.',
    '.kmpmmmmmmmmmmk.',
    'kmmwwwmmmmwwwmmk',
    'kmmwkkmmmmkkwmmk',
    'kmmwwwmmmmwwwmmk',
    'kmmmmmmmmmmmmmmk',
    'kmkkkkkkkkkkkkmk',
    'kmkwrwrwrwrwrkmk',
    'kmkrrrryrrrrrkmk',
    'kmkrrryyyrrrrkmk',
    'kmkrrryryrrrrkmk',
    'kmkwrwrwrwrwrkmk',
    '.kmkkkkkkkkkkmk.',
    '..kkkkkkkkkkkk..',
  ],
  // --- Avatars des joueurs ---------------------------------------------------
  robot: [
    '.....rr.....',
    '.....kk.....',
    '.kkkkkkkkkk.',
    '.kggggggggk.',
    '.kgbbggbbgk.',
    '.kgwbggwbgk.',
    '.kggggggggk.',
    '.kggkkkkggk.',
    '.kggggggggk.',
    '.kkkkkkkkkk.',
    '...kddddk...',
    '..kkkkkkkk..',
  ],
  chat: [
    '.k........k.',
    'kok......kok',
    'kopok..kopok',
    'koookkkkoook',
    'kooooooooook',
    'koGkooooGkok',
    'koGkooooGkok',
    'kooooppooook',
    'kooookkooook',
    '.kooooooook.',
    '..kkooookk..',
    '....kkkk....',
  ],
  hibou: [
    'kk........kk',
    'kBk......kBk',
    'kBBkkkkkkBBk',
    'kBBBBBBBBBBk',
    'kBwwwBBwwwBk',
    'kBwkwBBwkwBk',
    'kBwwwyywwwBk',
    'kBBBByyBBBBk',
    'kBsBsBBsBsBk',
    '.kBsBsBsBsk.',
    '..kBBBBBBk..',
    '...kokkok...',
  ],
  grenouille: [
    '.kkk....kkk.',
    'kwwwk..kwwwk',
    'kwkwkkkkwkwk',
    'kGGGGGGGGGGk',
    'kGGGGGGGGGGk',
    'kGkGGGGGGkGk',
    'kGGkkkkkkGGk',
    'kGGGGGGGGGGk',
    '.kGvGGGGvGk.',
    '..kGGGGGGk..',
    '.kGGk..kGGk.',
    '.kkkk..kkkk.',
  ],
  // --- Étapes ----------------------------------------------------------------
  loupe: [
    '..kkkk......',
    '.kwwbbk.....',
    'kwbbbbbk....',
    'kwbbbbbk....',
    'kbbbbbbk....',
    'kbbbbbbk....',
    '.kbbbbk.....',
    '..kkkkkk....',
    '......kok...',
    '.......kok..',
    '........kok.',
    '.........kk.',
  ],
  pieges: [
    '.....kk.....',
    '....kyyk....',
    '....kyyk....',
    '...kykkyk...',
    '...kykkyk...',
    '..kyykkyyk..',
    '..kyykkyyk..',
    '.kyyyyyyyyk.',
    '.kyyykkyyyk.',
    'kyyyyyyyyyyk',
    'kkkkkkkkkkkk',
  ],
  flash: [
    '.....kkkk.....',
    'kkkkkkggkkkkkk',
    'kggggggggggyyk',
    'kgggggkkkggggk',
    'kggggkbbbkgggk',
    'kggggkbwbkgggk',
    'kggggkbbbkgggk',
    'kgggggkkkggggk',
    'kggggggggggggk',
    'kkkkkkkkkkkkkk',
  ],
  dictee: [
    '...kkkkkk...',
    '..kggggggk..',
    '.kgk....kgk.',
    'kgk......kgk',
    'kgk......kgk',
    'kkkk....kkkk',
    'krrk....krrk',
    'krrk....krrk',
    'krrk....krrk',
    'kkkk....kkkk',
  ],
  couronne: [
    'k....kk....k',
    'kk..kyyk..kk',
    'kyk.kyyk.kyk',
    'kyykyyyykyyk',
    'kyyyyyyyyyyk',
    'kyyryyyybyyk',
    'kyyyyyyyyyyk',
    'kooooooooook',
    'kkkkkkkkkkkk',
  ],
  // --- Objets ----------------------------------------------------------------
  etoile: [
    '.....k.....',
    '....kyk....',
    '....kyk....',
    'kkkkyyykkkk',
    'kywyyyyyyyk',
    '.kyyyyyyyk.',
    '..kyyyyyk..',
    '..kyyyyyk..',
    '.kyyykyyyk.',
    '.kyyk.kyyk.',
    '.kkk...kkk.',
  ],
  cadenas: [
    '..kkkkk..',
    '.kgggggk.',
    '.kgk.kgk.',
    '.kgk.kgk.',
    'kkkkkkkkk',
    'kyyyyyyyk',
    'kyyykyyyk',
    'kyyykyyyk',
    'koooooook',
    'kkkkkkkkk',
  ],
  coffre: [
    '..kkkkkkkkkk..',
    '.kBBBBBBBBBBk.',
    'kBBBBBBBBBBBBk',
    'kooooooooooook',
    'kkkkkkyykkkkkk',
    'kBBBBkyykBBBBk',
    'kBBBBBkkBBBBBk',
    'kooooooooooook',
    'kBBBBBBBBBBBBk',
    'kBBBBBBBBBBBBk',
    'kkkkkkkkkkkkkk',
  ],
  gemme: [
    '..kkkkkk..',
    '.kwbbbbnk.',
    'kwwbbbbbnk',
    'kkkkkkkkkk',
    '.kbbbbbnk.',
    '..kbbbnk..',
    '...kbnk...',
    '....kk....',
  ],
  drapeau: [
    'kk........',
    'kwkkkkk...',
    'kwGGGGGk..',
    'kwGGGGGGk.',
    'kwGGGGGk..',
    'kwkkkkk...',
    'kwk.......',
    'kwk.......',
    'kwk.......',
    'kkk.......',
  ],
};

/** Variante de couleur d'un sprite : { y: 'd' } remplace le jaune par du gris. */
export function teinter(nom, remplacements) {
  return SPRITES[nom].map((ligne) => [...ligne].map((c) => remplacements[c] || c).join(''));
}

export const AVATARS = ['robot', 'chat', 'hibou', 'grenouille'];
