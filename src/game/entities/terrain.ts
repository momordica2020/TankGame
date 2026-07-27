import type { Terrain } from '../types';
import { randRange } from '../math';
import { getNextId } from '../core/id';

// 生成不规则多边形顶点（局部坐标，中心 0,0）
export function makeIrregularPoly(sides: number, baseR: number, jitter: number): { x: number; y: number }[] {
  const verts: { x: number; y: number }[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const r = baseR * (1 - jitter / 2 + Math.random() * jitter);
    verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return verts;
}

export function darkenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.max(0, Math.min(255, Math.round(r * (1 - amount))));
  const ng = Math.max(0, Math.min(255, Math.round(g * (1 - amount * 1.2))));
  const nb = Math.max(0, Math.min(255, Math.round(b * (1 - amount * 1.5))));
  return '#' + nr.toString(16).padStart(2, '0') + ng.toString(16).padStart(2, '0') + nb.toString(16).padStart(2, '0');
}

export function generateTerrains(mapW: number, mapH: number): Terrain[] {
  const terrains: Terrain[] = [];

  // 软石（低硬度，容易破坏）
  const softRockCount = 12;
  for (let i = 0; i < softRockCount; i++) {
    const w = randRange(50, 100);
    const h = randRange(50, 100);
    const x = randRange(120, mapW - 120 - w);
    const y = randRange(120, mapH - 120 - h);
    const avgR = Math.min(w, h) * 0.5;
    const sides = Math.floor(randRange(5, 8));
    const vertices = makeIrregularPoly(sides, avgR, 0.3);
    const hp = Math.floor(40 + avgR * 1.2);
    terrains.push({
      id: getNextId(), type: 'obstacle', variant: 'soft_rock',
      x: x + w / 2, y: y + h / 2,
      width: w, height: h,
      hp, maxHp: hp, destructible: true, vertices,
    });
  }

  // 硬石（高硬度，难以破坏）
  const hardRockCount = 8;
  for (let i = 0; i < hardRockCount; i++) {
    const w = randRange(70, 150);
    const h = randRange(70, 150);
    const x = randRange(150, mapW - 150 - w);
    const y = randRange(150, mapH - 150 - h);
    const avgR = Math.min(w, h) * 0.5;
    const sides = Math.floor(randRange(6, 10));
    const vertices = makeIrregularPoly(sides, avgR, 0.25);
    const hp = Math.floor(160 + avgR * 3);
    terrains.push({
      id: getNextId(), type: 'obstacle', variant: 'hard_rock',
      x: x + w / 2, y: y + h / 2,
      width: w, height: h,
      hp, maxHp: hp, destructible: true, vertices,
    });
  }

  // 金属残骸（极高硬度）
  const metalCount = 3;
  for (let i = 0; i < metalCount; i++) {
    const w = randRange(90, 160);
    const h = randRange(60, 120);
    const x = randRange(200, mapW - 200 - w);
    const y = randRange(200, mapH - 200 - h);
    const avgR = Math.min(w, h) * 0.5;
    const sides = Math.floor(randRange(7, 11));
    const vertices = makeIrregularPoly(sides, avgR, 0.2);
    const hp = Math.floor(350 + avgR * 4);
    terrains.push({
      id: getNextId(), type: 'obstacle', variant: 'metal',
      x: x + w / 2, y: y + h / 2,
      width: w, height: h,
      hp, maxHp: hp, destructible: true, vertices,
    });
  }

  // 枯树（中等硬度，较细）
  const treeCount = 15;
  for (let i = 0; i < treeCount; i++) {
    const w = randRange(35, 55);
    const h = randRange(35, 55);
    const x = randRange(100, mapW - 100 - w);
    const y = randRange(100, mapH - 100 - h);
    const avgR = Math.min(w, h) * 0.5;
    const sides = Math.floor(randRange(7, 10));
    const vertices = makeIrregularPoly(sides, avgR, 0.15);
    const hp = Math.floor(60 + avgR * 1.5);
    terrains.push({
      id: getNextId(), type: 'obstacle', variant: 'tree',
      x: x + w / 2, y: y + h / 2,
      width: w, height: h,
      hp, maxHp: hp, destructible: true, vertices,
    });
  }

  // 沼泽（减速带，不规则形状，不可破坏）
  for (let i = 0; i < 7; i++) {
    const w = randRange(120, 240);
    const h = randRange(120, 240);
    const x = randRange(120, mapW - 120 - w);
    const y = randRange(120, mapH - 120 - h);
    const avgR = Math.min(w, h) * 0.5;
    const sides = Math.floor(randRange(8, 13));
    const vertices = makeIrregularPoly(sides, avgR, 0.3);
    terrains.push({
      id: getNextId(), type: 'slowzone',
      x: x + w / 2, y: y + h / 2,
      width: w, height: h,
      hp: 0, maxHp: 0, destructible: false, vertices,
    });
  }
  return terrains;
}
