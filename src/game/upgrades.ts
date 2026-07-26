import type { UpgradeOption, Player, WeaponConfig } from './types';
import { WEAPON_CONFIGS } from './weapons';
import { randPick } from './math';

const ALL_UPGRADES: UpgradeOption[] = [
  // --- 原始武器 ---
  { id: 'unlock_rifle', name: '获得突击步枪', description: '可穿透敌人的中距离步枪', rarity: 'common', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.rifle) },
  { id: 'unlock_shotgun', name: '获得霰弹枪', description: '近距离高爆发散射武器', rarity: 'common', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.shotgun) },
  { id: 'unlock_gatling', name: '获得加特林', description: '极高射速的持续火力压制', rarity: 'rare', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.gatling) },
  { id: 'unlock_laser', name: '获得激光炮', description: '穿透一切的高能激光束', rarity: 'rare', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.laser) },
  { id: 'unlock_grenade', name: '获得手雷', description: '自动投掷的范围爆炸武器', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.grenade) },
  { id: 'unlock_drone', name: '获得浮游炮', description: '自动追踪攻击的无人机群', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.drone) },

  // --- 陷阱类 ---
  { id: 'unlock_mine', name: '获得地雷布设器', description: '在身边布设地雷，敌人靠近时引爆', rarity: 'rare', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.mine) },

  // --- 定向类 ---
  { id: 'unlock_flamethrower', name: '获得火焰喷射器', description: '锥形火焰持续灼烧前方敌人', rarity: 'rare', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.flamethrower) },

  // --- 近战类 ---
  { id: 'unlock_sword', name: '获得高频刀刃', description: '挥砍周围敌人，近战高伤害带击退', rarity: 'rare', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.sword) },

  // --- 召唤物 ---
  { id: 'unlock_turret', name: '获得部署炮塔', description: '固定位置自动射击的炮塔，定期重新部署', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.turret) },
  { id: 'unlock_shield_drone', name: '获得护盾浮游机', description: '环绕飞行，拦截敌人弹幕', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.shield_drone) },
  { id: 'unlock_auto_turret', name: '获得自动炮塔', description: '跟随环绕飞行并自动射击敌人，周期嘲讽', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.auto_turret) },

  // --- 魔法类 ---
  { id: 'unlock_lightning', name: '习得闪电链', description: '闪电在敌人间跳跃连锁，命中多个目标', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.lightning) },
  { id: 'unlock_fire_wall', name: '习得火墙术', description: '在敌人密集处召唤火墙，持续灼烧', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.fire_wall) },
  { id: 'unlock_ice_wall', name: '习得冰墙术', description: '制造冰墙阻挡敌人，减速并冰冻', rarity: 'rare', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.ice_wall) },
  { id: 'unlock_skeleton', name: '习得召唤骷髅', description: '召唤骷髅战士自动攻击附近敌人', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.skeleton) },
  { id: 'unlock_beam_laser', name: '习得天罚光束', description: '从天而降的毁灭光束，直线贯穿所有敌人', rarity: 'legendary', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.beam_laser) },

  // --- 属性提升 ---
  { id: 'hp_up', name: '体质强化', description: '最大生命值 +25', rarity: 'common', type: 'stat', apply: (p) => { p.maxHp += 25; p.hp += 25; } },
  { id: 'speed_up', name: '战术机动', description: '移动速度 +15%', rarity: 'common', type: 'stat', apply: (p) => { p.speed *= 1.15; } },
  { id: 'armor_up', name: '防弹插板', description: '获得20点护甲上限', rarity: 'rare', type: 'stat', apply: (p) => { p.maxArmor += 20; p.armor += 20; } },
  { id: 'pickup_up', name: '磁力拾取', description: '经验拾取范围 +50%', rarity: 'common', type: 'stat', apply: (p) => { p.pickupRadius *= 1.5; } },
  { id: 'damage_up', name: '过载装药', description: '所有武器伤害 +20%', rarity: 'rare', type: 'stat', apply: (p) => { for (const w of p.weapons) w.config = { ...w.config, damage: w.config.damage * 1.2 }; } },
  { id: 'fire_rate_up', name: '极速扳机', description: '所有武器射速 +15%', rarity: 'rare', type: 'stat', apply: (p) => { for (const w of p.weapons) w.config = { ...w.config, fireRate: w.config.fireRate * 1.15 }; } },

  // --- 附魔类 ---
  { id: 'enchant_freeze', name: '寒冰附魔', description: '普通攻击有概率冻结敌人，降低其移动速度', rarity: 'rare', type: 'stat', apply: (p) => { p.enchants.freeze += 1; } },
  { id: 'enchant_burn', name: '烈焰附魔', description: '普通攻击有概率点燃敌人，造成持续灼烧伤害', rarity: 'rare', type: 'stat', apply: (p) => { p.enchants.burn += 1; } },
  { id: 'enchant_pierce', name: '穿透附魔', description: '所有弹射武器额外穿透 +1 个敌人', rarity: 'epic', type: 'stat', apply: (p) => { p.enchants.pierce += 1; } },

  // --- 被动 ---
  { id: 'regen', name: '纳米修复', description: '每秒恢复2点生命', rarity: 'epic', type: 'passive', apply: () => {} },
  { id: 'vampirism', name: '生命汲取', description: '击杀敌人时恢复3点生命', rarity: 'legendary', type: 'passive', apply: () => {} },
];

function addWeapon(player: Player, config: WeaponConfig) {
  const existing = player.weapons.find((w) => w.config.id === config.id);
  if (existing) {
    existing.level += 1;
  } else {
    player.weapons.push({ config: { ...config }, level: 1, lastFireTime: 0, heat: 0, aimAngle: 0, targetAngle: 0, fireFlash: 0 });
  }
}

export function generateUpgradeOptions(player: Player): UpgradeOption[] {
  const pool = ALL_UPGRADES.filter((u) => {
    if (u.type === 'weapon' && u.id.startsWith('unlock_')) {
      const wid = u.id.replace('unlock_', '') as keyof typeof WEAPON_CONFIGS;
      const existing = player.weapons.find((w) => w.config.id === wid);
      return !existing || existing.level < 5;
    }
    return true;
  });

  const options: UpgradeOption[] = [];
  const count = Math.min(3, pool.length);
  while (options.length < count) {
    const pick = randPick(pool);
    if (!options.some((o) => o.id === pick.id)) options.push(pick);
  }

  return options;
}

export function getRarityColor(rarity: UpgradeOption['rarity']): string {
  switch (rarity) {
    case 'common': return '#9ca3af';
    case 'rare': return '#3b82f6';
    case 'epic': return '#a855f7';
    case 'legendary': return '#f59e0b';
  }
}
