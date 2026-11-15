export type TenseId =
  | 'present'
  | 'passe_simple'
  | 'passe_compose'
  | 'imparfait'
  | 'plus_que_parfait'
  | 'futur_simple'
  | 'futur_anterieur'
  | 'conditionnel_present'
  | 'conditionnel_passe'
  | 'subjonctif_present'
  | 'imperatif';

export type FrenchTenseKey =
  | 'present'
  | 'passe_compose'
  | 'imparfait'
  | 'plus_que_parfait'
  | 'futur_simple'
  | 'futur_anterieur'
  | 'conditionnel_present'
  | 'conditionnel_passe'
  | 'subjonctif_present'
  | 'imperatif';

export type PersonIndex = 0 | 1 | 2 | 3 | 4 | 5;

export type PronounVariant = {
  frenchPronoun: string;
  spanishPronoun: string;
  gender?: 'm' | 'f';
  isPlural?: boolean;
};

export interface VerbDefinition {
  id: string;
  infinitive: string;
  spanishInfinitive: string;
  level: 'basico' | 'intermedio' | 'avanzado';
  impersonal?: boolean;
  auxiliary: 'avoir' | 'être';
  participePasse: string;
  /** French forms for simple tenses: arrays of 6 [je, tu, il/elle/on, nous, vous, ils/elles] or single string for impersonal */
  fr: {
    present: string[] | string;
    imparfait: string[] | string;
    futur_simple: string[] | string;
    conditionnel_present: string[] | string;
    subjonctif_present: string[] | string;
    imperatif?: [string, string, string]; // [tu, nous, vous]
  };
  /** Spanish forms for each TenseId */
  es: {
    present: string[] | string;
    passe_simple: string[] | string;
    passe_compose: string[] | string;
    imparfait: string[] | string;
    plus_que_parfait: string[] | string;
    futur_simple: string[] | string;
    futur_anterieur: string[] | string;
    conditionnel_present: string[] | string;
    conditionnel_passe: string[] | string;
    subjonctif_present: string[] | string;
    imperatif?: [string, string, string]; // [tú, nosotros, vosotros]
  };
  disambiguationNote?: string;
}

export interface PracticeQuestion {
  id: string;
  verbId: string;
  infinitive: string;
  spanishInfinitive: string;
  tenseId: TenseId;
  frenchTenseKey: FrenchTenseKey;
  personIndex: PersonIndex;
  spanishPrompt: string;
  spanishPronounHint?: string;
  canonicalFrench: string;
  acceptedFrenchForms: string[];
  grammarTip: string;
  impersonal: boolean;
}

export interface EvaluationResult {
  isCorrect: boolean;
  isAccentIssue: boolean;
  timedOut: boolean;
  userAnswer: string;
  canonicalAnswer: string;
  xpEarned: number;
  responseTimeMs: number;
}

export interface SessionConfig {
  selectedVerbIds: string[];
  selectedTenseIds: TenseId[];
  sessionLength: number; // 0 = libre
  autoSpeak: boolean;
  showAccentBar: boolean;
  showInfinitiveHint: boolean;
  offlineFocusMode: boolean;
}

export interface VerbStat {
  attempts: number;
  correct: number;
}

export interface TenseStat {
  attempts: number;
  correct: number;
}

export interface DailyActivity {
  attempts: number;
  correct: number;
  xp: number;
}

export interface AttemptSummary {
  id: string;
  timestamp: number;
  verbId: string;
  infinitive: string;
  tenseId: TenseId;
  spanishPrompt: string;
  canonicalFrench: string;
  userAnswer: string;
  isCorrect: boolean;
  responseTimeMs: number;
}

export interface UserProgress {
  xp: number;
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null; // YYYY-MM-DD
  dailyGoal: number;
  totalAttempts: number;
  totalCorrect: number;
  totalResponseTimeMs: number;
  bestSessionStreak: number;
  verbStats: Record<string, VerbStat>;
  tenseStats: Record<string, TenseStat>;
  dailyHistory: Record<string, DailyActivity>;
  recentAttempts: AttemptSummary[];
  config: SessionConfig;
}

export interface LevelInfo {
  level: number;
  title: string;
  minXp: number;
  nextLevelXp: number | null;
  progressPercent: number;
}
