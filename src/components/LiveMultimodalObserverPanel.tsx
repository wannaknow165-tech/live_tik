import React, { useEffect, useRef, useState } from 'react';
import { Camera, FileVideo, Loader2, Mic, Monitor, Square, Volume2 } from 'lucide-react';
import { MultimodalObserverState } from '../types/boosteraIntelligence';

interface LiveMultimodalObserverPanelProps {
  multimodal: MultimodalObserverState;
  activeStreamId: string;
  creatorUsername: string;
  activeVfxCount: number;
  onDashboardUpdated: () => Promise<void>;
  onAnalyzeCurrentFrameInBrain: (frameDataUrl: string) => Promise<void>;
}

export const LiveMultimodalObserverPanel: React.FC<LiveMultimodalObserverPanelProps> = ({
  multimodal,
  activeStreamId,
  creatorUsername,
  activeVfxCount,
  onDashboardUpdated,
  onAnalyzeCurrentFrameInBrain,
}) => {
  const [captureMode, setCaptureMode] = useState<'NONE' | 'WEBCAM' | 'SCREEN_SHARE' | 'VIDEO_FILE'>('NONE');
  const [statusNoteHe, setStatusNoteHe] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [analyzingFrame, setAnalyzingFrame] = useState(false);
  const [speakerLabelInput, setSpeakerLabelInput] = useState(creatorUsername || 'host_creator');
  const [speakerVerifiedToggle, setSpeakerVerifiedToggle] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const prevGrayFrameRef = useRef<Uint8Array | null>(null);
  const baselineCenterLumaRef = useRef<number | null>(null);
  const onsetTimestampsRef = useRef<number[]>([]);
  const silenceStartedAtRef = useRef<number | null>(null);
  const prevRmsDbRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const cleanupMedia = async (notifyServer = true) => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        await audioCtxRef.current.close();
      } catch {
        // Ignore close errors
      }
      audioCtxRef.current = null;
      analyserRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute('src');
    }
    prevGrayFrameRef.current = null;
    baselineCenterLumaRef.current = null;
    onsetTimestampsRef.current = [];
    silenceStartedAtRef.current = null;
    setCaptureMode('NONE');

    if (notifyServer) {
      try {
        await fetch('/api/intelligence/multimodal/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamId: activeStreamId,
            creatorUsername,
            visual: {
              sourceConnected: false,
              sourceType: 'NONE',
              motionIndexPct: 0,
              lightingBrightnessPct: 0,
              visualClutterPct: 0,
              subjectOccludedByVfx: false,
            },
            audio: {
              sourceConnected: false,
            },
          }),
        });
        await onDashboardUpdated();
      } catch {
        // Ignore network errors during cleanup
      }
    }
  };

  useEffect(() => {
    return () => {
      void cleanupMedia(false);
    };
  }, []);

  const attachAudioAndTelemetryLoop = (
    stream: MediaStream | null,
    mode: 'WEBCAM' | 'SCREEN_SHARE' | 'VIDEO_FILE',
    sourceLabelHe: string
  ) => {
    const hasAudioTrack = Boolean(stream && stream.getAudioTracks().length > 0);
    if (stream && hasAudioTrack) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.75;
        src.connect(analyser);
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      } catch {
        analyserRef.current = null;
      }
    }

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
    }

    intervalRef.current = window.setInterval(async () => {
      const videoEl = videoRef.current;
      const canvasEl = canvasRef.current;
      let visualPayload: Record<string, unknown> | undefined;

      if (videoEl && canvasEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
        const w = 160;
        const h = 90;
        canvasEl.width = w;
        canvasEl.height = h;
        const ctx2d = canvasEl.getContext('2d');
        if (ctx2d) {
          ctx2d.drawImage(videoEl, 0, 0, w, h);
          const img = ctx2d.getImageData(0, 0, w, h).data;
          const gray = new Uint8Array(w * h);
          let sumLuma = 0;
          let sumR = 0;
          let sumG = 0;
          let sumB = 0;
          let centerLumaSum = 0;
          let centerPixels = 0;

          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;
              const r = img[idx];
              const g = img[idx + 1];
              const b = img[idx + 2];
              const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
              gray[y * w + x] = luma;
              sumLuma += luma;
              sumR += r;
              sumG += g;
              sumB += b;
              if (x >= w * 0.3 && x <= w * 0.7 && y >= h * 0.2 && y <= h * 0.8) {
                centerLumaSum += luma;
                centerPixels += 1;
              }
            }
          }

          let diffAcc = 0;
          const prev = prevGrayFrameRef.current;
          if (prev && prev.length === gray.length) {
            for (let i = 0; i < gray.length; i++) {
              diffAcc += Math.abs(gray[i] - prev[i]);
            }
          }
          prevGrayFrameRef.current = gray;

          // Edge density proxy for visual clutter
          let edgeCount = 0;
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const p = y * w + x;
              const gx = Math.abs(gray[p + 1] - gray[p - 1]);
              const gy = Math.abs(gray[p + w] - gray[p - w]);
              if (gx + gy > 52) edgeCount += 1;
            }
          }

          const motionPct = prev ? Math.min(100, Math.round((diffAcc / (gray.length * 42)) * 100)) : 0;
          const brightnessPct = Math.round((sumLuma / (gray.length * 255)) * 100);
          const clutterPct = Math.min(100, Math.round((edgeCount / (gray.length * 0.35)) * 100));
          const centerLuma = centerPixels > 0 ? centerLumaSum / centerPixels : 128;

          if (activeVfxCount === 0) {
            baselineCenterLumaRef.current = centerLuma;
          }
          const baselineCenter = baselineCenterLumaRef.current ?? centerLuma;
          const centerShiftPct = Math.round((Math.abs(centerLuma - baselineCenter) / 255) * 100);
          const subjectOccluded = activeVfxCount > 0 && (clutterPct >= 76 || centerShiftPct >= 38);

          const avgR = sumR / gray.length;
          const avgG = sumG / gray.length;
          const avgB = sumB / gray.length;
          const dominantToneHe =
            avgR > avgB + 22
              ? 'גוונים חמים (אדום/כתום)'
              : avgB > avgR + 22
                ? 'גוונים קרים (כחול/סגול)'
                : avgG > avgR + 16
                  ? 'גוון ירקרק/ניטרלי'
                  : 'תאורה מאוזנת';

          visualPayload = {
            sourceConnected: true,
            sourceType: mode,
            motionIndexPct: motionPct,
            lightingBrightnessPct: brightnessPct,
            dominantColorToneHe: dominantToneHe,
            visualClutterPct: clutterPct,
            subjectOccludedByVfx: subjectOccluded,
            cameraAngleChangeDetected: motionPct >= 68,
            visualPeakDetected: motionPct >= 55,
            beforeAfterVfxComparisonHe:
              activeVfxCount > 0
                ? `בזמן אפקט פעיל: שינוי אזור המצולם ${centerShiftPct}% (${subjectOccluded ? 'מסתיר מצולם — נדרש ריסון!' : 'שומר על נראות המצולם'})`
                : 'ללא אפקט פעיל — פריים ייחוס נקי נשמר להשוואת לפני/אחרי',
            visibleExpressionCueHe:
              motionPct >= 45
                ? 'תנועת גוף/ידיים ערה במרכז הפריים'
                : 'נוכחות רגועה ויציבה מול המצלמה',
            confidence: 0.86,
          };
        }
      }

      let audioPayload: Record<string, unknown> = { sourceConnected: false };
      const analyser = analyserRef.current;
      const audioCtx = audioCtxRef.current;
      if (analyser && audioCtx) {
        const timeBuf = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(timeBuf);
        let sumSq = 0;
        for (let i = 0; i < timeBuf.length; i++) {
          sumSq += timeBuf[i] * timeBuf[i];
        }
        const rms = Math.sqrt(sumSq / timeBuf.length);
        const rmsDb = Number(Math.max(-72, 20 * Math.log10(Math.max(rms, 0.00025))).toFixed(1));

        const freqBuf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqBuf);
        const nyquist = audioCtx.sampleRate / 2;
        const binHz = nyquist / freqBuf.length;

        let speechEnergy = 0;
        let lowBassEnergy = 0;
        let highSfxEnergy = 0;
        for (let b = 1; b < freqBuf.length; b++) {
          const hz = b * binHz;
          const val = freqBuf[b];
          if (hz >= 300 && hz <= 3400) speechEnergy += val;
          else if (hz < 250) lowBassEnergy += val;
          else if (hz > 4000 && hz <= 10000) highSfxEnergy += val;
        }

        const totalSpectral = Math.max(1, speechEnergy + lowBassEnergy + highSfxEnergy);
        const speechClarityPct = Math.round((speechEnergy / totalSpectral) * 100);
        const sfxMasking = rmsDb > -34 && speechClarityPct < 28 && lowBassEnergy + highSfxEnergy > speechEnergy * 2.4;

        const now = Date.now();
        const isSilent = rmsDb <= -48;
        if (isSilent) {
          if (!silenceStartedAtRef.current) silenceStartedAtRef.current = now;
        } else {
          silenceStartedAtRef.current = null;
        }
        const silenceDurationMs = silenceStartedAtRef.current ? now - silenceStartedAtRef.current : 0;

        const prevDb = prevRmsDbRef.current ?? rmsDb;
        const deltaDb = rmsDb - prevDb;
        prevRmsDbRef.current = rmsDb;

        if (deltaDb >= 4.5 && rmsDb > -32) {
          const onsets = onsetTimestampsRef.current;
          if (onsets.length === 0 || now - onsets[onsets.length - 1] >= 280) {
            onsets.push(now);
          }
        }
        onsetTimestampsRef.current = onsetTimestampsRef.current.filter((t) => now - t <= 16000);

        let estimatedBpm: number | null = null;
        let beatRegularityPct: number | null = null;
        const onsets = onsetTimestampsRef.current;
        if (onsets.length >= 4) {
          const intervals: number[] = [];
          for (let i = 1; i < onsets.length; i++) {
            const dt = onsets[i] - onsets[i - 1];
            if (dt >= 300 && dt <= 1500) intervals.push(dt);
          }
          if (intervals.length >= 3) {
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            estimatedBpm = Math.round(60000 / avgInterval);
            const variance =
              intervals.reduce((acc, v) => acc + Math.abs(v - avgInterval), 0) / intervals.length;
            beatRegularityPct = Math.max(0, Math.min(100, Math.round(100 - (variance / avgInterval) * 100)));
          }
        }

        audioPayload = {
          sourceConnected: true,
          sourceLabelHe,
          rmsLoudnessDb: rmsDb,
          estimatedBpm,
          beatRegularityPct,
          energyShiftDeltaPct: Math.round(deltaDb * 4),
          silenceDetected: silenceDurationMs >= 2500,
          silenceDurationMs,
          musicalBurstDetected: deltaDb >= 7.5 && rmsDb > -20,
          speechBandClarityPct: speechClarityPct,
          sfxImpairingSpeech: sfxMasking,
          musicSpeechAlignmentHe: sfxMasking
            ? 'מוזיקה/אפקטים ממסכים תדרי דיבור — מומלץ להנמיך עוצמת רקע'
            : isSilent
              ? 'שקט בערוץ השמע המחובר'
              : speechClarityPct >= 45
                ? 'תדרי דיבור ברורים ונקיים מול הרקע'
                : 'שילוב מוזיקה ודיבור מאוזן',
        };
      }

      try {
        await fetch('/api/intelligence/multimodal/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamId: activeStreamId,
            creatorUsername,
            visual: visualPayload,
            audio: audioPayload,
          }),
        });
        await onDashboardUpdated();
      } catch {
        // Ignore transient telemetry errors
      }
    }, 2400);
  };

  const handleStartWebcamAndMic = async () => {
    await cleanupMedia(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 } },
        audio: true,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCaptureMode('WEBCAM');
      setStatusNoteHe('חוברו מצלמה ומיקרופון מורשים — ניתוח פריימים, תדרי דיבור ו-BPM פעיל בזמן אמת.');
      attachAudioAndTelemetryLoop(stream, 'WEBCAM', 'מצלמה + מיקרופון מקומי מורשה');
    } catch (err: any) {
      setStatusNoteHe(`לא ניתן לפתוח מצלמה/מיקרופון (${String(err?.message || 'אין הרשאת דפדפן')}).`);
    }
  };

  const handleStartScreenShare = async () => {
    await cleanupMedia(false);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCaptureMode('SCREEN_SHARE');
      const hasAudio = stream.getAudioTracks().length > 0;
      setStatusNoteHe(
        hasAudio
          ? 'שיתוף מסך/לשונית שידור עם שמע מחובר — מנתח וידאו ואודיו בזמן אמת.'
          : 'שיתוף מסך מחובר (ללא סימון שיתוף שמע בלשונית — מנתח וידאו בלבד, אודיו מסומן כלא מחובר).'
      );
      attachAudioAndTelemetryLoop(stream, 'SCREEN_SHARE', 'שיתוף לשונית/מסך שידור מורשה');
    } catch (err: any) {
      setStatusNoteHe(`שיתוף המסך בוטל או לא נתמך (${String(err?.message || 'בוטל')}).`);
    }
  };

  const handleVideoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await cleanupMedia(false);
    const objUrl = URL.createObjectURL(file);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = objUrl;
      videoRef.current.loop = true;
      videoRef.current.muted = false;
      try {
        await videoRef.current.play();
        const vidAny = videoRef.current as HTMLVideoElement & {
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        };
        const captured = vidAny.captureStream
          ? vidAny.captureStream()
          : vidAny.mozCaptureStream
            ? vidAny.mozCaptureStream()
            : null;
        if (captured) mediaStreamRef.current = captured;
        setCaptureMode('VIDEO_FILE');
        setStatusNoteHe(`קובץ מדיה נטען לבדיקה (${file.name}) — מפיק מדדי וידאו ושמע אמיתיים.`);
        attachAudioAndTelemetryLoop(captured, 'VIDEO_FILE', `קובץ שידור מוקלט: ${file.name}`);
      } catch (err: any) {
        setStatusNoteHe(`שגיאה בהפעלת קובץ המדיה: ${String(err?.message || err)}`);
      }
    }
  };

  const handleCapture5sSpeechTranscript = async () => {
    const stream = mediaStreamRef.current;
    if (!stream || stream.getAudioTracks().length === 0) {
      setStatusNoteHe('אין ערוץ אודיו פעיל לתמלול — חבר תחילה מיקרופון או לשונית שידור עם שמע.');
      return;
    }
    setTranscribing(true);
    setStatusNoteHe('מקליט דגימת דיבור בת 5 שניות לתמלול רב-לשוני (STT)...');
    try {
      const audioOnlyStream = new MediaStream(stream.getAudioTracks());
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(audioOnlyStream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const base64Audio = await new Promise<string>((resolve, reject) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('שגיאת קריאת שמע'));
          reader.readAsDataURL(blob);
        };
        recorder.onerror = () => reject(new Error('שגיאת הקלטת MediaRecorder'));
        recorder.start();
        window.setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, 5000);
      });

      const resp = await fetch('/api/intelligence/multimodal/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType: 'audio/webm',
          streamId: activeStreamId,
          creatorUsername,
          speakerLabel: speakerLabelInput.trim() || creatorUsername,
          speakerVerified: speakerVerifiedToggle,
          volumeDb: multimodal.audio.rmsLoudnessDb,
        }),
      });
      const data = await resp.json();
      if (data.ok && data.stt?.text) {
        setStatusNoteHe(`תומלל בהצלחה (${data.stt.language}): "${data.stt.text}"`);
      } else {
        setStatusNoteHe(data.stt?.errorHe || data.error || 'לא זוהה דיבור ברור בקטע השמע.');
      }
      await onDashboardUpdated();
    } catch (err: any) {
      setStatusNoteHe(`שגיאה בתמלול הקטע: ${String(err?.message || err)}`);
    } finally {
      setTranscribing(false);
    }
  };

  const handleSendFrameToBrain = async () => {
    const canvasEl = canvasRef.current;
    if (!multimodal.visual.sourceConnected || !canvasEl) {
      setStatusNoteHe('חבר תחילה מקור וידאו מורשה כדי לשלוח פריים אמיתי למוח המרכזי.');
      return;
    }
    setAnalyzingFrame(true);
    try {
      const dataUrl = canvasEl.toDataURL('image/jpeg', 0.78);
      await onAnalyzeCurrentFrameInBrain(dataUrl);
      setStatusNoteHe('הפריים החי נשלח ונותח במוח המרכזי מול נתוני הצ׳אט והשמע.');
    } finally {
      setAnalyzingFrame(false);
    }
  };

  const v = multimodal.visual;
  const a = multimodal.audio;

  return (
    <section className="border border-[#1E2636] bg-[#0F1520] rounded-xl p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1E2636] pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Live Multimodal Observer — ניתוח וידאו, דיבור, רגשות זהיר ומוזיקה
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            קולט אך ורק מקורות מדיה מורשים שחיברת במפורש. כאשר אין מקור מחובר — המערכת מדווחת על כך בשקיפות ואינה ממציאה מדדים.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleStartWebcamAndMic}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#182234] text-slate-100 hover:bg-[#223049] border border-[#2A3954] transition-colors whitespace-nowrap shrink-0"
          >
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            חבר מצלמה ומיקרופון
          </button>

          <button
            onClick={handleStartScreenShare}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#182234] text-slate-100 hover:bg-[#223049] border border-[#2A3954] transition-colors whitespace-nowrap shrink-0"
          >
            <Monitor className="w-3.5 h-3.5 text-cyan-400" />
            שתף מסך/לשונית עם שמע
          </button>

          <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#182234] text-slate-100 hover:bg-[#223049] border border-[#2A3954] transition-colors cursor-pointer whitespace-nowrap shrink-0">
            <FileVideo className="w-3.5 h-3.5 text-emerald-400" />
            טען קובץ וידאו לבדיקה
            <input type="file" accept="video/*,audio/*" onChange={handleVideoFileSelected} className="hidden" />
          </label>

          {captureMode !== 'NONE' && (
            <button
              onClick={() => void cleanupMedia(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-rose-950/60 text-rose-200 hover:bg-rose-900/70 border border-rose-800/60 transition-colors whitespace-nowrap shrink-0"
            >
              <Square className="w-3.5 h-3.5" />
              נתק מקור מדיה
            </button>
          )}
        </div>
      </div>

      {statusNoteHe && (
        <div className="text-xs text-amber-200 bg-[#151D2C] border border-[#26334D] rounded-lg px-4 py-2.5">
          {statusNoteHe}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Live Video Preview & Visual Scene Analysis */}
        <div className="lg:col-span-5 flex flex-col justify-between border border-[#1E2636] rounded-lg p-4 bg-[#0B0E14]">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium text-slate-200">תצפית פריים וידאו והגנת נראות המצולם</span>
              <span className="font-mono tabular-nums">
                {v.sourceConnected ? `מחובר (${v.sourceType})` : 'לא מחובר וידאו'}
              </span>
            </div>

            <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-[#070A0F] border border-[#1E2636] flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted={captureMode === 'WEBCAM'}
                className={`w-full h-full object-cover ${captureMode === 'NONE' ? 'hidden' : 'block'}`}
              />
              <canvas ref={canvasRef} className="hidden" />
              {captureMode === 'NONE' && (
                <div className="text-center px-6 py-8 space-y-1.5">
                  <p className="text-sm font-medium text-slate-300">אין מקור וידאו מחובר כרגע</p>
                  <p className="text-xs text-slate-500">
                    חבר מצלמה, שיתוף מסך של השידור או קובץ וידאו כדי למדוד תנועה, תאורה, עומס חזותי ובדיקת לפני/אחרי VFX.
                  </p>
                </div>
              )}
            </div>

            {v.sourceConnected ? (
              <div className="grid grid-cols-3 gap-3 pt-2 text-xs border-t border-[#1E2636]">
                <div>
                  <div className="text-slate-400">מדד תנועה</div>
                  <div className="text-base font-semibold text-slate-100 font-mono tabular-nums">
                    {v.motionIndexPct}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">בהירות תאורה</div>
                  <div className="text-base font-semibold text-slate-100 font-mono tabular-nums">
                    {v.lightingBrightnessPct}%
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">עומס חזותי</div>
                  <div
                    className={`text-base font-semibold font-mono tabular-nums ${
                      v.subjectOccludedByVfx ? 'text-rose-400' : 'text-slate-100'
                    }`}
                  >
                    {v.visualClutterPct}%
                  </div>
                </div>
                <div className="col-span-3 text-slate-300 space-y-1 pt-1">
                  <div>
                    גוון שלט: <span className="text-slate-100">{v.dominantColorToneHe}</span>
                    <span aria-hidden="true"> · </span>
                    סימן חזותי: <span className="text-slate-100">{v.visibleExpressionCueHe || 'יציב'}</span>
                  </div>
                  <div className={v.subjectOccludedByVfx ? 'text-rose-300 font-medium' : 'text-slate-400'}>
                    {v.beforeAfterVfxComparisonHe || 'בדיקת לפני/אחרי VFX תקינה'}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 pt-1">
                מדדי תנועה, תאורה והסתרת מצולם יוצגו רק כאשר מקור וידאו פעיל.
              </p>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-[#1E2636] flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">שליחת פריים לבדיקה מולטימודלית במוח</span>
            <button
              onClick={handleSendFrameToBrain}
              disabled={!v.sourceConnected || analyzingFrame}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
            >
              {analyzingFrame ? 'מנתח פריים...' : 'נתח פריים חי במוח המרכזי'}
            </button>
          </div>
        </div>

        {/* Right: Audio & Music FFT + Multilingual STT + Careful Affect */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-5">
          {/* Audio & Music Intelligence */}
          <div className="border border-[#1E2636] rounded-lg p-4 bg-[#0B0E14] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  ניתוח אודיו, קצב מוזיקלי (BPM) ובהירות דיבור מול אפקטים
                </h3>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {a.sourceConnected ? 'ערוץ שמע מחובר' : 'אין מקור אודיו מחובר'}
              </span>
            </div>

            {a.sourceConnected ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-[#1E2636] text-xs">
                <div>
                  <div className="text-slate-400">עוצמת RMS</div>
                  <div className="text-base font-semibold text-slate-100 font-mono tabular-nums">
                    {a.rmsLoudnessDb !== null ? `${a.rmsLoudnessDb} dB` : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">BPM משוער</div>
                  <div className="text-base font-semibold text-slate-100 font-mono tabular-nums">
                    {a.estimatedBpm !== null ? `${a.estimatedBpm} BPM` : 'אוסף פעימות'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">בהירות תדר דיבור</div>
                  <div
                    className={`text-base font-semibold font-mono tabular-nums ${
                      a.sfxImpairingSpeech ? 'text-rose-400' : 'text-emerald-300'
                    }`}
                  >
                    {a.speechBandClarityPct !== null ? `${a.speechBandClarityPct}%` : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">זיהוי שקט</div>
                  <div className="text-base font-semibold text-slate-100 font-mono tabular-nums">
                    {a.silenceDetected ? `${(a.silenceDurationMs / 1000).toFixed(1)}s שקט` : 'פעיל'}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-4 text-slate-300 pt-1">
                  אבחון סאונד: <span className="text-slate-100">{a.musicSpeechAlignmentHe}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 pt-2 border-t border-[#1E2636]">
                {a.sourceLabelHe}
              </div>
            )}
          </div>

          {/* Speech Transcription (STT) & Speaker Attribution */}
          <div className="border border-[#1E2636] rounded-lg p-4 bg-[#0B0E14] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  תמלול דיבור רב-לשוני (STT) וחיבור אוטומטי לתגובות הצ׳אט
                </h3>
                <p className="text-xs text-slate-400">
                  מתמלל דגימת שמע אמיתית של 5 שניות מהמקור המחובר ומצליב מול הודעות צופים ב-10 השניות העוקבות.
                </p>
              </div>
              <button
                onClick={handleCapture5sSpeechTranscript}
                disabled={transcribing || !a.sourceConnected}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
              >
                {transcribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
                {transcribing ? 'מקליט ומתמלל (5 שנ׳)...' : 'דגום ותמלל 5 שנ׳ דיבור חי'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-300">
                <span>דובר משויך:</span>
                <input
                  type="text"
                  value={speakerLabelInput}
                  onChange={(e) => setSpeakerLabelInput(e.target.value)}
                  className="bg-[#121926] border border-[#26334D] rounded px-2.5 py-1 text-xs text-slate-100 w-36"
                />
              </label>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={speakerVerifiedToggle}
                  onChange={(e) => setSpeakerVerifiedToggle(e.target.checked)}
                />
                <span>דובר מזוהה בוודאות (אם לא מסומן — יסומן כהשערת ייחוס דובר)</span>
              </label>
            </div>

            <div className="divide-y divide-[#1E2636] border-t border-[#1E2636] pt-2 max-h-36 overflow-y-auto">
              {multimodal.recentTranscripts.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  טרם נקלטו מקטעי דיבור מתומללים בסשן זה (תומך גם בכתוביות דיבור חיות מטיקטוק וגם בדגימת מיקרופון/שמע).
                </p>
              ) : (
                multimodal.recentTranscripts.slice(0, 5).map((seg) => (
                  <div key={seg.segmentId} className="py-2 text-xs space-y-0.5">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>
                        @{seg.speakerLabel}
                        <span aria-hidden="true"> · </span>
                        {seg.speakerVerified ? 'דובר מאומת' : 'ייחוס דובר משוער'}
                        <span aria-hidden="true"> · </span>
                        {seg.language}
                      </span>
                      <span className="font-mono tabular-nums">
                        {seg.speechRateWpm ? `${seg.speechRateWpm} מילים/דקה · ` : ''}
                        {seg.linkedChatEventIds.length} תגובות צ׳אט סמוכות
                      </span>
                    </div>
                    <p className="text-slate-100">"{seg.text}"</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Careful Affect & Atmosphere Estimation */}
          <div className="border border-[#1E2636] rounded-lg p-4 bg-[#0B0E14] space-y-2">
            <h3 className="text-sm font-semibold text-slate-100">
              הערכת אווירה ואותות רגש חיצוניים (מבוסס ראיות נצפות בלבד)
            </h3>
            {multimodal.affectEstimates.length === 0 ? (
              <p className="text-xs text-slate-500">
                הערכות אווירה מוצגות רק כאשר קיימות ראיות קול, תנועה או קצב קהל נמדדות — המערכת לעולם אינה מתיימרת לקרוא מחשבות.
              </p>
            ) : (
              multimodal.affectEstimates.slice(0, 2).map((est) => (
                <div key={est.estimateId} className="text-xs space-y-1 pt-1 border-t border-[#1E2636]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200">{est.labelHe}</span>
                    <span className="font-mono tabular-nums text-slate-400">
                      ביטחון {Math.round(est.confidence * 100)}%
                    </span>
                  </div>
                  <div className="text-slate-300">ראיות: {est.observableEvidenceHe.join(' · ')}</div>
                  <div className="text-slate-500">{est.epistemicDisclaimerHe}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
