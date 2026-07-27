import type { GameState } from '../types';

// ============ 摄像机 ============
export function updateCamera(state: GameState, dt: number, canvasW: number, canvasH: number) {
  state.camera.targetX = state.player.x;
  state.camera.targetY = state.player.y;
  state.camera.x += (state.camera.targetX - state.camera.x) * Math.min(1, dt * 8);
  state.camera.y += (state.camera.targetY - state.camera.y) * Math.min(1, dt * 8);
}
