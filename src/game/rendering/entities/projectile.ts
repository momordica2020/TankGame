import type { GameState } from '../../types';

export function drawProjectiles(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const proj of state.projectiles) {
    if (!proj.active) continue;
    ctx.save();
    ctx.translate(proj.x, proj.y);

    if (proj.type === 'laser') {
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 4 + proj.size;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(proj.angle) * 18, -Math.sin(proj.angle) * 18);
      ctx.lineTo(Math.cos(proj.angle) * 18, Math.sin(proj.angle) * 18);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-Math.cos(proj.angle) * 14, -Math.sin(proj.angle) * 14);
      ctx.lineTo(Math.cos(proj.angle) * 14, Math.sin(proj.angle) * 14);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (proj.type === 'grenade') {
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(0, 0, proj.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(0, 0, proj.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, proj.size + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(0, 0, proj.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, proj.size * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = proj.color;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = proj.size * 0.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-Math.cos(proj.angle) * 18, -Math.sin(proj.angle) * 18);
      ctx.stroke();
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = proj.size * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-Math.cos(proj.angle) * 10, -Math.sin(proj.angle) * 10);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}

export function drawEnemyProjectiles(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const proj of state.enemyProjectiles) {
    if (!proj.active) continue;
    ctx.save();
    ctx.translate(proj.x, proj.y);

    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.arc(0, 0, proj.size, 0, Math.PI * 2);
    ctx.fill();
    // 白色高光内核
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, proj.size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // 拖尾
    ctx.strokeStyle = proj.color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = proj.size * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-Math.cos(proj.angle) * 10, -Math.sin(proj.angle) * 10);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}
