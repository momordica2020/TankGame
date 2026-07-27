# 绿坎大战马勒戈壁 —— 扩展代码模板

本文件提供常见扩展场景的代码模板，复制到对应位置后按需填写即可。

---

## 模板 1：新增怪物

### 1.1 类型声明（types.ts）

```ts
export type EnemyType = 'basic' | ... | 'my_enemy';

export interface Enemy extends Entity {
  // ... 已有字段
  mySpecialTimer?: number;
}
```

### 1.2 工厂与更新（entities/enemy.ts）

```ts
export function createEnemyAt(
  state: GameState, type: EnemyType, x: number, y: number,
  angleOffset = 0, groupDelay = 0,
): Enemy {
  // ... 已有 switch
  if (type === 'my_enemy') {
    return {
      id: getNextId(),
      x, y, vx: 0, vy: 0,
      radius: 22,
      hp: 80 * mult, maxHp: 80 * mult, active: true,
      type,
      speed: 170,
      damage: 18,
      isElite: false,
      expValue: 8,
      flashTimer: 0,
      spawnAnim: 0.4,
      mySpecialTimer: 2 + Math.random(),
      turrets: [],
      projectileSpeed: 0,
      projectileDamage: 0,
    };
  }
  // ...
}
```

### 1.3 行为更新

在 `updateEnemies` 中加入分支：

```ts
if (e.type === 'my_enemy') {
  e.mySpecialTimer -= dt;
  if (e.mySpecialTimer <= 0) {
    e.mySpecialTimer = 2 + Math.random();
    // 例如：向玩家冲刺
    const a = angleTo(e.x, e.y, p.x, p.y);
    e.vx += Math.cos(a) * 300;
    e.vy += Math.sin(a) * 300;
  }
}
```

### 1.4 渲染（rendering/entities/enemy.ts）

```ts
// 在 drawEnemies 的通用绘制逻辑附近加入
if (e.type === 'my_enemy') {
  ctx.fillStyle = '#ff88aa';
  ctx.beginPath();
  ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
}
```

### 1.5 加入生成池（core/spawning.ts）

```ts
if (wave >= 5) pool.push('my_enemy');
```

---

## 模板 2：新增武器

### 2.1 类型声明（types.ts）

```ts
export type WeaponType = ... | 'my_weapon';
export type WeaponCategory = ... | 'special';
```

### 2.2 配置注册（weapons/core.ts）

```ts
my_weapon: {
  id: 'my_weapon', name: '我的武器', category: 'special',
  damage: 25, fireRate: 2, range: 500, piercing: 2, projectileCount: 1,
  projectileSpeed: 600, spreadAngle: 0.1, cooldown: 0, color: '#ff66cc',
  description: '自定义武器描述',
  targeting: 'nearest', slot: 'back',
},
```

### 2.3 开火行为（weapons/behaviors.ts）

```ts
case 'my_weapon': {
  const projs = fireWeapon(p, cfg, lvl, targetX, targetY, muzzle.x, muzzle.y);
  for (const pr of projs) {
    // 自定义附加属性
    pr.damage *= 1.5;
    state.projectiles.push(pr);
    spawnMuzzleFlash(pr.x, pr.y, pr.angle, cfg.color);
  }
  break;
}
```

### 2.4 投射物渲染（rendering/entities/projectile.ts）

```ts
if (pr.type === 'my_weapon') {
  ctx.fillStyle = pr.color;
  ctx.beginPath();
  ctx.arc(0, 0, pr.size, 0, Math.PI * 2);
  ctx.fill();
}
```

---

## 模板 3：新增主动技能

### 3.1 类型与常量（core/constants.ts）

```ts
export const SKILL_CD = { ..., my_skill: 20 } as const;
export const SKILL_DURATION = { ..., my_skill: 5 } as const;
```

### 3.2 输入绑定（core/input.ts）

在 `input` 对象与 `bindInput` 中新增 `skill5` 键位监听（若需要）。

### 3.3 技能实现（skills/active.ts）

```ts
import { SKILL_CD, SKILL_DURATION } from '../core/constants';

export function updateSkills(state: GameState, dt: number) {
  // ... 已有技能
  if (input.skill5) {
    input.skill5 = false;
    if ((p.timers.my_skill || 0) <= 0) {
      p.timers.my_skill = SKILL_CD.my_skill;
      castMySkill(state);
    }
  }
}

function castMySkill(state: GameState) {
  const p = state.player;
  spawnMagicBurst(p.x, p.y, '#ff66cc');
  // 例如：击退周围敌人
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = dist(e.x, e.y, p.x, p.y);
    if (d < 300) {
      const k = normalize(e.x - p.x, e.y - p.y);
      e.vx += k.x * 400;
      e.vy += k.y * 400;
    }
  }
}
```

---

## 模板 4：新增召唤物

### 4.1 类型声明（types.ts）

```ts
export type SummonType = 'turret' | ... | 'my_pet';
```

### 4.2 工厂与更新（entities/summon.ts）

```ts
export function makeSummon(type: SummonType, cfg: WeaponConfig, lvl: number, x: number, y: number, isMine: boolean): Summon {
  // ... 已有分支
  if (type === 'my_pet') {
    return {
      id: getNextId(),
      x, y, vx: 0, vy: 0,
      radius: 14 + lvl * 1.5,
      hp: 60 + lvl * 20, maxHp: 60 + lvl * 20, active: true,
      type, weapon: cfg, level: lvl,
      lastFireTime: 0, angle: 0,
      orbitRadius: 90, orbitSpeed: 2,
      lifetime: 9999, maxLifetime: 9999,
      deployX: x, deployY: y,
      tauntRadius: 0,
    };
  }
}

export function updateSummons(state: GameState, dt: number) {
  // ... 已有分支
  if (s.type === 'my_pet') {
    // 环绕玩家
    s.orbitRadius = 90 + s.level * 5;
    const ang = state.gameTime * s.orbitSpeed + s.id;
    s.x = p.x + Math.cos(ang) * s.orbitRadius;
    s.y = p.y + Math.sin(ang) * s.orbitRadius;
    // 自动射击
    const targetId = findNearestEnemyId(s.x, s.y, state.enemies, s.weapon.range);
    if (targetId !== null) {
      const e = state.enemies.find((en) => en.id === targetId);
      if (e) {
        const ang = angleTo(s.x, s.y, e.x, e.y);
        if (now - s.lastFireTime >= 1 / s.weapon.fireRate) {
          s.lastFireTime = now;
          state.projectiles.push(createProjectile(s.x, s.y, ang, s.weapon, s.level));
          spawnMuzzleFlash(s.x, s.y, ang, s.weapon.color);
        }
      }
    }
  }
}
```

### 4.3 渲染（rendering/entities/summon.ts）

在 `drawSummons` 中增加 `s.type === 'my_pet'` 分支。

---

## 模板 5：新增地图生态

### 5.1 地形生成（entities/terrain.ts）

```ts
export function generateTerrains(mapW: number, mapH: number): Terrain[] {
  const terrains: Terrain[] = [];
  makeSoftRockBiome(terrains, mapW, mapH);
  makeHardRockBiome(terrains, mapW, mapH);
  makeMyBiome(terrains, mapW, mapH);
  return terrains;
}

function makeMyBiome(terrains: Terrain[], mapW: number, mapH: number) {
  for (let i = 0; i < 10; i++) {
    const w = randRange(40, 90);
    const h = randRange(40, 90);
    const x = randRange(100, mapW - 100 - w);
    const y = randRange(100, mapH - 100 - h);
    const avgR = Math.min(w, h) * 0.5;
    const vertices = makeIrregularPoly(6, avgR, 0.25);
    terrains.push({
      id: getNextId(), type: 'obstacle', variant: 'my_rock',
      x: x + w / 2, y: y + h / 2,
      width: w, height: h,
      hp: 100, maxHp: 100, destructible: true, vertices,
    });
  }
}
```

### 5.2 渲染（rendering/entities/terrain.ts）

在 `drawTerrains` 中按 `variant` 分支绘制不同颜色/形状。

---

## 模板 6：新增图片序列帧单位

### 6.1 类型声明（types.ts）

```ts
export interface Enemy extends Entity {
  // ... 已有字段
  spriteSheet?: HTMLImageElement;
  spriteFrame?: number;
  spriteTimer?: number;
  spriteFrameCount?: number;
}
```

### 6.2 资源加载

在 `core/state.ts` 或 `rendering/sprites.ts` 中：

```ts
const img = new Image();
img.src = '/sprites/my_unit.png';
```

### 6.3 渲染

```ts
if (e.spriteSheet && e.spriteSheet.complete) {
  const frameW = e.spriteSheet.width / e.spriteFrameCount!;
  const fx = Math.floor(e.spriteFrame || 0) * frameW;
  ctx.drawImage(
    e.spriteSheet,
    fx, 0, frameW, e.spriteSheet.height,
    -e.radius, -e.radius, e.radius * 2, e.radius * 2,
  );
} else {
  // 兜底：CSS 风格绘制
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
  ctx.fill();
}
```

---

## 模板 7：新增 UI 渲染层

### 7.1 新建文件（rendering/layers/my_ui.ts）

```ts
import type { GameState } from '../../types';

export function drawMyUi(ctx: CanvasRenderingContext2D, state: GameState, canvasW: number, canvasH: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`波次：${state.wave}`, 20, 40);
  ctx.restore();
}
```

### 7.2 注册到渲染管线（rendering/game.ts）

```ts
import { drawMyUi } from './layers/my_ui';

// 在 renderGame 末尾调用
drawMyUi(ctx, state, canvasW, canvasH);
```
