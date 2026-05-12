/**
 * physics.js - Rapier 2D 物理引擎封装
 * - 管理物理世界（零重力俯视角）
 * - 玩家 dynamic 刚体（速度驱动移动，碰撞自动推离）
 * - 家具/墙壁 fixed 碰撞体
 * - 每帧步进，自动碰撞推离
 */

import RAPIER from '@dimforge/rapier2d-compat';

let world = null;
let playerBody = null;

/**
 * 初始化 Rapier 物理世界
 */
export async function initPhysics() {
  await RAPIER.init();

  // 零重力（俯视角2D游戏）
  world = new RAPIER.World({ x: 0.0, y: 0.0 });

  // 玩家刚体：dynamic（可以被碰撞体推回）
  // 锁定旋转，高阻尼防止滑动
  const playerBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(5.0, 5.0)
    .lockRotations()
    .setLinearDamping(10.0);
  playerBody = world.createRigidBody(playerBodyDesc);

  // 玩家碰撞体：圆形
  const playerColliderDesc = RAPIER.ColliderDesc.ball(0.35)
    .setFriction(0.0)
    .setRestitution(0.0);
  world.createCollider(playerColliderDesc, playerBody);

  // 边界墙
  createFurnitureCollider(6, 12.5, 7, 0.3);   // 后墙
  createFurnitureCollider(-0.5, 6, 0.3, 7);    // 左墙
  createFurnitureCollider(6, -0.5, 7, 0.3);    // 前墙（隐形边界）
  createFurnitureCollider(12.5, 6, 0.3, 7);    // 右墙（隐形边界）
}

/**
 * 注册家具/墙壁碰撞体
 * @param {number} x - 2D 中心 X
 * @param {number} y - 2D 中心 Y
 * @param {number} hw - 半宽
 * @param {number} hh - 半高
 * @param {number} [rotation=0] - 旋转角度（弧度）
 */
export function createFurnitureCollider(x, y, hw, hh, rotation = 0) {
  if (!world) return;
  const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y);
  if (rotation) bodyDesc.setRotation(rotation);
  const body = world.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.cuboid(hw, hh);
  world.createCollider(colliderDesc, body);
}

/**
 * 步进物理模拟
 */
export function stepPhysics(delta) {
  if (!world) return;
  world.step();
}

/**
 * 设置玩家移动速度（方向 * 速度）
 * dynamic 刚体通过速度移动，碰撞自动推离
 */
export function setPlayerVelocity(vx, vy) {
  if (!playerBody) return;
  playerBody.setLinvel({ x: vx, y: vy }, true);
}

/**
 * 直接设置玩家位置（用于初始化或重置）
 */
export function setPlayerPosition(x, y) {
  if (!playerBody) return;
  playerBody.setTranslation({ x, y }, true);
  playerBody.setLinvel({ x: 0, y: 0 }, true);
}

/**
 * 获取玩家实际位置（碰撞推离后的位置）
 */
export function getPlayerPosition() {
  if (!playerBody) return { x: 5, y: 5 };
  const t = playerBody.translation();
  return { x: t.x, y: t.y };
}
