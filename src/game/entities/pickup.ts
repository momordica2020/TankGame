import type { GameState, Pickup, EnemyType } from '../types';
import { dist, normalize, randRange, clamp } from '../math';
import {
  spawnExpOrbSparkle, spawnMagicBurst, spawnBigExplosion,
  spawnScreenFlash, spawnParticles, spawnLightPillarBurst, makeLightPillar,
} from '../particles';
import { damageEnemy } from './enemy';
import { screenClear } from '../skills/active';

// 经验掉落分级配置：小怪少小，大怪多大团
export function getExpDropConfig(type: EnemyType, totalExp: number): { count: number; perValue: number; perRadius: number } {
  switch (type) {
    case 'fast':
    case 'splitter_small':
      return { count: 1, perValue: totalExp, perRadius: 5 };
    case 'basic':
      return { count: 1, perValue: totalExp, perRadius: 6 };
    case 'shooter':
    case 'sniper':
    case 'shotgunner':
      return { count: 2, perValue: Math.ceil(totalExp / 2), perRadius: 9 };
    case 'splitter':
    case 'tank':
      return { count: 3, perValue: Math.ceil(totalExp / 3), perRadius: 10 };
    case 'bruiser':
    case 'elite':
      return { count: 4, perValue: Math.ceil(totalExp / 4), perRadius: 11 };
    case 'elite_brute':
    case 'elite_gunner':
    case 'elite_bomber':
      return { count: 5, perValue: Math.ceil(totalExp / 5), perRadius: 12 };
    case 'boss':
      return { count: 10, perValue: Math.ceil(totalExp / 10), perRadius: 13 };
    default:
      return { count: 1, perValue: totalExp, perRadius: 9 };
  }
}

export function updatePickups(state: GameState, dt: number) {
  const p = state.player;
  for (const pk of state.pickups) {
    if (!pk.active) continue;
    // 生命周期减少，过期消失
    pk.life -= dt;
    if (pk.life <= 0) {
      pk.active = false;
      continue;
    }
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
    pk.vx *= 0.92;
    pk.vy *= 0.92;

    const d = dist(pk.x, pk.y, p.x, p.y);
    if (d < p.pickupRadius && d > 0) {
      // 磁吸：越接近玩家速度越快，带加速度感
      // 距离因子：从 0（范围边缘）到 1（贴脸）
      const distFactor = 1 - d / p.pickupRadius;
      // 速度随距离平方增长，越近越快
      const baseSpeed = 80 + distFactor * distFactor * 400;
      // 等级加成（加速度随等级提升）
      const levelBonus = 1 + (p.level - 1) * 0.06;
      let pullSpeed = baseSpeed * levelBonus;
      // 特殊掉落物（非经验/非血包）吸引速率减半，更难捡到
      const isSpecial = pk.type !== 'exp' && pk.type !== 'health';
      if (isSpecial) pullSpeed *= 0.5;
      const dir = normalize(p.x - pk.x, p.y - pk.y);
      // 螺旋分量：垂直于指向玩家的方向
      const perpX = -dir.y;
      const perpY = dir.x;
      const spiralStrength = 0.5 * (1 - distFactor * 0.5);
      pk.vx += dir.x * pullSpeed * dt * 4 + perpX * pullSpeed * spiralStrength * dt;
      pk.vy += dir.y * pullSpeed * dt * 4 + perpY * pullSpeed * spiralStrength * dt;
      // 速度上限
      const maxSpeed = 500 + distFactor * 600;
      const spd = Math.hypot(pk.vx, pk.vy);
      if (spd > maxSpeed) {
        pk.vx = (pk.vx / spd) * maxSpeed;
        pk.vy = (pk.vy / spd) * maxSpeed;
      }
    }
    if (d < p.radius + pk.radius) {
      applyPickup(state, pk);
    }
  }
  state.pickups = state.pickups.filter((pk) => pk.active);
}

export function applyPickup(state: GameState, pk: Pickup) {
  const p = state.player;
  pk.active = false;
  switch (pk.type) {
    case 'exp': {
      p.exp += pk.value * p.expGainMult;
      spawnExpOrbSparkle(pk.x, pk.y);
      // 小绿光上升粒子
      spawnParticles(pk.x, pk.y, 4, ['#44ff88', '#88ffaa'], 40, 120, 1, 3, 0.2, 0.4);
      break;
    }
    case 'health': {
      p.hp = Math.min(p.maxHp, p.hp + pk.value);
      // 红色治疗十字爆发
      spawnMagicBurst(pk.x, pk.y, '#ff4466');
      spawnParticles(pk.x, pk.y, 12, ['#ff4466', '#ff88aa', '#ffffff', '#ff6688'], 60, 200, 1.5, 5, 0.2, 0.5);
      break;
    }
    case 'bomb': {
      // 瞬间爆炸地雷：清除附近敌人 + 大爆炸特效
      spawnBigExplosion(pk.x, pk.y);
      spawnScreenFlash(p.x, p.y);
      state.screenShake = 16;
      // 冲天光柱
      state.lightPillars.push(makeLightPillar(p.x, p.y, '#ff6600', {
        baseRadius: 26, beamHeight: 260, ringMax: 180, life: 1.4,
      }));
      spawnLightPillarBurst(p.x, p.y, '#ff6600');
      // 冲击波粒子环
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        spawnParticles(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, 1,
          ['#ff6600', '#ffaa00', '#ff3300'], 200, 400, 2, 6, 0.1, 0.3);
      }
      for (const e of state.enemies) {
        if (!e.active) continue;
        if (dist(e.x, e.y, p.x, p.y) < 350) {
          damageEnemy(state, e, 80 + p.level * 8, '#ff3300');
        }
      }
      break;
    }
    case 'vacuum': {
      // 吸收全屏物件：所有经验/生命吸到玩家
      for (const other of state.pickups) {
        if (!other.active || other === pk) continue;
        if (other.type === 'exp' || other.type === 'health') {
          other.magnetTarget = p.id;
          // 立即吸过来
          const dir = normalize(p.x - other.x, p.y - other.y);
          other.x = p.x - dir.x * 5;
          other.y = p.y - dir.y * 5;
        }
      }
      // 旋涡特效
      spawnMagicBurst(p.x, p.y, '#44ddff');
      state.lightPillars.push(makeLightPillar(p.x, p.y, '#44ddff', {
        baseRadius: 22, beamHeight: 230, ringMax: 160, life: 1.3,
      }));
      spawnLightPillarBurst(p.x, p.y, '#44ddff');
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        const r = 80;
        spawnParticles(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 1,
          ['#44ddff', '#88eeff', '#ffffff'], 120, 250, 1.5, 4, 0.2, 0.5);
      }
      break;
    }
    case 'shield_pickup': {
      p.shieldTimer = Math.max(p.shieldTimer, 8);
      // 蓝色护盾展开环
      spawnMagicBurst(p.x, p.y, '#3b82f6');
      state.lightPillars.push(makeLightPillar(p.x, p.y, '#3b82f6', {
        baseRadius: 22, beamHeight: 230, ringMax: 160, life: 1.3,
      }));
      spawnLightPillarBurst(p.x, p.y, '#3b82f6');
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        spawnParticles(p.x + Math.cos(a) * 10, p.y + Math.sin(a) * 10, 1,
          ['#3b82f6', '#6bb6ff', '#ffffff'], 80, 200, 2, 5, 0.2, 0.5);
      }
      break;
    }
    case 'screen_clear': {
      // 清屏前先闪一下白光
      spawnParticles(p.x, p.y, 30, ['#ffffff', '#ffdd44'], 100, 400, 2, 8, 0.2, 0.5);
      state.lightPillars.push(makeLightPillar(p.x, p.y, '#ffffff', {
        baseRadius: 28, beamHeight: 280, ringMax: 200, life: 1.5,
      }));
      spawnLightPillarBurst(p.x, p.y, '#ffdd44');
      screenClear(state);
      break;
    }
  }
}
