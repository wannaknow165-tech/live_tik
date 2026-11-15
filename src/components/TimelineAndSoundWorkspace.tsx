import { useState } from 'react';
import { Play, Volume2, Sliders } from 'lucide-react';
import {
  BATTLE_TIMELINE_CUES,
  BOOSTERA_ASSETS,
  BattlePhaseId,
} from '../data/boosteraCatalog';
import { soundEngine } from '../engine/soundEngine';

interface TimelineAndSoundWorkspaceProps {
  currentElapsedSec: number;
  onJumpToSecond: (sec: number) => void;
}

export function TimelineAndSoundWorkspace({
  currentElapsedSec,
  onJumpToSecond,
}: TimelineAndSoundWorkspaceProps) {
  const [phaseFilter, setPhaseFilter] = useState<'ALL' | BattlePhaseId | 'QUIET_ONLY'>('ALL');
  const [masterVol, setMasterVol] = useState(Math.round(soundEngine.getMasterVolume() * 100));
  const [vocalCarve, setVocalCarve] = useState(soundEngine.isVocalProtectionEnabled());

  const filteredCues = BATTLE_TIMELINE_CUES.filter((cue) => {
    if (phaseFilter === 'ALL') return true;
    if (phaseFilter === 'QUIET_ONLY') return cue.isQuietMoment;
    return cue.phase === phaseFilter;
  });

  return (
    <div className="space-y-10">
      {/* Deliverable D: Second-by-Second 240s Battle Timeline */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#1E2636] pb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">
              ציר זמן בימוי מלא (240 שניות) ותוכנית עיצוב סאונד
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              תכנון דרמטי מדויק שנייה-אחר-שנייה לחמשת שלבי הקרב, כולל 4 הפוגות שקט מכוונות (Quiet Valleys) שנועדו למנוע התשה חושית ולהכפיל את האימפקט ברגעי השיא.
            </p>
          </div>

          {/* Phase & Quiet Moment Filter */}
          <div className="flex items-center gap-1 p-1 bg-[#121722] border border-[#1E2636] rounded-lg flex-wrap">
            {(
              [
                { id: 'ALL', label: 'כל 240 השניות' },
                { id: 'IGNITION', label: '1. Ignition' },
                { id: 'MOMENTUM', label: '2. Momentum' },
                { id: 'PRESSURE', label: '3. Pressure' },
                { id: 'TENSION', label: '4. Tension' },
                { id: 'FINALE', label: '5. Finale' },
                { id: 'QUIET_ONLY', label: 'רגעי שקט מכוונים' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                onClick={() => setPhaseFilter(btn.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  phaseFilter === btn.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#121722] border border-[#1E2636] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1E2636] bg-[#0E131D] text-slate-400 font-medium">
                  <th className="py-3 px-4 whitespace-nowrap">טווח זמן</th>
                  <th className="py-3 px-4 whitespace-nowrap">שלב ואופי</th>
                  <th className="py-3 px-4">בימוי ויזואלי ונוכחות בפריים</th>
                  <th className="py-3 px-4">חוקיות תגובה לקהל</th>
                  <th className="py-3 px-4">תפקיד הסאונד והמיקס</th>
                  <th className="py-3 px-4 text-left whitespace-nowrap">בדיקה חיה</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2636]">
                {filteredCues.map((cue) => {
                  const isLiveNow =
                    currentElapsedSec >= cue.startSec && currentElapsedSec < cue.endSec;
                  return (
                    <tr
                      key={cue.id}
                      className={`transition-colors ${
                        isLiveNow
                          ? 'bg-amber-500/[0.08]'
                          : cue.isQuietMoment
                            ? 'bg-sky-500/[0.03] hover:bg-[#161D2B]'
                            : 'hover:bg-[#161D2B]'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono tabular-nums font-semibold text-slate-100 whitespace-nowrap">
                        {cue.timeRange}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-200">{cue.titleHe}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {cue.phase} · {cue.isQuietMoment ? 'הפוגת שקט מתוכננת' : 'שלב אקטיבי'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 leading-relaxed max-w-xs">
                        {cue.visualDirectionHe}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 leading-relaxed max-w-xs">
                        {cue.reactiveRulesHe}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 leading-relaxed max-w-xs">
                        {cue.soundDirectionHe}
                      </td>
                      <td className="py-3.5 px-4 text-left whitespace-nowrap">
                        <button
                          onClick={() => onJumpToSecond(cue.startSec + 0.2)}
                          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#0B0E14] border border-[#1E2636] text-slate-200 hover:border-amber-500/60 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <Play className="w-3 h-3 text-amber-400" />
                          <span>קפוץ לרגע זה</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Deliverable E: Sound Design Architecture & Broadcast Mixing Plan */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E2636] pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">
              תוכנית עיצוב סאונד, הגנת דיבור ומיקס שידור חי (Sound Design Plan)
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              כל קובצי הסאונד מופרדים משכבת הווידאו, עוברים דרך פילטר פינוי תדרי דיבור (Vocal Carve סביב 1.45kHz) ולימיטר קשיח ב--1.2dBFS כך שקול המגיש תמיד מוביל.
            </p>
          </div>

          {/* Live Master Audio Calibration Strip */}
          <div className="flex items-center gap-4 bg-[#121722] border border-[#1E2636] rounded-xl px-4 py-2.5 shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <Volume2 className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300">עוצמת אפקטים:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={masterVol}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMasterVol(v);
                  soundEngine.ensureInitialized();
                  soundEngine.setMasterVolume(v / 100);
                }}
                className="w-24 accent-amber-500"
              />
              <span className="font-mono tabular-nums text-slate-200 w-8">{masterVol}%</span>
            </div>

            <button
              onClick={() => {
                soundEngine.ensureInitialized();
                const next = !vocalCarve;
                setVocalCarve(next);
                soundEngine.setVocalProtection(next);
              }}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                vocalCarve
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                  : 'bg-[#0B0E14] border-[#1E2636] text-slate-400'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Vocal EQ Carve (-5.5dB): {vocalCarve ? 'פעיל' : 'כבוי'}</span>
            </button>
          </div>
        </div>

        {/* Mixing Engineering Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#121722] border border-[#1E2636] rounded-xl p-4 space-y-1.5">
            <h3 className="text-sm font-semibold text-slate-100">01. היררכיית עוצמות (LUFS &amp; Ducking)</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              קול המגיש ב-OBS מכויל ל-<span className="font-mono">-14 LUFS</span> (שיא ב-<span className="font-mono">-3dBFS</span>). אפקטי אווירה יושבים ב-<span className="font-mono">-32 LUFS</span>, אפקטי שיתוף/עוקב ב-<span className="font-mono">-16 LUFS</span>, ואימפקט פינאלה מוגבל ל-<span className="font-mono">-11 LUFS</span> עם פינוי תדרי אמצע.
            </p>
          </div>
          <div className="bg-[#121722] border border-[#1E2636] rounded-xl p-4 space-y-1.5">
            <h3 className="text-sm font-semibold text-slate-100">02. תנועת סטריאו התואמת לפריים</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              אפקטים בשולי ה-26% (CO₂, גיצי זהב, קשתות צ׳אט) מצודדים ל-<span className="font-mono">±75% L/R</span>, בעוד שקול המגיש ואימפקט ה-Sub של גל ההדף יושבים במרכז המונו — כך נוצרת הפרדה מרחבית גם באוזניות טלפון.
            </p>
          </div>
          <div className="bg-[#121722] border border-[#1E2636] rounded-xl p-4 space-y-1.5">
            <h3 className="text-sm font-semibold text-slate-100">03. מניעת עייפות אוזן וחפיפות</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              כל הפעלה עוברת הזזת תדר אקראית קלה (<span className="font-mono">±5% Pitch</span>), מוגבלת ל-4 קולות חד-פעמיים במקביל (Voice Stealing), ונחסמת על ידי Cooldown ייעודי לכל סוג אירוע.
            </p>
          </div>
        </div>

        {/* Sound Cue Matrix Table */}
        <div className="bg-[#121722] border border-[#1E2636] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#1E2636] bg-[#0E131D] text-slate-400 font-medium">
                  <th className="py-3 px-4 whitespace-nowrap">מזהה סאונד</th>
                  <th className="py-3 px-4">אפקט משויך וקונספט אקוסטי</th>
                  <th className="py-3 px-4 whitespace-nowrap">עוצמה (Peak / LUFS)</th>
                  <th className="py-3 px-4">מיקום סטריאו והגנת דיבור</th>
                  <th className="py-3 px-4 whitespace-nowrap">משך ו-Cooldown</th>
                  <th className="py-3 px-4 text-left whitespace-nowrap">האזנת סולו</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2636]">
                {BOOSTERA_ASSETS.map((asset) => (
                  <tr key={asset.audio.cueId} className="hover:bg-[#161D2B] transition-colors">
                    <td className="py-3 px-4 font-mono text-amber-300 whitespace-nowrap">
                      {asset.audio.cueId}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200">{asset.titleHe}</div>
                      <div className="text-slate-400 mt-0.5">{asset.audio.conceptHe}</div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-200 whitespace-nowrap">
                      {asset.audio.targetPeakDbfs} dBFS · {asset.audio.relativeLoudnessLufs} LUFS
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs">
                      <div>{asset.audio.stereoMovement}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">{asset.audio.vocalCarveHz}</div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-300 whitespace-nowrap">
                      {asset.audio.durationSec}s · CD {asset.audio.cooldownMs}ms
                    </td>
                    <td className="py-3 px-4 text-left whitespace-nowrap">
                      <button
                        onClick={() => {
                          soundEngine.ensureInitialized();
                          soundEngine.triggerEffectSound(asset.id, true);
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-[#0B0E14] border border-[#1E2636] text-slate-200 hover:border-amber-500/60 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>נגן סאונד</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
