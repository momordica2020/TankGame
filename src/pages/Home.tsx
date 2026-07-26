import { useGameStore } from '../store/gameStore';
import { Crosshair, Play, Settings, HelpCircle, Trophy, Coins } from 'lucide-react';
import { useState } from 'react';

export default function Home() {
  const { setScreen, save } = useGameStore();
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="relative w-full h-screen bg-[#1a1a1f] overflow-hidden flex flex-col items-center justify-center">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#4a7c59] opacity-20"
            style={{
              width: 4 + (i % 5) * 2,
              height: 4 + (i % 5) * 2,
              left: `${(i * 17) % 100}%`,
              top: `${(i * 23) % 100}%`,
              animation: `float ${3 + (i % 4)}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)'
      }} />

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-4 mb-4">
          <Crosshair className="w-12 h-12 text-[#e85913]" />
          <div>
            <h1 className="text-5xl font-black tracking-wider text-white uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>
              生存战线
            </h1>
            <p className="text-[#4a7c59] text-sm tracking-[0.3em] uppercase font-bold mt-1">
              孤胆佣兵
            </p>
          </div>
        </div>

        {/* Menu buttons */}
        <div className="flex flex-col gap-3 w-64">
          <button
            onClick={() => setScreen('game')}
            className="group flex items-center justify-center gap-3 px-6 py-3 border-2 border-[#4a7c59] text-white font-bold uppercase tracking-widest transition-all hover:bg-[#4a7c59]/20 hover:shadow-[0_0_20px_rgba(74,124,89,0.3)]"
          >
            <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
            开始游戏
          </button>

          <button
            onClick={() => setScreen('upgrade')}
            className="group flex items-center justify-center gap-3 px-6 py-3 border-2 border-[#f59e0b] text-[#f59e0b] font-bold uppercase tracking-widest transition-all hover:bg-[#f59e0b]/20 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          >
            <Coins className="w-5 h-5 group-hover:scale-110 transition-transform" />
            永久强化
          </button>

          <button
            onClick={() => setShowHelp(true)}
            className="group flex items-center justify-center gap-3 px-6 py-3 border-2 border-[#4a4a55] text-gray-300 font-bold uppercase tracking-widest transition-all hover:border-[#6b6b75] hover:bg-[#2a2a35]"
          >
            <HelpCircle className="w-5 h-5" />
            操作说明
          </button>
        </div>

        {/* High score & coins */}
        <div className="flex flex-col items-center gap-2 mt-4">
          {save.highScore > 0 && (
            <div className="flex items-center gap-2 text-[#f59e0b]">
              <Trophy className="w-5 h-5" />
              <span className="text-sm font-bold tracking-wider">
                最高存活: {Math.floor(save.highScore)}秒
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[#fbbf24]">
            <Coins className="w-5 h-5" />
            <span className="text-sm font-bold tracking-wider">
              金币: {save.coins}
            </span>
          </div>
        </div>
      </div>

      {/* Help modal */}
      {showHelp && (
        <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center" onClick={() => setShowHelp(false)}>
          <div className="bg-[#1a1a1f] border-2 border-[#4a7c59] p-8 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Settings className="w-6 h-6 text-[#4a7c59]" />
              操作说明
            </h2>
            <div className="space-y-4 text-gray-300 text-sm">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-[#2a2a35] border border-[#4a4a55] text-white font-mono text-xs">W A S D</span>
                <span>移动角色</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-[#2a2a35] border border-[#4a4a55] text-white font-mono text-xs">鼠标</span>
                <span>瞄准方向（武器自动射击）</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-[#2a2a35] border border-[#4a4a55] text-white font-mono text-xs">ESC</span>
                <span>暂停游戏</span>
              </div>
              <p className="text-[#4a7c59] pt-2">
                击败敌人获取经验升级，选择强化能力，尽可能存活更久！
              </p>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-6 w-full py-2 bg-[#4a7c59] text-white font-bold uppercase tracking-widest hover:bg-[#3d6b4a] transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
}
