import React, { useMemo, useState } from 'react';
import { Flame, Play, RotateCcw, Target, Trophy } from 'lucide-react';
import { TENSES } from '../data/tenses';
import { VERB_MAP } from '../data/verbs';
import { UserProgress } from '../types/conjugation';
import {
  getEffectiveStreak,
  getLastNDays,
  getLevelInfo,
  getLocalDateKey,
  getWeakVerbIds,
  LEVEL_TIERS,
} from '../utils/storage';

interface StatsViewProps {
  progress: UserProgress;
  onChangeDailyGoal: (goal: number) => void;
  onPracticeWeakVerbs: (verbIds: string[]) => void;
  onResetStats: () => void;
}

export const StatsView: React.FC<StatsViewProps> = ({
  progress,
  onChangeDailyGoal,
  onPracticeWeakVerbs,
  onResetStats,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  const levelInfo = useMemo(() => getLevelInfo(progress.xp), [progress.xp]);
  const effectiveStreak = useMemo(() => getEffectiveStreak(progress), [progress]);
  const last7Days = useMemo(() => getLastNDays(7), []);
  const todayKey = getLocalDateKey();
  const todayCount = progress.dailyHistory[todayKey]?.attempts ?? 0;

  const globalAccuracy =
    progress.totalAttempts > 0
      ? Math.round((progress.totalCorrect / progress.totalAttempts) * 100)
      : 0;

  const avgResponseSec =
    progress.totalAttempts > 0
      ? (progress.totalResponseTimeMs / progress.totalAttempts / 1000).toFixed(1)
      : '—';

  const maxDayCount = Math.max(
    progress.dailyGoal,
    ...last7Days.map((d) => progress.dailyHistory[d.dateKey]?.attempts ?? 0)
  );

  const practicedVerbs = useMemo(() => {
    return Object.entries(progress.verbStats)
      .filter(([, s]) => s.attempts > 0)
      .map(([verbId, s]) => ({
        verbId,
        verb: VERB_MAP[verbId],
        attempts: s.attempts,
        correct: s.correct,
        accuracy: Math.round((s.correct / s.attempts) * 100),
      }))
      .filter((item) => Boolean(item.verb))
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
  }, [progress.verbStats]);

  const weakVerbIds = useMemo(() => getWeakVerbIds(progress, 6), [progress]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Tu progreso y estadísticas
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Seguimiento personal de precisión, rachas diarias, puntos y dominio por tiempo verbal.
          </p>
        </div>

        {weakVerbIds.length > 0 && (
          <button
            type="button"
            onClick={() => onPracticeWeakVerbs(weakVerbIds)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Play className="h-4 w-4" />
            Repasar {weakVerbIds.length} verbos con más fallos
          </button>
        )}
      </div>

      {/* 4-column KPI Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Verbos practicados</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
            {progress.totalAttempts}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {todayCount} hoy · media {avgResponseSec} s/verbo
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Precisión global</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
            {globalAccuracy}%
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {progress.totalCorrect} aciertos · mejor serie {progress.bestSessionStreak}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Racha diaria</p>
            <Flame className={`h-4 w-4 ${effectiveStreak > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
            {effectiveStreak} {effectiveStreak === 1 ? 'día' : 'días'}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Récord personal: {progress.longestStreak}{' '}
            {progress.longestStreak === 1 ? 'día' : 'días'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Nivel y recompensa</p>
            <Trophy className="h-4 w-4 text-blue-700" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Nv. {levelInfo.level} · {levelInfo.title}
          </p>
          <p className="mt-1 text-xs text-blue-700 font-medium tabular-nums">
            {progress.xp} XP{' '}
            {levelInfo.nextLevelXp !== null
              ? `/ ${levelInfo.nextLevelXp} XP`
              : '(Nivel máximo)'}
          </p>
        </div>
      </div>

      {/* Middle Row: 7-Day Streak Activity + Level Progression */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Constancia de los últimos 7 días
              </h2>
              <p className="text-xs text-slate-500">
                Completa al menos 1 verbo cada día para mantener tu racha activa.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-slate-400" />
              <label htmlFor="daily-goal-select" className="text-xs text-slate-600">
                Meta diaria:
              </label>
              <select
                id="daily-goal-select"
                value={progress.dailyGoal}
                onChange={(e) => onChangeDailyGoal(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value={5}>5 verbos</option>
                <option value={10}>10 verbos</option>
                <option value={15}>15 verbos</option>
                <option value={20}>20 verbos</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-3 items-end h-44 pt-4">
            {last7Days.map((day) => {
              const entry = progress.dailyHistory[day.dateKey];
              const count = entry?.attempts ?? 0;
              const pct = maxDayCount > 0 ? Math.round((count / maxDayCount) * 100) : 0;
              const metGoal = count >= progress.dailyGoal;
              const isToday = day.dateKey === todayKey;

              return (
                <div key={day.dateKey} className="flex flex-col items-center h-full justify-end gap-2">
                  <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
                    {count}
                  </span>
                  <div className="w-full max-w-[40px] flex-1 flex items-end rounded-lg bg-slate-100 p-1">
                    <div
                      className={`w-full rounded-md transition-[height] duration-300 ${
                        metGoal
                          ? 'bg-emerald-600'
                          : count > 0
                            ? 'bg-blue-600'
                            : 'bg-transparent'
                      }`}
                      style={{ height: `${Math.max(count > 0 ? 12 : 0, pct)}%` }}
                    />
                  </div>
                  <span
                    className={`text-xs ${
                      isToday ? 'font-bold text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {isToday ? 'Hoy' : day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Levels Ladder */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-4">
            Niveles de usuario
          </h2>
          <div className="mt-4 divide-y divide-slate-100">
            {LEVEL_TIERS.map((tier) => {
              const unlocked = progress.xp >= tier.minXp;
              const isCurrent = levelInfo.level === tier.level;
              return (
                <div
                  key={tier.level}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`font-mono text-xs font-semibold w-7 tabular-nums ${
                        isCurrent
                          ? 'text-blue-700'
                          : unlocked
                            ? 'text-emerald-700'
                            : 'text-slate-400'
                      }`}
                    >
                      Nv.{tier.level}
                    </span>
                    <span
                      className={
                        isCurrent
                          ? 'font-bold text-slate-900'
                          : unlocked
                            ? 'font-medium text-slate-700'
                            : 'text-slate-400'
                      }
                    >
                      {tier.title}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {isCurrent
                      ? 'Actual'
                      : unlocked
                        ? 'Superado'
                        : `${tier.minXp} XP`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Breakdown by Tense */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-4">
          Rendimiento por tiempo verbal
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {TENSES.map((tense) => {
            const stat = progress.tenseStats[tense.id];
            const attempts = stat?.attempts ?? 0;
            const correct = stat?.correct ?? 0;
            const acc = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;

            return (
              <div key={tense.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-900 truncate">
                    {tense.spanishName}{' '}
                    <span className="text-xs font-normal text-slate-500">({tense.frenchName})</span>
                  </span>
                  <span className="font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap shrink-0">
                    {attempts > 0 ? `${acc}% (${correct}/${attempts})` : 'Sin datos'}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full transition-[width] duration-300 ${
                      attempts === 0
                        ? 'bg-transparent'
                        : acc >= 80
                          ? 'bg-emerald-600'
                          : acc >= 55
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                    }`}
                    style={{ width: `${acc}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Breakdown by Verb */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Progreso por verbo ({practicedVerbs.length} practicados)
          </h2>
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-700 font-medium">¿Borrar todo tu progreso?</span>
              <button
                type="button"
                onClick={() => {
                  onResetStats();
                  setConfirmReset(false);
                }}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-700 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reiniciar estadísticas
            </button>
          )}
        </div>

        {practicedVerbs.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">
            Todavía no has completado ningún verbo. Empieza una sesión en la pestaña Practicar para ver tus estadísticas detalladas aquí.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Infinitivo</th>
                  <th className="py-2.5 pr-4 font-medium">Significado</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Intentos</th>
                  <th className="py-2.5 pr-4 font-medium text-right">Precisión</th>
                  <th className="py-2.5 font-medium text-right">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {practicedVerbs.map((row) => (
                  <tr key={row.verbId}>
                    <td className="py-2.5 pr-4 font-semibold text-slate-900">
                      {row.verb.infinitive}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">{row.verb.spanishInfinitive}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-slate-700 tabular-nums">
                      {row.correct}/{row.attempts}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {row.accuracy}%
                    </td>
                    <td className="py-2.5 text-right text-xs font-medium">
                      {row.accuracy >= 85 ? (
                        <span className="text-emerald-700">Dominado</span>
                      ) : row.accuracy >= 60 ? (
                        <span className="text-amber-700">En progreso</span>
                      ) : (
                        <span className="text-rose-700">Por reforzar</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
