/**
 * Doodle Dash — Word Packs
 *
 * Pre-built theme packs and utilities for word selection.
 * Used by both the realtime server (word picking) and client (pack metadata display).
 */

export interface WordPack {
  id: string;
  name: string;
  icon: string;
  description: string;
  words: string[];
}

export const WORD_PACKS: WordPack[] = [
  {
    id: 'default',
    name: 'Classic',
    icon: '🎨',
    description: 'The original mix — animals, food, objects, and more',
    words: [
      // Animals
      'cat', 'dog', 'fish', 'bird', 'elephant', 'giraffe', 'penguin', 'dolphin',
      'octopus', 'butterfly', 'snake', 'turtle', 'lion', 'tiger', 'bear',
      // Food
      'pizza', 'hamburger', 'sushi', 'taco', 'apple', 'banana', 'watermelon',
      'ice cream', 'cake', 'donut', 'coffee', 'hotdog', 'sandwich', 'pasta',
      // Objects
      'house', 'car', 'bicycle', 'phone', 'laptop', 'umbrella', 'clock', 'camera',
      'guitar', 'piano', 'chair', 'table', 'lamp', 'book', 'pencil', 'key',
      'rocket', 'airplane', 'boat', 'train', 'helicopter',
      // Nature
      'sun', 'moon', 'star', 'cloud', 'rainbow', 'mountain', 'tree', 'flower',
      'beach', 'volcano', 'island', 'desert', 'forest', 'ocean',
      // Actions
      'swimming', 'dancing', 'sleeping', 'running', 'jumping', 'climbing',
      'cooking', 'painting', 'reading',
      // Places
      'castle', 'lighthouse', 'bridge', 'windmill', 'pyramid', 'igloo',
      'skyscraper', 'hospital', 'library', 'stadium',
      // Characters
      'pirate', 'astronaut', 'superhero', 'wizard', 'mermaid', 'dragon',
      'robot', 'ghost', 'vampire', 'ninja',
      // Misc
      'fireworks', 'treasure', 'compass', 'magnifying glass',
      'spaceship', 'submarine', 'hot air balloon', 'ferris wheel',
    ],
  },
  {
    id: 'movies',
    name: 'Movies & TV',
    icon: '🎬',
    description: 'Iconic scenes, characters, and props from film & television',
    words: [
      'lightsaber', 'popcorn', 'red carpet', 'oscar', 'clapperboard',
      'director chair', 'movie ticket', 'spotlight', 'paparazzi', 'stuntman',
      'explosion', 'time machine', 'alien', 'spaceship', 'dinosaur',
      'shark', 'zombie', 'haunted house', 'treasure map', 'magic wand',
      'crown', 'sword fight', 'car chase', 'superhero cape', 'villain',
      'robot army', 'love letter', 'dance scene', 'slow motion', 'plot twist',
      'sequel', 'prequel', 'blooper', 'green screen', 'microphone',
      'film reel', '3d glasses', 'movie poster', 'red carpet', 'limousine',
    ],
  },
  {
    id: 'animals',
    name: 'Animals',
    icon: '🐾',
    description: 'Creatures from land, sea, and sky',
    words: [
      'flamingo', 'chameleon', 'porcupine', 'seahorse', 'peacock',
      'koala', 'sloth', 'platypus', 'narwhal', 'axolotl',
      'red panda', 'hedgehog', 'otter', 'hamster', 'parrot',
      'jellyfish', 'stingray', 'lobster', 'pelican', 'toucan',
      'gorilla', 'cheetah', 'rhinoceros', 'hippopotamus', 'crocodile',
      'bat', 'owl', 'eagle', 'hummingbird', 'caterpillar',
      'ladybug', 'scorpion', 'tarantula', 'whale', 'seal',
      'moose', 'raccoon', 'skunk', 'pufferfish', 'starfish',
    ],
  },
  {
    id: 'food',
    name: 'Food & Drinks',
    icon: '🍕',
    description: 'Delicious dishes, snacks, and beverages',
    words: [
      'ramen', 'croissant', 'burrito', 'waffle', 'pretzel',
      'smoothie', 'milkshake', 'french fries', 'nachos', 'spring roll',
      'spaghetti', 'pancake', 'fried chicken', 'lobster roll', 'dim sum',
      'boba tea', 'espresso', 'lemonade', 'champagne', 'hot chocolate',
      'avocado toast', 'cheese wheel', 'birthday cake', 'gingerbread man', 'candy cane',
      'cotton candy', 'caramel apple', 'fortune cookie', 'churro', 'brownie',
      'popsicle', 'sundae', 'macaron', 'cinnamon roll', 'garlic bread',
      'mango', 'pineapple', 'coconut', 'dragonfruit', 'pomegranate',
    ],
  },
  {
    id: 'tech',
    name: 'Tech & Science',
    icon: '💻',
    description: 'Gadgets, inventions, and scientific concepts',
    words: [
      'robot', 'satellite', 'drone', 'virtual reality', 'hologram',
      'laser', 'microchip', 'battery', 'solar panel', 'telescope',
      'microscope', 'test tube', 'atom', 'magnet', 'lightning bolt',
      'wifi signal', 'bluetooth', 'usb drive', 'keyboard', 'mouse cursor',
      'selfie', 'emoji', 'hashtag', 'password', 'firewall',
      'cloud computing', 'touchscreen', 'smartwatch', 'headphones', 'webcam',
      'printer', 'scanner', 'hard drive', 'server rack', '3d printer',
      'circuit board', 'antenna', 'traffic light', 'calculator', 'thermometer',
    ],
  },
  {
    id: 'sports',
    name: 'Sports',
    icon: '⚽',
    description: 'Games, athletes, and sporting moments',
    words: [
      'slam dunk', 'goal kick', 'home run', 'touchdown', 'hole in one',
      'swimming pool', 'tennis racket', 'boxing gloves', 'skateboard', 'surfboard',
      'snowboard', 'ski jump', 'ice skating', 'wrestling', 'archery',
      'fencing', 'marathon', 'hurdles', 'javelin', 'discus',
      'trophy', 'gold medal', 'podium', 'referee', 'cheerleader',
      'stadium', 'scoreboard', 'finish line', 'starting blocks', 'relay baton',
      'ping pong', 'badminton', 'volleyball', 'cricket bat', 'hockey stick',
      'bowling pin', 'dart board', 'punching bag', 'trampoline', 'balance beam',
    ],
  },
  {
    id: 'geography',
    name: 'Geography',
    icon: '🌍',
    description: 'Landmarks, countries, and natural wonders',
    words: [
      'eiffel tower', 'great wall', 'statue of liberty', 'taj mahal', 'colosseum',
      'big ben', 'sydney opera house', 'golden gate bridge', 'mount everest', 'grand canyon',
      'niagara falls', 'great barrier reef', 'sahara desert', 'amazon river', 'north pole',
      'volcano', 'glacier', 'waterfall', 'cave', 'canyon',
      'island', 'peninsula', 'archipelago', 'oasis', 'geyser',
      'aurora borealis', 'coral reef', 'bamboo forest', 'rice terrace', 'fjord',
      'hot spring', 'sand dune', 'cliff', 'lagoon', 'tundra',
      'savanna', 'marsh', 'plateau', 'ravine', 'crater',
    ],
  },
  {
    id: 'music',
    name: 'Music',
    icon: '🎵',
    description: 'Instruments, genres, and musical moments',
    words: [
      'electric guitar', 'drum set', 'violin', 'saxophone', 'trumpet',
      'microphone', 'headphones', 'turntable', 'vinyl record', 'cassette tape',
      'boombox', 'jukebox', 'karaoke', 'concert', 'stage dive',
      'crowd surfing', 'air guitar', 'disco ball', 'dj booth', 'speaker',
      'music note', 'treble clef', 'metronome', 'tuning fork', 'harmonica',
      'banjo', 'ukulele', 'harp', 'accordion', 'tambourine',
      'xylophone', 'maracas', 'cowbell', 'bagpipes', 'flute',
      'orchestra', 'choir', 'beatboxing', 'lullaby', 'encore',
    ],
  },
  {
    id: 'anime',
    name: 'Anime & Manga',
    icon: '⛩️',
    description: 'Characters, items, and scenes from anime & manga',
    words: [
      'katana', 'shuriken', 'ninja scroll', 'ramen bowl', 'bento box',
      'cherry blossom', 'torii gate', 'lucky cat', 'koi fish', 'origami crane',
      'sushi roll', 'onigiri', 'mochi', 'matcha', 'chopsticks',
      'samurai armor', 'geisha', 'sumo wrestler', 'kimono', 'paper fan',
      'dragon ball', 'magic circle', 'transformation', 'power up', 'final form',
      'mecha robot', 'spirit bomb', 'energy beam', 'sword slash', 'ninja run',
      'school uniform', 'rooftop lunch', 'beach episode', 'festival', 'fireworks',
      'bonsai tree', 'zen garden', 'temple', 'hot spring', 'bullet train',
    ],
  },
  {
    id: 'holiday',
    name: 'Holiday',
    icon: '🎄',
    description: 'Festive traditions, decorations, and celebrations',
    words: [
      'christmas tree', 'snowman', 'gingerbread house', 'candy cane', 'santa claus',
      'reindeer', 'present', 'stocking', 'wreath', 'ornament',
      'menorah', 'dreidel', 'fireworks', 'countdown', 'champagne',
      'easter egg', 'bunny', 'chocolate egg', 'basket', 'spring flowers',
      'pumpkin', 'jack o lantern', 'witch hat', 'ghost costume', 'haunted house',
      'turkey', 'cornucopia', 'pilgrim hat', 'thanksgiving dinner', 'pie',
      'heart candy', 'cupid', 'love letter', 'valentine card', 'chocolate box',
      'four leaf clover', 'leprechaun', 'pot of gold', 'firecracker', 'parade',
    ],
  },
];

/**
 * Look up a word pack by its ID.
 */
export function getWordPack(packId: string): WordPack | undefined {
  return WORD_PACKS.find((p) => p.id === packId);
}

/**
 * Metadata-only version for client display (no word lists).
 */
export interface WordPackMeta {
  id: string;
  name: string;
  icon: string;
  description: string;
  wordCount: number;
}

export function getWordPackMetas(): WordPackMeta[] {
  return WORD_PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    description: p.description,
    wordCount: p.words.length,
  }));
}
