export * from './core';
export * from './behaviors';

import type { GameState } from '../types';
import { angleTo } from '../math';
import { selectTarget } from './core';
import { fireWeaponByType } from './behaviors';

export function updateWeapons(state: GameState, dt: number) {
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
