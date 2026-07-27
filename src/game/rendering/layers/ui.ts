import type { GameState } from '../../types';

export function drawMinimap(ctx: CanvasRenderingContext2D, state: GameState, cw: number, ch: number) {
  const size = 120;
  const pad = 16;
  const x = cw - size - pad;
  const y = ch - size - pad;
  const scaleX = size / state.mapWidth;
  const scaleY = size / state.mapHeight;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = '#4a7c59';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, size, size);

  // 地形
  for (const t of state.terrains) {
    if (t.type === 'obstacle') ctx.fillStyle = '#3a3a42';
    else if (t.type === 'slowzone') ctx.fillStyle = 'rgba(120, 80, 40, 0.5)';
    else ctx.fillStyle = 'rgba(74, 124, 89, 0.4)';
    ctx.fillRect(x + t.x * scaleX, y + t.y * scaleY, t.width * scaleX, t.height * scaleY);
  }

  // 玩家
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.arc(x + state.player.x * scaleX, y + state.player.y * scaleY, 3, 0, Math.PI * 2);
  ctx.fill();

  // 召唤物
  for (const s of state.summons) {
    if (!s.active) continue;
    ctx.fillStyle = s.type === 'skeleton' ? '#ddddcc' : '#ffaa00';
    ctx.beginPath();
    ctx.arc(x + s.x * scaleX, y + s.y * scaleY, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 特殊拾取物（高亮）
  for (const pk of state.pickups) {
    if (!pk.active || pk.type === 'exp') continue;
    ctx.fillStyle = pk.type === 'screen_clear' ? '#ffdd44'
      : pk.type === 'bomb' ? '#ff6600'
      : pk.type === 'vacuum' ? '#44ddff'
      : '#3b82f6';
    ctx.beginPath();
    ctx.arc(x + pk.x * scaleX, y + pk.y * scaleY, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 敌人
  for (const e of state.enemies) {
    if (!e.active) continue;
    const isBoss = e.type === 'boss';
    if (isBoss) {
      // Boss：发光的大红色点
      ctx.shadowColor = '#ff2222';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x + e.x * scaleX, y + e.y * scaleY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x + e.x * scaleX, y + e.y * scaleY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 视野范围
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  const vw = cw * scaleX;
  const vh = ch * scaleY;
  ctx.strokeRect(x + (state.camera.x - cw / 2) * scaleX, y + (state.camera.y - ch / 2) * scaleY, vw, vh);

  ctx.restore();
}

export function drawOffscreenIndicators(ctx: CanvasRenderingContext2D, state: GameState, canvasW: number, canvasH: number) {
  const cam = state.camera;
  // 屏幕可视区域边界（留出边距）
  const margin = 40;
  const left = cam.x - canvasW / 2 + margin;
  const right = cam.x + canvasW / 2 - margin;
  const top = cam.y - canvasH / 2 + margin;
  const bottom = cam.y + canvasH / 2 - margin;

  for (const e of state.enemies) {
    if (!e.active) continue;
    const isBoss = e.type === 'boss';
    if (!isBoss && !e.isElite) continue;

    // 判断是否在屏幕外
    const onScreen = e.x > left && e.x < right && e.y > top && e.y < bottom;
    if (onScreen) continue;

    // 计算屏幕边缘交点
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const dx = e.x - cam.x;
    const dy = e.y - cam.y;
    const ang = Math.atan2(dy, dx);

    // 屏幕半尺寸（留边距）
    const halfW = canvasW / 2 - margin;
    const halfH = canvasH / 2 - margin;

    // 计算箭头位置在屏幕边缘上的坐标
    let ix: number, iy: number;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    // 用较小比例确定先碰到哪个边界
    const tx = halfW / Math.abs(cosA || 0.0001);
    const ty = halfH / Math.abs(sinA || 0.0001);
    const t = Math.min(tx, ty);
    ix = cx + cosA * t;
    iy = cy + sinA * t;

    const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8;

    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(ang);

    if (isBoss) {
      // Boss：大箭头 + 骷髅标记（放大1.8倍）
      ctx.scale(1.8, 1.8);
      ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 18;
      // 箭头
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-7, -12);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-7, 12);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // 骷髅标记（在箭头上方）
      ctx.rotate(-ang); // 取消旋转画骷髅
      ctx.fillStyle = `rgba(255, 220, 220, ${pulse})`;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 12;
      // 骷髅头圆形
      ctx.beginPath();
      ctx.arc(0, -20, 9, 0, Math.PI * 2);
      ctx.fill();
      // 眼窝
      ctx.fillStyle = '#330000';
      ctx.beginPath();
      ctx.arc(-3, -21, 2.5, 0, Math.PI * 2);
      ctx.arc(3, -21, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // 牙齿
      ctx.strokeStyle = '#330000';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-4, -15);
      ctx.lineTo(4, -15);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // 精英怪：中箭头（放大1.5倍）
      ctx.scale(1.5, 1.5);
      ctx.fillStyle = `rgba(255, 60, 60, ${pulse * 0.85})`;
      ctx.shadowColor = '#ff3333';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-5, -9);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-5, 9);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

export function drawTouchJoystick(ctx: CanvasRenderingContext2D, state: GameState, canvasW: number, canvasH: number) {
  const ti = state.touchInput;
  if (!ti.active) return;

  const baseX = ti.startX;
  const baseY = ti.startY;
  const stickX = baseX + ti.joyX;
  const stickY = baseY + ti.joyY;

  ctx.save();
  // 基座
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#4a7c59';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(baseX, baseY, 50, 0, Math.PI * 2);
  ctx.fill();
  // 基座内环
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#4a7c59';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(baseX, baseY, 35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 摇杆头
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#4a7c59';
  ctx.shadowColor = '#4a7c59';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(stickX, stickY, 22, 0, Math.PI * 2);
  ctx.fill();
  // 摇杆内圈
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#6ba97f';
  ctx.beginPath();
  ctx.arc(stickX, stickY, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}
