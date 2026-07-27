import type { GameState } from '../types';

// ============ 连击 ============
let comboTimer = 0;
export function updateCombo(state: GameState, dt: number) {
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
