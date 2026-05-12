/**
 * main.js - 游戏入口
 * - 异步初始化：Rapier 物理 → 资源加载 → 场景 → 玩家
 * - PerspectiveCamera 第三人称跟随
 * - 游戏主循环（欲望系统 + 健身系统 + 自动进食）
 */

import * as THREE from 'three';
import { initPhysics } from './physics.js';
import { loadAssets } from './assets.js';
import { createScene } from './scene.js';
import { createPlayer, updatePlayer, triggerAction, endAction, isInAction, getWeight, getHappiness, getX2d, getY2d, getMesh } from './player.js';
import { initFood, updateFood, tryEatFood, getFoods } from './food.js';
import { updateUI, initWorkoutPanel, toggleWorkoutPanel, updateWorkoutProgress, updateDesireBubbleSuppressing, showDialog } from './ui.js';
import { tryTriggerEvent } from './events.js';
import { initInput, getInputDirection, getCameraState, consumeWorkoutAction, consumeActionCancel, consumeTogglePanel, isSpaceDown, hasDirectionInput } from './input.js';
import { updateDesire, getDesire, shouldAutoEat, satisfyDesireOnEat, getAutoEatDirection, getAutoMoveSpeedRatio, setAutoWalking, isAutoWalking } from './desire.js';
import { startWorkout, updateWorkout, cancelWorkout, isWorkingOut, getWorkoutStatus, setDialogFn } from './workout.js';

const MAX_CAM_PITCH = 1.5; // 靠墙时最大俯角

// --- 启动 ---
async function init() {
  // 1. 初始化 Rapier 物理
  await initPhysics();

  // 2. 加载资源
  await loadAssets((loaded, total) => {
    const el = document.getElementById('loading-text');
    if (el) el.textContent = `加载资源 ${loaded}/${total}...`;
  });

  // 3. 隐藏加载画面
  const loadingEl = document.getElementById('loading-screen');
  if (loadingEl) loadingEl.style.display = 'none';

  // --- 渲染器 ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // --- 透视摄像机 ---
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );

  // --- 场景 ---
  const scene = createScene();

  // --- 玩家 ---
  createPlayer(scene);

  // --- 食物 ---
  initFood(scene, (eatenFood) => {
    // 进食后降低欲望
    satisfyDesireOnEat();
    tryTriggerEvent(eatenFood.name);
  });

  // --- 输入 ---
  initInput(renderer.domElement);

  // --- UI 初始化 ---
  initWorkoutPanel();
  setDialogFn(showDialog);

  // --- 窗口缩放 ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- 游戏主循环 ---
  const clock = new THREE.Clock();

  function gameLoop() {
    requestAnimationFrame(gameLoop);

    const delta = clock.getDelta();
    const dt = Math.min(delta, 0.05);
    const input = getInputDirection();

    // --- Tab 切换健身面板 ---
    if (consumeTogglePanel()) {
      toggleWorkoutPanel();
    }

    // --- 检查健身动作触发 ---
    const workoutAction = consumeWorkoutAction();
    if (workoutAction && !isWorkingOut() && !isInAction()) {
      const started = startWorkout(workoutAction);
      if (started) {
        triggerAction(workoutAction);
      }
    }

    // --- 检查动作取消 (ESC) ---
    const cancel = consumeActionCancel();
    if (cancel) {
      if (isWorkingOut()) {
        cancelWorkout();
        endAction();
      } else if (isInAction()) {
        endAction();
      }
    }

    // --- 更新健身进度 ---
    const workoutResult = updateWorkout(dt);
    if (workoutResult.active) {
      // 健身进行中，不允许移动
      updatePlayer(dt, { dx: 0, dy: 0, moving: false, actionCancel: false });
    } else if (workoutResult.completed) {
      // 健身刚完成，恢复行动
      endAction();
      updatePlayer(dt, { dx: 0, dy: 0, moving: false, actionCancel: false });
    } else {
      // --- 正常移动模式 ---
      const isSuppressing = isSpaceDown();
      const hasManualInput = hasDirectionInput();

      // 更新欲望
      updateDesire(dt, isSuppressing);
      updateDesireBubbleSuppressing(isSuppressing);

      // 如果玩家按了方向键，打断自动寻路
      if (hasManualInput) {
        setAutoWalking(false);
      }

      // 计算自动寻路方向
      let autoDir = null;
      let autoSpeedRatio = null;
      if (!hasManualInput && !isSuppressing && shouldAutoEat()) {
        const playerPos = { x: getX2d(), y: getY2d() };
        const foods = getFoods();
        autoDir = getAutoEatDirection(playerPos, foods);
        if (autoDir) {
          autoSpeedRatio = getAutoMoveSpeedRatio();
          setAutoWalking(true);
        } else {
          setAutoWalking(false);
        }
      } else {
        setAutoWalking(false);
      }

      // 更新玩家（传入自动寻路方向）
      updatePlayer(dt, { ...input, actionCancel: false }, autoDir, autoSpeedRatio);
    }

    // --- 碰到食物自动吃掉（手动移动 + 自动寻路都检测） ---
    const playerMoved = input.moving || isAutoWalking();
    if (playerMoved) {
      tryEatFood({ x: getX2d(), y: getY2d() });
    }

    // --- 更新食物动画 ---
    updateFood();

    // --- 更新 UI ---
    updateUI(getWeight(), getHappiness(), getDesire());
    updateWorkoutProgress(getWorkoutStatus());

    // --- 第三人称摄像机跟随 ---
    const playerMesh = getMesh();
    if (playerMesh) {
      const cam = getCameraState();
      const px = playerMesh.position.x;
      const pz = playerMesh.position.z;

      // 角色靠近墙壁时自动抬高视角，避免被墙挡住
      const wallMargin = 3.0;
      const distBack = 12 - pz;   // 离后墙距离
      const distLeft = px;         // 离左墙距离
      const distFront = pz;        // 离前墙距离
      const distRight = 12 - px;   // 离右墙距离
      const minDist = Math.min(distBack, distLeft, distFront, distRight);

      // 靠墙时 pitch 从用户值平滑抬到更高（更陡俯角）
      let extraPitch = 0;
      if (minDist < wallMargin) {
        extraPitch = (1 - minDist / wallMargin) * 0.6; // 最多额外抬 0.6 弧度
      }
      const effectivePitch = Math.min(MAX_CAM_PITCH, cam.pitch + extraPitch);

      const offsetX = Math.sin(cam.yaw) * Math.cos(effectivePitch) * cam.distance;
      const offsetY = Math.sin(effectivePitch) * cam.distance;
      const offsetZ = Math.cos(cam.yaw) * Math.cos(effectivePitch) * cam.distance;

      camera.position.set(px + offsetX, offsetY, pz + offsetZ);
      camera.lookAt(px, 1.2, pz);
    }

    // 渲染
    renderer.render(scene, camera);
  }

  gameLoop();
}

init().catch((err) => {
  console.error('游戏初始化失败:', err);
  const loadingText = document.getElementById('loading-text');
  if (loadingText) loadingText.textContent = '加载失败，请刷新重试';
});
