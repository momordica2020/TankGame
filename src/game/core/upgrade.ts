import type { GameState } from '../types';
import { generateUpgradeOptions } from '../upgrades';
import { spawnMagicBurst, spawnScreenFlash, spawnParticles, spawnLightPillarBurst, makeLightPillar } from '../particles';
import { getWeaponMuzzleWorld } from '../weapons';

// ============ 升级 ============
export function checkLevelUp(state: GameState) {
  const p = state.player;
  while (p.exp >= p.maxExp) {
    p.exp -= p.maxExp;
    p.level += 1;
    p.maxExp = Math.floor(p.maxExp * 1.25) + 8;
    p.maxHp += 10;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.1);
    // 升级提升拾取范围和吸力
    p.pickupRadius += 12;
    state.showUpgrade = true;
    state.upgradeOptions = generateUpgradeOptions(p);
    // 升级视觉特效：金色爆发 + 闪光 + 冲击波
    spawnMagicBurst(p.x, p.y, '#ffdd44');
    spawnScreenFlash(p.x, p.y);
    spawnParticles(p.x, p.y, 20, ['#ffdd44', '#ffaa00', '#ffffff', '#ffee88'], 80, 300, 2, 7, 0.3, 0.6);
    state.screenShake = Math.max(state.screenShake, 6);
    break; // 一次只触发一次升级面板
  }
}

export function applyUpgrade(state: GameState, idx: number) {
  const opt = state.upgradeOptions[idx];
  if (!opt) return;
  const p = state.player;
  // 记录升级前各武器等级，用于检测哪把武器升级并定位其炮塔
  const before = new Map<string, number>();
  for (const w of p.weapons) before.set(w.config.id, w.level);

  opt.apply(p);
  p.upgrades.push(opt.id);
  state.showUpgrade = false;
  state.upgradeOptions = [];

  // 如果还有待选的开局升级，继续弹出选择面板
  if (state.pendingStartUpgrades > 0) {
    state.pendingStartUpgrades -= 1;
    if (state.pendingStartUpgrades > 0) {
      state.upgradeOptions = generateUpgradeOptions(p);
      state.showUpgrade = true;
    } else {
      // 开局升级全部选完，开始第一波倒计时
      state.waveTimer = 3;
    }
  }

  // 选择升级后的确认特效
  spawnMagicBurst(p.x, p.y, '#44ff88');
  spawnParticles(p.x, p.y, 15, ['#44ff88', '#88ffaa', '#ffffff'], 60, 200, 1.5, 5, 0.2, 0.4);

  // 武器升级：在对应炮塔位置发出冲天光柱
  if (opt.type === 'weapon' && opt.id.startsWith('unlock_')) {
    const wid = opt.id.replace('unlock_', '');
    const w = p.weapons.find((ww) => ww.config.id === wid);
    if (w && before.get(wid) !== w.level) {
      // 计算该武器在其 slot 中的序号
      let wIdx = 0;
      for (const ww of p.weapons) {
        if (ww.config.slot === w.config.slot) {
          if (ww === w) break;
          wIdx++;
        }
      }
      const muzzle = getWeaponMuzzleWorld(p, w, wIdx);
      const color = w.config.color;
      state.lightPillars.push(makeLightPillar(muzzle.x, muzzle.y, color, {
        baseRadius: 18, beamHeight: 200, ringMax: 120, life: 1.3,
      }));
      spawnLightPillarBurst(muzzle.x, muzzle.y, color);
    }
  }
}
