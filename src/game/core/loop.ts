import type { GameState } from '../types';
import { getInput } from './input';
import { randRange } from '../math';
import { updateParticles, spawnParticles } from '../particles';
import { updatePlayer } from '../entities/player';
import { updateSkills } from '../skills/active';
import { updateWeapons } from '../weapons';
import { updateProjectiles, updateEnemyProjectiles } from '../entities/projectile';
import { updateEnemies } from '../entities/enemy';
import { updateSummons } from '../entities/summon';
import { updatePickups } from '../entities/pickup';
import { updateMagicEffects } from '../effects';
import { updateMeleeAndFlame } from '../effects/melee';
import { updateSpawning } from './spawning';
import { updateCamera } from './camera';
import { updateCombo } from './combo';
import { checkLevelUp } from './upgrade';

export function updateGame(state: GameState, dt: number, canvasW: number, canvasH: number) {
  const input = getInput();

  // 同步触摸输入到 state（供渲染使用）
  state.touchInput.active = input.touchActive;
  state.touchInput.startX = input.touchStartX;
  state.touchInput.startY = input.touchStartY;
  state.touchInput.currentX = input.touchX;
  state.touchInput.currentY = input.touchY;
  state.touchInput.joyX = input.touchJoyX;
  state.touchInput.joyY = input.touchJoyY;
  if (state.isPaused || state.isGameOver || state.showUpgrade) return;

  // 死亡动画阶段：只更新碎片、粒子、相机，不更新游戏逻辑
  if (state.deathAnim > 0) {
    state.deathAnim -= dt;
    // 更新碎片
    for (const d of state.deathDebris) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 0.96;
      d.vy *= 0.96;
      d.vy += 200 * dt;
      d.rot += d.vr * dt;
      if (d.life !== undefined) d.life -= dt;
    }
    // 过滤掉生命周期结束的碎片（弹壳等临时物）
    state.deathDebris = state.deathDebris.filter((d) => d.life === undefined || d.life > 0);
    // 持续冒火花（移动端减少）
    const deathSparkRate = state.isMobile ? 0.15 : 0.5;
    if (Math.random() < deathSparkRate) {
      const p = state.player;
      spawnParticles(p.x + randRange(-15, 15), p.y + randRange(-15, 15), 2,
        ['#ffaa00', '#ff6600', '#ff3333', '#ffdd44'], 30, 120, 1, 4, 0.2, 0.5);
    }
    if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - dt * 30);
    updateParticles(dt);
    // 相机缩进到玩家位置
    const p = state.player;
    state.camera.targetX = p.x;
    state.camera.targetY = p.y;
    state.camera.x += (state.camera.targetX - state.camera.x) * Math.min(1, dt * 3);
    state.camera.y += (state.camera.targetY - state.camera.y) * Math.min(1, dt * 3);
    // 动画结束 → 进入结算
    if (state.deathAnim <= 0) {
      state.isGameOver = true;
    }
    return;
  }

  state.gameTime += dt;
  if (state.screenShake > 0) state.screenShake = Math.max(0, state.screenShake - dt * 30);
  if (state.damageFlash > 0) {
    state.damageFlash = Math.max(0, state.damageFlash - dt * 3);
  }

  // 鼠标世界坐标
  input.mouseWorldX = state.camera.x + (input.mouseX - canvasW / 2);
  input.mouseWorldY = state.camera.y + (input.mouseY - canvasH / 2);

  updatePlayer(state, dt);
  updateSkills(state, dt);
  updateWeapons(state, dt);
  updateProjectiles(state, dt);
  updateEnemyProjectiles(state, dt);
  updateEnemies(state, dt);
  updateSummons(state, dt);
  updatePickups(state, dt);
  updateMagicEffects(state, dt);
  updateMeleeAndFlame(state, dt);
  updateParticles(dt);
  // 更新弹壳等碎片
  for (const d of state.deathDebris) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vx *= 0.96;
    d.vy *= 0.96;
    d.vy += 200 * dt;
    d.rot += d.vr * dt;
    if (d.life !== undefined) d.life -= dt;
  }
  state.deathDebris = state.deathDebris.filter((d) => d.life === undefined || d.life > 0);
  updateSpawning(state, dt);
  updateCamera(state, dt, canvasW, canvasH);
  updateCombo(state, dt);

  // 移除被摧毁的障碍物
  state.terrains = state.terrains.filter((t) => !(t.type === 'obstacle' && t.hp <= 0));

  // 经验升级
  checkLevelUp(state);
}
