import { VERB_PRESETS } from '../data/verbs';
import {
  AttemptSummary,
  LevelInfo,
  SessionConfig,
  TenseId,
  UserProgress,
} from '../types/conjugation';

const STORAGE_KEY = 'conjugo_progress_v1';

export const LEVEL_TIERS = [
  { level: 1, title: 'Débutant', minXp: 0 },
  { level: 2, title: 'Apprenti', minXp: 100 },
  { level: 3, title: 'Explorateur', minXp: 250 },
  { level: 4, title: 'Voyageur', minXp: 500 },
  { level: 5, title: 'Francophone', minXp: 900 },
  { level: 6, title: 'Maître des Verbes', minXp: 1400 },
  { level: 7, title: 'Académicien', minXp: 2100 },
];

export const DEFAULT_CONFIG: SessionConfig = {
  selectedVerbIds: VERB_PRESETS[0].verbIds,
  selectedTenseIds: ['present', 'passe_simple', 'passe_compose', 'imparfait', 'futur_simple'],
  sessionLength: 10,
  autoSpeak: true,
  showAccentBar: true,
  showInfinitiveHint: false,
  offlineFocusMode: false,
};

export function createInitialProgress(): UserProgress {
  return {
    xp: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastPracticeDate: null,
    dailyGoal: 10,
    totalAttempts: 0,
    totalCorrect: 0,
    totalResponseTimeMs: 0,
    bestSessionStreak: 0,
    verbStats: {},
    tenseStats: {},
    dailyHistory: {},
    recentAttempts: [],
    config: DEFAULT_CONFIG,
  };
}

export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getYesterdayDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateKey(d);
}

export function loadProgress(): UserProgress {
  if (typeof window === 'undefined') return createInitialProgress();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialProgress();
    const parsed = JSON.parse(raw) as Partial<UserProgress>;
    const base = createInitialProgress();
    return {
      ...base,
      ...parsed,
      config: {
        ...base.config,
        ...(parsed.config || {}),
      },
      verbStats: parsed.verbStats || {},
      tenseStats: parsed.tenseStats || {},
      dailyHistory: parsed.dailyHistory || {},
      recentAttempts: parsed.recentAttempts || [],
    };
  } catch {
    return createInitialProgress();
  }
}

export function saveProgress(progress: UserProgress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage quota issues
  }
}

export function getEffectiveStreak(progress: UserProgress): number {
  if (!progress.lastPracticeDate) return 0;
  const today = getLocalDateKey();
  const yesterday = getYesterdayDateKey();
  if (progress.lastPracticeDate === today || progress.lastPracticeDate === yesterday) {
    return progress.currentStreak;
  }
  return 0;
}

export function recordAttempt(
  prev: UserProgress,
  attempt: AttemptSummary,
  xpEarned: number,
  currentSessionStreak: number
): { nextProgress: UserProgress; bonusDailyGoalXp: number } {
  const today = getLocalDateKey();
  const yesterday = getYesterdayDateKey();

  const prevToday = prev.dailyHistory[today] || { attempts: 0, correct: 0, xp: 0 };
  const newTodayAttempts = prevToday.attempts + 1;

  // Award daily goal completion bonus once when crossing dailyGoal today
  const hitGoalJustNow =
    prevToday.attempts < prev.dailyGoal && newTodayAttempts >= prev.dailyGoal;
  const bonusDailyGoalXp = hitGoalJustNow ? 30 : 0;
  const totalXpDelta = xpEarned + bonusDailyGoalXp;

  // Update daily streak
  let nextStreak = prev.currentStreak;
  if (prev.lastPracticeDate === today) {
    nextStreak = Math.max(1, prev.currentStreak);
  } else if (prev.lastPracticeDate === yesterday) {
    nextStreak = prev.currentStreak + 1;
  } else {
    nextStreak = 1;
  }

  const nextLongest = Math.max(prev.longestStreak, nextStreak);
  const prevVerb = prev.verbStats[attempt.verbId] || { attempts: 0, correct: 0 };
  const prevTense = prev.tenseStats[attempt.tenseId] || { attempts: 0, correct: 0 };

  const nextProgress: UserProgress = {
    ...prev,
    xp: prev.xp + totalXpDelta,
    currentStreak: nextStreak,
    longestStreak: nextLongest,
    lastPracticeDate: today,
    totalAttempts: prev.totalAttempts + 1,
    totalCorrect: prev.totalCorrect + (attempt.isCorrect ? 1 : 0),
    totalResponseTimeMs: prev.totalResponseTimeMs + attempt.responseTimeMs,
    bestSessionStreak: Math.max(prev.bestSessionStreak, currentSessionStreak),
    verbStats: {
      ...prev.verbStats,
      [attempt.verbId]: {
        attempts: prevVerb.attempts + 1,
        correct: prevVerb.correct + (attempt.isCorrect ? 1 : 0),
      },
    },
    tenseStats: {
      ...prev.tenseStats,
      [attempt.tenseId]: {
        attempts: prevTense.attempts + 1,
        correct: prevTense.correct + (attempt.isCorrect ? 1 : 0),
      },
    },
    dailyHistory: {
      ...prev.dailyHistory,
      [today]: {
        attempts: newTodayAttempts,
        correct: prevToday.correct + (attempt.isCorrect ? 1 : 0),
        xp: prevToday.xp + totalXpDelta,
      },
    },
    recentAttempts: [attempt, ...prev.recentAttempts].slice(0, 60),
  };

  saveProgress(nextProgress);
  return { nextProgress, bonusDailyGoalXp };
}

export function getLevelInfo(xp: number): LevelInfo {
  let currentTier = LEVEL_TIERS[0];
  let nextTier: (typeof LEVEL_TIERS)[number] | null = LEVEL_TIERS[1];

  for (let i = 0; i < LEVEL_TIERS.length; i++) {
    if (xp >= LEVEL_TIERS[i].minXp) {
      currentTier = LEVEL_TIERS[i];
      nextTier = LEVEL_TIERS[i + 1] || null;
    }
  }

  if (!nextTier) {
    return {
      level: currentTier.level,
      title: currentTier.title,
      minXp: currentTier.minXp,
      nextLevelXp: null,
      progressPercent: 100,
    };
  }

  const span = nextTier.minXp - currentTier.minXp;
  const gained = xp - currentTier.minXp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((gained / span) * 100)));

  return {
    level: currentTier.level,
    title: currentTier.title,
    minXp: currentTier.minXp,
    nextLevelXp: nextTier.minXp,
    progressPercent,
  };
}

export function getLastNDays(days: number): Array<{ dateKey: string; label: string }> {
  const result: Array<{ dateKey: string; label: string }> = [];
  const weekdayShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push({
      dateKey: getLocalDateKey(d),
      label: weekdayShort[d.getDay()],
    });
  }
  return result;
}

export function getWeakVerbIds(progress: UserProgress, limit = 6): string[] {
  const entries = Object.entries(progress.verbStats)
    .filter(([, s]) => s.attempts >= 1)
    .map(([verbId, s]) => ({
      verbId,
      accuracy: s.correct / s.attempts,
      attempts: s.attempts,
    }))
    .filter((e) => e.accuracy < 0.85)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);

  return entries.slice(0, limit).map((e) => e.verbId);
}

export function getWeakTenseIds(progress: UserProgress): TenseId[] {
  return Object.entries(progress.tenseStats)
    .filter(([, s]) => s.attempts >= 1 && s.correct / s.attempts < 0.85)
    .sort((a, b) => a[1].correct / a[1].attempts - b[1].correct / b[1].attempts)
    .slice(0, 4)
    .map(([tId]) => tId as TenseId);
}
