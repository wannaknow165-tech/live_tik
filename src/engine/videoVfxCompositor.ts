import {
  ActiveEffectInstance,
  BOOSTERA_ASSETS,
  CustomUserVideoVfx,
  VfxLayer,
} from '../data/boosteraCatalog';

export interface VideoVfxDescriptor {
  id: string;
  titleHe: string;
  videoSrc: string;
  layer: VfxLayer;
  framingMode: 'SPLIT_EDGES_9X16' | 'IMPACT_LOWER_BACK' | 'UPPER_CREST_BACK';
  cropBottomPct: number;
  fadeTailSec: number;
  trimStartSec: number;
  maskBottomFeatherPct: number;
  playEmbeddedAudio: boolean;
  durationSec: number;
  compositingMode: 'CHROMA_GREEN' | 'SCREEN_BLACK';
}

interface ActivePlaybackEntry {
  video: HTMLVideoElement;
  boundInstanceId: string | null;
  ready: boolean;
}

class BoosteraVideoVfxCompositor {
  private descriptors = new Map<string, VideoVfxDescriptor>();
  private customVideos: CustomUserVideoVfx[] = [];
  private boundSlotUrls = new Map<string, string>();
  private players = new Map<string, ActivePlaybackEntry>();
  private workCanvas: HTMLCanvasElement | null = null;
  private workCtx: CanvasRenderingContext2D | null = null;
  private readonly WORK_W = 320;
  private readonly WORK_H = 320;

  constructor() {
    for (const asset of BOOSTERA_ASSETS) {
      if (asset.videoSrc) {
        this.descriptors.set(asset.id, {
          id: asset.id,
          titleHe: asset.titleHe,
          videoSrc: asset.videoSrc,
          layer: asset.layer,
          framingMode: asset.videoFramingMode || 'SPLIT_EDGES_9X16',
          cropBottomPct: asset.cropBottomPct ?? 5,
          fadeTailSec: asset.fadeTailSec ?? 0.8,
          trimStartSec: asset.trimStartSec ?? 0,
          maskBottomFeatherPct: asset.maskBottomFeatherPct ?? 0,
          playEmbeddedAudio: Boolean(asset.playEmbeddedAudio),
          durationSec: asset.durationSec,
          compositingMode:
            asset.compositingMethod === 'SCREEN_ADDITIVE_BLACK' ? 'SCREEN_BLACK' : 'CHROMA_GREEN',
        });
      }
    }
  }

  /**
   * Binds a local green-screen MP4 file directly to a pre-calibrated catalog slot
   * (e.g. BEAST_08_VIOLET_PHOENIX, BEAST_09_SOLAR_TIGER, BEAST_10_ROYAL_FIRE_LION)
   * applying its exact green-screen vignette normalization, pixel-streak bottom feather mask,
   * trimStartSec, and embedded roar audio!
   */
  public bindVideoFileToCatalogSlot(
    effectId: string,
    videoUrl: string,
    overrides?: {
      trimStartSec?: number;
      maskBottomFeatherPct?: number;
      playEmbeddedAudio?: boolean;
    }
  ): boolean {
    const asset = BOOSTERA_ASSETS.find((a) => a.id === effectId);
    if (!asset) return false;

    const existingPlayer = this.players.get(effectId);
    if (existingPlayer) {
      existingPlayer.video.pause();
      this.players.delete(effectId);
    }

    this.boundSlotUrls.set(effectId, videoUrl);
    this.descriptors.set(effectId, {
      id: asset.id,
      titleHe: asset.titleHe,
      videoSrc: videoUrl,
      layer: asset.layer,
      framingMode: asset.videoFramingMode || 'UPPER_CREST_BACK',
      cropBottomPct: asset.cropBottomPct ?? 6,
      fadeTailSec: asset.fadeTailSec ?? 0.75,
      trimStartSec: overrides?.trimStartSec ?? asset.trimStartSec ?? 0,
      maskBottomFeatherPct: overrides?.maskBottomFeatherPct ?? asset.maskBottomFeatherPct ?? 0,
      playEmbeddedAudio: overrides?.playEmbeddedAudio ?? Boolean(asset.playEmbeddedAudio),
      durationSec: asset.durationSec,
      compositingMode:
        asset.compositingMethod === 'SCREEN_ADDITIVE_BLACK' ? 'SCREEN_BLACK' : 'CHROMA_GREEN',
    });
    return true;
  }

  public getBoundSlotUrl(effectId: string): string | undefined {
    return this.boundSlotUrls.get(effectId);
  }

  public registerCustomVideo(
    clip: CustomUserVideoVfx,
    compositingMode: 'CHROMA_GREEN' | 'SCREEN_BLACK' = 'CHROMA_GREEN'
  ) {
    const existingIdx = this.customVideos.findIndex((v) => v.id === clip.id);
    if (existingIdx >= 0) {
      this.customVideos[existingIdx] = clip;
    } else {
      this.customVideos.unshift(clip);
    }

    const existingPlayer = this.players.get(clip.id);
    if (existingPlayer) {
      existingPlayer.video.pause();
      this.players.delete(clip.id);
    }

    this.descriptors.set(clip.id, {
      id: clip.id,
      titleHe: clip.titleHe,
      videoSrc: clip.videoUrl,
      layer: clip.layer,
      framingMode: clip.framingMode,
      cropBottomPct: clip.cropBottomPct,
      fadeTailSec: 0.75,
      trimStartSec: clip.trimStartSec ?? 0,
      maskBottomFeatherPct: clip.maskBottomFeatherPct ?? 0,
      playEmbeddedAudio: Boolean(clip.playEmbeddedAudio),
      durationSec: clip.durationSec,
      compositingMode,
    });
  }

  public getCustomVideos(): CustomUserVideoVfx[] {
    return this.customVideos;
  }

  public isVideoEffect(effectId: string): boolean {
    return this.descriptors.has(effectId);
  }

  public isPlayingEmbeddedAudio(effectId: string): boolean {
    const d = this.descriptors.get(effectId);
    return Boolean(d && d.playEmbeddedAudio);
  }

  public getDescriptor(effectId: string): VideoVfxDescriptor | undefined {
    return this.descriptors.get(effectId);
  }

  private ensureWorkSurface(): CanvasRenderingContext2D | null {
    if (typeof document === 'undefined') return null;
    if (!this.workCanvas) {
      this.workCanvas = document.createElement('canvas');
      this.workCanvas.width = this.WORK_W;
      this.workCanvas.height = this.WORK_H;
      this.workCtx = this.workCanvas.getContext('2d', { willReadFrequently: true });
    }
    return this.workCtx;
  }

  private getOrCreatePlayer(desc: VideoVfxDescriptor): ActivePlaybackEntry | null {
    if (typeof document === 'undefined') return null;
    let entry = this.players.get(desc.id);
    if (!entry) {
      const vid = document.createElement('video');
      vid.src = desc.videoSrc;
      vid.muted = !desc.playEmbeddedAudio;
      vid.volume = desc.playEmbeddedAudio ? 0.82 : 0;
      vid.playsInline = true;
      vid.preload = 'auto';
      if (!desc.videoSrc.startsWith('blob:')) {
        vid.crossOrigin = 'anonymous';
      }
      const created: ActivePlaybackEntry = {
        video: vid,
        boundInstanceId: null,
        ready: false,
      };
      vid.onloadeddata = () => {
        created.ready = true;
      };
      vid.load();
      this.players.set(desc.id, created);
      entry = created;
    } else {
      entry.video.muted = !desc.playEmbeddedAudio;
      entry.video.volume = desc.playEmbeddedAudio ? 0.82 : 0;
    }
    return entry;
  }

  /**
   * Broadcast-Grade Chroma & Artifact Keyer:
   * 1. Removes pure #00FF00 AND dark-vignetted green corners (#063B06 in Phoenix) + compression blocks (Tiger/Lion)
   *    using dual absolute + ratio-normalized green dominance!
   * 2. Suppresses green spill on grey/violet smoke clouds and fiery golden edges.
   * 3. Crops bottom nozzle hardware (`cropBottomPct`) AND applies smooth vertical alpha feathering
   *    (`maskBottomFeatherPct`) to erase lower pixel-stretch glitches (00:03–00:08 in Tiger & Lion)!
   */
  public keyFrameIntoWorkCanvas(
    video: HTMLVideoElement,
    compositingMode: 'CHROMA_GREEN' | 'SCREEN_BLACK',
    cropBottomPct: number,
    maskBottomFeatherPct = 0
  ): HTMLCanvasElement | null {
    const wCtx = this.ensureWorkSurface();
    if (!wCtx || !this.workCanvas || video.readyState < 2) return null;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const safeCropPct = Math.max(0, Math.min(22, cropBottomPct));
    const srcH = Math.max(16, Math.floor(vh * (1 - safeCropPct / 100)));

    wCtx.clearRect(0, 0, this.WORK_W, this.WORK_H);
    wCtx.drawImage(video, 0, 0, vw, srcH, 0, 0, this.WORK_W, this.WORK_H);

    const frame = wCtx.getImageData(0, 0, this.WORK_W, this.WORK_H);
    const d = frame.data;
    const totalW = this.WORK_W;
    const totalH = this.WORK_H;
    const clampedFeatherPct = Math.max(0, Math.min(55, maskBottomFeatherPct));
    const featherStartRow =
      clampedFeatherPct > 0 ? Math.floor(totalH * (1 - clampedFeatherPct / 100)) : totalH;
    const featherSpan = Math.max(1, totalH - featherStartRow);

    if (compositingMode === 'CHROMA_GREEN') {
      for (let y = 0; y < totalH; y++) {
        let rowMask = 1;
        if (y >= featherStartRow) {
          // Smoothly fades lower region to 0 alpha (completely hides vertical pixel-smear columns!)
          const t = (y - featherStartRow) / featherSpan;
          const inv = Math.max(0, 1 - t * 1.18);
          rowMask = inv * inv;
        }

        const rowOffset = y * totalW * 4;
        if (rowMask <= 0.004) {
          for (let x = 0; x < totalW; x++) {
            d[rowOffset + x * 4 + 3] = 0;
          }
          continue;
        }

        for (let x = 0; x < totalW; x++) {
          const i = rowOffset + x * 4;
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const maxRB = r > b ? r : b;
          const greenExcess = g - maxRB;

          // Vignette-proof green detection: catches bright #00FF00 AND dark corner #063B06 green!
          const isBrightGreenBg = g > 64 && greenExcess > 40;
          const isDarkVignetteGreenBg = g >= 18 && greenExcess >= 14 && g > maxRB * 1.48;

          if (isBrightGreenBg || isDarkVignetteGreenBg) {
            d[i + 3] = 0;
          } else if (greenExcess > 6) {
            const rampSpan = g < 65 ? 16 : 34;
            const alphaFactor = Math.max(0, Math.min(1, 1 - (greenExcess - 6) / rampSpan));
            d[i + 3] = Math.round(d[i + 3] * alphaFactor * rowMask);
            const minRB = r < b ? r : b;
            d[i + 1] = Math.round(maxRB * 0.88 + minRB * 0.12);
          } else if (rowMask < 0.999) {
            d[i + 3] = Math.round(d[i + 3] * rowMask);
          }
        }
      }
    } else {
      for (let y = 0; y < totalH; y++) {
        let rowMask = 1;
        if (y >= featherStartRow) {
          const t = (y - featherStartRow) / featherSpan;
          rowMask = Math.max(0, 1 - t);
        }
        const rowOffset = y * totalW * 4;
        for (let x = 0; x < totalW; x++) {
          const i = rowOffset + x * 4;
          const lum = Math.max(d[i], d[i + 1], d[i + 2]);
          d[i + 3] = lum < 14 ? 0 : Math.min(255, Math.round((lum - 14) * 1.15 * rowMask));
        }
      }
    }

    wCtx.putImageData(frame, 0, 0);
    return this.workCanvas;
  }

  /**
   * Projects a keyed plate intelligently onto a 9:16 broadcast stage
   * while protecting the presenter's face readability!
   */
  public projectKeyedSurfaceTo9x16(
    destCtx: CanvasRenderingContext2D,
    destW: number,
    destH: number,
    keyedCanvas: HTMLCanvasElement,
    framingMode: 'SPLIT_EDGES_9X16' | 'IMPACT_LOWER_BACK' | 'UPPER_CREST_BACK',
    envelopeAlpha = 1
  ) {
    if (envelopeAlpha <= 0.01) return;
    destCtx.save();
    destCtx.globalAlpha = Math.max(0, Math.min(1, envelopeAlpha));

    const sw = keyedCanvas.width;
    const sh = keyedCanvas.height;

    if (framingMode === 'SPLIT_EDGES_9X16') {
      const sliceSrcW = Math.floor(sw * 0.38);
      const corridorDestW = Math.floor(destW * 0.31);

      destCtx.drawImage(keyedCanvas, 0, 0, sliceSrcW, sh, 0, 0, corridorDestW, destH);
      destCtx.drawImage(
        keyedCanvas,
        sw - sliceSrcW,
        0,
        sliceSrcW,
        sh,
        destW - corridorDestW,
        0,
        corridorDestW,
        destH
      );
    } else if (framingMode === 'UPPER_CREST_BACK') {
      // Majestic Upper-Back Crest behind presenter's head & shoulders (Phoenix wings, Solar Tiger, Royal Lion!)
      const crestW = Math.floor(destW * 1.06);
      const crestH = Math.floor(destH * 0.56);
      const crestX = Math.floor((destW - crestW) * 0.5);
      const crestY = Math.floor(destH * 0.02);
      destCtx.drawImage(keyedCanvas, 0, 0, sw, sh, crestX, crestY, crestW, crestH);
    } else {
      // IMPACT_LOWER_BACK
      const targetH = Math.floor(destH * 0.56);
      const targetY = Math.floor(destH * 0.4);
      destCtx.drawImage(keyedCanvas, 0, 0, sw, sh, -destW * 0.08, targetY, destW * 1.16, targetH);
    }

    destCtx.restore();
  }

  public renderActiveVideoLayer(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    targetLayer: 'BACK' | 'FRONT',
    activeEffects: ActiveEffectInstance[]
  ) {
    const nowEpoch = Date.now();
    const activeIds = new Set<string>();

    for (const inst of activeEffects) {
      const desc = this.descriptors.get(inst.effectId);
      if (!desc) continue;

      const matchesLayer =
        desc.layer === targetLayer || (desc.layer === 'HYBRID' && targetLayer === 'FRONT');
      if (!matchesLayer) continue;

      const elapsedMs = nowEpoch - inst.triggeredAt;
      if (elapsedMs < 0 || elapsedMs > inst.durationMs) continue;

      activeIds.add(desc.id);
      const player = this.getOrCreatePlayer(desc);
      if (!player) continue;

      const elapsedSec = elapsedMs / 1000;
      const targetMediaTime = desc.trimStartSec + elapsedSec;
      const mediaCap = Math.max(0.2, (player.video.duration || desc.durationSec + desc.trimStartSec) - 0.08);

      if (player.boundInstanceId !== inst.instanceId) {
        player.boundInstanceId = inst.instanceId;
        try {
          player.video.currentTime = Math.min(Math.max(0, targetMediaTime), mediaCap);
        } catch {
          // Metadata still loading
        }
        player.video.play().catch(() => {
          // If browser blocks unmuted autoplay, fallback to muted playback seamlessly
          player.video.muted = true;
          player.video.play().catch(() => {});
        });
      } else if (player.video.paused && targetMediaTime < mediaCap - 0.1) {
        player.video.play().catch(() => {});
      }

      const keyed = this.keyFrameIntoWorkCanvas(
        player.video,
        desc.compositingMode,
        desc.cropBottomPct,
        desc.maskBottomFeatherPct
      );
      if (!keyed) continue;

      const totalSec = inst.durationMs / 1000;
      const entryFade = Math.min(1, elapsedSec / 0.2);
      const remainingSec = Math.max(0, totalSec - elapsedSec);
      const tailFade = desc.fadeTailSec > 0 ? Math.min(1, remainingSec / desc.fadeTailSec) : 1;
      const alpha = entryFade * tailFade * Math.min(1.15, inst.intensity || 1);

      this.projectKeyedSurfaceTo9x16(ctx, W, H, keyed, desc.framingMode, alpha);
    }

    for (const [id, player] of this.players.entries()) {
      if (!activeIds.has(id) && !player.video.paused) {
        const stillInAnyLayer = activeEffects.some(
          (fx) => fx.effectId === id && nowEpoch - fx.triggeredAt < fx.durationMs
        );
        if (!stillInAnyLayer) {
          player.video.pause();
          player.boundInstanceId = null;
        }
      }
    }
  }
}

export const videoVfxCompositor = new BoosteraVideoVfxCompositor();
