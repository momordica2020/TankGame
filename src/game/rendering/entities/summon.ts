import type { GameState } from '../../types';

export function drawSummons(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const s of state.summons) {
    if (!s.active) continue;
    ctx.save();
    ctx.translate(s.x, s.y);

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, s.radius * 0.5, s.radius * 0.8, s.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (s.weapon.id === 'mine') {
      // 地雷：六边形能量发生器，中心光球，无炮管
      const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
      // 外框底座（六边形）
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const rx = Math.cos(a) * s.radius;
        const ry = Math.sin(a) * s.radius * 0.6;
        if (i === 0) ctx.moveTo(rx, ry + 2);
        else ctx.lineTo(rx, ry + 2);
      }
      ctx.closePath();
      ctx.fill();
      // 主壳体（六边形，上移）
      ctx.fillStyle = '#555';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const rx = Math.cos(a) * s.radius * 0.75;
        const ry = Math.sin(a) * s.radius * 0.45;
        if (i === 0) ctx.moveTo(rx, ry - s.radius * 0.1);
        else ctx.lineTo(rx, ry - s.radius * 0.1);
      }
      ctx.closePath();
      ctx.fill();
      // 中心能量核心（光球）
      ctx.fillStyle = `rgba(255, 60, 60, ${pulse})`;
      ctx.shadowColor = '#ff3333';
      ctx.shadowBlur = 12 * pulse;
      ctx.beginPath();
      ctx.arc(0, -s.radius * 0.1, s.radius * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 200, 200, ${pulse})`;
      ctx.beginPath();
      ctx.arc(0, -s.radius * 0.1, s.radius * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 六边形边缘装饰点
      ctx.fillStyle = '#222';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const rx = Math.cos(a) * s.radius * 0.5;
        const ry = Math.sin(a) * s.radius * 0.3 - s.radius * 0.1;
        ctx.beginPath();
        ctx.arc(rx, ry, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (s.type === 'turret') {
      // 固定炮塔：八边形能量发生器，顶部旋转棱镜，无炮管
      // 底座
      ctx.fillStyle = '#444';
      drawRoundedRect(ctx, -s.radius, -s.radius * 0.2, s.radius * 2, s.radius * 0.7, 4);
      ctx.fill();
      ctx.fillStyle = '#333';
      drawRoundedRect(ctx, -s.radius * 0.8, s.radius * 0.25, s.radius * 1.6, s.radius * 0.25, 3);
      ctx.fill();
      // 八边形发生器主体
      ctx.save();
      ctx.translate(0, -s.radius * 0.15);
      ctx.fillStyle = shadeColor(s.weapon.color, -15);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rx = Math.cos(a) * s.radius * 0.55;
        const ry = Math.sin(a) * s.radius * 0.45;
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.fill();
      // 顶部旋转棱镜（朝向目标）
      const target = state.enemies.find((e) => e.active && Math.hypot(e.x - s.x, e.y - s.y) < s.weapon.range);
      const prismAngle = target ? Math.atan2(target.y - s.y, target.x - s.x) : 0;
      ctx.save();
      ctx.rotate(prismAngle);
      // 棱镜基座
      ctx.fillStyle = s.weapon.color;
      ctx.beginPath();
      ctx.moveTo(-s.radius * 0.3, -s.radius * 0.25);
      ctx.lineTo(s.radius * 0.3, -s.radius * 0.25);
      ctx.lineTo(s.radius * 0.2, s.radius * 0.15);
      ctx.lineTo(-s.radius * 0.2, s.radius * 0.15);
      ctx.closePath();
      ctx.fill();
      // 发射口光球（朝向正前方）
      ctx.fillStyle = shadeColor(s.weapon.color, 40);
      ctx.shadowColor = s.weapon.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, -s.radius * 0.25, s.radius * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
      // 中心能量核心
      ctx.fillStyle = shadeColor(s.weapon.color, 30);
      ctx.shadowColor = s.weapon.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, -s.radius * 0.05, s.radius * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      // 召唤物不显示头顶血条
    } else if (s.type === 'shield_drone') {
      // 护盾浮游机：菱形能量发生器，核心发光，无炮管
      // 外框（菱形）
      ctx.fillStyle = shadeColor(s.weapon.color, -30);
      ctx.beginPath();
      ctx.moveTo(0, -s.radius * 0.6);
      ctx.lineTo(s.radius * 0.7, 0);
      ctx.lineTo(0, s.radius * 0.6);
      ctx.lineTo(-s.radius * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      // 内框
      ctx.fillStyle = s.weapon.color;
      ctx.beginPath();
      ctx.moveTo(0, -s.radius * 0.45);
      ctx.lineTo(s.radius * 0.52, 0);
      ctx.lineTo(0, s.radius * 0.45);
      ctx.lineTo(-s.radius * 0.52, 0);
      ctx.closePath();
      ctx.fill();
      // 中心能量核心（光球）
      ctx.fillStyle = '#d0f0ff';
      ctx.shadowColor = '#44ddff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 护盾光环
      ctx.strokeStyle = 'rgba(68, 221, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(68, 221, 255, 0.2)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      // 侧面能量喷口
      ctx.fillStyle = '#223';
      ctx.beginPath();
      ctx.arc(-s.radius * 0.72, 0, 2.5, 0, Math.PI * 2);
      ctx.arc(s.radius * 0.72, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.type === 'auto_turret') {
      // 自动炮塔：十二边形能量塔，顶部三重能量环，无炮管
      // 底座
      ctx.fillStyle = '#443344';
      drawRoundedRect(ctx, -s.radius, -s.radius * 0.2, s.radius * 2, s.radius * 0.7, 4);
      ctx.fill();
      // 十二边形塔身
      ctx.save();
      ctx.translate(0, -s.radius * 0.1);
      ctx.fillStyle = shadeColor(s.weapon.color, -25);
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const rx = Math.cos(a) * s.radius * 0.55;
        const ry = Math.sin(a) * s.radius * 0.5;
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.fill();
      // 内层
      ctx.fillStyle = shadeColor(s.weapon.color, -10);
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
        const rx = Math.cos(a) * s.radius * 0.4;
        const ry = Math.sin(a) * s.radius * 0.36;
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.fill();
      // 顶部旋转能量环（朝向目标）
      const target = state.enemies.find((e) => e.active && Math.hypot(e.x - s.x, e.y - s.y) < s.weapon.range);
      const ringAngle = target ? Math.atan2(target.y - s.y, target.x - s.x) : 0;
      ctx.save();
      ctx.rotate(ringAngle);
      // 外环
      ctx.strokeStyle = s.weapon.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      // 中环
      ctx.strokeStyle = shadeColor(s.weapon.color, 20);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      // 核心光球
      ctx.fillStyle = shadeColor(s.weapon.color, 40);
      ctx.shadowColor = s.weapon.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, s.radius * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 朝向指示点
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.radius * 0.3, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.restore();

      // 嘲讽光环
      if (s.tauntRadius > 0) {
        const pulse = Math.sin(Date.now() / 300) * 0.2 + 0.3;
        ctx.strokeStyle = `rgba(255, 100, 170, ${pulse})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, s.tauntRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (s.type === 'skeleton') {
      // 骷髅兵：骨架+武器
      // 腿
      ctx.fillStyle = '#ddd0c0';
      drawRoundedRect(ctx, -s.radius * 0.25, s.radius * 0.4, s.radius * 0.18, s.radius * 0.5, 2);
      ctx.fill();
      drawRoundedRect(ctx, s.radius * 0.07, s.radius * 0.4, s.radius * 0.18, s.radius * 0.5, 2);
      ctx.fill();
      // 肋骨/身体
      ctx.fillStyle = s.weapon.color;
      drawRoundedRect(ctx, -s.radius * 0.4, -s.radius * 0.3, s.radius * 0.8, s.radius * 0.7, 3);
      ctx.fill();
      // 肋骨条纹
      ctx.strokeStyle = '#c0b0a0';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-s.radius * 0.35, -s.radius * 0.15 + i * s.radius * 0.2);
        ctx.lineTo(s.radius * 0.35, -s.radius * 0.15 + i * s.radius * 0.2);
        ctx.stroke();
      }
      // 头骨
      ctx.fillStyle = '#eee0d0';
      ctx.beginPath();
      ctx.arc(0, -s.radius * 0.5, s.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      // 眼窝
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.ellipse(-s.radius * 0.15, -s.radius * 0.5, s.radius * 0.1, s.radius * 0.12, 0, 0, Math.PI * 2);
      ctx.ellipse(s.radius * 0.15, -s.radius * 0.5, s.radius * 0.1, s.radius * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      // 发光眼
      ctx.fillStyle = '#ff3300';
      ctx.shadowColor = '#ff3300';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(-s.radius * 0.15, -s.radius * 0.5, 2, 0, Math.PI * 2);
      ctx.arc(s.radius * 0.15, -s.radius * 0.5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 下颌
      ctx.fillStyle = '#ddd0c0';
      drawRoundedRect(ctx, -s.radius * 0.15, -s.radius * 0.25, s.radius * 0.3, s.radius * 0.15, 2);
      ctx.fill();
      // 骨斧（非管状武器）
      ctx.fillStyle = '#ddd0c0';
      ctx.beginPath();
      ctx.moveTo(s.radius * 0.3, -s.radius * 0.6);
      ctx.lineTo(s.radius * 0.7, -s.radius * 0.4);
      ctx.lineTo(s.radius * 0.6, s.radius * 0.1);
      ctx.lineTo(s.radius * 0.3, s.radius * 0.2);
      ctx.closePath();
      ctx.fill();
      // 骨斧锯齿
      ctx.fillStyle = s.weapon.color;
      ctx.shadowColor = s.weapon.color;
      ctx.shadowBlur = 4;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(s.radius * 0.55, -s.radius * 0.4 + i * s.radius * 0.22);
        ctx.lineTo(s.radius * 0.75, -s.radius * 0.35 + i * s.radius * 0.22);
        ctx.lineTo(s.radius * 0.55, -s.radius * 0.3 + i * s.radius * 0.22);
        ctx.closePath();
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // 召唤物不显示头顶血条
    }

    ctx.restore();
  }
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}
