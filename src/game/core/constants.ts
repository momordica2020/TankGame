// 全局游戏常量，集中管理便于后续扩展时调整数值

export const SKILL_CD = { heal: 30, shield: 25, invincible: 60, screenClear: 45 } as const;
export const SKILL_DURATION = { shield: 8, invincible: 5 } as const;

export const TURRET_MAX_COUNT = 4;
export const TURRET_DEPLOY_INTERVAL = 12;
export const TURRET_TAUNT_INTERVAL = 5;
export const TURRET_TAUNT_RADIUS = 400;

export const MAP_WIDTH = 2500;
export const MAP_HEIGHT = 2500;
