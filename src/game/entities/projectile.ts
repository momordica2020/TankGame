import type { GameState, Terrain } from '../types';
import { dist, circlePolygonCollision } from '../math';
import { spawnExplosion, spawnHitSpark, spawnParticles } from '../particles';
import { createProjectile, createEnemyProjectile } from '../weapons';
import { damageEnemy } from './enemy';
import { damagePlayer } from './player';

// 对地形造成伤害（可破坏的障碍物），被破坏时返回 true 并生成裂开碎屑
function damageTerrain(state: GameState, t: Terrain, dmg: number, atX: number, atY: number): boolean {
  if (!t.destructible || !t.hp) return false;
  t.hp -= dmg;
  if (t.hp <= 0) {
    // 根据地形变体决定颜色
    let fragColor = '#4a4a52';
    let particleColors = ['#5a5a62', '#3a3a42', '#6a6a72'];
    let sparkColor = '#aaa';
    let fragCount = 8 + Math.floor(Math.random() * 6);
    switch (t.variant) {
      case 'soft_rock':
        fragColor = '#8b6a45';
        particleColors = ['#9a7a55', '#6b5236', '#aa8a65'];
        sparkColor = '#cc9';
        fragCount = 10 + Math.floor(Math.random() * 8);
        break;
      case 'hard_rock':
        fragColor = '#555048';
        particleColors = ['#6a6558', '#4a4540', '#7a7568'];
        sparkColor = '#bbb';
        break;
      case 'metal':
        fragColor = '#7a7a8a';
        particleColors = ['#9a9aaa', '#5a5a6a', '#aaaabb'];
        sparkColor = '#eef';
        fragCount = 6 + Math.floor(Math.random() * 5);
        break;
      case 'tree':
        fragColor = '#6a4528';
        particleColors = ['#8a6548', '#4a3020', '#aa8558'];
        sparkColor = '#c96';
        fragCount = 12 + Math.floor(Math.random() * 8);
        break;
    }
    // 破坏效果：生成多块碎屑
    const avgR = Math.min(t.width, t.height) * 0.2;
    for (let i = 0; i < fragCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = avgR * 0.3 + Math.random() * avgR * 0.5;
      state.deathDebris.push({
        x: t.x + Math.cos(a) * dist,
        y: t.y + Math.sin(a) * dist,
        vx: Math.cos(a) * (40 + Math.random() * 80),
        vy: Math.sin(a) * (40 + Math.random() * 80) - 60,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 6,
        size: 6 + Math.random() * 10,
        color: fragColor,
      });
    }
    spawnParticles(t.x, t.y, 15, particleColors, 40, 100, 0.3, 8, 0.3, 0.6);
    state.screenShake = Math.max(state.screenShake, 5);
    t.hp = 0;
    return true;
  }
  // 受损小效果
  let sparkCol = '#888';
  if (t.variant === 'soft_rock') sparkCol = '#caa';
  else if (t.variant === 'metal') sparkCol = '#aac';
  else if (t.variant === 'tree') sparkCol = '#a86';
  spawnHitSpark(atX, atY, sparkCol);
  return false;
}

export function updateProjectiles(state: GameState, dt: number) {
  for (const pr of state.projectiles) {
    if (!pr.active) continue;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.lifetime += dt;
    if (pr.lifetime > pr.maxLifetime) { pr.active = false; continue; }
    // 边界
    if (pr.x < 0 || pr.x > state.mapWidth || pr.y < 0 || pr.y > state.mapHeight) {
      pr.active = false; continue;
    }
    // 障碍物（可破坏）
    let blocked = false;
    for (const t of state.terrains) {
      if (t.type !== 'obstacle' || !t.destructible || !t.hp) continue;
      if (circlePolygonCollision(pr.x, pr.y, pr.radius, t.x, t.y, t.vertices)) {
        damageTerrain(state, t, pr.damage, pr.x, pr.y);
        blocked = true;
        break;
      }
    }
    if (blocked) {
      if (pr.type === 'grenade') {
        spawnExplosion(pr.x, pr.y, 30);
        for (const e of state.enemies) {
          if (!e.active) continue;
          if (dist(e.x, e.y, pr.x, pr.y) < 80) {
            damageEnemy(state, e, pr.damage, pr.color);
          }
        }
        // 爆炸对周围地形造成范围伤害
        for (const t of state.terrains) {
          if (t.type !== 'obstacle' || !t.destructible || !t.hp) continue;
          if (dist(t.x, t.y, pr.x, pr.y) < 100) {
            damageTerrain(state, t, pr.damage * 0.5, pr.x, pr.y);
          }
        }
      }
      pr.active = false;
      continue;
    }
    // 命中敌人
    for (const e of state.enemies) {
      if (!e.active) continue;
      if (pr.hits.has(e.id)) continue;
      if (dist(e.x, e.y, pr.x, pr.y) < e.radius + pr.radius) {
        damageEnemy(state, e, pr.damage, pr.color);
        pr.hits.add(e.id);
        if (pr.type === 'grenade') {
          spawnExplosion(pr.x, pr.y, 30);
          for (const e2 of state.enemies) {
            if (!e2.active || e2.id === e.id) continue;
            if (dist(e2.x, e2.y, pr.x, pr.y) < 80) {
              damageEnemy(state, e2, pr.damage * 0.6, pr.color);
            }
          }
          pr.active = false;
          break;
        }
        if (pr.piercing <= 0) { pr.active = false; break; }
        pr.piercing -= 1;
      }
    }
  }
  state.projectiles = state.projectiles.filter((p) => p.active);
}

export function updateEnemyProjectiles(state: GameState, dt: number) {
  const p = state.player;
  for (const pr of state.enemyProjectiles) {
    if (!pr.active) continue;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.lifetime += dt;
    if (pr.lifetime > pr.maxLifetime) { pr.active = false; continue; }
    if (pr.x < 0 || pr.x > state.mapWidth || pr.y < 0 || pr.y > state.mapHeight) {
      pr.active = false; continue;
    }
    // 障碍物阻挡（可破坏）
    let blocked = false;
    for (const t of state.terrains) {
      if (t.type !== 'obstacle' || !t.destructible || !t.hp) continue;
      if (circlePolygonCollision(pr.x, pr.y, pr.radius, t.x, t.y, t.vertices)) {
        damageTerrain(state, t, pr.damage * 0.5, pr.x, pr.y);
        blocked = true; break;
      }
    }
    if (blocked) { pr.active = false; continue; }

    // 命中玩家
    if (p.active && dist(pr.x, pr.y, p.x, p.y) < p.radius + pr.radius) {
      damagePlayer(state, pr.damage);
      spawnExplosion(pr.x, pr.y, 8);
      state.screenShake = Math.max(state.screenShake, 3);
      pr.active = false;
    }
    // 命中召唤物（非地雷）
    for (const s of state.summons) {
      if (!s.active || s.type === 'turret' && s.weapon.id === 'mine') continue;
      if (dist(pr.x, pr.y, s.x, s.y) < s.radius + pr.radius) {
        s.hp -= pr.damage;
        pr.active = false;
        spawnHitSpark(s.x, s.y, '#ffaa00');
        if (s.hp <= 0) s.active = false;
        break;
      }
    }
  }
  state.enemyProjectiles = state.enemyProjectiles.filter((p) => p.active);
}
