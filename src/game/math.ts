import type { Vec2 } from './types';

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalize(x: number, y: number): Vec2 {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

export function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1));
}

export function randPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function circleRectCollision(
  cx: number, cy: number, cr: number,
  rx: number, ry: number, rw: number, rh: number
): boolean {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx * dx + dy * dy) < (cr * cr);
}

// 点-多边形碰撞（射线法，顶点为局部坐标，tx/ty 为多边形中心）
export function pointInPolygon(px: number, py: number, tx: number, ty: number, verts: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = tx + verts[i].x, yi = ty + verts[i].y;
    const xj = tx + verts[j].x, yj = ty + verts[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// 圆-多边形碰撞检测
export function circlePolygonCollision(
  cx: number, cy: number, cr: number,
  tx: number, ty: number, verts: { x: number; y: number }[]
): boolean {
  if (pointInPolygon(cx, cy, tx, ty, verts)) return true;
  for (let i = 0; i < verts.length; i++) {
    const v1x = tx + verts[i].x, v1y = ty + verts[i].y;
    const v2x = tx + verts[(i + 1) % verts.length].x, v2y = ty + verts[(i + 1) % verts.length].y;
    const dx = v2x - v1x, dy = v2y - v1y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    let t = ((cx - v1x) * dx + (cy - v1y) * dy) / len2;
    t = clamp(t, 0, 1);
    const closestX = v1x + t * dx, closestY = v1y + t * dy;
    const distX = cx - closestX, distY = cy - closestY;
    if (distX * distX + distY * distY < cr * cr) return true;
  }
  return false;
}
