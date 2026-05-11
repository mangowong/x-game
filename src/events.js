/**
 * events.js - 搞笑事件系统
 * - 事件表：包含初始搞笑事件
 * - 吃食物时按概率触发随机事件
 * - 事件触发后调用 ui 显示对话，修改玩家状态
 */

import { weightedRandom } from './utils.js';
import { modifyWeight, modifyHappiness } from './player.js';
import { showDialog } from './ui.js';

/**
 * 事件表 - 每个事件包含：描述文字、体重变化、快乐值变化、概率权重
 */
const EVENTS = [
  {
    text: '薯片卡在嘴里，像只松鼠 🐿️ ➤ 快乐-5',
    weightDelta: 0,
    happinessDelta: -5,
    probability: 3,
  },
  {
    text: '发现过期牛奶，但你不在乎 ➤ 体重+2',
    weightDelta: 2,
    happinessDelta: 0,
    probability: 2,
  },
  {
    text: '猫偷走了你的鸡腿 🐱 ➤ 快乐-10',
    weightDelta: 0,
    happinessDelta: -10,
    probability: 2,
  },
  {
    text: '打了个巨大的饱嗝震动天花板 ➤ 体重不变但快乐+3',
    weightDelta: 0,
    happinessDelta: 3,
    probability: 3,
  },
  {
    text: '吃到隐藏款口味！惊喜满分 ➤ 快乐+8',
    weightDelta: 1,
    happinessDelta: 8,
    probability: 1,
  },
  {
    text: '不小心咬到舌头... ➤ 快乐-7',
    weightDelta: 0,
    happinessDelta: -7,
    probability: 2,
  },
  {
    text: '零食太好吃根本停不下来 ➤ 体重+3 快乐+5',
    weightDelta: 3,
    happinessDelta: 5,
    probability: 2,
  },
  // 欲望/暴食相关事件
  {
    text: '忍不住偷吃了一口冰箱里的蛋糕！ ➤ 体重+5',
    weightDelta: 5,
    happinessDelta: 3,
    probability: 2,
  },
  {
    text: '肚子咕咕叫，猫都被吓跑了 ➤ 快乐-3',
    weightDelta: 0,
    happinessDelta: -3,
    probability: 2,
  },
  {
    text: '梦游到冰箱前醒了过来...太丢人了 ➤ 快乐-5',
    weightDelta: 1,
    happinessDelta: -5,
    probability: 1,
  },
  {
    text: '吃完才想起来在减肥！ ➤ 快乐-8',
    weightDelta: 2,
    happinessDelta: -8,
    probability: 1,
  },
];

/**
 * 尝试触发随机事件（吃食物时调用）
 * @param {string} foodName - 被吃掉的食物名
 */
export function tryTriggerEvent(foodName) {
  // 70% 概率触发事件
  if (Math.random() > 0.7) return;

  const event = weightedRandom(EVENTS);

  // 应用属性变化
  if (event.weightDelta !== 0) {
    modifyWeight(event.weightDelta);
  }
  if (event.happinessDelta !== 0) {
    modifyHappiness(event.happinessDelta);
  }

  // 显示对话
  showDialog(`【吃了${foodName}】${event.text}`, 3500);
}

/**
 * 添加自定义事件（用于扩展事件表）
 */
export function addEvent(event) {
  EVENTS.push(event);
}
