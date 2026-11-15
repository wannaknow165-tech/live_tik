import fs from 'fs';
import path from 'path';
import {
  CrossStreamEmpiricalObservation,
  KnowledgeEngineSnapshot,
  KnowledgeMemoryEntry,
  KnowledgeRecordLayer,
  SemanticSearchHit,
} from '../types/boosteraIntelligence';
import { sanitizeTextAndDetectInjection } from './boosteraDataFactory';

const DATA_DIR = path.join(process.cwd(), '.data');
const KNOWLEDGE_FILE = path.join(DATA_DIR, 'boostera_knowledge_engine.json');

interface StoredKnowledgeEntry extends KnowledgeMemoryEntry {
  embeddingVector: number[];
}

interface PersistedKnowledgeState {
  retentionDays: number;
  entries: StoredKnowledgeEntry[];
  crossStreamObservations: CrossStreamEmpiricalObservation[];
}

const LOCAL_VECTOR_DIM = 96;

/**
 * Deterministic multilingual (Hebrew + English + Arabic/Global) character 3-gram + word hash projection.
 * Used as a rock-solid local embedding vector when external embedding APIs are not called or offline,
 * and can be seamlessly replaced by OpenRouter / Gemini embeddings when available.
 */
export function buildLocalDeterministicEmbedding(text: string): number[] {
  const vec = new Array<number>(LOCAL_VECTOR_DIM).fill(0);
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return vec;

  const tokens = normalized.split(' ');
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % LOCAL_VECTOR_DIM;
    vec[idx] += 1.4;

    for (let g = 0; g <= tok.length - 3; g++) {
      const tri = tok.slice(g, g + 3);
      let th = 5381;
      for (let c = 0; c < tri.length; c++) {
        th = (th * 33) ^ tri.charCodeAt(c);
      }
      vec[Math.abs(th) % LOCAL_VECTOR_DIM] += 0.65;
    }
  }

  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => Number((v / norm).toFixed(5)));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

export class BoosteraKnowledgeEngine {
  private retentionDays = 30;
  private entries: StoredKnowledgeEntry[] = [];
  private crossStreamObservations: CrossStreamEmpiricalObservation[] = [];
  private seq = 0;

  constructor() {
    this.loadFromDisk();
    this.pruneExpiredEntries();
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${Date.now()}_${this.seq}`;
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(KNOWLEDGE_FILE)) {
        const raw = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf-8')) as Partial<PersistedKnowledgeState>;
        if (typeof raw.retentionDays === 'number') {
          this.retentionDays = Math.max(1, Math.min(365, raw.retentionDays));
        }
        if (Array.isArray(raw.entries)) {
          this.entries = raw.entries.slice(0, 600);
        }
        if (Array.isArray(raw.crossStreamObservations)) {
          this.crossStreamObservations = raw.crossStreamObservations.slice(0, 80);
        }
      }
    } catch {
      this.entries = [];
      this.crossStreamObservations = [];
    }
  }

  public saveToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const payload: PersistedKnowledgeState = {
        retentionDays: this.retentionDays,
        entries: this.entries.slice(0, 600),
        crossStreamObservations: this.crossStreamObservations.slice(0, 80),
      };
      fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch {
      // Ignore write failures
    }
  }

  public setRetentionDays(days: number) {
    this.retentionDays = Math.max(1, Math.min(365, Math.round(days)));
    this.pruneExpiredEntries();
    this.saveToDisk();
  }

  public pruneExpiredEntries(): number {
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.createdAtTs >= cutoff);
    return before - this.entries.length;
  }

  public purgeStreamOrAllData(streamId?: string): number {
    const before = this.entries.length;
    if (streamId) {
      const clean = streamId.toLowerCase();
      this.entries = this.entries.filter((e) => e.streamId !== clean);
    } else {
      this.entries = [];
      this.crossStreamObservations = [];
    }
    this.saveToDisk();
    return before - this.entries.length;
  }

  /**
   * Records a strictly categorized knowledge item (RAW_EVENT_DIGEST, VERIFIED_FACT, HYPOTHESIS, or AI_CONCLUSION).
   * Enforces that conclusions/facts carry explicit evidenceEventIds and strips PII before storage.
   */
  public recordEntry(params: {
    streamId: string;
    layer: KnowledgeRecordLayer;
    summaryHe: string;
    evidenceEventIds: string[];
    confidence: number;
    disagreementsNotedHe?: string | null;
    tags?: string[];
    externalEmbedding?: number[] | null;
  }): KnowledgeMemoryEntry | null {
    const { sanitized } = sanitizeTextAndDetectInjection(params.summaryHe, true);
    if (!sanitized) return null;

    // Require at least one evidence ID for non-raw conclusions
    const evidenceIds = Array.isArray(params.evidenceEventIds)
      ? params.evidenceEventIds.filter(Boolean)
      : [];
    if (params.layer !== 'RAW_EVENT_DIGEST' && evidenceIds.length === 0) {
      return null;
    }

    const embeddingVector =
      params.externalEmbedding && params.externalEmbedding.length > 0
        ? params.externalEmbedding
        : buildLocalDeterministicEmbedding(`${sanitized} ${(params.tags || []).join(' ')}`);

    const stored: StoredKnowledgeEntry = {
      entryId: this.nextId('know'),
      createdAtTs: Date.now(),
      streamId: params.streamId.toLowerCase(),
      layer: params.layer,
      summaryHe: sanitized,
      evidenceEventIds: evidenceIds,
      confidence: Math.max(0, Math.min(1, Number(params.confidence.toFixed(2)))),
      disagreementsNotedHe: params.disagreementsNotedHe || null,
      tags: params.tags || [],
      embeddingVector,
    };

    this.entries.unshift(stored);
    if (this.entries.length > 600) this.entries.length = 600;
    this.saveToDisk();

    const { embeddingVector: _vec, ...publicEntry } = stored;
    return publicEntry;
  }

  /**
   * Records a controlled pre/post empirical observation across streams WITHOUT claiming unproven causation.
   */
  public recordEmpiricalTrial(params: {
    patternKey: string;
    subjectLabelHe: string;
    kind: 'PARTICIPANT_INTERACTION_CHAT' | 'EFFECT_EXECUTION_TRIAL' | 'MOD_PROMPT_TRIAL';
    streamId: string;
    beforeMetric: number;
    afterMetric: number;
    evidenceEventIds: string[];
  }): CrossStreamEmpiricalObservation {
    const deltaPct =
      params.beforeMetric > 0
        ? Number((((params.afterMetric - params.beforeMetric) / params.beforeMetric) * 100).toFixed(1))
        : params.afterMetric > 0
          ? 100
          : 0;
    const positiveShift = params.afterMetric > params.beforeMetric;

    let obs = this.crossStreamObservations.find((o) => o.patternKey === params.patternKey);
    if (!obs) {
      obs = {
        patternKey: params.patternKey,
        statementHe: '',
        distinctStreamsObserved: [params.streamId.toLowerCase()],
        totalTrialsCount: 1,
        positiveShiftTrialsCount: positiveShift ? 1 : 0,
        avgMetricDeltaPct: deltaPct,
        causalCautionNoteHe:
          'תצפית אמפירית מתאמית בלבד — אין להסיק אוטומטית סיבתיות ישירה ללא ניסוי השוואה מבוקר (A/B) לאורך זמן.',
        evidenceEventIds: params.evidenceEventIds.slice(0, 8),
        lastUpdatedTs: Date.now(),
      };
      this.crossStreamObservations.unshift(obs);
    } else {
      if (!obs.distinctStreamsObserved.includes(params.streamId.toLowerCase())) {
        obs.distinctStreamsObserved.push(params.streamId.toLowerCase());
      }
      obs.avgMetricDeltaPct = Number(
        (
          (obs.avgMetricDeltaPct * obs.totalTrialsCount + deltaPct) /
          (obs.totalTrialsCount + 1)
        ).toFixed(1)
      );
      obs.totalTrialsCount += 1;
      if (positiveShift) obs.positiveShiftTrialsCount += 1;
      for (const id of params.evidenceEventIds) {
        if (!obs.evidenceEventIds.includes(id)) {
          obs.evidenceEventIds.unshift(id);
        }
      }
      obs.evidenceEventIds = obs.evidenceEventIds.slice(0, 12);
      obs.lastUpdatedTs = Date.now();
    }

    if (params.kind === 'EFFECT_EXECUTION_TRIAL') {
      obs.statementHe = `האפקט "${params.subjectLabelHe}" הופעל ${obs.totalTrialsCount} פעמים (ב-${obs.distinctStreamsObserved.length} שידורים), וב-${obs.positiveShiftTrialsCount} מהן נצפתה עלייה בפעילות ב-12 השניות שלאחר ההפעלה (שינוי ממוצע: ${
        obs.avgMetricDeltaPct >= 0 ? '+' : ''
      }${obs.avgMetricDeltaPct}%).`;
    } else if (params.kind === 'PARTICIPANT_INTERACTION_CHAT') {
      obs.statementHe = `ב-${obs.distinctStreamsObserved.length} שידורים שונים (${obs.totalTrialsCount} דגימות) נצפה שינוי בקצב הצ׳אט לאחר ${params.subjectLabelHe} (${obs.positiveShiftTrialsCount}/${obs.totalTrialsCount} מקרים בעלייה).`;
    } else {
      obs.statementHe = `דפוס ניהול הצ׳אט "${params.subjectLabelHe}" נבדק ${obs.totalTrialsCount} פעמים ב-${obs.distinctStreamsObserved.length} שידורים, וב-${obs.positiveShiftTrialsCount} מהן נצפתה עלייה בתגובות הצופים.`;
    }

    this.saveToDisk();
    return obs;
  }

  public semanticSearch(
    query: string,
    options?: { queryEmbedding?: number[] | null; topK?: number; layerFilter?: KnowledgeRecordLayer }
  ): SemanticSearchHit[] {
    const cleanQ = String(query || '').trim();
    if (!cleanQ) return [];
    const topK = options?.topK ?? 8;
    const localQueryVec = buildLocalDeterministicEmbedding(cleanQ);
    const qLower = cleanQ.toLowerCase();

    const scored: SemanticSearchHit[] = [];
    for (const item of this.entries) {
      if (options?.layerFilter && item.layer !== options.layerFilter) continue;

      let sim = 0;
      if (options?.queryEmbedding && item.embeddingVector.length === options.queryEmbedding.length) {
        sim = cosineSimilarity(options.queryEmbedding, item.embeddingVector);
      } else {
        const localItemVec =
          item.embeddingVector.length === LOCAL_VECTOR_DIM
            ? item.embeddingVector
            : buildLocalDeterministicEmbedding(`${item.summaryHe} ${item.tags.join(' ')}`);
        sim = cosineSimilarity(localQueryVec, localItemVec);
      }

      // Lexical overlap boost for exact Hebrew/English terms
      if (item.summaryHe.toLowerCase().includes(qLower)) {
        sim = Math.min(1, sim + 0.35);
      }

      if (sim > 0.05) {
        scored.push({
          entryId: item.entryId,
          streamId: item.streamId,
          layer: item.layer,
          summaryHe: item.summaryHe,
          similarityScore: Number(sim.toFixed(3)),
          createdAtTs: item.createdAtTs,
          evidenceEventIds: item.evidenceEventIds,
        });
      }
    }

    scored.sort((a, b) => b.similarityScore - a.similarityScore);
    return scored.slice(0, topK);
  }

  public getSnapshot(): KnowledgeEngineSnapshot {
    return {
      totalEntries: this.entries.length,
      verifiedFactsCount: this.entries.filter((e) => e.layer === 'VERIFIED_FACT').length,
      hypothesesCount: this.entries.filter((e) => e.layer === 'HYPOTHESIS').length,
      aiConclusionsCount: this.entries.filter((e) => e.layer === 'AI_CONCLUSION').length,
      retentionDays: this.retentionDays,
      recentEntries: this.entries.slice(0, 25).map(({ embeddingVector: _v, ...rest }) => rest),
      crossStreamObservations: this.crossStreamObservations.slice(0, 20),
    };
  }
}
