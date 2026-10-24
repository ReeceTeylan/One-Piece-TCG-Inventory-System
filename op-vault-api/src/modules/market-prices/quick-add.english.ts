import { QuickCandidate } from './quick-add.helpers';

const JP = /[\u3040-\u30ff\u3400-\u9fff]/u;

const JPN_NAMES: Record<string, string> = {
  'モンキー・D・ルフィ': 'Monkey D. Luffy',
  'モンキー・Ｄ・ルフィ': 'Monkey D. Luffy',
  'ロロノア・ゾロ': 'Roronoa Zoro',
  'ナミ': 'Nami',
  'サンジ': 'Sanji',
  'ウソップ': 'Usopp',
  'トニートニー・チョッパー': 'Tony Tony Chopper',
  'ニコ・ロビン': 'Nico Robin',
  'フランキー': 'Franky',
  'ブルック': 'Brook',
  'ジンベエ': 'Jinbe',
  'シャンクス': 'Shanks',
  'ポートガス・D・エース': 'Portgas D. Ace',
  'ポートガス・Ｄ・エース': 'Portgas D. Ace',
  'ボア・ハンコック': 'Boa Hancock',
  'トラファルガー・ロー': 'Trafalgar Law',
  'ユースタス・キッド': 'Eustass Kid',
  'マーシャル・D・ティーチ': 'Marshall D. Teach',
  'バギー': 'Buggy',
  'ヤマト': 'Yamato',
  'ウタ': 'Uta',
  'ジュエリー・ボニー': 'Jewelry Bonney',
  'ドンキホーテ・ドフラミンゴ': 'Donquixote Doflamingo',
  'カイドウ': 'Kaido',
  'シャーロット・リンリン': 'Charlotte Linlin',
  'シャーロット・カタクリ': 'Charlotte Katakuri',
  'サボ': 'Sabo',
  'コビー': 'Koby',
  'ペローナ': 'Perona',
  'クロコダイル': 'Crocodile',
  'ゲッコー・モリア': 'Gecko Moria',
  'クザン': 'Kuzan',
  'サカズキ': 'Sakazuki',
};

export function basicCharacterName(sourceName: string): string {
  const raw = sourceName.trim()
    .replace(/^〔[^〕]*〕/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s*\((?:[^)]*)\)/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return raw.replace(/\bMonkey\.D\.Luffy\b/gi, 'Monkey D. Luffy')
    .replace(/\bPortgas\.D\.Ace\b/gi, 'Portgas D. Ace')
    .replace(/\bMarshall\.D\.Teach\b/gi, 'Marshall D. Teach')
    .replace(/\bRoronoa\.Zoro\b/gi, 'Roronoa Zoro');
}

export function englishCharacter(name: string): string | null {
  const base = basicCharacterName(name);
  if (!base) return null;
  if (!JP.test(base)) return base;
  const standard = base.replace(/Ｄ/g, 'D').replace(/．/g, '.');
  return JPN_NAMES[standard] ?? null;
}

export function selectEnglishCharacter(source: QuickCandidate, englishCatalog: QuickCandidate[]): string | null {
  const direct = englishCharacter(source.name);
  if (direct) return direct;
  const options = new Map<string, string>();
  for (const entry of englishCatalog) {
    if (entry.cardNumber !== source.cardNumber) continue;
    const name = englishCharacter(entry.name);
    if (name) options.set(name.toLowerCase(), name);
  }
  return options.size === 1 ? [...options.values()][0] : null;
}

export const isEnglishCharacter = (name: string) =>
  name.trim().length >= 2 && !JP.test(name) && !/[\r\n]/.test(name);
