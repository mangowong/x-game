/**
 * player.js - 玩家管理
 * - 使用 assets.js 预加载的 GLB 模型（含动画）
 * - 使用 physics.js (Rapier) 处理碰撞推离
 * - 键盘 WASD 摄像机相对移动
 * - 维护体重、快乐值
 * - 平滑移动插值 + GLB 动画切换
 * - 程序化动作：跳绳、俯卧撑、仰卧起坐、深蹲、高抬腿、
 *   平板支撑、哑铃弯举、瑜伽、举抱枕深蹲、追猫跑
 */

import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { physTo3D } from './utils.js';
import { getAssetRaw } from './assets.js';
import { setPlayerVelocity, setPlayerPosition, getPlayerPosition, stepPhysics } from './physics.js';

const MOVE_SPEED = 4.0;

// --- 运动平滑参数 ---
const POSITION_LERP = 12;
const ROTATION_LERP = 10;

// 玩家状态
const state = {
  weight: 50,
  happiness: 50,
};

let mesh = null;
let innerModel = null; // 模型内部对象，用于骨骼访问
let mixer = null;
let walkAction = null;
let idleAction = null;
let currentAction = null;
let lastMoving = false;
let prevPos3d = null;

// --- 程序化动作状态 ---
let actionMode = 'normal';
let actionPhase = 0;

// --- 骨骼引用 ---
const bones = {};
const boneRestQuats = {};
const boneRestPos = {};

function cacheBones(model) {
  model.traverse((child) => {
    if (child.isBone) {
      // Mixamo 骨骼名带 "mixamorig:" 前缀，也存一份不带前缀的
      bones[child.name] = child;
      const short = child.name.replace('mixamorig:', '');
      bones[short] = child;
      boneRestQuats[child.name] = child.quaternion.clone();
      boneRestPos[child.name] = child.position.clone();
    }
  });
}

// --- 骨骼旋转辅助 ---
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

function setBoneRotAxis(name, axis, angle) {
  const bone = bones[name];
  if (!bone) return;
  const rest = boneRestQuats[bone.name];
  if (!rest) return;
  _v.copy(axis);
  _q.setFromAxisAngle(_v, angle);
  bone.quaternion.copy(rest).multiply(_q);
}

function resetBone(name, factor) {
  const bone = bones[name];
  if (!bone) return;
  bone.quaternion.slerp(boneRestQuats[bone.name], factor);
}

function resetBonePos(name, factor) {
  const bone = bones[name];
  if (!bone) return;
  bone.position.lerp(boneRestPos[bone.name], factor);
}

// ============ 动作动画 ============

// 跳绳动画
function applyJumpRope(dt) {
  if (!innerModel) return;
  actionPhase += dt * 6;
  const t = actionPhase;

  // 整体上下跳动
  innerModel.position.y = Math.max(0, Math.sin(t * 2)) * 0.4;

  // 手臂：向前微抬，前臂弯曲（摇绳姿态）
  setBoneRotAxis('LeftArm', new THREE.Vector3(1, 0, 0), -0.8);
  setBoneRotAxis('RightArm', new THREE.Vector3(1, 0, 0), -0.8);
  setBoneRotAxis('LeftForeArm', new THREE.Vector3(1, 0, 0), -1.0);
  setBoneRotAxis('RightForeArm', new THREE.Vector3(1, 0, 0), -1.0);

  // 腿：微弯跳跃
  const legBend = Math.max(0, -Math.sin(t * 2)) * 0.3;
  setBoneRotAxis('LeftLeg', new THREE.Vector3(1, 0, 0), legBend);
  setBoneRotAxis('RightLeg', new THREE.Vector3(1, 0, 0), legBend);
  setBoneRotAxis('LeftFoot', new THREE.Vector3(1, 0, 0), -legBend * 0.5);
  setBoneRotAxis('RightFoot', new THREE.Vector3(1, 0, 0), -legBend * 0.5);

  setBoneRotAxis('Spine', new THREE.Vector3(1, 0, 0), 0.1);
  setBoneRotAxis('Spine1', new THREE.Vector3(1, 0, 0), 0.05);
  setBoneRotAxis('Spine2', new THREE.Vector3(1, 0, 0), 0.03);
  setBoneRotAxis('Head', new THREE.Vector3(1, 0, 0), -0.1);
}

// 俯卧撑动画
function applyPushup(dt) {
  if (!innerModel) return;
  actionPhase += dt * 3;
  const t = actionPhase;
  const dip = (Math.sin(t) * 0.5 + 0.5);

  innerModel.rotation.x = -Math.PI / 2;
  innerModel.position.y = 0.8 - dip * 0.3;

  const armBend = dip * 1.2;
  setBoneRotAxis('LeftArm', new THREE.Vector3(1, 0, 0), armBend);
  setBoneRotAxis('RightArm', new THREE.Vector3(1, 0, 0), armBend);
  setBoneRotAxis('LeftForeArm', new THREE.Vector3(1, 0, 0), armBend * 0.5);
  setBoneRotAxis('RightForeArm', new THREE.Vector3(1, 0, 0), armBend * 0.5);

  setBoneRotAxis('Spine', new THREE.Vector3(1, 0, 0), -0.05);
  setBoneRotAxis('Spine1', new THREE.Vector3(1, 0, 0), -0.03);
  setBoneRotAxis('Spine2', new THREE.Vector3(1, 0, 0), -0.02);
  setBoneRotAxis('Head', new THREE.Vector3(1, 0, 0), 0.3);

  setBoneRotAxis('LeftLeg', new THREE.Vector3(1, 0, 0), 0.05);
  setBoneRotAxis('RightLeg', new THREE.Vector3(1, 0, 0), 0.05);
  setBoneRotAxis('LeftFoot', new THREE.Vector3(1, 0, 0), -0.9);
  setBoneRotAxis('RightFoot', new THREE.Vector3(1, 0, 0), -0.9);
}

// 仰卧起坐动画
function applySitup(dt) {
  if (!innerModel) return;
  actionPhase += dt * 3;
  const t = actionPhase;
  // 仰卧起坐：身体前倾后仰
  const situp = Math.sin(t) * 0.5; // -0.5 ~ 0.5

  // 身体前倾（正向弯曲）
  setBoneRotAxis('Spine', new THREE.Vector3(1, 0, 0), situp * 0.6);
  setBoneRotAxis('Spine1', new THREE.Vector3(1, 0, 0), situp * 0.4);
  setBoneRotAxis('Spine2', new THREE.Vector3(1, 0, 0), situp * 0.3);
  setBoneRotAxis('Head', new THREE.Vector3(1, 0, 0), situp * 0.2);

  // 手放头后
  setBoneRotAxis('LeftArm', new THREE.Vector3(0, 0, 1), -1.2);
  setBoneRotAxis('RightArm', new THREE.Vector3(0, 0, 1), 1.2);
  setBoneRotAxis('LeftForeArm', new THREE.Vector3(1, 0, 0), -0.8);
  setBoneRotAxis('RightForeArm', new THREE.Vector3(1, 0, 0), -0.8);

  // 腿弯曲
  setBoneRotAxis('LeftLeg', new THREE.Vector3(1, 0, 0), -1.2);
  setBoneRotAxis('RightLeg', new THREE.Vector3(1, 0, 0), -1.2);
  setBoneRotAxis('LeftFoot', new THREE.Vector3(1, 0, 0), 0.5);
  setBoneRotAxis('RightFoot', new THREE.Vector3(1, 0, 0), 0.5);

  // 整体轻微上下
  innerModel.position.y = Math.max(0, 0.1 + Math.sin(t) * 0.1);
}

// 深蹲动画
function applySquat(dt) {
  if (!innerModel) return;
  actionPhase += dt * 2.5;
  const t = actionPhase;
  const squat = (Math.sin(t) * 0.5 + 0.5); // 0~1

  // 腿弯曲
  const legBend = squat * 1.4;
  setBoneRotAxis('LeftLeg', new THREE.Vector3(1, 0, 0), legBend);
  setBoneRotAxis('RightLeg', new THREE.Vector3(1, 0, 0), legBend);
  setBoneRotAxis('LeftFoot', new THREE.Vector3(1, 0, 0), -legBend * 0.3);
  setBoneRotAxis('RightFoot', new THREE.Vector3(1, 0, 0), -legBend * 0.3);

  // 身体前倾保持平衡
  setBoneRotAxis('Spine', new THREE.Vector3(1, 0, 0), squat * 0.3);
  setBoneRotAxis('Spine1', new THREE.Vector3(1, 0, 0), squat * 0.2);
  setBoneRotAxis('Spine2', new THREE.Vector3(1, 0, 0), squat * 0.1);

  // 手臂前伸保持平衡
  setBoneRotAxis('LeftArm', new THREE.Vector3(1, 0, 0), -squat * 0.8);
  setBoneRotAxis('RightArm', new THREE.Vector3(1, 0, 0), -squat * 0.8);
  setBoneRotAxis('LeftForeArm', new THREE.Vector3(1, 0, 0), -0.2);
  setBoneRotAxis('RightForeArm', new THREE.Vector3(1, 0, 0), -0.2);

  // 整体下沉
  innerModel.position.y = -squat * 0.4;
}

// 高抬腿动画
function applyHighKnees(dt) {
  if (!innerModel) return;
  actionPhase += dt * 7;
  const t = actionPhase;

  // 交替抬腿
  const leftKnee = Math.max(0, Math.sin(t)) * 1.5;
  const rightKnee = Math.max(0, Math.sin(t + Math.PI)) * 1.5;

  setBoneRotAxis('LeftLeg', new THREE.Vector3(1, 0, 0), -leftKnee);
  setBoneRotAxis('RightLeg', new THREE.Vector3(1, 0, 0), -rightKnee);
  setBoneRotAxis('LeftFoot', new THREE.Vector3(1, 0, 0), leftKnee * 0.3);
  setBoneRotAxis('RightFoot', new THREE.Vector3(1, 0, 0), rightKnee * 0.3);

  // 手臂摆动配合
  setBoneRotAxis('LeftArm', new THREE.Vector3(1, 0, 0), Math.sin(t + Math.PI) * 0.5);
  setBoneRotAxis('RightArm', new THREE.Vector3(1, 0, 0), Math.sin(t) * 0.5);

  // 轻微跳动
  innerModel.position.y = Math.abs(Math.sin(t)) * 0.15;

  setBoneRotAxis('Spine', new THREE.Vector3(1, 0, 0), 0.1);
}

// 平板支撑动画
function applyPlank(dt) {
  if (!innerModel) return;
  actionPhase += dt * 1;
  const t = actionPhase;
  // 微小抖动（很累！）
  const shake = Math.sin(t * 15) * 0.02;

  // 俯卧撑姿态保持
  innerModel.rotation.x = -Math.PI / 2;
  innerModel.position.y = 0.7 + shake;

  // 手臂撑住
  setBoneRotAxis('LeftArm', new THREE.Vector3(1, 0, 0), 0.1 + shake);
  setBoneRotAxis('RightArm', new THREE.Vector3(1, 0, 0), 0.1 + shake);
  setBoneRotAxis('LeftForeArm', new THREE.Vector3(1, 0, 0), 0.05);
  setBoneRotAxis('RightForeArm', new THREE.Vector3(1, 0, 0), 0.05);

  // 身体保持直线（微微颤抖）
  setBoneRotAxis('Spine', new THREE.Vector3(1, 0, 0), -0.05 + shake);
  setBoneRotAxis('Spine1', new THREE.Vector3(1, 0, 0), -0.03);
  setBoneRotAxis('Spine2', new THREE.Vector3(1, 0, 0), -0.02);

  // 头看前方
  setBoneRotAxis('Head', new THREE.Vector3(1, 0, 0), 0.4);

  // 腿伸直
  setBoneRotAxis('LeftLeg', new THREE.Vector3(1, 0, 0), 0.05);
  setBoneRotAxis('RightLeg', new THREE.Vector3(1, 0, 0), 0.05);
  setBoneRotAxis('LeftFoot', new THREE.Vector3(1, 0, 0), -0.9);
  setBoneRotAxis('RightFoot', new THREE.Vector3(1, 0, 0), -0.9);
}

// 哑铃弯举动画
function applyDumbbell(dt) {
  if (!innerModel) return;
  actionPhase += dt * 4;
  const t = actionPhase;
  const curl = (Math.sin(t) * 0.5 + 0.5); // 0~1

  // 手臂弯曲举哑铃
  const armCurl = curl * 2.0;
  setBoneRotAxis('LeftForeArm', new THREE.Vector3(1, 0, 0), -armCurl);
  setBoneRotAxis('RightForeArm', new THREE.Vector3(1, 0, 0), -armCurl);

  // 上臂保持
  setBoneRotAxis('LeftArm', new THREE.Vector3(0, 0, 1), -0.3);
  setBoneRotAxis('RightArm', new THREE.Vector3(0, 0, 1), 0.3);

  // 身体微微用力
  setBoneRotAxis('Spine', new THREE.Vector3(1, 0, 0), -curl * 0.05);
}

// 瑜伽拉伸动画
function applyYoga(dt) {
  if (!innerModel) return;
  actionPhase += dt * 1.5;
  const t = actionPhase;
  const balance = Math.sin(t * 0.5); // 缓慢平衡

  // 单腿站立（一条腿抬起）
  setBoneRotAxis('LeftLeg', new THREE.Vector3(1, 0, 0), 0);
  setBoneRotAxis('RightLeg', new THREE.Vector3(1, 0, 0), -Math.max(0, balance) * 1.0);
  setBoneRotAxis('RightFoot', new THREE.Vector3(1, 0, 0), Math.max(0, balance) * 0.5);

  // 双手合十高举
  setBoneRotAxis('LeftArm', new THREE.Vector3(0, 0, 1), -0.5 + balance * 0.1);
  setBoneRotAxis('RightArm', new THREE.Vector3(0, 0, 1), 0.5 - balance * 0.1);
  setBoneRotAxis('LeftForeArm', new THREE.Vector3(1, 0, 0), -0.3);
  setBoneRotAxis('RightForeArm', new THREE.Vector3(1, 0, 0), -0.3);

  // 身体微倾保持平衡
  setBoneRotAxis('Spine', new THREE.Vector3(2, 0, 0), balance * 0.1);

  // 整体轻微浮动
  innerModel.position.y = Math.abs(balance) * 0.05;
}

// 举抱枕深蹲动画（搞笑版深蹲）
function applyPillowSquat(dt) {
  if (!innerModel) return;
  actionPhase += dt * 3;
  const t = actionPhase;
  const squat = (Math.sin(t) * 0.5 + 0.5); // 0~1

  // 腿弯曲（深蹲）
  const legBend = squat * 1.2;
  setBoneRotAxis('LeftLeg', new THREE.Vector3(1, 0, 0), legBend);
  setBoneRotAxis('RightLeg', new THREE.Vector3(1, 0, 0), legBend);

  // 手臂抱着看不见的抱枕（胸前弯曲）
  setBoneRotAxis('LeftArm', new THREE.Vector3(0, 0, 1), -0.8);
  setBoneRotAxis('RightArm', new THREE.Vector3(0, 0, 1), 0.8);
  setBoneRotAxis('LeftForeArm', new THREE.Vector3(1, 0, 0), -1.5);
  setBoneRotAxis('RightForeArm', new THREE.Vector3(1, 0, 0), -1.5);

  // 身体前倾
  setBoneRotAxis('Spine', new THREE.Vector3(1, 0, 0), squat * 0.25);
  setBoneRotAxis('Spine1', new THREE.Vector3(1, 0, 0), squat * 0.15);

  // 头左右看（搞笑感）
  setBoneRotAxis('Head', new THREE.Vector3(0, 1, 0), Math.sin(t * 2) * 0.3);

  // 整体下沉
  innerModel.position.y = -squat * 0.35;
}

// 追猫跑动画
function applyChaseCat(dt) {
  if (!innerModel) return;
  actionPhase += dt * 10;
  const t = actionPhase;

  // 原地快速跑动
  const leftKnee = Math.sin(t) * 0.8;
  const rightKnee = Math.sin(t + Math.PI) * 0.8;
  setBoneRotAxis('LeftLeg', new THREE.Vector3(1, 0, 0), leftKnee);
  setBoneRotAxis('RightLeg', new THREE.Vector3(1, 0, 0), rightKnee);

  // 手臂快速摆动
  setBoneRotAxis('LeftArm', new THREE.Vector3(1, 0, 0), Math.sin(t + Math.PI) * 0.7);
  setBoneRotAxis('RightArm', new THREE.Vector3(1, 0, 0), Math.sin(t) * 0.7);

  // 身体前倾（追着跑）
  setBoneRotAxis('Spine', new THREE.Vector3(1, 0, 0), 0.3);
  setBoneRotAxis('Spine1', new THREE.Vector3(1, 0, 0), 0.2);

  // 头前伸
  setBoneRotAxis('Head', new THREE.Vector3(1, 0, 0), 0.2);

  // 跳动
  innerModel.position.y = Math.abs(Math.sin(t)) * 0.1;

  // 左右晃动（追着猫跑不稳定）
  setBoneRotAxis('Spine', new THREE.Vector3(0, 0, 1), Math.sin(t * 0.7) * 0.1);
}

// 蹲下动画（静止蹲姿）
function applyCrouch(dt) {
  if (!innerModel) return;
  // 腿弯曲
  const legBend = 1.2;
  setBoneRotAxis('LeftLeg', new THREE.Vector3(1, 0, 0), legBend);
  setBoneRotAxis('RightLeg', new THREE.Vector3(1, 0, 0), legBend);
  setBoneRotAxis('LeftFoot', new THREE.Vector3(1, 0, 0), -legBend * 0.3);
  setBoneRotAxis('RightFoot', new THREE.Vector3(1, 0, 0), -legBend * 0.3);

  // 身体前倾
  setBoneRotAxis('Spine', new THREE.Vector3(1, 0, 0), 0.35);
  setBoneRotAxis('Spine1', new THREE.Vector3(1, 0, 0), 0.2);

  // 手臂向前微伸保持平衡
  setBoneRotAxis('LeftArm', new THREE.Vector3(1, 0, 0), -0.5);
  setBoneRotAxis('RightArm', new THREE.Vector3(1, 0, 0), -0.5);
  setBoneRotAxis('LeftForeArm', new THREE.Vector3(1, 0, 0), -0.6);
  setBoneRotAxis('RightForeArm', new THREE.Vector3(1, 0, 0), -0.6);

  // 头微微前看
  setBoneRotAxis('Head', new THREE.Vector3(1, 0, 0), 0.15);

  // 整体下沉
  innerModel.position.y = -0.4;
}

// 拿东西动画（弯腰伸手）
function applyGrabItem(dt) {
  if (!innerModel) return;
  actionPhase += dt * 3;
  const t = actionPhase;
  // 弯腰进度
  const bend = Math.min(1, t * 0.5);

  // 整体前倾弯腰
  setBoneRotAxis('Spine', new THREE.Vector3(1, 0, 0), bend * 0.8);
  setBoneRotAxis('Spine1', new THREE.Vector3(1, 0, 0), bend * 0.5);
  setBoneRotAxis('Spine2', new THREE.Vector3(1, 0, 0), bend * 0.3);

  // 手臂向下伸
  setBoneRotAxis('LeftArm', new THREE.Vector3(1, 0, 0), bend * 1.2);
  setBoneRotAxis('RightArm', new THREE.Vector3(1, 0, 0), bend * 1.2);
  setBoneRotAxis('LeftForeArm', new THREE.Vector3(1, 0, 0), -bend * 0.3);
  setBoneRotAxis('RightForeArm', new THREE.Vector3(1, 0, 0), -bend * 0.3);

  // 腿微弯保持平衡
  setBoneRotAxis('LeftLeg', new THREE.Vector3(1, 0, 0), bend * 0.3);
  setBoneRotAxis('RightLeg', new THREE.Vector3(1, 0, 0), bend * 0.3);

  // 头低看
  setBoneRotAxis('Head', new THREE.Vector3(1, 0, 0), bend * 0.3);

  // 整体微下沉
  innerModel.position.y = -bend * 0.15;
}

// 动作动画映射
const ACTION_ANIMATIONS = {
  jumpRope: applyJumpRope,
  pushup: applyPushup,
  situp: applySitup,
  squat: applySquat,
  highKnees: applyHighKnees,
  plank: applyPlank,
  dumbbell: applyDumbbell,
  yoga: applyYoga,
  pillowSquat: applyPillowSquat,
  chaseCat: applyChaseCat,
  crouch: applyCrouch,
  grabItem: applyGrabItem,
};

// 恢复所有骨骼到初始姿态
function resetAllBones(dt) {
  const factor = 1 - Math.exp(-6 * dt);
  const allBones = [
    'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
    'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
    'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
    'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
    'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
  ];
  for (const name of allBones) {
    resetBone(name, factor);
    resetBonePos(name, factor);
  }
  if (innerModel) {
    innerModel.rotation.x = 0;
  }
}

/**
 * 创建玩家并添加到场景
 */
export function createPlayer(scene) {
  const gltf = getAssetRaw('player');

  if (!gltf || !gltf.scene) {
    console.warn('玩家模型未加载，使用占位几何体');
    createFallbackPlayer(scene);
    return;
  }

  let model;
  try {
    model = cloneSkeleton(gltf.scene);
  } catch (e) {
    console.warn('SkeletonUtils.clone 失败，尝试普通 clone:', e);
    model = gltf.scene.clone(true);
  }
  model.name = 'player-model';

  // 自动缩放
  const box = new THREE.Box3();
  model.traverse((child) => {
    if (child.isSkinnedMesh) {
      child.frustumCulled = false;
      const geometry = child.geometry;
      if (geometry.boundingBox === null) geometry.computeBoundingBox();
      const meshBox = geometry.boundingBox.clone();
      meshBox.applyMatrix4(child.matrixWorld);
      box.union(meshBox);
    }
  });
  if (box.isEmpty()) box.setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const targetHeight = 2.5;
  const scale = targetHeight / size.y;
  model.scale.setScalar(scale);

  // 底部对齐
  const newBox = new THREE.Box3();
  model.updateMatrixWorld(true);
  model.traverse((child) => {
    if (child.isSkinnedMesh) {
      const geometry = child.geometry;
      if (geometry.boundingBox === null) geometry.computeBoundingBox();
      const meshBox = geometry.boundingBox.clone();
      meshBox.applyMatrix4(child.matrixWorld);
      newBox.union(meshBox);
    }
  });
  if (newBox.isEmpty()) newBox.setFromObject(model);
  const bottom = newBox.min.y;
  model.position.y = -bottom;

  const group = new THREE.Group();
  group.name = 'player';
  group.add(model);
  innerModel = model;

  const pos = getPlayerPosition();
  const pos3d = physTo3D(pos.x, pos.y);
  group.position.set(pos3d.x, 0, pos3d.z);
  prevPos3d = { x: pos3d.x, z: pos3d.z };

  mesh = group;
  scene.add(mesh);

  // 缓存骨骼
  cacheBones(model);

  // 处理动画
  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      const name = clip.name.toLowerCase();
      if (name.includes('walk') || name.includes('run')) {
        walkAction = action;
      } else if (name.includes('idle') || name.includes('stand')) {
        idleAction = action;
      }
    });

    currentAction = idleAction || walkAction || mixer.clipAction(gltf.animations[0]);
    if (currentAction) currentAction.play();
  }
}

function createFallbackPlayer(scene) {
  const group = new THREE.Group();
  group.name = 'player';

  const bodyGeo = new THREE.CylinderGeometry(0.35, 0.4, 1.2, 16);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x4a90d9 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  group.add(body);

  const headGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffcc99 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.5;
  group.add(head);

  const pos = getPlayerPosition();
  const pos3d = physTo3D(pos.x, pos.y);
  group.position.set(pos3d.x, 0, pos3d.z);
  prevPos3d = { x: pos3d.x, z: pos3d.z };

  mesh = group;
  scene.add(mesh);
}

function angleDiff(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function switchAction(newAction) {
  if (!newAction || newAction === currentAction) return;
  if (currentAction) currentAction.fadeOut(0.3);
  newAction.reset().fadeIn(0.3).play();
  currentAction = newAction;
}

/**
 * 触发特殊动作
 */
export function triggerAction(action) {
  if (actionMode !== 'normal') return; // 已在做动作中
  actionMode = action;
  actionPhase = 0;

  // 暂停当前 GLB 动画
  if (currentAction) currentAction.fadeOut(0.2);
}

/**
 * 结束当前动作，恢复正常
 */
export function endAction() {
  if (actionMode === 'normal') return;
  actionMode = 'normal';
  if (innerModel) {
    innerModel.position.y = 0;
    innerModel.rotation.x = 0;
  }
  if (idleAction) {
    idleAction.reset().fadeIn(0.3).play();
    currentAction = idleAction;
  }
}

/**
 * 当前是否在做动作
 */
export function isInAction() {
  return actionMode !== 'normal';
}

/**
 * 每帧更新玩家
 * @param {number} delta - 帧间隔
 * @param {object} input - { dx, dy, moving, actionCancel }
 * @param {object|null} autoDir - 自动寻路方向 { dx, dy } 或 null
 * @param {number|null} autoSpeedRatio - 自动寻路速度倍率
 */
export function updatePlayer(delta, input, autoDir = null, autoSpeedRatio = null) {
  if (mixer) mixer.update(delta || 0.016);
  if (!mesh) return;

  const dt = Math.min(delta, 0.05);
  const currentPos = getPlayerPosition();

  // --- 特殊动作模式 ---
  if (actionMode !== 'normal') {
    resetAllBones(dt);

    const animFn = ACTION_ANIMATIONS[actionMode];
    if (animFn) animFn(dt);

    // 按取消键退出动作
    if (input.actionCancel) {
      endAction();
    }
    lastMoving = false;
    return;
  }

  // --- 正常移动 ---
  let moveDx = input.dx;
  let moveDy = input.dy;
  let isMoving = input.moving;
  let speed = MOVE_SPEED;

  // 自动寻路：当无手动输入且有自动方向时
  if (!isMoving && autoDir) {
    moveDx = autoDir.dx;
    moveDy = autoDir.dy;
    isMoving = true;
    speed = MOVE_SPEED * (autoSpeedRatio || 0.6);
  }

  let targetX, targetZ;
  if (isMoving) {
    // 用速度驱动移动，碰撞自动推离
    setPlayerVelocity(moveDx * speed, moveDy * speed);
    stepPhysics(dt);

    const resolvedPos = getPlayerPosition();
    const pos3d = physTo3D(resolvedPos.x, resolvedPos.y);
    targetX = pos3d.x;
    targetZ = pos3d.z;

    if (!lastMoving) switchAction(walkAction);
  } else {
    // 停止移动，高阻尼会让玩家迅速停下
    setPlayerVelocity(0, 0);
    stepPhysics(dt);

    const resolvedPos = getPlayerPosition();
    const pos3d = physTo3D(resolvedPos.x, resolvedPos.y);
    targetX = pos3d.x;
    targetZ = pos3d.z;

    if (lastMoving) switchAction(idleAction);
  }

  // --- 平滑位置插值 ---
  if (!prevPos3d) prevPos3d = { x: targetX, z: targetZ };
  const lerpFactor = 1 - Math.exp(-POSITION_LERP * dt);
  const smoothX = prevPos3d.x + (targetX - prevPos3d.x) * lerpFactor;
  const smoothZ = prevPos3d.z + (targetZ - prevPos3d.z) * lerpFactor;
  mesh.position.x = smoothX;
  mesh.position.z = smoothZ;
  prevPos3d.x = smoothX;
  prevPos3d.z = smoothZ;

  // --- 平滑旋转 ---
  if (isMoving) {
    const targetRotation = Math.atan2(moveDx, moveDy) + Math.PI;
    const rotLerp = 1 - Math.exp(-ROTATION_LERP * dt);
    mesh.rotation.y += angleDiff(mesh.rotation.y, targetRotation) * rotLerp;
  }

  lastMoving = isMoving;
}

export function modifyWeight(d) { state.weight = Math.max(0, Math.min(100, state.weight + d)); }
export function modifyHappiness(d) { state.happiness = Math.max(0, Math.min(100, state.happiness + d)); }

export function getWeight() { return state.weight; }
export function getHappiness() { return state.happiness; }
export function getX2d() { return getPlayerPosition().x; }
export function getY2d() { return getPlayerPosition().y; }
export function getMesh() { return mesh; }
