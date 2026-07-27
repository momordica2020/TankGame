# 绿坎大战马勒戈壁 —— 代码维护规范

本规范面向后续继续开发本游戏的开发者或其他 Agent，确保扩展时保持代码可维护、功能稳定、风格一致。

## 1. 语言与代码风格

### 1.1 中文纯洁性

- 业务代码（变量名、函数名、注释、字符串常量）优先使用中文语义命名。
- 避免在核心游戏逻辑中混入英文符号：箭头函数仍使用 `=>`，但原始代码中的中文关键字、中文注释应保持不变。
- 用户界面文本、武器/技能/怪物名称使用中文。

### 1.2 命名约定

| 对象 | 约定 | 示例 |
|------|------|------|
| 文件/模块 | 小写 + 下划线 | `enemy.ts`、`beam_laser.ts` |
| 类型/接口 | PascalCase | `Enemy`、`WeaponConfig` |
| 枚举联合类型 | 小写 + 下划线 | `'elite_brute'`、`'fire_wall'` |
| 函数 | camelCase，动词开头 | `updateEnemies`、`damagePlayer` |
| 常量 | 全大写 + 下划线 | `MAP_WIDTH`、`TURRET_MAX_COUNT` |
| 布尔/状态字段 | 语义明确 | `active`、`isElite`、`shieldTimer` |

## 2. 导入规范

### 2.1 导入顺序

每个模块文件按以下顺序排列导入：

1. `type { ... } from '../types'` 类型导入。
2. 同级或子模块导入（`./xxx`）。
3. 父级/其他模块导入（`../xxx`）。
4. 工具模块导入（`../math`、`../particles` 等）。

示例：

```ts
import type { GameState, Enemy } from '../types';
import { getNextId } from '../core/id';
import { dist, angleTo } from '../math';
import { spawnBlood } from '../particles';
import { createEnemyProjectile } from '../weapons';
import { damagePlayer } from './player';
```

### 2.2 避免循环依赖

- 禁止 `entities/player.ts` 与 `entities/enemy.ts` 互相直接导入。
- 若出现共用逻辑，将其下沉到 `math.ts`、新工具模块，或通过 `state` 参数传递所需数据。
- 引入新依赖前，使用 `npm run check` 检查是否产生循环依赖报错。

### 2.3 门面文件使用

- React 页面统一通过 `engine.ts`、`renderer.ts`、`weapons.ts` 导入核心 API。
- 内部模块之间直接导入具体子模块，避免再次经过门面。

## 3. 状态管理

- 所有可变游戏状态集中在 `GameState`（`src/game/types.ts`）。
- 禁止在模块外部使用闭包状态存储游戏运行时数据（输入、粒子池除外）。
- 新增实体或效果时，必须同步：
  1. 在 `GameState` 中增加对应数组/字段。
  2. 在 `createGameState` 中初始化。
  3. 在 `updateGame` 中调度更新。
  4. 在 `renderGame` 中调度渲染。

## 4. 新增内容的标准流程

### 4.1 新增实体（敌人/召唤物/投射物/拾取物）

1. 类型：在 `types.ts` 补充接口与类型联合。
2. 工厂函数：在对应 `entities/*.ts` 中提供 `makeXxx`。
3. 更新：在该模块提供 `updateXxx(state, dt)` 或复用已有的 `updateXxxs`。
4. 渲染：在 `rendering/entities/*.ts` 中提供 `drawXxx`。
5. 注册：在 `core/loop.ts` 和 `rendering/game.ts` 中调用。

### 4.2 新增武器

1. `types.ts` 扩展 `WeaponType` / `WeaponCategory`。
2. `weapons/core.ts` 的 `WEAPON_CONFIGS` 中注册配置。
3. `weapons/behaviors.ts` 的 `fireWeaponByType` 中实现行为。
4. 渲染：在 `rendering/entities/projectile.ts` 或新增渲染分支。

### 4.3 新增技能

- 主动：`skills/active.ts` 监听输入键位，修改玩家或敌人状态。
- 被动：`skills/passive.ts` 提供纯函数，在 `updatePlayer` 中调用。
- 升级：`upgrades.ts` 中补充选项与描述。

### 4.4 新增地图/关卡

- 地图尺寸、常量放入 `core/constants.ts`。
- 地形生成函数放入 `entities/terrain.ts`，推荐拆分为 `makeForestBiome`、`makeDesertBiome` 等独立函数。
- 关卡规则变化放在 `core/spawning.ts` 或 `core/difficulty.ts`，通过 `state.wave` 或新增 `levelTheme` 字段控制。

## 5. 性能约定

### 5.1 每帧开销控制

- 实体遍历优先使用 `for...of`，避免 `filter`/`map` 产生新数组。
- 移除实体时采用 `active = false` + 统一过滤，避免 mid-loop 删除。
- 距离判定优先比较平方距离，减少 `Math.hypot`/`Math.sqrt` 调用。

### 5.2 粒子与特效

- 新粒子效果必须提供移动端降级路径。
- 重型特效（爆炸、血液、魔法爆发）受 `setHeavyEffectRate` 控制，不要绕过该机制直接大量生成。
- 在 `state.isMobile` 分支中减少粒子数量、降低生成频率。

### 5.3 渲染性能

- 渲染层只读 `state`，不修改。
- 屏幕外对象应提前 `continue`，避免无效绘制。
- 复杂绘制使用 `ctx.save()` / `ctx.restore()` 配对，避免状态泄漏。

## 6. 调试与验证

### 6.1 每次修改后必须执行

```bash
npm run check
npm run build
```

### 6.2 行为验证

- 不得改变已有武器、技能、怪物的数值与行为，除非需求明确。
- 新增内容应在本地实际运行一次，确认无崩溃、无渲染异常。
- 涉及平衡性改动时，在注释中说明改动原因。

## 7. 代码审查清单

- [ ] 类型定义已同步到 `types.ts`。
- [ ] 新增模块已在正确的位置注册（loop / rendering / spawning）。
- [ ] 导入路径未经过门面文件绕路。
- [ ] 未引入循环依赖。
- [ ] 移动端性能已考虑。
- [ ] 中文关键字/注释保持原样。
- [ ] `npm run check` 与 `npm run build` 通过。
