import React, { useMemo, useState } from 'react';
import { Check, Play, Search } from 'lucide-react';
import { TENSE_MOODS, TENSES } from '../data/tenses';
import { VERB_PRESETS, VERBS } from '../data/verbs';
import { SessionConfig, TenseId } from '../types/conjugation';
import { getValidPairsCount } from '../utils/conjugationEngine';

interface ConfigViewProps {
  config: SessionConfig;
  onUpdateConfig: (next: SessionConfig) => void;
  onStartPractice: () => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  config,
  onUpdateConfig,
  onStartPractice,
}) => {
  const [search, setSearch] = useState('');

  const filteredVerbs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return VERBS;
    return VERBS.filter(
      (v) =>
        v.infinitive.toLowerCase().includes(q) ||
        v.spanishInfinitive.toLowerCase().includes(q)
    );
  }, [search]);

  const validPairsCount = useMemo(
    () => getValidPairsCount(config.selectedVerbIds, config.selectedTenseIds),
    [config.selectedTenseIds, config.selectedVerbIds]
  );

  const toggleVerb = (verbId: string) => {
    const exists = config.selectedVerbIds.includes(verbId);
    const next = exists
      ? config.selectedVerbIds.filter((id) => id !== verbId)
      : [...config.selectedVerbIds, verbId];
    onUpdateConfig({ ...config, selectedVerbIds: next });
  };

  const toggleTense = (tenseId: TenseId) => {
    const exists = config.selectedTenseIds.includes(tenseId);
    const next = exists
      ? config.selectedTenseIds.filter((id) => id !== tenseId)
      : [...config.selectedTenseIds, tenseId];
    onUpdateConfig({ ...config, selectedTenseIds: next });
  };

  const applyPreset = (verbIds: string[]) => {
    onUpdateConfig({ ...config, selectedVerbIds: verbIds });
  };

  const selectAllTenses = () => {
    onUpdateConfig({ ...config, selectedTenseIds: TENSES.map((t) => t.id) });
  };

  const selectEssentialTenses = () => {
    onUpdateConfig({
      ...config,
      selectedTenseIds: ['present', 'passe_simple', 'passe_compose', 'imparfait', 'futur_simple'],
    });
  };

  const canStart = validPairsCount > 0;

  return (
    <div className="space-y-8">
      {/* Page Header & Launch Action */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Configura tu sesión de práctica
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Elige los verbos en infinitivo y los tiempos verbales que quieres repasar hoy.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600 tabular-nums">
            {validPairsCount} combinaciones válidas
          </span>
          <button
            type="button"
            disabled={!canStart}
            onClick={onStartPractice}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Play className="h-4 w-4" />
            Empezar práctica
          </button>
        </div>
      </div>

      {!canStart && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Selecciona al menos un verbo y un tiempo verbal compatible (recuerda que{' '}
          <strong>y avoir</strong>, <strong>falloir</strong>, <strong>pouvoir</strong> y{' '}
          <strong>devoir</strong> no tienen imperativo).
        </div>
      )}

      {/* Section 1: Infinitive Verbs */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              1. Verbos en infinitivo ({config.selectedVerbIds.length} de {VERBS.length})
            </h2>
            <p className="text-xs text-slate-500">
              Incluye los verbos más usuales e impersonales (il y a / il faut).
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar verbo..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Presets */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 mr-1">Selección rápida:</span>
          {VERB_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.verbIds)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => applyPreset([])}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Limpiar selección
          </button>
        </div>

        {/* Infinitive Grid */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredVerbs.map((verb) => {
            const selected = config.selectedVerbIds.includes(verb.id);
            return (
              <button
                key={verb.id}
                type="button"
                onClick={() => toggleVerb(verb.id)}
                className={`flex items-start justify-between gap-2 rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                  selected
                    ? 'border-blue-600 bg-blue-50/60 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{verb.infinitive}</p>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">{verb.spanishInfinitive}</p>
                </div>
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    selected
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {selected && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 2: Tenses */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              2. Tiempos verbales ({config.selectedTenseIds.length} de {TENSES.length})
            </h2>
            <p className="text-xs text-slate-500">
              El pretérito perfecto simple y el compuesto español se responden ambos con el passé composé.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectEssentialTenses}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Básicos ESO
            </button>
            <button
              type="button"
              onClick={selectAllTenses}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Seleccionar todos
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-6">
          {TENSE_MOODS.map((mood) => {
            const moodTenses = TENSES.filter((t) => t.mood === mood);
            return (
              <div key={mood}>
                <h3 className="text-xs font-semibold text-slate-500 mb-2.5">{mood}</h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {moodTenses.map((tense) => {
                    const selected = config.selectedTenseIds.includes(tense.id);
                    return (
                      <button
                        key={tense.id}
                        type="button"
                        onClick={() => toggleTense(tense.id)}
                        className={`flex items-start justify-between gap-3 rounded-lg border p-3.5 text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-blue-600 bg-blue-50/60'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {tense.spanishName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {tense.frenchName}
                          </p>
                        </div>
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            selected
                              ? 'border-blue-700 bg-blue-700 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 3: Session Preferences */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-4">
          3. Preferencias de estudio
        </h2>
        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-slate-900">Duración de la sesión</p>
            <p className="text-xs text-slate-500">Número de verbos antes del resumen</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {[
                { value: 10, label: '10 verbos' },
                { value: 15, label: '15 verbos' },
                { value: 20, label: '20 verbos' },
                { value: 0, label: 'Modo libre' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdateConfig({ ...config, sessionLength: opt.value })}
                  className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    config.sessionLength === opt.value
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-900">Pronunciación automática</p>
                <p className="text-xs text-slate-500">
                  Pronuncia el verbo en francés al comprobar o agotarse los 15 s
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.autoSpeak}
                onChange={(e) => onUpdateConfig({ ...config, autoSpeak: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-900">Barra de tildes francesas</p>
                <p className="text-xs text-slate-500">
                  Muestra botones rápidos para é, è, ê, ç, œ, etc.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.showAccentBar}
                onChange={(e) => onUpdateConfig({ ...config, showAccentBar: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
            </label>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-900">Mostrar pista del infinitivo</p>
                <p className="text-xs text-slate-500">
                  Muestra el infinitivo en francés encima de la pregunta
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.showInfinitiveHint}
                onChange={(e) =>
                  onUpdateConfig({ ...config, showInfinitiveHint: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  );
};
