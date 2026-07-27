import type { GameState } from '../../types';
import { getActiveParticles } from '../../particles';
import { clamp } from '../../math';

export function drawMeleeEffects(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const m of state.meleeEffects) {
    if (!m.active) continue;
    ctx.save();
    ctx.translate(m.x, m.y);
    const alpha = m.life / m.maxLife;

    ctx.shadowColor = '#00ddff';
    ctx.shadowBlur = 20;
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = '#00ddff';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, m.radius, m.angle - m.arc / 2, m.angle + m.arc / 2);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, m.radius, m.angle - m.arc / 2, m.angle + m.arc / 2);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, m.radius * 0.7, m.angle - m.arc / 2, m.angle + m.arc / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}

export function drawFlameEffects(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const f of state.flameEffects) {
    if (!f.active) continue;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.angle);

    const alpha = f.life / 0.15;
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 25;
    ctx.globalAlpha = alpha * 0.75;

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, f.radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.15, '#ffff00');
    grad.addColorStop(0.4, '#ff9900');
    grad.addColorStop(0.7, '#ff3300');
    grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, f.radius, -0.3, 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = alpha * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, f.radius * 0.85, -0.25, 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}

export function drawBeamLasers(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const b of state.beamLaserEffects) {
    if (!b.active) continue;
    const alpha = b.life / b.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 20 + b.width * 2;
    // 外层光晕
    const halfW = b.width * 5;
    const grad = ctx.createLinearGradient(0, -halfW, 0, halfW);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.6)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, -halfW, b.length, halfW * 2);
    // 主光束
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, -b.width / 2, b.length, b.width);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

export function drawLightning(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const l of state.lightningEffects) {
    if (!l.active || l.points.length < 2) continue;
    const alpha = l.life / l.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = '#88ccff';
    ctx.shadowBlur = 15 + l.width * 5;

    // 外层光晕
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = l.width * 3;
    ctx.beginPath();
    ctx.moveTo(l.points[0].x, l.points[0].y);
    for (let i = 1; i < l.points.length; i++) {
      const p = l.points[i];
      const prev = l.points[i - 1];
      // 加入锯齿
      const segs = 5;
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const x = prev.x + (p.x - prev.x) * t + (Math.random() - 0.5) * 12;
        const y = prev.y + (p.y - prev.y) * t + (Math.random() - 0.5) * 12;
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // 主线
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = l.width;
    ctx.beginPath();
    ctx.moveTo(l.points[0].x, l.points[0].y);
    for (let i = 1; i < l.points.length; i++) {
      ctx.lineTo(l.points[i].x, l.points[i].y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

export function drawBossBombs(ctx: CanvasRenderingContext2D, state: GameState) {
  const t = Date.now();
  for (const b of state.bossBombs) {
    if (!b.active) continue;
    const progress = 1 - b.timer / b.maxTimer; // 0→1 从空到满
    const pulse = Math.sin(t / 100) * 0.2 + 0.8;
    const fillR = b.radius * progress; // 填充半径随时间扩张

    // 外层半透明警示底圈
    ctx.strokeStyle = `rgba(255, 30, 30, ${pulse * (0.35 + progress * 0.4)})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 12 * (0.5 + progress * 0.5);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 从中心扩张的实体红色填充圈
    if (fillR > 0) {
      const fillGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, fillR);
      fillGrad.addColorStop(0, `rgba(255, 200, 80, ${0.95 * pulse})`);
      fillGrad.addColorStop(0.4, `rgba(255, 80, 0, ${0.85 * pulse})`);
      fillGrad.addColorStop(0.8, `rgba(255, 20, 0, ${0.7 * pulse})`);
      fillGrad.addColorStop(1, 'rgba(180, 0, 0, 0)');
      ctx.fillStyle = fillGrad;
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur = 20 * progress;
      ctx.beginPath();
      ctx.arc(b.x, b.y, fillR, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 填充圈的前缘亮边
      ctx.strokeStyle = `rgba(255, 230, 120, ${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, fillR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 中心十字准星
    ctx.strokeStyle = `rgba(255, 120, 120, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - 10, b.y);
    ctx.lineTo(b.x + 10, b.y);
    ctx.moveTo(b.x, b.y - 10);
    ctx.lineTo(b.x, b.y + 10);
    ctx.stroke();

    // 内缩的虚线预警环（倒计时剩余比例）
    const warnR = b.radius * (1 - progress * 0.5);
    ctx.strokeStyle = `rgba(255, 180, 60, ${0.6 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(b.x, b.y, warnR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// 冲天光柱：地面震荡环 + 底部辉光 + 向屏幕上方延伸的光柱
export function drawLightPillars(ctx: CanvasRenderingContext2D, state: GameState, canvasH: number) {
  for (const lp of state.lightPillars) {
    if (!lp.active) continue;
    const p = lp.life / lp.maxLife; // 1→0
    const fade = p * p; // 平滑淡出
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 地面震荡环（扩张 + 淡出）
    if (lp.ringRadius > 1) {
      ctx.strokeStyle = lp.color;
      ctx.globalAlpha = fade * 0.8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, lp.ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      // 内层薄环
      ctx.globalAlpha = fade * 0.4;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, lp.ringRadius * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 底部辉光（径向渐变）
    ctx.globalAlpha = fade;
    const baseR = lp.baseRadius * (1 + (1 - p) * 0.6);
    const baseGrad = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, baseR);
    baseGrad.addColorStop(0, lp.color);
    baseGrad.addColorStop(0.5, lp.color);
    baseGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(lp.x, lp.y, baseR, 0, Math.PI * 2);
    ctx.fill();

    // 冲天光柱：动态计算高度，贯穿整个屏幕至顶端
    const screenTopY = state.camera.y - canvasH / 2;
    const beamH = Math.max(canvasH + 200, lp.y - screenTopY + 100);
    const beamW = lp.baseRadius * 0.9;
    const beamGrad = ctx.createLinearGradient(lp.x, lp.y, lp.x, lp.y - beamH);
    beamGrad.addColorStop(0, lp.color);
    beamGrad.addColorStop(0.15, lp.color);
    beamGrad.addColorStop(0.6, lp.color);
    beamGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = fade * 0.55;
    ctx.fillStyle = beamGrad;
    ctx.fillRect(lp.x - beamW, lp.y - beamH, beamW * 2, beamH);
    // 中央亮芯
    ctx.globalAlpha = fade * 0.9;
    const coreGrad = ctx.createLinearGradient(lp.x, lp.y, lp.x, lp.y - beamH);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.3, lp.color);
    coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coreGrad;
    ctx.fillRect(lp.x - beamW * 0.3, lp.y - beamH, beamW * 0.6, beamH);

    ctx.restore();
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const p of getActiveParticles()) {
    ctx.save();
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = p.size * 2;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

export function drawFireWalls(ctx: CanvasRenderingContext2D, state: GameState) {
  const t = Date.now();
  for (const fw of state.fireWallEffects) {
    if (!fw.active) continue;
    const lifeRatio = fw.life / fw.maxLife;
    const alpha = Math.min(1, lifeRatio * 1.5);
    const pulse = Math.sin(t / 100) * 0.15 + 0.85;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(fw.x, fw.y);
    ctx.rotate(fw.angle);

    const hw = fw.width / 2;   // 厚度半长
    const hh = fw.height / 2;  // 长度半长

    // 1. 地面熔岩辉光（沿墙长轴的椭圆）
    ctx.shadowColor = '#ff3300';
    ctx.shadowBlur = 40;
    const groundGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, fw.height * 0.6);
    groundGrad.addColorStop(0, 'rgba(255, 80, 0, 0.6)');
    groundGrad.addColorStop(0.5, 'rgba(200, 40, 0, 0.3)');
    groundGrad.addColorStop(1, 'rgba(80, 10, 0, 0)');
    ctx.fillStyle = groundGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, fw.width * 1.3, fw.height * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 2. 熔岩地裂纹路（沿长轴方向，正弦扰动）
    ctx.strokeStyle = `rgba(255, 120, 0, ${0.7 * pulse})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const y0 = -hh + (i + 0.5) * fw.height / 4;
      ctx.beginPath();
      ctx.moveTo(-hw * 1.4, y0);
      for (let s = 1; s <= 6; s++) {
        const fx = -hw * 1.4 + (s / 6) * hw * 2.8;
        const fy = y0 + Math.sin(t / 150 + i * 1.7 + s) * 3;
        ctx.lineTo(fx, fy);
      }
      ctx.stroke();
    }

    // 3. 主火焰墙体（厚度方向渐变，中心炽热）
    ctx.shadowColor = '#ff5500';
    ctx.shadowBlur = 30;
    const flameGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
    flameGrad.addColorStop(0, 'rgba(255, 60, 0, 0.1)');
    flameGrad.addColorStop(0.2, 'rgba(255, 100, 0, 0.7)');
    flameGrad.addColorStop(0.5, 'rgba(255, 230, 100, 0.95)');
    flameGrad.addColorStop(0.8, 'rgba(255, 100, 0, 0.7)');
    flameGrad.addColorStop(1, 'rgba(255, 60, 0, 0.1)');
    ctx.fillStyle = flameGrad;
    ctx.fillRect(-hw, -hh, fw.width, fw.height);

    // 4. 跳动火柱（沿长轴多根椭圆火舌）
    const colCount = 11;
    for (let i = 0; i < colCount; i++) {
      const y = -hh + (i + 0.5) * fw.height / colCount;
      const ph = Math.sin(t / 80 + i * 1.3) * 0.4 + 0.6;
      const w = fw.width * (0.7 + Math.sin(t / 100 + i) * 0.2);
      ctx.fillStyle = `rgba(255, 240, 150, ${ph * 0.8})`;
      ctx.beginPath();
      ctx.ellipse(0, y, w / 2, fw.height / colCount * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. 两侧外溢火舌（厚度方向±边缘跳动）
    ctx.fillStyle = `rgba(255, 180, 60, ${0.6 * pulse})`;
    const tongueCount = 13;
    for (let i = 0; i < tongueCount; i++) {
      const y = -hh + (i + 0.5) * fw.height / tongueCount;
      const flickR = Math.abs(Math.sin(t / 60 + i * 1.7)) * 5 + 5;
      const flickL = Math.abs(Math.sin(t / 65 + i * 1.9 + 1)) * 5 + 5;
      ctx.beginPath();
      ctx.arc(hw, y, flickR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-hw, y, flickL, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. 中央高亮炽热核
    ctx.fillStyle = `rgba(255, 255, 220, ${0.5 * pulse})`;
    ctx.fillRect(-hw * 0.25, -hh, fw.width * 0.5, fw.height);

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

export function drawIceWalls(ctx: CanvasRenderingContext2D, state: GameState) {
  const t = Date.now();
  for (const iw of state.iceWallEffects) {
    if (!iw.active) continue;
    const lifeRatio = iw.life / iw.maxLife;
    const alpha = Math.min(1, lifeRatio * 1.5);
    const shimmer = Math.sin(t / 150) * 0.15 + 0.85;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(iw.x, iw.y);
    ctx.rotate(iw.angle);

    const hw = iw.width / 2;
    const hh = iw.height / 2;

    // 1. 寒霜地面雾气（椭圆辉光）
    ctx.shadowColor = '#66ccff';
    ctx.shadowBlur = 30;
    const mistGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, iw.height * 0.6);
    mistGrad.addColorStop(0, 'rgba(150, 220, 255, 0.45)');
    mistGrad.addColorStop(0.5, 'rgba(80, 160, 220, 0.22)');
    mistGrad.addColorStop(1, 'rgba(30, 80, 140, 0)');
    ctx.fillStyle = mistGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, iw.width * 1.6, iw.height * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 2. 冰墙底座深色阴影
    ctx.fillStyle = 'rgba(40, 80, 120, 0.5)';
    ctx.fillRect(-hw - 2, -hh, iw.width + 4, iw.height);

    // 3. 冰墙主体（晶体感横向渐变，中心透亮）
    ctx.shadowColor = '#88ddff';
    ctx.shadowBlur = 20;
    const bodyGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
    bodyGrad.addColorStop(0, 'rgba(120, 200, 240, 0.6)');
    bodyGrad.addColorStop(0.3, 'rgba(180, 230, 255, 0.85)');
    bodyGrad.addColorStop(0.5, 'rgba(230, 250, 255, 0.95)');
    bodyGrad.addColorStop(0.7, 'rgba(180, 230, 255, 0.85)');
    bodyGrad.addColorStop(1, 'rgba(120, 200, 240, 0.6)');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(-hw, -hh, iw.width, iw.height);

    // 4. 冰晶切面棱线（菱形分块）
    ctx.strokeStyle = `rgba(180, 230, 255, ${0.6 * shimmer})`;
    ctx.lineWidth = 1;
    const facetCount = 6;
    for (let i = 0; i < facetCount; i++) {
      const y0 = -hh + (i / facetCount) * iw.height;
      const y1 = -hh + ((i + 1) / facetCount) * iw.height;
      const ym = (y0 + y1) / 2;
      ctx.beginPath();
      ctx.moveTo(-hw, y0);
      ctx.lineTo(hw * 0.3, ym);
      ctx.lineTo(-hw, y1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hw, y0);
      ctx.lineTo(-hw * 0.3, ym);
      ctx.lineTo(hw, y1);
      ctx.stroke();
    }

    // 5. 两侧锯齿冰刺（沿长边外凸）
    ctx.fillStyle = `rgba(220, 245, 255, ${0.9 * shimmer})`;
    const shardCount = 11;
    ctx.beginPath();
    ctx.moveTo(hw, -hh);
    for (let i = 0; i <= shardCount; i++) {
      const y = -hh + (i / shardCount) * iw.height;
      const tip = hw + 6 + Math.sin(t / 200 + i * 1.3) * 3 + (i % 2) * 4;
      ctx.lineTo(tip, y);
    }
    ctx.lineTo(hw, hh);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-hw, -hh);
    for (let i = 0; i <= shardCount; i++) {
      const y = -hh + (i / shardCount) * iw.height;
      const tip = -hw - 6 - Math.sin(t / 210 + i * 1.5 + 1) * 3 - (i % 2) * 4;
      ctx.lineTo(tip, y);
    }
    ctx.lineTo(-hw, hh);
    ctx.closePath();
    ctx.fill();

    // 6. 高光闪烁线（偶现）
    ctx.strokeStyle = `rgba(255, 255, 255, ${shimmer})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const y = -hh + (i + 1) * iw.height / 4;
      const flick = Math.sin(t / 120 + i * 2) * 0.5 + 0.5;
      if (flick > 0.5) {
        ctx.beginPath();
        ctx.moveTo(-hw * 0.6, y);
        ctx.lineTo(hw * 0.6, y);
        ctx.stroke();
      }
    }

    // 7. 两端封顶（更亮的冰帽）
    ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * shimmer})`;
    ctx.beginPath();
    ctx.moveTo(-hw, -hh);
    ctx.lineTo(hw, -hh);
    ctx.lineTo(hw * 0.5, -hh - 6);
    ctx.lineTo(-hw * 0.5, -hh - 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-hw, hh);
    ctx.lineTo(hw, hh);
    ctx.lineTo(hw * 0.5, hh + 6);
    ctx.lineTo(-hw * 0.5, hh + 6);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
