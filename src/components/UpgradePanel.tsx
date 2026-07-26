import type { GameState } from '../game/types';
import { getRarityColor } from '../game/upgrades';
import { Sparkles, Crosshair, Heart, Shield } from 'lucide-react';

interface UpgradePanelProps {
  state: GameState;
  onSelect: (index: number) => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  weapon: <Crosshair className="w-5 h-5" />,
  stat: <Shield className="w-5 h-5" />,
  passive: <Heart className="w-5 h-5" />,
};

// 计算某升级选项应用后的“下一等级”标签
function getUpgradeLevelLabel(state: GameState, optId: string, optType: string): string | null {
  if (optType === 'weapon' && optId.startsWith('unlock_')) {
    const wid = optId.replace('unlock_', '');
    const w = state.player.weapons.find((ww) => ww.config.id === wid);
    const cur = w ? w.level : 0;
    return `Lv.${cur} → Lv.${cur + 1}`;
  }
  // 统计类/被动：按已选同类次数作为等级
  const count = state.player.upgrades.filter((id) => id === optId).length;
  if (count > 0) return `Lv.${count} → Lv.${count + 1}`;
  return null;
}

export default function UpgradePanel({ state, onSelect }: UpgradePanelProps) {
  return (
    <div className="absolute inset-0 z-30 bg-black/70 flex items-center justify-center">
      <div className="max-w-3xl w-full mx-4">
        <h2 className="text-2xl font-black text-white text-center uppercase tracking-widest mb-8">
          <Sparkles className="w-6 h-6 inline-block mr-2 text-[#f59e0b]" />
          选择强化
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {state.upgradeOptions.map((opt, idx) => {
            const color = getRarityColor(opt.rarity);
            const levelLabel = getUpgradeLevelLabel(state, opt.id, opt.type);
            return (
              <button
                key={opt.id}
                onClick={() => onSelect(idx)}
                className="group relative p-6 bg-[#1a1a1f] border-2 transition-all hover:scale-105 text-left"
                style={{ borderColor: color }}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2" style={{ color }}>
                    {TYPE_ICONS[opt.type] || <Sparkles className="w-5 h-5" />}
                    <span className="text-xs font-bold uppercase tracking-wider">{opt.rarity}</span>
                  </div>
                  {levelLabel && (
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded border"
                      style={{ color, borderColor: `${color}66`, background: `${color}14` }}
                    >
                      {levelLabel}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-white mb-2">{opt.name}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{opt.description}</p>

                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  style={{ boxShadow: `0 0 30px ${color}40` }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
