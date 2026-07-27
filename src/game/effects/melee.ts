import type { GameState } from '../types';

export function updateMeleeAndFlame(state: GameState, dt: number) {
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
