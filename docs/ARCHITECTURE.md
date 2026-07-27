# 绿坎大战马勒戈壁 —— 游戏架构说明

本文档描述当前游戏项目的模块化结构、运行流程以及后续扩展时应当遵循的分层原则。

## 1. 项目定位

- 引擎：基于 HTML5 Canvas 2D 的即时动作游戏循环。
- 框架：React 仅负责菜单、HUD、升级面板等 UI 层；核心战斗逻辑全部位于 `src/game/`。
- 构建：Vite + TypeScript，入口为 `src/main.tsx`。

## 2. 目录结构

```text
src/game/
  core/              # 全局核心：循环、状态、输入、相机、生成、难度、升级
    loop.ts          # updateGame：每帧调度各模块更新
    state.ts         # createGameState：初始化一局游戏
    input.ts         # 键盘 / 鼠标 / 触摸输入绑定
    constants.ts     # 全局常量（CD、地图尺寸、炮塔参数等）
    camera.ts        # 相机跟随与抖动
    spawning.ts      # 敌人生成逻辑
    difficulty.ts    # 动态难度与玩家强度评估
    upgrade.ts       # 等级提升与开局强化
    combo.ts         # 连击统计
    id.ts            # 全局唯一 ID 生成器
  entities/          # 游戏实体：玩家、敌人、召唤物、投射物、拾取物、地形
    player.ts
    enemy.ts
    summon.ts
    projectile.ts
    pickup.ts
    terrain.ts
  weapons/           # 武器系统
    core.ts          # WeaponConfig、投射物创建、目标选择
    behaviors.ts     # 各类武器的具体开火行为
    index.ts         # 聚合导出 + updateWeapons 主调度
  skills/            # 技能系统
    active.ts        # 主动技能（1/2/3/4 键）
    passive.ts       # 被动效果（生命恢复、吸血等）
  effects/           # 视觉/逻辑特效
    magic.ts         # 闪电、火墙、冰墙、召唤、光束
    melee.ts         # 近战与火焰喷射器命中判定
    index.ts         # 特效聚合导出
  rendering/         # 渲染系统
    game.ts          # renderGame：主渲染管线
    entities/        # 各实体绘制
    layers/          # 地面、特效、UI 层
  particles.ts       # 粒子系统
  math.ts            # 数学/几何工具
  types.ts           # 全局类型定义
  upgrades.ts        # 升级选项生成
  engine.ts          # 薄门面：供 React 页面调用
  renderer.ts        # 薄门面：供 React 页面调用
  weapons.ts         # 薄门面：供 React 页面调用
```

## 3. 运行时数据流

### 3.1 启动流程

1. `pages/Game.tsx` 调用 `createGameState(startWeapon)`。
2. `createGameState` 生成地图、玩家、初始武器，初始化粒子系统。
3. `bindInput(canvas)` 绑定输入事件。
4. `requestAnimationFrame` 启动主循环。

### 3.2 每帧更新流程

```text
pages/Game.tsx loop
  └─ updateGame(state, dt, canvasW, canvasH)     [core/loop.ts]
      ├─ 同步输入到 state
      ├─ 死亡动画分支
      ├─ updatePlayer(state, dt)                 [entities/player.ts]
      ├─ updateSkills(state, dt)                 [skills/active.ts]
      ├─ updateWeapons(state, dt)                [weapons/index.ts]
      │   └─ fireWeaponByType(...)               [weapons/behaviors.ts]
      ├─ updateProjectiles(state, dt)            [entities/projectile.ts]
      ├─ updateEnemyProjectiles(state, dt)       [entities/projectile.ts]
      ├─ updateEnemies(state, dt)                [entities/enemy.ts]
      ├─ updateSummons(state, dt)                [entities/summon.ts]
      ├─ updatePickups(state, dt)                [entities/pickup.ts]
      ├─ updateMagicEffects(state, dt)           [effects/magic.ts]
      ├─ updateMeleeAndFlame(state, dt)          [effects/melee.ts]
      ├─ updateParticles(dt)                     [particles.ts]
      ├─ updateSpawning(state, dt)               [core/spawning.ts]
      ├─ updateCamera(state, dt, ...)            [core/camera.ts]
      ├─ updateCombo(state, dt)                  [core/combo.ts]
      └─ checkLevelUp(state)                     [core/upgrade.ts]
```

### 3.3 每帧渲染流程

```text
renderGame(ctx, state, canvasW, canvasH)       [rendering/game.ts]
  ├─ drawGround                                [layers/ground.ts]
  ├─ drawTerrains                              [rendering/entities/terrain.ts]
  ├─ drawIceWalls / drawFireWalls              [layers/effects.ts]
  ├─ drawPickups                               [rendering/entities/pickup.ts]
  ├─ drawSummons                               [rendering/entities/summon.ts]
  ├─ drawEnemies                               [rendering/entities/enemy.ts]
  ├─ drawEnemyProjectiles                      [rendering/entities/projectile.ts]
  ├─ drawPlayer                                [rendering/entities/player.ts]
  ├─ drawProjectiles                           [rendering/entities/projectile.ts]
  ├─ drawMeleeEffects / drawFlameEffects       [layers/effects.ts]
  ├─ drawBeamLasers / drawBossBombs            [layers/effects.ts]
  ├─ drawLightning / drawLightPillars          [layers/effects.ts]
  ├─ drawParticles                             [layers/effects.ts]
  ├─ drawMapBorder                             [rendering/game.ts]
  ├─ drawMinimap / drawOffscreenIndicators     [layers/ui.ts]
  └─ drawTouchJoystick                         [layers/ui.ts]
```

## 4. 扩展点

### 4.1 新增怪物种类

1. 在 `src/game/types.ts` 的 `EnemyType` 中加入新类型。
2. 在 `src/game/entities/enemy.ts` 的 `createEnemyAt` 中补充属性。
3. 在 `updateEnemies` 中添加该怪物的 AI/攻击行为（可拆成独立函数）。
4. 在 `src/game/rendering/entities/enemy.ts` 中补充绘制。
5. 在 `src/game/core/spawning.ts` 的生成池中加入该类型。

### 4.2 新增怪物攻击方式

- 若攻击产生投射物：使用 `createEnemyProjectile` 创建并推入 `state.enemyProjectiles`。
- 若攻击为近战/范围：在 `updateEnemies` 中直接做命中判定，并调用 `damagePlayer`。
- 若攻击需要蓄力/提示：通过敌人状态字段（如 `bossChargeState`）驱动，并在渲染层绘制预警。

### 4.3 新增场内/场外技能

- 主动技能：扩展 `skills/active.ts`，监听 `input.skillN`，调用 `screenClear` 类似函数。
- 被动技能：扩展 `skills/passive.ts`，在 `updatePlayer` 中调用。
- 召唤物：通过 `makeSummon` 创建并加入 `state.summons`，在 `updateSummons` 中处理行为。

### 4.4 新增武器

1. 在 `src/game/types.ts` 的 `WeaponType` 和 `WeaponCategory` 中加入新类型。
2. 在 `src/game/weapons/core.ts` 的 `WEAPON_CONFIGS` 中注册配置。
3. 在 `src/game/weapons/behaviors.ts` 的 `fireWeaponByType` 中实现开火逻辑。
4. 若需要新的投射物表现：在 `createProjectile` 中处理或新增类型分支。
5. 在 `src/game/rendering/entities/projectile.ts` 中补充绘制。

### 4.5 新增单位模型（图片序列帧 / CSS 绘制）

- CSS 绘制单位：保持当前做法，在对应 `rendering/entities/*.ts` 中使用 Canvas API 绘制。
- 图片序列帧单位：
  1. 将序列帧放入 `public/` 或 `src/assets/`。
  2. 在实体类型中增加 `spriteSheet`、`spriteFrame`、`spriteTimer` 字段。
  3. 在渲染函数中通过 `ctx.drawImage` 按帧切换绘制。
  4. 加载逻辑建议集中到 `src/game/rendering/sprites.ts`（如未来需要）。

### 4.6 新增关卡/地图

1. 地图尺寸：修改 `src/game/core/constants.ts` 的 `MAP_WIDTH` / `MAP_HEIGHT`。
2. 地形生成：修改 `src/game/entities/terrain.ts` 的 `generateTerrains`，可拆分为多个 `makeXXXBiome` 函数。
3. 关卡规则：在 `core/spawning.ts` 或 `core/difficulty.ts` 中按波次/地图类型切换生成池与倍率。

## 5. 依赖原则

- `core` 可以依赖 `entities`、`weapons`、`effects`、`particles`、`math`。
- `entities` 之间允许互相依赖，但优先通过参数传递而非直接读取全局状态。
- `weapons` 可以依赖 `entities` 和 `effects`。
- `effects` 可以依赖 `entities` 和 `particles`。
- `rendering` 只读取 `state`，不修改 `state`。
- 禁止 `rendering` 导入 `core/loop.ts`、`core/state.ts` 等更新逻辑。

## 6. 门面文件说明

`engine.ts`、`renderer.ts`、`weapons.ts` 目前作为薄门面存在，供 React 页面直接导入。若后续需要进一步清理导入路径，可删除门面文件并同步修改 `pages/Game.tsx` 等调用方；在删除前应保持门面导出稳定。
