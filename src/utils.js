/**
 * utils.js - 辅助函数
 * - 2D 物理 → 3D 坐标映射
 * - 随机数等工具
 */

/**
 * 将 2D 物理坐标转换为 3D 坐标
 * 2D (x, y) → 3D (x, 0, y)，Y 轴为高度
 */
export function physTo3D(x2d, y2d) {
  return {
    x: x2d,
    y: 0,
    z: y2d,
  };
}

/**
 * 返回 [min, max) 之间的随机浮点数
 */
export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * 返回 [min, max] 之间的随机整数
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 按概率从数组中随机选取一个元素
 * @param {Array} items - { ..., probability: 0-1 } 数组
 */
export function weightedRandom(items) {
  const total = items.reduce((sum, item) => sum + item.probability, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.probability;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}
