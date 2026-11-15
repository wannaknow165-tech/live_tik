import { useState } from 'react';
import { CheckCircle2, Copy, Film, Flame, Layers3, Zap } from 'lucide-react';

const fx = [
  { id:'battle_smoke', effectId:'ALPHA_BATTLE_SMOKE', title:'עשן קרב',placement:'BACK / מסביב למצולם',frequency:'אווירה איטית',weight:7 },
  { id:'co2_share', effectId:'ALPHA_CO2_SHARE', title:'תותחי CO₂',placement:'FRONT / תחתית',frequency:'שיתוף משמעותי',weight:16 },
  { id:'electric_energy', effectId:'ALPHA_ELECTRIC_ENERGY', title:'ברקים ואנרגיה',placement:'FRONT / צדדים',frequency:'קצב לייקים עולה',weight:12 },
  { id:'fire_cannons', effectId:'ALPHA_FIRE_CANNONS', title:'עמודי אש',placement:'FRONT / שוליים',frequency:'שיא מאומת בלבד',weight:26 },
  { id:'fire_sweep', effectId:'ALPHA_FIRE_SWEEP', title:'מעבר אש',placement:'FRONT / מעבר',frequency:'שיא מאומת בלבד',weight:24 },
  { id:'gold_sparks', effectId:'ALPHA_GOLD_SPARKS', title:'ניצוצות זהב',placement:'FRONT / פינות',frequency:'שיתוף / עוקב',weight:12 },
  { id:'lightning_strikes', effectId:'ALPHA_LIGHTNING_STRIKES', title:'מכת ברק',placement:'FRONT / קצוות',frequency:'הסלמה חריגה',weight:18 },
  { id:'shockwave', effectId:'ALPHA_SHOCKWAVE', title:'גל הדף',placement:'FRONT / הובלה',frequency:'אירוע שיא',weight:22 },
] as const;
export function HybridAiFxLibrary({onTrigger}: {onTrigger:(id:string)=>void}){
 const [selected,setSelected] = useState<string | null>(null);
 const [copied,setCopied] = useState<string | null>(null);
 const [layout,setLayout] = useState<'contain'|'fill'>('contain');
 const copy = async(id:string)=>{
   try{await navigator.clipboard.writeText(window.location.origin+'/assets/boostera-alpha/'+id+'.webm');
     setCopied(id);setTimeout(()=>setCopied(null),1200);
   }catch{}
 };
 return <section className="rounded-xl border border-amber-500/25 bg-[#121722] p-5 space-y-4" dir="rtl">
   <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
     <div>
       <div className="text-[11px] text-amber-300 font-bold tracking-widest mb-2 flex items-center gap-2">
         <Layers3 className="w-4 h-4"/> BOOSTERA HYBRID V9 · ALPHA FX
       </div>
       <h2 className="text-lg text-slate-100 font-bold">8 סרטוני האפקטים שקיבלו שקיפות אמיתית</h2>
       <p className="text-sm text-slate-400 mt-1 max-w-2xl">
         הבאתי לכאן גם את סרטוני ה־WebM השקופים מהמנוע המקומי. הספרייה משלימה את האפקטים שכבר היו בפרויקט.
         עוצמת הבמאי המומלצת לרוב הזמן היא 8%–15%; אש וגל הדף שמורים לרגעי שיא.
       </p>
     </div>
     <div className="flex items-center gap-2 rounded-lg border border-[#364153] p-1 text-xs">
       <button onClick={()=>setLayout('contain')} className={'px-3 py-2 rounded '+(layout==='contain'?'bg-amber-500 text-slate-950':'text-slate-300')}>
         FIT לבדיקת מקור</button>
       <button onClick={()=>setLayout('fill')} className={'px-3 py-2 rounded '+(layout==='fill'?'bg-amber-500 text-slate-950':'text-slate-300')}>
         FILL בהמחשה</button>
     </div>
   </div>
   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
     {fx.map(item=>{
       const url='/assets/boostera-alpha/'+item.id+'.webm';
       return <div key={item.id} className="rounded-xl border border-[#2c3a4a] bg-[#0a1320] p-2">
         <div className="relative aspect-[9/16] rounded-lg overflow-hidden border border-[#24364c]"
           style={{background:'repeating-conic-gradient(#28313e 0% 25%, #111c29 0% 50%) 50% / 16px 16px'}}>
           <video key={item.id+layout} src={url} preload="none" loop playsInline muted
             controls className="w-full h-full" style={{objectFit:layout,opacity:Math.max(.09,item.weight/100)}}/>
         </div>
         <strong className="block text-slate-100 text-sm mt-2">{item.title}</strong>
         <div className="text-[11px] text-slate-400 mt-1">{item.placement}</div>
         <div className="text-[11px] text-amber-300 mt-1">{item.frequency} · עד {item.weight}%</div>
         <button onClick={()=>onTrigger(item.effectId)} className="rounded-md bg-amber-500 text-slate-950 text-xs font-semibold w-full py-2 mt-2">
           הפעל בבמה (FRONT/BACK)
         </button>
         <button onClick={()=>void copy(item.id)} className="flex items-center gap-1 text-xs text-cyan-300 mt-2 py-1">
           {copied===item.id?<CheckCircle2 className="w-3 h-3"/>:<Copy className="w-3 h-3"/>}
           {copied===item.id?'הועתק':'העתק כתובת קובץ'}
         </button>
       </div>
     })}
   </div>
   <p className="text-xs text-amber-200/70 border-r-2 border-amber-700 pr-3">
     הסרטונים קיימים כעת ב־public/assets/boostera-alpha. כפתור ההפעלה שולח את האפקט למנוע הבמה הקיים, בשקיפות עדינה ובשכבת FRONT/BACK המתאימה.
     בדוק תחילה ב־OBS Preview לפני שידור; האפקט מופיע על שתי השכבות רק אם נבחר HYBRID, לא כשכפול של אותו מקור.
   </p>
 </section>;
}
