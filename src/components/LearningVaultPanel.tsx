import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from 'react';
import {
  FileAudio,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { LearningMaterialKind, LearningVaultItem } from '../data/boosteraCatalog';
import { soundEngine } from '../engine/soundEngine';

interface LearningVaultPanelProps {
  items: LearningVaultItem[];
  refreshState: () => Promise<void>;
  compact?: boolean;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return 'טקסט חכם';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function KindBadge({ kind }: { kind: LearningMaterialKind }) {
  if (kind === 'VIDEO') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/35">
        <Video className="w-3 h-3" />
        וידאו
      </span>
    );
  }
  if (kind === 'AUDIO') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/35">
        <FileAudio className="w-3 h-3" />
        אודיו
      </span>
    );
  }
  if (kind === 'IMAGE') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/35">
        <ImageIcon className="w-3 h-3" />
        תמונה / צילום
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
      <FileText className="w-3 h-3" />
      {kind === 'NOTE' ? 'פתק / תמליל' : 'מסמך / PDF'}
    </span>
  );
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const str = String(reader.result || '');
      const idx = str.indexOf(',');
      resolve(idx >= 0 ? str.slice(idx + 1) : str);
    };
    reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
    reader.readAsDataURL(file);
  });
}

async function sampleVideoKeyframes(
  file: File
): Promise<{ frames: Array<{ base64: string; mimeType: string; timeSec: number }>; durationSec: number }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('שגיאה בטעינת קובץ הווידאו'));
    });

    const durationSec = Math.max(1, video.duration || 20);
    const canvas = document.createElement('canvas');
    const targetW = 460;
    const aspect = video.videoHeight && video.videoWidth ? video.videoHeight / video.videoWidth : 16 / 9;
    canvas.width = targetW;
    canvas.height = Math.round(targetW * aspect);
    const ctx = canvas.getContext('2d');

    const frames: Array<{ base64: string; mimeType: string; timeSec: number }> = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      const t = Number((((i + 0.5) / count) * durationSec).toFixed(1));
      video.currentTime = t;
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
      });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        const b64 = dataUrl.split(',')[1] || '';
        if (b64) {
          frames.push({ base64: b64, mimeType: 'image/jpeg', timeSec: t });
        }
      }
    }
    return { frames, durationSec };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LearningVaultPanel({ items, refreshState, compact = false }: LearningVaultPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [userContextNoteHe, setUserContextNoteHe] = useState('');
  const [quickNoteTitle, setQuickNoteTitle] = useState('');
  const [quickNoteBody, setQuickNoteBody] = useState('');
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [statusHe, setStatusHe] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const activeItem: LearningVaultItem | null =
    items.find((i) => i.id === selectedId) || items[0] || null;

  const processSelectedFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (let idx = 0; idx < fileList.length; idx++) {
        const file = fileList[idx];
        setStatusHe(`קורא ומפרק את "${file.name}" בתיקיית הלמידה (${idx + 1}/${fileList.length})...`);

        const mime = (file.type || '').toLowerCase();
        const lowerName = file.name.toLowerCase();
        const isVideo = mime.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/.test(lowerName);
        const isTextLike =
          mime.startsWith('text/') || /\.(txt|md|csv|json|srt|vtt|log)$/.test(lowerName);

        let textContent: string | undefined;
        let base64Data: string | undefined;
        let videoFrames: Array<{ base64: string; mimeType: string; timeSec: number }> | undefined;
        let durationSec: number | undefined;

        if (isTextLike) {
          textContent = await file.text();
        } else if (isVideo) {
          try {
            const sampled = await sampleVideoKeyframes(file);
            videoFrames = sampled.frames;
            durationSec = sampled.durationSec;
          } catch {
            // Fallback to raw base64 if small enough
          }
          if (file.size <= 10 * 1024 * 1024) {
            base64Data = await readFileAsBase64(file);
          }
        } else if (file.size <= 22 * 1024 * 1024) {
          base64Data = await readFileAsBase64(file);
        }

        const resp = await fetch('/api/learning-vault/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            base64Data,
            textContent,
            videoFrames,
            durationSec,
            userNoteHe: userContextNoteHe.trim() || undefined,
          }),
        });
        const json = await resp.json();
        if (!resp.ok) {
          setStatusHe(json.error || `שגיאה בפריקת הקובץ ${file.name}`);
        } else if (json.item?.id) {
          setSelectedId(json.item.id);
          setStatusHe(
            `פורק ונלמד "${file.name}"! נוצר חוק אנרגיה ("${json.newRule?.titleHe}") + כלי חדש ("${json.newTool?.nameHe}").`
          );
        }
      }
      setUserContextNoteHe('');
      await refreshState();
    } catch {
      setStatusHe('שגיאה בהעלאה או פירוק הקובץ בתיקיית הלמידה.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    void processSelectedFiles(e.target.files);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    void processSelectedFiles(e.dataTransfer.files);
  };

  const handleSaveTextNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!quickNoteBody.trim()) return;
    setUploading(true);
    const titleClean = (quickNoteTitle.trim() || `תמליל_ואסטרטגיה_${items.length + 1}`).replace(/\s+/g, '_');
    setStatusHe('קורא, מפרק ומחלץ כלים מתוך הטקסט שהזנת לתיקיית הלמידה...');
    try {
      const resp = await fetch('/api/learning-vault/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `${titleClean}.note`,
          mimeType: 'text/plain',
          sizeBytes: quickNoteBody.length,
          textContent: quickNoteBody.trim(),
          userNoteHe: userContextNoteHe.trim() || undefined,
        }),
      });
      const json = await resp.json();
      if (resp.ok && json.item) {
        setSelectedId(json.item.id);
        setQuickNoteTitle('');
        setQuickNoteBody('');
        setShowNoteComposer(false);
        setStatusHe(
          `החומר נקרא ופורק! הופק חוק "${json.newRule?.titleHe}" וכלי במה חדש "${json.newTool?.nameHe}".`
        );
        await refreshState();
      } else {
        setStatusHe(json.error || 'שגיאה בשמירת הטקסט בתיקיית הלמידה.');
      }
    } catch {
      setStatusHe('שגיאת תקשורת בשמירת חומר הלמידה.');
    } finally {
      setUploading(false);
    }
  };

  const handleApplyVaultItemToStage = async (vaultItemId: string) => {
    soundEngine.ensureInitialized();
    setBusyItemId(vaultItemId);
    try {
      const resp = await fetch('/api/tiktok/apply-creator-playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vaultItemId }),
      });
      const json = await resp.json();
      await refreshState();
      if (json.executedSummaryHe) {
        setStatusHe(json.executedSummaryHe);
      }
    } catch {
      setStatusHe('שגיאה בהפעלת המסקנה על הבמה.');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleReanalyze = async (id: string) => {
    setBusyItemId(id);
    setStatusHe('קורא ומפרק מחדש לעומק את הקובץ מתוך תיקיית הלמידה...');
    try {
      const resp = await fetch('/api/learning-vault/reanalyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json = await resp.json();
      await refreshState();
      if (resp.ok && json.item) {
        setStatusHe(`הקובץ "${json.item.fileName}" נקרא ופורק מחדש בהצלחה!`);
      }
    } catch {
      setStatusHe('שגיאה בקריאה חוזרת של הקובץ.');
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyItemId(id);
    try {
      await fetch('/api/learning-vault/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (selectedId === id) setSelectedId(null);
      await refreshState();
    } finally {
      setBusyItemId(null);
    }
  };

  return (
    <section
      className="bg-[#121722] border border-emerald-500/35 rounded-xl p-5 space-y-4"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <FolderOpen className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100 font-display">
              תיקיית למידה חכמה — העלאת חומרים, קריאה ופירוק אוטומטי ע״י ה-AI
            </h2>
            <span className="text-xs font-mono tabular-nums text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
              {items.length} קבצים מפורקים בתיקייה
            </span>
          </div>
          <p className="text-xs text-slate-400">
            העלה לכאן וידאו מקרבות, הקלטות אודיו, צילומי מסך, PDF, קובצי טקסט או תמלילים — ה-AI קורא הכל, מפרק לחלקים ומסקנות, ומייצר לבד חוקי אנרגיה וכלים חדשים לבמה שלך!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowNoteComposer((v) => !v)}
            className="px-3 py-2 rounded-lg bg-[#0B0E14] border border-[#283246] hover:border-emerald-500/60 text-xs font-semibold text-slate-200 transition-colors"
          >
            {showNoteComposer ? 'סגור עורך טקסט' : '+ הדבק טקסט / אסטרטגיה לתיקייה'}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{uploading ? 'מפרק וקורא חומר...' : 'העלה קבצים לתיקיית הלמידה'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".mp4,.mov,.webm,.mp3,.wav,.m4a,.ogg,.png,.jpg,.jpeg,.webp,.pdf,.txt,.md,.csv,.json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Drag & Drop + Context Note Bar */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`rounded-xl border border-dashed p-3.5 transition-colors flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${
          dragActive
            ? 'border-emerald-400 bg-emerald-500/10'
            : 'border-[#2A3650] bg-[#0B0E14]'
        }`}
      >
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300"
        >
          <Upload className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            גרור לכאן קובץ <span className="text-emerald-300 font-semibold">וידאו / אודיו / תמונה / PDF / TXT / JSON</span> או לחץ לבחירה כדי שה-AI יפרק ויקרא אותו לעומק
          </span>
        </div>

        <input
          type="text"
          value={userContextNoteHe}
          onChange={(e) => setUserContextNoteHe(e.target.value)}
          placeholder="דגש אופציונלי ל-AI (למשל: שים לב איך הוא פותח כפפה או מגיב לענן)..."
          className="md:w-80 bg-[#121722] border border-[#253047] rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Optional Quick Text / Playbook Composer */}
      {showNoteComposer && (
        <form
          onSubmit={handleSaveTextNote}
          className="bg-[#0B0E14] border border-[#243047] rounded-xl p-4 space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={quickNoteTitle}
              onChange={(e) => setQuickNoteTitle(e.target.value)}
              placeholder="כותרת החומר בתיקייה (למשל: אסטרטגיית שבירת ענן וסנייפ ב-10 שניות)"
              className="flex-1 bg-[#121722] border border-[#283246] rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={uploading || !quickNoteBody.trim()}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-colors shrink-0"
            >
              שמור בתיקייה, פרק ולמד עכשיו
            </button>
          </div>
          <textarea
            rows={3}
            value={quickNoteBody}
            onChange={(e) => setQuickNoteBody(e.target.value)}
            placeholder="הדבק כאן תמליל של שידור, חוקי באטל, רשימת טריגרים, או הערות מהשטח — ה-AI יקרא, יפרק לסעיפים ויבנה מהם כלי אוטומטי..."
            className="w-full bg-[#121722] border border-[#283246] rounded-lg p-3 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </form>
      )}

      {statusHe && (
        <div className="bg-[#0B0E14] border border-emerald-500/35 rounded-lg px-3.5 py-2 text-xs text-emerald-200">
          {statusHe}
        </div>
      )}

      {/* Explorer Grid: Left = Folder File List, Right = Deep Deconstruction Reader */}
      {items.length > 0 && (
        <div className={`grid grid-cols-1 ${compact ? 'lg:grid-cols-12' : 'lg:grid-cols-12'} gap-4`}>
          {/* Folder Files Column */}
          <div className="lg:col-span-5 bg-[#0B0E14] border border-[#1E2636] rounded-xl p-3 space-y-2 max-h-80 overflow-y-auto">
            <div className="text-xs font-bold text-slate-300 px-1 flex items-center justify-between">
              <span>קבצים בתיקיית הלמידה (`data/learning_vault`)</span>
              <span className="text-[11px] text-slate-500">לחץ לקריאת הפירוק</span>
            </div>

            {items.map((item) => {
              const isSelected = activeItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-colors space-y-1 ${
                    isSelected
                      ? 'bg-[#162032] border-emerald-500/60'
                      : 'bg-[#121722] border-[#1E2636] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-100 truncate">{item.fileName}</span>
                    <KindBadge kind={item.kind} />
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{item.overviewHe}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 tabular-nums pt-0.5">
                    <span>{formatFileSize(item.sizeBytes)}</span>
                    <span className="text-amber-300/90 truncate max-w-[170px]">
                      כלי: {item.generatedToolNameHe}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected File Deep Deconstruction Inspector */}
          {activeItem && (
            <div className="lg:col-span-7 bg-[#0B0E14] border border-[#1E2636] rounded-xl p-4 space-y-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#1E2636] pb-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <KindBadge kind={activeItem.kind} />
                    <h3 className="text-sm font-bold text-slate-100 truncate">{activeItem.fileName}</h3>
                  </div>
                  <p className="text-xs text-emerald-300 leading-relaxed">{activeItem.overviewHe}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={busyItemId === activeItem.id}
                    onClick={() => handleApplyVaultItemToStage(activeItem.id)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>הפעל מסקנה בבמה!</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyItemId === activeItem.id}
                    onClick={() => handleReanalyze(activeItem.id)}
                    title="קרא ופרק מחדש ב-AI"
                    className="p-1.5 rounded-lg bg-[#161F30] hover:bg-[#1F2B42] text-slate-200 border border-[#28344E] transition-colors"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${busyItemId === activeItem.id ? 'animate-spin text-amber-400' : ''}`}
                    />
                  </button>
                  <button
                    type="button"
                    disabled={busyItemId === activeItem.id}
                    onClick={() => handleDelete(activeItem.id)}
                    title="מחק מתיקיית הלמידה"
                    className="p-1.5 rounded-lg bg-[#161F30] hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-[#28344E] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Deconstructed Parts & Conclusions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-[#121722] border border-[#1E2636] rounded-lg p-3 space-y-1.5">
                  <div className="font-bold text-slate-200">פירוק החומר לחלקים (מה נקרא בפנים):</div>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside leading-relaxed">
                    {activeItem.breakdownPartsHe.map((part, idx) => (
                      <li key={idx}>{part}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-[#121722] border border-[#1E2636] rounded-lg p-3 space-y-2">
                  <div className="font-bold text-amber-300">מה ה-AI הסיק וייצר מתוך החומר:</div>
                  <ul className="space-y-1 text-slate-200 list-disc list-inside leading-relaxed">
                    {activeItem.conclusionsHe.map((conc, idx) => (
                      <li key={idx}>{conc}</li>
                    ))}
                  </ul>
                  <div className="pt-2 border-t border-[#1E2636] space-y-1 text-[11px]">
                    <div className="text-emerald-300">
                      <Sparkles className="w-3 h-3 inline ml-1" />
                      <span className="font-semibold">חוק שהוטמע:</span> {activeItem.generatedRuleTitleHe}
                    </div>
                    <div className="text-sky-300">
                      <span className="font-semibold">כלי חדש שנוצר:</span> {activeItem.generatedToolNameHe} (
                      {activeItem.recommendedVfxId} + {activeItem.recommendedCamera})
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
