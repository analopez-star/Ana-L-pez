import { FrenchTenseKey, TenseId } from '../types/conjugation';

export interface TenseMeta {
  id: TenseId;
  frenchKey: FrenchTenseKey;
  spanishName: string;
  frenchName: string;
  mood: 'Indicativo' | 'Condicional' | 'Subjuntivo' | 'Imperativo';
  levelTag: string;
  note: string;
}

export const TENSES: TenseMeta[] = [
  {
    id: 'present',
    frenchKey: 'present',
    spanishName: 'Presente',
    frenchName: "Présent de l'indicatif",
    mood: 'Indicativo',
    levelTag: '1.º ESO',
    note: 'Acciones habituales o actuales.',
  },
  {
    id: 'passe_simple',
    frenchKey: 'passe_compose',
    spanishName: 'Pretérito perfecto simple',
    frenchName: 'Passé composé',
    mood: 'Indicativo',
    levelTag: '2.º ESO',
    note: 'En francés estándar, el pretérito perfecto simple español (fui, comí) se traduce con el passé composé.',
  },
  {
    id: 'passe_compose',
    frenchKey: 'passe_compose',
    spanishName: 'Pretérito perfecto compuesto',
    frenchName: 'Passé composé',
    mood: 'Indicativo',
    levelTag: '2.º ESO',
    note: 'El pretérito perfecto compuesto español (he ido, he comido) también corresponde al passé composé.',
  },
  {
    id: 'imparfait',
    frenchKey: 'imparfait',
    spanishName: 'Pretérito imperfecto',
    frenchName: 'Imparfait',
    mood: 'Indicativo',
    levelTag: '2.º ESO',
    note: 'Se forma con la raíz de «nous» en presente + -ais, -ais, -ait, -ions, -iez, -aient (salvo être: ét-).',
  },
  {
    id: 'plus_que_parfait',
    frenchKey: 'plus_que_parfait',
    spanishName: 'Pretérito pluscuamperfecto',
    frenchName: 'Plus-que-parfait',
    mood: 'Indicativo',
    levelTag: '3.º ESO',
    note: 'Auxiliar avoir o être en imparfait + participe passé.',
  },
  {
    id: 'futur_simple',
    frenchKey: 'futur_simple',
    spanishName: 'Futuro simple',
    frenchName: 'Futur simple',
    mood: 'Indicativo',
    levelTag: '2.º ESO',
    note: 'Infinitivo (o raíz irregular) + -ai, -as, -a, -ons, -ez, -ont.',
  },
  {
    id: 'futur_anterieur',
    frenchKey: 'futur_anterieur',
    spanishName: 'Futuro compuesto',
    frenchName: 'Futur antérieur',
    mood: 'Indicativo',
    levelTag: '4.º ESO / Bach.',
    note: 'Auxiliar avoir o être en futur simple + participe passé.',
  },
  {
    id: 'conditionnel_present',
    frenchKey: 'conditionnel_present',
    spanishName: 'Condicional simple',
    frenchName: 'Conditionnel présent',
    mood: 'Condicional',
    levelTag: '3.º ESO',
    note: 'Raíz del futur simple + terminaciones del imparfait (-ais, -ais, -ait, -ions, -iez, -aient).',
  },
  {
    id: 'conditionnel_passe',
    frenchKey: 'conditionnel_passe',
    spanishName: 'Condicional compuesto',
    frenchName: 'Conditionnel passé',
    mood: 'Condicional',
    levelTag: '4.º ESO / Bach.',
    note: 'Auxiliar avoir o être en conditionnel présent + participe passé.',
  },
  {
    id: 'subjonctif_present',
    frenchKey: 'subjonctif_present',
    spanishName: 'Presente de subjuntivo',
    frenchName: 'Subjonctif présent',
    mood: 'Subjuntivo',
    levelTag: '4.º ESO / Bach.',
    note: 'Se usa tras expresiones de deseo, duda u obligación (il faut que...). Acepta con o sin «que».',
  },
  {
    id: 'imperatif',
    frenchKey: 'imperatif',
    spanishName: 'Imperativo',
    frenchName: 'Impératif présent',
    mood: 'Imperativo',
    levelTag: '1.º–2.º ESO',
    note: 'Se escribe sin pronombre sujeto. Los verbos en -er pierden la -s final en 2.ª persona singular.',
  },
];

export const TENSE_MAP: Record<TenseId, TenseMeta> = TENSES.reduce(
  (acc, tense) => {
    acc[tense.id] = tense;
    return acc;
  },
  {} as Record<TenseId, TenseMeta>
);

export const TENSE_MOODS: Array<TenseMeta['mood']> = [
  'Indicativo',
  'Condicional',
  'Subjuntivo',
  'Imperativo',
];
