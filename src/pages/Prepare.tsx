import { useGameStore } from '../store/gameStore';
import { WEAPON_CONFIGS } from '../game/weapons';
import { ArrowLeft, Crosshair, Flame, Zap, Bomb, Plane, Radio, AlertTriangle, Sword, Shield, Bot, Wrench, Sparkles, Snowflake, Skull, Wand2 } from 'lucide-react';
import { useState } from 'react';
import type { WeaponType } from '../game/types';

const ICONS: Record<WeaponType, React.ReactNode> = {
  rifle: <Crosshair className="w-8 h-8" />,
  shotgun: <Flame className="w-8 h-8" />,
  gatling: <Zap className="w-8 h-8" />,
  laser: <Radio className="w-8 h-8" />,
  grenade: <Bomb className="w-8 h-8" />,
  drone: <Plane className="w-8 h-8" />,
  mine: <AlertTriangle className="w-8 h-8" />,
  flamethrower: <Flame className="w-8 h-8" />,
  sword: <Sword className="w-8 h-8" />,
  turret: <Wrench className="w-8 h-8" />,
  shield_drone: <Shield className="w-8 h-8" />,
  auto_turret: <Bot className="w-8 h-8" />,
  lightning: <Zap className="w-8 h-8" />,
  fire_wall: <Flame className="w-8 h-8" />,
  ice_wall: <Snowflake className="w-8 h-8" />,
  skeleton: <Skull className="w-8 h-8" />,
  beam_laser: <Wand2 className="w-8 h-8" />,
};

// 只展示适合作为初始武器的选择（魔法武器作为初始选项较弱，仅列入现代战争武器）
const STARTER_WEAPONS: WeaponType[] = ['rifle', 'shotgun', 'gatling', 'laser', 'grenade', 'drone', 'mine', 'flamethrower', 'sword', 'turret', 'shield_drone', 'auto_turret', 'lightning', 'fire_wall', 'ice_wall', 'skeleton', 'beam_laser'];

export default function Prepare() {
  const { setScreen, selectWeapon } = useGameStore();
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('rifle');

  const handleStart = () => {
    selectWeapon(selected);
    setScreen('game');
  };

  return (
    <div className="relative w-full h-screen bg-[#1a1a1f] flex flex-col items-center justify-center p-8 overflow-auto">
      <button
        onClick={() => setScreen('title')}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-bold uppercase tracking-wider">返回</span>
      </button>

      <h2 className="text-3xl font-black text-white uppercase tracking-wider mb-2" style={{ fontFamily: 'Oswald, sans-serif' }}>
        选择初始装备
      </h2>
      <p className="text-gray-400 text-sm mb-8">选择你的开局主武器，战斗中可获取更多武器</p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-3xl w-full mb-8">
        {STARTER_WEAPONS.map((wid) => {
          const w = WEAPON_CONFIGS[wid];
          const isSelected = selected === wid;
          const isHovered = hovered === wid;
          return (
            <div
              key={wid}
              onClick={() => setSelected(wid)}
              onMouseEnter={() => setHovered(wid)}
              onMouseLeave={() => setHovered(null)}
              className={`
                relative cursor-pointer p-4 border-2 transition-all
                ${isSelected ? 'border-[#e85913] bg-[#e85913]/10' : 'border-[#2a2a35] bg-[#1f1f24]'}
                ${isHovered && !isSelected ? 'border-[#4a7c59] bg-[#4a7c59]/10' : ''}
              `}
            >
              <div className={`mb-2 ${isSelected ? 'text-[#e85913]' : 'text-[#4a7c59]'}`}>
                {ICONS[wid]}
              </div>
              <h3 className="text-white font-bold text-sm mb-1">{w.name}</h3>
              <p className="text-gray-400 text-xs leading-relaxed">{w.description}</p>

              {isSelected && (
                <div className="absolute top-2 right-2 w-3 h-3 bg-[#e85913] rotate-45" />
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleStart}
        className="px-12 py-4 bg-[#e85913] text-white font-black text-lg uppercase tracking-[0.2em] hover:bg-[#d14a0a] transition-all hover:shadow-[0_0_30px_rgba(232,89,19,0.3)]"
      >
        进入战场
      </button>
    </div>
  );
}
