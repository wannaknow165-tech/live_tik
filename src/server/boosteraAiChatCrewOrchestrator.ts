import fs from 'fs';
import path from 'path';
import {
  AgentInitiativeLevel,
  AiCrewArchetypeId,
  AiCrewControlCenterState,
  AiModeratorActionAuditRecord,
  AiModeratorIdentityProfile,
  ChatOrchestratorGateLog,
  CrewAgentBrainNote,
  LiveStreamDossier,
} from '../types/boosteraIntelligence';
import { BoosteraDataFactory } from './boosteraDataFactory';
import { BoosteraKnowledgeEngine } from './boosteraKnowledgeEngine';

const DATA_DIR = path.join(process.cwd(), '.data');
const CREW_FILE = path.join(DATA_DIR, 'boostera_ai_crew_identities.json');

interface PersistedCrewState {
  maxActiveCrewPerStream: number;
  silenceWhenCreatorSpeaks: boolean;
  busyChatThresholdPerMin: number;
  agents: AiModeratorIdentityProfile[];
  recentActionAudits: AiModeratorActionAuditRecord[];
  recentOrchestratorGates: ChatOrchestratorGateLog[];
}

function buildDefaultCrewIdentities(
  companionHandles: Array<{ slotNumber: number; handle: string; displayName: string }>
): AiModeratorIdentityProfile[] {
  const getSlot = (n: number, fallbackHandle: string) => {
    const found = companionHandles.find((c) => c.slotNumber === n);
    return found ? found.handle : fallbackHandle;
  };

  return [
    {
      agentId: 'ai_crew_1_host',
      linkedCompanionSlotNumber: 1,
      linkedCompanionHandle: getSlot(1, 'omer_snipe_il'),
      nameHe: 'מנחה AI #1 — מארח שיחה (Conversation Host)',
      crewRole: 'CONVERSATION_HOST',
      roleTitleHe: 'CONVERSATION HOST · אחראי רצף שיחה ושאלות ליוצר',
      transparentDisclosurePrefixHe: '[מנחה AI]',
      enabled: true,
      pausedByBrainUntilTs: 0,
      language: 'he-IL',
      speakingStyleHe: 'ענייני, מזמין, קשוב לדברי היוצר ומנסח שאלות פתוחות קצרות בגובה העיניים',
      communicativePersonaHe:
        'מארח שיחה שקוף שמחבר בין נושאים שעולים בצ׳אט לבין היוצר והמשתתפים, בלי להעמיס ובלי להתחזות לצופה אנושי.',
      knowledgeDomainsHe: ['הנחיית שיחה בשידור חי', 'זיהוי שאלות ליוצר', 'גישור בין משתתפים'],
      initiativeLevel: 'BALANCED',
      minCooldownSec: 28,
      whenAllowedToRespondHe: [
        'כאשר עולה שאלה עניינית המופנית ליוצר והיוצר אינו באמצע משפט',
        'לאחר הפוגת שקט של מעל 15 שניות כשיש נושא אמיתי מהצ׳אט',
      ],
      allowedTargets: ['CREATOR', 'VIEWERS', 'CO_HOSTS'],
      actionsRequiringApproval: ['פרסום הודעה פומבית לצ׳אט ללא אישור אוטומציה מפורש', 'שינוי הגדרות זהות'],
      forbiddenBehaviorsHe: [
        'אסור להתחזות לצופה אנושי או להסתיר היותו סוכן אוטומטי',
        'אסור לקטוע את היוצר בזמן דיבור פעיל',
        'אסור לנהל שיחה מלאכותית עם מנחה AI אחר כדי לנפח תגובות',
      ],
      relevantConversationMemoryHe: [
        'שאלות קצרות המבוססות על מה שהיוצר הזכיר זה עתה מייצרות מענה אנושי גבוה יותר מהודעות כלליות.',
      ],
      currentActivityState: 'IDLE_LISTENING',
      whatDoingNowHe: 'מאזין לשאלות המופנות ליוצר ולנושאים מתפתחים בצ׳אט',
      whyDoingNowHe: 'ממתין להזדמנות בעלת ערך אמיתי לצופים מבלי להפריע לשטף הדיבור',
      lastMessageHe: null,
      lastMessageAtTs: null,
      lastBrainDirectiveHe: null,
      lastOpenAiNoteHe: null,
      lastClaudeNoteHe: null,
      improvementRecommendationHe: null,
      qualityMetrics: {
        totalActionsCount: 0,
        helpfulActionsCount: 0,
        neutralActionsCount: 0,
        interferingActionsCount: 0,
        genuineHumanRepliesReceived: 0,
        overloadIncidentsCount: 0,
        suppressedByOrchestratorCount: 0,
        qualityScorePct: 90,
      },
      pendingIdentityProposal: null,
    },
    {
      agentId: 'ai_crew_2_community',
      linkedCompanionSlotNumber: 2,
      linkedCompanionHandle: getSlot(2, 'maya_vibes_live'),
      nameHe: 'מנחה AI #2 — מנהל קהילה (Community Manager)',
      crewRole: 'COMMUNITY_MANAGER',
      roleTitleHe: 'COMMUNITY MANAGER · שאלות חוזרות, סדר ומענה מבוסס מידע מאושר',
      transparentDisclosurePrefixHe: '[קהילה AI]',
      enabled: true,
      pausedByBrainUntilTs: 0,
      language: 'he-IL',
      speakingStyleHe: 'בהיר, שירותי, מכבד ומדויק — עונה רק על בסיס עובדות מאומתות מהשידור',
      communicativePersonaHe:
        'מנהל קהילה שקוף שמזהה שאלות שחוזרות מספר פעמים ללא מענה, מסייע לצופים חדשים ומתריע על עומסי צ׳אט.',
      knowledgeDomainsHe: ['מענה לשאלות חוזרות', 'קליטת צופים חדשים', 'שמירה על שיח מכבד ורגוע'],
      initiativeLevel: 'BALANCED',
      minCooldownSec: 25,
      whenAllowedToRespondHe: [
        'כאשר אותה שאלה נשאלה 2 פעמים ומעלה ע״י צופים אנושיים ולא נענתה',
        'כאשר נדרשת הבהרה עובדתית מאושרת לגבי כללי השידור',
      ],
      allowedTargets: ['VIEWERS', 'HUMAN_MODS', 'CREATOR'],
      actionsRequiringApproval: ['פעולת ניהול/חסימת משתמש', 'פרסום תשובה פומבית בצ׳אט'],
      forbiddenBehaviorsHe: [
        'אסור להמציא תשובות או עובדות שאינן מאומתות בנתוני השידור',
        'אסור לענות על שאלה שמנהל אנושי או מנחה אחר כבר ענה עליה',
      ],
      relevantConversationMemoryHe: [
        'מתן מענה מרוכז אחד לשאלה שחזרה 3 פעמים מפחית הצפה בצ׳אט ומשפר חוויית צפייה.',
      ],
      currentActivityState: 'IDLE_LISTENING',
      whatDoingNowHe: 'סורק אשכולות שאלות חוזרות שלא נענו ועומסי צ׳אט',
      whyDoingNowHe: 'מונע תסכול של צופים ששואלים שוב ושוב בלי לקבל התייחסות',
      lastMessageHe: null,
      lastMessageAtTs: null,
      lastBrainDirectiveHe: null,
      lastOpenAiNoteHe: null,
      lastClaudeNoteHe: null,
      improvementRecommendationHe: null,
      qualityMetrics: {
        totalActionsCount: 0,
        helpfulActionsCount: 0,
        neutralActionsCount: 0,
        interferingActionsCount: 0,
        genuineHumanRepliesReceived: 0,
        overloadIncidentsCount: 0,
        suppressedByOrchestratorCount: 0,
        qualityScorePct: 92,
      },
      pendingIdentityProposal: null,
    },
    {
      agentId: 'ai_crew_3_battle',
      linkedCompanionSlotNumber: 3,
      linkedCompanionHandle: getSlot(3, 'itay_shield_mod'),
      nameHe: 'מנחה AI #3 — אנליסט קרב (Battle Analyst)',
      crewRole: 'BATTLE_ANALYST',
      roleTitleHe: 'BATTLE ANALYST · ניתוח באטל, שינויי קצב וניקוד מאומת בלבד',
      transparentDisclosurePrefixHe: '[אנליסט קרב AI]',
      enabled: true,
      pausedByBrainUntilTs: 0,
      language: 'he-IL',
      speakingStyleHe: 'תמציתי, אנליטי, מבוסס מספרים מאומתים בלבד ללא הגזמות שווא',
      communicativePersonaHe:
        'פרשן קרב שקוף שמעדכן את היוצר והקהל בשינויי קצב משמעותיים, מהפכי ניקוד מאומתים וחלונות כפפה/בונוס.',
      knowledgeDomainsHe: ['ניקוד PK מאומת', 'מומנטום 10 שניות', 'זיהוי כפפות ומשימות קרב'],
      initiativeLevel: 'LOW',
      minCooldownSec: 32,
      whenAllowedToRespondHe: [
        'כאשר מתרחש מהפך הובלה או שינוי קצב מאומת מטיקטוק',
        'כאשר נפתחת כפפת בוסט או משימת מהירות מאומתת',
      ],
      allowedTargets: ['CREATOR', 'VIEWERS'],
      actionsRequiringApproval: ['פרסום הודעת מצב קרב בצ׳אט החי'],
      forbiddenBehaviorsHe: [
        'אסור להציג ניקוד משוער כאילו התקבל מטיקטוק',
        'אסור לפעול כשאין באטל פעיל או כשאין שינוי משמעותי',
      ],
      relevantConversationMemoryHe: [
        'דיווח ממוקד על פער מאומת בדקה האחרונה מסייע ליוצר להבין את תמונת הקרב בלי רעש מיותר.',
      ],
      currentActivityState: 'IDLE_LISTENING',
      whatDoingNowHe: 'עוקב אחר נתוני באטל מאומתים ושינויי מומנטום',
      whyDoingNowHe: 'מגיב רק באירועי קרב מאומתים בעלי משמעות טקטית',
      lastMessageHe: null,
      lastMessageAtTs: null,
      lastBrainDirectiveHe: null,
      lastOpenAiNoteHe: null,
      lastClaudeNoteHe: null,
      improvementRecommendationHe: null,
      qualityMetrics: {
        totalActionsCount: 0,
        helpfulActionsCount: 0,
        neutralActionsCount: 0,
        interferingActionsCount: 0,
        genuineHumanRepliesReceived: 0,
        overloadIncidentsCount: 0,
        suppressedByOrchestratorCount: 0,
        qualityScorePct: 91,
      },
      pendingIdentityProposal: null,
    },
    {
      agentId: 'ai_crew_4_creative',
      linkedCompanionSlotNumber: 4,
      linkedCompanionHandle: getSlot(4, 'noa_vip_host'),
      nameHe: 'מנחה AI #4 — מעורבות יצירתית ותוכן (Creative Engagement)',
      crewRole: 'CREATIVE_ENGAGEMENT',
      roleTitleHe: 'CREATIVE ENGAGEMENT · סקרים, רעיונות תוכן ותזמון אפקטים',
      transparentDisclosurePrefixHe: '[תוכן AI]',
      enabled: true,
      pausedByBrainUntilTs: 0,
      language: 'he-IL',
      speakingStyleHe: 'יצירתי, סקרן, מציע דילמות וסקרים קצרים שמשרתים את נושא השידור',
      communicativePersonaHe:
        'יועץ תוכן ואינטראקציה שקוף שמזהה נושאים שמרתקים את הצופים, מציע סקרים קצרים ליוצר וממליץ מתי לשלב אפקט עדין.',
      knowledgeDomainsHe: ['סקרי קהל מהירים', 'פיתוח רעיונות תוכן בזמן אמת', 'שילוב אפקטים בשירות התוכן'],
      initiativeLevel: 'LOW',
      minCooldownSec: 40,
      whenAllowedToRespondHe: [
        'כאשר מתפתח נושא בולט בצ׳אט שניתן להפוך לסקר או פעילות משותפת בין המשתתפים',
        'כאשר המוח המרכזי מזהה הזדמנות לתוכן חדש בחדר רגוע',
      ],
      allowedTargets: ['CREATOR', 'CO_HOSTS', 'VIEWERS'],
      actionsRequiringApproval: ['הפעלת סקר בצ׳אט', 'יצירת הצעת אפקט/תוכן חדש'],
      forbiddenBehaviorsHe: [
        'אסור להציף סקרים בזמן שהצ׳אט כבר עמוס ומגיב מעצמו',
        'אסור להפעיל אפקטים חזותיים שמסתירים את המצולם',
      ],
      relevantConversationMemoryHe: [
        'סקר קצר הקשור ישירות לנושא שהיוצר העלה מייצר שיחה אותנטית פי 2 משאלה מנותקת.',
      ],
      currentActivityState: 'IDLE_LISTENING',
      whatDoingNowHe: 'מנתח נושאי עניין של הקהל והזדמנויות לפעילות משותפת',
      whyDoingNowHe: 'מציע תוכן או אפקט רק כשהדבר מעשיר את השידור בפועל',
      lastMessageHe: null,
      lastMessageAtTs: null,
      lastBrainDirectiveHe: null,
      lastOpenAiNoteHe: null,
      lastClaudeNoteHe: null,
      improvementRecommendationHe: null,
      qualityMetrics: {
        totalActionsCount: 0,
        helpfulActionsCount: 0,
        neutralActionsCount: 0,
        interferingActionsCount: 0,
        genuineHumanRepliesReceived: 0,
        overloadIncidentsCount: 0,
        suppressedByOrchestratorCount: 0,
        qualityScorePct: 89,
      },
      pendingIdentityProposal: null,
    },
  ];
}

export class BoosteraAiChatCrewOrchestrator {
  private maxActiveCrewPerStream = 4;
  private silenceWhenCreatorSpeaks = true;
  private busyChatThresholdPerMin = 32;
  private agents: AiModeratorIdentityProfile[] = [];
  private recentActionAudits: AiModeratorActionAuditRecord[] = [];
  private recentOrchestratorGates: ChatOrchestratorGateLog[] = [];
  private handledQuestionFingerprints = new Map<string, number>();
  private recentMessageHashes = new Map<string, number>();
  private seq = 0;

  constructor(
    companionHandles: Array<{ slotNumber: number; handle: string; displayName: string }>
  ) {
    this.loadFromDisk(companionHandles);
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${Date.now()}_${this.seq}`;
  }

  private loadFromDisk(
    companionHandles: Array<{ slotNumber: number; handle: string; displayName: string }>
  ) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(CREW_FILE)) {
        const raw = JSON.parse(fs.readFileSync(CREW_FILE, 'utf-8')) as Partial<PersistedCrewState>;
        if (typeof raw.maxActiveCrewPerStream === 'number') {
          this.maxActiveCrewPerStream = Math.max(1, Math.min(4, Math.round(raw.maxActiveCrewPerStream)));
        }
        if (typeof raw.silenceWhenCreatorSpeaks === 'boolean') {
          this.silenceWhenCreatorSpeaks = raw.silenceWhenCreatorSpeaks;
        }
        if (typeof raw.busyChatThresholdPerMin === 'number') {
          this.busyChatThresholdPerMin = Math.max(8, Math.min(120, raw.busyChatThresholdPerMin));
        }
        if (Array.isArray(raw.agents) && raw.agents.length === 4) {
          this.agents = raw.agents;
        }
        if (Array.isArray(raw.recentActionAudits)) {
          this.recentActionAudits = raw.recentActionAudits.slice(0, 60);
        }
        if (Array.isArray(raw.recentOrchestratorGates)) {
          this.recentOrchestratorGates = raw.recentOrchestratorGates.slice(0, 60);
        }
      }
    } catch {
      this.agents = [];
    }

    if (this.agents.length !== 4) {
      this.agents = buildDefaultCrewIdentities(companionHandles);
      this.saveToDisk();
    }
  }

  public saveToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const payload: PersistedCrewState = {
        maxActiveCrewPerStream: this.maxActiveCrewPerStream,
        silenceWhenCreatorSpeaks: this.silenceWhenCreatorSpeaks,
        busyChatThresholdPerMin: this.busyChatThresholdPerMin,
        agents: this.agents,
        recentActionAudits: this.recentActionAudits.slice(0, 60),
        recentOrchestratorGates: this.recentOrchestratorGates.slice(0, 60),
      };
      fs.writeFileSync(CREW_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch {
      // Ignore write failures
    }
  }

  public syncCompanionHandles(
    companionHandles: Array<{ slotNumber: number; handle: string }>
  ): Array<{ handle: string; agentId: string }> {
    for (const agent of this.agents) {
      const slot = companionHandles.find((c) => c.slotNumber === agent.linkedCompanionSlotNumber);
      if (slot && slot.handle) {
        agent.linkedCompanionHandle = slot.handle;
      }
    }
    return this.agents.map((a) => ({ handle: a.linkedCompanionHandle, agentId: a.agentId }));
  }

  public updatePolicyConfig(patch: {
    maxActiveCrewPerStream?: number;
    silenceWhenCreatorSpeaks?: boolean;
    busyChatThresholdPerMin?: number;
  }) {
    if (typeof patch.maxActiveCrewPerStream === 'number') {
      this.maxActiveCrewPerStream = Math.max(1, Math.min(4, Math.round(patch.maxActiveCrewPerStream)));
    }
    if (typeof patch.silenceWhenCreatorSpeaks === 'boolean') {
      this.silenceWhenCreatorSpeaks = patch.silenceWhenCreatorSpeaks;
    }
    if (typeof patch.busyChatThresholdPerMin === 'number') {
      this.busyChatThresholdPerMin = Math.max(8, Math.min(120, Math.round(patch.busyChatThresholdPerMin)));
    }
    this.saveToDisk();
  }

  public assignSelectedAccountsToCrew(
    assignments: Array<{
      slotNumber: number;
      handle: string;
      displayName?: string;
      crewRole: AiCrewArchetypeId;
    }>
  ): AiModeratorIdentityProfile[] {
    const byRole = new Map<AiCrewArchetypeId, { slotNumber: number; handle: string; displayName?: string }>();
    for (const item of assignments) {
      if (!byRole.has(item.crewRole) && item.slotNumber >= 1 && item.handle.trim()) {
        byRole.set(item.crewRole, {
          slotNumber: item.slotNumber,
          handle: item.handle.replace(/^@+/, '').trim(),
          displayName: item.displayName?.trim(),
        });
      }
    }

    let enabledCount = 0;
    for (const agent of this.agents) {
      const assigned = byRole.get(agent.crewRole);
      if (assigned) {
        agent.linkedCompanionSlotNumber = assigned.slotNumber;
        agent.linkedCompanionHandle = assigned.handle;
        agent.enabled = true;
        enabledCount += 1;
      } else {
        agent.enabled = false;
      }
    }

    if (enabledCount >= 1) {
      this.maxActiveCrewPerStream = Math.max(1, Math.min(4, enabledCount));
    }
    this.saveToDisk();
    return this.agents;
  }

  public updateAgentIdentityDirect(
    agentId: string,
    patch: {
      nameHe?: string;
      enabled?: boolean;
      speakingStyleHe?: string;
      communicativePersonaHe?: string;
      initiativeLevel?: AgentInitiativeLevel;
      minCooldownSec?: number;
      transparentDisclosurePrefixHe?: string;
    }
  ): AiModeratorIdentityProfile | null {
    const agent = this.agents.find((a) => a.agentId === agentId);
    if (!agent) return null;
    if (typeof patch.nameHe === 'string' && patch.nameHe.trim()) agent.nameHe = patch.nameHe.trim();
    if (typeof patch.enabled === 'boolean') agent.enabled = patch.enabled;
    if (typeof patch.speakingStyleHe === 'string' && patch.speakingStyleHe.trim()) {
      agent.speakingStyleHe = patch.speakingStyleHe.trim();
    }
    if (typeof patch.communicativePersonaHe === 'string' && patch.communicativePersonaHe.trim()) {
      agent.communicativePersonaHe = patch.communicativePersonaHe.trim();
    }
    if (patch.initiativeLevel) agent.initiativeLevel = patch.initiativeLevel;
    if (typeof patch.minCooldownSec === 'number') {
      agent.minCooldownSec = Math.max(10, Math.min(180, Math.round(patch.minCooldownSec)));
    }
    if (typeof patch.transparentDisclosurePrefixHe === 'string' && patch.transparentDisclosurePrefixHe.trim()) {
      const p = patch.transparentDisclosurePrefixHe.trim();
      agent.transparentDisclosurePrefixHe = p.includes('AI') ? p : `[AI · ${p}]`;
    }
    this.saveToDisk();
    return agent;
  }

  public proposeIdentityChange(params: {
    agentId: string;
    proposedBy: 'AI_BRAIN_CONSENSUS' | 'CONTROL_LEARNING';
    reasonHe: string;
    evidenceEventIds: string[];
    proposedPatch: {
      speakingStyleHe?: string;
      initiativeLevel?: AgentInitiativeLevel;
      whenAllowedToRespondHe?: string[];
      forbiddenBehaviorsHe?: string[];
      enabled?: boolean;
    };
  }): AiModeratorIdentityProfile | null {
    const agent = this.agents.find((a) => a.agentId === params.agentId);
    if (!agent) return null;
    agent.pendingIdentityProposal = {
      proposalId: this.nextId('idprop'),
      createdAtTs: Date.now(),
      proposedBy: params.proposedBy,
      reasonHe: params.reasonHe,
      evidenceEventIds: params.evidenceEventIds,
      proposedPatch: params.proposedPatch,
      status: 'PENDING_APPROVAL',
    };
    this.saveToDisk();
    return agent;
  }

  public resolveIdentityProposal(agentId: string, approve: boolean): AiModeratorIdentityProfile | null {
    const agent = this.agents.find((a) => a.agentId === agentId);
    if (!agent || !agent.pendingIdentityProposal) return null;
    const prop = agent.pendingIdentityProposal;
    if (approve) {
      if (prop.proposedPatch.speakingStyleHe) agent.speakingStyleHe = prop.proposedPatch.speakingStyleHe;
      if (prop.proposedPatch.initiativeLevel) agent.initiativeLevel = prop.proposedPatch.initiativeLevel;
      if (prop.proposedPatch.whenAllowedToRespondHe) {
        agent.whenAllowedToRespondHe = prop.proposedPatch.whenAllowedToRespondHe;
      }
      if (prop.proposedPatch.forbiddenBehaviorsHe) {
        agent.forbiddenBehaviorsHe = prop.proposedPatch.forbiddenBehaviorsHe;
      }
      if (typeof prop.proposedPatch.enabled === 'boolean') {
        agent.enabled = prop.proposedPatch.enabled;
      }
    }
    agent.pendingIdentityProposal = null;
    this.saveToDisk();
    return agent;
  }

  public applyBrainCrewNotes(
    openAiNotes: CrewAgentBrainNote[] | undefined,
    claudeNotes: CrewAgentBrainNote[] | undefined,
    modelsAgree: boolean
  ) {
    const now = Date.now();
    for (const agent of this.agents) {
      const oNote = openAiNotes?.find((n) => n.agentId === agent.agentId || n.crewRole === agent.crewRole);
      const cNote = claudeNotes?.find((n) => n.agentId === agent.agentId || n.crewRole === agent.crewRole);
      if (oNote) agent.lastOpenAiNoteHe = oNote.directiveHe;
      if (cNote) agent.lastClaudeNoteHe = cNote.directiveHe;

      if (modelsAgree && oNote?.shouldPause && cNote?.shouldPause) {
        agent.pausedByBrainUntilTs = now + 45000;
        agent.currentActivityState = 'PAUSED_BY_BRAIN';
        agent.whatDoingNowHe = 'מושהה זמנית בהחלטת המוח המרכזי';
        agent.whyDoingNowHe = oNote.directiveHe;
      }
    }
    this.saveToDisk();
  }

  public pauseAgentByBrain(agentIdOrRole: string, durationSec: number, reasonHe: string) {
    const target =
      this.agents.find((a) => a.agentId === agentIdOrRole || a.crewRole === agentIdOrRole) ||
      this.agents[0];
    if (!target) return;
    target.pausedByBrainUntilTs = Date.now() + durationSec * 1000;
    target.currentActivityState = 'PAUSED_BY_BRAIN';
    target.lastBrainDirectiveHe = reasonHe;
    target.whatDoingNowHe = `מושהה ל-${durationSec} שנ׳ בהוראת המוח`;
    target.whyDoingNowHe = reasonHe;
    this.saveToDisk();
  }

  public silenceAllCrew(durationSec: number, reasonHe: string) {
    const until = Date.now() + durationSec * 1000;
    for (const agent of this.agents) {
      agent.pausedByBrainUntilTs = until;
      agent.currentActivityState = 'MUTED_CREATOR_SPEAKING';
      agent.lastBrainDirectiveHe = reasonHe;
      agent.whatDoingNowHe = 'שקט יזום — נותן במה ליוצר / לקהל';
      agent.whyDoingNowHe = reasonHe;
    }
    this.saveToDisk();
  }

  // ==========================================================================
  // SECTION 7: CHAT ORCHESTRATOR GATEKEEPER
  // ==========================================================================

  public evaluateAndCoordinateCrewMessage(params: {
    streamDossier: LiveStreamDossier | undefined;
    candidateRole?: AiCrewArchetypeId;
    candidateAgentId?: string;
    addressedToHandle?: string;
    rawSuggestedMessageHe: string;
    purposeHe: string;
    viewerValueHe: string;
    questionKeyBeingAnswered?: string;
    claimsUnverifiedScoreOrFact?: boolean;
    requireHumanApproval: boolean;
  }): {
    allowed: boolean;
    requiresHumanApproval: boolean;
    formattedTransparentMessageHe: string;
    selectedAgent: AiModeratorIdentityProfile | null;
    gateLog: ChatOrchestratorGateLog;
  } {
    const now = Date.now();
    const streamId = params.streamDossier?.streamId || 'live_stage';
    const activeSlice = this.agents.slice(0, this.maxActiveCrewPerStream);
    const agent =
      activeSlice.find(
        (a) => a.agentId === params.candidateAgentId || a.crewRole === params.candidateRole
      ) || activeSlice.find((a) => a.enabled) || this.agents[0];

    const recordGate = (
      decision: ChatOrchestratorGateLog['decision'],
      explanationHe: string,
      blockReasonCode?: ChatOrchestratorGateLog['blockReasonCode'],
      timingAppropriate = true
    ): ChatOrchestratorGateLog => {
      const log: ChatOrchestratorGateLog = {
        gateId: this.nextId('gate'),
        timestamp: now,
        streamId,
        candidateAgentId: agent.agentId,
        candidateRole: agent.crewRole,
        whoShouldRespondHe: agent.nameHe,
        whyRespondHe: params.purposeHe,
        viewerValueHe: params.viewerValueHe,
        timingAppropriate,
        decision,
        blockReasonCode,
        explanationHe,
      };
      this.recentOrchestratorGates.unshift(log);
      if (this.recentOrchestratorGates.length > 60) this.recentOrchestratorGates.length = 60;
      if (decision === 'BLOCKED') {
        agent.qualityMetrics.suppressedByOrchestratorCount += 1;
      }
      this.saveToDisk();
      return log;
    };

    const cleanBody = String(params.rawSuggestedMessageHe || '').trim();
    if (!cleanBody || cleanBody.length < 4 || !params.viewerValueHe.trim()) {
      return {
        allowed: false,
        requiresHumanApproval: true,
        formattedTransparentMessageHe: '',
        selectedAgent: agent,
        gateLog: recordGate(
          'BLOCKED',
          'נחסם ע״י Chat Orchestrator: אין ערך מוגדר וברור לצופה בהודעה זו — מעדיף שקט.',
          'NO_VIEWER_VALUE',
          false
        ),
      };
    }

    // 1. Prevent AI-to-AI synthetic conversation!
    if (params.addressedToHandle) {
      const cleanTarget = params.addressedToHandle.replace(/^@+/, '').toLowerCase();
      const isTargetingAnotherAi = this.agents.some(
        (a) => a.linkedCompanionHandle.toLowerCase() === cleanTarget || a.agentId.toLowerCase() === cleanTarget
      );
      if (isTargetingAnotherAi) {
        return {
          allowed: false,
          requiresHumanApproval: true,
          formattedTransparentMessageHe: '',
          selectedAgent: agent,
          gateLog: recordGate(
            'BLOCKED',
            'נחסם ע״י Chat Orchestrator: נאסר על סוכן AI לפנות לסוכן AI אחר או לייצר שיח מלאכותי בין בוטים.',
            'BOT_TO_BOT_FORBIDDEN',
            false
          ),
        };
      }
    }

    // 2. Check agent enabled / paused / cooldown
    if (!agent.enabled || agent.pausedByBrainUntilTs > now) {
      return {
        allowed: false,
        requiresHumanApproval: true,
        formattedTransparentMessageHe: '',
        selectedAgent: agent,
        gateLog: recordGate(
          'BLOCKED',
          `נחסם: ${agent.nameHe} מושהה כעת ע״י המוח המרכזי או המנהל.`,
          'AGENT_PAUSED_OR_COOLDOWN',
          false
        ),
      };
    }
    if (agent.lastMessageAtTs && now - agent.lastMessageAtTs < agent.minCooldownSec * 1000) {
      return {
        allowed: false,
        requiresHumanApproval: true,
        formattedTransparentMessageHe: '',
        selectedAgent: agent,
        gateLog: recordGate(
          'BLOCKED',
          `נחסם: ${agent.nameHe} עדיין בחלון קירור (${agent.minCooldownSec} שנ׳) למניעת הצפה.`,
          'AGENT_PAUSED_OR_COOLDOWN',
          false
        ),
      };
    }

    // 3. Do not interrupt creator while actively speaking!
    if (this.silenceWhenCreatorSpeaks && params.streamDossier?.creatorCurrentlySpeaking) {
      agent.currentActivityState = 'MUTED_CREATOR_SPEAKING';
      agent.whatDoingNowHe = 'שומר על שקט בזמן שהיוצר מדבר';
      return {
        allowed: false,
        requiresHumanApproval: true,
        formattedTransparentMessageHe: '',
        selectedAgent: agent,
        gateLog: recordGate(
          'BLOCKED',
          'נחסם ע״י Chat Orchestrator: היוצר נמצא באמצע דיבור פעיל — לא מתערבים באמצע שיחה.',
          'CREATOR_SPEAKING_NOW',
          false
        ),
      };
    }

    // 4. Do not flood when human chat is already busy!
    if (
      params.streamDossier &&
      (params.streamDossier.chatMetrics.humanMessagesPerMin >= this.busyChatThresholdPerMin ||
        params.streamDossier.chatMetrics.burstActive)
    ) {
      return {
        allowed: false,
        requiresHumanApproval: true,
        formattedTransparentMessageHe: '',
        selectedAgent: agent,
        gateLog: recordGate(
          'BLOCKED',
          `נחסם ע״י Chat Orchestrator: הצ׳אט האנושי כבר פעיל מאוד (${params.streamDossier.chatMetrics.humanMessagesPerMin} הודעות/דקה) — מצמצמים הודעות אוטומטיות.`,
          'CHAT_OVERLOAD_BUSY',
          false
        ),
      };
    }

    // 5. Block unverified factual or score claims!
    if (
      params.claimsUnverifiedScoreOrFact ||
      (agent.crewRole === 'BATTLE_ANALYST' &&
        params.streamDossier &&
        params.streamDossier.battleMetrics.verifiedHostScore === null &&
        /\d{3,}/.test(cleanBody))
    ) {
      return {
        allowed: false,
        requiresHumanApproval: true,
        formattedTransparentMessageHe: '',
        selectedAgent: agent,
        gateLog: recordGate(
          'BLOCKED',
          'נחסם ע״י Chat Orchestrator: ניסיון להתייחס למספר/עובדה שאינם מאומתים בנתוני השידור.',
          'UNVERIFIED_FACT_CLAIM',
          false
        ),
      };
    }

    // 6. Prevent multiple moderators answering the same question!
    if (params.questionKeyBeingAnswered) {
      const qPrev = this.handledQuestionFingerprints.get(params.questionKeyBeingAnswered);
      if (qPrev && now - qPrev < 90000) {
        return {
          allowed: false,
          requiresHumanApproval: true,
          formattedTransparentMessageHe: '',
          selectedAgent: agent,
          gateLog: recordGate(
            'BLOCKED',
            'נחסם ע״י Chat Orchestrator: שאלה זו כבר קיבלה מענה ממנחה אחר ב-90 השניות האחרונות.',
            'QUESTION_ALREADY_HANDLED',
            false
          ),
        };
      }
      this.handledQuestionFingerprints.set(params.questionKeyBeingAnswered, now);
    }

    // 7. Prevent duplicate messages across any crew member!
    const msgHash = cleanBody.toLowerCase().replace(/\s+/g, ' ').slice(0, 80);
    const prevMsgTs = this.recentMessageHashes.get(msgHash);
    if (prevMsgTs && now - prevMsgTs < 120000) {
      return {
        allowed: false,
        requiresHumanApproval: true,
        formattedTransparentMessageHe: '',
        selectedAgent: agent,
        gateLog: recordGate(
          'BLOCKED',
          'נחסם ע״י Chat Orchestrator: הודעה זהה או דומה מדי כבר נשלחה לאחרונה.',
          'DUPLICATE_MESSAGE',
          false
        ),
      };
    }
    this.recentMessageHashes.set(msgHash, now);

    // Enforce transparent automated agent prefix so it NEVER impersonates a human viewer!
    const prefix = agent.transparentDisclosurePrefixHe || '[AI מנחה]';
    const formattedTransparentMessageHe = cleanBody.startsWith('[')
      ? cleanBody
      : `${prefix} ${cleanBody}`;

    const gateDecision = params.requireHumanApproval
      ? 'QUEUED_FOR_HUMAN_APPROVAL'
      : 'APPROVED_FOR_DISPATCH';

    return {
      allowed: true,
      requiresHumanApproval: params.requireHumanApproval,
      formattedTransparentMessageHe,
      selectedAgent: agent,
      gateLog: recordGate(
        gateDecision,
        params.requireHumanApproval
          ? `אושר ע״י Chat Orchestrator וממתין לאישור אנושי לפני פרסום בצ׳אט (${agent.nameHe}).`
          : `אושר לביצוע מבוקר ושקוף ע״י ${agent.nameHe}.`,
        undefined,
        true
      ),
    };
  }

  // ==========================================================================
  // SECTION 3 & 8: RECORD ACTION & MEASURE GENUINE HUMAN OUTCOME AFTER 15s
  // ==========================================================================

  public recordCrewActionAndScheduleMeasurement(params: {
    agent: AiModeratorIdentityProfile;
    streamId: string;
    creatorUsername: string;
    addressedTo: string;
    purposeHe: string;
    messageTextHe: string;
    dispatchedState: AiModeratorActionAuditRecord['dispatchedLiveOrSuggested'];
    dataFactory: BoosteraDataFactory;
    knowledgeEngine: BoosteraKnowledgeEngine;
    onMeasured?: () => void;
  }): AiModeratorActionAuditRecord {
    const now = Date.now();
    const dossier = params.dataFactory.getStreamDossier(params.streamId);
    const preHumanMpm = dossier?.chatMetrics.humanMessagesPerMin ?? 0;

    const audit: AiModeratorActionAuditRecord = {
      auditId: this.nextId('crewaudit'),
      timestamp: now,
      agentId: params.agent.agentId,
      agentNameHe: params.agent.nameHe,
      crewRole: params.agent.crewRole,
      targetStreamId: params.streamId,
      addressedTo: params.addressedTo,
      purposeHe: params.purposeHe,
      preChatState: {
        humanMessagesPerMin: preHumanMpm,
        unansweredQuestionsCount: dossier?.chatMetrics.repeatedUnansweredCount ?? 0,
        creatorSpeaking: dossier?.creatorCurrentlySpeaking ?? false,
        chatBurstActive: dossier?.chatMetrics.burstActive ?? false,
      },
      messageTextHe: params.messageTextHe,
      dispatchedLiveOrSuggested: params.dispatchedState,
      postActionMeasuredAtTs: null,
      postOutcomeSummaryHe:
        params.dispatchedState === 'SUGGESTED_PENDING_APPROVAL'
          ? 'הוצע לאישור המנהל/היוצר (טרם פורסם בצ׳אט)'
          : 'מודד תגובות אנושיות ב-15 השניות הקרובות (ללא ספירת הודעות AI)...',
      receivedGenuineHumanReply: false,
      humanRepliesCountAfter15s: 0,
      causedChatOverload: false,
      impactAssessment: 'PENDING_MEASUREMENT',
      behaviorAdjustmentNeededHe: null,
      evidenceEventIds: [],
    };

    params.agent.lastMessageHe = params.messageTextHe;
    params.agent.lastMessageAtTs = now;
    params.agent.currentActivityState =
      params.dispatchedState === 'SENT_AUTHORIZED' ? 'ACTIVE_IN_STREAM' : 'PREPARING_SUGGESTION';
    params.agent.whatDoingNowHe = params.purposeHe;
    params.agent.whyDoingNowHe = `פנייה אל ${params.addressedTo} ב-${params.streamId}`;
    params.agent.qualityMetrics.totalActionsCount += 1;

    if (params.dispatchedState === 'SENT_AUTHORIZED') {
      const ingested = params.dataFactory.ingestEvent({
        streamId: params.streamId,
        creatorUsername: params.creatorUsername,
        timestamp: now,
        source: 'AI_CHAT_CREW',
        reliability: 'VERIFIED_SYSTEM_AGENT',
        actorOrigin: 'AI_AGENT',
        category: 'AI_MODERATOR_ACTION',
        subType: params.agent.crewRole,
        actorHandle: params.agent.linkedCompanionHandle,
        actorDisplayName: params.agent.nameHe,
        explicitRole: 'AI_CHAT_MODERATOR',
        aiAgentId: params.agent.agentId,
        targetHandle: params.addressedTo,
        textContent: params.messageTextHe,
      });
      if (ingested) {
        audit.evidenceEventIds.push(ingested.eventId);
      }

      // Measure genuine human outcome after 15 seconds!
      setTimeout(() => {
        const measuredAt = Date.now();
        const postDossier = params.dataFactory.getStreamDossier(params.streamId);
        const humanWindow = params.dataFactory.countGenuineHumanResponsesInWindow(
          params.streamId,
          now,
          measuredAt
        );
        const postHumanMpm = postDossier?.chatMetrics.humanMessagesPerMin ?? 0;
        const causedOverload = postHumanMpm > this.busyChatThresholdPerMin * 1.35;

        audit.postActionMeasuredAtTs = measuredAt;
        audit.humanRepliesCountAfter15s = humanWindow.humanRepliesCount;
        audit.receivedGenuineHumanReply =
          humanWindow.humanRepliesCount > 0 || humanWindow.creatorReplied;
        audit.causedChatOverload = causedOverload;
        audit.evidenceEventIds = [...audit.evidenceEventIds, ...humanWindow.evidenceEventIds];

        if (causedOverload) {
          audit.impactAssessment = 'INTERFERED';
          audit.postOutcomeSummaryHe = `נוצר עומס גבוה בצ׳אט (${postHumanMpm} הודעות/דקה) לאחר ההודעה.`;
          audit.behaviorAdjustmentNeededHe = 'להעלות זמן קירור ולהימנע משליחה בקצב גבוה.';
          params.agent.qualityMetrics.interferingActionsCount += 1;
          params.agent.qualityMetrics.overloadIncidentsCount += 1;
          params.agent.improvementRecommendationHe = audit.behaviorAdjustmentNeededHe;
        } else if (audit.receivedGenuineHumanReply) {
          audit.impactAssessment = 'HELPED';
          audit.postOutcomeSummaryHe = `נצפו ${humanWindow.humanRepliesCount} תגובות של צופים אנושיים${
            humanWindow.creatorReplied ? ' + התייחסות מהיוצר' : ''
          } תוך 15 שניות (ללא ספירת בוטים).`;
          params.agent.qualityMetrics.helpfulActionsCount += 1;
          params.agent.qualityMetrics.genuineHumanRepliesReceived += humanWindow.humanRepliesCount;
        } else {
          audit.impactAssessment = 'NEUTRAL';
          audit.postOutcomeSummaryHe =
            'לא נצפתה תגובה אנושית ישירה ב-15 השניות שלאחר ההודעה — ייתכן שעדיף להמתין לשאלה ממוקדת יותר.';
          params.agent.qualityMetrics.neutralActionsCount += 1;
          if (params.agent.qualityMetrics.neutralActionsCount >= 3 && params.agent.qualityMetrics.helpfulActionsCount === 0) {
            audit.behaviorAdjustmentNeededHe = 'להוריד רמת יוזמה ל-LOW ולהגיב רק לשאלות מפורשות של צופים.';
            params.agent.improvementRecommendationHe = audit.behaviorAdjustmentNeededHe;
            this.proposeIdentityChange({
              agentId: params.agent.agentId,
              proposedBy: 'CONTROL_LEARNING',
              reasonHe: '3 הודעות רצופות ללא מענה אנושי — מומלץ להוריד רמת יוזמה כדי לשמור על ניקיון הצ׳אט.',
              evidenceEventIds: audit.evidenceEventIds.length > 0 ? audit.evidenceEventIds : ['audit_neutral_streak'],
              proposedPatch: { initiativeLevel: 'LOW' },
            });
          }
        }

        const totalMeasured =
          params.agent.qualityMetrics.helpfulActionsCount +
          params.agent.qualityMetrics.neutralActionsCount +
          params.agent.qualityMetrics.interferingActionsCount;
        if (totalMeasured > 0) {
          params.agent.qualityMetrics.qualityScorePct = Math.round(
            ((params.agent.qualityMetrics.helpfulActionsCount * 100 +
              params.agent.qualityMetrics.neutralActionsCount * 65) /
              (totalMeasured * 100)) *
              100
          );
        }

        params.knowledgeEngine.recordEmpiricalTrial({
          patternKey: `crew_${params.agent.crewRole}`,
          subjectLabelHe: params.agent.nameHe,
          kind: 'MOD_PROMPT_TRIAL',
          streamId: params.streamId,
          beforeMetric: preHumanMpm,
          afterMetric: preHumanMpm + humanWindow.humanRepliesCount * 4,
          evidenceEventIds: audit.evidenceEventIds,
        });

        params.agent.currentActivityState = 'IDLE_LISTENING';
        this.saveToDisk();
        if (params.onMeasured) params.onMeasured();
      }, 15000);
    }

    this.recentActionAudits.unshift(audit);
    if (this.recentActionAudits.length > 60) this.recentActionAudits.length = 60;
    this.saveToDisk();
    return audit;
  }

  public getControlCenterState(): AiCrewControlCenterState {
    return {
      maxActiveCrewPerStream: this.maxActiveCrewPerStream,
      transparentDisclosureEnforced: true,
      antiSyntheticConversationEnforced: true,
      silenceWhenCreatorSpeaks: this.silenceWhenCreatorSpeaks,
      busyChatThresholdPerMin: this.busyChatThresholdPerMin,
      agents: this.agents,
      recentActionAudits: this.recentActionAudits.slice(0, 35),
      recentOrchestratorGates: this.recentOrchestratorGates.slice(0, 35),
    };
  }
}
