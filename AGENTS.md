# florr2 项目说明

> 面向后续开发者与 AI 的项目上下文。结构与约定变化时同步更新本文件。

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
- 热键：`F3` 调试屏幕、`C` 碰撞箱（屏幕打开时）、`M` 小地图档位、`Z` 背包、
  `R` 主副槽整排互换、`1~0` 换列。
- 语言、键盘移动、调试模式在游戏内设置窗口，存 Cookie `florr_settings`。
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
| `js/ui/bossbar.js` | 顶部 Boss 血条（仅 `eternal` / `super`） |
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
- `main.js` 末尾 `boot()`：`UI.init()` → `loadGardenData()` → `Game.init()` → `Game.start()` → 后台素材。
- 素材全部完成才 `UI.hideLoading()`；20 秒未完成显示慢加载提示但继续等待。

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
- 快照频率 `SNAP_HZ = 25`，`LocalNet.step` 按 `SNAP_DT` 累加并保留余量后下发。
- 快照内容：`player`、`petals`（按 `petalNetKey` 定位）、`ents`（全量生物 + `FX_FIELDS`）、
  `webs`、`projectiles`。
- 事件：`dmg`、`kill`、`hurt`、`chat`、`sys`、`respawned`、`teleported`。
- 客户端差分镜像：新 `netId` 建视图，消失的播放退场后回收；`px/tx/blend` 插值。
- 远处生物休眠：`MOB_ACTIVE_R = 2200`，休眠个体不跑 AI/物理，但仍下发人口（小地图使用）。
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
4. 渲染只读 `visual()` 或直接用 `EntityFX.draw`，不自行乘入场/退场曲线。
5. 退场计时每帧推进；快照中消失的实体必须补 `despawn`。
6. 可复活的实体用 `createEntitySet.reclaim` 取消离场并重新入场。

例外：

- 主角不在容器里，但 Q 弹、红闪、计时共用引擎。
- Hornet 弹体是母体子实体，id 为 `父 netId + ':missile:' + 序号`，不进世界人口表。
- 挂载态弹体画在父实体坐标系里，用 `visual()` + `drawHurt()`。

### 7.2 花瓣实体

- `Player.petals` 保存本世代实体；死亡的独立子体保留到复活，权威侧靠它推进
  `respawnT / holdRespawn`，客户端靠它等待快照复活。
- 退场中的实体在 `player.petalExit`，只由它计时与绘制；`Player.update` 每帧 `sweep`。
- 快照按 `(slot, sub, gen)` 匹配；`gen` 两端可能差一拍，`_netPetalFor` 有唯一记录退化匹配。
- 客户端只生成服务端确实有的实体（`_netSlotHasLive`）。
- `_snapPetals` 必须为"有卡但无实体"的槽补 dead 记录，否则客户端会留下不参与伤害的幽灵花瓣。

### 7.3 碰撞与伤害

- `Mob._ensureShape()` 是碰撞轮廓唯一建立入口，键为 `'mob' + (artSvg || svg)`。
- 多节生物头节 `12_h`、身体节 `12_b` 各用本节贴图，不回落整条外形。
- 物种可选手写 `MOB_TRAITS[slug].collider = { type:'circle', k }`。
- 蜘蛛轮廓从删除 8 条腿后的身体素材提取。
- `Mob.walkR / walkSize / walkHull` 只用于墙体与禁行地形；伤害、推挤、花瓣命中用 `r / shape / collSize`。
- 花瓣与生物的实体碰撞由 `PETAL_TRAITS[slug].solid` 决定：
  - `false`：穿过生物，重合瞬间传一次冲量（`PETAL_KB_CD`）；
  - `true`：生物被推出花瓣轮廓并沿表面摩擦，花瓣不位移。
  两种情况花瓣都不位移，伤害由 `LocalServer._combatTick` 每 tick 结算。
- 推出时保留 `PETAL_CONTACT_SKIN` 穿透量，否则下一 tick 命中判定归零。
- 花瓣吸附只对 `solid` 花瓣生效。
- 伤害唯一入口 `LocalServer._dmg(atk, armor) = max(atk - armor, 0)`，四个方向共用。
- 接触伤害每 tick 一次、一次为完整面板值，无伤害冷却与单次上限；
  只有花朵本体有 `FLOWER_HURT_INVULN` 受伤无敌帧。
- 击退是离散事件（`kbT` + `PetalFX.onHit`），一次接触传一次动能。
- 飘字按 0.12s 聚合，数值为窗口内累计。

## 8. 数据层

- `RARITIES` 九档：`common → unusual → rare → epic → legendary → mythic → ultra → super → eternal`。
- `registry.js`：花瓣 1..94 为真实、95..116 为二创；生物 1..83 为真实，84+ 忽略。
- 启用花瓣（`ENABLED_PETAL_SLUGS`）：`basic, light, rose, stinger, pollen, honey, peas, leaf,
  faster, third_eye, web, antennae, orange, missile, wax, rice, corn, wing, ant_egg`。
- Antennae 的 `sight` 为官方视野比例，相机缩放 `1/(1+sight)`；
  所有以屏幕尺寸计算视口的位置都要除以缩放值。
- 一卡多体的显示口径由 `PETAL_STAT_DISPLAY` 声明：`each` 单体值 / `total` 合计值，
  只影响悬浮框、卡面与卡槽水缸；实体结算永远用单体值。
- Orange：三实体阵型，伤害按目标上次实际受伤追加计算，上限 `Max Damage`。
- Missile：reach 保持 0.5s 后发射，直线飞行，参与实体碰撞。
- Hornet：追击速度 0.95× 玩家，尾部 Missile 为 MobFX 子实体，独立受击，消失后 0.5s 重生。
- 可自然生成生物（`SPAWNABLE_MOB_SLUGS`）：`ladybug, bee, bumble_bee, centipede, spider, hornet`。
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
- 小地图 3 档，`M` 切换；生物点仅在 F3 打开时绘制。
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
