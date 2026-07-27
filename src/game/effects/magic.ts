import type { GameState, WeaponConfig, Enemy } from '../types';
import { angleTo, dist, randRange, clamp } from '../math';
import { findNearestEnemyId, selectTarget } from '../weapons';
import { spawnLightning, spawnMagicBurst, spawnBigExplosion, spawnIceShatter, spawnParticles, spawnExplosion } from '../particles';
import { makeSummon } from '../entities/summon';
import { damageEnemy } from '../entities/enemy';
import { damagePlayer } from '../entities/player';

// ---- 闪电链 ----
export function castLightning(state: GameState, cfg: WeaponConfig, lvl: number, ox: number, oy: number) {
  const targetId = findNearestEnemyId(ox, oy, state.enemies, cfg.range);
  if (targetId === null) return;
  const chainCount = 3 + Math.floor(lvl / 2);
  const dmg = cfg.damage * (1 + (lvl - 1) * 0.3);

  const hit = new Set<number>();
  let curX = ox, curY = oy;
  let curTargetId: number | null = targetId;
  const points: { x: number; y: number }[] = [{ x: curX, y: curY }];

  for (let i = 0; i < chainCount; i++) {
    if (curTargetId === null) break;
    const e = state.enemies.find((en) => en.id === curTargetId && en.active);
    if (!e) break;
    points.push({ x: e.x, y: e.y });
    damageEnemy(state, e, dmg, cfg.color);
    spawnLightning(e.x, e.y);
    hit.add(e.id);
    // 找下一个未命中的最近敌人
    let next: Enemy | null = null;
    let minD = 220;
    for (const en of state.enemies) {
      if (!en.active || hit.has(en.id)) continue;
      const d = dist(en.x, en.y, e.x, e.y);
      if (d < minD) { minD = d; next = en; }
    }
    if (!next) break;
    curTargetId = next.id;
  }

  state.lightningEffects.push({
    points,
    width: 2 + Math.floor(lvl / 2),  // 闪电粗细随等级增加
    life: 0.18, maxLife: 0.18, active: true,
  });
}

// ---- 火墙术 ----
export function castFireWall(state: GameState, cfg: WeaponConfig, lvl: number) {
  const p = state.player;
  // 找最密集敌群位置
  let bestX = p.x + randRange(-200, 200), bestY = p.y + randRange(-200, 200);
  let bestCount = 0;
  for (let i = 0; i < 12; i++) {
    const cx = clamp(p.x + randRange(-300, 300), 50, state.mapWidth - 50);
    const cy = clamp(p.y + randRange(-300, 300), 50, state.mapHeight - 50);
    let cnt = 0;
    for (const e of state.enemies) {
      if (!e.active) continue;
      if (dist(e.x, e.y, cx, cy) < 120) cnt++;
    }
    if (cnt > bestCount) { bestCount = cnt; bestX = cx; bestY = cy; }
  }
  // 墙体长边垂直于玩家到墙中心的连线
  const fwAng = angleTo(p.x, p.y, bestX, bestY);
  state.fireWallEffects.push({
    x: bestX, y: bestY, width: 55, height: 210, angle: fwAng,
    life: 3 + lvl * 0.3, maxLife: 3 + lvl * 0.3,
    damage: cfg.damage * (1 + (lvl - 1) * 0.3),
    lastTickTime: 0, active: true,
  });
  spawnMagicBurst(bestX, bestY, cfg.color);
  spawnBigExplosion(bestX, bestY);
}

// ---- 冰墙术 ----
export function castIceWall(state: GameState, cfg: WeaponConfig, lvl: number) {
  const p = state.player;
  // 在最近敌人方向放置一堵冰墙，无敌人则朝玩家移动方向
  const tgt = selectTarget(p, state.enemies, 'nearest', 600);
  const ang = tgt ? angleTo(p.x, p.y, tgt.x, tgt.y) : p.facing;
  const wx = p.x + Math.cos(ang) * 120;
  const wy = p.y + Math.sin(ang) * 120;
  state.iceWallEffects.push({
    x: wx, y: wy, width: 34, height: 180, angle: ang,
    life: 5 + lvl * 0.4, maxLife: 5 + lvl * 0.4, active: true,
  });
  // 给附近敌人造成冰冻伤害和减速
  for (const e of state.enemies) {
    if (!e.active) continue;
    if (dist(e.x, e.y, wx, wy) < 100) {
      damageEnemy(state, e, cfg.damage * (1 + (lvl - 1) * 0.3), cfg.color);
      e.freezeTimer = Math.max(e.freezeTimer, 2 + lvl * 0.3);
      e.speed = e.baseSpeed * 0.5;
    }
  }
  spawnIceShatter(wx, wy);
}

// ---- 召唤骷髅兵 ----
export function castSkeleton(state: GameState, cfg: WeaponConfig, lvl: number) {
  const p = state.player;
  const existing = state.summons.filter((s) => s.active && s.type === 'skeleton');
  // 数量随等级大幅提升，每级接近翻倍增长
  const want = Math.min(3 + lvl * 3, 16);
  if (existing.length >= want) return;
  const ang = randRange(0, Math.PI * 2);
  const r = randRange(40, 100);
  const sx = p.x + Math.cos(ang) * r;
  const sy = p.y + Math.sin(ang) * r;
  const sk = makeSummon('skeleton', { ...cfg }, lvl, sx, sy, false);
  sk.lifetime = 15;
  sk.maxLifetime = 15;
  state.summons.push(sk);
  spawnMagicBurst(sx, sy, cfg.color);
}

// ---- 天罚光束 ----
export function castBeamLaser(state: GameState, cfg: WeaponConfig, lvl: number, ox: number, oy: number) {
  // 光束数量随等级大幅提升：2级起2道，4级起3道，6级起4道
  const beamCount = lvl >= 6 ? 4 : lvl >= 4 ? 3 : lvl >= 2 ? 2 : 1;
  const spreadAngle = 0.2; // 光束间夹角

  // 优先寻找boss和精英怪等高价值目标
  let targetId: number | null = null;
  let bestPriority = -1;
  let bestDist = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = dist(e.x, e.y, ox, oy);
    if (d > cfg.range) continue;
    let priority = 0;
    if (e.type === 'boss') priority = 100;
    else if (e.type.startsWith('elite')) priority = 50;
    if (priority > bestPriority || (priority === bestPriority && d < bestDist)) {
      bestPriority = priority;
      bestDist = d;
      targetId = e.id;
    }
  }
  // 如果没有找到高价值目标，找最近的敌人
  if (targetId === null) {
    targetId = findNearestEnemyId(ox, oy, state.enemies, cfg.range);
  }
  let baseAng = -Math.PI / 2;
  let tx = ox, ty = oy - 100;
  if (targetId !== null) {
    const e = state.enemies.find((en) => en.id === targetId);
    if (e) {
      baseAng = angleTo(ox, oy, e.x, e.y);
      tx = e.x; ty = e.y;
    }
  }

  for (let b = 0; b < beamCount; b++) {
    const angOffset = beamCount > 1 ? (b - (beamCount - 1) / 2) * spreadAngle : 0;
    const ang = baseAng + angOffset;
    state.beamLaserEffects.push({
      x: ox, y: oy, angle: ang, length: cfg.range,
      width: 6 + lvl * 2,  // 光束宽度随等级加粗
      life: 0.25, maxLife: 0.25,
      damage: (cfg.damage * (1 + (lvl - 1) * 0.3)) / beamCount * 1.2, // 多道总伤害略高
      hits: new Set(), active: true,
    });
    // 立即造成伤害
    for (const e of state.enemies) {
      if (!e.active) continue;
      if (pointLineDistance(e.x, e.y, ox, oy, ang) < e.radius + 12) {
        const d = dist(e.x, e.y, ox, oy);
        if (d < cfg.range) {
          damageEnemy(state, e, (cfg.damage * (1 + (lvl - 1) * 0.3)) / beamCount * 1.2, cfg.color);
        }
      }
    }
  }
  spawnMagicBurst(tx, ty, cfg.color);
}

function pointLineDistance(px: number, py: number, lx: number, ly: number, lang: number): number {
  // 点到经过 (lx,ly) 方向 lang 的直线的距离
  const dx = px - lx;
  const dy = py - ly;
  // 沿 lang 法线投影
  return Math.abs(-Math.sin(lang) * dx + Math.cos(lang) * dy);
}

// ============ 魔法效果更新 ============
export function updateMagicEffects(state: GameState, dt: number) {
  // 闪电
  for (const l of state.lightningEffects) {
    if (!l.active) continue;
    l.life -= dt;
    if (l.life <= 0) l.active = false;
  }
  state.lightningEffects = state.lightningEffects.filter((l) => l.active);

  // 火墙
  for (const fw of state.fireWallEffects) {
    if (!fw.active) continue;
    fw.life -= dt;
    if (fw.life <= 0) fw.active = false;
    // 环境火焰粒子（沿长轴随机分布）
    const envRate = state.isMobile ? 0.1 : 0.7;
    if (Math.random() < envRate) {
      const cW = Math.cos(fw.angle), sW = Math.sin(fw.angle);
      const t = (Math.random() - 0.5) * fw.height;
      const px = fw.x - sW * t;
      const py = fw.y + cW * t;
      spawnParticles(px, py, 1, ['#ffaa00', '#ff6600', '#ff3300', '#ffdd66'], 20, 90, 1, 3, 0.3, 0.7);
    }
  }
  state.fireWallEffects = state.fireWallEffects.filter((f) => f.active);

  // 冰墙
  for (const iw of state.iceWallEffects) {
    if (!iw.active) continue;
    iw.life -= dt;
    if (iw.life <= 0) iw.active = false;
    // 环境寒霜粒子
    const envIceRate = state.isMobile ? 0.08 : 0.5;
    if (Math.random() < envIceRate) {
      const cW = Math.cos(iw.angle), sW = Math.sin(iw.angle);
      const t = (Math.random() - 0.5) * iw.height;
      const px = iw.x - sW * t;
      const py = iw.y + cW * t;
      spawnParticles(px, py, 1, ['#aaeeff', '#66ccff', '#ffffff', '#bbddff'], 10, 45, 1, 2, 0.4, 0.9);
    }
  }
  state.iceWallEffects = state.iceWallEffects.filter((i) => i.active);

  // 光束
  for (const b of state.beamLaserEffects) {
    if (!b.active) continue;
    b.life -= dt;
    if (b.life <= 0) b.active = false;
  }
  state.beamLaserEffects = state.beamLaserEffects.filter((b) => b.active);

  // 冲天光柱：生命衰减 + 地面震荡环扩张
  for (const lp of state.lightPillars) {
    if (!lp.active) continue;
    lp.life -= dt;
    const p = 1 - (lp.life / lp.maxLife); // 0→1
    lp.ringRadius = lp.ringMaxRadius * (1 - Math.pow(1 - p, 2)); // 缓出扩张
    if (lp.life <= 0) lp.active = false;
  }
  state.lightPillars = state.lightPillars.filter((lp) => lp.active);

  // Boss炸弹更新
  const p = state.player;
  for (const b of state.bossBombs) {
    if (!b.active) continue;
    b.timer -= dt;
    if (b.timer <= 0) {
      b.active = false;
      // 爆炸伤害
      const dp = dist(b.x, b.y, p.x, p.y);
      if (dp < b.radius) {
        damagePlayer(state, b.damage);
      }
      spawnExplosion(b.x, b.y, 20);
      state.screenShake = Math.max(state.screenShake, 8);
    }
  }
  state.bossBombs = state.bossBombs.filter((b) => b.active);
}
