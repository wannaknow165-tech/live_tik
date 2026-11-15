import { MouseEvent, useEffect, useRef, useState } from 'react';
import { Crown, Eye, Flame, Sparkles } from 'lucide-react';
import {
  BattleState,
  PresenterGestureId,
  StageAvatarSpotlight,
  StageSupporterAvatar,
} from '../data/boosteraCatalog';
import { BoosteraVfxEngine } from '../engine/vfxRenderer';
import { videoVfxCompositor } from '../engine/videoVfxCompositor';
import { soundEngine } from '../engine/soundEngine';

const PRESENTER_PORTRAIT_URL = '/src/assets/images/presenter_studio_portrait_1794720719224.jpg';
const STUDIO_BACKDROP_URL = '/src/assets/images/studio_backdrop_plate_1794720718630.jpg';

export interface StagePerfMetrics {
  fps: number;
  frameTimeMs: number;
}

interface TapRipple {
  x: number;
  y: number;
  bornAt: number;
  comboLabel: string;
}

interface BroadcastStageProps {
  battleState: BattleState;
  obsMode?: boolean;
  obsLayer?: 'back' | 'front' | 'composite';
  showSafeZone?: boolean;
  showLayerFilter?: 'both' | 'back_only' | 'front_only';
  useLiveWebcam?: boolean;
  onWebcamError?: (msg: string) => void;
  onPerfSample?: (metrics: StagePerfMetrics) => void;
  onStageTap?: () => void;
  onGestureDetected?: (gesture: PresenterGestureId) => void;
}

function formatCompactPoints(pts: number): string {
  if (pts >= 1_000_000) return `${(pts / 1_000_000).toFixed(1)}M`;
  if (pts >= 1_000) return `${(pts / 1_000).toFixed(1)}K`;
  return String(Math.round(pts));
}

function AvatarCircle({
  avatarUrl,
  label,
  sizeClass,
  ringClass,
}: {
  avatarUrl?: string;
  label: string;
  sizeClass: string;
  ringClass: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials =
    (label || 'VIP')
      .replace(/^@/, '')
      .trim()
      .slice(0, 2)
      .toUpperCase() || 'VP';

  if (!avatarUrl || imgFailed) {
    return (
      <div
        className={`${sizeClass} ${ringClass} rounded-full bg-gradient-to-br from-[#1C2538] to-[#090D16] flex items-center justify-center font-mono font-bold text-[10px] text-amber-300 shrink-0 select-none`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={label}
      referrerPolicy="no-referrer"
      onError={() => setImgFailed(true)}
      className={`${sizeClass} ${ringClass} rounded-full object-cover bg-[#0B0E14] shrink-0 select-none`}
    />
  );
}

function StageBroadcastHudOverlays({ battleState }: { battleState: BattleState }) {
  const cloud = battleState.cloudRadar;
  const showCloudXray = Boolean(cloud?.active);
  const showAvatars = Boolean(battleState.avatarsOverlayEnabled);
  const top3: StageSupporterAvatar[] = showAvatars ? (battleState.topSupporters || []).slice(0, 3) : [];
  const spotlights: StageAvatarSpotlight[] = showAvatars ? (battleState.avatarSpotlights || []).slice(0, 2) : [];

  const leftSpot = spotlights.find((s) => s.side === 'LEFT') || spotlights[0] || null;
  const rightSpot =
    spotlights.find((s) => s.side === 'RIGHT' && s.id !== leftSpot?.id) ||
    (spotlights.length > 1 && spotlights[1].id !== leftSpot?.id ? spotlights[1] : null);

  return (
    <div className="absolute inset-0 z-45 pointer-events-none select-none overflow-hidden" dir="rtl">
      {/* 1. ANTI-CLOUD LIVE SCORE X-RAY OVERLAY (Triggered when Opponent uses Smoke/Mist Card!) */}
      {showCloudXray && (
        <div className="absolute top-2 inset-x-2 bg-[#060A13]/92 border border-cyan-400/80 rounded-lg px-2.5 py-1.5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between gap-1.5 text-[10px] pb-1 border-b border-cyan-500/25">
            <div className="flex items-center gap-1 text-cyan-300 font-bold truncate">
              <Eye className="w-3 h-3 text-cyan-400 shrink-0 animate-pulse" />
              <span className="truncate">
                שובר-ענן חי {cloud.opponentUsername ? `(דרך @${cloud.opponentUsername})` : '(שיקוף חדר יריב)'}
              </span>
            </div>
            <span className="font-mono tabular-nums text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-400/40 rounded px-1.5 py-0.2 shrink-0">
              ענן {Math.ceil(cloud.remainingSec)}s
            </span>
          </div>

          <div className="grid grid-cols-3 items-center text-center pt-1 gap-1 tabular-nums">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
              <div className="text-[9px] text-amber-200/80 leading-tight">הסקור שלי</div>
              <div className="text-xs sm:text-sm font-mono font-extrabold text-amber-300 leading-tight">
                {cloud.myTrueScore.toLocaleString()}
              </div>
            </div>

            <div className="px-1">
              <div className="text-[9px] text-slate-400 leading-tight">
                {cloud.opponentRoomConnected ? 'חי מחדר יריב' : 'פער אמיתי'}
              </div>
              <div
                className={`text-xs font-mono font-extrabold leading-tight ${
                  cloud.scoreDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {cloud.scoreDiff >= 0
                  ? `+${cloud.scoreDiff.toLocaleString()}`
                  : cloud.scoreDiff.toLocaleString()}
              </div>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/30 rounded px-1.5 py-0.5">
              <div className="text-[9px] text-rose-200/80 leading-tight">סקור יריב</div>
              <div className="text-xs sm:text-sm font-mono font-extrabold text-rose-300 leading-tight">
                {cloud.opponentTrueScore.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. TOP SAFE-ZONE SUPPORTER AVATAR PODIUM (#1 MVP CROWN, #2, #3 — Strictly Above Presenter Head) */}
      {top3.length > 0 && (
        <div
          className={`absolute inset-x-2 flex items-center justify-center gap-1.5 transition-all duration-300 ${
            showCloudXray ? 'top-[76px]' : 'top-2.5'
          }`}
        >
          {top3.map((sup, idx) => {
            const isMvp = idx === 0;
            const ringStyle = isMvp
              ? 'ring-2 ring-amber-400 shadow-md'
              : idx === 1
                ? 'ring-2 ring-sky-400/90'
                : 'ring-2 ring-fuchsia-400/85';
            const pillBorder = isMvp
              ? 'bg-[#090D16]/90 border-amber-400/65'
              : idx === 1
                ? 'bg-[#090D16]/85 border-sky-400/45'
                : 'bg-[#090D16]/85 border-fuchsia-400/40';

            return (
              <div
                key={sup.userId || sup.username}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full border backdrop-blur-sm max-w-[33%] ${pillBorder}`}
              >
                <div className="relative shrink-0">
                  <AvatarCircle
                    avatarUrl={sup.avatarUrl}
                    label={sup.displayName || sup.username}
                    sizeClass={isMvp ? 'w-7 h-7' : 'w-6 h-6'}
                    ringClass={ringStyle}
                  />
                  <span
                    className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-extrabold ${
                      isMvp
                        ? 'bg-amber-400 text-slate-950'
                        : idx === 1
                          ? 'bg-sky-400 text-slate-950'
                          : 'bg-fuchsia-400 text-slate-950'
                    }`}
                  >
                    {isMvp ? <Crown className="w-2.5 h-2.5" /> : idx + 1}
                  </span>
                </div>

                <div className="min-w-0 leading-tight">
                  <div className="text-[10px] font-bold text-slate-100 truncate">
                    {sup.displayName || sup.username}
                  </div>
                  <div className="text-[9px] font-mono tabular-nums text-amber-300 font-semibold">
                    {formatCompactPoints(sup.points)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. OUTER-RAIL PARTICIPANT AVATAR SPOTLIGHTS (Strictly on Outer Edges — Presenter Face 100% Clear!) */}
      {leftSpot && (
        <div className="absolute left-2 bottom-12 max-w-[44%] bg-[#080C15]/90 border border-amber-400/65 rounded-xl p-1.5 backdrop-blur-sm shadow-lg flex items-center gap-2">
          <AvatarCircle
            avatarUrl={leftSpot.avatarUrl}
            label={leftSpot.displayName || leftSpot.username}
            sizeClass="w-8 h-8"
            ringClass={
              leftSpot.kind === 'WHALE_GIFT'
                ? 'ring-2 ring-amber-400'
                : leftSpot.kind === 'SHARE'
                  ? 'ring-2 ring-sky-400'
                  : 'ring-2 ring-emerald-400'
            }
          />
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1">
              <Flame className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              <span className="text-[9px] font-mono font-extrabold text-amber-300 truncate">
                {leftSpot.badgeHe}
              </span>
            </div>
            <div className="text-[10px] font-bold text-slate-100 truncate">
              {leftSpot.displayName || leftSpot.username}
            </div>
            <div className="text-[9px] text-slate-300 truncate">{leftSpot.detailHe}</div>
          </div>
        </div>
      )}

      {rightSpot && (
        <div className="absolute right-2 bottom-24 max-w-[44%] bg-[#080C15]/90 border border-sky-400/60 rounded-xl p-1.5 backdrop-blur-sm shadow-lg flex items-center gap-2">
          <AvatarCircle
            avatarUrl={rightSpot.avatarUrl}
            label={rightSpot.displayName || rightSpot.username}
            sizeClass="w-8 h-8"
            ringClass={
              rightSpot.kind === 'WHALE_GIFT'
                ? 'ring-2 ring-amber-400'
                : rightSpot.kind === 'FOLLOW'
                  ? 'ring-2 ring-fuchsia-400'
                  : 'ring-2 ring-sky-400'
            }
          />
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-sky-400 shrink-0" />
              <span className="text-[9px] font-mono font-extrabold text-sky-300 truncate">
                {rightSpot.badgeHe}
              </span>
            </div>
            <div className="text-[10px] font-bold text-slate-100 truncate">
              {rightSpot.displayName || rightSpot.username}
            </div>
            <div className="text-[9px] text-slate-300 truncate">{rightSpot.detailHe}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function BroadcastStage9x16({
  battleState,
  obsMode = false,
  obsLayer = 'composite',
  showSafeZone = false,
  showLayerFilter = 'both',
  useLiveWebcam = false,
  onWebcamError,
  onPerfSample,
  onStageTap,
  onGestureDetected,
}: BroadcastStageProps) {
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<BoosteraVfxEngine | null>(null);
  const stateRef = useRef<BattleState>(battleState);
  const ripplesRef = useRef<TapRipple[]>([]);

  const [backdropFailed, setBackdropFailed] = useState(false);
  const [presenterFailed, setPresenterFailed] = useState(false);

  stateRef.current = battleState;

  // Live camera feed + real-time computer-vision gesture motion detector
  useEffect(() => {
    if (!useLiveWebcam || obsMode) return;
    let stream: MediaStream | null = null;
    let gestureTimer: ReturnType<typeof setInterval> | null = null;
    let prevLuma: Float32Array | null = null;
    let lastGestureTs = 0;

    const visionCanvas = document.createElement('canvas');
    visionCanvas.width = 48;
    visionCanvas.height = 64;
    const visionCtx = visionCanvas.getContext('2d', { willReadFrequently: true });

    navigator.mediaDevices
      ?.getUserMedia({ video: { width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }

        // Sample spatial motion zones every 200ms to detect presenter gestures
        gestureTimer = setInterval(() => {
          const vid = videoRef.current;
          if (!vid || !visionCtx || vid.readyState < 2) return;
          const now = Date.now();
          if (now - lastGestureTs < 3600) return;

          visionCtx.drawImage(vid, 0, 0, 48, 64);
          const img = visionCtx.getImageData(0, 0, 48, 64).data;
          const curr = new Float32Array(48 * 64);

          let topMotion = 0;
          let sideMotion = 0;
          let centerMotion = 0;

          for (let y = 0; y < 64; y++) {
            for (let x = 0; x < 48; x++) {
              const idx = y * 48 + x;
              const p = idx * 4;
              const luma = (img[p] * 0.299 + img[p + 1] * 0.587 + img[p + 2] * 0.114) / 255;
              curr[idx] = luma;

              if (prevLuma) {
                const diff = Math.abs(luma - prevLuma[idx]);
                if (diff > 0.16) {
                  if (y < 18) topMotion += diff;
                  else if (x < 11 || x > 36) sideMotion += diff;
                  else if (x >= 15 && x <= 32 && y >= 20 && y <= 48) centerMotion += diff;
                }
              }
            }
          }
          prevLuma = curr;

          if (topMotion > 18 && onGestureDetected) {
            lastGestureTs = now;
            onGestureDetected('HANDS_UP_HYPE');
          } else if (sideMotion > 24 && onGestureDetected) {
            lastGestureTs = now;
            onGestureDetected('TAP_CALLOUT_WAVE');
          } else if (centerMotion > 34 && onGestureDetected) {
            lastGestureTs = now;
            onGestureDetected('LEAN_IN_CLOSE');
          }
        }, 200);
      })
      .catch(() => {
        if (onWebcamError) {
          onWebcamError('לא ניתן לגשת למצלמה בדפדפן — מוצגת דמות מגיש אולפן לבדיקה.');
        }
      });

    return () => {
      if (gestureTimer) clearInterval(gestureTimer);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [useLiveWebcam, obsMode, onWebcamError, onGestureDetected]);

  // 60fps Dual-Canvas Physics, AI Kinetic Camera Rig, Screen Shake & Tactile Tap Stimulus Loop
  useEffect(() => {
    const engine = new BoosteraVfxEngine();
    engineRef.current = engine;

    let rafId = 0;
    let frames = 0;
    let lastSampleTime = performance.now();
    let accumFrameMs = 0;

    const W = 540;
    const H = 960;

    if (backCanvasRef.current) {
      backCanvasRef.current.width = W;
      backCanvasRef.current.height = H;
    }
    if (frontCanvasRef.current) {
      frontCanvasRef.current.width = W;
      frontCanvasRef.current.height = H;
    }

    function computeCameraTransform(s: BattleState, nowMs: number) {
      if (s.cameraMode === 'LOCKED') {
        return { scale: 1, dx: 0, dy: 0, rotRad: 0, chromaticPx: 0, vignetteAlpha: 0 };
      }

      const hyperMult = s.cameraMode === 'HYPER_KINETIC' ? 1.35 : 1.0;
      let scale = 1.0 + Math.sin(nowMs * 0.0016) * 0.005 * hyperMult;
      let dx = 0;
      let dy = 0;
      let rotRad = 0;
      let chromaticPx = 0;
      let vignetteAlpha = 0;

      // Automatic Snipe Window Hitchcock tension push-in
      if (s.snipeWindowActive && s.streamMode === 'BATTLE') {
        const snipeProgress = Math.min(1, Math.max(0, (s.elapsedSec - 205) / 35));
        scale += snipeProgress * 0.065 * hyperMult;
        vignetteAlpha = Math.max(vignetteAlpha, snipeProgress * 0.28);
      }

      // Active AI / Manual Camera Kinetic Event
      const ev = s.activeCameraEvent;
      if (ev) {
        const age = Date.now() - ev.triggeredAt;
        if (age >= 0 && age <= ev.durationMs) {
          const p = age / ev.durationMs;
          const decay = 1 - p;
          const k = ev.intensity * hyperMult;

          if (ev.preset === 'ZOOM_PUNCH') {
            const punch = Math.sin(Math.min(1, p * 3.2) * Math.PI) * decay;
            scale += 0.085 * punch * k;
            chromaticPx = 3.5 * punch * k;
          } else if (ev.preset === 'EARTHQUAKE_SHAKE') {
            const amp = 14 * decay * decay * k;
            dx += Math.sin(nowMs * 0.068) * amp + Math.cos(nowMs * 0.11) * (amp * 0.45);
            dy += Math.cos(nowMs * 0.079) * amp * 0.85;
            rotRad += Math.sin(nowMs * 0.052) * 0.018 * decay * k;
            chromaticPx = 5.0 * decay * k;
          } else if (ev.preset === 'BASS_PUMP') {
            const beatPulse = Math.pow(Math.max(0, Math.sin(nowMs * 0.014)), 4);
            scale += 0.032 * beatPulse * k;
          } else if (ev.preset === 'DUTCH_WHIP') {
            rotRad += Math.sin(p * Math.PI * 2) * 0.035 * decay * k;
            scale += 0.04 * decay * k;
          } else if (ev.preset === 'SNIPE_CREEP') {
            scale += 0.075 * Math.sin(p * Math.PI) * k;
            vignetteAlpha = Math.max(vignetteAlpha, 0.32 * decay);
          } else if (ev.preset === 'VACUUM_DROP') {
            scale -= 0.025 * Math.sin(p * Math.PI);
            vignetteAlpha = Math.max(vignetteAlpha, 0.42 * Math.sin(p * Math.PI));
          }
        }
      }

      return { scale, dx, dy, rotRad, chromaticPx, vignetteAlpha };
    }

    function drawFrontKineticHudAndTapStimulus(
      ctx: CanvasRenderingContext2D,
      s: BattleState,
      cam: { chromaticPx: number; vignetteAlpha: number },
      nowPerf: number
    ) {
      const nowEpoch = Date.now();

      // 1. Focus / Vacuum Vignette on Outer Edges (never darkening central presenter face)
      if (cam.vignetteAlpha > 0.01) {
        const grad = ctx.createRadialGradient(W * 0.5, H * 0.5, W * 0.34, W * 0.5, H * 0.5, H * 0.62);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(4,6,12,${cam.vignetteAlpha.toFixed(3)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      // 2. Anamorphic Chromatic Edge Split Flash on Heavy Impacts
      if (cam.chromaticPx > 0.4) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = `rgba(245, 158, 11, ${Math.min(0.45, cam.chromaticPx * 0.08)})`;
        ctx.lineWidth = cam.chromaticPx * 1.6;
        ctx.strokeRect(cam.chromaticPx, cam.chromaticPx, W - cam.chromaticPx * 2, H - cam.chromaticPx * 2);
        ctx.strokeStyle = `rgba(56, 189, 248, ${Math.min(0.38, cam.chromaticPx * 0.07)})`;
        ctx.strokeRect(
          cam.chromaticPx * 2.2,
          cam.chromaticPx * 2.2,
          W - cam.chromaticPx * 4.4,
          H - cam.chromaticPx * 4.4
        );
        ctx.restore();
      }

      // 3. Tactile Finger-Tap Micro-Dopamine Stimulus (Outer 24% Edge Pacemaker Rings — keeps face clear!)
      const stimulusActive = s.tapStimulusActiveUntil > nowEpoch;
      if (stimulusActive || s.likeComboCount >= 15) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const phaseWave = (nowPerf * 0.0032) % 1;
        const leftAnchorX = W * 0.13;
        const rightAnchorX = W * 0.87;
        const anchorY = H * 0.64;

        [leftAnchorX, rightAnchorX].forEach((ax, sideIdx) => {
          for (let r = 0; r < 2; r++) {
            const p = (phaseWave + r * 0.5 + sideIdx * 0.15) % 1;
            const radius = 14 + p * 44;
            const alpha = (1 - p) * (stimulusActive ? 0.52 : 0.25);
            ctx.beginPath();
            ctx.arc(ax, anchorY, radius, 0, Math.PI * 2);
            ctx.strokeStyle =
              r === 0 ? `rgba(251, 191, 36, ${alpha.toFixed(3)})` : `rgba(56, 189, 248, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 2.2 * (1 - p * 0.5);
            ctx.stroke();
          }

          // Crisp tactile thumb-target core dot in safe outer margin
          const corePulse = 5 + Math.sin(nowPerf * 0.014) * 1.8;
          ctx.beginPath();
          ctx.arc(ax, anchorY, corePulse, 0, Math.PI * 2);
          ctx.fillStyle = stimulusActive ? 'rgba(253, 224, 71, 0.78)' : 'rgba(251, 191, 36, 0.42)';
          ctx.fill();
        });

        // Subtle kinetic Combo Streak Meter (shifted gracefully below top HUD if active)
        if (s.likeComboCount >= 10 || stimulusActive) {
          const hasHudAtTop =
            Boolean(s.cloudRadar?.active) ||
            (Boolean(s.avatarsOverlayEnabled) && (s.topSupporters?.length || 0) > 0);
          const barW = 190;
          const barX = (W - barW) / 2;
          const barY = hasHudAtTop ? (s.cloudRadar?.active ? 215 : 108) : 30;
          const fillPct = Math.min(1, s.likeComboCount / 150);

          ctx.fillStyle = 'rgba(8, 12, 20, 0.68)';
          ctx.beginPath();
          ctx.roundRect(barX, barY, barW, 8, 4);
          ctx.fill();

          const comboGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
          comboGrad.addColorStop(0, '#F59E0B');
          comboGrad.addColorStop(1, '#38BDF8');
          ctx.fillStyle = comboGrad;
          ctx.beginPath();
          ctx.roundRect(barX, barY, Math.max(14, barW * fillPct), 8, 4);
          ctx.fill();

          ctx.font = '700 13px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(254, 243, 199, 0.92)';
          const label =
            stimulusActive && s.tapCalloutTextHe
              ? `${s.tapCalloutTextHe} · x${s.comboMultiplier}`
              : `COMBO STREAK x${s.likeComboCount}`;
          ctx.fillText(label, W * 0.5, barY - 7);
        }
        ctx.restore();
      }

      // 4. Interactive Finger-Tap Dopamine Ripples (when user taps stage)
      ripplesRef.current = ripplesRef.current.filter((rp) => nowPerf - rp.bornAt < 680);
      if (ripplesRef.current.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (const rp of ripplesRef.current) {
          const p = (nowPerf - rp.bornAt) / 680;
          const radius = 10 + p * 78;
          const alpha = Math.pow(1 - p, 1.5) * 0.85;

          ctx.beginPath();
          ctx.arc(rp.x, rp.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(251, 191, 36, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 3 * (1 - p);
          ctx.stroke();

          ctx.font = '700 15px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(254, 249, 195, ${alpha.toFixed(3)})`;
          ctx.fillText(rp.comboLabel, rp.x, rp.y - 14 - p * 36);
        }
        ctx.restore();
      }
    }

    function tick(now: number) {
      const t0 = performance.now();
      const s = stateRef.current;

      const renderInput = {
        elapsedSec: s.elapsedSec,
        phase: s.phase,
        likeEnergy: s.likeEnergy,
        roundPalette: s.roundPalette,
        activeEffects: s.activeEffects,
        streamMode: s.streamMode,
        gloveRemainingSec: s.gloveRemainingSec,
      };

      engine.step(W, H, renderInput, now);
      const cam = computeCameraTransform(s, now);

      const renderBack =
        obsMode ? obsLayer === 'back' || obsLayer === 'composite' : showLayerFilter !== 'front_only';
      const renderFront =
        obsMode ? obsLayer === 'front' || obsLayer === 'composite' : showLayerFilter !== 'back_only';

      if (backCanvasRef.current) {
        const bCtx = backCanvasRef.current.getContext('2d', { alpha: true });
        if (bCtx) {
          bCtx.clearRect(0, 0, W, H);
          if (renderBack) {
            bCtx.save();
            bCtx.translate(W * 0.5 + cam.dx, H * 0.5 + cam.dy);
            bCtx.rotate(cam.rotRad);
            bCtx.scale(cam.scale, cam.scale);
            bCtx.translate(-W * 0.5, -H * 0.5);
            engine.renderLayer(bCtx, W, H, 'BACK', renderInput, 'transparent', now);
            videoVfxCompositor.renderActiveVideoLayer(bCtx, W, H, 'BACK', s.activeEffects);
            bCtx.restore();
          }
        }
      }

      if (frontCanvasRef.current) {
        const fCtx = frontCanvasRef.current.getContext('2d', { alpha: true });
        if (fCtx) {
          fCtx.clearRect(0, 0, W, H);
          if (renderFront) {
            fCtx.save();
            fCtx.translate(W * 0.5 + cam.dx, H * 0.5 + cam.dy);
            fCtx.rotate(cam.rotRad);
            fCtx.scale(cam.scale, cam.scale);
            fCtx.translate(-W * 0.5, -H * 0.5);
            engine.renderLayer(fCtx, W, H, 'FRONT', renderInput, 'transparent', now);
            videoVfxCompositor.renderActiveVideoLayer(fCtx, W, H, 'FRONT', s.activeEffects);
            fCtx.restore();

            drawFrontKineticHudAndTapStimulus(fCtx, s, cam, now);
          }
        }
      }

      const frameCost = performance.now() - t0;
      accumFrameMs += frameCost;
      frames += 1;

      if (now - lastSampleTime >= 750) {
        const fps = Math.min(60, Math.round((frames * 1000) / (now - lastSampleTime)));
        const avgMs = Number((accumFrameMs / Math.max(1, frames)).toFixed(2));
        if (onPerfSample) {
          onPerfSample({ fps, frameTimeMs: avgMs });
        }
        frames = 0;
        accumFrameMs = 0;
        lastSampleTime = now;
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [obsMode, obsLayer, showLayerFilter, onPerfSample]);

  const handleInteractiveStageTap = (e: MouseEvent<HTMLDivElement>) => {
    if (obsMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 540;
    const y = ((e.clientY - rect.top) / rect.height) * 960;

    soundEngine.ensureInitialized();
    soundEngine.triggerEffectSound('SND_TAP_DOPAMINE_PULSE', true);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch {
        // Ignore if unsupported
      }
    }

    const nextCombo = (battleState.likeComboCount || 0) + 5;
    ripplesRef.current.push({
      x,
      y,
      bornAt: performance.now(),
      comboLabel: `+TAP x${nextCombo}`,
    });

    if (onStageTap) {
      onStageTap();
    }
  };

  if (obsMode) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-transparent pointer-events-none select-none">
        <div className="relative h-screen aspect-[9/16] max-w-full bg-transparent overflow-hidden">
          {(obsLayer === 'back' || obsLayer === 'composite') && (
            <canvas ref={backCanvasRef} className="absolute inset-0 w-full h-full z-10" />
          )}
          {(obsLayer === 'front' || obsLayer === 'composite') && (
            <>
              <canvas ref={frontCanvasRef} className="absolute inset-0 w-full h-full z-30" />
              <StageBroadcastHudOverlays battleState={battleState} />
            </>
          )}
        </div>
      </div>
    );
  }

  // Discrete Tailwind camera rig classes for preview presenter & studio plate
  const camActive =
    battleState.activeCameraEvent &&
    Date.now() - battleState.activeCameraEvent.triggeredAt < battleState.activeCameraEvent.durationMs
      ? battleState.activeCameraEvent.preset
      : null;

  const presenterKineticClass =
    camActive === 'ZOOM_PUNCH'
      ? 'scale-105 transition-transform duration-150'
      : camActive === 'DUTCH_WHIP'
        ? 'scale-105 rotate-1 transition-transform duration-150'
        : camActive === 'EARTHQUAKE_SHAKE'
          ? 'scale-105 -rotate-1 transition-transform duration-75'
          : camActive === 'SNIPE_CREEP' || battleState.snipeWindowActive
            ? 'scale-105 transition-transform duration-700'
            : 'scale-100 transition-transform duration-300';

  return (
    <div
      onClick={handleInteractiveStageTap}
      title="לחץ על המסך לבדיקת גירוי אצבע (Tap-Tap Dopamine) ורצף לייקים חי!"
      className="relative w-full max-w-[360px] mx-auto aspect-[9/16] rounded-xl overflow-hidden border border-[#1E2636] bg-[#07090E] select-none cursor-pointer"
    >
      {/* Z-10: Permanent Dark Studio Wall Backdrop */}
      {!backdropFailed ? (
        <img
          src={STUDIO_BACKDROP_URL}
          alt="רקע קיר אולפן שידור כהה"
          referrerPolicy="no-referrer"
          onError={() => setBackdropFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover opacity-55 z-10 ${presenterKineticClass}`}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F141F] via-[#090C12] to-[#05070B] z-10" />
      )}

      {/* Z-20: BACKGROUND FX LAYER */}
      <canvas ref={backCanvasRef} className="absolute inset-0 w-full h-full z-20 pointer-events-none" />

      {/* Z-30: Presenter Layer */}
      <div className={`absolute inset-0 z-30 pointer-events-none flex items-end justify-center ${presenterKineticClass}`}>
        {useLiveWebcam ? (
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full h-full object-cover [mask-image:radial-gradient(ellipse_44%_52%_at_50%_54%,#000_64%,transparent_100%)]"
          />
        ) : !presenterFailed ? (
          <img
            src={PRESENTER_PORTRAIT_URL}
            alt="מגיש שידור חי במרכז הפריים"
            referrerPolicy="no-referrer"
            onError={() => setPresenterFailed(true)}
            className="w-full h-full object-cover [mask-image:radial-gradient(ellipse_43%_50%_at_50%_56%,#000_66%,transparent_100%)]"
          />
        ) : (
          <div className="w-[48%] h-[68%] mb-6 rounded-t-full bg-gradient-to-b from-slate-700/70 to-slate-900/90 border border-slate-600/30 flex items-center justify-center text-xs text-slate-300">
            מגיש שידור (אזור מרכזי)
          </div>
        )}
      </div>

      {/* Z-40: FOREGROUND FX + TACTILE TAP-DOPAMINE LAYER */}
      <canvas ref={frontCanvasRef} className="absolute inset-0 w-full h-full z-40 pointer-events-none" />

      {/* Z-45: BROADCAST SUPPORTER AVATARS + ANTI-CLOUD SCORE X-RAY OVERLAY */}
      {showLayerFilter !== 'back_only' && <StageBroadcastHudOverlays battleState={battleState} />}

      {/* Z-50: Optional Broadcast Safe-Zone Calibration Grid */}
      {showSafeZone && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <div className="absolute inset-y-0 left-[26%] right-[26%] border-x border-dashed border-amber-400/70 bg-amber-500/[0.04] flex flex-col justify-between p-2">
            <span className="text-[11px] font-mono text-amber-300 bg-black/70 px-1.5 py-0.5 rounded self-center">
              SAFE ZONE 48% (פני מגיש)
            </span>
            <span className="text-[10px] font-mono text-amber-200/80 bg-black/70 px-1.5 py-0.5 rounded self-center">
              ללא חסימה רציפה
            </span>
          </div>
        </div>
      )}

      {/* Minimal Measured Scrim at bottom for clean studio timecode & combo readout */}
      <div className="absolute inset-x-0 bottom-0 z-45 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-200 pointer-events-none">
        {battleState.streamMode === 'SOLO' ? (
          <>
            <span className="font-semibold text-amber-300">שידור סולו חי</span>
            <span className="text-slate-300 tabular-nums">
              רצף טאפ x{battleState.likeComboCount} · בימוי פתוח
            </span>
          </>
        ) : (
          <>
            <span className="font-mono tabular-nums font-semibold">
              {String(Math.floor(battleState.elapsedSec / 60)).padStart(2, '0')}:
              {String(Math.floor(battleState.elapsedSec % 60)).padStart(2, '0')} / 04:00
            </span>
            <span className="text-slate-300 tabular-nums">
              {battleState.gloveRemainingSec > 0
                ? `כפפה x5 (${Math.ceil(battleState.gloveRemainingSec)}s)`
                : battleState.snipeWindowActive
                  ? 'חלון סנייפ פעיל!'
                  : `קומבו x${battleState.likeComboCount} · ${battleState.phase}`}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
