import type { GameState } from '../game/types';
import { Heart, Shield, Zap, Crosshair, Clock, Skull } from 'lucide-react';

interface HUDProps {
  state: GameState;
}

export default function HUD({ state }: HUDProps) {
  const p = state.player;
  const hpRatio = Math.max(0, p.hp / p.maxHp);
  const expRatio = Math.max(0, p.exp / p.maxExp);
  const armorRatio = p.maxArmor > 0 ? p.armor / p.maxArmor : 0;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Boss血条 */}
      {(() => {
        const boss = state.enemies.find(e => e.type === 'boss' && e.active);
        if (!boss) return null;
        const bossHpRatio = Math.max(0, boss.hp / boss.maxHp);
        return (
          <div className="absolute top-0 left-0 right-0 flex flex-col items-center pt-2 pointer-events-none z-20">
            <div className="text-red-400 font-bold text-sm mb-1 tracking-widest drop-shadow-lg">
              ⚠ BOSS ⚠
            </div>
            <div className="relative w-[80%] h-6 bg-black/70 rounded-sm border border-red-900/80 overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-900 via-red-600 to-red-500 transition-all duration-100"
                style={{ width: `${bossHpRatio * 100}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold drop-shadow-md">
                {Math.ceil(boss.hp)} / {Math.floor(boss.maxHp)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 底部横贯式状态栏 */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-0.5 bg-black/40 backdrop-blur-sm border-t border-white/10">
        {/* 血条 - 横贯全屏 */}
        <div className="relative w-full h-5">
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-700 via-red-500 to-red-400 transition-all"
            style={{ width: `${hpRatio * 100}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-3">
            <div className="flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-red-200 drop-shadow" />
              <span className="text-xs text-white font-mono font-bold drop-shadow">{Math.ceil(p.hp)} / {Math.floor(p.maxHp)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-white/90">
                <Crosshair className="w-3.5 h-3.5 text-[#e85913]" />
                <span className="text-xs font-bold">波次 {state.wave}</span>
              </div>
              <div className="flex items-center gap-1 text-white/70">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs font-mono">{Math.floor(state.gameTime)}s</span>
              </div>
            </div>
          </div>
        </div>

        {/* 护甲条 - 横贯全屏 */}
        {p.maxArmor > 0 && (
          <div className="relative w-full h-2.5">
            <div className="absolute inset-0 bg-black/60" />
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-400 transition-all"
              style={{ width: `${armorRatio * 100}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-3">
              <div className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-blue-200" />
                <span className="text-[10px] text-white font-mono font-bold">{Math.ceil(p.armor)} / {p.maxArmor}</span>
              </div>
            </div>
          </div>
        )}

        {/* 经验条 - 横贯全屏 */}
        <div className="relative w-full h-2">
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-700 via-emerald-500 to-lime-400 transition-all"
            style={{ width: `${expRatio * 100}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-3">
            <div className="flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-lime-200" />
              <span className="text-[10px] text-lime-100 font-mono font-bold">Lv.{p.level}</span>
            </div>
            <span className="text-[10px] text-lime-200/70 font-mono">
              {Math.floor(p.exp)} / {Math.floor(p.maxExp)}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom center - kills */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 px-4 py-1 border border-white/10">
        <Skull className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-white font-bold">{state.kills}</span>
        {state.combo > 5 && (
          <span className="text-xs text-[#e85913] font-bold">{state.combo}连杀!</span>
        )}
      </div>
    </div>
  );
}
