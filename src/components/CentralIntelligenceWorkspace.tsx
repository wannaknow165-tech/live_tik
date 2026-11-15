import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Check,
  CheckCircle2,
  Database,
  Lightbulb,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import { BattleState } from '../data/boosteraCatalog';
import {
  AiOrchestratorConfig,
  BoosteraIntelligenceDashboardState,
  CrossCorrelationDomain,
  DecisionTierLevel,
  KnowledgeRecordLayer,
  SemanticSearchHit,
} from '../types/boosteraIntelligence';
import { LiveMultimodalObserverPanel } from './LiveMultimodalObserverPanel';
import { AiCrewControlCenterPanel } from './AiCrewControlCenterPanel';

interface CentralIntelligenceWorkspaceProps {
  battleState: BattleState;
  refreshBattleState: () => Promise<void>;
}

type SubViewFilter =
  | 'UNIFIED_ALL'
  | 'LIVE_OBSERVATION'
  | 'MULTIMODAL_OBSERVER'
  | 'CROSS_LIVE_GRAPH'
  | 'AI_WAR_ROOM'
  | 'AI_CREW_CENTER'
  | 'KNOWLEDGE_IDEAS_TESTS';

const CORRELATION_DOMAIN_LABELS: Record<CrossCorrelationDomain | 'ALL', string> = {
  ALL: 'כל 12 הצלבות הקשרים',
  AI_MOD_VS_VIEWERS: '1. מנחה AI מול הצופים',
  AI_MOD_VS_CREATOR: '2. מנחה AI מול היוצר',
  AI_MOD_VS_HUMAN_MOD: '3. מנחה AI מול מנהל אנושי',
  CREATOR_VS_VIEWERS: '4. היוצר מול הצופים',
  CREATOR_VS_OPPONENT: '5. היוצר מול היריב',
  CREATOR_VS_CO_CREATORS: '6. היוצר מול יוצרים נוספים',
  OPPONENT_VS_VIEWERS: '7. היריב מול הצופים',
  CHAT_VS_BATTLE_EVENTS: '8. צ׳אט מול אירועי קרב',
  CHAT_VS_MUSIC: '9. צ׳אט מול מוזיקה',
  CHAT_VS_VFX: '10. צ׳אט מול אפקטים',
  MODS_VS_STREAM_EVENTS: '11. מנחים מול אירועי שידור',
  UNIFIED_ALL_CONVERSATIONS: '12. כל השיחות יחד',
};

export const CentralIntelligenceWorkspace: React.FC<CentralIntelligenceWorkspaceProps> = ({
  battleState,
  refreshBattleState,
}) => {
  const [dashboard, setDashboard] = useState<BoosteraIntelligenceDashboardState | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [subView, setSubView] = useState<SubViewFilter>('UNIFIED_ALL');
  const [bannerHe, setBannerHe] = useState<string | null>(null);

  // Connect live TikTok room input (reuses existing Swarm API)
  const [newCreatorHandle, setNewCreatorHandle] = useState('');
  const [connectingRoom, setConnectingRoom] = useState(false);

  // Replay controls
  const [replayTitleInput, setReplayTitleInput] = useState('');
  const [savingReplay, setSavingReplay] = useState(false);

  // Cross-correlation filter
  const [domainFilter, setDomainFilter] = useState<CrossCorrelationDomain | 'ALL'>('ALL');

  // Brain War Room controls & editable OpenRouter configuration draft
  const [selectedStreamId, setSelectedStreamId] = useState<string>('');
  const [runningBrainTier, setRunningBrainTier] = useState<DecisionTierLevel | null>(null);
  const [testingModels, setTestingModels] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [resettingDefaults, setResettingDefaults] = useState(false);
  const [allowLocalCrewPreview, setAllowLocalCrewPreview] = useState(false);
  const [configDraft, setConfigDraft] = useState<AiOrchestratorConfig | null>(null);
  const [configDirty, setConfigDirty] = useState(false);

  // Knowledge Engine Semantic Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLayerFilter, setSearchLayerFilter] = useState<KnowledgeRecordLayer | ''>('');
  const [searchHits, setSearchHits] = useState<SemanticSearchHit[]>([]);
  const [searchEmbeddingSource, setSearchEmbeddingSource] = useState<string | null>(null);
  const [searchingKnowledge, setSearchingKnowledge] = useState(false);

  // Phase 5 14-Scenario Test Suite Runner
  const [runningTests, setRunningTests] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const resp = await fetch('/api/intelligence/dashboard');
      const data = await resp.json();
      if (data.ok && data.dashboard) {
        setDashboard(data.dashboard);
      }
    } catch {
      // Ignore transient poll errors
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
    const poll = window.setInterval(() => {
      void fetchDashboard();
    }, 4000);

    // Also subscribe to real-time WebSocket intelligence:update frames
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === 'intelligence:update' && msg.dashboard) {
            setDashboard(msg.dashboard);
          }
        } catch {
          // Ignore malformed WS message
        }
      };
    } catch {
      ws = null;
    }

    return () => {
      window.clearInterval(poll);
      if (ws) ws.close();
    };
  }, [fetchDashboard]);

  // Keep editable config draft synced with server config whenever user doesn't have unsaved edits
  useEffect(() => {
    if (dashboard?.orchestratorConfig && !configDirty) {
      setConfigDraft(dashboard.orchestratorConfig);
    }
  }, [dashboard?.orchestratorConfig, configDirty]);

  const handleConnectLiveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const handle = newCreatorHandle.trim().replace(/^@+/, '');
    if (!handle) return;
    setConnectingRoom(true);
    try {
      const resp = await fetch('/api/tiktok/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: handle,
          listenMode: 'OBSERVER_LEARN',
          mirrorToStage: false,
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        setBannerHe(`חדר הלייב @${handle} חובר למפעל המידע (Data Factory) ולמנוע ה-Swarm.`);
        setNewCreatorHandle('');
      } else {
        setBannerHe(data.error || data.errorHe || `לא ניתן להתחבר כרגע ל-@${handle} (ייתכן שאינו בשידור חי).`);
      }
      await refreshBattleState();
      await fetchDashboard();
    } finally {
      setConnectingRoom(false);
    }
  };

  const handleSaveReplay = async () => {
    setSavingReplay(true);
    try {
      const resp = await fetch('/api/intelligence/replay/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleHe: replayTitleInput.trim() || undefined,
          streamId: selectedStreamId || undefined,
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        setBannerHe(`נשמר סשן Replay (${data.eventsCount} אירועים מתועדים) לשחזור ובדיקה.`);
        setReplayTitleInput('');
        if (data.dashboard) setDashboard(data.dashboard);
      }
    } finally {
      setSavingReplay(false);
    }
  };

  const handleStartReplay = async (replayId: string) => {
    const resp = await fetch('/api/intelligence/replay/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replayId }),
    });
    const data = await resp.json();
    if (data.ok) {
      setBannerHe('ניגון Replay הופעל — האירועים מוזרמים כעת דרך ה-Data Factory והגרף.');
      if (data.dashboard) setDashboard(data.dashboard);
    } else {
      setBannerHe(data.errorHe || 'לא ניתן להפעיל Replay זה (ייתכן שאין בו אירועים מוקלטים).');
    }
  };

  const handleRunBrainAnalysis = async (tier: DecisionTierLevel, frameDataUrl?: string) => {
    setRunningBrainTier(tier);
    try {
      const resp = await fetch('/api/intelligence/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          targetStreamId: selectedStreamId || undefined,
          frameDataUrl: frameDataUrl || undefined,
        }),
      });
      const data = await resp.json();
      if (data.ok && data.decision) {
        setBannerHe(`ניתוח המוח הושלם (${tier}) — החלטה סופית: ${data.decision.final_decision}`);
        if (data.dashboard) setDashboard(data.dashboard);
      } else {
        setBannerHe(data.error || 'לא נמצא אירוע מהיר המצדיק התערבות ברמה 1.');
      }
    } finally {
      setRunningBrainTier(null);
    }
  };

  const handleResolveDecision = async (decisionId: string, approve: boolean) => {
    const resp = await fetch('/api/intelligence/decision/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decisionId,
        approve,
        allowPreviewOverride: allowLocalCrewPreview,
      }),
    });
    const data = await resp.json();
    if (data.ok) {
      setBannerHe(data.execution?.statusHe || (approve ? 'ההחלטה אושרה ובוצעה.' : 'ההחלטה נדחתה.'));
      if (data.dashboard) setDashboard(data.dashboard);
      await refreshBattleState();
    }
  };

  const handleTestModelsLatency = async () => {
    setTestingModels(true);
    try {
      const resp = await fetch('/api/intelligence/test-models', { method: 'POST' });
      const data = await resp.json();
      if (data.ok && data.dashboard) {
        setDashboard(data.dashboard);
        setBannerHe(
          data.openRouterStatus?.statusSummaryHe ||
            'בדיקת זמינות קטלוג OpenRouter וחיבור ששת המודלים הושלמה.'
        );
      }
    } finally {
      setTestingModels(false);
    }
  };

  const handleUpdateOrchestratorConfig = async (patch: Partial<AiOrchestratorConfig>) => {
    setSavingConfig(true);
    try {
      const resp = await fetch('/api/intelligence/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await resp.json();
      if (data.ok && data.dashboard) {
        setDashboard(data.dashboard);
        setConfigDraft(data.dashboard.orchestratorConfig);
        setConfigDirty(false);
        setBannerHe('הגדרות המודלים והתקציב נשמרו ואומתו מול קטלוג OpenRouter.');
      }
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveDraftConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configDraft) return;
    await handleUpdateOrchestratorConfig(configDraft);
  };

  const handleResetToAutoDefaults = async () => {
    setResettingDefaults(true);
    try {
      const resp = await fetch('/api/intelligence/config/reset-defaults', { method: 'POST' });
      const data = await resp.json();
      if (data.ok && data.dashboard) {
        setDashboard(data.dashboard);
        setConfigDraft(data.dashboard.orchestratorConfig);
        setConfigDirty(false);
        setBannerHe('שוחזרו ברירות המחדל האוטומטיות המומלצות של OpenRouter לכל 6 המודלים ולתקציב.');
      }
    } finally {
      setResettingDefaults(false);
    }
  };

  const updateDraftField = <K extends keyof AiOrchestratorConfig>(
    key: K,
    value: AiOrchestratorConfig[K]
  ) => {
    setConfigDraft((prev) => {
      const base = prev || dashboard?.orchestratorConfig;
      if (!base) return prev;
      return { ...base, [key]: value };
    });
    setConfigDirty(true);
  };

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchingKnowledge(true);
    try {
      const resp = await fetch('/api/intelligence/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          layerFilter: searchLayerFilter || undefined,
        }),
      });
      const data = await resp.json();
      if (data.ok) {
        setSearchHits(data.hits || []);
        setSearchEmbeddingSource(data.embeddingSource || null);
      }
    } finally {
      setSearchingKnowledge(false);
    }
  };

  const handlePurgeKnowledge = async (streamOnly?: string) => {
    const resp = await fetch('/api/intelligence/knowledge/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purgeNow: true,
        streamId: streamOnly,
      }),
    });
    const data = await resp.json();
    if (data.ok) {
      setBannerHe(`נמחקו ${data.purgedCount} רשומות ממנוע הידע בהתאם למדיניות הפרטיות.`);
      if (data.dashboard) setDashboard(data.dashboard);
      setSearchHits([]);
    }
  };

  const handleUpdateIdeaStatus = async (ideaId: string, status: 'APPROVED_FOR_DEV' | 'ARCHIVED') => {
    const resp = await fetch('/api/intelligence/ideas/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ideaId, status }),
    });
    const data = await resp.json();
    if (data.ok && data.dashboard) {
      setDashboard(data.dashboard);
    }
  };

  const handleRunPhase5Tests = async () => {
    setRunningTests(true);
    try {
      const resp = await fetch('/api/intelligence/tests/run', { method: 'POST' });
      const data = await resp.json();
      if (data.ok && data.report) {
        setBannerHe(
          `סוויטת 14 בדיקות המערכת הושלמה: ${data.report.passedCount}/${data.report.totalScenarios} תרחישים עברו בהצלחה.`
        );
        if (data.dashboard) setDashboard(data.dashboard);
      }
    } finally {
      setRunningTests(false);
    }
  };

  if (loadingInitial && !dashboard) {
    return (
      <div className="border border-[#1E2636] bg-[#0F1520] rounded-xl p-10 text-center space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
        <p className="text-sm text-slate-300">טוען את מערך המודיעין המרכזי, מפעל המידע וצוות מנחי ה-AI...</p>
      </div>
    );
  }

  if (!dashboard) return null;

  const {
    sixLayersStatus,
    dataFactory,
    crossLive,
    multimodal,
    crewControl,
    orchestratorConfig,
    openRouterStatus,
    modelHealth,
    costLedger,
    recentDecisions,
    ideasLab,
    knowledge,
    lastTestReport,
  } = dashboard;

  const activeDraft = configDraft || orchestratorConfig;

  const activeCreator =
    dataFactory.streams.find((s) => s.streamId === selectedStreamId)?.creatorUsername ||
    dataFactory.streams[0]?.creatorUsername ||
    battleState.tiktokRoom.targetUsername ||
    'studio_live';

  const activeStreamKey = selectedStreamId || dataFactory.streams[0]?.streamId || 'live_studio';

  const filteredFindings =
    domainFilter === 'ALL'
      ? crossLive.findings
      : crossLive.findings.filter((f) => f.domain === domainFilter);

  const latestDecision = recentDecisions[0] || null;

  return (
    <div className="space-y-6">
      {/* Top Executive Header & Primary Intelligence Controls */}
      <section className="border border-[#1E2636] bg-[#0F1520] rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
              Central Intelligence & AI Chat Crew
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              מערכת 6 השכבות לאיסוף רב-ערוצי מ-10+ לייבים, הצלבת 12 יחסי שיחה ואירועים, תצפית וידאו/שמע מורשית, מוח הכרעה כפול (OpenAI + Claude דרך OpenRouter) וצוות 4 מנחי AI שקופים.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedStreamId}
              onChange={(e) => setSelectedStreamId(e.target.value)}
              className="bg-[#121926] border border-[#2A3954] rounded-lg px-3 py-2 text-xs text-slate-100"
            >
              <option value="">לייב יעד לניתוח (אוטומטי / פעיל ראשון)</option>
              {dataFactory.streams.map((s) => (
                <option key={s.streamId} value={s.streamId}>
                  @{s.creatorUsername} ({s.connected ? 'מחובר' : 'היסטוריה'})
                </option>
              ))}
            </select>

            <button
              onClick={() => void handleRunBrainAnalysis('STRATEGIC_ANALYSIS')}
              disabled={runningBrainTier !== null}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {runningBrainTier === 'STRATEGIC_ANALYSIS' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Activity className="w-3.5 h-3.5" />
              )}
              הפעל ניתוח מוח (OpenAI + Claude)
            </button>

            <button
              onClick={() => void handleRunBrainAnalysis('DEEP_INTELLIGENCE')}
              disabled={runningBrainTier !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#182234] text-slate-100 hover:bg-[#223049] border border-[#2A3954] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              ניתוח עומק רב-לייבים
            </button>

            <button
              onClick={handleRunPhase5Tests}
              disabled={runningTests}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#182234] text-emerald-300 hover:bg-[#223049] border border-[#2A3954] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {runningTests ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {runningTests ? 'מריץ 14 בדיקות...' : 'הרץ 14 בדיקות מערכת'}
            </button>
          </div>
        </div>

        {/* 6-Layer Architecture Live Health Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-4 border-t border-[#1E2636]">
          {sixLayersStatus.map((layer) => (
            <div key={layer.layerId} className="bg-[#0B0E14] border border-[#1E2636] rounded-lg p-3 space-y-1">
              <div className="text-xs font-semibold text-slate-200">{layer.titleHe}</div>
              <div className={`text-xs ${layer.healthy ? 'text-emerald-300' : 'text-amber-300'}`}>
                {layer.statusHe}
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">{layer.keyMetricHe}</div>
            </div>
          ))}
        </div>

        {/* Clean Functional Sub-Navigation Segmented Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1E2636]">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B0E14] border border-[#1E2636] rounded-lg">
            {(
              [
                { id: 'UNIFIED_ALL', label: 'תצוגה משולבת מלאה' },
                { id: 'LIVE_OBSERVATION', label: 'תצפית לייבים ו-Replay' },
                { id: 'MULTIMODAL_OBSERVER', label: 'מולטימודל (וידאו/שמע/STT)' },
                { id: 'CROSS_LIVE_GRAPH', label: '12 הצלבות וגרף שיחות' },
                { id: 'AI_WAR_ROOM', label: 'חדר מלחמה AI (OpenRouter)' },
                { id: 'AI_CREW_CENTER', label: 'מרכז בקרת 4 מנחי AI' },
                { id: 'KNOWLEDGE_IDEAS_TESTS', label: 'מנוע ידע, רעיונות ובדיקות' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSubView(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  subView === tab.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => void fetchDashboard()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            רענן נתונים
          </button>
        </div>

        {bannerHe && (
          <div className="text-xs text-amber-200 bg-[#151D2C] border border-[#26334D] rounded-lg px-4 py-2.5 flex items-center justify-between gap-3">
            <span>{bannerHe}</span>
            <button onClick={() => setBannerHe(null)} className="text-slate-400 hover:text-slate-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* =====================================================================
          1. LIVE OBSERVATION — DATA FACTORY (10+ CONCURRENT STREAMS & REPLAY)
         ===================================================================== */}
      {(subView === 'UNIFIED_ALL' || subView === 'LIVE_OBSERVATION') && (
        <section className="border border-[#1E2636] bg-[#0F1520] rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1E2636] pb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Live Observation — מפעל המידע (תמיכה ב-12 לייבים במקביל, מניעת כפילויות ו-Replay)
              </h2>
              <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                לייבים פעילים: {dataFactory.activeStreamsCount}/{dataFactory.maxConcurrentStreams}
                <span aria-hidden="true"> · </span>
                אירועים מתועדים: {dataFactory.totalEventsCaptured}
                <span aria-hidden="true"> · </span>
                כפילויות שסוננו: {dataFactory.deduplicatedDropsCount}
                <span aria-hidden="true"> · </span>
                הזרקות פרומפט שנחסמו: {dataFactory.promptInjectionsBlockedCount}
              </div>
            </div>

            <form onSubmit={handleConnectLiveRoom} className="flex items-center gap-2">
              <input
                type="text"
                value={newCreatorHandle}
                onChange={(e) => setNewCreatorHandle(e.target.value)}
                placeholder="הוסף @שם_יוצר בלייב לאיסוף..."
                className="bg-[#121926] border border-[#2A3954] rounded-lg px-3 py-2 text-xs text-slate-100 w-52"
              />
              <button
                type="submit"
                disabled={connectingRoom}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#182234] text-slate-100 hover:bg-[#223049] border border-[#2A3954] transition-colors whitespace-nowrap shrink-0"
              >
                {connectingRoom ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                חבר לייב ל-Data Factory
              </button>
            </form>
          </div>

          {/* Multi-Stream Table */}
          {dataFactory.streams.length === 0 ? (
            <div className="text-xs text-slate-400 py-6 text-center border border-[#1E2636] rounded-lg bg-[#0B0E14]">
              טרם חוברו לייבים פעילים בסשן הנוכחי. חבר יוצר מטיקטוק למעלה או הפעל את 14 בדיקות המערכת להדגמה מלאה.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#1E2636] rounded-lg bg-[#0B0E14]">
              <table className="w-full text-right text-xs">
                <thead className="border-b border-[#1E2636] text-slate-400 bg-[#111724]">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">יוצר / מזהה לייב</th>
                    <th className="py-2.5 px-3 font-medium">מקור ואמינות</th>
                    <th className="py-2.5 px-3 font-medium">צופים</th>
                    <th className="py-2.5 px-3 font-medium">צ׳אט אנושי (הודעות/דקה)</th>
                    <th className="py-2.5 px-3 font-medium">הודעות AI (מופרדות)</th>
                    <th className="py-2.5 px-3 font-medium">שאלות חוזרות פתוחות</th>
                    <th className="py-2.5 px-3 font-medium">לייקים/שנ׳ ומתנות</th>
                    <th className="py-2.5 px-3 font-medium">באטל וניקוד מאומת</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2636] font-mono tabular-nums">
                  {dataFactory.streams.map((st) => (
                    <tr key={st.streamId} className="hover:bg-[#141C2B] transition-colors">
                      <td className="py-2.5 px-3 font-sans">
                        <div className="font-semibold text-slate-100">@{st.creatorUsername}</div>
                        <div className="text-slate-500">
                          {st.connected ? 'מחובר חי' : 'הסתיים'} · {st.participants.length} משתתפים מזוהים
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">{st.source}</td>
                      <td className="py-2.5 px-3 text-slate-200">
                        {st.viewerCount !== null
                          ? `${st.viewerCount.toLocaleString()}${st.viewerCountVerified ? ' (מאומת)' : ''}`
                          : 'לא זמין'}
                      </td>
                      <td className="py-2.5 px-3 text-emerald-300">
                        {st.chatMetrics.humanViewerMessagesCount} ({st.chatMetrics.humanMessagesPerMin}/דקה)
                      </td>
                      <td className="py-2.5 px-3 text-cyan-300">{st.chatMetrics.aiAgentMessagesCount}</td>
                      <td className="py-2.5 px-3 text-amber-300">{st.chatMetrics.repeatedUnansweredCount}</td>
                      <td className="py-2.5 px-3 text-slate-200">
                        {st.engagementMetrics.likesPerSec}/s · {st.engagementMetrics.totalDiamonds} יהלומים
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 font-sans">
                        {st.battleMetrics.inBattle ? (
                          <span className="font-mono tabular-nums">
                            מול @{st.battleMetrics.opponentUsername || 'יריב'} ·{' '}
                            {st.battleMetrics.verifiedHostScore !== null
                              ? `${st.battleMetrics.verifiedHostScore}:${st.battleMetrics.verifiedOpponentScore}`
                              : 'ללא ניקוד מאומת'}
                          </span>
                        ) : (
                          <span className="text-slate-500">ללא באטל פעיל</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Unanswered Repeated Questions + Replay Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="border border-[#1E2636] rounded-lg p-4 bg-[#0B0E14] space-y-2">
              <h3 className="text-sm font-semibold text-slate-100">
                אשכולות שאלות חוזרות מצופים אנושיים ללא מענה
              </h3>
              {dataFactory.repeatedQuestions.length === 0 ? (
                <p className="text-xs text-slate-500">אין כרגע שאלות חוזרות פתוחות בצ׳אטים המנוטרים.</p>
              ) : (
                <div className="divide-y divide-[#1E2636] text-xs">
                  {dataFactory.repeatedQuestions.slice(0, 6).map((q) => (
                    <div key={q.clusterId} className="py-2 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-slate-100 font-medium">"{q.sampleRawQuestion}"</span>
                        <div className="text-slate-400">
                          {q.streamId} · נשאלה ע״י {q.distinctAskHandles.length} צופים אנושיים ·{' '}
                          {q.answeredByHostOrMod ? 'נענתה' : 'ממתינה להתייחסות'}
                        </div>
                      </div>
                      <span className="font-mono tabular-nums text-amber-300 shrink-0">
                        x{q.occurrencesCount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-[#1E2636] rounded-lg p-4 bg-[#0B0E14] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">
                  מערכת Replay — שמירה ושחזור של סשנים מוקלטים לבדיקה ואימון
                </h3>
                {dataFactory.activeReplayStatus.running && (
                  <span className="text-xs text-emerald-300 font-mono tabular-nums">
                    מנגן Replay ({dataFactory.activeReplayStatus.progressPct}%)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={replayTitleInput}
                  onChange={(e) => setReplayTitleInput(e.target.value)}
                  placeholder="שם להקלטת האירועים הנוכחית..."
                  className="flex-1 bg-[#121926] border border-[#2A3954] rounded-md px-3 py-1.5 text-xs text-slate-100"
                />
                <button
                  onClick={handleSaveReplay}
                  disabled={savingReplay}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#182234] text-slate-100 hover:bg-[#223049] border border-[#2A3954] whitespace-nowrap shrink-0"
                >
                  <Save className="w-3.5 h-3.5 text-amber-400" />
                  שמור Replay
                </button>
              </div>

              <div className="divide-y divide-[#1E2636] max-h-32 overflow-y-auto text-xs">
                {dataFactory.availableReplays.length === 0 ? (
                  <p className="text-slate-500 py-2">טרם נשמרו הקלטות Replay.</p>
                ) : (
                  dataFactory.availableReplays.map((rep) => (
                    <div key={rep.replayId} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-slate-200">{rep.titleHe}</span>
                        <span className="text-slate-500 font-mono tabular-nums"> · {rep.eventsCount} אירועים</span>
                      </div>
                      <button
                        onClick={() => void handleStartReplay(rep.replayId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#182234] text-cyan-300 hover:bg-[#223049] whitespace-nowrap shrink-0"
                      >
                        <Play className="w-3 h-3" />
                        נגן
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          2. LIVE MULTIMODAL OBSERVER (VIDEO / AUDIO FFT / STT / AFFECT)
         ===================================================================== */}
      {(subView === 'UNIFIED_ALL' || subView === 'MULTIMODAL_OBSERVER') && (
        <LiveMultimodalObserverPanel
          multimodal={multimodal}
          activeStreamId={activeStreamKey}
          creatorUsername={activeCreator}
          activeVfxCount={battleState.activeEffects.length}
          onDashboardUpdated={fetchDashboard}
          onAnalyzeCurrentFrameInBrain={async (frameUrl) => {
            await handleRunBrainAnalysis('STRATEGIC_ANALYSIS', frameUrl);
          }}
        />
      )}

      {/* =====================================================================
          3. CROSS-LIVE INTELLIGENCE & INTERACTION GRAPH (ALL 12 DOMAINS)
         ===================================================================== */}
      {(subView === 'UNIFIED_ALL' || subView === 'CROSS_LIVE_GRAPH') && (
        <section className="border border-[#1E2636] bg-[#0F1520] rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1E2636] pb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                Cross-Live Intelligence & Interaction Graph — הצלבת כל 12 הקשרים החיים
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                כל קשר מתעד מזהי ראיות, מרווח זמן במילישניות ורמת ביטחון. כאשר אין הוכחה סיבתית ישירה או ייחוס דובר ודאי — הקשר מסומן במפורש כהשערה.
              </p>
            </div>

            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value as CrossCorrelationDomain | 'ALL')}
              className="bg-[#121926] border border-[#2A3954] rounded-lg px-3 py-2 text-xs text-slate-100"
            >
              {(Object.keys(CORRELATION_DOMAIN_LABELS) as Array<CrossCorrelationDomain | 'ALL'>).map((k) => (
                <option key={k} value={k}>
                  {CORRELATION_DOMAIN_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* 12 Cross-Correlation Findings */}
            <div className="lg:col-span-7 border border-[#1E2636] rounded-lg p-4 bg-[#0B0E14] space-y-2">
              <h3 className="text-sm font-semibold text-slate-100">ממצאי הצלבה חיים ({filteredFindings.length})</h3>
              <div className="divide-y divide-[#1E2636] max-h-80 overflow-y-auto text-xs">
                {filteredFindings.length === 0 ? (
                  <p className="text-slate-500 py-4">
                    אין עדיין מספיק אירועים מוצלבים בקטגוריה זו — חבר לייב או הרץ בדיקת מערכת.
                  </p>
                ) : (
                  filteredFindings.map((f) => (
                    <div key={f.findingId} className="py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-100">{f.headlineHe}</span>
                        <span className="font-mono tabular-nums text-slate-400 shrink-0">
                          {f.isHypothesis ? 'השערה מתאמית' : 'עובדה מאומתת'} · ביטחון{' '}
                          {Math.round(f.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-slate-300">{f.explanationHe}</p>
                      <div className="text-slate-500 font-mono tabular-nums">
                        מדד: {f.measuredDeltaSummaryHe} · ראיות: {f.evidenceEventIds.slice(0, 4).join(', ')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Time-Synchronized Interaction Chains & Graph Edges */}
            <div className="lg:col-span-5 border border-[#1E2636] rounded-lg p-4 bg-[#0B0E14] space-y-3">
              <h3 className="text-sm font-semibold text-slate-100">
                שרשראות שיחה ותגובה מסונכרנות בזמן ({crossLive.causalChains.length})
              </h3>
              <div className="divide-y divide-[#1E2636] max-h-80 overflow-y-auto text-xs">
                {crossLive.causalChains.length === 0 ? (
                  <p className="text-slate-500 py-4">
                    שרשראות (יוצר ← מנחה ← צופה אנושי ← לייקים) ייבנו אוטומטית עם זרימת אירועים.
                  </p>
                ) : (
                  crossLive.causalChains.map((ch) => (
                    <div key={ch.chainId} className="py-3 space-y-1.5">
                      <div className="flex items-center justify-between text-slate-400 font-mono tabular-nums">
                        <span>{ch.streamId}</span>
                        <span>
                          {(ch.totalSpanMs / 1000).toFixed(1)}s · {ch.isHypothesis ? 'השערת רצף' : 'מאומת'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {ch.steps.map((st) => (
                          <div key={st.eventId} className="text-slate-200">
                            <span className="font-mono tabular-nums text-amber-300">
                              +{(st.offsetMs / 1000).toFixed(1)}s
                            </span>{' '}
                            <span className="font-medium">{st.actorLabel}:</span>{' '}
                            <span className="text-slate-300">{st.actionHe}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          4. AI WAR ROOM — SINGLE-KEY OPENROUTER AUTO-CONFIG, VERIFICATION & ARBITER
         ===================================================================== */}
      {(subView === 'UNIFIED_ALL' || subView === 'AI_WAR_ROOM') && (
        <section className="border border-[#1E2636] bg-[#0F1520] rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1E2636] pb-4">
            <div className="max-w-3xl">
              <h2 className="text-lg font-semibold text-slate-100">
                AI War Room — תצורת מפתח יחיד (OPENROUTER_API_KEY), אימות 6 מודלים ומנוע הכרעה
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                כל המודלים (OpenAI, Claude, Gemini, מודל מהיר, תמלול שמע ו-Embeddings) ומגבלות התקציב מוגדרים אוטומטית דרך מפתח שרת יחיד וניתנים לשינוי בכל עת מתוך הדשבורד ללא צורך במפתחות נוספים.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                onClick={handleTestModelsLatency}
                disabled={testingModels}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                {testingModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                בדוק זמינות וחיבור OpenRouter (6 מודלים)
              </button>

              <button
                onClick={handleResetToAutoDefaults}
                disabled={resettingDefaults}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#182234] text-slate-200 hover:bg-[#223049] border border-[#2A3954] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resettingDefaults ? 'animate-spin' : ''}`} />
                שחזר ברירות מחדל אוטומטיות
              </button>
            </div>
          </div>

          {/* Single-Key OpenRouter Status Bar */}
          <div className="border border-[#26334D] bg-[#0B0E14] rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-slate-200">
                <span className="font-semibold">מפתח יחיד בשרת (OPENROUTER_API_KEY):</span>
                <span
                  className={
                    orchestratorConfig.openRouterKeyConfiguredOnServer
                      ? openRouterStatus.keyAuthenticated === false
                        ? 'text-rose-400 font-semibold'
                        : 'text-emerald-300 font-semibold'
                      : 'text-amber-300 font-semibold'
                  }
                >
                  {orchestratorConfig.openRouterKeyConfiguredOnServer
                    ? openRouterStatus.keyAuthenticated === false
                      ? 'המפתח ב-Secrets נדחה — בדוק תוקף מפתח'
                      : `מחובר ומאומת${openRouterStatus.keyLabelMasked ? ` (${openRouterStatus.keyLabelMasked})` : ''}`
                    : 'ממתין להזנת OPENROUTER_API_KEY ב-Settings > Secrets בלבד'}
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="font-mono tabular-nums text-slate-300">
                  קטלוג OpenRouter חי: {openRouterStatus.catalogReachable ? 'זמין' : 'בבדיקה'} (
                  {openRouterStatus.catalogTotalChatModels} מודלי שיחה/מולטימודל +{' '}
                  {openRouterStatus.catalogTotalEmbeddingModels} מודלי Embeddings)
                </span>
              </div>
              <div className="text-slate-400">{openRouterStatus.statusSummaryHe}</div>
            </div>

            <div className="font-mono tabular-nums text-right shrink-0">
              <div className="text-slate-400">אימות תצורת מודלים</div>
              <div
                className={`text-sm font-semibold ${
                  openRouterStatus.allConfiguredModelsInCatalog ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {openRouterStatus.verifiedSlotsCount}/{openRouterStatus.totalSlotsCount} מאומתים ב-OpenRouter
              </div>
            </div>
          </div>

          {/* All 6 Auto-Configured OpenRouter Models Verification Grid */}
          {modelHealth.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              {modelHealth.map((mh) => (
                <div key={mh.role} className="border border-[#1E2636] bg-[#0B0E14] rounded-lg p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-100">{mh.roleLabelHe}</span>
                    <span
                      className={`font-mono tabular-nums shrink-0 ${
                        mh.catalogVerified ? 'text-emerald-300' : 'text-rose-400'
                      }`}
                    >
                      {mh.catalogVerified ? 'מאומת בקטלוג' : 'לא נמצא בקטלוג'}
                    </span>
                  </div>
                  <div className="font-mono tabular-nums text-amber-300 truncate">{mh.modelId}</div>
                  <div className="text-slate-500 font-mono tabular-nums truncate">
                    {mh.fallbackModelId ? `גיבוי: ${mh.fallbackModelId}` : 'ללא גיבוי'}
                    {mh.modalitiesSupported && mh.modalitiesSupported.length > 0
                      ? ` · [${mh.modalitiesSupported.join(', ')}]`
                      : ''}
                    {mh.promptPricePer1MUsd !== null && mh.promptPricePer1MUsd !== undefined
                      ? ` · $${mh.promptPricePer1MUsd}/1M`
                      : ''}
                  </div>
                  <div className={mh.reachable ? 'text-emerald-300' : 'text-slate-300'}>
                    {mh.statusHe}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Latest Brain Decision Side-by-Side Comparison */}
          {latestDecision ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {latestDecision.opinions.map((op) => (
                  <div key={op.role} className="border border-[#1E2636] bg-[#0B0E14] rounded-lg p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">
                        {op.role === 'OPENAI_STRATEGIST'
                          ? 'OpenAI — ראש אסטרטגיה'
                          : op.role === 'CLAUDE_CRITIC'
                            ? 'Claude — אנליסט ובקר החלטות'
                            : 'Gemini — בקר מולטימודלי'}
                      </span>
                      <span className="font-mono tabular-nums text-slate-400">
                        {op.latencyMs}ms · ביטחון {Math.round(op.confidence * 100)}%
                      </span>
                    </div>
                    <div className="font-mono tabular-nums text-amber-300">
                      המלצה: {op.recommendedAction}
                      {op.usedFallbackRoute ? ' (מסלול גיבוי)' : ''}
                    </div>
                    <p className="text-slate-200">{op.reasoningHe}</p>
                    {op.alternativeInterpretationHe && (
                      <div className="text-slate-400">פרשנות חלופית: {op.alternativeInterpretationHe}</div>
                    )}
                    {op.riskWarningHe && (
                      <div className="text-rose-300">אזהרת סיכון: {op.riskWarningHe}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Arbiter Final Verdict Box */}
              <div className="border border-[#26334D] bg-[#0B0E14] rounded-lg p-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-semibold text-slate-100">
                      הכרעת הבורר המרכזי: {latestDecision.final_decision}
                    </span>
                    <span className="text-slate-400 font-mono tabular-nums">
                      {' '}
                      · יעד @{latestDecision.target_live} · הסכמת מודלים:{' '}
                      {latestDecision.models_agree ? 'מלאה' : 'מחלוקת זוהתה'} · ביטחון{' '}
                      {Math.round(latestDecision.confidence * 100)}%
                    </span>
                  </div>

                  {latestDecision.approval_status === 'PENDING_HUMAN' && (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowLocalCrewPreview}
                          onChange={(e) => setAllowLocalCrewPreview(e.target.checked)}
                        />
                        <span>אפשר הדגמה מקומית למנחה</span>
                      </label>
                      <button
                        onClick={() => void handleResolveDecision(latestDecision.decision_id, true)}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        אשר ובצע במנוע BOOSTERA
                      </button>
                      <button
                        onClick={() => void handleResolveDecision(latestDecision.decision_id, false)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#182234] text-slate-200 hover:bg-[#223049] transition-colors whitespace-nowrap shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                        דחה
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-slate-200">{latestDecision.reason_he}</p>
                {latestDecision.suggested_chat_text_he && (
                  <div className="text-cyan-300">טקסט מוצע: "{latestDecision.suggested_chat_text_he}"</div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400 font-mono tabular-nums pt-2 border-t border-[#1E2636]">
                  <span>סטטוס ביצוע: {latestDecision.execution_status_he}</span>
                  <span>ראיות: {latestDecision.evidence_event_ids.slice(0, 5).join(', ') || 'ללא'}</span>
                  <span>עלות החלטה: ${latestDecision.total_cost_usd.toFixed(5)}</span>
                </div>
                {latestDecision.measured_outcome_he && (
                  <div className="text-emerald-300 pt-1">{latestDecision.measured_outcome_he}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-[#1E2636] bg-[#0B0E14] rounded-lg p-6 text-center text-xs text-slate-400">
              לחץ על "הפעל ניתוח מוח (OpenAI + Claude)" למעלה כדי להפיק ניתוח עצמאי והכרעה חיה על בסיס הראיות שנאספו.
            </div>
          )}

          {/* Complete Editable OpenRouter Models, STT, Embeddings & Budget Form */}
          <form
            onSubmit={handleSaveDraftConfig}
            className="border border-[#1E2636] bg-[#0B0E14] rounded-lg p-5 space-y-5 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2636] pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    הגדרות מודלי OpenRouter ותקציב (מוגדרות אוטומטית · ניתנות לעריכה מלאה כאן)
                  </h3>
                  <p className="text-slate-400 mt-0.5">
                    בחר מודל מתוך הרשימה המאומתת או הקלד כל מזהה מודל של OpenRouter ולחץ "שמור הגדרות ואמת קטלוג".
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {configDirty && (
                  <span className="text-amber-300">קיימים שינויים שטרם נשמרו</span>
                )}
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                >
                  {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  שמור הגדרות ואמת קטלוג
                </button>
              </div>
            </div>

            {/* Verified OpenRouter Datalists for Seamless Dropdown + Custom Typing */}
            <datalist id="or-openai-models">
              {openRouterStatus.recommendedChoices.openAi.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <datalist id="or-claude-models">
              {openRouterStatus.recommendedChoices.claude.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <datalist id="or-gemini-models">
              {openRouterStatus.recommendedChoices.gemini.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <datalist id="or-fast-models">
              {openRouterStatus.recommendedChoices.fast.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <datalist id="or-stt-models">
              {openRouterStatus.recommendedChoices.stt.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <datalist id="or-emb-models">
              {openRouterStatus.recommendedChoices.embeddings.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>

            {/* Primary & Fallback Models Grid (All 6 Roles) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <label className="space-y-1 block">
                <span className="text-slate-300 font-medium">1. מודל OpenAI ראשי (אסטרטגיה)</span>
                <input
                  type="text"
                  list="or-openai-models"
                  value={activeDraft.openAiModel}
                  onChange={(e) => updateDraftField('openAiModel', e.target.value)}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-400">מודל OpenAI גיבוי אוטומטי</span>
                <input
                  type="text"
                  list="or-openai-models"
                  value={activeDraft.openAiFallbackModel}
                  onChange={(e) => updateDraftField('openAiFallbackModel', e.target.value)}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-300 font-medium">2. מודל Claude ראשי (בקרת איכות)</span>
                <input
                  type="text"
                  list="or-claude-models"
                  value={activeDraft.claudeModel}
                  onChange={(e) => updateDraftField('claudeModel', e.target.value)}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-400">מודל Claude גיבוי אוטומטי</span>
                <input
                  type="text"
                  list="or-claude-models"
                  value={activeDraft.claudeFallbackModel}
                  onChange={(e) => updateDraftField('claudeFallbackModel', e.target.value)}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-300 font-medium">3. מודל Gemini ראשי (מולטימודלי)</span>
                <input
                  type="text"
                  list="or-gemini-models"
                  value={activeDraft.geminiModel}
                  onChange={(e) => updateDraftField('geminiModel', e.target.value)}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-400">מודל Gemini גיבוי</span>
                <input
                  type="text"
                  list="or-gemini-models"
                  value={activeDraft.geminiFallbackModel}
                  onChange={(e) => updateDraftField('geminiFallbackModel', e.target.value)}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-300 font-medium">4. מודל מהיר (Fast Router)</span>
                <input
                  type="text"
                  list="or-fast-models"
                  value={activeDraft.fastRouterModel}
                  onChange={(e) => updateDraftField('fastRouterModel', e.target.value)}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-400">רמת ניתוח ברירת מחדל</span>
                <select
                  value={activeDraft.analysisMode}
                  onChange={(e) => updateDraftField('analysisMode', e.target.value as DecisionTierLevel)}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100"
                >
                  <option value="FAST_REACTION">FAST_REACTION (תגובה מיידית)</option>
                  <option value="STRATEGIC_ANALYSIS">STRATEGIC_ANALYSIS (OpenAI + Claude)</option>
                  <option value="DEEP_INTELLIGENCE">DEEP_INTELLIGENCE (רב-לייבים עמוק)</option>
                </select>
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-300 font-medium">5. מודל תמלול שמע (STT OpenRouter)</span>
                <input
                  type="text"
                  list="or-stt-models"
                  value={activeDraft.sttModel}
                  onChange={(e) => updateDraftField('sttModel', e.target.value)}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-400">מודל תמלול שמע גיבוי</span>
                <input
                  type="text"
                  list="or-stt-models"
                  value={activeDraft.sttFallbackModel}
                  onChange={(e) => updateDraftField('sttFallbackModel', e.target.value)}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-300 font-medium">6. מודל Embeddings ראשי (וקטורים)</span>
                <input
                  type="text"
                  list="or-emb-models"
                  value={activeDraft.embeddingModel}
                  onChange={(e) => updateDraftField('embeddingModel', e.target.value)}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-400">מודל Embeddings גיבוי</span>
                <input
                  type="text"
                  list="or-emb-models"
                  value={activeDraft.embeddingFallbackModel}
                  onChange={(e) => updateDraftField('embeddingFallbackModel', e.target.value)}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </label>
            </div>

            {/* Budget Caps, Thresholds & Guardrails */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-3 border-t border-[#1E2636]">
              <label className="space-y-1 block">
                <span className="text-slate-300 font-medium">תקציב יומי מקסימלי (USD)</span>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="1000"
                  value={activeDraft.dailyBudgetUsd}
                  onChange={(e) => updateDraftField('dailyBudgetUsd', Number(e.target.value))}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono tabular-nums"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-300 font-medium">תקציב חודשי מקסימלי (USD)</span>
                <input
                  type="number"
                  step="1"
                  min="0.5"
                  max="10000"
                  value={activeDraft.monthlyBudgetUsd}
                  onChange={(e) => updateDraftField('monthlyBudgetUsd', Number(e.target.value))}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono tabular-nums"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-400">עוצמת VFX אוטומטית מקס׳ (0.05–1.0)</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="1.0"
                  value={activeDraft.maxVfxIntensity}
                  onChange={(e) => updateDraftField('maxVfxIntensity', Number(e.target.value))}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono tabular-nums"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-400">סף ביטחון לביצוע אוטומטי (0.5–0.99)</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="0.99"
                  value={activeDraft.minConfidenceForAutoAction}
                  onChange={(e) => updateDraftField('minConfidenceForAutoAction', Number(e.target.value))}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono tabular-nums"
                />
              </label>

              <label className="space-y-1 block">
                <span className="text-slate-400">מרווח ניתוח אסטרטגי (שניות)</span>
                <input
                  type="number"
                  step="5"
                  min="5"
                  max="300"
                  value={activeDraft.strategicIntervalSec}
                  onChange={(e) => updateDraftField('strategicIntervalSec', Number(e.target.value))}
                  className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono tabular-nums"
                />
              </label>
            </div>

            {/* Toggles & Live Cost Ledger Summary */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#1E2636]">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeDraft.openAiEnabled}
                    onChange={(e) => updateDraftField('openAiEnabled', e.target.checked)}
                  />
                  <span>OpenAI פעיל</span>
                </label>

                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeDraft.claudeEnabled}
                    onChange={(e) => updateDraftField('claudeEnabled', e.target.checked)}
                  />
                  <span>Claude פעיל</span>
                </label>

                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeDraft.geminiEnabled}
                    onChange={(e) => updateDraftField('geminiEnabled', e.target.checked)}
                  />
                  <span>Gemini מולטימודלי פעיל</span>
                </label>

                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeDraft.zeroDataRetention}
                    onChange={(e) => updateDraftField('zeroDataRetention', e.target.checked)}
                  />
                  <span>Zero Data Retention (ZDR)</span>
                </label>

                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeDraft.piiSanitizationEnabled}
                    onChange={(e) => updateDraftField('piiSanitizationEnabled', e.target.checked)}
                  />
                  <span>סינון מידע אישי (PII)</span>
                </label>

                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeDraft.requireApprovalForChatAndMod}
                    onChange={(e) => updateDraftField('requireApprovalForChatAndMod', e.target.checked)}
                  />
                  <span>אישור אנושי לצ׳אט/מודרציה</span>
                </label>

                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeDraft.autoExecuteApprovedVfx}
                    onChange={(e) => updateDraftField('autoExecuteApprovedVfx', e.target.checked)}
                  />
                  <span>אישור אוטומטי ל-VFX עדין בהסכמת מודלים</span>
                </label>
              </div>

              <div className="font-mono tabular-nums text-slate-300">
                נוצל היום: <strong className="text-slate-100">${costLedger.spentTodayUsd.toFixed(4)}</strong> / $
                {costLedger.dailyBudgetUsd} · החודש:{' '}
                <strong className="text-slate-100">${costLedger.spentThisMonthUsd.toFixed(4)}</strong> / $
                {costLedger.monthlyBudgetUsd} · קריאות: {costLedger.totalCallsCount} ·{' '}
                <span className={costLedger.budgetExceeded ? 'text-rose-400 font-semibold' : 'text-emerald-300'}>
                  {costLedger.budgetExceeded ? 'תקציב ננעל' : 'תקציב תקין'}
                </span>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* =====================================================================
          5. AI CREW CONTROL CENTER (1..4 TRANSPARENT AI MODERATORS)
         ===================================================================== */}
      {(subView === 'UNIFIED_ALL' || subView === 'AI_CREW_CENTER') && (
        <AiCrewControlCenterPanel
          crewControl={crewControl}
          accountsBridge={dashboard.accountsBridge}
          streams={dataFactory.streams}
          onDashboardUpdated={fetchDashboard}
        />
      )}

      {/* =====================================================================
          6. KNOWLEDGE ENGINE, IDEAS LAB & PHASE 5 14-SCENARIO TEST SUITE
         ===================================================================== */}
      {(subView === 'UNIFIED_ALL' || subView === 'KNOWLEDGE_IDEAS_TESTS') && (
        <section className="border border-[#1E2636] bg-[#0F1520] rounded-xl p-6 space-y-6">
          {/* Knowledge Engine & Semantic Vector Search */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1E2636] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-lg font-semibold text-slate-100">
                    Knowledge Engine — הפרדת עובדות, השערות ומסקנות + חיפוש סמנטי
                  </h2>
                </div>
                <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                  סה״כ רשומות: {knowledge.totalEntries} · עובדות מאומתות: {knowledge.verifiedFactsCount} · השערות:{' '}
                  {knowledge.hypothesesCount} · מסקנות מוח: {knowledge.aiConclusionsCount} · שמירה:{' '}
                  {knowledge.retentionDays} ימים
                </div>
              </div>

              <button
                onClick={() => void handlePurgeKnowledge()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-rose-950/50 text-rose-200 hover:bg-rose-900/60 border border-rose-800/50 transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                מחק היסטוריית ידע (פרטיות)
              </button>
            </div>

            <form onSubmit={handleSemanticSearch} className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש סמנטית בזיכרון השידורים (למשל: שאלות קהל חוזרות, באטל, אפקט)..."
                className="flex-1 min-w-[240px] bg-[#121926] border border-[#2A3954] rounded-lg px-3 py-2 text-slate-100"
              />
              <select
                value={searchLayerFilter}
                onChange={(e) => setSearchLayerFilter(e.target.value as KnowledgeRecordLayer | '')}
                className="bg-[#121926] border border-[#2A3954] rounded-lg px-3 py-2 text-slate-100"
              >
                <option value="">כל שכבות הידע</option>
                <option value="VERIFIED_FACT">עובדות מאומתות בלבד</option>
                <option value="HYPOTHESIS">השערות מתאמיות</option>
                <option value="AI_CONCLUSION">מסקנות מוח AI</option>
              </select>
              <button
                type="submit"
                disabled={searchingKnowledge}
                className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                חפש וקטורית
              </button>
            </form>

            {searchHits.length > 0 && (
              <div className="border border-[#1E2636] bg-[#0B0E14] rounded-lg p-4 divide-y divide-[#1E2636] text-xs">
                {searchEmbeddingSource && (
                  <div className="pb-2 text-slate-400 font-mono tabular-nums">
                    מנוע חיפוש פעיל: {searchEmbeddingSource}
                  </div>
                )}
                {searchHits.map((hit) => (
                  <div key={hit.entryId} className="py-2 flex items-start justify-between gap-4">
                    <div>
                      <span className="text-amber-300 font-mono">{hit.layer}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="text-slate-200">{hit.summaryHe}</span>
                    </div>
                    <span className="font-mono tabular-nums text-cyan-300 shrink-0">
                      דמיון {(hit.similarityScore * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Cross-Stream Empirical Learning & Ideas Lab */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="border border-[#1E2636] bg-[#0B0E14] rounded-lg p-4 space-y-2 text-xs">
                <h3 className="text-sm font-semibold text-slate-100">
                  למידה אמפירית חוצת-לייבים (ללא הסקת סיבתיות אוטומטית)
                </h3>
                {knowledge.crossStreamObservations.length === 0 ? (
                  <p className="text-slate-500 py-2">
                    ניסויי לפני/אחרי של אפקטים ופעולות מנחים יתועדו כאן אוטומטית לאחר ביצוע ומדידת 12–15 שניות.
                  </p>
                ) : (
                  <div className="divide-y divide-[#1E2636]">
                    {knowledge.crossStreamObservations.slice(0, 6).map((obs) => (
                      <div key={obs.patternKey} className="py-2.5 space-y-1">
                        <p className="text-slate-200">{obs.statementHe}</p>
                        <p className="text-slate-500">{obs.causalCautionNoteHe}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-[#1E2636] bg-[#0B0E14] rounded-lg p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-slate-100">
                    Ideas Lab — מעבדת הצעות פיתוח אוטומטיות מבוססות ראיות
                  </h3>
                </div>
                {ideasLab.length === 0 ? (
                  <p className="text-slate-500 py-2">
                    כאשר המוח מזהה הזדמנות לאפקט חדש, חיישן אירועים או כלי אוטומציה — המפרט יופיע כאן עם קישור לראיות.
                  </p>
                ) : (
                  <div className="divide-y divide-[#1E2636] max-h-56 overflow-y-auto">
                    {ideasLab.map((idea) => (
                      <div key={idea.ideaId} className="py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-100">{idea.titleHe}</span>
                          <span className="font-mono tabular-nums text-slate-400">
                            {idea.category} · {idea.priority} · {idea.status}
                          </span>
                        </div>
                        <p className="text-slate-300">{idea.descriptionHe}</p>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => void handleUpdateIdeaStatus(idea.ideaId, 'APPROVED_FOR_DEV')}
                            className="px-2.5 py-1 rounded bg-[#182234] text-emerald-300 hover:bg-[#223049]"
                          >
                            אשר לפיתוח
                          </button>
                          <button
                            onClick={() => void handleUpdateIdeaStatus(idea.ideaId, 'ARCHIVED')}
                            className="px-2.5 py-1 rounded bg-[#182234] text-slate-400 hover:text-slate-200"
                          >
                            העבר לארכיון
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Phase 5 Automated 14-Scenario Test Report */}
          <div className="border-t border-[#1E2636] pt-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-semibold text-slate-100">
                  Phase 5 — דוח 14 בדיקות אוטומטיות, עמידות, הגנות והפרדת AI מצופים אנושיים
                </h3>
              </div>
              <button
                onClick={handleRunPhase5Tests}
                disabled={runningTests}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                {runningTests ? 'מריץ בדיקות...' : 'הרץ עכשיו את כל 14 הבדיקות'}
              </button>
            </div>

            {!lastTestReport ? (
              <p className="text-xs text-slate-400">
                לחץ על "הרץ עכשיו את כל 14 הבדיקות" כדי לאמת בזמן אמת 10 לייבים במקביל, מניעת כפילויות, גרף 4 משתתפים, מחלוקת OpenAI/Claude, נפילות מודלים, אודיו/וידאו חסרים, הזרקת פרומפט ומגבלת תקציב.
              </p>
            ) : (
              <div className="overflow-x-auto border border-[#1E2636] rounded-lg bg-[#0B0E14]">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-[#1E2636] text-slate-400 bg-[#111724]">
                    <tr>
                      <th className="py-2 px-3 font-medium">#</th>
                      <th className="py-2 px-3 font-medium">תרחיש בדיקה</th>
                      <th className="py-2 px-3 font-medium">תוצאה</th>
                      <th className="py-2 px-3 font-medium">התנהגות שאומתה בפועל</th>
                      <th className="py-2 px-3 font-medium">דגימת ראיה</th>
                      <th className="py-2 px-3 font-medium">זמן</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2636]">
                    {lastTestReport.results.map((r) => (
                      <tr key={r.scenarioId} className="hover:bg-[#141C2B]">
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-400">{r.order}</td>
                        <td className="py-2 px-3 font-medium text-slate-100">{r.titleHe}</td>
                        <td
                          className={`py-2 px-3 font-mono font-semibold ${
                            r.passed ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {r.passed ? 'PASS' : 'FAIL'}
                        </td>
                        <td className="py-2 px-3 text-slate-300">{r.verifiedBehaviorHe}</td>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-400">{r.evidenceSample}</td>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-500">{r.durationMs}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
