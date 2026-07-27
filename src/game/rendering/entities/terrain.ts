import type { GameState, Camera } from '../../types';

export function drawTerrains(ctx: CanvasRenderingContext2D, state: GameState, cam: Camera, cw: number, ch: number) {
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
