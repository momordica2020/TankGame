import type { GameState, Player } from '../types';

export function applyPassiveRegen(player: Player, dt: number) {
  // 被动 - 纳米修复
  if (player.passives.regen > 0) {
    player.hp = Math.min(player.maxHp, player.hp + player.passives.regen * 6 * dt);
  }
}

export function applyPassiveVampirism(state: GameState) {
  // 吸血被动
  if (state.player.passives.vampirism > 0) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 1 + state.player.passives.vampirism);
  }
}
