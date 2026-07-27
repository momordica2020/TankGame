import type { WeaponConfig, WeaponType, Player, Projectile, Enemy, TargetingMode, WeaponInstance } from '../types';
import { angleTo, randRange } from '../math';
import { getNextId } from '../core/id';

export const WEAPON_CONFIGS: Record<WeaponType, WeaponConfig> = {
  rifle: {
    id: 'rifle', name: '突击步枪', category: 'projectile',
    damage: 12, fireRate: 3.5, range: 600, piercing: 1, projectileCount: 1,
    projectileSpeed: 700, spreadAngle: 0.05, cooldown: 0, color: '#ffd700',
    description: '平衡型武器，瞄准最近敌人，可穿透1个敌人',
    targeting: 'nearest', slot: 'right_arm',
  },
  shotgun: {
    id: 'shotgun', name: '霰弹枪', category: 'projectile',
    damage: 10, fireRate: 1.0, range: 350, piercing: 0, projectileCount: 6,
    projectileSpeed: 650, spreadAngle: 0.4, cooldown: 0, color: '#daa520',
    description: '瞄准血量最低的敌人，近距离扇形散射',
    targeting: 'lowest_hp', slot: 'left_arm',
  },
  gatling: {
    id: 'gatling', name: '加特林', category: 'projectile',
    damage: 7, fireRate: 12, range: 500, piercing: 2, projectileCount: 1,
    projectileSpeed: 900, spreadAngle: 0.12, cooldown: 0, color: '#4488ff',
    description: '瞄准最远的敌人，极高射速持续压制',
    targeting: 'farthest', slot: 'shoulder',
  },
  laser: {
    id: 'laser', name: '激光炮', category: 'projectile',
    damage: 4, fireRate: 10, range: 800, piercing: 99, projectileCount: 1,
    projectileSpeed: 2000, spreadAngle: 0, cooldown: 0, color: '#00ff88',
    description: '瞄准血量最高的敌人，高频激光穿透所有',
    targeting: 'highest_hp', slot: 'back',
  },
  grenade: {
    id: 'grenade', name: '手雷投掷器', category: 'projectile',
    damage: 55, fireRate: 0.7, range: 450, piercing: 0, projectileCount: 1,
    projectileSpeed: 400, spreadAngle: 0.12, cooldown: 0, color: '#33aaff',
    description: '瞄准敌人最密集处，范围爆炸',
    targeting: 'densest', slot: 'back',
  },
  drone: {
    id: 'drone', name: '浮游炮', category: 'projectile',
    damage: 10, fireRate: 3, range: 700, piercing: 1, projectileCount: 1,
    projectileSpeed: 650, spreadAngle: 0.08, cooldown: 0, color: '#3388ff',
    description: '随机瞄准附近敌人，环绕发射追踪弹',
    targeting: 'random', slot: 'shoulder',
  },
  mine: {
    id: 'mine', name: '地雷布设器', category: 'trap',
    damage: 120, fireRate: 0.7, range: 0, piercing: 0, projectileCount: 1,
    projectileSpeed: 0, spreadAngle: 0, cooldown: 0, color: '#66dd88',
    description: '在身边布设地雷，敌人靠近时引爆',
    targeting: 'nearest', slot: 'core',
  },
  flamethrower: {
    id: 'flamethrower', name: '火焰喷射器', category: 'directional',
    damage: 8, fireRate: 12, range: 360, piercing: 99, projectileCount: 1,
    projectileSpeed: 500, spreadAngle: 0.35, cooldown: 0, color: '#ffcc00',
    description: '瞄准最近敌人，锥形火焰持续灼烧',
    targeting: 'nearest', slot: 'left_arm',
  },
  sword: {
    id: 'sword', name: '高频刀刃', category: 'melee',
    damage: 55, fireRate: 2.5, range: 180, piercing: 99, projectileCount: 1,
    projectileSpeed: 0, spreadAngle: 0, cooldown: 0, color: '#aaddff',
    description: '挥砍周围所有敌人，近战范围高伤害',
    targeting: 'nearest', slot: 'right_arm',
  },
  turret: {
    id: 'turret', name: '部署炮塔', category: 'summon',
    damage: 20, fireRate: 5, range: 650, piercing: 1, projectileCount: 1,
    projectileSpeed: 900, spreadAngle: 0.06, cooldown: 0, color: '#ffd700',
    description: '固定位置自动射击炮塔，定期重新部署',
    targeting: 'nearest', slot: 'core',
  },
  shield_drone: {
    id: 'shield_drone', name: '护盾浮游机', category: 'summon',
    damage: 0, fireRate: 0, range: 0, piercing: 0, projectileCount: 1,
    projectileSpeed: 0, spreadAngle: 0, cooldown: 0, color: '#88ccff',
    description: '环绕飞行的护盾无人机，抵消敌人弹幕伤害',
    targeting: 'nearest', slot: 'core',
  },
  auto_turret: {
    id: 'auto_turret', name: '自动炮塔', category: 'summon',
    damage: 18, fireRate: 6, range: 600, piercing: 1, projectileCount: 1,
    projectileSpeed: 800, spreadAngle: 0.1, cooldown: 0, color: '#33dd77',
    description: '跟随环绕飞行并自动射击敌人',
    targeting: 'nearest', slot: 'shoulder',
  },
  // --- 魔法类 ---
  lightning: {
    id: 'lightning', name: '闪电链', category: 'magic',
    damage: 40, fireRate: 2, range: 500, piercing: 99, projectileCount: 1,
    projectileSpeed: 0, spreadAngle: 0, cooldown: 0, color: '#aaddff',
    description: '瞄准血量最高敌人，闪电在敌人间连锁',
    targeting: 'highest_hp', slot: 'back',
  },
  fire_wall: {
    id: 'fire_wall', name: '火墙术', category: 'magic',
    damage: 15, fireRate: 0.5, range: 0, piercing: 99, projectileCount: 1,
    projectileSpeed: 0, spreadAngle: 0, cooldown: 0, color: '#ffaa00',
    description: '在敌人最密集处召唤火墙，持续灼烧',
    targeting: 'densest', slot: 'core',
  },
  ice_wall: {
    id: 'ice_wall', name: '冰墙术', category: 'magic',
    damage: 5, fireRate: 0.4, range: 0, piercing: 0, projectileCount: 1,
    projectileSpeed: 0, spreadAngle: 0, cooldown: 0, color: '#66ccff',
    description: '在敌人密集处制造冰墙，减速并冰冻',
    targeting: 'densest', slot: 'core',
  },
  skeleton: {
    id: 'skeleton', name: '召唤骷髅兵', category: 'magic',
    damage: 20, fireRate: 2, range: 300, piercing: 0, projectileCount: 1,
    projectileSpeed: 0, spreadAngle: 0, cooldown: 0, color: '#e8e0d0',
    description: '召唤骷髅战士自动攻击附近敌人',
    targeting: 'nearest', slot: 'core',
  },
  beam_laser: {
    id: 'beam_laser', name: '天罚光束', category: 'magic',
    damage: 80, fireRate: 0.4, range: 1000, piercing: 99, projectileCount: 1,
    projectileSpeed: 0, spreadAngle: 0, cooldown: 0, color: '#ffffff',
    description: '瞄准最远敌人，从天而降的毁灭光束',
    targeting: 'farthest', slot: 'back',
  },
};

export function createProjectile(
  x: number, y: number, angle: number,
  config: WeaponConfig, level: number, isEnemy = false
): Projectile {
  const speed = config.projectileSpeed * (1 + (level - 1) * 0.12);
  const damage = config.damage * (1 + (level - 1) * 0.3);
  const typeSpecificSize = (config.id === 'laser' ? 8 : config.id === 'grenade' ? 12 : 6) + (level - 1);
  const radius = (config.id === 'laser' ? 5 : config.id === 'grenade' ? 8 : 4) + Math.floor((level - 1) * 0.5);
  return {
    id: getNextId(),
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    hp: 1, maxHp: 1, active: true,
    damage, speed, angle,
    piercing: config.piercing + Math.floor(level / 3),
    hits: new Set(),
    lifetime: 0,
    maxLifetime: (config.range / Math.max(speed, 1)) * 1.3,
    color: config.color,
    type: config.id,
    size: typeSpecificSize,
    isEnemy,
  };
}

export function createEnemyProjectile(
  x: number, y: number, angle: number,
  speed: number, damage: number, color: string
): Projectile {
  return {
    id: getNextId(),
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 5, hp: 1, maxHp: 1, active: true,
    damage, speed, angle,
    piercing: 0,
    hits: new Set(),
    lifetime: 0,
    maxLifetime: 5,
    color,
    type: 'rifle',
    size: 5,
    isEnemy: true,
  };
}

// ============ 炮塔挂载位置（身体局部坐标，-y = 前方）============
// 战列舰式布局：纵向长、横向窄；炮塔环列在两侧与中轴线前后部，避开正中央
export function getSlotMount(
  slot: WeaponConfig['slot'],
  radius: number,
  weaponIndex = 0
): { x: number; y: number } {
  const bw = radius * 0.8; // 横向半宽
  const bh = radius * 1.35; // 纵向半长
  switch (slot) {
    case 'left_arm':  return { x: -bw * 1.05,  y: -bh * 0.3 };
    case 'right_arm': return { x:  bw * 1.05,  y: -bh * 0.3 };
    case 'shoulder':  return weaponIndex === 0
      ? { x: -bw * 0.95, y: bh * 0.45 }
      : { x:  bw * 0.95, y: bh * 0.45 };
    case 'back':      return { x: 0,           y: bh * 0.75 };
    case 'core':      return { x: 0,           y: -bh * 0.55 };
  }
}

// 炮口相对挂载点的偏移距离（沿瞄准方向）
export function getMuzzleOffset(slot: WeaponConfig['slot']): number {
  switch (slot) {
    case 'left_arm': case 'right_arm': return 18;
    case 'shoulder': return 20;
    case 'back':     return 24;
    case 'core':     return 14;
    default:         return 18;
  }
}

// 计算某武器的炮塔中心世界坐标（挂载点位置，不含枪管偏移）
export function getWeaponMountWorld(
  player: Player,
  w: WeaponInstance,
  weaponIndex = 0
): { x: number; y: number } {
  const bodyRot = player.facing + Math.PI / 2; // 局部 -y → 世界 facing
  const mount = getSlotMount(w.config.slot, player.radius, weaponIndex);
  const cosR = Math.cos(bodyRot), sinR = Math.sin(bodyRot);
  return {
    x: player.x + mount.x * cosR - mount.y * sinR,
    y: player.y + mount.x * sinR + mount.y * cosR,
  };
}

// 计算某武器的炮口世界坐标
export function getWeaponMuzzleWorld(
  player: Player,
  w: WeaponInstance,
  weaponIndex = 0
): { x: number; y: number } {
  const bodyRot = player.facing + Math.PI / 2; // 局部 -y → 世界 facing
  const mount = getSlotMount(w.config.slot, player.radius, weaponIndex);
  const cosR = Math.cos(bodyRot), sinR = Math.sin(bodyRot);
  const mx = player.x + mount.x * cosR - mount.y * sinR;
  const my = player.y + mount.x * sinR + mount.y * cosR;
  const off = getMuzzleOffset(w.config.slot);
  return {
    x: mx + Math.cos(w.aimAngle) * off,
    y: my + Math.sin(w.aimAngle) * off,
  };
}

export function fireWeapon(
  player: Player,
  weapon: WeaponConfig,
  level: number,
  targetX: number, targetY: number,
  originX: number, originY: number
): Projectile[] {
  const baseAngle = angleTo(originX, originY, targetX, targetY);
  const projectiles: Projectile[] = [];

  if (weapon.id === 'shotgun') {
    const pellets = weapon.projectileCount + level - 1;
    for (let i = 0; i < pellets; i++) {
      const spread = (i - (pellets - 1) / 2) * weapon.spreadAngle * (2 / pellets);
      projectiles.push(createProjectile(originX, originY, baseAngle + spread, weapon, level));
    }
  } else if (weapon.id === 'drone') {
    const droneCount = Math.min(4 + level * 2, 16);
    // 用持续旋转的环绕角度，避免目标变化导致位置跳跃
    const orbit = player.droneOrbit;
    for (let i = 0; i < droneCount; i++) {
      const droneAngle = orbit + (i * Math.PI * 2) / droneCount;
      const dx = Math.cos(droneAngle) * 65;
      const dy = Math.sin(droneAngle) * 65;
      // 弹道方向朝目标，但出生位置基于稳定环绕
      projectiles.push(createProjectile(player.x + dx, player.y + dy, baseAngle, weapon, level));
    }
  } else {
    // 普通武器：每升1级弹道+1（最多8道），方向平行
    const totalShots = Math.min(level, 8);
    // 平行弹道：垂直于射击方向的偏移
    const perpX = -Math.sin(baseAngle);
    const perpY = Math.cos(baseAngle);
    const spacing = 12; // 弹道间距
    for (let i = 0; i < totalShots; i++) {
      const offset = totalShots > 1 ? (i - (totalShots - 1) / 2) * spacing : 0;
      const spread = randRange(-weapon.spreadAngle * 0.3, weapon.spreadAngle * 0.3);
      const px = originX + perpX * offset;
      const py = originY + perpY * offset;
      projectiles.push(createProjectile(px, py, baseAngle + spread, weapon, level));
    }
  }

  return projectiles;
}

// 根据武器瞄准模式自动选择目标，返回目标坐标。无目标时返回 null。
export function selectTarget(
  player: Player,
  enemies: Enemy[],
  mode: TargetingMode,
  maxRange: number
): { x: number; y: number } | null {
  if (enemies.length === 0) return null;
  // range <= 0 视为无限射程（魔法类武器如火墙/冰墙）
  const maxRangeSq = maxRange > 0 ? maxRange * maxRange : Infinity;
  let best: Enemy | null = null;

  if (mode === 'densest') {
    // 找到半径 220 内敌人最密集的位置（以某个敌人为中心）
    let bestCount = 0;
    const sampleR = 220;
    for (const e of enemies) {
      if (!e.active) continue;
      const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
      if (d > maxRangeSq) continue;
      let cnt = 0;
      for (const o of enemies) {
        if (!o.active) continue;
        if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < sampleR * sampleR) cnt++;
      }
      if (cnt > bestCount) {
        bestCount = cnt;
        best = e;
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  let bestScore = -Infinity;
  for (const e of enemies) {
    if (!e.active) continue;
    const d = (e.x - player.x) ** 2 + (e.y - player.y) ** 2;
    if (d > maxRangeSq) continue;
    let score = 0;
    switch (mode) {
      case 'nearest': score = -d; break;
      case 'farthest': score = d; break;
      case 'highest_hp': score = e.hp * 1000 - d * 0.001; break;
      case 'lowest_hp': score = -e.hp * 1000 - d * 0.001; break;
      case 'random': score = Math.random() * 1000; break;
    }
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

export function findNearestEnemy(px: number, py: number, enemies: { x: number; y: number; active: boolean; id: number }[]): { x: number; y: number; id: number } | null {
  let nearest = null;
  let minDist = Infinity;
  for (const e of enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - px, e.y - py);
    if (d < minDist) {
      minDist = d;
      nearest = e;
    }
  }
  return nearest;
}

export function findNearestEnemyId(px: number, py: number, enemies: { x: number; y: number; active: boolean; id: number }[], maxDist: number): number | null {
  let nearest = null;
  let minDist = maxDist;
  for (const e of enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - px, e.y - py);
    if (d < minDist) {
      minDist = d;
      nearest = e;
    }
  }
  return nearest ? nearest.id : null;
}
