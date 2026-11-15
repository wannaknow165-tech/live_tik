/**
 * BOOSTERA — CENTRAL INTELLIGENCE, AI CHAT CREW & AUTONOMOUS BRAIN
 * Six-Layer Unified Architecture:
 *   1. OBSERVATION        — Multi-Live Data Factory & Live Multimodal Observer
 *   2. KNOWLEDGE          — Verified Facts, Hypotheses, Semantic Vector Memory & Cross-Stream Learning
 *   3. IDENTITY           — 1..4 Transparent AI Crew Agents with Persistent Identity, Memory & Permissions
 *   4. BRAIN              — Independent OpenAI (Strategic Director) + Claude (Behavior & Quality Analyst) + Gemini Multimodal via OpenRouter + Arbiter
 *   5. EXECUTION          — Existing BOOSTERA Engine Bridge + Chat Orchestrator Gatekeeper
 *   6. CONTROL & LEARNING — Post-Action Human-Only Outcome Measurement, Crew Self-Audit & Ideas Lab
 */

export type SixLayerStageId =
  | 'OBSERVATION'
  | 'KNOWLEDGE'
  | 'IDENTITY'
  | 'BRAIN'
  | 'EXECUTION'
  | 'CONTROL_AND_LEARNING';

export type EventSourceKind =
  | 'TIKTOK_WEBCAST_LIVE'
  | 'AUTHORIZED_MEDIA_STREAM'
  | 'AI_CHAT_CREW'
  | 'EXECUTION_ENGINE'
  | 'REPLAY_RECORDING'
  | 'TEST_HARNESS';

export type EventReliabilityLevel =
  | 'VERIFIED_TIKTOK'
  | 'VERIFIED_LOCAL_MEDIA'
  | 'VERIFIED_SYSTEM_AGENT'
  | 'VERIFIED_EXECUTION'
  | 'DERIVED_METRIC'
  | 'REPLAY_VERIFIED'
  | 'TEST_SYNTHETIC';

/**
 * Mandatory strict separation between Human Viewers, Creator, Human Moderators, and AI Agents.
 * AI Agent messages are NEVER counted as human audience reactions or crowd engagement!
 */
export type ActorOriginKind =
  | 'HUMAN_VIEWER'
  | 'CREATOR_HOST'
  | 'CO_CREATOR_OR_RIVAL'
  | 'HUMAN_MODERATOR'
  | 'AI_AGENT'
  | 'SYSTEM_STAGE';

export type CanonicalEventCategory =
  | 'STREAM_LIFECYCLE'
  | 'PARTICIPANT_PRESENCE'
  | 'CHAT_MESSAGE'
  | 'AI_MODERATOR_ACTION'
  | 'SPEECH_TRANSCRIPT'
  | 'ENGAGEMENT_SIGNAL'
  | 'BATTLE_STATE'
  | 'AUDIO_MUSIC_OBSERVATION'
  | 'VISUAL_SCENE_OBSERVATION'
  | 'SYSTEM_EXECUTION';

export type ParticipantRoleKind =
  | 'HOST_CREATOR'
  | 'CO_HOST'
  | 'BATTLE_OPPONENT'
  | 'HUMAN_CHAT_MODERATOR'
  | 'AI_CHAT_MODERATOR'
  | 'VIP_SUPPORTER'
  | 'VIEWER';

export type ChatSemanticSubKind =
  | 'PUBLIC_STATEMENT'
  | 'VIEWER_QUESTION'
  | 'REPEATED_QUESTION'
  | 'REPLY_TO_HOST'
  | 'REPLY_TO_HUMAN_MOD'
  | 'REPLY_TO_AI_MOD'
  | 'REPLY_TO_OPPONENT'
  | 'PARTICIPANT_MENTION'
  | 'HUMAN_MOD_ANNOUNCEMENT'
  | 'AI_MOD_TRANSPARENT_MESSAGE'
  | 'POST_EVENT_REACTION';

export interface CanonicalLiveEvent {
  eventId: string;
  streamId: string;
  creatorUsername: string;
  timestamp: number;
  source: EventSourceKind;
  reliability: EventReliabilityLevel;
  actorOrigin: ActorOriginKind;
  category: CanonicalEventCategory;
  subType: string;
  actorHandle: string;
  actorDisplayName: string;
  actorRole: ParticipantRoleKind;
  aiAgentId?: string | null;
  targetHandle?: string | null;
  targetRole?: ParticipantRoleKind | null;
  numericValue?: number;
  textContent?: string;
  sanitizedTextContent?: string;
  promptInjectionFlagged?: boolean;
  chatSubKind?: ChatSemanticSubKind;
  languageTag?: string;
  relatedEventIds: string[];
  metadata?: Record<string, string | number | boolean | null>;
}

export interface StreamParticipantProfile {
  handle: string;
  displayName: string;
  actorOrigin: ActorOriginKind;
  role: ParticipantRoleKind;
  roleConfidence: number;
  firstSeenTs: number;
  lastSeenTs: number;
  humanMessagesCount: number;
  aiMessagesCount: number;
  questionsAsked: number;
  speechTurnsCount: number;
  likesCount: number;
  giftsDiamondsTotal: number;
}

export interface RepeatedQuestionCluster {
  clusterId: string;
  streamId: string;
  normalizedQuestionHe: string;
  sampleRawQuestion: string;
  occurrencesCount: number;
  distinctAskHandles: string[];
  firstAskedTs: number;
  lastAskedTs: number;
  answeredByHostOrMod: boolean;
  evidenceEventIds: string[];
}

export interface LiveStreamDossier {
  streamId: string;
  creatorUsername: string;
  roomId: string | null;
  source: EventSourceKind;
  connected: boolean;
  startedAtTs: number;
  endedAtTs: number | null;
  lastEventTs: number;
  activeAiCrewCount: number; // 1..4 configurable per live stream
  creatorCurrentlySpeaking: boolean;
  lastCreatorSpeechTs: number | null;
  viewerCount: number | null;
  viewerCountVerified: boolean;
  peakViewers: number | null;
  participants: StreamParticipantProfile[];
  coHosts: string[];
  opponents: string[];
  humanModeratorsDetected: string[];
  aiModeratorsAssigned: string[];
  chatMetrics: {
    humanViewerMessagesCount: number; // Strictly human viewers ONLY (excludes AI agents!)
    creatorMessagesCount: number;
    humanModeratorMessagesCount: number;
    aiAgentMessagesCount: number; // Tracked separately — never inflates crowd metrics!
    questionsCount: number;
    repeatedUnansweredCount: number;
    repliesToHostCount: number;
    repliesToHumanModCount: number;
    repliesToAiModCount: number;
    repliesToOpponentCount: number;
    humanMessagesPerMin: number;
    burstActive: boolean;
    lastTopicShiftSummaryHe: string | null;
    postEventReactionRatio: number;
  };
  engagementMetrics: {
    totalLikes: number;
    likesPerSec: number;
    totalShares: number;
    totalGifts: number;
    totalDiamonds: number;
    newFollowers: number;
    joinsCount: number;
    leavesCount: number;
    peakMomentCount: number;
    medianCrowdResponseMs: number | null;
  };
  battleMetrics: {
    inBattle: boolean;
    battleStartedAtTs: number | null;
    battleEndedAtTs: number | null;
    opponentUsername: string | null;
    verifiedHostScore: number | null;
    verifiedOpponentScore: number | null;
    scoreLeadState: 'LEADING' | 'TRAILING' | 'TIED' | 'UNKNOWN';
    scoreMomentumPer10s: number;
    verifiedGloveActive: boolean;
    verifiedBonusTaskActive: boolean;
    crowdReactionToScoreShiftHe: string | null;
  };
  audioSourceConnected: boolean;
  videoSourceConnected: boolean;
  latestAudioSummaryHe: string | null;
  latestVisualSummaryHe: string | null;
}

export interface ReplaySessionRecord {
  replayId: string;
  titleHe: string;
  createdAtTs: number;
  streamIds: string[];
  durationMs: number;
  eventsCount: number;
  events: CanonicalLiveEvent[];
}

export interface DataFactorySnapshot {
  maxConcurrentStreams: number;
  activeStreamsCount: number;
  totalEventsCaptured: number;
  deduplicatedDropsCount: number;
  promptInjectionsBlockedCount: number;
  streams: LiveStreamDossier[];
  recentCanonicalEvents: CanonicalLiveEvent[];
  repeatedQuestions: RepeatedQuestionCluster[];
  availableReplays: Array<Omit<ReplaySessionRecord, 'events'>>;
  activeReplayStatus: {
    running: boolean;
    replayId: string | null;
    progressPct: number;
  };
}

// ============================================================================
// LAYER 3: AI CHAT CREW IDENTITIES (1..4 TRANSPARENT MODERATOR AGENTS)
// ============================================================================

export type AiCrewArchetypeId =
  | 'CONVERSATION_HOST'
  | 'COMMUNITY_MANAGER'
  | 'BATTLE_ANALYST'
  | 'CREATIVE_ENGAGEMENT';

export type AgentInitiativeLevel = 'LOW' | 'BALANCED' | 'PROACTIVE';

export type AgentAllowedTarget = 'CREATOR' | 'VIEWERS' | 'CO_HOSTS' | 'HUMAN_MODS';

export interface IdentityChangeProposal {
  proposalId: string;
  createdAtTs: number;
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
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
}

export interface AiModeratorIdentityProfile {
  agentId: string;
  linkedCompanionSlotNumber: number; // Bridges directly to existing CompanionAccountSlot (#1..#4)
  linkedCompanionHandle: string;
  nameHe: string;
  crewRole: AiCrewArchetypeId;
  roleTitleHe: string;
  transparentDisclosurePrefixHe: string; // Mandatory transparency e.g. "[בוט מנחה AI]" — never impersonates humans!
  enabled: boolean;
  pausedByBrainUntilTs: number;
  language: string;
  speakingStyleHe: string;
  communicativePersonaHe: string;
  knowledgeDomainsHe: string[];
  initiativeLevel: AgentInitiativeLevel;
  minCooldownSec: number;
  whenAllowedToRespondHe: string[];
  allowedTargets: AgentAllowedTarget[];
  actionsRequiringApproval: string[];
  forbiddenBehaviorsHe: string[];
  relevantConversationMemoryHe: string[];
  currentActivityState: 'IDLE_LISTENING' | 'PREPARING_SUGGESTION' | 'ACTIVE_IN_STREAM' | 'PAUSED_BY_BRAIN' | 'MUTED_CREATOR_SPEAKING';
  whatDoingNowHe: string;
  whyDoingNowHe: string;
  lastMessageHe: string | null;
  lastMessageAtTs: number | null;
  lastBrainDirectiveHe: string | null;
  lastOpenAiNoteHe: string | null;
  lastClaudeNoteHe: string | null;
  improvementRecommendationHe: string | null;
  qualityMetrics: {
    totalActionsCount: number;
    helpfulActionsCount: number;
    neutralActionsCount: number;
    interferingActionsCount: number;
    genuineHumanRepliesReceived: number;
    overloadIncidentsCount: number;
    suppressedByOrchestratorCount: number;
    qualityScorePct: number;
  };
  pendingIdentityProposal: IdentityChangeProposal | null;
}

export interface AiModeratorActionAuditRecord {
  auditId: string;
  timestamp: number;
  agentId: string;
  agentNameHe: string;
  crewRole: AiCrewArchetypeId;
  targetStreamId: string;
  addressedTo: string;
  purposeHe: string;
  preChatState: {
    humanMessagesPerMin: number;
    unansweredQuestionsCount: number;
    creatorSpeaking: boolean;
    chatBurstActive: boolean;
  };
  messageTextHe: string;
  dispatchedLiveOrSuggested: 'SENT_AUTHORIZED' | 'SUGGESTED_PENDING_APPROVAL' | 'SUPPRESSED_BY_ORCHESTRATOR';
  postActionMeasuredAtTs: number | null;
  postOutcomeSummaryHe: string;
  receivedGenuineHumanReply: boolean; // Strictly human viewers/creator only!
  humanRepliesCountAfter15s: number;
  causedChatOverload: boolean;
  impactAssessment: 'HELPED' | 'NEUTRAL' | 'INTERFERED' | 'PENDING_MEASUREMENT';
  behaviorAdjustmentNeededHe: string | null;
  evidenceEventIds: string[];
}

export interface ChatOrchestratorGateLog {
  gateId: string;
  timestamp: number;
  streamId: string;
  candidateAgentId: string;
  candidateRole: AiCrewArchetypeId;
  whoShouldRespondHe: string;
  whyRespondHe: string;
  viewerValueHe: string;
  timingAppropriate: boolean;
  decision: 'APPROVED_FOR_DISPATCH' | 'QUEUED_FOR_HUMAN_APPROVAL' | 'BLOCKED';
  blockReasonCode?:
    | 'DUPLICATE_MESSAGE'
    | 'CONTRADICTORY_RESPONSE'
    | 'CHAT_OVERLOAD_BUSY'
    | 'CREATOR_SPEAKING_NOW'
    | 'UNVERIFIED_FACT_CLAIM'
    | 'QUESTION_ALREADY_HANDLED'
    | 'BOT_TO_BOT_FORBIDDEN'
    | 'NO_VIEWER_VALUE'
    | 'AGENT_PAUSED_OR_COOLDOWN';
  explanationHe: string;
}

export interface AiCrewControlCenterState {
  maxActiveCrewPerStream: number; // 1..4 configurable per live stream
  transparentDisclosureEnforced: boolean; // Always true: AI agents never impersonate human viewers
  antiSyntheticConversationEnforced: boolean; // Always true: AI agents never talk to each other to fake hype
  silenceWhenCreatorSpeaks: boolean;
  busyChatThresholdPerMin: number;
  agents: AiModeratorIdentityProfile[];
  recentActionAudits: AiModeratorActionAuditRecord[];
  recentOrchestratorGates: ChatOrchestratorGateLog[];
}

// ============================================================================
// ALL 12 LIVE RELATIONSHIP CROSS-CORRELATIONS & INTERACTION GRAPH
// ============================================================================

export type CrossCorrelationDomain =
  | 'AI_MOD_VS_VIEWERS'          // 1. מנחה AI מול הצופים
  | 'AI_MOD_VS_CREATOR'          // 2. מנחה AI מול היוצר
  | 'AI_MOD_VS_HUMAN_MOD'        // 3. מנחה AI מול מנהל צ׳אט אנושי
  | 'CREATOR_VS_VIEWERS'         // 4. היוצר מול הצופים
  | 'CREATOR_VS_OPPONENT'        // 5. היוצר מול היריב
  | 'CREATOR_VS_CO_CREATORS'     // 6. היוצר מול יוצרים נוספים
  | 'OPPONENT_VS_VIEWERS'        // 7. היריב מול הצופים
  | 'CHAT_VS_BATTLE_EVENTS'      // 8. הצ׳אט מול אירועי הקרב
  | 'CHAT_VS_MUSIC'              // 9. הצ׳אט מול המוזיקה
  | 'CHAT_VS_VFX'                // 10. הצ׳אט מול האפקטים
  | 'MODS_VS_STREAM_EVENTS'      // 11. המנחים מול אירועי השידור
  | 'UNIFIED_ALL_CONVERSATIONS'; // 12. כל השיחות והאירועים יחד

export interface InteractionGraphNode {
  nodeId: string;
  streamId: string;
  label: string;
  nodeType:
    | 'CREATOR'
    | 'OPPONENT'
    | 'CO_HOST'
    | 'HUMAN_MOD'
    | 'AI_CREW_AGENT'
    | 'VIEWER_COHORT'
    | 'STAGE_VFX_AUDIO'
    | 'BATTLE_EVENT';
  activityScore: number;
  lastActiveTs: number;
}

export interface InteractionGraphEdge {
  edgeId: string;
  streamId: string;
  fromNodeId: string;
  toNodeId: string;
  domain: CrossCorrelationDomain;
  relationLabelHe: string;
  deltaMs: number;
  weight: number;
  confidence: number;
  isHypothesis: boolean;
  hypothesisReasonHe?: string;
  evidenceEventIds: string[];
  updatedAtTs: number;
}

export interface InteractionTimelineChain {
  chainId: string;
  streamId: string;
  startedAtTs: number;
  totalSpanMs: number;
  summaryChainHe: string;
  isHypothesis: boolean;
  confidence: number;
  steps: Array<{
    eventId: string;
    offsetMs: number;
    actorOrigin: ActorOriginKind;
    actorLabel: string;
    actionHe: string;
    reliability: EventReliabilityLevel;
  }>;
}

export interface CrossCorrelationFinding {
  findingId: string;
  streamId: string;
  domain: CrossCorrelationDomain;
  headlineHe: string;
  explanationHe: string;
  measuredDeltaSummaryHe: string;
  confidence: number;
  isHypothesis: boolean;
  evidenceEventIds: string[];
  detectedAtTs: number;
}

export interface CrossLiveAnalyticsSnapshot {
  lastComputedAtTs: number;
  nodes: InteractionGraphNode[];
  edges: InteractionGraphEdge[];
  causalChains: InteractionTimelineChain[];
  findings: CrossCorrelationFinding[];
}

// ============================================================================
// LIVE MULTIMODAL OBSERVER
// ============================================================================

export interface VisualSceneTelemetry {
  sourceConnected: boolean;
  sourceType: 'NONE' | 'WEBCAM' | 'SCREEN_SHARE' | 'VIDEO_FILE';
  capturedAtTs: number;
  motionIndexPct: number;
  lightingBrightnessPct: number;
  dominantColorToneHe: string;
  visualClutterPct: number;
  subjectOccludedByVfx: boolean;
  cameraAngleChangeDetected: boolean;
  visualPeakDetected: boolean;
  beforeAfterVfxComparisonHe: string | null;
  visibleExpressionCueHe: string | null;
  aiSceneSummaryHe: string | null;
  confidence: number;
}

export interface SpeechTranscriptSegment {
  segmentId: string;
  streamId: string;
  startedAtTs: number;
  endedAtTs: number;
  speakerLabel: string;
  speakerVerified: boolean;
  language: string;
  text: string;
  containsSpokenQuestion: boolean;
  speechRateWpm: number | null;
  vocalToneHe: string;
  volumeDb: number | null;
  linkedChatEventIds: string[];
  providerUsed: string;
}

export interface CarefulAffectEstimate {
  estimateId: string;
  streamId: string;
  timestamp: number;
  apparentAtmosphere:
    | 'TENSION'
    | 'EXCITEMENT'
    | 'CALM'
    | 'FRUSTRATION'
    | 'SURPRISE'
    | 'HUMOR'
    | 'ENERGY_SHIFT';
  labelHe: string;
  confidence: number;
  observableEvidenceHe: string[];
  epistemicDisclaimerHe: string;
  evidenceEventIds: string[];
}

export interface AudioMusicTelemetry {
  sourceConnected: boolean;
  sourceLabelHe: string;
  capturedAtTs: number;
  rmsLoudnessDb: number | null;
  estimatedBpm: number | null;
  beatRegularityPct: number | null;
  energyShiftDeltaPct: number | null;
  silenceDetected: boolean;
  silenceDurationMs: number;
  musicalBurstDetected: boolean;
  speechBandClarityPct: number | null;
  sfxImpairingSpeech: boolean;
  musicSpeechAlignmentHe: string;
}

export interface MultimodalObserverState {
  visual: VisualSceneTelemetry;
  audio: AudioMusicTelemetry;
  recentTranscripts: SpeechTranscriptSegment[];
  affectEstimates: CarefulAffectEstimate[];
  statusBannerHe: string;
}

// ============================================================================
// LAYER 4 & 5: AI BRAIN — OPENAI + CLAUDE + GEMINI ORCHESTRATOR & EXECUTION
// ============================================================================

export type DecisionActionType =
  | 'NO_ACTION'
  | 'CHANGE_MUSIC'
  | 'REDUCE_SOUND'
  | 'TRIGGER_VFX'
  | 'CHANGE_CAMERA'
  | 'SUGGEST_CHAT_REPLY'
  | 'SUGGEST_MODERATION'
  | 'PAUSE_AI_MODERATOR'
  | 'ANSWER_REPEATED_QUESTION'
  | 'ANNOUNCE_VERIFIED_BATTLE_SCORE'
  | 'PROPOSE_CREATOR_QUESTION'
  | 'SILENCE_ALL_AI_CREW'
  | 'THROTTLE_CHAT_AUTOMATION'
  | 'PROPOSE_IDENTITY_UPDATE'
  | 'CREATE_NEW_EFFECT'
  | 'CREATE_NEW_CONTENT'
  | 'REQUEST_MORE_DATA'
  | 'ESCALATE_TO_HUMAN';

export type DecisionTierLevel =
  | 'FAST_REACTION'
  | 'STRATEGIC_ANALYSIS'
  | 'DEEP_INTELLIGENCE';

export interface AiOrchestratorConfig {
  openRouterKeyConfiguredOnServer: boolean;
  geminiServerKeyConfigured: boolean;
  analysisMode: DecisionTierLevel;
  openAiModel: string;
  openAiFallbackModel: string;
  openAiEnabled: boolean;
  claudeModel: string;
  claudeFallbackModel: string;
  claudeEnabled: boolean;
  geminiModel: string;
  geminiFallbackModel: string;
  geminiEnabled: boolean;
  fastRouterModel: string;
  sttModel: string;
  sttFallbackModel: string;
  embeddingModel: string;
  embeddingFallbackModel: string;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  zeroDataRetention: boolean;
  piiSanitizationEnabled: boolean;
  autoExecuteApprovedVfx: boolean;
  requireApprovalForChatAndMod: boolean;
  maxVfxIntensity: number;
  minConfidenceForAutoAction: number;
  strategicIntervalSec: number;
}

export type OpenRouterRoleSlot =
  | 'OPENAI_STRATEGIST'
  | 'CLAUDE_CRITIC'
  | 'GEMINI_MULTIMODAL'
  | 'FAST_ROUTER'
  | 'STT_TRANSCRIBE'
  | 'EMBEDDINGS';

export interface ModelHealthCheckResult {
  role: OpenRouterRoleSlot;
  roleLabelHe: string;
  modelId: string;
  fallbackModelId?: string;
  catalogVerified: boolean;
  fallbackCatalogVerified?: boolean;
  modalitiesSupported?: string[];
  promptPricePer1MUsd?: number | null;
  reachable: boolean;
  usedFallback: boolean;
  latencyMs: number | null;
  statusHe: string;
  checkedAtTs: number;
}

export interface OpenRouterConnectionSummary {
  singleKeyModeActive: boolean;
  keyConfiguredOnServer: boolean;
  keyAuthenticated: boolean | null;
  keyLabelMasked: string | null;
  keyLimitRemainingUsd: number | null;
  catalogReachable: boolean;
  catalogTotalChatModels: number;
  catalogTotalEmbeddingModels: number;
  verifiedSlotsCount: number;
  totalSlotsCount: number;
  allConfiguredModelsInCatalog: boolean;
  lastVerifiedAtTs: number | null;
  statusSummaryHe: string;
  recommendedChoices: {
    openAi: string[];
    claude: string[];
    gemini: string[];
    fast: string[];
    stt: string[];
    embeddings: string[];
  };
}

export interface CrewAgentBrainNote {
  agentId: string;
  crewRole: AiCrewArchetypeId;
  directiveHe: string;
  shouldPause: boolean;
  suggestedLineHe?: string | null;
}

export interface ModelIndependentOpinion {
  role: 'OPENAI_STRATEGIST' | 'CLAUDE_CRITIC' | 'GEMINI_MULTIMODAL';
  modelId: string;
  invoked: boolean;
  succeeded: boolean;
  usedFallbackRoute: boolean;
  latencyMs: number;
  costUsd: number;
  observedSituationHe: string;
  recommendedAction: DecisionActionType;
  targetCrewAgentId?: string | null;
  recommendedEffectOrTrackId?: string | null;
  recommendedLayer?: 'FRONT' | 'BACK' | null;
  recommendedIntensity?: number | null;
  recommendedDurationMs?: number | null;
  suggestedChatOrCreatorPromptHe?: string | null;
  crewNotes?: CrewAgentBrainNote[];
  confidence: number;
  citedEvidenceIds: string[];
  reasoningHe: string;
  alternativeInterpretationHe?: string | null;
  riskWarningHe?: string | null;
  suggestsWaitNoAction: boolean;
}

export type BrainPipelineStageId =
  | 'DATA'
  | 'OPENAI'
  | 'CLAUDE'
  | 'CROSS_CHECK'
  | 'DECISION'
  | 'APPROVAL'
  | 'EXECUTION'
  | 'RESULT'
  | 'MEMORY';

export type BrainPipelineBlockStatus =
  | 'WAITING'
  | 'ANALYZING'
  | 'COMPLETED'
  | 'REQUIRES_APPROVAL'
  | 'FAILED';

export interface BrainPipelineStageEntry {
  stageId: BrainPipelineStageId;
  status: BrainPipelineBlockStatus;
  summaryHe: string;
  updatedAtTs: number;
  latencyMs?: number | null;
}

export type DecisionApproverKind =
  | 'NONE'
  | 'OPERATOR'
  | 'OPERATOR_MODIFIED'
  | 'AUTO_POLICY'
  | 'REJECTED_BY_OPERATOR';

export type DecisionResultOutcome =
  | 'NOT_EXECUTED'
  | 'MEASURING_OUTCOME'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  | 'BLOCKED';

export interface DecisionInputSnapshot {
  capturedAtTs: number;
  activeLivesCount: number;
  streamsSummary: Array<{
    streamId: string;
    creatorUsername: string;
    connected: boolean;
    viewerCount: number | null;
    humanMessagesPerMin: number;
    aiMessagesCount: number;
    likesPerSec: number;
    totalDiamonds: number;
    inBattle: boolean;
    opponentUsername: string | null;
    verifiedHostScore: number | null;
    verifiedOpponentScore: number | null;
    creatorSpeakingNow: boolean;
  }>;
  chatSamples: Array<{
    eventId: string;
    timestamp: number;
    actorHandle: string;
    actorOrigin: ActorOriginKind;
    role: ParticipantRoleKind;
    text: string;
    streamId: string;
  }>;
  moderatorSignals: Array<{
    agentId: string;
    nameHe: string;
    crewRole: AiCrewArchetypeId;
    linkedSlotNumber: number;
    linkedHandle: string;
    activityState: string;
    helpfulCount: number;
    interferedCount: number;
    lastMessageHe: string | null;
  }>;
  creatorSignals: Array<{
    timestamp: number;
    kind: string;
    summaryHe: string;
    eventId?: string;
  }>;
  opponentSignals: Array<{
    timestamp: number;
    opponentHandle: string;
    summaryHe: string;
    verifiedHostScore: number | null;
    verifiedOpponentScore: number | null;
  }>;
  musicAndAudio: {
    activeMusicTrackId: string;
    stageMusicVolumePct: number;
    audioSourceConnected: boolean;
    loudnessDb: number | null;
    bpm: number | null;
    speechClarityPct: number | null;
    sfxImpairingSpeech: boolean;
  };
  effectsAndVisual: {
    activeEffectsOnStage: Array<{ effectId: string; layer: string }>;
    cameraMode: string;
    visualSourceConnected: boolean;
    motionPct: number | null;
    clutterPct: number | null;
    subjectOccludedByVfx: boolean;
  };
  repeatedQuestions: Array<{
    questionHe: string;
    count: number;
    askersCount: number;
    streamId: string;
  }>;
  crossCorrelations: Array<{
    domain: CrossCorrelationDomain;
    headlineHe: string;
    deltaHe: string;
    isHypothesis: boolean;
    confidence: number;
    evidenceIds: string[];
  }>;
  sanitizedModelPayloadJson: string;
}

export interface ApprovedActionSpec {
  action: DecisionActionType;
  targetLive: string;
  targetAccountSlot: number | null;
  targetAccountHandle: string | null;
  targetAgentId: string | null;
  effectId: string | null;
  musicTrackId: string | null;
  cameraPresetId: string | null;
  layer: 'FRONT' | 'BACK' | null;
  intensity: number;
  durationMs: number;
  suggestedChatTextHe: string | null;
}

export interface DecisionApprovalAudit {
  approver: DecisionApproverKind;
  approverLabelHe: string;
  approvedAtTs: number | null;
  policyRuleAppliedHe: string | null;
  operatorNoteHe: string | null;
  wasModifiedBeforeApproval: boolean;
  modificationsSummaryHe: string[];
  originalRecommendedDecision: DecisionActionType;
  approvedActionSpec: ApprovedActionSpec | null;
}

export interface DecisionExecutionAudit {
  attemptedAtTs: number | null;
  subsystemDispatched:
    | 'VFX_ENGINE'
    | 'CAMERA_ENGINE'
    | 'AUDIO_MUSIC_ENGINE'
    | 'AI_CHAT_CREW_ACCOUNT'
    | 'IDEAS_LAB'
    | 'NONE';
  subsystemLabelHe: string;
  targetLive: string;
  targetAccountSlot: number | null;
  targetAccountHandle: string | null;
  targetAgentId: string | null;
  dispatchedAction: DecisionActionType | null;
  dispatchedPayloadSummaryHe: string;
  dispatchedParams: Record<string, string | number | boolean | null>;
  matchesApprovedSpec: boolean;
  parityCheckSummaryHe: string;
}

export interface DecisionResultAndLearningAudit {
  outcome: DecisionResultOutcome;
  outcomeLabelHe: string;
  completedAtTs: number | null;
  resultSummaryHe: string;
  postActionMeasuredAtTs: number | null;
  beforeMetrics: { humanMpm: number; likesPerSec: number } | null;
  afterMetrics: { humanMpm: number; likesPerSec: number; genuineHumanReplies: number } | null;
  whatHappenedNextHe: string;
  knowledgeEntryId: string | null;
  learningSummaryHe: string;
  recommendedAdjustmentHe: string;
}

export interface LiveBrainPipelineProgress {
  runId: string;
  active: boolean;
  startedAtTs: number;
  updatedAtTs: number;
  targetLive: string;
  tier: DecisionTierLevel;
  currentStage: BrainPipelineStageId;
  stages: Record<BrainPipelineStageId, BrainPipelineStageEntry>;
  linkedDecisionId: string | null;
}

export interface StructuredBrainDecision {
  decision_id: string;
  timestamp: number;
  tier: DecisionTierLevel;
  target_live: string;
  target_agent_id?: string | null;
  target_account_slot?: number | null;
  target_account_handle?: string | null;
  observed_situation: string;
  evidence_event_ids: string[];
  openai_recommendation: string;
  claude_recommendation: string;
  claude_agrees_with_openai?: boolean;
  claude_agreement_summary_he?: string;
  gemini_observation: string | null;
  models_agree: boolean;
  disagreement_points_he: string[];
  final_decision: DecisionActionType;
  effect_id: string | null;
  music_track_id?: string | null;
  camera_preset_id?: string | null;
  suggested_chat_text_he?: string | null;
  layer: 'FRONT' | 'BACK' | null;
  intensity: number;
  duration_ms: number;
  confidence: number;
  requires_approval: boolean;
  approval_status: 'NOT_REQUIRED' | 'PENDING_HUMAN' | 'APPROVED' | 'REJECTED';
  reason_he: string;
  executed: boolean;
  execution_status_he: string;
  measured_outcome_he: string | null;
  total_latency_ms: number;
  total_cost_usd: number;
  opinions: ModelIndependentOpinion[];
  input_snapshot?: DecisionInputSnapshot;
  approval_audit?: DecisionApprovalAudit;
  execution_audit?: DecisionExecutionAudit;
  result_learning_audit?: DecisionResultAndLearningAudit;
  pipeline_stages?: Record<BrainPipelineStageId, BrainPipelineStageEntry>;
}

export interface CostLedgerSummary {
  dayKey: string;
  monthKey: string;
  spentTodayUsd: number;
  spentThisMonthUsd: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  budgetExceeded: boolean;
  byModelUsd: Record<string, number>;
  byStreamUsd: Record<string, number>;
  totalCallsCount: number;
}

export interface IdeaLabEntry {
  ideaId: string;
  createdAtTs: number;
  category:
    | 'NEW_EFFECT'
    | 'NEW_AUTOMATION'
    | 'EVENT_DETECTION'
    | 'GIFT_ANIMATION'
    | 'MUSIC_REACTION'
    | 'CHAT_UX'
    | 'STAGE_DESIGN';
  titleHe: string;
  descriptionHe: string;
  evidenceEventIds: string[];
  sourceStreamIds: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedDevCostHe: string;
  implementationSpecHe: string[];
  status: 'PROPOSED' | 'APPROVED_FOR_DEV' | 'ARCHIVED';
}

// ============================================================================
// LAYER 2 & 6: KNOWLEDGE ENGINE & CONTROL / EMPIRICAL LEARNING
// ============================================================================

export type KnowledgeRecordLayer =
  | 'RAW_EVENT_DIGEST'
  | 'VERIFIED_FACT'
  | 'HYPOTHESIS'
  | 'AI_CONCLUSION';

export interface KnowledgeMemoryEntry {
  entryId: string;
  createdAtTs: number;
  streamId: string;
  layer: KnowledgeRecordLayer;
  summaryHe: string;
  evidenceEventIds: string[];
  confidence: number;
  disagreementsNotedHe?: string | null;
  tags: string[];
}

export interface CrossStreamEmpiricalObservation {
  patternKey: string;
  statementHe: string;
  distinctStreamsObserved: string[];
  totalTrialsCount: number;
  positiveShiftTrialsCount: number;
  avgMetricDeltaPct: number;
  causalCautionNoteHe: string;
  evidenceEventIds: string[];
  lastUpdatedTs: number;
}

export interface SemanticSearchHit {
  entryId: string;
  streamId: string;
  layer: KnowledgeRecordLayer;
  summaryHe: string;
  similarityScore: number;
  createdAtTs: number;
  evidenceEventIds: string[];
}

export interface KnowledgeEngineSnapshot {
  totalEntries: number;
  verifiedFactsCount: number;
  hypothesesCount: number;
  aiConclusionsCount: number;
  retentionDays: number;
  recentEntries: KnowledgeMemoryEntry[];
  crossStreamObservations: CrossStreamEmpiricalObservation[];
}

export interface SystemTestScenarioResult {
  scenarioId: string;
  order: number;
  titleHe: string;
  passed: boolean;
  durationMs: number;
  verifiedBehaviorHe: string;
  evidenceSample: string;
}

export interface SystemTestSuiteReport {
  executedAtTs: number;
  totalScenarios: number;
  passedCount: number;
  failedCount: number;
  results: SystemTestScenarioResult[];
}

export interface SixLayerHealthSummary {
  layerId: SixLayerStageId;
  order: number;
  titleHe: string;
  statusHe: string;
  healthy: boolean;
  keyMetricHe: string;
}

export type ManagedTikTokVerifiedStatus = 'CONNECTED' | 'ACTIVE_IN_LIVE' | 'DISCONNECTED';

export type ManagedTikTokVerifiedChannel =
  | 'CLOUD_PHONE_GEELARK'
  | 'TIKTOK_OAUTH_SECURE'
  | 'WS_EXTERNAL_BRIDGE'
  | 'SERVER_MANAGED_SESSION'
  | 'NONE';

export interface UnifiedCloudPhoneSummary {
  id: string;
  serialName: string;
  status: 'RUNNING' | 'STOPPED' | 'STARTING' | 'UNKNOWN';
  osVersion: string;
  deviceModel: string;
  countryCode: string;
  tiktokPackages: string[];
  lastCheckedTs: number;
}

export interface UnifiedManagedTikTokAccount {
  accountId: string;
  slotNumber: number;
  geelarkSlotId: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  enabled: boolean;
  verifiedStatus: ManagedTikTokVerifiedStatus;
  verifiedChannel: ManagedTikTokVerifiedChannel;
  verificationDetailHe: string;
  lastVerifiedAtTs: number | null;
  geelarkDeviceId: string | null;
  geelarkDeviceName: string | null;
  geelarkDeviceStatus: 'RUNNING' | 'STOPPED' | 'STARTING' | 'UNKNOWN' | 'UNLINKED';
  appPackageId: string;
  selectedForChatCrew: boolean;
  assignedCrewRole: AiCrewArchetypeId | null;
  assignedCrewAgentId: string | null;
  assignedLiveStream: string | null;
  assignedLiveActive: boolean;
  messagesSentCount: number;
  lastConnectionErrorHe: string | null;
}

export interface PhoneAndAccountsBridgeState {
  checkedAtTs: number;
  nonBlockingOptionalMode: boolean;
  phoneSystem: {
    configuredInEnv: boolean;
    connected: boolean;
    verifiedAtTs: number | null;
    authMode: 'BEARER_TOKEN' | 'APP_SIGNATURE' | 'UNCONFIGURED';
    statusSummaryHe: string;
    missingPrerequisitesHe: string[];
    devices: UnifiedCloudPhoneSummary[];
  };
  oauthSystem: {
    configured: boolean;
    redirectUri: string;
    sharedRedirectUri: string;
    statusSummaryHe: string;
    missingPrerequisitesHe: string[];
  };
  wsBridgeSystem: {
    connected: boolean;
    activeBridgesCount: number;
    statusSummaryHe: string;
  };
  accounts: UnifiedManagedTikTokAccount[];
  selectedCrewCount: number;
  connectedAccountsCount: number;
  activeInLiveCount: number;
  activeTargetLive: string | null;
  activeTargetLiveOnline: boolean;
}

export interface BoosteraIntelligenceDashboardState {
  updatedAtTs: number;
  sixLayersStatus: SixLayerHealthSummary[];
  dataFactory: DataFactorySnapshot;
  crossLive: CrossLiveAnalyticsSnapshot;
  multimodal: MultimodalObserverState;
  crewControl: AiCrewControlCenterState;
  accountsBridge?: PhoneAndAccountsBridgeState;
  orchestratorConfig: AiOrchestratorConfig;
  openRouterStatus: OpenRouterConnectionSummary;
  modelHealth: ModelHealthCheckResult[];
  costLedger: CostLedgerSummary;
  recentDecisions: StructuredBrainDecision[];
  activeBrainPipeline?: LiveBrainPipelineProgress | null;
  autoBrainLoopEnabled?: boolean;
  ideasLab: IdeaLabEntry[];
  knowledge: KnowledgeEngineSnapshot;
  lastTestReport: SystemTestSuiteReport | null;
}

