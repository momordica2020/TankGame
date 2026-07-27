import type { GameState, Enemy } from '../../types';

export function drawEnemies(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const e of state.enemies) {
    if (!e.active) continue;
    ctx.save();
    ctx.translate(e.x, e.y);

    // 生成动画：缩放渐入
    if (e.spawnAnim > 0) {
      const s = 1 - e.spawnAnim / 0.4;
      ctx.scale(s, s);
    }

    // Boss蓄力冲锋路径高亮警示（使用相对坐标，因 ctx 已平移到 Boss 位置）
    if (e.type === 'boss' && e.bossChargeState === 'charging' && e.bossChargeDir) {
      const chargeLen = 720; // 与实际冲锋距离一致：dashSpeed(600) * dashTime(1.2)
      const dirX = e.bossChargeDir.x;
      const dirY = e.bossChargeDir.y;
      const pulse = Math.sin(Date.now() / 80) * 0.3 + 0.7;
      const halfW = e.radius * 0.9;
      const perpX = -dirY;
      const perpY = dirX;
      const endLX = dirX * chargeLen; // 终点相对坐标
      const endLY = dirY * chargeLen;
      ctx.save();
      ctx.fillStyle = `rgba(255, 30, 30, ${pulse * 0.25})`;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.moveTo(perpX * halfW, perpY * halfW);
      ctx.lineTo(-perpX * halfW, -perpY * halfW);
      ctx.lineTo(endLX - perpX * halfW, endLY - perpY * halfW);
      ctx.lineTo(endLX + perpX * halfW, endLY + perpY * halfW);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 60, 60, ${pulse * 0.9})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 200, 0, ${pulse * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(endLX, endLY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, e.radius * 0.6, e.radius * 0.8, e.radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 精英怪/Boss脚下红色危险圆环（高亮度危险提示）
    if (e.isElite || e.type === 'boss') {
      const ringPulse = Math.sin(Date.now() / 200) * 0.25 + 0.75;
      const isBoss = e.type === 'boss';
      const glowMult = isBoss ? 2.5 : 1.5;
      // 外发光晕
      ctx.shadowColor = '#ff2222';
      ctx.shadowBlur = 30 * glowMult * ringPulse;
      ctx.strokeStyle = `rgba(255, 50, 50, ${ringPulse * 0.9})`;
      ctx.lineWidth = isBoss ? 5 : 3.5;
      ctx.beginPath();
      ctx.ellipse(0, e.radius * 0.6, e.radius * 1.25, e.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      // 中层亮环
      ctx.shadowBlur = 15 * glowMult;
      ctx.strokeStyle = `rgba(255, 100, 100, ${ringPulse * 0.7})`;
      ctx.lineWidth = isBoss ? 2.5 : 1.8;
      ctx.beginPath();
      ctx.ellipse(0, e.radius * 0.6, e.radius * 1.0, e.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      // 内层细闪环
      ctx.shadowBlur = 8 * glowMult;
      ctx.strokeStyle = `rgba(255, 200, 200, ${ringPulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, e.radius * 0.6, e.radius * 0.82, e.radius * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    const flashWhite = e.flashTimer > 0;
    const frozen = e.freezeTimer > 0;

    // ---- 精英怪：复杂形态 + 多炮台 ----
    if (e.isElite) {
      drawEliteBody(ctx, e, flashWhite, frozen);
      // 炮台（加大加亮，危险提示）
      for (const tur of e.turrets) {
        const tx = Math.cos(tur.angle) * tur.radius;
        const ty = Math.sin(tur.angle) * tur.radius;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(tur.angle);
        // 炮台底座（加大）
        ctx.fillStyle = '#1a0a0a';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        // 炮管（加粗加长）
        ctx.fillStyle = '#441111';
        drawRoundedRect(ctx, 0, -4, 14, 8, 2);
        ctx.fill();
        // 炮口危险闪光（加亮+脉冲）
        const turPulse = Math.sin(Date.now() / 150 + tur.offsetAngle * 3) * 0.3 + 0.7;
        ctx.fillStyle = tur.color;
        ctx.shadowColor = tur.color;
        ctx.shadowBlur = 15 * turPulse;
        ctx.beginPath();
        ctx.arc(14, 0, 4 * turPulse, 0, Math.PI * 2);
        ctx.fill();
        // 炮口核心白光
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = turPulse * 0.7;
        ctx.beginPath();
        ctx.arc(14, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.restore();
      }
      // 精英光环
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      // ---- 普通敌人：各类型写实质感 ----
      drawEnemyByType(ctx, e, flashWhite, frozen);
    }

    // HP bar —— 仅精英怪和Boss显示，普通小怪不显示
    if (e.isElite || e.type === 'boss') {
      const hpRatio = e.hp / e.maxHp;
      const barW = e.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      drawRoundedRect(ctx, -barW / 2, -e.radius - 12, barW, 4, 2);
      ctx.fill();
      ctx.fillStyle = hpRatio > 0.5 ? '#4ade80' : hpRatio > 0.25 ? '#facc15' : '#ef4444';
      drawRoundedRect(ctx, -barW / 2, -e.radius - 12, barW * hpRatio, 4, 2);
      ctx.fill();
    }

    // 状态效果图标
    let statusX = -e.radius;
    if (e.burnTimer > 0) {
      ctx.fillStyle = '#ff6600';
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(statusX + 2, -e.radius - 20);
      ctx.lineTo(statusX + 5, -e.radius - 24);
      ctx.lineTo(statusX + 8, -e.radius - 20);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      statusX += 10;
    }
    if (e.freezeTimer > 0) {
      ctx.fillStyle = '#66ccff';
      ctx.shadowColor = '#66ccff';
      ctx.shadowBlur = 6;
      ctx.fillRect(statusX + 2, -e.radius - 23, 6, 6);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

// 根据敌人类型绘制不同写实质感
function drawEnemyByType(ctx: CanvasRenderingContext2D, e: Enemy, flashWhite: boolean, frozen: boolean) {
  const mainColor = flashWhite ? '#ffffff' : (frozen ? '#aaddff' : e.color);
  const darkColor = flashWhite ? '#eeeeee' : (frozen ? '#88bbee' : shadeColor(e.color, -30));
  const lightColor = flashWhite ? '#ffffff' : (frozen ? '#ccddff' : shadeColor(e.color, 20));

  switch (e.type) {
    case 'basic': {
      ctx.fillStyle = mainColor;
      drawRoundedRect(ctx, -e.radius * 0.5, -e.radius * 0.3, e.radius, e.radius * 0.9, 3);
      ctx.fill();
      ctx.fillStyle = lightColor;
      ctx.beginPath();
      ctx.arc(0, -e.radius * 0.55, e.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.arc(0, -e.radius * 0.6, e.radius * 0.38, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = darkColor;
      drawRoundedRect(ctx, -e.radius * 0.35, e.radius * 0.55, e.radius * 0.25, e.radius * 0.4, 2);
      ctx.fill();
      drawRoundedRect(ctx, e.radius * 0.1, e.radius * 0.55, e.radius * 0.25, e.radius * 0.4, 2);
      ctx.fill();
      if (!flashWhite) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-e.radius * 0.12, -e.radius * 0.55, 2, 0, Math.PI * 2);
        ctx.arc(e.radius * 0.12, -e.radius * 0.55, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'fast': {
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.radius * 0.7, e.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = lightColor;
      ctx.beginPath();
      ctx.moveTo(e.radius * 0.5, -e.radius * 0.2);
      ctx.lineTo(e.radius * 0.8, 0);
      ctx.lineTo(e.radius * 0.5, e.radius * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = lightColor;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-e.radius * 0.6, -e.radius * 0.3 + i * e.radius * 0.3);
        ctx.lineTo(-e.radius, -e.radius * 0.3 + i * e.radius * 0.3);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (!flashWhite) {
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(e.radius * 0.3, -e.radius * 0.05, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      break;
    }
    case 'tank': {
      ctx.fillStyle = darkColor;
      drawRoundedRect(ctx, -e.radius * 0.4, e.radius * 0.4, e.radius * 0.3, e.radius * 0.5, 3);
      ctx.fill();
      drawRoundedRect(ctx, e.radius * 0.1, e.radius * 0.4, e.radius * 0.3, e.radius * 0.5, 3);
      ctx.fill();
      ctx.fillStyle = mainColor;
      drawRoundedRect(ctx, -e.radius * 0.7, -e.radius * 0.5, e.radius * 1.4, e.radius * 1.0, 5);
      ctx.fill();
      ctx.fillStyle = lightColor;
      drawRoundedRect(ctx, -e.radius * 0.5, -e.radius * 0.4, e.radius, e.radius * 0.5, 4);
      ctx.fill();
      ctx.fillStyle = darkColor;
      drawRoundedRect(ctx, -e.radius * 0.3, -e.radius * 0.9, e.radius * 0.6, e.radius * 0.4, 3);
      ctx.fill();
      if (!flashWhite) {
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 6;
        drawRoundedRect(ctx, -e.radius * 0.2, -e.radius * 0.75, e.radius * 0.4, 3, 1);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.arc(-e.radius * 0.7, -e.radius * 0.3, e.radius * 0.3, 0, Math.PI * 2);
      ctx.arc(e.radius * 0.7, -e.radius * 0.3, e.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'shooter': {
      ctx.fillStyle = mainColor;
      drawRoundedRect(ctx, -e.radius * 0.4, -e.radius * 0.2, e.radius * 0.8, e.radius * 0.8, 3);
      ctx.fill();
      ctx.fillStyle = lightColor;
      ctx.beginPath();
      ctx.arc(0, -e.radius * 0.5, e.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.arc(0, -e.radius * 0.5, e.radius * 0.33, Math.PI * 1.1, Math.PI * 1.9);
      ctx.fill();
      ctx.strokeStyle = '#6b4423';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.radius * 0.6, 0, e.radius * 0.5, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.strokeStyle = '#eeeeee';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.radius * 0.6, -e.radius * 0.5);
      ctx.lineTo(e.radius * 0.3, 0);
      ctx.lineTo(e.radius * 0.6, e.radius * 0.5);
      ctx.stroke();
      ctx.strokeStyle = '#8b5a2b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(e.radius * 0.3, 0);
      ctx.lineTo(e.radius * 0.9, 0);
      ctx.stroke();
      if (!flashWhite) {
        ctx.fillStyle = '#00ffaa';
        ctx.shadowColor = '#00ffaa';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(e.radius * 0.1, -e.radius * 0.5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      break;
    }
    case 'sniper': {
      ctx.fillStyle = mainColor;
      drawRoundedRect(ctx, -e.radius * 0.35, -e.radius * 0.3, e.radius * 0.7, e.radius * 0.9, 3);
      ctx.fill();
      ctx.fillStyle = darkColor;
      drawRoundedRect(ctx, -e.radius * 0.28, -e.radius * 0.75, e.radius * 0.56, e.radius * 0.4, 3);
      ctx.fill();
      if (!flashWhite) {
        ctx.fillStyle = '#ff3333';
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(e.radius * 0.1, -e.radius * 0.55, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = '#222';
      drawRoundedRect(ctx, e.radius * 0.2, -1.5, e.radius * 1.1, 3, 1);
      ctx.fill();
      ctx.fillStyle = '#333';
      drawRoundedRect(ctx, e.radius * 0.5, -3, e.radius * 0.3, 5, 1);
      ctx.fill();
      ctx.fillStyle = '#444';
      drawRoundedRect(ctx, e.radius * 1.2, -2.5, e.radius * 0.25, 5, 1);
      ctx.fill();
      break;
    }
    case 'shotgunner': {
      ctx.fillStyle = mainColor;
      drawRoundedRect(ctx, -e.radius * 0.6, -e.radius * 0.4, e.radius * 1.2, e.radius * 1.0, 5);
      ctx.fill();
      ctx.fillStyle = lightColor;
      ctx.beginPath();
      ctx.arc(0, -e.radius * 0.55, e.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = darkColor;
      drawRoundedRect(ctx, -e.radius * 0.4, -e.radius * 0.85, e.radius * 0.8, e.radius * 0.35, 3);
      ctx.fill();
      if (!flashWhite) {
        ctx.fillStyle = '#ffcc00';
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(-e.radius * 0.15, -e.radius * 0.55, 1.8, 0, Math.PI * 2);
        ctx.arc(e.radius * 0.15, -e.radius * 0.55, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = '#442211';
      drawRoundedRect(ctx, -e.radius * 0.9, -2, e.radius * 0.5, 4, 1);
      ctx.fill();
      drawRoundedRect(ctx, e.radius * 0.4, -2, e.radius * 0.5, 4, 1);
      ctx.fill();
      break;
    }
    case 'elite': {
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.moveTo(-e.radius * 0.8, -e.radius * 0.4);
      ctx.lineTo(-e.radius * 1.0, e.radius * 0.8);
      ctx.lineTo(e.radius * 1.0, e.radius * 0.8);
      ctx.lineTo(e.radius * 0.8, -e.radius * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = mainColor;
      drawRoundedRect(ctx, -e.radius * 0.55, -e.radius * 0.5, e.radius * 1.1, e.radius * 1.1, 4);
      ctx.fill();
      ctx.fillStyle = '#ffdd44';
      ctx.shadowColor = '#ffdd44';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, -e.radius * 0.2);
      ctx.lineTo(e.radius * 0.2, 0);
      ctx.lineTo(0, e.radius * 0.2);
      ctx.lineTo(-e.radius * 0.2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = darkColor;
      drawRoundedRect(ctx, -e.radius * 0.35, -e.radius * 0.95, e.radius * 0.7, e.radius * 0.45, 4);
      ctx.fill();
      if (!flashWhite) {
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 8;
        drawRoundedRect(ctx, -e.radius * 0.25, -e.radius * 0.75, e.radius * 0.5, 3, 1);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      break;
    }
    case 'boss': {
      ctx.fillStyle = darkColor;
      drawRoundedRect(ctx, -e.radius * 0.5, e.radius * 0.5, e.radius * 0.35, e.radius * 0.5, 4);
      ctx.fill();
      drawRoundedRect(ctx, e.radius * 0.15, e.radius * 0.5, e.radius * 0.35, e.radius * 0.5, 4);
      ctx.fill();
      ctx.fillStyle = mainColor;
      drawRoundedRect(ctx, -e.radius * 0.85, -e.radius * 0.6, e.radius * 1.7, e.radius * 1.2, 8);
      ctx.fill();
      ctx.fillStyle = lightColor;
      drawRoundedRect(ctx, -e.radius * 0.6, -e.radius * 0.5, e.radius * 1.2, e.radius * 0.5, 6);
      ctx.fill();
      ctx.fillStyle = darkColor;
      drawRoundedRect(ctx, -e.radius * 0.45, -e.radius * 1.0, e.radius * 0.9, e.radius * 0.45, 5);
      ctx.fill();
      ctx.fillStyle = '#1a1a1f';
      ctx.beginPath();
      ctx.moveTo(-e.radius * 0.45, -e.radius * 1.0);
      ctx.lineTo(-e.radius * 0.6, -e.radius * 1.4);
      ctx.lineTo(-e.radius * 0.3, -e.radius * 1.0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(e.radius * 0.45, -e.radius * 1.0);
      ctx.lineTo(e.radius * 0.6, -e.radius * 1.4);
      ctx.lineTo(e.radius * 0.3, -e.radius * 1.0);
      ctx.closePath();
      ctx.fill();
      if (!flashWhite) {
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        drawRoundedRect(ctx, -e.radius * 0.3, -e.radius * 0.85, e.radius * 0.2, 4, 2);
        ctx.fill();
        drawRoundedRect(ctx, e.radius * 0.1, -e.radius * 0.85, e.radius * 0.2, 4, 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.arc(-e.radius * 0.85, -e.radius * 0.3, e.radius * 0.35, 0, Math.PI * 2);
      ctx.arc(e.radius * 0.85, -e.radius * 0.3, e.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bruiser': {
      // 肉盾：超大型重甲怪物，圆胖体型
      // 腿（短粗）
      ctx.fillStyle = darkColor;
      drawRoundedRect(ctx, -e.radius * 0.45, e.radius * 0.5, e.radius * 0.35, e.radius * 0.45, 4);
      ctx.fill();
      drawRoundedRect(ctx, e.radius * 0.1, e.radius * 0.5, e.radius * 0.35, e.radius * 0.45, 4);
      ctx.fill();
      // 身体（巨大圆胖）
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.radius * 0.95, e.radius * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      // 腹部装甲
      ctx.fillStyle = lightColor;
      ctx.beginPath();
      ctx.ellipse(0, e.radius * 0.1, e.radius * 0.6, e.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // 肩部尖刺
      ctx.fillStyle = darkColor;
      ctx.beginPath();
      ctx.moveTo(-e.radius * 0.9, -e.radius * 0.3);
      ctx.lineTo(-e.radius * 1.1, -e.radius * 0.7);
      ctx.lineTo(-e.radius * 0.7, -e.radius * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(e.radius * 0.9, -e.radius * 0.3);
      ctx.lineTo(e.radius * 1.1, -e.radius * 0.7);
      ctx.lineTo(e.radius * 0.7, -e.radius * 0.5);
      ctx.closePath();
      ctx.fill();
      // 头（小而凶悍）
      ctx.fillStyle = darkColor;
      drawRoundedRect(ctx, -e.radius * 0.35, -e.radius * 0.75, e.radius * 0.7, e.radius * 0.35, 4);
      ctx.fill();
      // 小角
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.moveTo(-e.radius * 0.3, -e.radius * 0.75);
      ctx.lineTo(-e.radius * 0.4, -e.radius * 1.0);
      ctx.lineTo(-e.radius * 0.15, -e.radius * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(e.radius * 0.3, -e.radius * 0.75);
      ctx.lineTo(e.radius * 0.4, -e.radius * 1.0);
      ctx.lineTo(e.radius * 0.15, -e.radius * 0.75);
      ctx.closePath();
      ctx.fill();
      // 发光眼
      if (!flashWhite) {
        ctx.fillStyle = '#ff4400';
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(-e.radius * 0.15, -e.radius * 0.6, 3, 0, Math.PI * 2);
        ctx.arc(e.radius * 0.15, -e.radius * 0.6, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      break;
    }
    case 'splitter':
    case 'splitter_small': {
      // 分裂怪/小分裂怪：半透明果冻状史莱姆，带内部核心
      const isSmall = e.type === 'splitter_small';
      // 外层凝胶（半透明）
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.radius * 0.9, e.radius * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // 内层高光
      ctx.fillStyle = lightColor;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.ellipse(-e.radius * 0.2, -e.radius * 0.2, e.radius * 0.5, e.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // 底部凝胶滴
      ctx.fillStyle = mainColor;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.ellipse(-e.radius * 0.4, e.radius * 0.7, e.radius * 0.2, e.radius * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(e.radius * 0.3, e.radius * 0.65, e.radius * 0.18, e.radius * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      // 内部核心（发光）
      if (!flashWhite) {
        ctx.fillStyle = shadeColor(e.color, 30);
        ctx.shadowColor = e.color;
        ctx.shadowBlur = isSmall ? 6 : 10;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // 眼睛（在核心两侧）
      if (!flashWhite) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-e.radius * 0.2, -e.radius * 0.05, e.radius * 0.1, 0, Math.PI * 2);
        ctx.arc(e.radius * 0.2, -e.radius * 0.05, e.radius * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(-e.radius * 0.18, -e.radius * 0.05, e.radius * 0.05, 0, Math.PI * 2);
        ctx.arc(e.radius * 0.22, -e.radius * 0.05, e.radius * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    default: {
      ctx.fillStyle = mainColor;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// 颜色加深/变亮工具
function shadeColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// 绘制精英怪复杂身体（齿轮/星形多层结构）
function drawEliteBody(ctx: CanvasRenderingContext2D, e: Enemy, flashWhite: boolean, frozen: boolean) {
  const bodyColor = flashWhite ? '#ffffff' : (frozen ? '#aaddff' : e.color);
  const innerColor = flashWhite ? '#dddddd' : (frozen ? '#88bbee' : '#1a1a2a');
  // 外层：旋转的齿轮齿（10 齿）
  ctx.save();
  ctx.rotate(e.rotation);
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  const teeth = 10;
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? e.radius : e.radius * 0.78;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 中层：反向旋转的六边形
  ctx.save();
  ctx.rotate(-e.rotation * 1.5);
  ctx.fillStyle = innerColor;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = e.radius * 0.6;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 核心：发光眼
  const eyeColor = flashWhite ? '#ffffff' : '#ff3333';
  ctx.fillStyle = eyeColor;
  ctx.shadowColor = '#ff3333';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, 0, e.radius * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
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
