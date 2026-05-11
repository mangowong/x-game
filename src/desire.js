/**
 * desire.js - 欲望系统
 * - 欲望值 0~100，自然增长，进食降低
 * - 欲望 >= 70 时角色自动走向最近食物
 * - 玩家按方向键可打断自动寻路
 * - Space 长按压制欲望
 */

const DESIRE_GROWTH_RATE = 0.5;    // 每秒自然增长
const DESIRE_EAT_REDUCE = 30;      // 进食降低
const DESIRE_WORKOUT_REDUCE = 10;  // 健身降低
const DESIRE_SUPPRESS_RATE = 2;    // Space 压制每秒降低
const DESIRE_THRESHOLD = 70;       // 自动进食阈值
const AUTO_MOVE_SPEED_RATIO = 0.6; // 自动寻路速度比例

let desire = 0;
let suppressing = false;
let autoWalking = false;

/**
 * 更新欲望值（每帧调用）
 * @param {number} dt - 帧间隔（秒）
 * @param {boolean} isSuppressing - 是否按住 Space
 */
export function updateDesire(dt, isSuppressing) {
  suppressing = isSuppressing;
  if (isSuppressing) {
    desire = Math.max(0, desire - DESIRE_SUPPRESS_RATE * dt);
  } else {
    desire = Math.min(100, desire + DESIRE_GROWTH_RATE * dt);
  }
}

/**
 * 进食后降低欲望
 */
export function satisfyDesireOnEat() {
  desire = Math.max(0, desire - DESIRE_EAT_REDUCE);
}

/**
 * 健身后降低欲望
 */
export function satisfyDesireOnWorkout() {
  desire = Math.max(0, desire - DESIRE_WORKOUT_REDUCE);
}

/**
 * 获取当前欲望值
 */
export function getDesire() {
  return desire;
}

/**
 * 是否应该自动进食
 */
export function shouldAutoEat() {
  return desire >= DESIRE_THRESHOLD;
}

/**
 * 是否正在压制欲望
 */
export function isSuppressingDesire() {
  return suppressing;
}

/**
 * 是否处于自动行走状态
 */
export function isAutoWalking() {
  return autoWalking;
}

/**
 * 设置自动行走状态
 */
export function setAutoWalking(v) {
  autoWalking = v;
}

/**
 * 计算自动寻路方向（朝最近食物）
 * @param {{ x: number, y: number }} playerPos - 玩家 2D 位置
 * @param {Array<{ x: number, z: number }>} foods - 食物列表
 * @returns {{ dx: number, dy: number } | null}
 */
export function getAutoEatDirection(playerPos, foods) {
  if (!foods || foods.length === 0) return null;

  let nearest = null;
  let nearestDist = Infinity;

  for (const food of foods) {
    const dx = playerPos.x - food.x;
    const dy = playerPos.y - food.z;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = food;
    }
  }

  if (!nearest) return null;

  const dx = nearest.x - playerPos.x;
  const dy = nearest.z - playerPos.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return null;

  return { dx: dx / len, dy: dy / len };
}

/**
 * 自动寻路速度倍率
 */
export function getAutoMoveSpeedRatio() {
  return AUTO_MOVE_SPEED_RATIO;
}
