import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Loader2,
  MessageSquarePlus,
  Plus,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  BattleState,
  ChatMomentType,
  CompanionAccountSlot,
  CompanionRoleId,
} from '../data/boosteraCatalog';

interface ChatCompanionCrewPanelProps {
  battleState: BattleState;
  refreshState: () => Promise<void>;
  sendTikTokEvent?: (payload: {
    type: string;
    user?: string;
    message?: string;
  }) => Promise<void>;
}

const ROLE_LABELS: Record<CompanionRoleId, string> = {
  TACTICAL_SNIPE: 'קצין קרב, כפפה וסנייפ',
  VIBE_HYPE: 'הרמת אווירה ושובר שתיקה',
  MOD_SHIELD: 'מגן צ׳אט וניקוי טרולים',
  WELCOME_VIP: 'קבלת פנים ותודות VIP',
  COMBO_PACER: 'דחיפת הקשות וקומבו מהירות',
  SCOUT_SUPPORT: 'מלווה שיח ושיתופי לייב',
};

const MOMENT_LABELS: Record<ChatMomentType, string> = {
  OPENING_WARMUP: 'פתיחת סיבוב / חימום',
  DEAD_AIR_ICEBREAKER: 'שובר שתיקה בצ׳אט',
  GLOVE_X5_PUSH: 'חלון כפפה x5 (30 שנ׳)',
  CLOUD_DEFENSE: 'הגנה מול ענן יריב',
  FINAL_30S_SNIPE: '30 שניות הכרעה וסנייפ',
  VIP_THANK_YOU: 'פרגון לתומך / מתנה',
  ANTI_TROLL_SHIELD: 'בלימת טרולים והצפה חיובית',
};

const QUICK_BRAIN_COMMANDS: Array<{ labelHe: string; commandHe: string }> = [
  {
    labelHe: 'פתיחת שיחה טבעית והרמת אווירה',
    commandHe: 'תפתחו שיחה אנושית טבעית בין המנחים בצ׳אט ותרימו את האווירה והתגובות של הצופים בחדר',
  },
  {
    labelHe: 'דחיפת כפפה x5 מדורגת',
    commandHe: 'כפפה פתוחה עכשיו — חלקו פקודות בין המנחים להניע ורדים ומתנות קטנות ב-5 שניות לתפיסת מכפיל x5',
  },
  {
    labelHe: 'הרגעת ענן יריב + הכנה לסנייפ',
    commandHe: 'היריב פתח ענן הסתרה — הרגיעו מיד את הצ׳אט שלא יקפאו, המשיכו הקשות והכינו את התומכים לסנייפ ב-8 שניות אחרונות',
  },
  {
    labelHe: 'מתקפת משימת מהירות (הקשות)',
    commandHe: 'יש משימת מהירות על המסך — תדליקו גל הקשות כפולות ושיתופים של כל הצופים לנקודות בונוס',
  },
  {
    labelHe: 'ניקוי שליליות והצפה חיובית',
    commandHe: 'נקו אנרגיה שלילית מהצ׳אט והציפו 3 הודעות חיוביות מדורגות שמחזקות את המשפחה בחדר',
  },
];

export const ChatCompanionCrewPanel: React.FC<ChatCompanionCrewPanelProps> = ({
  battleState,
  refreshState,
  sendTikTokEvent,
}) => {
  const comp = battleState.chatCompanion;
  const brain = comp?.commanderBrain;
  const accounts = comp?.accounts || [];
  const enabledCount = accounts.filter((a) => a.enabled).length;
  const liveMonitoredRooms = (battleState.tiktokRoom?.monitoredRooms || []).filter(
    (r) => r.connected
  );

  // Deploy & Brain Command state
  const [targetRoomInput, setTargetRoomInput] = useState<string>(
    brain?.activeTargetRoom || battleState.tiktokRoom?.targetUsername || ''
  );
  const [deployingSquad, setDeployingSquad] = useState<boolean>(false);
  const [brainCommandInput, setBrainCommandInput] = useState<string>('');
  const [executingBrainCmd, setExecutingBrainCmd] = useState<boolean>(false);

  // Training state
  const [trainingNotesInput, setTrainingNotesInput] = useState<string>('');
  const [trainingSquadNow, setTrainingSquadNow] = useState<boolean>(false);
  const [learningPatternsNow, setLearningPatternsNow] = useState<boolean>(false);

  // Add / Edit Account state
  const [showAddAccount, setShowAddAccount] = useState<boolean>(false);
  const [accHandle, setAccHandle] = useState<string>('');
  const [accDisplayName, setAccDisplayName] = useState<string>('');
  const [accRole, setAccRole] = useState<CompanionRoleId>('VIBE_HYPE');
  const [accToneHe, setAccToneHe] = useState<string>('');

  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editHandle, setEditHandle] = useState<string>('');
  const [editDisplayName, setEditDisplayName] = useState<string>('');
  const [editRole, setEditRole] = useState<CompanionRoleId>('VIBE_HYPE');
  const [editToneHe, setEditToneHe] = useState<string>('');

  const [oauthSlotUrls, setOauthSlotUrls] = useState<Record<string, string>>({});

  // Manual single line send
  const [manualLineHe, setManualLineHe] = useState<string>('');
  const [manualAccountId, setManualAccountId] = useState<string>('');
  const [bannerHe, setBannerHe] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!targetRoomInput && brain?.activeTargetRoom) {
      setTargetRoomInput(brain.activeTargetRoom);
    }
  }, [brain?.activeTargetRoom, targetRoomInput]);

  useEffect(() => {
    if (!battleState.tiktokRoom?.oauthConfigured || accounts.length === 0) return;
    let cancelled = false;
    const origin = encodeURIComponent(window.location.origin);
    Promise.all(
      accounts.slice(0, 8).map(async (acc) => {
        try {
          const r = await fetch(`/api/auth/tiktok/url?slotId=${encodeURIComponent(acc.id)}&origin=${origin}`);
          const j = await r.json();
          return j?.configured && j?.url ? ([acc.id, String(j.url)] as const) : null;
        } catch {
          return null;
        }
      })
    ).then((pairs) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const p of pairs) {
        if (p) map[p[0]] = p[1];
      }
      setOauthSlotUrls(map);
    });
    return () => {
      cancelled = true;
    };
  }, [battleState.tiktokRoom?.oauthConfigured, accounts.length]);

  const handleToggleConfig = async (patch: {
    autoCompanionEnabled?: boolean;
    autoModerationShieldEnabled?: boolean;
    autoLearnFromLiveChat?: boolean;
    autonomousBrainEnabled?: boolean;
  }) => {
    await fetch('/api/chat-companion/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await refreshState();
  };

  const handleDeploySquadToLive = async (explicitRoom?: string) => {
    const roomToDeploy = (explicitRoom ?? targetRoomInput).trim();
    if (!roomToDeploy) {
      setBannerHe('הזן @username של שידור חי בטיקטוק כדי לשלוח אליו את צוות המנחים.');
      return;
    }
    setDeployingSquad(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/chat-companion/deploy-squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRoomHandle: roomToDeploy,
          sendEntryGreeting: true,
        }),
      });
      const json = await resp.json();
      await refreshState();
      if (resp.ok) {
        setTargetRoomInput(json.targetRoom || roomToDeploy);
        setBannerHe(
          json.roomConnected
            ? `נשלחו ${json.deployedCount} חשבונות מנחים ללייב של @${json.targetRoom} — המוח מתזמן עכשיו כניסה טבעית בצ׳אט!`
            : `הוצבו ${json.deployedCount} חשבונות מנחים על @${json.targetRoom} — ברגע שהשידור באוויר המוח ינהל את הצ׳אט אוטומטית.`
        );
      } else {
        setBannerHe(json.error || 'שגיאה בשליחת הצוות לחדר הלייב.');
      }
    } catch {
      setBannerHe('שגיאת תקשורת בפריסת צוות המנחים.');
    } finally {
      setDeployingSquad(false);
    }
  };

  const handleSendBrainCommand = async (presetCommandHe?: string) => {
    const cmd = (presetCommandHe ?? brainCommandInput).trim();
    if (!cmd) {
      setBannerHe('כתוב פקודה למוח ה-AI (למשל: "תרימו אווירה וכפפה x5 בלייב").');
      return;
    }
    setExecutingBrainCmd(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/chat-companion/brain-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandHe: cmd,
          targetRoomHandle: targetRoomInput.trim() || undefined,
        }),
      });
      const json = await resp.json();
      await refreshState();
      if (resp.ok && json.order) {
        if (!presetCommandHe) setBrainCommandInput('');
        setBannerHe(
          `המוח פירק את הפקודה ל-${json.order.steps.length} הודעות מדורגות בין המנחים ומשגר אותן בהפרשי שניות אנושיים!`
        );
      } else {
        setBannerHe(json.error || 'שגיאה בביצוע פקודת המוח.');
      }
    } catch {
      setBannerHe('שגיאת תקשורת מול מוח המנחים.');
    } finally {
      setExecutingBrainCmd(false);
    }
  };

  const handleTrainSquadNow = async () => {
    setTrainingSquadNow(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/chat-companion/train-squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customChatSample: trainingNotesInput.trim() || undefined,
        }),
      });
      const json = await resp.json();
      await refreshState();
      if (resp.ok) {
        setTrainingNotesInput('');
        setBannerHe(
          json.trainingSummaryHe ||
            `כל ${json.trainedAccountsCount} חשבונות המנחים אומנו מחדש ממה שנלמד בצ׳אט החי!`
        );
      } else {
        setBannerHe(json.error || 'שגיאה באימון צוות המנחים.');
      }
    } catch {
      setBannerHe('שגיאת תקשורת באימון המנחים.');
    } finally {
      setTrainingSquadNow(false);
    }
  };

  const handleLearnPatternsOnly = async () => {
    setLearningPatternsNow(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/chat-companion/learn-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customChatSample: trainingNotesInput.trim() || undefined }),
      });
      const json = await resp.json();
      await refreshState();
      if (resp.ok) {
        setBannerHe(json.summaryInsightHe || 'נוספו תבניות חדשות מספר הלמידה של הצ׳אט!');
      } else {
        setBannerHe(json.error || 'שגיאה בלמידת צ׳אט.');
      }
    } catch {
      setBannerHe('שגיאת תקשורת בלמידת צ׳אט.');
    } finally {
      setLearningPatternsNow(false);
    }
  };

  const handleAddAccount = async () => {
    if (!accHandle.trim() && !accDisplayName.trim()) {
      setBannerHe('הזן @username בטיקטוק או שם תצוגה לחשבון המנחה החדש.');
      return;
    }
    await fetch('/api/chat-companion/account/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: accHandle.trim(),
        displayName: accDisplayName.trim() || accHandle.trim(),
        role: accRole,
        toneNotesHe: accToneHe.trim() || undefined,
        enabled: true,
      }),
    });
    setAccHandle('');
    setAccDisplayName('');
    setAccToneHe('');
    setShowAddAccount(false);
    await refreshState();
    setBannerHe('חשבון מנחה חדש חובר לצוות ותחת פיקוד מוח ה-AI!');
  };

  const startEditingAccount = (acc: CompanionAccountSlot) => {
    setEditingAccountId(acc.id);
    setEditHandle(acc.handle);
    setEditDisplayName(acc.displayName);
    setEditRole(acc.role);
    setEditToneHe(acc.toneNotesHe);
  };

  const handleSaveEditedAccount = async (id: string) => {
    await fetch('/api/chat-companion/account/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        handle: editHandle.trim(),
        displayName: editDisplayName.trim(),
        role: editRole,
        toneNotesHe: editToneHe.trim(),
      }),
    });
    setEditingAccountId(null);
    await refreshState();
    setBannerHe('פרטי חשבון המנחה עודכנו ונשמרו.');
  };

  const handleToggleAccount = async (id: string, enabled: boolean) => {
    await fetch('/api/chat-companion/account/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    });
    await refreshState();
  };

  const handleDeleteAccount = async (id: string) => {
    await fetch('/api/chat-companion/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await refreshState();
  };

  const handleDispatchNow = async (opts: {
    moment: ChatMomentType;
    preferredRole: CompanionRoleId;
    accountId?: string;
    customMessageHe?: string;
  }) => {
    const resp = await fetch('/api/chat-companion/dispatch-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...opts,
        targetRoom: targetRoomInput.trim() || brain?.activeTargetRoom || undefined,
      }),
    });
    const json = await resp.json();
    await refreshState();
    if (json.dispatched) {
      setBannerHe(
        `נשלח מ-@${json.dispatched.accountHandle}: "${json.dispatched.messageTextHe}"`
      );
    }
  };

  const handleResolveModerationFlag = async (flagId: string, sendFlood: boolean) => {
    await fetch('/api/chat-companion/resolve-flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flagId, sendFlood }),
    });
    await refreshState();
  };

  const handleSimulateTrollTest = async () => {
    if (sendTikTokEvent) {
      await sendTikTokEvent({
        type: 'chat',
        user: 'troll_from_opponent99',
        message: 'אין לכם סיכוי הפסדתם כבר יא חלשים תפרוש מהלייב',
      });
      setBannerHe('נשלחה הודעת טרול לבדיקה — מגן הצ׳אט זיהה, סימן להסרה והפעיל הצפה חיובית אוטומטית!');
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const unresolvedFlagsCount = (comp?.moderationFlags || []).filter((f) => !f.resolved).length;

  return (
    <div className="rounded-xl border border-emerald-500/35 bg-[#101622] p-4 sm:p-5 space-y-5">
      {/* Header & Global Mode Switches */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <Brain className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm sm:text-base font-bold text-slate-100">
              מוח AI מפקד + {accounts.length} חשבונות מנחי טיקטוק מאומנים לשליחה בלייב
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            {enabledCount} מתוך {accounts.length} חשבונות פעילים · קצב צ׳אט:{' '}
            <span className="font-mono tabular-nums text-emerald-300">
              {comp?.chatVelocityPerMin || 0} הודעות/דקה
            </span>{' '}
            · אימונים שבוצעו:{' '}
            <span className="font-mono tabular-nums text-amber-300">
              {brain?.trainingSessionsCount || 1}
            </span>
            {brain?.activeTargetRoom ? ` · פרוסים כעת על @${brain.activeTargetRoom}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() =>
              handleToggleConfig({
                autonomousBrainEnabled: !brain?.autonomousBrainEnabled,
              })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              brain?.autonomousBrainEnabled
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-[#0B0E14] border-slate-700 text-slate-300'
            }`}
          >
            {brain?.autonomousBrainEnabled ? 'מוח AI אוטונומי: פעיל' : 'מוח AI: פקודות ידניות'}
          </button>

          <button
            type="button"
            onClick={() =>
              handleToggleConfig({ autoCompanionEnabled: !comp?.autoCompanionEnabled })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              comp?.autoCompanionEnabled
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-[#0B0E14] border-slate-700 text-slate-400'
            }`}
          >
            {comp?.autoCompanionEnabled ? 'שליחה חיה: מופעלת' : 'שליחה חיה: מושהית'}
          </button>

          <button
            type="button"
            onClick={() =>
              handleToggleConfig({
                autoModerationShieldEnabled: !comp?.autoModerationShieldEnabled,
              })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              comp?.autoModerationShieldEnabled
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-200'
                : 'bg-[#0B0E14] border-slate-700 text-slate-400'
            }`}
          >
            {comp?.autoModerationShieldEnabled ? 'מגן טרולים: אוטומטי' : 'מגן טרולים: כבוי'}
          </button>
        </div>
      </div>

      {bannerHe && (
        <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/35 text-xs text-emerald-200 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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

      {/* SECTION A: CENTRAL AI BRAIN COMMANDER + DEPLOY SQUAD TO LIVE */}
      <div className="rounded-xl bg-[#0B0E14] border border-amber-500/35 p-3.5 sm:p-4 space-y-3.5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              <span className="text-xs sm:text-sm font-bold text-slate-100">
                מרכז הפיקוד — סוכן ה-AI הראשי שמנהל את כל חשבונות המנחים
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              סטטוס מוח נוכחי: <span className="text-amber-200">{brain?.brainStatusHe}</span>
            </p>
          </div>

          <button
            type="button"
            disabled={trainingSquadNow}
            onClick={handleTrainSquadNow}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-500/20 border border-purple-400/50 text-purple-200 hover:bg-purple-500/30 disabled:opacity-50 flex items-center gap-1.5"
          >
            {trainingSquadNow ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            אמן עכשיו את כל {accounts.length} המנחים ממה שלמדנו מהצ׳אט
          </button>
        </div>

        {/* Row 1: Deploy Squad to Target TikTok Live Room */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-center">
          <div className="lg:col-span-5 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
            <input
              type="text"
              value={targetRoomInput}
              onChange={(e) => setTargetRoomInput(e.target.value)}
              placeholder="ל-איזה לייב לשלוח אותם? הזן @username..."
              className="w-full bg-[#131926] border border-[#222D42] rounded-lg px-3 py-2 text-xs text-slate-100"
            />
          </div>
          <div className="lg:col-span-3">
            <button
              type="button"
              disabled={deployingSquad}
              onClick={() => handleDeploySquadToLive()}
              className="w-full px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {deployingSquad ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Users className="w-3.5 h-3.5" />
              )}
              שלח את {enabledCount} המנחים ללייב זה
            </button>
          </div>
          <div className="lg:col-span-4 flex items-center gap-1.5 flex-wrap">
            {liveMonitoredRooms.length > 0 ? (
              <>
                <span className="text-[11px] text-slate-400">לייבים פעילים כעת:</span>
                {liveMonitoredRooms.slice(0, 4).map((rm) => (
                  <button
                    key={rm.username}
                    type="button"
                    onClick={() => {
                      setTargetRoomInput(rm.username);
                      void handleDeploySquadToLive(rm.username);
                    }}
                    className="px-2 py-1 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-[11px] font-mono"
                  >
                    @{rm.username}
                  </button>
                ))}
              </>
            ) : (
              <span className="text-[11px] text-slate-500">
                ניתן להקליד כל @username בטיקטוק לשליחה מיידית של הצוות
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Direct Natural Hebrew Command to the AI Brain */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="text"
            value={brainCommandInput}
            onChange={(e) => setBrainCommandInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSendBrainCommand();
              }
            }}
            placeholder='תן פקודה חופשית למוח (למשל: "שלח אותם ללייב של @romanioli3 ותפתחו שיחה שמדליקה הקשות וכפפה")...'
            className="flex-1 bg-[#131926] border border-amber-500/35 rounded-lg px-3 py-2 text-xs text-slate-100"
          />
          <button
            type="button"
            disabled={executingBrainCmd}
            onClick={() => handleSendBrainCommand()}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
          >
            {executingBrainCmd ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            בצע פקודת מוח לצוות
          </button>
        </div>

        {/* Quick Tactical Commands */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 ml-1">פקודות מהירות למוח:</span>
          {QUICK_BRAIN_COMMANDS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              disabled={executingBrainCmd}
              onClick={() => handleSendBrainCommand(q.commandHe)}
              className="px-2.5 py-1 rounded-lg bg-[#141C2B] border border-[#25324B] hover:border-amber-400/60 text-slate-200 text-[11px] transition-colors disabled:opacity-50"
            >
              {q.labelHe}
            </button>
          ))}
        </div>

        {/* Optional Custom Training Input + Last Training Summary */}
        <div className="pt-2 border-t border-[#1B2333] space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={trainingNotesInput}
              onChange={(e) => setTrainingNotesInput(e.target.value)}
              placeholder="רוצה ללמד אותם סגנון מיוחד או סלנג ספציפי? כתוב כאן ולחץ 'אמן עכשיו'..."
              className="flex-1 bg-[#131926] border border-[#1E2636] rounded-lg px-3 py-1.5 text-xs text-slate-100"
            />
          </div>
          {brain?.lastTrainingSummaryHe && (
            <p className="text-[11px] text-slate-300">
              <span className="text-purple-300 font-semibold">סיכום אימון אחרון של המוח: </span>
              {brain.lastTrainingSummaryHe}
            </p>
          )}
        </div>

        {/* Live Staggered Execution Plan Feed (recentOrders) */}
        {(brain?.recentOrders || []).length > 0 && (
          <div className="pt-2 border-t border-[#1B2333] space-y-2">
            <span className="text-xs font-bold text-amber-300 block">
              תוכנית החלוקה האחרונה של המוח בין חשבונות המנחים (תזמון אנושי מדורג):
            </span>
            {brain!.recentOrders.slice(0, 2).map((ord) => (
              <div
                key={ord.id}
                className="rounded-lg bg-[#111724] border border-[#222D42] p-2.5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-slate-100">
                    פקודה: "{ord.commandHe}"
                    {ord.targetRoom ? ` · יעד @${ord.targetRoom}` : ''}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {ord.source === 'AUTONOMOUS_BRAIN' ? 'יזום אוטונומית ע״י המוח' : 'פקודת במאי'} ·{' '}
                    {new Date(ord.ts).toLocaleTimeString('he-IL', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{ord.brainReasoningHe}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {ord.steps.map((st) => (
                    <div
                      key={`${ord.id}_${st.stepIndex}`}
                      className="rounded bg-[#0B0E14] border border-[#1C2536] px-2.5 py-1.5 flex items-start justify-between gap-2 text-[11px]"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-amber-300">
                          #{st.stepIndex} {st.accountDisplayName} (@{st.accountHandle})
                        </span>
                        <p className="text-slate-200 mt-0.5">"{st.lineHe}"</p>
                      </div>
                      <span
                        className={`shrink-0 font-mono text-[10px] ${
                          st.status === 'SENT' ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        {st.status === 'SENT' ? 'נשלח בלייב' : `בעוד ${st.delaySec} שנ׳`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION B: 6 CONNECTED & TRAINABLE TIKTOK MODERATOR ACCOUNTS */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="space-y-0.5">
            <span className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              1. צוות חשבונות הטיקטוק המחוברים ({accounts.length} מנחים ניתנים לאימון, עריכה ושליחה חיה)
            </span>
            <p className="text-[11px] text-slate-400">
              כל חשבון מחזיק אופי משלו ומשפטים שאומנו מהצ׳אט. ניתן לערוך את ה-@username של כל חשבון טיקטוק שלך או להוסיף חשבונות נוספים.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddAccount((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            חבר חשבון מנחה נוסף
          </button>
        </div>

        {showAddAccount && (
          <div className="rounded-xl bg-[#0B0E14] border border-emerald-500/40 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <input
              type="text"
              value={accHandle}
              onChange={(e) => setAccHandle(e.target.value)}
              placeholder="@username של חשבון הטיקטוק..."
              className="bg-[#131926] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
            />
            <input
              type="text"
              value={accDisplayName}
              onChange={(e) => setAccDisplayName(e.target.value)}
              placeholder="שם ותפקיד קצר (למשל: עומר · סנייפ)"
              className="bg-[#131926] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
            />
            <select
              value={accRole}
              onChange={(e) => setAccRole(e.target.value as CompanionRoleId)}
              className="bg-[#131926] border border-[#1E2636] rounded-lg px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="VIBE_HYPE">הרמת אווירה ושובר שתיקה</option>
              <option value="TACTICAL_SNIPE">קצין קרב, כפפה וסנייפ</option>
              <option value="COMBO_PACER">דחיפת הקשות וקומבו מהירות</option>
              <option value="SCOUT_SUPPORT">מלווה שיח ושיתופי לייב</option>
              <option value="WELCOME_VIP">קבלת פנים ותודות VIP</option>
              <option value="MOD_SHIELD">מגן צ׳אט וניקוי טרולים</option>
            </select>
            <input
              type="text"
              value={accToneHe}
              onChange={(e) => setAccToneHe(e.target.value)}
              placeholder="אופי / הוראות התנהגות לחשבון..."
              className="bg-[#131926] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={handleAddAccount}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            >
              חבר לצוות ה-AI
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {accounts.map((acc) => {
            const isEditing = editingAccountId === acc.id;
            const slotOauthUrl = oauthSlotUrls[acc.id];
            return (
              <div
                key={acc.id}
                className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 ${
                  acc.enabled
                    ? 'bg-[#0B0E14] border-[#222D42]'
                    : 'bg-[#090C12] border-[#182030] opacity-60'
                }`}
              >
                <div className="space-y-2">
                  {/* Top Account Row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <img
                        src={acc.avatarUrl}
                        alt={acc.displayName}
                        className="w-10 h-10 rounded-full border border-amber-500/40 shrink-0 object-cover"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-mono text-amber-400 font-bold">
                            #{acc.slotNumber || 1}
                          </span>
                          <span className="text-xs font-bold text-slate-100 truncate">
                            {acc.displayName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">
                          <span className="font-mono text-cyan-300">@{acc.handle}</span> ·{' '}
                          {ROLE_LABELS[acc.role] || acc.role}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                          אימון {acc.trainingLevel || 88}% · נשלחו {acc.messagesDispatched}
                          {acc.deployedRoomHandle ? ` · מוצב ב-@${acc.deployedRoomHandle}` : ''}
                          {acc.hasServerTikTokAuth ? ' · סשן ישיר מחובר' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          isEditing ? setEditingAccountId(null) : startEditingAccount(acc)
                        }
                        className="p-1.5 rounded border border-slate-700/80 text-slate-300 hover:text-amber-300 hover:border-amber-400/50"
                        title="ערוך פרטי חשבון טיקטוק"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAccount(acc.id, !acc.enabled)}
                        className={`px-2 py-1 rounded text-[10px] font-bold border ${
                          acc.enabled
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {acc.enabled ? 'פעיל' : 'מושהה'}
                      </button>
                      {accounts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="p-1 text-slate-500 hover:text-rose-400"
                          title="הסר חשבון"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Edit Form */}
                  {isEditing ? (
                    <div className="rounded-lg bg-[#131926] border border-amber-500/40 p-2.5 space-y-2">
                      <input
                        type="text"
                        value={editHandle}
                        onChange={(e) => setEditHandle(e.target.value)}
                        placeholder="@username בטיקטוק"
                        className="w-full bg-[#0B0E14] border border-[#222D42] rounded px-2 py-1 text-xs text-slate-100"
                      />
                      <input
                        type="text"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        placeholder="שם תצוגה"
                        className="w-full bg-[#0B0E14] border border-[#222D42] rounded px-2 py-1 text-xs text-slate-100"
                      />
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value as CompanionRoleId)}
                        className="w-full bg-[#0B0E14] border border-[#222D42] rounded px-2 py-1 text-xs text-slate-100"
                      >
                        <option value="TACTICAL_SNIPE">קצין קרב, כפפה וסנייפ</option>
                        <option value="VIBE_HYPE">הרמת אווירה ושובר שתיקה</option>
                        <option value="COMBO_PACER">דחיפת הקשות וקומבו מהירות</option>
                        <option value="SCOUT_SUPPORT">מלווה שיח ושיתופי לייב</option>
                        <option value="WELCOME_VIP">קבלת פנים ותודות VIP</option>
                        <option value="MOD_SHIELD">מגן צ׳אט וניקוי טרולים</option>
                      </select>
                      <input
                        type="text"
                        value={editToneHe}
                        onChange={(e) => setEditToneHe(e.target.value)}
                        placeholder="אופי והנחיות סגנון"
                        className="w-full bg-[#0B0E14] border border-[#222D42] rounded px-2 py-1 text-xs text-slate-100"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingAccountId(null)}
                          className="px-2.5 py-1 rounded text-[11px] text-slate-400 hover:text-slate-200"
                        >
                          ביטול
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditedAccount(acc.id)}
                          className="px-3 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[11px] hover:bg-amber-400"
                        >
                          שמור חשבון
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        <span className="text-purple-300 font-semibold">התמחות מאומנת: </span>
                        {acc.trainedSkillSummaryHe || acc.toneNotesHe}
                      </p>

                      {/* Trained Lines Ready for 1-Click Live Send */}
                      <div className="space-y-1">
                        {(acc.trainedLinesHe || []).slice(0, 2).map((line, lIdx) => (
                          <div
                            key={lIdx}
                            className="rounded bg-[#121826] border border-[#1C2536] px-2 py-1 flex items-center justify-between gap-2 text-[11px]"
                          >
                            <span className="text-slate-200 truncate">"{line}"</span>
                            <button
                              type="button"
                              onClick={() =>
                                handleDispatchNow({
                                  moment: 'DEAD_AIR_ICEBREAKER',
                                  preferredRole: acc.role,
                                  accountId: acc.id,
                                  customMessageHe: line,
                                })
                              }
                              className="text-emerald-300 hover:text-emerald-200 font-semibold shrink-0 flex items-center gap-1 text-[10px]"
                              title="שלח משפט זה עכשיו בלייב דרך חשבון זה"
                            >
                              <Send className="w-2.5 h-2.5" />
                              שלח
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-2 border-t border-[#182132] flex items-center justify-between gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      handleDispatchNow({
                        moment: 'DEAD_AIR_ICEBREAKER',
                        preferredRole: acc.role,
                        accountId: acc.id,
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25 font-semibold flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    שלח הודעה חיה מחשבון זה
                  </button>

                  {slotOauthUrl ? (
                    <a
                      href={slotOauthUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 hover:underline flex items-center gap-1 text-[10px]"
                    >
                      חבר ב-TikTok OAuth
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-[10px] text-slate-500 truncate">
                      {acc.lastOrderHe ? `אחרון: ${acc.lastOrderHe.slice(0, 24)}` : 'מוכן לפקודת המוח'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION C: CHAT MODERATION SHIELD ("מה שצריך להעיף מבחינת צ׳אט") */}
      <div className="rounded-xl bg-[#0B0E14] border border-rose-500/30 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold text-slate-100">
              2. מגן צ׳אט אוטומטי — זיהוי טרולים מחדר יריב, שליליות וספאם ({unresolvedFlagsCount} ממתינים)
            </span>
          </div>
          {sendTikTokEvent && (
            <button
              type="button"
              onClick={handleSimulateTrollTest}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3" />
              בדוק זיהוי ובלימת טרול חי
            </button>
          )}
        </div>

        {(comp?.moderationFlags || []).length === 0 ? (
          <p className="text-[11px] text-slate-400">
            הצ׳אט נקי כרגע — כשנכנסת הודעה מורידת מורל מחדר היריב או קישור ספאם, המוח מסמן את המשתמש להסרה ומפעיל את מגן החדר להצפה חיובית מתואמת.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {comp.moderationFlags.slice(0, 10).map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#141925] border border-rose-500/25 text-[11px]"
              >
                <div className="min-w-0">
                  <p className="text-slate-200 truncate">
                    <span className="font-bold text-rose-300">{f.offenderUser}</span> ·{' '}
                    <span className="font-mono text-slate-400">{f.sourceRoom}</span> ·{' '}
                    <span className="text-rose-200">{f.reasonHe}</span>
                  </p>
                  <p className="text-slate-400 truncate mt-0.5">הודעה שנחסמה: "{f.rawMessage}"</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {f.resolved ? (
                    <span className="text-emerald-300 text-[10px] font-semibold">
                      טופל + הוצף חיובי
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleResolveModerationFlag(f.id, true)}
                      className="px-2.5 py-1 rounded bg-rose-500 text-slate-950 font-bold text-[10px] hover:bg-rose-400"
                    >
                      העף + הצף חיובי
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION D: LEARNED PLAYBOOK & LIVE OUTBOX */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Learned Patterns from Live Chat */}
        <div className="rounded-xl bg-[#0B0E14] border border-[#1E2636] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              3. מאגר התבניות שהמוח למד מהצ׳אט החי ({(comp?.learnedPatterns || []).length})
            </span>
            <button
              type="button"
              disabled={learningPatternsNow}
              onClick={handleLearnPatternsOnly}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-500/20 border border-purple-400/40 text-purple-200 hover:bg-purple-500/30 disabled:opacity-50 flex items-center gap-1"
            >
              {learningPatternsNow ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              חלץ עוד תבניות מהצ׳אט
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {(comp?.learnedPatterns || []).slice(0, 8).map((pat) => (
              <div
                key={pat.id}
                className="rounded-lg bg-[#121826] border border-[#1E2636] p-2.5 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-amber-300 text-[11px] font-semibold">
                    {MOMENT_LABELS[pat.moment] || pat.moment} · {pat.sourceStreamHe}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleDispatchNow({
                        moment: pat.moment,
                        preferredRole: pat.role,
                        customMessageHe: pat.hebrewLines[0],
                      })
                    }
                    className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25 text-[10px] font-semibold flex items-center gap-1 shrink-0"
                  >
                    <Send className="w-2.5 h-2.5" />
                    שלח עכשיו
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">{pat.whatObservedHe}</p>
                <div className="space-y-1">
                  {pat.hebrewLines.slice(0, 2).map((line, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 bg-[#0B0E14] px-2 py-1 rounded text-[11px] text-slate-200"
                    >
                      <span className="truncate">"{line}"</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(`${pat.id}_${idx}`, line)}
                        className="text-slate-400 hover:text-amber-300 shrink-0"
                        title="העתק משפט"
                      >
                        {copiedId === `${pat.id}_${idx}` ? (
                          <span className="text-[10px] text-emerald-400">הועתק</span>
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Outbox Stream */}
        <div className="rounded-xl bg-[#0B0E14] border border-[#1E2636] p-3.5 space-y-2.5">
          <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
            <MessageSquarePlus className="w-3.5 h-3.5 text-emerald-400" />
            4. פיד שליחה חי של המנחים לצ׳אט הלייב
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={manualAccountId}
              onChange={(e) => setManualAccountId(e.target.value)}
              className="bg-[#131926] border border-[#1E2636] rounded-lg px-2 py-1.5 text-[11px] text-slate-100"
            >
              <option value="">בחירה אוטומטית ע״י המוח</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  #{acc.slotNumber} @{acc.handle}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={manualLineHe}
              onChange={(e) => setManualLineHe(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleDispatchNow({
                    moment: 'DEAD_AIR_ICEBREAKER',
                    preferredRole: 'VIBE_HYPE',
                    accountId: manualAccountId || undefined,
                    customMessageHe: manualLineHe.trim() || undefined,
                  });
                  setManualLineHe('');
                }
              }}
              placeholder="שלח שורה ישירה דרך אחד מחשבונות המנחים..."
              className="flex-1 min-w-[140px] bg-[#131926] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={() => {
                void handleDispatchNow({
                  moment: 'DEAD_AIR_ICEBREAKER',
                  preferredRole: 'VIBE_HYPE',
                  accountId: manualAccountId || undefined,
                  customMessageHe: manualLineHe.trim() || undefined,
                });
                setManualLineHe('');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            >
              שגר
            </button>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {(comp?.recentDispatches || []).length === 0 ? (
              <p className="text-[11px] text-slate-500 py-6 text-center">
                ברגע שתיתן פקודה למוח או שיזוהה אירוע בלייב (כפפה, ענן, מתנת VIP או טרול) — תראה כאן בזמן אמת כל שורה שנשלחת מחשבונות המנחים!
              </p>
            ) : (
              comp.recentDispatches.slice(0, 14).map((d) => (
                <div
                  key={d.id}
                  className="rounded-lg bg-[#121826] border border-[#1E2636] px-2.5 py-2 text-[11px] space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-amber-300 truncate">
                      {d.accountDisplayName}{' '}
                      <span className="font-mono text-[10px] text-slate-400">(@{d.accountHandle})</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {new Date(d.ts).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-100">"{d.messageTextHe}"</p>
                  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                    <span className="truncate">
                      {d.momentLabelHe}
                      {d.deliveryModeHe ? ` · ${d.deliveryModeHe}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(d.id, d.messageTextHe)}
                      className="text-cyan-300 hover:underline shrink-0"
                    >
                      {copiedId === d.id ? 'הועתק!' : 'העתק'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
