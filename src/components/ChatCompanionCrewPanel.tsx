import React, { useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Copy,
  Loader2,
  MessageSquarePlus,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  BattleState,
  ChatMomentType,
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

const ROLE_LABELS: Record<CompanionRoleId, { badgeHe: string; colorClass: string }> = {
  TACTICAL_SNIPE: {
    badgeHe: 'קצין קרב, כפפה וסנייפ',
    colorClass: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  },
  VIBE_HYPE: {
    badgeHe: 'הרמת אווירה ושובר שתיקה',
    colorClass: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
  },
  MOD_SHIELD: {
    badgeHe: 'מגן צ׳אט וניקוי טרולים/ספאם',
    colorClass: 'bg-rose-500/15 border-rose-500/40 text-rose-300',
  },
  WELCOME_VIP: {
    badgeHe: 'קבלת פנים ותודות VIP לתומכים',
    colorClass: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
  },
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

export const ChatCompanionCrewPanel: React.FC<ChatCompanionCrewPanelProps> = ({
  battleState,
  refreshState,
  sendTikTokEvent,
}) => {
  const comp = battleState.chatCompanion;

  const [showAddAccount, setShowAddAccount] = useState<boolean>(false);
  const [accHandle, setAccHandle] = useState<string>('');
  const [accDisplayName, setAccDisplayName] = useState<string>('');
  const [accRole, setAccRole] = useState<CompanionRoleId>('VIBE_HYPE');
  const [accBridgeTag, setAccBridgeTag] = useState<string>('');
  const [accToneHe, setAccToneHe] = useState<string>('');

  const [customSampleForLearn, setCustomSampleForLearn] = useState<string>('');
  const [learningNow, setLearningNow] = useState<boolean>(false);
  const [manualLineHe, setManualLineHe] = useState<string>('');
  const [manualRole, setManualRole] = useState<CompanionRoleId>('VIBE_HYPE');
  const [bannerHe, setBannerHe] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleToggleConfig = async (patch: {
    autoCompanionEnabled?: boolean;
    autoModerationShieldEnabled?: boolean;
    autoLearnFromLiveChat?: boolean;
  }) => {
    await fetch('/api/chat-companion/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await refreshState();
  };

  const handleAddAccount = async () => {
    if (!accHandle.trim() && !accDisplayName.trim()) {
      setBannerHe('הזן שם משתמש או כינוי לחשבון המלווה החדש.');
      return;
    }
    await fetch('/api/chat-companion/account/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: accHandle.trim(),
        displayName: accDisplayName.trim() || accHandle.trim(),
        role: accRole,
        externalWebhookOrWsTag: accBridgeTag.trim() || undefined,
        toneNotesHe: accToneHe.trim() || undefined,
        enabled: true,
      }),
    });
    setAccHandle('');
    setAccDisplayName('');
    setAccBridgeTag('');
    setAccToneHe('');
    setShowAddAccount(false);
    await refreshState();
    setBannerHe('חשבון מנחה מלווה נוסף לצוות ומוכן לחיבור והפעלה בצ׳אט!');
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

  const handleLearnFromChatNow = async () => {
    setLearningNow(true);
    setBannerHe(null);
    try {
      const resp = await fetch('/api/chat-companion/learn-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customChatSample: customSampleForLearn.trim() || undefined }),
      });
      const json = await resp.json();
      await refreshState();
      if (resp.ok) {
        setCustomSampleForLearn('');
        setBannerHe(json.summaryInsightHe || 'זוקקו תבניות חדשות של מנחים מלווים מהצ׳אט החי!');
      } else {
        setBannerHe(json.error || 'שגיאה בלמידת צ׳אט.');
      }
    } catch {
      setBannerHe('שגיאת תקשורת בלמידת צ׳אט.');
    } finally {
      setLearningNow(false);
    }
  };

  const handleDispatchNow = async (opts: {
    moment: ChatMomentType;
    preferredRole: CompanionRoleId;
    customMessageHe?: string;
  }) => {
    const resp = await fetch('/api/chat-companion/dispatch-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    });
    const json = await resp.json();
    await refreshState();
    if (json.dispatched) {
      setBannerHe(
        `נשלח דרך ${json.dispatched.accountDisplayName}: "${json.dispatched.messageTextHe}"`
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
    <div className="rounded-xl border border-emerald-500/35 bg-[#101622] p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm sm:text-base font-bold text-slate-100">
              מעקב צ׳אט חי, למידת מנחים מלווים וצוות חשבונות אווירה והגנה
            </h3>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono">
              {(comp?.accounts || []).filter((a) => a.enabled).length} חשבונות מלווים מוכנים
            </span>
          </div>
          <p className="text-xs text-slate-400">
            לומד איך מנחים מלווים ומודרטורים מרימים צ׳אט בלייבים חזקים, מזהה הודעות שליליות/טרולים/ספאם שצריך להעיף בזמן אמת, ומנהל סלוטים לחשבונות מלווים שיצטרפו בלייב וייצרו צ׳אט אווירה מתוזמן.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
            {comp?.autoCompanionEnabled ? 'צ׳אט אווירה אוטומטי: פעיל' : 'צ׳אט אווירה: ידני'}
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
            {comp?.autoModerationShieldEnabled
              ? 'סינון טרולים וספאם: אוטומטי'
              : 'סינון טרולים: כבוי'}
          </button>
        </div>
      </div>

      {/* Live Chat Pulse Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
        <div className="rounded-lg bg-[#0B0E14] border border-[#1E2636] p-2.5">
          <span className="text-[11px] text-slate-400 block">קצב צ׳אט חי בחדר</span>
          <span className="text-base font-bold font-mono tabular-nums text-emerald-300">
            {comp?.chatVelocityPerMin || 0} הודעות/דקה
          </span>
        </div>
        <div className="rounded-lg bg-[#0B0E14] border border-[#1E2636] p-2.5 md:col-span-2">
          <span className="text-[11px] text-slate-400 block">אבחון אווירה ולמידת צ׳אט נוכחית</span>
          <span className="text-xs font-semibold text-slate-100 block truncate mt-0.5">
            {comp?.detectedRoomMoodHe || 'עוקב אחר הודעות צ׳אט חיות...'}
          </span>
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

      {/* 1. Multi-Account Companion Crew Slots */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5 text-amber-400" />
            1. צוות חשבונות מנחים מלווים (מוכן לחיבור חשבונות בלייב ליצירת אווירה והגנה)
          </span>
          <button
            type="button"
            onClick={() => setShowAddAccount((v) => !v)}
            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            הוסף חשבון מלווה
          </button>
        </div>

        {showAddAccount && (
          <div className="rounded-xl bg-[#0B0E14] border border-amber-500/40 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            <input
              type="text"
              value={accHandle}
              onChange={(e) => setAccHandle(e.target.value)}
              placeholder="@username בטיקטוק..."
              className="bg-[#131926] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
            />
            <input
              type="text"
              value={accDisplayName}
              onChange={(e) => setAccDisplayName(e.target.value)}
              placeholder="שם תצוגה (למשל: דור · מרים אווירה)"
              className="bg-[#131926] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
            />
            <select
              value={accRole}
              onChange={(e) => setAccRole(e.target.value as CompanionRoleId)}
              className="bg-[#131926] border border-[#1E2636] rounded-lg px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="VIBE_HYPE">הרמת אווירה ושובר שתיקה</option>
              <option value="TACTICAL_SNIPE">קצין קרב, כפפה וסנייפ</option>
              <option value="MOD_SHIELD">מגן צ׳אט וניקוי ספאם/טרולים</option>
              <option value="WELCOME_VIP">קבלת פנים ותודות VIP</option>
            </select>
            <input
              type="text"
              value={accToneHe}
              onChange={(e) => setAccToneHe(e.target.value)}
              placeholder="סגנון דיבור / הערות..."
              className="bg-[#131926] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={handleAddAccount}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400"
            >
              שמור חשבון בצוות
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {(comp?.accounts || []).map((acc) => {
            const roleMeta = ROLE_LABELS[acc.role];
            return (
              <div
                key={acc.id}
                className={`rounded-xl border p-3 flex items-start justify-between gap-3 ${
                  acc.enabled
                    ? 'bg-[#0B0E14] border-[#222D42]'
                    : 'bg-[#090C12] border-[#182030] opacity-60'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <img
                    src={acc.avatarUrl}
                    alt={acc.displayName}
                    className="w-9 h-9 rounded-full border border-amber-500/40 shrink-0 object-cover"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-100">{acc.displayName}</span>
                      <span className="text-[10px] font-mono text-slate-400">@{acc.handle}</span>
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] ${roleMeta.colorClass}`}>
                        {roleMeta.badgeHe}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{acc.toneNotesHe}</p>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                      <span>הודעות שנשלחו: {acc.messagesDispatched}</span>
                      {acc.moderationsTriggered > 0 && (
                        <span className="text-rose-300">סינונים: {acc.moderationsTriggered}</span>
                      )}
                      <span className="text-cyan-400">{acc.externalWebhookOrWsTag}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleAccount(acc.id, !acc.enabled)}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${
                      acc.enabled
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {acc.enabled ? 'פעיל' : 'כבוי'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(acc.id)}
                    className="p-1 text-slate-500 hover:text-rose-400"
                    title="הסר חשבון"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Chat Moderation Shield ("מה שצריך להעיף מבחינת צ׳אט") */}
      <div className="rounded-xl bg-[#0B0E14] border border-rose-500/30 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold text-slate-100">
              2. רדאר ניקוי צ׳אט והגנה מטרולים / ספאם ({unresolvedFlagsCount} ממתינים לטיפול)
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
            הצ׳אט נקי כרגע — ברגע שתיכנס הודעת יריב מורידת מורל, קישור ספאם או קללה, המערכת תסמן את המשתמש להסרה ותציף מיד משפט אווירה חיובי מהמנחים המלווים.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {comp.moderationFlags.slice(0, 10).map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#141925] border border-rose-500/25 text-[11px]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-rose-300">{f.offenderUser}</span>
                    <span className="text-slate-500 font-mono text-[10px]">({f.sourceRoom})</span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-200 text-[10px]">
                      {f.reasonHe}
                    </span>
                  </div>
                  <p className="text-slate-300 truncate mt-0.5">הודעה שנחסמה: "{f.rawMessage}"</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {f.resolved ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px]">
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

      {/* 3. AI Moderator Learning & Learned Vibe Playbooks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#0B0E14] border border-[#1E2636] p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              3. תבניות אווירה שנלמדו ממנחים מלווים בלייבים
            </span>
            <button
              type="button"
              disabled={learningNow}
              onClick={handleLearnFromChatNow}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-500/20 border border-purple-400/40 text-purple-200 hover:bg-purple-500/30 disabled:opacity-50 flex items-center gap-1"
            >
              {learningNow ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              למד עכשיו מהצ׳אט החי (AI)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customSampleForLearn}
              onChange={(e) => setCustomSampleForLearn(e.target.value)}
              placeholder="הדבק אופציונלית דוגמת צ׳אט או סגנון מנחה ללמידה..."
              className="flex-1 bg-[#131926] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
            />
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {(comp?.learnedPatterns || []).slice(0, 8).map((pat) => (
              <div
                key={pat.id}
                className="rounded-lg bg-[#121826] border border-[#1E2636] p-2.5 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-semibold">
                    {MOMENT_LABELS[pat.moment] || pat.moment}
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
                    className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25 text-[10px] font-semibold flex items-center gap-1"
                  >
                    <Send className="w-2.5 h-2.5" />
                    שלח עכשיו לצ׳אט
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

        {/* 4. Manual & Automatic Companion Dispatch Outbox */}
        <div className="rounded-xl bg-[#0B0E14] border border-[#1E2636] p-3 space-y-2.5">
          <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
            <MessageSquarePlus className="w-3.5 h-3.5 text-emerald-400" />
            4. תור שיגור חי של המנחים המלווים (פיד הודעות והגנות)
          </span>

          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={manualRole}
              onChange={(e) => setManualRole(e.target.value as CompanionRoleId)}
              className="bg-[#131926] border border-[#1E2636] rounded-lg px-2 py-1.5 text-[11px] text-slate-100"
            >
              <option value="VIBE_HYPE">מרים אווירה</option>
              <option value="TACTICAL_SNIPE">קצין סנייפ וכפפה</option>
              <option value="WELCOME_VIP">תודות VIP</option>
              <option value="MOD_SHIELD">מגן צ׳אט</option>
            </select>
            <input
              type="text"
              value={manualLineHe}
              onChange={(e) => setManualLineHe(e.target.value)}
              placeholder="שלח משפט יזום דרך חשבון מלווה..."
              className="flex-1 min-w-[140px] bg-[#131926] border border-[#1E2636] rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
            />
            <button
              type="button"
              onClick={() => {
                void handleDispatchNow({
                  moment: 'DEAD_AIR_ICEBREAKER',
                  preferredRole: manualRole,
                  customMessageHe: manualLineHe.trim() || undefined,
                });
                setManualLineHe('');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            >
              שגר
            </button>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {(comp?.recentDispatches || []).length === 0 ? (
              <p className="text-[11px] text-slate-500 py-4 text-center">
                ברגע שייפתח ענן, כפפה, מתנת לווייתן או טרול בצ׳אט — המנחים המלווים ישגרו כאן הודעות אווירה מתוזמנות בזמן אמת!
              </p>
            ) : (
              comp.recentDispatches.slice(0, 12).map((d) => (
                <div
                  key={d.id}
                  className="rounded-lg bg-[#121826] border border-[#1E2636] px-2.5 py-2 text-[11px] space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-amber-300">
                      {d.accountDisplayName}{' '}
                      <span className="font-mono text-[10px] text-slate-400">(@{d.accountHandle})</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(d.ts).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-100">"{d.messageTextHe}"</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{d.momentLabelHe}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(d.id, d.messageTextHe)}
                      className="text-cyan-300 hover:underline"
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
