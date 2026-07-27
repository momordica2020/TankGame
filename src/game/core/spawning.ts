import type { GameState, EnemyType } from '../types';
import { clamp, randRange, randInt, randPick } from '../math';
import { createEnemyAt } from '../entities/enemy';
import { updateDifficulty, calcPlayerPower } from './difficulty';

// ============ 敌人生成（动态控制版） ============
export function updateSpawning(state: GameState, dt: number) {
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

  const liveEnemies = state.enemies.filter((e) => e.active).length;

  // 2) 动态上限、3) 动态经验系数、3.5) 动态波次难度
  updateDifficulty(state, dt, liveEnemies);

  const growth = calcPlayerPower(p);
  const densityRatio = liveEnemies / state.enemyCap;

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
