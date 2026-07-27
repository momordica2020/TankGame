import type { GameState } from '../types';
import { normalize, clamp, randRange, circlePolygonCollision, pointInPolygon } from '../math';
import { spawnParticles, spawnBigExplosion } from '../particles';
import { applyPassiveRegen } from '../skills/passive';
import { getInput } from '../core/input';
import { getSlotMount } from '../weapons/core';

export function updatePlayer(state: GameState, dt: number) {
  const p = state.player;
  if (!p.active) return;

  // 计时器
  if (p.invincibleTimer > 0) p.invincibleTimer -= dt;
  if (p.shieldTimer > 0) p.shieldTimer -= dt;
  if (p.berserkTimer > 0) p.berserkTimer -= dt;
  for (const k of Object.keys(p.timers)) {
    if (p.timers[k] > 0) p.timers[k] = Math.max(0, p.timers[k] - dt);
  }

  // 移动
  const input = getInput();
  let mx = 0, my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  // 触摸控制
  if (input.touchActive && state.isMobile) {
    const joyDeadzone = 8;
    const joyMag = Math.hypot(input.touchJoyX, input.touchJoyY);
    if (joyMag > joyDeadzone) {
      const factor = (joyMag - joyDeadzone) / (50 - joyDeadzone);
      mx += (input.touchJoyX / joyMag) * factor;
      my += (input.touchJoyY / joyMag) * factor;
    }
  }
  const n = normalize(mx, my);
  let speed = p.speed;
  // 地形影响
  const onSlow = state.terrains.some((t) => t.type === 'slowzone' && pointInPolygon(p.x, p.y, t.x, t.y, t.vertices));
  if (onSlow) speed *= 0.55;

  p.vx = n.x * speed;
  p.vy = n.y * speed;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // 移动状态、朝向、走路周期
  const moving = (n.x !== 0 || n.y !== 0);
  p.moving = moving;
  // 浮游炮环绕角度（持续旋转，不依赖目标）
  p.droneOrbit += dt * 2.5;
  // 缓急转向：身体朝向缓动逼近目标朝向（最短角差）
  if (moving) {
    p.targetFacing = Math.atan2(n.y, n.x);
  }
  {
    let diff = p.targetFacing - p.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnSpeed = 7.5; // rad/s，平滑但不拖沓
    const maxTurn = turnSpeed * dt;
    if (Math.abs(diff) <= maxTurn) p.facing = p.targetFacing;
    else p.facing += Math.sign(diff) * maxTurn;
  }
  if (moving) {
    p.walkCycle += dt * 12;
    // 尘土效果（移动端大幅降低频率）
    p.dustTimer -= dt;
    const dustInterval = state.isMobile ? 0.35 : 0.06;
    if (p.dustTimer <= 0) {
      p.dustTimer = dustInterval;
      const back = p.facing + Math.PI;
      const offX = Math.cos(back) * p.radius * 0.4 + randRange(-8, 8);
      const offY = Math.sin(back) * p.radius * 0.4 + randRange(-8, 8);
      spawnParticles(
        p.x + offX, p.y + offY, state.isMobile ? 2 : 4,
        ['#8a7a5a', '#a09070', '#6b5d40', '#7a6c4a'],
        20, 60, 3, 8, 0.3, 0.6
      );
    }
  } else {
    p.walkCycle = 0;
  }

  // 障碍物碰撞（多边形）
  for (const t of state.terrains) {
    if (t.type !== 'obstacle' || !t.hp) continue;
    if (!circlePolygonCollision(p.x, p.y, p.radius, t.x, t.y, t.vertices)) continue;
    // 找最近的边并推出
    let minDist = Infinity, pushX = 0, pushY = 0;
    for (let i = 0; i < t.vertices.length; i++) {
      const v1x = t.x + t.vertices[i].x, v1y = t.y + t.vertices[i].y;
      const v2x = t.x + t.vertices[(i + 1) % t.vertices.length].x;
      const v2y = t.y + t.vertices[(i + 1) % t.vertices.length].y;
      const dx = v2x - v1x, dy = v2y - v1y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      let s = ((p.x - v1x) * dx + (p.y - v1y) * dy) / len2;
      s = clamp(s, 0, 1);
      const closestX = v1x + s * dx, closestY = v1y + s * dy;
      const ddx = p.x - closestX, ddy = p.y - closestY;
      const d = Math.hypot(ddx, ddy);
      if (d < minDist) {
        minDist = d;
        pushX = ddx / (d || 1);
        pushY = ddy / (d || 1);
      }
    }
    p.x += pushX * (p.radius - minDist + 1);
    p.y += pushY * (p.radius - minDist + 1);
  }

  // 边界
  p.x = clamp(p.x, p.radius, state.mapWidth - p.radius);
  p.y = clamp(p.y, p.radius, state.mapHeight - p.radius);

  // 被动 - 纳米修复
  applyPassiveRegen(p, dt);
}

export function damagePlayer(state: GameState, dmg: number) {
  const p = state.player;
  if (!p.active) return;
  if (p.invincibleTimer > 0) return;
  if (p.shieldTimer > 0) {
    // 护盾期间减伤 70%
    dmg *= 0.3;
  }
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, dmg * 0.6);
    p.armor -= absorbed;
    dmg -= absorbed;
  }
  p.hp -= dmg;
  state.screenShake = Math.max(state.screenShake, dmg * 0.3);
  state.damageFlash = Math.min(1, Math.max(state.damageFlash, 0.3 + dmg * 0.04));
  if (p.hp <= 0 && state.deathAnim === 0) {
    p.hp = 0;
    p.active = false;
    state.deathAnim = 1.6; // 死亡动画时长 1.6 秒
    state.screenShake = 20;
    spawnBigExplosion(p.x, p.y);
    // 生成机甲碎片
    const colors = ['#3a5a44', '#4f7a5c', '#2a3f30', '#ffcc44', '#444', '#ff3333'];
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 + randRange(-0.3, 0.3);
      const spd = randRange(120, 320);
      state.deathDebris.push({
        x: p.x, y: p.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        rot: randRange(0, Math.PI * 2),
        vr: randRange(-8, 8),
        size: randRange(6, 14),
        color: colors[i % colors.length],
      });
    }
    // 武器炮塔碎片：每个武器生成一个较大的炮塔碎片飞散
    const slotCounts: Record<string, number> = {};
    const bodyRot = p.facing + Math.PI / 2;
    const cosR = Math.cos(bodyRot), sinR = Math.sin(bodyRot);
    for (let i = 0; i < p.weapons.length; i++) {
      const w = p.weapons[i];
      const slot = w.config.slot;
      const idx = slotCounts[slot] || 0;
      slotCounts[slot] = idx + 1;
      const mount = getSlotMount(slot, p.radius, idx);
      const sx = p.x + mount.x * cosR - mount.y * sinR;
      const sy = p.y + mount.x * sinR + mount.y * cosR;
      const baseAngle = Math.atan2(mount.y, mount.x) + bodyRot;
      const ang = baseAngle + randRange(-0.4, 0.4);
      const spd = randRange(150, 280);
      state.deathDebris.push({
        x: sx, y: sy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        rot: randRange(0, Math.PI * 2),
        vr: randRange(-6, 6),
        size: randRange(10, 16),
        color: w.config.color,
      });
    }
  }
}
