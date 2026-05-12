/**
 * scene.js - 场景管理
 * - 创建等距视角的客厅环境
 * - 地板、墙壁、地毯、丰富家具
 * - 环境光 + 方向光 + 点光源
 * - 所有物体用基本几何体组合占位，标注替换点
 */

import * as THREE from 'three';
import { physTo3D } from './utils.js';
import { createFurnitureCollider } from './physics.js';

const FLOOR_SIZE = 12;

/**
 * 快捷创建家具并加入场景，同时注册碰撞区域到 Rapier
 */
function addFurniture(scene, { name, parts, pos2d, rotY = 0, collider }) {
  const group = new THREE.Group();
  group.name = name;

  parts.forEach(({ geo, mat, pos, rot }) => {
    const mesh = new THREE.Mesh(geo, mat);
    if (pos) mesh.position.set(pos.x, pos.y, pos.z);
    if (rot) mesh.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  const pos3d = physTo3D(pos2d[0], pos2d[1]);
  group.position.set(pos3d.x, 0, pos3d.z);
  group.rotation.y = rotY;
  scene.add(group);

  // 注册碰撞到 Rapier
  if (collider) {
    createFurnitureCollider(
      pos2d[0] + (collider.offsetX || 0),
      pos2d[1] + (collider.offsetY || 0),
      collider.hw,
      collider.hh,
      collider.rotation || 0,
    );
  }

  return group;
}

// 常用材质
const WOOD_DARK = new THREE.MeshLambertMaterial({ color: 0x5c3d2e });
const WOOD_MID = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
const WOOD_LIGHT = new THREE.MeshLambertMaterial({ color: 0xc9a86c });
const FABRIC_GREEN = new THREE.MeshLambertMaterial({ color: 0x5b7553 });
const FABRIC_BEIGE = new THREE.MeshLambertMaterial({ color: 0xd4c5a9 });
const FABRIC_RED = new THREE.MeshLambertMaterial({ color: 0xb85c38 });
const METAL_DARK = new THREE.MeshLambertMaterial({ color: 0x333333 });
const METAL_SILVER = new THREE.MeshLambertMaterial({ color: 0x888899 });
const PLASTIC_WHITE = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
const GLASS_MAT = new THREE.MeshLambertMaterial({ color: 0xaaddff, transparent: true, opacity: 0.3 });
const WALL_MAT = new THREE.MeshLambertMaterial({ color: 0xf5e6d3 });
const PLANT_GREEN = new THREE.MeshLambertMaterial({ color: 0x3a7d44 });
const PLANT_POT = new THREE.MeshLambertMaterial({ color: 0xc4783e });
const BOOK_COLORS = [0xcc3333, 0x3366cc, 0x339933, 0xcc9933, 0x9933cc, 0xcc6633].map(
  c => new THREE.MeshLambertMaterial({ color: c })
);

/**
 * 创建客厅场景
 */
export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3d2b1f);

  // --- 光照 ---
  const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffeedd, 1.0);
  dirLight.position.set(5, 12, 8);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  dirLight.shadow.camera.left = -10;
  dirLight.shadow.camera.right = 10;
  dirLight.shadow.camera.top = 10;
  dirLight.shadow.camera.bottom = -10;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 30;
  scene.add(dirLight);

  // 落地灯暖光
  const lampLight = new THREE.PointLight(0xffe4b5, 0.6, 8);
  lampLight.position.set(10, 2, 2);
  scene.add(lampLight);

  // 电视机蓝光
  const tvLight = new THREE.PointLight(0x88bbff, 0.3, 4);
  tvLight.position.set(6, 1.8, 11);
  scene.add(tvLight);

  // --- 地板 ---
  // TODO: 替换为带贴图的地板 GLB 模型
  const floorGeo = new THREE.PlaneGeometry(18, 18);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0xc9a86c });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'floor';
  scene.add(floor);

  // --- 网格辅助线 ---
  const gridGroup = new THREE.Group();
  gridGroup.name = 'grid';
  const gridMat = new THREE.LineBasicMaterial({ color: 0x8b7355, transparent: true, opacity: 0.2 });
  for (let i = 0; i <= FLOOR_SIZE; i++) {
    gridGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.01, i),
        new THREE.Vector3(FLOOR_SIZE, 0.01, i),
      ]), gridMat
    ));
    gridGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i, 0.01, 0),
        new THREE.Vector3(i, 0.01, FLOOR_SIZE),
      ]), gridMat
    ));
  }
  scene.add(gridGroup);

  // --- 墙壁 ---
  // TODO: 替换为墙壁 GLB 模型
  const backWallGeo = new THREE.BoxGeometry(FLOOR_SIZE, 5, 0.2);
  const backWall = new THREE.Mesh(backWallGeo, WALL_MAT);
  backWall.position.set(FLOOR_SIZE / 2, 2.5, FLOOR_SIZE + 0.1);
  backWall.name = 'wall-back';
  scene.add(backWall);

  const leftWallGeo = new THREE.BoxGeometry(0.2, 5, FLOOR_SIZE);
  const leftWall = new THREE.Mesh(leftWallGeo, WALL_MAT);
  leftWall.position.set(-0.1, 2.5, FLOOR_SIZE / 2);
  leftWall.name = 'wall-left';
  scene.add(leftWall);

  // 踢脚线
  const baseboardMat = new THREE.MeshLambertMaterial({ color: 0xddd0c0 });
  const baseboardBackGeo = new THREE.BoxGeometry(18, 0.15, 0.05);
  const bbBack = new THREE.Mesh(baseboardBackGeo, baseboardMat);
  bbBack.position.set(backWall.position.x, 0.075, backWall.position.z - 0.12);
  scene.add(bbBack);

  const baseboardLeftGeo = new THREE.BoxGeometry(0.05, 0.15, 13);
  const bbLeft = new THREE.Mesh(baseboardLeftGeo, baseboardMat);
  bbLeft.position.set(leftWall.position.x + 0.12, 0.075, leftWall.position.z);
  scene.add(bbLeft);

  // =============================================
  // 家具
  // =============================================

  // --- 地毯 --- 无碰撞（可踩上去）
  addFurniture(scene, {
    name: 'carpet',
    pos2d: [5, 5],
    parts: [
      { geo: new THREE.BoxGeometry(6, 0.04, 4.5), mat: FABRIC_RED, pos: { x: 0, y: 0.02, z: 0 } },
      { geo: new THREE.BoxGeometry(6.1, 0.05, 0.15), mat: new THREE.MeshLambertMaterial({ color: 0x9a4a2a }), pos: { x: 0, y: 0.03, z: 2.2 } },
      { geo: new THREE.BoxGeometry(6.1, 0.05, 0.15), mat: new THREE.MeshLambertMaterial({ color: 0x9a4a2a }), pos: { x: 0, y: 0.03, z: -2.2 } },
      // 花纹条纹
      { geo: new THREE.BoxGeometry(5.4, 0.05, 0.08), mat: new THREE.MeshLambertMaterial({ color: 0xddaa55 }), pos: { x: 0, y: 0.04, z: 1.5 } },
      { geo: new THREE.BoxGeometry(5.4, 0.05, 0.08), mat: new THREE.MeshLambertMaterial({ color: 0xddaa55 }), pos: { x: 0, y: 0.04, z: -1.5 } },
      { geo: new THREE.BoxGeometry(0.08, 0.05, 3.8), mat: new THREE.MeshLambertMaterial({ color: 0xddaa55 }), pos: { x: -2.5, y: 0.04, z: 0 } },
      { geo: new THREE.BoxGeometry(0.08, 0.05, 3.8), mat: new THREE.MeshLambertMaterial({ color: 0xddaa55 }), pos: { x: 2.5, y: 0.04, z: 0 } },
      // 中心菱形装饰
      { geo: new THREE.BoxGeometry(1, 0.05, 1), mat: new THREE.MeshLambertMaterial({ color: 0xcc8833 }), pos: { x: 0, y: 0.04, z: 0 }, rot: { y: Math.PI / 4 } },
    ],
  });

  // --- 沙发 ---
  // TODO: 替换为沙发 GLB 模型
  addFurniture(scene, {
    name: 'sofa',
    pos2d: [9, 1],
    collider: { hw: 1.5, hh: 0.75 },
    parts: [
      // 底座
      { geo: new THREE.BoxGeometry(3, 0.5, 1.2), mat: FABRIC_GREEN, pos: { x: 0, y: 0.35, z: 0 } },
      // 靠背
      { geo: new THREE.BoxGeometry(3, 0.7, 0.25), mat: FABRIC_GREEN, pos: { x: 0, y: 0.75, z: -0.48 } },
      // 左扶手
      { geo: new THREE.BoxGeometry(0.25, 0.55, 1.2), mat: FABRIC_GREEN, pos: { x: -1.38, y: 0.5, z: 0 } },
      // 右扶手
      { geo: new THREE.BoxGeometry(0.25, 0.55, 1.2), mat: FABRIC_GREEN, pos: { x: 1.38, y: 0.5, z: 0 } },
      // 坐垫左
      { geo: new THREE.BoxGeometry(1.2, 0.12, 0.9), mat: FABRIC_BEIGE, pos: { x: -0.7, y: 0.66, z: 0.05 } },
      // 坐垫右
      { geo: new THREE.BoxGeometry(1.2, 0.12, 0.9), mat: FABRIC_BEIGE, pos: { x: 0.7, y: 0.66, z: 0.05 } },
      // 靠垫
      { geo: new THREE.BoxGeometry(0.5, 0.4, 0.15), mat: new THREE.MeshLambertMaterial({ color: 0xe8c170 }), pos: { x: -0.7, y: 0.85, z: -0.3 }, rot: { x: -0.2 } },
      { geo: new THREE.BoxGeometry(0.5, 0.4, 0.15), mat: new THREE.MeshLambertMaterial({ color: 0xd4764e }), pos: { x: 0.7, y: 0.85, z: -0.3 }, rot: { x: -0.2 } },
    ],
  });

  // --- 茶几 ---
  // TODO: 替换为茶几 GLB 模型
  addFurniture(scene, {
    name: 'coffee-table',
    pos2d: [7, 3],
    collider: { hw: 0.9, hh: 0.5 },
    parts: [
      // 桌面
      { geo: new THREE.BoxGeometry(1.8, 0.08, 1), mat: WOOD_MID, pos: { x: 0, y: 0.45, z: 0 } },
      // 下层搁板
      { geo: new THREE.BoxGeometry(1.6, 0.05, 0.8), mat: WOOD_MID, pos: { x: 0, y: 0.15, z: 0 } },
      // 四条腿
      { geo: new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), mat: WOOD_DARK, pos: { x: -0.75, y: 0.225, z: -0.35 } },
      { geo: new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), mat: WOOD_DARK, pos: { x: 0.75, y: 0.225, z: -0.35 } },
      { geo: new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), mat: WOOD_DARK, pos: { x: -0.75, y: 0.225, z: 0.35 } },
      { geo: new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), mat: WOOD_DARK, pos: { x: 0.75, y: 0.225, z: 0.35 } },
      // 桌上的遥控器
      { geo: new THREE.BoxGeometry(0.25, 0.03, 0.08), mat: METAL_DARK, pos: { x: 0.3, y: 0.51, z: 0.1 } },
      // 杯子
      { geo: new THREE.CylinderGeometry(0.06, 0.05, 0.12, 12), mat: PLASTIC_WHITE, pos: { x: -0.4, y: 0.53, z: -0.1 } },
      // 杂志
      { geo: new THREE.BoxGeometry(0.3, 0.02, 0.4), mat: new THREE.MeshLambertMaterial({ color: 0x4488cc }), pos: { x: 0.1, y: 0.5, z: -0.2 } },
      // 小碟子
      { geo: new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12), mat: new THREE.MeshLambertMaterial({ color: 0xeeddcc }), pos: { x: -0.5, y: 0.5, z: 0.2 } },
    ],
  });

  // --- 电视柜 + 电视 ---
  // TODO: 替换为电视柜 GLB 模型
  addFurniture(scene, {
    name: 'tv-stand',
    pos2d: [6, 10],
    collider: { hw: 1.5, hh: 0.35 },
    parts: [
      // 柜体
      { geo: new THREE.BoxGeometry(3, 0.7, 0.6), mat: WOOD_DARK, pos: { x: 0, y: 0.35, z: 0 } },
      // 柜门左
      { geo: new THREE.BoxGeometry(1.35, 0.6, 0.04), mat: WOOD_DARK, pos: { x: -0.7, y: 0.35, z: 0.32 } },
      // 柜门右
      { geo: new THREE.BoxGeometry(1.35, 0.6, 0.04), mat: WOOD_DARK, pos: { x: 0.7, y: 0.35, z: 0.32 } },
      // 把手左
      { geo: new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), mat: METAL_SILVER, pos: { x: -0.15, y: 0.35, z: 0.35 }, rot: { x: Math.PI / 2 } },
      // 把手右
      { geo: new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), mat: METAL_SILVER, pos: { x: 0.15, y: 0.35, z: 0.35 }, rot: { x: Math.PI / 2 } },
      // 电视机底座
      { geo: new THREE.BoxGeometry(0.6, 0.05, 0.25), mat: METAL_DARK, pos: { x: 0, y: 0.73, z: 0 } },
      // 电视机屏幕
      { geo: new THREE.BoxGeometry(2, 1.1, 0.06), mat: METAL_DARK, pos: { x: 0, y: 1.4, z: -0.02 } },
      // 屏幕亮面（模拟开机画面）
      { geo: new THREE.BoxGeometry(1.85, 0.95, 0.01), mat: new THREE.MeshBasicMaterial({ color: 0x1a3a5c }), pos: { x: 0, y: 1.4, z: 0.02 } },
      // 屏幕内容色块
      { geo: new THREE.BoxGeometry(0.8, 0.4, 0.005), mat: new THREE.MeshBasicMaterial({ color: 0x3388bb }), pos: { x: -0.3, y: 1.55, z: 0.025 } },
      { geo: new THREE.BoxGeometry(0.6, 0.25, 0.005), mat: new THREE.MeshBasicMaterial({ color: 0x55aa44 }), pos: { x: 0.4, y: 1.3, z: 0.025 } },
    ],
  });

  // --- 书架 ---
  // TODO: 替换为书架 GLB 模型
  const bookshelfParts = [
    // 侧板左
    { geo: new THREE.BoxGeometry(0.06, 2.2, 0.5), mat: WOOD_DARK, pos: { x: -0.72, y: 1.1, z: 0 } },
    // 侧板右
    { geo: new THREE.BoxGeometry(0.06, 2.2, 0.5), mat: WOOD_DARK, pos: { x: 0.72, y: 1.1, z: 0 } },
    // 背板
    { geo: new THREE.BoxGeometry(1.44, 2.2, 0.04), mat: WOOD_DARK, pos: { x: 0, y: 1.1, z: -0.23 } },
  ];
  // 4层隔板
  for (let i = 0; i < 5; i++) {
    bookshelfParts.push({
      geo: new THREE.BoxGeometry(1.38, 0.04, 0.5),
      mat: WOOD_DARK,
      pos: { x: 0, y: i * 0.5 + 0.15, z: 0 },
    });
  }
  // 书本
  for (let row = 0; row < 4; row++) {
    const y = row * 0.5 + 0.42;
    const count = 4 + Math.floor(Math.random() * 3);
    let xStart = -0.55;
    for (let b = 0; b < count; b++) {
      const thickness = 0.04 + Math.random() * 0.06;
      const height = 0.25 + Math.random() * 0.15;
      const color = BOOK_COLORS[(row * 3 + b) % BOOK_COLORS.length];
      bookshelfParts.push({
        geo: new THREE.BoxGeometry(thickness, height, 0.35),
        mat: color,
        pos: { x: xStart + thickness / 2, y: y, z: 0.02 },
      });
      xStart += thickness + 0.01;
    }
  }
  addFurniture(scene, { name: 'bookshelf', pos2d: [1, 9], collider: { hw: 0.75, hh: 0.3 }, parts: bookshelfParts });

  // --- 落地灯 ---
  // TODO: 替换为落地灯 GLB 模型
  addFurniture(scene, {
    name: 'floor-lamp',
    pos2d: [10, 2],
    collider: { hw: 0.3, hh: 0.3 },
    parts: [
      // 底座
      { geo: new THREE.CylinderGeometry(0.2, 0.22, 0.05, 16), mat: METAL_SILVER, pos: { x: 0, y: 0.025, z: 0 } },
      // 灯杆
      { geo: new THREE.CylinderGeometry(0.025, 0.025, 1.8, 8), mat: METAL_SILVER, pos: { x: 0, y: 0.95, z: 0 } },
      // 灯罩（半透明暖光效果）
      { geo: new THREE.CylinderGeometry(0.15, 0.3, 0.35, 16, 1, true), mat: new THREE.MeshLambertMaterial({ color: 0xfff5e0, side: THREE.DoubleSide, transparent: true, opacity: 0.7, emissive: 0xfff5e0, emissiveIntensity: 0.3 }), pos: { x: 0, y: 1.95, z: 0 } },
      // 灯泡光晕
      { geo: new THREE.SphereGeometry(0.06, 8, 8), mat: new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.6 }), pos: { x: 0, y: 1.85, z: 0 } },
    ],
  });

  // --- 单人沙发椅 ---
  // TODO: 替换为沙发椅 GLB 模型
  addFurniture(scene, {
    name: 'armchair',
    pos2d: [3, 3],
    rotY: Math.PI / 4 + Math.PI / 2,
    collider: { hw: 0.55, hh: 0.55, rotation: Math.PI / 4 + Math.PI / 2 },
    parts: [
      { geo: new THREE.BoxGeometry(1, 0.4, 1), mat: new THREE.MeshLambertMaterial({ color: 0x7a5c3e }), pos: { x: 0, y: 0.3, z: 0 } },
      { geo: new THREE.BoxGeometry(1, 0.6, 0.2), mat: new THREE.MeshLambertMaterial({ color: 0x7a5c3e }), pos: { x: 0, y: 0.6, z: -0.4 } },
      { geo: new THREE.BoxGeometry(0.2, 0.45, 1), mat: new THREE.MeshLambertMaterial({ color: 0x7a5c3e }), pos: { x: -0.4, y: 0.4, z: 0 } },
      { geo: new THREE.BoxGeometry(0.2, 0.45, 1), mat: new THREE.MeshLambertMaterial({ color: 0x7a5c3e }), pos: { x: 0.4, y: 0.4, z: 0 } },
      // 坐垫
      { geo: new THREE.BoxGeometry(0.7, 0.1, 0.7), mat: FABRIC_BEIGE, pos: { x: 0, y: 0.55, z: 0.05 } },
      // 靠垫
      { geo: new THREE.BoxGeometry(0.5, 0.35, 0.12), mat: new THREE.MeshLambertMaterial({ color: 0xc97a4a }), pos: { x: 0, y: 0.7, z: -0.25 }, rot: { x: -0.15 } },
    ],
  });

  // --- 餐桌 + 椅子 ---
  // TODO: 替换为餐桌 GLB 模型
  addFurniture(scene, {
    name: 'dining-table',
    pos2d: [2, 6],
    collider: { hw: 0.8, hh: 0.6 },
    parts: [
      // 桌面
      { geo: new THREE.BoxGeometry(1.6, 0.07, 1.2), mat: WOOD_LIGHT, pos: { x: 0, y: 0.75, z: 0 } },
      // 桌腿
      { geo: new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8), mat: WOOD_DARK, pos: { x: -0.65, y: 0.375, z: -0.45 } },
      { geo: new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8), mat: WOOD_DARK, pos: { x: 0.65, y: 0.375, z: -0.45 } },
      { geo: new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8), mat: WOOD_DARK, pos: { x: -0.65, y: 0.375, z: 0.45 } },
      { geo: new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8), mat: WOOD_DARK, pos: { x: 0.65, y: 0.375, z: 0.45 } },
      // 桌上：碗
      { geo: new THREE.CylinderGeometry(0.12, 0.08, 0.06, 12), mat: PLASTIC_WHITE, pos: { x: -0.2, y: 0.81, z: 0.1 } },
      // 桌上：筷子
      { geo: new THREE.BoxGeometry(0.02, 0.02, 0.3), mat: WOOD_DARK, pos: { x: -0.05, y: 0.8, z: 0.1 }, rot: { y: 0.3 } },
      { geo: new THREE.BoxGeometry(0.02, 0.02, 0.3), mat: WOOD_DARK, pos: { x: -0.03, y: 0.8, z: 0.1 }, rot: { y: 0.3 } },
    ],
  });

  // --- 冰箱 ---
  // TODO: 替换为冰箱 GLB 模型
  addFurniture(scene, {
    name: 'fridge',
    pos2d: [1, 1],
    collider: { hw: 0.4, hh: 0.35 },
    parts: [
      // 主体
      { geo: new THREE.BoxGeometry(0.7, 1.8, 0.6), mat: PLASTIC_WHITE, pos: { x: 0, y: 0.9, z: 0 } },
      // 上门把手
      { geo: new THREE.BoxGeometry(0.04, 0.2, 0.04), mat: METAL_SILVER, pos: { x: 0.25, y: 1.3, z: 0.32 } },
      // 下门把手
      { geo: new THREE.BoxGeometry(0.04, 0.2, 0.04), mat: METAL_SILVER, pos: { x: 0.25, y: 0.45, z: 0.32 } },
      // 分隔线
      { geo: new THREE.BoxGeometry(0.72, 0.03, 0.62), mat: METAL_SILVER, pos: { x: 0, y: 0.85, z: 0 } },
      // 冰箱贴纸装饰
      { geo: new THREE.BoxGeometry(0.12, 0.12, 0.005), mat: new THREE.MeshLambertMaterial({ color: 0xff6644 }), pos: { x: -0.2, y: 1.5, z: 0.31 } },
      { geo: new THREE.BoxGeometry(0.08, 0.1, 0.005), mat: new THREE.MeshLambertMaterial({ color: 0x44cc88 }), pos: { x: 0.1, y: 1.6, z: 0.31 } },
      { geo: new THREE.BoxGeometry(0.1, 0.08, 0.005), mat: new THREE.MeshLambertMaterial({ color: 0xffcc33 }), pos: { x: -0.05, y: 1.15, z: 0.31 } },
    ],
  });

  // --- 盆栽（大） ---
  // TODO: 替换为盆栽 GLB 模型
  addFurniture(scene, {
    name: 'plant-large',
    pos2d: [10, 9],
    collider: { hw: 0.35, hh: 0.35 },
    parts: [
      // 花盆
      { geo: new THREE.CylinderGeometry(0.25, 0.2, 0.4, 12), mat: PLANT_POT, pos: { x: 0, y: 0.2, z: 0 } },
      // 泥土
      { geo: new THREE.CylinderGeometry(0.23, 0.23, 0.05, 12), mat: new THREE.MeshLambertMaterial({ color: 0x5c3a1e }), pos: { x: 0, y: 0.42, z: 0 } },
      // 主干
      { geo: new THREE.CylinderGeometry(0.04, 0.05, 0.6, 8), mat: new THREE.MeshLambertMaterial({ color: 0x6b4226 }), pos: { x: 0, y: 0.72, z: 0 } },
      // 树冠
      { geo: new THREE.SphereGeometry(0.35, 12, 12), mat: PLANT_GREEN, pos: { x: 0, y: 1.2, z: 0 } },
      { geo: new THREE.SphereGeometry(0.25, 10, 10), mat: PLANT_GREEN, pos: { x: 0.15, y: 1.4, z: 0.1 } },
      { geo: new THREE.SphereGeometry(0.2, 10, 10), mat: PLANT_GREEN, pos: { x: -0.1, y: 1.35, z: -0.1 } },
    ],
  });

  // --- 盆栽（小，茶几上） ---
  // TODO: 替换为盆栽 GLB 模型
  addFurniture(scene, {
    name: 'plant-small',
    pos2d: [7, 3],
    parts: [
      { geo: new THREE.CylinderGeometry(0.08, 0.06, 0.12, 10), mat: PLANT_POT, pos: { x: 0.5, y: 0.52, z: -0.3 } },
      { geo: new THREE.SphereGeometry(0.08, 8, 8), mat: PLANT_GREEN, pos: { x: 0.5, y: 0.65, z: -0.3 } },
    ],
  });

  // --- 窗户 ---
  // TODO: 替换为窗户 GLB 模型
  addFurniture(scene, {
    name: 'window',
    pos2d: [4, 11.8],
    parts: [
      // 窗框
      { geo: new THREE.BoxGeometry(2, 1.5, 0.1), mat: WOOD_DARK, pos: { x: 0, y: 2.5, z: 0 } },
      // 窗玻璃
      { geo: new THREE.BoxGeometry(1.8, 1.3, 0.02), mat: new THREE.MeshBasicMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.4 }), pos: { x: 0, y: 2.5, z: 0.06 } },
      // 窗格横
      { geo: new THREE.BoxGeometry(1.8, 0.05, 0.12), mat: WOOD_DARK, pos: { x: 0, y: 2.5, z: 0 } },
      // 窗格竖
      { geo: new THREE.BoxGeometry(0.05, 1.3, 0.12), mat: WOOD_DARK, pos: { x: 0, y: 2.5, z: 0 } },
    ],
  });

  // --- 墙上画框 ---
  // TODO: 替换为装饰画 GLB 模型
  addFurniture(scene, {
    name: 'painting',
    pos2d: [0.3, 6],
    parts: [
      // 画框
      { geo: new THREE.BoxGeometry(0.08, 1, 0.8), mat: WOOD_DARK, pos: { x: 0.1, y: 2, z: 0 } },
      // 画面
      { geo: new THREE.BoxGeometry(0.04, 0.75, 0.55), mat: new THREE.MeshBasicMaterial({ color: 0xd4a050 }), pos: { x: 0.12, y: 2, z: 0 } },
    ],
  });

  // --- 鞋柜（门口） ---
  // TODO: 替换为鞋柜 GLB 模型
  addFurniture(scene, {
    name: 'shoe-cabinet',
    pos2d: [1, 4],
    collider: { hw: 0.35, hh: 0.55 },
    parts: [
      { geo: new THREE.BoxGeometry(0.6, 0.7, 1), mat: WOOD_MID, pos: { x: 0, y: 0.35, z: 0 } },
      // 鞋子
      { geo: new THREE.BoxGeometry(0.12, 0.06, 0.25), mat: new THREE.MeshLambertMaterial({ color: 0x333333 }), pos: { x: 0, y: 0.73, z: 0.1 } },
      { geo: new THREE.BoxGeometry(0.12, 0.06, 0.25), mat: new THREE.MeshLambertMaterial({ color: 0xcc4444 }), pos: { x: -0.15, y: 0.73, z: -0.1 } },
    ],
  });

  // --- 时钟（墙上） ---
  addFurniture(scene, {
    name: 'wall-clock',
    pos2d: [0.3, 3],
    parts: [
      // 钟面
      { geo: new THREE.CylinderGeometry(0.25, 0.25, 0.04, 24), mat: PLASTIC_WHITE, pos: { x: 0.1, y: 2.8, z: 0 }, rot: { z: Math.PI / 2 } },
      // 钟框
      { geo: new THREE.TorusGeometry(0.25, 0.025, 8, 24), mat: WOOD_DARK, pos: { x: 0.1, y: 2.8, z: 0.03 }, rot: { z: Math.PI / 2 } },
    ],
  });

  // --- 垃圾桶 ---
  addFurniture(scene, {
    name: 'trash-can',
    pos2d: [10, 7],
    rotY: Math.PI / 4,
    collider: { hw: 0.2, hh: 0.2, rotation: Math.PI / 4 },
    parts: [
      { geo: new THREE.CylinderGeometry(0.15, 0.12, 0.35, 12, 1, true), mat: new THREE.MeshLambertMaterial({ color: 0x556655, side: THREE.DoubleSide }), pos: { x: 0, y: 0.175, z: 0 } },
      { geo: new THREE.CylinderGeometry(0.16, 0.16, 0.02, 12), mat: new THREE.MeshLambertMaterial({ color: 0x445544 }), pos: { x: 0, y: 0.35, z: 0 } },
    ],
  });

  return scene;
}
