import type {
  GameState, Player, Enemy, EnemyType, EnemyTurret, Projectile, Pickup, PickupType,
  Summon, SummonType, Terrain, WeaponConfig, WeaponInstance,
  MeleeEffect, FlameEffect, LightningEffect, FireWallEffect, IceWallEffect, BeamLaserEffect,
} from './types';
import { WEAPON_CONFIGS, createProjectile, createEnemyProjectile, fireWeapon, findNearestEnemyId, selectTarget, getWeaponMuzzleWorld, getWeaponMountWorld, getSlotMount } from './weapons';
import { dist, angleTo, normalize, clamp, randRange, randInt, randPick, circlePolygonCollision, pointInPolygon } from './math';
import {
  initParticles, updateParticles, setParticleSpawnRate,
  spawnExplosion, spawnBigExplosion, spawnBlood, spawnExpOrbSparkle,
  spawnHitSpark, spawnMuzzleFlash, spawnLightning, spawnIceShatter,
  spawnMagicBurst, spawnScreenFlash, spawnParticles,
  makeLightPillar, spawnLightPillarBurst,
} from './particles';
import { generateUpgradeOptions } from './upgrades';

let nextId = 1;

const input = {
  up: false, down: false, left: false, right: false,
  mouseX: 0, mouseY: 0, mouseWorldX: 0, mouseWorldY: 0,
  skill1: false, skill2: false, skill3: false, skill4: false,
  touchActive: false,
  touchStartX: 0,
  touchStartY: 0,
  touchX: 0,
  touchY: 0,
  touchJoyX: 0,
  touchJoyY: 0,
};

// ---- 主动技能冷却（秒） ----
const SKILL_CD = { heal: 30, shield: 25, invincible: 60, screenClear: 45 };
const SKILL_DURATION = { shield: 8, invincible: 5 };
// ---- 自动炮塔 ----
const TURRET_MAX_COUNT = 4;
const TURRET_DEPLOY_INTERVAL = 12; // 每 12 秒重新部署
const TURRET_TAUNT_INTERVAL = 5;   // 每 5 秒嘲讽一次
const TURRET_TAUNT_RADIUS = 400;

export function bindInput(canvas: HTMLCanvasElement) {
  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') input.up = true;
    if (k === 's' || k === 'arrowdown') input.down = true;
    if (k === 'a' || k === 'arrowleft') input.left = true;
    if (k === 'd' || k === 'arrowright') input.right = true;
    if (k === '1') input.skill1 = true;
    if (k === '2') input.skill2 = true;
    if (k === '3') input.skill3 = true;
    if (k === '4') input.skill4 = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') input.up = false;
    if (k === 's' || k === 'arrowdown') input.down = false;
    if (k === 'a' || k === 'arrowleft') input.left = false;
    if (k === 'd' || k === 'arrowright') input.right = false;
  };
  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      input.touchActive = true;
      input.touchStartX = x;
      input.touchStartY = y;
      input.touchX = x;
      input.touchY = y;
      input.touchJoyX = 0;
      input.touchJoyY = 0;
      input.mouseX = x;
      input.mouseY = y;
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0 && input.touchActive) {
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      input.touchX = x;
      input.touchY = y;
      input.mouseX = x;
      input.mouseY = y;
      const dx = x - input.touchStartX;
      const dy = y - input.touchStartY;
      const maxDist = 50;
      const dist = Math.hypot(dx, dy);
      if (dist > maxDist) {
        input.touchJoyX = (dx / dist) * maxDist;
        input.touchJoyY = (dy / dist) * maxDist;
      } else {
        input.touchJoyX = dx;
        input.touchJoyY = dy;
      }
    }
  };
  const onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    input.touchActive = false;
    input.touchJoyX = 0;
    input.touchJoyY = 0;
  };
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
}

export function createGameState(startWeapon: string): GameState {
  initParticles();
  nextId = 1;

  const mapWidth = 2400;
  const mapHeight = 2400;

  const isMobile = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window && (typeof window !== 'undefined' && window.innerWidth < 900))
  );
  if (isMobile) setParticleSpawnRate(0.25); // 移动端粒子数降至 25%
  const mobileZoom = 1;

  const terrains: Terrain[] = generateTerrains(mapWidth, mapHeight);

  const player: Player = {
    id: nextId++,
    x: mapWidth / 2, y: mapHeight / 2,
    vx: 0, vy: 0,
    radius: 44,
    hp: 100, maxHp: 100, active: true,
    speed: 260,
    exp: 0, maxExp: 10, level: 1,
    weapons: [],
    upgrades: [],
    invincibleTimer: 0,
    armor: 0, maxArmor: 0,
    pickupRadius: 150,
    expGainMult: 1,
    timers: { heal: 0, shield: 0, invincible: 0, screenClear: 0 },
    shieldTimer: 0,
    berserkTimer: 0,
    enchants: { freeze: 0, burn: 0, pierce: 0 },
    facing: 0,
    targetFacing: 0,
    walkCycle: 0,
    dustTimer: 0,
    moving: false,
    droneOrbit: 0,
  };

  const startWeaponId = (startWeapon as keyof typeof WEAPON_CONFIGS) || 'rifle';
  const cfg = WEAPON_CONFIGS[startWeaponId] || WEAPON_CONFIGS.rifle;
  player.weapons.push({ config: { ...cfg }, level: 1, lastFireTime: 0, heat: 0, aimAngle: 0, targetAngle: 0, fireFlash: 0 });

  return {
    player,
    projectiles: [],
    enemies: [],
    pickups: [],
    particles: [],
    camera: { x: player.x, y: player.y, targetX: player.x, targetY: player.y },
    wave: 1,
    waveTimer: 3,
    gameTime: 0,
    kills: 0,
    combo: 0,
    maxCombo: 0,
    isPaused: false,
    isGameOver: false,
    showUpgrade: false,
    isMobile,
    mobileZoom,
    touchInput: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, joyX: 0, joyY: 0 },
    upgradeOptions: [],
    screenShake: 0,
    damageFlash: 0,
    mapWidth,
    mapHeight,
    terrains,
    summons: [],
    meleeEffects: [],
    flameEffects: [],
    enemyProjectiles: [],
    lightningEffects: [],
    fireWallEffects: [],
    iceWallEffects: [],
    beamLaserEffects: [],
    lightPillars: [],
    continuousSpawnTimer: 0,
    groupSpawnTimer: 4,
    eliteSpawnTimer: 18,
    killsRecent: 0,
    killRateTimer: 0,
    killRatePerMin: 0,
    enemyCap: 90,
    dynamicExpMult: 1,
    deathAnim: 0,
    deathDebris: [],
    bossBombs: [],
    bossSpawnCount: 0,
  };
}

// 生成不规则多边形顶点（局部坐标，中心 0,0）
function makeIrregularPoly(sides: number, baseR: number, jitter: number): { x: number; y: number }[] {
  const verts: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const r = baseR * (1 - jitter / 2 + Math.random() * jitter);
    verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return verts;
}

function generateTerrains(mapW: number, mapH: number): Terrain[] {
  const terrains: Terrain[] = [];

  // 软石（低硬度，容易破坏）
  const softRockCount = 12;
  for (let i = 0; i < softRockCount; i++) {
    const w = randRange(50, 100);
    const h = randRange(50, 100);
    const x = randRange(120, mapW - 120 - w);
    const y = randRange(120, mapH - 120 - h);
    const avgR = Math.min(w, h) * 0.5;
    const sides = Math.floor(randRange(5, 8));
    const vertices = makeIrregularPoly(sides, avgR, 0.3);
    const hp = Math.floor(40 + avgR * 1.2);
    terrains.push({
      id: nextId++, type: 'obstacle', variant: 'soft_rock',
      x: x + w / 2, y: y + h / 2,
      width: w, height: h,
      hp, maxHp: hp, destructible: true, vertices,
    });
  }

  // 硬石（高硬度，难以破坏）
  const hardRockCount = 8;
  for (let i = 0; i < hardRockCount; i++) {
    const w = randRange(70, 150);
    const h = randRange(70, 150);
    const x = randRange(150, mapW - 150 - w);
    const y = randRange(150, mapH - 150 - h);
    const avgR = Math.min(w, h) * 0.5;
    const sides = Math.floor(randRange(6, 10));
    const vertices = makeIrregularPoly(sides, avgR, 0.25);
    const hp = Math.floor(160 + avgR * 3);
    terrains.push({
      id: nextId++, type: 'obstacle', variant: 'hard_rock',
      x: x + w / 2, y: y + h / 2,
      width: w, height: h,
      hp, maxHp: hp, destructible: true, vertices,
    });
  }

  // 金属残骸（极高硬度）
  const metalCount = 3;
  for (let i = 0; i < metalCount; i++) {
    const w = randRange(90, 160);
    const h = randRange(60, 120);
    const x = randRange(200, mapW - 200 - w);
    const y = randRange(200, mapH - 200 - h);
    const avgR = Math.min(w, h) * 0.5;
    const sides = Math.floor(randRange(7, 11));
    const vertices = makeIrregularPoly(sides, avgR, 0.2);
    const hp = Math.floor(350 + avgR * 4);
    terrains.push({
      id: nextId++, type: 'obstacle', variant: 'metal',
      x: x + w / 2, y: y + h / 2,
      width: w, height: h,
      hp, maxHp: hp, destructible: true, vertices,
    });
  }

  // 枯树（中等硬度，较细）
  const treeCount = 15;
  for (let i = 0; i < treeCount; i++) {
    const w = randRange(35, 55);
    const h = randRange(35, 55);
    const x = randRange(100, mapW - 100 - w);
    const y = randRange(100, mapH - 100 - h);
    const avgR = Math.min(w, h) * 0.5;
    const sides = Math.floor(randRange(7, 10));
    const vertices = makeIrregularPoly(sides, avgR, 0.15);
    const hp = Math.floor(60 + avgR * 1.5);
    terrains.push({
      id: nextId++, type: 'obstacle', variant: 'tree',
      x: x + w / 2, y: y + h / 2,
      width: w, height: h,
      hp, maxHp: hp, destructible: true, vertices,
    });
  }

  // 沼泽（减速带，不规则形状，不可破坏）
  for (let i = 0; i < 7; i++) {
    const w = randRange(120, 240);
    const h = randRange(120, 240);
    const x = randRange(120, mapW - 120 - w);
    const y = randRange(120, mapH - 120 - h);
    const avgR = Math.min(w, h) * 0.5;
    const sides = Math.floor(randRange(8, 13));
    const vertices = makeIrregularPoly(sides, avgR, 0.3);
    terrains.push({
      id: nextId++, type: 'slowzone',
      x: x + w / 2, y: y + h / 2,
      width: w, height: h,
      hp: 0, maxHp: 0, destructible: false, vertices,
    });
  }
  return terrains;
}

// ============ 主循环 ============
export function updateGame(state: GameState, dt: number, canvasW: number, canvasH: number) {
  // 同步触摸输入到 state（供渲染使用）
  state.touchInput.active = input.touchActive;
  state.touchInput.startX = input.touchStartX;
  state.touchInput.startY = input.touchStartY;
  state.touchInput.currentX = input.touchX;
  state.touchInput.currentY = input.touchY;
  state.touchInput.joyX = input.touchJoyX;
  state.touchInput.joyY = input.touchJoyY;
  if (state.isPaused || state.isGameOver || state.showUpgrade) return;

  // 死亡动画阶段：只更新碎片、粒子、相机，不更新游戏逻辑
  if (state.deathAnim > 0) {
    state.deathAnim -= dt;
    // 更新碎片
    for (const d of state.deathDebris) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 0.96;
      d.vy *= 0.96;
      d.vy += 200 * dt;
      d.rot += d.vr * dt;
      if (d.life !== undefined) d.life -= dt;
    }
    // 过滤掉生命周期结束的碎片（弹壳等临时物）
    state.deathDebris = state.deathDebris.filter((d) => d.life === undefined || d.life > 0);
    // 持续冒火花（移动端减少）
    const deathSparkRate = state.isMobile ? 0.15 : 0.5;
    if (Math.random() < deathSparkRate) {
      const p = state.player;
      spawnParticles(p.x + randRange(-15, 15), p.y + randRange(-15, 15), 2,
        ['#ffaa00', '#ff6600', '#ff3333', '#ffdd44'], 30, 120, 1, 4, 0.2, 0.5);
    }
    if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - dt * 30);
    updateParticles(dt);
    // 相机缩进到玩家位置
    const p = state.player;
    state.camera.targetX = p.x;
    state.camera.targetY = p.y;
    state.camera.x += (state.camera.targetX - state.camera.x) * Math.min(1, dt * 3);
    state.camera.y += (state.camera.targetY - state.camera.y) * Math.min(1, dt * 3);
    // 动画结束 → 进入结算
    if (state.deathAnim <= 0) {
      state.isGameOver = true;
    }
    return;
  }

  state.gameTime += dt;
  if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - dt * 30);
  if (state.damageFlash > 0) {
    state.damageFlash = Math.max(0, state.damageFlash - dt * 3);
  }

  // 鼠标世界坐标
  input.mouseWorldX = state.camera.x + (input.mouseX - canvasW / 2);
  input.mouseWorldY = state.camera.y + (input.mouseY - canvasH / 2);

  updatePlayer(state, dt);
  updateSkills(state, dt);
  updateWeapons(state, dt);
  updateProjectiles(state, dt);
  updateEnemyProjectiles(state, dt);
  updateEnemies(state, dt);
  updateSummons(state, dt);
  updatePickups(state, dt);
  updateMagicEffects(state, dt);
  updateMeleeAndFlame(state, dt);
  updateParticles(dt);
  // 更新弹壳等碎片
  for (const d of state.deathDebris) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vx *= 0.96;
    d.vy *= 0.96;
    d.vy += 200 * dt;
    d.rot += d.vr * dt;
    if (d.life !== undefined) d.life -= dt;
  }
  state.deathDebris = state.deathDebris.filter((d) => d.life === undefined || d.life > 0);
  updateSpawning(state, dt);
  updateCamera(state, dt, canvasW, canvasH);
  updateCombo(state, dt);

  // 移除被摧毁的障碍物
  state.terrains = state.terrains.filter((t) => !(t.type === 'obstacle' && t.hp <= 0));

  // 经验升级
  checkLevelUp(state);
}

function updatePlayer(state: GameState, dt: number) {
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
    // 尘土效果
    p.dustTimer -= dt;
    if (p.dustTimer <= 0) {
      p.dustTimer = 0.06;
      const back = p.facing + Math.PI;
      const offX = Math.cos(back) * p.radius * 0.4 + randRange(-8, 8);
      const offY = Math.sin(back) * p.radius * 0.4 + randRange(-8, 8);
      spawnParticles(
        p.x + offX, p.y + offY, 4,
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
  if (p.upgrades.includes('regen')) {
    p.hp = Math.min(p.maxHp, p.hp + 2 * dt);
  }
}

// ============ 主动技能 ============
function updateSkills(state: GameState, dt: number) {
  const p = state.player;

  if (input.skill1) {
    input.skill1 = false;
    if ((p.timers.heal || 0) <= 0) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
      p.timers.heal = SKILL_CD.heal;
      spawnMagicBurst(p.x, p.y, '#44ff88');
    }
  }
  if (input.skill2) {
    input.skill2 = false;
    if ((p.timers.shield || 0) <= 0) {
      p.shieldTimer = SKILL_DURATION.shield;
      p.timers.shield = SKILL_CD.shield;
      spawnMagicBurst(p.x, p.y, '#3b82f6');
    }
  }
  if (input.skill3) {
    input.skill3 = false;
    if ((p.timers.invincible || 0) <= 0) {
      p.invincibleTimer = Math.max(p.invincibleTimer, SKILL_DURATION.invincible);
      p.timers.invincible = SKILL_CD.invincible;
      spawnMagicBurst(p.x, p.y, '#ffdd44');
    }
  }
  if (input.skill4) {
    input.skill4 = false;
    if ((p.timers.screenClear || 0) <= 0) {
      p.timers.screenClear = SKILL_CD.screenClear;
      screenClear(state);
    }
  }
}

function screenClear(state: GameState) {
  const p = state.player;
  spawnScreenFlash(p.x, p.y);
  state.screenShake = 18;
  for (const e of state.enemies) {
    if (!e.active) continue;
    if (e.type === 'boss') {
      e.hp -= e.maxHp * 0.25;
      if (e.hp <= 0) killEnemy(state, e);
    } else {
      e.hp = 0;
      killEnemy(state, e);
    }
  }
  // 清除敌方弹幕
  for (const proj of state.enemyProjectiles) proj.active = false;
}

// ============ 武器开火 ============
function updateWeapons(state: GameState, dt: number) {
  const p = state.player;
  const now = state.gameTime;
  const slotIdx: Record<string, number> = { left_arm: 0, right_arm: 0, back: 0, shoulder: 0, core: 0 };
  for (const w of p.weapons) {
    const wIdx = slotIdx[w.config.slot] || 0;
    // 每个炮塔独立索敌
    const tgt = selectTarget(p, state.enemies, w.config.targeting, w.config.range);
    if (tgt) {
      // 有目标时：炮塔旋转瞄准
      w.targetAngle = angleTo(p.x, p.y, tgt.x, tgt.y);
      // 缓动旋转（角度差取最短路径）
      let diff = w.targetAngle - w.aimAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turnSpeed = 6 + w.level * 0.5;
      const maxTurn = turnSpeed * dt;
      if (Math.abs(diff) <= maxTurn) {
        w.aimAngle = w.targetAngle;
      } else {
        w.aimAngle += Math.sign(diff) * maxTurn;
      }
      // 开火
      const interval = 1 / Math.max(0.01, w.config.fireRate);
      if (now - w.lastFireTime >= interval) {
        w.lastFireTime = now;
        w.fireFlash = 1;
        fireWeaponByType(state, w, wIdx, tgt);
      }
    } else {
      // 无目标时：保持当前朝向，不开火
    }
    // 发射闪光衰减
    if (w.fireFlash > 0) {
      w.fireFlash = Math.max(0, w.fireFlash - dt * 8);
    }
    slotIdx[w.config.slot] = wIdx + 1;
  }
}

function fireWeaponByType(state: GameState, w: WeaponInstance, wIdx: number, tgt: { x: number; y: number }) {
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
      // 在玩家周围布设地雷，数量随等级提升
      const mineCount = 1 + Math.floor(lvl / 1.5);
      for (let i = 0; i < mineCount; i++) {
        const ang = randRange(0, Math.PI * 2);
        const r = randRange(40, 110);
        const mx = p.x + Math.cos(ang) * r;
        const my = p.y + Math.sin(ang) * r;
        state.summons.push(makeSummon('turret', { ...cfg }, lvl, mx, my, true));
        state.lightPillars.push(makeLightPillar(mx, my, cfg.color,
          { baseRadius: 16, beamHeight: 160, ringMax: 70, life: 0.8 }));
      }
      break;
    }
    case 'flamethrower': {
      const baseAngle = angleTo(muzzle.x, muzzle.y, targetX, targetY);
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
        if (diff < 0.35) {
          damageEnemy(state, e, cfg.damage * (1 + (lvl - 1) * 0.3), cfg.color);
        }
      }
      break;
    }
    case 'sword': {
      const baseAngle = angleTo(muzzle.x, muzzle.y, targetX, targetY);
      state.meleeEffects.push({
        x: muzzle.x, y: muzzle.y, angle: baseAngle, arc: Math.PI * 0.75, radius: cfg.range,
        life: 0.18, maxLife: 0.18, active: true, hits: new Set(),
      });
      for (const e of state.enemies) {
        if (!e.active) continue;
        const d = dist(e.x, e.y, muzzle.x, muzzle.y);
        if (d > cfg.range) continue;
        const a = angleTo(muzzle.x, muzzle.y, e.x, e.y);
        let diff = Math.abs(a - baseAngle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < Math.PI * 0.375) {
          damageEnemy(state, e, cfg.damage * (1 + (lvl - 1) * 0.3), cfg.color);
          const kx = normalize(e.x - muzzle.x, e.y - muzzle.y);
          e.x += kx.x * 30;
          e.y += kx.y * 30;
        }
      }
      break;
    }
    case 'turret': {
      // 部署炮塔：定期在玩家附近放置固定炮塔，数量随等级提升
      const existing = state.summons.filter((s) => s.active && s.type === 'turret' && s.weapon.id === 'turret');
      const realTurrets = existing.filter((s) => !s.orbitRadius); // 固定炮塔
      const maxTurrets = Math.min(2 + lvl, 10);
      if (realTurrets.length < maxTurrets) {
        const ang = randRange(0, Math.PI * 2);
        const r = randRange(70, 130);
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
      // 维持 N 个护盾浮游机
      const existing = state.summons.filter((s) => s.active && s.type === 'shield_drone');
      const want = Math.min(2 + lvl, 8);
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
      // 跟随环绕炮塔：维持 N 个
      const existing = state.summons.filter((s) => s.active && s.type === 'auto_turret');
      const want = Math.min(2 + lvl, 8);
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

// ---- 闪电链 ----
function castLightning(state: GameState, cfg: WeaponConfig, lvl: number, ox: number, oy: number) {
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
function castFireWall(state: GameState, cfg: WeaponConfig, lvl: number) {
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
function castIceWall(state: GameState, cfg: WeaponConfig, lvl: number) {
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
function castSkeleton(state: GameState, cfg: WeaponConfig, lvl: number) {
  const p = state.player;
  const existing = state.summons.filter((s) => s.active && s.type === 'skeleton');
  const want = Math.min(2 + lvl * 2, 10);
  if (existing.length >= want) return;
  const ang = randRange(0, Math.PI * 2);
  const r = randRange(40, 80);
  const sx = p.x + Math.cos(ang) * r;
  const sy = p.y + Math.sin(ang) * r;
  const sk = makeSummon('skeleton', { ...cfg }, lvl, sx, sy, false);
  sk.lifetime = 12;
  sk.maxLifetime = 12;
  state.summons.push(sk);
  spawnMagicBurst(sx, sy, cfg.color);
}

// ---- 天罚光束 ----
function castBeamLaser(state: GameState, cfg: WeaponConfig, lvl: number, ox: number, oy: number) {
  // 光束数量随等级提升：3级起2道，5级起3道
  const beamCount = lvl >= 5 ? 3 : lvl >= 3 ? 2 : 1;
  const spreadAngle = 0.25; // 光束间夹角

  // 找一个主目标方向
  const targetId = findNearestEnemyId(ox, oy, state.enemies, cfg.range);
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

// ============ 召唤物 ============
function makeSummon(
  type: SummonType, cfg: WeaponConfig, lvl: number,
  x: number, y: number, isMine: boolean,
): Summon {
  return {
    id: nextId++,
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

function updateSummons(state: GameState, dt: number) {
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

// ============ 投射物 ============
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

function updateProjectiles(state: GameState, dt: number) {
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

function updateEnemyProjectiles(state: GameState, dt: number) {
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

// ============ 敌人 ============
function updateEnemies(state: GameState, dt: number) {
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
      if (e.ringFireTimer === undefined) e.ringFireTimer = 3 + Math.random() * 2;
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
      if (e.bossSkillTimer === undefined) e.bossSkillTimer = 4;
      if (e.bossBombTimer === undefined) e.bossBombTimer = 6;
      if (e.bossChargeState === undefined) e.bossChargeState = 'idle';

      // 技能1：东方Project风格弹幕（多种模式轮替，数量多、速度慢）
      e.bossSkillTimer -= dt;
      if (e.bossSkillTimer <= 0) {
        e.bossSkillTimer = 1.8 + Math.random() * 1.0;
        // 弹幕模式池
        const pattern = Math.floor(Math.random() * 7);
        const baseSpeed = 110; // 弹幕整体偏慢，靠密度压制

        if (pattern === 0) {
          // 模式1：双层环形弹幕（48+36发）
          const count1 = 48;
          const count2 = 36;
          const startAng = Math.random() * Math.PI * 2;
          for (let i = 0; i < count1; i++) {
            const a = startAng + (i / count1) * Math.PI * 2;
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, baseSpeed, 10, '#ff3366'));
          }
          for (let i = 0; i < count2; i++) {
            const a = startAng + Math.PI / count2 + (i / count2) * Math.PI * 2;
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, baseSpeed * 0.7, 8, '#ffaa22'));
          }
        } else if (pattern === 1) {
          // 模式2：扇形弹幕+追踪（大扇形21发+中央瞄准弹）
          const ang = angleTo(e.x, e.y, p.x, p.y);
          const fanCount = 21;
          const fanSpread = Math.PI * 0.8;
          for (let i = 0; i < fanCount; i++) {
            const a = ang - fanSpread / 2 + (i / (fanCount - 1)) * fanSpread;
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, baseSpeed * 0.95, 10, '#cc33ff'));
          }
          // 中央3发快速瞄准弹
          for (let i = -1; i <= 1; i++) {
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, ang + i * 0.08, baseSpeed * 1.4, 12, '#ff0088'));
          }
        } else if (pattern === 2) {
          // 模式3：螺旋弹幕（双螺旋各18发，旋转扩散）
          const spiralCount = 18;
          const spiralAng = Math.random() * Math.PI * 2;
          for (let i = 0; i < spiralCount; i++) {
            const t = i / spiralCount;
            const a1 = spiralAng + t * Math.PI * 2.5;
            const a2 = spiralAng + Math.PI + t * Math.PI * 2.5;
            const spd = baseSpeed * (0.7 + t * 0.6);
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a1, spd, 8, '#6644ff'));
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a2, spd, 8, '#ff44aa'));
          }
        } else if (pattern === 3) {
          // 模式4：圆形散射+随机偏移（模拟乱弹）
          const total = 60;
          for (let i = 0; i < total; i++) {
            const a = (i / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
            const spd = baseSpeed * (0.75 + Math.random() * 0.5);
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, spd, 7, '#ff8800'));
          }
        } else if (pattern === 4) {
          // 模式5：三方向波浪弹（左右中三路，每路扇形，密度高）
          const ang = angleTo(e.x, e.y, p.x, p.y);
          const waveCount = 9;
          for (let w = -1; w <= 1; w++) {
            const baseA = ang + w * 0.55;
            for (let i = 0; i < waveCount; i++) {
              const a = baseA - 0.3 + (i / (waveCount - 1)) * 0.6;
              const spd = baseSpeed * (0.85 + Math.abs(i - (waveCount - 1) / 2) * 0.05);
              state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, spd, 9, '#ffdd33'));
            }
          }
        } else if (pattern === 5) {
          // 模式6：十字+X字弹幕组合（密集激光线）
          const lineCount = 16;
          for (let i = 0; i < lineCount; i++) {
            const t = i / lineCount;
            for (let d = 0; d < 8; d++) {
              const a = (d / 8) * Math.PI * 2 + t * 0.15;
              const spd = baseSpeed * (0.6 + t * 0.5);
              state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, spd, 7, '#33ccff'));
            }
          }
        } else {
          // 模式7：花瓣环形弹幕（6瓣各9发，图案优美）
          const petalCount = 6;
          const perPetal = 9;
          const startAng = Math.random() * Math.PI * 2;
          for (let pt = 0; pt < petalCount; pt++) {
            const centerA = startAng + (pt / petalCount) * Math.PI * 2;
            for (let i = 0; i < perPetal; i++) {
              const a = centerA - 0.25 + (i / (perPetal - 1)) * 0.5;
              const spd = baseSpeed * (0.8 + Math.abs(i - (perPetal - 1) / 2) * 0.08);
              state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, spd, 8, '#ff5599'));
            }
          }
          // 中央6发快弹
          for (let i = 0; i < 6; i++) {
            const a = startAng + (i / 6) * Math.PI * 2;
            state.enemyProjectiles.push(createEnemyProjectile(e.x, e.y, a, baseSpeed * 1.3, 10, '#ffffff'));
          }
        }
        spawnMuzzleFlash(e.x, e.y, 0, '#ff0033');
      }

      // 技能2：定点炸弹
      e.bossBombTimer -= dt;
      if (e.bossBombTimer <= 0) {
        e.bossBombTimer = 7 + Math.random() * 3;
        // 在玩家附近放置3-5个炸弹
        const bombCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < bombCount; i++) {
          const bx = p.x + randRange(-180, 180);
          const by = p.y + randRange(-180, 180);
          state.bossBombs.push({
            x: bx, y: by,
            timer: 2.5, maxTimer: 2.5,
            radius: 80, damage: 25, active: true,
          });
        }
      }

      // 技能3：直线蓄力冲锋
      if (e.bossChargeState === 'idle') {
        if (e.bossChargeTimer === undefined) e.bossChargeTimer = 8;
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
            damagePlayer(state, 30);
          }
        }
        if (e.bossChargeTimer <= 0) {
          e.bossChargeState = 'idle';
          e.bossChargeTimer = 6 + Math.random() * 3;
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

function damagePlayer(state: GameState, dmg: number) {
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

function damageEnemy(state: GameState, e: Enemy, dmg: number, color: string) {
  if (!e.active) return;
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

// 经验掉落分级配置：小怪少小，大怪多大团
function getExpDropConfig(type: EnemyType, totalExp: number): { count: number; perValue: number; perRadius: number } {
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

function killEnemy(state: GameState, e: Enemy) {
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
  const dropCfg = getExpDropConfig(e.type, expVal);
  for (let i = 0; i < dropCfg.count; i++) {
    const ang = (i / dropCfg.count) * Math.PI * 2 + randRange(-0.3, 0.3);
    const r = randRange(0, e.radius * 0.8);
    const px = e.x + Math.cos(ang) * r;
    const py = e.y + Math.sin(ang) * r;
    const spd = randRange(30, 80);
    state.pickups.push({
      id: nextId++, x: px, y: py,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      radius: dropCfg.perRadius, hp: 1, maxHp: 1, active: true,
      type: 'exp', value: dropCfg.perValue, magnetTarget: null,
    });
  }

  // 生命掉落（大怪更大概率）
  const healChance = e.type === 'boss' ? 1.0 : e.isElite || e.type === 'elite' ? 0.35 : 0.04;
  if (Math.random() < healChance) {
    state.pickups.push({
      id: nextId++, x: e.x, y: e.y, vx: 0, vy: 0,
      radius: 11, hp: 1, maxHp: 1, active: true,
      type: 'health', value: 20, magnetTarget: null,
    });
  }

  // 精英/Boss 必掉特殊拾取物
  if (e.isElite || e.type === 'elite' || e.type === 'boss') {
    const dropType: PickupType = randPick(['bomb', 'vacuum', 'shield_pickup', 'screen_clear'] as const);
    state.pickups.push({
      id: nextId++, x: e.x, y: e.y, vx: 0, vy: 0,
      radius: 15, hp: 1, maxHp: 1, active: true,
      type: dropType, value: 0, magnetTarget: null,
    });
  }

  // 吸血被动
  if (state.player.upgrades.includes('vampirism')) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 3);
  }
}

// ============ 拾取物 ============
function updatePickups(state: GameState, dt: number) {
  const p = state.player;
  for (const pk of state.pickups) {
    if (!pk.active) continue;
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

function applyPickup(state: GameState, pk: Pickup) {
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

// ============ 魔法效果更新 ============
function updateMagicEffects(state: GameState, dt: number) {
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

function updateMeleeAndFlame(state: GameState, dt: number) {
  for (const m of state.meleeEffects) {
    if (!m.active) continue;
    m.life -= dt;
    if (m.life <= 0) m.active = false;
  }
  state.meleeEffects = state.meleeEffects.filter((m) => m.active);
  for (const f of state.flameEffects) {
    if (!f.active) continue;
    f.life -= dt;
    if (f.life <= 0) f.active = false;
  }
  state.flameEffects = state.flameEffects.filter((f) => f.active);
}

// ============ 敌人生成（动态控制版） ============
function updateSpawning(state: GameState, dt: number) {
  const p = state.player;
  const wave = state.wave;

  // 1) 更新清怪速率（每 3 秒统计一次，外推到每分钟）
  state.killRateTimer -= dt;
  if (state.killRateTimer <= 0) {
    state.killRateTimer = 3;
    // killsRecent 是过去 3 秒的击杀数
    state.killRatePerMin = (state.killsRecent / 3) * 60;
    state.killsRecent = 0;
  }

  // 2) 动态上限：基于玩家成长度，严格控制（小怪数量翻倍）
  //    基础 140，每级成长 +12，最高 260
  const growth = calcPlayerPower(p);
  state.enemyCap = Math.min(260, 140 + Math.floor(growth * 12));

  // 3) 动态经验系数：场上怪物多/清怪快时降低单个经验，避免频繁升级暂停
  //    目标：让玩家大约每 12-18 秒升一级
  const liveEnemies = state.enemies.filter((e) => e.active).length;
  const densityRatio = liveEnemies / state.enemyCap;
  const killRate = state.killRatePerMin;
  // 清怪越快、场上越多 → 经验越低；反之提升
  let targetExp = 1.0;
  if (killRate > 60) targetExp -= (killRate - 60) / 200; // 清得快降经验
  if (densityRatio > 0.7) targetExp -= (densityRatio - 0.7) * 0.8; // 场上太挤降经验
  if (densityRatio < 0.3 && killRate < 40) targetExp += 0.3; // 怪少且清得慢，加经验
  targetExp = clamp(targetExp, 0.45, 1.4);
  // 平滑过渡
  state.dynamicExpMult += (targetExp - state.dynamicExpMult) * Math.min(1, dt * 0.5);

  // 4) 持续刷新：少量基础敌人持续涌入（填补清怪空白，保持节奏感）— 小怪数量翻倍
  state.continuousSpawnTimer -= dt;
  if (state.continuousSpawnTimer <= 0) {
    // 间隔：场上越满越慢；整体频率提高
    const interval = clamp(1.0 - growth * 0.05, 0.3, 1.0) * (0.4 + densityRatio * 0.8);
    state.continuousSpawnTimer = interval;
    if (liveEnemies < state.enemyCap) {
      const pool: EnemyType[] = ['basic'];
      if (wave >= 2) pool.push('fast');
      if (wave >= 4) pool.push('basic', 'fast', 'splitter');
      if (wave >= 6) pool.push('tank');
      if (wave >= 9) pool.push('bruiser');
      const count = 2 + (Math.random() < 0.4 ? 2 : 0);
      for (let i = 0; i < count && liveEnemies + i < state.enemyCap; i++) {
        spawnEnemy(state, randPick(pool));
      }
    }
  }

  // 5) 群组波次刷新：每 3-6 秒生成 6-10 只成群敌人（从同一方向涌入）— 小怪数量翻倍
  state.groupSpawnTimer -= dt;
  if (state.groupSpawnTimer <= 0) {
    state.groupSpawnTimer = randRange(3, 6);
    if (liveEnemies < state.enemyCap - 12) {
      const pool: EnemyType[] = ['basic', 'fast'];
      if (wave >= 3) pool.push('shooter');
      if (wave >= 5) pool.push('tank', 'shotgunner', 'splitter');
      if (wave >= 8) pool.push('sniper', 'bruiser');
      const groupSize = Math.min(state.enemyCap - liveEnemies, randInt(6, 10));
      // 同一方向
      const groupAng = randRange(0, Math.PI * 2);
      for (let i = 0; i < groupSize; i++) {
        spawnEnemyAt(state, randPick(pool), groupAng, i * 0.1);
      }
    }
  }

  // 6) 精英怪刷新：每 18-28 秒生成一只精英（带多炮台）
  state.eliteSpawnTimer -= dt;
  if (state.eliteSpawnTimer <= 0) {
    state.eliteSpawnTimer = randRange(18, 28);
    if (wave >= 4 && liveEnemies < state.enemyCap) {
      const eliteTypes: EnemyType[] = ['elite_brute', 'elite_gunner', 'elite_bomber'];
      spawnEnemy(state, randPick(eliteTypes));
    }
  }

  // 7) 大波次推进：waveTimer 用于推进波次等级（影响怪物属性），不再一次性刷大量怪
  state.waveTimer -= dt;
  if (state.waveTimer <= 0) {
    state.wave += 1;
    // 波次间隔随成长缩短
    state.waveTimer = Math.max(6, 16 - growth * 0.8);
    // Boss 每 10 波
    if (state.wave % 10 === 0) {
      state.bossSpawnCount = (state.bossSpawnCount || 0) + 1;
      spawnEnemy(state, 'boss');
    }
  }
}

function calcPlayerPower(p: Player): number {
  // 综合玩家等级、武器数量、武器等级，得到成长系数
  let power = p.level * 0.3;
  for (const w of p.weapons) {
    power += w.level * 0.5;
  }
  return Math.min(8, power);
}

// 在玩家视野外随机方向生成
function spawnEnemy(state: GameState, type: EnemyType) {
  const ang = randRange(0, Math.PI * 2);
  spawnEnemyAt(state, type, ang, 0);
}

// 在指定方向生成（用于群组）
function spawnEnemyAt(state: GameState, type: EnemyType, baseAng: number, angJitter: number) {
  const p = state.player;
  const ang = baseAng + randRange(-0.3, 0.3) + angJitter;
  const r = randRange(560, 820);
  const x = clamp(p.x + Math.cos(ang) * r, 30, state.mapWidth - 30);
  const y = clamp(p.y + Math.sin(ang) * r, 30, state.mapHeight - 30);
  const e = createEnemyAt(state, type, x, y);
  if (e) state.enemies.push(e);
}

// 在指定坐标创建敌人（用于分裂等），返回敌人对象
function createEnemyAt(state: GameState, type: EnemyType, x: number, y: number): Enemy | null {
  const wave = state.wave;

  const configs: Record<EnemyType, { hp: number; speed: number; damage: number; exp: number; radius: number; color: string; ranged: boolean; prefDist: number; projSpeed: number; projDmg: number; atkCd: number }> = {
    basic:        { hp: 40 + wave * 6,     speed: 70 + wave * 1.2,   damage: 6 + wave * 0.4,   exp: 4,  radius: 16, color: '#991b1b', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 1.0 },
    fast:         { hp: 28 + wave * 4,     speed: 130 + wave * 1.8,  damage: 5 + wave * 0.3,   exp: 5,  radius: 12, color: '#7f1d1d', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 0.8 },
    tank:         { hp: 180 + wave * 20,   speed: 38 + wave * 0.4,   damage: 12 + wave * 0.6,  exp: 14, radius: 30, color: '#5b21b6', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 1.5 },
    bruiser:      { hp: 320 + wave * 32,   speed: 30 + wave * 0.3,   damage: 18 + wave * 0.7,  exp: 22, radius: 34, color: '#4c1d95', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 1.8 },
    splitter:     { hp: 100 + wave * 12,   speed: 55 + wave * 0.8,   damage: 8 + wave * 0.4,   exp: 12, radius: 20, color: '#6d28d9', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 1.2 },
    splitter_small:{ hp: 35 + wave * 5,    speed: 95 + wave * 1.2,   damage: 4 + wave * 0.2,   exp: 3,  radius: 11, color: '#7c3aed', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 0.9 },
    elite:        { hp: 420 + wave * 42,   speed: 65 + wave * 0.8,   damage: 14 + wave * 0.5,  exp: 30, radius: 26, color: '#881337', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 1.2 },
    boss:         { hp: 1600 + wave * 140 + (state.bossSpawnCount || 0) * 1200,   speed: 50 + wave * 0.3,   damage: 22 + wave * 0.8 + (state.bossSpawnCount || 0) * 8,  exp: 100, radius: 88, color: '#7f1d1d', ranged: false, prefDist: 0,   projSpeed: 0,   projDmg: 0,                 atkCd: 1.5 },
    shooter:      { hp: 45 + wave * 5,     speed: 55 + wave * 0.8,   damage: 4 + wave * 0.2,   exp: 10, radius: 14, color: '#7c3aed', ranged: true,  prefDist: 280, projSpeed: 200, projDmg: 3 + wave * 0.3,    atkCd: 2.5 },
    sniper:       { hp: 55 + wave * 6,     speed: 42 + wave * 0.3,   damage: 6 + wave * 0.3,   exp: 15, radius: 13, color: '#be123c', ranged: true,  prefDist: 480, projSpeed: 420, projDmg: 8 + wave * 0.5,    atkCd: 4.5 },
    shotgunner:   { hp: 65 + wave * 7,     speed: 50 + wave * 0.6,   damage: 5 + wave * 0.2,   exp: 12, radius: 15, color: '#991b1b', ranged: true,  prefDist: 200, projSpeed: 180, projDmg: 2 + wave * 0.2,    atkCd: 3.5 },
    // --- 精英怪（复杂形态 + 多炮台） ---
    elite_brute:  { hp: 750 + wave * 67.5,   speed: 48 + wave * 0.4,   damage: 20 + wave * 0.6,  exp: 50, radius: 52, color: '#6b21a8', ranged: true,  prefDist: 220, projSpeed: 312, projDmg: 7.8 + wave * 0.52,    atkCd: 1.6 },
    elite_gunner: { hp: 570 + wave * 57,   speed: 58 + wave * 0.5,   damage: 16 + wave * 0.5,  exp: 48, radius: 48, color: '#5b21b6', ranged: true,  prefDist: 320, projSpeed: 416, projDmg: 6.5 + wave * 0.39,    atkCd: 1.2 },
    elite_bomber: { hp: 510 + wave * 51,   speed: 75 + wave * 0.7,   damage: 18 + wave * 0.4,  exp: 45, radius: 46, color: '#831843', ranged: true,  prefDist: 180, projSpeed: 260, projDmg: 10.4 + wave * 0.52,    atkCd: 2.0 },
  };
  const c = configs[type];

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
    id: nextId++,
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

// ============ 摄像机 ============
function updateCamera(state: GameState, dt: number, canvasW: number, canvasH: number) {
  state.camera.targetX = state.player.x;
  state.camera.targetY = state.player.y;
  state.camera.x += (state.camera.targetX - state.camera.x) * Math.min(1, dt * 8);
  state.camera.y += (state.camera.targetY - state.camera.y) * Math.min(1, dt * 8);
}

// ============ 连击 ============
let comboTimer = 0;
function updateCombo(state: GameState, dt: number) {
  if (state.combo > 0) {
    comboTimer += dt;
    if (comboTimer > 3) {
      state.combo = 0;
      comboTimer = 0;
    }
  } else {
    comboTimer = 0;
  }
}

// ============ 升级 ============
function checkLevelUp(state: GameState) {
  const p = state.player;
  while (p.exp >= p.maxExp) {
    p.exp -= p.maxExp;
    p.level += 1;
    p.maxExp = Math.floor(p.maxExp * 1.25) + 8;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.1);
    // 升级提升拾取范围和吸力
    p.pickupRadius += 12;
    state.showUpgrade = true;
    state.upgradeOptions = generateUpgradeOptions(p);
    // 升级视觉特效：金色爆发 + 闪光 + 冲击波
    spawnMagicBurst(p.x, p.y, '#ffdd44');
    spawnScreenFlash(p.x, p.y);
    spawnParticles(p.x, p.y, 20, ['#ffdd44', '#ffaa00', '#ffffff', '#ffee88'], 80, 300, 2, 7, 0.3, 0.6);
    state.screenShake = Math.max(state.screenShake, 6);
    break; // 一次只触发一次升级面板
  }
}

export function applyUpgrade(state: GameState, idx: number) {
  const opt = state.upgradeOptions[idx];
  if (!opt) return;
  const p = state.player;
  // 记录升级前各武器等级，用于检测哪把武器升级并定位其炮塔
  const before = new Map<string, number>();
  for (const w of p.weapons) before.set(w.config.id, w.level);

  opt.apply(p);
  p.upgrades.push(opt.id);
  state.showUpgrade = false;
  state.upgradeOptions = [];
  // 选择升级后的确认特效
  spawnMagicBurst(p.x, p.y, '#44ff88');
  spawnParticles(p.x, p.y, 15, ['#44ff88', '#88ffaa', '#ffffff'], 60, 200, 1.5, 5, 0.2, 0.4);

  // 武器升级：在对应炮塔位置发出冲天光柱
  if (opt.type === 'weapon' && opt.id.startsWith('unlock_')) {
    const wid = opt.id.replace('unlock_', '');
    const w = p.weapons.find((ww) => ww.config.id === wid);
    if (w && before.get(wid) !== w.level) {
      // 计算该武器在其 slot 中的序号
      let wIdx = 0;
      for (const ww of p.weapons) {
        if (ww.config.slot === w.config.slot) {
          if (ww === w) break;
          wIdx++;
        }
      }
      const muzzle = getWeaponMuzzleWorld(p, w, wIdx);
      const color = w.config.color;
      state.lightPillars.push(makeLightPillar(muzzle.x, muzzle.y, color, {
        baseRadius: 18, beamHeight: 200, ringMax: 120, life: 1.3,
      }));
      spawnLightPillarBurst(muzzle.x, muzzle.y, color);
    }
  }
}
