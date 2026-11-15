import React, { useState } from 'react';
import { Check, Edit3, PauseCircle, PlayCircle, Send, ShieldCheck, X } from 'lucide-react';
import {
  AgentInitiativeLevel,
  AiCrewControlCenterState,
  AiModeratorIdentityProfile,
  LiveStreamDossier,
  PhoneAndAccountsBridgeState,
} from '../types/boosteraIntelligence';
import { UnifiedTikTokAccountsPhonePanel } from './UnifiedTikTokAccountsPhonePanel';

interface AiCrewControlCenterPanelProps {
  crewControl: AiCrewControlCenterState;
  accountsBridge?: PhoneAndAccountsBridgeState;
  streams: LiveStreamDossier[];
  onDashboardUpdated: () => Promise<void>;
}

const INITIATIVE_LABELS: Record<AgentInitiativeLevel, string> = {
  LOW: 'נמוכה (מגיב רק באירוע מובהק)',
  BALANCED: 'מאוזנת (קשוב לצורך אמיתי)',
  PROACTIVE: 'יוזמת (בכפוף ל-Chat Orchestrator)',
};

const ACTIVITY_STATE_LABELS: Record<AiModeratorIdentityProfile['currentActivityState'], string> = {
  IDLE_LISTENING: 'מאזין בשקט לשידור',
  PREPARING_SUGGESTION: 'מכין המלצה לאישור',
  ACTIVE_IN_STREAM: 'פעל בשידור (במדידת תוצאה)',
  PAUSED_BY_BRAIN: 'מושהה ע״י המוח המרכזי',
  MUTED_CREATOR_SPEAKING: 'שקט — היוצר מדבר כעת',
};

export const AiCrewControlCenterPanel: React.FC<AiCrewControlCenterPanelProps> = ({
  crewControl,
  accountsBridge,
  streams,
  onDashboardUpdated,
}) => {
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editStyleHe, setEditStyleHe] = useState('');
  const [editPersonaHe, setEditPersonaHe] = useState('');
  const [editInitiative, setEditInitiative] = useState<AgentInitiativeLevel>('BALANCED');
  const [editCooldownSec, setEditCooldownSec] = useState(28);
  const [editPrefixHe, setEditPrefixHe] = useState('[מנחה AI]');

  // Coordinated Chat Orchestrator test/dispatch composer
  const [selectedAgentId, setSelectedAgentId] = useState('ai_crew_1_host');
  const [targetStreamId, setTargetStreamId] = useState(streams[0]?.streamId || 'live_studio');
  const [addressedToHandle, setAddressedToHandle] = useState('');
  const [messageHe, setMessageHe] = useState('');
  const [purposeHe, setPurposeHe] = useState('מענה לשאלה או המשך שיחה טבעי');
  const [viewerValueHe, setViewerValueHe] = useState('סיוע לצופים להבין מה קורה בשידור');
  const [dispatchImmediately, setDispatchImmediately] = useState(false);
  const [allowPreviewOverride, setAllowPreviewOverride] = useState(false);
  const [orchestratorFeedbackHe, setOrchestratorFeedbackHe] = useState<string | null>(null);

  const handlePolicyChange = async (patch: {
    maxActiveCrewPerStream?: number;
    silenceWhenCreatorSpeaks?: boolean;
    busyChatThresholdPerMin?: number;
  }) => {
    await fetch('/api/intelligence/crew/policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...patch,
        streamId: targetStreamId,
      }),
    });
    await onDashboardUpdated();
  };

  const openEditor = (agent: AiModeratorIdentityProfile) => {
    setEditingAgentId(agent.agentId);
    setEditStyleHe(agent.speakingStyleHe);
    setEditPersonaHe(agent.communicativePersonaHe);
    setEditInitiative(agent.initiativeLevel);
    setEditCooldownSec(agent.minCooldownSec);
    setEditPrefixHe(agent.transparentDisclosurePrefixHe);
  };

  const saveAgentIdentity = async (agentId: string) => {
    await fetch('/api/intelligence/crew/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        speakingStyleHe: editStyleHe,
        communicativePersonaHe: editPersonaHe,
        initiativeLevel: editInitiative,
        minCooldownSec: editCooldownSec,
        transparentDisclosurePrefixHe: editPrefixHe,
      }),
    });
    setEditingAgentId(null);
    await onDashboardUpdated();
  };

  const toggleAgentEnabled = async (agent: AiModeratorIdentityProfile) => {
    await fetch('/api/intelligence/crew/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: agent.agentId,
        enabled: !agent.enabled,
      }),
    });
    await onDashboardUpdated();
  };

  const resolveProposal = async (agentId: string, approve: boolean) => {
    await fetch('/api/intelligence/crew/proposal/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, approve }),
    });
    await onDashboardUpdated();
  };

  const handleProposeViaOrchestrator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageHe.trim()) return;
    const resp = await fetch('/api/intelligence/crew/propose-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        streamId: targetStreamId,
        agentId: selectedAgentId,
        addressedToHandle,
        messageHe,
        purposeHe,
        viewerValueHe,
        dispatchImmediately,
        allowPreviewOverride,
      }),
    });
    const data = await resp.json();
    setOrchestratorFeedbackHe(data.dispatchStatusHe || data.gate?.explanationHe || 'נבדק ב-Chat Orchestrator');
    if (data.ok) {
      setMessageHe('');
    }
    await onDashboardUpdated();
  };

  return (
    <div className="space-y-6">
      <UnifiedTikTokAccountsPhonePanel
        bridge={accountsBridge}
        streams={streams}
        onUpdated={onDashboardUpdated}
      />

      <section className="border border-[#1E2636] bg-[#0F1520] rounded-xl p-6 space-y-6">
      {/* Header & Global Crew Governance */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1E2636] pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            AI Crew Control Center — ניהול 4 מנחי AI שקופים, זהויות ו-Chat Orchestrator
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            גילוי נאות שקוף כסוכנים אוטומטיים מופעל תמיד · אסור לסוכנים להתחזות לצופים אנושיים או לנהל שיחות בוט-לבוט · הודעות AI לעולם אינן נספרות כתגובות קהל.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label className="flex items-center gap-2 text-slate-300">
            <span>מספר מנחי AI פעילים ללייב:</span>
            <select
              value={crewControl.maxActiveCrewPerStream}
              onChange={(e) => void handlePolicyChange({ maxActiveCrewPerStream: Number(e.target.value) })}
              className="bg-[#121926] border border-[#2A3954] rounded-md px-2.5 py-1.5 text-slate-100 font-mono tabular-nums"
            >
              <option value={1}>1 מנחה</option>
              <option value={2}>2 מנחים</option>
              <option value={3}>3 מנחים</option>
              <option value={4}>4 מנחים (צוות מלא)</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={crewControl.silenceWhenCreatorSpeaks}
              onChange={(e) => void handlePolicyChange({ silenceWhenCreatorSpeaks: e.target.checked })}
            />
            <span>שקט אוטומטי כשהיוצר מדבר</span>
          </label>

          <label className="flex items-center gap-2 text-slate-300">
            <span>סף צ׳אט עמוס להשהיה:</span>
            <input
              type="number"
              min={8}
              max={120}
              value={crewControl.busyChatThresholdPerMin}
              onChange={(e) =>
                void handlePolicyChange({ busyChatThresholdPerMin: Number(e.target.value || 32) })
              }
              className="w-16 bg-[#121926] border border-[#2A3954] rounded-md px-2 py-1 text-slate-100 font-mono tabular-nums"
            />
            <span className="text-slate-500">הודעות/דקה</span>
          </label>
        </div>
      </div>

      {/* 4 AI Crew Identities Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {crewControl.agents.map((agent, idx) => {
          const withinActiveQuota = idx < crewControl.maxActiveCrewPerStream;
          const isEditing = editingAgentId === agent.agentId;

          return (
            <div
              key={agent.agentId}
              className={`border rounded-lg p-4 bg-[#0B0E14] space-y-3 ${
                withinActiveQuota && agent.enabled ? 'border-[#26334D]' : 'border-[#1A2130] opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{agent.nameHe}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {agent.roleTitleHe}
                    <span aria-hidden="true"> · </span>
                    יוזמה: {INITIATIVE_LABELS[agent.initiativeLevel]}
                    <span aria-hidden="true"> · </span>
                    חשבון משויך #{agent.linkedCompanionSlotNumber} (@{agent.linkedCompanionHandle})
                    <span aria-hidden="true"> · </span>
                    קידומת שקיפות: <span className="text-amber-300">{agent.transparentDisclosurePrefixHe}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEditor(agent)}
                    className="p-1.5 rounded-md text-slate-300 hover:text-slate-100 hover:bg-[#182234] transition-colors"
                    title="ערוך זהות, סגנון וגבולות מנחה"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => void toggleAgentEnabled(agent)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#182234] text-slate-200 hover:bg-[#223049] border border-[#2A3954] transition-colors whitespace-nowrap shrink-0"
                  >
                    {agent.enabled ? (
                      <>
                        <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                        השהה
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                        הפעל
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Pending Identity Change Proposal from Brain / Control Layer */}
              {agent.pendingIdentityProposal && (
                <div className="border border-amber-700/60 bg-amber-950/25 rounded-lg p-3 text-xs space-y-2">
                  <div className="font-semibold text-amber-200">
                    הצעת עדכון זהות לאישור מנהל ({agent.pendingIdentityProposal.proposedBy})
                  </div>
                  <p className="text-slate-200">{agent.pendingIdentityProposal.reasonHe}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => void resolveProposal(agent.agentId, true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      אשר עדכון זהות
                    </button>
                    <button
                      onClick={() => void resolveProposal(agent.agentId, false)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#182234] text-slate-200 hover:bg-[#223049] transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      דחה הצעה
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Identity Editor */}
              {isEditing ? (
                <div className="space-y-3 pt-2 border-t border-[#1E2636] text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="space-y-1 block">
                      <span className="text-slate-400">סגנון דיבור בעברית</span>
                      <input
                        type="text"
                        value={editStyleHe}
                        onChange={(e) => setEditStyleHe(e.target.value)}
                        className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100"
                      />
                    </label>
                    <label className="space-y-1 block">
                      <span className="text-slate-400">קידומת זיהוי שקופה (חובה AI)</span>
                      <input
                        type="text"
                        value={editPrefixHe}
                        onChange={(e) => setEditPrefixHe(e.target.value)}
                        className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100"
                      />
                    </label>
                  </div>
                  <label className="space-y-1 block">
                    <span className="text-slate-400">אישיות תקשורתית ותפקיד</span>
                    <input
                      type="text"
                      value={editPersonaHe}
                      onChange={(e) => setEditPersonaHe(e.target.value)}
                      className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 block">
                      <span className="text-slate-400">רמת יוזמה</span>
                      <select
                        value={editInitiative}
                        onChange={(e) => setEditInitiative(e.target.value as AgentInitiativeLevel)}
                        className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100"
                      >
                        <option value="LOW">LOW — שמרנית</option>
                        <option value="BALANCED">BALANCED — מאוזנת</option>
                        <option value="PROACTIVE">PROACTIVE — יוזמת</option>
                      </select>
                    </label>
                    <label className="space-y-1 block">
                      <span className="text-slate-400">קירור מינימלי (שניות)</span>
                      <input
                        type="number"
                        min={10}
                        max={180}
                        value={editCooldownSec}
                        onChange={(e) => setEditCooldownSec(Number(e.target.value || 28))}
                        className="w-full bg-[#121926] border border-[#2A3954] rounded px-2.5 py-1.5 text-slate-100 font-mono tabular-nums"
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingAgentId(null)}
                      className="px-3 py-1.5 rounded bg-[#182234] text-slate-300 hover:text-slate-100"
                    >
                      ביטול
                    </button>
                    <button
                      onClick={() => void saveAgentIdentity(agent.agentId)}
                      className="px-3.5 py-1.5 rounded bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400"
                    >
                      שמור זהות מנחה
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Live Activity & Brain Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#1E2636] text-xs">
                    <div>
                      <div className="text-slate-400">סטטוס פעיל ומה עושה כרגע</div>
                      <div className="text-slate-100 font-medium mt-0.5">
                        {withinActiveQuota
                          ? ACTIVITY_STATE_LABELS[agent.currentActivityState]
                          : 'מחוץ למכסת המנחים הפעילים שהוגדרה ללייב'}
                      </div>
                      <div className="text-slate-400 mt-0.5">{agent.whatDoingNowHe}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">למה פועל כך / הנחיית מוח</div>
                      <div className="text-slate-200 mt-0.5">{agent.whyDoingNowHe}</div>
                      {agent.lastMessageHe && (
                        <div className="text-cyan-300 mt-1 truncate" title={agent.lastMessageHe}>
                          הודעה אחרונה: "{agent.lastMessageHe}"
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Self-Audit Quality Metrics (Human-Only Replies!) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1E2636] text-xs text-slate-400 font-mono tabular-nums">
                    <span>איכות: {agent.qualityMetrics.qualityScorePct}%</span>
                    <span>סייע: {agent.qualityMetrics.helpfulActionsCount}</span>
                    <span>ניטרלי: {agent.qualityMetrics.neutralActionsCount}</span>
                    <span>הפריע: {agent.qualityMetrics.interferingActionsCount}</span>
                    <span>תגובות אנושיות שהתקבלו: {agent.qualityMetrics.genuineHumanRepliesReceived}</span>
                    <span>נבלם בתיאום: {agent.qualityMetrics.suppressedByOrchestratorCount}</span>
                  </div>

                  {(agent.lastOpenAiNoteHe || agent.lastClaudeNoteHe || agent.improvementRecommendationHe) && (
                    <div className="pt-2 border-t border-[#1E2636] text-xs space-y-1 text-slate-300">
                      {agent.lastOpenAiNoteHe && <div>הערת OpenAI: {agent.lastOpenAiNoteHe}</div>}
                      {agent.lastClaudeNoteHe && <div>הערת Claude: {agent.lastClaudeNoteHe}</div>}
                      {agent.improvementRecommendationHe && (
                        <div className="text-amber-300">המלצת שיפור: {agent.improvementRecommendationHe}</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Chat Orchestrator Interactive Gate & Dispatch Form */}
      <form
        onSubmit={handleProposeViaOrchestrator}
        className="border border-[#1E2636] rounded-lg p-4 bg-[#0B0E14] space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              בדיקה ושליחה מתואמת דרך ה-Chat Orchestrator (מונע כפילויות, הצפה ושיח בוטים)
            </h3>
          </div>
          <span className="text-xs text-slate-400">כל הודעה עוברת 7 שערי בטיחות לפני אישור</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="bg-[#121926] border border-[#2A3954] rounded-md px-3 py-2 text-slate-100"
          >
            {crewControl.agents.map((a) => (
              <option key={a.agentId} value={a.agentId}>
                {a.nameHe}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={targetStreamId}
            onChange={(e) => setTargetStreamId(e.target.value)}
            placeholder="מזהה לייב (למשל live_studio)"
            className="bg-[#121926] border border-[#2A3954] rounded-md px-3 py-2 text-slate-100"
          />

          <input
            type="text"
            value={addressedToHandle}
            onChange={(e) => setAddressedToHandle(e.target.value)}
            placeholder="נמען אופציונלי (@יוצר או @צופה — חוסם פנייה לבוט)"
            className="bg-[#121926] border border-[#2A3954] rounded-md px-3 py-2 text-slate-100"
          />

          <input
            type="text"
            value={purposeHe}
            onChange={(e) => setPurposeHe(e.target.value)}
            placeholder="מטרת הפעולה לצופים"
            className="bg-[#121926] border border-[#2A3954] rounded-md px-3 py-2 text-slate-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={messageHe}
            onChange={(e) => setMessageHe(e.target.value)}
            placeholder="נסח הודעה שקופה (קידומת [מנחה AI] תתווסף אוטומטית)..."
            className="flex-1 min-w-[240px] bg-[#121926] border border-[#2A3954] rounded-md px-3 py-2 text-xs text-slate-100"
          />

          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={dispatchImmediately}
              onChange={(e) => setDispatchImmediately(e.target.checked)}
            />
            <span>שלח מיד אם אושר ב-Orchestrator</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={allowPreviewOverride}
              onChange={(e) => setAllowPreviewOverride(e.target.checked)}
            />
            <span>אפשר תצוגת הדגמה מקומית ללא Session</span>
          </label>

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            העבר בשער ה-Orchestrator
          </button>
        </div>

        {orchestratorFeedbackHe && (
          <div className="text-xs text-cyan-200 pt-1">{orchestratorFeedbackHe}</div>
        )}
      </form>

      {/* Two-Column Audit Tables: 15s Human-Outcome Audits & Orchestrator Gate Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="border border-[#1E2636] rounded-lg p-4 bg-[#0B0E14] space-y-2">
          <h3 className="text-sm font-semibold text-slate-100">
            מדידת תוצאות אמיתית לפעולות מנחים (15 שניות אחרי — צופים אנושיים בלבד)
          </h3>
          <div className="divide-y divide-[#1E2636] max-h-56 overflow-y-auto text-xs">
            {crewControl.recentActionAudits.length === 0 ? (
              <p className="text-slate-500 py-3">טרם נרשמו פעולות מנחי AI בסשן הנוכחי.</p>
            ) : (
              crewControl.recentActionAudits.slice(0, 10).map((aud) => (
                <div key={aud.auditId} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-slate-200 font-medium">{aud.agentNameHe}</span>
                    <span className="font-mono tabular-nums">
                      {aud.impactAssessment} · {aud.humanRepliesCountAfter15s} תגובות אנושיות
                    </span>
                  </div>
                  <div className="text-slate-300">"{aud.messageTextHe}"</div>
                  <div className="text-slate-400">{aud.postOutcomeSummaryHe}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border border-[#1E2636] rounded-lg p-4 bg-[#0B0E14] space-y-2">
          <h3 className="text-sm font-semibold text-slate-100">
            יומן החלטות Chat Orchestrator (מניעת כפילויות, הצפה ושיח בוטים)
          </h3>
          <div className="divide-y divide-[#1E2636] max-h-56 overflow-y-auto text-xs">
            {crewControl.recentOrchestratorGates.length === 0 ? (
              <p className="text-slate-500 py-3">יומן השערים ריק כרגע.</p>
            ) : (
              crewControl.recentOrchestratorGates.slice(0, 10).map((gate) => (
                <div key={gate.gateId} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200 font-medium">{gate.whoShouldRespondHe}</span>
                    <span
                      className={`font-mono tabular-nums ${
                        gate.decision === 'BLOCKED' ? 'text-rose-400' : 'text-emerald-300'
                      }`}
                    >
                      {gate.decision}
                      {gate.blockReasonCode ? ` (${gate.blockReasonCode})` : ''}
                    </span>
                  </div>
                  <div className="text-slate-400">{gate.explanationHe}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </section>
    </div>
  );
};
