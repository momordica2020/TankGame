import type { GameState, WeaponConfig, WeaponInstance } from '../types';
import { angleTo, randRange, dist, normalize } from '../math';
import {
  createProjectile,
  fireWeapon,
  getWeaponMuzzleWorld,
  getWeaponMountWorld,
  getSlotMount,
  findNearestEnemyId,
} from './core';
import {
  castLightning,
  castFireWall,
  castIceWall,
  castSkeleton,
  castBeamLaser,
} from '../effects/magic';
import { spawnMuzzleFlash, makeLightPillar } from '../particles';
import { makeSummon } from '../entities/summon';
import { damageEnemy } from '../entities/enemy';
import { TURRET_DEPLOY_INTERVAL, TURRET_TAUNT_RADIUS } from '../core/constants';

export function fireWeaponByType(state: GameState, w: WeaponInstance, wIdx: number, tgt: { x: number; y: number }) {
  const p = state.player;
  const cfg = w.config;
  const lvl = w.level;
  const targetX = tgt.x;
  const targetY = tgt.y;
  // 炮口世界坐标（从该炮塔位置出发）
  const muzzle = getWeaponMuzzleWorld(p, w, wIdx);
  // 炮塔中心世界坐标（球状炮塔中心，不含枪管偏移）
  const mount = getWeaponMountWorld(p, w, wIdx);

  switch (cfg.id) {
    case 'rifle':
    case 'shotgun':
    case 'gatling':
    case 'laser':
    case 'grenade':
    case 'drone': {
      const projs = fireWeapon(p, cfg, lvl, targetX, targetY, muzzle.x, muzzle.y);
      for (const pr of projs) {
        if (p.enchants.pierce > 0) {
          pr.piercing += p.enchants.pierce;
        }
        state.projectiles.push(pr);
        spawnMuzzleFlash(pr.x, pr.y, pr.angle, cfg.color);
      }
      break;
    }
    case 'mine': {
      // 在玩家周围布设地雷，数量随等级显著提升
      const mineCount = 2 + lvl * 2;
      const mineLifetime = 12 + lvl * 1.5;
      for (let i = 0; i < mineCount; i++) {
        const ang = randRange(0, Math.PI * 2);
        const r = randRange(40, 130);
        const mx = p.x + Math.cos(ang) * r;
        const my = p.y + Math.sin(ang) * r;
        const mine = makeSummon('turret', { ...cfg }, lvl, mx, my, true);
        mine.lifetime = mineLifetime;
        mine.maxLifetime = mineLifetime;
        state.summons.push(mine);
        state.lightPillars.push(makeLightPillar(mx, my, cfg.color,
          { baseRadius: 16, beamHeight: 160, ringMax: 70, life: 0.8 }));
      }
      break;
    }
    case 'flamethrower': {
      const baseAngle = angleTo(muzzle.x, muzzle.y, targetX, targetY);
      const coneAngle = cfg.spreadAngle;
      state.flameEffects.push({
        x: muzzle.x, y: muzzle.y, angle: baseAngle, radius: cfg.range,
        life: 0.15, active: true,
      });
      for (const e of state.enemies) {
        if (!e.active) continue;
        const d = dist(e.x, e.y, muzzle.x, muzzle.y);
        if (d > cfg.range) continue;
        const a = angleTo(muzzle.x, muzzle.y, e.x, e.y);
        let diff = Math.abs(a - baseAngle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < coneAngle) {
          damageEnemy(state, e, cfg.damage * (1 + (lvl - 1) * 0.3), cfg.color);
        }
      }
      break;
    }
    case 'sword': {
      const baseAngle = angleTo(muzzle.x, muzzle.y, targetX, targetY);
      // 剑的弧角随等级扩大，每级 +15%
      const swordArc = Math.PI * 0.75 * (1 + (lvl - 1) * 0.15);
      state.meleeEffects.push({
        x: muzzle.x, y: muzzle.y, angle: baseAngle, arc: swordArc, radius: cfg.range,
        life: 0.18, maxLife: 0.18, active: true, hits: new Set(),
      });
      for (const e of state.enemies) {
        if (!e.active) continue;
        const d = dist(e.x, e.y, muzzle.x, muzzle.y);
        if (d > cfg.range) continue;
        const a = angleTo(muzzle.x, muzzle.y, e.x, e.y);
        let diff = Math.abs(a - baseAngle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < swordArc / 2) {
          damageEnemy(state, e, cfg.damage * (1 + (lvl - 1) * 0.3), cfg.color);
          const kx = normalize(e.x - muzzle.x, e.y - muzzle.y);
          e.x += kx.x * 30;
          e.y += kx.y * 30;
        }
      }
      break;
    }
    case 'turret': {
      // 部署炮塔：定期在玩家附近放置固定炮塔，数量随等级大幅提升
      const existing = state.summons.filter((s) => s.active && s.type === 'turret' && s.weapon.id === 'turret');
      const realTurrets = existing.filter((s) => !s.orbitRadius); // 固定炮塔
      const maxTurrets = Math.min(3 + lvl * 2, 16);
      if (realTurrets.length < maxTurrets) {
        const ang = randRange(0, Math.PI * 2);
        const r = randRange(70, 150);
        const tx = p.x + Math.cos(ang) * r;
        const ty = p.y + Math.sin(ang) * r;
        const s = makeSummon('turret', { ...cfg }, lvl, tx, ty, false);
        s.lifetime = TURRET_DEPLOY_INTERVAL;
        s.maxLifetime = TURRET_DEPLOY_INTERVAL;
        state.summons.push(s);
        state.lightPillars.push(makeLightPillar(tx, ty, cfg.color,
          { baseRadius: 18, beamHeight: 180, ringMax: 80, life: 0.9 }));
      }
      break;
    }
    case 'shield_drone': {
      // 护盾浮游机：数量随等级大幅提升
      const existing = state.summons.filter((s) => s.active && s.type === 'shield_drone');
      const want = Math.min(3 + lvl * 2, 14);
      if (existing.length < want) {
        const s = makeSummon('shield_drone', { ...cfg }, lvl, p.x, p.y, false);
        s.orbitRadius = 55;
        s.orbitSpeed = 2;
        s.lifetime = 9999;
        s.maxLifetime = 9999;
        state.summons.push(s);
        state.lightPillars.push(makeLightPillar(p.x, p.y, cfg.color,
          { baseRadius: 16, beamHeight: 160, ringMax: 70, life: 0.8 }));
      }
      break;
    }
    case 'auto_turret': {
      // 跟随环绕炮塔：数量随等级大幅提升
      const existing = state.summons.filter((s) => s.active && s.type === 'auto_turret');
      const want = Math.min(3 + lvl * 2, 12);
      if (existing.length < want) {
        const s = makeSummon('auto_turret', { ...cfg }, lvl, p.x, p.y, false);
        s.orbitRadius = 80;
        s.orbitSpeed = 1.5;
        s.lifetime = 9999;
        s.maxLifetime = 9999;
        s.tauntRadius = TURRET_TAUNT_RADIUS;
        s.deployX = p.x;
        s.deployY = p.y;
        state.summons.push(s);
        state.lightPillars.push(makeLightPillar(p.x, p.y, cfg.color,
          { baseRadius: 20, beamHeight: 200, ringMax: 90, life: 1.0 }));
      }
      break;
    }
    // ---- 魔法类 ----
    case 'lightning': {
      castLightning(state, cfg, lvl, mount.x, mount.y);
      break;
    }
    case 'fire_wall': {
      castFireWall(state, cfg, lvl);
      break;
    }
    case 'ice_wall': {
      castIceWall(state, cfg, lvl);
      break;
    }
    case 'skeleton': {
      castSkeleton(state, cfg, lvl);
      break;
    }
    case 'beam_laser': {
      castBeamLaser(state, cfg, lvl, mount.x, mount.y);
      break;
    }
  }
}
