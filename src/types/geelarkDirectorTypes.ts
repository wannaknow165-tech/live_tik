/**
 * BOOSTERA AI LIVE DIRECTOR — GeeLark Cloud Phone + Dual TikTok Accounts + Self-Learning Skills Types
 */

export type ControlActionStatus = 'SUCCESS' | 'FAILED' | 'NEEDS_APPROVAL' | 'UNSUPPORTED';

export type CapabilityVerificationState =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'UNSUPPORTED'
  | 'AWAITING_SERVER_TOKEN';

export type AgentWorkMode = 'FAST_MODE' | 'LEARNING_MODE' | 'LIVE_DIRECTOR' | 'RECOVERY_MODE';

export type DecisionTierId =
  | 'VERIFIED_SKILL'
  | 'OFFICIAL_API'
  | 'MCP_TOOL'
  | 'GEELARK_UI'
  | 'AI_PLANNER';

export type LiveChatAgentMode = 'MONITOR' | 'ASSIST' | 'AUTO';

export type TikTokAccountSlotId =
  | 'TIKTOK_ACCOUNT_1'
  | 'TIKTOK_ACCOUNT_2'
  | 'TIKTOK_ACCOUNT_3'
  | 'TIKTOK_ACCOUNT_4'
  | 'TIKTOK_ACCOUNT_5'
  | 'TIKTOK_ACCOUNT_6';

export type AccountStorageIsolationMode =
  | 'SEPARATE_APPS'
  | 'ANDROID_PROFILES'
  | 'SAME_APP_SWITCHER'
  | 'DUAL_CLOUD_PHONES'
  | 'UNVERIFIED';

export type LiveParticipantRole = 'HOST' | 'CO_HOST' | 'GUEST' | 'MODERATOR' | 'VIEWER';

export interface GeeLarkInstalledAppInfo {
  packageName: string;
  appName: string;
  versionName: string;
  androidProfileId: string;
}

export interface GeeLarkCloudPhone {
  id: string;
  serialName: string;
  status: 'RUNNING' | 'STOPPED' | 'STARTING' | 'UNKNOWN';
  osVersion: string;
  deviceModel: string;
  countryCode: string;
  adbEnabled: boolean;
  adbEndpoint: string | null;
  installedApps: GeeLarkInstalledAppInfo[];
  androidProfiles: string[];
  supportsDualSimultaneousApps: boolean;
  lastCheckedTs: number;
}

export interface DetectedPhoneScreenState {
  ts: number;
  phoneId: string;
  detectedScreenId:
    | 'HOME_LAUNCHER'
    | 'TIKTOK_FEED'
    | 'TIKTOK_PROFILE_SWITCHER'
    | 'TIKTOK_SEARCH'
    | 'TIKTOK_LIVE_ROOM'
    | 'TIKTOK_COHOST_DIALOG'
    | 'TIKTOK_POPUP_MODAL'
    | 'UNKNOWN';
  detectedActiveHandle: string | null;
  detectedButtons: string[];
  popupDetected: string | null;
  errorBannerDetected: string | null;
}

export interface GeeLarkConnectionState {
  configuredInEnv: boolean;
  authMode: 'BEARER_TOKEN' | 'APP_SIGNATURE' | 'UNCONFIGURED';
  tokenStatusHe: string;
  baseUrl: string;
  connected: boolean;
  verifiedAtTs: number | null;
  lastErrorHe: string | null;
  selectedPhoneId: string | null;
  secondaryPhoneId: string | null;
  discoveredTransports: {
    openApi: CapabilityVerificationState;
    cliTool: CapabilityVerificationState;
    mcpServer: CapabilityVerificationState;
    remoteAdb: CapabilityVerificationState;
  };
  supportedCapabilities: {
    listPhones: CapabilityVerificationState;
    startStopPhone: CapabilityVerificationState;
    appAndProfileDiscovery: CapabilityVerificationState;
    screenshotCapture: CapabilityVerificationState;
    tapSwipeTypeInput: CapabilityVerificationState;
    openAppLaunch: CapabilityVerificationState;
  };
  devices: GeeLarkCloudPhone[];
  lastScreenshotUrl: string | null;
  lastScreenshotTs: number | null;
  lastScreenState: DetectedPhoneScreenState | null;
}

export interface RecordedAgentAction {
  id: string;
  ts: number;
  sequenceGroupId: string;
  accountId: TikTokAccountSlotId | 'SYSTEM';
  moduleName:
    | 'GeeLarkConnector'
    | 'TikTokPhoneController'
    | 'TikTokLiveManager'
    | 'LiveParticipantManager'
    | 'LiveModeratorManager'
    | 'LiveChatAgent'
    | 'BoosteraEffectsBridge'
    | 'DeterministicRunner'
    | 'AIRecovery';
  actionName: string;
  sanitizedParams: Record<string, string | number | boolean | null>;
  status: ControlActionStatus;
  tierUsed: DecisionTierId;
  latencyMs: number;
  summaryHe: string;
  verifiedResult: boolean;
}

export interface DualTikTokAccountPermissions {
  canWatchLive: boolean;
  canSendChat: boolean;
  canRequestGuest: boolean;
  canJoinCoHost: boolean;
  canManageBattleMatch: boolean;
  canModerateChat: boolean;
  canManageModerators: boolean;
}

export interface DualTikTokAccountRecord {
  id: TikTokAccountSlotId;
  labelHe: string;
  tiktokUsername: string;
  geelarkDeviceId: string | null;
  appPackageId: string;
  androidProfileId: string | null;
  storageIsolationMode: AccountStorageIsolationMode;
  loginStatus: 'VERIFIED_LOGGED_IN' | 'SWITCH_REQUIRED' | 'LOGGED_OUT' | 'UNVERIFIED';
  identityVerifiedAtTs: number | null;
  liveRole: LiveParticipantRole | 'IDLE';
  permissions: DualTikTokAccountPermissions;
  activityStatus: 'ACTIVE' | 'STANDBY' | 'IN_LIVE' | 'ERROR' | 'STOPPED';
  isActiveSelected: boolean;
  currentLiveHost: string | null;
  assignedSkillIds: string[];
  actionHistory: RecordedAgentAction[];
}

export interface LiveRoomParticipantItem {
  id: string;
  username: string;
  displayName: string;
  role: LiveParticipantRole;
  verifiedSource: 'TIKTOK_LIVE_STREAM' | 'GEELARK_UI' | 'OPERATOR_ASSIGNED';
  joinedAtTs: number;
  pointsContributed: number;
}

export interface LiveInvitationItem {
  id: string;
  ts: number;
  fromUsername: string;
  targetAccountId: TikTokAccountSlotId;
  kind: 'GUEST_INVITE' | 'CO_HOST_INVITE' | 'LIVE_MATCH_BATTLE_INVITE' | 'VIEWER_JOIN_REQUEST';
  status: 'PENDING_OPERATOR_APPROVAL' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  noteHe: string;
}

export interface LiveRoomModeratorItem {
  username: string;
  displayName: string;
  assignedByAccountId: TikTokAccountSlotId | 'HOST';
  status: 'ACTIVE_MODERATOR' | 'PROPOSED_BY_AI' | 'REMOVAL_PENDING_APPROVAL';
  permissionsSummaryHe: string;
  updatedAtTs: number;
}

export interface PendingOperatorApprovalItem {
  id: string;
  ts: number;
  accountId: TikTokAccountSlotId;
  category:
    | 'GUEST_PARTICIPATION'
    | 'COHOST_JOIN'
    | 'BATTLE_MATCH'
    | 'MODERATOR_PERMISSION_CHANGE'
    | 'CHAT_MODERATION_ACTION'
    | 'SKILL_RECOVERY_CODE_PROMOTION';
  titleHe: string;
  detailHe: string;
  payload: Record<string, string | number | boolean | null>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface ManagementAuditEntry {
  id: string;
  ts: number;
  actorHe: string;
  accountId: TikTokAccountSlotId | 'OPERATOR';
  actionType: string;
  status: ControlActionStatus;
  detailHe: string;
}

export interface AnalyzedLiveChatItem {
  id: string;
  ts: number;
  roomHost: string;
  username: string;
  text: string;
  classification: 'QUESTION' | 'SUPPORTER' | 'IMPORTANT' | 'SPAM' | 'HARASSMENT' | 'GENERAL';
  suggestedReplyHe: string | null;
  proposedModerationAction: 'NONE' | 'MUTE_USER' | 'BLOCK_USER' | 'PIN_COMMENT';
  forwardedEffectId: string | null;
  replySentStatus: 'NOT_SENT' | 'QUEUED_ASSIST' | 'SENT_APPROVED' | 'BLOCKED_ANTI_FLOOD';
}

export interface LiveChatAgentState {
  mode: LiveChatAgentMode;
  authorizedDataSource: 'TIKTOK_LIVE_CONNECTOR' | 'GEELARK_UI_READER' | 'NONE';
  antiFloodMinIntervalSec: number;
  lastReplySentTs: number;
  rollingSummaryHe: string;
  messages: AnalyzedLiveChatItem[];
}

export interface ParallelMonitoredLiveItem {
  hostUsername: string;
  roomId: string | null;
  isLive: boolean;
  viewerCount: number;
  likesCount: number;
  giftsDiamonds: number;
  battleActive: boolean;
  dataSource: 'TIKTOK_LIVE_CONNECTOR' | 'SWARM_WATCHLIST';
  updatedAtTs: number;
}

export interface TikTokLiveDirectorSessionState {
  activeHostUsername: string | null;
  roomId: string | null;
  isLive: boolean;
  streamState:
    | 'IDLE'
    | 'WATCHING_VIEWER'
    | 'GUEST_REQUESTED'
    | 'ACTIVE_GUEST'
    | 'ACTIVE_COHOST'
    | 'ACTIVE_BATTLE_MATCH';
  viewerCount: number;
  likesCount: number;
  giftsCount: number;
  battleActive: boolean;
  battleStartedAtTs: number | null;
  battleEndedAtTs: number | null;
  ourScore: number;
  opponentScore: number;
  participants: LiveRoomParticipantItem[];
  invitations: LiveInvitationItem[];
  moderators: LiveRoomModeratorItem[];
  pendingApprovals: PendingOperatorApprovalItem[];
  auditLog: ManagementAuditEntry[];
  parallelLives: ParallelMonitoredLiveItem[];
}

export interface BoosteraEffectsBridgeRule {
  id: string;
  eventType:
    | 'GIFT_RECEIVED'
    | 'LIKE_SURGE'
    | 'SCORE_LEAD_CHANGE'
    | 'GLOVE_MULTIPLIER'
    | 'BATTLE_START'
    | 'BATTLE_END'
    | 'WIN_OR_SNIPE'
    | 'GUEST_JOINED'
    | 'COHOST_JOINED'
    | 'CHAT_HIGHLIGHT'
    | 'MODERATOR_ACTION'
    | 'ENERGY_SHIFT';
  labelHe: string;
  enabled: boolean;
  layerTarget: 'BACK' | 'FRONT' | 'STAGE_AVATAR' | 'CAMERA_SOUND';
  vfxId: string;
  soundCueId: string;
  musicTrackId: string;
  cooldownSec: number;
  triggeredCount: number;
  lastTriggeredTs: number;
}

export interface BoosteraEffectsBridgeState {
  autoBridgeEnabled: boolean;
  maxVisualLoadConcurrent: number;
  currentVisualLoadCount: number;
  preserveStudioLayerOrder: boolean;
  layerStackOrder: ['CAMERA', 'BACKGROUND_BACK', 'STAGE_AVATARS', 'FOREGROUND_FRONT', 'HUD_INFO'];
  rules: BoosteraEffectsBridgeRule[];
}

export interface SkillVariableSpec {
  name: string;
  descriptionHe: string;
  required: boolean;
  defaultValue: string;
}

export interface SkillWorkflowStep {
  stepOrder: number;
  operation:
    | 'VERIFY_ACCOUNT_IDENTITY'
    | 'GEELARK_OPEN_APP'
    | 'GEELARK_SWITCH_PROFILE'
    | 'GEELARK_TAP'
    | 'GEELARK_SWIPE'
    | 'GEELARK_TYPE_TEXT'
    | 'GEELARK_SCREENSHOT_VERIFY'
    | 'LIVE_CONNECTOR_SEARCH'
    | 'LIVE_CONNECTOR_JOIN_STREAM'
    | 'LIVE_CHAT_READ'
    | 'LIVE_CHAT_REPLY'
    | 'LIVE_PARTICIPANT_REQUEST'
    | 'LIVE_MODERATOR_UPDATE'
    | 'BOOSTERA_TRIGGER_EFFECT';
  descriptionHe: string;
  paramsTemplate: Record<string, string | number | boolean>;
  requiresOperatorApproval?: boolean;
}

export interface SkillRecoveryProposal {
  proposedVersion: number;
  createdAtTs: number;
  failureReasonHe: string;
  aiDiagnosisHe: string;
  proposedSteps: SkillWorkflowStep[];
  proposedTypeScriptCode: string;
  testedInSandbox: boolean;
  approvedByOperator: boolean;
}

export interface SkillDefinition {
  id: string;
  nameHe: string;
  descriptionHe: string;
  status: 'DRAFT' | 'TESTED' | 'VERIFIED_ACTIVE' | 'NEEDS_RECOVERY';
  version: number;
  createdFromSequenceId: string | null;
  variables: SkillVariableSpec[];
  preconditionsHe: string[];
  successConditionsHe: string[];
  workflowSteps: SkillWorkflowStep[];
  generatedTypeScriptCode: string;
  generatedPythonCode: string;
  runsWithoutAi: boolean;
  testStatus: 'UNTESTED' | 'PASSED' | 'FAILED';
  lastTestedAtTs: number | null;
  runCount: number;
  successCount: number;
  failureCount: number;
  lastRunAtTs: number | null;
  lastRunStatus: ControlActionStatus | null;
  recoveryProposal: SkillRecoveryProposal | null;
}

export interface AgentCommandExecutionRecord {
  id: string;
  ts: number;
  commandHe: string;
  accountId: TikTokAccountSlotId;
  workMode: AgentWorkMode;
  selectedTier: DecisionTierId;
  matchedSkillId: string | null;
  status: ControlActionStatus | 'STOPPED';
  resultSummaryHe: string;
  latencyMs: number;
}

export interface DecisionEngineState {
  workMode: AgentWorkMode;
  emergencyStopped: boolean;
  emergencyStoppedAtTs: number | null;
  priorityOrder: DecisionTierId[];
  currentStatusHe: string;
  recentCommands: AgentCommandExecutionRecord[];
}

export interface AcceptanceCheckItem {
  id: string;
  titleHe: string;
  verified: boolean;
  statusLabelHe: string;
  evidenceHe: string;
}

export type ModeratorLanguageCode = 'he' | 'en' | 'ar' | 'es' | 'ru';

export interface GlobalLearnedModeratorTactic {
  id: string;
  ts: number;
  sourceCreatorHandle: string;
  sourceLanguage: string;
  originalObservedLine: string;
  tacticalWhyHe: string;
  localizedByLanguage: Record<ModeratorLanguageCode, string>;
  effectivenessRating: number;
}

export interface GlobalModeratorPlaybookState {
  lastUpdatedTs: number;
  analyzedLanguages: string[];
  tactics: GlobalLearnedModeratorTactic[];
  michalBriefSubjectHe: string;
  michalBriefBodyHe: string;
}

export interface MultiAccountConversationTurn {
  turnOrder: number;
  speakerLabel: string;
  speakerHandle: string;
  language: ModeratorLanguageCode;
  delaySec: number;
  text: string;
  status: 'QUEUED' | 'SENT';
}

export interface MultiAccountConversationState {
  autoConverseWhenQuiet: boolean;
  activeTopicHe: string;
  lastRunTs: number | null;
  recentDialogueTurns: MultiAccountConversationTurn[];
}

export interface PobCloudDiagnosticResult {
  ts: number;
  passed: boolean;
  pobPacketEvent: string;
  opponentUsername: string;
  revealedOpponentScore: number;
  revealedOurScore: number;
  cloudRadarActive: boolean;
  checks: { stepHe: string; ok: boolean; detailHe: string }[];
}

export interface GeeLarkDirectorFullSnapshot {
  geelark: GeeLarkConnectionState;
  accounts: (DualTikTokAccountRecord & { preferredLanguage?: ModeratorLanguageCode })[];
  activeAccountId: TikTokAccountSlotId;
  simultaneousDualPhoneRequired: boolean;
  liveSession: TikTokLiveDirectorSessionState;
  chatAgent: LiveChatAgentState;
  effectsBridge: BoosteraEffectsBridgeState;
  skills: SkillDefinition[];
  recordedActions: RecordedAgentAction[];
  decisionEngine: DecisionEngineState;
  acceptanceChecks: AcceptanceCheckItem[];
  globalPlaybook: GlobalModeratorPlaybookState;
  conversationEngine: MultiAccountConversationState;
  lastPobCloudDiagnostic: PobCloudDiagnosticResult | null;
}
