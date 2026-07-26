import { useRef, useEffect, useCallback, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { createGameState, updateGame, applyUpgrade, bindInput } from '../game/engine';
import { renderGame } from '../game/renderer';
import HUD from '../components/HUD';
import UpgradePanel from '../components/UpgradePanel';
import type { GameState } from '../game/types';

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [uiState, setUiState] = useState<{ showUpgrade: boolean; isGameOver: boolean; isPaused: boolean }>({
    showUpgrade: false,
    isGameOver: false,
    isPaused: false,
  });
  const [renderTick, setRenderTick] = useState(0);

  const { selectedWeapon, setScreen, updateSave, applyPermanentUpgrades, getStartLevel } = useGameStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    bindInput(canvas);

    const startWeapon = selectedWeapon || 'rifle';
    let gameState = createGameState(startWeapon);
    gameState.player = applyPermanentUpgrades(gameState.player);
    const startLv = getStartLevel();
    for (let i = 0; i < startLv; i++) {
      gameState.player.level += 1;
      gameState.player.maxExp = Math.floor(gameState.player.maxExp * 1.25) + 10;
    }
    stateRef.current = gameState;
    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      const state = stateRef.current;
      if (state) {
        updateGame(state, dt, canvas.width, canvas.height);
        renderGame(ctx, state, canvas.width, canvas.height);

        // Sync UI state periodically
        if (Math.random() < 0.1) {
          setUiState({
            showUpgrade: state.showUpgrade,
            isGameOver: state.isGameOver,
            isPaused: state.isPaused,
          });
        }

        if (state.isGameOver && !uiState.isGameOver) {
          setUiState((u) => ({ ...u, isGameOver: true }));
          const runData = {
            survivalTime: state.gameTime,
            kills: state.kills,
            maxCombo: state.maxCombo,
            levelReached: state.player.level,
          };
          updateSave(runData);
          // 死亡动画已播完，短暂淡出后进入结算
          setTimeout(() => setScreen('gameover'), 400);
        }

        setRenderTick((t) => t + 1);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [selectedWeapon, setScreen, updateSave, uiState.isGameOver]);

  // Pause on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stateRef.current) {
        stateRef.current.isPaused = !stateRef.current.isPaused;
        setUiState((u) => ({ ...u, isPaused: stateRef.current!.isPaused }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleUpgrade = useCallback((idx: number) => {
    if (stateRef.current) {
      applyUpgrade(stateRef.current, idx);
      setUiState((u) => ({ ...u, showUpgrade: false }));
    }
  }, []);

  const handleResume = useCallback(() => {
    if (stateRef.current) {
      stateRef.current.isPaused = false;
      setUiState((u) => ({ ...u, isPaused: false }));
    }
  }, []);

  const handleQuit = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setScreen('title');
  }, [setScreen]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden" style={{ cursor: 'none' }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: 'auto', cursor: 'none' }}
      />

      {stateRef.current && !uiState.isGameOver && (
        <HUD state={stateRef.current} />
      )}

      {uiState.showUpgrade && stateRef.current && (
        <UpgradePanel state={stateRef.current} onSelect={handleUpgrade} />
      )}

      {uiState.isPaused && !uiState.showUpgrade && !uiState.isGameOver && (
        <div className="absolute inset-0 z-30 bg-black/70 flex items-center justify-center">
          <div className="bg-[#1a1a1f] border-2 border-[#4a7c59] p-8 max-w-sm w-full mx-4 text-center">
            <h2 className="text-3xl font-black text-white uppercase tracking-widest mb-8">暂停</h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleResume}
                className="w-full py-3 bg-[#4a7c59] text-white font-bold uppercase tracking-widest hover:bg-[#3d6b4a] transition-colors"
              >
                继续游戏
              </button>
              <button
                onClick={handleQuit}
                className="w-full py-3 border-2 border-[#4a4a55] text-gray-300 font-bold uppercase tracking-widest hover:border-[#6b6b75] hover:bg-[#2a2a35] transition-all"
              >
                返回主菜单
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
