import { setParticleSpawnRate, setHeavyEffectRate } from '../particles';

const input = {
  up: false, down: false, left: false, right: false,
  mouseX: 0, mouseY: 0, mouseWorldX: 0, mouseWorldY: 0,
  skill1: false, skill2: false, skill3: false, skill4: false,
  touchActive: false,
  touchStartX: 0,
  touchStartY: 0,
  touchX: 0,
  touchY: 0,
  touchJoyX: 0,
  touchJoyY: 0,
};

export type InputState = typeof input;

export function getInput(): InputState {
  return input;
}

export function bindInput(canvas: HTMLCanvasElement) {
  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') input.up = true;
    if (k === 's' || k === 'arrowdown') input.down = true;
    if (k === 'a' || k === 'arrowleft') input.left = true;
    if (k === 'd' || k === 'arrowright') input.right = true;
    if (k === '1') input.skill1 = true;
    if (k === '2') input.skill2 = true;
    if (k === '3') input.skill3 = true;
    if (k === '4') input.skill4 = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') input.up = false;
    if (k === 's' || k === 'arrowdown') input.down = false;
    if (k === 'a' || k === 'arrowleft') input.left = false;
    if (k === 'd' || k === 'arrowright') input.right = false;
  };
  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);

  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      input.touchActive = true;
      input.touchStartX = x;
      input.touchStartY = y;
      input.touchX = x;
      input.touchY = y;
      input.touchJoyX = 0;
      input.touchJoyY = 0;
      input.mouseX = x;
      input.mouseY = y;
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length > 0 && input.touchActive) {
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      input.touchX = x;
      input.touchY = y;
      input.mouseX = x;
      input.mouseY = y;
      const dx = x - input.touchStartX;
      const dy = y - input.touchStartY;
      const maxDist = 50;
      const dist = Math.hypot(dx, dy);
      if (dist > maxDist) {
        input.touchJoyX = (dx / dist) * maxDist;
        input.touchJoyY = (dy / dist) * maxDist;
      } else {
        input.touchJoyX = dx;
        input.touchJoyY = dy;
      }
    }
  };
  const onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    input.touchActive = false;
    input.touchJoyX = 0;
    input.touchJoyY = 0;
  };
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
}

export function detectMobile(): boolean {
  return typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window && (typeof window !== 'undefined' && window.innerWidth < 900))
  );
}

export function setupMobileEffects(isMobile: boolean): void {
  if (isMobile) {
    setParticleSpawnRate(0.12);
    setHeavyEffectRate(0.15);
  }
}
