import type { GameState, Summon, SummonType, WeaponConfig } from '../types';
import { dist, angleTo, normalize, randRange } from '../math';
import {
  spawnMuzzleFlash, spawnHitSpark, spawnBlood, spawnBigExplosion,
  spawnMagicBurst, makeLightPillar, spawnLightPillarBurst,
} from '../particles';
import { createProjectile, findNearestEnemyId } from '../weapons';
import { TURRET_TAUNT_INTERVAL, TURRET_TAUNT_RADIUS } from '../core/constants';
import { damageEnemy } from './enemy';
import { getNextId } from '../core/id';

export function makeSummon(
  type: SummonType, cfg: WeaponConfig, lvl: number,
  x: number, y: number, isMine: boolean,
): Summon {
  return {
    id: getNextId(),
    x, y, vx: 0, vy: 0,
    radius: isMine ? 8 : (12 + lvl * 1.5),
    hp: isMine ? 1 : (40 + lvl * 12), maxHp: isMine ? 1 : (40 + lvl * 12),
    active: true,
    type, weapon: cfg, level: lvl,
    lastFireTime: 0, angle: 0,
    orbitRadius: 0, orbitSpeed: 0,
    lifetime: 0, maxLifetime: 0,
    deployX: x, deployY: y,
    tauntRadius: 0,
  };
}

export function updateSummons(state: GameState, dt: number) {
  const p = state.player;
  const now = state.gameTime;

  for (const s of state.summons) {
    if (!s.active) continue;

    // 生命周期
    if (s.maxLifetime > 0 && s.maxLifetime < 9999) {
      s.lifetime -= dt;
      if (s.lifetime <= 0) {
        s.active = false;
        continue;
      }
    }

    if (s.type === 'turret' && s.weapon.id === 'mine') {
      // 地雷：检测附近敌人引爆
      let trigger = false;
      for (const e of state.enemies) {
        if (!e.active) continue;
        if (dist(e.x, e.y, s.x, s.y) < 40) { trigger = true; break; }
      }
      if (trigger) {
        s.active = false;
        spawnBigExplosion(s.x, s.y);
        state.screenShake = 10;
        for (const e of state.enemies) {
          if (!e.active) continue;
          const d = dist(e.x, e.y, s.x, s.y);
          if (d < 120) {
            damageEnemy(state, e, s.weapon.damage * (1 + (s.level - 1) * 0.3), '#ff3300');
          }
        }
      }
      continue;
    }

    if (s.type === 'turret') {
      // 固定炮塔：自动射击
      const targetId = findNearestEnemyId(s.x, s.y, state.enemies, s.weapon.range);
      if (targetId !== null) {
        const e = state.enemies.find((en) => en.id === targetId);
        if (e) {
          const ang = angleTo(s.x, s.y, e.x, e.y);
          s.angle = ang;
          const interval = 1 / Math.max(0.01, s.weapon.fireRate);
          if (now - s.lastFireTime >= interval) {
            s.lastFireTime = now;
            const pr = createProjectile(s.x, s.y, ang, s.weapon, s.level);
            if (state.player.enchants.pierce > 0) {
              pr.piercing += state.player.enchants.pierce;
            }
            state.projectiles.push(pr);
            spawnMuzzleFlash(s.x, s.y, ang, s.weapon.color);
          }
        }
      }
      continue;
    }

    if (s.type === 'shield_drone') {
      // 护盾浮游机：环绕玩家，拦截敌人弹幕
      s.angle += s.orbitSpeed * dt;
      s.x = p.x + Math.cos(s.angle) * s.orbitRadius;
      s.y = p.y + Math.sin(s.angle) * s.orbitRadius;
      // 拦截弹幕
      for (const proj of state.enemyProjectiles) {
        if (!proj.active) continue;
        if (dist(proj.x, proj.y, s.x, s.y) < s.radius + proj.radius) {
          proj.active = false;
          spawnHitSpark(s.x, s.y, '#00ddff');
        }
      }
      continue;
    }

    if (s.type === 'auto_turret') {
      // 自动炮塔：环绕玩家 + 自动射击 + 周期嘲讽
      s.angle += s.orbitSpeed * dt;
      s.x = p.x + Math.cos(s.angle) * s.orbitRadius;
      s.y = p.y + Math.sin(s.angle) * s.orbitRadius;

      const targetId = findNearestEnemyId(s.x, s.y, state.enemies, s.weapon.range);
      if (targetId !== null) {
        const e = state.enemies.find((en) => en.id === targetId);
        if (e) {
          const ang = angleTo(s.x, s.y, e.x, e.y);
          s.angle = ang; // 用于炮管朝向覆盖；与环绕角度冲突，简化处理
          const interval = 1 / Math.max(0.01, s.weapon.fireRate);
          if (now - s.lastFireTime >= interval) {
            s.lastFireTime = now;
            const pr = createProjectile(s.x, s.y, ang, s.weapon, s.level);
            if (state.player.enchants.pierce > 0) {
              pr.piercing += state.player.enchants.pierce;
            }
            state.projectiles.push(pr);
            spawnMuzzleFlash(s.x, s.y, ang, s.weapon.color);
          }
        }
      }

      // 周期嘲讽：每 TURRET_TAUNT_INTERVAL 秒嘲讽附近敌人
      // 用 lastFireTime 之外的字段记录：用 deployX 作为下次嘲讽时间
      const nextTaunt = s.deployX; // 复用字段
      if (nextTaunt === 0 || now >= nextTaunt) {
        s.deployX = now + TURRET_TAUNT_INTERVAL;
        // 让范围内敌人优先攻击此召唤物
        for (const e of state.enemies) {
          if (!e.active) continue;
          if (dist(e.x, e.y, s.x, s.y) < s.tauntRadius) {
            e.tauntTarget = s.id;
          }
        }
      }
      continue;
    }

    if (s.type === 'skeleton') {
      // 骷髅兵：找最近敌人，靠近后近战攻击
      const targetId = findNearestEnemyId(s.x, s.y, state.enemies, s.weapon.range);
      if (targetId !== null) {
        const e = state.enemies.find((en) => en.id === targetId);
        if (e) {
          const d = dist(e.x, e.y, s.x, s.y);
          if (d > 30) {
            const dir = normalize(e.x - s.x, e.y - s.y);
            s.x += dir.x * 180 * dt;
            s.y += dir.y * 180 * dt;
          } else {
            const interval = 1 / Math.max(0.01, s.weapon.fireRate);
            if (now - s.lastFireTime >= interval) {
              s.lastFireTime = now;
              damageEnemy(state, e, s.weapon.damage * (1 + (s.level - 1) * 0.3), s.weapon.color);
              spawnHitSpark(e.x, e.y, s.weapon.color);
            }
          }
        }
      }
      // 骷髅受敌人攻击伤害
      for (const e of state.enemies) {
        if (!e.active) continue;
        if (dist(e.x, e.y, s.x, s.y) < e.radius + s.radius) {
          s.hp -= e.damage * dt * 0.5;
          if (s.hp <= 0) {
            s.active = false;
            spawnBlood(s.x, s.y, 5);
          }
        }
      }
      continue;
    }
  }

  // 清理失活的召唤物
  state.summons = state.summons.filter((s) => s.active);
}
