import {
  ActiveEffectInstance,
  BattlePhaseId,
  ROUND_PALETTES,
  RoundPaletteId,
  VfxLayer,
} from '../data/boosteraCatalog';
import { videoVfxCompositor } from './videoVfxCompositor';

interface SmokePuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  growth: number;
  alpha: number;
  age: number;
  maxAge: number;
  layer: 'BACK' | 'FRONT';
  tint: 'ambient' | 'cryo' | 'warm_plume';
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  age: number;
  maxAge: number;
  gravity: number;
  drag: number;
  layer: 'BACK' | 'FRONT';
  hueType: 'gold' | 'ember' | 'plasma';
}

interface BoltSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
}

interface LightningBolt {
  segments: BoltSegment[];
  createdAt: number;
  lifetimeMs: number;
  layer: 'BACK' | 'FRONT';
  colorHex: string;
}

interface ShockwaveRing {
  cx: number;
  cy: number;
  createdAt: number;
  durationMs: number;
  maxRadius: number;
  colorHex: string;
}

export interface RenderInputState {
  streamMode?: 'BATTLE' | 'SOLO';
  gloveRemainingSec?: number;
  elapsedSec: number;
  phase: BattlePhaseId;
  likeEnergy: number;
  roundPalette: RoundPaletteId;
  activeEffects: ActiveEffectInstance[];
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function generateBoltSegments(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  displace: number,
  thickness: number,
  depth = 0
): BoltSegment[] {
  if (displace < 6 || depth > 4) {
    return [{ x1, y1, x2, y2, thickness }];
  }
  const midX = (x1 + x2) * 0.5 + (Math.random() - 0.5) * displace;
  const midY = (y1 + y2) * 0.5 + (Math.random() - 0.5) * displace * 0.45;
  const left = generateBoltSegments(x1, y1, midX, midY, displace * 0.52, thickness, depth + 1);
  const right = generateBoltSegments(midX, midY, x2, y2, displace * 0.52, thickness * 0.92, depth + 1);
  const out = [...left, ...right];

  if (depth <= 2 && Math.random() < 0.42) {
    const branchEndX = midX + (Math.random() - 0.5) * displace * 1.4;
    const branchEndY = midY + Math.abs(y2 - y1) * (0.32 + Math.random() * 0.25);
    out.push(
      ...generateBoltSegments(midX, midY, branchEndX, branchEndY, displace * 0.45, thickness * 0.55, depth + 2)
    );
  }
  return out;
}

export class BoosteraVfxEngine {
  private smoke: SmokePuff[] = [];
  private sparks: SparkParticle[] = [];
  private bolts: LightningBolt[] = [];
  private shockwaves: ShockwaveRing[] = [];
  private processedInstances = new Set<string>();
  private lastTimeMs = performance.now();
  private smoothedEnergy = 15;

  public step(width: number, height: number, state: RenderInputState, nowMs = performance.now()) {
    const dt = Math.min(0.05, Math.max(0.001, (nowMs - this.lastTimeMs) / 1000));
    this.lastTimeMs = nowMs;

    // Smooth energy interpolation so jumps feel organic
    this.smoothedEnergy += (state.likeEnergy - this.smoothedEnergy) * Math.min(1, dt * 4.5);

    const palette = ROUND_PALETTES[state.roundPalette] || ROUND_PALETTES.molten_gold;
    const isPreDropQuiet = state.elapsedSec >= 218 && state.elapsedSec < 225;

    // 1. Continuous Ambient Volumetric Smoke (BACK)
    const phaseDensity =
      state.phase === 'IGNITION'
        ? 0.35
        : state.phase === 'MOMENTUM'
          ? 0.52
          : state.phase === 'PRESSURE'
            ? 0.7
            : state.phase === 'TENSION'
              ? isPreDropQuiet
                ? 0.25
                : 0.82
              : 0.95;

    if (this.smoke.length < 95 && Math.random() < phaseDensity * dt * 16) {
      const fromLeft = Math.random() < 0.5;
      // Keep heavier smoke biased to bottom & outer corridors
      const x = fromLeft
        ? width * (0.02 + Math.random() * 0.28)
        : width * (0.7 + Math.random() * 0.28);
      const y = height * (0.86 + Math.random() * 0.16);
      this.smoke.push({
        x,
        y,
        vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 14),
        vy: -(16 + Math.random() * 26 * phaseDensity),
        radius: width * (0.11 + Math.random() * 0.12),
        growth: width * 0.032,
        alpha: 0.12 + phaseDensity * 0.11,
        age: 0,
        maxAge: 3.6 + Math.random() * 2.2,
        layer: 'BACK',
        tint: 'ambient',
      });
    }

    // 2. Continuous Progressive Like Energy (Outer 25% Left & Right Corridors — BACK)
    if (this.smoothedEnergy >= 15 && !isPreDropQuiet) {
      const eNorm = (this.smoothedEnergy - 15) / 85; // 0..1
      const spawnCount = Math.random() < eNorm * dt * 48 ? (eNorm > 0.7 ? 2 : 1) : 0;
      for (let i = 0; i < spawnCount; i++) {
        const leftSide = Math.random() < 0.5;
        const marginX = leftSide
          ? width * (0.02 + Math.random() * 0.21)
          : width * (0.77 + Math.random() * 0.21);
        this.sparks.push({
          x: marginX,
          y: height * (0.72 + Math.random() * 0.28),
          vx: (Math.random() - 0.5) * 38,
          vy: -(95 + eNorm * 230 + Math.random() * 90),
          size: 1.4 + Math.random() * (1.8 + eNorm * 1.6),
          age: 0,
          maxAge: 0.85 + Math.random() * 0.9,
          gravity: -25, // thermal updraft!
          drag: 0.99,
          layer: 'BACK',
          hueType: eNorm > 0.65 ? 'plasma' : 'ember',
        });
      }

      // HYPE & OVERDRIVE outer perimeter plasma micro-arcs
      if (this.smoothedEnergy >= 62 && Math.random() < eNorm * dt * 5.5) {
        const leftSide = Math.random() < 0.5;
        const baseX = leftSide ? width * (0.06 + Math.random() * 0.12) : width * (0.82 + Math.random() * 0.12);
        const startY = height * (0.3 + Math.random() * 0.5);
        this.bolts.push({
          segments: generateBoltSegments(baseX, startY, baseX + (Math.random() - 0.5) * 28, startY - height * 0.18, 22, 1.8),
          createdAt: nowMs,
          lifetimeMs: 180,
          layer: 'BACK',
          colorHex: palette.arcHex,
        });
      }
    }

    // 3. Phase 4 TENSION Spiraling Forge Cinders (02:55–03:38) in Battle Mode
    if (state.streamMode !== 'SOLO' && state.phase === 'TENSION' && !isPreDropQuiet && Math.random() < dt * 26) {
      const leftSide = Math.random() < 0.5;
      const x = leftSide ? width * (0.03 + Math.random() * 0.22) : width * (0.75 + Math.random() * 0.22);
      this.sparks.push({
        x,
        y: height * 0.98,
        vx: (leftSide ? 1 : -1) * (12 + Math.random() * 24),
        vy: -(110 + Math.random() * 120),
        size: 1.8 + Math.random() * 2.0,
        age: 0,
        maxAge: 1.6 + Math.random() * 1.1,
        gravity: -15,
        drag: 0.992,
        layer: 'BACK',
        hueType: 'ember',
      });
    }

    // 3B. SOLO Mode Warm Floating Tungsten Bokeh Motes
    if (state.streamMode === 'SOLO' && Math.random() < dt * 14) {
      const leftSide = Math.random() < 0.5;
      const x = leftSide ? width * (0.04 + Math.random() * 0.22) : width * (0.74 + Math.random() * 0.22);
      this.sparks.push({
        x,
        y: height * (0.3 + Math.random() * 0.65),
        vx: (Math.random() - 0.5) * 16,
        vy: -(18 + Math.random() * 26),
        size: 2.2 + Math.random() * 2.4,
        age: 0,
        maxAge: 2.4 + Math.random() * 1.6,
        gravity: -4,
        drag: 0.995,
        layer: 'BACK',
        hueType: 'gold',
      });
    }

    // 3C. Active Glove x5 Multiplier Corridor Surge (30s active window)
    if ((state.gloveRemainingSec ?? 0) > 0 && Math.random() < dt * 42) {
      const leftSide = Math.random() < 0.5;
      const gx = leftSide ? width * (0.04 + Math.random() * 0.19) : width * (0.77 + Math.random() * 0.19);
      this.sparks.push({
        x: gx,
        y: height * 0.98,
        vx: (Math.random() - 0.5) * 45,
        vy: -(240 + Math.random() * 210),
        size: 2.0 + Math.random() * 2.2,
        age: 0,
        maxAge: 0.95 + Math.random() * 0.55,
        gravity: -30,
        drag: 0.99,
        layer: 'BACK',
        hueType: Math.random() < 0.5 ? 'gold' : 'plasma',
      });
    }

    // 4. Process Active One-Shot & Choreographed Effects
    for (const fx of state.activeEffects) {
      const elapsedFxMs = Date.now() - fx.triggeredAt;
      if (elapsedFxMs < 0 || elapsedFxMs > fx.durationMs) continue;
      const progress = elapsedFxMs / fx.durationMs;

      // Initial burst spawns (once per instanceId)
      if (!this.processedInstances.has(fx.instanceId)) {
        this.processedInstances.add(fx.instanceId);
        if (this.processedInstances.size > 150) {
          const first = this.processedInstances.values().next().value;
          if (first) this.processedInstances.delete(first);
        }

        if (fx.effectId === 'FOLLOW_GOLDEN_SPARKS') {
          // Upper-left & upper-right golden titanium sparkler bursts cascading along outer corridors
          for (let i = 0; i < 68; i++) {
            const left = i % 2 === 0;
            const originX = left ? width * 0.12 : width * 0.88;
            const originY = height * (0.14 + Math.random() * 0.08);
            const spreadAngle = left
              ? -0.35 + Math.random() * 1.25
              : Math.PI + 0.35 - Math.random() * 1.25;
            const speed = 75 + Math.random() * 220;
            this.sparks.push({
              x: originX,
              y: originY,
              vx: Math.cos(spreadAngle) * speed * 0.55,
              vy: Math.sin(spreadAngle) * speed * 0.45 - 50,
              size: 1.8 + Math.random() * 2.4,
              age: 0,
              maxAge: 1.5 + Math.random() * 1.6,
              gravity: 310,
              drag: 0.985,
              layer: 'FRONT',
              hueType: 'gold',
            });
          }
        } else if (fx.effectId === 'CHAT_TESLA_FILAMENT') {
          const left = Math.random() < 0.5;
          const x = left ? width * 0.08 : width * 0.92;
          this.bolts.push({
            segments: generateBoltSegments(x, height * 0.82, x + (Math.random() - 0.5) * 20, height * 0.24, 28, 2.2),
            createdAt: nowMs,
            lifetimeMs: 520,
            layer: 'BACK',
            colorHex: palette.arcHex,
          });
        } else if (fx.effectId === 'GOAL_SHOCKWAVE_RING') {
          // Fast refractive pressure wave (crosses center in <240ms!) + outer spark burst
          this.shockwaves.push({
            cx: width * 0.5,
            cy: height * 0.5,
            createdAt: nowMs,
            durationMs: 850,
            maxRadius: Math.hypot(width, height) * 0.72,
            colorHex: palette.primaryHex,
          });
          for (let i = 0; i < 56; i++) {
            const angle = (i / 56) * Math.PI * 2 + Math.random() * 0.1;
            const rStart = width * 0.26; // Starts outside central face corridor!
            const speed = 180 + Math.random() * 240;
            this.sparks.push({
              x: width * 0.5 + Math.cos(angle) * rStart,
              y: height * 0.5 + Math.sin(angle) * rStart,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              size: 2.0 + Math.random() * 2.2,
              age: 0,
              maxAge: 1.1 + Math.random() * 0.9,
              gravity: 160,
              drag: 0.975,
              layer: 'BACK',
              hueType: 'gold',
            });
          }
        } else if (fx.effectId === 'PRESSURE_FORKED_LIGHTNING') {
          // Twin forked strikes along upper-outer corridors (BACK)
          [0.18, 0.82].forEach((normX, idx) => {
            setTimeout(() => {
              this.bolts.push({
                segments: generateBoltSegments(
                  width * normX,
                  0,
                  width * (normX + (idx === 0 ? -0.05 : 0.05)),
                  height * 0.68,
                  46,
                  3.2
                ),
                createdAt: performance.now(),
                lifetimeMs: 480,
                layer: 'BACK',
                colorHex: '#E0F2FE',
              });
            }, idx * 130);
          });
        } else if (fx.effectId === 'GLOVE_POWER_SURGE') {
          // Dual plasma bolts + upward gold surge along outer margins
          [0.12, 0.88].forEach((nx) => {
            this.bolts.push({
              segments: generateBoltSegments(width * nx, height * 0.95, width * nx, height * 0.15, 36, 2.8),
              createdAt: nowMs,
              lifetimeMs: 650,
              layer: 'BACK',
              colorHex: '#FDE68A',
            });
          });
        } else if (
          fx.effectId === 'BEAST_08_VIOLET_PHOENIX' ||
          fx.effectId === 'BEAST_09_SOLAR_TIGER' ||
          fx.effectId === 'BEAST_10_ROYAL_FIRE_LION'
        ) {
          const isPhoenix = fx.effectId === 'BEAST_08_VIOLET_PHOENIX';
          const boltHex = isPhoenix ? '#E879F9' : '#F59E0B';
          [0.16, 0.84].forEach((nx, idx) => {
            this.bolts.push({
              segments: generateBoltSegments(
                width * 0.5,
                height * 0.24,
                width * (nx + (idx === 0 ? -0.06 : 0.06)),
                height * 0.06,
                34,
                2.6
              ),
              createdAt: nowMs,
              lifetimeMs: 680,
              layer: 'BACK',
              colorHex: boltHex,
            });
          });
          for (let i = 0; i < 52; i++) {
            const left = i % 2 === 0;
            const spread = (Math.random() * 0.42 + 0.08) * (left ? -1 : 1);
            this.sparks.push({
              x: width * (0.5 + spread * 0.5),
              y: height * (0.14 + Math.random() * 0.2),
              vx: spread * (240 + Math.random() * 190),
              vy: -(90 + Math.random() * 200),
              size: 2.1 + Math.random() * 2.4,
              age: 0,
              maxAge: 1.2 + Math.random() * 1.1,
              gravity: isPhoenix ? -35 : 85,
              drag: 0.985,
              layer: 'BACK',
              hueType: isPhoenix ? 'plasma' : 'gold',
            });
          }
        } else if (fx.effectId === 'SNIPE_CRITICAL_FLASH') {
          // Ultra-fast 200ms center-clear tactical shockwave + 4-corner tungsten flares
          this.shockwaves.push({
            cx: width * 0.5,
            cy: height * 0.5,
            createdAt: nowMs,
            durationMs: 650,
            maxRadius: Math.hypot(width, height) * 0.78,
            colorHex: '#FB7185',
          });
          const corners = [
            [0.06, 0.08],
            [0.94, 0.08],
            [0.06, 0.92],
            [0.94, 0.92],
          ];
          corners.forEach(([cx, cy]) => {
            for (let i = 0; i < 16; i++) {
              const toCenterAngle = Math.atan2(0.5 - cy, 0.5 - cx) + (Math.random() - 0.5) * 0.7;
              const spd = 140 + Math.random() * 190;
              this.sparks.push({
                x: width * cx,
                y: height * cy,
                vx: Math.cos(toCenterAngle) * spd * 0.55,
                vy: Math.sin(toCenterAngle) * spd * 0.55,
                size: 2.2 + Math.random() * 2.0,
                age: 0,
                maxAge: 0.75 + Math.random() * 0.45,
                gravity: 110,
                drag: 0.96,
                layer: 'FRONT',
                hueType: 'gold',
              });
            }
          });
        } else if (fx.effectId === 'SOLO_WARM_LOUNGE') {
          for (let i = 0; i < 28; i++) {
            const left = i % 2 === 0;
            this.sparks.push({
              x: left ? width * (0.04 + Math.random() * 0.22) : width * (0.74 + Math.random() * 0.22),
              y: height * (0.25 + Math.random() * 0.65),
              vx: (Math.random() - 0.5) * 20,
              vy: -(20 + Math.random() * 35),
              size: 2.4 + Math.random() * 2.0,
              age: 0,
              maxAge: 2.5 + Math.random() * 1.5,
              gravity: -5,
              drag: 0.995,
              layer: 'BACK',
              hueType: 'gold',
            });
          }
        }
      }

      // Sustained emitter effects while active
      if (fx.effectId === 'SHARE_CO2_CANNONS' && progress < 0.52) {
        // High-velocity cryo jets from lower-left & lower-right along outer 24% corridors (FRONT)
        const jetCount = 5;
        for (let j = 0; j < jetCount; j++) {
          const left = j % 2 === 0;
          const nozzleX = left ? width * 0.06 : width * 0.94;
          const nozzleY = height * 0.96;
          const angle = left ? -Math.PI * 0.43 + (Math.random() - 0.5) * 0.14 : -Math.PI * 0.57 + (Math.random() - 0.5) * 0.14;
          const speed = height * (0.85 + Math.random() * 0.45);
          this.smoke.push({
            x: nozzleX,
            y: nozzleY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: width * (0.028 + Math.random() * 0.025),
            growth: width * 0.11,
            alpha: 0.42,
            age: 0,
            maxAge: 0.75 + Math.random() * 0.45,
            layer: 'FRONT',
            tint: 'cryo',
          });
        }
      }

      if (fx.effectId === 'SHARE_SMOKE_PLUMES' && progress < 0.62) {
        [0.2, 0.8].forEach((colX) => {
          if (Math.random() < 0.65) {
            this.smoke.push({
              x: width * colX + (Math.random() - 0.5) * width * 0.04,
              y: height * 0.95,
              vx: (Math.random() - 0.5) * 22,
              vy: -(height * (0.42 + Math.random() * 0.22)),
              radius: width * 0.065,
              growth: width * 0.085,
              alpha: 0.34,
              age: 0,
              maxAge: 1.6 + Math.random() * 0.6,
              layer: 'BACK',
              tint: 'warm_plume',
            });
          }
        });
      }

      // 15s Choreographed GRAND FINALE (03:45 - 04:00)
      if (fx.effectId === 'FINALE_PYRO_CONVERGENCE') {
        const secInFinale = (elapsedFxMs / 1000);
        // Act 1 (0 - 13.4s): Twin stadium golden pyro fountains in outer margins (BACK)
        if (secInFinale < 13.4) {
          for (let s = 0; s < 3; s++) {
            const left = Math.random() < 0.5;
            const fxX = left ? width * 0.13 : width * 0.87;
            this.sparks.push({
              x: fxX + (Math.random() - 0.5) * 14,
              y: height * 0.96,
              vx: (left ? 1 : -1) * (15 + Math.random() * 48) + (Math.random() - 0.5) * 30,
              vy: -(height * (0.58 + Math.random() * 0.32)),
              size: 2.0 + Math.random() * 2.2,
              age: 0,
              maxAge: 1.1 + Math.random() * 0.7,
              gravity: 280,
              drag: 0.988,
              layer: 'BACK',
              hueType: 'gold',
            });
          }
        }
        // Act 2 (8.0 - 13.5s): Escalating crown lightning arcs
        if (secInFinale >= 8.0 && secInFinale < 13.5 && Math.random() < dt * 9) {
          const left = Math.random() < 0.5;
          const sx = left ? width * 0.05 : width * 0.95;
          this.bolts.push({
            segments: generateBoltSegments(sx, height * 0.06, width * (left ? 0.26 : 0.74), height * 0.42, 34, 2.5),
            createdAt: nowMs,
            lifetimeMs: 240,
            layer: 'BACK',
            colorHex: palette.secondaryHex,
          });
        }
        // Act 3 (13.95s): Massive Climax Shockwave + Perimeter Golden Rain!
        const climaxTag = `${fx.instanceId}_climax_hit`;
        if (secInFinale >= 13.95 && !this.processedInstances.has(climaxTag)) {
          this.processedInstances.add(climaxTag);
          this.shockwaves.push({
            cx: width * 0.5,
            cy: height * 0.48,
            createdAt: nowMs,
            durationMs: 950,
            maxRadius: Math.hypot(width, height) * 0.85,
            colorHex: palette.primaryHex,
          });
          for (let k = 0; k < 95; k++) {
            const left = k % 2 === 0;
            const px = left ? width * (0.04 + Math.random() * 0.22) : width * (0.74 + Math.random() * 0.22);
            this.sparks.push({
              x: px,
              y: height * (0.05 + Math.random() * 0.35),
              vx: (Math.random() - 0.5) * 140,
              vy: -60 + Math.random() * 190,
              size: 2.2 + Math.random() * 2.6,
              age: 0,
              maxAge: 1.6 + Math.random() * 1.4,
              gravity: 240,
              drag: 0.985,
              layer: 'FRONT',
              hueType: 'gold',
            });
          }
        }
      }
    }

    // Update Smoke Physics
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const p = this.smoke[i];
      p.age += dt;
      if (p.age >= p.maxAge) {
        this.smoke.splice(i, 1);
        continue;
      }
      // Aerodynamic drag slows supersonic cryo jets naturally
      const drag = p.tint === 'cryo' ? Math.pow(0.18, dt) : Math.pow(0.75, dt);
      p.vx *= drag;
      p.vy *= drag;
      // Gentle curl turbulence
      p.vx += Math.sin(p.age * 3.2 + p.y * 0.015) * 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.radius += p.growth * dt;
    }

    // Update Ballistic Sparks Physics
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      if (s.age >= s.maxAge) {
        this.sparks.splice(i, 1);
        continue;
      }
      s.vx *= s.drag;
      s.vy = s.vy * s.drag + s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }

    // Prune expired Lightning & Shockwaves
    this.bolts = this.bolts.filter((b) => nowMs - b.createdAt < b.lifetimeMs);
    this.shockwaves = this.shockwaves.filter((w) => nowMs - w.createdAt < w.durationMs);
  }

  public renderLayer(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    targetLayer: 'BACK' | 'FRONT',
    state: RenderInputState,
    backgroundMode: 'transparent' | 'chroma_green' | 'pitch_black' = 'transparent',
    nowMs = performance.now()
  ) {
    ctx.clearRect(0, 0, width, height);
    if (backgroundMode === 'chroma_green') {
      ctx.fillStyle = '#00FF00';
      ctx.fillRect(0, 0, width, height);
    } else if (backgroundMode === 'pitch_black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    }

    const palette = ROUND_PALETTES[state.roundPalette] || ROUND_PALETTES.molten_gold;

    // BACK-only atmospheric & rim lighting layers
    if (targetLayer === 'BACK') {
      // Progressive Like Charge perimeter aura (left & right 24% borders)
      if (this.smoothedEnergy >= 15) {
        const eNorm = (this.smoothedEnergy - 15) / 85;
        const leftGrad = ctx.createLinearGradient(0, 0, width * 0.28, 0);
        leftGrad.addColorStop(0, hexToRgba(palette.primaryHex, 0.24 * eNorm));
        leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = leftGrad;
        ctx.fillRect(0, 0, width * 0.28, height);

        const rightGrad = ctx.createLinearGradient(width, 0, width * 0.72, 0);
        rightGrad.addColorStop(0, hexToRgba(palette.primaryHex, 0.24 * eNorm));
        rightGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rightGrad;
        ctx.fillRect(width * 0.72, 0, width * 0.28, height);
      }

      // Phase 4 Tension rhythmic outer vignette pulse
      if (state.phase === 'TENSION') {
        const bpm = 82 + ((state.elapsedSec - 175) / 50) * 28;
        const pulse = 0.5 + 0.5 * Math.sin((nowMs / 1000) * (bpm / 60) * Math.PI * 2);
        const vig = ctx.createRadialGradient(
          width * 0.5,
          height * 0.46,
          width * 0.26,
          width * 0.5,
          height * 0.5,
          width * 0.78
        );
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, `rgba(6, 8, 14, ${(0.38 + pulse * 0.22).toFixed(3)})`);
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, width, height);
      }

      // Anamorphic Viewer Join Light Sweep
      for (const fx of state.activeEffects) {
        if (fx.effectId === 'JOIN_ANAMORPHIC_SWEEP') {
          const prog = Math.max(0, Math.min(1, (Date.now() - fx.triggeredAt) / fx.durationMs));
          const sweepX = -width * 0.3 + prog * width * 1.6;
          const env = Math.sin(prog * Math.PI);
          ctx.save();
          ctx.translate(sweepX, 0);
          ctx.rotate(-0.24);
          const beam = ctx.createLinearGradient(-width * 0.18, 0, width * 0.18, 0);
          beam.addColorStop(0, 'rgba(0,0,0,0)');
          beam.addColorStop(0.5, hexToRgba(palette.secondaryHex, 0.22 * env));
          beam.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = beam;
          ctx.fillRect(-width * 0.2, -height * 0.2, width * 0.4, height * 1.4);
          ctx.restore();
        } else if (
          (fx.effectId === 'BEAST_08_VIOLET_PHOENIX' ||
            fx.effectId === 'BEAST_09_SOLAR_TIGER' ||
            fx.effectId === 'BEAST_10_ROYAL_FIRE_LION') &&
          !videoVfxCompositor.isVideoEffect(fx.effectId)
        ) {
          // 60fps Upper-Crest BACK Guardian Energy Emblem (automatically yields when real MP4 is bound!)
          const prog = Math.max(0, Math.min(1, (Date.now() - fx.triggeredAt) / fx.durationMs));
          const env = Math.min(1, prog / 0.14) * Math.min(1, (1 - prog) / 0.18);
          if (env > 0.01) {
            ctx.save();
            const prevComp = ctx.globalCompositeOperation;
            if (backgroundMode !== 'chroma_green') {
              ctx.globalCompositeOperation = 'lighter';
            }
            const cx = width * 0.5;
            const cy = height * 0.23 - Math.sin(prog * Math.PI) * height * 0.03;
            const flap = Math.sin(nowMs * 0.008) * 0.12;

            if (fx.effectId === 'BEAST_08_VIOLET_PHOENIX') {
              // Astral Violet-Magenta Phoenix Wings spreading in Upper-Crest BACK
              const aura = ctx.createRadialGradient(cx, cy, width * 0.03, cx, cy, width * 0.46);
              aura.addColorStop(0, `rgba(245, 208, 254, ${(0.48 * env).toFixed(3)})`);
              aura.addColorStop(0.45, `rgba(192, 38, 211, ${(0.34 * env).toFixed(3)})`);
              aura.addColorStop(1, 'rgba(112, 26, 117, 0)');
              ctx.fillStyle = aura;
              ctx.beginPath();
              ctx.arc(cx, cy, width * 0.46, 0, Math.PI * 2);
              ctx.fill();

              [-1, 1].forEach((dir) => {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.scale(dir, 1);
                ctx.rotate(-0.18 + flap);
                for (let feather = 0; feather < 6; feather++) {
                  const len = width * (0.44 - feather * 0.045);
                  const ang = -0.45 + feather * 0.17;
                  ctx.strokeStyle =
                    feather % 2 === 0
                      ? `rgba(232, 121, 249, ${(0.62 * env).toFixed(3)})`
                      : `rgba(250, 232, 255, ${(0.75 * env).toFixed(3)})`;
                  ctx.lineWidth = Math.max(2, (7 - feather) * 1.1);
                  ctx.lineCap = 'round';
                  ctx.beginPath();
                  ctx.moveTo(width * 0.03, 0);
                  ctx.quadraticCurveTo(
                    Math.cos(ang - 0.22) * len * 0.58,
                    Math.sin(ang - 0.28) * len * 0.58,
                    Math.cos(ang) * len,
                    Math.sin(ang) * len
                  );
                  ctx.stroke();
                }
                ctx.restore();
              });
            } else {
              // Blazing Solar Tiger (#9) / Royal Fire Lion Mane Crown (#10) in Upper-Crest BACK
              const isLion = fx.effectId === 'BEAST_10_ROYAL_FIRE_LION';
              const pulse = 1 + Math.sin(nowMs * 0.014) * 0.06;
              const crownGrad = ctx.createRadialGradient(
                cx,
                cy,
                width * 0.04,
                cx,
                cy,
                width * (isLion ? 0.48 : 0.42) * pulse
              );
              crownGrad.addColorStop(0, `rgba(255, 251, 235, ${(0.55 * env).toFixed(3)})`);
              crownGrad.addColorStop(0.35, `rgba(245, 158, 11, ${(0.44 * env).toFixed(3)})`);
              crownGrad.addColorStop(0.7, `rgba(234, 88, 12, ${(0.26 * env).toFixed(3)})`);
              crownGrad.addColorStop(1, 'rgba(154, 52, 18, 0)');
              ctx.fillStyle = crownGrad;
              ctx.beginPath();
              ctx.arc(cx, cy, width * (isLion ? 0.48 : 0.42) * pulse, 0, Math.PI * 2);
              ctx.fill();

              const rayCount = isLion ? 18 : 12;
              for (let rIdx = 0; rIdx < rayCount; rIdx++) {
                const tNorm = rIdx / (rayCount - 1);
                const angle = Math.PI * (1.08 + tNorm * 0.84);
                const innerR = width * 0.12;
                const outerR =
                  width * (isLion ? 0.42 : 0.36) * (0.85 + 0.18 * Math.sin(nowMs * 0.012 + rIdx));
                ctx.strokeStyle =
                  rIdx % 2 === 0
                    ? `rgba(251, 191, 36, ${(0.68 * env).toFixed(3)})`
                    : `rgba(249, 115, 22, ${(0.58 * env).toFixed(3)})`;
                ctx.lineWidth = isLion ? 5.2 : 6.4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
                ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
                ctx.stroke();
              }

              // Fierce glowing predator eyes high above presenter head
              [-1, 1].forEach((eyeDir) => {
                ctx.fillStyle = `rgba(254, 243, 199, ${(0.88 * env).toFixed(3)})`;
                ctx.beginPath();
                ctx.ellipse(
                  cx + eyeDir * width * 0.085,
                  cy - height * 0.015,
                  width * 0.028,
                  height * 0.007,
                  eyeDir * -0.22,
                  0,
                  Math.PI * 2
                );
                ctx.fill();
              });
            }

            ctx.globalCompositeOperation = prevComp;
            ctx.restore();
          }
        }
      }
    }

    // Volumetric Smoke & Cryo Puffs for this layer
    for (const p of this.smoke) {
      if (p.layer !== targetLayer) continue;
      const lifeRatio = p.age / p.maxAge;
      const fadeIn = Math.min(1, lifeRatio * 5.5);
      const fadeOut = Math.pow(1 - lifeRatio, 1.55);
      const a = p.alpha * fadeIn * fadeOut;
      if (a <= 0.004) continue;

      const grad = ctx.createRadialGradient(p.x, p.y, p.radius * 0.08, p.x, p.y, p.radius);
      if (p.tint === 'cryo') {
        grad.addColorStop(0, `rgba(248, 250, 252, ${(a * 0.95).toFixed(3)})`);
        grad.addColorStop(0.45, `rgba(226, 232, 240, ${(a * 0.55).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(226, 232, 240, 0)');
      } else if (p.tint === 'warm_plume') {
        grad.addColorStop(0, hexToRgba(palette.primaryHex, a * 0.65));
        grad.addColorStop(0.5, `rgba(100, 116, 139, ${(a * 0.48).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(30, 41, 59, 0)');
      } else {
        const [r, g, b] = palette.smokeTintRgb;
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`);
        grad.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, ${(a * 0.42).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Additive-style glowing elements (Lightning, Sparks, Shockwaves)
    ctx.save();
    if (backgroundMode !== 'chroma_green') {
      ctx.globalCompositeOperation = 'lighter';
    }

    // Lightning Bolts
    for (const bolt of this.bolts) {
      if (bolt.layer !== targetLayer) continue;
      const ageRatio = (nowMs - bolt.createdAt) / bolt.lifetimeMs;
      if (ageRatio < 0 || ageRatio >= 1) continue;
      const flicker = ageRatio < 0.25 ? 1 : (1 - ageRatio) * (0.75 + Math.random() * 0.25);

      // Outer plasma bloom
      ctx.strokeStyle = hexToRgba(bolt.colorHex, 0.42 * flicker);
      ctx.lineCap = 'round';
      for (const seg of bolt.segments) {
        ctx.lineWidth = seg.thickness * 3.4;
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      }

      // White-hot core
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.95 * flicker).toFixed(3)})`;
      for (const seg of bolt.segments) {
        ctx.lineWidth = seg.thickness;
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      }
    }

    // Velocity-stretched Metallic Sparks
    for (const s of this.sparks) {
      if (s.layer !== targetLayer) continue;
      const life = 1 - s.age / s.maxAge;
      if (life <= 0) continue;

      const tailX = s.x - s.vx * 0.032;
      const tailY = s.y - s.vy * 0.032;

      const outerHex =
        s.hueType === 'gold'
          ? '#F59E0B'
          : s.hueType === 'plasma'
            ? palette.arcHex
            : palette.primaryHex;

      ctx.strokeStyle = hexToRgba(outerHex, life * 0.85);
      ctx.lineWidth = s.size * 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();

      ctx.strokeStyle = `rgba(255, 251, 235, ${(life * 0.95).toFixed(3)})`;
      ctx.lineWidth = s.size * 0.65;
      ctx.beginPath();
      ctx.moveTo((tailX + s.x) * 0.5, (tailY + s.y) * 0.5);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }

    // Concussive Shockwave Rings (rendered in FRONT — crosses center in <240ms!)
    if (targetLayer === 'FRONT') {
      for (const w of this.shockwaves) {
        const p = (nowMs - w.createdAt) / w.durationMs;
        if (p < 0 || p >= 1) continue;
        // Fast non-linear expansion so center clears in < 240ms
        const eased = 1 - Math.pow(1 - p, 3.1);
        const radius = w.maxRadius * eased;
        const alpha = Math.pow(1 - p, 1.8) * 0.78;

        ctx.strokeStyle = hexToRgba(w.colorHex, alpha);
        ctx.lineWidth = Math.max(2, 14 * (1 - p));
        ctx.beginPath();
        ctx.arc(w.cx, w.cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.8).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, 4 * (1 - p));
        ctx.beginPath();
        ctx.arc(w.cx, w.cy, radius * 1.03, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

/**
 * Renders any BOOSTERA VFX asset into a downloadable vertical 9:16 WebM video clip
 * supporting Transparent Alpha, Pure #00FF00 Chroma Green, or #000000 Screen Black.
 */
export async function exportVfxClipToWebm(options: {
  effectId: string;
  durationSec: number;
  layer: VfxLayer;
  roundPalette: RoundPaletteId;
  backgroundMode: 'transparent' | 'chroma_green' | 'pitch_black';
  onProgress?: (pct: number) => void;
}): Promise<{ blob: Blob; filename: string }> {
  const width = 720;
  const height = 1280; // Vertical 9:16 broadcast plate
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true })!;

  const mimeCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const selectedMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

  const stream = canvas.captureStream(60);
  const recorder = new MediaRecorder(stream, {
    mimeType: selectedMime,
    videoBitsPerSecond: 12_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const engine = new BoosteraVfxEngine();
  const startWall = Date.now();
  const startPerf = performance.now();
  const renderDurationSec = Math.min(options.durationSec, 6); // Keep interactive export snappy (up to 6s)
  const totalMs = renderDurationSec * 1000;

  const instance: ActiveEffectInstance = {
    instanceId: `export_${startWall}`,
    effectId: options.effectId,
    triggeredAt: startWall,
    durationMs: options.durationSec * 1000,
    layer: options.layer,
    intensity: 1.0,
    sourceLabel: 'ייצוא קליפ',
  };

  return new Promise((resolve, reject) => {
    recorder.onerror = () => reject(new Error('שגיאה בקידוד וידאו WebM בדפדפן.'));
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: selectedMime });
      const suffix =
        options.backgroundMode === 'chroma_green'
          ? 'chroma_00FF00'
          : options.backgroundMode === 'pitch_black'
            ? 'screen_black'
            : 'alpha_vp9';
      resolve({
        blob,
        filename: `${options.effectId.toLowerCase()}_9x16_${suffix}.webm`,
      });
    };

    recorder.start(100);

    function frame() {
      const nowPerf = performance.now();
      const elapsedMs = nowPerf - startPerf;
      if (options.onProgress) {
        options.onProgress(Math.min(99, Math.round((elapsedMs / totalMs) * 100)));
      }

      const simState: RenderInputState = {
        elapsedSec: options.effectId === 'TENSION_EMBER_VORTEX' ? 190 : options.effectId === 'FINALE_PYRO_CONVERGENCE' ? 238 : 95,
        phase:
          options.effectId === 'TENSION_EMBER_VORTEX'
            ? 'TENSION'
            : options.effectId === 'FINALE_PYRO_CONVERGENCE'
              ? 'FINALE'
              : 'MOMENTUM',
        likeEnergy: options.effectId === 'LIKE_PROGRESSIVE_CHARGE' ? 92 : 10,
        roundPalette: options.roundPalette,
        activeEffects: [instance],
      };

      engine.step(width, height, simState, nowPerf);

      if (options.layer === 'HYBRID') {
        // Render BACK then FRONT onto composite offscreen
        const tempFront = document.createElement('canvas');
        tempFront.width = width;
        tempFront.height = height;
        const fCtx = tempFront.getContext('2d')!;
        engine.renderLayer(ctx, width, height, 'BACK', simState, options.backgroundMode, nowPerf);
        engine.renderLayer(fCtx, width, height, 'FRONT', simState, 'transparent', nowPerf);
        ctx.drawImage(tempFront, 0, 0);
      } else {
        engine.renderLayer(
          ctx,
          width,
          height,
          options.layer === 'FRONT' ? 'FRONT' : 'BACK',
          simState,
          options.backgroundMode,
          nowPerf
        );
      }

      if (elapsedMs < totalMs) {
        requestAnimationFrame(frame);
      } else {
        if (options.onProgress) options.onProgress(100);
        recorder.stop();
      }
    }

    requestAnimationFrame(frame);
  });
}
