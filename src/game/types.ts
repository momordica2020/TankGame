export interface Vec2 {
  x: number;
  y: number;
}

export interface Entity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  active: boolean;
}

export type TargetingMode =
  | 'nearest'
  | 'farthest'
  | 'highest_hp'
  | 'lowest_hp'
  | 'random'
  | 'densest';

export interface Player extends Entity {
  speed: number;
  exp: number;
  maxExp: number;
  level: number;
  weapons: WeaponInstance[];
  upgrades: string[];
  invincibleTimer: number;
  armor: number;
  maxArmor: number;
  pickupRadius: number;
  expGainMult: number;
  timers: { [key: string]: number };
  shieldTimer: number;
  berserkTimer: number;
  enchants: {
    freeze: number;
    burn: number;
    pierce: number;
  };
  passives: {
    regen: number;
    vampirism: number;
  };
  facing: number;
  targetFacing: number; // 缓急转向的目标朝向
  walkCycle: number;
  dustTimer: number;
  moving: boolean;
  droneOrbit: number;
}

export type WeaponType =
  | 'rifle' | 'shotgun' | 'gatling' | 'laser' | 'grenade' | 'drone'
  | 'mine' | 'flamethrower' | 'sword'
  | 'turret' | 'shield_drone' | 'auto_turret'
  | 'lightning' | 'fire_wall' | 'ice_wall' | 'skeleton' | 'beam_laser';

export type WeaponCategory = 'projectile' | 'trap' | 'directional' | 'melee' | 'summon' | 'magic';

export interface WeaponConfig {
  id: WeaponType;
  name: string;
  category: WeaponCategory;
  damage: number;
  fireRate: number;
  range: number;
  piercing: number;
  projectileCount: number;
  projectileSpeed: number;
  spreadAngle: number;
  cooldown: number;
  color: string;
  description: string;
  targeting: TargetingMode;
  slot: 'left_arm' | 'right_arm' | 'back' | 'shoulder' | 'core';
}

export interface WeaponInstance {
  config: WeaponConfig;
  level: number;
  lastFireTime: number;
  heat: number;
  aimAngle: number;
  targetAngle: number;
  fireFlash: number;
}

export interface Projectile extends Entity {
  damage: number;
  speed: number;
  angle: number;
  piercing: number;
  hits: Set<number>;
  lifetime: number;
  maxLifetime: number;
  color: string;
  type: WeaponType;
  size: number;
  isEnemy: boolean;
}

export type EnemyType = 'basic' | 'fast' | 'tank' | 'elite' | 'boss'
  | 'shooter' | 'sniper' | 'shotgunner'
  | 'bruiser' | 'splitter' | 'splitter_small'
  | 'elite_brute' | 'elite_gunner' | 'elite_bomber';

export interface EnemyTurret {
  angle: number;
  offsetAngle: number;
  radius: number;
  cooldown: number;
  lastFire: number;
  color: string;
}

export interface Enemy extends Entity {
  speed: number;
  damage: number;
  expValue: number;
  type: EnemyType;
  color: string;
  attackCooldown: number;
  lastAttackTime: number;
  flashTimer: number;
  isRanged: boolean;
  preferredDistance: number;
  projectileSpeed: number;
  projectileDamage: number;
  tauntTarget: number | null;
  baseSpeed: number;
  freezeTimer: number;
  burnTimer: number;
  burnDamage: number;
  isElite: boolean;
  turrets: EnemyTurret[];
  rotation: number;
  ringFireTimer?: number;
  // Boss技能状态
  bossSkillTimer?: number;
  bossChargeTimer?: number;
  bossChargeDir?: { x: number; y: number };
  bossChargeState?: 'idle' | 'charging' | 'dashing';
  bossBombTimer?: number;
  spawnAnim: number;
}

export type PickupType = 'exp' | 'health' | 'bomb' | 'vacuum' | 'shield_pickup' | 'screen_clear';

export interface Pickup extends Entity {
  type: PickupType;
  value: number;
  magnetTarget: number | null;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  active: boolean;
}

export interface Camera {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

export type TerrainType = 'obstacle' | 'slowzone';
export type ObstacleVariant = 'soft_rock' | 'hard_rock' | 'tree' | 'metal';

export interface Terrain {
  id: number;
  type: TerrainType;
  variant?: ObstacleVariant; // obstacle 子类：软石/硬石/树木/金属
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  destructible: boolean;
  vertices: { x: number; y: number }[]; // 局部坐标不规则形状顶点
}

export type SummonType = 'turret' | 'shield_drone' | 'auto_turret' | 'skeleton';

export interface Summon extends Entity {
  type: SummonType;
  weapon: WeaponConfig;
  level: number;
  lastFireTime: number;
  angle: number;
  orbitRadius: number;
  orbitSpeed: number;
  lifetime: number;
  maxLifetime: number;
  deployX: number;
  deployY: number;
  tauntRadius: number;
}

export interface MeleeEffect {
  x: number;
  y: number;
  angle: number;
  arc: number;
  radius: number;
  life: number;
  maxLife: number;
  active: boolean;
  hits: Set<number>;
}

export interface FlameEffect {
  x: number;
  y: number;
  angle: number;
  radius: number;
  life: number;
  active: boolean;
}

export interface LightningEffect {
  points: { x: number; y: number }[];
  width: number;  // 闪电粗细
  life: number;
  maxLife: number;
  active: boolean;
}

export interface FireWallEffect {
  x: number;
  y: number;
  width: number;   // 厚度（短边，沿玩家到墙方向）
  height: number;  // 长度（长边，垂直于玩家到墙方向）
  angle: number;   // 玩家到墙中心的方向角，墙体绕此旋转使长边垂直于该连线
  life: number;
  maxLife: number;
  damage: number;
  lastTickTime: number;
  active: boolean;
}

export interface IceWallEffect {
  x: number;
  y: number;
  width: number;   // 厚度
  height: number;  // 长度
  angle: number;   // 玩家到墙中心的方向角
  life: number;
  maxLife: number;
  active: boolean;
}

export interface BeamLaserEffect {
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;  // 光束宽度
  life: number;
  maxLife: number;
  damage: number;
  hits: Set<number>;
  active: boolean;
}

// 冲天光柱特效（炮塔升级 / 高级拾取 / 精英击杀）
export interface LightPillar {
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
  baseRadius: number;
  beamHeight: number;
  ringRadius: number;     // 地面震荡环当前半径
  ringMaxRadius: number;  // 地面震荡环最大半径
  active: boolean;
}

export interface GameState {
  player: Player;
  projectiles: Projectile[];
  enemies: Enemy[];
  pickups: Pickup[];
  particles: Particle[];
  camera: Camera;
  wave: number;
  waveTimer: number;
  gameTime: number;
  kills: number;
  combo: number;
  maxCombo: number;
  isPaused: boolean;
  isGameOver: boolean;
  showUpgrade: boolean;
  isMobile: boolean;
  mobileZoom: number;
  pendingStartUpgrades: number;
  touchInput: {
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    joyX: number;
    joyY: number;
  };
  upgradeOptions: UpgradeOption[];
  screenShake: number;
  damageFlash: number;
  mapWidth: number;
  mapHeight: number;
  terrains: Terrain[];
  summons: Summon[];
  meleeEffects: MeleeEffect[];
  flameEffects: FlameEffect[];
  enemyProjectiles: Projectile[];
  lightningEffects: LightningEffect[];
  fireWallEffects: FireWallEffect[];
  iceWallEffects: IceWallEffect[];
  beamLaserEffects: BeamLaserEffect[];
  lightPillars: LightPillar[];
  continuousSpawnTimer: number;
  groupSpawnTimer: number;
  eliteSpawnTimer: number;
  killsRecent: number;
  killRateTimer: number;
  killRatePerMin: number;
  enemyCap: number;
  dynamicExpMult: number;
  deathAnim: number;
  deathDebris: { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; color: string; life?: number }[];
  bossSpawnCount: number;
  waveDifficultyMult: number;
  bossBombs: { x: number; y: number; timer: number; maxTimer: number; radius: number; damage: number; active: boolean }[];
}

export interface UpgradeOption {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'weapon' | 'stat' | 'passive' | 'skill';
  apply: (player: Player) => void;
}

export type GameScreen = 'title' | 'prepare' | 'game' | 'gameover' | 'upgrade';

export interface RunRecord {
  date: string;
  survivalTime: number;
  kills: number;
  maxCombo: number;
  levelReached: number;
}
