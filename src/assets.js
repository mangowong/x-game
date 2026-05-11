/**
 * assets.js - 统一资源加载管理
 * - 借鉴 CubeCity 的 Resources 模式
 * - 预加载 GLB 模型，缓存避免重复加载
 * - 支持加载进度回调
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

/**
 * 资源定义表
 * name: 资源名（后续 getAsset 时用）
 * path: GLB 文件路径（相对于 public/）
 */
const ASSET_DEFINITIONS = [
  { name: 'player', path: '/soldier.glb' },
];

/**
 * 加载所有资源
 * @param {function} onProgress - (loaded, total) => void
 * @returns {Promise<void>}
 */
export async function loadAssets(onProgress) {
  const total = ASSET_DEFINITIONS.length;
  let loaded = 0;

  const tasks = ASSET_DEFINITIONS.map(({ name, path }) => {
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (gltf) => {
          cache.set(name, gltf);
          loaded++;
          if (onProgress) onProgress(loaded, total);
          resolve();
        },
        undefined,
        (error) => {
          console.error(`资源加载失败: ${name} (${path})`, error);
          cache.set(name, null); // 标记为加载失败
          loaded++;
          if (onProgress) onProgress(loaded, total);
          resolve(); // 不阻断其他资源
        }
      );
    });
  });

  await Promise.all(tasks);
}

/**
 * 获取缓存的 GLTF 资源
 * @param {string} name - 资源名
 * @returns {THREE.Group|null}
 */
export function getAsset(name) {
  const gltf = cache.get(name);
  if (!gltf) return null;
  // 每次返回克隆的 scene，避免多个实例共享同一个对象
  return gltf.scene.clone();
}

/**
 * 获取原始 GLTF 对象（包含动画数据）
 * @param {string} name
 * @returns {object|null}
 */
export function getAssetRaw(name) {
  return cache.get(name) || null;
}
