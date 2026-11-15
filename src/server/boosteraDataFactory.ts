import fs from 'fs';
import path from 'path';
import {
  ActorOriginKind,
  AudioMusicTelemetry,
  CanonicalEventCategory,
  CanonicalLiveEvent,
  CarefulAffectEstimate,
  ChatSemanticSubKind,
  CrossCorrelationDomain,
  CrossCorrelationFinding,
  CrossLiveAnalyticsSnapshot,
  DataFactorySnapshot,
  EventReliabilityLevel,
  EventSourceKind,
  InteractionGraphEdge,
  InteractionGraphNode,
  InteractionTimelineChain,
  LiveStreamDossier,
  MultimodalObserverState,
  ParticipantRoleKind,
  RepeatedQuestionCluster,
  ReplaySessionRecord,
  SpeechTranscriptSegment,
  StreamParticipantProfile,
  VisualSceneTelemetry,
} from '../types/boosteraIntelligence';

const DATA_DIR = path.join(process.cwd(), '.data');
const REPLAYS_FILE = path.join(DATA_DIR, 'boostera_replays.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Ignore fs errors in restricted environments
  }
}

export function sanitizeTextAndDetectInjection(
  rawText: string | undefined,
  stripPii = true
): { sanitized: string; promptInjectionFlagged: boolean } {
  if (!rawText) return { sanitized: '', promptInjectionFlagged: false };
  let cleaned = String(rawText).trim().slice(0, 400);

  if (stripPii) {
    cleaned = cleaned
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTED]')
      .replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g, '[PHONE_REDACTED]')
      .replace(/\b(?:sessionid|bearer|sk-or-v1-[a-z0-9]+)[=:\s]*[^\s]+/gi, '[SECRET_REDACTED]');
  }

  const injectionPatterns = [
    /ignore\s+(?:all\s+)?(?:previous|prior|system)\s+instructions/i,
    /\bsystem\s*:\s*you\s+are/i,
    /\b(?:execute|run)\s+(?:command|shell|bash|rm\s+-rf)/i,
    /תתעלם\s+מכל\s+ההוראות/i,
    /הוראת\s+מערכת\s*:/i,
    /TRIGGER_VFX|ESCALATE_TO_HUMAN|OPENROUTER_API_KEY/i,
  ];
  const promptInjectionFlagged = injectionPatterns.some((rx) => rx.test(cleaned));
  if (promptInjectionFlagged) {
    cleaned = `[חסום-הזרקת-פרומפט] ${cleaned.replace(/[{}`<>]/g, '')}`;
  }
  return { sanitized: cleaned, promptInjectionFlagged };
}

function normalizeQuestionFingerprint(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

export function isQuestionText(text: string): boolean {
  if (text.includes('?') || text.includes('؟')) return true;
  return /^(?:למה|מתי|איך|איפה|כמה|מי|האם|מה\s+קרה|מה\s+הסקור|why|when|how|where|who|what\s+happened)/i.test(
    text.trim()
  );
}

interface InternalStreamBucket {
  dossier: LiveStreamDossier;
  participantsMap: Map<string, StreamParticipantProfile>;
  events: CanonicalLiveEvent[];
  humanChatTimestamps: number[];
  likeSamples: Array<{ ts: number; count: number }>;
  scoreHistory: Array<{ ts: number; host: number; opp: number }>;
  responseLatenciesMs: number[];
  lastTriggerTs: number | null;
  lastTriggerEventId: string | null;
  questionMap: Map<string, RepeatedQuestionCluster>;
}

export class BoosteraDataFactory {
  private maxConcurrentStreams = 12;
  private streams = new Map<string, InternalStreamBucket>();
  private globalEvents: CanonicalLiveEvent[] = [];
  private seenFingerprints = new Map<string, number>();
  private deduplicatedDropsCount = 0;
  private promptInjectionsBlockedCount = 0;
  private seq = 0;
  private knownHumanModeratorHandles = new Set<string>();
  private knownAiAgentHandles = new Map<string, string>(); // handle -> agentId
  private piiSanitizationEnabled = true;

  private replays: ReplaySessionRecord[] = [];
  private activeReplayTimer: ReturnType<typeof setInterval> | null = null;
  private activeReplayStatus = {
    running: false,
    replayId: null as string | null,
    progressPct: 0,
  };

  private multimodal: MultimodalObserverState = {
    visual: {
      sourceConnected: false,
      sourceType: 'NONE',
      capturedAtTs: 0,
      motionIndexPct: 0,
      lightingBrightnessPct: 0,
      dominantColorToneHe: 'לא מחובר מקור וידאו מורשה',
      visualClutterPct: 0,
      subjectOccludedByVfx: false,
      cameraAngleChangeDetected: false,
      visualPeakDetected: false,
      beforeAfterVfxComparisonHe: null,
      visibleExpressionCueHe: null,
      aiSceneSummaryHe: null,
      confidence: 0,
    },
    audio: {
      sourceConnected: false,
      sourceLabelHe: 'אין מקור אודיו מחובר — חבר מיקרופון, שיתוף לשונית עם שמע או קובץ וידאו לניתוח אמיתי',
      capturedAtTs: 0,
      rmsLoudnessDb: null,
      estimatedBpm: null,
      beatRegularityPct: null,
      energyShiftDeltaPct: null,
      silenceDetected: false,
      silenceDurationMs: 0,
      musicalBurstDetected: false,
      speechBandClarityPct: null,
      sfxImpairingSpeech: false,
      musicSpeechAlignmentHe: 'ממתין לחיבור מקור אודיו מורשה מהשידור',
    },
    recentTranscripts: [],
    affectEstimates: [],
    statusBannerHe:
      'LIVE MULTIMODAL OBSERVER מוכן — חבר מקור וידאו/אודיו מורשה לניתוח תמונה, דיבור ומוזיקה אמיתיים.',
  };

  constructor() {
    this.loadReplaysFromDisk();
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${Date.now()}_${this.seq}`;
  }

  public setPiiSanitization(enabled: boolean) {
    this.piiSanitizationEnabled = enabled;
  }

  public setMaxConcurrentStreams(limit: number) {
    this.maxConcurrentStreams = Math.max(10, Math.min(30, Math.round(limit)));
  }

  public registerHumanModerators(handles: string[]) {
    for (const h of handles) {
      const clean = String(h || '').replace(/^@+/, '').trim().toLowerCase();
      if (clean && !this.knownAiAgentHandles.has(clean)) {
        this.knownHumanModeratorHandles.add(clean);
      }
    }
  }

  /**
   * Registers AI Crew handles so Data Factory NEVER confuses an AI Crew message
   * with a genuine human viewer or human moderator message!
   */
  public registerAiCrewAgentHandles(entries: Array<{ handle: string; agentId: string }>) {
    this.knownAiAgentHandles.clear();
    for (const item of entries) {
      const clean = String(item.handle || '').replace(/^@+/, '').trim().toLowerCase();
      if (clean) {
        this.knownAiAgentHandles.set(clean, item.agentId);
      }
    }
  }

  public setActiveAiCrewCountForStream(streamIdOrCreator: string, count: number) {
    const d = this.getStreamDossier(streamIdOrCreator);
    if (d) {
      d.activeAiCrewCount = Math.max(1, Math.min(4, Math.round(count)));
    }
  }

  public ensureStreamRegistered(params: {
    streamId?: string;
    creatorUsername: string;
    roomId?: string | null;
    source: EventSourceKind;
    connected: boolean;
  }): { bucket: InternalStreamBucket; alreadyConnected: boolean } {
    const cleanCreator = String(params.creatorUsername || 'unknown')
      .replace(/^@+/, '')
      .trim()
      .toLowerCase();
    const streamKey = (params.streamId || `live_${cleanCreator}`).toLowerCase();

    const existing = this.streams.get(streamKey);
    if (existing) {
      const wasConnected = existing.dossier.connected;
      existing.dossier.connected = params.connected;
      if (params.roomId) existing.dossier.roomId = params.roomId;
      if (!params.connected && wasConnected) {
        existing.dossier.endedAtTs = Date.now();
      } else if (params.connected && existing.dossier.endedAtTs !== null) {
        existing.dossier.endedAtTs = null;
      }
      return { bucket: existing, alreadyConnected: wasConnected && params.connected };
    }

    if (this.streams.size >= this.maxConcurrentStreams) {
      let candidateKey: string | null = null;
      for (const [k, b] of this.streams.entries()) {
        if (!b.dossier.connected) {
          candidateKey = k;
          break;
        }
      }
      if (candidateKey) {
        this.streams.delete(candidateKey);
      }
    }

    const now = Date.now();
    const dossier: LiveStreamDossier = {
      streamId: streamKey,
      creatorUsername: cleanCreator,
      roomId: params.roomId || null,
      source: params.source,
      connected: params.connected,
      startedAtTs: now,
      endedAtTs: params.connected ? null : now,
      lastEventTs: now,
      activeAiCrewCount: 4,
      creatorCurrentlySpeaking: false,
      lastCreatorSpeechTs: null,
      viewerCount: null,
      viewerCountVerified: false,
      peakViewers: null,
      participants: [],
      coHosts: [],
      opponents: [],
      humanModeratorsDetected: [],
      aiModeratorsAssigned: Array.from(this.knownAiAgentHandles.keys()).slice(0, 4),
      chatMetrics: {
        humanViewerMessagesCount: 0,
        creatorMessagesCount: 0,
        humanModeratorMessagesCount: 0,
        aiAgentMessagesCount: 0,
        questionsCount: 0,
        repeatedUnansweredCount: 0,
        repliesToHostCount: 0,
        repliesToHumanModCount: 0,
        repliesToAiModCount: 0,
        repliesToOpponentCount: 0,
        humanMessagesPerMin: 0,
        burstActive: false,
        lastTopicShiftSummaryHe: null,
        postEventReactionRatio: 0,
      },
      engagementMetrics: {
        totalLikes: 0,
        likesPerSec: 0,
        totalShares: 0,
        totalGifts: 0,
        totalDiamonds: 0,
        newFollowers: 0,
        joinsCount: 0,
        leavesCount: 0,
        peakMomentCount: 0,
        medianCrowdResponseMs: null,
      },
      battleMetrics: {
        inBattle: false,
        battleStartedAtTs: null,
        battleEndedAtTs: null,
        opponentUsername: null,
        verifiedHostScore: null,
        verifiedOpponentScore: null,
        scoreLeadState: 'UNKNOWN',
        scoreMomentumPer10s: 0,
        verifiedGloveActive: false,
        verifiedBonusTaskActive: false,
        crowdReactionToScoreShiftHe: null,
      },
      audioSourceConnected: false,
      videoSourceConnected: false,
      latestAudioSummaryHe: null,
      latestVisualSummaryHe: null,
    };

    const hostProfile: StreamParticipantProfile = {
      handle: cleanCreator,
      displayName: `@${cleanCreator}`,
      actorOrigin: 'CREATOR_HOST',
      role: 'HOST_CREATOR',
      roleConfidence: 1.0,
      firstSeenTs: now,
      lastSeenTs: now,
      humanMessagesCount: 0,
      aiMessagesCount: 0,
      questionsAsked: 0,
      speechTurnsCount: 0,
      likesCount: 0,
      giftsDiamondsTotal: 0,
    };

    const pMap = new Map<string, StreamParticipantProfile>();
    pMap.set(cleanCreator, hostProfile);
    dossier.participants = [hostProfile];

    const bucket: InternalStreamBucket = {
      dossier,
      participantsMap: pMap,
      events: [],
      humanChatTimestamps: [],
      likeSamples: [],
      scoreHistory: [],
      responseLatenciesMs: [],
      lastTriggerTs: null,
      lastTriggerEventId: null,
      questionMap: new Map(),
    };
    this.streams.set(streamKey, bucket);
    return { bucket, alreadyConnected: false };
  }

  public ingestEvent(input: {
    streamId?: string;
    creatorUsername: string;
    roomId?: string | null;
    timestamp?: number;
    source: EventSourceKind;
    reliability: EventReliabilityLevel;
    actorOrigin?: ActorOriginKind;
    category: CanonicalEventCategory;
    subType: string;
    actorHandle: string;
    actorDisplayName?: string;
    explicitRole?: ParticipantRoleKind;
    isVerifiedHumanModerator?: boolean;
    aiAgentId?: string | null;
    targetHandle?: string | null;
    numericValue?: number;
    textContent?: string;
    languageTag?: string;
    dedupeKey?: string;
    metadata?: Record<string, string | number | boolean | null>;
  }): CanonicalLiveEvent | null {
    const now = input.timestamp ?? Date.now();
    const cleanCreator = String(input.creatorUsername || 'unknown')
      .replace(/^@+/, '')
      .trim()
      .toLowerCase();
    const streamKey = (input.streamId || `live_${cleanCreator}`).toLowerCase();
    const actorClean = String(input.actorHandle || 'viewer')
      .replace(/^@+/, '')
      .trim()
      .toLowerCase();

    const fp =
      input.dedupeKey ||
      `${streamKey}|${input.category}|${input.subType}|${actorClean}|${input.textContent || ''}|${
        input.numericValue ?? ''
      }|${Math.floor(now / 750)}`;
    const prevSeen = this.seenFingerprints.get(fp);
    if (prevSeen && now - prevSeen < 2200) {
      this.deduplicatedDropsCount += 1;
      return null;
    }
    this.seenFingerprints.set(fp, now);
    if (this.seenFingerprints.size > 4000) {
      const cutoff = now - 15000;
      for (const [k, ts] of this.seenFingerprints.entries()) {
        if (ts < cutoff) this.seenFingerprints.delete(k);
      }
    }

    const { bucket } = this.ensureStreamRegistered({
      streamId: streamKey,
      creatorUsername: cleanCreator,
      roomId: input.roomId,
      source: input.source,
      connected: true,
    });
    const dossier = bucket.dossier;
    dossier.lastEventTs = now;

    // Refresh creatorCurrentlySpeaking window (active for 7s after last speech utterance)
    if (dossier.lastCreatorSpeechTs && now - dossier.lastCreatorSpeechTs > 7000) {
      dossier.creatorCurrentlySpeaking = false;
    }

    // Strict separation between AI Agents, Creator, Co-Creators/Rivals, Human Moderators, and Human Viewers
    const detectedAiAgentId = input.aiAgentId || this.knownAiAgentHandles.get(actorClean) || null;
    let role: ParticipantRoleKind = input.explicitRole || 'VIEWER';
    let actorOrigin: ActorOriginKind = input.actorOrigin || 'HUMAN_VIEWER';
    let roleConfidence = input.explicitRole ? 1.0 : 0.88;

    if (detectedAiAgentId || input.source === 'AI_CHAT_CREW' || input.explicitRole === 'AI_CHAT_MODERATOR') {
      role = 'AI_CHAT_MODERATOR';
      actorOrigin = 'AI_AGENT';
      roleConfidence = 1.0;
    } else if (input.category === 'SYSTEM_EXECUTION') {
      actorOrigin = 'SYSTEM_STAGE';
    } else if (actorClean === cleanCreator || role === 'HOST_CREATOR') {
      role = 'HOST_CREATOR';
      actorOrigin = 'CREATOR_HOST';
      roleConfidence = 1.0;
    } else if (dossier.opponents.includes(actorClean) || role === 'BATTLE_OPPONENT') {
      role = 'BATTLE_OPPONENT';
      actorOrigin = 'CO_CREATOR_OR_RIVAL';
      roleConfidence = 1.0;
    } else if (dossier.coHosts.includes(actorClean) || role === 'CO_HOST') {
      role = 'CO_HOST';
      actorOrigin = 'CO_CREATOR_OR_RIVAL';
      roleConfidence = 0.95;
    } else if (
      input.isVerifiedHumanModerator ||
      role === 'HUMAN_CHAT_MODERATOR' ||
      this.knownHumanModeratorHandles.has(actorClean)
    ) {
      role = 'HUMAN_CHAT_MODERATOR';
      actorOrigin = 'HUMAN_MODERATOR';
      roleConfidence = input.isVerifiedHumanModerator ? 1.0 : 0.9;
    }

    let participant = bucket.participantsMap.get(actorClean);
    if (!participant) {
      participant = {
        handle: actorClean,
        displayName: input.actorDisplayName || actorClean,
        actorOrigin,
        role,
        roleConfidence,
        firstSeenTs: now,
        lastSeenTs: now,
        humanMessagesCount: 0,
        aiMessagesCount: 0,
        questionsAsked: 0,
        speechTurnsCount: 0,
        likesCount: 0,
        giftsDiamondsTotal: 0,
      };
      bucket.participantsMap.set(actorClean, participant);
    } else {
      participant.lastSeenTs = now;
      if (role !== 'VIEWER' && participant.role === 'VIEWER') {
        participant.role = role;
        participant.actorOrigin = actorOrigin;
        participant.roleConfidence = roleConfidence;
      }
    }

    if (role === 'HUMAN_CHAT_MODERATOR' && !dossier.humanModeratorsDetected.includes(actorClean)) {
      dossier.humanModeratorsDetected.push(actorClean);
    }
    if (role === 'AI_CHAT_MODERATOR' && !dossier.aiModeratorsAssigned.includes(actorClean)) {
      dossier.aiModeratorsAssigned.push(actorClean);
    }
    if (role === 'CO_HOST' && !dossier.coHosts.includes(actorClean)) {
      dossier.coHosts.push(actorClean);
    }
    if (role === 'BATTLE_OPPONENT' && !dossier.opponents.includes(actorClean)) {
      dossier.opponents.push(actorClean);
    }

    const { sanitized, promptInjectionFlagged } = sanitizeTextAndDetectInjection(
      input.textContent,
      this.piiSanitizationEnabled
    );
    if (promptInjectionFlagged) {
      this.promptInjectionsBlockedCount += 1;
    }

    const relatedEventIds: string[] = [];
    if (bucket.lastTriggerTs && bucket.lastTriggerEventId && now - bucket.lastTriggerTs <= 12000) {
      relatedEventIds.push(bucket.lastTriggerEventId);
    }

    let chatSubKind: ChatSemanticSubKind | undefined;
    let targetHandle = input.targetHandle ? input.targetHandle.replace(/^@+/, '').toLowerCase() : null;
    let targetRole: ParticipantRoleKind | null = null;

    if ((input.category === 'CHAT_MESSAGE' || input.category === 'AI_MODERATOR_ACTION') && sanitized) {
      const mentionMatch = sanitized.match(/@([a-zA-Z0-9_.-]{2,30})/);
      if (mentionMatch && !targetHandle) {
        targetHandle = mentionMatch[1].toLowerCase();
      }
      if (targetHandle) {
        const targetProf = bucket.participantsMap.get(targetHandle);
        targetRole =
          targetProf?.role ||
          (this.knownAiAgentHandles.has(targetHandle)
            ? 'AI_CHAT_MODERATOR'
            : targetHandle === cleanCreator
              ? 'HOST_CREATOR'
              : dossier.opponents.includes(targetHandle)
                ? 'BATTLE_OPPONENT'
                : dossier.humanModeratorsDetected.includes(targetHandle)
                  ? 'HUMAN_CHAT_MODERATOR'
                  : 'VIEWER');
      }

      if (actorOrigin === 'AI_AGENT') {
        // CRITICAL RULE: AI Agent messages NEVER count as human viewer messages or crowd velocity!
        participant.aiMessagesCount += 1;
        dossier.chatMetrics.aiAgentMessagesCount += 1;
        chatSubKind = 'AI_MOD_TRANSPARENT_MESSAGE';
        for (const q of bucket.questionMap.values()) {
          if (!q.answeredByHostOrMod && now - q.lastAskedTs <= 60000) {
            q.answeredByHostOrMod = true;
          }
        }
      } else if (actorOrigin === 'CREATOR_HOST') {
        participant.humanMessagesCount += 1;
        dossier.chatMetrics.creatorMessagesCount += 1;
        chatSubKind = 'PUBLIC_STATEMENT';
      } else if (actorOrigin === 'HUMAN_MODERATOR') {
        participant.humanMessagesCount += 1;
        dossier.chatMetrics.humanModeratorMessagesCount += 1;
        chatSubKind = 'HUMAN_MOD_ANNOUNCEMENT';
        for (const q of bucket.questionMap.values()) {
          if (!q.answeredByHostOrMod && now - q.lastAskedTs <= 45000) {
            q.answeredByHostOrMod = true;
          }
        }
      } else {
        // Genuine HUMAN_VIEWER message!
        participant.humanMessagesCount += 1;
        dossier.chatMetrics.humanViewerMessagesCount += 1;
        bucket.humanChatTimestamps.push(now);
        const oneMinAgo = now - 60000;
        bucket.humanChatTimestamps = bucket.humanChatTimestamps.filter((t) => t >= oneMinAgo);
        dossier.chatMetrics.humanMessagesPerMin = bucket.humanChatTimestamps.length;

        const tenSecHumanCount = bucket.humanChatTimestamps.filter((t) => now - t <= 10000).length;
        dossier.chatMetrics.burstActive = tenSecHumanCount >= 8;

        // Check if a recent AI moderator posted within 15s and this human viewer is replying
        const recentAiMsg = bucket.events.find(
          (e) => e.actorOrigin === 'AI_AGENT' && now - e.timestamp >= 0 && now - e.timestamp <= 15000
        );

        if (isQuestionText(sanitized)) {
          participant.questionsAsked += 1;
          dossier.chatMetrics.questionsCount += 1;
          const qKey = normalizeQuestionFingerprint(sanitized);
          if (qKey.length >= 4) {
            const existingQ = bucket.questionMap.get(qKey);
            if (existingQ) {
              existingQ.occurrencesCount += 1;
              existingQ.lastAskedTs = now;
              existingQ.answeredByHostOrMod = false;
              if (!existingQ.distinctAskHandles.includes(actorClean)) {
                existingQ.distinctAskHandles.push(actorClean);
              }
              chatSubKind = 'REPEATED_QUESTION';
            } else {
              bucket.questionMap.set(qKey, {
                clusterId: this.nextId('qclust'),
                streamId: streamKey,
                normalizedQuestionHe: sanitized.slice(0, 90),
                sampleRawQuestion: sanitized.slice(0, 90),
                occurrencesCount: 1,
                distinctAskHandles: [actorClean],
                firstAskedTs: now,
                lastAskedTs: now,
                answeredByHostOrMod: false,
                evidenceEventIds: [],
              });
              chatSubKind = 'VIEWER_QUESTION';
            }
          } else {
            chatSubKind = 'VIEWER_QUESTION';
          }
        } else if (targetRole === 'AI_CHAT_MODERATOR' || recentAiMsg) {
          chatSubKind = 'REPLY_TO_AI_MOD';
          dossier.chatMetrics.repliesToAiModCount += 1;
          if (recentAiMsg && !relatedEventIds.includes(recentAiMsg.eventId)) {
            relatedEventIds.push(recentAiMsg.eventId);
          }
        } else if (targetRole === 'HUMAN_CHAT_MODERATOR') {
          chatSubKind = 'REPLY_TO_HUMAN_MOD';
          dossier.chatMetrics.repliesToHumanModCount += 1;
        } else if (
          targetRole === 'BATTLE_OPPONENT' ||
          (dossier.battleMetrics.opponentUsername &&
            sanitized.toLowerCase().includes(dossier.battleMetrics.opponentUsername.toLowerCase()))
        ) {
          chatSubKind = 'REPLY_TO_OPPONENT';
          dossier.chatMetrics.repliesToOpponentCount += 1;
        } else if (
          targetRole === 'HOST_CREATOR' ||
          (bucket.lastTriggerTs && now - bucket.lastTriggerTs <= 9000)
        ) {
          chatSubKind = relatedEventIds.length > 0 ? 'POST_EVENT_REACTION' : 'REPLY_TO_HOST';
          dossier.chatMetrics.repliesToHostCount += 1;
        } else if (mentionMatch) {
          chatSubKind = 'PARTICIPANT_MENTION';
        } else {
          chatSubKind = 'PUBLIC_STATEMENT';
        }
      }
    }

    if (input.category === 'SPEECH_TRANSCRIPT') {
      participant.speechTurnsCount += 1;
      if (role === 'HOST_CREATOR' || role === 'CO_HOST') {
        dossier.creatorCurrentlySpeaking = true;
        dossier.lastCreatorSpeechTs = now;
        for (const q of bucket.questionMap.values()) {
          if (!q.answeredByHostOrMod && now - q.lastAskedTs <= 35000) {
            q.answeredByHostOrMod = true;
          }
        }
      }
    }

    if (input.category === 'ENGAGEMENT_SIGNAL' && actorOrigin !== 'AI_AGENT') {
      const val = Math.max(1, Number(input.numericValue ?? 1));
      if (input.subType === 'LIKE') {
        participant.likesCount += val;
        dossier.engagementMetrics.totalLikes += val;
        bucket.likeSamples.push({ ts: now, count: val });
        const cutoff = now - 10000;
        bucket.likeSamples = bucket.likeSamples.filter((s) => s.ts >= cutoff);
        const sum10s = bucket.likeSamples.reduce((acc, s) => acc + s.count, 0);
        dossier.engagementMetrics.likesPerSec = Number((sum10s / 10).toFixed(1));
        if (dossier.engagementMetrics.likesPerSec >= 18) {
          dossier.engagementMetrics.peakMomentCount += 1;
        }
      } else if (input.subType === 'SHARE') {
        dossier.engagementMetrics.totalShares += val;
      } else if (input.subType === 'FOLLOW') {
        dossier.engagementMetrics.newFollowers += val;
      } else if (input.subType === 'GIFT') {
        participant.giftsDiamondsTotal += val;
        if (participant.giftsDiamondsTotal >= 100 && participant.role === 'VIEWER') {
          participant.role = 'VIP_SUPPORTER';
        }
        dossier.engagementMetrics.totalGifts += 1;
        dossier.engagementMetrics.totalDiamonds += val;
        if (val >= 150) {
          dossier.engagementMetrics.peakMomentCount += 1;
        }
      }

      if (bucket.lastTriggerTs && now - bucket.lastTriggerTs <= 10000 && now >= bucket.lastTriggerTs) {
        bucket.responseLatenciesMs.push(now - bucket.lastTriggerTs);
        if (bucket.responseLatenciesMs.length > 40) bucket.responseLatenciesMs.shift();
        const sorted = [...bucket.responseLatenciesMs].sort((a, b) => a - b);
        dossier.engagementMetrics.medianCrowdResponseMs = sorted[Math.floor(sorted.length / 2)] ?? null;
      }
    }

    if (input.category === 'PARTICIPANT_PRESENCE') {
      if (input.subType === 'JOIN') {
        dossier.engagementMetrics.joinsCount += 1;
      } else if (input.subType === 'LEAVE') {
        dossier.engagementMetrics.leavesCount += 1;
      } else if (input.subType === 'VIEWER_COUNT' && typeof input.numericValue === 'number') {
        dossier.viewerCount = input.numericValue;
        dossier.viewerCountVerified = input.reliability === 'VERIFIED_TIKTOK';
        dossier.peakViewers = Math.max(dossier.peakViewers ?? 0, input.numericValue);
      }
    }

    if (input.category === 'BATTLE_STATE') {
      if (input.subType === 'BATTLE_START') {
        dossier.battleMetrics.inBattle = true;
        dossier.battleMetrics.battleStartedAtTs = now;
        dossier.battleMetrics.battleEndedAtTs = null;
        if (targetHandle) {
          dossier.battleMetrics.opponentUsername = targetHandle;
          if (!dossier.opponents.includes(targetHandle)) dossier.opponents.push(targetHandle);
        }
      } else if (input.subType === 'BATTLE_END') {
        dossier.battleMetrics.inBattle = false;
        dossier.battleMetrics.battleEndedAtTs = now;
        dossier.battleMetrics.verifiedGloveActive = false;
      } else if (input.subType === 'SCORE_UPDATE') {
        const hostScore = Number(input.metadata?.hostScore ?? input.numericValue ?? 0);
        const oppScore = Number(input.metadata?.opponentScore ?? 0);
        if (
          input.reliability === 'VERIFIED_TIKTOK' ||
          input.reliability === 'REPLAY_VERIFIED' ||
          input.reliability === 'TEST_SYNTHETIC'
        ) {
          dossier.battleMetrics.inBattle = true;
          dossier.battleMetrics.verifiedHostScore = hostScore;
          dossier.battleMetrics.verifiedOpponentScore = oppScore;
          dossier.battleMetrics.scoreLeadState =
            hostScore > oppScore ? 'LEADING' : hostScore < oppScore ? 'TRAILING' : 'TIED';
          bucket.scoreHistory.push({ ts: now, host: hostScore, opp: oppScore });
          const tenSecAgo = now - 10000;
          bucket.scoreHistory = bucket.scoreHistory.filter((h) => h.ts >= tenSecAgo);
          if (bucket.scoreHistory.length >= 2) {
            const first = bucket.scoreHistory[0];
            const last = bucket.scoreHistory[bucket.scoreHistory.length - 1];
            dossier.battleMetrics.scoreMomentumPer10s = last.host - last.opp - (first.host - first.opp);
          }
        }
      } else if (input.subType === 'GLOVE_X5') {
        dossier.battleMetrics.verifiedGloveActive = true;
      } else if (input.subType === 'SPEED_TASK') {
        dossier.battleMetrics.verifiedBonusTaskActive = true;
      }
    }

    const eventId = this.nextId('evt');
    const canonical: CanonicalLiveEvent = {
      eventId,
      streamId: streamKey,
      creatorUsername: cleanCreator,
      timestamp: now,
      source: input.source,
      reliability: input.reliability,
      actorOrigin,
      category: input.category,
      subType: input.subType,
      actorHandle: actorClean,
      actorDisplayName: input.actorDisplayName || participant.displayName,
      actorRole: participant.role,
      aiAgentId: detectedAiAgentId,
      targetHandle,
      targetRole,
      numericValue: input.numericValue,
      textContent: input.textContent ? input.textContent.slice(0, 300) : undefined,
      sanitizedTextContent: sanitized || undefined,
      promptInjectionFlagged,
      chatSubKind,
      languageTag: input.languageTag,
      relatedEventIds,
      metadata: input.metadata,
    };

    if (chatSubKind === 'REPEATED_QUESTION' || chatSubKind === 'VIEWER_QUESTION') {
      const qKey = normalizeQuestionFingerprint(sanitized);
      const qCluster = bucket.questionMap.get(qKey);
      if (qCluster) {
        qCluster.evidenceEventIds.push(eventId);
        if (qCluster.evidenceEventIds.length > 10) qCluster.evidenceEventIds.shift();
      }
    }

    if (
      input.category === 'SPEECH_TRANSCRIPT' ||
      input.category === 'BATTLE_STATE' ||
      input.category === 'SYSTEM_EXECUTION' ||
      input.category === 'AI_MODERATOR_ACTION' ||
      chatSubKind === 'HUMAN_MOD_ANNOUNCEMENT' ||
      chatSubKind === 'AI_MOD_TRANSPARENT_MESSAGE'
    ) {
      bucket.lastTriggerTs = now;
      bucket.lastTriggerEventId = eventId;
    }

    dossier.chatMetrics.repeatedUnansweredCount = Array.from(bucket.questionMap.values()).filter(
      (q) => q.occurrencesCount >= 2 && !q.answeredByHostOrMod
    ).length;

    const humanChatEvents = bucket.events.filter(
      (e) => e.category === 'CHAT_MESSAGE' && e.actorOrigin === 'HUMAN_VIEWER'
    );
    const postEventCount = humanChatEvents.filter((e) => e.chatSubKind === 'POST_EVENT_REACTION').length;
    dossier.chatMetrics.postEventReactionRatio =
      humanChatEvents.length > 0 ? Number((postEventCount / humanChatEvents.length).toFixed(2)) : 0;

    dossier.participants = Array.from(bucket.participantsMap.values())
      .sort((a, b) => b.lastSeenTs - a.lastSeenTs)
      .slice(0, 40);

    bucket.events.unshift(canonical);
    if (bucket.events.length > 400) bucket.events.length = 400;

    this.globalEvents.unshift(canonical);
    if (this.globalEvents.length > 1500) this.globalEvents.length = 1500;

    return canonical;
  }

  /**
   * Counts ONLY genuine human viewer messages in a time window `[fromTs, toTs]`,
   * strictly excluding AI Agent messages so self-measurement is 100% honest!
   */
  public countGenuineHumanResponsesInWindow(
    streamIdOrCreator: string,
    fromTs: number,
    toTs: number
  ): { humanRepliesCount: number; creatorReplied: boolean; evidenceEventIds: string[] } {
    const events = this.getRecentStreamEvents(streamIdOrCreator, 200);
    const matched = events.filter(
      (e) =>
        e.timestamp > fromTs &&
        e.timestamp <= toTs &&
        e.category === 'CHAT_MESSAGE' &&
        (e.actorOrigin === 'HUMAN_VIEWER' || e.actorOrigin === 'CREATOR_HOST')
    );
    return {
      humanRepliesCount: matched.filter((m) => m.actorOrigin === 'HUMAN_VIEWER').length,
      creatorReplied: matched.some((m) => m.actorOrigin === 'CREATOR_HOST'),
      evidenceEventIds: matched.slice(0, 6).map((m) => m.eventId),
    };
  }

  // ==========================================================================
  // ALL 12 LIVE RELATIONSHIP CROSS-CORRELATIONS & INTERACTION GRAPH
  // ==========================================================================

  public computeCrossLiveAnalytics(filterStreamId?: string): CrossLiveAnalyticsSnapshot {
    const now = Date.now();
    const nodes: InteractionGraphNode[] = [];
    const edges: InteractionGraphEdge[] = [];
    const causalChains: InteractionTimelineChain[] = [];
    const findings: CrossCorrelationFinding[] = [];

    const targetBuckets = filterStreamId
      ? ([this.streams.get(filterStreamId.toLowerCase())].filter(Boolean) as InternalStreamBucket[])
      : Array.from(this.streams.values());

    for (const bucket of targetBuckets) {
      const sId = bucket.dossier.streamId;
      const creator = bucket.dossier.creatorUsername;
      const creatorNodeId = `${sId}:creator:${creator}`;
      const viewersNodeId = `${sId}:viewers:crowd`;
      const aiCrewNodeId = `${sId}:aicrew:team`;
      const humanModNodeId = `${sId}:humanmods:team`;
      const vfxAudioNodeId = `${sId}:stage:vfx_audio`;
      const battleNodeId = `${sId}:battle:events`;

      nodes.push({
        nodeId: creatorNodeId,
        streamId: sId,
        label: `יוצר @${creator}`,
        nodeType: 'CREATOR',
        activityScore: Math.min(100, 35 + bucket.events.filter((e) => e.actorOrigin === 'CREATOR_HOST').length * 8),
        lastActiveTs: bucket.dossier.lastEventTs,
      });

      nodes.push({
        nodeId: viewersNodeId,
        streamId: sId,
        label: `צופים אנושיים (@${creator})`,
        nodeType: 'VIEWER_COHORT',
        activityScore: Math.min(
          100,
          bucket.dossier.chatMetrics.humanMessagesPerMin * 3 + bucket.dossier.engagementMetrics.likesPerSec * 2
        ),
        lastActiveTs: bucket.dossier.lastEventTs,
      });

      nodes.push({
        nodeId: aiCrewNodeId,
        streamId: sId,
        label: `צוות מנחי AI (${bucket.dossier.activeAiCrewCount})`,
        nodeType: 'AI_CREW_AGENT',
        activityScore: Math.min(100, 20 + bucket.dossier.chatMetrics.aiAgentMessagesCount * 10),
        lastActiveTs: bucket.dossier.lastEventTs,
      });

      const chronological = [...bucket.events].slice(0, 220).reverse();

      // 1. AI_MOD_VS_VIEWERS (מנחה AI מול הצופים — סופר אך ורק תגובות אנושיות!)
      const aiMsgs = chronological.filter((e) => e.actorOrigin === 'AI_AGENT');
      if (aiMsgs.length > 0) {
        const lastAi = aiMsgs[aiMsgs.length - 1];
        const humanAfter = chronological.filter(
          (e) =>
            e.category === 'CHAT_MESSAGE' &&
            e.actorOrigin === 'HUMAN_VIEWER' &&
            e.timestamp > lastAi.timestamp &&
            e.timestamp - lastAi.timestamp <= 15000
        );
        const evIds = [lastAi.eventId, ...humanAfter.slice(0, 4).map((h) => h.eventId)];

        edges.push({
          edgeId: `${sId}:edge:aimod_viewers`,
          streamId: sId,
          fromNodeId: aiCrewNodeId,
          toNodeId: viewersNodeId,
          domain: 'AI_MOD_VS_VIEWERS',
          relationLabelHe: `מנחה AI ← ${humanAfter.length} תגובות צופים אנושיים (15 שנ׳)`,
          deltaMs: humanAfter[0] ? humanAfter[0].timestamp - lastAi.timestamp : 0,
          weight: Math.max(1, humanAfter.length),
          confidence: humanAfter.some((h) => h.chatSubKind === 'REPLY_TO_AI_MOD') ? 0.89 : 0.68,
          isHypothesis: !humanAfter.some((h) => h.chatSubKind === 'REPLY_TO_AI_MOD'),
          hypothesisReasonHe: 'נספרו תגובות אנושיות בלבד (ללא הודעות בוטים); קשר סיבתי דורש פנייה ישירה',
          evidenceEventIds: evIds,
          updatedAtTs: now,
        });

        findings.push({
          findingId: `${sId}:find:aimod_viewers`,
          streamId: sId,
          domain: 'AI_MOD_VS_VIEWERS',
          headlineHe: `1. מנחה AI מול הצופים ב-@${creator}`,
          explanationHe: `לאחר הודעת @${lastAi.actorHandle} ("${(lastAi.sanitizedTextContent || '').slice(
            0,
            52
          )}"), נרשמו ${humanAfter.length} הודעות מצופים אנושיים ב-15 שניות (הודעות סוכני AI מופרדות ואינן נספרות כתגובות קהל).`,
          measuredDeltaSummaryHe: `${humanAfter.length} תגובות אנושיות / 15 שנ׳`,
          confidence: 0.85,
          isHypothesis: humanAfter.length > 0 && !humanAfter.some((h) => h.chatSubKind === 'REPLY_TO_AI_MOD'),
          evidenceEventIds: evIds,
          detectedAtTs: now,
        });

        // 2. AI_MOD_VS_CREATOR (מנחה AI מול היוצר)
        const creatorAfterAi = chronological.filter(
          (e) =>
            e.actorOrigin === 'CREATOR_HOST' &&
            e.timestamp > lastAi.timestamp &&
            e.timestamp - lastAi.timestamp <= 20000
        );
        findings.push({
          findingId: `${sId}:find:aimod_creator`,
          streamId: sId,
          domain: 'AI_MOD_VS_CREATOR',
          headlineHe: `2. מנחה AI מול היוצר @${creator}`,
          explanationHe:
            creatorAfterAi.length > 0
              ? `היוצר הגיב/דיבר תוך ${Math.round((creatorAfterAi[0].timestamp - lastAi.timestamp) / 1000)} שנ׳ מהצעת מנחה ה-AI.`
              : bucket.dossier.creatorCurrentlySpeaking
                ? 'היוצר באמצע דיבור פעיל — מנחי ה-AI שומרים על שקט כדי לא לקטוע אותו.'
                : 'מנחה ה-AI מסייע בשמירת רצף שיחה מבלי להתנגש בדברי היוצר.',
          measuredDeltaSummaryHe: creatorAfterAi.length > 0 ? 'המשך שיח ע״י היוצר' : 'ללא התנגשות בדיבור יוצר',
          confidence: 0.82,
          isHypothesis: creatorAfterAi.length > 0,
          evidenceEventIds: [lastAi.eventId, ...creatorAfterAi.slice(0, 2).map((c) => c.eventId)],
          detectedAtTs: now,
        });
      }

      // 3. AI_MOD_VS_HUMAN_MOD (מנחה AI מול מנהל צ׳אט אנושי)
      const humanModMsgs = chronological.filter((e) => e.actorOrigin === 'HUMAN_MODERATOR');
      if (humanModMsgs.length > 0) {
        nodes.push({
          nodeId: humanModNodeId,
          streamId: sId,
          label: `מנהלי צ׳אט אנושיים (${bucket.dossier.humanModeratorsDetected.length})`,
          nodeType: 'HUMAN_MOD',
          activityScore: Math.min(100, humanModMsgs.length * 14),
          lastActiveTs: humanModMsgs[humanModMsgs.length - 1].timestamp,
        });
        const lastHMod = humanModMsgs[humanModMsgs.length - 1];
        edges.push({
          edgeId: `${sId}:edge:aimod_humanmod`,
          streamId: sId,
          fromNodeId: humanModNodeId,
          toNodeId: aiCrewNodeId,
          domain: 'AI_MOD_VS_HUMAN_MOD',
          relationLabelHe: 'חלוקת עבודה מתואמת ללא כפילות מענה',
          deltaMs: 0,
          weight: humanModMsgs.length,
          confidence: 0.88,
          isHypothesis: false,
          evidenceEventIds: [lastHMod.eventId],
          updatedAtTs: now,
        });
        findings.push({
          findingId: `${sId}:find:aimod_humanmod`,
          streamId: sId,
          domain: 'AI_MOD_VS_HUMAN_MOD',
          headlineHe: `3. מנחה AI מול מנהל צ׳אט אנושי (@${lastHMod.actorHandle})`,
          explanationHe: `זוהו ${humanModMsgs.length} הודעות של מנהלי צ׳אט אנושיים. ה-Chat Orchestrator מונע ממנחי ה-AI לענות כפול על שאלה שמנהל אנושי כבר ענה עליה.`,
          measuredDeltaSummaryHe: `${humanModMsgs.length} פעולות מנהל אנושי סונכרנו`,
          confidence: 0.88,
          isHypothesis: false,
          evidenceEventIds: [lastHMod.eventId],
          detectedAtTs: now,
        });
      }

      // 4. CREATOR_VS_VIEWERS (היוצר מול הצופים + שאלות חוזרות)
      const creatorSpeech = chronological.filter((e) => e.actorOrigin === 'CREATOR_HOST');
      if (creatorSpeech.length > 0) {
        const lastSp = creatorSpeech[creatorSpeech.length - 1];
        const postHumanChat = chronological.filter(
          (e) =>
            e.category === 'CHAT_MESSAGE' &&
            e.actorOrigin === 'HUMAN_VIEWER' &&
            e.timestamp > lastSp.timestamp &&
            e.timestamp - lastSp.timestamp <= 10000
        );
        const speakerVerified = Boolean(lastSp.metadata?.speakerVerified);
        const evIds = [lastSp.eventId, ...postHumanChat.slice(0, 4).map((c) => c.eventId)];

        edges.push({
          edgeId: `${sId}:edge:creator_viewers`,
          streamId: sId,
          fromNodeId: creatorNodeId,
          toNodeId: viewersNodeId,
          domain: 'CREATOR_VS_VIEWERS',
          relationLabelHe: `דברי יוצר ← ${postHumanChat.length} הודעות צופים ב-10 שנ׳`,
          deltaMs: postHumanChat[0] ? postHumanChat[0].timestamp - lastSp.timestamp : 0,
          weight: Math.max(1, postHumanChat.length),
          confidence: speakerVerified ? 0.87 : 0.64,
          isHypothesis: !speakerVerified,
          hypothesisReasonHe: !speakerVerified ? 'ייחוס דובר משוער מערוץ השמע' : undefined,
          evidenceEventIds: evIds,
          updatedAtTs: now,
        });

        findings.push({
          findingId: `${sId}:find:creator_viewers`,
          streamId: sId,
          domain: 'CREATOR_VS_VIEWERS',
          headlineHe: `4. היוצר מול הצופים ב-@${creator}`,
          explanationHe: `לאחר פניית היוצר ("${(lastSp.sanitizedTextContent || '').slice(0, 50)}"), נרשמו ${
            postHumanChat.length
          } תגובות מצופים אנושיים תוך 10 שניות.`,
          measuredDeltaSummaryHe: `${postHumanChat.length} תגובות קהל / 10 שנ׳`,
          confidence: speakerVerified ? 0.87 : 0.64,
          isHypothesis: !speakerVerified,
          evidenceEventIds: evIds,
          detectedAtTs: now,
        });
      }

      for (const q of bucket.questionMap.values()) {
        if (q.occurrencesCount >= 2 && !q.answeredByHostOrMod) {
          findings.push({
            findingId: `${sId}:find:unanswered_${q.clusterId}`,
            streamId: sId,
            domain: 'CREATOR_VS_VIEWERS',
            headlineHe: `שאלה חוזרת ללא מענה (${q.occurrencesCount} פעמים) — מועברת למנחה 2 (Community Manager)`,
            explanationHe: `השאלה "${q.sampleRawQuestion}" נשאלה ע״י ${q.distinctAskHandles.length} צופים אנושיים וטרם נענתה.`,
            measuredDeltaSummaryHe: `${q.occurrencesCount} שאלות פתוחות`,
            confidence: 0.94,
            isHypothesis: false,
            evidenceEventIds: q.evidenceEventIds,
            detectedAtTs: now,
          });
        }
      }

      // 5. CREATOR_VS_OPPONENT & 7. OPPONENT_VS_VIEWERS & 8. CHAT_VS_BATTLE_EVENTS
      if (bucket.dossier.battleMetrics.opponentUsername) {
        const opp = bucket.dossier.battleMetrics.opponentUsername;
        const oppNodeId = `${sId}:opp:${opp}`;
        const oppBucket = this.streams.get(`live_${opp.toLowerCase()}`);

        nodes.push({
          nodeId: oppNodeId,
          streamId: sId,
          label: `יריב @${opp}`,
          nodeType: 'OPPONENT',
          activityScore: bucket.dossier.battleMetrics.inBattle ? 80 : 35,
          lastActiveTs: bucket.dossier.lastEventTs,
        });

        const battleEvs = chronological.filter((e) => e.category === 'BATTLE_STATE');
        const oppMentionsInChat = chronological.filter((e) => e.chatSubKind === 'REPLY_TO_OPPONENT');

        if (battleEvs.length > 0) {
          const lastB = battleEvs[battleEvs.length - 1];
          nodes.push({
            nodeId: battleNodeId,
            streamId: sId,
            label: `זירת קרב (${bucket.dossier.battleMetrics.verifiedHostScore ?? '?'} : ${
              bucket.dossier.battleMetrics.verifiedOpponentScore ?? '?'
            })`,
            nodeType: 'BATTLE_EVENT',
            activityScore: 85,
            lastActiveTs: lastB.timestamp,
          });

          edges.push({
            edgeId: `${sId}:edge:creator_opp`,
            streamId: sId,
            fromNodeId: creatorNodeId,
            toNodeId: oppNodeId,
            domain: 'CREATOR_VS_OPPONENT',
            relationLabelHe: `קרב חי (${bucket.dossier.battleMetrics.scoreLeadState})`,
            deltaMs: 0,
            weight: 4,
            confidence: bucket.dossier.battleMetrics.verifiedHostScore !== null ? 0.93 : 0.65,
            isHypothesis: !oppBucket,
            evidenceEventIds: [lastB.eventId],
            updatedAtTs: now,
          });

          findings.push({
            findingId: `${sId}:find:creator_opp`,
            streamId: sId,
            domain: 'CREATOR_VS_OPPONENT',
            headlineHe: `5. היוצר @${creator} מול היריב @${opp}`,
            explanationHe: `ניקוד מאומת: ${bucket.dossier.battleMetrics.verifiedHostScore ?? 'לא זמין'} מול ${
              bucket.dossier.battleMetrics.verifiedOpponentScore ?? 'לא זמין'
            } (מומנטום 10 שנ׳: ${bucket.dossier.battleMetrics.scoreMomentumPer10s}).`,
            measuredDeltaSummaryHe: `מצב: ${bucket.dossier.battleMetrics.scoreLeadState}`,
            confidence: bucket.dossier.battleMetrics.verifiedHostScore !== null ? 0.93 : 0.65,
            isHypothesis: false,
            evidenceEventIds: [lastB.eventId],
            detectedAtTs: now,
          });

          // 7. OPPONENT_VS_VIEWERS
          findings.push({
            findingId: `${sId}:find:opp_viewers`,
            streamId: sId,
            domain: 'OPPONENT_VS_VIEWERS',
            headlineHe: `7. היריב @${opp} מול הצופים`,
            explanationHe: oppBucket
              ? `בחדר היריב @${opp} נמדדות כעת ${oppBucket.dossier.chatMetrics.humanMessagesPerMin} הודעות/דקה, ובחדר שלנו ${oppMentionsInChat.length} הודעות התייחסו ישירות ליריב.`
              : `בחדר שלנו זוהו ${oppMentionsInChat.length} הודעות צופים המתייחסות ליריב @${opp}.`,
            measuredDeltaSummaryHe: `${oppMentionsInChat.length} אזכורי יריב בצ׳אט`,
            confidence: oppBucket ? 0.89 : 0.72,
            isHypothesis: !oppBucket,
            evidenceEventIds: [lastB.eventId, ...oppMentionsInChat.slice(-2).map((m) => m.eventId)],
            detectedAtTs: now,
          });

          // 8. CHAT_VS_BATTLE_EVENTS
          const chatAroundBattle = chronological.filter(
            (e) =>
              e.category === 'CHAT_MESSAGE' &&
              e.actorOrigin === 'HUMAN_VIEWER' &&
              Math.abs(e.timestamp - lastB.timestamp) <= 12000
          );
          edges.push({
            edgeId: `${sId}:edge:battle_chat`,
            streamId: sId,
            fromNodeId: battleNodeId,
            toNodeId: viewersNodeId,
            domain: 'CHAT_VS_BATTLE_EVENTS',
            relationLabelHe: `אירוע קרב (${lastB.subType}) ← ${chatAroundBattle.length} הודעות קהל`,
            deltaMs: 12000,
            weight: Math.max(1, chatAroundBattle.length),
            confidence: 0.86,
            isHypothesis: true,
            evidenceEventIds: [lastB.eventId, ...chatAroundBattle.slice(0, 3).map((c) => c.eventId)],
            updatedAtTs: now,
          });

          findings.push({
            findingId: `${sId}:find:chat_battle`,
            streamId: sId,
            domain: 'CHAT_VS_BATTLE_EVENTS',
            headlineHe: `8. הצ׳אט מול אירועי הקרב (${lastB.subType})`,
            explanationHe: `בסביבת אירוע הקרב האחרון נרשמו ${chatAroundBattle.length} תגובות של צופים אנושיים.`,
            measuredDeltaSummaryHe: `${chatAroundBattle.length} הודעות סביב אירוע קרב`,
            confidence: 0.86,
            isHypothesis: true,
            evidenceEventIds: [lastB.eventId, ...chatAroundBattle.slice(0, 3).map((c) => c.eventId)],
            detectedAtTs: now,
          });
        }
      }

      // 6. CREATOR_VS_CO_CREATORS (כמה יוצרים ביחד)
      const creatorGroupEvents = chronological.filter(
        (e) => e.actorOrigin === 'CREATOR_HOST' || e.actorOrigin === 'CO_CREATOR_OR_RIVAL'
      );
      const distinctGroupHandles = Array.from(new Set(creatorGroupEvents.map((e) => e.actorHandle)));
      if (distinctGroupHandles.length >= 2) {
        for (const co of bucket.dossier.coHosts.slice(0, 3)) {
          nodes.push({
            nodeId: `${sId}:cohost:${co}`,
            streamId: sId,
            label: `יוצר שותף @${co}`,
            nodeType: 'CO_HOST',
            activityScore: 68,
            lastActiveTs: bucket.dossier.lastEventTs,
          });
        }
        findings.push({
          findingId: `${sId}:find:co_creators`,
          streamId: sId,
          domain: 'CREATOR_VS_CO_CREATORS',
          headlineHe: `6. היוצר מול יוצרים נוספים (${distinctGroupHandles.length} משתתפים)`,
          explanationHe: `שיח פעיל בין: ${distinctGroupHandles.map((h) => '@' + h).join(' ↔ ')} (${
            creatorGroupEvents.length
          } תורות מתועדים).`,
          measuredDeltaSummaryHe: `${creatorGroupEvents.length} חילופי דברים`,
          confidence: 0.78,
          isHypothesis: creatorGroupEvents.some((e) => e.metadata?.speakerVerified === false),
          evidenceEventIds: creatorGroupEvents.slice(-4).map((e) => e.eventId),
          detectedAtTs: now,
        });
      }

      // 9. CHAT_VS_MUSIC & 10. CHAT_VS_VFX & 11. MODS_VS_STREAM_EVENTS
      const execEvents = chronological.filter((e) => e.category === 'SYSTEM_EXECUTION');
      if (execEvents.length > 0) {
        nodes.push({
          nodeId: vfxAudioNodeId,
          streamId: sId,
          label: 'במת אפקטים ומוזיקה',
          nodeType: 'STAGE_VFX_AUDIO',
          activityScore: 72,
          lastActiveTs: execEvents[execEvents.length - 1].timestamp,
        });

        const lastExec = execEvents[execEvents.length - 1];
        const isMusic = lastExec.subType.includes('MUSIC') || lastExec.subType.includes('SOUND');
        const dom: CrossCorrelationDomain = isMusic ? 'CHAT_VS_MUSIC' : 'CHAT_VS_VFX';
        const afterHuman = chronological.filter(
          (e) =>
            e.category === 'CHAT_MESSAGE' &&
            e.actorOrigin === 'HUMAN_VIEWER' &&
            e.timestamp > lastExec.timestamp &&
            e.timestamp - lastExec.timestamp <= 12000
        );

        edges.push({
          edgeId: `${sId}:edge:stage_${dom}`,
          streamId: sId,
          fromNodeId: vfxAudioNodeId,
          toNodeId: viewersNodeId,
          domain: dom,
          relationLabelHe: `${lastExec.subType} ← ${afterHuman.length} הודעות קהל (השערת מתאם)`,
          deltaMs: 12000,
          weight: Math.max(1, afterHuman.length),
          confidence: 0.71,
          isHypothesis: true,
          hypothesisReasonHe: 'סמיכות זמנים אינה מוכיחה סיבתיות לבדה',
          evidenceEventIds: [lastExec.eventId, ...afterHuman.slice(0, 3).map((a) => a.eventId)],
          updatedAtTs: now,
        });

        findings.push({
          findingId: `${sId}:find:${dom}_${lastExec.eventId}`,
          streamId: sId,
          domain: dom,
          headlineHe: isMusic
            ? `9. הצ׳אט מול המוזיקה והסאונד (${lastExec.subType})`
            : `10. הצ׳אט מול האפקטים (${lastExec.subType})`,
          explanationHe: `ב-12 השניות שלאחר ${lastExec.subType} נמדדו ${afterHuman.length} הודעות מצופים אנושיים.`,
          measuredDeltaSummaryHe: `${afterHuman.length} הודעות אנושיות אחרי ההפעלה`,
          confidence: 0.71,
          isHypothesis: true,
          evidenceEventIds: [lastExec.eventId, ...afterHuman.slice(0, 3).map((a) => a.eventId)],
          detectedAtTs: now,
        });
      }

      // 11. MODS_VS_STREAM_EVENTS
      if (aiMsgs.length > 0 || humanModMsgs.length > 0) {
        const modCombined = [...aiMsgs, ...humanModMsgs];
        const lastM = modCombined[modCombined.length - 1];
        findings.push({
          findingId: `${sId}:find:mods_events`,
          streamId: sId,
          domain: 'MODS_VS_STREAM_EVENTS',
          headlineHe: `11. תזמון המנחים מול אירועי השידור`,
          explanationHe: `פעולת המנחה האחרונה (@${lastM.actorHandle}) בוצעה ${
            lastM.relatedEventIds.length > 0 ? 'כתגובה ישירה לאירוע מזוהה בלייב' : 'ביוזמה יזומה בחלון שקט'
          }.`,
          measuredDeltaSummaryHe: `${modCombined.length} פעולות מנחים מתועדות`,
          confidence: 0.85,
          isHypothesis: false,
          evidenceEventIds: [lastM.eventId, ...lastM.relatedEventIds.slice(0, 2)],
          detectedAtTs: now,
        });
      }

      // 12. UNIFIED_ALL_CONVERSATIONS — Time-Synchronized Interaction Chain
      if (chronological.length >= 3) {
        const recentSlice = chronological.slice(-7);
        const t0 = recentSlice[0].timestamp;
        const hasUnverifiedSpeaker = recentSlice.some(
          (e) => e.category === 'SPEECH_TRANSCRIPT' && e.metadata?.speakerVerified === false
        );
        const steps = recentSlice.map((ev) => ({
          eventId: ev.eventId,
          offsetMs: ev.timestamp - t0,
          actorOrigin: ev.actorOrigin,
          actorLabel: `@${ev.actorHandle} [${
            ev.actorOrigin === 'AI_AGENT'
              ? 'סוכן AI'
              : ev.actorOrigin === 'CREATOR_HOST'
                ? 'יוצר'
                : ev.actorOrigin === 'CO_CREATOR_OR_RIVAL'
                  ? 'משתתף/יריב'
                  : ev.actorOrigin === 'HUMAN_MODERATOR'
                    ? 'מנהל אנושי'
                    : ev.actorOrigin === 'SYSTEM_STAGE'
                      ? 'במה'
                      : 'צופה אנושי'
          }]`,
          actionHe: ev.sanitizedTextContent
            ? `"${ev.sanitizedTextContent.slice(0, 44)}"`
            : `${ev.subType}${ev.numericValue ? ` (${ev.numericValue})` : ''}`,
          reliability: ev.reliability,
        }));

        causalChains.push({
          chainId: `${sId}:chain:${t0}`,
          streamId: sId,
          startedAtTs: t0,
          totalSpanMs: recentSlice[recentSlice.length - 1].timestamp - t0,
          summaryChainHe: steps.map((st) => `${st.actorLabel}: ${st.actionHe}`).join(' ← '),
          isHypothesis: hasUnverifiedSpeaker || recentSlice.some((e) => e.relatedEventIds.length === 0),
          confidence: hasUnverifiedSpeaker ? 0.65 : 0.84,
          steps,
        });

        findings.push({
          findingId: `${sId}:find:unified_${sId}`,
          streamId: sId,
          domain: 'UNIFIED_ALL_CONVERSATIONS',
          headlineHe: `12. סנכרון כלל השיחות והאירועים בחדר @${creator}`,
          explanationHe: `סונכרנו ${recentSlice.length} אירועים עוקבים על ציר הזמן בהפרדה מלאה בין צופים אנושיים (${bucket.dossier.chatMetrics.humanViewerMessagesCount}), יוצר (${bucket.dossier.chatMetrics.creatorMessagesCount}) וסוכני AI (${bucket.dossier.chatMetrics.aiAgentMessagesCount}).`,
          measuredDeltaSummaryHe: `טווח שרשרת אחרונה: ${((recentSlice[recentSlice.length - 1].timestamp - t0) / 1000).toFixed(1)} שנ׳`,
          confidence: 0.9,
          isHypothesis: false,
          evidenceEventIds: recentSlice.map((e) => e.eventId),
          detectedAtTs: now,
        });
      }
    }

    return {
      lastComputedAtTs: now,
      nodes: nodes.slice(0, 70),
      edges: edges.slice(0, 70),
      causalChains: causalChains.slice(0, 16),
      findings: findings.slice(0, 40),
    };
  }

  // ==========================================================================
  // LIVE MULTIMODAL OBSERVER UPDATES
  // ==========================================================================

  public updateVisualTelemetry(
    streamId: string,
    creatorUsername: string,
    patch: Partial<VisualSceneTelemetry>
  ) {
    const now = Date.now();
    this.multimodal.visual = {
      ...this.multimodal.visual,
      ...patch,
      capturedAtTs: now,
    };

    const { bucket } = this.ensureStreamRegistered({
      streamId,
      creatorUsername,
      source: 'AUTHORIZED_MEDIA_STREAM',
      connected: true,
    });
    bucket.dossier.videoSourceConnected = Boolean(this.multimodal.visual.sourceConnected);
    bucket.dossier.latestVisualSummaryHe =
      this.multimodal.visual.aiSceneSummaryHe ||
      (this.multimodal.visual.sourceConnected
        ? `תנועה ${this.multimodal.visual.motionIndexPct}% · עומס חזותי ${this.multimodal.visual.visualClutterPct}%${
            this.multimodal.visual.subjectOccludedByVfx ? ' · אזהרה: אפקט מסתיר מצולם!' : ''
          }`
        : null);

    if (this.multimodal.visual.sourceConnected) {
      this.ingestEvent({
        streamId,
        creatorUsername,
        source: 'AUTHORIZED_MEDIA_STREAM',
        reliability: 'VERIFIED_LOCAL_MEDIA',
        actorOrigin: 'CREATOR_HOST',
        category: 'VISUAL_SCENE_OBSERVATION',
        subType: this.multimodal.visual.subjectOccludedByVfx
          ? 'SUBJECT_OCCLUDED_WARNING'
          : this.multimodal.visual.visualPeakDetected
            ? 'VISUAL_PEAK'
            : 'FRAME_METRICS',
        actorHandle: creatorUsername,
        explicitRole: 'HOST_CREATOR',
        numericValue: this.multimodal.visual.motionIndexPct,
        textContent: bucket.dossier.latestVisualSummaryHe || undefined,
      });
    }
  }

  public updateAudioMusicTelemetry(
    streamId: string,
    creatorUsername: string,
    patch: Partial<AudioMusicTelemetry>
  ) {
    const now = Date.now();
    if (!patch.sourceConnected) {
      this.multimodal.audio = {
        sourceConnected: false,
        sourceLabelHe:
          'אין מקור אודיו מחובר — חבר מיקרופון או שיתוף לשונית/וידאו עם שמע לקבלת BPM, בהירות דיבור וניתוח מוזיקה אמיתי',
        capturedAtTs: now,
        rmsLoudnessDb: null,
        estimatedBpm: null,
        beatRegularityPct: null,
        energyShiftDeltaPct: null,
        silenceDetected: false,
        silenceDurationMs: 0,
        musicalBurstDetected: false,
        speechBandClarityPct: null,
        sfxImpairingSpeech: false,
        musicSpeechAlignmentHe: 'לא זמין ללא מקור אודיו מורשה',
      };
      const existing = this.streams.get(streamId.toLowerCase());
      if (existing) {
        existing.dossier.audioSourceConnected = false;
        existing.dossier.latestAudioSummaryHe = null;
      }
      return;
    }

    this.multimodal.audio = {
      ...this.multimodal.audio,
      ...patch,
      sourceConnected: true,
      capturedAtTs: now,
    };

    const { bucket } = this.ensureStreamRegistered({
      streamId,
      creatorUsername,
      source: 'AUTHORIZED_MEDIA_STREAM',
      connected: true,
    });
    bucket.dossier.audioSourceConnected = true;
    bucket.dossier.latestAudioSummaryHe = `עוצמה ${this.multimodal.audio.rmsLoudnessDb ?? '--'}dB · BPM משוער ${
      this.multimodal.audio.estimatedBpm ?? 'במדידה'
    } · בהירות דיבור ${this.multimodal.audio.speechBandClarityPct ?? '--'}%`;

    if (
      this.multimodal.audio.sfxImpairingSpeech ||
      this.multimodal.audio.silenceDetected ||
      this.multimodal.audio.musicalBurstDetected
    ) {
      this.ingestEvent({
        streamId,
        creatorUsername,
        source: 'AUTHORIZED_MEDIA_STREAM',
        reliability: 'VERIFIED_LOCAL_MEDIA',
        actorOrigin: 'SYSTEM_STAGE',
        category: 'AUDIO_MUSIC_OBSERVATION',
        subType: this.multimodal.audio.sfxImpairingSpeech
          ? 'SFX_MASKING_SPEECH'
          : this.multimodal.audio.silenceDetected
            ? 'AUDIO_SILENCE_WINDOW'
            : 'MUSICAL_BURST',
        actorHandle: creatorUsername,
        explicitRole: 'HOST_CREATOR',
        numericValue: this.multimodal.audio.rmsLoudnessDb ?? 0,
        textContent: this.multimodal.audio.musicSpeechAlignmentHe,
      });
    }
  }

  public recordTranscriptSegment(params: {
    streamId: string;
    creatorUsername: string;
    speakerLabel: string;
    speakerVerified: boolean;
    speakerRole?: ParticipantRoleKind;
    language: string;
    text: string;
    startedAtTs: number;
    endedAtTs: number;
    vocalToneHe: string;
    volumeDb: number | null;
    providerUsed: string;
  }): SpeechTranscriptSegment | null {
    const cleanText = String(params.text || '').trim();
    if (!cleanText) return null;

    const durationMin = Math.max(0.05, (params.endedAtTs - params.startedAtTs) / 60000);
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
    const wpm = Math.round(wordCount / durationMin);

    const bucket = this.streams.get(params.streamId.toLowerCase());
    const linkedChatEventIds = bucket
      ? bucket.events
          .filter(
            (e) =>
              e.category === 'CHAT_MESSAGE' &&
              e.actorOrigin === 'HUMAN_VIEWER' &&
              Math.abs(e.timestamp - params.endedAtTs) <= 10000
          )
          .slice(0, 5)
          .map((e) => e.eventId)
      : [];

    const seg: SpeechTranscriptSegment = {
      segmentId: this.nextId('stt'),
      streamId: params.streamId.toLowerCase(),
      startedAtTs: params.startedAtTs,
      endedAtTs: params.endedAtTs,
      speakerLabel: params.speakerLabel,
      speakerVerified: params.speakerVerified,
      language: params.language,
      text: cleanText,
      containsSpokenQuestion: isQuestionText(cleanText),
      speechRateWpm: wpm,
      vocalToneHe: params.vocalToneHe,
      volumeDb: params.volumeDb,
      linkedChatEventIds,
      providerUsed: params.providerUsed,
    };

    this.multimodal.recentTranscripts.unshift(seg);
    if (this.multimodal.recentTranscripts.length > 30) {
      this.multimodal.recentTranscripts.length = 30;
    }

    const evt = this.ingestEvent({
      streamId: params.streamId,
      creatorUsername: params.creatorUsername,
      timestamp: params.endedAtTs,
      source: 'AUTHORIZED_MEDIA_STREAM',
      reliability: 'VERIFIED_LOCAL_MEDIA',
      actorOrigin: params.speakerRole === 'BATTLE_OPPONENT' || params.speakerRole === 'CO_HOST'
        ? 'CO_CREATOR_OR_RIVAL'
        : 'CREATOR_HOST',
      category: 'SPEECH_TRANSCRIPT',
      subType: seg.containsSpokenQuestion ? 'SPOKEN_QUESTION' : 'SPOKEN_UTTERANCE',
      actorHandle: params.speakerLabel,
      explicitRole: params.speakerRole || 'HOST_CREATOR',
      textContent: cleanText,
      languageTag: params.language,
      metadata: {
        speakerVerified: params.speakerVerified,
        wpm,
        providerUsed: params.providerUsed,
      },
    });

    if (evt) {
      this.deriveCarefulAffectEstimate(params.streamId, [evt.eventId, ...linkedChatEventIds]);
    }

    return seg;
  }

  public deriveCarefulAffectEstimate(streamId: string, evidenceEventIds: string[]): CarefulAffectEstimate | null {
    const v = this.multimodal.visual;
    const a = this.multimodal.audio;
    const evidence: string[] = [];
    let atmosphere: CarefulAffectEstimate['apparentAtmosphere'] = 'CALM';
    let labelHe = 'אווירה רגועה ויציבה (הערכה חיצונית זהירה)';
    let confidence = 0.58;

    if (a.sourceConnected && a.rmsLoudnessDb !== null) {
      evidence.push(`עוצמת שמע נמדדת: ${a.rmsLoudnessDb} dBFS`);
    }
    if (v.sourceConnected) {
      evidence.push(`מדד תנועה בפריים: ${v.motionIndexPct}%`);
      if (v.visibleExpressionCueHe) evidence.push(`סימן חזותי נראה: ${v.visibleExpressionCueHe}`);
    }
    const bucket = this.streams.get(streamId.toLowerCase());
    if (bucket) {
      evidence.push(`קצב צ׳אט אנושי: ${bucket.dossier.chatMetrics.humanMessagesPerMin} הודעות/דקה`);
      if (bucket.dossier.engagementMetrics.likesPerSec > 0) {
        evidence.push(`קצב לייקים: ${bucket.dossier.engagementMetrics.likesPerSec}/שנ׳`);
      }
    }

    if (evidence.length === 0) return null;

    if (
      (a.rmsLoudnessDb !== null && a.rmsLoudnessDb > -14) ||
      v.motionIndexPct >= 62 ||
      (bucket && bucket.dossier.engagementMetrics.likesPerSec >= 18)
    ) {
      atmosphere = 'EXCITEMENT';
      labelHe = 'עליית אנרגיה והתלהבות נצפית בשידור';
      confidence = v.sourceConnected && a.sourceConnected ? 0.81 : 0.66;
    } else if (bucket?.dossier.battleMetrics.inBattle && bucket.dossier.battleMetrics.scoreLeadState === 'TRAILING') {
      atmosphere = 'TENSION';
      labelHe = 'דריכות/מתח תחרותי נצפה בזמן פיגור בבאטל';
      confidence = 0.72;
    } else if (a.silenceDetected && a.silenceDurationMs >= 4000) {
      atmosphere = 'CALM';
      labelHe = 'הפוגת שקט / האטת קצב נצפית בשידור';
      confidence = 0.75;
    }

    const est: CarefulAffectEstimate = {
      estimateId: this.nextId('affect'),
      streamId: streamId.toLowerCase(),
      timestamp: Date.now(),
      apparentAtmosphere: atmosphere,
      labelHe,
      confidence,
      observableEvidenceHe: evidence,
      epistemicDisclaimerHe:
        'הערכה זו מתארת אותות קול, תנועה וקצב קהל חיצוניים בלבד — אינה קובעת מחשבות או רגשות פנימיים של המצולמים.',
      evidenceEventIds,
    };

    this.multimodal.affectEstimates.unshift(est);
    if (this.multimodal.affectEstimates.length > 16) {
      this.multimodal.affectEstimates.length = 16;
    }
    return est;
  }

  // ==========================================================================
  // REPLAY ENGINE
  // ==========================================================================

  private loadReplaysFromDisk() {
    ensureDataDir();
    try {
      if (fs.existsSync(REPLAYS_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(REPLAYS_FILE, 'utf-8'));
        if (Array.isArray(parsed)) {
          this.replays = parsed.slice(0, 15);
        }
      }
    } catch {
      this.replays = [];
    }
  }

  private persistReplaysToDisk() {
    ensureDataDir();
    try {
      fs.writeFileSync(REPLAYS_FILE, JSON.stringify(this.replays.slice(0, 15), null, 2), 'utf-8');
    } catch {
      // Ignore
    }
  }

  public saveCurrentSnapshotAsReplay(titleHe?: string, streamIdFilter?: string): ReplaySessionRecord {
    const sourceEvents = (
      streamIdFilter
        ? this.globalEvents.filter((e) => e.streamId === streamIdFilter.toLowerCase())
        : this.globalEvents
    )
      .slice(0, 250)
      .reverse();

    const t0 = sourceEvents[0]?.timestamp ?? Date.now();
    const tEnd = sourceEvents[sourceEvents.length - 1]?.timestamp ?? t0;
    const streamIds = Array.from(new Set(sourceEvents.map((e) => e.streamId)));

    const record: ReplaySessionRecord = {
      replayId: this.nextId('replay'),
      titleHe:
        titleHe?.trim() ||
        `הקלטת אירועי לייב (${streamIds.length || 1} חדרים · ${sourceEvents.length} אירועים)`,
      createdAtTs: Date.now(),
      streamIds,
      durationMs: Math.max(1000, tEnd - t0),
      eventsCount: sourceEvents.length,
      events: sourceEvents,
    };

    this.replays.unshift(record);
    if (this.replays.length > 15) this.replays.length = 15;
    this.persistReplaysToDisk();
    return record;
  }

  public startReplaySession(
    replayId: string,
    onStep?: (ev: CanonicalLiveEvent) => void
  ): { ok: boolean; errorHe?: string } {
    const found = this.replays.find((r) => r.replayId === replayId);
    if (!found || found.events.length === 0) {
      return { ok: false, errorHe: 'סשן ה-Replay המבוקש לא נמצא או שהוא ריק מאירועים.' };
    }

    if (this.activeReplayTimer) {
      clearInterval(this.activeReplayTimer);
      this.activeReplayTimer = null;
    }

    let idx = 0;
    this.activeReplayStatus = {
      running: true,
      replayId,
      progressPct: 0,
    };

    this.activeReplayTimer = setInterval(() => {
      if (idx >= found.events.length) {
        if (this.activeReplayTimer) clearInterval(this.activeReplayTimer);
        this.activeReplayTimer = null;
        this.activeReplayStatus = { running: false, replayId: null, progressPct: 100 };
        return;
      }
      const orig = found.events[idx];
      idx += 1;
      this.activeReplayStatus.progressPct = Math.round((idx / found.events.length) * 100);

      const replayed = this.ingestEvent({
        streamId: `replay_${orig.creatorUsername}`,
        creatorUsername: orig.creatorUsername,
        source: 'REPLAY_RECORDING',
        reliability: 'REPLAY_VERIFIED',
        actorOrigin: orig.actorOrigin,
        category: orig.category,
        subType: orig.subType,
        actorHandle: orig.actorHandle,
        actorDisplayName: orig.actorDisplayName,
        explicitRole: orig.actorRole,
        aiAgentId: orig.aiAgentId,
        targetHandle: orig.targetHandle,
        numericValue: orig.numericValue,
        textContent: orig.textContent,
        languageTag: orig.languageTag,
        dedupeKey: `replay_${replayId}_${idx}_${Date.now()}`,
        metadata: orig.metadata,
      });
      if (replayed && onStep) onStep(replayed);
    }, 280);

    return { ok: true };
  }

  public removeSyntheticTestStreams() {
    for (const [key, bucket] of this.streams.entries()) {
      if (bucket.dossier.source === 'TEST_HARNESS' || key.startsWith('test_')) {
        this.streams.delete(key);
      }
    }
    this.globalEvents = this.globalEvents.filter((e) => e.source !== 'TEST_HARNESS');
  }

  public getEventById(eventId: string): CanonicalLiveEvent | undefined {
    return this.globalEvents.find((e) => e.eventId === eventId);
  }

  public getStreamDossier(streamIdOrCreator: string): LiveStreamDossier | undefined {
    const clean = streamIdOrCreator.replace(/^@+/, '').toLowerCase();
    return (
      this.streams.get(clean)?.dossier ||
      this.streams.get(`live_${clean}`)?.dossier ||
      Array.from(this.streams.values()).find((b) => b.dossier.creatorUsername === clean)?.dossier
    );
  }

  public getRecentStreamEvents(streamIdOrCreator?: string, limit = 40): CanonicalLiveEvent[] {
    if (!streamIdOrCreator) return this.globalEvents.slice(0, limit);
    const clean = streamIdOrCreator.replace(/^@+/, '').toLowerCase();
    const bucket =
      this.streams.get(clean) ||
      this.streams.get(`live_${clean}`) ||
      Array.from(this.streams.values()).find((b) => b.dossier.creatorUsername === clean);
    return bucket ? bucket.events.slice(0, limit) : this.globalEvents.slice(0, limit);
  }

  public getMultimodalState(): MultimodalObserverState {
    return this.multimodal;
  }

  public getSnapshot(): DataFactorySnapshot {
    const repeatedQuestions: RepeatedQuestionCluster[] = [];
    for (const b of this.streams.values()) {
      for (const q of b.questionMap.values()) {
        if (q.occurrencesCount >= 2) {
          repeatedQuestions.push(q);
        }
      }
    }
    repeatedQuestions.sort((a, b) => b.lastAskedTs - a.lastAskedTs);

    const streamsList = Array.from(this.streams.values())
      .map((b) => b.dossier)
      .sort((a, b) => {
        if (a.connected !== b.connected) return a.connected ? -1 : 1;
        return b.lastEventTs - a.lastEventTs;
      });

    return {
      maxConcurrentStreams: this.maxConcurrentStreams,
      activeStreamsCount: streamsList.filter((s) => s.connected).length,
      totalEventsCaptured: this.globalEvents.length,
      deduplicatedDropsCount: this.deduplicatedDropsCount,
      promptInjectionsBlockedCount: this.promptInjectionsBlockedCount,
      streams: streamsList,
      recentCanonicalEvents: this.globalEvents.slice(0, 60),
      repeatedQuestions: repeatedQuestions.slice(0, 20),
      availableReplays: this.replays.map(({ events: _ev, ...meta }) => meta),
      activeReplayStatus: this.activeReplayStatus,
    };
  }
}
