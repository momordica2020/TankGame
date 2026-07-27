import type { GameState, Player } from '../types';
import { clamp } from '../math';

export function updateDifficulty(state: GameState, dt: number, liveEnemies: number) {
  const p = state.player;

  // 2) 动态上限：基于玩家成长度，严格控制（小怪数量翻倍）
  //    基础 140，每级成长 +12，最高 260
  const growth = calcPlayerPower(p);
  state.enemyCap = Math.min(360, 140 + Math.floor(growth * 12));

  // 3) 动态经验系数：场上怪物多/清怪快时降低单个经验，避免频繁升级暂停
  //    目标：让玩家大约每 12-18 秒升一级
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

  // 3.5) 动态波次难度：击杀过快时每15秒概率提升怪物强度，增加不确定感
  state.difficultyAdjustTimer -= dt;
  if (state.difficultyAdjustTimer <= 0) {
    state.difficultyAdjustTimer = 15;

    // 只在玩家击杀速度超限时才可能提升难度
    if (killRate > 70) {
      // 计算概率：超限越多概率越高（1/3到2/3）
      const overkillRatio = Math.min(1, (killRate - 70) / 60); // 70-130映射到0-1
      const probability = 1/3 + overkillRatio * (2/3 - 1/3); // 1/3到2/3

      if (Math.random() < probability) {
        // 难度提升：根据超限程度决定提升幅度
        const increase = 0.05 + overkillRatio * 0.1; // 5%-15%
        state.waveDifficultyMult = Math.min(2.0, state.waveDifficultyMult + increase);
      }
    } else if (killRate < 30 && densityRatio < 0.3) {
      // 击杀太慢时可能降低难度（概率固定1/3）
      if (Math.random() < 1/3) {
        const decrease = 0.05;
        state.waveDifficultyMult = Math.max(0.7, state.waveDifficultyMult - decrease);
      }
    }
  }
}

export function calcPlayerPower(p: Player): number {
  // 综合玩家等级、武器数量、武器等级，得到成长系数
  let power = p.level * 0.3;
  for (const w of p.weapons) {
    power += w.level * 0.5;
  }
  return Math.min(8, power);
}
