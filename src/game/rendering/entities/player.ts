import type { GameState, WeaponInstance } from '../../types';
import { clamp } from '../../math';
import { getSlotMount } from '../../weapons';

export function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState) {
  const p = state.player;
  if (!p.active) return;

  ctx.save();
  ctx.translate(p.x, p.y);

  // ---- 身体组：旋转到移动方向（local 前方 = -y）----
  ctx.save();
  const bodyRot = p.facing + Math.PI / 2;
  ctx.rotate(bodyRot);

  const bodyW = p.radius * 0.8; // 横向半宽（窄，战列舰式）
  const bodyH = p.radius * 1.35;  // 纵向半长（长）

  // ---- 主身体：长方形厚重机甲躯干（纵向长、横向窄，战列舰式）----
  const bodyColor = p.invincibleTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0 ? '#ffffff' : '#2d4a36';
  const bodyLight = p.invincibleTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0 ? '#dddddd' : '#4a7a5c';
  const bodyDark = p.invincibleTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0 ? '#bbbbbb' : '#1f3527';

  // 身体底层（深色装甲板）
  ctx.fillStyle = bodyDark;
  drawRoundedRect(ctx, -bodyW, -bodyH, bodyW * 2, bodyH * 2, 6);
  ctx.fill();
  // 身体中层（主装甲）
  ctx.fillStyle = bodyColor;
  drawRoundedRect(ctx, -bodyW * 0.88, -bodyH * 0.94, bodyW * 1.76, bodyH * 1.88, 5);
  ctx.fill();
  // 身体顶层（高光装甲，纵向长条）
  ctx.fillStyle = bodyLight;
  drawRoundedRect(ctx, -bodyW * 0.6, -bodyH * 0.82, bodyW * 1.2, bodyH * 1.5, 4);
  ctx.fill();

  // 前装甲鼻（指示朝向，向 -y 前方突出）
  ctx.fillStyle = bodyDark;
  ctx.beginPath();
  ctx.moveTo(-bodyW * 0.45, -bodyH * 0.85);
  ctx.lineTo(bodyW * 0.45, -bodyH * 0.85);
  ctx.lineTo(bodyW * 0.28, -bodyH * 1.18);
  ctx.lineTo(-bodyW * 0.28, -bodyH * 1.18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(-bodyW * 0.38, -bodyH * 0.9);
  ctx.lineTo(bodyW * 0.38, -bodyH * 0.9);
  ctx.lineTo(bodyW * 0.22, -bodyH * 1.12);
  ctx.lineTo(-bodyW * 0.22, -bodyH * 1.12);
  ctx.closePath();
  ctx.fill();

  // 装甲板螺栓细节
  ctx.fillStyle = bodyDark;
  const boltPositions = [
    [-bodyW * 0.8, -bodyH * 0.8], [bodyW * 0.8, -bodyH * 0.8],
    [-bodyW * 0.8, bodyH * 0.8], [bodyW * 0.8, bodyH * 0.8],
    [-bodyW * 0.3, -bodyH * 0.85], [bodyW * 0.3, -bodyH * 0.85],
  ];
  for (const [bx, by] of boltPositions) {
    ctx.beginPath();
    ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 前置核心：发光传感器眼（位于前装甲鼻后方）
  ctx.fillStyle = '#ffcc44';
  ctx.shadowColor = '#ffcc44';
  ctx.shadowBlur = 12;
  drawRoundedRect(ctx, -10, -bodyH * 0.45 - 6, 20, 12, 4);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffee88';
  drawRoundedRect(ctx, -6, -bodyH * 0.45 - 3, 12, 6, 2);
  ctx.fill();

  // ---- 按 slot 绘制各武器炮塔（每把武器有独立的 aimAngle 和外观）----
  // 战列舰式布置：两侧 + 中轴线
  const slotWeapons: Record<string, WeaponInstance[]> = {
    left_arm: [], right_arm: [], back: [], shoulder: [], core: [],
  };
  for (const w of p.weapons) {
    slotWeapons[w.config.slot].push(w);
  }

  // 两侧前部炮塔（左/右臂）
  const laMount = getSlotMount('left_arm', p.radius);
  const raMount = getSlotMount('right_arm', p.radius);
  drawArmTurret(ctx, laMount.x, laMount.y, slotWeapons.left_arm, -1, bodyRot);
  drawArmTurret(ctx, raMount.x, raMount.y, slotWeapons.right_arm, 1, bodyRot);

  // 两侧后部炮塔（肩部，两座）
  const sh0 = getSlotMount('shoulder', p.radius, 0);
  const sh1 = getSlotMount('shoulder', p.radius, 1);
  drawShoulderTurret(ctx, sh0.x, sh0.y, slotWeapons.shoulder.slice(0, 1), bodyRot);
  drawShoulderTurret(ctx, sh1.x, sh1.y, slotWeapons.shoulder.slice(1), bodyRot);

  // 中轴线后部主炮塔（背负式大型）
  const backMount = getSlotMount('back', p.radius);
  drawBackTurret(ctx, backMount.x, backMount.y, slotWeapons.back, bodyRot);

  // 中轴线核心炮塔（中央小型，特殊武器）
  const coreMount = getSlotMount('core', p.radius);
  drawCoreTurret(ctx, coreMount.x, coreMount.y, slotWeapons.core, bodyRot);

  // 结束身体组旋转（无人机与光环用世界帧）
  ctx.restore();

  // 环绕无人机（浮游炮）可视化
  const droneWeapon = p.weapons.find((w) => w.config.id === 'drone');
  if (droneWeapon) {
    const droneCount = Math.min(droneWeapon.level + 2, 7);
    const orbitR = p.radius * 2.2;
    for (let i = 0; i < droneCount; i++) {
      const a = p.droneOrbit + (i * Math.PI * 2) / droneCount;
      const dx = Math.cos(a) * orbitR;
      const dy = Math.sin(a) * orbitR;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(a + Math.PI / 2);
      // 无人机主体
      ctx.fillStyle = '#1a2a4a';
      drawRoundedRect(ctx, -8, -6, 16, 12, 4);
      ctx.fill();
      // 顶部
      ctx.fillStyle = '#2a4a7a';
      drawRoundedRect(ctx, -5, -8, 10, 4, 2);
      ctx.fill();
      // 两侧推进器
      ctx.fillStyle = '#0a1525';
      drawRoundedRect(ctx, -11, -3, 3, 6, 1);
      ctx.fill();
      drawRoundedRect(ctx, 8, -3, 3, 6, 1);
      ctx.fill();
      // 底部发光炮口
      ctx.fillStyle = droneWeapon.config.color;
      ctx.shadowColor = droneWeapon.config.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, 5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // 护甲环
  if (p.armor > 0) {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 主动护盾（技能2）
  if (p.shieldTimer > 0) {
    const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(59, 130, 246, ${pulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(120, 180, 255, ${pulse * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 24, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 无敌（技能3）金色光环
  if (p.invincibleTimer > 0) {
    const pulse = Math.sin(Date.now() / 80) * 0.4 + 0.6;
    ctx.strokeStyle = `rgba(255, 221, 68, ${pulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

// 手臂式炮塔（挂在身体两侧）
function drawArmTurret(ctx: CanvasRenderingContext2D, x: number, y: number, weapons: WeaponInstance[], side: number, bodyRot: number) {
  if (weapons.length === 0) {
    // 没有武器也要画机械臂关节
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#1f3527';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d4a36';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  for (let i = 0; i < weapons.length; i++) {
    const w = weapons[i];
    const offY = (i - (weapons.length - 1) / 2) * 14;
    ctx.save();
    ctx.translate(x + side * 4, y + offY);
    // 关节底座
    ctx.fillStyle = '#1f3527';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d4a36';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    // 旋转到瞄准方向（世界 aimAngle，扣除身体旋转）
    ctx.rotate(w.aimAngle - bodyRot);
    // 炮管（根据武器类型有不同外观）
    drawWeaponBarrel(ctx, w, side, false, w.fireFlash);
    ctx.restore();
  }
}

// 肩部炮塔
function drawShoulderTurret(ctx: CanvasRenderingContext2D, x: number, y: number, weapons: WeaponInstance[], bodyRot: number) {
  if (weapons.length === 0) return;
  for (let i = 0; i < weapons.length; i++) {
    const w = weapons[i];
    ctx.save();
    ctx.translate(x, y - i * 4);
    // 方形炮塔底座
    ctx.fillStyle = '#1a2a20';
    drawRoundedRect(ctx, -11, -11, 22, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#2d4a36';
    drawRoundedRect(ctx, -8, -8, 16, 16, 3);
    ctx.fill();
    ctx.rotate(w.aimAngle - bodyRot);
    drawWeaponBarrel(ctx, w, 1, true, w.fireFlash);
    ctx.restore();
  }
}

// 背负式大型炮塔
function drawBackTurret(ctx: CanvasRenderingContext2D, x: number, y: number, weapons: WeaponInstance[], bodyRot: number) {
  if (weapons.length === 0) return;
  // 大型底座
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#1a2a20';
  drawRoundedRect(ctx, -22, -14, 44, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#2d4a36';
  drawRoundedRect(ctx, -18, -11, 36, 22, 5);
  ctx.fill();
  ctx.restore();
  // 每把武器一个炮座
  const spacing = 18;
  const totalW = (weapons.length - 1) * spacing;
  for (let i = 0; i < weapons.length; i++) {
    const w = weapons[i];
    const px = x - totalW / 2 + i * spacing;
    ctx.save();
    ctx.translate(px, y);
    ctx.fillStyle = '#1f3527';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(w.aimAngle - bodyRot);
    drawWeaponBarrel(ctx, w, 1, true, w.fireFlash);
    ctx.restore();
  }
}

// 核心炮塔（小，在身体中央）
function drawCoreTurret(ctx: CanvasRenderingContext2D, x: number, y: number, weapons: WeaponInstance[], bodyRot: number) {
  if (weapons.length === 0) return;
  for (let i = 0; i < weapons.length; i++) {
    const w = weapons[i];
    const offY = (i - (weapons.length - 1) / 2) * 10;
    ctx.save();
    ctx.translate(x, y + offY);
    ctx.fillStyle = '#1a2a20';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(w.aimAngle - bodyRot);
    drawWeaponBarrel(ctx, w, 1, false, w.fireFlash);
    ctx.restore();
  }
}

// 根据武器类型画不同外观的炮管
function drawWeaponBarrel(ctx: CanvasRenderingContext2D, w: WeaponInstance, side: number, isTurret: boolean, fireFlash: number) {
  const id = w.config.id;
  const color = w.config.color;
  const lvl = w.level;

  if (id === 'gatling') {
    // 加特林：多管旋转
    ctx.fillStyle = '#333';
    drawRoundedRect(ctx, 0, -5, 24, 10, 2);
    ctx.fill();
    // 6 根枪管
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + w.aimAngle * 3;
      const bx = 22 + Math.cos(a) * 2.5;
      const by = Math.sin(a) * 2.5;
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(bx, by, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // 炮口发光
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(24, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (id === 'laser') {
    // 激光炮：细长+能量槽
    ctx.fillStyle = '#223';
    drawRoundedRect(ctx, 0, -3, 28, 6, 1);
    ctx.fill();
    // 能量线圈
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6 + fireFlash * 0.4;
      ctx.fillRect(6 + i * 7, -4, 2, 8);
    }
    ctx.globalAlpha = 1;
    // 发射口光晕
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 + fireFlash * 25;
    ctx.beginPath();
    ctx.arc(28, 0, 3 + fireFlash * 2.5, 0, Math.PI * 2);
    ctx.fill();
    // 中心高光
    if (fireFlash > 0.1) {
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = fireFlash * 0.9;
      ctx.beginPath();
      ctx.arc(28, 0, 1.5 + fireFlash * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;
  } else if (id === 'shotgun') {
    // 霰弹枪：双管粗短
    ctx.fillStyle = '#442211';
    drawRoundedRect(ctx, 0, -5, 18, 4, 1);
    ctx.fill();
    drawRoundedRect(ctx, 0, 1, 18, 4, 1);
    ctx.fill();
    // 泵动护木
    ctx.fillStyle = '#663322';
    ctx.fillRect(8, -5, 5, 10);
    // 炮口
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(18, -3, 1.5, 0, Math.PI * 2);
    ctx.arc(18, 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (id === 'grenade') {
    // 榴弹炮：短粗大口径
    ctx.fillStyle = '#333';
    drawRoundedRect(ctx, 0, -6, 16, 12, 3);
    ctx.fill();
    // 大口径喇叭口
    ctx.fillStyle = '#222';
    drawRoundedRect(ctx, 12, -8, 8, 16, 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(20, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (id === 'flamethrower') {
    // 喷火器：粗管+燃料罐
    ctx.fillStyle = '#332211';
    drawRoundedRect(ctx, 0, -4, 20, 8, 2);
    ctx.fill();
    // 喷嘴
    ctx.fillStyle = '#552200';
    drawRoundedRect(ctx, 18, -6, 5, 12, 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(23, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (id === 'sword') {
    // 光剑：能量刃
    ctx.fillStyle = '#222';
    drawRoundedRect(ctx, 0, -2, 10, 4, 1);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    drawRoundedRect(ctx, 10, -1.5, 20, 3, 1);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (id === 'lightning') {
    // 闪电发射器：中心球状发射器，无炮管
    ctx.fillStyle = '#113';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    // 发射光晕
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 + fireFlash * 20;
    ctx.beginPath();
    ctx.arc(0, 0, 5 + fireFlash * 2, 0, Math.PI * 2);
    ctx.fill();
    // 外环辉光
    ctx.globalAlpha = 0.5 + fireFlash * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, 9 + fireFlash * 3, 0, Math.PI * 2);
    ctx.fill();
    // 中心爆闪
    if (fireFlash > 0.2) {
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = fireFlash * 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, 3 + fireFlash * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  } else if (id === 'beam_laser') {
    // 光束炮：中心聚焦发射器，无炮管
    ctx.fillStyle = '#221133';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    // 聚焦核心光晕
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 + fireFlash * 25;
    ctx.beginPath();
    ctx.arc(0, 0, 6 + fireFlash * 2.5, 0, Math.PI * 2);
    ctx.fill();
    // 外环辉光
    ctx.globalAlpha = 0.4 + fireFlash * 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, 12 + fireFlash * 4, 0, Math.PI * 2);
    ctx.fill();
    // 中心爆闪亮点
    if (fireFlash > 0.15) {
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = fireFlash * 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, 3.5 + fireFlash * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  } else if (id === 'drone') {
    // 无人机发射器
    ctx.fillStyle = '#112244';
    drawRoundedRect(ctx, 0, -4, 14, 8, 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillRect(12, -3, 3, 6);
    ctx.shadowBlur = 0;
  } else if (id === 'turret' || id === 'auto_turret' || id === 'shield_drone' || id === 'mine') {
    // 部署类：半球形能量发生器，无炮管
    // 底座
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(0, 1, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // 半球壳体
    ctx.fillStyle = shadeColor(color, -20);
    ctx.beginPath();
    ctx.arc(0, -1, 7, Math.PI, 0);
    ctx.lineTo(7, 1);
    ctx.lineTo(-7, 1);
    ctx.closePath();
    ctx.fill();
    // 顶部能量核心
    const pulse = Math.sin(Date.now() / 250 + (color.charCodeAt(1))) * 0.3 + 0.7;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10 * pulse;
    ctx.beginPath();
    ctx.arc(0, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    // 内部亮点
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = pulse * 0.8;
    ctx.beginPath();
    ctx.arc(-1, -4, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  } else if (id === 'fire_wall' || id === 'ice_wall') {
    // 法术发射器
    ctx.fillStyle = '#1a1a2f';
    drawRoundedRect(ctx, 0, -4, 12, 8, 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    drawRoundedRect(ctx, 10, -3, 6, 6, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (id === 'skeleton') {
    // 召唤法阵
    ctx.fillStyle = '#2a2a20';
    drawRoundedRect(ctx, 0, -4, 12, 8, 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(12, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // 默认：步枪样式
    ctx.fillStyle = '#333';
    drawRoundedRect(ctx, 0, -2.5, 20, 5, 1);
    ctx.fill();
    // 瞄准镜
    ctx.fillStyle = '#222';
    drawRoundedRect(ctx, 4, -4.5, 6, 3, 1);
    ctx.fill();
    // 枪托
    ctx.fillStyle = '#443322';
    drawRoundedRect(ctx, -6, -2, 7, 4, 1);
    ctx.fill();
    // 炮口发光
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 7;
    ctx.beginPath();
    ctx.arc(20, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // 等级标记（炮管上的小环）
  if (lvl >= 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(10, 0, 5, -0.5, 0.5);
    ctx.stroke();
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
