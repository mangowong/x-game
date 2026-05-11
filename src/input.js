/**
 * input.js - 输入处理
 * - 键盘 WASD / 方向键：摄像机相对移动
 * - 鼠标拖拽：旋转摄像机
 * - 滚轮：缩放距离
 * - Space：长按压制欲望
 * - Tab：显示/隐藏健身面板
 * - 1-9, 0：触发健身动作
 */

// --- 键盘状态 ---
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  space: false,
};

// --- 动作触发 ---
let pendingWorkoutAction = null;
let actionCancel = false;
let toggleWorkoutPanel = false;

// --- 摄像机控制状态 ---
let cameraYaw = 0;       // 水平旋转角度（弧度）
let cameraPitch = 0.5;   // 垂直角度（弧度，0=水平，PI/2=正上方）
let cameraDistance = 6;   // 摄像机距离
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

const MIN_PITCH = 0.15;
const MAX_PITCH = 1.35;
const MIN_DISTANCE = 2;
const MAX_DISTANCE = 15;

// 健身动作按键映射
const WORKOUT_KEY_MAP = {
  'Digit1': 'jumpRope',
  'Digit2': 'pushup',
  'Digit3': 'situp',
  'Digit4': 'squat',
  'Digit5': 'highKnees',
  'Digit6': 'plank',
  'Digit7': 'dumbbell',
  'Digit8': 'yoga',
  'Digit9': 'pillowSquat',
  'Digit0': 'chaseCat',
};

/**
 * 初始化输入系统
 */
export function initInput(canvas) {
  // 键盘
  window.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    keys.up = true; break;
      case 'KeyS': case 'ArrowDown':  keys.down = true; break;
      case 'KeyA': case 'ArrowLeft':  keys.left = true; break;
      case 'KeyD': case 'ArrowRight': keys.right = true; break;
      case 'Space':
        keys.space = true;
        e.preventDefault(); // 防止页面滚动
        break;
      case 'Tab':
        toggleWorkoutPanel = true;
        e.preventDefault();
        break;
      case 'Escape': actionCancel = true; break;
      default:
        // 健身动作键
        if (WORKOUT_KEY_MAP[e.code]) {
          pendingWorkoutAction = WORKOUT_KEY_MAP[e.code];
        }
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp':    keys.up = false; break;
      case 'KeyS': case 'ArrowDown':  keys.down = false; break;
      case 'KeyA': case 'ArrowLeft':  keys.left = false; break;
      case 'KeyD': case 'ArrowRight': keys.right = false; break;
      case 'Space': keys.space = false; break;
    }
  });

  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = keys.space = false;
  });

  // 鼠标拖拽旋转摄像机
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // 左键
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    cameraYaw -= dx * 0.005;
    cameraPitch += dy * 0.005;
    cameraPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, cameraPitch));
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) isDragging = false;
  });

  // 滚轮缩放
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    cameraDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, cameraDistance * zoomFactor));
  }, { passive: false });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * 获取摄像机控制参数
 */
export function getCameraState() {
  return { yaw: cameraYaw, pitch: cameraPitch, distance: cameraDistance };
}

/**
 * 获取并清除待处理的健身动作
 */
export function consumeWorkoutAction() {
  const a = pendingWorkoutAction;
  pendingWorkoutAction = null;
  return a;
}

/**
 * 获取并清除动作取消标志
 */
export function consumeActionCancel() {
  const c = actionCancel;
  actionCancel = false;
  return c;
}

/**
 * 获取并清除健身面板切换标志
 */
export function consumeTogglePanel() {
  const v = toggleWorkoutPanel;
  toggleWorkoutPanel = false;
  return v;
}

/**
 * 是否按住 Space
 */
export function isSpaceDown() {
  return keys.space;
}

/**
 * 是否有方向键按下（用于打断自动寻路）
 */
export function hasDirectionInput() {
  return keys.up || keys.down || keys.left || keys.right;
}

/**
 * 获取当前输入方向（摄像机相对）
 * @returns {{ dx: number, dy: number, moving: boolean }}
 */
export function getInputDirection() {
  let sx = 0; // -1=左, +1=右
  let sy = 0; // -1=前(W), +1=后(S)

  if (keys.up)    sy -= 1;
  if (keys.down)  sy += 1;
  if (keys.left)  sx -= 1;
  if (keys.right) sx += 1;

  if (sx === 0 && sy === 0) return { dx: 0, dy: 0, moving: false };

  // 摄像机相对方向：把屏幕方向旋转 yaw 角度
  const cos = Math.cos(cameraYaw);
  const sin = Math.sin(cameraYaw);
  // 屏幕 W(前) 对应摄像机 -Z 方向，旋转到世界 XZ 平面
  const dx = sx * cos + sy * sin;
  const dy = -sx * sin + sy * cos;

  const len = Math.sqrt(dx * dx + dy * dy);
  return { dx: dx / len, dy: dy / len, moving: true };
}
