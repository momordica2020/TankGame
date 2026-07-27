import type { GameState } from '../types';
import { spawnScreenFlash, spawnMagicBurst } from '../particles';
import { killEnemy } from '../entities/enemy';
import { getInput } from '../core/input';
import { SKILL_CD, SKILL_DURATION } from '../core/constants';

export function updateSkills(state: GameState, dt: number) {
  const p = state.player;
  const input = getInput();

  if (input.skill1) {
    input.skill1 = false;
    if ((p.timers.heal || 0) <= 0) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
      p.timers.heal = SKILL_CD.heal;
      spawnMagicBurst(p.x, p.y, '#44ff88');
    }
  }
  if (input.skill2) {
    input.skill2 = false;
    if ((p.timers.shield || 0) <= 0) {
      p.shieldTimer = SKILL_DURATION.shield;
      p.timers.shield = SKILL_CD.shield;
      spawnMagicBurst(p.x, p.y, '#3b82f6');
    }
  }
  if (input.skill3) {
    input.skill3 = false;
    if ((p.timers.invincible || 0) <= 0) {
      p.invincibleTimer = Math.max(p.invincibleTimer, SKILL_DURATION.invincible);
      p.timers.invincible = SKILL_CD.invincible;
      spawnMagicBurst(p.x, p.y, '#ffdd44');
    }
  }
  if (input.skill4) {
    input.skill4 = false;
    if ((p.timers.screenClear || 0) <= 0) {
      p.timers.screenClear = SKILL_CD.screenClear;
      screenClear(state);
    }
  }
}

export function screenClear(state: GameState) {
  const p = state.player;
  spawnScreenFlash(p.x, p.y);
  state.screenShake = 18;
  for (const e of state.enemies) {
    if (!e.active) continue;
    if (e.type === 'boss') {
      e.hp -= e.maxHp * 0.25;
      if (e.hp <= 0) killEnemy(state, e);
    } else {
      e.hp = 0;
      killEnemy(state, e);
    }
  }
  // 清除敌方弹幕
  for (const proj of state.enemyProjectiles) proj.active = false;
}
