# florr2 项目记忆

> 给后续开发者 / AI 的项目上下文。改代码前先读本文件；结构、约定或玩法有明显变化时同步更新。
> 最后核对：2026-10（对应 `Commit 13 fix5`，main 分支）

## 1. 项目定位

- **florr.io 的浏览器端复刻（非官方）**，当前只做 **Garden** 一张图。
- 纯前端：`HTML + CSS + 原生 JS + Canvas 2D + DOM 覆盖层`。
- **没有构建步骤、没有 npm 依赖、没有 package.json、没有测试和 lint**。改完直接在浏览器里手动验证。
- 入口是根目录 `index.html`。**必须用本地 HTTP 服务器打开**：地图数据 `assets/static/maps/garden.tmj` 和 tileset 是 `fetch()` 加载的，`file://` 会失败。
- 仓库：`https://github.com/VP-xudon/florr2`，默认分支 `main`。
- 代码注释、提交说明、文档以中文为主；界面文本通过 i18n（默认 `en_US`，内置 `zh_CN`）。
- 素材来自 florr.io 官方 CDN / 社区镜像，来源与许可见 `SOURCES.md`。

## 2. 运行与调试

```powershell
# 在项目根目录启动静态服务器（任选其一）
python -m http.server 8000
# 然后打开 http://localhost:8000/
```

- 仅支持 `?hp=N` 一个 URL 调试参数（例如 `?hp=100000`），会同时设置当前血量和血量上限；非法值忽略。
- 语言、键盘移动、调试模式已移到游戏内 **设置窗口**，存 Cookie（`florr_settings`），不再用 URL 参数。
- 浏览器控制台可用 `window.__game` 访问 Game 实例；`window.__queryParams` 是解析后的查询参数；`window.__debug` 是调试模式开关。

### 自测（Agent 也可独立执行）

```powershell
python dev/selftest.py                       # 起 8080 + 无头 Chrome/Edge(CDP)，断言 + 性能
python dev/selftest.py --json dev/baseline.json     # 存基线
python dev/selftest.py --baseline dev/baseline.json # 与基线对比 p95
python dev/selftest.py --mode dump                  # 回退路径（virtual-time，计时不可信）
python dev/check_versions.py                        # 静态检查：引用/重名/i18n/版本号
```

- 页面自检只在 `?selftest=1` 时由 `main.js` 动态加载 `js/selftest.js`，正常运行零成本。
- 断言覆盖：引导就绪、移动、快照同步、击退守恒、装填暂停跨端一致、预测偏差、重生后花瓣世代号、Leaf 持续回血、多体数量数据化、复活点区域内随机且可站人、多节生物用本节轮廓。
- 性能数据来自 `Game.stepFrames` 固定步长回放，多轮取中位数；headless 噪声较大，只用于相对比较。
- `?selftest=1` 也可直接在真浏览器打开，控制台/页面底部会留下 `#selftest-result`（JSON）。

## 3. 目录与文件职责

| 路径 | 职责 |
|---|---|
| `index.html` | 唯一页面；按固定顺序同步加载脚本；所有脚本/样式带 `?v=N` 缓存版本号 |
| `css/style.css` | 全部样式（HUD、背包、图鉴、聊天、设置、死亡界面等） |
| `js/main.js` | 启动引导：构造资源清单 `ASSET_LIST`、解析参数、`loadGardenData()`、`new Game()`、后台加载所有 SVG，全部完成才撤加载蒙版 |
| `js/util.js` | `TAU`/`clamp`/`rand`/`damp` 等数学工具、`Settings`（Cookie）、`fmtNum`、`emptySlots`、**`ASSET_VER`** |
| `js/assets.js` | `SpriteStore`：SVG 加载、离屏预渲染、固定裁剪框、白色/红色剪影、图案包围盒、**碰撞轮廓多边形**（`CONTOUR_N=96`） |
| `js/lang.js` | `I18N`：语言包注册/切换、`t/tf/opt`、`{#A#B}` 格式 DSL、缺失键回退英文并显式显示 `<key>` |
| `js/data.js` | 数据层：`RARITIES`、由 `window.REGISTRY` 构建 `PETAL_TYPES`/`MOB_TYPES`、掉落表、难度→稀有度、初始装备、地图生成区解析 |
| `js/cards.js` | `CardRenderer`：稀有度双色圆角卡面、花瓣图形 + i18n 名称、多体花瓣布局、装填扇形阴影、血量阴影、卡牌画布池 |
| `js/ui.js` | UI 门面：窗口骨架、设置、背包/图鉴渲染、卡槽与装填驱动（`UI` 对象主体） |
| `js/ui/tooltip.js` | 悬浮框：卡牌详情 canvas + 简易按钮提示（`Object.assign(UI, {...})` 挂回 UI） |
| `js/ui/drag.js` | 拖拽、飞卡、吸附与统一幽灵动画 |
| `js/ui/minimap.js` | 小地图三档模式与平滑过渡 |
| `js/map.js` | 读取 `garden.tmj` + `.tsj`、Tiled 瓦片/翻转/对象层解析、碰撞（瓦片遮罩 + 多边形）、检查点、生成区、瓦片渲染、小地图位图 |
| `js/ai.js` | `MobAI`：只输出“移动欲望”，不直接改坐标；随机游走 + 仇恨/追击（`step/notifyMoved/facing`） |
| `js/petal-effects.js` | `PetalFX`：花瓣特殊效果注册引擎，按 `card.type.slug` 匹配（如 `rose`），在花瓣上轨后每帧 `detect`，可 `heal/consumePetal` |
| `js/sim/constants.js` | 模拟层常量与纯规则（`InvulnFX`、击退份额、花瓣/花朵数值），无 DOM |
| `js/sim/physics.js` | `physicsPush`、`moveEntity`、击退冲量与衰减，无 DOM |
| `js/sim/mob-shape.js` | 生物视觉尺寸表与 SVG 轮廓碰撞数学（`mobHitTest` / `mobShapeNearest`） |
| `js/sim/player.js` | `Player`：移动、装填、花瓣轨道、无敌、死亡与 `resetForSpawn` 唯一重置入口 |
| `js/sim/mob.js` | `Mob`：AI 驱动、血量、表现计时、绘制 |
| `js/sim/drops.js` | `DropCard` 与掉落卡面缓存 |
| `js/render/render-util.js` | 通用绘制工具（颜色、圆角、精灵、血条），全项目唯一 `roundRectPath` |
| `js/render/fx.js` | `DropSpark` / `Particle` / `DamageText` |
| `js/entities.js` | **空壳**：实体已拆分到 `js/sim/*` 与 `js/render/*` |
| `js/net/protocol.js` | 传输协议与生成参数（`SNAP_HZ`、密度、休眠半径等），可在 Node 加载 |
| `js/net/server.js` | `LocalServer` 权威模拟世界 + `handleRequest` 请求分发，无 DOM |
| `js/net/client.js` | `Net` 接口 + `LocalNet` + `WebSocketNet` 骨架（连接失败自动回退本地） |
| `js/net.js` | **空壳**：网络层已拆分到 `js/net/*` |
| `js/selftest.js` | `?selftest=1` 时动态加载：断言 + 性能基准，结果写回 DOM |
| `dev/selftest.py` | 自测驱动：起静态服务器 + 无头 Chrome/Edge（CDP），解析结果并给退出码 |
| `dev/check_versions.py` | 静态检查：引用是否存在、跨文件顶层重名、i18n 键、版本号提醒 |
| `js/chat.js` | 全局聊天：四频道标签、漂浮消息、指令解析与本地实现、`/tp` 标点确认 |
| `js/game.js` | `Game`：主循环、输入、相机/渲染、快照镜像、事件表现、背包/装备/掉落拾取、小地图、调试绘制 |
| `assets/registry.js` | **数据单一来源**（约 198KB），由 `scripts/build_manifest.py` 生成，也可手改；`assets/registry.js.bak` 是备份 |
| `assets/i18n/<code>/<code>.js` | 官方语言包（`window.I18N_EN` / `window.I18N_ZH_CN`），`lang.js` 注册；同目录 `.txt` 是抓取源 |
| `assets/lang/en.js` | 旧版命名空间包（`ui.*` 等），属遗留/兼容文件，新文本不要往这里加 |
| `assets/mob-shapes.js` | 离线预计算的生物碰撞轮廓（`tools/gen_mob_shapes.py` 生成） |
| `assets/petal-metrics.js` | 卡面布局参数（`vb/t/sw`），运行时不做测量 |
| `assets/static/maps/*.tmj` | 22 张官方地图；运行时只用 `garden.tmj` |
| `assets/static/maps/garden.json` / `garden.js` | `scripts/build_map.py` 生成的烘焙产物，**运行时不用**（运行时直接读 tmj） |
| `scripts/` | 资源抓取、注册表生成、地图烘焙、i18n 抓取、校验脚本 |
| `tools/` | 离线图像处理：SVG 裁剪、碰撞轮廓、位图转矢量 |
| `.codebuddy/` | 历史 AI 助手的计划/临时脚本/部署脚本，**不属于运行代码** |

根目录的 `*.PNG/webp` 是 UI/卡面参考图；`_tmp_bbox.py`、`_tmp_svg.py` 是临时脚本。

## 4. 启动顺序与全局对象

`index.html` 中的脚本顺序不能随意调整，存在硬依赖：

```
util.js → assets.js → i18n(en_US/zh_CN) → lang.js → assets/lang/en.js
→ mob-shapes.js → registry.js → data.js → petal-metrics.js → cards.js
→ ui.js → ui/tooltip.js → ui/drag.js → ui/minimap.js
→ map.js → ai.js → petal-effects.js
→ sim/constants.js → render/render-util.js → sim/physics.js → sim/mob-shape.js
→ sim/player.js → sim/mob.js → sim/drops.js → render/fx.js → entities.js(空壳)
→ net/protocol.js → net/server.js → net/client.js → net.js(空壳)
→ chat.js → game.js → main.js
```

关键点：

- `lang.js` 必须在 `data.js` 之前：`RARITIES`/花瓣名在加载时就要取译文。
- `registry.js` 必须在 `data.js` 之前：`data.js` 用它构建类型表。
- `entities.js` 依赖 `MobAI`、`PetalFX`；`game.js` 依赖几乎所有模块。
- `main.js` 最后执行 `boot()`：`UI.init()` → `loadGardenData()` → `Game.init()` → `Game.start()` → 后台加载素材。
- 素材全部加载完才 `UI.hideLoading()`；20 秒未完成显示慢加载提示但继续等。
- 主要全局：`RARITIES`、`RARITY_ORDER`、`PETAL_TYPES`、`MOB_TYPES`、`PETAL_BY_ID`、`MOB_BY_ID`、`I18N`、`SpriteStore`、`CardRenderer`、`UI`、`PetalFX`、`InvulnFX`、`MobAI`、`Chat`、`Settings`。

## 5. 核心架构

### 5.1 主循环

`Game.start()` 用 `requestAnimationFrame` 驱动；`dt` 上限 0.05s。`Game.update(dt)` 顺序：

1. 读输入，推导移动方向与 `mode`（`normal/reach/detect`）。
2. **本地玩家预测**：`player.update(dt, dir, map, mobs)`，手感零延迟。
3. 上行 `loadout` + `input`，调用 `net.step(dt)` 推进服务端并收快照/事件。
4. `_tickMobViews(dt)`：生物视图按快照插值 + 动画计时。
5. 玩家与生物按质量/动能推挤（`physicsPush`）。
6. 死亡界面、仇恨清理、地面卡/掉落物/粒子/飘字更新。
7. 相机夹紧到地图边界（不越界）、屏幕抖动衰减、`updateHUD()`。

### 5.2 服务端权威 + 客户端预测（`net.js`）

- `Net` 是接口；`LocalNet` 是进程内实现，内部持有一个 `LocalServer`。
- **权威状态**（生物生成/移动/碰撞/战斗/击退/聊天路由）在 `LocalServer`；**本地玩家**在客户端预测，服务端跑同一套物理做校验。
- 快照频率 `SNAP_HZ = 25`（`SNAP_DT = 1/25`），与战斗固定步长 25 tick/s 一致。
- 上行：`{t:'input', input:{dx,dy,mode}}`、`{t:'loadout', slots}`、`{t:'respawn'}`、`{t:'chat', ...}`。
- 下行：`{t:'snap', snap}`、`{t:'evt', ev}`。
- 快照含：`player`（位置/血量/无敌/死因/受伤红闪等）、`petals`（按 `slot|sub|gen` 定位的血量/碎裂状态）、`ents`（全量生物，含表现层计时）。
- 事件类型：`dmg`（飘字）、`kill`（图鉴 + 掉落）、`hurt`（玩家击退份额 + 屏幕抖动）、`chat`/`sys`（聊天）、`respawned`/`teleported`（同步预测副本与相机）。
- 客户端差分镜像：新 `netId` 建视图 `Mob`，消失的播放退场后回收；`px/tx/blend` 做插值。
- 远处生物休眠：`MOB_ACTIVE_R = 2200`，超出不跑 AI/物理；全图人口仍下发（小地图可见）。
- 换成真实网络时：新增一个 `Net` 子类（WebSocket）即可，客户端代码不用改。

### 5.3 实体层（`entities.js`）

- `Player`：位置/朝向/血量/等级、`slots`（主槽）/`subSlots`（副槽）/`invBar`（临时物品栏）/`backpack`、`reload` 装填状态、花瓣实体 `petals`、`recompute()` 重算属性。
- `Mob`：按稀有度取 hp/dmg/armor/exp；视觉直径决定碰撞半径；`shape/hull` 是 SVG 轮廓；`weight` 按直径²（障碍型 ×5）；`threat` 仇恨表；`topThreat()` 中 Honey 强制优先。
- **碰撞轮廓只认 `Mob._ensureShape()`**：键 = `'mob' + (artSvg || svg)`。多节生物（蜈蚣）头节 `12_h` / 身体节 `12_b` 各用本节贴图，**绝不回落到整条 `12.svg`**（整条外形套在单节上又长又大、还会把触角算进判定）；客户端视图与权威副本走同一个方法，`r` 也由同一份轮廓的等面积圆算出。
- `Card`、`DropCard`：地面/背包卡；`DropCard` 支持堆叠、飞向玩家拾取、Ultra+ 持续冒粒子。
- `DamageText`：Q 弹飘字，颜色区分伤害/治疗（`HEAL_TEXT_COLOR = #ff94c9`）。
- `InvulnFX`：多来源无敌（绝对到期时间），出生 3 秒；白晕 + 金色血条；无敌期完全免伤。
- 击退按稀有度分配份额（`KNOCKBACK_SHARE`），总位移 `FLOWER_KNOCKBACK = 0.3 × 主角直径`。
- 碰撞：生物用 SVG 轮廓多边形（`contourFromGrid`），墙体用瓦片遮罩/多边形；未就绪时退化为圆。

### 5.4 数据层（`data.js` + `registry.js`）

- `RARITIES` 共 9 档：`common → unusual → rare → epic → legendary → mythic → ultra → super → eternal`（无 `unique`；个别覆盖表里会出现但不在主序列）。
- `registry.js` 里 **花瓣 1..94 为真实、95..116 为二创；生物 1..83 为真实、84+ 忽略**。二创/缺名项不进入游戏，登记到 `NEEDS_MANUAL`。
- **当前真正启用的花瓣 8 种**（`ENABLED_PETAL_SLUGS`）：`basic, light, rose, stinger, pollen, honey, peas, leaf`。其余 registry 数据保留但不加载。
- **当前真正会生成的生物 3 种**（`SPAWNABLE_MOB_SLUGS`）：`ladybug, bee, centipede`；地图生成区里的 `garden` 组展开为这几种。其他生物可用 `/summon` 手动召唤调试。
- 花瓣 key 是 `'p' + id`（如玫瑰 `p5`），`slug` 才是 i18n/特效匹配用的 `rose`。
- 掉落：按生物稀有度查表，`rollMobDrops()`；初始装备 = 4× common Basic + 1× common Rose，背包只有 1× common Basic。
- 难度→稀有度用 S 型曲线（`RARITY_DIFF_T`）；生成区来自 `garden.tmj` 的 `spawn_mobs` 对象层。

### 5.5 地图与渲染（`map.js` / `game.js`）

- `GARDEN_TILE = 288`（原 384 × 0.75）；`WORLD_R = 1125`；`SPEED_SCALE = 5`；`PLAYER_BASE_SPEED = 232`。
- `loadGardenData()` 读 `garden.tmj`，再读引用的 `.tsj`；支持 gzip/zlib 压缩层、Tiled 翻转位（H/V/D）、对象层生成区。
- 碰撞：tileset 的 `objectgroup` 多边形 → 归一化；烘焙瓦片遮罩在 `garden.json`（运行时主要用 tmj 的 shapes/遮罩逻辑）。
- 相机锁定玩家并夹紧到地图边界；屏幕抖动 `HURT_SHAKE = 5.98`，按 `dt*30` 衰减。
- 渲染顺序：草地底色 → 瓦片 → 地面卡/掉落物粒子/掉落卡 → `/tp` 标记 → 尸体 → 生物（按 y 排序）→ 活玩家 → 粒子/飘字 → 碰撞箱调试 → 坐标/边缘指示/小地图。
- 视口裁剪给屏幕外 2 倍余量；大生物按半径判定，避免贴边消失。
- 小地图 3 档，`M` 切换；位图缓存。
- **复活落点**：`map.checkpointSpawnPoint(cp, r)` 在检查点【整片矩形区域内随机】取一个
  `map.canStandAt(x, y, r)` 为真的位置（点不在实心瓦片 + 玩家半径内不压墙），
  **不再优先生效区域中心**；随机采样失败时网格扫描兜底，最后才用中心 + 碰撞推离。
  客户端开局与 `/tp` 判定复用同一套 `canStandAt`。

### 5.6 UI / 卡牌 / 聊天

- `UI.init()` 在 `#ui` 覆盖层里动态创建所有元素；`index.html` 不写死 HUD。
- 背包/图鉴/设置是独立窗口；`Escape` 只退出聊天输入，窗口用关闭按钮或再次点图标。
- 快捷栏：主槽 `slots` + 副槽 `subSlots`；点击主/副槽同列互换；`1..9,0` 直接换列；`R` 整行交换主/副。
- `CardRenderer`：稀有度外框深色 + 内板亮色，花瓣图形去名称、名称实时按 i18n 绘制（Ubuntu 800，白字黑描边）；`drawReload` 装填扇形、`drawHpShadow` 花瓣血量阴影。
- 聊天：四频道 `local/squad/guild/whisper`，**只有 Local 可真正发送**；非输入态消息漂浮后渐隐；红色字体一律表示系统消息。所有消息经 `Net` 上行、由服务端路由后下行。
- 聊天指令：`/local /global /map /guild /squad /whisper(/w) /reply(/r) /help /rot-speed /speed /show-coord /pending crash /print-players /unblock /unblock-all /give /tp /sure /init /resphere /summon /kill /kill-mob`。

### 5.7 花瓣特效引擎（`petal-effects.js`）

- 注册：`PetalFX.register(key, { detect(ctx), start(ctx), update(ctx,dt), draw?(ctx2d,ctx) })`，`key === card.type.slug`。
- 只在该花瓣 **reload 完成、弹出到轨道后** 才跑 `detect`；命中后由 `update` 驱动，激活期间跳过轨道弹簧与普通战斗。
- **被动形态**：`PetalFX.register(key, { passive: true, tick(ctx,dt) })` —— 每帧都跑，但不接管位置、不跳过战斗。
- `ctx` 提供 `player/petal/stats/dt`、`onOrbit()`、`heal(n)`、`consumePetal()`、`floatText()`。
- 现有实现：`rose`（主动：血量不满 → 1.5s 飞向主角回血 → 退场）；`leaf`（被动：按 `heal/s` 连续回血，与碰撞/伤害并存）；`PetalFX.textSink` 把治疗数字接到 `DamageText`。
- `honey / peas / pollen` 的物理与运动能力**不走 PetalFX**，而是 `data.js` 的 `PETAL_TRAITS` 数据字段（`hardCollide` / `attractMobs` / `holdReloadUntilDeath` / `launch` / `detachAfter`）：行为层只读字段、不判断 slug。新增同类花瓣只需在 `PETAL_TRAITS` 声明。

## 6. 关键数值

| 常量 | 值 | 含义 |
|---|---|---|
| `FLOWER_BASE_HP` | 100 | 花朵基础血量（装花瓣不再加 maxHp） |
| `FLOWER_BODY_DMG` | 20 | 花朵本体伤害 |
| `FLOWER_SPAWN_INVULN` | 3 s | 出生/重生无敌 |
| `FLOWER_KNOCKBACK` | 0.3 | 击退总位移（× 主角直径） |
| `SNAP_HZ` | 25 | 快照/战斗固定步长 |
| `MOB_ACTIVE_R` | 2200 | 生物激活半径，超出休眠 |
| `SPAWN_INTERVAL` | 0.1 s | 服务端补怪间隔 |
| `CP_RESPAWN_STAYS` | 3 | 每个检查点保底复活次数 |
| `DROP_PICK_R` | 2 | 拾取半径 = 2 × 玩家直径 |
| `ASSET_VER` | 15 | 素材内容版本（改素材时 +1） |
| `RECONCILE_RATE` / `RECONCILE_SNAP` | 14 / 120 | 预测位置向权威位置收敛速率（每秒）与硬吸附阈值（px） |

生物速度口径：追击 = 0.90×玩家最高速（蜜蜂 1.05×）；游荡 = 0.95 × 0.3~0.5 随机 × 0.75（蜜蜂 ×1.2），只有蜜蜂走 S 型。

## 7. 代码约定（重要）

1. **缓存版本号**：修改 `js/*.js` 或 `css/style.css` 后，把 `index.html` 里对应文件的 `?v=N` 加 1（只加改到的文件）。修改 `assets/` 下图片/SVG 内容但文件名不变时，把 `js/util.js` 的 `ASSET_VER` 加 1。历史上多次因为忘记 bump 导致“改了没生效”。
2. **i18n**：所有用户可见文本必须走 `I18N.t('...')`，不要在代码/HTML 硬编码中文或英文。新 key 同时补 `en_US` 和 `zh_CN`。缺失键会显示 `<key>`，这是故意的。
3. **编码/换行**：JS/HTML/CSS/Markdown 都是 **UTF-8 无 BOM**；`.js/.html/.css` 使用 **CRLF**，`.md` 使用 LF。中文注释不要转码。
4. **不要引入构建链/依赖**：保持“打开 HTML 就能跑”的零依赖形态。
5. **数据优先改 registry**：`assets/registry.js` 是数据源；能改数据就不要在代码里写死。它可由脚本重新生成，手改后注意不要被覆盖。
6. **资源来源**：素材来自官方 CDN；地图/tileset 官方 403，使用仓库内快照。不要重复抓取覆盖。
7. **调参位置**：模拟层常量集中在 `js/sim/constants.js`（击退/花朵/步长）与 `js/net/protocol.js`（快照/生成参数）；数据规则在 `data.js`；UI 动画在 `ui.js/cards.js`。
8. **临时文件**：`.codebuddy/`、根目录 `_tmp_*.py`、参考图不属于运行代码，不要随意删除用户内容；新临时文件不要提交。

## 8. 资源与数据管线

```powershell
# 重新生成 registry.js（读取 scripts/petals_real.json、mobs_real.json）
python scripts/build_manifest.py

# 从 garden.tmj 烘焙 garden.json / garden.js（含瓦片碰撞遮罩）
python scripts/build_map.py

# 生成生物碰撞轮廓 + 旋转轴心 assets/mob-shapes.js（主体部件，自动排除触角/腿/花纹）
python tools/gen_mob_shapes_vector.py

# 裁剪/处理生物 SVG
python tools/crop_mob_svgs.py

# 抓取官方素材 / i18n（需要网络）
powershell -ExecutionPolicy Bypass -File scripts/fetch-assets.ps1
python scripts/fetch_i18n.py

# 素材健康检查（数量、平均大小、占位图数量）
powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
```

已知占位素材：少数已下架生物 id（如 13/15/17/35/57/60/62/64/66/69）官方 CDN 返回 404，文件是灰色圆 + “N/A” 的合法占位 SVG，不是真实美术。

## 9. 常见改动路径

**新增一种花瓣**
1. 确认 `registry.js` 有真实数据，且 id 未标记二创。
2. 在 `data.js` 的 `ENABLED_PETAL_SLUGS` 加入 slug；必要时补 `PETAL_RARITY_OVERRIDES` / `PETAL_SUB_COUNT`。
3. 在 `petal-effects.js` 用 slug 注册特殊效果（普通伤害花瓣不需要）。
4. 补 i18n `Petals/<slug>/Name`、`Description`。
5. bump 改到的脚本版本号。

**新增一种生物**
1. `registry.js` 有该生物数据；补/确认 `MOB_TYPES` 构建结果。
2. 加入 `SPAWNABLE_MOB_SLUGS`，并在 `MOB_GROUPS` 或地图生成区里配置权重。
3. 在 `ai.js` / `Mob` 里补行为（追击、S 型、障碍等）；掉落表在 `data.js`。
4. 视觉尺寸 `MOB_SIZE_SCALE`、贴图朝向 `MOB_ART_ROT`、碰撞轮廓 `mob-shapes.js`。
5. i18n `Mobs/<slug>/Name`；bump 版本号。

**改 UI 文本/布局**：`ui.js` 建 DOM + `css/style.css` 写样式；卡面在 `cards.js`；不要往 `index.html` 加静态 HUD。

## 10. 已知限制 / 待办

- **Net 已抽象但未做真联机验证**：协议/服务端/传输已分层，`WebSocketNet` 骨架在 `js/net/client.js`（连接失败自动回退 `LocalNet`）；本机没有 Node 环境，端到端联机未测。`LocalServer.handleRequest` 是请求入口，`LocalNet.requestSync` 仅本地可用。
- **快照仍是每帧全量**（未池化/未降频）：`LocalNet.step` 每帧推进模拟并立刻投递快照，本地零延迟优先；`SNAP_DT` 只用于客户端插值步长基准。真服务器应改为按 `SNAP_HZ` 投递 + 对象池。
- **生物实体数远超 `GLOBAL_MAX_MOBS`**：上限按"只"统计，而一条蜈蚣会展开成多节实体（实测约 4500~4900 个视图实体）。
- 只有 Garden 一张图；`/init <map>` 只能初始化当前地图，不能切图（其余 `.tmj` 未被加载）。
- 只有 8 种花瓣（`basic/light/rose/stinger/pollen/honey/peas/leaf`）、3 种可生成生物（瓢虫/蜜蜂/蜈蚣）；大量 registry 数据尚未接入玩法。
- 聊天只有 Local 可用；Squad/Guild/Whisper 是 UI + 提示占位。没有真实多人/账号系统。
- 没有存档：除设置 Cookie 外，装备/图鉴/进度都在内存，刷新即重置。
- 没有音效/音乐；没有移动端触控适配（鼠标/键盘为主）。
- `assets/lang/en.js` 是旧命名空间，和新 i18n 并存，新增文本不要用它。
- 代码仍有几个大文件（`game.js` ~64KB、`net/server.js` ~61KB、`ui.js` ~54KB、`sim/player.js` ~54KB、`assets/registry.js` ~198KB）；改动时尽量局部化，避免整文件重排。

## 11. 改动后自检清单

- [ ] 浏览器通过本地 HTTP 打开，控制台无报错。
- [ ] 改过的 JS/CSS 已 bump `index.html` 的 `?v=`；改过素材已 bump `ASSET_VER`。
- [ ] 新文本同时有 `en_US` / `zh_CN` 键。
- [ ] 战斗相关改动确认服务端权威副本同步（否则客户端表现正常但服务端不一致）。
- [ ] 新增/修改实体确认快照字段下发（`hurtT/flash/squash/deathTimer/...`），否则客户端看不到表现。
- [ ] 改动 `.js/.html/.css` 后仍是 UTF-8 无 BOM + CRLF。
