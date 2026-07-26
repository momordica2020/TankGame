import { create } from 'zustand';
import type { GameScreen, RunRecord, Player } from '../game/types';

export interface PermanentUpgrade {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costMult: number;
}

export const PERMANENT_UPGRADES: PermanentUpgrade[] = [
  { id: 'max_hp', name: '强化体魄', description: '最大生命值 +5%/级', maxLevel: 10, baseCost: 50, costMult: 1.5 },
  { id: 'damage', name: '火力增幅', description: '所有武器伤害 +3%/级', maxLevel: 10, baseCost: 80, costMult: 1.6 },
  { id: 'fire_rate', name: '高速扳机', description: '所有武器射速 +3%/级', maxLevel: 10, baseCost: 80, costMult: 1.6 },
  { id: 'move_speed', name: '战术机动', description: '移动速度 +4%/级', maxLevel: 8, baseCost: 60, costMult: 1.5 },
  { id: 'pickup_range', name: '磁力收集', description: '拾取范围 +10%/级', maxLevel: 5, baseCost: 40, costMult: 1.4 },
  { id: 'start_exp', name: '先发优势', description: '初始等级 +1/级', maxLevel: 5, baseCost: 100, costMult: 1.8 },
  { id: 'exp_gain', name: '经验加速', description: '经验获取 +8%/级', maxLevel: 8, baseCost: 70, costMult: 1.5 },
  { id: 'armor', name: '装甲强化', description: '初始护甲 +10/级', maxLevel: 5, baseCost: 90, costMult: 1.7 },
];

interface SaveData {
  highScore: number;
  totalKills: number;
  bestRuns: RunRecord[];
  coins: number;
  totalCoins: number;
  upgrades: Record<string, number>;
}

interface GameStore {
  screen: GameScreen;
  selectedWeapon: string | null;
  lastRun: {
    survivalTime: number;
    kills: number;
    maxCombo: number;
    levelReached: number;
    coinsEarned: number;
  } | null;
  save: SaveData;
  setScreen: (s: GameScreen) => void;
  selectWeapon: (w: string) => void;
  setLastRun: (run: GameStore['lastRun']) => void;
  updateSave: (run: { survivalTime: number; kills: number; maxCombo: number; levelReached: number }) => void;
  buyUpgrade: (id: string) => boolean;
  getUpgradeCost: (id: string) => number;
  applyPermanentUpgrades: (player: Player) => Player;
  getStartLevel: () => number;
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem('survivor_save');
    if (raw) {
      const data = JSON.parse(raw);
      return {
        highScore: data.highScore || 0,
        totalKills: data.totalKills || 0,
        bestRuns: data.bestRuns || [],
        coins: data.coins ?? 0,
        totalCoins: data.totalCoins ?? 0,
        upgrades: data.upgrades || {},
      };
    }
  } catch { /* ignore */ }
  return { highScore: 0, totalKills: 0, bestRuns: [], coins: 0, totalCoins: 0, upgrades: {} };
}

function writeSave(s: SaveData) {
  localStorage.setItem('survivor_save', JSON.stringify(s));
}

function calcCoins(run: { survivalTime: number; kills: number; maxCombo: number; levelReached: number }): number {
  return Math.floor(
    run.survivalTime * 2 +
    run.kills * 0.5 +
    run.maxCombo * 5 +
    run.levelReached * 10
  );
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'title',
  selectedWeapon: null,
  lastRun: null,
  save: loadSave(),

  setScreen: (s) => set({ screen: s }),

  selectWeapon: (w) => set({ selectedWeapon: w }),

  setLastRun: (run) => set({ lastRun: run }),

  updateSave: (run) => {
    const prev = get().save;
    const coinsEarned = calcCoins(run);
    const runs = [...prev.bestRuns, {
      date: new Date().toLocaleDateString(),
      ...run,
    }].sort((a, b) => b.survivalTime - a.survivalTime).slice(0, 10);
    const next: SaveData = {
      highScore: Math.max(prev.highScore, run.survivalTime),
      totalKills: prev.totalKills + run.kills,
      bestRuns: runs,
      coins: prev.coins + coinsEarned,
      totalCoins: prev.totalCoins + coinsEarned,
      upgrades: prev.upgrades,
    };
    writeSave(next);
    set({ save: next, lastRun: { ...run, coinsEarned } });
  },

  getUpgradeCost: (id) => {
    const up = PERMANENT_UPGRADES.find((u) => u.id === id);
    if (!up) return 0;
    const level = get().save.upgrades[id] || 0;
    if (level >= up.maxLevel) return -1;
    return Math.floor(up.baseCost * Math.pow(up.costMult, level));
  },

  buyUpgrade: (id) => {
    const up = PERMANENT_UPGRADES.find((u) => u.id === id);
    if (!up) return false;
    const level = get().save.upgrades[id] || 0;
    if (level >= up.maxLevel) return false;
    const cost = get().getUpgradeCost(id);
    if (get().save.coins < cost) return false;

    const next: SaveData = {
      ...get().save,
      coins: get().save.coins - cost,
      upgrades: { ...get().save.upgrades, [id]: level + 1 },
    };
    writeSave(next);
    set({ save: next });
    return true;
  },

  applyPermanentUpgrades: (player) => {
    const ups = get().save.upgrades;
    const p = { ...player };

    const hpLevel = ups.max_hp || 0;
    p.maxHp = p.maxHp * (1 + hpLevel * 0.05);
    p.hp = p.maxHp;

    const dmgLevel = ups.damage || 0;
    p.weapons = p.weapons.map((w) => ({
      ...w,
      config: { ...w.config, damage: w.config.damage * (1 + dmgLevel * 0.03) },
    }));

    const fireLevel = ups.fire_rate || 0;
    p.weapons = p.weapons.map((w) => ({
      ...w,
      config: { ...w.config, fireRate: w.config.fireRate * (1 + fireLevel * 0.03) },
    }));

    const speedLevel = ups.move_speed || 0;
    p.speed = p.speed * (1 + speedLevel * 0.04);

    const pickupLevel = ups.pickup_range || 0;
    p.pickupRadius = p.pickupRadius * (1 + pickupLevel * 0.1);

    const armorLevel = ups.armor || 0;
    p.maxArmor = armorLevel * 10;
    p.armor = p.maxArmor;

    const expLevel = ups.exp_gain || 0;
    p.expGainMult = 1 + expLevel * 0.08;

    return p;
  },

  getStartLevel: () => {
    const lvl = get().save.upgrades.start_exp || 0;
    return lvl;
  },
}));
