import { ChangeEvent, useRef, useState } from 'react';
import {
  Play,
  Copy,
  Check,
  Download,
  Upload,
  Wand2,
  Film,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  BOOSTERA_ASSETS,
  RoundPaletteId,
  VfxAssetSpec,
  VfxLayer,
} from '../data/boosteraCatalog';
import { exportVfxClipToWebm } from '../engine/vfxRenderer';
import { soundEngine } from '../engine/soundEngine';
import { videoVfxCompositor } from '../engine/videoVfxCompositor';
import { useEffect } from 'react';
import { HybridAiFxLibrary } from './HybridAiFxLibrary';

interface VfxLibraryWorkspaceProps {
  roundPalette: RoundPaletteId;
  onTriggerInLiveStage: (effectId: string) => void;
}

interface MeasuredVideoTelemetry {
  fileName: string;
  fileSizeMb: string;
  width: number;
  height: number;
  aspectRatioLabel: string;
  durationSec: number;
  isVertical9x16: boolean;
  hasTrueAlphaPixels: boolean;
  chromaGreenPixelPct: number;
  pitchBlackPixelPct: number;
  centerSafeZoneOccupancyPct: number;
}

interface GeminiInspectionVerdict {
  identifiedEffectHe: string;
  recommendedTikTokTriggerHe: string;
  recommendedLayer: string;
  chromaAndAlphaVerdictHe: string;
  framingAndSafeZoneVerdictHe: string;
  reusabilityVerdictHe: string;
  soundPairingSuggestionHe: string;
  needsRerender: boolean;
}

export function VfxLibraryWorkspace({
  roundPalette,
  onTriggerInLiveStage,
}: VfxLibraryWorkspaceProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Per-card custom prompt refinements
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [refineInputs, setRefineInputs] = useState<Record<string, string>>({});
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [refineNote, setRefineNote] = useState<Record<string, string>>({});

  // WebM video clip export state
  const [exportBgMode, setExportBgMode] = useState<'transparent' | 'pitch_black' | 'chroma_green'>('transparent');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportError, setExportError] = useState<string | null>(null);

  // Video & Chroma Inspector Lab state
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<MeasuredVideoTelemetry | null>(null);
  const [capturedFrameB64, setCapturedFrameB64] = useState<string | null>(null);
  const [inspectingAi, setInspectingAi] = useState(false);
  const [aiVerdict, setAiVerdict] = useState<GeminiInspectionVerdict | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [previewKeyMode, setPreviewKeyMode] = useState<'raw' | 'chroma_key' | 'screen_black'>('raw');

  const inspectorVideoRef = useRef<HTMLVideoElement | null>(null);
  const inspectorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live Studio Video & Green-Screen Beast Previewer + Slot Binder State
  const studioVideos = BOOSTERA_ASSETS.filter((a) => a.id.startsWith('VID_'));
  const beastAssets = BOOSTERA_ASSETS.filter((a) => a.id.startsWith('BEAST_'));
  const [selectedVideoId, setSelectedVideoId] = useState<string>('VID_02_CRYO_CO2_CANNONS');
  const [showKeyedPreview, setShowKeyedPreview] = useState<boolean>(true);
  const [boundBeastUrls, setBoundBeastUrls] = useState<Record<string, string>>({});
  const [slotStatusHe, setSlotStatusHe] = useState<string | null>(null);

  // Custom Green-Screen Video Adder State
  const [customTitleHe, setCustomTitleHe] = useState('');
  const [customLayer, setCustomLayer] = useState<VfxLayer>('BACK');
  const [customFraming, setCustomFraming] = useState<
    'UPPER_CREST_BACK' | 'SPLIT_EDGES_9X16' | 'IMPACT_LOWER_BACK'
  >('UPPER_CREST_BACK');
  const [customFeatherPct, setCustomFeatherPct] = useState<number>(28);
  const [customPlayAudio, setCustomPlayAudio] = useState<boolean>(true);
  const [customClipsVersion, setCustomClipsVersion] = useState<number>(0);

  const livePreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const livePreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectedStudioAsset =
    BOOSTERA_ASSETS.find((a) => a.id === selectedVideoId) || studioVideos[0];
  const activePreviewSrc =
    boundBeastUrls[selectedStudioAsset.id] ||
    videoVfxCompositor.getBoundSlotUrl(selectedStudioAsset.id) ||
    selectedStudioAsset.videoSrc ||
    null;

  useEffect(() => {
    if (!showKeyedPreview || !activePreviewSrc) return;
    let rafId = 0;
    const renderLoop = () => {
      const vid = livePreviewVideoRef.current;
      const canvas = livePreviewCanvasRef.current;
      if (vid && canvas && vid.readyState >= 2) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Simulated subtle presenter silhouette in center so user sees BACK vs FRONT & Safe Zone clearly!
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const keyed = videoVfxCompositor.keyFrameIntoWorkCanvas(
            vid,
            selectedStudioAsset.compositingMethod === 'SCREEN_ADDITIVE_BLACK'
              ? 'SCREEN_BLACK'
              : 'CHROMA_GREEN',
            selectedStudioAsset.cropBottomPct ?? 5,
            selectedStudioAsset.maskBottomFeatherPct ?? 0
          );

          if (selectedStudioAsset.layer === 'BACK' && keyed) {
            videoVfxCompositor.projectKeyedSurfaceTo9x16(
              ctx,
              canvas.width,
              canvas.height,
              keyed,
              selectedStudioAsset.videoFramingMode || 'SPLIT_EDGES_9X16',
              1
            );
          }

          // Presenter silhouette safe-zone reference
          ctx.fillStyle = 'rgba(30, 41, 59, 0.92)';
          ctx.beginPath();
          ctx.arc(canvas.width * 0.5, canvas.height * 0.42, canvas.width * 0.13, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(
            canvas.width * 0.5,
            canvas.height * 0.78,
            canvas.width * 0.27,
            canvas.height * 0.24,
            0,
            Math.PI,
            0
          );
          ctx.fill();

          if (selectedStudioAsset.layer !== 'BACK' && keyed) {
            videoVfxCompositor.projectKeyedSurfaceTo9x16(
              ctx,
              canvas.width,
              canvas.height,
              keyed,
              selectedStudioAsset.videoFramingMode || 'SPLIT_EDGES_9X16',
              1
            );
          }
        }
      }
      rafId = requestAnimationFrame(renderLoop);
    };
    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [showKeyedPreview, activePreviewSrc, selectedStudioAsset]);

  const handleBindBeastMp4 = (effectId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    videoVfxCompositor.bindVideoFileToCatalogSlot(effectId, blobUrl);
    setBoundBeastUrls((prev) => ({ ...prev, [effectId]: blobUrl }));
    setSelectedVideoId(effectId);
    setSlotStatusHe(
      `קובץ "${file.name}" חובר בהצלחה לסלוט ${effectId} עם חיתוך כרומה אוטומטי, מסכת ריכוך תחתונה וסאונד שאגה חי!`
    );
    e.target.value = '';
  };

  const handleAddCustomGreenScreenClip = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    const id = `CUSTOM_VID_${Date.now()}`;
    const title = customTitleHe.trim() || file.name.replace(/\.[^.]+$/, '');
    videoVfxCompositor.registerCustomVideo(
      {
        id,
        titleHe: title,
        videoUrl: blobUrl,
        layer: customLayer,
        framingMode: customFraming,
        durationSec: 8.5,
        cropBottomPct: 6,
        maskBottomFeatherPct: customFeatherPct,
        playEmbeddedAudio: customPlayAudio,
      },
      'CHROMA_GREEN'
    );
    setCustomTitleHe('');
    setCustomClipsVersion((v) => v + 1);
    setSlotStatusHe(`הסרטון "${title}" נוסף לספריית הגרין-סקרין החיה ומוכן לשיגור מיידי לבמה!`);
    e.target.value = '';
  };

  const customRegisteredClips = videoVfxCompositor.getCustomVideos();
  void customClipsVersion;

  const filteredAssets = BOOSTERA_ASSETS.filter(
    (a) => categoryFilter === 'ALL' || a.category === categoryFilter
  );

  const copyPrompt = (asset: VfxAssetSpec) => {
    const text = customPrompts[asset.id] || asset.promptEn;
    navigator.clipboard.writeText(text);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRefinePrompt = async (asset: VfxAssetSpec) => {
    const reqText = refineInputs[asset.id]?.trim();
    if (!reqText) return;
    setRefiningId(asset.id);
    try {
      const res = await fetch('/api/gemini/refine-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePrompt: customPrompts[asset.id] || asset.promptEn,
          directorRequestHe: reqText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בעדכון הפרומפט');
      if (data.refinedPromptEn) {
        setCustomPrompts((prev) => ({ ...prev, [asset.id]: data.refinedPromptEn }));
      }
      if (data.directorNoteHe) {
        setRefineNote((prev) => ({ ...prev, [asset.id]: data.directorNoteHe }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'שגיאה בפנייה לשרת Gemini';
      setRefineNote((prev) => ({ ...prev, [asset.id]: msg }));
    } finally {
      setRefiningId(null);
    }
  };

  const handleExportVideo = async (asset: VfxAssetSpec) => {
    setExportError(null);
    setExportingId(asset.id);
    setExportProgress(2);
    try {
      const { blob, filename } = await exportVfxClipToWebm({
        effectId: asset.id,
        durationSec: asset.durationSec,
        layer: asset.layer,
        roundPalette,
        backgroundMode: exportBgMode,
        onProgress: (p) => setExportProgress(p),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'ייצוא הווידאו נכשל בדפדפן זה.');
    } finally {
      setExportingId(null);
      setExportProgress(0);
    }
  };

  const handleVideoFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);

    const url = URL.createObjectURL(file);
    setUploadedVideoUrl(url);
    setAiVerdict(null);
    setInspectError(null);

    const tempVideo = document.createElement('video');
    tempVideo.src = url;
    tempVideo.muted = true;
    tempVideo.playsInline = true;

    tempVideo.onloadedmetadata = () => {
      // Seek to peak action (~35% into clip) to measure genuine pixel alpha, chroma green, and safe-zone intrusion
      tempVideo.currentTime = Math.min(tempVideo.duration * 0.35, 2.0);
    };

    tempVideo.onseeked = () => {
      const w = tempVideo.videoWidth || 1080;
      const h = tempVideo.videoHeight || 1920;
      const sampleW = 180;
      const sampleH = Math.max(100, Math.round((h / w) * sampleW));
      const c = document.createElement('canvas');
      c.width = sampleW;
      c.height = sampleH;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.clearRect(0, 0, sampleW, sampleH);
      ctx.drawImage(tempVideo, 0, 0, sampleW, sampleH);

      const img = ctx.getImageData(0, 0, sampleW, sampleH).data;
      let transparentCount = 0;
      let greenCount = 0;
      let blackCount = 0;
      let centerOccupied = 0;
      let centerTotal = 0;

      for (let py = 0; py < sampleH; py++) {
        for (let px = 0; px < sampleW; px++) {
          const idx = (py * sampleW + px) * 4;
          const r = img[idx];
          const g = img[idx + 1];
          const b = img[idx + 2];
          const a = img[idx + 3];

          if (a < 245) transparentCount += 1;
          const isChromaGreen = g > 150 && g > r * 1.45 && g > b * 1.45;
          const isBlack = r < 22 && g < 22 && b < 22;
          if (isChromaGreen) greenCount += 1;
          if (isBlack) blackCount += 1;

          // Central 48% Presenter Face Safe Corridor
          if (px >= sampleW * 0.26 && px <= sampleW * 0.74 && py >= sampleH * 0.22 && py <= sampleH * 0.78) {
            centerTotal += 1;
            if (a >= 40 && !isChromaGreen && !isBlack) {
              centerOccupied += 1;
            }
          }
        }
      }

      const totalPixels = sampleW * sampleH;
      const ratio = w / h;
      const is9x16 = Math.abs(ratio - 9 / 16) < 0.04;

      const measured: MeasuredVideoTelemetry = {
        fileName: file.name,
        fileSizeMb: (file.size / (1024 * 1024)).toFixed(2),
        width: w,
        height: h,
        aspectRatioLabel: is9x16 ? '9:16 אנכי תקני' : `${w}:${h} (יחס ${ratio.toFixed(2)})`,
        durationSec: Number(tempVideo.duration.toFixed(2)),
        isVertical9x16: is9x16,
        hasTrueAlphaPixels: transparentCount > totalPixels * 0.02,
        chromaGreenPixelPct: Math.round((greenCount / totalPixels) * 100),
        pitchBlackPixelPct: Math.round((blackCount / totalPixels) * 100),
        centerSafeZoneOccupancyPct: Math.round((centerOccupied / Math.max(1, centerTotal)) * 100),
      };

      setTelemetry(measured);

      // Export JPEG frame for optional server-side Gemini VFX Supervisor review
      const jpegDataUrl = c.toDataURL('image/jpeg', 0.85);
      setCapturedFrameB64(jpegDataUrl.split(',')[1] || null);
    };
  };

  // Real-time Chroma Key / Screen compositor preview for uploaded video
  const renderInspectorCompositeFrame = () => {
    const vid = inspectorVideoRef.current;
    const canvas = inspectorCanvasRef.current;
    if (!vid || !canvas || vid.paused || vid.ended) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);

    if (previewKeyMode === 'chroma_key') {
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = frame.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        if (g > 110 && g > r * 1.3 && g > b * 1.3) {
          d[i + 3] = 0;
        } else if (g > r && g > b) {
          // Despill green edge fringe
          d[i + 1] = Math.round((r + b) * 0.5);
        }
      }
      ctx.putImageData(frame, 0, 0);
    } else if (previewKeyMode === 'screen_black') {
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = frame.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = Math.max(d[i], d[i + 1], d[i + 2]);
        d[i + 3] = lum < 18 ? 0 : lum;
      }
      ctx.putImageData(frame, 0, 0);
    }
    requestAnimationFrame(renderInspectorCompositeFrame);
  };

  const runGeminiVideoAudit = async () => {
    if (!capturedFrameB64 || !telemetry) return;
    setInspectingAi(true);
    setInspectError(null);
    try {
      const res = await fetch('/api/gemini/inspect-vfx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameBase64: capturedFrameB64,
          mimeType: 'image/jpeg',
          metrics: telemetry,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בניתוח הווידאו');
      setAiVerdict(data.analysis);
    } catch (err: unknown) {
      setInspectError(err instanceof Error ? err.message : 'שגיאה בניתוח הווידאו');
    } finally {
      setInspectingAi(false);
    }
  };

  return (
    <div className="space-y-8">
      <HybridAiFxLibrary />
      {/* Header & Export Plate Selector */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1E2636] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            ספריית 24 אפקטי השידור החי: 7 סרטוני אולפן + 3 חיות גרין-סקרין + 14 אפקטי 60fps
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            כל הסרטונים שהעלית מוטמעים ומוכנים עם חיתוך כרומה ירוק (#00FF00) אוטומטי, תיקון פינות והסתרת מריחות פיקסלים, התאמה ל-9:16 ושמירה על אזור הפנים של המגיש — בלחיצה אחת לבמה או בניהול הטייס האוטומטי!
          </p>
        </div>

        {/* Export Background Format Selector */}
        <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0">
          <span className="text-xs text-slate-400">פורמט רקע בעת ייצוא קליפ וידאו (.webm):</span>
          <div className="flex items-center gap-1 p-1 bg-[#121722] border border-[#1E2636] rounded-lg">
            {(
              [
                { id: 'transparent', label: 'Alpha שקוף (VP9)' },
                { id: 'pitch_black', label: 'שחור #000000 (Screen)' },
                { id: 'chroma_green', label: 'כרומה #00FF00' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setExportBgMode(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  exportBgMode === opt.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {slotStatusHe && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-200">
          {slotStatusHe}
        </div>
      )}

      {/* SPOTLIGHT 1: 7 READY REAL CHROMA-GREEN STUDIO VIDEOS + LIVE 9:16 KEYED PREVIEWER */}
      <section className="bg-[#121722] border border-emerald-500/35 rounded-xl p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#1E2636] pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              7 סרטוני הגרין-סקרין המוכנים שלך בלייב (Chroma #00FF00 → 9:16 שקוף)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              בחר כל סרטון לצפייה בהדמיית חיתוך הכרומה החי ב-9:16 (כולל חיתוך מבערים תחתונים ו-Despill) או שגר אותו מיד לבמה החיה ול-OBS.
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-[#283246] bg-[#0B0E14] p-1 self-start">
            <button
              onClick={() => setShowKeyedPreview(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                showKeyedPreview ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'
              }`}
            >
              תצוגת 9:16 אחרי חיתוך גרין-סקרין
            </button>
            <button
              onClick={() => setShowKeyedPreview(false)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                !showKeyedPreview ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
              }`}
            >
              קובץ MP4 מקורי (#00FF00)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: 7 Studio Videos + Bound Beasts Selector */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {studioVideos.map((vid) => {
              const active = selectedVideoId === vid.id;
              return (
                <div
                  key={vid.id}
                  onClick={() => setSelectedVideoId(vid.id)}
                  className={`cursor-pointer rounded-xl p-3.5 border transition-colors flex flex-col justify-between gap-3 ${
                    active
                      ? 'bg-emerald-500/10 border-emerald-500/60'
                      : 'bg-[#0B0E14] border-[#1E2636] hover:border-slate-600'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span className="text-emerald-400 font-semibold">שכבת {vid.layer}</span>
                      <span>{vid.durationSec}s · P{vid.priority}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 leading-snug">{vid.titleHe}</h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      מתי לשלב: {vid.triggerLabelHe}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      soundEngine.ensureInitialized();
                      onTriggerInLiveStage(vid.id);
                    }}
                    className="w-full py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    שגר לבמה החיה + סאונד
                  </button>
                </div>
              );
            })}
          </div>

          {/* Right: Live 9:16 Keyed Stage Preview + Supervisor Audit */}
          <div className="lg:col-span-5 bg-[#0B0E14] border border-[#1E2636] rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200 truncate">
                תצוגת מוניטור: {selectedStudioAsset.titleHe}
              </span>
              <span className="text-[11px] font-mono text-emerald-400 shrink-0">
                {selectedStudioAsset.videoFramingMode}
              </span>
            </div>

            {activePreviewSrc ? (
              <div className="flex justify-center">
                <video
                  ref={livePreviewVideoRef}
                  src={activePreviewSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className={
                    showKeyedPreview
                      ? 'hidden'
                      : 'w-full max-w-[280px] rounded-lg border border-[#283246]'
                  }
                />
                {showKeyedPreview && (
                  <canvas
                    ref={livePreviewCanvasRef}
                    width={252}
                    height={448}
                    className="w-[210px] h-[373px] rounded-xl border border-emerald-500/40 bg-[#0B0E14]"
                  />
                )}
              </div>
            ) : (
              <div className="p-5 rounded-lg bg-[#121722] border border-[#283246] text-xs text-slate-300 text-center space-y-2">
                <p>אפקט זה פעיל ברינדור 60fps חי על הבמה! חבר למטה את קובץ ה-MP4 המקומי כדי לראות כאן גם את וידאו הגרין-סקרין המקורי.</p>
              </div>
            )}

            {selectedStudioAsset.supervisorAuditHe && (
              <div className="space-y-1.5 text-xs text-slate-300 border-t border-[#1E2636] pt-3">
                <p>
                  <span className="text-amber-400 font-semibold">זיהוי סריקה: </span>
                  {selectedStudioAsset.supervisorAuditHe.identifiedHe}
                </p>
                <p>
                  <span className="text-emerald-400 font-semibold">מתי לשלב בלייב: </span>
                  {selectedStudioAsset.supervisorAuditHe.triggerFitHe}
                </p>
                <p>
                  <span className="text-sky-400 font-semibold">כיול גרין-סקרין ו-Safe Zone: </span>
                  {selectedStudioAsset.supervisorAuditHe.chromaAlphaVerdictHe}{' '}
                  {selectedStudioAsset.supervisorAuditHe.framingSafeZoneHe}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SPOTLIGHT 2: SCAN REPORT & 1-CLICK GREEN-SCREEN BINDER FOR THE 3 NEW BEAST ADDITIONS */}
      <section className="bg-[#121722] border border-fuchsia-500/35 rounded-xl p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#1E2636] pb-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-100">
              דו״ח סריקה ושילוב ל-3 תוספות הגרין-סקרין החדשות (פניקס סגול · טיגריס אש · אריה אש)
            </h2>
            <p className="text-xs text-slate-400 max-w-4xl">
              נסרקו כל הפריימים והסאונד של שלושת הסרטונים: כולם כבר משולבים בטייס האוטומטי ובבמה החיה (60fps בשכבת BACK העליונה מעל הכתפיים בלי להסתיר פנים!), עם תיקון אוטומטי להאפלת הפינות הירוקה בפניקס ולהסתרת מריחת הפיקסלים התחתונה (00:03–00:08) בטיגריס ובאריה. ניתן גם לחבר בלחיצה את קובץ ה-MP4 מהמחשב לכל סלוט!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {beastAssets.map((beast) => {
            const isBound = Boolean(boundBeastUrls[beast.id]);
            return (
              <div
                key={beast.id}
                className="bg-[#0B0E14] border border-[#243044] rounded-xl p-4 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-fuchsia-300">
                      שכבת {beast.layer} · UPPER_CREST
                    </span>
                    <span className="text-[11px] text-emerald-400 font-semibold">
                      {isBound ? 'MP4 גרין-סקרין מחובר!' : 'פעיל ב-60fps חי'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100">{beast.titleHe}</h3>

                  {beast.supervisorAuditHe && (
                    <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-[#1E2636]">
                      <p>
                        <span className="text-amber-400 font-semibold">מתי לשלב בלייב: </span>
                        {beast.supervisorAuditHe.triggerFitHe}
                      </p>
                      <p>
                        <span className="text-fuchsia-300 font-semibold">ממצאי סריקת גרין-סקרין: </span>
                        {beast.supervisorAuditHe.chromaAlphaVerdictHe}
                      </p>
                      <p>
                        <span className="text-emerald-300 font-semibold">תיקון חכם שבוצע במנוע: </span>
                        {beast.supervisorAuditHe.framingSafeZoneHe}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-[#1E2636]">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.ensureInitialized();
                      onTriggerInLiveStage(beast.id);
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    שגר לבמה החיה עכשיו + שאגה
                  </button>

                  <label className="w-full py-2 px-3 rounded-lg bg-[#121722] border border-fuchsia-500/40 hover:border-fuchsia-400 text-fuchsia-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    {isBound ? 'החלף קובץ MP4 גרין-סקרין בסלוט' : `חבר קובץ MP4 (${beast.filename})`}
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/*"
                      onChange={(ev) => handleBindBeastMp4(beast.id, ev)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Any Additional Green-Screen MP4 Directly Into Live Stage */}
        <div className="bg-[#0B0E14] border border-[#1E2636] rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-100">
              הוספת כל סרטון גרין-סקרין נוסף משלך ישר לבמה החיה (עם ניקוי #00FF00 אוטומטי)
            </h3>
            <span className="text-xs text-slate-400">חותך ירוק בזמן אמת ב-60fps בסטודיו וב-OBS</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-center">
            <input
              type="text"
              value={customTitleHe}
              onChange={(e) => setCustomTitleHe(e.target.value)}
              placeholder="שם האפקט (למשל: דרקון זהב לסנייפ)..."
              className="bg-[#121722] border border-[#283246] rounded-lg px-3 py-2 text-xs text-slate-100 outline-none"
            />
            <select
              value={customLayer}
              onChange={(e) => setCustomLayer(e.target.value as VfxLayer)}
              className="bg-[#121722] border border-[#283246] rounded-lg px-3 py-2 text-xs text-slate-100 outline-none"
            >
              <option value="BACK">שכבת BACK (מאחורי המגיש)</option>
              <option value="FRONT">שכבת FRONT (קדמת הבמה)</option>
            </select>
            <select
              value={customFraming}
              onChange={(e) =>
                setCustomFraming(
                  e.target.value as 'UPPER_CREST_BACK' | 'SPLIT_EDGES_9X16' | 'IMPACT_LOWER_BACK'
                )
              }
              className="bg-[#121722] border border-[#283246] rounded-lg px-3 py-2 text-xs text-slate-100 outline-none"
            >
              <option value="UPPER_CREST_BACK">כתר עליון מעל הכתפיים (חיות/כנפיים)</option>
              <option value="SPLIT_EDGES_9X16">פיצול שוליים אנכי 9:16 (תותחים/אש)</option>
              <option value="IMPACT_LOWER_BACK">אימפקט רוחבי מאחורי הגוף</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-300 px-2">
              <input
                type="checkbox"
                checked={customPlayAudio}
                onChange={(e) => setCustomPlayAudio(e.target.checked)}
                className="accent-amber-500"
              />
              נגן סאונד מובנה מהווידאו ({customFeatherPct}% ריכוך תחתון)
            </label>
            <label className="py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              העלה MP4 גרין-סקרין לבמה
              <input
                type="file"
                accept="video/mp4,video/webm,video/*"
                onChange={handleAddCustomGreenScreenClip}
                className="hidden"
              />
            </label>
          </div>

          {customRegisteredClips.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1E2636]">
              {customRegisteredClips.map((clip) => (
                <button
                  key={clip.id}
                  type="button"
                  onClick={() => onTriggerInLiveStage(clip.id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 flex items-center gap-1.5"
                >
                  <Play className="w-3 h-3 fill-current" />
                  שגר: {clip.titleHe} ({clip.layer})
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {exportError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/40 text-xs text-rose-200">
          {exportError}
        </div>
      )}

      {/* Category Filter Segmented Control */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(
          [
            { id: 'ALL', label: `כל ${BOOSTERA_ASSETS.length} האפקטים` },
            { id: 'AMBIENT', label: 'אווירה רציפה (Loop)' },
            { id: 'REACTIVE_ENERGY', label: 'צבירת לייקים וצ׳אט' },
            { id: 'SHARE_IMPACT', label: 'שיתופים (CO₂ ועשן)' },
            { id: 'SOCIAL_REWARD', label: 'עוקבים וצופים' },
            { id: 'ESCALATION', label: 'יעדים, ברקים ומתח' },
            { id: 'CLIMAX', label: 'גראנד פינאלה' },
          ] as const
        ).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategoryFilter(cat.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              categoryFilter === cat.id
                ? 'bg-[#1A2233] border-amber-500/60 text-amber-200'
                : 'bg-[#121722] border-[#1E2636] text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 11 Production VFX Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {filteredAssets.map((asset) => {
          const activePrompt = customPrompts[asset.id] || asset.promptEn;
          const isExporting = exportingId === asset.id;

          return (
            <article
              key={asset.id}
              className="bg-[#121722] border border-[#1E2636] rounded-xl p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Unboxed Clean Metadata Kicker (Zero-Pill Discipline) */}
                <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-amber-400 font-semibold">
                      {String(asset.order).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-slate-300">{asset.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>שכבה: {asset.layer}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{asset.durationSec}s</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">עדיפות P{asset.priority}</span>
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-slate-100">{asset.titleHe}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    טריגר: <span className="text-slate-200">{asset.triggerLabelHe}</span> · סאונד תואם:{' '}
                    <span className="text-slate-200">{asset.audio.conceptHe}</span>
                  </p>
                </div>

                <div className="text-xs text-slate-300 space-y-1.5 pt-2 border-t border-[#1E2636]">
                  <p>
                    <span className="text-slate-400">התנהגות אזור בטוח: </span>
                    {asset.safeZoneBehaviorHe}
                  </p>
                  <p>
                    <span className="text-slate-400">שיטת קומפוזיטינג מומלצת ({asset.compositingMethod}): </span>
                    {asset.compositingRationaleHe}
                  </p>
                </div>

                {/* Production-Ready English Prompt Box */}
                <div className="bg-[#0B0E14] border border-[#1E2636] rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-300">
                      פרומפט מוכן להעתקה (English Video Generation Prompt)
                    </span>
                    <button
                      onClick={() => copyPrompt(asset)}
                      className="px-2.5 py-1 text-xs rounded-md bg-[#161D2B] hover:bg-[#1E283B] text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      {copiedId === asset.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>הועתק</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>העתק פרומפט</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p
                    dir="ltr"
                    className="text-xs font-mono text-slate-300 leading-relaxed select-all text-left"
                  >
                    {activePrompt}
                  </p>

                  {/* Optional Gemini Prompt Tailoring Row */}
                  <div className="pt-2 border-t border-[#1E2636]/80 flex items-center gap-2">
                    <input
                      type="text"
                      value={refineInputs[asset.id] || ''}
                      onChange={(e) =>
                        setRefineInputs((prev) => ({ ...prev, [asset.id]: e.target.value }))
                      }
                      placeholder="בקש מ-Gemini התאמה לפרומפט (למשל: עשן כהה יותר או משך 5 שניות)..."
                      className="flex-1 bg-[#121722] border border-[#1E2636] rounded-md px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
                    />
                    <button
                      onClick={() => handleRefinePrompt(asset)}
                      disabled={refiningId === asset.id || !refineInputs[asset.id]?.trim()}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#192233] border border-[#28354E] text-slate-200 hover:border-amber-500/50 disabled:opacity-40 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>{refiningId === asset.id ? 'מעדכן...' : 'דייק פרומפט'}</span>
                    </button>
                  </div>
                  {refineNote[asset.id] && (
                    <p className="text-[11px] text-amber-300/90">{refineNote[asset.id]}</p>
                  )}
                </div>
              </div>

              {/* Action Row: Live Stage Trigger + Sound Audition + 9:16 WebM Video Export */}
              <div className="pt-3 border-t border-[#1E2636] flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      soundEngine.ensureInitialized();
                      soundEngine.triggerEffectSound(asset.id, true);
                      onTriggerInLiveStage(asset.id);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>הפעל במוניטור + סאונד</span>
                  </button>
                </div>

                <button
                  onClick={() => handleExportVideo(asset)}
                  disabled={Boolean(exportingId)}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[#0B0E14] border border-[#1E2636] hover:border-slate-500 text-slate-200 disabled:opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {isExporting
                      ? `מרנדר וידאו (${exportProgress}%)...`
                      : 'הורד וידאו 9:16 (.webm)'}
                  </span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Existing Video & Chroma-Key Inspector Lab (Section 8 Support) */}
      <section className="bg-[#121722] border border-[#1E2636] rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E2636] pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Film className="w-5 h-5 text-amber-400" />
              <span>מעבדת בדיקת סרטוני VFX קיימים (רזולוציה, Alpha, כרומה ואזור בטוח)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              טען כל סרטון וידאו קיים או מרונדר מ-Gemini כדי למדוד פיקסל-אחר-פיקסל האם יש בו ערוץ שקיפות אמיתי, האם חיתוך ה-Green Screen יעבוד ללא הילה ירוקה, ולקבל אבחון מלא ממפקח ה-VFX.
            </p>
          </div>

          <label className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 self-start">
            <Upload className="w-4 h-4" />
            <span>בחר קובץ וידאו לבדיקה (.mp4 / .webm)</span>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleVideoFileSelect}
              className="hidden"
            />
          </label>
        </div>

        {!telemetry ? (
          <div className="py-8 text-center text-sm text-slate-400">
            טרם נבחר סרטון חיצוני — ניתן להעלות כאן קליפ לבדיקת Chroma Key / Screen או לייצא קליפ מאחד מ-11 האפקטים למעלה ולבדוק אותו.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Video + Real-Time Compositing Tester */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-300 font-medium">תצוגת בדיקת מפתח:</span>
                <div className="flex items-center gap-1 p-1 bg-[#0B0E14] border border-[#1E2636] rounded-lg">
                  {(
                    [
                      { id: 'raw', label: 'מקור גולמי' },
                      { id: 'chroma_key', label: 'חיתוך #00FF00' },
                      { id: 'screen_black', label: 'מיזוג Screen' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPreviewKeyMode(m.id)}
                      className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 ${
                        previewKeyMode === m.id
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative w-full max-w-[280px] mx-auto aspect-[9/16] rounded-lg overflow-hidden border border-[#1E2636] bg-[conic-gradient(#161d2b_25%,#0b0e14_0_50%,#161d2b_0_75%,#0b0e14_0)] bg-[length:20px_20px]">
                <video
                  ref={inspectorVideoRef}
                  src={uploadedVideoUrl || undefined}
                  controls
                  loop
                  muted
                  playsInline
                  onPlay={() => requestAnimationFrame(renderInspectorCompositeFrame)}
                  className={`w-full h-full object-contain ${previewKeyMode !== 'raw' ? 'opacity-0 absolute inset-0' : ''}`}
                />
                {previewKeyMode !== 'raw' && (
                  <canvas
                    ref={inspectorCanvasRef}
                    width={270}
                    height={480}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                )}
              </div>
            </div>

            {/* Measured File Metrics & Gemini Supervisor Verdict */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#0B0E14] border border-[#1E2636] rounded-lg p-4 text-xs">
                <div>
                  <div className="text-slate-400">רזולוציה נמדדת</div>
                  <div className="font-mono tabular-nums text-slate-100 font-semibold mt-0.5">
                    {telemetry.width}×{telemetry.height}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">יחס מסך</div>
                  <div className="font-mono tabular-nums text-slate-100 font-semibold mt-0.5">
                    {telemetry.aspectRatioLabel}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">משך ונפח</div>
                  <div className="font-mono tabular-nums text-slate-100 font-semibold mt-0.5">
                    {telemetry.durationSec}s · {telemetry.fileSizeMb} MB
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">ערוץ Alpha אמיתי בקובץ</div>
                  <div className="mt-0.5 flex items-center gap-1 font-semibold">
                    {telemetry.hasTrueAlphaPixels ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> קיים (שקוף אמיתי)
                      </span>
                    ) : (
                      <span className="text-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> ללא Alpha (וידאו אטום)
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">זיהוי רקע דומיננטי</div>
                  <div className="font-mono tabular-nums text-slate-200 mt-0.5">
                    ירוק: {telemetry.chromaGreenPixelPct}% · שחור: {telemetry.pitchBlackPixelPct}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">נוכחות באזור המגיש (48%)</div>
                  <div
                    className={`font-mono tabular-nums font-semibold mt-0.5 ${
                      telemetry.centerSafeZoneOccupancyPct > 35 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {telemetry.centerSafeZoneOccupancyPct}% מהמרכז
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={runGeminiVideoAudit}
                  disabled={inspectingAi}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>
                    {inspectingAi ? 'מנתח פריים ומדדים ב-Gemini...' : 'הפק חוות דעת מפקח VFX מלאה (8 סעיפים)'}
                  </span>
                </button>
              </div>

              {inspectError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/40 text-xs text-rose-200">
                  {inspectError}
                </div>
              )}

              {aiVerdict && (
                <div className="bg-[#0B0E14] border border-[#1E2636] rounded-lg p-4 space-y-2.5 text-xs text-slate-200">
                  <div className="flex items-center justify-between border-b border-[#1E2636] pb-2">
                    <span className="font-semibold text-amber-300">חוות דעת בימוי וקומפוזיטינג (Gemini VFX Audit)</span>
                    <span className="font-mono text-slate-300">
                      שכבה מומלצת: {aiVerdict.recommendedLayer} ·{' '}
                      {aiVerdict.needsRerender ? 'מומלץ רינדור מחדש' : 'כשיר לשידור'}
                    </span>
                  </div>
                  <p><span className="text-slate-400">1. זיהוי האפקט:</span> {aiVerdict.identifiedEffectHe}</p>
                  <p><span className="text-slate-400">2. אירוע TikTok מתאים:</span> {aiVerdict.recommendedTikTokTriggerHe}</p>
                  <p><span className="text-slate-400">3. הערכת Alpha / Chroma Key:</span> {aiVerdict.chromaAndAlphaVerdictHe}</p>
                  <p><span className="text-slate-400">4. פריימינג ואזור מגיש:</span> {aiVerdict.framingAndSafeZoneVerdictHe}</p>
                  <p><span className="text-slate-400">5. שימוש חוזר (Reusability):</span> {aiVerdict.reusabilityVerdictHe}</p>
                  <p><span className="text-slate-400">6. שילוב סאונד מומלץ:</span> {aiVerdict.soundPairingSuggestionHe}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
