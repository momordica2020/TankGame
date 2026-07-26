import type { UpgradeOption, Player, WeaponConfig } from './types';
import { WEAPON_CONFIGS } from './weapons';
import { randPick } from './math';

const WEAPON_LEVEL_NAMES: Record<string, string[]> = {
  rifle: ['突击步枪', '强化步枪', '战斗步枪', '突击先锋', '毁灭者'],
  shotgun: ['霰弹枪', '重型霰弹', '爆裂霰弹', '雷霆霰弹', '毁灭之息'],
  gatling: ['加特林', '速射机枪', '火神炮', '金属风暴', '末日弹幕'],
  laser: ['激光炮', '聚能激光', '高能光束', '粒子光束', '湮灭射线'],
  grenade: ['手雷', '高爆手雷', '集束手雷', '纳米炸弹', '毁灭弹头'],
  drone: ['浮游炮', '攻击无人机', '战机群', '蜂群无人机', '天网'],
  mine: ['地雷布设器', '高爆地雷', '感应地雷', '子母地雷', '末日雷场'],
  flamethrower: ['火焰喷射器', '烈焰喷射', '地狱火', '焚尽者', '太阳风暴'],
  sword: ['光刀', '增强光刀', '纳米光斧', '纳米巨刃', '创世之刃'],
  turret: ['部署炮塔', '双联炮塔', '重型炮塔', '脉冲炮塔', '要塞炮'],
  shield_drone: ['护盾浮游机', '护盾无人机', '护盾编队', '力场护盾', '绝对防御'],
  auto_turret: ['自动炮塔', '攻击炮塔', '战斗炮塔', '智能炮塔', '歼灭者'],
  lightning: ['闪电链', '连锁闪电', '雷霆万钧', '九天雷劫', '天罚之雷'],
  fire_wall: ['火墙术', '烈焰墙', '地狱火墙', '焚天烈焰', '末日火海'],
  ice_wall: ['冰墙术', '寒冰墙', '极寒冰墙', '霜之屏障', '绝对零度'],
  skeleton: ['亡灵学徒', '亡灵术士', '亡灵导师', '巫妖', '天灾之主'],
  beam_laser: ['天罚光束', '毁灭光束', '天罚之眼', '神圣制裁', '末日审判'],
};

const WEAPON_LEVEL_DESCRIPTIONS: Record<string, string[]> = {
  rifle: [
    '可穿透1个敌人的中距离平衡型步枪',
    '步枪射速+20%，步枪伤害+25%，步枪穿透+1',
    '步枪射速+20%，步枪伤害+25%，步枪穿透+1，双弹道并行',
    '步枪射速+20%，步枪伤害+25%，步枪穿透+1，三弹道并行',
    '步枪射速+20%，步枪伤害+25%，步枪穿透+1，四弹道并行',
  ],
  shotgun: [
    '近距离扇形散射6发弹丸',
    '霰弹射速+20%，霰弹伤害+25%，霰弹弹丸+3',
    '霰弹射速+20%，霰弹伤害+25%，霰弹弹丸+3，双弹道并行',
    '霰弹射速+20%，霰弹伤害+25%，霰弹弹丸+3，三弹道并行',
    '霰弹射速+20%，霰弹伤害+25%，霰弹弹丸+3，四弹道并行',
  ],
  gatling: [
    '极高射速的持续火力压制，穿透2个敌人',
    '加特林射速+20%，加特林伤害+25%，散射收窄',
    '加特林射速+20%，加特林伤害+25%，散射收窄，双弹道并行',
    '加特林射速+20%，加特林伤害+25%，散射收窄，三弹道并行',
    '加特林射速+20%，加特林伤害+25%，散射收窄，四弹道并行',
  ],
  laser: [
    '高频激光束，穿透所有敌人',
    '激光射速+20%，激光伤害+25%，激光穿透+2',
    '激光射速+20%，激光伤害+25%，激光穿透+2，双光束并行',
    '激光射速+20%，激光伤害+25%，激光穿透+2，三光束并行',
    '激光射速+20%，激光伤害+25%，激光穿透+2，四光束并行',
  ],
  grenade: [
    '自动投掷范围爆炸手雷',
    '手雷伤害+35%，手雷射速+15%，爆炸范围扩大',
    '手雷伤害+35%，手雷射速+15%，双枚齐射',
    '手雷伤害+35%，手雷射速+15%，三枚齐射',
    '手雷伤害+35%，手雷射速+15%，四枚齐射',
  ],
  drone: [
    '自动追踪攻击的浮游炮',
    '浮游炮射速+20%，浮游炮伤害+25%，双炮并行',
    '浮游炮射速+20%，浮游炮伤害+25%，三炮并行',
    '浮游炮射速+20%，浮游炮伤害+25%，四炮并行',
    '浮游炮射速+20%，浮游炮伤害+25%，五炮并行',
  ],
  mine: [
    '每次布设4颗地雷，持续13.5秒',
    '地雷伤害+50%，布雷速度+30%，布设6颗，持续15秒',
    '地雷伤害+50%，布雷速度+30%，布设8颗，持续16.5秒',
    '地雷伤害+50%，布雷速度+30%，布设10颗，持续18秒',
    '地雷伤害+50%，布雷速度+30%，布设12颗，持续19.5秒',
  ],
  flamethrower: [
    '锥形火焰持续灼烧前方敌人',
    '火焰伤害+35%，火焰射程+20%，喷速+15%，扇形扩大',
    '火焰伤害+35%，火焰射程+20%，喷速+15%，扇形进一步扩大',
    '火焰伤害+35%，火焰射程+20%，喷速+15%，扇形继续扩大',
    '火焰伤害+35%，火焰射程+20%，喷速+15%，扇形达到最大',
  ],
  sword: [
    '挥砍周围敌人，近战高伤害带击退',
    '光刀伤害+35%，光刀范围+20%，挥速+15%，弧角扩大',
    '光刀伤害+35%，光刀范围+20%，挥速+15%，弧角进一步扩大',
    '光刀伤害+35%，光刀范围+20%，挥速+15%，弧角继续扩大',
    '光刀伤害+35%，光刀范围+20%，挥速+15%，弧角达到最大',
  ],
  turret: [
    '最多部署5座固定炮塔，自动射击敌人',
    '炮塔伤害+30%，炮塔射速+25%，最多7座',
    '炮塔伤害+30%，炮塔射速+25%，最多9座',
    '炮塔伤害+30%，炮塔射速+25%，最多11座',
    '炮塔伤害+30%，炮塔射速+25%，最多13座',
  ],
  shield_drone: [
    '环绕飞行的5架护盾无人机，拦截敌人弹幕',
    '最多7架护盾无人机',
    '最多9架护盾无人机',
    '最多11架护盾无人机',
    '最多13架护盾无人机',
  ],
  auto_turret: [
    '环绕飞行的5座自动炮塔，自动射击并嘲讽',
    '自动炮塔伤害+30%，自动炮塔射速+25%，最多7座',
    '自动炮塔伤害+30%，自动炮塔射速+25%，最多9座',
    '自动炮塔伤害+30%，自动炮塔射速+25%，最多11座',
    '自动炮塔伤害+30%，自动炮塔射速+25%，最多12座',
  ],
  lightning: [
    '闪电链跳跃3个目标，连锁伤害',
    '闪电伤害+40%，跳跃目标+1',
    '闪电伤害+40%，跳跃目标+1，双道闪电',
    '闪电伤害+40%，跳跃目标+1，三道闪电',
    '闪电伤害+40%，跳跃目标+1，四道闪电',
  ],
  fire_wall: [
    '在敌人密集处召唤火墙，持续灼烧',
    '火墙伤害+40%，火墙召唤速度+20%，范围扩大',
    '火墙伤害+40%，火墙召唤速度+20%，双火墙',
    '火墙伤害+40%，火墙召唤速度+20%，三火墙',
    '火墙伤害+40%，火墙召唤速度+20%，四火墙',
  ],
  ice_wall: [
    '制造冰墙阻挡敌人，减速并冰冻',
    '冰墙伤害+40%，冰墙召唤速度+20%，范围扩大',
    '冰墙伤害+40%，冰墙召唤速度+20%，双冰墙',
    '冰墙伤害+40%，冰墙召唤速度+20%，三冰墙',
    '冰墙伤害+40%，冰墙召唤速度+20%，四冰墙',
  ],
  skeleton: [
    '召唤6名骷髅战士自动攻击敌人，持续15秒',
    '骷髅伤害+40%，最多9名骷髅战士',
    '骷髅伤害+40%，最多12名骷髅战士',
    '骷髅伤害+40%，最多15名骷髅战士',
    '骷髅伤害+40%，最多16名骷髅战士',
  ],
  beam_laser: [
    '从天而降的毁灭光束，直线贯穿所有敌人',
    '光束伤害+50%，光束射速+20%，双光束',
    '光束伤害+50%，光束射速+20%，三光束',
    '光束伤害+50%，光束射速+20%，四光束',
    '光束伤害+50%，光束射速+20%，五光束',
  ],
};

function getWeaponLevelName(weaponId: string, level: number): string {
  const names = WEAPON_LEVEL_NAMES[weaponId] || ['武器强化'];
  if (level <= names.length) {
    return names[level - 1];
  }
  const baseName = names[names.length - 1];
  const romanNum = toRoman(level - names.length + 1);
  return `${baseName}${romanNum}`;
}

function getWeaponLevelDescription(weaponId: string, level: number): string {
  const descs = WEAPON_LEVEL_DESCRIPTIONS[weaponId];
  if (!descs) return '性能显著提升';
  if (level <= descs.length) {
    return descs[level - 1];
  }
  const baseName = WEAPON_LEVEL_NAMES[weaponId]?.[WEAPON_LEVEL_NAMES[weaponId].length - 1] || '武器';
  const romanNum = toRoman(level - descs.length + 1);
  return `${baseName}${romanNum}：全属性进一步提升`;
}

function toRoman(num: number): string {
  const romanNums = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return romanNums[num - 1] || String(num);
}

const ALL_UPGRADES: UpgradeOption[] = [
  // --- 原始武器 ---
  { id: 'unlock_rifle', name: '突击步枪', description: '可穿透敌人的中距离步枪', rarity: 'common', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.rifle) },
  { id: 'unlock_shotgun', name: '霰弹枪', description: '近距离高爆发散射武器', rarity: 'common', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.shotgun) },
  { id: 'unlock_gatling', name: '加特林', description: '极高射速的持续火力压制', rarity: 'rare', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.gatling) },
  { id: 'unlock_laser', name: '激光炮', description: '穿透一切的高能激光束', rarity: 'rare', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.laser) },
  { id: 'unlock_grenade', name: '手雷', description: '自动投掷的范围爆炸武器', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.grenade) },
  { id: 'unlock_drone', name: '浮游炮', description: '自动追踪攻击的无人机群', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.drone) },

  // --- 陷阱类 ---
  { id: 'unlock_mine', name: '地雷布设器', description: '在身边布设地雷，敌人靠近时引爆', rarity: 'rare', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.mine) },

  // --- 定向类 ---
  { id: 'unlock_flamethrower', name: '火焰喷射器', description: '锥形火焰持续灼烧前方敌人', rarity: 'rare', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.flamethrower) },

  // --- 近战类 ---
  { id: 'unlock_sword', name: '光刀', description: '挥砍周围敌人，近战高伤害带击退', rarity: 'rare', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.sword) },

  // --- 召唤物 ---
  { id: 'unlock_turret', name: '部署炮塔', description: '固定位置自动射击的炮塔，定期重新部署', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.turret) },
  { id: 'unlock_shield_drone', name: '护盾浮游机', description: '环绕飞行，拦截敌人弹幕', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.shield_drone) },
  { id: 'unlock_auto_turret', name: '自动炮塔', description: '跟随环绕飞行并自动射击敌人，周期嘲讽', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.auto_turret) },

  // --- 魔法类 ---
  { id: 'unlock_lightning', name: '闪电链', description: '闪电在敌人间跳跃连锁，命中多个目标', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.lightning) },
  { id: 'unlock_fire_wall', name: '火墙术', description: '在敌人密集处召唤火墙，持续灼烧', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.fire_wall) },
  { id: 'unlock_ice_wall', name: '冰墙术', description: '制造冰墙阻挡敌人，减速并冰冻', rarity: 'rare', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.ice_wall) },
  { id: 'unlock_skeleton', name: '亡灵学徒', description: '召唤骷髅战士自动攻击附近敌人', rarity: 'epic', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.skeleton) },
  { id: 'unlock_beam_laser', name: '天罚光束', description: '从天而降的毁灭光束，直线贯穿所有敌人', rarity: 'legendary', type: 'weapon', apply: (p) => addWeapon(p, WEAPON_CONFIGS.beam_laser) },

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
  { id: 'regen', name: '纳米修复', description: '每秒恢复6点生命', rarity: 'epic', type: 'passive', apply: (p) => { p.passives.regen += 1; } },
  { id: 'vampirism', name: '生命汲取', description: '击杀敌人时恢复2点生命，每级+1点', rarity: 'legendary', type: 'passive', apply: (p) => { p.passives.vampirism += 1; } },
];

function addWeapon(player: Player, config: WeaponConfig) {
  const existing = player.weapons.find((w) => w.config.id === config.id);
  if (existing) {
    existing.level += 1;
    const lvl = existing.level;
    const cat = config.category;
    const id = config.id;

    // 按类别显著提升性能
    if (cat === 'projectile') {
      // 枪械投射物类：射速 + 子弹数量（并行弹道）+ 伤害
      // 射速：每级 +20%
      existing.config = { ...existing.config, fireRate: existing.config.fireRate * 1.2 };
      // 伤害：每级 +25%
      existing.config = { ...existing.config, damage: existing.config.damage * 1.25 };
      // 霰弹枪：每级弹丸数 +3
      if (id === 'shotgun') {
        existing.config = { ...existing.config, projectileCount: existing.config.projectileCount + 3 };
      }
      // 加特林：每级散射收窄
      if (id === 'gatling') {
        existing.config = { ...existing.config, spreadAngle: Math.max(0.03, existing.config.spreadAngle * 0.9) };
      }
      // 激光炮：每级穿透 +2
      if (id === 'laser') {
        existing.config = { ...existing.config, piercing: existing.config.piercing + 2 };
      }
      // 手雷：每级爆炸半径 +25%
      if (id === 'grenade') {
        existing.config = { ...existing.config, damage: existing.config.damage * 1.35 };
        existing.config = { ...existing.config, fireRate: existing.config.fireRate * 1.15 };
      }
      // 步枪：每级穿透 +1
      if (id === 'rifle') {
        existing.config = { ...existing.config, piercing: existing.config.piercing + 1 };
      }
    } else if (cat === 'directional' || cat === 'melee') {
      // 近战/喷火器：扇形角度扩大 + 半径增加 + 伤害提升
      // 伤害：每级 +35%
      existing.config = { ...existing.config, damage: existing.config.damage * 1.35 };
      // 范围半径：每级 +20%
      existing.config = { ...existing.config, range: existing.config.range * 1.2 };
      // 射速：每级 +15%
      existing.config = { ...existing.config, fireRate: existing.config.fireRate * 1.15 };
      // 喷火器：扇形角度每级扩大 25%
      if (id === 'flamethrower') {
        existing.config = { ...existing.config, spreadAngle: Math.min(1.2, existing.config.spreadAngle * 1.25) };
      }
    } else if (cat === 'summon' || cat === 'magic') {
      // 召唤/魔法类：数量翻倍 + 性能提升
      // 伤害：每级 +30%
      existing.config = { ...existing.config, damage: existing.config.damage * 1.3 };
      // 射速：每级 +25%
      existing.config = { ...existing.config, fireRate: existing.config.fireRate * 1.25 };
      // 火墙/冰墙/天罚光束：范围扩大
      if (id === 'fire_wall' || id === 'ice_wall') {
        existing.config = { ...existing.config, damage: existing.config.damage * 1.4 };
        existing.config = { ...existing.config, fireRate: existing.config.fireRate * 1.2 };
      }
      // 闪电链：每级跳跃目标 +1
      if (id === 'lightning') {
        existing.config = { ...existing.config, piercing: existing.config.piercing + 1 };
        existing.config = { ...existing.config, damage: existing.config.damage * 1.4 };
      }
      // 天罚光束：每级显著提升伤害和宽度感
      if (id === 'beam_laser') {
        existing.config = { ...existing.config, damage: existing.config.damage * 1.5 };
        existing.config = { ...existing.config, fireRate: existing.config.fireRate * 1.2 };
      }
      // 召唤骷髅：每级多召唤 1 个
      if (id === 'skeleton') {
        existing.config = { ...existing.config, damage: existing.config.damage * 1.4 };
      }
      // 炮塔/浮游炮/护盾机：召唤数量 +50%（在生成逻辑中按 level 计算）
    } else if (cat === 'trap') {
      // 地雷：伤害 + 数量增加
      existing.config = { ...existing.config, damage: existing.config.damage * 1.5 };
      existing.config = { ...existing.config, fireRate: existing.config.fireRate * 1.3 };
    }
  } else {
    player.weapons.push({ config: { ...config }, level: 1, lastFireTime: 0, heat: 0, aimAngle: 0, targetAngle: 0, fireFlash: 0 });
  }
}

export function generateUpgradeOptions(player: Player): UpgradeOption[] {
  const pool: UpgradeOption[] = [];
  
  for (const u of ALL_UPGRADES) {
    if (u.type === 'weapon' && u.id.startsWith('unlock_')) {
      const wid = u.id.replace('unlock_', '') as keyof typeof WEAPON_CONFIGS;
      const existing = player.weapons.find((w) => w.config.id === wid);
      const currentLevel = existing ? existing.level : 0;
      const nextLevel = currentLevel + 1;
      
      if (nextLevel > 10) continue;
      
      const levelName = getWeaponLevelName(wid, nextLevel);
      const description = getWeaponLevelDescription(wid, nextLevel);
      
      pool.push({
        ...u,
        name: levelName,
        description,
      });
    } else {
      // 计算非武器类升级的当前等级
      let currentLevel = 0;
      if (u.id.startsWith('enchant_')) {
        const eid = u.id.replace('enchant_', '') as keyof typeof player.enchants;
        currentLevel = player.enchants[eid] || 0;
      } else if (u.id === 'regen') {
        currentLevel = player.passives.regen;
      } else if (u.id === 'vampirism') {
        currentLevel = player.passives.vampirism;
      } else {
        // 属性提升类：统计upgrades中出现的次数
        currentLevel = player.upgrades.filter((x) => x === u.id).length;
      }
      const nextLevel = currentLevel + 1;
      // 非武器类最多10级
      if (nextLevel > 10) continue;
      
      // 在名称后添加等级后缀
      let levelSuffix = '';
      if (currentLevel > 0) {
        levelSuffix = ' ' + toRoman(currentLevel + 1);
      }
      
      // 根据当前等级动态计算描述数值
      let desc = u.description;
      if (u.id === 'regen') {
        const currentVal = currentLevel * 6;
        const nextVal = (currentLevel + 1) * 6;
        desc = currentLevel > 0
          ? `当前${currentLevel}级，每秒恢复${currentVal}点生命，升级后每秒恢复${nextVal}点`
          : `每秒恢复${nextVal}点生命`;
      } else if (u.id === 'vampirism') {
        const currentVal = 1 + currentLevel;
        const nextVal = 1 + currentLevel + 1;
        desc = currentLevel > 0
          ? `当前${currentLevel}级，击杀敌人时恢复${currentVal}点生命，升级后恢复${nextVal}点`
          : `击杀敌人时恢复${nextVal}点生命，每级+1点`;
      } else if (currentLevel > 0) {
        desc = `当前${currentLevel}级，${desc}`;
      }
      
      pool.push({
        ...u,
        name: u.name + levelSuffix,
        description: desc,
      });
    }
  }

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
