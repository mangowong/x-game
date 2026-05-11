# X-Game 技术架构文档

> **沙发土豆的客厅冒险** — 基于 Three.js + Rapier 2D 的等距俯视角浏览器游戏

---

## 一、技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Three.js | ^0.170.0 | 3D 渲染、摄像机、光照、阴影、骨骼动画 |
| @dimforge/rapier2d-compat | ^0.19.3 | 2D 物理碰撞（WASM 内嵌 base64，无需额外配置） |
| Vite | ^6.0.0 | 构建工具、开发服务器 |

**无测试框架、无 linter、无 TypeScript。**

---

## 二、文件结构

```
src/
├── main.js      # 入口：异步初始化链 + 游戏主循环
├── player.js    # 玩家模型（GLB/骨骼动画）、移动、状态管理
├── desire.js    # 欲望系统：自然增长、自动寻路、压制机制
├── workout.js   # 健身系统：10 种动作定义、进度管理、效果计算
├── food.js      # 食物生成/刷新/进食检测
├── events.js    # 随机事件表（吃食物触发）
├── ui.js        # HTML 覆盖层：状态条、健身面板、对话框、气泡
├── input.js     # 键盘/鼠标输入处理、摄像机轨道控制
├── physics.js   # Rapier 2D 封装：物理世界、碰撞体
├── scene.js     # 客厅环境：灯光、地板、墙壁、15 件家具
├── assets.js    # GLB 资源预加载与缓存
└── utils.js     # 坐标映射、随机数、加权选择
```

---

## 三、模块依赖图

```
main.js (入口，调度所有模块)
  │
  ├── physics.js          ← scene.js, player.js, food.js
  │     └── @dimforge/rapier2d-compat
  │
  ├── assets.js           ← player.js
  │     └── three (GLTFLoader)
  │
  ├── scene.js            ← (无反向依赖)
  │     ├── utils.js
  │     └── physics.js (createFurnitureCollider)
  │
  ├── player.js           ← workout.js, events.js, main.js
  │     ├── three (SkeletonUtils)
  │     ├── utils.js (physTo3D)
  │     ├── assets.js (getAssetRaw)
  │     └── physics.js (set/getPlayerPosition, stepPhysics)
  │
  ├── desire.js           ← workout.js, main.js (纯逻辑，无外部依赖)
  │
  ├── workout.js          ← main.js, ui.js (仅读取 WORKOUTS 常量)
  │     ├── player.js (modifyWeight, modifyHappiness)
  │     └── desire.js (satisfyDesireOnWorkout)
  │     └── showDialog 通过 main.js 注入（避免循环依赖）
  │
  ├── food.js             ← main.js
  │     ├── three
  │     └── utils.js (physTo3D, randomRange)
  │
  ├── events.js           ← main.js
  │     ├── utils.js (weightedRandom)
  │     ├── player.js (modifyWeight, modifyHappiness)
  │     └── ui.js (showDialog)
  │
  ├── ui.js               ← main.js
  │     └── workout.js (WORKOUTS 常量，仅数据引用)
  │
  ├── input.js            ← main.js (纯事件处理，无内部依赖)
  │
  └── utils.js            ← 多个模块引用 (纯工具函数)
```

### 循环依赖处理

`ui.js ↔ workout.js` 存在循环：`ui.js` 导入 `WORKOUTS` 常量，`workout.js` 需要调用 `showDialog`。
**解决方案**：`workout.js` 不直接导入 `ui.js`，而是通过 `setDialogFn(fn)` 在 `main.js` 初始化时注入对话框函数。

---

## 四、核心系统

### 4.1 物理系统 (`physics.js`)

- **引擎**：Rapier 2D，零重力 `(0, 0)` 俯视角
- **玩家**：`kinematicPositionBased` 刚体 + `ball(0.35)` 碰撞体，初始位置 `(5, 5)`
- **家具/墙壁**：`fixed` 刚体 + `cuboid(hw, hh)` 碰撞体
- **碰撞推离**：Rapier 自动处理，无需手动轴分离
- **边界**：12×12 区域，4 面墙

### 4.2 坐标系统

```
2D 物理 (Rapier)          →    3D 渲染 (Three.js)
   x2d                           x_3d = x2d
   y2d                           z_3d = y2d   (注意：y2d 映射为 z_3d)
                                  y_3d = 0     (地面高度)
```

`utils.physTo3D(x2d, y2d)` 返回 `{ x: x2d, y: 0, z: y2d }`。

**注意**：CODEBUDDY.md 描述的等距映射 (`x_3d = x2d - y2d`) 已过时，实际为直接映射。

### 4.3 玩家系统 (`player.js`)

#### 状态
| 属性 | 初始值 | 范围 | 修改方 |
|------|--------|------|--------|
| `weight` | 50 | [0, 100] | events.js, workout.js |
| `happiness` | 50 | [0, 100] | events.js, workout.js |

#### 移动
- 速度：`MOVE_SPEED = 4.0` 单位/秒
- 输入：摄像机相对方向（旋转 yaw 角度后的归一化向量）
- 物理：`setPlayerPosition()` → `stepPhysics()` → `getPlayerPosition()`
- 平滑：指数插值 `1 - exp(-12 * dt)`（位置）、`1 - exp(-10 * dt)`（旋转）

#### 模型
- 来源：`/soldier.glb`（通过 `assets.js` 预加载）
- 缩放：自动缩放到 2.5 单位高度，底部对齐
- 动画：`AnimationMixer` 管理 walk/idle 切换（0.3s 淡入淡出）
- 回退：加载失败时使用圆柱体+球体占位

#### 程序化骨骼动画（10 种）

| 动作标识 | 名称 | 关键骨骼操作 |
|----------|------|-------------|
| `jumpRope` | 跳绳 | 上下跳动 + 手臂内收 + 腿微弯 |
| `pushup` | 俯卧撑 | 模型旋转 90° + 手臂弯曲 + 上下起伏 |
| `situp` | 仰卧起坐 | 脊柱前后弯曲 + 手放头后 + 腿弯曲 |
| `squat` | 深蹲 | 腿弯曲 + 身体前倾 + 手臂前伸 + 整体下沉 |
| `highKnees` | 高抬腿 | 交替抬腿 + 手臂摆动 + 轻微跳动 |
| `plank` | 平板支撑 | 俯卧姿态保持 + 微小颤抖 |
| `dumbbell` | 哑铃弯举 | 前臂弯曲循环 + 身体微用力 |
| `yoga` | 瑜伽拉伸 | 单腿站立 + 双手高举 + 缓慢平衡 |
| `pillowSquat` | 举抱枕深蹲 | 抱臂弯曲 + 深蹲 + 头左右看 |
| `chaseCat` | 追猫跑 | 快速交替腿 + 手臂摆动 + 前倾 + 左右晃 |

骨骼缓存机制：`cacheBones(model)` 遍历模型存储所有骨骼引用，支持 `mixamorig:` 前缀和短名称两种访问方式。

### 4.4 欲望系统 (`desire.js`)

#### 参数
| 常量 | 值 | 说明 |
|------|-----|------|
| `DESIRE_GROWTH_RATE` | 0.5/秒 | 自然增长 |
| `DESIRE_EAT_REDUCE` | 30 | 进食降低 |
| `DESIRE_WORKOUT_REDUCE` | 10 | 健身降低 |
| `DESIRE_SUPPRESS_RATE` | 2/秒 | Space 压制 |
| `DESIRE_THRESHOLD` | 70 | 自动进食触发线 |
| `AUTO_MOVE_SPEED_RATIO` | 0.6 | 自动寻路速度倍率 |

#### 自动寻路逻辑
1. 欲望 >= 70 且无手动输入 → 计算到最近食物的方向
2. 角色以 60% 速度自动走向食物
3. 玩家按方向键 → 打断自动寻路
4. Space 长按 → 停止移动 + 持续降低欲望

### 4.5 健身系统 (`workout.js`)

#### 动作定义

| 按键 | action | 名称 | 时长(秒) | 体重 | 快乐 | 分类 |
|------|--------|------|---------|------|------|------|
| 1 | jumpRope | 跳绳 | 3 | -3 | 0 | 基础 |
| 2 | pushup | 俯卧撑 | 3 | -3 | 0 | 基础 |
| 3 | situp | 仰卧起坐 | 3 | -2 | 0 | 基础 |
| 4 | squat | 深蹲 | 2.5 | -2 | 0 | 基础 |
| 5 | highKnees | 高抬腿 | 3 | -4 | 0 | 基础 |
| 6 | plank | 平板支撑 | 4 | -5 | -2 | 基础 |
| 7 | dumbbell | 哑铃弯举 | 3 | -3 | 0 | 器械 |
| 8 | yoga | 瑜伽拉伸 | 3.5 | -1 | +5 | 器械 |
| 9 | pillowSquat | 举抱枕深蹲 | 2.5 | -2 | +3 | 搞笑 |
| 0 | chaseCat | 追猫跑 | 3 | -4 | +3 | 搞笑 |

#### 机制
- 按键触发 → 进入动作模式（无法移动）→ 进度条递增 → 完成后应用效果
- ESC 取消 → 按完成比例折算效果
- 完成时随机显示一条祝贺消息

### 4.6 食物系统 (`food.js`)

| 常量 | 值 |
|------|-----|
| `MAX_FOOD` | 6 |
| `RESPAWN_INTERVAL` | 5000ms |
| `EAT_RADIUS` | 0.8 |

**食物类型**：薯片、蛋糕、鸡腿、可乐、甜甜圈（BoxGeometry 占位，有 `// TODO:` 待替换）

**生成规则**：范围 [1.5, 10.5]，防重叠距离 0.8，20 次尝试。

### 4.7 事件系统 (`events.js`)

11 条事件，吃食物时 70% 概率触发，加权随机选择。每条事件含 `text`, `weightDelta`, `happinessDelta`, `probability`。

可通过 `addEvent(event)` 运行时扩展事件表。

### 4.8 输入系统 (`input.js`)

| 输入 | 功能 |
|------|------|
| WASD / 方向键 | 摄像机相对移动 |
| Space | 长按压制食欲 |
| Tab | 切换健身面板 |
| 1-9, 0 | 触发健身动作 |
| Escape | 取消动作 |
| 左键拖拽 | 轨道摄像机旋转 |
| 滚轮 | 缩放距离 (2~15) |

摄像机参数：`yaw=0`, `pitch=0.5`, `distance=6`，pitch 限制 [0.15, 1.35] 弧度。

### 4.9 UI 系统 (`ui.js`) + `index.html`

**DOM 结构**：
- `#stats`：体重条(橙) + 快乐条(粉) + 食欲条(紫)
- `#workout-panel`：右侧浮动面板，按分类显示所有健身动作
- `#workout-progress`：底部进度条
- `#dialog`：底部对话框（CSS opacity 淡入淡出）
- `#desire-bubble`：浮动表情气泡（>=70 "馋"，>=90 "🤤"，压制中 "😤"）
- `#controls-hint`：左下角操作提示

**食欲警告**：欲望 >= 70 时食欲条边框红色发光 + 标签文字闪烁。

### 4.10 场景 (`scene.js`)

**房间**：12×12 地板，奶油色墙壁（后墙+左墙可见，前墙+右墙隐形碰撞边界）

**灯光**：环境光(暖白 0.6) + 方向光(暖色 1.0, 阴影) + 落地灯点光(暖 0.6) + 电视蓝光(0.3)

**家具 15 件**：地毯、沙发、茶几、电视柜、书架、落地灯、单人椅、餐桌、冰箱、大盆栽、小盆栽、窗户、画、鞋柜、挂钟、垃圾桶。均有 `// TODO: 替换为 xxx GLB 模型` 注释。

### 4.11 资源管理 (`assets.js`)

- 预加载：`[{ name: 'player', path: '/soldier.glb' }]`
- 缓存：`Map<string, GLTF>`，加载失败存 null 不阻塞
- 访问：`getAsset(name)` 返回克隆场景，`getAssetRaw(name)` 返回原始 GLTF（含动画）

---

## 五、游戏主循环 (`main.js`)

### 初始化顺序
```
initPhysics() → loadAssets() → hide loading → renderer → camera → createScene()
  → createPlayer() → initFood(callback) → initInput() → initWorkoutPanel() → setDialogFn()
```

### 每帧执行
```
1. dt = min(delta, 0.05)
2. 处理 Tab 面板切换
3. 消费健身动作按键 → startWorkout() + triggerAction()
4. 消费 ESC 取消 → cancelWorkout() / endAction()
5. if 健身进行中 → 冻结移动，显示进度
6. if 健身完成 → endAction()
7. else 正常模式：
   a. 更新欲望（Space 压制 / 自然增长）
   b. 欲望>=70 且无手动输入 → 自动寻路到最近食物
   c. 方向键 → 打断自动寻路
   d. updatePlayer(dt, input, autoDir, autoSpeedRatio)
8. tryEatFood() (手动或自动移动时)
9. updateFood() (食物旋转动画)
10. updateUI() + updateWorkoutProgress()
11. 摄像机跟随 + 渲染
```

---

## 六、GLB 模型资源

| 文件 | 状态 | 用途 |
|------|------|------|
| `/soldier.glb` | 已使用 | 玩家角色（含 Mixamo 骨骼和 walk/idle 动画） |
| `/guy.glb` | 未使用 | 备用角色模型 |
| `/guy2.glb` | 未使用 | 备用角色模型 |

---

## 七、摄像机系统

- 类型：`PerspectiveCamera(FOV=60, near=0.1, far=100)`
- 跟随：球坐标偏移，始终看向玩家 `(px, 1.2, pz)`
- 控制：左键拖拽旋转 yaw/pitch，滚轮缩放 distance
- 范围：pitch [0.15, 1.35] rad，distance [2, 15]

---

## 八、已知限制与 TODO

1. **无 Game Over**：体重/快乐到达 0 或 100 无特殊效果
2. **家具占位**：所有家具使用简单几何体，带 `// TODO:` 注释待替换 GLB
3. **食物占位**：所有食物使用 BoxGeometry，带 `// TODO:` 注释待替换 GLB
4. **无声音**：游戏中没有任何音效或背景音乐
5. **无存档**：刷新页面重置所有进度
6. **CODEBUDDY.md 过时**：描述的等距坐标映射、正交摄像机、Y 排序与实际代码不符
7. **`food.js` 导入了未使用的 `getPlayerPosition`**
8. **`public/guy.glb` 和 `guy2.glb` 未被引用**

---

## 九、扩展指南

### 添加新的健身动作
1. 在 `workout.js` 的 `WORKOUTS` 数组添加条目
2. 在 `player.js` 的 `ACTION_ANIMATIONS` 映射添加骨骼动画函数
3. 在 `input.js` 的 `WORKOUT_KEY_MAP` 绑定按键（如需新按键）
4. UI 面板会自动从 `WORKOUTS` 数组渲染新条目

### 添加新食物
1. 在 `food.js` 的 `FOOD_TYPES` 数组添加 `{ name, color, scale }`

### 添加新事件
1. 在 `events.js` 的 `EVENTS` 数组添加 `{ text, weightDelta, happinessDelta, probability }`
2. 或运行时调用 `addEvent(event)`

### 添加新家具
1. 在 `scene.js` 调用 `addFurniture(scene, { name, parts, pos2d, rotY?, collider? })`
2. 如需碰撞：传入 `collider: { hw, hh }`，自动注册 Rapier 碰撞体
3. 保留 `// TODO: 替换为 xxx GLB 模型` 注释
