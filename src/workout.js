/**
 * workout.js - 健身训练系统
 * - 10 种健身动作（基础/器械/搞笑）
 * - 每种动作有持续时间、减肥效果、快乐效果
 * - 进度管理，完成或取消时应用效果
 */

import { modifyWeight, modifyHappiness } from './player.js';
import { satisfyDesireOnWorkout } from './desire.js';

// 对话显示回调（由 main.js 注入，避免循环依赖 ui.js）
let showDialogFn = null;

/**
 * 注入对话框显示函数（main.js 调用）
 */
export function setDialogFn(fn) {
  showDialogFn = fn;
}

/**
 * 健身动作定义
 * key: 按键, action: 动作标识, name: 显示名, duration: 持续时间(秒),
 * weightDelta: 减肥效果, happinessDelta: 快乐效果, category: 分类
 */
export const WORKOUTS = [
  { key: 'Digit1', action: 'jumpRope',    name: '跳绳',     duration: 3,   weightDelta: -3,  happinessDelta: 0,  category: '基础' },
  { key: 'Digit2', action: 'pushup',      name: '俯卧撑',   duration: 3,   weightDelta: -3,  happinessDelta: 0,  category: '基础' },
  { key: 'Digit3', action: 'situp',       name: '仰卧起坐', duration: 3,   weightDelta: -2,  happinessDelta: 0,  category: '基础' },
  { key: 'Digit4', action: 'squat',       name: '深蹲',     duration: 2.5, weightDelta: -2,  happinessDelta: 0,  category: '基础' },
  { key: 'Digit5', action: 'highKnees',   name: '高抬腿',   duration: 3,   weightDelta: -4,  happinessDelta: 0,  category: '基础' },
  { key: 'Digit6', action: 'plank',       name: '平板支撑', duration: 4,   weightDelta: -5,  happinessDelta: -2, category: '基础' },
  { key: 'Digit7', action: 'dumbbell',    name: '哑铃弯举', duration: 3,   weightDelta: -3,  happinessDelta: 0,  category: '器械' },
  { key: 'Digit8', action: 'yoga',        name: '瑜伽拉伸', duration: 3.5, weightDelta: -1,  happinessDelta: 5,  category: '器械' },
  { key: 'Digit9', action: 'pillowSquat', name: '举抱枕深蹲', duration: 2.5, weightDelta: -2, happinessDelta: 3,  category: '搞笑' },
  { key: 'Digit0', action: 'chaseCat',    name: '追猫跑',   duration: 3,   weightDelta: -4,  happinessDelta: 3,  category: '搞笑' },
];

// 当前健身状态
let activeWorkout = null;
let workoutElapsed = 0;

/**
 * 开始健身动作
 * @param {string} action - 动作标识
 * @returns {boolean} 是否成功开始
 */
export function startWorkout(action) {
  if (activeWorkout) return false;

  const def = WORKOUTS.find(w => w.action === action);
  if (!def) return false;

  activeWorkout = def;
  workoutElapsed = 0;
  return true;
}

/**
 * 更新健身进度（每帧调用）
 * @param {number} dt - 帧间隔（秒）
 * @returns {{ active: boolean, progress: number, workout: object|null, completed: boolean }}
 */
export function updateWorkout(dt) {
  if (!activeWorkout) {
    return { active: false, progress: 0, workout: null, completed: false };
  }

  workoutElapsed += dt;
  const progress = Math.min(1, workoutElapsed / activeWorkout.duration);

  if (progress >= 1) {
    completeWorkout();
    return { active: false, progress: 1, workout: null, completed: true };
  }

  return { active: true, progress, workout: activeWorkout, completed: false };
}

/**
 * 取消当前健身（获得部分效果）
 */
export function cancelWorkout() {
  if (!activeWorkout) return;

  const ratio = Math.min(1, workoutElapsed / activeWorkout.duration);
  applyWorkoutEffects(activeWorkout, ratio);
  activeWorkout = null;
  workoutElapsed = 0;
}

/**
 * 完成健身（获得全部效果）
 */
function completeWorkout() {
  if (!activeWorkout) return;

  applyWorkoutEffects(activeWorkout, 1);

  if (showDialogFn) {
    const msgs = [
      `${activeWorkout.name}完成！体重${activeWorkout.weightDelta}`,
      `做完${activeWorkout.name}了，爽！`,
      `${activeWorkout.name}打卡成功！`,
    ];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    showDialogFn(msg, 2500);
  }

  activeWorkout = null;
  workoutElapsed = 0;
}

/**
 * 应用健身效果
 * @param {object} workout - 健身动作定义
 * @param {number} ratio - 完成比例 0~1
 */
function applyWorkoutEffects(workout, ratio) {
  if (workout.weightDelta !== 0) {
    modifyWeight(Math.round(workout.weightDelta * ratio));
  }
  if (workout.happinessDelta !== 0) {
    modifyHappiness(Math.round(workout.happinessDelta * ratio));
  }
  satisfyDesireOnWorkout();
}

/**
 * 是否正在健身中
 */
export function isWorkingOut() {
  return activeWorkout !== null;
}

/**
 * 获取当前健身状态（用于 UI 显示）
 */
export function getWorkoutStatus() {
  if (!activeWorkout) return null;
  return {
    name: activeWorkout.name,
    progress: Math.min(1, workoutElapsed / activeWorkout.duration),
    category: activeWorkout.category,
  };
}
