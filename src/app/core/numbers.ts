const SMALL = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
];

const TENS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
];

const ORDINAL_FORMS: Record<string, string> = {
  zero: 'zeroth', one: 'first', two: 'second', three: 'third', four: 'fourth',
  five: 'fifth', six: 'sixth', seven: 'seventh', eight: 'eighth', nine: 'ninth',
  ten: 'tenth', eleven: 'eleventh', twelve: 'twelfth', thirteen: 'thirteenth',
  fourteen: 'fourteenth', fifteen: 'fifteenth', sixteen: 'sixteenth',
  seventeen: 'seventeenth', eighteen: 'eighteenth', nineteen: 'nineteenth',
  twenty: 'twentieth', thirty: 'thirtieth', forty: 'fortieth', fifty: 'fiftieth',
  sixty: 'sixtieth', seventy: 'seventieth', eighty: 'eightieth', ninety: 'ninetieth',
  hundred: 'hundredth', thousand: 'thousandth', million: 'millionth',
};

const MAX_SPELLED = 1_000_000_000;
const MILLION = 1_000_000;

const GROUP_SEPARATOR = '[.,\u00a0\u202f]';
const GROUPED_DIGITS = new RegExp(`\\b\\d{1,3}(?:${GROUP_SEPARATOR}\\d{3})+\\b`, 'g');
const GROUP_SEPARATORS = new RegExp(GROUP_SEPARATOR, 'g');

function underHundred(n: number): string[] {
  if (n < 20) { return [SMALL[n]]; }
  const tens = TENS[Math.floor(n / 10)];
  const ones = n % 10;
  return ones ? [tens, SMALL[ones]] : [tens];
}

function underThousand(n: number): string[] {
  if (n < 100) { return underHundred(n); }
  const hundreds = [SMALL[Math.floor(n / 100)], 'hundred'];
  const rest = n % 100;
  return rest ? [...hundreds, ...underHundred(rest)] : hundreds;
}

function underMillion(n: number): string[] {
  if (n < 1000) { return underThousand(n); }
  const thousands = underThousand(Math.floor(n / 1000));
  const rest = n % 1000;
  return rest
    ? [...thousands, 'thousand', ...underThousand(rest)]
    : [...thousands, 'thousand'];
}

export function cardinalWords(n: number): string[] {
  if (!Number.isInteger(n) || n < 0 || n >= MAX_SPELLED) { return [String(n)]; }
  if (n < MILLION) { return underMillion(n); }
  const millions = underThousand(Math.floor(n / MILLION));
  const rest = n % MILLION;
  return rest
    ? [...millions, 'million', ...underMillion(rest)]
    : [...millions, 'million'];
}

export function ordinalWords(n: number): string[] {
  const words = cardinalWords(n);
  const last = words[words.length - 1];
  const ordinal = ORDINAL_FORMS[last];
  return ordinal ? [...words.slice(0, -1), ordinal] : words;
}

export function joinDigitGroups(text: string): string {
  return String(text ?? '')
    .replace(GROUPED_DIGITS, (group) => group.replace(GROUP_SEPARATORS, ''));
}

export function spellNumbers(text: string): string {
  return joinDigitGroups(text)
    .replace(/(\d+)(?:st|nd|rd|th)\b/gi, (_, digits: string) =>
      ` ${ordinalWords(Number(digits)).join(' ')} `)
    .replace(/\d+/g, (digits) => ` ${cardinalWords(Number(digits)).join(' ')} `);
}
