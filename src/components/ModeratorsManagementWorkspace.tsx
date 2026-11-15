import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Edit3,
  Loader2,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import {
  BattleState,
  CompanionRoleId,
  EnvModeratorSlotActivity,
  ModeratorAutoScriptRule,
  ModeratorScriptStep,
  ModeratorTriggerEventType,
} from '../data/boosteraCatalog';
import { ChatCompanionCrewPanel } from './ChatCompanionCrewPanel';

interface ModeratorsManagementWorkspaceProps {
  battleState: BattleState;
  refreshState: () => Promise<void>;
  sendTikTokEvent?: (payload: {
    type: string;
    user?: string;
    message?: string;
    count?: number;
    points?: number;
  }) => Promise<void>;
}

const TRIGGER_EVENT_LABELS: Record<ModeratorTriggerEventType, string> = {
  WHALE_GIFT: 'מתנת לווייתן / מתנה גדולה בלייב',
  MEDIUM_GIFT: 'מתנה בינונית / רצף מתנות',
  GLOVE_OPENED: 'פתיחת כפפת בוסט (Glove x5)',
  OPPONENT_CLOUD: 'זיהוי ענן הסתרת סקור של היריב',
  BATTLE_SPEED_TASK: 'משימת מהירות / בונוס קרב (Battle Task)',
  SNIPE_WINDOW_30S: 'כניסה ל-30 שניות הכרעה וסנייפ',
  VIP_BARRAGE_JOIN: 'כניסת תומך VIP / באנר כניסה מיוחד',
  SHARE_SPIKE: 'שיתוף השידור החי ע״י צופה',
  FOLLOW_NEW: 'הצטרפות עוקב חדש לחדר',
  LIKE_BURST: 'גל הקשות / קומבו לייקים מהיר',
  TROLL_OR_SPAM_CHAT: 'זיהוי טרול מחדר יריב או ספאם בצ׳אט',
  CHAT_KEYWORD_MATCH: 'זיהוי מילה או ביטוי בצ׳אט החי',
  CUSTOM_WS_EVENT: 'אירוע WebSocket ספציפי שנקלט בלייב',
};

const ROLE_LABELS_HE: Record<CompanionRoleId, string> = {
  TACTICAL_SNIPE: 'קצין קרב, כפפה וסנייפ',
  VIBE_HYPE: 'הרמת אווירה ושובר שתיקה',
  MOD_SHIELD: 'מגן צ׳אט וניקוי רעשים',
  WELCOME_VIP: 'קבלת פנים ותודות VIP',
  COMBO_PACER: 'דחיפת הקשות ומשימות מהירות',
  SCOUT_SUPPORT: 'מלווה שיח ושיתופי לייב',
};

const DELIVERY_STATE_LABELS: Record<
  EnvModeratorSlotActivity['liveDeliveryState'],
  { textHe: string; toneClass: string }
> = {
  DIRECT_TIKTOK_AUTH: {
    textHe: 'שליחה ישירה מאומתת (.env)',
    toneClass: 'text-emerald-300',
  },
  WS_BRIDGE_CONNECTED: {
    textHe: 'מחובר דרך גשר WebSocket',
    toneClass: 'text-cyan-300',
  },
  STAGE_READY: {
    textHe: 'פעיל בתצוגה ובגשר מנחים',
    toneClass: 'text-amber-300',
  },
  PAUSED: {
    textHe: 'מושהה ידנית',
    toneClass: 'text-slate-500',
  },
};

const DYNAMIC_PLACEHOLDERS = [
  { token: '{{USER}}', labelHe: 'שם הצופה/התומך' },
  { token: '{{GIFT}}', labelHe: 'שם המתנה' },
  { token: '{{VALUE}}', labelHe: 'כמות יהלומים/לייקים' },
  { token: '{{ROOM}}', labelHe: '@חדר הלייב' },
];

export const ModeratorsManagementWorkspace: React.FC<ModeratorsManagementWorkspaceProps> = ({
  battleState,
  refreshState,
  sendTikTokEvent,
}) => {
  const comp = battleState.chatCompanion;
  const envSlots = comp?.envSlotsActivity || [];
  const scripts = comp?.autoScripts || [];
  const discoveredWsEvents = battleState.wsSniffer?.discoveredEvents || [];

  const [sectionFilter, setSectionFilter] = useState<'ALL' | 'ENV_ACCOUNTS' | 'AUTO_SCRIPTS' | 'AI_BRAIN'>('ALL');
  const [bannerHe, setBannerHe] = useState<string | null>(null);
  const [reloadingEnv, setReloadingEnv] = useState<boolean>(false);
  const [expandedSlotLog, setExpandedSlotLog] = useState<number | null>(null);

  // Inline slot editor (#1..#6)
  const [editingSlotNum, setEditingSlotNum] = useState<number | null>(null);
  const [slotEditHandle, setSlotEditHandle] = useState<string>('');
  const [slotEditDisplayName, setSlotEditDisplayName] = useState<string>('');
  const [slotEditRole, setSlotEditRole] = useState<CompanionRoleId>('VIBE_HYPE');

  // Script Builder / Editor state
  const [builderOpen, setBuilderOpen] = useState<boolean>(false);
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [scriptNameHe, setScriptNameHe] = useState<string>('');
  const [scriptDescHe, setScriptDescHe] = useState<string>('');
  const [scriptTrigger, setScriptTrigger] = useState<ModeratorTriggerEventType>('WHALE_GIFT');
  const [scriptCustomWsKey, setScriptCustomWsKey] = useState<string>('');
  const [scriptKeyword, setScriptKeyword] = useState<string>('');
  const [scriptMinVal, setScriptMinVal] = useState<number>(0);
  const [scriptCooldownSec, setScriptCooldownSec] = useState<number>(20);
  const [scriptSteps, setScriptSteps] = useState<ModeratorScriptStep[]>([
    {
      id: 'draft_1',
      slotNumber: 1,
      delaySec: 0,
      messageTemplateHe: 'כבוד ענק ל-{{USER}} על התמיכה המטורפת בחדר {{ROOM}}!',
    },
    {
      id: 'draft_2',
      slotNumber: 2,
      delaySec: 3.5,
      messageTemplateHe: 'כולם בצ׳אט להרים לבבות והקשות על המסך ביחד!',
    },
  ]);
  const [savingScript, setSavingScript] = useState<boolean>(false);
  const [testingScriptId, setTestingScriptId] = useState<string | null>(null);

  // Quick Deploy Bar
  const [deployRoomInput, setDeployRoomInput] = useState<string>(
    comp?.commanderBrain?.activeTargetRoom || battleState.tiktokRoom?.targetUsername || ''
  );
  const [deployingNow, setDeployingNow] = useState<boolean>(false);

  const configuredInEnvCount = envSlots.filter((s) => s.sessionConfiguredInEnv).length;
  const enabledSlotsCount = envSlots.filter((s) => s.enabled).length;
  const totalMessagesAcrossSix = envSlots.reduce((sum, s) => sum + (s.messagesSentTotal || 0), 0);
  const totalAutoScriptFires = scripts.reduce((sum, r) => sum + (r.triggeredCount || 0), 0);

  const handleReloadEnvStatus = async () => {
    setReloadingEnv(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/chat-companion/reload-env-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await resp.json();
      await refreshState();
      if (resp.ok) {
        setBannerHe(
          `נסרק קובץ הסביבה (.env): זוהו ${json.configuredCount} מתוך 6 סשנים ישירים פעילים, וכל 6 הסלוטים מסונכרנים.`
        );
      }
    } catch {
      setBannerHe('שגיאה ברענון סטטוס משתני ה-.env.');
    } finally {
      setReloadingEnv(false);
    }
  };

  const handleDeployAllSix = async () => {
    const clean = deployRoomInput.trim();
    if (!clean) {
      setBannerHe('הזן @username של לייב בטיקטוק כדי להציב בו את 6 החשבונות.');
      return;
    }
    setDeployingNow(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/chat-companion/deploy-squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRoomHandle: clean, sendEntryGreeting: true }),
      });
      const json = await resp.json();
      await refreshState();
      if (resp.ok) {
        setDeployRoomInput(json.targetRoom || clean);
        setBannerHe(
          `6 החשבונות הוצבו על @${json.targetRoom} — כל תסריטי האירועים האוטומטיים מכוונים כעת לחדר זה.`
        );
      } else {
        setBannerHe(json.error || 'שגיאה בפריסת החשבונות.');
      }
    } catch {
      setBannerHe('שגיאת תקשורת בפריסת החשבונות.');
    } finally {
      setDeployingNow(false);
    }
  };

  const handleToggleAutoScriptsMaster = async () => {
    await fetch('/api/chat-companion/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        autoEventScriptsEnabled: !comp?.autoEventScriptsEnabled,
      }),
    });
    await refreshState();
  };

  const handleToggleSlotEnabled = async (slot: EnvModeratorSlotActivity) => {
    await fetch('/api/chat-companion/account/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: slot.accountId,
        slotNumber: slot.slotNumber,
        enabled: !slot.enabled,
      }),
    });
    await refreshState();
  };

  const openSlotEdit = (slot: EnvModeratorSlotActivity) => {
    setEditingSlotNum(slot.slotNumber);
    setSlotEditHandle(slot.handle);
    setSlotEditDisplayName(slot.displayName);
    setSlotEditRole(slot.role);
  };

  const handleSaveSlotEdit = async (slot: EnvModeratorSlotActivity) => {
    await fetch('/api/chat-companion/account/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: slot.accountId,
        slotNumber: slot.slotNumber,
        handle: slotEditHandle.trim(),
        displayName: slotEditDisplayName.trim(),
        role: slotEditRole,
      }),
    });
    setEditingSlotNum(null);
    await refreshState();
    setBannerHe(`עודכנו פרטי המנחה עבור סלוט #${slot.slotNumber} (${slot.envSessionKeyName}).`);
  };

  const handleQuickTestSlot = async (slot: EnvModeratorSlotActivity) => {
    const resp = await fetch('/api/chat-companion/dispatch-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: slot.accountId,
        preferredRole: slot.role,
        targetRoom: deployRoomInput.trim() || comp?.commanderBrain?.activeTargetRoom || undefined,
      }),
    });
    const json = await resp.json();
    await refreshState();
    if (json.dispatched) {
      setBannerHe(
        `נשלחה הודעת בדיקה מסלוט #${slot.slotNumber} (@${slot.handle}): "${json.dispatched.messageTextHe}"`
      );
    }
  };

  const openCreateNewScript = () => {
    setEditingScriptId(null);
    setScriptNameHe('');
    setScriptDescHe('');
    setScriptTrigger('WHALE_GIFT');
    setScriptCustomWsKey(discoveredWsEvents[0]?.eventKey || 'WebcastLinkMicBattleTaskMessage');
    setScriptKeyword('');
    setScriptMinVal(0);
    setScriptCooldownSec(20);
    setScriptSteps([
      {
        id: `step_${Date.now()}_1`,
        slotNumber: 1,
        delaySec: 0,
        messageTemplateHe: 'יאללה {{USER}} איזו אנרגיה ב-{{ROOM}} — כולם להצטרף אליו!',
      },
      {
        id: `step_${Date.now()}_2`,
        slotNumber: 2,
        delaySec: 3.5,
        messageTemplateHe: 'ממשיכים דאבל טאפ חזק על המסך חברים, המומנטום שלנו!',
      },
    ]);
    setBuilderOpen(true);
  };

  const openEditScript = (rule: ModeratorAutoScriptRule) => {
    setEditingScriptId(rule.id);
    setScriptNameHe(rule.nameHe);
    setScriptDescHe(rule.descriptionHe);
    setScriptTrigger(rule.triggerEventType);
    setScriptCustomWsKey(rule.customWsEventKey || discoveredWsEvents[0]?.eventKey || '');
    setScriptKeyword(rule.keywordFilter || '');
    setScriptMinVal(rule.minNumericValue || 0);
    setScriptCooldownSec(rule.cooldownSec || 20);
    setScriptSteps(
      rule.steps.map((st) => ({
        id: st.id,
        slotNumber: st.slotNumber,
        delaySec: st.delaySec,
        messageTemplateHe: st.messageTemplateHe,
      }))
    );
    setBuilderOpen(true);
  };

  const handleAddStepRow = () => {
    const nextSlot = (scriptSteps.length % 6) + 1;
    const prevDelay =
      scriptSteps.length > 0 ? scriptSteps[scriptSteps.length - 1].delaySec : -3.5;
    setScriptSteps((prev) => [
      ...prev,
      {
        id: `step_${Date.now()}_${prev.length + 1}`,
        slotNumber: nextSlot,
        delaySec: Number(Math.max(0, prevDelay + 3.5).toFixed(1)),
        messageTemplateHe: '',
      },
    ]);
  };

  const handleUpdateStep = (idx: number, patch: Partial<ModeratorScriptStep>) => {
    setScriptSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );
  };

  const handleRemoveStep = (idx: number) => {
    setScriptSteps((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const appendTokenToLastStep = (token: string) => {
    setScriptSteps((prev) => {
      if (prev.length === 0) return prev;
      const lastIdx = prev.length - 1;
      return prev.map((s, i) =>
        i === lastIdx
          ? {
              ...s,
              messageTemplateHe: `${s.messageTemplateHe}${
                s.messageTemplateHe && !s.messageTemplateHe.endsWith(' ') ? ' ' : ''
              }${token}`,
            }
          : s
      );
    });
  };

  const handleSaveScript = async () => {
    const validSteps = scriptSteps.filter((s) => s.messageTemplateHe.trim().length > 0);
    if (!scriptNameHe.trim() || validSteps.length === 0) {
      setBannerHe('יש להזין שם לתסריט ולפחות שורת תגובה אחת לצ׳אט.');
      return;
    }
    setSavingScript(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/chat-companion/script/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingScriptId || undefined,
          nameHe: scriptNameHe.trim(),
          descriptionHe:
            scriptDescHe.trim() ||
            `תגובה אוטומטית מדורגת באירוע: ${TRIGGER_EVENT_LABELS[scriptTrigger]}`,
          enabled: true,
          triggerEventType: scriptTrigger,
          customWsEventKey:
            scriptTrigger === 'CUSTOM_WS_EVENT' ? scriptCustomWsKey.trim() : undefined,
          keywordFilter: scriptKeyword.trim() || undefined,
          minNumericValue: Number(scriptMinVal) || 0,
          cooldownSec: Number(scriptCooldownSec) || 20,
          steps: validSteps,
        }),
      });
      const json = await resp.json();
      await refreshState();
      if (resp.ok) {
        setBuilderOpen(false);
        setEditingScriptId(null);
        setBannerHe(`התסריט "${json.script?.nameHe}" נשמר ופעיל כעת בזמן אמת על אירועי הלייב!`);
      } else {
        setBannerHe(json.error || 'שגיאה בשמירת התסריט.');
      }
    } catch {
      setBannerHe('שגיאת תקשורת בשמירת התסריט.');
    } finally {
      setSavingScript(false);
    }
  };

  const handleToggleScriptEnabled = async (rule: ModeratorAutoScriptRule) => {
    await fetch('/api/chat-companion/script/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: rule.id,
        enabled: !rule.enabled,
      }),
    });
    await refreshState();
  };

  const handleDeleteScript = async (id: string) => {
    await fetch('/api/chat-companion/script/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await refreshState();
  };

  const handleTestFireScript = async (rule: ModeratorAutoScriptRule) => {
    setTestingScriptId(rule.id);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/chat-companion/script/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id }),
      });
      const json = await resp.json();
      await refreshState();
      if (resp.ok) {
        setBannerHe(
          `התסריט "${rule.nameHe}" הופעל עכשיו לבדיקה חיה — ${rule.steps.length} השורות משוגרות בהפרשי הזמן שהוגדרו אל החשבונות!`
        );
      } else {
        setBannerHe(json.error || 'שגיאה בהפעלת בדיקת התסריט.');
      }
    } catch {
      setBannerHe('שגיאת תקשורת בבדיקת התסריט.');
    } finally {
      setTestingScriptId(null);
    }
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Top Page Header & Segmented View Filter */}
      <section className="border-b border-[#1E2636] pb-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1.5 max-w-3xl">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
              ניהול מנחים (Moderators), תסריטי אירועים אוטומטיים וניטור 6 חשבונות ה-.env
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              {enabledSlotsCount}/6 חשבונות מנחים פעילים
              <span aria-hidden="true"> · </span>
              {configuredInEnvCount}/6 סשנים ישירים מוגדרים ב-.env
              <span aria-hidden="true"> · </span>
              {scripts.filter((s) => s.enabled).length} תסריטי אירועים דרוכים
              <span aria-hidden="true"> · </span>
              סה״כ שוגרו {totalMessagesAcrossSix} הודעות ({totalAutoScriptFires} הפעלות תסריט)
            </p>
          </div>

          {/* Interactive Segmented Filter Controls */}
          <div className="flex items-center gap-1 p-1 bg-[#111724] border border-[#1E2636] rounded-lg">
            {(
              [
                { id: 'ALL', label: 'תצוגה מרוכזת' },
                { id: 'ENV_ACCOUNTS', label: '6 חשבונות ה-.env' },
                { id: 'AUTO_SCRIPTS', label: 'תסריטי תגובה אוטומטיים' },
                { id: 'AI_BRAIN', label: 'מוח AI ואימון צ׳אט' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSectionFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sectionFilter === tab.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target Room Quick Deployment Strip */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
            <input
              type="text"
              value={deployRoomInput}
              onChange={(e) => setDeployRoomInput(e.target.value)}
              placeholder="הזן @username של לייב בטיקטוק להצבת כל 6 החשבונות והתסריטים..."
              className="flex-1 bg-[#111724] border border-[#1E2636] rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
            />
            <button
              type="button"
              disabled={deployingNow}
              onClick={handleDeployAllSix}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              {deployingNow ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Users className="w-3.5 h-3.5" />
              )}
              הצב את 6 החשבונות בלייב
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleToggleAutoScriptsMaster}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                comp?.autoEventScriptsEnabled
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-200'
                  : 'bg-[#111724] border-[#1E2636] text-slate-400'
              }`}
            >
              {comp?.autoEventScriptsEnabled
                ? 'תסריטים אוטומטיים באירועים: פעיל'
                : 'תסריטים אוטומטיים: מושהה'}
            </button>

            <button
              type="button"
              disabled={reloadingEnv}
              onClick={handleReloadEnvStatus}
              className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#111724] border border-[#1E2636] hover:border-slate-600 text-slate-200 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reloadingEnv ? 'animate-spin' : ''}`} />
              סרוק מחדש קובץ .env
            </button>
          </div>
        </div>

        {bannerHe && (
          <div className="px-3.5 py-2.5 rounded-lg bg-[#111927] border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              {bannerHe}
            </span>
            <button
              type="button"
              onClick={() => setBannerHe(null)}
              className="text-slate-400 hover:text-slate-200 text-xs shrink-0"
            >
              סגור
            </button>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* 01. CENTRALIZED 6 .ENV ACCOUNTS MONITOR (TIKTOK_MOD_1 .. TIKTOK_MOD_6) */}
      {/* ===================================================================== */}
      {(sectionFilter === 'ALL' || sectionFilter === 'ENV_ACCOUNTS') && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                01. מרכז פעילות 6 החשבונות המוגדרים בקובץ ה-.env
              </h2>
              <p className="text-xs text-slate-400">
                מיפוי מלא של משתני הסביבה{' '}
                <span className="font-mono text-slate-300">TIKTOK_MOD_1_SESSIONID</span> עד{' '}
                <span className="font-mono text-slate-300">TIKTOK_MOD_6_SESSIONID</span> — כולל אזור שרת, חדר יעד, ספירת תסריטים ויומן הודעות אחרונות לכל חשבון.
              </p>
            </div>
          </div>

          {/* 6 Accounts Centralized Table / Grid */}
          <div className="rounded-xl border border-[#1E2636] bg-[#0F141F] overflow-hidden">
            <div className="divide-y divide-[#1E2636]">
              {envSlots.map((slot) => {
                const deliveryMeta = DELIVERY_STATE_LABELS[slot.liveDeliveryState];
                const isEditingThis = editingSlotNum === slot.slotNumber;
                const isLogOpen = expandedSlotLog === slot.slotNumber;

                return (
                  <div key={slot.slotNumber} className="p-4 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left/Right Identity & .env Status */}
                      <div className="flex items-start gap-3 min-w-0">
                        <img
                          src={slot.avatarUrl}
                          alt={slot.displayName}
                          className="w-10 h-10 rounded-full border border-[#2A354B] shrink-0 object-cover"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap text-sm">
                            <span className="font-mono font-bold text-amber-400">
                              סלוט #{slot.slotNumber}
                            </span>
                            <span aria-hidden="true" className="text-slate-600">·</span>
                            <span className="font-semibold text-slate-100">
                              {slot.displayName}
                            </span>
                            <span className="font-mono text-xs text-cyan-300">
                              @{slot.handle}
                            </span>
                            <span aria-hidden="true" className="text-slate-600">·</span>
                            <span className="text-xs text-slate-400">
                              {ROLE_LABELS_HE[slot.role] || slot.role}
                            </span>
                          </div>

                          {/* Clean unboxed .env metadata row */}
                          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                            <span className="font-mono text-slate-300">
                              {slot.envSessionKeyName}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                slot.sessionConfiguredInEnv
                                  ? 'text-emerald-300'
                                  : 'text-slate-400'
                              }
                            >
                              {slot.sessionMaskedStatusHe}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>אזור: {slot.targetIdc}</span>
                            <span aria-hidden="true">·</span>
                            <span className={deliveryMeta.toneClass}>{deliveryMeta.textHe}</span>
                            {slot.deployedRoomHandle && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-300 font-mono">
                                  מוצב ב-@{slot.deployedRoomHandle}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Activity Counters & Last Message */}
                          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                            <span className="text-slate-200 font-mono tabular-nums">
                              סה״כ נשלחו: {slot.messagesSentTotal}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              מתסריטי אירועים: {slot.autoScriptTriggersCount}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              מפקודות מוח: {slot.brainCommandsCount}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              הגנות צ׳אט: {slot.moderationsCount}
                            </span>
                            {slot.lastSentAtTs && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono text-slate-500">
                                  אחרון ב-
                                  {new Date(slot.lastSentAtTs).toLocaleTimeString('he-IL', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}
                                </span>
                              </>
                            )}
                          </div>

                          {slot.lastSentMessageHe && (
                            <p className="text-xs text-slate-300 truncate max-w-2xl">
                              הודעה אחרונה שנשלחה: "{slot.lastSentMessageHe}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Slot Controls */}
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQuickTestSlot(slot)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#161F30] border border-[#26334D] hover:border-emerald-400/50 text-emerald-300 flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          שלח בדיקה
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSlotLog(isLogOpen ? null : slot.slotNumber)
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#161F30] border border-[#26334D] hover:border-slate-500 text-slate-200"
                        >
                          {isLogOpen
                            ? 'הסתר יומן'
                            : `יומן פעילות (${slot.recentLogs.length})`}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            isEditingThis
                              ? setEditingSlotNum(null)
                              : openSlotEdit(slot)
                          }
                          className="p-1.5 rounded-lg bg-[#161F30] border border-[#26334D] hover:border-amber-400/50 text-slate-300"
                          title="ערוך שיוך מנחה לסלוט זה"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleSlotEnabled(slot)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                            slot.enabled
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : 'bg-[#0B0E14] border-[#1E2636] text-slate-500'
                          }`}
                        >
                          {slot.enabled ? 'פעיל' : 'מושהה'}
                        </button>
                      </div>
                    </div>

                    {/* Inline Slot Profile Editor */}
                    {isEditingThis && (
                      <div className="pt-3 border-t border-[#1E2636] grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <input
                          type="text"
                          value={slotEditHandle}
                          onChange={(e) => setSlotEditHandle(e.target.value)}
                          placeholder="@username בטיקטוק"
                          className="bg-[#0B0E14] border border-[#26334D] rounded-lg px-3 py-1.5 text-xs text-slate-100"
                        />
                        <input
                          type="text"
                          value={slotEditDisplayName}
                          onChange={(e) => setSlotEditDisplayName(e.target.value)}
                          placeholder="שם תצוגה ותפקיד"
                          className="bg-[#0B0E14] border border-[#26334D] rounded-lg px-3 py-1.5 text-xs text-slate-100"
                        />
                        <select
                          value={slotEditRole}
                          onChange={(e) => setSlotEditRole(e.target.value as CompanionRoleId)}
                          className="bg-[#0B0E14] border border-[#26334D] rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                        >
                          <option value="TACTICAL_SNIPE">קצין קרב, כפפה וסנייפ</option>
                          <option value="VIBE_HYPE">הרמת אווירה ושובר שתיקה</option>
                          <option value="MOD_SHIELD">מגן צ׳אט וניקוי רעשים</option>
                          <option value="WELCOME_VIP">קבלת פנים ותודות VIP</option>
                          <option value="COMBO_PACER">דחיפת הקשות ומשימות מהירות</option>
                          <option value="SCOUT_SUPPORT">מלווה שיח ושיתופי לייב</option>
                        </select>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingSlotNum(null)}
                            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                          >
                            ביטול
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveSlotEdit(slot)}
                            className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400"
                          >
                            שמור סלוט #{slot.slotNumber}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Expandable Per-Slot Live Log */}
                    {isLogOpen && (
                      <div className="pt-3 border-t border-[#1E2636] space-y-1.5">
                        {slot.recentLogs.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            טרם נשלחו הודעות מסלוט #{slot.slotNumber} בסשן הנוכחי — לחץ "שלח בדיקה" או הפעל תסריט למטה.
                          </p>
                        ) : (
                          slot.recentLogs.map((lg) => (
                            <div
                              key={lg.id}
                              className="flex items-center justify-between gap-3 text-xs py-1 text-slate-300"
                            >
                              <span className="truncate">
                                "{lg.messageHe}"
                                <span aria-hidden="true" className="text-slate-600"> · </span>
                                <span className="text-slate-400">{lg.sourceLabelHe}</span>
                              </span>
                              <span className="text-[11px] font-mono text-slate-500 shrink-0">
                                {lg.deliveryStatusHe} ·{' '}
                                {new Date(lg.ts).toLocaleTimeString('he-IL', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* 02. AUTOMATIC EVENT-DRIVEN CHAT RESPONSE SCRIPTS                      */}
      {/* ===================================================================== */}
      {(sectionFilter === 'ALL' || sectionFilter === 'AUTO_SCRIPTS') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-semibold text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                02. תסריטי תגובה אוטומטיים לצ׳אט לפי זיהוי אירועים בלייב
              </h2>
              <p className="text-xs text-slate-400">
                הגדר אילו מחשבונות ה-.env (#1–#6) יגיבו אוטומטית ובאילו הפרשי שניות בכל פעם שמזוהה מתנה, כפפה, ענן יריב, משימת מהירות או כל אירוע WebSocket בלייב.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateNewScript}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              צור תסריט תגובה חדש
            </button>
          </div>

          {/* Interactive Script Builder Drawer */}
          {builderOpen && (
            <div className="rounded-xl border border-amber-500/45 bg-[#0F141F] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-100">
                  {editingScriptId ? 'עריכת תסריט תגובה אוטומטי' : 'יצירת תסריט תגובה אוטומטי חדש'}
                </h3>
                <button
                  type="button"
                  onClick={() => setBuilderOpen(false)}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  סגור עורך
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1 lg:col-span-2">
                  <label className="text-xs text-slate-300 block">שם התסריט</label>
                  <input
                    type="text"
                    value={scriptNameHe}
                    onChange={(e) => setScriptNameHe(e.target.value)}
                    placeholder="למשל: תסריט פרגון מתנת אריה + הרמת צ׳אט"
                    className="w-full bg-[#0B0E14] border border-[#26334D] rounded-lg px-3 py-2 text-xs text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-300 block">אירוע מפעיל בלייב</label>
                  <select
                    value={scriptTrigger}
                    onChange={(e) =>
                      setScriptTrigger(e.target.value as ModeratorTriggerEventType)
                    }
                    className="w-full bg-[#0B0E14] border border-[#26334D] rounded-lg px-2.5 py-2 text-xs text-slate-100"
                  >
                    {(Object.keys(TRIGGER_EVENT_LABELS) as ModeratorTriggerEventType[]).map(
                      (k) => (
                        <option key={k} value={k}>
                          {TRIGGER_EVENT_LABELS[k]}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 block">מינימום ערך (יהלומים/לייק)</label>
                    <input
                      type="number"
                      min={0}
                      value={scriptMinVal}
                      onChange={(e) => setScriptMinVal(Number(e.target.value) || 0)}
                      className="w-full bg-[#0B0E14] border border-[#26334D] rounded-lg px-2.5 py-2 text-xs text-slate-100"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 block">קירור (שניות)</label>
                    <input
                      type="number"
                      min={4}
                      max={300}
                      value={scriptCooldownSec}
                      onChange={(e) => setScriptCooldownSec(Number(e.target.value) || 20)}
                      className="w-full bg-[#0B0E14] border border-[#26334D] rounded-lg px-2.5 py-2 text-xs text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {scriptTrigger === 'CUSTOM_WS_EVENT' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 block">
                      בחר אירוע WebSocket מתוך האירועים שנקלטו בלייב
                    </label>
                    <select
                      value={scriptCustomWsKey}
                      onChange={(e) => setScriptCustomWsKey(e.target.value)}
                      className="w-full bg-[#0B0E14] border border-[#26334D] rounded-lg px-2.5 py-2 text-xs text-slate-100"
                    >
                      {discoveredWsEvents.map((ev) => (
                        <option key={ev.eventKey} value={ev.eventKey}>
                          {ev.labelHe} ({ev.eventKey})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300 block">
                      או הקלד שם אירוע WebSocket ידנית
                    </label>
                    <input
                      type="text"
                      value={scriptCustomWsKey}
                      onChange={(e) => setScriptCustomWsKey(e.target.value)}
                      placeholder="WebcastGoalUpdateMessage"
                      className="w-full bg-[#0B0E14] border border-[#26334D] rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
                    />
                  </div>
                </div>
              )}

              {(scriptTrigger === 'CHAT_KEYWORD_MATCH' ||
                scriptTrigger === 'WHALE_GIFT' ||
                scriptTrigger === 'MEDIUM_GIFT') && (
                <div className="space-y-1 max-w-md">
                  <label className="text-xs text-slate-300 block">
                    סינון לפי מילת מפתח בצ׳אט או שם מתנה ספציפי (אופציונלי)
                  </label>
                  <input
                    type="text"
                    value={scriptKeyword}
                    onChange={(e) => setScriptKeyword(e.target.value)}
                    placeholder='למשל: "כמה הסקור" או "Lion"'
                    className="w-full bg-[#0B0E14] border border-[#26334D] rounded-lg px-3 py-1.5 text-xs text-slate-100"
                  />
                </div>
              )}

              {/* Staggered Multi-Account Steps */}
              <div className="space-y-2.5 pt-2 border-t border-[#1E2636]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-200">
                    שלבי שיחה מתוזמנים בין חשבונות ה-.env (נשלחים בדירוג אנושי):
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400">הוסף משתנה חי:</span>
                    {DYNAMIC_PLACEHOLDERS.map((p) => (
                      <button
                        key={p.token}
                        type="button"
                        onClick={() => appendTokenToLastStep(p.token)}
                        className="px-2 py-1 rounded bg-[#161F30] border border-[#26334D] hover:border-amber-400/50 text-[11px] font-mono text-amber-300"
                        title={p.labelHe}
                      >
                        {p.token}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {scriptSteps.map((st, idx) => (
                    <div
                      key={st.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-3">
                        <select
                          value={st.slotNumber}
                          onChange={(e) =>
                            handleUpdateStep(idx, {
                              slotNumber: Number(e.target.value),
                            })
                          }
                          className="w-full bg-[#0B0E14] border border-[#26334D] rounded-lg px-2.5 py-2 text-xs text-slate-100"
                        >
                          {envSlots.map((sl) => (
                            <option key={sl.slotNumber} value={sl.slotNumber}>
                              סלוט #{sl.slotNumber} — @{sl.handle}
                            </option>
                          ))}
                          <option value={0}>רוטציה אוטומטית בין הפעילים</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2 flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 shrink-0">השהיה:</span>
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          max={25}
                          value={st.delaySec}
                          onChange={(e) =>
                            handleUpdateStep(idx, {
                              delaySec: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-[#0B0E14] border border-[#26334D] rounded-lg px-2 py-2 text-xs font-mono text-slate-100"
                        />
                        <span className="text-[11px] text-slate-400 shrink-0">שנ׳</span>
                      </div>

                      <div className="sm:col-span-6">
                        <input
                          type="text"
                          value={st.messageTemplateHe}
                          onChange={(e) =>
                            handleUpdateStep(idx, {
                              messageTemplateHe: e.target.value,
                            })
                          }
                          placeholder="טקסט ההודעה שתישלח לצ׳אט..."
                          className="w-full bg-[#0B0E14] border border-[#26334D] rounded-lg px-3 py-2 text-xs text-slate-100"
                        />
                      </div>

                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(idx)}
                          disabled={scriptSteps.length <= 1}
                          className="p-2 text-slate-500 hover:text-rose-400 disabled:opacity-30"
                          title="הסר שלב"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleAddStepRow}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#161F30] border border-[#26334D] hover:border-slate-500 text-slate-200 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    הוסף תגובת המשך מחשבון נוסף
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBuilderOpen(false)}
                      className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200"
                    >
                      ביטול
                    </button>
                    <button
                      type="button"
                      disabled={savingScript}
                      onClick={handleSaveScript}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                    >
                      {savingScript ? 'שומר...' : 'שמור והפעל תסריט'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Auto-Response Scripts List */}
          <div className="rounded-xl border border-[#1E2636] bg-[#0F141F] divide-y divide-[#1E2636]">
            {scripts.map((rule) => (
              <div
                key={rule.id}
                className={`p-4 space-y-3 ${rule.enabled ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-100">
                      {rule.nameHe}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                      <span className="text-amber-300">
                        טריגר: {TRIGGER_EVENT_LABELS[rule.triggerEventType] || rule.triggerEventType}
                        {rule.customWsEventKey ? ` (${rule.customWsEventKey})` : ''}
                      </span>
                      {rule.minNumericValue > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>סף מינימום: {rule.minNumericValue}</span>
                        </>
                      )}
                      {rule.keywordFilter && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>מילת מפתח: "{rule.keywordFilter}"</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>קירור: {rule.cooldownSec} שנ׳</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums text-emerald-300">
                        הופעל {rule.triggeredCount} פעמים
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={testingScriptId === rule.id}
                      onClick={() => handleTestFireScript(rule)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#161F30] border border-[#26334D] hover:border-emerald-400/50 text-emerald-300 flex items-center gap-1.5"
                    >
                      {testingScriptId === rule.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      בדוק הפעלה חיה
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditScript(rule)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#161F30] border border-[#26334D] hover:border-slate-500 text-slate-200"
                    >
                      ערוך
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleScriptEnabled(rule)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        rule.enabled
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-[#0B0E14] border-[#1E2636] text-slate-500'
                      }`}
                    >
                      {rule.enabled ? 'פעיל' : 'כבוי'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteScript(rule.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400"
                      title="מחק תסריט"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Staggered Dialogue Steps Preview */}
                <div className="space-y-1.5 pt-1">
                  {rule.steps.map((st, sIdx) => {
                    const slotObj = envSlots.find((sl) => sl.slotNumber === st.slotNumber);
                    return (
                      <div
                        key={st.id || sIdx}
                        className="flex items-baseline gap-2.5 text-xs text-slate-300"
                      >
                        <span className="font-mono text-amber-400 shrink-0">
                          +{st.delaySec}s
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="font-mono text-cyan-300 shrink-0">
                          {st.slotNumber >= 1
                            ? `סלוט #${st.slotNumber} (@${slotObj?.handle || `mod_${st.slotNumber}`})`
                            : 'רוטציה חכמה'}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-slate-200">"{st.messageTemplateHe}"</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* 03. AI BRAIN COMMANDER, TRAINING & MODERATION SHIELD                  */}
      {/* ===================================================================== */}
      {(sectionFilter === 'ALL' || sectionFilter === 'AI_BRAIN') && (
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-slate-100">
            03. פיקוד מוח ה-AI, אימון מהצ׳אט החי וסינון טרולים
          </h2>
          <ChatCompanionCrewPanel
            battleState={battleState}
            refreshState={refreshState}
            sendTikTokEvent={sendTikTokEvent}
          />
        </section>
      )}
    </div>
  );
};
