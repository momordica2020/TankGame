import { useGameStore, PERMANENT_UPGRADES } from '../store/gameStore';
import { ArrowLeft, Coins, TrendingUp, Zap, Heart, Footprints, Magnet, Star, Sparkles, Shield } from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  max_hp: <Heart className="w-6 h-6" />,
  damage: <Zap className="w-6 h-6" />,
  fire_rate: <TrendingUp className="w-6 h-6" />,
  move_speed: <Footprints className="w-6 h-6" />,
  pickup_range: <Magnet className="w-6 h-6" />,
  start_exp: <Star className="w-6 h-6" />,
  exp_gain: <Sparkles className="w-6 h-6" />,
  armor: <Shield className="w-6 h-6" />,
};

const COLOR_MAP: Record<string, string> = {
  max_hp: '#ef4444',
  damage: '#f59e0b',
  fire_rate: '#eab308',
  move_speed: '#22c55e',
  pickup_range: '#3b82f6',
  start_exp: '#a855f7',
  exp_gain: '#ec4899',
  armor: '#06b6d4',
};

export default function Upgrade() {
  const { save, setScreen, buyUpgrade, getUpgradeCost } = useGameStore();

  const handleBuy = (id: string) => {
    buyUpgrade(id);
  };

  return (
    <div className="relative w-full h-screen bg-[#1a1a1f] flex flex-col items-center p-6 overflow-auto">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setScreen('title')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-wider">返回</span>
          </button>

          <div className="flex items-center gap-2 px-4 py-2 bg-[#1f1f24] border-2 border-[#f59e0b]">
            <Coins className="w-5 h-5 text-[#f59e0b]" />
            <span className="text-[#f59e0b] font-bold text-lg">{save.coins}</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-3xl font-black text-white uppercase tracking-wider" style={{ fontFamily: 'Oswald, sans-serif' }}>
            永久强化
          </h2>
          <p className="text-gray-400 text-sm mt-2">使用战斗中获得的金币永久提升能力</p>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3 bg-[#1f1f24] border border-[#2a2a35] p-4">
          <div className="text-center">
            <div className="text-[#f59e0b] font-bold text-xl">{save.coins}</div>
            <div className="text-gray-400 text-xs">当前金币</div>
          </div>
          <div className="text-center">
            <div className="text-[#4ade80] font-bold text-xl">{save.totalCoins}</div>
            <div className="text-gray-400 text-xs">累计金币</div>
          </div>
          <div className="text-center">
            <div className="text-[#3b82f6] font-bold text-xl">{save.totalKills}</div>
            <div className="text-gray-400 text-xs">累计击杀</div>
          </div>
        </div>

        {/* Upgrade list */}
        <div className="flex flex-col gap-3">
          {PERMANENT_UPGRADES.map((up) => {
            const level = save.upgrades[up.id] || 0;
            const maxed = level >= up.maxLevel;
            const cost = getUpgradeCost(up.id);
            const canAfford = !maxed && cost >= 0 && save.coins >= cost;
            const color = COLOR_MAP[up.id] || '#fff';

            return (
              <div
                key={up.id}
                className={`flex items-center gap-4 p-4 border-2 transition-all ${
                  maxed
                    ? 'border-[#f59e0b] bg-[#f59e0b]/5'
                    : canAfford
                    ? 'border-[#4a7c59] bg-[#4a7c59]/5 hover:bg-[#4a7c59]/10'
                    : 'border-[#2a2a35] bg-[#1f1f24] opacity-70'
                }`}
              >
                {/* Icon */}
                <div
                  className="flex-shrink-0 w-12 h-12 flex items-center justify-center border-2"
                  style={{ borderColor: color, color }}
                >
                  {ICON_MAP[up.id]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-bold text-base">{up.name}</h3>
                    <span className="text-xs px-2 py-0.5 bg-[#2a2a35] text-gray-300">
                      Lv.{level}/{up.maxLevel}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs">{up.description}</p>

                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-[#2a2a35] overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{ width: `${(level / up.maxLevel) * 100}%`, backgroundColor: color }}
                    />
                  </div>
                </div>

                {/* Buy button */}
                <div className="flex-shrink-0">
                  {maxed ? (
                    <div className="px-4 py-2 bg-[#f59e0b]/20 text-[#f59e0b] font-bold text-sm uppercase tracking-wider border-2 border-[#f59e0b]">
                      已满级
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuy(up.id)}
                      disabled={!canAfford}
                      className={`
                        flex items-center gap-2 px-4 py-2 font-bold text-sm uppercase tracking-wider
                        transition-all border-2
                        ${canAfford
                          ? 'bg-[#4a7c59] text-white border-[#4a7c59] hover:bg-[#3d6b4a]'
                          : 'bg-[#2a2a35] text-gray-500 border-[#4a4a55] cursor-not-allowed'
                        }
                      `}
                    >
                      <Coins className="w-4 h-4" />
                      {cost}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Back button */}
        <button
          onClick={() => setScreen('title')}
          className="w-full py-3 bg-[#e85913] text-white font-bold uppercase tracking-[0.2em] hover:bg-[#d14a0a] transition-all hover:shadow-[0_0_20px_rgba(232,89,19,0.3)]"
        >
          返回主菜单
        </button>
      </div>
    </div>
  );
}
