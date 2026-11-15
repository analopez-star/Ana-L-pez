import { useCallback, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { ConfigView } from './components/ConfigView';
import { OfflineView } from './components/OfflineView';
import { PracticeView } from './components/PracticeView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { StatsView } from './components/StatsView';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePWAInstall } from './hooks/usePWAInstall';
import { AttemptSummary, SessionConfig, TenseId, UserProgress } from './types/conjugation';
import {
  createInitialProgress,
  loadProgress,
  recordAttempt,
  saveProgress,
} from './utils/storage';

type TabId = 'practicar' | 'configurar' | 'estadisticas' | 'offline';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('practicar');
  const [progress, setProgress] = useState<UserProgress>(() => loadProgress());
  const [overrideVerbs, setOverrideVerbs] = useState<string[] | null>(null);
  const [overrideTenses, setOverrideTenses] = useState<TenseId[] | null>(null);
  const [sessionSeed, setSessionSeed] = useState(0);

  const isOnline = useOnlineStatus();
  const { isInstallable, isIOS, isInstalled } = usePWAInstall();

  const handleUpdateConfig = useCallback((nextConfig: SessionConfig) => {
    setProgress((prev) => {
      const updated = { ...prev, config: nextConfig };
      saveProgress(updated);
      return updated;
    });
  }, []);

  const handleRecordAttempt = useCallback(
    (attempt: AttemptSummary, xpEarned: number, sessionStreak: number) => {
      let bonusXp = 0;
      setProgress((prev) => {
        const res = recordAttempt(prev, attempt, xpEarned, sessionStreak);
        bonusXp = res.bonusDailyGoalXp;
        return res.nextProgress;
      });
      return { bonusDailyGoalXp: bonusXp };
    },
    []
  );

  const handleChangeDailyGoal = useCallback((goal: number) => {
    setProgress((prev) => {
      const updated = { ...prev, dailyGoal: goal };
      saveProgress(updated);
      return updated;
    });
  }, []);

  const handlePracticeWeakVerbs = useCallback((verbIds: string[]) => {
    setOverrideVerbs(verbIds);
    setOverrideTenses(null);
    setSessionSeed((s) => s + 1);
    setActiveTab('practicar');
  }, []);

  const handleResetStats = useCallback(() => {
    setProgress((prev) => {
      const fresh = createInitialProgress();
      fresh.config = prev.config;
      saveProgress(fresh);
      return fresh;
    });
  }, []);

  const handleStartNewSession = useCallback(() => {
    setOverrideVerbs(null);
    setOverrideTenses(null);
    setSessionSeed((s) => s + 1);
    setActiveTab('practicar');
  }, []);

  const showOfflineBanner = !isOnline || progress.config.offlineFocusMode;
  const showInstallInHeader = !isInstalled && (isInstallable || isIOS);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (4 nav links) — Zone 3 (1 primary action) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          {/* Zone 1: Brand Title */}
          <button
            type="button"
            onClick={() => setActiveTab('practicar')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Conjugo
          </button>

          {/* Zone 2: Single-line navigation links */}
          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {[
              { id: 'practicar' as const, label: 'Practicar' },
              { id: 'configurar' as const, label: 'Configurar' },
              { id: 'estadisticas' as const, label: 'Estadísticas' },
              { id: 'offline' as const, label: 'Sin conexión' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-blue-700 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            {showInstallInHeader ? (
              <PWAInstallButton variant="header" />
            ) : (
              <button
                type="button"
                onClick={handleStartNewSession}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Nueva sesión
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav Row (keeps touch targets >= 40px and compact within sticky height cap) */}
        <nav
          aria-label="Navegación móvil"
          className="flex md:hidden border-t border-slate-100 px-2 overflow-x-auto"
        >
          {[
            { id: 'practicar' as const, label: 'Practicar' },
            { id: 'configurar' as const, label: 'Configurar' },
            { id: 'estadisticas' as const, label: 'Estadísticas' },
            { id: 'offline' as const, label: 'Sin conexión' },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-h-[40px] px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'border-blue-700 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {activeTab === 'practicar' && (
          <PracticeView
            key={sessionSeed}
            progress={progress}
            config={progress.config}
            overrideVerbs={overrideVerbs}
            overrideTenses={overrideTenses}
            onClearOverrides={() => {
              setOverrideVerbs(null);
              setOverrideTenses(null);
            }}
            onRecordAttempt={handleRecordAttempt}
            onOpenConfig={() => setActiveTab('configurar')}
            onPracticeWeakVerbs={handlePracticeWeakVerbs}
          />
        )}

        {activeTab === 'configurar' && (
          <ConfigView
            config={progress.config}
            onUpdateConfig={handleUpdateConfig}
            onStartPractice={handleStartNewSession}
          />
        )}

        {activeTab === 'estadisticas' && (
          <StatsView
            progress={progress}
            onChangeDailyGoal={handleChangeDailyGoal}
            onPracticeWeakVerbs={handlePracticeWeakVerbs}
            onResetStats={handleResetStats}
          />
        )}

        {activeTab === 'offline' && (
          <OfflineView
            config={progress.config}
            onUpdateConfig={handleUpdateConfig}
            onStartPractice={handleStartNewSession}
          />
        )}
      </main>

      {/* Non-intrusive real offline/study mode indicator */}
      {showOfflineBanner && (
        <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-sm">
          <WifiOff className="h-3.5 w-3.5 text-amber-700 shrink-0" />
          <span>
            {!isOnline
              ? 'Sin conexión — Estudiando con datos en caché'
              : 'Modo estudio sin conexión activo'}
          </span>
        </div>
      )}
    </div>
  );
}
