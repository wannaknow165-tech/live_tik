import React, { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Loader2,
  Play,
  Plus,
  PlugZap,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Unplug,
  Zap,
} from 'lucide-react';
import {
  BattleState,
  BOOSTERA_ASSETS,
  BOOSTERA_MUSIC_TRACKS,
  CameraPresetId,
  DiscoveredWsEventRecord,
  STANDALONE_SOUND_CUES,
  WsCollectedEventCategory,
  WsEventTriggerBinding,
  WsSpecialStageAction,
} from '../data/boosteraCatalog';
import { soundEngine } from '../engine/soundEngine';

interface WsEventSnifferPanelProps {
  battleState: BattleState;
  refreshState: () => Promise<void>;
  compact?: boolean;
}

const CAMERA_OPTIONS: Array<{ value: CameraPresetId | 'NONE'; labelHe: string }> = [
  { value: 'NONE', labelHe: 'ללא תנועת מצלמה' },
  { value: 'ZOOM_PUNCH', labelHe: 'זום-פאנץ׳ אנרגטי (ZOOM_PUNCH)' },
  { value: 'EARTHQUAKE_SHAKE', labelHe: 'רעידת הדף קולנועית (EARTHQUAKE)' },
  { value: 'DUTCH_WHIP', labelHe: 'הטיה מהירה (DUTCH_WHIP)' },
  { value: 'BASS_PUMP', labelHe: 'פעימת באס קצבית (BASS_PUMP)' },
  { value: 'SNIPE_CREEP', labelHe: 'זחילת מתח ממוקדת (SNIPE_CREEP)' },
  { value: 'VACUUM_DROP', labelHe: 'שאיבת וואקום דרמטית (VACUUM_DROP)' },
  { value: 'STEADY_BREATH', labelHe: 'נשימת אולפן עדינה (STEADY)' },
];

const SPECIAL_ACTION_OPTIONS: Array<{ value: WsSpecialStageAction; labelHe: string }> = [
  { value: 'NONE', labelHe: 'ללא פעולה מיוחדת' },
  { value: 'CLOUD_XRAY', labelHe: 'רנטגן אנטי-ענן (חשיפת סקור מחדר היריב)' },
  { value: 'GLOVE_30S', labelHe: 'הפעלת מצב כפפה x5 ל-30 שניות' },
  { value: 'SNIPE_WINDOW', labelHe: 'דריכת חלון סנייפ קריטי' },
  { value: 'AVATAR_SPOTLIGHT', labelHe: 'זרקור אווטאר משתתף לבמה' },
  { value: 'TAP_BOOST_BANNER', labelHe: 'הקפצת באנר עידוד הקשות' },
];

const CATEGORY_TABS: Array<{ id: 'ALL' | 'SEEN_LIVE' | WsCollectedEventCategory; labelHe: string }> = [
  { id: 'ALL', labelHe: 'כל האירועים' },
  { id: 'SEEN_LIVE', labelHe: 'נתפסו חי ב-WS' },
  { id: 'CARDS_BOOSTS', labelHe: 'קלפים, כפפות וענן' },
  { id: 'BATTLE_PK', labelHe: 'קרבות ומשימות' },
  { id: 'GIFTS_DIAMONDS', labelHe: 'מתנות ויהלומים' },
  { id: 'CROWD_SOCIAL', labelHe: 'קהל, מנויים ולייקים' },
  { id: 'RANKS_GOALS', labelHe: 'דירוגים ותיבות' },
  { id: 'EXTERNAL_CUSTOM', labelHe: 'אירועים חדשים / חיצוני' },
];

export const WsEventSnifferPanel: React.FC<WsEventSnifferPanelProps> = ({
  battleState,
  refreshState,
  compact = false,
}) => {
  const sniffer = battleState.wsSniffer;

  const [roomInput, setRoomInput] = useState<string>('');
  const [connectingRoom, setConnectingRoom] = useState<boolean>(false);
  const [scanningAutoLive, setScanningAutoLive] = useState<boolean>(false);

  const [extUrlInput, setExtUrlInput] = useState<string>('ws://localhost:21213/');
  const [connectingExt, setConnectingExt] = useState<boolean>(false);

  const [activeCategory, setActiveCategory] = useState<'ALL' | 'SEEN_LIVE' | WsCollectedEventCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedPayloadKey, setExpandedPayloadKey] = useState<string | null>(null);

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [aiAssigning, setAiAssigning] = useState<boolean>(false);
  const [bannerHe, setBannerHe] = useState<string | null>(null);

  const [showNewCustomForm, setShowNewCustomForm] = useState<boolean>(false);
  const [newEventKey, setNewEventKey] = useState<string>('');
  const [newEventLabelHe, setNewEventLabelHe] = useState<string>('');

  const filteredEvents = useMemo(() => {
    const list = sniffer?.discoveredEvents || [];
    const q = searchQuery.trim().toLowerCase();
    return list.filter((ev) => {
      if (activeCategory === 'SEEN_LIVE' && ev.seenCount <= 0) return false;
      if (activeCategory !== 'ALL' && activeCategory !== 'SEEN_LIVE' && ev.category !== activeCategory) {
        return false;
      }
      if (!q) return true;
      return (
        ev.eventKey.toLowerCase().includes(q) ||
        ev.labelHe.toLowerCase().includes(q) ||
        ev.lastSampleSummaryHe.toLowerCase().includes(q)
      );
    });
  }, [sniffer?.discoveredEvents, activeCategory, searchQuery]);

  const handleUpdateConfig = async (patch: {
    snifferActive?: boolean;
    autoExecuteBoundTriggers?: boolean;
    globalScopeOverride?: 'RESPECT_BINDING' | 'ALL_CONNECTED_SOCKETS' | 'MIRRORED_ONLY';
    resetCounters?: boolean;
  }) => {
    await fetch('/api/ws-sniffer/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await refreshState();
  };

  const handleConnectTikTokRoom = async () => {
    const clean = roomInput.trim().replace(/^@+/, '');
    if (!clean) {
      setBannerHe('הזן שם משתמש בטיקטוק להתחברות WebSocket ישירה או לחץ על סריקה אוטומטית לחדרים חיים.');
      return;
    }
    setConnectingRoom(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/tiktok/connect-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: clean,
          listenMode: 'MY_BROADCAST',
          mirrorToStage: true,
        }),
      });
      const json = await resp.json();
      await refreshState();
      if (json.connected) {
        setRoomInput('');
        setBannerHe(`מחובר חי ב-WebSocket אל @${clean} — מזהה ואוסף את כל האירועים בזמן אמת!`);
      } else {
        setBannerHe(json.errorHe || `@${clean} אינו בלייב כרגע — נוסף למעקב אוטומטי.`);
      }
    } catch {
      setBannerHe('שגיאת תקשורת בחיבור לחדר השידור.');
    } finally {
      setConnectingRoom(false);
    }
  };

  const handleScanAndConnectLiveSockets = async () => {
    setScanningAutoLive(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/tiktok/connect-all-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeGlobalTop: true }),
      });
      const json = await resp.json();
      await refreshState();
      const liveList: string[] = json.currentlyLive || [];
      if (liveList.length > 0) {
        setBannerHe(
          `מחובר עכשיו ב-WebSocket חי ל-${liveList.length} חדרים (${liveList
            .slice(0, 4)
            .map((u) => '@' + u)
            .join(', ')}) — קולט ואוסף אירועים בזמן אמת!`
        );
      } else {
        setBannerHe('בוצעה סריקת חדרים; ברגע שחדר פעיל עולה ללייב קליטת ה-WebSocket תתחיל מיד.');
      }
    } catch {
      setBannerHe('שגיאה בסריקת WebSockets חיים.');
    } finally {
      setScanningAutoLive(false);
    }
  };

  const handleConnectExternalWs = async (presetUrl?: string) => {
    const targetUrl = (presetUrl ?? extUrlInput).trim();
    if (!targetUrl) return;
    setConnectingExt(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/ws-sniffer/connect-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const json = await resp.json();
      await refreshState();
      if (!resp.ok) {
        setBannerHe(json.error || 'כתובת WebSocket לא תקינה.');
      } else {
        setBannerHe(
          json.mode === 'BROWSER_LOCAL'
            ? `נפתח חיבור WebSocket מקומי מהדפדפן אל ${targetUrl} — כל אירוע ייקלט וישובץ אוטומטית!`
            : `נפתח חיבור WebSocket ישיר אל ${targetUrl}!`
        );
      }
    } catch {
      setBannerHe('שגיאה בחיבור לגשר WebSocket חיצוני.');
    } finally {
      setConnectingExt(false);
    }
  };

  const handleDisconnectExternalWs = async (url: string) => {
    await fetch('/api/ws-sniffer/disconnect-external', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    await refreshState();
  };

  const handlePatchBinding = async (eventKey: string, patch: Partial<WsEventTriggerBinding>) => {
    setSavingKey(eventKey);
    try {
      await fetch('/api/ws-sniffer/update-binding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventKey, binding: patch }),
      });
      await refreshState();
    } finally {
      setSavingKey(null);
    }
  };

  const handleTestBinding = async (rec: DiscoveredWsEventRecord) => {
    soundEngine.ensureInitialized();
    setTestingKey(rec.eventKey);
    try {
      const resp = await fetch('/api/ws-sniffer/test-binding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventKey: rec.eventKey }),
      });
      const json = await resp.json();
      await refreshState();
      if (json.summaryHe) {
        setBannerHe(`הופעלה בדיקה חיה על הבמה עבור "${rec.labelHe}": ${json.summaryHe}`);
      } else {
        setBannerHe(`בחר לפחות אפקט, מצלמה, סאונד או פעולה מיוחדת עבור "${rec.labelHe}" ואז לחץ בדוק בבמה.`);
      }
    } finally {
      setTestingKey(null);
    }
  };

  const handleAiAutoAssign = async (singleEventKey?: string) => {
    setAiAssigning(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/ws-sniffer/ai-auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(singleEventKey ? { eventKey: singleEventKey } : {}),
      });
      const json = await resp.json();
      await refreshState();
      if (resp.ok) {
        setBannerHe(`ה-AI ניתח ושיבץ הפעלות במה אוטומטיות ל-${json.updatedCount || 1} אירועי WebSocket!`);
      } else {
        setBannerHe(json.error || 'שגיאה בשיבוץ אוטומטי חכם.');
      }
    } catch {
      setBannerHe('שגיאת תקשורת בשיבוץ AI.');
    } finally {
      setAiAssigning(false);
    }
  };

  const handleCreateCustomEvent = async () => {
    const k = newEventKey.trim();
    if (!k) return;
    await fetch('/api/ws-sniffer/update-binding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventKey: k,
        labelHe: newEventLabelHe.trim() || `אירוע מותאם (${k})`,
        binding: {
          enabled: true,
          vfxId: 'VID_02_CRYO_CO2_CANNONS',
          cameraPreset: 'ZOOM_PUNCH',
          soundCueId: 'SND_HYPE_STADIUM_CHEER',
        },
      }),
    });
    setNewEventKey('');
    setNewEventLabelHe('');
    setShowNewCustomForm(false);
    await refreshState();
    setBannerHe(`נוסף אירוע WebSocket "${k}" עם הפעלה אוטומטית!`);
  };

  const seenEventsCount = (sniffer?.discoveredEvents || []).filter((e) => e.seenCount > 0).length;
  const armedEventsCount = (sniffer?.discoveredEvents || []).filter((e) => e.binding.enabled).length;

  return (
    <div className="rounded-xl border border-cyan-500/35 bg-[#101521] p-4 sm:p-5 space-y-4">
      {/* Header & Live Telemetry */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <PlugZap className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm sm:text-base font-bold text-slate-100">
              קולט אירועי WebSocket חי ושיבוץ הפעלות במה אוטומטיות
            </h3>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                (sniffer?.activeTikTokSocketsCount || 0) > 0 ||
                (sniffer?.externalBridges || []).some((b) => b.connected)
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              }`}
            >
              {(sniffer?.activeTikTokSocketsCount || 0) > 0
                ? `${sniffer.activeTikTokSocketsCount} צינורות WebSocket חיים`
                : 'ממתין לחיבור חדר חי'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            מאזין ישירות לכל פריים ב-WebSocket (טיקטוק לייב + גשרים חיצוניים כמו TikFinity / Streamer.bot), מזהה ואוסף כל סוג אירוע שמופיע בשידור ומאפשר לך לבחור בדיוק איזה אפקט, מצלמה, סאונד ופעולה יופעלו אוטומטית.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleUpdateConfig({ snifferActive: !sniffer?.snifferActive })}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              sniffer?.snifferActive
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-[#0B0E14] border-slate-700 text-slate-400'
            }`}
          >
            {sniffer?.snifferActive ? 'איסוף אירועים: פעיל' : 'איסוף אירועים: מושהה'}
          </button>

          <button
            type="button"
            onClick={() =>
              handleUpdateConfig({ autoExecuteBoundTriggers: !sniffer?.autoExecuteBoundTriggers })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              sniffer?.autoExecuteBoundTriggers
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-[#0B0E14] border-slate-700 text-slate-400'
            }`}
          >
            {sniffer?.autoExecuteBoundTriggers ? 'הפעלות אוטומטיות: חמושות' : 'הפעלות אוטומטיות: כבויות'}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="rounded-lg bg-[#0B0E14] border border-[#1E2636] p-2.5">
          <span className="text-[11px] text-slate-400 block">חבילות WebSocket שנקלטו</span>
          <span className="text-base font-bold font-mono tabular-nums text-cyan-300">
            {(sniffer?.totalPacketsCaptured || 0).toLocaleString()}
          </span>
        </div>
        <div className="rounded-lg bg-[#0B0E14] border border-[#1E2636] p-2.5">
          <span className="text-[11px] text-slate-400 block">סוגי אירועים במאגר</span>
          <span className="text-base font-bold font-mono tabular-nums text-slate-100">
            {sniffer?.uniqueEventTypesCount || 0}{' '}
            <span className="text-[11px] text-emerald-400 font-normal">({seenEventsCount} נתפסו חי)</span>
          </span>
        </div>
        <div className="rounded-lg bg-[#0B0E14] border border-[#1E2636] p-2.5">
          <span className="text-[11px] text-slate-400 block">הפעלות אוטומטיות משובצות</span>
          <span className="text-base font-bold font-mono tabular-nums text-amber-300">
            {armedEventsCount} פעילות
          </span>
        </div>
        <div className="rounded-lg bg-[#0B0E14] border border-[#1E2636] p-2.5">
          <span className="text-[11px] text-slate-400 block">טווח הפעלה אוטומטית</span>
          <select
            value={sniffer?.globalScopeOverride || 'ALL_CONNECTED_SOCKETS'}
            onChange={(e) =>
              handleUpdateConfig({
                globalScopeOverride: e.target.value as
                  | 'RESPECT_BINDING'
                  | 'ALL_CONNECTED_SOCKETS'
                  | 'MIRRORED_ONLY',
              })
            }
            className="mt-0.5 w-full bg-transparent text-xs font-semibold text-slate-100 focus:outline-none"
          >
            <option value="ALL_CONNECTED_SOCKETS" className="bg-[#0B0E14]">
              מכל WebSocket מחובר (כולל חדרי בדיקה)
            </option>
            <option value="MIRRORED_ONLY" className="bg-[#0B0E14]">
              רק מהלייב הראשי שלי (Mirrored)
            </option>
            <option value="RESPECT_BINDING" className="bg-[#0B0E14]">
              לפי הגדרה פרטנית בכל אירוע
            </option>
          </select>
        </div>
      </div>

      {/* Connection Bar: TikTok Live WebSocket + External Local/Remote WS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 bg-[#0B0E14] border border-[#1E2636] rounded-xl p-3">
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            1. חיבור WebSocket ישיר לטיקטוק לייב (שלי או סריקת לייבים פעילים)
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="@username (חדר טיקטוק חי)..."
              className="flex-1 min-w-[150px] bg-[#121722] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              disabled={connectingRoom}
              onClick={handleConnectTikTokRoom}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors"
            >
              {connectingRoom ? 'מתחבר...' : 'התחבר לחדר'}
            </button>
            <button
              type="button"
              disabled={scanningAutoLive}
              onClick={handleScanAndConnectLiveSockets}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {scanningAutoLive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              סרוק והתחבר ללייבים לאיסוף חי
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
            <PlugZap className="w-3.5 h-3.5 text-amber-400" />
            2. גשר WebSocket חיצוני (TikFinity / Streamer.bot / שרת מותאם)
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={extUrlInput}
              onChange={(e) => setExtUrlInput(e.target.value)}
              placeholder="ws://localhost:21213/ או wss://..."
              className="flex-1 min-w-[160px] bg-[#121722] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              disabled={connectingExt}
              onClick={() => handleConnectExternalWs()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 transition-colors"
            >
              חבר WS
            </button>
            <button
              type="button"
              onClick={() => {
                setExtUrlInput('ws://localhost:21213/');
                void handleConnectExternalWs('ws://localhost:21213/');
              }}
              className="px-2.5 py-1.5 rounded-lg text-[11px] bg-[#141B29] border border-slate-700 text-slate-300 hover:border-slate-500"
            >
              TikFinity :21213
            </button>
          </div>

          {(sniffer?.externalBridges || []).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {sniffer.externalBridges.map((b) => (
                <div
                  key={b.url}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#141B29] border border-slate-700 text-[11px]"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      b.connected ? 'bg-emerald-400' : b.connecting ? 'bg-amber-400' : 'bg-rose-400'
                    }`}
                  />
                  <span className="font-mono text-slate-200">{b.url}</span>
                  <span className="text-slate-400 font-mono">({b.messagesReceived})</span>
                  {b.lastErrorHe && <span className="text-rose-300 text-[10px]">{b.lastErrorHe}</span>}
                  <button
                    type="button"
                    onClick={() => handleDisconnectExternalWs(b.url)}
                    className="text-slate-400 hover:text-rose-400"
                    title="נתק WebSocket"
                  >
                    <Unplug className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {bannerHe && (
        <div className="px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/35 text-xs text-cyan-200 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            {bannerHe}
          </span>
          <button
            type="button"
            onClick={() => setBannerHe(null)}
            className="text-[11px] text-slate-400 hover:text-slate-200"
          >
            סגור
          </button>
        </div>
      )}

      {/* Rolling Real-Time Captured WebSocket Stream */}
      {(sniffer?.recentPackets || []).length > 0 && (
        <div className="rounded-lg bg-[#0B0E14] border border-[#1E2636] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              זרם אירועים חיים שנקלטים עכשיו ב-WebSocket ({sniffer.recentPackets.length} אחרונים)
            </span>
            <button
              type="button"
              onClick={() => handleUpdateConfig({ resetCounters: true })}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              אפס מונים
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
            {sniffer.recentPackets.slice(0, compact ? 8 : 16).map((pkt) => (
              <div
                key={pkt.id}
                className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1 rounded bg-[#121826] border border-[#1E2636]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-slate-500 shrink-0">
                    {new Date(pkt.ts).toLocaleTimeString('he-IL', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono text-[10px] shrink-0">
                    {pkt.eventKey}
                  </span>
                  <span className="text-amber-300 font-mono shrink-0">{pkt.sourceLabel}</span>
                  <span className="text-slate-200 truncate">{pkt.summaryHe}</span>
                </div>
                {pkt.autoTriggered && pkt.triggeredActionsSummaryHe && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold shrink-0">
                    הופעל: {pkt.triggeredActionsSummaryHe}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & AI Smart Mapper Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                activeCategory === tab.id
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                  : 'bg-[#0B0E14] border-[#1E2636] text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.labelHe}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חפש אירוע..."
              className="bg-[#0B0E14] border border-[#1E2636] rounded-lg pr-8 pl-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 w-40"
            />
          </div>

          <button
            type="button"
            disabled={aiAssigning}
            onClick={() => handleAiAutoAssign()}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-purple-500/20 border border-purple-400/40 text-purple-200 hover:bg-purple-500/30 disabled:opacity-50 flex items-center gap-1.5"
          >
            {aiAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            שיבוץ אוטומטי חכם (AI)
          </button>

          <button
            type="button"
            onClick={() => setShowNewCustomForm((v) => !v)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#0B0E14] border border-slate-700 text-slate-200 hover:border-slate-500 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            אירוע מותאם
          </button>
        </div>
      </div>

      {showNewCustomForm && (
        <div className="rounded-lg bg-[#0B0E14] border border-cyan-500/40 p-3 flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={newEventKey}
            onChange={(e) => setNewEventKey(e.target.value)}
            placeholder="מזהה אירוע (למשל ExternalWS:customAlert או WebcastPollMessage)"
            className="flex-1 min-w-[210px] bg-[#121722] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
          />
          <input
            type="text"
            value={newEventLabelHe}
            onChange={(e) => setNewEventLabelHe(e.target.value)}
            placeholder="שם תצוגה בעברית..."
            className="flex-1 min-w-[160px] bg-[#121722] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
          />
          <button
            type="button"
            onClick={handleCreateCustomEvent}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
          >
            הוסף ושבץ
          </button>
        </div>
      )}

      {/* Collected Events & Assignable Stage Triggers List */}
      <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
        {filteredEvents.map((rec) => {
          const b = rec.binding;
          const isPayloadOpen = expandedPayloadKey === rec.eventKey;
          return (
            <div
              key={rec.eventKey}
              className={`rounded-xl border p-3 transition-colors space-y-2.5 ${
                b.enabled
                  ? 'bg-[#0E1420] border-amber-500/35'
                  : 'bg-[#0B0E14] border-[#1E2636]'
              }`}
            >
              {/* Top Row: Toggle + Title + Counters + Test Button */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => handlePatchBinding(rec.eventKey, { enabled: !b.enabled })}
                    className={`mt-0.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors shrink-0 ${
                      b.enabled
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-[#161D2B] text-slate-400 border border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {b.enabled ? 'מופעל אוטומטית' : 'כבוי'}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-slate-100">{rec.labelHe}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[#161E2E] text-cyan-300 font-mono text-[10px]">
                        {rec.eventKey}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                          rec.seenCount > 0
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        נקלט {rec.seenCount.toLocaleString()} פעמים
                      </span>
                      {b.triggeredCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-[10px]">
                          הפעיל במה x{b.triggeredCount}
                        </span>
                      )}
                      {savingKey === rec.eventKey && (
                        <span className="text-[10px] text-emerald-400">שומר...</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {rec.seenCount > 0
                        ? `דגימה אחרונה (${rec.lastSourceLabel}): ${rec.lastSampleSummaryHe}`
                        : rec.descriptionHe}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={testingKey === rec.eventKey}
                    onClick={() => handleTestBinding(rec)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 flex items-center gap-1"
                  >
                    {testingKey === rec.eventKey ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    בדוק בבמה
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAiAutoAssign(rec.eventKey)}
                    className="px-2 py-1 rounded-lg text-[11px] bg-purple-500/15 border border-purple-500/35 text-purple-200 hover:bg-purple-500/25"
                    title="בקש מ-AI לשבץ הפעלה מומלצת לאירוע זה"
                  >
                    <Zap className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedPayloadKey(isPayloadOpen ? null : rec.eventKey)
                    }
                    className="px-2 py-1 rounded-lg text-[11px] bg-[#151C2A] border border-slate-700 text-slate-300 hover:text-slate-100 flex items-center gap-1"
                    title="הצג שדות ומידע גולמי שנתפסו ב-WebSocket"
                  >
                    <Code2 className="w-3 h-3" />
                    {isPayloadOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Trigger Assignment Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-1">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">אפקט במה / וידאו (VFX)</label>
                  <select
                    value={b.vfxId}
                    onChange={(e) => handlePatchBinding(rec.eventKey, { vfxId: e.target.value, enabled: true })}
                    className="w-full bg-[#141B29] border border-[#243047] rounded-lg px-2 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="NONE">ללא אפקט ויזואלי</option>
                    {BOOSTERA_ASSETS.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.titleHe}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">תנועת מצלמה קינטית</label>
                  <select
                    value={b.cameraPreset}
                    onChange={(e) =>
                      handlePatchBinding(rec.eventKey, {
                        cameraPreset: e.target.value as CameraPresetId | 'NONE',
                        enabled: true,
                      })
                    }
                    className="w-full bg-[#141B29] border border-[#243047] rounded-lg px-2 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {CAMERA_OPTIONS.map((cam) => (
                      <option key={cam.value} value={cam.value}>
                        {cam.labelHe}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">סאונד אימפקט לשידור</label>
                  <select
                    value={b.soundCueId}
                    onChange={(e) =>
                      handlePatchBinding(rec.eventKey, { soundCueId: e.target.value, enabled: true })
                    }
                    className="w-full bg-[#141B29] border border-[#243047] rounded-lg px-2 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="NONE">ללא סאונד</option>
                    {STANDALONE_SOUND_CUES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.titleHe}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">פעולה מיוחדת בבמה</label>
                  <select
                    value={b.specialAction}
                    onChange={(e) =>
                      handlePatchBinding(rec.eventKey, {
                        specialAction: e.target.value as WsSpecialStageAction,
                        enabled: true,
                      })
                    }
                    className="w-full bg-[#141B29] border border-[#243047] rounded-lg px-2 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {SPECIAL_ACTION_OPTIONS.map((sp) => (
                      <option key={sp.value} value={sp.value}>
                        {sp.labelHe}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">מוזיקה</label>
                    <select
                      value={b.musicTrackId}
                      onChange={(e) =>
                        handlePatchBinding(rec.eventKey, { musicTrackId: e.target.value, enabled: true })
                      }
                      className="w-full bg-[#141B29] border border-[#243047] rounded-lg px-1.5 py-1.5 text-[11px] text-slate-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="KEEP">ללא שינוי</option>
                      {BOOSTERA_MUSIC_TRACKS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.titleHe}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">צינון (שנ׳)</label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={b.cooldownSec}
                      onChange={(e) =>
                        handlePatchBinding(rec.eventKey, {
                          cooldownSec: Math.max(1, Number(e.target.value || 5)),
                        })
                      }
                      className="w-full bg-[#141B29] border border-[#243047] rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Expanded Payload & Fine Tuning */}
              {isPayloadOpen && (
                <div className="rounded-lg bg-[#090C12] border border-slate-800 p-2.5 space-y-2 text-[11px]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">כיתוב באנר על הבמה</label>
                      <input
                        type="text"
                        defaultValue={b.calloutTextHe}
                        onBlur={(e) =>
                          handlePatchBinding(rec.eventKey, { calloutTextHe: e.target.value })
                        }
                        placeholder="למשל: GLOVE x5 NOW!"
                        className="w-full bg-[#141B29] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">סף מינימום (יהלומים/לייקים)</label>
                      <input
                        type="number"
                        min={0}
                        defaultValue={b.minNumericValue}
                        onBlur={(e) =>
                          handlePatchBinding(rec.eventKey, {
                            minNumericValue: Math.max(0, Number(e.target.value || 0)),
                          })
                        }
                        className="w-full bg-[#141B29] border border-slate-700 rounded px-2 py-1 text-xs font-mono text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">שדות שזוהו באירוע</label>
                      <div className="text-[10px] font-mono text-cyan-300 truncate pt-1">
                        {rec.detectedFields.length > 0 ? rec.detectedFields.join(', ') : 'טרם נקלט פריים חי'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-0.5">דגימת Payload גולמית אחרונה:</span>
                    <pre className="text-[10px] font-mono text-slate-300 bg-[#101521] p-2 rounded overflow-x-auto">
                      {rec.lastPayloadPreview}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
