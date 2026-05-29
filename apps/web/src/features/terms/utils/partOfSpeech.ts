const partOfSpeechLabels: Record<string, string> = {
  adj: "Adjective",
  adnominal: "Adnominal",
  adv: "Adverb",
  affix: "Affix",
  article: "Article",
  character: "Character",
  classifier: "Classifier",
  combining_form: "Combining form",
  conj: "Conjunction",
  contraction: "Contraction",
  counter: "Counter",
  det: "Determiner",
  interfix: "Interfix",
  intj: "Interjection",
  name: "Name",
  noun: "Noun",
  num: "Numeral",
  particle: "Particle",
  phrase: "Phrase",
  postp: "Postposition",
  prefix: "Prefix",
  prep: "Preposition",
  prep_phrase: "Prepositional phrase",
  pron: "Pronoun",
  romanization: "Romanization",
  root: "Root",
  "soft-redirect": "Soft redirect",
  suffix: "Suffix",
  syllable: "Syllable",
  symbol: "Symbol",
  verb: "Verb"
};

/** Displays known Wiktextract part-of-speech codes while preserving unknown codes for debugging. */
export function partOfSpeechLabel(code: string): string {
  return partOfSpeechLabels[code] ?? code;
}
