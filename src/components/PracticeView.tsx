import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Trophy,
  Volume2,
  XCircle,
} from 'lucide-react';
import { TENSE_MAP } from '../data/tenses';
import { VERB_MAP } from '../data/verbs';
import {
  AttemptSummary,
  EvaluationResult,
  PracticeQuestion,
  SessionConfig,
  TenseId,
  UserProgress,
} from '../types/conjugation';
import { evaluateAnswer, generateQuestion } from '../utils/conjugationEngine';
import { isSpeechSupported, speakFrench, stopSpeaking } from '../utils/speech';
import { getEffectiveStreak, getLevelInfo, getLocalDateKey } from '../utils/storage';

const TIMER_SECONDS = 20;
const FRENCH_ACCENTS = ['é', 'è', 'ê', 'à', 'ç', 'û', 'î', 'ô', 'ù', 'œ', "'"];

interface PracticeViewProps {
  progress: UserProgress;
  config: SessionConfig;
  overrideVerbs?: string[] | null;
  overrideTenses?: TenseId[] | null;
  onClearOverrides: () => void;
  onRecordAttempt: (
    attempt: AttemptSummary,
    xpEarned: number,
    sessionStreak: number
  ) => { bonusDailyGoalXp: number };
  onOpenConfig: () => void;
  onPracticeWeakVerbs: (verbIds: string[]) => void;
}

export const PracticeView: React.FC<PracticeViewProps> = ({
  progress,
  config,
  overrideVerbs,
  overrideTenses,
  onClearOverrides,
  onRecordAttempt,
  onOpenConfig,
  onPracticeWeakVerbs,
}) => {
  const activeVerbIds = overrideVerbs && overrideVerbs.length > 0 ? overrideVerbs : config.selectedVerbIds;
  const activeTenseIds = overrideTenses && overrideTenses.length > 0 ? overrideTenses : config.selectedTenseIds;

  const [question, setQuestion] = useState<PracticeQuestion>(() =>
    generateQuestion(activeVerbIds, activeTenseIds)
  );
  const [userInput, setUserInput] = useState('');
  const [timeLeftMs, setTimeLeftMs] = useState(TIMER_SECONDS * 1000);
  const [isPaused, setIsPaused] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [bonusGoalXp, setBonusGoalXp] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Session counters
  const [sessionAttempts, setSessionAttempts] = useState<AttemptSummary[]>([]);
  const [sessionXp, setSessionXp] = useState(0);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const questionStartRef = useRef<number>(Date.now());
  const hasEvaluatedRef = useRef<boolean>(false);
  const userInputRef = useRef<string>('');
  userInputRef.current = userInput;

  const targetLength = overrideVerbs ? Math.max(6, overrideVerbs.length * 2) : config.sessionLength;

  const startFreshSession = useCallback(
    (vIds = activeVerbIds, tIds = activeTenseIds) => {
      stopSpeaking();
      const firstQ = generateQuestion(vIds, tIds);
      setQuestion(firstQ);
      setUserInput('');
      setTimeLeftMs(TIMER_SECONDS * 1000);
      setIsPaused(false);
      setResult(null);
      setBonusGoalXp(0);
      setSessionAttempts([]);
      setSessionXp(0);
      setSessionStreak(0);
      setSessionComplete(false);
      questionStartRef.current = Date.now();
      hasEvaluatedRef.current = false;
      setTimeout(() => inputRef.current?.focus(), 40);
    },
    [activeVerbIds, activeTenseIds]
  );

  // Regenerate when config/override changes
  useEffect(() => {
    startFreshSession(activeVerbIds, activeTenseIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVerbIds.join(','), activeTenseIds.join(','), config.sessionLength]);

  const handleTriggerSpeak = useCallback((text: string, rate = 0.95) => {
    speakFrench(text, {
      rate,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  }, []);

  const finalizeQuestion = useCallback(
    (rawAnswer: string, timedOut: boolean) => {
      if (hasEvaluatedRef.current) return;
      hasEvaluatedRef.current = true;

      const elapsedMs = Math.min(TIMER_SECONDS * 1000, Date.now() - questionStartRef.current);
      const evaluation = evaluateAnswer(
        rawAnswer,
        question,
        elapsedMs,
        timedOut,
        sessionStreak
      );

      const nextStreak = evaluation.isCorrect ? sessionStreak + 1 : 0;
      setSessionStreak(nextStreak);
      setResult(evaluation);

      const attempt: AttemptSummary = {
        id: question.id,
        timestamp: Date.now(),
        verbId: question.verbId,
        infinitive: question.infinitive,
        tenseId: question.tenseId,
        spanishPrompt: question.spanishPrompt,
        canonicalFrench: question.canonicalFrench,
        userAnswer: evaluation.userAnswer,
        isCorrect: evaluation.isCorrect,
        responseTimeMs: elapsedMs,
      };

      const { bonusDailyGoalXp } = onRecordAttempt(attempt, evaluation.xpEarned, nextStreak);
      setBonusGoalXp(bonusDailyGoalXp);
      setSessionXp((prev) => prev + evaluation.xpEarned + bonusDailyGoalXp);
      setSessionAttempts((prev) => [...prev, attempt]);

      if (config.autoSpeak) {
        handleTriggerSpeak(question.canonicalFrench, 0.95);
      }
    },
    [config.autoSpeak, handleTriggerSpeak, onRecordAttempt, question, sessionStreak]
  );

  // 15-second countdown timer
  useEffect(() => {
    if (result || isPaused || sessionComplete) return;

    const interval = window.setInterval(() => {
      setTimeLeftMs((prev) => {
        const next = prev - 100;
        if (next <= 0) {
          window.clearInterval(interval);
          finalizeQuestion(userInputRef.current, true);
          return 0;
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [result, isPaused, sessionComplete, finalizeQuestion]);

  const handleNextQuestion = useCallback(() => {
    stopSpeaking();
    if (targetLength > 0 && sessionAttempts.length >= targetLength) {
      setSessionComplete(true);
      return;
    }

    const nextQ = generateQuestion(
      activeVerbIds,
      activeTenseIds,
      `${question.verbId}:${question.tenseId}`
    );
    setQuestion(nextQ);
    setUserInput('');
    setTimeLeftMs(TIMER_SECONDS * 1000);
    setIsPaused(false);
    setResult(null);
    setBonusGoalXp(0);
    questionStartRef.current = Date.now();
    hasEvaluatedRef.current = false;
    setTimeout(() => inputRef.current?.focus(), 40);
  }, [activeTenseIds, activeVerbIds, question.tenseId, question.verbId, sessionAttempts.length, targetLength]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (result) {
      handleNextQuestion();
    } else {
      finalizeQuestion(userInput, false);
    }
  };

  const insertAccent = (char: string) => {
    if (result) return;
    const el = inputRef.current;
    if (!el) {
      setUserInput((prev) => prev + char);
      return;
    }
    const start = el.selectionStart ?? userInput.length;
    const end = el.selectionEnd ?? userInput.length;
    const nextValue = userInput.slice(0, start) + char + userInput.slice(end);
    setUserInput(nextValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + char.length, start + char.length);
    });
  };

  const levelInfo = useMemo(() => getLevelInfo(progress.xp), [progress.xp]);
  const effectiveStreak = useMemo(() => getEffectiveStreak(progress), [progress]);
  const todayKey = getLocalDateKey();
  const todayAttempts = progress.dailyHistory[todayKey]?.attempts ?? 0;
  const dailyGoalPct = Math.min(100, Math.round((todayAttempts / progress.dailyGoal) * 100));

  const tenseMeta = TENSE_MAP[question.tenseId];
  const timerPercent = Math.max(0, (timeLeftMs / (TIMER_SECONDS * 1000)) * 100);
  const secondsDisplay = (timeLeftMs / 1000).toFixed(1);

  const sessionCorrectCount = sessionAttempts.filter((a) => a.isCorrect).length;
  const sessionMistakes = sessionAttempts.filter((a) => !a.isCorrect);

  if (sessionComplete) {
    const accuracy =
      sessionAttempts.length > 0
        ? Math.round((sessionCorrectCount / sessionAttempts.length) * 100)
        : 0;
    const weakIds = Array.from(new Set(sessionMistakes.map((m) => m.verbId)));

    return (
      <div className="mx-auto max-w-4xl py-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <p className="text-sm font-medium text-blue-700">Sesión completada</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Resumen de tu práctica
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {overrideVerbs && (
                <button
                  type="button"
                  onClick={onClearOverrides}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Volver a selección habitual
                </button>
              )}
              <button
                type="button"
                onClick={() => startFreshSession()}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-4 w-4" />
                Otra sesión
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 border-b border-slate-200 py-6 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Aciertos</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                {sessionCorrectCount}/{sessionAttempts.length}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Precisión</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{accuracy}%</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Puntos ganados</p>
              <p className="mt-1 text-2xl font-bold text-blue-700 tabular-nums">+{sessionXp} XP</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Racha diaria</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                {effectiveStreak} {effectiveStreak === 1 ? 'día' : 'días'}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-slate-900">
                Repaso de la sesión ({sessionAttempts.length} verbos)
              </h3>
              {weakIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onPracticeWeakVerbs(weakIds)}
                  className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  Repasar solo los {weakIds.length} con fallos
                </button>
              )}
            </div>

            <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
              {sessionAttempts.map((item, idx) => (
                <div
                  key={`${item.id}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" aria-label="Correcto" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-600 shrink-0" aria-label="Incorrecto" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-slate-900">{item.spanishPrompt}</span>
                        <span className="text-slate-400" aria-hidden="true">→</span>
                        <span className="font-semibold text-blue-700">{item.canonicalFrench}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {item.infinitive} · {TENSE_MAP[item.tenseId].spanishName}
                        {!item.isCorrect && item.userAnswer && (
                          <> · Tu respuesta: <span className="text-rose-700">{item.userAnswer}</span></>
                        )}
                      </p>
                    </div>
                  </div>
                  {isSpeechSupported() && (
                    <button
                      type="button"
                      onClick={() => handleTriggerSpeak(item.canonicalFrench, 0.9)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      Escuchar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
      {/* Left / Center Interactive Stage (65% -> 8 cols) */}
      <section className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        {/* Session mode notice if reviewing weak verbs */}
        {overrideVerbs && overrideVerbs.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 text-sm">
            <span className="font-medium text-blue-700">
              Modo repaso dirigido: {overrideVerbs.map((id) => VERB_MAP[id]?.infinitive).filter(Boolean).join(', ')}
            </span>
            <button
              type="button"
              onClick={onClearOverrides}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 underline cursor-pointer"
            >
              Salir del repaso
            </button>
          </div>
        )}

        {/* Top prompt bar: Tense info + 15s Timer */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{tenseMeta.spanishName}</span>
            <span aria-hidden="true">·</span>
            <span>{tenseMeta.mood}</span>
            {config.showInfinitiveHint && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-blue-700">Infinitivo: {question.infinitive}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!result && (
              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                aria-label={isPaused ? 'Reanudar temporizador' : 'Pausar temporizador'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                {isPaused ? 'Reanudar' : 'Pausar'}
              </button>
            )}
            <div
              className={`inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums ${
                timeLeftMs <= 4000 && !result ? 'text-rose-600' : 'text-slate-700'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>{secondsDisplay} s</span>
            </div>
          </div>
        </div>

        {/* 15-second Countdown Progress Track */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <div
            className={`h-full transition-[width] duration-100 ease-linear ${
              result
                ? result.isCorrect
                  ? 'bg-emerald-500'
                  : 'bg-rose-500'
                : timeLeftMs <= 4000
                  ? 'bg-rose-500'
                  : 'bg-blue-600'
            }`}
            style={{ width: `${result ? 100 : timerPercent}%` }}
          />
        </div>

        {/* Spanish Verb Prompt */}
        <div className="mt-8 mb-6">
          <p className="text-xs font-medium text-slate-500">
            {question.tenseId === 'imperatif'
              ? 'Escribe el imperativo en francés (sin sujeto)'
              : question.impersonal
                ? 'Escribe la forma impersonal en francés'
                : 'Escribe la forma verbal en francés con su sujeto'}
          </p>

          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            {question.spanishPronounHint && (
              <span className="text-xl font-medium text-slate-400 sm:text-2xl">
                ({question.spanishPronounHint})
              </span>
            )}
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl text-balance">
              {question.spanishPrompt}
            </h2>
          </div>

          {(question.tenseId === 'passe_simple' || question.tenseId === 'passe_compose') && (
            <p className="mt-2 text-xs text-slate-500">
              Objetivo en francés: <span className="font-medium text-slate-700">Passé composé</span>
            </p>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="french-answer-input" className="sr-only">
              Respuesta en francés
            </label>
            <input
              ref={inputRef}
              id="french-answer-input"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={Boolean(result)}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={
                question.tenseId === 'imperatif'
                  ? 'Ej.: va / allons / allez'
                  : question.impersonal
                    ? 'Ej.: il y a / il faut'
                    : 'Ej.: je vais'
              }
              className={`w-full rounded-xl border px-4 py-3.5 text-lg font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors ${
                result
                  ? result.isCorrect
                    ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950'
                    : 'border-rose-300 bg-rose-50/40 text-rose-950'
                  : 'border-slate-300 bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15'
              }`}
            />
          </div>

          {/* French Accent Quick-Insert Toolbar */}
          {config.showAccentBar && !result && (
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Teclado de caracteres franceses">
              <span className="mr-1 text-xs text-slate-500">Caracteres:</span>
              {FRENCH_ACCENTS.map((char) => (
                <button
                  key={char}
                  type="button"
                  onClick={() => insertAccent(char)}
                  className="min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-colors cursor-pointer"
                >
                  {char}
                </button>
              ))}
            </div>
          )}

          {/* Action Row */}
          {!result && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Comprobar ahora
              </button>
              <span className="text-xs text-slate-500">
                Pulsa <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px]">Enter</kbd> para comprobar o espera {Math.ceil(timeLeftMs / 1000)} s
              </span>
            </div>
          )}
        </form>

        {/* Verification & Audio Pronunciation Reveal */}
        {result && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            {/* Explicit Semantic Feedback Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {result.isCorrect ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span className="text-sm font-semibold text-emerald-800">
                      ¡Correcto!
                    </span>
                  </>
                ) : result.isAccentIssue ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                    <span className="text-sm font-semibold text-amber-800">
                      Casi correcto: revisa las tildes o la cedilla
                    </span>
                  </>
                ) : result.timedOut ? (
                  <>
                    <Clock className="h-5 w-5 text-rose-600 shrink-0" />
                    <span className="text-sm font-semibold text-rose-800">
                      Tiempo agotado (20 s) — Solución
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
                    <span className="text-sm font-semibold text-rose-800">
                      Revisa la forma correcta
                    </span>
                  </>
                )}
              </div>

              {result.xpEarned > 0 && (
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 tabular-nums">
                  <span>+{result.xpEarned} XP</span>
                  {bonusGoalXp > 0 && (
                    <span className="text-emerald-700">· +{bonusGoalXp} XP meta diaria</span>
                  )}
                </div>
              )}
            </div>

            {/* Written & Pronounced Solution Box */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    {question.infinitive} ({question.spanishInfinitive}) · {tenseMeta.frenchName}
                  </p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {question.canonicalFrench}
                  </p>
                  {question.acceptedFrenchForms.length > 1 && (
                    <p className="mt-1 text-xs text-slate-500">
                      También válido: {question.acceptedFrenchForms.slice(1).join(' / ')}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTriggerSpeak(question.canonicalFrench, 0.95)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      isSpeaking
                        ? 'border-blue-600 bg-blue-50 text-blue-800'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <Volume2 className="h-4 w-4" />
                    {isSpeaking ? 'Reproduciendo...' : 'Escuchar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerSpeak(question.canonicalFrench, 0.7)}
                    title="Escuchar más despacio"
                    className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
                  >
                    0.7× Lento
                  </button>
                </div>
              </div>

              <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-600">
                {question.grammarTip}
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleNextQuestion}
                autoFocus
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {targetLength > 0 && sessionAttempts.length >= targetLength
                  ? 'Ver resumen de sesión'
                  : 'Siguiente verbo'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Right Rail: Session, Streak, Daily Goal & Level (35% -> 4 cols) */}
      <aside className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-6 divide-y divide-slate-200">
        {/* Session Progress */}
        <div className="pb-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-900">Sesión actual</span>
            <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
              {targetLength > 0
                ? `${Math.min(sessionAttempts.length + (result ? 0 : 1), targetLength)} / ${targetLength}`
                : `${sessionAttempts.length} completados`}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 py-2.5 px-2">
              <p className="text-[11px] text-slate-500">Aciertos</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
                {sessionCorrectCount}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 py-2.5 px-2">
              <p className="text-[11px] text-slate-500">En racha</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
                {sessionStreak}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 py-2.5 px-2">
              <p className="text-[11px] text-slate-500">XP sesión</p>
              <p className="mt-0.5 text-lg font-bold text-blue-700 tabular-nums">
                +{sessionXp}
              </p>
            </div>
          </div>
        </div>

        {/* Daily Streak & Goal */}
        <div className="py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className={`h-4 w-4 ${effectiveStreak > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
              <span className="text-sm font-semibold text-slate-900">Racha diaria</span>
            </div>
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              {effectiveStreak} {effectiveStreak === 1 ? 'día' : 'días'}
            </span>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Objetivo de hoy</span>
              <span className="font-mono tabular-nums">
                {todayAttempts} / {progress.dailyGoal} verbos
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-amber-500 transition-[width] duration-300"
                style={{ width: `${dailyGoalPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* User Level & XP */}
        <div className="py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-blue-700" />
              <span className="text-sm font-semibold text-slate-900">
                Nivel {levelInfo.level} · {levelInfo.title}
              </span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500 tabular-nums">
            <span>{progress.xp} XP totales</span>
            <span>
              {levelInfo.nextLevelXp !== null
                ? `Siguiente: ${levelInfo.nextLevelXp} XP`
                : 'Nivel máximo'}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-blue-700 transition-[width] duration-300"
              style={{ width: `${levelInfo.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Active Config Summary */}
        <div className="pt-5">
          <p className="text-xs font-medium text-slate-500">Configuración activa</p>
          <p className="mt-1 text-sm text-slate-700">
            {activeVerbIds.length} {activeVerbIds.length === 1 ? 'verbo' : 'verbos'} ·{' '}
            {activeTenseIds.length} {activeTenseIds.length === 1 ? 'tiempo' : 'tiempos'}
          </p>
          <button
            type="button"
            onClick={onOpenConfig}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Elegir verbos y tiempos
          </button>
        </div>
      </aside>
    </div>
  );
};
