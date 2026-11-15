import { TENSE_MAP } from '../data/tenses';
import { VERB_MAP, VERBS } from '../data/verbs';
import {
  EvaluationResult,
  FrenchTenseKey,
  PersonIndex,
  PracticeQuestion,
  TenseId,
  VerbDefinition,
} from '../types/conjugation';

const AVOIR_PRESENT = ['ai', 'as', 'a', 'avons', 'avez', 'ont'];
const AVOIR_IMPARFAIT = ['avais', 'avais', 'avait', 'avions', 'aviez', 'avaient'];
const AVOIR_FUTUR = ['aurai', 'auras', 'aura', 'aurons', 'aurez', 'auront'];
const AVOIR_COND = ['aurais', 'aurais', 'aurait', 'aurions', 'auriez', 'auraient'];

const ETRE_PRESENT = ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'];
const ETRE_IMPARFAIT = ['étais', 'étais', 'était', 'étions', 'étiez', 'étaient'];
const ETRE_FUTUR = ['serai', 'seras', 'sera', 'serons', 'serez', 'seront'];
const ETRE_COND = ['serais', 'serais', 'serait', 'serions', 'seriez', 'seraient'];

const STARTS_WITH_VOWEL_OR_MUTE_H = /^[aeiouyàâäéèêëîïôöùûüœæh]/i;

export function combinePronounAndVerb(pronoun: string, verbForm: string): string {
  if (pronoun === 'je' && STARTS_WITH_VOWEL_OR_MUTE_H.test(verbForm)) {
    return `j'${verbForm}`;
  }
  return `${pronoun} ${verbForm}`;
}

export function isValidVerbTense(verb: VerbDefinition, tenseId: TenseId): boolean {
  if (tenseId === 'imperatif') {
    return Boolean(!verb.impersonal && verb.fr.imperatif && verb.es.imperatif);
  }
  return true;
}

export function getValidPairsCount(verbIds: string[], tenseIds: TenseId[]): number {
  let count = 0;
  for (const vId of verbIds) {
    const verb = VERB_MAP[vId];
    if (!verb) continue;
    for (const tId of tenseIds) {
      if (isValidVerbTense(verb, tId)) count++;
    }
  }
  return count;
}

function getAuxiliaryArray(aux: 'avoir' | 'être', frenchKey: FrenchTenseKey): string[] {
  if (aux === 'avoir') {
    switch (frenchKey) {
      case 'passe_compose':
        return AVOIR_PRESENT;
      case 'plus_que_parfait':
        return AVOIR_IMPARFAIT;
      case 'futur_anterieur':
        return AVOIR_FUTUR;
      case 'conditionnel_passe':
        return AVOIR_COND;
      default:
        return AVOIR_PRESENT;
    }
  } else {
    switch (frenchKey) {
      case 'passe_compose':
        return ETRE_PRESENT;
      case 'plus_que_parfait':
        return ETRE_IMPARFAIT;
      case 'futur_anterieur':
        return ETRE_FUTUR;
      case 'conditionnel_passe':
        return ETRE_COND;
      default:
        return ETRE_PRESENT;
    }
  }
}

function buildImpersonalFrench(verb: VerbDefinition, frenchKey: FrenchTenseKey): string {
  if (verb.id === 'y_avoir') {
    switch (frenchKey) {
      case 'present':
        return 'il y a';
      case 'passe_compose':
        return 'il y a eu';
      case 'imparfait':
        return 'il y avait';
      case 'plus_que_parfait':
        return 'il y avait eu';
      case 'futur_simple':
        return 'il y aura';
      case 'futur_anterieur':
        return 'il y aura eu';
      case 'conditionnel_present':
        return 'il y aurait';
      case 'conditionnel_passe':
        return 'il y aurait eu';
      case 'subjonctif_present':
        return 'il y ait';
      default:
        return 'il y a';
    }
  }
  // falloir
  switch (frenchKey) {
    case 'present':
      return 'il faut';
    case 'passe_compose':
      return 'il a fallu';
    case 'imparfait':
      return 'il fallait';
    case 'plus_que_parfait':
      return 'il avait fallu';
    case 'futur_simple':
      return 'il faudra';
    case 'futur_anterieur':
      return 'il aura fallu';
    case 'conditionnel_present':
      return 'il faudrait';
    case 'conditionnel_passe':
      return 'il aurait fallu';
    case 'subjonctif_present':
      return 'il faille';
    default:
      return 'il faut';
  }
}

function needsSpanishSubjectHint(tenseId: TenseId, personIndex: PersonIndex): boolean {
  // Always clarify 3rd person gender (él vs ella, ellos vs ellas)
  if (personIndex === 2 || personIndex === 5) return true;
  // In Spanish, 1st and 3rd singular are identical in imperfecto, pluscuamperfecto, condicional, subjuntivo
  if (
    personIndex === 0 &&
    (tenseId === 'imparfait' ||
      tenseId === 'plus_que_parfait' ||
      tenseId === 'conditionnel_present' ||
      tenseId === 'conditionnel_passe' ||
      tenseId === 'subjonctif_present')
  ) {
    return true;
  }
  return false;
}

export function generateQuestion(
  selectedVerbIds: string[],
  selectedTenseIds: TenseId[],
  previousQuestionKey?: string
): PracticeQuestion {
  const validPairs: Array<{ verb: VerbDefinition; tenseId: TenseId }> = [];
  for (const vId of selectedVerbIds) {
    const verb = VERB_MAP[vId];
    if (!verb) continue;
    for (const tId of selectedTenseIds) {
      if (isValidVerbTense(verb, tId)) {
        validPairs.push({ verb, tenseId: tId });
      }
    }
  }

  // Fallback to default pair if config is somehow empty
  if (validPairs.length === 0) {
    validPairs.push({ verb: VERBS[4], tenseId: 'present' }); // aller
  }

  // Pick pair avoiding immediate repeat when possible
  let candidates = validPairs;
  if (validPairs.length > 1 && previousQuestionKey) {
    const filtered = validPairs.filter((p) => `${p.verb.id}:${p.tenseId}` !== previousQuestionKey);
    if (filtered.length > 0) candidates = filtered;
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const { verb, tenseId } = chosen;
  const tenseMeta = TENSE_MAP[tenseId];
  const frenchKey = tenseMeta.frenchKey;

  // Impersonal verbs (y avoir, falloir)
  if (verb.impersonal) {
    const esForm = verb.es[tenseId] as string;
    const canonicalFrench = buildImpersonalFrench(verb, frenchKey);
    const accepted = [canonicalFrench];
    if (frenchKey === 'subjonctif_present') {
      accepted.push(`qu'${canonicalFrench}`);
    }

    return {
      id: `${verb.id}-${tenseId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      verbId: verb.id,
      infinitive: verb.infinitive,
      spanishInfinitive: verb.spanishInfinitive,
      tenseId,
      frenchTenseKey: frenchKey,
      personIndex: 2,
      spanishPrompt: esForm,
      spanishPronounHint: undefined,
      canonicalFrench,
      acceptedFrenchForms: accepted,
      grammarTip: verb.disambiguationNote || tenseMeta.note,
      impersonal: true,
    };
  }

  // Imperative mood
  if (tenseId === 'imperatif' && verb.fr.imperatif && verb.es.imperatif) {
    const impIdx = Math.floor(Math.random() * 3) as 0 | 1 | 2;
    const personIndex: PersonIndex = impIdx === 0 ? 1 : impIdx === 1 ? 3 : 4;
    const esImpForm = verb.es.imperatif[impIdx];
    const frImpForm = verb.fr.imperatif[impIdx];
    const esHint = impIdx === 0 ? 'tú' : impIdx === 1 ? 'nosotros' : 'vosotros';

    return {
      id: `${verb.id}-${tenseId}-${personIndex}-${Date.now()}`,
      verbId: verb.id,
      infinitive: verb.infinitive,
      spanishInfinitive: verb.spanishInfinitive,
      tenseId,
      frenchTenseKey: 'imperatif',
      personIndex,
      spanishPrompt: esImpForm,
      spanishPronounHint: esHint,
      canonicalFrench: frImpForm,
      acceptedFrenchForms: [frImpForm],
      grammarTip: tenseMeta.note,
      impersonal: false,
    };
  }

  // Standard 6-person verb
  const personIndex = Math.floor(Math.random() * 6) as PersonIndex;
  const esArray = verb.es[tenseId] as string[];
  const esForm = esArray[personIndex];

  let frenchPronoun = 'je';
  let spanishPronoun = 'yo';
  let isFeminine3rd = false;

  switch (personIndex) {
    case 0:
      frenchPronoun = 'je';
      spanishPronoun = 'yo';
      break;
    case 1:
      frenchPronoun = 'tu';
      spanishPronoun = 'tú';
      break;
    case 2:
      if (Math.random() < 0.5) {
        frenchPronoun = 'il';
        spanishPronoun = 'él';
      } else {
        frenchPronoun = 'elle';
        spanishPronoun = 'ella';
        isFeminine3rd = true;
      }
      break;
    case 3:
      frenchPronoun = 'nous';
      spanishPronoun = 'nosotros';
      break;
    case 4:
      frenchPronoun = 'vous';
      spanishPronoun = 'vosotros';
      break;
    case 5:
      if (Math.random() < 0.5) {
        frenchPronoun = 'ils';
        spanishPronoun = 'ellos';
      } else {
        frenchPronoun = 'elles';
        spanishPronoun = 'ellas';
        isFeminine3rd = true;
      }
      break;
  }

  const isCompound =
    frenchKey === 'passe_compose' ||
    frenchKey === 'plus_que_parfait' ||
    frenchKey === 'futur_anterieur' ||
    frenchKey === 'conditionnel_passe';

  let canonicalFrench = '';
  const acceptedFrenchForms: string[] = [];

  if (isCompound) {
    const auxForm = getAuxiliaryArray(verb.auxiliary, frenchKey)[personIndex];
    const baseParticiple = verb.participePasse;
    const prefix = combinePronounAndVerb(frenchPronoun, auxForm);

    if (verb.auxiliary === 'être') {
      if (personIndex === 2) {
        canonicalFrench = isFeminine3rd
          ? `${prefix} ${baseParticiple}e`
          : `${prefix} ${baseParticiple}`;
        acceptedFrenchForms.push(canonicalFrench);
      } else if (personIndex === 5) {
        canonicalFrench = isFeminine3rd
          ? `${prefix} ${baseParticiple}es`
          : `${prefix} ${baseParticiple}s`;
        acceptedFrenchForms.push(canonicalFrench);
      } else if (personIndex === 0 || personIndex === 1) {
        canonicalFrench = `${prefix} ${baseParticiple}`;
        acceptedFrenchForms.push(`${prefix} ${baseParticiple}`, `${prefix} ${baseParticiple}e`);
      } else if (personIndex === 3) {
        canonicalFrench = `${prefix} ${baseParticiple}s`;
        acceptedFrenchForms.push(`${prefix} ${baseParticiple}s`, `${prefix} ${baseParticiple}es`);
      } else {
        // vous (plural or polite singular)
        canonicalFrench = `${prefix} ${baseParticiple}s`;
        acceptedFrenchForms.push(
          `${prefix} ${baseParticiple}s`,
          `${prefix} ${baseParticiple}es`,
          `${prefix} ${baseParticiple}`,
          `${prefix} ${baseParticiple}e`
        );
      }
    } else {
      canonicalFrench = `${prefix} ${baseParticiple}`;
      acceptedFrenchForms.push(canonicalFrench);
    }
  } else {
    const frSimpleArray = verb.fr[frenchKey as keyof typeof verb.fr] as string[];
    const frVerbForm = frSimpleArray[personIndex];
    canonicalFrench = combinePronounAndVerb(frenchPronoun, frVerbForm);
    acceptedFrenchForms.push(canonicalFrench);

    if (frenchKey === 'subjonctif_present') {
      const quePrefix = STARTS_WITH_VOWEL_OR_MUTE_H.test(frenchPronoun) ? "qu'" : 'que ';
      acceptedFrenchForms.push(`${quePrefix}${canonicalFrench}`);
    }
  }

  const spanishPronounHint = needsSpanishSubjectHint(tenseId, personIndex)
    ? spanishPronoun
    : undefined;

  const grammarTip =
    tenseId === 'passe_simple' || tenseId === 'passe_compose'
      ? tenseMeta.note
      : verb.disambiguationNote || tenseMeta.note;

  return {
    id: `${verb.id}-${tenseId}-${personIndex}-${Date.now()}`,
    verbId: verb.id,
    infinitive: verb.infinitive,
    spanishInfinitive: verb.spanishInfinitive,
    tenseId,
    frenchTenseKey: frenchKey,
    personIndex,
    spanishPrompt: esForm,
    spanishPronounHint,
    canonicalFrench,
    acceptedFrenchForms,
    grammarTip,
    impersonal: false,
  };
}

function normalizeFrench(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/\s*'\s*/g, "'")
    .replace(/[¡!¿?.,;:]/g, '')
    .replace(/\s+/g, ' ');
}

function stripAccents(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function evaluateAnswer(
  rawInput: string,
  question: PracticeQuestion,
  responseTimeMs: number,
  timedOut: boolean,
  currentSessionStreak: number
): EvaluationResult {
  const normalizedUser = normalizeFrench(rawInput);

  if (!normalizedUser) {
    return {
      isCorrect: false,
      isAccentIssue: false,
      timedOut,
      userAnswer: rawInput.trim(),
      canonicalAnswer: question.canonicalFrench,
      xpEarned: 0,
      responseTimeMs,
    };
  }

  const normalizedAccepted = question.acceptedFrenchForms.map(normalizeFrench);
  const isExactMatch = normalizedAccepted.includes(normalizedUser);

  if (isExactMatch) {
    let xp = 15; // base XP
    if (responseTimeMs <= 6000) xp += 5; // speed bonus
    if (currentSessionStreak >= 2) xp += 5; // combo bonus (3rd+ consecutive hit)

    return {
      isCorrect: true,
      isAccentIssue: false,
      timedOut,
      userAnswer: rawInput.trim(),
      canonicalAnswer: question.canonicalFrench,
      xpEarned: xp,
      responseTimeMs,
    };
  }

  const strippedUser = stripAccents(normalizedUser);
  const isAccentIssue = normalizedAccepted.some((acc) => stripAccents(acc) === strippedUser);

  return {
    isCorrect: false,
    isAccentIssue,
    timedOut,
    userAnswer: rawInput.trim(),
    canonicalAnswer: question.canonicalFrench,
    xpEarned: 0,
    responseTimeMs,
  };
}
