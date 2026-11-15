import { LikeEnergyTier } from '../data/boosteraCatalog';
import { videoVfxCompositor } from './videoVfxCompositor';

class BoosteraSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private vocalCarveFilter: BiquadFilterNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private timeData: Float32Array<ArrayBuffer> | null = null;

  private ambOsc: OscillatorNode | null = null;
  private ambGain: GainNode | null = null;
  private likeOsc: OscillatorNode | null = null;
  private likeGain: GainNode | null = null;

  private muted = false;
  private masterVolume = 0.8;
  private vocalProtectionEnabled = true;
  private lastCueTimestamps = new Map<string, number>();
  private activeOneShotVoices = 0;
  private noiseBuffer: AudioBuffer | null = null;

  public ensureInitialized(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();

      // Master Broadcast Signal Chain:
      // Voices -> Vocal Carve EQ (protects presenter speech 350Hz-3.2kHz) -> Brickwall Limiter (-1.2dBFS) -> Master Gain -> Analyser -> Destination
      this.vocalCarveFilter = this.ctx.createBiquadFilter();
      this.vocalCarveFilter.type = 'peaking';
      this.vocalCarveFilter.frequency.value = 1450;
      this.vocalCarveFilter.Q.value = 0.85;
      this.vocalCarveFilter.gain.value = this.vocalProtectionEnabled ? -5.5 : 0;

      this.limiter = this.ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -3.0;
      this.limiter.knee.value = 2.0;
      this.limiter.ratio.value = 16.0;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.12;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.timeData = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));

      this.vocalCarveFilter.connect(this.limiter);
      this.limiter.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.noiseBuffer = this.createWhiteNoiseBuffer(3.0);
      this.startContinuousBeds();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  private createWhiteNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private startContinuousBeds() {
    if (!this.ctx || !this.vocalCarveFilter) return;

    // Subtle sub-room air bed (< 95Hz)
    this.ambOsc = this.ctx.createOscillator();
    this.ambOsc.type = 'sine';
    this.ambOsc.frequency.value = 52;
    this.ambGain = this.ctx.createGain();
    this.ambGain.gain.value = 0.0;
    this.ambOsc.connect(this.ambGain);
    this.ambGain.connect(this.vocalCarveFilter);
    this.ambOsc.start();

    // Progressive Like Charge harmonic stem
    this.likeOsc = this.ctx.createOscillator();
    this.likeOsc.type = 'triangle';
    this.likeOsc.frequency.value = 110;
    const likeFilter = this.ctx.createBiquadFilter();
    likeFilter.type = 'lowpass';
    likeFilter.frequency.value = 380;
    this.likeGain = this.ctx.createGain();
    this.likeGain.gain.value = 0.0;

    this.likeOsc.connect(likeFilter);
    likeFilter.connect(this.likeGain);
    this.likeGain.connect(this.vocalCarveFilter);
    this.likeOsc.start();
  }

  public updateContinuousState(
    isRunning: boolean,
    likeEnergy: number,
    _likeTier: LikeEnergyTier,
    phaseIntensity: number
  ) {
    if (!this.ctx || !this.ambGain || !this.likeGain || !this.likeOsc) return;
    if (this.ctx.state !== 'running') return;

    const now = this.ctx.currentTime;
    const targetAmb = isRunning ? 0.025 * (0.5 + phaseIntensity * 0.6) : 0;
    this.ambGain.gain.setTargetAtTime(targetAmb, now, 0.25);

    const normalizedEnergy = Math.max(0, Math.min(1, likeEnergy / 100));
    const targetLikeVol = isRunning && likeEnergy >= 15 ? normalizedEnergy * 0.055 : 0;
    const targetFreq = 95 + normalizedEnergy * 165;
    this.likeGain.gain.setTargetAtTime(targetLikeVol, now, 0.2);
    this.likeOsc.frequency.setTargetAtTime(targetFreq, now, 0.2);
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMasterVolume(val: number) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.ctx && this.masterGain && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setVocalProtection(enabled: boolean) {
    this.vocalProtectionEnabled = enabled;
    if (this.ctx && this.vocalCarveFilter) {
      this.vocalCarveFilter.gain.setTargetAtTime(enabled ? -5.5 : 0, this.ctx.currentTime, 0.08);
    }
  }

  public isVocalProtectionEnabled(): boolean {
    return this.vocalProtectionEnabled;
  }

  public getLiveLevelDbfs(): number {
    if (!this.analyser || !this.timeData || this.muted || !this.ctx || this.ctx.state !== 'running') {
      return -60;
    }
    this.analyser.getFloatTimeDomainData(this.timeData);
    let peak = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const abs = Math.abs(this.timeData[i]);
      if (abs > peak) peak = abs;
    }
    if (peak < 0.001) return -60;
    return Math.max(-60, Math.min(0, 20 * Math.log10(peak)));
  }

  public triggerEffectSound(effectId: string, bypassCooldown = false) {
    if (this.muted) return;
    if (!this.ensureInitialized() || !this.ctx || !this.vocalCarveFilter || !this.noiseBuffer) return;

    const nowMs = Date.now();
    const cooldownMap: Record<string, number> = {
      SHARE_CO2_CANNONS: 1800,
      SHARE_SMOKE_PLUMES: 2500,
      FOLLOW_GOLDEN_SPARKS: 1600,
      JOIN_ANAMORPHIC_SWEEP: 3000,
      CHAT_TESLA_FILAMENT: 2200,
      GOAL_SHOCKWAVE_RING: 4000,
      PRESSURE_FORKED_LIGHTNING: 3000,
      FINALE_PYRO_CONVERGENCE: 10000,
      VID_01_FIREBALL_SNIPE_BLAST: 3500,
      VID_02_CRYO_CO2_CANNONS: 2000,
      VID_03_TWIN_LIGHTNING_ARCS: 2800,
      VID_04_COLD_SPARK_FOUNTAINS: 2200,
      VID_05_PK_FACTION_SMOKE_CLASH: 4000,
      VID_06_PLASMA_SPARK_SURGE: 3000,
      VID_07_QUAD_PYRO_FLAME_JETS: 4500,
      BEAST_08_VIOLET_PHOENIX: 4000,
      BEAST_09_SOLAR_TIGER: 4200,
      BEAST_10_ROYAL_FIRE_LION: 4500,
    };

    // If a local green-screen MP4 with embedded roar/screech is actively bound to this slot, let its real audio play cleanly!
    if (videoVfxCompositor.isPlayingEmbeddedAudio(effectId)) {
      return;
    }

    if (!bypassCooldown && cooldownMap[effectId]) {
      const prev = this.lastCueTimestamps.get(effectId) ?? 0;
      if (nowMs - prev < cooldownMap[effectId]) return;
    }
    if (
      this.activeOneShotVoices >= 4 &&
      effectId !== 'FINALE_PYRO_CONVERGENCE' &&
      effectId !== 'GOAL_SHOCKWAVE_RING' &&
      effectId !== 'VID_01_FIREBALL_SNIPE_BLAST' &&
      effectId !== 'VID_07_QUAD_PYRO_FLAME_JETS' &&
      effectId !== 'BEAST_10_ROYAL_FIRE_LION'
    ) {
      return;
    }

    this.lastCueTimestamps.set(effectId, nowMs);
    this.activeOneShotVoices += 1;

    const pitchJitter = 0.95 + Math.random() * 0.1;
    const t = this.ctx.currentTime;

    switch (effectId) {
      case 'VID_02_CRYO_CO2_CANNONS':
      case 'SHARE_CO2_CANNONS': {
        // Dual stereo pressurized cryo air burst
        [-0.78, 0.78].forEach((panVal) => {
          const src = this.ctx!.createBufferSource();
          src.buffer = this.noiseBuffer!;
          src.playbackRate.value = pitchJitter;

          const bp = this.ctx!.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(2800 * pitchJitter, t);
          bp.frequency.exponentialRampToValueAtTime(650, t + 1.85);
          bp.Q.value = 0.75;

          const pan = this.ctx!.createStereoPanner();
          pan.pan.value = panVal;

          const gain = this.ctx!.createGain();
          gain.gain.setValueAtTime(0.001, t);
          gain.gain.linearRampToValueAtTime(0.28, t + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 1.9);

          src.connect(bp);
          bp.connect(pan);
          pan.connect(gain);
          gain.connect(this.vocalCarveFilter!);
          src.start(t);
          src.stop(t + 1.95);
        });
        this.releaseVoiceAfter(1950);
        break;
      }

      case 'VID_05_PK_FACTION_SMOKE_CLASH':
      case 'SHARE_SMOKE_PLUMES': {
        // Deep warm pneumatic plume whoosh
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(160, t);
        lp.frequency.exponentialRampToValueAtTime(580 * pitchJitter, t + 0.9);
        lp.frequency.exponentialRampToValueAtTime(140, t + 2.7);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.32, t + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 2.8);

        src.connect(lp);
        lp.connect(gain);
        gain.connect(this.vocalCarveFilter);
        src.start(t);
        src.stop(t + 2.85);
        this.releaseVoiceAfter(2850);
        break;
      }

      case 'VID_04_COLD_SPARK_FOUNTAINS':
      case 'FOLLOW_GOLDEN_SPARKS': {
        // Refined metallic shimmer + micro spark crackles
        const freqs = [587.33, 880, 1174.66, 1760].map((f) => f * pitchJitter);
        freqs.forEach((f, idx) => {
          const osc = this.ctx!.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = f;

          const pan = this.ctx!.createStereoPanner();
          pan.pan.value = idx % 2 === 0 ? -0.65 : 0.65;

          const gain = this.ctx!.createGain();
          const start = t + idx * 0.055;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(0.075, start + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.8);

          osc.connect(pan);
          pan.connect(gain);
          gain.connect(this.vocalCarveFilter!);
          osc.start(start);
          osc.stop(start + 1.85);
        });

        // Subtle high-passed titanium fizz
        const fizz = this.ctx.createBufferSource();
        fizz.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 5200;
        const fizzGain = this.ctx.createGain();
        fizzGain.gain.setValueAtTime(0.001, t);
        fizzGain.gain.linearRampToValueAtTime(0.09, t + 0.12);
        fizzGain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
        fizz.connect(hp);
        hp.connect(fizzGain);
        fizzGain.connect(this.vocalCarveFilter);
        fizz.start(t);
        fizz.stop(t + 2.55);

        this.releaseVoiceAfter(2550);
        break;
      }

      case 'JOIN_ANAMORPHIC_SWEEP': {
        // Soft L->R optical air shimmer
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(420, t);
        bp.frequency.exponentialRampToValueAtTime(1200, t + 1.1);
        bp.frequency.exponentialRampToValueAtTime(360, t + 2.1);
        bp.Q.value = 1.8;

        const pan = this.ctx.createStereoPanner();
        pan.pan.setValueAtTime(-0.75, t);
        pan.pan.linearRampToValueAtTime(0.75, t + 2.1);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.11, t + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 2.15);

        src.connect(bp);
        bp.connect(pan);
        pan.connect(gain);
        gain.connect(this.vocalCarveFilter);
        src.start(t);
        src.stop(t + 2.2);
        this.releaseVoiceAfter(2200);
        break;
      }

      case 'CHAT_TESLA_FILAMENT': {
        // Restrained outer-edge electrical snap
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(920 * pitchJitter, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.16);

        const pan = this.ctx.createStereoPanner();
        pan.pan.value = Math.random() > 0.5 ? 0.82 : -0.82;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

        osc.connect(pan);
        pan.connect(gain);
        gain.connect(this.vocalCarveFilter);
        osc.start(t);
        osc.stop(t + 0.25);
        this.releaseVoiceAfter(300);
        break;
      }

      case 'GOAL_SHOCKWAVE_RING': {
        // Deep concussive 42Hz sub-drop + air pressure crack
        const sub = this.ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(115, t);
        sub.frequency.exponentialRampToValueAtTime(36, t + 0.45);
        sub.frequency.exponentialRampToValueAtTime(28, t + 2.2);

        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(0.001, t);
        subGain.gain.linearRampToValueAtTime(0.58, t + 0.015);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 2.3);

        sub.connect(subGain);
        subGain.connect(this.vocalCarveFilter);
        sub.start(t);
        sub.stop(t + 2.35);

        const crack = this.ctx.createBufferSource();
        crack.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1800;
        const crackGain = this.ctx.createGain();
        crackGain.gain.setValueAtTime(0.32, t);
        crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

        crack.connect(hp);
        hp.connect(crackGain);
        crackGain.connect(this.vocalCarveFilter);
        crack.start(t);
        crack.stop(t + 0.6);

        this.releaseVoiceAfter(2350);
        break;
      }

      case 'VID_03_TWIN_LIGHTNING_ARCS':
      case 'PRESSURE_FORKED_LIGHTNING': {
        // Sharp double electrical crack + low rolling thunder
        [0, 0.14].forEach((offset) => {
          const snap = this.ctx!.createBufferSource();
          snap.buffer = this.noiseBuffer!;
          const bp = this.ctx!.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 3400 * pitchJitter;
          bp.Q.value = 1.1;

          const g = this.ctx!.createGain();
          g.gain.setValueAtTime(0.34, t + offset);
          g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.25);

          snap.connect(bp);
          bp.connect(g);
          g.connect(this.vocalCarveFilter!);
          snap.start(t + offset);
          snap.stop(t + offset + 0.28);
        });

        const thunder = this.ctx.createOscillator();
        thunder.type = 'triangle';
        thunder.frequency.setValueAtTime(78, t + 0.08);
        thunder.frequency.exponentialRampToValueAtTime(34, t + 1.9);

        const thGain = this.ctx.createGain();
        thGain.gain.setValueAtTime(0.001, t + 0.05);
        thGain.gain.linearRampToValueAtTime(0.36, t + 0.18);
        thGain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

        thunder.connect(thGain);
        thGain.connect(this.vocalCarveFilter);
        thunder.start(t + 0.05);
        thunder.stop(t + 2.05);

        this.releaseVoiceAfter(2100);
        break;
      }

      case 'FINALE_PYRO_CONVERGENCE': {
        // 13.6s rising tension sweep -> 0.35s dramatic vacuum -> massive 14.0s concussive impact
        const riser = this.ctx.createOscillator();
        riser.type = 'sawtooth';
        riser.frequency.setValueAtTime(85, t);
        riser.frequency.exponentialRampToValueAtTime(520, t + 13.5);

        const riserLp = this.ctx.createBiquadFilter();
        riserLp.type = 'lowpass';
        riserLp.frequency.setValueAtTime(240, t);
        riserLp.frequency.exponentialRampToValueAtTime(2600, t + 13.5);

        const riserGain = this.ctx.createGain();
        riserGain.gain.setValueAtTime(0.01, t);
        riserGain.gain.exponentialRampToValueAtTime(0.24, t + 13.4);
        riserGain.gain.linearRampToValueAtTime(0.0001, t + 13.65); // Pre-impact acoustic vacuum!

        riser.connect(riserLp);
        riserLp.connect(riserGain);
        riserGain.connect(this.vocalCarveFilter);
        riser.start(t);
        riser.stop(t + 13.7);

        // Climax Impact at +13.95s
        const impactTime = t + 13.95;
        const boom = this.ctx.createOscillator();
        boom.type = 'sine';
        boom.frequency.setValueAtTime(130, impactTime);
        boom.frequency.exponentialRampToValueAtTime(32, impactTime + 1.0);

        const boomGain = this.ctx.createGain();
        boomGain.gain.setValueAtTime(0.001, impactTime);
        boomGain.gain.linearRampToValueAtTime(0.65, impactTime + 0.02);
        boomGain.gain.exponentialRampToValueAtTime(0.001, impactTime + 1.4);

        boom.connect(boomGain);
        boomGain.connect(this.vocalCarveFilter);
        boom.start(impactTime);
        boom.stop(impactTime + 1.45);

        this.releaseVoiceAfter(15000);
        break;
      }

      case 'VID_06_PLASMA_SPARK_SURGE':
      case 'SND_GLOVE_POWERUP':
      case 'GLOVE_POWER_SURGE': {
        // High-voltage x5 Glove turbine charge + kinetic plasma lock
        const turbine = this.ctx.createOscillator();
        turbine.type = 'sawtooth';
        turbine.frequency.setValueAtTime(110, t);
        turbine.frequency.exponentialRampToValueAtTime(660, t + 1.4);
        turbine.frequency.setValueAtTime(220, t + 1.42);

        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(320, t);
        lp.frequency.exponentialRampToValueAtTime(2900, t + 1.4);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.01, t);
        g.gain.linearRampToValueAtTime(0.36, t + 1.38);
        g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);

        turbine.connect(lp);
        lp.connect(g);
        g.connect(this.vocalCarveFilter);
        turbine.start(t);
        turbine.stop(t + 2.45);
        this.releaseVoiceAfter(2500);
        break;
      }

      case 'SND_SNIPE_LOCK':
      case 'SNIPE_CRITICAL_FLASH': {
        // Tactical dual sonar lock ping + deep sub drop for critical snipe moments
        [0, 0.22].forEach((offset, idx) => {
          const ping = this.ctx!.createOscillator();
          ping.type = 'sine';
          ping.frequency.setValueAtTime(idx === 0 ? 1320 : 1760, t + offset);
          ping.frequency.exponentialRampToValueAtTime(880, t + offset + 0.18);

          const pg = this.ctx!.createGain();
          pg.gain.setValueAtTime(0.24, t + offset);
          pg.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.2);

          ping.connect(pg);
          pg.connect(this.vocalCarveFilter!);
          ping.start(t + offset);
          ping.stop(t + offset + 0.21);
        });

        const drop = this.ctx.createOscillator();
        drop.type = 'sine';
        drop.frequency.setValueAtTime(140, t + 0.35);
        drop.frequency.exponentialRampToValueAtTime(34, t + 1.9);

        const dg = this.ctx.createGain();
        dg.gain.setValueAtTime(0.52, t + 0.35);
        dg.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

        drop.connect(dg);
        dg.connect(this.vocalCarveFilter);
        drop.start(t + 0.35);
        drop.stop(t + 2.05);
        this.releaseVoiceAfter(2100);
        break;
      }

      case 'SND_LEAD_TAKEN': {
        // Uplifting heroic brass-synth triad hit when taking the lead
        [220, 277.18, 329.63, 440].forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = freq * pitchJitter;
          const lp = this.ctx!.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(1800, t);
          lp.frequency.exponentialRampToValueAtTime(420, t + 1.6);

          const g = this.ctx!.createGain();
          g.gain.setValueAtTime(0.001, t);
          g.gain.linearRampToValueAtTime(0.11, t + 0.04 + idx * 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + 1.7);

          osc.connect(lp);
          lp.connect(g);
          g.connect(this.vocalCarveFilter!);
          osc.start(t);
          osc.stop(t + 1.75);
        });
        this.releaseVoiceAfter(1800);
        break;
      }

      case 'SND_LEAD_LOST_TENSION': {
        // Urgent low minor tension sting when opponent overtakes
        [146.83, 155.56].forEach((freq) => {
          const osc = this.ctx!.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          osc.frequency.linearRampToValueAtTime(freq * 0.92, t + 1.4);

          const g = this.ctx!.createGain();
          g.gain.setValueAtTime(0.24, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

          osc.connect(g);
          g.connect(this.vocalCarveFilter!);
          osc.start(t);
          osc.stop(t + 1.55);
        });
        this.releaseVoiceAfter(1600);
        break;
      }

      case 'SND_FINAL_10S_HEARTBEAT': {
        // Deep cinematic lub-dub heartbeat x3
        [0, 0.85, 1.65].forEach((beat) => {
          [0, 0.2].forEach((lubDub, idx) => {
            const osc = this.ctx!.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(idx === 0 ? 68 : 56, t + beat + lubDub);
            osc.frequency.exponentialRampToValueAtTime(34, t + beat + lubDub + 0.22);

            const g = this.ctx!.createGain();
            g.gain.setValueAtTime(idx === 0 ? 0.46 : 0.34, t + beat + lubDub);
            g.gain.exponentialRampToValueAtTime(0.001, t + beat + lubDub + 0.26);

            osc.connect(g);
            g.connect(this.vocalCarveFilter!);
            osc.start(t + beat + lubDub);
            osc.stop(t + beat + lubDub + 0.28);
          });
        });
        this.releaseVoiceAfter(2400);
        break;
      }

      case 'SND_ENERGY_WAKEUP_SWEEP':
      case 'SOLO_WARM_LOUNGE': {
        // Gentle warm analog air riser to lift dead-air moments gracefully
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(280, t);
        bp.frequency.exponentialRampToValueAtTime(1450, t + 2.2);
        bp.Q.value = 2.2;

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.14, t + 1.4);
        g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);

        src.connect(bp);
        bp.connect(g);
        g.connect(this.vocalCarveFilter);
        src.start(t);
        src.stop(t + 2.55);
        this.releaseVoiceAfter(2600);
        break;
      }

      case 'SND_HYPE_STADIUM_CHEER': {
        // Controlled arena crowd-textured warm swell + bright harmonic
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(750, t);
        bp.frequency.linearRampToValueAtTime(1150, t + 0.9);
        bp.Q.value = 0.9;

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.22, t + 0.35);
        g.gain.exponentialRampToValueAtTime(0.001, t + 2.3);

        src.connect(bp);
        bp.connect(g);
        g.connect(this.vocalCarveFilter);
        src.start(t);
        src.stop(t + 2.35);
        this.releaseVoiceAfter(2400);
        break;
      }

      case 'SND_CINEMATIC_BRAAM': {
        // Deep Christopher Nolan / Inception low brass braam
        [55, 55.4, 110].forEach((freq) => {
          const osc = this.ctx!.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, t);

          const lp = this.ctx!.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(620, t);
          lp.frequency.exponentialRampToValueAtTime(160, t + 2.2);

          const g = this.ctx!.createGain();
          g.gain.setValueAtTime(0.001, t);
          g.gain.linearRampToValueAtTime(0.2, t + 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, t + 2.25);

          osc.connect(lp);
          lp.connect(g);
          g.connect(this.vocalCarveFilter!);
          osc.start(t);
          osc.stop(t + 2.3);
        });
        this.releaseVoiceAfter(2350);
        break;
      }

      case 'SND_TAP_DOPAMINE_PULSE': {
        // Tactile finger-tap micro-dopamine trigger: tight 58Hz physical thumb thump + crisp 2.6kHz silk snap
        const sub = this.ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(118 * pitchJitter, t);
        sub.frequency.exponentialRampToValueAtTime(52, t + 0.09);

        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(0.24, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

        const click = this.ctx.createOscillator();
        click.type = 'triangle';
        click.frequency.setValueAtTime(2450 * pitchJitter, t);
        click.frequency.exponentialRampToValueAtTime(980, t + 0.035);

        const clickGain = this.ctx.createGain();
        clickGain.gain.setValueAtTime(0.075, t);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

        sub.connect(subGain);
        subGain.connect(this.vocalCarveFilter);
        click.connect(clickGain);
        clickGain.connect(this.vocalCarveFilter);

        sub.start(t);
        sub.stop(t + 0.12);
        click.start(t);
        click.stop(t + 0.045);
        this.releaseVoiceAfter(130);
        break;
      }

      case 'SND_COMBO_MILESTONE': {
        // Ascending kinetic combo reward chord (x25 / x50 / x100 streak)
        [329.63, 440, 659.25, 880].forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          osc.type = 'triangle';
          const startAt = t + idx * 0.045;
          osc.frequency.setValueAtTime(freq * pitchJitter, startAt);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.04, startAt + 0.35);

          const g = this.ctx!.createGain();
          g.gain.setValueAtTime(0.001, startAt);
          g.gain.linearRampToValueAtTime(0.11, startAt + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0008, startAt + 0.42);

          osc.connect(g);
          g.connect(this.vocalCarveFilter!);
          osc.start(startAt);
          osc.stop(startAt + 0.45);
        });
        this.releaseVoiceAfter(600);
        break;
      }

      case 'VID_01_FIREBALL_SNIPE_BLAST':
      case 'VID_07_QUAD_PYRO_FLAME_JETS': {
        // Concert pyrotechnic flame jet ignition roar + deep sub impact
        const sub = this.ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(128, t);
        sub.frequency.exponentialRampToValueAtTime(38, t + 0.55);
        sub.frequency.exponentialRampToValueAtTime(30, t + 2.6);

        const subG = this.ctx.createGain();
        subG.gain.setValueAtTime(0.001, t);
        subG.gain.linearRampToValueAtTime(0.55, t + 0.03);
        subG.gain.exponentialRampToValueAtTime(0.001, t + 2.7);
        sub.connect(subG);
        subG.connect(this.vocalCarveFilter);
        sub.start(t);
        sub.stop(t + 2.75);

        [-0.82, 0.82].forEach((panPos, idx) => {
          const roar = this.ctx!.createBufferSource();
          roar.buffer = this.noiseBuffer!;
          roar.playbackRate.value = (idx === 0 ? 0.92 : 1.04) * pitchJitter;

          const lp = this.ctx!.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(220, t);
          lp.frequency.exponentialRampToValueAtTime(1150, t + 0.35);
          lp.frequency.exponentialRampToValueAtTime(260, t + 2.8);

          const pan = this.ctx!.createStereoPanner();
          pan.pan.value = panPos;

          const g = this.ctx!.createGain();
          g.gain.setValueAtTime(0.001, t);
          g.gain.linearRampToValueAtTime(0.32, t + 0.14);
          g.gain.exponentialRampToValueAtTime(0.001, t + 2.85);

          roar.connect(lp);
          lp.connect(pan);
          pan.connect(g);
          g.connect(this.vocalCarveFilter!);
          roar.start(t);
          roar.stop(t + 2.9);
        });
        this.releaseVoiceAfter(2950);
        break;
      }

      case 'BEAST_08_VIOLET_PHOENIX': {
        // Astral harmonic phoenix screech + wide ascending wing whoosh
        [1180, 1770].forEach((baseFreq, idx) => {
          const osc = this.ctx!.createOscillator();
          osc.type = idx === 0 ? 'sawtooth' : 'triangle';
          osc.frequency.setValueAtTime(baseFreq * pitchJitter, t + 0.05);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.55, t + 0.48);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.82, t + 1.9);

          const bp = this.ctx!.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(1950, t);
          bp.Q.value = 2.4;

          const pan = this.ctx!.createStereoPanner();
          pan.pan.setValueAtTime(-0.65, t);
          pan.pan.linearRampToValueAtTime(0.65, t + 2.0);

          const g = this.ctx!.createGain();
          g.gain.setValueAtTime(0.001, t);
          g.gain.linearRampToValueAtTime(idx === 0 ? 0.16 : 0.11, t + 0.16);
          g.gain.exponentialRampToValueAtTime(0.0008, t + 2.05);

          osc.connect(bp);
          bp.connect(pan);
          pan.connect(g);
          g.connect(this.vocalCarveFilter!);
          osc.start(t + 0.04);
          osc.stop(t + 2.1);
        });

        const wing = this.ctx.createBufferSource();
        wing.buffer = this.noiseBuffer;
        const wLp = this.ctx.createBiquadFilter();
        wLp.type = 'bandpass';
        wLp.frequency.setValueAtTime(360, t);
        wLp.frequency.exponentialRampToValueAtTime(1400, t + 0.8);
        wLp.frequency.exponentialRampToValueAtTime(320, t + 2.3);
        const wGain = this.ctx.createGain();
        wGain.gain.setValueAtTime(0.001, t);
        wGain.gain.linearRampToValueAtTime(0.24, t + 0.35);
        wGain.gain.exponentialRampToValueAtTime(0.001, t + 2.35);
        wing.connect(wLp);
        wLp.connect(wGain);
        wGain.connect(this.vocalCarveFilter);
        wing.start(t);
        wing.stop(t + 2.4);

        this.releaseVoiceAfter(2450);
        break;
      }

      case 'BEAST_09_SOLAR_TIGER':
      case 'BEAST_10_ROYAL_FIRE_LION': {
        // Deep guttural predator sub-roar + fiery chest resonance
        const isLion = effectId === 'BEAST_10_ROYAL_FIRE_LION';
        const subOsc = this.ctx.createOscillator();
        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime((isLion ? 92 : 108) * pitchJitter, t);
        subOsc.frequency.exponentialRampToValueAtTime(isLion ? 46 : 54, t + 0.7);
        subOsc.frequency.exponentialRampToValueAtTime(isLion ? 36 : 42, t + 2.6);

        const formant = this.ctx.createBiquadFilter();
        formant.type = 'lowpass';
        formant.frequency.setValueAtTime(280, t);
        formant.frequency.exponentialRampToValueAtTime(640, t + 0.35);
        formant.frequency.exponentialRampToValueAtTime(180, t + 2.6);
        formant.Q.value = 3.2;

        const roarGain = this.ctx.createGain();
        roarGain.gain.setValueAtTime(0.001, t);
        roarGain.gain.linearRampToValueAtTime(isLion ? 0.44 : 0.38, t + 0.14);
        roarGain.gain.exponentialRampToValueAtTime(0.001, t + 2.75);

        subOsc.connect(formant);
        formant.connect(roarGain);
        roarGain.connect(this.vocalCarveFilter);
        subOsc.start(t);
        subOsc.stop(t + 2.8);

        const breath = this.ctx.createBufferSource();
        breath.buffer = this.noiseBuffer;
        const bFilter = this.ctx.createBiquadFilter();
        bFilter.type = 'bandpass';
        bFilter.frequency.setValueAtTime(420, t);
        bFilter.frequency.exponentialRampToValueAtTime(190, t + 2.5);
        bFilter.Q.value = 1.4;
        const bGain = this.ctx.createGain();
        bGain.gain.setValueAtTime(0.001, t);
        bGain.gain.linearRampToValueAtTime(0.28, t + 0.18);
        bGain.gain.exponentialRampToValueAtTime(0.001, t + 2.65);
        breath.connect(bFilter);
        bFilter.connect(bGain);
        bGain.connect(this.vocalCarveFilter);
        breath.start(t);
        breath.stop(t + 2.7);

        this.releaseVoiceAfter(2850);
        break;
      }

      default: {
        // Preview gentle sub pulse for loop/continuous cards when clicked in library
        const pulse = this.ctx.createOscillator();
        pulse.type = 'sine';
        pulse.frequency.setValueAtTime(92, t);
        pulse.frequency.exponentialRampToValueAtTime(48, t + 0.8);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
        pulse.connect(g);
        g.connect(this.vocalCarveFilter);
        pulse.start(t);
        pulse.stop(t + 0.9);
        this.releaseVoiceAfter(900);
      }
    }
  }

  private releaseVoiceAfter(ms: number) {
    setTimeout(() => {
      this.activeOneShotVoices = Math.max(0, this.activeOneShotVoices - 1);
    }, ms);
  }
}

export const soundEngine = new BoosteraSoundEngine();
