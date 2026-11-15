import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, Brain, CheckCircle2, ChevronDown, CircleAlert, Copy, Download,
  Flame, Gauge, MessageCircle, Pause, Play, Plus, Radio, RefreshCw,
  ShieldCheck, Sparkles, Users, Video, Volume2, X, Zap,
} from 'lucide-react';

type Advice = {
  id: string; title: string; rationale: string; create: string;
  priority: number; format: string; evidence: string; source: string;
};
type Question = {
  count: number; category: string; label: string; example: string;
  uniqueAskers: number; draft: string;
};
type Live = {
  username: string; status: string; lastAt: number; error?: string;
  metrics: {
    sampleSec: number; likesPerSec: number; likes10: number; chat60: number;
    chatPerSec: number; shares60: number; follows60: number;
    viewerCount: number | null; chatOverloaded: boolean; trend: string;
    topics: Array<{ term: string; count: number }>; questions: Question[];
    captions: Array<{ text: string; at: number }>;
    visual?: { motion: number; brightness: number; audioRms: number; audioConnected: boolean };
    evidenceCoverage: { video: boolean; audio: boolean; captions: boolean };
  };
  battle: {
    active: boolean; opponent?: string | null; hostPoints: number | null;
    opponentPoints: number | null; card?: string | null;
    clock?: { source:string; seconds:number|null; remainingSec:number|null; durationSec:number|null; official:boolean };
    scoreVerified?: boolean;
  };
  recommendations: Advice[];
  director?: { effect:string; opacity:number; maxDurationMs:number; mood:string; soundGain:number; reasonHe:string; automatic:boolean };
};
type Intelligence = {
  version: string; source: string; capacity: number; liveCount: number;
  lives: Live[];
  comparison: {
    ranked: Array<{ username: string; likesPerSec: number; chatPerSec: number; reliable: boolean; score: number }>;
    overloaded: string[]; actions: Advice[]; note: string;
  };
  updatedAt: number;
};
type GeminiReview = {
  at: number | null; source: string[];
  result: {
    summaryHe?: string; ideas?: Array<{
      title: string; trigger: string; evidence: string; creationBrief: string; confidence: string;
    }>; chatActionHe?: string;
  } | null;
};
type Capture = {
  stream: MediaStream; video: HTMLVideoElement; timer: number;
  audioContext?: AudioContext; analyser?: AnalyserNode;
  data?: Float32Array; previous?: Uint8ClampedArray; energy: number;
};
const fmt = (v: number) => Number(v || 0).toLocaleString('en-US');
const nameFrom = (raw: string): string | null => {
  const text = raw.trim();
  const matched = text.match(/^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@([A-Za-z0-9._]{2,32})(?:\/live)?(?:\/.*)?(?:\?.*)?$/i);
  const value = matched?.[1] ?? text.replace(/^@/, '');
  return /^[A-Za-z0-9._]{2,32}$/.test(value) ? value : null;
};
const buildCreativeBrief = (idea: Advice) => [
  'BOOSTERA — הוראת יצירה מבוססת TikTok LIVE',
  'מקור: @' + idea.source,
  'מסקנה: ' + idea.title,
  'ראיות: ' + idea.rationale,
  'מה ליצור: ' + idea.create,
  'פורמט: ' + idea.format,
  'מפרט: מסך אנכי 9:16, שכבת alpha שקופה, ללא תמונת קיר.',
  'ברירת מחדל: אפקטים עדינים מאוד, השארת הפנים פנויות.',
  'פיק חריג: שיא קצר עד 3 שניות, נדרשת אמת עובדתית מנתוני הלייב.',
  'אין יצירת נתונים, ניקוד או טענות על אודיו/וידאו שלא נצפו.',
].join('\n');
const request = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, { ...init, headers: {
    ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init?.headers || {}),
  }, cache: 'no-store' });
  let json: any; try { json = await r.json(); } catch { json = {}; }
  if (!r.ok) throw Error(String(json.error || 'HTTP ' + r.status));
  return json;
};

export function LiveIntelligenceWorkspace({ onOpenOriginalWatchlist }: { onOpenOriginalWatchlist?: () => void }) {
  const [data, setData] = useState<Intelligence | null>(null);
  const [handle, setHandle] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [editingFacts, setEditingFacts] = useState<string | null>(null);
  const [factsText, setFactsText] = useState('');
  const [selectedLive, setSelectedLive] = useState<string | null>(null);
  const [gemini, setGemini] = useState<GeminiReview | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [capturesActive, setCapturesActive] = useState<string[]>([]);
  const captures = useRef<Map<string, Capture>>(new Map());
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const snapshot = await request('/api/intelligence/status') as Intelligence;
      setData(snapshot);
    } catch (err) {
      setAlert(err instanceof Error ? err.message : 'לא ניתן לקבל נתוני לייב');
    } finally { inFlight.current = false; }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1850);
    request('/api/intelligence/ai-review/latest').then((x: GeminiReview) => setGemini(x)).catch(() => {});
    return () => { window.clearInterval(timer); };
  }, [refresh]);

  const stopCapture = useCallback((name: string) => {
    const capture = captures.current.get(name);
    if (!capture) return;
    window.clearInterval(capture.timer);
    capture.stream.getTracks().forEach(track => track.stop());
    capture.video.pause();capture.video.srcObject = null;
    capture.audioContext?.close().catch(() => {});
    captures.current.delete(name);
    setCapturesActive([...captures.current.keys()]);
    void fetch('/api/intelligence/visual', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name, active: false }),
    }).catch(() => {});
  }, []);

  useEffect(() => () => {
    for (const [name, capture] of captures.current) {
      window.clearInterval(capture.timer);
      capture.stream.getTracks().forEach(track => track.stop());
      capture.video.pause();capture.audioContext?.close().catch(() => {});
      captures.current.delete(name);
    }
  }, []);

  const openCapture = async (name: string) => {
    if (captures.current.has(name)) { stopCapture(name); return; }
    if (captures.current.size >= 3) {
      setAlert('אפשר למדוד תמונה וקול בשלושה חלונות במקביל; מעקב האירועים ממשיך עד עשרה.');
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) { setAlert('הדפדפן אינו תומך בשיתוף חלון.'); return; }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); }
    catch { setAlert('שיתוף החלון בוטל. נתוני הצ׳אט והלייקים ממשיכים להתעדכן.'); return; }
    const video = document.createElement('video');
    video.autoplay = true; video.muted = true; video.playsInline = true; video.srcObject = stream;
    try { await video.play(); }
    catch { stream.getTracks().forEach(t => t.stop());setAlert('לא ניתן לקרוא את חלון הלייב.');return; }
    const canvas = document.createElement('canvas');canvas.width = 80;canvas.height = 45;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) { stream.getTracks().forEach(t => t.stop()); return; }
    let ac: AudioContext | undefined, analyser: AnalyserNode | undefined;
    let samples: Float32Array | undefined;
    try {
      if (stream.getAudioTracks().length) {
        ac = new AudioContext();await ac.resume();
        analyser = ac.createAnalyser();analyser.fftSize = 512;
        ac.createMediaStreamSource(stream).connect(analyser);
        samples = new Float32Array(analyser.fftSize);
      }
    } catch { analyser = undefined;samples = undefined;ac?.close().catch(() => {});ac = undefined; }
    const cap: Capture = { stream, video, timer: 0, audioContext: ac, analyser, data: samples, energy: 0 };
    captures.current.set(name, cap);setCapturesActive([...captures.current.keys()]);
    stream.getVideoTracks()[0]?.addEventListener('ended', () => stopCapture(name), { once: true });
    const sample = async () => {
      if (!captures.current.has(name) || video.readyState < 2) return;
      try {
        ctx.drawImage(video, 0, 0, 80, 45);
        const raw = ctx.getImageData(0, 0, 80, 45).data;
        let brightness = 0, movement = 0, saturation = 0, n = 0;
        for (let i = 0; i < raw.length; i += 12) {
          const r = raw[i],g = raw[i+1],b = raw[i+2];
          brightness += (.2126*r+.7152*g+.0722*b)/255;
          saturation += (Math.max(r,g,b)-Math.min(r,g,b))/255;
          if (cap.previous) movement += (Math.abs(r-cap.previous[i])+
            Math.abs(g-cap.previous[i+1])+Math.abs(b-cap.previous[i+2]))/(255*3);
          n++;
        }
        cap.previous = new Uint8ClampedArray(raw);
        let rms = 0, beat = 0;
        if (cap.analyser && cap.data) {
          cap.analyser.getFloatTimeDomainData(cap.data as Float32Array<ArrayBuffer>);
          for (const x of cap.data) rms += x*x;
          rms = Math.min(1,Math.sqrt(rms / cap.data.length)*2.1);
          beat = rms > Math.max(.13,cap.energy*1.7)?1:0;
          cap.energy = cap.energy*.82+rms*.18;
        }
        await request('/api/intelligence/visual', { method: 'POST', body: JSON.stringify({
          username: name, brightness: brightness/n, motion: Math.min(1,(movement/n)*2.1),
          saturation: saturation/n, audioRms: rms, beat, audioConnected: !!cap.analyser,
        }) });
      } catch { /* A closed capture or offline service must never interrupt the UI */ }
    };
    cap.timer = window.setInterval(() => { void sample(); }, 1600);
    void sample();
    setAlert('בחרת חלון עבור @'+name+'. רק מדדים מספריים נשלחים לשרת; לא מועלים פריימים או הקלטת קול.');
  };

  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = nameFrom(handle);
    if (!name) { setAlert('הזן @username תקין או קישור TikTok LIVE.'); return; }
    setConnecting(true);setAlert(null);
    try {
      const result = await request('/api/tiktok/connect-room', { method:'POST',
        body:JSON.stringify({ username:name, listenMode:'OBSERVER_LEARN', mirrorToStage:false }) });
      setAlert(result.connected ? 'מחובר למעקב אחרי @'+name :
        result.errorHe || 'החשבון נוסף למעקב. ייתכן שהוא אינו בשידור כרגע.');
      setHandle('');void refresh();
    } catch (err) { setAlert(err instanceof Error ? err.message : 'החיבור נכשל'); }
    finally { setConnecting(false); }
  };

  const scanSaved = async () => {
    setScanning(true);
    try {
      const result = await request('/api/tiktok/connect-all-live', { method:'POST',
        body:JSON.stringify({ includeGlobal:false }) });
      setAlert('סריקה הסתיימה: '+(result.activeStreamsCount||0)+' לייבים מחוברים.');
      void refresh();
    } catch (err) {setAlert(err instanceof Error ? err.message : 'שגיאה בסריקה')}
    finally {setScanning(false)}
  };

  const openFacts = async (username: string) => {
    setEditingFacts(username);
    try {
      const x = await request('/api/intelligence/facts?username='+encodeURIComponent(username));
      setFactsText(String(x.facts||''));
    } catch { setFactsText(''); }
  };
  const saveFacts = async () => {
    if (!editingFacts) return;
    try {
      await request('/api/intelligence/facts',{method:'POST',
        body: JSON.stringify({username:editingFacts,facts:factsText})});
      setAlert('עובדות מאושרות נשמרו עבור @'+editingFacts);
      setEditingFacts(null);void refresh();
    } catch (err) {setAlert(err instanceof Error ? err.message : 'שמירה נכשלה')}
  };
  const runGemini = async () => {
    setAiRunning(true);setAlert('Gemini מנתח את המדדים. זהו שימוש בתשלום ב־API רק בעקבות לחיצה מפורשת.');
    try {
      const a = await request('/api/intelligence/ai-review',{
        method:'POST',body:JSON.stringify({usernames: selectedLive ? [selectedLive] : []}),
      }) as GeminiReview;
      setGemini(a);
      setAlert('הסקירה הושלמה. ההמלצות מוצגות בפאנל; שום אפקט או הודעת צ׳אט לא הופעלו.');
    } catch (err) {setAlert(err instanceof Error ? err.message : 'ניתוח Gemini אינו זמין')}
    finally {setAiRunning(false)}
  };
  const copy = async (text:string) => {
    try {await navigator.clipboard.writeText(text);setAlert('הטקסט הועתק ללוח.');}
    catch {setAlert('העתקה אינה זמינה בדפדפן.')}
  };
  const list = data?.lives || [];
  const actions = data?.comparison.actions || [];
  const totalChats = list.filter(l=>l.status==='live').reduce((s,l)=>s+l.metrics.chat60,0);
  const totalLikes = list.filter(l=>l.status==='live').reduce((s,l)=>s+l.metrics.likesPerSec,0);
  const overload = list.filter(l=>l.metrics.chatOverloaded);
  const questions = list.flatMap(l=>l.metrics.questions.map(q=>({...q,source:l.username})))
    .sort((a,b)=>b.count-a.count).slice(0,8);
  const selected = selectedLive ? list.find(l=>l.username===selectedLive) : null;

  return <div dir="rtl" className="space-y-5">
    <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-l from-[#241b1c] via-[#121925] to-[#0e1420] p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-amber-300 text-xs font-bold tracking-widest">
            <Brain className="w-4 h-4"/> BOOSTERA / LIVE INTELLIGENCE / V11
          </div>
          <h2 className="text-2xl font-bold text-slate-100 mt-2">מוח אחד. עשרה לייבים. החלטות מבוססות נתונים.</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-3xl">
            מחובר למערכת ה־Swarm שכבר בנית. בלי חיבור TikTok כפול:
            מזהה עומסים, שאלות חוזרות, באטלים ושיאי פעילות — ומציע מה ליצור, ולא רק איזה אפקט להפעיל.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={'rounded-full border px-3 py-2 '+(data?'text-emerald-300 border-emerald-500/40':'text-rose-300 border-rose-500/40')}>
            <Radio className="w-3 h-3 inline-block ml-1"/>{data?'מנוע פעיל':'ממתין לשרת'}
          </span>
          <button onClick={()=>void refresh()} className="px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700">
            <RefreshCw className="w-4 h-4"/></button>
        </div>
      </div>
    </div>
    <section className="flex flex-wrap gap-3 items-end p-4 rounded-xl bg-[#121722] border border-[#1E2636]">
      <form onSubmit={connect} className="flex-1 min-w-[260px]">
        <label htmlFor="intelUsername" className="block text-xs text-slate-400 mb-2">הוסף לייב למעקב נפרד</label>
        <div className="flex gap-2">
          <input id="intelUsername" value={handle} onChange={e=>setHandle(e.target.value)}
            placeholder="@username / TikTok LIVE URL"
            className="min-w-0 flex-1 bg-[#0a111c] text-slate-100 border border-[#344153] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500"/>
          <button disabled={connecting} className="flex items-center gap-2 bg-amber-500 text-slate-950 px-4 py-2 font-bold rounded-lg disabled:opacity-60">
            <Plus className="w-4 h-4"/>{connecting?'מתחבר...':'הוסף'}</button>
        </div>
      </form>
      <button disabled={scanning} onClick={()=>void scanSaved()}
        className="border border-[#47576f] rounded-lg px-4 py-3 text-sm flex items-center gap-2 text-slate-200 hover:bg-[#263044]">
        <Radio className="w-4 h-4"/>{scanning?'סורק...':'סרוק רשימת מעקב'}</button>
      {onOpenOriginalWatchlist&&<button onClick={onOpenOriginalWatchlist}
        className="rounded-lg px-4 py-3 text-sm text-cyan-300 border border-cyan-500/40 hover:bg-cyan-900/20">למערכת הלמידה המקורית</button>}
    </section>
    {alert&&<div role="status" className="flex justify-between gap-4 rounded-lg border border-amber-500/30 text-amber-200 bg-amber-800/10 p-3 text-xs">
      <span>{alert}</span><button onClick={()=>setAlert(null)}><X className="w-4 h-4"/></button></div>}
    <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {[
        { label:'חיבורים חיים',value:(data?.liveCount||0)+' / '+(data?.capacity||10),sub:'חיבור אחד לכל לייב',icon:Radio },
        { label:'קצב הלייקים',value:totalLikes.toFixed(1)+'/s',sub:'ממוצע ל־10 שניות',icon:Zap },
        { label:'צ׳אט בדקה',value:fmt(totalChats),sub:'כל השידורים המחוברים',icon:MessageCircle },
        { label:'צ׳אטים עמוסים',value:String(overload.length),sub:'שאלות לתיעדוף',icon:Gauge },
      ].map(k=><div key={k.label} className="bg-[#141c2a] border border-[#2a3546] rounded-xl p-4">
        <div className="flex items-center justify-between text-slate-400 text-xs">{k.label}<k.icon className="w-4 h-4 text-amber-400"/></div>
        <strong className="block text-2xl font-semibold text-slate-100 mt-3">{k.value}</strong>
        <span className="text-[11px] text-slate-500">{k.sub}</span>
      </div>)}
    </section>

    <section className="rounded-xl border border-cyan-600/25 bg-cyan-950/10 p-4 text-sm text-slate-400">
      <div className="flex items-center gap-2 font-bold text-cyan-200 mb-1"><ShieldCheck className="w-4 h-4"/> מה המנוע יודע בפועל</div>
      אירועי TikTok, תגובות, מתנות, שיתופים, צ׳אט וקצב פעילות הם מדדים שנקלטים מהחיבורים.
      כפתור „נתח חלון” מאפשר, לאחר אישורך, למדוד תנועה, תאורה ועוצמת שמע במחשב בלבד.
      <strong className="text-amber-200"> אין עדיין זיהוי סמנטי של הווידאו או תמלול מלא; המערכת לא ממציאה מה נאמר.</strong>
    </section>

    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      <section className="xl:col-span-7 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">לייבים בזמן אמת</h3>
          <span className="text-xs text-slate-500">{list.length} חשבונות שנפתחו למעקב</span>
        </div>
        {!list.length&&<div className="rounded-xl border border-dashed border-[#3d495a] bg-[#111722] text-center p-12">
          <Users className="w-9 h-9 text-amber-400/60 mx-auto mb-4"/>
          <h4 className="text-slate-200 font-bold">הוסף לייב כדי להתחיל ללמוד</h4>
          <p className="text-sm text-slate-400 mt-2">הממצאים מבוססים רק על אירועי TikTok אמיתיים; אין הדמיית מדדים כאילו היו צופים.</p>
        </div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map(l=>{
            const m=l.metrics,idea=l.recommendations[0],active=l.status==='live';
            return <article key={l.username} className={'p-4 rounded-xl border bg-[#111924] '+(m.chatOverloaded?'border-rose-500/45':'border-[#2a374a]')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-bold text-cyan-200 truncate" dir="ltr">@{l.username}</h4>
                  <div className="text-[11px] text-slate-500 mt-1">{m.viewerCount===null?'מספר צופים לא זמין':fmt(m.viewerCount)+' צופים'}</div>
                </div>
                <span className={'rounded-full text-[11px] px-3 py-1 border '+(active?'text-emerald-300 bg-emerald-900/20 border-emerald-500/30':'text-amber-200 border-amber-700/30')}>
                  {active?'● LIVE':l.status==='connecting'?'◌ מתחבר':l.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {[[m.likesPerSec.toFixed(1)+'/s','לייקים'],[String(m.chat60),'צ׳אט/דקה'],[String(m.shares60),'שיתופים']].map(([value,label])=>
                  <div key={label} className="bg-[#0a1420] rounded-md py-3 px-1 text-center">
                    <strong className="text-slate-100 text-base block">{value}</strong><span className="text-[10px] text-slate-500">{label}</span>
                  </div>)}
              </div>
              <div className="flex gap-2 flex-wrap mt-3 text-[11px]">
                {m.chatOverloaded&&<span className="text-rose-300 rounded-md bg-rose-900/20 px-2 py-1">צ׳אט עמוס</span>}
                {l.battle.active&&<span className="text-amber-200 rounded-md bg-amber-900/20 px-2 py-1">Battle @{l.battle.opponent||'?'}</span>}
                {l.battle.active&&<span className={'rounded-md px-2 py-1 '+(l.battle.scoreVerified?'text-emerald-200 bg-emerald-900/20':'text-amber-300 bg-amber-900/20')}>
                  {l.battle.scoreVerified?'ניקוד מאומת: '+l.battle.hostPoints+' : '+l.battle.opponentPoints:'ניקוד בהמתנה לזיהוי שני צדדי הקרב'}
                </span>}
                {l.battle.clock?.seconds!=null&&<span className="text-cyan-200 rounded-md bg-cyan-900/20 px-2 py-1">זמן קרב: {Math.floor(l.battle.clock.seconds/60)}:{String(Math.floor(l.battle.clock.seconds%60)).padStart(2,'0')} · {l.battle.clock.official?'חותמת זמן TikTok':'משוער לפי אירוע TikTok'}</span>}
                {l.battle.active&&l.battle.clock?.remainingSec==null&&<span className="text-amber-200/80 rounded-md bg-amber-900/20 px-2 py-1">אין זמן סיום מאומת — לא מציגים ספירה לאחור</span>}
                {m.trend==='rising'&&<span className="text-emerald-300 rounded-md bg-emerald-900/20 px-2 py-1">↑ פעילות עולה</span>}
                {m.visual&&<span className="text-cyan-300 rounded-md bg-cyan-900/20 px-2 py-1">תנועה {Math.round(m.visual.motion*100)}%</span>}
                {!!m.captions?.length&&<span className="text-cyan-300 rounded-md bg-cyan-900/20 px-2 py-1">כתוביות מקור</span>}
              </div>
              <div className="bg-[#102330] rounded-lg p-3 my-3 text-xs">
                <strong className="text-amber-200 block mb-1">{idea?.title||'ממתין לנתונים'}</strong>
                <span className="text-slate-400">{idea?.rationale||'שידור ללא פעילות נצפית.'}</span>
              </div>
              {l.director&&<div className="text-[11px] text-slate-400 mb-3 rounded-md border border-amber-900/35 bg-amber-900/10 p-2">
                <strong className="text-amber-200">במאי V9: {l.director.effect} · {Math.round(l.director.opacity*100)}%</strong>
                <span className="block mt-1">{l.director.reasonHe}</span>
                <span className="block text-slate-500 mt-1">המלצה בלבד — אין הפעלה אוטומטית דרך מודול הניתוח.</span>
              </div>}
              <div className="flex flex-wrap gap-2">
                <button onClick={()=>void openFacts(l.username)} className="px-3 py-2 rounded-lg text-xs text-slate-200 border border-slate-600 hover:bg-slate-700">תשובות מאושרות</button>
                <button onClick={()=>void openCapture(l.username)}
                  className="px-3 py-2 rounded-lg text-xs text-slate-200 border border-cyan-700 hover:bg-cyan-900/20 flex items-center gap-1">
                  <Video className="w-3 h-3"/>{capturesActive.includes(l.username)?'עצור ניתוח חלון':'נתח חלון ושמע'}</button>
                <button onClick={()=>setSelectedLive(selectedLive===l.username?null:l.username)}
                  className="px-3 py-2 rounded-lg text-xs border border-amber-600/40 text-amber-200 flex items-center gap-1">
                  <ChevronDown className="w-3 h-3"/>{selectedLive===l.username?'סגור פירוט':'פירוט'}</button>
              </div>
              {!!l.error&&<p className="mt-3 text-[11px] text-rose-300">{l.error.slice(0,150)}</p>}
            </article>
          })}
        </div>
        {selected&&<div className="rounded-xl bg-[#151e2d] border border-amber-600/30 p-4">
          <h4 className="text-amber-200 font-semibold">ניתוח @ {selected.username}</h4>
          <p className="text-sm text-slate-400 mt-2">נתונים מצטברים רק כל עוד קיים החיבור הנוכחי. תצפית: {selected.metrics.sampleSec} שניות.</p>
          <p className="text-sm text-slate-400 mt-2">מילות מפתח: {selected.metrics.topics.map(x=>x.term).join(' · ')||'עדיין אין'}</p>
          {selected.metrics.captions.length>0&&<p className="mt-2 text-sm text-slate-300">
            כתוביות שהתקבלו מ־TikTok: {selected.metrics.captions.map(x=>x.text).slice(-2).join(' / ')}</p>}
          {selected.battle.active&&<p className="mt-2 text-sm text-amber-200">באטל מזוהה. נתוני ניקוד מדווחים רק כשהם מתקבלים. {selected.battle.clock?.remainingSec!=null?'זמן לסיום לפי אירוע TikTok: '+selected.battle.clock.remainingSec+' שניות.':'לא התקבל זמן סיום אמיתי מטיקטוק; לא מוצגת ספירה לאחור משוערת.'}</p>}
        </div>}
      </section>
      <aside className="xl:col-span-5 space-y-4">
        <section className="p-4 rounded-xl border border-amber-500/25 bg-[#171b25]">
          <div className="flex gap-2 items-center mb-3"><Flame className="w-5 h-5 text-amber-400"/>
            <h3 className="font-bold text-slate-100">מסקנה ראשונה · מה כדאי לעשות</h3></div>
          {actions[0]?<>
            <h4 className="font-semibold text-amber-200">{actions[0].title}</h4>
            <p className="text-sm text-slate-300 leading-relaxed mt-2">{actions[0].rationale}</p>
            <p className="text-sm text-slate-400 leading-relaxed mt-2">{actions[0].create}</p>
            <span className="text-xs text-slate-500 block mt-2">מקור: @{actions[0].source}</span>
          </>:<p className="text-slate-400 text-sm">אין עדיין אירועי LIVE שמצדיקים מסקנה. אפשר בהחלט לא להפעיל שום אפקט.</p>}
        </section>
        <section className="p-4 rounded-xl border border-[#2b394b] bg-[#121722]">
          <div className="flex items-center gap-2 mb-3"><Sparkles className="text-cyan-300 w-4 h-4"/>
            <h3 className="font-bold text-slate-100">מה ליצור עכשיו</h3></div>
          <div className="space-y-2">
            {actions.slice(0,5).map(a=><div key={a.source+':'+a.id}
              className="border border-[#2a3746] bg-[#0a1623] rounded-lg p-3">
              <strong className="text-sm text-slate-200">{a.title}</strong>
              <span className="block text-xs text-amber-300/90 mt-1">@{a.source} · {a.format}</span>
              <p className="text-xs leading-5 text-slate-400 my-2">{a.create}</p>
              <button onClick={()=>void copy(buildCreativeBrief(a))}
                className="rounded-md px-3 py-1.5 border border-cyan-600/30 text-xs text-cyan-200 flex gap-1 items-center"><Copy className="w-3 h-3"/> העתק פורמט ל־Gemini</button>
            </div>)}
            {!actions.length&&<p className="text-xs text-slate-500">הנחיות יצירה יופיעו רק עם נתונים נצפים.</p>}
          </div>
        </section>
        <section className="p-4 rounded-xl border border-[#2b394b] bg-[#121722]">
          <div className="flex items-center gap-2 mb-3"><MessageCircle className="text-rose-300 w-4 h-4"/>
            <h3 className="font-bold text-slate-100">עומס צ׳אט ושאלות חוזרות</h3>
            <span className="text-[10px] border border-rose-700/30 text-rose-200 px-2 py-1 rounded-full">{overload.length?'OVERLOAD':'READ ONLY'}</span>
          </div>
          <p className="text-[11px] text-slate-500 mb-3">טיוטות לאישור בלבד. שום הודעה לא נשלחת אוטומטית לצופים.</p>
          {questions.slice(0,5).map((q,i)=><div key={i} className="bg-[#091724] border-r-2 border-amber-600/60 p-3 mb-2 rounded-md">
            <strong className="text-xs text-amber-200">{q.count}× @{q.source} · {q.label}</strong>
            <p className="text-xs text-slate-300 mt-2">{q.example}</p>
            <p className="text-xs text-slate-400 mt-2">{q.draft}</p>
            <button onClick={()=>void copy(q.draft)} className="text-cyan-300 text-xs mt-2 flex gap-1 items-center"><Copy className="w-3 h-3"/> העתק תשובה לאישור</button>
          </div>)}
          {!questions.length&&<div className="text-xs text-slate-500">אין כרגע שאלות חוזרות לניתוח.</div>}
        </section>
        <section className="p-4 rounded-xl border border-[#2b394b] bg-[#121722]">
          <div className="flex justify-between items-center gap-2 mb-3">
            <div className="flex gap-2 items-center"><Brain className="text-amber-300 w-4 h-4"/>
              <h3 className="font-bold text-slate-100">תחקור Gemini מבוסס ראיות</h3></div>
            <button onClick={()=>void runGemini()} disabled={aiRunning||!data?.liveCount}
              className="px-3 py-2 rounded-lg bg-amber-500 disabled:opacity-40 text-slate-950 text-xs font-bold flex gap-1 items-center">
              <Sparkles className="w-3 h-3"/>{aiRunning?'מנתח...':'נתח ב־AI'}</button>
          </div>
          <p className="text-xs text-slate-500 mb-3">לפי דרישה בלבד. דורש GEMINI_API_KEY; שימוש ב־API עשוי לעלות כסף. מדדים ושאלות בלבד נשלחים למודל, לא פריימים או שמות צופים.</p>
          {gemini?.result&&<div className="space-y-3">
            <p className="text-sm text-slate-200">{gemini.result.summaryHe}</p>
            {gemini.result.ideas?.map((idea,i)=><div key={i} className="bg-[#0a1623] rounded-lg p-3">
              <strong className="text-amber-300 text-sm">{idea.title}</strong>
              <p className="text-xs text-slate-400 mt-1">{idea.evidence}</p>
              <p className="text-xs text-slate-200 mt-2">{idea.creationBrief}</p>
              <button onClick={()=>void copy(idea.creationBrief)} className="text-cyan-300 text-xs mt-2 flex gap-1 items-center">
                <Copy className="w-3 h-3"/> העתק הנחיה</button>
            </div>)}
            {gemini.result.chatActionHe&&<p className="text-xs text-slate-400">צ׳אט: {gemini.result.chatActionHe}</p>}
          </div>}
          {!gemini?.result&&<div className="text-xs text-slate-500">המודל לא הופעל עדיין. המסקנות האנליטיות פועלות גם בלעדיו.</div>}
        </section>
        <section className="p-4 rounded-xl border border-[#2b394b] bg-[#121722]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-100">השוואת פעילות בין לייבים</h3>
            <a href="/api/intelligence/export.md" download className="text-cyan-300 flex gap-1 items-center text-xs"><Download className="w-4 h-4"/> דוח מסקנות</a>
          </div>
          {data?.comparison.ranked.map((r,i)=><div key={r.username} className="flex justify-between gap-2 text-sm text-slate-300 py-2 border-b border-[#253142]">
            <span>{i+1}. @{r.username}{!r.reliable&&<small className="text-[10px] text-amber-300 mr-2">דגימה קצרה</small>}</span>
            <strong className="text-slate-200">{r.likesPerSec.toFixed(1)} ♥/s</strong></div>)}
          <p className="text-xs text-slate-500 mt-3">דירוג פעילות בלבד — לא איכות תוכן. רצוי לפחות 45 שניות לדגימה.</p>
        </section>
      </aside>
    </div>
    {editingFacts&&<div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#161f2d] p-6 border border-amber-500/30 rounded-2xl shadow-2xl">
        <h3 className="font-bold text-lg text-amber-200 mb-2">עובדות מאושרות — @{editingFacts}</h3>
        <p className="text-xs text-slate-400 mb-4">הכנס רק מידע שאתה יודע בוודאות. המערכת תשתמש בו להכנת תשובות; היא לא תפרסם אוטומטית.</p>
        <textarea rows={7} maxLength={1500} value={factsText} onChange={e=>setFactsText(e.target.value)}
          className="w-full bg-[#080f18] text-slate-200 border border-[#3e4d60] rounded-lg p-3 text-sm resize-y"
          placeholder={'לדוגמה: המוצר זמין כרגע באתר שלנו.\nקישור מסודר נמצא בעמוד הרשמי.'}/>
        <div className="flex gap-2 mt-4">
          <button onClick={()=>void saveFacts()} className="px-5 py-2 bg-amber-500 text-slate-950 font-semibold rounded-lg">שמור עובדות</button>
          <button onClick={()=>setEditingFacts(null)} className="px-5 py-2 border border-slate-500 rounded-lg text-slate-300">ביטול</button>
        </div>
      </div>
    </div>}
  </div>;
}
