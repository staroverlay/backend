// Random Strings
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CHARS_LENGTH = CHARS.length;

export function randomString(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS_LENGTH));
  }
  return result;
}

// Random numbers
export function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Random items
export function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Random names
const PREFIXES = [
  'Adorable',
  'Adventurous',
  'Beautiful',
  'Brave',
  'Colorful',
  'Creative',
  'Delightful',
  'Determined',
  'Elegant',
  'Enthusiastic',
  'Fancy',
  'Fantastic',
  'Glamorous',
  'Gorgeous',
  'Handsome',
  'Happy',
  'Incredible',
  'Innovative',
  'Joyful',
  'Jubilant',
  'Kind',
  'Knowledgeable',
  'Lively',
  'Lovely',
  'Magnificent',
  'Marvelous',
  'Nice',
  'Noble',
  'Optimistic',
  'Outstanding',
  'Pleasant',
  'Positive',
  'Quality',
  'Quick',
  'Radiant',
  'Respectful',
  'Stunning',
  'Successful',
  'Terrific',
  'Trustworthy',
  'Unique',
  'Useful',
  'Valuable',
  'Vibrant',
  'Wonderful',
  'Worthy',
  'Xenial', // Xenial means hospitable, especially to visiting strangers or foreigners.
  'Young',
  'Youthful',
  'Zesty',
  'Zealous',
];

const SUFFIXES = [
  'Antelope',
  'Ant',
  'Bear',
  'Bird',
  'Cat',
  'Cheetah',
  'Dog',
  'Dolphin',
  'Elephant',
  'Eagle',
  'Frog',
  'Fox',
  'Giraffe',
  'Goat',
  'Horse',
  'Hawk',
  'Iguana',
  'Impala',
  'Jaguar',
  'Jellyfish',
  'Kangaroo',
  'Koala',
  'Lion',
  'Lizard',
  'Moose',
  'Monkey',
  'Nightingale',
  'Newt',
  'Ocelot', // Ocelot is a wild cat native to the Americas.
  'Owl',
  'Penguin',
  'Panda',
  'Quail',
  'Quokka', // Quokka is a small macropod native to Australia.
  'Rabbit',
  'Raccoon',
  'Salamander',
  'Squirrel',
  'Turtle',
  'Tiger',
  'Uakari', // Uakari is a type of monkey.
  'Unicorn',
  'Viper',
  'Vulture',
  'Walrus',
  'Wolf',
  'Xerus', // Xerus is a genus of ground squirrels.
  'Xenops', // Xenops is a genus of birds.
  'Yak',
  'Yakari', // Yakari is a Franco-Belgian comic book series.
  'Zebra',
  'Zebu', // Zebu is a type of cattle.
];

export function randomName(): string {
  return randomItem(PREFIXES) + randomItem(SUFFIXES) + randomNumber(1, 99);
}
