import type { GameState, Camera, Terrain, Enemy, WeaponInstance } from './types';
import { getActiveParticles } from './particles';
import { clamp, pointInPolygon } from './math';
import { getSlotMount } from './weapons';

const GROUND_COLOR = '#1a1a1f';
const GRID_COLOR = '#2a2a30';
const MAP_BORDER_COLOR = '#4a7c59';

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, canvasW: number, canvasH: number) {
  // 死亡后保持纯黑，避免闪回正常画面再跳结算
  if (state.isGameOver) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasW, canvasH);
    return;
  }

  const cam = state.camera;
  let shakeX = 0, shakeY = 0;
  if (state.screenShake > 0) {
    shakeX = (Math.random() - 0.5) * state.screenShake * 2;
    shakeY = (Math.random() - 0.5) * state.screenShake * 2;
  }

  // 死亡动画：画面逐渐缩进到玩家位置
  const dying = state.deathAnim > 0;
  let zoom = 1;
  // 移动端缩放：竖屏适配，拉远视野
  if (state.isMobile) {
    zoom = Math.min(1, (canvasW * 0.78) / 480);
  }
  if (dying) {
    // 从 1.0 缩放到 2.5
    const t = 1 - state.deathAnim / 1.6;
    zoom = 1 + t * 1.5;
  }

  // 清屏，防止 zoom<1 时未覆盖区域产生拖影
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.save();
  ctx.translate(canvasW / 2 + shakeX, canvasH / 2 + shakeY);
  if (zoom !== 1) ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);

  // 计算缩放后的实际视野世界尺寸，传给需要覆盖全屏的绘制函数
  const vw = canvasW / zoom;
  const vh = canvasH / zoom;
  drawGround(ctx, state, cam, vw, vh);
  drawTerrains(ctx, state, cam, vw, vh);
  drawIceWalls(ctx, state);
  drawFireWalls(ctx, state);
  drawPickups(ctx, state);
  drawSummons(ctx, state);
  drawEnemies(ctx, state);
  drawEnemyProjectiles(ctx, state);
  if (!dying) drawPlayer(ctx, state);
  drawProjectiles(ctx, state);
  drawMeleeEffects(ctx, state);
  drawFlameEffects(ctx, state);
  drawBeamLasers(ctx, state);
  drawBossBombs(ctx, state);
  drawLightning(ctx, state);
  drawLightPillars(ctx, state, canvasH);
  drawParticles(ctx, state);
  drawMapBorder(ctx, state);

  // 死亡碎片
  if (dying) drawDeathDebris(ctx, state);

  ctx.restore();

  // 死亡渐暗遮罩
  if (dying) {
    const t = 1 - state.deathAnim / 1.6;
    ctx.fillStyle = `rgba(0,0,0,${t * 0.6})`;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // 受击屏幕闪红
  if (state.damageFlash > 0) {
    ctx.fillStyle = `rgba(180, 20, 20, ${state.damageFlash * 0.35})`;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  if (!dying && !state.isMobile) drawMinimap(ctx, state, canvasW, canvasH);
  if (!dying) drawOffscreenIndicators(ctx, state, canvasW, canvasH);
  if (!dying && state.isMobile) drawTouchJoystick(ctx, state, canvasW, canvasH);
}

function drawDeathDebris(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const d of state.deathDebris) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.fillStyle = d.color;
    ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size * 0.6);
    ctx.restore();
  }
}

function drawGround(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera, cw: number, ch: number) {
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

function drawTerrains(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera, cw: number, ch: number) {
  for (const t of state.terrains) {
    // 视锥剔除（用包围盒）
    if (t.x + t.width / 2 < cam.x - cw / 2 || t.x - t.width / 2 > cam.x + cw / 2) continue;
    if (t.y + t.height / 2 < cam.y - ch / 2 || t.y - t.height / 2 > cam.y + ch / 2) continue;

    ctx.save();
    ctx.translate(t.x, t.y);

    if (t.type === 'obstacle') {
      const damaged = t.destructible && t.hp < t.maxHp;
      const dmgRatio = t.maxHp > 0 ? (t.maxHp - t.hp) / t.maxHp : 0;
      const v = t.variant || 'hard_rock';

      // 阴影底层
      let shadowColor = '#2a2a30';
      let bodyColor = '#4a4a52';
      let strokeColor = '#5a5a62';
      let crackColor = 'rgba(20, 15, 10, 0.8)';

      if (v === 'soft_rock') {
        shadowColor = damaged ? '#3d2e1f' : '#3a2e22';
        bodyColor = damaged ? '#7a5a3a' : '#6b5236';
        strokeColor = damaged ? '#8b6a45' : '#7a6040';
      } else if (v === 'hard_rock') {
        shadowColor = damaged ? '#2a2a20' : '#2e2e36';
        bodyColor = damaged ? '#555040' : '#4a4a52';
        strokeColor = damaged ? '#666050' : '#5a5a62';
      } else if (v === 'metal') {
        shadowColor = damaged ? '#2a2030' : '#252530';
        bodyColor = damaged ? '#6a5a7a' : '#5a5a6a';
        strokeColor = damaged ? '#8a7a9a' : '#7a7a8a';
      } else if (v === 'tree') {
        shadowColor = damaged ? '#1a1a10' : '#201a10';
        bodyColor = damaged ? '#5a4028' : '#4a3520';
        strokeColor = damaged ? '#7a5538' : '#6a4528';
      }

      // 阴影
      ctx.fillStyle = shadowColor;
      ctx.beginPath();
      for (let i = 0; i < t.vertices.length; i++) {
        const vv = t.vertices[i];
        if (i === 0) ctx.moveTo(vv.x, vv.y + 3);
        else ctx.lineTo(vv.x, vv.y + 3);
      }
      ctx.closePath();
      ctx.fill();
      // 主体
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      for (let i = 0; i < t.vertices.length; i++) {
        const vv = t.vertices[i];
        if (i === 0) ctx.moveTo(vv.x, vv.y);
        else ctx.lineTo(vv.x, vv.y);
      }
      ctx.closePath();
      ctx.fill();
      // 描边
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = v === 'tree' ? 1.5 : 2;
      ctx.beginPath();
      for (let i = 0; i < t.vertices.length; i++) {
        const vv = t.vertices[i];
        if (i === 0) ctx.moveTo(vv.x, vv.y);
        else ctx.lineTo(vv.x, vv.y);
      }
      ctx.closePath();
      ctx.stroke();

      // 树：顶部深色纹理（年轮/枝桠感）
      if (v === 'tree') {
        ctx.fillStyle = 'rgba(20, 15, 10, 0.4)';
        ctx.beginPath();
        for (let i = 0; i < t.vertices.length; i++) {
          const vv = t.vertices[i];
          if (i === 0) ctx.moveTo(vv.x * 0.55, vv.y * 0.55);
          else ctx.lineTo(vv.x * 0.55, vv.y * 0.55);
        }
        ctx.closePath();
        ctx.fill();
        // 顶部亮点
        ctx.fillStyle = 'rgba(120, 90, 60, 0.5)';
        ctx.beginPath();
        ctx.arc(-3, -3, Math.min(t.width, t.height) * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }

      // 金属：高光条
      if (v === 'metal') {
        ctx.strokeStyle = 'rgba(180, 180, 200, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const v0 = t.vertices[0];
        const v1 = t.vertices[Math.floor(t.vertices.length / 3)];
        ctx.moveTo(v0.x * 0.7, v0.y * 0.7);
        ctx.lineTo(v1.x * 0.7, v1.y * 0.7);
        ctx.stroke();
      }

      // 裂纹（受损时）
      if (damaged && dmgRatio > 0.15) {
        ctx.strokeStyle = `rgba(0, 0, 0, ${0.25 + dmgRatio * 0.5})`;
        ctx.lineWidth = 1.5;
        const crackCount = Math.floor(dmgRatio * 6) + 1;
        for (let i = 0; i < crackCount; i++) {
          const seed = (t.id * 13 + i * 7) % t.vertices.length;
          const v1 = t.vertices[seed];
          const v2 = t.vertices[(seed + Math.floor(t.vertices.length / 2)) % t.vertices.length];
          ctx.beginPath();
          ctx.moveTo(v1.x * 0.7, v1.y * 0.7);
          ctx.lineTo(v2.x * 0.55, v2.y * 0.55);
          ctx.stroke();
        }
      }
    } else if (t.type === 'slowzone') {
      // 减速带：不规则形状泥沼
      ctx.fillStyle = 'rgba(120, 80, 40, 0.35)';
      ctx.beginPath();
      for (let i = 0; i < t.vertices.length; i++) {
        const v = t.vertices[i];
        if (i === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      }
      ctx.closePath();
      ctx.fill();
      // 边缘描边
      ctx.strokeStyle = 'rgba(160, 110, 60, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      for (let i = 0; i < t.vertices.length; i++) {
        const v = t.vertices[i];
        if (i === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      // 泥沼纹理斑点
      ctx.fillStyle = 'rgba(100, 70, 30, 0.3)';
      const dotCount = Math.floor((t.width * t.height) / 2000);
      for (let i = 0; i < dotCount; i++) {
        const seed = t.id * 17 + i * 23;
        const a = (seed % 100) / 100 * Math.PI * 2;
        const r = ((seed * 3) % 100) / 100 * Math.min(t.width, t.height) * 0.4;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        ctx.beginPath();
        ctx.arc(px, py, 4 + (i % 3) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function drawMapBorder(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.strokeStyle = MAP_BORDER_COLOR;
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, state.mapWidth, state.mapHeight);
}

function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState) {
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

function drawEnemies(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const e of state.enemies) {
    if (!e.active) continue;
    ctx.save();
    ctx.translate(e.x, e.y);

    // 生成动画：缩放渐入
    if (e.spawnAnim > 0) {
      const s = 1 - e.spawnAnim / 0.4;
      ctx.scale(s, s);
    }

    // Boss蓄力冲锋路径高亮警示
    if (e.type === 'boss' && e.bossChargeState === 'charging' && e.bossChargeDir) {
      const chargeLen = 600;
      const endX = e.x + e.bossChargeDir.x * chargeLen;
      const endY = e.y + e.bossChargeDir.y * chargeLen;
      const pulse = Math.sin(Date.now() / 80) * 0.3 + 0.7;
      const halfW = e.radius * 0.9;
      const perpX = -e.bossChargeDir.y;
      const perpY = e.bossChargeDir.x;
      const p1x = e.x + perpX * halfW, p1y = e.y + perpY * halfW;
      const p2x = e.x - perpX * halfW, p2y = e.y - perpY * halfW;
      const p3x = endX - perpX * halfW, p3y = endY - perpY * halfW;
      const p4x = endX + perpX * halfW, p4y = endY + perpY * halfW;
      ctx.save();
      ctx.fillStyle = `rgba(255, 30, 30, ${pulse * 0.25})`;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.lineTo(p3x, p3y);
      ctx.lineTo(p4x, p4y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 60, 60, ${pulse * 0.9})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 200, 0, ${pulse * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255, 0, 0, ${pulse * 0.6})`;
      ctx.beginPath();
      ctx.arc(endX, endY, halfW * 0.6, 0, Math.PI * 2);
      ctx.fill();
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

    // HP bar
    const hpRatio = e.hp / e.maxHp;
    const barW = e.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    drawRoundedRect(ctx, -barW / 2, -e.radius - 12, barW, 4, 2);
    ctx.fill();
    ctx.fillStyle = hpRatio > 0.5 ? '#4ade80' : hpRatio > 0.25 ? '#facc15' : '#ef4444';
    drawRoundedRect(ctx, -barW / 2, -e.radius - 12, barW * hpRatio, 4, 2);
    ctx.fill();

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

function drawProjectiles(ctx: CanvasRenderingContext2D, state: GameState) {
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

function drawEnemyProjectiles(ctx: CanvasRenderingContext2D, state: GameState) {
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

function drawSummons(ctx: CanvasRenderingContext2D, state: GameState) {
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

      // HP bar
      if (s.hp < s.maxHp) {
        const barW = s.radius * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        drawRoundedRect(ctx, -barW / 2, -s.radius - 10, barW, 3, 1);
        ctx.fill();
        ctx.fillStyle = '#4ade80';
        drawRoundedRect(ctx, -barW / 2, -s.radius - 10, barW * (s.hp / s.maxHp), 3, 1);
        ctx.fill();
      }
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

      // HP bar
      if (s.hp < s.maxHp) {
        const barW = s.radius * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        drawRoundedRect(ctx, -barW / 2, -s.radius - 10, barW, 3, 1);
        ctx.fill();
        ctx.fillStyle = '#4ade80';
        drawRoundedRect(ctx, -barW / 2, -s.radius - 10, barW * (s.hp / s.maxHp), 3, 1);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

function drawMeleeEffects(ctx: CanvasRenderingContext2D, state: GameState) {
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

function drawFlameEffects(ctx: CanvasRenderingContext2D, state: GameState) {
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

function drawPickups(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const pk of state.pickups) {
    if (!pk.active) continue;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8;
    const spin = Date.now() / 500;

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

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState) {
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

function drawLightning(ctx: CanvasRenderingContext2D, state: GameState) {
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

function drawFireWalls(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const fw of state.fireWallEffects) {
    if (!fw.active) continue;
    const alpha = Math.min(1, fw.life / fw.maxLife * 1.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(fw.x, fw.y);
    ctx.shadowColor = '#ff4400';
    ctx.shadowBlur = 30;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, fw.width);
    grad.addColorStop(0, 'rgba(255, 240, 100, 0.85)');
    grad.addColorStop(0.3, 'rgba(255, 120, 0, 0.75)');
    grad.addColorStop(0.7, 'rgba(255, 40, 0, 0.5)');
    grad.addColorStop(1, 'rgba(120, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-fw.width / 2, -fw.height / 2, fw.width, fw.height);
    // 火焰波动
    const flickr = Math.sin(Date.now() / 80) * 4;
    ctx.fillStyle = 'rgba(255, 220, 80, 0.6)';
    ctx.fillRect(-fw.width / 2, -fw.height / 2 + flickr, fw.width, fw.height - flickr * 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawIceWalls(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const iw of state.iceWallEffects) {
    if (!iw.active) continue;
    const alpha = Math.min(1, iw.life / iw.maxLife * 1.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(iw.x, iw.y);
    ctx.shadowColor = '#66ccff';
    ctx.shadowBlur = 20;
    // 冰墙主体
    const grad = ctx.createLinearGradient(0, -iw.height / 2, 0, iw.height / 2);
    grad.addColorStop(0, 'rgba(170, 230, 255, 0.85)');
    grad.addColorStop(0.5, 'rgba(100, 180, 230, 0.7)');
    grad.addColorStop(1, 'rgba(60, 130, 200, 0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(-iw.width / 2, -iw.height / 2, iw.width, iw.height);
    // 冰晶边缘
    ctx.strokeStyle = '#aaeeff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-iw.width / 2, -iw.height / 2, iw.width, iw.height);
    // 冰晶高光
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = -iw.height / 2 + (i + 1) * iw.height / 5;
      ctx.beginPath();
      ctx.moveTo(-iw.width / 2, y);
      ctx.lineTo(-iw.width / 2 + 4, y - 3);
      ctx.lineTo(iw.width / 2, y - 3);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawBeamLasers(ctx: CanvasRenderingContext2D, state: GameState) {
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

function drawBossBombs(ctx: CanvasRenderingContext2D, state: GameState) {
  for (const b of state.bossBombs) {
    if (!b.active) continue;
    const progress = 1 - b.timer / b.maxTimer; // 0→1
    const pulse = Math.sin(Date.now() / 100) * 0.2 + 0.8;
    // 红色警示圈
    ctx.strokeStyle = `rgba(255, 30, 30, ${pulse * (0.4 + progress * 0.6)})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 15 * (0.5 + progress * 0.5);
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.stroke();
    // 内层填充
    ctx.fillStyle = `rgba(255, 0, 0, ${progress * 0.2})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    // 倒计时数字
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.timer.toFixed(1), b.x, b.y);
    // 中心十字准星
    ctx.strokeStyle = `rgba(255, 100, 100, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - 10, b.y);
    ctx.lineTo(b.x + 10, b.y);
    ctx.moveTo(b.x, b.y - 10);
    ctx.lineTo(b.x, b.y + 10);
    ctx.stroke();
  }
}

// 冲天光柱：地面震荡环 + 底部辉光 + 向屏幕上方延伸的光柱
function drawLightPillars(ctx: CanvasRenderingContext2D, state: GameState, canvasH: number) {
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

function drawMinimap(ctx: CanvasRenderingContext2D, state: GameState, cw: number, ch: number) {
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
function drawOffscreenIndicators(ctx: CanvasRenderingContext2D, state: GameState, canvasW: number, canvasH: number) {
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
      // Boss：大箭头 + 骷髅标记
      ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 15;
      // 箭头
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-6, -10);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-6, 10);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // 骷髅标记（在箭头上方）
      ctx.rotate(-ang); // 取消旋转画骷髅
      ctx.fillStyle = `rgba(255, 220, 220, ${pulse})`;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 10;
      // 骷髅头圆形
      ctx.beginPath();
      ctx.arc(0, -16, 7, 0, Math.PI * 2);
      ctx.fill();
      // 眼窝
      ctx.fillStyle = '#330000';
      ctx.beginPath();
      ctx.arc(-2.5, -17, 1.8, 0, Math.PI * 2);
      ctx.arc(2.5, -17, 1.8, 0, Math.PI * 2);
      ctx.fill();
      // 牙齿
      ctx.strokeStyle = '#330000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, -12);
      ctx.lineTo(3, -12);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // 精英怪：小箭头
      ctx.fillStyle = `rgba(255, 60, 60, ${pulse * 0.8})`;
      ctx.shadowColor = '#ff3333';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, -7);
      ctx.lineTo(-1, 0);
      ctx.lineTo(-4, 7);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}
function drawTouchJoystick(ctx: CanvasRenderingContext2D, state: GameState, canvasW: number, canvasH: number) {
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
