/**
 * ui.js - UI 覆盖层管理
 * - 体重条（数值 + 进度条）
 * - 快乐值（数值 + emoji）
 * - 食欲条（数值 + 进度条 + 警告）
 * - 健身面板（Tab 切换）
 * - 健身进度条
 * - 欲望气泡
 * - 对话框显示
 */

import { WORKOUTS } from './workout.js';

// DOM 元素引用
const weightValueEl = document.getElementById('weight-value');
const weightFillEl = document.getElementById('weight-fill');
const happinessValueEl = document.getElementById('happiness-value');
const happinessFillEl = document.getElementById('happiness-fill');
const desireValueEl = document.getElementById('desire-value');
const desireFillEl = document.getElementById('desire-fill');
const desireRowEl = document.getElementById('desire-row');
const dialogEl = document.getElementById('dialog');
const workoutPanelEl = document.getElementById('workout-panel');
const workoutListEl = document.getElementById('workout-list');
const workoutProgressEl = document.getElementById('workout-progress');
const workoutProgressNameEl = document.getElementById('workout-progress-name');
const workoutProgressFillEl = document.getElementById('workout-progress-fill');
const desireBubbleEl = document.getElementById('desire-bubble');

let dialogTimer = null;
let workoutPanelVisible = false;

// 初始化健身面板内容
export function initWorkoutPanel() {
  if (!workoutListEl) return;

  const categories = ['基础', '器械', '搞笑'];
  const labels = { 'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4', 'Digit5': '5', 'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9', 'Digit0': '0' };

  let html = '';
  for (const cat of categories) {
    const items = WORKOUTS.filter(w => w.category === cat);
    if (items.length === 0) continue;
    html += `<div class="workout-category">—— ${cat} ——</div>`;
    for (const w of items) {
      const key = labels[w.key] || '?';
      let effect = `体重${w.weightDelta}`;
      if (w.happinessDelta !== 0) {
        effect += ` <span class="happy">快乐${w.happinessDelta > 0 ? '+' : ''}${w.happinessDelta}</span>`;
      }
      html += `<div class="workout-item"><span><span class="workout-key">${key}</span> ${w.name}</span><span class="workout-effect">${effect}</span></div>`;
    }
  }
  workoutListEl.innerHTML = html;
}

/**
 * 切换健身面板显示
 */
export function toggleWorkoutPanel() {
  workoutPanelVisible = !workoutPanelVisible;
  if (workoutPanelEl) {
    workoutPanelEl.classList.toggle('visible', workoutPanelVisible);
  }
}

/**
 * 更新 HUD 显示
 */
export function updateUI(weight, happiness, desire = 0) {
  if (weightValueEl) weightValueEl.textContent = weight;
  if (weightFillEl) weightFillEl.style.width = weight + '%';

  // 快乐值 + emoji
  let emoji = '😊';
  if (happiness < 20) emoji = '😢';
  else if (happiness < 40) emoji = '😟';
  else if (happiness < 60) emoji = '😐';
  else if (happiness < 80) emoji = '😊';
  else emoji = '😆';
  if (happinessValueEl) happinessValueEl.textContent = happiness + ' ' + emoji;
  if (happinessFillEl) happinessFillEl.style.width = happiness + '%';

  // 食欲条
  const desireRounded = Math.round(desire);
  if (desireValueEl) desireValueEl.textContent = desireRounded;
  if (desireFillEl) desireFillEl.style.width = desireRounded + '%';
  // 警告闪烁
  if (desireRowEl) {
    desireRowEl.classList.toggle('warning', desire >= 70);
  }

  // 食欲气泡
  if (desireBubbleEl) {
    if (desire >= 70) {
      desireBubbleEl.classList.add('visible');
      desireBubbleEl.textContent = desire >= 90 ? '🤤' : '馋';
    } else {
      desireBubbleEl.classList.remove('visible');
    }
  }
}

/**
 * 更新健身进度显示
 * @param {{ name: string, progress: number } | null} status
 */
export function updateWorkoutProgress(status) {
  if (!workoutProgressEl) return;

  if (status) {
    workoutProgressEl.classList.add('visible');
    if (workoutProgressNameEl) workoutProgressNameEl.textContent = status.name + ' 中...';
    if (workoutProgressFillEl) workoutProgressFillEl.style.width = Math.round(status.progress * 100) + '%';
  } else {
    workoutProgressEl.classList.remove('visible');
  }
}

/**
 * 显示压制食欲状态
 */
export function updateDesireBubbleSuppressing(suppressing) {
  if (!desireBubbleEl) return;
  if (suppressing) {
    desireBubbleEl.classList.add('visible');
    desireBubbleEl.textContent = '😤';
  }
}

/**
 * 显示对话文字，几秒后自动消失
 */
export function showDialog(text, duration = 3000) {
  if (!dialogEl) return;

  dialogEl.textContent = text;
  dialogEl.classList.add('visible');

  if (dialogTimer) clearTimeout(dialogTimer);

  dialogTimer = setTimeout(() => {
    dialogEl.classList.remove('visible');
    dialogTimer = null;
  }, duration);
}
