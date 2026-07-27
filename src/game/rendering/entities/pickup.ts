import type { GameState } from '../../types';

export function drawPickups(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const pk of state.pickups) {
    if (!pk.active) continue;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    const lifeRatio = pk.life / pk.maxLife;
    let alpha = 1;
    if (lifeRatio < 0.3) {
      alpha = Math.sin(Date.now() / 125) * 0.5 + 0.5;
      alpha = Math.max(alpha, 0.3);
    }
    ctx.globalAlpha = alpha;
    const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8;
    const spin = Date.now() / 500;

    // 特殊掉落物品阶光环底（醒目化）
    const isSpecial = pk.type !== 'exp' && pk.type !== 'health';
    if (isSpecial) {
      // 品阶颜色：bomb/vacuum=蓝，shield_pickup=蓝，screen_clear=金
      let ringColor: string;
      let ringGlow: string;
      if (pk.type === 'screen_clear') {
        ringColor = '#ffdd44';
        ringGlow = '#ffaa00';
      } else if (pk.type === 'bomb') {
        ringColor = '#ff8833';
        ringGlow = '#ff4400';
      } else if (pk.type === 'vacuum') {
        ringColor = '#44ddff';
        ringGlow = '#2299cc';
      } else {
        ringColor = '#3b82f6';
        ringGlow = '#2255aa';
      }
      const ringR = pk.radius * 1.8;
      // 外层柔光晕
      const haloGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, ringR * 1.5);
      haloGrad.addColorStop(0, `${ringGlow}aa`);
      haloGrad.addColorStop(0.5, `${ringGlow}44`);
      haloGrad.addColorStop(1, `${ringGlow}00`);
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(0, 0, ringR * 1.5, 0, Math.PI * 2);
      ctx.fill();
      // 内层实色光环
      ctx.shadowColor = ringGlow;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, 0, Math.PI * 2);
      ctx.stroke();
      // 旋转的品阶装饰小点
      ctx.globalAlpha = 1;
      ctx.fillStyle = ringColor;
      for (let i = 0; i < 4; i++) {
        const a = spin * 0.7 + (i / 4) * Math.PI * 2;
        const dx = Math.cos(a) * ringR;
        const dy = Math.sin(a) * ringR;
        ctx.beginPath();
        ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    if (pk.type === 'exp') {
      // 经验：正六边形晶体，大小/亮度随经验值变化，普通小兵的更小更暗
      const r = pk.radius;
      const isSmall = r <= 7; // 普通小兵掉落
      const isMedium = r > 7 && r <= 10;
      const glow = isSmall ? 2 : isMedium ? 4 : 7;
      const baseColor = isSmall ? '#2a6b4a' : isMedium ? '#339966' : '#44bb66';
      const innerColor = isSmall ? '#558866' : isMedium ? '#77aa88' : '#99ccaa';
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = glow;
      ctx.fillStyle = baseColor;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + spin * 0.3;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = innerColor;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + spin * 0.3;
        const px = Math.cos(a) * r * 0.45;
        const py = Math.sin(a) * r * 0.45;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (pk.type === 'health') {
      // 生命包：长方形药瓶 + 白色十字
      ctx.shadowColor = '#aa3333';
      ctx.shadowBlur = 5;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-pk.radius * 0.6, -pk.radius * 0.8, pk.radius * 1.2, pk.radius * 1.6);
      ctx.fillStyle = '#cc2244';
      ctx.fillRect(-pk.radius * 0.3, -pk.radius, pk.radius * 0.6, pk.radius * 0.25);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-pk.radius * 0.15, -pk.radius * 0.45, pk.radius * 0.3, pk.radius * 0.9);
      ctx.fillRect(-pk.radius * 0.4, -pk.radius * 0.1, pk.radius * 0.8, pk.radius * 0.2);
      ctx.shadowBlur = 0;
    } else if (pk.type === 'bomb') {
      // 炸弹拾取：方形炸药包 + 引信
      ctx.shadowColor = '#aa4400';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(-pk.radius, -pk.radius * 0.8, pk.radius * 2, pk.radius * 1.6);
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2;
      ctx.strokeRect(-pk.radius, -pk.radius * 0.8, pk.radius * 2, pk.radius * 1.6);
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(-pk.radius * 0.7, -pk.radius * 0.2, pk.radius * 1.4, pk.radius * 0.4);
      // 引信
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -pk.radius * 0.8);
      ctx.lineTo(3, -pk.radius * 0.8 - 4);
      ctx.lineTo(-2, -pk.radius * 0.8 - 8);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 220, 50, ${pulse})`;
      ctx.beginPath();
      ctx.arc(-2, -pk.radius * 0.8 - 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (pk.type === 'vacuum') {
      // 吸物特效：三角漩涡（带旋转）
      ctx.shadowColor = '#226688';
      ctx.shadowBlur = 7;
      ctx.strokeStyle = `rgba(68, 221, 255, ${pulse})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const r = pk.radius * (1 + i * 0.4);
        ctx.arc(0, 0, r, Date.now() / 200 + i, Date.now() / 200 + i + Math.PI * 1.5);
        ctx.stroke();
      }
      ctx.fillStyle = '#aaeeff';
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + spin;
        const px = Math.cos(a) * 4;
        const py = Math.sin(a) * 4;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (pk.type === 'shield_pickup') {
      // 护盾拾取：六角形盾
      ctx.shadowColor = '#2255aa';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * pk.radius;
        const py = Math.sin(a) * pk.radius * 0.85;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#aaeeff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * pk.radius * 0.35;
        const py = Math.sin(a) * pk.radius * 0.3;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (pk.type === 'screen_clear') {
      // 清屏拾取：八角星形
      ctx.shadowColor = '#887722';
      ctx.shadowBlur = 7;
      ctx.fillStyle = '#ffdd44';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? pk.radius : pk.radius * 0.55;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}
