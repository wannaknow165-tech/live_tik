import { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sliders,
  Zap,
  Share2,
  UserPlus,
  Users,
  MessageSquare,
  Target,
  Flame,
  Camera,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import {
  BATTLE_PHASES,
  BattleState,
  LIKE_ENERGY_TIERS,
  ROUND_PALETTES,
  RoundPaletteId,
} from '../data/boosteraCatalog';
import { BroadcastStage9x16, StagePerfMetrics } from './BroadcastStage9x16';
import { soundEngine } from '../engine/soundEngine';

interface LiveDirectorWorkspaceProps {
  battleState: BattleState;
  wsConnected: boolean;
  sendTikTokEvent: (payload: {
    type: string;
    count?: number;
    effectId?: string;
    user?: string;
    message?: string;
    bypassCooldown?: boolean;
  }) => Promise<void>;
  controlBattle: (payload: {
    action: 'start' | 'pause' | 'reset' | 'seek' | 'set_palette' | 'toggle_crowd_test';
    timeSec?: number;
    palette?: RoundPaletteId;
  }) => Promise<void>;
  perfMetrics: StagePerfMetrics;
  onPerfSample: (m: StagePerfMetrics) => void;
}

export function LiveDirectorWorkspace({
  battleState,
  wsConnected,
  sendTikTokEvent,
  controlBattle,
  perfMetrics,
  onPerfSample,
}: LiveDirectorWorkspaceProps) {
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [layerFilter, setLayerFilter] = useState<'both' | 'back_only' | 'front_only'>('both');
  const [useWebcam, setUseWebcam] = useState(false);
  const [webcamNotice, setWebcamNotice] = useState<string | null>(null);

  const [muted, setMuted] = useState(soundEngine.isMuted());
  const [vocalProtect, setVocalProtect] = useState(soundEngine.isVocalProtectionEnabled());
  const [liveDb, setLiveDb] = useState(-60);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setLiveDb(soundEngine.getLiveLevelDbfs());
    }, 140);
    return () => clearInterval(id);
  }, []);

  const toggleMute = () => {
    soundEngine.ensureInitialized();
    const next = !muted;
    soundEngine.setMuted(next);
    setMuted(next);
  };

  const toggleVocalProtect = () => {
    soundEngine.ensureInitialized();
    const next = !vocalProtect;
    soundEngine.setVocalProtection(next);
    setVocalProtect(next);
  };

  const activePhaseSpec =
    BATTLE_PHASES.find((p) => p.id === battleState.phase) || BATTLE_PHASES[0];

  const webhookExample = `curl -X POST ${window.location.origin}/api/events -H "Content-Type: application/json" -d '{"type":"share","count":1,"user":"TikTokViewer"}'`;

  const copyWebhookCmd = () => {
    navigator.clipboard.writeText(webhookExample);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Main 2-Column Broadcast Control Room Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Column A (5 cols): 9:16 Live Broadcast Monitor & Layer / Audio Toolbar */}
        <div className="lg:col-span-5 bg-[#121722] border border-[#1E2636] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-slate-100">מוניטור שידור חי (9:16)</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                הפרדת שכבות BACK / FRONT סביב המגיש ·{' '}
                <span className="font-mono tabular-nums text-slate-300">{perfMetrics.fps} FPS</span> ·{' '}
                <span className="font-mono tabular-nums text-slate-300">{perfMetrics.frameTimeMs}ms</span>
              </p>
            </div>

            {/* Segmented Layer Filter Control */}
            <div className="flex items-center gap-1 p-1 bg-[#0B0E14] border border-[#1E2636] rounded-lg">
              {(
                [
                  { id: 'both', label: 'משולב' },
                  { id: 'back_only', label: 'BACK' },
                  { id: 'front_only', label: 'FRONT' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLayerFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    layerFilter === tab.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 9:16 Live Stage */}
          <BroadcastStage9x16
            battleState={battleState}
            showSafeZone={showSafeZone}
            showLayerFilter={layerFilter}
            useLiveWebcam={useWebcam}
            onWebcamError={(msg) => {
              setUseWebcam(false);
              setWebcamNotice(msg);
            }}
            onPerfSample={onPerfSample}
          />

          {webcamNotice && (
            <p className="text-xs text-amber-300/90 text-center">{webcamNotice}</p>
          )}

          {/* Stage Calibrations & Audio Protection Controls */}
          <div className="pt-2 border-t border-[#1E2636] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowSafeZone((v) => !v)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  showSafeZone
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                    : 'bg-[#0B0E14] border-[#1E2636] text-slate-300 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>אזור בטוח 48%</span>
              </button>

              <button
                onClick={() => {
                  setWebcamNotice(null);
                  setUseWebcam((v) => !v);
                }}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  useWebcam
                    ? 'bg-sky-500/15 border-sky-500/50 text-sky-200'
                    : 'bg-[#0B0E14] border-[#1E2636] text-slate-300 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{useWebcam ? 'כבה מצלמה' : 'מצלמה חיה'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleVocalProtect}
                title="פינוי תדרי דיבור 350Hz-3.2kHz להגנה על קול המגיש"
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  vocalProtect
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                    : 'bg-[#0B0E14] border-[#1E2636] text-slate-400'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>הגנת קול מגיש</span>
              </button>

              <button
                onClick={toggleMute}
                className="px-3 py-1.5 text-xs rounded-lg border border-[#1E2636] bg-[#0B0E14] text-slate-200 hover:bg-[#171E2C] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
              >
                {muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
                <span className="font-mono tabular-nums">
                  {muted ? 'מושתק' : `${liveDb <= -58 ? '-∞' : `${liveDb.toFixed(0)}dB`}`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Column B (7 cols): 240s Battle Timeline Scrubber + Reactive Trigger Deck + Live Event Stream */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Synchronized 240-Second 5-Phase Battle Controller */}
          <section className="bg-[#121722] border border-[#1E2636] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>מסע קרב מתוזמן (240 שניות)</span>
                  <span aria-hidden="true">·</span>
                  <span>שלב {activePhaseSpec.index}/5: {activePhaseSpec.nameHe}</span>
                  <span aria-hidden="true">·</span>
                  <span>{wsConnected ? 'מחובר בזמן אמת (WS)' : 'מסנכרן חיבור...'}</span>
                </div>
                <h3 className="text-lg font-semibold text-slate-100 mt-1">
                  {activePhaseSpec.nameEn} ({activePhaseSpec.timeRangeLabel}) — {activePhaseSpec.summaryHe}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => controlBattle({ action: battleState.isRunning ? 'pause' : 'start' })}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {battleState.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{battleState.isRunning ? 'השהה שעון' : 'הפעל שעון'}</span>
                </button>
                <button
                  onClick={() => controlBattle({ action: 'reset' })}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-[#0B0E14] border border-[#1E2636] text-slate-200 hover:bg-[#182030] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>איפוס</span>
                </button>
              </div>
            </div>

            {/* Interactive 5-Phase Timeline Bar */}
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-1.5">
                {BATTLE_PHASES.map((phase) => {
                  const isCurrent = battleState.phase === phase.id;
                  const pctInPhase =
                    battleState.elapsedSec <= phase.startSec
                      ? 0
                      : battleState.elapsedSec >= phase.endSec
                        ? 100
                        : ((battleState.elapsedSec - phase.startSec) / (phase.endSec - phase.startSec)) * 100;
                  return (
                    <button
                      key={phase.id}
                      onClick={() => controlBattle({ action: 'seek', timeSec: phase.startSec + 0.5 })}
                      className={`text-right p-2.5 rounded-lg border transition-colors ${
                        isCurrent
                          ? 'bg-[#192131] border-amber-500/60 text-slate-100'
                          : 'bg-[#0B0E14] border-[#1E2636] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                        <span>{phase.index}. {phase.nameEn}</span>
                        <span>{phase.timeRangeLabel.split('–')[0]}</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full bg-amber-500 transition-all duration-150 ${
                            pctInPhase >= 95
                              ? 'w-full'
                              : pctInPhase >= 75
                                ? 'w-3/4'
                                : pctInPhase >= 50
                                  ? 'w-1/2'
                                  : pctInPhase >= 25
                                    ? 'w-1/4'
                                    : pctInPhase > 2
                                      ? 'w-1/12'
                                      : 'w-0'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-4 pt-1 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>וריאציית צבע לסיבוב #{battleState.roundNumber}:</span>
                  <div className="flex items-center gap-1 p-0.5 bg-[#0B0E14] border border-[#1E2636] rounded-lg">
                    {(Object.keys(ROUND_PALETTES) as RoundPaletteId[]).map((pid) => (
                      <button
                        key={pid}
                        onClick={() => controlBattle({ action: 'set_palette', palette: pid })}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          battleState.roundPalette === pid
                            ? 'bg-[#1E2636] text-slate-100 font-medium'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {ROUND_PALETTES[pid].nameHe}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => controlBattle({ action: 'toggle_crowd_test' })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    battleState.crowdTestActive
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                      : 'bg-[#0B0E14] border-[#1E2636] text-slate-300 hover:text-white'
                  }`}
                >
                  {battleState.crowdTestActive ? 'עצור בדיקת עומס קהל' : 'הפעל בדיקת עומס קהל חי'}
                </button>
              </div>
            </div>
          </section>

          {/* 2. Progressive Like Energy Accumulation System (5-State) */}
          <section className="bg-[#121722] border border-[#1E2636] rounded-xl p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  מערכת צבירת אנרגיית לייקים (Progressive Like Charge)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  דרגה נוכחית: <span className="text-amber-300 font-semibold">{battleState.likeTier}</span> · עוצמה{' '}
                  <span className="font-mono tabular-nums text-slate-200">{Math.round(battleState.likeEnergy)}%</span> · קצב{' '}
                  <span className="font-mono tabular-nums text-slate-200">{battleState.likesPerSecond} לייקים/שנ׳</span> · סה״כ{' '}
                  <span className="font-mono tabular-nums text-slate-200">{battleState.totalLikes}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => sendTikTokEvent({ type: 'like', count: 6, user: 'צופה בלייב' })}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0B0E14] border border-[#1E2636] text-slate-200 hover:border-amber-500/50 transition-colors whitespace-nowrap shrink-0"
                >
                  +6 לייקים
                </button>
                <button
                  onClick={() => sendTikTokEvent({ type: 'like', count: 22, user: 'רצף הקשות קהל' })}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0B0E14] border border-[#1E2636] text-amber-300 hover:border-amber-500/60 transition-colors whitespace-nowrap shrink-0"
                >
                  +22 רצף לייקים
                </button>
                <button
                  onClick={() => sendTikTokEvent({ type: 'like', count: 55, user: 'סופת לייקים' })}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-200 hover:bg-amber-500/30 transition-colors whitespace-nowrap shrink-0"
                >
                  דחיפה ל-OVERDRIVE
                </button>
              </div>
            </div>

            {/* 5-Segment Progressive Meter */}
            <div className="grid grid-cols-5 gap-1.5">
              {LIKE_ENERGY_TIERS.map((t) => {
                const active = battleState.likeTier === t.tier;
                const passed = battleState.likeEnergy >= t.minEnergy;
                return (
                  <div
                    key={t.tier}
                    className={`px-2.5 py-2 rounded-lg border text-xs transition-colors ${
                      active
                        ? 'bg-amber-500/15 border-amber-400 text-amber-100 font-semibold'
                        : passed
                          ? 'bg-[#171F2E] border-[#28354D] text-slate-300'
                          : 'bg-[#0B0E14] border-[#1E2636] text-slate-500'
                    }`}
                  >
                    <div className="font-mono text-[11px]">{t.tier}</div>
                    <div className="text-[11px] opacity-80 truncate">{t.lpsThreshold}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Live TikTok Engagement & Director Manual Triggers */}
          <section className="bg-[#121722] border border-[#1E2636] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">
                לוח הפעלת אירועי TikTok LIVE (חי + ידני)
              </h3>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                שכבות פעילות כעת: {battleState.activeEffects.length}/3 · לקוחות מסונכרנים: {battleState.connectedClients}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => sendTikTokEvent({ type: 'share', count: 1, user: 'משתף שידור', bypassCooldown: true })}
                className="p-3 rounded-lg bg-[#0B0E14] border border-[#1E2636] hover:border-slate-500 text-right transition-colors group"
              >
                <div className="flex items-center justify-between text-slate-200 text-xs font-semibold">
                  <span>שיתוף (CO₂)</span>
                  <Share2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">FRONT · 2.8s · סה״כ {battleState.totalShares}</div>
              </button>

              <button
                onClick={() =>
                  sendTikTokEvent({ type: 'manual_vfx', effectId: 'SHARE_SMOKE_PLUMES', user: 'רצף שיתופים' })
                }
                className="p-3 rounded-lg bg-[#0B0E14] border border-[#1E2636] hover:border-slate-500 text-right transition-colors group"
              >
                <div className="flex items-center justify-between text-slate-200 text-xs font-semibold">
                  <span>עמודי עשן</span>
                  <Flame className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">BACK · 3+ שיתופים</div>
              </button>

              <button
                onClick={() => sendTikTokEvent({ type: 'follow', count: 1, user: 'עוקב חדש', bypassCooldown: true })}
                className="p-3 rounded-lg bg-[#0B0E14] border border-[#1E2636] hover:border-slate-500 text-right transition-colors group"
              >
                <div className="flex items-center justify-between text-slate-200 text-xs font-semibold">
                  <span>עוקב חדש</span>
                  <UserPlus className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">FRONT · ניצוצות זהב ({battleState.totalFollowers})</div>
              </button>

              <button
                onClick={() => sendTikTokEvent({ type: 'join', count: 5, user: 'גל צופים', bypassCooldown: true })}
                className="p-3 rounded-lg bg-[#0B0E14] border border-[#1E2636] hover:border-slate-500 text-right transition-colors group"
              >
                <div className="flex items-center justify-between text-slate-200 text-xs font-semibold">
                  <span>גל צופים (+5)</span>
                  <Users className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">BACK · אלומת אור ({battleState.totalViewersJoined})</div>
              </button>

              <button
                onClick={() =>
                  sendTikTokEvent({ type: 'chat', message: 'הקרב הזה מטורף!', user: 'תגובת צ׳אט', bypassCooldown: true })
                }
                className="p-3 rounded-lg bg-[#0B0E14] border border-[#1E2636] hover:border-slate-500 text-right transition-colors group"
              >
                <div className="flex items-center justify-between text-slate-200 text-xs font-semibold">
                  <span>צ׳אט משמעותי</span>
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">BACK · קשת טסלה היקפית</div>
              </button>

              <button
                onClick={() => sendTikTokEvent({ type: 'goal', user: 'יעד קהילה', bypassCooldown: true })}
                className="p-3 rounded-lg bg-[#0B0E14] border border-[#1E2636] hover:border-amber-500/60 text-right transition-colors group"
              >
                <div className="flex items-center justify-between text-amber-200 text-xs font-semibold">
                  <span>השלמת יעד</span>
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">HYBRID · גל הדף ({battleState.goalsCompleted})</div>
              </button>

              <button
                onClick={() => sendTikTokEvent({ type: 'glove', user: 'כפפת קרב (ידני/חי)', bypassCooldown: true })}
                className="p-3 rounded-lg bg-[#0B0E14] border border-[#1E2636] hover:border-sky-400/60 text-right transition-colors group"
              >
                <div className="flex items-center justify-between text-sky-200 text-xs font-semibold">
                  <span>כפפה / ברק</span>
                  <Zap className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">BACK · מכת ברק מתפצלת</div>
              </button>

              <button
                onClick={() => controlBattle({ action: 'seek', timeSec: 225.1 })}
                className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/50 hover:bg-amber-500/25 text-right transition-colors"
              >
                <div className="flex items-center justify-between text-amber-200 text-xs font-semibold">
                  <span>גראנד פינאלה</span>
                  <Play className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <div className="text-[11px] text-amber-200/80 mt-1">03:45–04:00 · 15s קליימקס</div>
              </button>
            </div>

            {/* Live Webhook Endpoint Bar */}
            <div className="pt-3 border-t border-[#1E2636] flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-slate-400">
                חיבור Webhook חי מ-TikFinity / Streamer.bot אל{' '}
                <code className="text-slate-200 bg-[#0B0E14] px-1.5 py-0.5 rounded">POST /api/events</code>
              </div>
              <button
                onClick={copyWebhookCmd}
                className="px-2.5 py-1 text-xs rounded-md bg-[#0B0E14] border border-[#1E2636] text-slate-300 hover:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedWebhook ? 'פקודת בדיקה הועתקה' : 'העתק דוגמת Webhook'}</span>
              </button>
            </div>
          </section>

          {/* 4. Real-Time Event & Cooldown Arbitrator Log */}
          <section className="bg-[#121722] border border-[#1E2636] rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">יומן אירועים ובורר קדימויות חי</h3>
              <span className="text-xs text-slate-400">מציג סינון Cooldown וניתוב שכבות בזמן אמת</span>
            </div>

            {battleState.recentLogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                עדיין לא התקבלו אירועים חדשים — לחץ על אחד מכפתורי האירועים למעלה או הפעל בדיקת עומס קהל.
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto divide-y divide-[#1E2636]">
                {battleState.recentLogs.slice(0, 10).map((log) => (
                  <div key={log.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono tabular-nums text-slate-400 shrink-0">
                        {String(Math.floor(log.battleTimeSec / 60)).padStart(2, '0')}:
                        {String(Math.floor(log.battleTimeSec % 60)).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="text-slate-200 truncate">{log.detailHe}</span>
                    </div>
                    <span
                      className={`text-[11px] font-mono shrink-0 ${
                        log.status === 'TRIGGERED'
                          ? 'text-emerald-400'
                          : log.status === 'ACCUMULATED'
                            ? 'text-amber-300'
                            : 'text-slate-500'
                      }`}
                    >
                      {log.status === 'TRIGGERED' ? 'הופעל' : log.status === 'ACCUMULATED' ? 'נצבר' : 'סונן ב-Cooldown'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
