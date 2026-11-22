# florr2 项目说明

> 面向后续开发者与 AI 的项目上下文。结构与约定变化时同步更新本文件。

> ## 第一条铁律（最严苛，永远有效）：不准动引擎本体
>
> 除非是在**做新功能**，否则不要修改共享引擎。共享引擎 =
> `js/sim/physics.js`、`js/sim/exit.js`、`js/sim/mob-shape.js`、`js/sim/constants.js`、
> `js/net/server.js` 的系统步骤（`sysXxx`）与统一结算入口（`_dmg` / `_hitMob` / `_pairHit` /
> `physicsPush` / `_combatTick`）、`js/ai.js` 的管线与 `_util`、`js/sim/mob.js` 的生命周期。
>
> 遇到“某个实体 / 花瓣 / 召唤物不听话”，做法永远是 **接入同一个体系**：
> 在数据表与能力字段里声明差异（`PETAL_TRAITS` / `MOB_TRAITS`），复用同一个函数、
> 同一套判定、同一个时机；**绝不新写**第二套碰撞、第二套伤害、第二套 AI、第二套移动，
> 也不在调用方加特判分支——那就是屎山。宁可改数据、改调用点，也不改引擎的行为口径；
> 已经写歪的分支要当场合并回引擎，不留双轨。

## 1. 项目定位

- **florr.io 的浏览器端复刻（非官方）**，当前只有 **Garden** 一张图。
- 纯前端：`HTML + CSS + 原生 JS + Canvas 2D + DOM 覆盖层`。
- 没有构建步骤、npm 依赖、package.json、测试与 lint；改完在浏览器中手动验证。
- 入口为根目录 `index.html`，**必须通过本地 HTTP 服务器打开**：地图与 tileset 由 `fetch()` 加载。
- 仓库：`https://github.com/VP-xudon/florr2`，默认分支 `main`。
- 代码注释、提交说明、文档以中文为主；界面文本走 i18n（默认 `en_US`，内置 `zh_CN`）。
- 素材来源与许可见 `SOURCES.md`。

## 2. 运行与调试

```powershell
python -m http.server 8000
# 打开 http://localhost:8000/
```

- URL 参数：`?hp=N`（同时设置当前与最大血量，非法值忽略）、`?touch=1`（桌面强制显示触控层）。
- 热键：`F3` 调试屏幕、`C` 合成窗口（调试屏幕打开时改为切碰撞箱）、
  `M` 小地图档位、`Z` 背包、`R` 主副槽整排互换、`1~0` 换列。
- 设置窗口分 Game / Controls / Graphics / Credits，存 Cookie `florr_settings`：
  语言（重启生效）、键盘移动、调试模式、`showMobHpBar`（显示生物血量条，含顶部 Boss 血条）、
  `showFeedback`（显示反馈数值，伤害/回血飘字）。后四项当场生效，两个图像开关默认开启。
- 控制台：`window.__game` 是 `Game` 实例，`window.__queryParams` 是解析后的参数，
  `window.__debug` 是调试开关；`Game.stepFrames(n, dt)` 可按固定步长推进世界。

```powershell
python dev/check_versions.py   # 引用、重名、i18n、版本号、跨文件契约
```

## 3. 目录与职责

| 路径 | 职责 |
|---|---|
| `index.html` | 唯一页面；固定顺序同步加载脚本；脚本/样式带 `?v=N` |
| `css/style.css` | 全部样式（HUD、背包、图鉴、聊天、设置、死亡界面等） |
| `js/main.js` | 启动：构造 `ASSET_LIST`、解析参数、`loadGardenData()`、`new Game()`、后台加载素材 |
| `js/util.js` | `TAU`/`clamp`/`rand`/`damp` 等工具、`Settings`、`fmtNum`、`emptySlots`、`ASSET_VER` |
| `js/assets.js` | `SpriteStore`：SVG 加载、裁剪缓存、红色剪影、图案包围盒、碰撞轮廓（`CONTOUR_N=96`） |
| `js/lang.js` | `I18N`：语言包注册、`t/tf/opt`、`{#A#B}` 格式、缺失键回退并显示 `<key>` |
| `js/data.js` | `RARITIES`、由 `REGISTRY` 构建 `PETAL_TYPES`/`MOB_TYPES`、掉落、难度稀有度、初始装备 |
| `js/cards.js` | `CardRenderer`：稀有度卡面、花瓣图形与 i18n 名称、多体布局、装填与血量阴影、画布池 |
| `js/ui.js` | UI 门面：窗口骨架、设置、背包/图鉴、卡槽与装填驱动 |
| `js/ui/tooltip.js` | 卡牌详情 canvas 与按钮提示 |
| `js/ui/drag.js` | 拖拽、飞卡、吸附与幽灵动画 |
| `js/ui/minimap.js` | 小地图三档模式与过渡 |
| `js/ui/touch.js` | 触控层：浮动摇杆 + `A`(reach) / `B`(detect)，桌面不创建元素 |
| `js/ui/debug-screen.js` | `F3` 分栏调试屏幕，控制碰撞箱与小地图生物点 |
| `js/ui/bossbar.js` | 顶部 Boss 血条（视野内离玩家最近的 `eternal` / `super`，最多 3 条） |
| `js/map.js` | `garden.tmj` / `.tsj` 解析、翻转、碰撞、检查点、生成区、瓦片与小地图位图 |
| `js/ai.js` | `MobAI`：按 `type.slug` 注册的物种 AI 引擎 |
| `js/petal-effects.js` | `PetalFX`：花瓣主动/被动特效、脱轨、飞行、硬碰撞、仇恨吸引 |
| `js/mob-fx.js` | `MobFX`：生物特性与大招、场地实体种类（与 `PetalFX` 对称） |
| `js/sim/constants.js` | 模拟常量与纯规则：`SNAP_HZ/SNAP_DT`、`InvulnFX`、击退份额、花朵数值 |
| `js/sim/exit.js` | 实体生命周期引擎 `EntityFX`、`KINDS`、`createEntitySet` |
| `js/sim/physics.js` | `physicsPush`、`moveEntity`、击退与衰减 |
| `js/sim/status.js` | `StatusFX`：`ent.status = [{id,dur,value}]`，移速统一走 `speedMul` |
| `js/sim/crb.js` | `CRB`：读取 `assets/crbs/` 的预制碰撞箱，唯一入口 |
| `js/sim/mob-shape.js` | 生物视觉尺寸表与 SVG 轮廓碰撞数学 |
| `js/render/spider-gait.js` | 蜘蛛八足步态（纯表现） |
| `js/sim/player.js` | `Player`：移动、装填、花瓣轨道、无敌、死亡与 `resetForSpawn` |
| `js/sim/mob.js` | `Mob`：AI 管线、血量、碰撞轮廓、绘制 |
| `js/sim/drops.js` | `DropCard`、掉落卡面缓存、粒子时长分级 |
| `js/render/render-util.js` | 绘制工具（颜色、圆角、精灵、血条），唯一 `roundRectPath` |
| `js/render/fx.js` | `DropSpark` / `Particle` / `DamageText` |
| `js/net/protocol.js` | 协议与生成参数、`FX_FIELDS`、`petalNetKey` |
| `js/net/server.js` | `LocalServer` 权威世界、`STEP_SYSTEMS`、`nextEntityId`、请求分发 |
| `js/net/client.js` | `Net` 接口、`LocalNet`、`WebSocketNet`（连接失败回退本地） |
| `js/chat.js` | 聊天频道、漂浮消息、指令解析与本地实现 |
| `js/game.js` | `Game`：主循环、输入、相机、渲染、快照镜像、事件、拾取、小地图 |
| `dev/check_versions.py` | 静态检查：引用、重名、i18n、版本号、跨文件契约 |
| `assets/registry.js` | 数据单一来源，由 `scripts/build_manifest.py` 生成，可手改 |
| `assets/i18n/<code>/<code>.js` | 官方语言包；同目录 `.txt` 是抓取源 |
| `js/i18n-extra.js` | 项目新增文案的唯一落点（F3、触控按钮等） |
| `assets/mob-shapes.js` | 离线预计算的生物轮廓与旋转轴心 |
| `assets/petal-metrics.js` | 卡面布局参数（`vb/t/sw`） |
| `assets/static/maps/*.tmj` | 官方地图，运行时只用 `garden.tmj` |
| `scripts/` | 资源抓取、注册表生成、地图烘焙、i18n 抓取、校验 |
| `tools/` | 离线图像处理：SVG 裁剪、碰撞轮廓、位图转矢量 |
| `.codebuddy/` | AI 助手的历史计划与临时脚本，不属于运行代码 |

## 4. 加载顺序

`index.html` 中脚本顺序有硬依赖：

```
util.js → assets.js → i18n(en_US/zh_CN) → lang.js
→ mob-shapes.js → registry.js → data.js → petal-metrics.js → cards.js
→ ui.js → ui/tooltip.js → ui/drag.js → ui/minimap.js
→ map.js → ai.js → petal-effects.js
→ sim/constants.js → sim/exit.js → mob-fx.js → render/render-util.js
→ sim/physics.js → sim/mob-shape.js → sim/player.js → sim/mob.js → sim/drops.js → render/fx.js
→ net/protocol.js → net/server.js → net/client.js
→ chat.js → i18n-extra.js → ui/touch.js → ui/debug-screen.js → ui/bossbar.js
→ game.js → main.js
```

- `lang.js` 先于 `data.js`：`RARITIES` 与花瓣名在加载时取译文。
- `registry.js` 先于 `data.js`。
- `sim/constants.js` 先于所有读取 `SNAP_DT` 的模块。
- `net/protocol.js` 先于 `server.js` / `client.js` / `game.js`：`FX_FIELDS` 与 `petalNetKey` 的唯一声明。
- `i18n-extra.js` 先于 `game.js`：`DebugScreen.init` / `TouchCtl.init` 在 `Game.init()` 读取这些键。
- `main.js` 末尾 `boot()`：`UI.init()` → `loadGardenData()` → `Game.init()` → `Game.start()` → 等待服务端库存镜像。
- Loading 蒙版【绝不提前撤】，依次等待：
  `CardRenderer.prewarm`（全部花瓣的 fetch / `getBBox` / dataURL / Image 解码 + 128/256px 实体位图）→
  `MobFX.prepareAssets`（尾针空壳 / 无触角身体 / Pollen，内部 fetch 自带超时且派生素材改为 await）→
  `SpiderGait.prewarm` / `AntArt.prewarm`（步态与蚂蚁分件图真正解码）→
  `SpriteStore.loadAll`（清单素材 + 所有派生素材，失败自动重试 3 次，判定必须 `naturalWidth > 0`）→
  瓦片位图（地图实际用到的 `svg#flags` 组合全部 `canvasFlip` 到 288px）→
  首屏生物位图/轴心/轮廓（`SpriteStore.prewarmMobs`，按实体真实 `drawSize`；同时完成全局裁剪框标定）→
  字体就绪（最多 5s）→ `UI.prewarmWindows`（背包整表与合成舞台/列表在隐藏窗口里建好并统一重绘）→
  小地图位图（含 `_mmFullPx` 全图大图，不再用 800ms 定时器）。
- 字体回调（`cards.js` / `ui/tooltip.js` 的 `document.fonts.load().then(repaintAll)`）用 `window.__uiBooted`
  拦住 Loading 期间的重复全量重绘；迟到字体才在撤蒙版后补一次。
- 加载蒙版：纯黑底，上方 120px 蜘蛛动画由 Worker + OffscreenCanvas 在【独立线程】绘制
  （`UI.js` 的 `LOADING_SPIDER_WORKER` 复刻 `assets/ui/spider_loading_sequenced.svg` 的 8 条腿与 4.8s 关键帧，
  直接画白蛛；主线程同步预热不再冻住它）。不支持 `transferControlToOffscreen` 时退回内联 SVG + `invert(1)`。
  动画与文字间距 40px，下方 36px Ubuntu 白字「Loading...」。蒙版【至少展示 5s】（不足则补等）。
- 加载完成的退场序列（`UI.hideLoading()`，蒙版【先不撤】）：
  ① `#loading.fade-out`：蜘蛛动画与 Loading 文案整体渐隐（450ms）；
  ② 内联 `assets/ui/studio-logo.svg`（已翻成白色，居中 220px 适当缩放）播放一次，
     等内部最长关键帧 `sunrise` 结束（animationend，8.5s 定时器兜底，reduced-motion 也不挂死）；
  ③ 停留 2s；
  ④ `#loading.gone` 整块蒙版渐隐 450ms 后才 `display:none`，露出已在跑的游戏画面。
  logo 的 SVG 文本在 `UI.init` 时预取（`_studioLogoSvg`），退场时不再等网络。
- 预热任务全部【协作式让帧】：`boot()` 的 `yieldFrame()` 在每个阶段之间、瓦片每 8 组、
  生物位图每 8 项、卡面每 8 张、背包每个稀有度分组后各 `await requestAnimationFrame`。
  同步长任务会占满主线程让 SVG 动画"播一下就冻住"；末尾不再 `repaintAll`（会再堵一次）。
- 全部完成才 `UI.hideLoading()`；30 秒未完成显示慢加载提示但继续等待。
- 卡面有两套独立缓存：`SpriteStore.images`（世界实体）与 `CardRenderer` 的 `_raw/_tinted/_imgCache`（卡面）；
  只加载前者仍会在首次开背包时集中 fetch + 强制重排，所以两者都必须预热。

主要全局：`RARITIES`、`RARITY_ORDER`、`PETAL_TYPES`、`MOB_TYPES`、`PETAL_BY_ID`、`MOB_BY_ID`、
`I18N`、`SpriteStore`、`CardRenderer`、`UI`、`PetalFX`、`MobFX`、`InvulnFX`、`EntityFX`、
`StatusFX`、`MobAI`、`Chat`、`Settings`。

## 5. 主循环

`Game.start()` 由 `requestAnimationFrame` 驱动；`dt` 上限 0.25s，固定步长 `STEP = 1/60`，
`MAX_STEPS = 3`（一帧最多补 3 步，多余丢弃）。上限过高会让低帧率下每帧补更多步，
形成掉帧 → 补步 → 更慢的正反馈。

`perf.fps / perf.sps` 由主循环按 rAF 间隔与实际模拟步数统计，F3 只负责显示。

`Game.update(dt)` 顺序：

1. 读输入，推导方向与 `mode`（`normal/reach/detect`）。
2. 本地玩家预测 `player.update(...)`。
3. 上行 `loadout` + `input`，`net.step(dt)` 推进服务端并收快照/事件。
4. `_tickMobViews(dt)`：视图插值与动画计时；屏幕外只贴位置。
5. 玩家与生物推挤（`physicsPush`），先用平方距预筛。
6. 死亡界面、仇恨清理、地面卡/掉落/粒子/飘字。
7. 相机夹紧、抖动衰减、F3 刷新（仅打开时，限频 5Hz）。
8. 记 `perf.updateMs / renderMs / frameMs`。

## 6. 网络

- `Net` 是接口；`LocalNet` 进程内持有 `LocalServer`；`WebSocketNet` 连接失败时回退 `LocalNet`。
- 权威状态（生成、移动、碰撞、战斗、击退、聊天路由）在 `LocalServer`；
  本地玩家在客户端预测，服务端跑同一套物理校验。
- 上行：`{t:'input'}`、`{t:'loadout'}`、`{t:'respawn'}`、`{t:'chat'}`。
- 下行：`{t:'snap'}`、`{t:'evt'}`。
- **背包与合成是服务端权威**：`LocalServer.inventory`（`type.key|rarity -> 数量`）是唯一库存，
  客户端 `UI._gc` 只是回执镜像（由 `_applyInventory` 整体覆盖）。所有增减都走
  `net.request('inv', {op, key, n})` → `invRequest`，它核实数量、算完结果后回传**整份**新背包。
  op：`get` 拉镜像 / `take`·`return`·`add` 装备与拾取 / **`load` 装载（点击就扣料）** /
  **`unload` 卸下（返还）** / **`craft` 合成** / **`takeResult` 领取结果**（无 key，放在 key 校验前）。
  `pendingCraft = {key, n}` 是服务端记录的"已扣、待合成"材料：`load` 先返还上一批再扣新的 n；
  `craft` **只消费 pending**（不采信客户端传来的 n/target），剩余 1~4 张转成新的 pending
  继续留在装载槽（与客户端 `st.count` 一致），卸下时才返还。
  `pendingResult = {key, count}` 是**服务端存储的待领取成品**：`craft` 只挂起、不写 inventory，
  所以背包和合成列表都不会提前显示结果；点结果卡（`takeResult`）或被下一拨/卸下"替下"时
  才真正计入 inventory。目标由 `craftTargetOf` 从材料稀有度推导，概率取 `data.js` 的 `CRAFT_CHANCE`。
  启动时 `main.js` 调 `UI.syncInventoryFromServer()` 拉一次镜像。
- 快照频率 `SNAP_HZ = 25`，`LocalNet.step` 按 `SNAP_DT` 累加并保留余量后下发。
- 快照内容：`player`、`petals`（按 `petalNetKey` 定位）、`ents`（全量生物 + `FX_FIELDS`）、
  `webs`、`projectiles`。
- 事件：`dmg`、`kill`、`hurt`、`chat`、`sys`、`respawned`、`teleported`。
- 客户端差分镜像：新 `netId` 建视图，消失的播放退场后回收；`px/tx/blend` 插值。
- 远处生物休眠：半径**不是固定值** —— 客户端每帧把可视半径（视口半对角线 + 相机偏移，
  已含 Antennae 缩放）随 `input.viewR` 上行，服务端 `activeR() = max(MIN, viewR + PAD)`；
  客户端从未上报时才退回 `MOB_ACTIVE_R = 2200`。休眠个体不跑 AI/物理，但仍下发人口（小地图使用）。
- 醒/睡判定的唯一入口是 `LocalServer._isAwake(m, p, R)`（分区 / 周期唤醒 / 每步休眠共用）。
  **多节生物按整条链判定**：锚点取 `m._head`（链头），半径加 `head._chainLen`（整链长），
  否则链尾进视野时链头还在睡，`_solveChains` 没有头可解 —— 表现就是"半条蜈蚣僵住"。
  某一节死亡导致断链时，新段首要重置自己和后续所有节的 `_head` 与 `_chainLen`。
- 生物互相推挤用均匀网格宽相位：格距 192px，按最大半径扩圈，`_pseq` 保证每对只算一次。
- 新增网络实现只需实现 `Net` 子类，客户端代码不变。

## 7. 实体层

### 7.1 生命周期契约（`js/sim/exit.js`）

任何实体的出现与消失只有一条路：入场 Q 弹 + 渐显，退场放大 + 渐隐。
曲线参数私有在 `KINDS` 表，外部只读 `EntityFX.visual`。

```js
EntityFX.spawn(ent, kind);
EntityFX.tickEntity(ent, dt);   // 不进容器的实体
list.sweep(dt);                 // 容器内推进 + 唯一常规回收点
EntityFX.despawn(ent, opt);
EntityFX.done(ent);
EntityFX.draw(ctx, ent, paint);
EntityFX.hurt(ent, dur);
```

规则：

1. 禁止 `splice / pop / filter / length = 0` 直接删实体；普通数组的过滤判据只能是 `EntityFX.done`。
2. 场地实体与客户端镜像容器用 `createEntitySet`，内部数组封闭，不提供删除接口。
3. 红闪只走 `EntityFX.hurt / hurtAlpha / drawHurt`。
   实体上的 `fx` 是 `visual()` 的每帧缓存，花瓣特效状态只能放 `fxState`。
4. 渲染只读 `visual()` 或直接用 `EntityFX.draw`，不自行乘入场/退场曲线。
5. 退场计时每帧推进；快照中消失的实体必须补 `despawn`。
6. 可复活的实体用 `createEntitySet.reclaim` 取消离场并重新入场。

例外：

- 主角不在容器里，但 Q 弹、红闪、计时共用引擎。
- Hornet 尾针是母体子实体，id 为 `父 netId + ':missile:' + 序号`，不进世界人口表。
  **发射前后是同一个实体对象**（只切 `flight` 标记）：血量 / 红闪 / age / 入场进度全部连续，
  发射时不会重置 HP，也不会"先删一个再建一个"。
- 尾针【两端各自只有一个】：服务端由 `MobFX.tick` 惰性创建（`init` 不再预生成），
  客户端只镜像快照里的 `hornetMissile`，绝不自己造占位对象。
  发射瞬间客户端在 `_applyProjectiles` 里【收养】挂载态那个对象（`parentId` → `hornetMissile`），
  从挂载过渡到飞行还是同一份对象。快照里没有 `hornetMissile` 时立刻把引用清空（否则 F3 会留一个
  静止的幽灵碰撞箱）。
- 挂载态位置 / 朝向只由 `MobFX.hornetTailPoint(mob, size)` 给出：绘制、F3、受击判定三处共用，
  不许再用 `mob.facing + π` 之类的猜测角度。
- 尾针挂点 `dx/dy/size` 一律按 **drawSize 的固定裁剪框**（`cropRatio × viewBox`）归一化，
  不是内容包围盒（用内容包围盒会把挂点放大 20%+）。`HORNET_TAIL_FALLBACK` 必须与
  `prepareAssets` 解析出来的那组数**完全一致**（0.2783 / 45° / 0.2645），
  否则素材就绪前后会出现"第一枚正常、之后变小又跑位"。
- 尾针的入场 / 退场 / 红闪读它自己的 `EntityFX.visual()`（挂载态也是），父实体只提供一个透明度倍率。

### 7.2 花瓣实体

- `Player.petals` 保存本世代实体；死亡的独立子体保留到复活，权威侧靠它推进
  `respawnT / holdRespawn`，客户端靠它等待快照复活。
- 退场中的实体在 `player.petalExit`，只由它计时与绘制；`Player.update` 每帧 `sweep`。
- 快照按 `(slot, sub, gen)` 匹配；`gen` 两端可能差一拍，`_netPetalFor` 退化为
  "同槽同子号的唯一未认领记录"，且**不改写实体的 `gen`**（否则同槽两代会共用一个键）。
- 客户端只生成服务端确实有的实体（`_netSlotHasLive`）。
- `_snapPetals` 必须为"有卡但无实体"的槽补 dead 记录，否则客户端会留下不参与伤害的幽灵花瓣。
- 【能不能挨打】只有一个判据：`PetalFX.canBeHit(body)`（= `!type.noHealth`）。
  生物体伤、Hornet 尾针（挂载态与飞行态两段）、Pollen 弹等**所有外部伤害入口都只问它**，
  不许各自拼 `noDamage / noPush / noHealth` 的组合 —— 漏一处就是"Basil 被尾针打碎"。
- Shovel（铲子）＝ 不参与任何实体碰撞/结算（同 Basil：noDamage/noHealth/noPush/noKnockback/overMobs），
  唯一效果是【遁地】：`PETAL_TRAITS.shovel.burrow = { mode: 'detect', dur: 2 }`，
  装填完成且处于 detect 模式时由 `Player._startBurrow(dur)` 触发（客户端/服务端同一份逻辑）：
  · 所有花瓣实体走通用退场下架，装填冻结清零，`_endBurrow()` 后全部从 0 重新装填；
  · `player.stealth = true`：`Mob.canSee/canChase/_pickTarget` 全部忽略它（仇恨表不清，出来继续追），
    `sysPush` 的玩家推挤、`_combatTick` 的花朵体伤与尾针命中全部跳过；
  · 表现：本体不画，只留 `Player.drawBurrowShadow()` —— 与本体同尺寸的**纯色半透明圆**
    （无渐变、无描边；画在瓦片之上、所有实体之下）＋ 起土粒子
    （颜色 = 起手瞬间画布上脚下的地面像素，见 `Game._groundColorAt`）；
  · 移速：与踩到 foliage/seaweed/vine 同一档减速（`SLOW_TILE_SPEED`，见 `Player.update`）。

### 7.3 碰撞与伤害

- `Mob._ensureShape()` 是碰撞轮廓唯一建立入口，键为 `'mob' + (artSvg || svg)`。
- 生物的硬编码碰撞箱在 `assets/crbs/mobs/*.crb`，由 `tools/gen_mob_crb.py` 从 SVG 矢量几何生成：
  参与碰撞的是 `BODY_PARTS[id]` 列出的【填充路径颜色】，
  外加"与身体同 `d` 的 `fill="none"` 描边"（按 `stroke-width/2` 向外扩），
  触角 / 腿 / 尾针（不与身体同 d 的细线）不参与。
  坐标口径 = 运行时固定裁剪框（`_cropRatio` 以瓢虫图案包围盒标定）+ `MOB_PIVOT` 轴心位移，
  所以"画多大就判多大"。
  · 瓢虫 `3`：红壳 `#eb4034` + **黑色头部 `#0e0e0e`/`#111`**（旧版只取红壳，头部凹进一块）
  + **红描边圈**（独立素材 `assets/entities/3_ring.svg`，运行时按 `LADYBUG_RING_RECT`
  拉伸叠在本体上；工具里用 `RING_LAYERS` 把它并入凸包，否则可见红圈比判定大一圈）；
  · 蜜蜂 `4` / 大黄蜂 `27`：黄色身体 + **身体自己的 4.167 描边**（旧版把描边当成触角删掉，碰撞箱小一圈）。
- 【路径解析的坑】`tools/fit_mob_viewbox.py` 的 `path_points` 必须实现 **T/S 平滑曲线**：
  `T = 平滑二次贝塞尔`（控制点是上一段 Q/T 控制点关于当前点的镜像）、
  `S = 平滑三次贝塞尔`（第一控制点同理）。瓢虫描边圈、蚂蚁/蜈蚣身体全是用 `T` 串起来的
  90° 大弧 —— 旧实现把 `T` 当"直线端点"（不采样、不反射），弧段中段只剩空档，
  碰撞箱就会"缺一块"（瓢虫后方）。改完必须重跑 `gen_mob_crb.py` 重新生成所有 `.crb`。
- 多节生物头节 `12_h`、身体节 `12_b` 各用本节贴图，不回落整条外形。
- 多节生物【节数】按稀有度递减（`MOB_TRAITS.centipede.segCount`），平均：
  common 11.5 / unusual 11 / rare 9.5（**rare 及以下固定**）→ epic 8.5 / legendary 7.5 /
  mythic 7 / ultra 6 / super 5 / eternal 5（高段整体比首版上浮约 30%，单调不回升）。
  高等级体节更大、长链极易卡墙，所以越高级越短；自然生成的 45~60 节超长个体仍然只有 common 有 0.3% 概率。
- 【禁止生成在墙体内】：所有自然生成都过 `LocalServer._canSpawnAt(x, y, r)` ——
  `mobBlockedAt`（减速瓦片 = 生物的墙）+ `canStandAt`（半径内不压瓦片碰撞多边形），
  半径取 `min(r, MOB_WALK_LIMIT_R)`（未建轮廓时 r 是视觉外接半径，会大出一大截）。
  蜈蚣是**逐节判**：某一节要落的位置站不住就【就地截断】，后面的节不再生成；
  头节本身在墙里则整条不生成（`_spawnChain` 返回 0，`_spawnInZone` 返回 false）。
- 多节生物【出生摆位】与 `_solveChain` 读同一个半径口径 `_chainRad`（`rMean`）+ `GLUE = 1.0`。
  出生时素材可能还没加载（`rMean` 算不出来），间距只能退回 `r` 估（偏大 20%+）；
  `_spawnChain` 因此把链头挂进 `_chainSettle`，素材就绪后由 `_settleChains` 用同一套解算
  **重摆一次**（每步最多 6 条）。少了这一步：远处的链会一直"一节一节散着"，
  直到玩家走近、链头进入视野被解算，才啪一下合拢。
- 物种可选手写 `MOB_TRAITS[slug].collider = { type:'circle', k }`。
- 蜘蛛轮廓从删除 8 条腿后的身体素材提取。
- `Mob.walkR / walkSize / walkHull` 只用于墙体与禁行地形；伤害、推挤、花瓣命中用 `r / shape / collSize`。
- 花瓣与生物的实体碰撞由 `PETAL_TRAITS[slug].solid` 决定：
  - `false`：穿过生物，重合瞬间传一次冲量（`PETAL_KB_CD`）；
  - `true`：生物被推出花瓣轮廓并沿表面摩擦，花瓣不位移。
  两种情况花瓣都不位移，伤害由 `LocalServer._combatTick` 每 tick 结算。
- 推出时保留 `PETAL_CONTACT_SKIN` 穿透量，否则下一 tick 命中判定归零。
- 花瓣吸附只对 `solid` 花瓣生效。
- 召唤物（Ant Egg）与普通生物同一口径：生成时立刻 `_ensureShape()` 建轮廓，
  不等下一次 `sysMobs`（否则首帧只有外接圆、F3 也没有碰撞箱）。
- 实体对撞只有一条路：`sysPush` 里玩家↔生物用 `physicsPushMob`、生物↔生物用网格里的
  `physicsPush` —— 召唤物就是普通生物，没有任何专属的碰撞/分离代码。
  接触伤害只在 `_combatTick` 结算（与花瓣/花朵本体同处），按【阵营】判定：
  同阵营不结算，玩家阵营↔敌对才双向掉血（`_dmg` + `_hitMob`）。
- 仇恨按【谁打的】记账：`_hitMob(m, dmg, src)` 的 src 缺省是玩家，召唤物互欧时传真实来源；
  `noteThreat` 另有"同阵营不记仇"的通用规则（召唤物绝不恨自己的主人）。
- 结构能力字段（`PETAL_TRAITS` → `type` 字段）：
  `noPush`（没有碰撞箱，穿透生物、不做分离）、`noKnockback`（不传击退）、
  `noHealth`（没血量，不初始化 hp、不挨打、不磨损）、`overMobs`（图层高于生物，
  由 `Player.drawOverMobs` 在生物之后补画）。Glass / Basil 四个都开。
- `stats.interval`（Glass）= 同一片实体两次伤害之间的最短间隔，计在实体的 `b.intervalT`；
  与 reload（卡什么时候重新长出一片）是两个独立概念，不要混用。
- 召唤物的"跟着主人"是【属性】不是专属 AI：`MOB_TRAITS.soldier_ant.follow =
  { start, stop }`（两个阀值做迟滞）+ 服务端只把 `mob.followEnt` 指向玩家，
  行为在通用 `wander` AI 的 `_util.follow` 里（任何生物都能配）。
  Soldier Ant 的 AI 与蜘蛛完全相同（通用游走：追击 -> 逃离 -> 跟随 -> 随机游走），
  只有移速数据与外观不同 —— 不要再给它写第二个状态机。
- Soldier Ant 兵蚁是【已实装的自然生成物种】（不再只是召唤物），四件事都走数据/同一套体系：
  · 数值：`MOB_RARITY_OVERRIDES[7]` 整表（hp/dmg/armor/exp，官方 Wiki 口径，Common 100/10/1/1 …）
  · 掉落：`MOB_DROP_ITEMS.soldier_ant = ['clover','glass']`，两张【各自独立】的分布表在
    `MOB_DROP_TABLE_ITEM.clover` / `.glass`（行 = 生物稀有度，列 = 花瓣稀有度，空格子 = 这一档不掉）
  · 生成：`SPAWNABLE_MOB_SLUGS` 收录 `soldier_ant`；TMJ 里的旧名 `ant_soldier` 由
    `MOB_SPAWN_ALIASES` 归一 —— 没有别名表会被当成"未实装物种"静默跳过（表现就是地图里一只都没有）
  · 阵营：Hostile → 看见玩家就追（与蜘蛛同一条 hostile 判定）；野生个体没有 `followEnt`，
    所以 `_util.follow` 天然不生效。跟随是属性，不需要第二个物种、也不需要第二套 AI。
  · 碰撞箱：只算【两个圆形体节】，翅膀与两只小牙不算。与蜘蛛同一条管线：
    `Mob._ensureShape` 的 bodyKey = `mob7_body`，矢量轮廓离线预计算在 `assets/mob-shapes.js`
    的 `'7_body'`（`tools/gen_ant_body_shape.py`：fill="#eee" = 翅膀、fill="none" = 小牙，
    一并排除，其余身体 path 的点一起取凸包）。
  · 外观分层（`js/render/ant-art.js` + `MobFX.register(slug)`）：按【原文档顺序】切成
    底层身体 / 中层（翅膀 + 小牙）/ 顶层身体三层（素材里腹部本来就压在翅膀上，顺序不能改），
    每层一张同 viewBox 的图叠画；摆动 = 每个部件绕【自己的起笔点】旋转 sin 相位，
    每秒 1.5 个来回（`AntArt.HZ = 1.5`，翅膀 ≈ 1.5°、小牙 ≈ 2.9° —— 用户口径：原幅度的 1/6）。
    叠加层由通用钩子 `MobFX.drawOver`（`mob.js` 在本体画完后调一次）分发，引擎不认识具体物种。
- Worker Ant 工蚁（id 6）= 兵蚁的同一套东西，差异全在数据：
  `MOB_RARITY_OVERRIDES[6]`（60/10/1/1 … 1574640000/65610/583/9345409）、
  `MOB_TRAITS.worker_ant = { speed:'player' }`（与兵蚁同一移速口径）、
  registry 的 `type = Neutral` → 中立：不主动追人、挨打才反击（与稀有瓢虫同一档）；
  掉落 `['leaf','magic_leaf','corn']`；碰撞箱 = 两个体节（`assets/mob-shapes.js` 的 `'6_body'`）；
  小牙摆动与兵蚁同频同幅（`AntArt.SPECIES.worker_ant` 只是换了一份素材）。
- Baby Ant 幼蚁（id 5）= 同上，但 `type = Passive`（永不主动生成仇恨）、
  `MOB_RARITY_OVERRIDES[5]`（25/10/1/1 … 656100000/65610/583/19893553）、
  掉落 `['light','leaf','magic_leaf','rice']`（Light 走官方通用表），
  碰撞箱 = **一个**体节（`'5_body'`）—— 生成脚本对体节数量不做假设，有几条身体 path 就取几条。
  体型按【主体球】对齐同级 Worker 的较大体节：`MOB_TRAITS.baby_ant.sizeScale = 0.8465`
  （素材归一化球径 Baby 0.8678 / Worker 大球 0.7346）。
- **蚂蚁家族整体小一档**：`MOB_TRAITS.<ant>.sizeTier = -1`（worker / baby / soldier / queen），
  `Mob` 构造里 `sizeTier` 换算成 `MOB_DIAM_STEP^tier`（≈0.708），绘制与碰撞同步缩放。
  用档位而不是手写小数：它直接对齐稀有度表，改表时不会脱节。蚁穴 / 蚁卵是结构物，不下移。
- 阵营：玩家本体 `Player.faction = 'player'`（召唤物同阵营）。`Mob.noteThreat` 用阵营判敌我，
  没有这个字段时玩家会被当成 `'enemy'`（= 与所有野生生物同阵营），于是**中立生物（工蚁 /
  Rare+ 瓢虫）挨打永远不记仇**，只有主动敌对型才会追 —— 这是"工蚁像是被动"的根因。
- 花瓣 → 生物的击退是**统一口径**：所有花瓣都按"legendary 花瓣以标准移速撞上来"算
  （`PETAL_KB_MASS_LEGENDARY` = 1.8，速度不参与），生物一侧按稀有度份额 `KNOCKBACK_SHARE`
  × 质量悬殊 `kbBoost` × 等级衰减 `1/(1+(level-1)×KB_LEVEL_FALLOFF)` 递减。
  花瓣自身的稀有度/等级/血量/速度一律不得进入击退公式。
  【生物击退硬上限】`MOB_KB_MAX = 22.4`（px 总位移）= 当前花瓣对 common 生物击退的 1/4，
  在 `applyKnockback` 里对有 `type.slug` 的生物统一钳制，不随稀有度/等级/装备变化；
  玩家本体不吃这个上限。低等级生物不再被一撞飞出好几个身位。
- 脱战只有一条规则：`Mob.canChase(ent)` = 距离 ≤ `sightR × MOB_DEAGGRO_K`（=2）且视线不被墙挡；
  `topThreat()` 用它逐条筛仇恨表。超范围的目标【只在本帧失效】，仇恨记录永不抹除 ——
  超范围时自动改选范围内下一个有效目标，没有有效目标就返回 null 让 AI 游走；
  目标回到范围内会自动恢复追击。视线采样统一在 `Mob._losBlocked`（0.15s 缓存），
  `canSee`（1×）/`canChase`（2×）/`wallBlocked` 共用同一份结果。
- Ant Egg 蚁卵（生物，id 40，与同名花瓣是两个东西）：障碍型 + `immovable`（重量 Infinity、
  不吃击退/推挤，`speed: 0` 据此判 `obstacle`），固定在原地；掉落花瓣 Ant Egg（官方通用表）。
  `immovable` 的实现在 `Mob.update`：**不跑 `moveEntity`**，速度/击退全部清零。
  只靠重量 Infinity 不够 —— 地形解算（`map.move/moveShape`）在实体压住墙体时会把它推出去，
  那正是"蚁穴/蚁卵偶尔会动"的来源。新增障碍型物种只要声明 `immovable: true` 就自动锁死。
  被击碎时 50% 原地生成【同级】Baby Ant（`mob.avenger`）：通用 `chase` 优先选中它并
  **忽略距离**（仍受墙阻挡），仇恨永不转移；玩家死亡后清空 `avenger`，变回正常被动。
  复仇幼蚁的追击速度 = Soldier Ant（同为 `speed:'player'`）。
- Queen Ant 蚁后（id 8）：AI 与 Soldier Ant 相同（`MobAI.register('queen_ant')` 复用 wander），
  差别只有属性 `queen = { minRarity:'rare', max:7, eggCd:1.5, hatch:1.0 }`：Rare+ 在执行 AI 的
  同时统计自己 `brood` 里的存活数，< 7 就停下写一次 `queenEggReq`（间隔 ≥1.5s）。
  生成/孵化全在服务端：`_queenAntTick` → `_spawnQueenEgg`（低一级、无敌、走通用实体接口）
  → 1s 后 `_hatchQueenEgg`（`despawn` 蚁卵原地放同级 Soldier Ant，存活数不变）。
  外观/碰撞：也进 `AntArt.SPECIES`（`queen_ant: '8'`）→ 翅膀与小牙和兵蚁一样摆动；
  碰撞箱 `assets/crbs/mobs/8.crb` 只含 3 个体节（`BODY_PARTS['8'] = ['#454545','#555']`），
  **翅膀与小牙不参与**。体型 `sizeScale = 1.369`：以"头部第一节圆"对齐兵蚁同级头部
  （素材头径 40.83/84.361 vs 兵蚁 29.17/44.027），否则整只蚁后比兵蚁还小。
- Ant Hole 蚁穴（id 9）：障碍型（`speed:0` + `immovable`）固定不动；数值走
  `MOB_RARITY_OVERRIDES[9]`。产卵参数全在 `MOB_TRAITS.ant_hole.hole`：
  `init` 开局铺 6 只（3 幼蚁 / 2 工蚁 / 1 兵蚁），`pool` 是整局 40 只的构成
  （5 幼蚁 / 8 工蚁 / 26 兵蚁 / 1 蚁后）—— 抽干即停，所以总量与占比恒定；
  每掉 `step`（7%）生命由 `_antHoleHurt` 补一批 3 只，抽取权重前期偏向幼蚁/工蚁
  （兵蚁后置），蚁后在生命 < `queenAt`（40%）时随某一批额外出现一次。
  受击时属于它的工蚁全部 `hostility='hostile'`（AI 与兵蚁一致）。
  `MOB_TRAITS.ant_hole.passWith` = 蚂蚁家族：`sysPush` 的 `_passThrough` 跳过这类配对的推挤，
  蚂蚁可以随意踩在蚁穴上。
  **掉落**：`MOB_DROP_ITEMS.ant_hole = ['soil','shovel']`，两张专属分布表在
  `MOB_DROP_TABLE_MOB.ant_hole`（官方 Wiki 的 Soil / Shovel 两个页签，逐档抄录）。
  走 `rollMobDrops` 通用掷骰，所以图鉴悬浮框（`mobDropRows`）与地面掉落同源。
  **生成**：蚁穴是【全图物种】，不是蚂蚁区专属 —— 它写在 `MOB_GROUPS.garden` 里
  （`['ant_hole', 0.05]`，与地图里那条专属权重同口径）。garden.tmj 的 41 个生成区里
  只有 1 个写了 `ant_hole:0.05`，其余 32 个写的是组名 `garden`；组表是唯一的分布来源，
  所以在组表里漏掉它 = 全图只有那一个区会刷蚁穴。
  全图 garden 区合计约 1500 只时，期望 7~8 个蚁穴（每区约 0.5% 概率）。
  `MOB_TRAITS.ant_hole.spawnMin = 1` 只是【整张地图】的保底数量（`_ensureStructureSpawns`），
  兜住"一整局一个都没随机到"的极小概率 —— **不要**退回"每个区保底一只"（那会变成 32 个穴）。
- 掉落表有三级优先级（`dropDistFor(slug, rarity, mobSlug)`）：
  【该生物对该件花的专属表（`MOB_DROP_TABLE_MOB`）】 > 【该件花的全局专属表（`MOB_DROP_TABLE_ITEM`）】 > 官方通用表。
  为什么要第二层：工蚁/幼蚁的 Leaf 表与通用表完全不同，而 Leaf 同样是蜈蚣的掉落 ——
  把 Leaf 写成全局专属表会把蜈蚣一起改掉。Magic Leaf 与同生物的 Leaf 表完全相同（只入库、不掉落）。
- 红闪【唯一入口】是 `EntityFX.drawHurtShape(ctx, ent, x, y, poly, scale, r, maxA)`：
  有碰撞多边形就填多边形（生物 / Wax 落位实体 / Hornet 尾针的 CRB），碰撞箱本来就是圆的
  （花朵本体的 `R`）就填圆。
  绝不再为某个物种单写"红剪影 / 专属半径"。
- **花瓣**的红闪按用户口径是【贴图自己的形状】（不是一个圆）：`_drawPetalEntity` 用
  `CardRenderer.redArtCanvas(svg)`（素材整张 `source-in` 染红、按 svg 缓存）叠在同一个变换上
  （含 `spinOrigin` 轴心偏移），素材未就绪才退回 `PETAL_R` 圆。
- **Hornet 尾针 / Missile 花瓣**：素材是花瓣 9，CRB 为 `assets/crbs/mobs/11_missile.crb`，
  由 `tools/gen_stinger_crb.py` 生成 —— **必须按 `stroke-width/2` 做圆角外扩**
  （素材是 `stroke-linejoin="round"`，描边才是画面最外沿；只取中心线会小一圈）。
  画红闪时必须套用与贴图相同的变换（平移到实体 → 旋转 `facing - MISSILE_TIP_ANGLE` → 缩放），
  CRB 的归一化坐标是【素材坐标系】，不旋转就会和画面错开。
- 回血增幅（Basil）= `stats.healBonus`，在 `Player.recompute` 里求和成 `player.healBonus`；
  【最后结算】: 所有回血只能走 `PetalFX.ctx.heal`，那里统一乘 `(1 + healBonus)`。
- 有方向的素材（Missile）只有两个声明：数据表的 `launchRadial`（方向取脱轨瞬间的轨道角）
  与 `PetalFX.artTip(type)`（尖端角，绘制与飞行朝向的唯一来源）。
  飞行朝向每帧由速度重算（`atan2(vy,vx) - artTip`），不依赖快照时机；
  实体推进与快照回填两处用同一个公式。
  退场朝向必须【定格在进入退场那一刻的画面朝向】（`Player._petalExitRot(b)`）：
  飞行体的 `flightRot` 与轨道花瓣的径向角是两回事，死亡时切回径向会在消失瞬间歪一下。
- 伤害唯一入口 `LocalServer._dmg(atk, armor) = max(atk - armor, 0)`，四个方向共用。
- 接触伤害每 tick 一次、一次为完整面板值，无伤害冷却与单次上限；
  只有花朵本体有 `FLOWER_HURT_INVULN` 受伤无敌帧。
- 击退是离散事件（`kbT` + `PetalFX.onHit`），一次接触传一次动能。
- 飘字按 0.12s 聚合，数值为窗口内累计。

## 8. 数据层

- `RARITIES` 九档：`common → unusual → rare → epic → legendary → mythic → ultra → super → eternal`。
- `registry.js`：花瓣 1..94 为真实、95..116 为二创；生物 1..83 为真实，84+ 忽略。
- 启用花瓣（`ENABLED_PETAL_SLUGS`）：`basic, light, rose, stinger, pollen, honey, peas, leaf,
  faster, third_eye, web, antennae, orange, missile, wax, rice, corn, wing, ant_egg, clover,
  glass, basil, shovel, soil`。
- 不可堆叠（`stackable: false`，只有最左那格生效）：`third_eye, antennae, clover`。
  这是"卡不可叠"，不是"效果不可叠"：多个玩家各带一张 Clover 时幸运值照常加算。
- 生物词条键：`MOB_I18N_ALIASES` 把 slug 映射到官方键（蚂蚁家族是 `ant_*` 前缀：
  `worker_ant→ant_worker / baby_ant→ant_baby / soldier_ant→ant_soldier / queen_ant→ant_queen`），
  名字与简介都必须经 `mobI18nKey(slug)` 查，否则中文环境回落英文且没有简介。
  特例：Bumble Bee 的 Pollen 是【生物实体】（`POLLEN_SHOT_TYPE`，slug `pollen_shot`），
  不能借 `Petals/pollen`，词条在 `js/i18n-extra.js` 里单独登记。
- 花瓣默认自转：口径是「**公转 + 自转 = `PETAL_SELF_TURN_T` 秒一圈**」（= 2s），
  所以 `_petalSelfRate` 必须 **减去公转角速度**（绘制角 = drawRot + selfRot，叠加才是玩家看到的一圈）。
  `type.selfSpin` 优先；`orientOutward`（Missile）与落位实体（Wax）不走默认自转。
  Wing 的自转轴心 = 半月形外弧的圆心（`spinOrigin` 按"实体窗口边长"归一化，见 data.js）。
- Soil（泥土）：伤害/血量/Flower Health 按稀有度在 `PETAL_RARITY_OVERRIDES.soil`；
  装备即生效的三项加成走 `PetalFX.bonus` → `Player.recompute`：
  `extraRadius`（+5/件，叠加）、`flowerHp`（按稀有度相加）、`speedMul`（0.75/件，**乘积**）。
  `Player._tickSoil(dt)` 用指数阻尼平滑逼近半径与生命上限（速率 3 = 半径变化速度的 0.5×）；
  改生命上限时当前血量与 `dispHp/ghostHp` 按**同一比例**缩放 → 血条百分比恒定。
  `baseR / baseMaxHp` 是不含 Soil 的基准，`?hp=`/attach/重置 三处必须同步维护。
  【花瓣轨道按当前实际半径】：`baseReach = this.r × (1 + PETAL_REACH) × 1.105`，
  花瓣到主角【边缘】的距离/变化幅度保持设计比例，本体变大时花瓣跟着边缘一起外移；
  旧版用固定 `PLAYER_R_STD` 会让花瓣挤到变大的身上。吸附预筛 `pullR` 随之同步。
  Wax 落点仍用 `p.r`（蜡块不能落在变大的花朵内部）。
- 玩家移动是"推进加速度 + 阻尼"模型（`MOVE_DRAG_ACTIVE = 5` / `MOVE_DRAG_IDLE = 3.5`）：
  每帧 `v = v × exp(-drag×dt) + a×dt`，`a = 目标速度 × MOVE_DRAG_ACTIVE`。
  稳态速度 = `a/drag`，转向保留旧速度一小段（侧滑惯性），松开靠阻尼滑停；
  客户端预测与服务端权威共用 `Player.update`，两端同一份常量，禁止只在单边加力。
- **合成窗口（Craft）**：**服务端权威** —— 客户端只发合成请求 + 播动画；`_gc` 只是服务端
  库存的**只读镜像**（`type.key|rar -> 数量`）。库存增减、成功率、结果计算全在服务端，
  插件改本地镜像改不到权威状态。
  · 入口：左下角 `craftBtn`（`assets/ui/btn-party.svg`，与背包同尺寸，位于其下方）或 `C` 键；
    动效与背包一致（主色 #db9d5a，描边 #b17f49）。**窗口宽 432px（背包 1.5×）、
    高 1.3×（max-height 530px），增加的高度全给下方卡片列表**，舞台固定 178px。
  · 舞台 `.craft-stage` 用 `flex: 1 1 auto` 吃满主行剩余宽度（按钮侧栏固定 112px 靠右），
    5 槽不能被挤窄。5 个材料槽按【正五边形】排列（一个顶点朝上），空槽/卡片均 48px。
    **点击空槽或卡片 = 卸下全部材料**（服务端 `unload` 把已扣的装载返还背包；动画中不可卸）。
  · 多张卡【均摊到 5 个槽】：`base = count/5 | 0`、`rem = count%5`，前 rem 槽 +1，
    每槽卡面带 xN 角标（`CardRenderer.createCard({count})`），合成过程中角标同样保留。
    不再把散卡堆在中心，也不显示损耗。
  · 下半列表：库存按【花瓣种类】分行，同种不同稀有度同一行，每行 8 格 common..super
    （**Eternal 不计入**）；有货格常显，**库存 + 同种同稀有度已装载的剩余张数 ≥ 5 才上色可点**
    （`_craftCellOn`：失败后装载槽里剩的 1~4 张会被下一次 `load` 先返还，所以能补齐一炉），
    否则灰化不可点（`on/off` 类 + `.off .card { filter: grayscale }`），零库存格同样是灰槽。
    库存被扣到 0 时直接隐藏该格卡面，不留旧角标的幽灵卡。
    悬浮只出 tooltip，无额外 hover 样式。
  · 点击装材料即【服务端扣料】（`inv{op:'load'}`），背包数量立刻减少；卸下走 `unload` 返还。
    服务端 `load` 的够不够判定必须把【同种上一批 pending 的返还量】算进去（`_invCount(key) + refund`），
    否则"装载 3 张 + 库存 2 张"要装 5 张会被误拒，客户端却按补齐显示 —— 既不扣料也能反复点。
    **调试模式不跳过 `load`**（`_craftDec` 一律上行）：`craft` 只消费服务端 `pendingCraft`，
    跳过装载就永远拿到 `no pending craft`，表现为"既不成功也不损耗"。
    调试库存是 ∞，Shift 批量装料只发有限批次（5.0k 张，均摊到 5 槽 = 每槽 1.0k）；服务端入口拒绝非有限 `n`
    （`Infinity` 会让 `craft` 的 `while (left >= 5)` 永远退不出去）。
    服务端 `_invCount/_invSet` **实时读 `window.__debug`**（不缓存字段）：设置里关掉调试后
    立刻恢复真实库存，不会残留"无限库存、怎么扣都不掉"的状态。
    5 槽待合成卡与背包卡同款悬浮框（类型实时读当前 `st.kind`，换卡自动跟着变）。
  · 点击行为：① 异种 → 退回现有材料再装 5 张；② 同种不足 5 → 补齐；
    ③ 同种已满 5 → 再叠 5 张，只更新 xN 角标，**绝不自动开始，必须点 Craft**；
    ④ **Shift+点击 → 批量装入全部库存**（调试 ∞ 按 5.0k，均摊每槽 1.0k），
    **仍需自己点 Craft** —— Shift 不再自动合成，全 UI 没有任何自动合成入口。
  · Craft 按钮描边深灰 `#242424`（不再是纯黑）；不足 5 张时 `:disabled` 灰底
    `#5a5a5a` + 略深描边 `#3a3a3a` —— JS 只给可用态写 inline 目标色，不可用态清空 inline 让 CSS 生效。
  · 成功率表在 `data.js` 的 `CRAFT_CHANCE`（64/38/19/9/4/2/1/0.1%，按目标稀有度），
    **服务端据此计算，目标由 `craftTargetOf` 从材料稀有度推导，不采信客户端上报**；
    失败损失 1~4 张四档均分（`1 + floor(random*4)`），剩余必定 1~4 张留在装载槽里，
    损耗在合成窗里以"尾部槽炸卡 + 剩余张数变少"体现；调试模式下库存是 ∞，但 `left` 仍按
    真实损耗减少（合成窗里看得到掉卡），成功结果照常进 `pendingResult`。
  · 计时由服务端回执驱动：`_craftStart` 只发 `inv{op:'craft'}` 请求，**没回执就一直聚拢/张开，
    绝不自行结算**；收到后先确保动画时长够 `minCycles`，再在【下一次聚拢】走半程到最紧后
    **停留** `holdDur = 1.25×1.6`，停留结束才 `_craftResolve` 展示回执结果。
    周期固定 `_CRAFT_CYCLE = 1.25s`（原 0.5s ÷ 0.4，速度 0.4×）。
  · 动画：每周期 `close = 0.5 - 0.5cos(pr·TAU)`（末次只走 0→0.5 的聚拢半程再 hold）；
    抖动幅度 ∝ close；中途粒子只在聚拢段迸发（close>0.55 且相位上升），
    方形、目标稀有度色、unusual 1~2 → eternal ≈500，走 UI 层 canvas `.craft-fx`。
    **5 个槽位本体和卡同步收紧/张开**（不是静态灰槽）：`_craftStart` 逐帧写槽位 left/top
    到中心，`_craftSpread(dyingSet)` 用【同一条 120ms 弹簧曲线】
    `cubic-bezier(.22,1.45,.36,1)`（起步快、尾段减速并轻微过冲）把槽位和卡一起放回五边形。
    · **批量合成**：服务端 `invRequest({op:'craft', key, n})` 一次性算完所有轮（成功 +1、
      失败损 1~4 且剩余继续复用，直到不足 5 张），扣 n 加 wins 后回传**整份新背包** +
      `{wins, losses, left, target}`；客户端只展示 `.craft-big` 的 **xN 角标**，不逐轮重播。
      守恒：`wins*5 + losses + left === n`，且 `left < 5`。
    · 结算表现：成功 = 中心【原地炸粒子】+ 成品卡，卡堆保持聚拢、**不重建卡面（避免闪一下）、
      5 个空槽先不出现**；点结果卡（`_craftTakeResult`）或下一拨才从中心张开。
      失败 = 炸卡取【尾部槽】：`nDying = 原可见槽数 - left`。旧版随机选会命中前排保留槽，
      渐小后本该有卡的槽反而空一格（看起来多损一张）。`_craftSyncCards(false,'keep',dying)`
      只把前 left 槽换成 x1，尾部被炸槽保持可见并随槽飞回；
      **从飞回这一刻就 `_craftPop(out)` 渐小**（220ms > 120ms 回位，移动全程都在缩），
      粒子一次性崩出并 `follow` 卡片逐帧跟随，卡隐藏后留在最后位置飞散（不跳回中心、不持续崩）。
      槽从 scale(0)/opacity(0) 渐大渐显（聚拢阶段槽隐藏）。
    · 渐小与渐大同为 `.22s` + `cubic-bezier(.3,1.5,.5,1)`（同样弹感）；
      **所有 `_craftFxBurst` 都立即渲染首帧**（成功粒子也不再有延迟）；
      炸卡粒子短寿命 0.08~0.18s；`.craft-fx` 的 `z-index:0` 低于槽(1)与卡(2)。
    · 成品在 `craft` 时只进服务端 `pendingResult`，**不写 inventory**（背包/合成列表不提前显示）；
     点中心结果卡或被替下时 `_craftTakeResult` 发 `takeResult` 才真正入包，
     并走 `_craftFlyToBag`：克隆结果卡飞向左下角背包按钮（canvas 克隆不带像素，
     需 `drawImage` 手动复制），给出"已返还背包"的可见反馈；结果卡收起、**不落到槽里**。
    · 切卡 / 加卡 / 卸下统一走 `_craftPop(el)` 渐大渐小，**渐大渐小同为 220ms**
     （CSS `.22s` 与 JS 隐藏定时器 220ms 对齐）。**pop class 同时加在 `.card` 与数量角标
     `.card-count` 上**：角标是 canvas 的兄弟节点，只动 canvas 会出现"卡没了、xN 才突然消失"；
     角标自带 `rotate(30deg)`，用专用 `craft-pop-count` 关键帧保住旋转。
     pop 绝不作用在 `.craft-card` 本体：本体的 `left/top/transform` 由合成动画逐帧写，
     被 CSS animation 覆盖会把卡锁在 `scale(.35)/opacity .4` 看起来"消失"。
    · **点击不闪**：`_craftSyncCards` 对同种卡（`el._craftKindKey === st.kind.key` 且未在渐小）
     只 `CardRenderer.setCount` 改角标、**不重建 canvas**；异种才重建。
     ① 异种装载 = 全部渐大；② 不足 5 补齐 = 只给原来为空的槽（`before..4`）播渐大；
     ③ 同种已满再加 5 张 = 只换角标、完全不播动画；④ Shift 批量装载也不额外闪、不自动合成。
     `_craftStart` 开头强制清残留 pop 并恢复可见；`_craftSeat` 归位清 `transform`，
     防止上次合成的旋转/位移残留导致"放卡会歪"；`_craftPop` 用 `clearTimeout(el._craftPopT)`
     + `children[0].parentNode !== el` 判据防止旧定时器把新装的卡隐藏。
     **没有蒙版、没有右上角多余结果卡**（旧 `.craft-out` 已删）。成品由服务端加进背包并回传；
     中心成品卡 `.craft-big` 同样绑【卡牌悬浮框】（类型/稀有度实时读 `st.result`，成功后才出现）；
     `craftGo` 绑定 `click -> _craftStart`；`_craftSyncTop` 显示成功率，空槽显示 `?`。
- Antennae 的 `sight` 为官方视野比例，相机缩放 `1/(1+sight)`；
  所有以屏幕尺寸计算视口的位置都要除以缩放值。
- 一卡多体的显示口径由 `PETAL_STAT_DISPLAY` 声明：`each` 单体值 / `total` 合计值，
  只影响悬浮框、卡面与卡槽水缸；实体结算永远用单体值。
- 卡面多体排布只有一张表：`CardRenderer` 的 `LIGHT_LAYOUTS[n]`（阵型型走 `FORMATION_LAYOUTS`），
  几何以单体直径 D 为单位、`k` 是单体缩放；新增 N 体花瓣只补档位，不写花瓣专属系数。
  引擎不做“整簇缩放”（`drawMulti` 的 scale 恒为 1）：单体大小只由素材内容与 `k` 决定。
- Ant Egg 的 `51.svg` 里只是【一个蛋】素材（原四蛋图已拆成 4 个独立实体），尺寸保持原样；
  卡面由 `LIGHT_LAYOUTS[4]` 摆 4 个：`r = 14.28/40 = 0.357` 是原四蛋素材里的蛋心位置，
  `k = 1` 是单蛋原尺寸（= 改排列前卡面画的那个蛋的大小），圆心位置也保持原样。
- 花瓣实体的绘制直径 = `CardRenderer.entityArtSize(svg, PETAL_ENT_SIZE)`：
  素材窗口相对 Basic 参考窗口的比例。卡面与世界用的是同一套比例，所以素材本身大的花瓣
  （Basil）在世界里也大，不再一律塞进同一个方框。
- 属性【标签】颜色只有一个来源：`data.js` 的 `STAT_LABEL_COLORS`（health/damage/heal/armor/
  poison/bonus/duration），每行构建时写进 `row.labelColor`。绝不按行序取色——
  卡上缺一项或新增一项属性时，其它属性的颜色会串位。数值列固定白色，
  只有需要强调的数值（Max Mob Rarity 的稀有度名）才用 `row.valueColor`。
- 生物衰减值 / 环境幸运值（Clover）：每个【自然生成】的生物出生时按所在地点的环境幸运值
  调整稀有度。`LUCK_BASE = -0.6`（= 60% 概率降一级）；Clover 在玩家 `CLOVER_LUCK_R = 1000`
  内叠加 `stats.luck`（+0.1 … +0.9），上限 `LUCK_MAX = 4.0`；
  统一公式 `luckRarityShift(luck) = sign(L) × (floor(|L|) + (rand < frac(|L|) ? 1 : 0))`，
  例：1.3 -> 必升一级 + 30% 再升一级；结果钳在 `[common, LUCK_MAX_RARITY = super]`
  —— Eternal 永远不能自然生成。回合入口是 `LocalServer._rollSpawnRarity`，
  `/summon` 等非自然生成不经过它。
- Glass：穿透实体、没有血量，接触生物时每一片实体每 `interval` 秒结算一次单向伤害；
  图层在生物之上（`overMobs` + `Player.drawOverMobs`）。
- Basil：`healBonus` 只有 Mythic+ 四档（Mythic 45% / Ultra 50% / Super 55% / Eternal 60%）；
  没有伤害、没有血量、没有碰撞（`noDamage + noHealth + noPush +
  noKnockback`），也不结算伤害；装填 2.5s。悬浮框只有 `Healing Bonus: +45%` 一行，
  标签色与 Heal 属性完全相同（`STAT_LABEL_COLORS.heal`）。
- Orange：三实体阵型，伤害按目标上次实际受伤追加计算，上限 `Max Damage`。
- Missile：发射链路与 Peas 相同（`launch` 能力字段 + 引擎默认 `detach`/`flightOf`）；
  reach 下加载完成即沿当前轨道角径向飞出（`launchRadial`），直线飞行 2s，参与实体碰撞。
- Hornet：追击速度 0.95× 玩家，尾部 Missile 为 MobFX 子实体，独立受击，消失后 0.5s 重生。
- Shovel：装填按稀有度递减（`PETAL_RARITY_OVERRIDES.shovel.reload`：15.0 / 13.1 / 11.8 / 10.1 /
  8.5 / 6.9 / 5.2 / 3.6 / 2.0 / 2.0 s，唯一入口 `petalReloadOf(card)`）；detect 模式装填完成即遁地 2s。
- 可自然生成生物（`SPAWNABLE_MOB_SLUGS`）：`ladybug, bee, bumble_bee, centipede, spider, hornet,
  soldier_ant, worker_ant, baby_ant, ant_egg, queen_ant, ant_hole`。地图 TMJ 里的旧名走
  `MOB_SPAWN_ALIASES`（`ant_soldier / ant_worker / ant_baby / ant_queen` → 对应物种）。
- 中毒数值在 `MOB_RARITY_OVERRIDES[id].{poison,poisonRate}`，由 `_combatTick` 施加到 `StatusFX`，
  扣血在 `Player._tickPoison`；状态效果不进快照，客户端由 `hurt` 事件的 `poison` 字段自挂。
- 隐藏掉落（`DROP_HIDDEN_SLUGS`）：`mana_orb / blueberries / magic_leaf / magic_eye`。
- 掉落按生物稀有度查表，`rollMobDrops()` 返回项带 `chance` 供粒子分级。
- 初始装备：4× common Basic + 1× common Rose；背包 1× common Basic。
- 超长蜈蚣（`CHAIN_LONG_DROPS`）每节独立掷骰，只掉 Basic，不进掉落表。

## 9. 花瓣能力与生物特性

### 9.1 PetalFX

- 注册 `PetalFX.register(slug, { detect, start, update, draw, passive, tick })`。
- 主动形态在 reload 完成并弹出到轨道后跑 `detect`，命中后由 `update` 驱动。
- 被动形态每帧 `tick`，不接管位置、不跳过战斗。
- 物理能力：`trait`、`canDetach/detach`、`flightOf/ttlOf`、`onHit`、`canAttract`。
- 能力字段声明在 `data.js` 的 `PETAL_TRAITS`，注册项 `traits` 只是可选覆盖。
- `bonus(type, rarity)` 返回 `{ rotSpeed, reach, sight }`，`Player.recompute()` 只求和。
- 装备型饰品（`accessory`）不进轨道、无装填、不参与战斗；`drawAccessory` 可接管绘制。
- `artVariant` / `artOverlay` 按 `svgId` 改写素材与补画可动部件，卡面与世界共用。

### 9.2 轨道

花瓣轨道 = 解析公转 + 残差弹簧：先按 `rotMax × ROT_SCALE` 把花瓣整体搬运同一角度，
弹簧只修残差。这样轨道半径严格等于 `reach`，与转速无关。

### 9.3 MobAI

- 注册键为 `type.slug`，定义包含 `init / create / step / notifyMoved / facing / speedLimit / onHurt`。
- 管线：`step` 取移动欲望 → `limitSpeed` → 阻尼 → `moveEntity` → 撞墙回馈 → `notifyMoved`。
- 内置：`wander`（默认）、`bee`（S 型）、`centipede`（连续弧线）。
- 蜈蚣：追击/避墙最小转弯半径 = 1 倍单节直径；游荡为大半径长弧；与墙保持 1 瓦片。
- 寻路只看 `walkR`：`MobAI._util.steer` 用前方 0.9 格采样，缓存偏转角 0.3s。
- 新增生物：`MOB_TRAITS` 声明体型与速度倍率，需要行为时注册 AI，否则用 `wander`。

### 9.4 MobFX 与大招

- 物种在 `MobFX.register('slug', {...})` 声明一次，AI、`Mob`、服务端、客户端全部向引擎查询。
- 大招仅 Super / Eternal 触发，每 1000~1500 tick 一次，持续结束后恢复正常 AI。
- 调度在 `MobAI._ultimateOf / _ultimateStep`，行为由物种定义 `start / during / end`。
- 产出走服务端权威：引擎只写请求字段，`LocalServer` 消费并生成场地实体。
- 蜘蛛：原地自转 3 秒 2 圈并补步态，自转 3 圈后生成半径 2 倍的同级蛛网。

## 10. 地图与渲染

- `GARDEN_TILE = 288`；`WORLD_R = 1125`；`SPEED_SCALE = 5`；`PLAYER_BASE_SPEED = 232`。
- `loadGardenData()` 读取 `garden.tmj` 与引用的 `.tsj`，支持压缩层与 Tiled 翻转位。
- 碰撞：tileset `objectgroup` 多边形归一化 + 瓦片遮罩。
- 相机锁定玩家并夹紧地图边界；抖动 `HURT_SHAKE = 5.98`，按 `dt*30` 衰减。
- 渲染顺序：草地 → 瓦片 → 地面卡/掉落粒子/掉落卡 → 传送标记 → 尸体 → 生物（按 y 排序）
  → 花瓣光环粒子 → 活玩家（花瓣在其内部绘制）→ 普通粒子/飘字 → 调试 → 小地图。
- 视口裁剪：先筛可见集合再按 y 排序；屏幕外余量按半屏。
- 小地图 3 档，`M` 切换；生物点仅在 F3 打开时绘制。第 1 档（局部）的边长与覆盖瓦片数随
  Antennae 视野按 `1/camZoom` 同步放大（量化到 0.05 档后复用同一套 0.6s 过渡），悬浮热区跟随。
- 复活落点 `map.checkpointSpawnPoint(cp, r)` 在检查点矩形内随机取 `canStandAt` 为真的位置，
  失败时网格扫描，最后才用中心 + 碰撞推离。
- 蜘蛛本体素材由 `SpiderGait.bodyUrl()` 去掉腿部路径后缓存，红闪与步态同源。

## 11. UI

- `UI.init()` 在 `#ui` 中创建所有元素；`index.html` 不写死 HUD。
- 背包、图鉴、设置是独立窗口；`Escape` 只退出聊天输入。
- 快捷栏：主槽 `slots` + 副槽 `subSlots`；点击同列互换；`1..9,0` 换列；`R` 整行交换。
- `CardRenderer`：稀有度外框 + 内板，名称按 i18n 实时绘制，`drawReload` 扇形、`drawHpShadow` 血量阴影。
- 聊天四频道 `local/squad/guild/whisper`，只有 Local 可发送；系统消息红色。
- 聊天指令：`/local /global /map /guild /squad /whisper(/w) /reply(/r) /help /rot-speed /speed
  /print-players /unblock /unblock-all /give /tp /sure /init /resphere /summon /kill /kill-mob`。
- `/summon <mob_id> <rarity>[<k=v,...>] <count>`，多节生物支持 `type=normal|long`。
- 悬浮框只显示存在的属性；生物属性：Health / Damage / Armor / Poison（总量 + 每秒）。
- 触控层只对粗指针设备创建；摇杆写 `game.touchDir`，`A`/`B` 写 `game.keys.mouse1/2`。
- 卡牌拖拽走 Pointer Events，按 `pointerId` 过滤多指；卡面与卡槽 `touch-action: none`，
  `.win-body` 用 `pan-y`；800ms 内忽略合成 mouse 事件；`pointercancel` 视同取消。
- Boss 条只显示 `eternal` / `super`，Eternal 优先；屏幕矩形外扩 150% 内可见；
  内条与主角血条同口径，`BAR_K = 0.7`；名称与稀有度用实测 ascent/descent 定位；
  显示/隐藏/换位由阻尼驱动，隐藏时保留到动画结束。

## 12. 代码约定

- 经典脚本共享全局作用域：顶层函数/常量不得重名；新增脚本同步 `index.html` 与 `?v=`。
- 中文注释；每个事实只写一处，最近使用处优先。
- 注释只写当前功能与难以直观理解的约束，不写改动过程、旧实现对比或调试经历。
- 数值来源优先放进数据表或常量表，不在业务代码里写字面量。
- 修改后运行 `python dev/check_versions.py`，并在本地服务器手测核心流程。

## 13. 改动后自检

- [ ] 新增实体：`spawn` → 每帧 `tickEntity`/`sweep` → `despawn`，渲染用 `EntityFX.draw`。
- [ ] 新增表现字段：只在 `FX_FIELDS` 加一行。
- [ ] 新增同步状态：进快照并由客户端镜像，不在两端各维护一份。
- [ ] 新增场地实体：权威 `server.fields`，客户端只读 `netWebs`。
- [ ] 新增系统步骤：加入 `STEP_SYSTEMS` 并写同名 `sysXxx(dt)`。
- [ ] 新增文案：写 `js/i18n-extra.js`，不改官方语言包。
- [ ] 新增数值：放数据表或常量表，并确认悬浮框显示口径。
- [ ] 改过的脚本 bump `index.html` 的 `?v=`。
- [ ] `python dev/check_versions.py` 通过，控制台无报错。
