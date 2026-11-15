import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Loader2,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import {
  AiCrewArchetypeId,
  LiveStreamDossier,
  PhoneAndAccountsBridgeState,
  UnifiedManagedTikTokAccount,
} from '../types/boosteraIntelligence';

interface UnifiedTikTokAccountsPhonePanelProps {
  bridge?: PhoneAndAccountsBridgeState;
  streams?: LiveStreamDossier[];
  fallbackTargetRoom?: string | null;
  onUpdated?: () => Promise<void>;
}

const CREW_ROLE_LABELS_HE: Record<AiCrewArchetypeId, string> = {
  CONVERSATION_HOST: 'מנחה 1 · מארח שיחה (Conversation Host)',
  COMMUNITY_MANAGER: 'מנחה 2 · מנהל קהילה (Community Manager)',
  BATTLE_ANALYST: 'מנחה 3 · אנליסט קרב (Battle Analyst)',
  CREATIVE_ENGAGEMENT: 'מנחה 4 · מעורבות ותוכן (Creative Engagement)',
};

const ALL_CREW_ROLES: AiCrewArchetypeId[] = [
  'CONVERSATION_HOST',
  'COMMUNITY_MANAGER',
  'BATTLE_ANALYST',
  'CREATIVE_ENGAGEMENT',
];

interface DraftRowSelection {
  selected: boolean;
  crewRole: AiCrewArchetypeId;
  handle: string;
  displayName: string;
  geelarkDeviceId: string;
}

export const UnifiedTikTokAccountsPhonePanel: React.FC<UnifiedTikTokAccountsPhonePanelProps> = ({
  bridge: externalBridge,
  streams = [],
  fallbackTargetRoom = null,
  onUpdated,
}) => {
  const [localBridge, setLocalBridge] = useState<PhoneAndAccountsBridgeState | null>(externalBridge || null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(!externalBridge);
  const [verifyingNow, setVerifyingNow] = useState<boolean>(false);
  const [savingCrew, setSavingCrew] = useState<boolean>(false);
  const [assigningLive, setAssigningLive] = useState<boolean>(false);
  const [connectingAccId, setConnectingAccId] = useState<string | null>(null);
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [copiedUri, setCopiedUri] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: 'ok' | 'warn';
    textHe: string;
  } | null>(null);

  const activeBridge = externalBridge || localBridge;

  const [targetLiveInput, setTargetLiveInput] = useState<string>(
    activeBridge?.activeTargetLive || fallbackTargetRoom || streams[0]?.creatorUsername || ''
  );

  const [draftMap, setDraftMap] = useState<Record<string, DraftRowSelection>>({});

  const syncDraftFromBridge = useCallback((b: PhoneAndAccountsBridgeState) => {
    const next: Record<string, DraftRowSelection> = {};
    for (const acc of b.accounts) {
      const defaultRole =
        acc.assignedCrewRole ||
        ALL_CREW_ROLES[(Math.max(1, acc.slotNumber) - 1) % ALL_CREW_ROLES.length];
      next[acc.accountId] = {
        selected: acc.selectedForChatCrew,
        crewRole: defaultRole,
        handle: acc.handle,
        displayName: acc.displayName,
        geelarkDeviceId: acc.geelarkDeviceId || '',
      };
    }
    setDraftMap(next);
    if (b.activeTargetLive) {
      setTargetLiveInput((prev) => prev || b.activeTargetLive || '');
    }
  }, []);

  const fetchBridgeStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/accounts-bridge/status');
      const data = await resp.json();
      if (data?.bridge) {
        setLocalBridge(data.bridge);
        syncDraftFromBridge(data.bridge);
      }
    } catch {
      // Non-blocking
    } finally {
      setLoadingStatus(false);
    }
  }, [syncDraftFromBridge]);

  useEffect(() => {
    if (externalBridge) {
      setLocalBridge(externalBridge);
      if (Object.keys(draftMap).length === 0) {
        syncDraftFromBridge(externalBridge);
      }
      setLoadingStatus(false);
    } else {
      void fetchBridgeStatus();
    }
  }, [externalBridge, fetchBridgeStatus, syncDraftFromBridge, draftMap]);

  const handleVerifyLiveConnections = useCallback(async () => {
    setVerifyingNow(true);
    setFeedbackBanner(null);
    try {
      const resp = await fetch('/api/accounts-bridge/verify', { method: 'POST' });
      const data = await resp.json();
      if (data?.bridge) {
        setLocalBridge(data.bridge);
        syncDraftFromBridge(data.bridge);
        const b: PhoneAndAccountsBridgeState = data.bridge;
        if (b.connectedAccountsCount > 0) {
          setFeedbackBanner({
            tone: 'ok',
            textHe: `בדיקת החיבור הושלמה: ${b.connectedAccountsCount} חשבונות TikTok מאומתים ומחוברים (${b.activeInLiveCount} פעילים בלייב).`,
          });
        } else {
          setFeedbackBanner({
            tone: 'warn',
            textHe:
              'בדיקת החיבור בוצעה בכנות: אף טלפון ענן או חשבון OAuth אינו מחובר כרגע. ראה פירוט מלא של מה שחסר למטה — המערכת כולה ממשיכה לפעול ללא חסימה.',
          });
        }
      }
      if (onUpdated) await onUpdated();
    } catch {
      setFeedbackBanner({
        tone: 'warn',
        textHe: 'לא ניתן להשלים את בדיקת החיבור כרגע — המערכת ממשיכה לפעול כרגיל.',
      });
    } finally {
      setVerifyingNow(false);
    }
  }, [onUpdated, syncDraftFromBridge]);

  // Listen for OAuth popup completion via postMessage (iframe-compliant)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      if (
        origin &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        origin !== window.location.origin
      ) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        void handleVerifyLiveConnections();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [handleVerifyLiveConnections]);

  const selectedCount = Object.values(draftMap).filter((d) => d.selected).length;

  const toggleAccountSelected = (acc: UnifiedManagedTikTokAccount) => {
    setDraftMap((prev) => {
      const cur = prev[acc.accountId] || {
        selected: acc.selectedForChatCrew,
        crewRole: acc.assignedCrewRole || 'CONVERSATION_HOST',
        handle: acc.handle,
        displayName: acc.displayName,
        geelarkDeviceId: acc.geelarkDeviceId || '',
      };
      const nextSelected = !cur.selected;
      if (nextSelected) {
        const currentlySelectedCount = Object.values(prev).filter((v) => v.selected).length;
        if (currentlySelectedCount >= 4) {
          setFeedbackBanner({
            tone: 'warn',
            textHe: 'ניתן לבחור עד 4 חשבונות לתפקידי מנחי הצ׳אט בו-זמנית לכל לייב (בטל חשבון אחר כדי להחליף).',
          });
          return prev;
        }
        const usedRoles = new Set(
          Object.entries(prev)
            .filter(([k, v]) => k !== acc.accountId && v.selected)
            .map(([, v]) => v.crewRole)
        );
        const freeRole = ALL_CREW_ROLES.find((r) => !usedRoles.has(r)) || cur.crewRole;
        return {
          ...prev,
          [acc.accountId]: { ...cur, selected: true, crewRole: freeRole },
        };
      }
      return {
        ...prev,
        [acc.accountId]: { ...cur, selected: false },
      };
    });
  };

  const updateDraftField = (
    accountId: string,
    patch: Partial<DraftRowSelection>
  ) => {
    setDraftMap((prev) => {
      const cur = prev[accountId];
      if (!cur) return prev;
      return {
        ...prev,
        [accountId]: { ...cur, ...patch },
      };
    });
  };

  const handleSaveCrewSelection = async () => {
    if (!activeBridge) return;
    setSavingCrew(true);
    setFeedbackBanner(null);
    try {
      const selections = activeBridge.accounts.map((acc) => {
        const d = draftMap[acc.accountId];
        return {
          accountId: acc.accountId,
          slotNumber: acc.slotNumber,
          handle: d?.handle ?? acc.handle,
          displayName: d?.displayName ?? acc.displayName,
          geelarkDeviceId: d?.geelarkDeviceId || null,
          selected: d ? d.selected : acc.selectedForChatCrew,
          crewRole: d ? d.crewRole : acc.assignedCrewRole,
        };
      });

      const resp = await fetch('/api/accounts-bridge/select-crew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      });
      const data = await resp.json();
      if (data?.bridge) {
        setLocalBridge(data.bridge);
        syncDraftFromBridge(data.bridge);
        setEditingAccId(null);
        setFeedbackBanner({
          tone: 'ok',
          textHe: `נשמרו ${data.selectedCrewCount} חשבונות TikTok לתפקידי מנחי הצ׳אט וסונכרנו עם המוח המרכזי.`,
        });
      }
      if (onUpdated) await onUpdated();
    } catch {
      setFeedbackBanner({
        tone: 'warn',
        textHe: 'שגיאה בשמירת בחירת המנחים.',
      });
    } finally {
      setSavingCrew(false);
    }
  };

  const handleAssignToLive = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTarget = targetLiveInput.trim().replace(/^@+/, '');
    if (!cleanTarget) {
      setFeedbackBanner({
        tone: 'warn',
        textHe: 'בחר לייב מהרשימה או הזן @username של שידור חי לשיוך המנחים הנבחרים.',
      });
      return;
    }
    setAssigningLive(true);
    setFeedbackBanner(null);
    try {
      const resp = await fetch('/api/accounts-bridge/assign-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLiveHandle: cleanTarget,
          onlySelectedCrew: true,
        }),
      });
      const data = await resp.json();
      if (data?.bridge) {
        setLocalBridge(data.bridge);
        syncDraftFromBridge(data.bridge);
        setFeedbackBanner({
          tone: 'ok',
          textHe: data.roomOnline
            ? `שויכו ${data.assignedCount} מנחי הצ׳אט לשידור החי הפעיל @${data.targetLive}.`
            : `שויכו ${data.assignedCount} מנחי הצ׳אט אל @${data.targetLive} (החשבון יתעדכן ל"פעיל בלייב" ברגע שחיבור הטלפון/האימות מאומת).`,
        });
      }
      if (onUpdated) await onUpdated();
    } catch {
      setFeedbackBanner({
        tone: 'warn',
        textHe: 'שגיאה בשיוך המנחים ללייב.',
      });
    } finally {
      setAssigningLive(false);
    }
  };

  const handleConnectViaCloudPhone = async (acc: UnifiedManagedTikTokAccount) => {
    setConnectingAccId(acc.accountId);
    setFeedbackBanner(null);
    try {
      const d = draftMap[acc.accountId];
      const resp = await fetch('/api/accounts-bridge/connect-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: acc.accountId,
          slotNumber: acc.slotNumber,
          action: 'VERIFY_AND_OPEN_PHONE',
          handle: d?.handle ?? acc.handle,
          displayName: d?.displayName ?? acc.displayName,
          geelarkDeviceId: d?.geelarkDeviceId || acc.geelarkDeviceId || null,
        }),
      });
      const data = await resp.json();
      if (data?.bridge) {
        setLocalBridge(data.bridge);
        syncDraftFromBridge(data.bridge);
      }
      setFeedbackBanner({
        tone: data?.ok ? 'ok' : 'warn',
        textHe:
          data?.messageHe ||
          'חיבור הטלפון נבדק — ראה פירוט של מה שחסר בחלק העליון (המערכת ממשיכה לפעול ללא חסימה).',
      });
      if (onUpdated) await onUpdated();
    } catch {
      setFeedbackBanner({
        tone: 'warn',
        textHe: 'שגיאת תקשורת בבדיקת טלפון הענן.',
      });
    } finally {
      setConnectingAccId(null);
    }
  };

  const handleSaveSingleAccountProfile = async (acc: UnifiedManagedTikTokAccount) => {
    setConnectingAccId(acc.accountId);
    try {
      const d = draftMap[acc.accountId];
      const resp = await fetch('/api/accounts-bridge/connect-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: acc.accountId,
          slotNumber: acc.slotNumber,
          action: 'SAVE_ACCOUNT_PROFILE',
          handle: d?.handle ?? acc.handle,
          displayName: d?.displayName ?? acc.displayName,
          geelarkDeviceId: d?.geelarkDeviceId || null,
        }),
      });
      const data = await resp.json();
      if (data?.bridge) {
        setLocalBridge(data.bridge);
        syncDraftFromBridge(data.bridge);
      }
      setEditingAccId(null);
      setFeedbackBanner({
        tone: 'ok',
        textHe: data?.messageHe || `פרטי @${d?.handle || acc.handle} נשמרו.`,
      });
      if (onUpdated) await onUpdated();
    } finally {
      setConnectingAccId(null);
    }
  };

  const handleConnectSecureOAuth = async (acc: UnifiedManagedTikTokAccount) => {
    setConnectingAccId(acc.accountId);
    setFeedbackBanner(null);
    try {
      const origin = encodeURIComponent(window.location.origin);
      const slotId = encodeURIComponent(acc.accountId);
      const resp = await fetch(`/api/auth/tiktok/url?origin=${origin}&slotId=${slotId}`);
      const data = await resp.json();

      if (!data?.configured || !data?.url) {
        setFeedbackBanner({
          tone: 'warn',
          textHe:
            data?.messageHe ||
            'להתחברות TikTok OAuth ישירה: הגדר TIKTOK_CLIENT_KEY ו-TIKTOK_CLIENT_SECRET ב-Settings > Secrets והוסף את כתובת ה-Redirect URI המוצגת למטה (אופציונלי — ניתן לחבר גם דרך מערכת הטלפונים).',
        });
        return;
      }

      const popup = window.open(data.url, 'tiktok_oauth_secure', 'width=600,height=720');
      if (!popup) {
        setFeedbackBanner({
          tone: 'warn',
          textHe: 'הדפדפן חסם את חלון ההתחברות המאובטח — אשר חלונות קופצים (Popups) ונסה שוב.',
        });
      } else {
        setFeedbackBanner({
          tone: 'ok',
          textHe: `נפתח חלון אימות רשמי ומאובטח של TikTok עבור @${acc.handle} — הסשן יישמר אוטומטית בשרת בסיום האישור.`,
        });
      }
    } catch {
      setFeedbackBanner({
        tone: 'warn',
        textHe: 'לא ניתן לפתוח חיבור OAuth כרגע.',
      });
    } finally {
      setConnectingAccId(null);
    }
  };

  const handleCopyRedirectUri = async (uri: string) => {
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedUri(true);
      setTimeout(() => setCopiedUri(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  if (loadingStatus && !activeBridge) {
    return (
      <section className="border border-[#1E2636] bg-[#0F1520] rounded-xl p-6 text-xs text-slate-300 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
        <span>בודק חיבורים קיימים למערכת הטלפונים ולחשבונות ה-TikTok...</span>
      </section>
    );
  }

  if (!activeBridge) return null;

  const { phoneSystem, oauthSystem, wsBridgeSystem, accounts } = activeBridge;
  const showMissingChecklist = !phoneSystem.connected || !oauthSystem.configured;

  return (
    <section className="border border-[#1E2636] bg-[#0F1520] rounded-xl p-6 space-y-6" dir="rtl">
      {/* Header & Honest Connection Verification Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1E2636] pb-4">
        <div className="space-y-1 max-w-3xl">
          <h2 className="text-lg font-semibold text-slate-100">
            מערך חשבונות TikTok וטלפוני הענן המחוברים — בחירת 3–4 מנחי צ׳אט ושיוך ללייב
          </h2>
          <p className="text-xs text-slate-400">
            מחובר ישירות למנוע החשבונות והטלפונים הקיים שלך ללא הזנה ידנית של SESSION או TARGET לכל מנחה.
            חשבונות מוצגים כ&quot;מחובר&quot; אך ורק לאחר אימות חי בשרת, וכל החיבורים אופציונליים ואינם חוסמים את BOOSTERA.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleVerifyLiveConnections()}
          disabled={verifyingNow}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#182234] hover:bg-[#223049] border border-[#2A3954] text-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${verifyingNow ? 'animate-spin text-amber-400' : 'text-cyan-400'}`} />
          בדוק חיבור אמיתי עכשיו
        </button>
      </div>

      {/* Live Connection Status Summary Strip (Clean Unboxed Typography & Dividers) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
        <div className="border border-[#1E2636] bg-[#0B0E14] rounded-lg p-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              מערכת טלפוני הענן (GeeLark)
            </span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                phoneSystem.connected ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {phoneSystem.connected ? 'מחובר ומאומת' : 'מנותק (אופציונלי)'}
            </span>
          </div>
          <p className="text-slate-400">{phoneSystem.statusSummaryHe}</p>
          <div className="text-slate-500 font-mono tabular-nums">
            מכשירים שזוהו: {phoneSystem.devices.length} · פעילים (RUNNING):{' '}
            {phoneSystem.devices.filter((d) => d.status === 'RUNNING').length}
          </div>
        </div>

        <div className="border border-[#1E2636] bg-[#0B0E14] rounded-lg p-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              חיבור TikTok OAuth מאובטח
            </span>
            <span
              className={`font-mono tabular-nums font-semibold ${
                oauthSystem.configured ? 'text-emerald-300' : 'text-slate-400'
              }`}
            >
              {oauthSystem.configured ? 'מוכן לאימות' : 'טרם הוגדר בשרת'}
            </span>
          </div>
          <p className="text-slate-400">{oauthSystem.statusSummaryHe}</p>
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="font-mono text-slate-500 truncate" title={oauthSystem.redirectUri}>
              Callback: {oauthSystem.redirectUri}
            </span>
            <button
              type="button"
              onClick={() => void handleCopyRedirectUri(oauthSystem.redirectUri)}
              className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 shrink-0"
            >
              <Copy className="w-3 h-3" />
              {copiedUri ? 'הועתק' : 'העתק'}
            </button>
          </div>
        </div>

        <div className="border border-[#1E2636] bg-[#0B0E14] rounded-lg p-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              סיכום חשבונות ומנחי צ׳אט
            </span>
            <span className="font-mono tabular-nums font-semibold text-slate-200">
              {activeBridge.connectedAccountsCount}/{accounts.length} מחוברים
            </span>
          </div>
          <div className="text-slate-300 font-mono tabular-nums">
            נבחרו למנחים: {selectedCount} (מומלץ 3–4) · פעילים בלייב: {activeBridge.activeInLiveCount}
          </div>
          <div className="text-slate-400">
            {activeBridge.activeTargetLive
              ? `לייב משויך נוכחי: @${activeBridge.activeTargetLive} · ${wsBridgeSystem.statusSummaryHe}`
              : `טרם שויך לייב יעד · ${wsBridgeSystem.statusSummaryHe}`}
          </div>
        </div>
      </div>

      {/* Exact Missing Prerequisites Diagnostic (Shown Honestly When Phone/OAuth Is Not Yet Connected) */}
      {showMissingChecklist && (
        <div className="border border-[#26334D] bg-[#0B0E14] rounded-lg p-4 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-amber-200">
              אבחון חיבור כנה — מה חסר כרגע לחיבור טלפוני הענן או אימות ה-OAuth (אופציונלי, אינו חוסם את BOOSTERA):
            </span>
            <span className="text-slate-400">
              סשנים מנוהלים אוטומטית בשרת בלבד ללא שדות SESSION/TARGET ידניים
            </span>
          </div>
          <ul className="space-y-1 text-slate-300 list-disc pr-5">
            {phoneSystem.missingPrerequisitesHe.map((item, idx) => (
              <li key={`pm_${idx}`}>{item}</li>
            ))}
            {oauthSystem.missingPrerequisitesHe.map((item, idx) => (
              <li key={`om_${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Bar: Assign Selected 3–4 Moderators to a Specific Live Stream + Save Crew */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-y border-[#1E2636] py-4 text-xs">
        <form onSubmit={handleAssignToLive} className="flex flex-wrap items-center gap-2 flex-1">
          <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-slate-300 font-medium whitespace-nowrap">שייך מנחים נבחרים ללייב:</span>

          {streams.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setTargetLiveInput(e.target.value);
              }}
              className="bg-[#0B0E14] border border-[#26334D] rounded-lg px-2.5 py-2 text-slate-200"
            >
              <option value="">בחר מתוך לייבים מנוטרים ({streams.length})...</option>
              {streams.map((s) => (
                <option key={s.streamId} value={s.creatorUsername}>
                  @{s.creatorUsername} ({s.connected ? 'LIVE' : 'מעקב'})
                </option>
              ))}
            </select>
          )}

          <input
            type="text"
            value={targetLiveInput}
            onChange={(e) => setTargetLiveInput(e.target.value)}
            placeholder="או הזן @username של לייב ב-TikTok..."
            className="flex-1 min-w-[200px] bg-[#0B0E14] border border-[#26334D] rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
          />

          <button
            type="submit"
            disabled={assigningLive}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {assigningLive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
            שייך ללייב
          </button>
        </form>

        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`font-mono tabular-nums ${
              selectedCount >= 3 && selectedCount <= 4 ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            נבחרו {selectedCount}/4 מנחי צ׳אט
          </span>
          <button
            type="button"
            onClick={() => void handleSaveCrewSelection()}
            disabled={savingCrew}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {savingCrew ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            שמור בחירת מנחים ותפקידים
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div
          className={`px-4 py-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
            feedbackBanner.tone === 'ok'
              ? 'bg-[#0D1A18] border-emerald-500/40 text-emerald-200'
              : 'bg-[#1A160D] border-amber-500/40 text-amber-200'
          }`}
        >
          <span>{feedbackBanner.textHe}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-400 hover:text-slate-200 shrink-0"
          >
            סגור
          </button>
        </div>
      )}

      {/* Unified TikTok Accounts Table / Rows */}
      <div className="border border-[#1E2636] rounded-xl overflow-hidden divide-y divide-[#1E2636] bg-[#0B0E14]">
        {accounts.map((acc) => {
          const draft = draftMap[acc.accountId] || {
            selected: acc.selectedForChatCrew,
            crewRole: acc.assignedCrewRole || 'CONVERSATION_HOST',
            handle: acc.handle,
            displayName: acc.displayName,
            geelarkDeviceId: acc.geelarkDeviceId || '',
          };
          const isEditing = editingAccId === acc.accountId;
          const isBusy = connectingAccId === acc.accountId;

          const statusTextHe =
            acc.verifiedStatus === 'ACTIVE_IN_LIVE'
              ? `פעיל בלייב @${acc.assignedLiveStream}`
              : acc.verifiedStatus === 'CONNECTED'
                ? 'מחובר ומאומת'
                : 'מנותק';

          const statusColorClass =
            acc.verifiedStatus === 'ACTIVE_IN_LIVE'
              ? 'text-emerald-300 font-semibold'
              : acc.verifiedStatus === 'CONNECTED'
                ? 'text-cyan-300 font-semibold'
                : 'text-rose-300 font-semibold';

          return (
            <div key={acc.accountId} className="p-4 space-y-3 hover:bg-[#0F1520]/60 transition-colors">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                {/* Account Identity + Verified Connection Status */}
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={draft.selected}
                    onChange={() => toggleAccountSelected(acc)}
                    className="mt-2.5 w-4 h-4 accent-amber-500 cursor-pointer shrink-0"
                    title="בחר חשבון זה לתפקיד מנחה צ׳אט בלייב"
                  />

                  <img
                    src={acc.avatarUrl}
                    alt={acc.displayName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full border border-[#26334D] object-cover shrink-0"
                  />

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-mono tabular-nums text-amber-300 font-semibold">
                        #{acc.slotNumber}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="font-semibold text-slate-100">{draft.displayName}</span>
                      <span className="font-mono text-xs text-cyan-300">@{draft.handle}</span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className={`text-xs ${statusColorClass}`}>{statusTextHe}</span>
                    </div>

                    {/* Unboxed Metadata Line */}
                    <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                      <span>{acc.verificationDetailHe}</span>
                      {acc.assignedLiveStream && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-slate-200">
                            לייב משויך: @{acc.assignedLiveStream}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        נשלחו: {acc.messagesSentCount}
                      </span>
                      {acc.geelarkDeviceName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-cyan-300">
                            מכשיר: {acc.geelarkDeviceName} ({acc.geelarkDeviceStatus})
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Role Selection + Secure Connect Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {draft.selected ? (
                    <select
                      value={draft.crewRole}
                      onChange={(e) =>
                        updateDraftField(acc.accountId, {
                          crewRole: e.target.value as AiCrewArchetypeId,
                        })
                      }
                      className="bg-[#121926] border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs text-amber-200"
                    >
                      {ALL_CREW_ROLES.map((roleKey) => (
                        <option key={roleKey} value={roleKey}>
                          {CREW_ROLE_LABELS_HE[roleKey]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-slate-500 px-2">לא נבחר לצוות המנחים הפעיל</span>
                  )}

                  {acc.verifiedStatus === 'DISCONNECTED' && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleConnectViaCloudPhone(acc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#162033] hover:bg-[#1E2C46] border border-[#2A3B5C] text-cyan-200 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Smartphone className="w-3.5 h-3.5" />
                        )}
                        חבר דרך טלפון ענן
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleConnectSecureOAuth(acc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#162422] hover:bg-[#1D312E] border border-emerald-700/50 text-emerald-200 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        התחבר מאובטח (OAuth)
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setEditingAccId(isEditing ? null : acc.accountId)}
                    className="p-1.5 rounded-lg bg-[#161F30] border border-[#26334D] hover:border-slate-500 text-slate-300"
                    title="ערוך שם משתמש או שיוך מכשיר טלפון"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Optional Inline Account Handle & Cloud Phone Device Mapper (No Manual Session/Token Fields!) */}
              {isEditing && (
                <div className="pt-3 border-t border-[#1E2636] grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                  <label className="space-y-1 block">
                    <span className="text-slate-400">שם משתמש TikTok (@handle)</span>
                    <input
                      type="text"
                      value={draft.handle}
                      onChange={(e) => updateDraftField(acc.accountId, { handle: e.target.value })}
                      placeholder="@username"
                      className="w-full bg-[#121926] border border-[#2A3954] rounded-lg px-2.5 py-1.5 text-slate-100 font-mono"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-slate-400">שם תצוגה בדשבורד</span>
                    <input
                      type="text"
                      value={draft.displayName}
                      onChange={(e) => updateDraftField(acc.accountId, { displayName: e.target.value })}
                      placeholder="שם תצוגה"
                      className="w-full bg-[#121926] border border-[#2A3954] rounded-lg px-2.5 py-1.5 text-slate-100"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-slate-400">שיוך לטלפון ענן קיים (אופציונלי)</span>
                    <select
                      value={draft.geelarkDeviceId}
                      onChange={(e) => updateDraftField(acc.accountId, { geelarkDeviceId: e.target.value })}
                      className="w-full bg-[#121926] border border-[#2A3954] rounded-lg px-2.5 py-1.5 text-slate-100"
                    >
                      <option value="">אוטומטי (מכשיר פעיל ראשון)</option>
                      {phoneSystem.devices.map((dev) => (
                        <option key={dev.id} value={dev.id}>
                          {dev.serialName} ({dev.status} · {dev.deviceModel})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-end justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingAccId(null)}
                      className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
                    >
                      ביטול
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleSaveSingleAccountProfile(acc)}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 disabled:opacity-50"
                    >
                      שמור שיוך
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
