import React, { useEffect, useState } from 'react';
import { CheckCircle2, Smartphone, Volume2, Wifi, WifiOff } from 'lucide-react';
import { TENSES } from '../data/tenses';
import { VERBS } from '../data/verbs';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { SessionConfig } from '../types/conjugation';
import { hasFrenchVoiceInstalled, isSpeechSupported, speakFrench } from '../utils/speech';
import { PWAInstallButton } from './PWAInstallButton';

interface OfflineViewProps {
  config: SessionConfig;
  onUpdateConfig: (next: SessionConfig) => void;
  onStartPractice: () => void;
}

export const OfflineView: React.FC<OfflineViewProps> = ({
  config,
  onUpdateConfig,
  onStartPractice,
}) => {
  const isOnline = useOnlineStatus();
  const [swReady, setSwReady] = useState(false);
  const [hasVoice, setHasVoice] = useState(() => hasFrenchVoiceInstalled());
  const [testingAudio, setTestingAudio] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => setSwReady(true))
        .catch(() => setSwReady(false));
    }
    const timer = window.setTimeout(() => {
      setHasVoice(hasFrenchVoiceInstalled());
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  const testOfflineAudio = () => {
    speakFrench('Bonjour, je suis prêt à pratiquer sans connexion.', {
      rate: 0.92,
      onStart: () => setTestingAudio(true),
      onEnd: () => setTestingAudio(false),
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Modo de práctica sin conexión
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Estudia verbos franceses en el autobús, en el instituto o sin cobertura móvil ni Wi-Fi.
          </p>
        </div>

        <button
          type="button"
          onClick={onStartPractice}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          Practicar ahora
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Offline Readiness & Focus Mode Toggle */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <WifiOff className="h-5 w-5 text-amber-600 shrink-0" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {isOnline ? 'Conexión activa' : 'Sin conexión a Internet'}
                </p>
                <p className="text-xs text-slate-500">
                  {swReady
                    ? 'Caché local lista: la app funciona íntegramente sin red.'
                    : 'Preparando archivos locales para uso sin conexión.'}
                </p>
              </div>
            </div>

            <label className="inline-flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.offlineFocusMode}
                onChange={(e) =>
                  onUpdateConfig({ ...config, offlineFocusMode: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
              />
              <span className="text-sm font-medium text-slate-800">
                Activar modo estudio sin conexión
              </span>
            </label>
          </div>

          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Recursos disponibles localmente en tu dispositivo
            </h2>
            <div className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
              <div className="flex items-center justify-between py-3 text-sm">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-slate-800">Base completa de verbos y formas impersonales</span>
                </div>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {VERBS.length} verbos
                </span>
              </div>

              <div className="flex items-center justify-between py-3 text-sm">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-slate-800">Todos los tiempos verbales de ESO y Bachillerato</span>
                </div>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {TENSES.length} tiempos
                </span>
              </div>

              <div className="flex items-center justify-between py-3 text-sm">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-slate-800">Estadísticas, puntos XP, niveles y rachas diarias</span>
                </div>
                <span className="text-xs text-slate-500">Guardado local</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 ${
                      isSpeechSupported() ? 'text-emerald-600' : 'text-amber-500'
                    }`}
                  />
                  <div>
                    <span className="text-slate-800">Síntesis de voz en francés del dispositivo</span>
                    <p className="text-xs text-slate-500">
                      {hasVoice
                        ? 'Voz francesa detectada en el navegador.'
                        : 'Usa el motor de voz del sistema operativo (fr-FR).'}
                    </p>
                  </div>
                </div>
                {isSpeechSupported() && (
                  <button
                    type="button"
                    onClick={testOfflineAudio}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    {testingAudio ? 'Sonando...' : 'Probar audio'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Install App Card */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5">
              <Smartphone className="h-5 w-5 text-blue-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Instala Conjugo en tu móvil o tablet
              </h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Al instalar la aplicación en tu pantalla de inicio, podrás abrirla al instante como una app nativa incluso cuando actives el modo avión o estés sin cobertura.
            </p>

            <div className="mt-4 space-y-2.5 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-600">
              <p>
                <strong className="text-slate-900">Android / Chrome / Edge:</strong> Pulsa «Instalar app» abajo o abre el menú del navegador y elige <em>Instalar aplicación</em>.
              </p>
              <p>
                <strong className="text-slate-900">iPhone / iPad (Safari):</strong> Toca <em>Compartir</em> y selecciona <em>Añadir a pantalla de inicio</em>.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <PWAInstallButton variant="panel" />
          </div>
        </section>
      </div>
    </div>
  );
};
