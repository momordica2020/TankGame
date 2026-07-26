import type { Particle, LightPillar } from './types';
import { randRange, randPick } from './math';

const MAX_PARTICLES = 2000;
let pool: Particle[] = [];

export function initParticles() {
  pool = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pool.push({
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 1, size: 1, color: '#fff', active: false,
    });
  }
}

function spawn(): Particle | null {
  for (const p of pool) {
    if (!p.active) return p;
  }
  return null;
}

export function spawnParticles(
  x: number,
  y: number,
  count: number,
  color: string | string[],
  speedMin: number,
  speedMax: number,
  sizeMin: number,
  sizeMax: number,
  lifeMin: number,
  lifeMax: number
) {
  for (let i = 0; i < count; i++) {
    const p = spawn();
    if (!p) break;
    const angle = randRange(0, Math.PI * 2);
    const speed = randRange(speedMin, speedMax);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = randRange(lifeMin, lifeMax);
    p.maxLife = p.life;
    p.size = randRange(sizeMin, sizeMax);
    p.color = Array.isArray(color) ? randPick(color) : color;
    p.active = true;
  }
}

export function spawnMuzzleFlash(x: number, y: number, angle: number, color: string) {
  for (let i = 0; i < 10; i++) {
    const p = spawn();
    if (!p) break;
    const spread = randRange(-0.4, 0.4);
    const speed = randRange(120, 280);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle + spread) * speed;
    p.vy = Math.sin(angle + spread) * speed;
    p.life = randRange(0.06, 0.15);
    p.maxLife = p.life;
    p.size = randRange(2, 5);
    p.color = color;
    p.active = true;
  }
}

export function spawnExplosion(x: number, y: number, size: number) {
  const colors = ['#ff3300', '#ff8800', '#ffcc00', '#ff6600', '#ffffff', '#ffaa22'];
  spawnParticles(x, y, Math.floor(size * 3), colors, 80, 450, 2, 8, 0.2, 0.7);
  spawnParticles(x, y, Math.floor(size * 1.5), ['#666666', '#555555', '#777777', '#444444'], 30, 180, 2, 6, 0.4, 1.0);
  spawnParticles(x, y, Math.floor(size * 0.8), ['#ffffff', '#ffffaa', '#ffff88'], 150, 350, 1, 3, 0.1, 0.3);
}

export function spawnBigExplosion(x: number, y: number) {
  const colors = ['#ff2200', '#ff6600', '#ffaa00', '#ffdd00', '#ffffff', '#ff4444'];
  spawnParticles(x, y, 120, colors, 100, 500, 3, 10, 0.3, 1.0);
  spawnParticles(x, y, 60, ['#555555', '#666666', '#777777', '#444444'], 40, 200, 3, 8, 0.6, 1.5);
  spawnParticles(x, y, 40, ['#ffffff', '#ffffaa'], 200, 400, 2, 5, 0.15, 0.4);
}

export function spawnBlood(x: number, y: number, amount: number) {
  spawnParticles(x, y, Math.floor(amount * 1.5), ['#cc0000', '#990000', '#ff2222', '#ff4444', '#aa0000'], 40, 180, 2, 6, 0.2, 0.5);
}

export function spawnExpOrbSparkle(x: number, y: number) {
  spawnParticles(x, y, 8, ['#44ff88', '#88ffaa', '#00ff66', '#aaffcc'], 30, 100, 1.5, 4, 0.2, 0.5);
}

export function spawnHitSpark(x: number, y: number, color: string) {
  spawnParticles(x, y, 12, [color, '#ffffff', color], 80, 250, 1, 4, 0.1, 0.3);
}

export function spawnLightning(x: number, y: number) {
  spawnParticles(x, y, 20, ['#88ccff', '#ffffff', '#aaddff', '#4488ff'], 60, 300, 2, 6, 0.1, 0.3);
}

export function spawnIceShatter(x: number, y: number) {
  spawnParticles(x, y, 25, ['#66ccff', '#aaeeff', '#ffffff', '#88ddff'], 50, 250, 2, 6, 0.2, 0.5);
}

export function spawnMagicBurst(x: number, y: number, color: string) {
  spawnParticles(x, y, 30, [color, '#ffffff', color], 80, 350, 2, 7, 0.2, 0.5);
}

export function spawnScreenFlash(x: number, y: number) {
  spawnParticles(x, y, 80, ['#ffffff', '#ffdd44', '#ffaa00', '#ff8800'], 100, 500, 3, 10, 0.3, 0.8);
}

// 冲天光柱 + 地面震荡环（炮塔升级 / 高级拾取 / 精英击杀）
// pillarPool 由 engine 提供（push 到 state.lightPillars）；这里只构造数据
export function makeLightPillar(
  x: number,
  y: number,
  color: string,
  opts?: { baseRadius?: number; beamHeight?: number; ringMax?: number; life?: number }
): LightPillar {
  const life = opts?.life ?? 1.2;
  return {
    x, y, color,
    life, maxLife: life,
    baseRadius: opts?.baseRadius ?? 22,
    beamHeight: opts?.beamHeight ?? 220,
    ringRadius: 0,
    ringMaxRadius: opts?.ringMax ?? 140,
    active: true,
  };
}

export function spawnLightPillarBurst(x: number, y: number, color: string) {
  // 配套粒子爆发（让光柱更醒目）
  spawnParticles(x, y, 26, [color, '#ffffff', color], 80, 320, 2, 6, 0.25, 0.6);
}

export function updateParticles(dt: number) {
  for (const p of pool) {
    if (!p.active) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
    if (p.life <= 0) p.active = false;
  }
}

export function getActiveParticles(): Particle[] {
  return pool.filter((p) => p.active);
}
