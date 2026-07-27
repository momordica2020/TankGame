import type { GameState } from '../types';
import { drawTerrains } from './entities/terrain';
import { drawPlayer } from './entities/player';
import { drawEnemies } from './entities/enemy';
import { drawProjectiles, drawEnemyProjectiles } from './entities/projectile';
import { drawPickups } from './entities/pickup';
import { drawSummons } from './entities/summon';
import { drawGround } from './layers/ground';
import {
  drawIceWalls,
  drawFireWalls,
  drawMeleeEffects,
  drawFlameEffects,
  drawBeamLasers,
  drawLightning,
  drawLightPillars,
  drawBossBombs,
  drawParticles,
} from './layers/effects';
import { drawMinimap, drawOffscreenIndicators, drawTouchJoystick } from './layers/ui';

const GROUND_COLOR = '#1a1a1f';
const GRID_COLOR = '#2a2a30';
const MAP_BORDER_COLOR = '#4a7c59';

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, canvasW: number, canvasH: number) {
  // 死亡后保持纯黑，避免闪回正常画面再跳结算
  if (state.isGameOver) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasW, canvasH);
    return;
  }

  const cam = state.camera;
  let shakeX = 0, shakeY = 0;
  if (state.screenShake > 0) {
    shakeX = (Math.random() - 0.5) * state.screenShake * 2;
    shakeY = (Math.random() - 0.5) * state.screenShake * 2;
  }

  // 死亡动画：画面逐渐缩进到玩家位置
  const dying = state.deathAnim > 0;
  let zoom = 1;
  // 移动端缩放：竖屏适配，拉远视野
  if (state.isMobile) {
    zoom = Math.min(1, (canvasW * 0.78) / 480);
  }
  if (dying) {
    // 从 1.0 缩放到 2.5
    const t = 1 - state.deathAnim / 1.6;
    zoom = 1 + t * 1.5;
  }

  // 清屏，防止 zoom<1 时未覆盖区域产生拖影
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.save();
  ctx.translate(canvasW / 2 + shakeX, canvasH / 2 + shakeY);
  if (zoom !== 1) ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);

  // 计算缩放后的实际视野世界尺寸，传给需要覆盖全屏的绘制函数
  const vw = canvasW / zoom;
  const vh = canvasH / zoom;
  drawGround(ctx, state, cam, vw, vh);
  drawTerrains(ctx, state, cam, vw, vh);
  drawIceWalls(ctx, state);
  drawFireWalls(ctx, state);
  drawPickups(ctx, state);
  drawSummons(ctx, state);
  drawEnemies(ctx, state);
  drawEnemyProjectiles(ctx, state);
  if (!dying) drawPlayer(ctx, state);
  drawProjectiles(ctx, state);
  drawMeleeEffects(ctx, state);
  drawFlameEffects(ctx, state);
  drawBeamLasers(ctx, state);
  drawBossBombs(ctx, state);
  drawLightning(ctx, state);
  drawLightPillars(ctx, state, canvasH);
  drawParticles(ctx, state);
  drawMapBorder(ctx, state);

  // 死亡碎片
  if (dying) drawDeathDebris(ctx, state);

  ctx.restore();

  // 死亡渐暗遮罩
  if (dying) {
    const t = 1 - state.deathAnim / 1.6;
    ctx.fillStyle = `rgba(0,0,0,${t * 0.6})`;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // 受击屏幕闪红
  if (state.damageFlash > 0) {
    ctx.fillStyle = `rgba(180, 20, 20, ${state.damageFlash * 0.35})`;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  if (!dying && !state.isMobile) drawMinimap(ctx, state, canvasW, canvasH);
  if (!dying) drawOffscreenIndicators(ctx, state, canvasW, canvasH);
  if (!dying && state.isMobile) drawTouchJoystick(ctx, state, canvasW, canvasH);
}

function drawDeathDebris(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const d of state.deathDebris) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.fillStyle = d.color;
    ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size * 0.6);
    ctx.restore();
  }
}

function drawMapBorder(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.strokeStyle = MAP_BORDER_COLOR;
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, state.mapWidth, state.mapHeight);
}
