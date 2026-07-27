import type { GameState, Player, Terrain } from '../types';
import { initParticles, setParticleSpawnRate, setHeavyEffectRate } from '../particles';
import { detectMobile, setupMobileEffects, getInput } from './input';
import { resetId, getNextId } from './id';
import { MAP_WIDTH, MAP_HEIGHT } from './constants';
import { generateTerrains } from '../entities/terrain';
import { clamp, randRange, circlePolygonCollision } from '../math';
import { WEAPON_CONFIGS } from '../weapons';

export function createGameState(startWeapon: string): GameState {
  initParticles();
  resetId();

  const mapWidth = MAP_WIDTH;
  const mapHeight = MAP_HEIGHT;

  const isMobile = detectMobile();
  setupMobileEffects(isMobile);
  const mobileZoom = 1;

  const terrains: Terrain[] = generateTerrains(mapWidth, mapHeight);

  // 确保玩家出生点不卡在地形里
  let spawnX = mapWidth / 2;
  let spawnY = mapHeight / 2;
  const playerSpawnRadius = 50;
  let spawnBlocked = true;
  let spawnAttempts = 0;
  while (spawnBlocked && spawnAttempts < 60) {
    spawnBlocked = false;
    for (const t of terrains) {
      if (t.type !== 'obstacle') continue;
      if (circlePolygonCollision(spawnX, spawnY, playerSpawnRadius, t.x, t.y, t.vertices)) {
        spawnBlocked = true;
        break;
      }
    }
    if (spawnBlocked) {
      const a = Math.random() * Math.PI * 2;
      const r = 60 + spawnAttempts * 15;
      spawnX = mapWidth / 2 + Math.cos(a) * r;
      spawnY = mapHeight / 2 + Math.sin(a) * r;
      spawnAttempts++;
    }
  }
  spawnX = clamp(spawnX, 100, mapWidth - 100);
  spawnY = clamp(spawnY, 100, mapHeight - 100);

  const player: Player = {
    id: getNextId(),
    x: spawnX, y: spawnY,
    vx: 0, vy: 0,
    radius: 44,
    hp: 100, maxHp: 100, active: true,
    speed: 260,
    exp: 0, maxExp: 10, level: 1,
    weapons: [],
    upgrades: [],
    invincibleTimer: 0,
    armor: 0, maxArmor: 0,
    pickupRadius: 150,
    expGainMult: 1,
    timers: { heal: 0, shield: 0, invincible: 0, screenClear: 0 },
    shieldTimer: 0,
    berserkTimer: 0,
    enchants: { freeze: 0, burn: 0, pierce: 0 },
    passives: { regen: 0, vampirism: 0 },
    facing: 0,
    targetFacing: 0,
    walkCycle: 0,
    dustTimer: 0,
    moving: false,
    droneOrbit: 0,
  };

  const startWeaponId = (startWeapon as keyof typeof WEAPON_CONFIGS) || 'rifle';
  const cfg = WEAPON_CONFIGS[startWeaponId] || WEAPON_CONFIGS.rifle;
  player.weapons.push({ config: { ...cfg }, level: 1, lastFireTime: 0, heat: 0, aimAngle: 0, targetAngle: 0, fireFlash: 0 });

  return {
    player,
    projectiles: [],
    enemies: [],
    pickups: [],
    particles: [],
    camera: { x: player.x, y: player.y, targetX: player.x, targetY: player.y },
    wave: 1,
    waveTimer: 3,
    gameTime: 0,
    kills: 0,
    combo: 0,
    maxCombo: 0,
    isPaused: false,
    isGameOver: false,
    showUpgrade: false,
    isMobile,
    mobileZoom,
    pendingStartUpgrades: 0,
    touchInput: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, joyX: 0, joyY: 0 },
    upgradeOptions: [],
    screenShake: 0,
    damageFlash: 0,
    mapWidth,
    mapHeight,
    terrains,
    summons: [],
    meleeEffects: [],
    flameEffects: [],
    enemyProjectiles: [],
    lightningEffects: [],
    fireWallEffects: [],
    iceWallEffects: [],
    beamLaserEffects: [],
    lightPillars: [],
    continuousSpawnTimer: 0,
    groupSpawnTimer: 4,
    eliteSpawnTimer: 18,
    killsRecent: 0,
    killRateTimer: 0,
    killRatePerMin: 0,
    enemyCap: 90,
    dynamicExpMult: 1,
    deathAnim: 0,
    deathDebris: [],
    bossBombs: [],
    bossSpawnCount: 0,
    waveDifficultyMult: 1,
    difficultyAdjustTimer: 15,
  };
}
