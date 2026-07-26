import { useGameStore } from '../store/gameStore';
import { Skull, Clock, Target, Zap, RotateCcw, Home, Coins } from 'lucide-react';

export default function GameOver() {
  const { setScreen, lastRun, save } = useGameStore();

  const run = lastRun;
  if (!run) {
    setScreen('title');
    return null;
  }

  const isNewRecord = run.survivalTime >= save.highScore;

  return (
    <div className="relative w-full h-screen bg-[#1a1a1f] flex flex-col items-center justify-center">
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#e85913] opacity-10"
            style={{
              width: 6 + (i % 4) * 3,
              height: 6 + (i % 4) * 3,
              left: `${(i * 19) % 100}%`,
              top: `${(i * 29) % 100}%`,
              animation: `float ${4 + (i % 3)}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md w-full mx-4">
        <Skull className="w-16 h-16 text-[#e85913]" />

        <h2 className="text-4xl font-black text-white uppercase tracking-widest" style={{ fontFamily: 'Oswald, sans-serif' }}>
          战斗结算
        </h2>

        {isNewRecord && (
          <div className="px-4 py-1 bg-[#f59e0b]/20 border border-[#f59e0b] text-[#f59e0b] text-sm font-bold uppercase tracking-wider">
            新纪录!
          </div>
        )}

        <div className="w-full bg-[#1f1f24] border border-[#2a2a35] p-6 grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center gap-1">
            <Clock className="w-5 h-5 text-gray-400" />
            <span className="text-2xl font-black text-white">{Math.floor(run.survivalTime)}s</span>
            <span className="text-xs text-gray-500 uppercase">存活时间</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Target className="w-5 h-5 text-gray-400" />
            <span className="text-2xl font-black text-white">{run.kills}</span>
            <span className="text-xs text-gray-500 uppercase">击杀数</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Zap className="w-5 h-5 text-gray-400" />
            <span className="text-2xl font-black text-white">{run.maxCombo}</span>
            <span className="text-xs text-gray-500 uppercase">最高连杀</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Target className="w-5 h-5 text-gray-400" />
            <span className="text-2xl font-black text-white">{run.levelReached}</span>
            <span className="text-xs text-gray-500 uppercase">达到等级</span>
          </div>
        </div>

        <div className="w-full bg-[#1f1f24] border-2 border-[#f59e0b] p-4 flex items-center justify-center gap-3">
          <Coins className="w-7 h-7 text-[#fbbf24]" />
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-[#fbbf24]">+{run.coinsEarned || 0}</span>
            <span className="text-xs text-[#f59e0b] uppercase tracking-wider">获得金币</span>
          </div>
          <div className="text-gray-500 text-sm">
            总计: <span className="text-[#fbbf24] font-bold">{save.coins}</span>
          </div>
        </div>

        <div className="flex gap-3 w-full">
          <button
            onClick={() => setScreen('game')}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#4a7c59] text-white font-bold uppercase tracking-widest hover:bg-[#3d6b4a] transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            再来一局
          </button>
          <button
            onClick={() => setScreen('title')}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 border-2 border-[#4a4a55] text-gray-300 font-bold uppercase tracking-widest hover:border-[#6b6b75] hover:bg-[#2a2a35] transition-all"
          >
            <Home className="w-5 h-5" />
            主菜单
          </button>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  );
}
