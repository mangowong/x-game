/**
 * food.js - 食物管理
 * - 在场景中随机生成食物（组合几何体）
 * - 食物包含 2D 物理坐标和 3D 网格
 * - 碰到食物触发"吃掉"逻辑
 * - 食物定时刷新，避免生成在家具碰撞区
 */

import * as THREE from 'three';
import { randomRange } from './utils.js';

const FOOD_TYPES = [
  { name: '薯片', createMesh: createChipsMesh },
  { name: '蛋糕', createMesh: createCakeMesh },
  { name: '鸡腿', createMesh: createDrumstickMesh },
  { name: '可乐', createMesh: createColaMesh },
  { name: '甜甜圈', createMesh: createDonutMesh },
];

const MAX_FOOD = 6;
const RESPAWN_INTERVAL = 5000;
const EAT_RADIUS = 0.8;

// 家具禁区列表：{ cx, cz, hw, hd } 中心点+半尺寸（与 scene.js 碰撞体对应）
const FURNITURE_ZONES = [
  { cx: 9, cz: 1, hw: 1.5, hd: 0.75 },      // 沙发
  { cx: 7, cz: 3, hw: 0.9, hd: 0.5 },        // 茶几
  { cx: 6, cz: 10, hw: 1.5, hd: 0.35 },      // 电视柜
  { cx: 1, cz: 9, hw: 0.75, hd: 0.3 },       // 书架
  { cx: 10, cz: 2, hw: 0.3, hd: 0.3 },       // 落地灯
  { cx: 3, cz: 3, hw: 0.55, hd: 0.55 },      // 单人椅
  { cx: 2, cz: 6, hw: 0.8, hd: 0.6 },        // 餐桌
  { cx: 1, cz: 1, hw: 0.4, hd: 0.35 },       // 冰箱
  { cx: 10, cz: 9, hw: 0.35, hd: 0.35 },     // 大盆栽
  { cx: 1, cz: 4, hw: 0.35, hd: 0.55 },      // 鞋柜
  { cx: 10, cz: 7, hw: 0.2, hd: 0.2 },       // 垃圾桶
];

let foods = [];
let sceneRef = null;
let onEatCallback = null;

// --- 食物网格创建函数 ---

function createChipsMesh() {
  const group = new THREE.Group();
  // 碗
  const bowlGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.06, 12);
  const bowlMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  const bowl = new THREE.Mesh(bowlGeo, bowlMat);
  bowl.position.y = 0.03;
  group.add(bowl);
  // 薯片（几片扁椭圆散落）
  const chipMat = new THREE.MeshLambertMaterial({ color: 0xf5c542 });
  for (let i = 0; i < 5; i++) {
    const chipGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.008, 8);
    const chip = new THREE.Mesh(chipGeo, chipMat);
    chip.position.set(
      (Math.random() - 0.5) * 0.1,
      0.07 + Math.random() * 0.03,
      (Math.random() - 0.5) * 0.1
    );
    chip.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
    group.add(chip);
  }
  return group;
}

function createCakeMesh() {
  const group = new THREE.Group();
  // 底层蛋糕
  const baseGeo = new THREE.CylinderGeometry(0.13, 0.14, 0.1, 16);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.05;
  group.add(base);
  // 上层
  const topGeo = new THREE.CylinderGeometry(0.1, 0.11, 0.08, 16);
  const topMat = new THREE.MeshLambertMaterial({ color: 0xf5a0a0 });
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.y = 0.14;
  group.add(top);
  // 奶油
  const creamGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.02, 16);
  const creamMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const cream = new THREE.Mesh(creamGeo, creamMat);
  cream.position.y = 0.19;
  group.add(cream);
  // 樱桃
  const cherryGeo = new THREE.SphereGeometry(0.03, 8, 8);
  const cherryMat = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
  const cherry = new THREE.Mesh(cherryGeo, cherryMat);
  cherry.position.y = 0.22;
  group.add(cherry);
  return group;
}

function createDrumstickMesh() {
  const group = new THREE.Group();
  // 骨棒
  const boneGeo = new THREE.CylinderGeometry(0.02, 0.015, 0.2, 8);
  const boneMat = new THREE.MeshLambertMaterial({ color: 0xf5e6d0 });
  const bone = new THREE.Mesh(boneGeo, boneMat);
  bone.position.set(0, 0.12, 0);
  bone.rotation.z = 0.3;
  group.add(bone);
  // 肉球
  const meatGeo = new THREE.SphereGeometry(0.09, 12, 12);
  const meatMat = new THREE.MeshLambertMaterial({ color: 0xd4a056 });
  const meat = new THREE.Mesh(meatGeo, meatMat);
  meat.position.set(0.04, 0.06, 0);
  meat.scale.set(1, 0.8, 1);
  group.add(meat);
  // 烤痕
  const grillGeo = new THREE.BoxGeometry(0.12, 0.005, 0.06);
  const grillMat = new THREE.MeshLambertMaterial({ color: 0xb8863a });
  const grill = new THREE.Mesh(grillGeo, grillMat);
  grill.position.set(0.04, 0.1, 0);
  group.add(grill);
  return group;
}

function createColaMesh() {
  const group = new THREE.Group();
  // 杯身
  const cupGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.16, 12);
  const cupMat = new THREE.MeshLambertMaterial({ color: 0x2ecc71 });
  const cup = new THREE.Mesh(cupGeo, cupMat);
  cup.position.y = 0.08;
  group.add(cup);
  // 盖子
  const lidGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.02, 12);
  const lidMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const lid = new THREE.Mesh(lidGeo, lidMat);
  lid.position.y = 0.17;
  group.add(lid);
  // 吸管
  const strawGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6);
  const strawMat = new THREE.MeshLambertMaterial({ color: 0xff4444 });
  const straw = new THREE.Mesh(strawGeo, strawMat);
  straw.position.set(0.02, 0.2, 0);
  straw.rotation.z = 0.15;
  group.add(straw);
  return group;
}

function createDonutMesh() {
  const group = new THREE.Group();
  // 甜甜圈主体
  const donutGeo = new THREE.TorusGeometry(0.08, 0.035, 12, 24);
  const donutMat = new THREE.MeshLambertMaterial({ color: 0xe891c9 });
  const donut = new THREE.Mesh(donutGeo, donutMat);
  donut.position.y = 0.05;
  donut.rotation.x = Math.PI / 2;
  group.add(donut);
  // 糖霜
  const icingGeo = new THREE.TorusGeometry(0.08, 0.025, 8, 24, Math.PI);
  const icingMat = new THREE.MeshLambertMaterial({ color: 0xff69b4 });
  const icing = new THREE.Mesh(icingGeo, icingMat);
  icing.position.y = 0.06;
  icing.rotation.x = Math.PI / 2;
  icing.rotation.z = 0.5;
  group.add(icing);
  // 彩色糖粒
  const sprinkleColors = [0xff4444, 0x44cc44, 0x4444ff, 0xffff44];
  for (let i = 0; i < 6; i++) {
    const sGeo = new THREE.BoxGeometry(0.015, 0.005, 0.005);
    const sMat = new THREE.MeshLambertMaterial({ color: sprinkleColors[i % sprinkleColors.length] });
    const s = new THREE.Mesh(sGeo, sMat);
    const angle = (i / 6) * Math.PI * 2;
    s.position.set(Math.cos(angle) * 0.07, 0.07, Math.sin(angle) * 0.07);
    s.rotation.y = angle;
    group.add(s);
  }
  return group;
}

/**
 * 初始化食物系统
 */
export function initFood(scene, onEat) {
  sceneRef = scene;
  onEatCallback = onEat;
  spawnBatch(MAX_FOOD);

  setInterval(() => {
    if (foods.length < MAX_FOOD) {
      spawnFood();
    }
  }, RESPAWN_INTERVAL);
}

function spawnBatch(count) {
  for (let i = 0; i < count; i++) {
    spawnFood();
  }
}

function isInFurnitureZone(fx, fz) {
  for (const zone of FURNITURE_ZONES) {
    if (Math.abs(fx - zone.cx) < zone.hw + 0.3 &&
        Math.abs(fz - zone.cz) < zone.hd + 0.3) {
      return true;
    }
  }
  return false;
}

function spawnFood() {
  const type = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];

  let fx, fz;
  let valid = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    fx = randomRange(1.5, 10.5);
    fz = randomRange(1.5, 10.5);
    // 检查是否在家具碰撞区
    if (isInFurnitureZone(fx, fz)) continue;
    // 检查是否和其他食物太近
    let tooClose = false;
    for (const food of foods) {
      const dx = fx - food.x;
      const dz = fz - food.z;
      if (Math.sqrt(dx * dx + dz * dz) < 0.8) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) { valid = true; break; }
  }
  if (!valid) return; // 放弃本次生成

  // TODO: 替换为食物 GLB 模型
  const mesh = type.createMesh();
  mesh.position.set(fx, 0.02, fz);
  mesh.rotation.y = Math.random() * Math.PI;
  mesh.castShadow = true;
  mesh.name = `food-${type.name}`;

  mesh.traverse((child) => {
    if (child.isMesh) {
      child.userData.isFood = true;
    }
  });

  sceneRef.add(mesh);

  foods.push({
    name: type.name,
    x: fx,
    z: fz,
    mesh,
  });
}

/**
 * 检测并吃掉附近食物
 */
export function tryEatFood(pos) {
  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];
    const dx = pos.x - food.x;
    const dz = pos.y - food.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < EAT_RADIUS) {
      disposeMeshGroup(food.mesh);
      sceneRef.remove(food.mesh);

      const eaten = { name: food.name };
      foods.splice(i, 1);

      if (onEatCallback) {
        onEatCallback(eaten);
      }

      return eaten;
    }
  }
  return null;
}

function disposeMeshGroup(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.geometry.dispose();
      if (child.material.dispose) child.material.dispose();
    }
  });
}

/**
 * 每帧更新食物（简单旋转动画 + 上下浮动）
 */
export function updateFood() {
  foods.forEach((food) => {
    if (food.mesh) {
      food.mesh.rotation.y += 0.02;
      food.mesh.position.y = 0.02 + Math.sin(Date.now() * 0.003 + food.x) * 0.05;
    }
  });
}

/**
 * 获取所有食物
 */
export function getFoods() {
  return foods;
}
