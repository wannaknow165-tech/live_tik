import { useMemo, useState } from 'react';
import { Copy, Check, Download, CheckSquare, Square } from 'lucide-react';
import {
  BOOSTERA_ASSETS,
  BattleState,
  DIRECTOR_ASSESSMENT_HE,
  QC_CHECKLIST_ITEMS,
} from '../data/boosteraCatalog';
import { StagePerfMetrics } from './BroadcastStage9x16';

interface ManifestAndQcWorkspaceProps {
  battleState: BattleState;
  perfMetrics: StagePerfMetrics;
}

export function ManifestAndQcWorkspace({
  battleState,
  perfMetrics,
}: ManifestAndQcWorkspaceProps) {
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [checkedQcIds, setCheckedQcIds] = useState<Record<string, boolean>>({
    QC_01_ALPHA_CHROMA: true,
    QC_02_SAFE_ZONE: true,
    QC_03_FPS_GPU: true,
    QC_04_OVERLAP_CAP: true,
    QC_05_AUDIO_SPEECH: true,
    QC_06_ROUND_CONTINUITY: true,
  });

  const integrationManifestObj = useMemo(() => {
    return {
      engine: 'BOOSTERA_LIVE_VFX_ENGINE',
      schemaVersion: '1.0.0',
      broadcastSpec: {
        aspectRatio: '9:16',
        targetCanvasResolution: '2160x3840',
        realtimeSimulationGrid: '1080x1920@60fps',
        presenterSafeCorridorHorizontalPct: [26, 74],
        battleDurationSec: 240,
        maxSimultaneousOneShots: 3,
        obsBrowserSources: {
          backLayerUrl: `${window.location.origin}/?mode=obs&layer=back`,
          frontLayerUrl: `${window.location.origin}/?mode=obs&layer=front`,
          compositeUrl: `${window.location.origin}/?mode=obs&layer=composite`,
          webhookEndpoint: `${window.location.origin}/api/events`,
        },
      },
      assets: BOOSTERA_ASSETS.map((a) => ({
        effectId: a.id,
        suggestedFilename: a.filename,
        category: a.category,
        triggerEvent: a.triggerEvent,
        triggerCondition: a.triggerThreshold,
        optionalManualFallback: a.optionalManualTrigger,
        cooldownMs: a.cooldownMs,
        priority: a.priority,
        playbackDurationSec: a.durationSec,
        layer: a.layer,
        playbackMode: a.playbackMode,
        requiredAudioCue: {
          cueId: a.audio.cueId,
          filename: a.audio.filename,
          targetPeakDbfs: a.audio.targetPeakDbfs,
          loudnessLufs: a.audio.relativeLoudnessLufs,
          cooldownMs: a.audio.cooldownMs,
          allowOverlap: a.audio.allowOverlap,
        },
        recommendedCompositingMethod: a.compositingMethod,
        maxSimultaneousInstances: a.simultaneousAllowed,
        minimumPerformanceSpec: a.minPerformanceSpec,
        maxCenterCrossDurationMs: a.centerCrossMs,
      })),
    };
  }, []);

  const manifestJsonString = useMemo(
    () => JSON.stringify(integrationManifestObj, null, 2),
    [integrationManifestObj]
  );

  const copyManifest = () => {
    navigator.clipboard.writeText(manifestJsonString);
    setCopiedManifest(true);
    setTimeout(() => setCopiedManifest(false), 1800);
  };

  const downloadManifest = () => {
    const blob = new Blob([manifestJsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'boostera-integration-manifest.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const toggleQc = (id: string) => {
    setCheckedQcIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-10">
      {/* Section 12: Senior VFX Supervisor Assessment in Hebrew */}
      <section className="space-y-4">
        <div className="border-b border-[#1E2636] pb-4">
          <h1 className="text-2xl font-bold text-slate-100">
            הערכת במאי VFX, טבלת מצאי, מניפסט JSON ובקרת איכות
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {DIRECTOR_ASSESSMENT_HE.roleSummary}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-[#121722] border border-[#1E2636] rounded-xl p-5 space-y-2.5">
            <h2 className="text-base font-semibold text-slate-100">
              01. מה כבר מוכן ופועל במערכת שבנינו?
            </h2>
            <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
              {DIRECTOR_ASSESSMENT_HE.whatWeHaveNow.map((line, idx) => (
                <li key={idx}>• {line}</li>
              ))}
            </ul>
          </div>

          <div className="bg-[#121722] border border-[#1E2636] rounded-xl p-5 space-y-2.5">
            <h2 className="text-base font-semibold text-slate-100">
              02. מה היה חסר בחבילות קליפים רגילות ואיך פתרנו זאת?
            </h2>
            <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
              {DIRECTOR_ASSESSMENT_HE.whatWasMissingInTypicalSetups.map((line, idx) => (
                <li key={idx}>• {line}</li>
              ))}
            </ul>
          </div>

          <div className="bg-[#121722] border border-[#1E2636] rounded-xl p-5 space-y-2.5">
            <h2 className="text-base font-semibold text-amber-300">
              03. מה חייבים להפסיק לייצר מיד (ביקורת מקצועית)?
            </h2>
            <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
              {DIRECTOR_ASSESSMENT_HE.whatWeMustStopMaking.map((line, idx) => (
                <li key={idx}>• {line}</li>
              ))}
            </ul>
          </div>

          <div className="bg-[#121722] border border-[#1E2636] rounded-xl p-5 space-y-2.5">
            <h2 className="text-base font-semibold text-slate-100">
              04. ארבעת אפקטי האימפקט הגבוהים ביותר ושקיפות ביצועים
            </h2>
            <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
              {DIRECTOR_ASSESSMENT_HE.highestImpactEffects.map((line, idx) => (
                <li key={idx} className="text-slate-200">{line}</li>
              ))}
            </ul>
            <div className="pt-2 border-t border-[#1E2636] space-y-1.5 text-xs text-slate-400">
              {DIRECTOR_ASSESSMENT_HE.technicalHonestyAndPerformance.map((line, idx) => (
                <p key={idx}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Deliverable A & B: Complete 11-Asset Inventory & Priority Matrix */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">
            טבלת מצאי ותעדוף אפקטים מלאה (Asset Inventory &amp; Priority Matrix)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            מיפוי מדויק של כל 11 נכסי ה-VFX, שכבת השידור (BACK / FRONT), תנאי ההפעלה, ה-Cooldown ושיטת הקומפוזיטינג.
          </p>
        </div>

        <div className="bg-[#121722] border border-[#1E2636] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1E2636] bg-[#0E131D] text-slate-400 font-medium">
                  <th className="py-3 px-3.5 whitespace-nowrap">#</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Effect ID</th>
                  <th className="py-3 px-3.5">שם וייעוד בקרב</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">שכבה</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">מצב ניגון</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">משך / CD</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">עדיפות</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">שיטת קומפוזיטינג</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2636]">
                {BOOSTERA_ASSETS.map((a) => (
                  <tr key={a.id} className="hover:bg-[#161D2B] transition-colors">
                    <td className="py-3 px-3.5 font-mono tabular-nums text-slate-400">
                      {String(a.order).padStart(2, '0')}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-amber-300 whitespace-nowrap">
                      {a.id}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-slate-200">{a.titleHe}</div>
                      <div className="text-slate-400 text-[11px]">{a.triggerLabelHe}</div>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-200 whitespace-nowrap">
                      {a.layer}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-300 whitespace-nowrap">
                      {a.playbackMode}
                    </td>
                    <td className="py-3 px-3.5 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                      {a.durationSec}s · {a.cooldownMs}ms
                    </td>
                    <td className="py-3 px-3.5 font-mono tabular-nums text-slate-200 whitespace-nowrap">
                      P{a.priority}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-300 whitespace-nowrap">
                      {a.compositingMethod}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Deliverable F: Exportable JSON Integration Manifest */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-100">
              מניפסט אינטגרציה למנוע BOOSTERA (JSON Manifest)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              מוכן לטעינה ישירה על ידי מפתחי המנוע כולל כתובות Browser Source, ספי הפעלה, חוקי Cooldown ומיפוי סאונד.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={copyManifest}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[#121722] border border-[#1E2636] text-slate-200 hover:border-slate-500 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {copiedManifest ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedManifest ? 'הועתק ללוח' : 'העתק JSON'}</span>
            </button>
            <button
              onClick={downloadManifest}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>הורד boostera-manifest.json</span>
            </button>
          </div>
        </div>

        <pre
          dir="ltr"
          className="bg-[#0B0E14] border border-[#1E2636] rounded-xl p-4 text-xs font-mono text-slate-300 max-h-96 overflow-auto text-left leading-relaxed"
        >
          {manifestJsonString}
        </pre>
      </section>

      {/* Deliverable G: Interactive Quality-Control Checklist & Live Broadcast Metrics */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1E2636] pb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-100">
              רשימת בקרת איכות לשידור חי (Quality-Control Checklist)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              פרוטוקול בדיקה לפני עלייה לאוויר ב-TikTok LIVE Studio / OBS.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-300 bg-[#121722] border border-[#1E2636] rounded-lg px-3.5 py-2">
            <span>FPS נמדד: {perfMetrics.fps}</span>
            <span aria-hidden="true">·</span>
            <span>זמן פריים: {perfMetrics.frameTimeMs}ms</span>
            <span aria-hidden="true">·</span>
            <span>שכבות פעילות: {battleState.activeEffects.length}/3</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QC_CHECKLIST_ITEMS.map((item) => {
            const checked = Boolean(checkedQcIds[item.id]);
            return (
              <button
                key={item.id}
                onClick={() => toggleQc(item.id)}
                className={`text-right p-4 rounded-xl border transition-colors flex items-start gap-3 ${
                  checked
                    ? 'bg-[#121722] border-[#263248]'
                    : 'bg-[#0E121B] border-[#1E2636] opacity-75'
                }`}
              >
                <div className="mt-0.5 text-amber-400 shrink-0">
                  {checked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-500" />}
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-400">{item.categoryHe}</div>
                  <div className="text-sm font-semibold text-slate-100">{item.titleHe}</div>
                  <p className="text-xs text-slate-300">
                    <span className="text-slate-400">קריטריון מעבר: </span>
                    {item.passCriteriaHe}
                  </p>
                  <p className="text-xs text-slate-400">
                    <span>איך לבדוק: </span>
                    {item.howToVerifyHe}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
