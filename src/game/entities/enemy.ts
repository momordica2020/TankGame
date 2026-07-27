import type { GameState, Enemy, EnemyType, EnemyTurret } from '../types';
import { dist, angleTo, normalize, clamp, randRange, randInt, randPick, circlePolygonCollision } from '../math';
import {
  spawnMuzzleFlash, spawnBlood, spawnExplosion, spawnBigExplosion,
  spawnHitSpark, spawnMagicBurst, spawnLightPillarBurst, makeLightPillar, spawnParticles,
  spawnIceShatter,
} from '../particles';
import { createEnemyProjectile } from '../weapons';
import { damagePlayer } from './player';
import { darkenColor } from './terrain';
import { getNextId } from '../core/id';
import { getExpDropConfig } from './pickup';

export function updateEnemies(state: GameState, dt: number) {
  const p = state.player;
  const now = state.gameTime;

  for (const e of state.enemies) {
    if (!e.active) continue;
    if (e.flashTimer > 0) e.flashTimer -= dt;
    if (e.spawnAnim > 0) e.spawnAnim -= dt;
    // 精英怪炮台旋转
    if (e.isElite) {
      e.rotation += dt * 0.6;
      // 环形弹幕：精英怪每隔一段时间发射一圈子弹
      if (e.ringFireTimer === undefined) e.ringFireTimer = 1.5 + Math.random() * 2;
      e.ringFireTimer -= dt;
      if (e.ringFireTimer <= 0) {
        e.ringFireTimer = 4 + Math.random() * 3;
        const ringCount = e.type === 'elite_gunner' ? 12 : e.type === 'elite_brute' ? 8 : 6;
        const ringSpeed = e.projectileSpeed * 0.6;
        const startAng = Math.random() * Math.PI * 2;
        for (let i = 0; i < ringCount; i++) {
          const a = startAng + (i / ringCount) * Math.PI * 2;
          state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, ringSpeed, e.projectileDamage * 0.5, '#ff0033'));
        }
        spawnMuzzleFlash(e.x, e.y, 0, '#ff0033');
      }
      for (const tur of e.turrets) {
        tur.angle = e.rotation + tur.offsetAngle;
        // 炮台射击：距离玩家在射程内才开火
        if (now - tur.lastFire > tur.cooldown) {
          const distP = dist(e.x, e.y, p.x, p.y);
          if (distP < 520) {
            tur.lastFire = now;
            // 炮台位置
            const tx = e.x + Math.cos(tur.angle) * tur.radius;
            const ty = e.y + Math.sin(tur.angle) * tur.radius;
            // 朝玩家方向开火
            const aimAng = angleTo(tx, ty, p.x, p.y);
            state.enemyProjectiles.push(createEnemyProjectile(tx, ty, aimAng, e.projectileSpeed, e.projectileDamage * 0.6, tur.color));
            spawnMuzzleFlash(tx, ty, aimAng, tur.color);
          }
        }
      }
    }

    // ---- Boss 技能系统 ----
    if (e.type === 'boss') {
      if (e.bossSkillTimer === undefined) e.bossSkillTimer = 0.5 + Math.random() * 0.5;
      if (e.bossBombTimer === undefined) e.bossBombTimer = 2 + Math.random() * 1;
      if (e.bossChargeState === undefined) e.bossChargeState = 'idle';
      if (e.bossChargeTimer === undefined) e.bossChargeTimer = 3 + Math.random() * 1;

      // Boss 弹幕/技能伤害倍率：与玩家实力挂钩（与小怪使用相同的动态难度机制）
      const stage = state.bossSpawnCount || 0;
      const diffMult = state.waveDifficultyMult || 1;
      const bossDmgMult = (1 + stage * 0.15) * Math.sqrt(diffMult);

      // 技能1：东方Project风格弹幕（多种模式轮替，数量多、速度慢）
      e.bossSkillTimer -= dt;
      if (e.bossSkillTimer <= 0) {
        e.bossSkillTimer = 0.9 + Math.random() * 0.7;
        // 弹幕模式池
        const pattern = Math.floor(Math.random() * 7);
        const baseSpeed = 110; // 弹幕整体偏慢，靠密度压制

        if (pattern === 0) {
          // 模式1：双层环形弹幕（72+54发）
          const count1 = 72;
          const count2 = 54;
          const startAng = Math.random() * Math.PI * 2;
          for (let i = 0; i < count1; i++) {
            const a = startAng + (i / count1) * Math.PI * 2;
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, baseSpeed, 10 * bossDmgMult, '#ff3366'));
          }
          for (let i = 0; i < count2; i++) {
            const a = startAng + Math.PI / count2 + (i / count2) * Math.PI * 2;
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, baseSpeed * 0.7, 8 * bossDmgMult, '#ffaa22'));
          }
        } else if (pattern === 1) {
          // 模式2：扇形弹幕+追踪（大扇形32发+中央瞄准弹）
          const ang = angleTo(e.x, e.y, p.x, p.y);
          const fanCount = 32;
          const fanSpread = Math.PI * 0.9;
          for (let i = 0; i < fanCount; i++) {
            const a = ang - fanSpread / 2 + (i / (fanCount - 1)) * fanSpread;
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, baseSpeed * 0.95, 10 * bossDmgMult, '#cc33ff'));
          }
          // 中央5发快速瞄准弹
          for (let i = -2; i <= 2; i++) {
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, ang + i * 0.06, baseSpeed * 1.4, 12 * bossDmgMult, '#ff0088'));
          }
        } else if (pattern === 2) {
          // 模式3：螺旋弹幕（双螺旋各27发，旋转扩散）
          const spiralCount = 27;
          const spiralAng = Math.random() * Math.PI * 2;
          for (let i = 0; i < spiralCount; i++) {
            const t = i / spiralCount;
            const a1 = spiralAng + t * Math.PI * 2.5;
            const a2 = spiralAng + Math.PI + t * Math.PI * 2.5;
            const spd = baseSpeed * (0.7 + t * 0.6);
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a1, spd, 8 * bossDmgMult, '#6644ff'));
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a2, spd, 8 * bossDmgMult, '#ff44aa'));
          }
        } else if (pattern === 3) {
          // 模式4：圆形散射+随机偏移（模拟乱弹）
          const total = 90;
          for (let i = 0; i < total; i++) {
            const a = (i / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
            const spd = baseSpeed * (0.75 + Math.random() * 0.5);
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, spd, 7 * bossDmgMult, '#ff8800'));
          }
        } else if (pattern === 4) {
          // 模式5：三方向波浪弹（左右中三路，每路扇形，密度高）
          const ang = angleTo(e.x, e.y, p.x, p.y);
          const waveCount = 14;
          for (let w = -1; w <= 1; w++) {
            const baseA = ang + w * 0.55;
            for (let i = 0; i < waveCount; i++) {
              const a = baseA - 0.3 + (i / (waveCount - 1)) * 0.6;
              const spd = baseSpeed * (0.85 + Math.abs(i - (waveCount - 1) / 2) * 0.05);
              state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, spd, 9 * bossDmgMult, '#ffdd33'));
            }
          }
        } else if (pattern === 5) {
          // 模式6：十字+X字弹幕组合（密集激光线）
          const lineCount = 24;
          for (let i = 0; i < lineCount; i++) {
            const t = i / lineCount;
            for (let d = 0; d < 8; d++) {
              const a = (d / 8) * Math.PI * 2 + t * 0.15;
              const spd = baseSpeed * (0.6 + t * 0.5);
              state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, spd, 7 * bossDmgMult, '#33ccff'));
            }
          }
        } else {
          // 模式7：花瓣环形弹幕（9瓣各13发，图案优美）
          const petalCount = 9;
          const perPetal = 13;
          const startAng = Math.random() * Math.PI * 2;
          for (let pt = 0; pt < petalCount; pt++) {
            const centerA = startAng + (pt / petalCount) * Math.PI * 2;
            for (let i = 0; i < perPetal; i++) {
              const a = centerA - 0.25 + (i / (perPetal - 1)) * 0.5;
              const spd = baseSpeed * (0.8 + Math.abs(i - (perPetal - 1) / 2) * 0.08);
              state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, spd, 8 * bossDmgMult, '#ff5599'));
            }
          }
          // 中央9发快弹
          for (let i = 0; i < 9; i++) {
            const a = startAng + (i / 9) * Math.PI * 2;
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, baseSpeed * 1.3, 10 * bossDmgMult, '#ffffff'));
          }
        }
        spawnMuzzleFlash(e.x, e.y, 0, '#ff0033');
      }

      // 技能2：定点炸弹
      e.bossBombTimer -= dt;
      if (e.bossBombTimer <= 0) {
        e.bossBombTimer = 4 + Math.random() * 2;
        // 在玩家附近放置3-5个炸弹
        const bombCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < bombCount; i++) {
          const bx = p.x + randRange(-180, 180);
          const by = p.y + randRange(-180, 180);
          state.bossBombs.push({
            x: bx, y: by,
            timer: 2.5, maxTimer: 2.5,
            radius: 80, damage: 25 * bossDmgMult, active: true,
          });
        }
      }

      // 技能3：直线蓄力冲锋
      if (e.bossChargeState === 'idle') {
        if (e.bossChargeTimer === undefined) e.bossChargeTimer = 5;
        e.bossChargeTimer -= dt;
        if (e.bossChargeTimer <= 0) {
          // 开始蓄力
          e.bossChargeState = 'charging';
          e.bossChargeTimer = 1.5; // 蓄力1.5秒
          const dir = normalize(p.x - e.x, p.y - e.y);
          e.bossChargeDir = dir;
        }
      } else if (e.bossChargeState === 'charging') {
        e.bossChargeTimer -= dt;
        if (e.bossChargeTimer <= 0) {
          // 开始冲锋
          e.bossChargeState = 'dashing';
          e.bossChargeTimer = 1.2; // 冲锋1.2秒（距离720）
        }
      } else if (e.bossChargeState === 'dashing') {
        e.bossChargeTimer -= dt;
        if (e.bossChargeDir) {
          const dashSpeed = 600;
          e.x += e.bossChargeDir.x * dashSpeed * dt;
          e.y += e.bossChargeDir.y * dashSpeed * dt;
          // 冲锋碰撞伤害
          const dp = dist(e.x, e.y, p.x, p.y);
          if (dp < e.radius + p.radius) {
            damagePlayer(state, 30 * bossDmgMult);
          }
        }
        if (e.bossChargeTimer <= 0) {
          e.bossChargeState = 'idle';
          e.bossChargeTimer = 3 + Math.random() * 2;
          e.bossChargeDir = undefined;
        }
      }
    }

    // ---- 状态效果更新 ----
    if (e.freezeTimer > 0) {
      e.freezeTimer -= dt;
      if (e.freezeTimer <= 0) {
        e.speed = e.baseSpeed;
      }
    }
    if (e.burnTimer > 0) {
      e.burnTimer -= dt;
      e.hp -= e.burnDamage * dt;
      // 燃烧粒子（移动端大幅减少）
      const burnRate = state.isMobile ? 0.05 : 0.3;
      if (Math.random() < burnRate) {
        spawnParticles(e.x + randRange(-e.radius, e.radius), e.y + randRange(-e.radius, e.radius), 1, ['#ff6600', '#ffaa00', '#ff3300'], 20, 80, 1, 3, 0.2, 0.4);
      }
      if (e.hp <= 0) {
        killEnemy(state, e);
        continue;
      }
    }

    // 冰墙阻挡（旋转矩形碰撞）—— Boss冲锋时无视冰墙
    let blockedByIce = false;
    const bossDashing = e.type === 'boss' && e.bossChargeState === 'dashing';
    if (!bossDashing) {
      for (const iw of state.iceWallEffects) {
        if (!iw.active) continue;
        const dx = e.x - iw.x;
        const dy = e.y - iw.y;
        const ca = Math.cos(-iw.angle);
        const sa = Math.sin(-iw.angle);
        const lx = dx * ca - dy * sa;
        const ly = dx * sa + dy * ca;
        if (Math.abs(lx) <= iw.width / 2 + e.radius && Math.abs(ly) <= iw.height / 2 + e.radius) {
          blockedByIce = true;
          e.freezeTimer = Math.max(e.freezeTimer, 0.5);
          e.speed = e.baseSpeed * 0.6;
          // 沿法线推开：本地坐标系中最近点
          const cxL = clamp(lx, -iw.width / 2, iw.width / 2);
          const cyL = clamp(ly, -iw.height / 2, iw.height / 2);
          // 转回世界坐标
          const cW = Math.cos(iw.angle);
          const sW = Math.sin(iw.angle);
          const closestX = iw.x + cxL * cW - cyL * sW;
          const closestY = iw.y + cxL * sW + cyL * cW;
          const pdx = e.x - closestX;
          const pdy = e.y - closestY;
          const pd = Math.hypot(pdx, pdy) || 1;
          e.x = closestX + (pdx / pd) * (e.radius + 2);
          e.y = closestY + (pdy / pd) * (e.radius + 2);
          break;
        }
      }
    }

    // 移动目标：嘲讽目标优先，否则玩家
    let tx = p.x, ty = p.y;
    if (e.tauntTarget !== null) {
      const s = state.summons.find((sm) => sm.id === e.tauntTarget && sm.active);
      if (s) { tx = s.x; ty = s.y; }
      else { e.tauntTarget = null; }
    }

    const d = dist(e.x, e.y, tx, ty);
    if (e.isRanged && !blockedByIce) {
      // 远程：保持距离
      const pref = e.preferredDistance;
      if (d < pref - 30) {
        const dir = normalize(e.x - tx, e.y - ty);
        e.x += dir.x * e.speed * dt;
        e.y += dir.y * e.speed * dt;
      } else if (d > pref + 30) {
        const dir = normalize(tx - e.x, ty - e.y);
        e.x += dir.x * e.speed * dt;
        e.y += dir.y * e.speed * dt;
      }
      // 攻击
      if (now - e.lastAttackTime > e.attackCooldown && d < e.preferredDistance + 100) {
        e.lastAttackTime = now;
        const ang = angleTo(e.x, e.y, tx, ty);
        if (e.type === 'shotgunner') {
          // 散弹：5 发扇形
          for (let i = -2; i <= 2; i++) {
            const a = ang + i * 0.2;
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, e.projectileSpeed * 0.9, e.projectileDamage, e.color));
          }
        } else {
          state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, ang, e.projectileSpeed, e.projectileDamage, e.color));
        }
        spawnMuzzleFlash(e.x, e.y, ang, e.color);
      }
    } else if (e.type === 'boss' && e.bossChargeState !== 'idle' && e.bossChargeState !== undefined) {
      // Boss蓄力/冲锋中不执行普通移动
    } else if (!blockedByIce) {
      // 近战：直冲目标
      if (d > e.radius + p.radius - 2) {
        const dir = normalize(tx - e.x, ty - e.y);
        e.x += dir.x * e.speed * dt;
        e.y += dir.y * e.speed * dt;
      }
      // 近战伤害
      if (d < e.radius + p.radius) {
        if (now - e.lastAttackTime > e.attackCooldown) {
          e.lastAttackTime = now;
          damagePlayer(state, e.damage);
        }
      }
    }

    // 障碍物（多边形碰撞）
    for (const t of state.terrains) {
      if (t.type !== 'obstacle' || !t.hp) continue;
      if (!circlePolygonCollision(e.x, e.y, e.radius, t.x, t.y, t.vertices)) continue;
      // 找最近的边并推出
      let minDist = Infinity, pushX = 0, pushY = 0;
      for (let i = 0; i < t.vertices.length; i++) {
        const v1x = t.x + t.vertices[i].x, v1y = t.y + t.vertices[i].y;
        const v2x = t.x + t.vertices[(i + 1) % t.vertices.length].x;
        const v2y = t.y + t.vertices[(i + 1) % t.vertices.length].y;
        const dx = v2x - v1x, dy = v2y - v1y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) continue;
        let s = ((e.x - v1x) * dx + (e.y - v1y) * dy) / len2;
        s = clamp(s, 0, 1);
        const closestX = v1x + s * dx, closestY = v1y + s * dy;
        const ddx = e.x - closestX, ddy = e.y - closestY;
        const d = Math.hypot(ddx, ddy);
        if (d < minDist) {
          minDist = d;
          pushX = ddx / (d || 1);
          pushY = ddy / (d || 1);
        }
      }
      e.x += pushX * (e.radius - minDist + 1);
      e.y += pushY * (e.radius - minDist + 1);
    }
    e.x = clamp(e.x, e.radius, state.mapWidth - e.radius);
    e.y = clamp(e.y, e.radius, state.mapHeight - e.radius);

    // 火墙持续伤害（旋转矩形碰撞）
    for (const fw of state.fireWallEffects) {
      if (!fw.active) continue;
      const dx = e.x - fw.x;
      const dy = e.y - fw.y;
      const ca = Math.cos(-fw.angle);
      const sa = Math.sin(-fw.angle);
      const lx = dx * ca - dy * sa;
      const ly = dx * sa + dy * ca;
      if (Math.abs(lx) <= fw.width / 2 + e.radius && Math.abs(ly) <= fw.height / 2 + e.radius) {
        damageEnemy(state, e, fw.damage * dt * 2, '#ff4400');
      }
    }
  }

  state.enemies = state.enemies.filter((e) => e.active);
}

export function damageEnemy(state: GameState, e: Enemy, dmg: number, color: string) {
  if (!e.active) return;
  // Boss冲锋蓄力和冲锋过程中无敌
  if (e.type === 'boss' && (e.bossChargeState === 'charging' || e.bossChargeState === 'dashing')) {
    return;
  }
  e.hp -= dmg;
  e.flashTimer = 0.08;
  spawnHitSpark(e.x, e.y, color);

  // ---- 附魔效果 ----
  const ench = state.player.enchants;
  if (ench.freeze > 0 && Math.random() < Math.min(0.5, ench.freeze * 0.12)) {
    e.freezeTimer = Math.max(e.freezeTimer, 1.5 + ench.freeze * 0.3);
    e.speed = e.baseSpeed * Math.max(0.2, 1 - ench.freeze * 0.15);
    spawnIceShatter(e.x, e.y);
  }
  if (ench.burn > 0 && Math.random() < Math.min(0.6, ench.burn * 0.15)) {
    e.burnTimer = Math.max(e.burnTimer, 2 + ench.burn * 0.5);
    e.burnDamage = Math.max(e.burnDamage, dmg * 0.25 * ench.burn);
  }
  // pierce 附魔增加穿透：直接作用在投射物创建阶段，这里不处理

  if (e.hp <= 0) {
    killEnemy(state, e);
  }
}

export function killEnemy(state: GameState, e: Enemy) {
  if (!e.active) return;
  e.active = false;
  state.kills += 1;
  state.killsRecent += 1;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);

  spawnBlood(e.x, e.y, e.type === 'boss' ? 30 : 10);

  // 分裂怪死亡后分裂成小分裂怪
  if (e.type === 'splitter') {
    const smallCount = 3 + Math.floor(state.wave / 5);
    for (let i = 0; i < Math.min(smallCount, 6); i++) {
      const ang = (i / Math.min(smallCount, 6)) * Math.PI * 2 + randRange(-0.2, 0.2);
      const dist = randRange(15, 30);
      const sx = clamp(e.x + Math.cos(ang) * dist, 10, state.mapWidth - 10);
      const sy = clamp(e.y + Math.sin(ang) * dist, 10, state.mapHeight - 10);
      const small = createEnemyAt(state, 'splitter_small', sx, sy);
      if (small) state.enemies.push(small);
    }
    spawnExplosion(e.x, e.y, 8);
  }

  if (e.type === 'boss') {
    spawnBigExplosion(e.x, e.y);
    state.screenShake = 16;
    // Boss 击杀：金色冲天光柱
    state.lightPillars.push(makeLightPillar(e.x, e.y, '#ffdd44', {
      baseRadius: 34, beamHeight: 320, ringMax: 240, life: 1.8,
    }));
    spawnLightPillarBurst(e.x, e.y, '#ffdd44');
  } else if (e.isElite) {
    spawnExplosion(e.x, e.y, 14);
    state.screenShake = 7;
    // 精英击杀：紫色冲天光柱
    state.lightPillars.push(makeLightPillar(e.x, e.y, '#a855f7', {
      baseRadius: 24, beamHeight: 250, ringMax: 170, life: 1.4,
    }));
    spawnLightPillarBurst(e.x, e.y, '#a855f7');
  } else if (e.type === 'elite') {
    spawnExplosion(e.x, e.y, 12);
    state.screenShake = 6;
    state.lightPillars.push(makeLightPillar(e.x, e.y, '#a855f7', {
      baseRadius: 22, beamHeight: 230, ringMax: 150, life: 1.3,
    }));
    spawnLightPillarBurst(e.x, e.y, '#a855f7');
  }

  // 经验掉落（受动态经验系数影响），按敌人难度分级：小怪少小，大怪多大团
  const expVal = Math.max(1, Math.round(e.expValue * state.dynamicExpMult));
  let dropCfg = getExpDropConfig(e.type, expVal);
  // Boss阶段：经验球掉率下降，但单球价值上升
  const stage = state.bossSpawnCount || 0;
  if (stage > 0) {
    const dropCountMult = Math.pow(0.82, stage);
    const perValueMult = 1 / dropCountMult;
    const newCount = Math.max(1, Math.round(dropCfg.count * dropCountMult));
    const newPerValue = Math.ceil(dropCfg.perValue * perValueMult);
    const newRadius = dropCfg.perRadius + Math.min(stage * 0.5, 3);
    dropCfg = { count: newCount, perValue: newPerValue, perRadius: newRadius };
  }
  for (let i = 0; i < dropCfg.count; i++) {
    const ang = (i / dropCfg.count) * Math.PI * 2 + randRange(-0.3, 0.3);
    const r = randRange(0, e.radius * 0.8);
    const px = e.x + Math.cos(ang) * r;
    const py = e.y + Math.sin(ang) * r;
    const spd = randRange(30, 80);
    // 经验球越小消失越快：5px→8秒，9px→14秒，12px→20秒
    const r0 = dropCfg.perRadius;
    const lifeTime = r0 <= 5 ? 8 : r0 <= 7 ? 12 : r0 <= 10 ? 16 : 22;
    state.pickups.push({
      id: getNextId(), x: px, y: py,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      radius: r0, hp: 1, maxHp: 1, active: true,
      type: 'exp', value: dropCfg.perValue, magnetTarget: null,
      life: lifeTime, maxLife: lifeTime,
    });
  }

  // 生命掉落（大怪更大概率）
  const healChance = e.type === 'boss' ? 1.0 : e.isElite || e.type === 'elite' ? 0.35 : 0.04;
  if (Math.random() < healChance) {
    state.pickups.push({
      id: getNextId(), x: e.x, y: e.y, vx: 0, vy: 0,
      radius: 11, hp: 1, maxHp: 1, active: true,
      type: 'health', value: 20, magnetTarget: null,
      life: 25, maxLife: 25,
    });
  }

  // 精英/Boss 必掉特殊拾取物
  if (e.isElite || e.type === 'elite' || e.type === 'boss') {
    const dropType = randPick(['bomb', 'vacuum', 'shield_pickup', 'screen_clear'] as const);
    // 特殊道具存在时间较长：30秒
    state.pickups.push({
      id: getNextId(), x: e.x, y: e.y, vx: 0, vy: 0,
      radius: 15, hp: 1, maxHp: 1, active: true,
      type: dropType, value: 0, magnetTarget: null,
      life: 35, maxLife: 35,
    });
  }

  // 吸血被动
  if (state.player.passives.vampirism > 0) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 1 + state.player.passives.vampirism);
  }
}

export function createEnemyAt(state: GameState, type: EnemyType, x: number, y: number): Enemy | null {
  const wave = state.wave;

  const configs: Record<EnemyType, { hp: number; speed: number; damage: number; exp: number; radius: number; color: string; ranged: boolean; prefDist: number; projSpeed: number; projDmg: number; atkCd: number }> = {
    basic:        { hp: 40 + wave * 6,     speed: 70 + wave * 1.2,   damage: 6 + wave * 0.4,   exp: 4,  radius: 16, color: '#991b1b', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 1.0 },
    fast:         { hp: 28 + wave * 4,     speed: 130 + wave * 1.8,  damage: 5 + wave * 0.3,   exp: 5,  radius: 12, color: '#7f1d1d', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 0.8 },
    tank:         { hp: 180 + wave * 20,   speed: 38 + wave * 0.4,   damage: 12 + wave * 0.6,  exp: 14, radius: 30, color: '#5b21b6', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 1.5 },
    bruiser:      { hp: 320 + wave * 32,   speed: 30 + wave * 0.3,   damage: 18 + wave * 0.7,  exp: 22, radius: 34, color: '#4c1d95', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 1.8 },
    splitter:     { hp: 100 + wave * 12,   speed: 55 + wave * 0.8,   damage: 8 + wave * 0.4,   exp: 12, radius: 20, color: '#6d28d9', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 1.2 },
    splitter_small:{ hp: 35 + wave * 5,    speed: 95 + wave * 1.2,   damage: 4 + wave * 0.2,   exp: 3,  radius: 11, color: '#7c3aed', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 0.9 },
    elite:        { hp: 420 + wave * 42,   speed: 65 + wave * 0.8,   damage: 14 + wave * 0.5,  exp: 30, radius: 26, color: '#881337', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 1.2 },
    boss:         { hp: 1600 + wave * 140,   speed: 50 + wave * 0.3,   damage: 22 + wave * 0.8,  exp: 100, radius: 88, color: '#7f1d1d', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 1.5 },
    shooter:      { hp: 45 + wave * 5,     speed: 55 + wave * 0.8,   damage: 4 + wave * 0.2,   exp: 10, radius: 14, color: '#7c3aed', ranged: true,  prefDist: 280, projSpeed: 200, projDmg: 3 + wave * 0.3,    atkCd: 2.5 },
    sniper:       { hp: 55 + wave * 6,     speed: 42 + wave * 0.3,   damage: 6 + wave * 0.3,   exp: 15, radius: 13, color: '#be123c', ranged: true,  prefDist: 480, projSpeed: 420, projDmg: 8 + wave * 0.5,    atkCd: 4.5 },
    shotgunner:   { hp: 65 + wave * 7,     speed: 50 + wave * 0.6,   damage: 5 + wave * 0.2,   exp: 12, radius: 15, color: '#991b1b', ranged: true,  prefDist: 200, projSpeed: 180, projDmg: 2 + wave * 0.2,    atkCd: 3.5 },
    // --- 精英怪（复杂形态 + 多炮台） ---
    elite_brute:  { hp: 750 + wave * 67.5,   speed: 48 + wave * 0.4,   damage: 20 + wave * 0.6,  exp: 50, radius: 52, color: '#6b21a8', ranged: true,  prefDist: 220, projSpeed: 312, projDmg: 7.8 + wave * 0.52,    atkCd: 1.6 },
    elite_gunner: { hp: 570 + wave * 57,   speed: 58 + wave * 0.5,   damage: 16 + wave * 0.5,  exp: 48, radius: 48, color: '#5b21b6', ranged: true,  prefDist: 320, projSpeed: 416, projDmg: 6.5 + wave * 0.39,    atkCd: 1.2 },
    elite_bomber: { hp: 510 + wave * 51,   speed: 75 + wave * 0.7,   damage: 18 + wave * 0.4,  exp: 45, radius: 46, color: '#831843', ranged: true,  prefDist: 180, projSpeed: 260, projDmg: 10.4 + wave * 0.52,    atkCd: 2.0 },
  };
  const c = configs[type];
  const stage = state.bossSpawnCount || 0;
  const diffMult = state.waveDifficultyMult || 1;
  const hpMult = (1 + stage * 0.25) * diffMult;
  const dmgMult = (1 + stage * 0.15) * Math.sqrt(diffMult);
  const spdMult = 1 + stage * 0.08;
  const expMult = 1 + stage * 0.3;
  const sizeMult = 1 + stage * 0.05;
  c.hp = Math.round(c.hp * hpMult);
  c.damage = c.damage * dmgMult;
  c.speed = c.speed * spdMult;
  c.exp = Math.round(c.exp * expMult);
  c.radius = c.radius * sizeMult;
  if (c.projDmg > 0) c.projDmg = c.projDmg * dmgMult;
  if (c.projSpeed > 0) c.projSpeed = c.projSpeed * (1 + stage * 0.05);
  // 阶段颜色变化：越往后越深越红
  if (stage > 0) {
    c.color = darkenColor(c.color, stage * 0.08);
  }

  // 精英怪炮台配置：身上长多个炮台
  let turrets: EnemyTurret[] = [];
  let isElite = false;
  if (type === 'elite_brute') {
    isElite = true;
    for (let i = 0; i < 4; i++) {
      turrets.push({
        angle: 0, offsetAngle: (i / 4) * Math.PI * 2,
        radius: c.radius * 0.6, cooldown: 1.4, lastFire: 0, color: '#8b5cf6',
      });
    }
  } else if (type === 'elite_gunner') {
    isElite = true;
    for (let i = 0; i < 6; i++) {
      turrets.push({
        angle: 0, offsetAngle: (i / 6) * Math.PI * 2,
        radius: c.radius * 0.65, cooldown: 1.0, lastFire: 0, color: '#a855f7',
      });
    }
  } else if (type === 'elite_bomber') {
    isElite = true;
    for (let i = 0; i < 3; i++) {
      turrets.push({
        angle: 0, offsetAngle: (i / 3) * Math.PI * 2,
        radius: c.radius * 0.55, cooldown: 1.8, lastFire: 0, color: '#7c3aed',
      });
    }
  }

  const e: Enemy = {
    id: getNextId(),
    x, y, vx: 0, vy: 0,
    radius: c.radius,
    hp: c.hp, maxHp: c.hp, active: true,
    speed: c.speed,
    damage: c.damage,
    expValue: c.exp,
    type,
    color: c.color,
    attackCooldown: c.atkCd,
    lastAttackTime: 0,
    flashTimer: 0,
    isRanged: c.ranged,
    preferredDistance: c.prefDist,
    projectileSpeed: c.projSpeed,
    projectileDamage: c.projDmg,
    tauntTarget: null,
    baseSpeed: c.speed,
    freezeTimer: 0,
    burnTimer: 0,
    burnDamage: 0,
    isElite,
    turrets,
    rotation: 0,
    spawnAnim: 0.4,
  };
  return e;
}
