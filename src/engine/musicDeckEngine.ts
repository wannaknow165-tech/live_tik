import { BOOSTERA_MUSIC_TRACKS, MusicTrackSpec } from '../data/boosteraCatalog';

/**
 * Real-time procedural studio music deck & custom MP3/WAV player with smooth crossfading
 * and automatic presenter voice ducking (Sidechain Ducking when host speaks!).
 */
class BoosteraMusicDeckEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;

  private isPlaying = false;
  private currentTrackId = 'MUS_SOLO_VELVET_LOFI';
  private baseVolume = 0.35;
  private isVoiceDucked = false;

  private stepTimer: ReturnType<typeof setInterval> | null = null;
  private stepIndex = 0;

  // Custom uploaded audio tracks support
  private customAudioEl: HTMLAudioElement | null = null;
  private customMediaSource: MediaElementAudioSourceNode | null = null;
  private customTracks: MusicTrackSpec[] = [];

  public ensureInit(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;

      this.ctx = new AudioCtx();
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 3400; // Keep crisp top-end space for presenter voice clarity

      this.duckGain = this.ctx.createGain();
      this.duckGain.gain.value = 1.0;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.baseVolume;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

      this.filterNode.connect(this.duckGain);
      this.duckGain.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  public getAllTracks(): MusicTrackSpec[] {
    return [...BOOSTERA_MUSIC_TRACKS, ...this.customTracks];
  }

  public addCustomTrack(file: File): MusicTrackSpec {
    const url = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    const customSpec: MusicTrackSpec = {
      id: `MUS_CUSTOM_${Date.now()}`,
      titleHe: `${cleanName} (קובץ מותאם)`,
      titleEn: cleanName,
      bpm: 120,
      energyLevel: 6,
      idealMode: 'BOTH',
      moodTagHe: 'רצועה מקומית שהועלתה לאולפן',
      whenAiPicksHe: 'זמין לבחירה ידנית או לשילוב בפלייליסט השידור החי.',
      synthProfile: 'warm_house',
      customUrl: url,
    };
    this.customTracks.push(customSpec);
    return customSpec;
  }

  public getCurrentTrackId(): string {
    return this.currentTrackId;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setVolumePct(pct: number) {
    this.baseVolume = Math.max(0, Math.min(1, pct / 100));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.baseVolume, this.ctx.currentTime, 0.12);
    }
  }

  public getVolumePct(): number {
    return Math.round(this.baseVolume * 100);
  }

  public setVoiceDuckingActive(speaking: boolean) {
    if (this.isVoiceDucked === speaking) return;
    this.isVoiceDucked = speaking;
    if (this.ctx && this.duckGain && this.filterNode) {
      const now = this.ctx.currentTime;
      // Smooth radio-broadcast sidechain ducking when presenter talks!
      this.duckGain.gain.setTargetAtTime(speaking ? 0.42 : 1.0, now, speaking ? 0.06 : 0.35);
      this.filterNode.frequency.setTargetAtTime(speaking ? 1650 : 3800, now, 0.15);
    }
  }

  public getMusicEnergyMeter(): number {
    if (!this.isPlaying || !this.analyser || !this.freqData) return 0;
    this.analyser.getByteFrequencyData(this.freqData);
    let sum = 0;
    for (let i = 0; i < this.freqData.length; i++) {
      sum += this.freqData[i];
    }
    return Math.min(100, Math.round((sum / (this.freqData.length * 255)) * 220));
  }

  public selectAndPlayTrack(trackId: string, autoStart = true) {
    const all = this.getAllTracks();
    const spec = all.find((t) => t.id === trackId) || BOOSTERA_MUSIC_TRACKS[0];
    this.currentTrackId = spec.id;

    if (!autoStart && !this.isPlaying) return;
    if (!this.ensureInit()) return;

    this.stopInternalTimers();
    this.isPlaying = true;

    if (spec.customUrl) {
      if (!this.customAudioEl) {
        this.customAudioEl = new Audio();
        this.customAudioEl.loop = true;
        this.customAudioEl.crossOrigin = 'anonymous';
        this.customMediaSource = this.ctx!.createMediaElementSource(this.customAudioEl);
        this.customMediaSource.connect(this.filterNode!);
      }
      this.customAudioEl.src = spec.customUrl;
      this.customAudioEl.play().catch(() => {});
      return;
    }

    if (this.customAudioEl) {
      this.customAudioEl.pause();
    }

    this.stepIndex = 0;
    const sixteenthMs = Math.round((60 / spec.bpm / 4) * 1000);
    this.stepTimer = setInterval(() => {
      this.triggerSequencerStep(spec, this.stepIndex);
      this.stepIndex = (this.stepIndex + 1) % 16;
    }, sixteenthMs);
  }

  public stop() {
    this.isPlaying = false;
    this.stopInternalTimers();
    if (this.customAudioEl) {
      this.customAudioEl.pause();
    }
  }

  private stopInternalTimers() {
    if (this.stepTimer) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private triggerSequencerStep(spec: MusicTrackSpec, step: number) {
    if (!this.ctx || !this.filterNode || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const p = spec.synthProfile;

    // 1. Kick Drum Pattern
    const kickHit =
      p === 'velvet_lofi'
        ? step === 0 || step === 10
        : p === 'warm_house' || p === 'kinetic_drive' || p === 'victory_anthem'
          ? step % 4 === 0
          : p === 'glove_overclock' || p === 'snipe_clockwork'
            ? step % 4 === 0 || step === 14
            : step === 0 || step === 6 || step === 10;

    if (kickHit) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const topFreq = p === 'velvet_lofi' ? 95 : 135;
      osc.frequency.setValueAtTime(topFreq, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.14);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(p === 'velvet_lofi' ? 0.28 : 0.42, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(g);
      g.connect(this.filterNode);
      osc.start(t);
      osc.stop(t + 0.24);
    }

    // 2. Crisp Hi-Hat / Clockwork Tick (especially poignant on Snipe Clockwork!)
    const hatHit =
      p === 'snipe_clockwork'
        ? step % 2 === 0 || step === 15
        : p === 'pressure_trap' || p === 'glove_overclock'
          ? step % 2 === 0 || step === 7 || step === 15
          : step % 4 === 2;

    if (hatHit) {
      const osc = this.ctx.createOscillator();
      osc.type = p === 'snipe_clockwork' ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(p === 'snipe_clockwork' ? (step % 4 === 0 ? 1320 : 880) : 4200, t);

      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = p === 'snipe_clockwork' ? 700 : 3500;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(p === 'snipe_clockwork' ? 0.08 : 0.035, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

      osc.connect(hp);
      hp.connect(g);
      g.connect(this.filterNode);
      osc.start(t);
      osc.stop(t + 0.06);
    }

    // 3. Bassline & Atmospheric Chord / Arp Motifs
    const rootNotes: Record<MusicTrackSpec['synthProfile'], number[]> = {
      velvet_lofi: [130.81, 155.56, 174.61, 196.0], // Cm7 warm
      warm_house: [110.0, 130.81, 146.83, 164.81], // Am9 deep
      dark_ignition: [73.42, 73.42, 87.31, 82.41], // D minor dark cinematic
      kinetic_drive: [98.0, 116.54, 130.81, 146.83], // Gm energetic
      pressure_trap: [65.41, 65.41, 77.78, 69.3], // C Phrygian heavy sub
      glove_overclock: [82.41, 98.0, 110.0, 123.47], // Em high-voltage drive
      snipe_clockwork: [73.42, 77.78, 87.31, 110.0], // Rising tension ostinato
      victory_anthem: [130.81, 164.81, 196.0, 246.94], // Cmaj7 uplifting
    };

    const scale = rootNotes[p];
    if (step % 2 === 0) {
      const note = scale[(step / 2) % scale.length];
      const bass = this.ctx.createOscillator();
      bass.type = p === 'velvet_lofi' || p === 'warm_house' ? 'triangle' : 'sawtooth';
      bass.frequency.setValueAtTime(note, t);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value =
        p === 'velvet_lofi' ? 320 : p === 'glove_overclock' || p === 'snipe_clockwork' ? 920 : 540;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      bass.connect(lp);
      lp.connect(g);
      g.connect(this.filterNode);
      bass.start(t);
      bass.stop(t + 0.24);
    }

    // Warm Pad / Cinematic Harmonic Swell on bar start (step 0)
    if (step === 0) {
      const chordMultipliers = p === 'victory_anthem' ? [2, 2.5, 3] : [2, 2.4, 3];
      const root = scale[0];
      chordMultipliers.forEach((mult) => {
        const pad = this.ctx!.createOscillator();
        pad.type = 'sine';
        pad.frequency.setValueAtTime(root * mult, t);

        const g = this.ctx!.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.045, t + 0.4);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

        pad.connect(g);
        g.connect(this.filterNode!);
        pad.start(t);
        pad.stop(t + 1.85);
      });
    }
  }
}

export const musicDeck = new BoosteraMusicDeckEngine();
