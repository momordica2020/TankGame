import type { GameState, Camera } from '../../types';

export function drawGround(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera, cw: number, ch: number) {
  // 荒原底色渐变
  const grad = ctx.createLinearGradient(cam.x - cw / 2, cam.y - ch / 2, cam.x + cw / 2, cam.y + ch / 2);
  grad.addColorStop(0, '#2d241a');
  grad.addColorStop(0.5, '#352a1e');
  grad.addColorStop(1, '#2a2016');
  ctx.fillStyle = grad;
  ctx.fillRect(cam.x - cw / 2, cam.y - ch / 2, cw, ch);

  // 荒原斑驳纹理（基于伪随机的泥土斑点）
  const tileSize = 160;
  const startX = Math.floor((cam.x - cw / 2) / tileSize) * tileSize;
  const startY = Math.floor((cam.y - ch / 2) / tileSize) * tileSize;
  for (let tx = startX; tx < cam.x + cw / 2; tx += tileSize) {
    for (let ty = startY; ty < cam.y + ch / 2; ty += tileSize) {
      // 用坐标作种子的伪随机
      const seed = Math.sin(tx * 0.013 + ty * 0.017) * 43758.5453;
      const r1 = seed - Math.floor(seed);
      const seed2 = Math.sin(tx * 0.031 - ty * 0.023) * 23421.631;
      const r2 = seed2 - Math.floor(seed2);
      // 大块暗斑
      ctx.fillStyle = `rgba(20, 15, 10, ${0.1 + r1 * 0.15})`;
      ctx.beginPath();
      ctx.arc(tx + tileSize * 0.3 + r1 * 40, ty + tileSize * 0.4 + r2 * 30, 25 + r1 * 20, 0, Math.PI * 2);
      ctx.fill();
      // 亮斑
      ctx.fillStyle = `rgba(90, 70, 50, ${0.05 + r2 * 0.08})`;
      ctx.beginPath();
      ctx.arc(tx + tileSize * 0.6 + r2 * 30, ty + tileSize * 0.7 + r1 * 25, 20 + r2 * 15, 0, Math.PI * 2);
      ctx.fill();
      // 细小石子
      const pebbleCount = 6 + Math.floor(r1 * 8);
      for (let i = 0; i < pebbleCount; i++) {
        const ps = Math.sin(tx * 0.1 + i * 0.7 + ty * 0.09) * 12345.678;
        const ps2 = Math.cos(ty * 0.11 + i * 0.5 + tx * 0.08) * 98765.432;
        const pr = ps - Math.floor(ps);
        const pr2 = ps2 - Math.floor(ps2);
        const px = tx + pr * tileSize;
        const py = ty + pr2 * tileSize;
        const psize = 1.5 + pr * 3;
        ctx.fillStyle = `rgba(${60 + pr * 30}, ${50 + pr * 25}, ${40 + pr * 20}, 0.4)`;
        ctx.beginPath();
        ctx.ellipse(px, py, psize, psize * 0.7, pr * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
