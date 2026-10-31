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

- URL 调试参数：`?hp=N`（同时设置当前/最大血量，非法值忽略）、`?touch=1`（桌面强制显示触控摇杆/按钮）、`?selftest=1`（页面自检）。
- 游戏内热键：`F3` 调试屏幕（坐标 / 移速 / 花瓣转速 / 碰撞箱 / 引擎计数）、`C` 碰撞箱（仅 F3 屏幕打开时）、`M` 小地图档位、`Z` 背包、`R` 主副槽整排互换、`1~0` 换列。
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
- 断言覆盖：引导就绪、移动、快照同步、击退守恒、装填暂停跨端一致、预测偏差、重生后花瓣世代号、Leaf 持续回血、多体数量数据化、复活点区域内随机且可站人、多节生物用本节轮廓与贴图、F3 屏幕开关（含碰撞箱联动）、触控层在桌面不出现、触控层自缩放尺寸合法。
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
| `js/ui/touch.js` | 移动端触控层：自缩放浮动摇杆 + `A`(reach)/`B`(detect)，桌面不创建元素（`?touch=1` 可强制） |
| `js/ui/debug-screen.js` | `F3` 调试屏幕：帧/玩家/引擎/花瓣分栏，碰撞箱与小地图生物点跟着它开关 |
| `js/ui/bossbar.js` | `BossBar`：屏幕顶部 Boss 血条。只显示 `eternal` / `super`（Eternal 优先），视野 + 外扩 150% 内才出现（矩形口径 `W*0.75`），名称/稀有度居中，显示与隐藏都走 0.1~0.15s 的渐大渐小 |
| `js/map.js` | 读取 `garden.tmj` + `.tsj`、Tiled 瓦片/翻转/对象层解析、碰撞（瓦片遮罩 + 多边形）、检查点、生成区、瓦片渲染、小地图位图 |
| `js/ai.js` | **`MobAI`：注册式生物 AI 引擎**。按 `type.slug` 分派，每个物种一套独立 AI（`register/init/create/step/notifyMoved/facing/speedLimit`）；内置 `wander`（瓢虫等）、`bee`（S 型）、`centipede`（连续弧线） |
| `js/petal-effects.js` | **`PetalFX`：花瓣能力 + 特效注册引擎**。按 `card.type.slug` 匹配，负责主动/被动特效，以及脱轨（`detach`）、飞行（`flightOf`）、硬碰撞（`onHit`）、仇恨吸引（`canAttract`）等物理能力；能力字段仍由 `data.js` 的 `PETAL_TRAITS` 声明，统一走 `trait()` 读取 |
| `js/sim/constants.js` | 模拟层常量与纯规则（`InvulnFX`、击退份额、花瓣/花朵数值），无 DOM |
| `js/sim/physics.js` | `physicsPush`、`moveEntity`、击退冲量与衰减，无 DOM |
| `js/sim/mob-shape.js` | 生物视觉尺寸表与 SVG 轮廓碰撞数学（`mobHitTest` / `mobShapeNearest`） |
| `js/sim/player.js` | `Player`：移动、装填、花瓣轨道、无敌、死亡与 `resetForSpawn` 唯一重置入口 |
| `js/sim/mob.js` | `Mob`：实体与引擎管线（问 AI → 限速 → 阻尼 → 位移 → 回馈）、血量、表现计时、绘制；物种差异写在 `ai.js` 的 AI 定义里 |
| `js/sim/drops.js` | `DropCard`、掉落卡面缓存、**持续粒子时长分级**（`dropFxDuration`：≤5% 3s / <1% 6s / <0.3% 15s / <0.1% 与 Ultra+ 永久） |
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
| `js/game.js` | `Game`：主循环（含 `perf` 指标）、输入（键盘/鼠标/触控）、相机/渲染、快照镜像、事件表现、背包/装备/掉落拾取、小地图、调试绘制 |
| `assets/registry.js` | **数据单一来源**（约 198KB），由 `scripts/build_manifest.py` 生成，也可手改；`assets/registry.js.bak` 是备份 |
| `assets/i18n/<code>/<code>.js` | 官方语言包（`window.I18N_EN` / `window.I18N_ZH_CN`），`lang.js` 注册；同目录 `.txt` 是抓取源 |
| `js/i18n-extra.js` | **本项目新增文案的唯一落点**（F3 调试屏幕、触控按钮等），`I18N.addPack` 增量注册 en_US/zh_CN；官方语言包不要手改 |
| `assets/mob-shapes.js` | 离线预计算的生物碰撞轮廓 + 旋转轴心（`tools/gen_mob_shapes_vector.py` 生成，只取主体部件） |
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
util.js → assets.js → i18n(en_US/zh_CN) → lang.js
→ mob-shapes.js → registry.js → data.js → petal-metrics.js → cards.js
→ ui.js → ui/tooltip.js → ui/drag.js → ui/minimap.js
→ map.js → ai.js → petal-effects.js
→ sim/constants.js → render/render-util.js → sim/physics.js → sim/mob-shape.js
→ sim/player.js → sim/mob.js → sim/drops.js → render/fx.js → entities.js(空壳)
→ net/protocol.js → net/server.js → net/client.js → net.js(空壳)
→ chat.js → i18n-extra.js → ui/touch.js → ui/debug-screen.js → ui/bossbar.js → game.js → main.js
```

关键点：

- `lang.js` 必须在 `data.js` 之前：`RARITIES`/花瓣名在加载时就要取译文。
- `registry.js` 必须在 `data.js` 之前：`data.js` 用它构建类型表。
- `entities.js` 依赖 `MobAI`、`PetalFX`；`game.js` 依赖几乎所有模块。
- `i18n-extra.js` 必须在 `game.js` 之前：`DebugScreen.init` / `TouchCtl.init` 在 `Game.init()` 里读取这些键。
- `ui/touch.js`、`ui/debug-screen.js`、`ui/bossbar.js` 先于 `game.js` 加载，但只在 `Game.init()` 里被调用（`?selftest=1` 时才由自测驱动）。
- `main.js` 最后执行 `boot()`：`UI.init()` → `loadGardenData()` → `Game.init()` → `Game.start()` → 后台加载素材。
- 素材全部加载完才 `UI.hideLoading()`；20 秒未完成显示慢加载提示但继续等。
- 主要全局：`RARITIES`、`RARITY_ORDER`、`PETAL_TYPES`、`MOB_TYPES`、`PETAL_BY_ID`、`MOB_BY_ID`、`I18N`、`SpriteStore`、`CardRenderer`、`UI`、`PetalFX`、`InvulnFX`、`MobAI`、`Chat`、`Settings`。

## 5. 核心架构

### 5.1 主循环

`Game.start()` 用 `requestAnimationFrame` 驱动；`dt` 上限 0.25s，固定步长 `STEP = 1/60`，
**`MAX_STEPS = 3`**（一帧最多补 3 步，剩下的丢弃）。上限设 8 时，一旦掉到 8fps 就再也回不来：
每帧补满 8 步 × 12ms = 96ms，帧率锁死在个位数。改大它之前先想清楚这个正反馈。
真实帧率与每秒模拟步数写在 `perf.fps / perf.sps`（F3 显示用，别在 F3 里另算）。`Game.update(dt)` 顺序：

1. 读输入，推导移动方向与 `mode`（`normal/reach/detect`）。
2. **本地玩家预测**：`player.update(dt, dir, map, mobs)`，手感零延迟。
3. 上行 `loadout` + `input`，调用 `net.step(dt)` 推进服务端并收快照/事件。
4. `_tickMobViews(dt)`：生物视图按快照插值 + 动画计时。**屏幕外的只贴位置**（`farR = max(W,H)*0.85+260`，超出直接 `x=tx` 并跳过血条/轮廓），全图 4700 只不参与每帧动画。
5. 玩家与生物按质量/动能推挤（`physicsPush`），**先用平方距预筛**（`(m.r + p.r + 24)²`），只对可能接触的那几只调用。
6. 死亡界面、仇恨清理、地面卡/掉落物/粒子/飘字更新。
7. 相机夹紧到地图边界（不越界）、屏幕抖动衰减、F3 屏幕刷新（仅打开时，限频 5Hz）。
8. 主循环在 `update`/`render` 两侧记 `perf.updateMs / renderMs / frameMs`（F3 屏幕读它）。

### 5.2 服务端权威 + 客户端预测（`net.js`）

- `Net` 是接口；`LocalNet` 是进程内实现，内部持有一个 `LocalServer`。
- **权威状态**（生物生成/移动/碰撞/战斗/击退/聊天路由）在 `LocalServer`；**本地玩家**在客户端预测，服务端跑同一套物理做校验。
- 快照频率 `SNAP_HZ = 25`（`SNAP_DT = 1/25`），与战斗固定步长 25 tick/s 一致。
  **`LocalNet.step` 按 `SNAP_DT` 累加后再发快照**（不是每步一发）：主循环一帧最多补 3 步，
  每步全量发快照 = 每秒几十份 4000+ 对象的数组 + 客户端整套镜像，GC 会把帧率打到个位数。
  快照里的 `ents` 数组与元素对象由 `LocalServer._fillEnts()` **复用**（同步消费，不会留到下一帧）；
  客户端 `_applySnap` 的 `seen` 集合也复用（`this._seen`）。改协议时注意：谁都不能长期持有快照对象。
- 上行：`{t:'input', input:{dx,dy,mode}}`、`{t:'loadout', slots}`、`{t:'respawn'}`、`{t:'chat', ...}`。
- 下行：`{t:'snap', snap}`、`{t:'evt', ev}`。
- 快照含：`player`（位置/血量/无敌/死因/受伤红闪等）、`petals`（按 `slot|sub|gen` 定位的血量/碎裂状态）、`ents`（全量生物，含表现层计时）。
- 事件类型：`dmg`（飘字）、`kill`（图鉴 + 掉落）、`hurt`（玩家击退份额 + 屏幕抖动）、`chat`/`sys`（聊天）、`respawned`/`teleported`（同步预测副本与相机）。
- 客户端差分镜像：新 `netId` 建视图 `Mob`，消失的播放退场后回收；`px/tx/blend` 做插值。
- 远处生物休眠：`MOB_ACTIVE_R = 2200`，超出不跑 AI/物理；全图人口仍下发（小地图可见，但只有 F3 打开才画点）。
- **生物互相推挤用均匀网格宽相位**（`LocalServer.step` 第 4 步）：格距 192px，按最大半径自动扩相邻圈数，`_pseq` 序号保证每对只算一次。改造前是 O(醒着的只数²)（蜈蚣一条几十节，实测 50 万次配对/帧、`net.step` 14.7ms），改后约 6.9ms。
- 换成真实网络时：新增一个 `Net` 子类（WebSocket）即可，客户端代码不用改。

### 5.3 实体层（`entities.js`）

- `Player`：位置/朝向/血量/等级、`slots`（主槽）/`subSlots`（副槽）/`invBar`（临时物品栏）/`backpack`、`reload` 装填状态、花瓣实体 `petals`、`recompute()` 重算属性。
- `Mob`：按稀有度取 hp/dmg/armor/exp；视觉直径决定碰撞半径；`shape/hull` 是 SVG 轮廓；`weight` 按直径²（障碍型 ×5）；`threat` 仇恨表；`topThreat()` 中 Honey 强制优先。
- **碰撞轮廓只认 `Mob._ensureShape()`**：键 = `'mob' + (artSvg || svg)`。多节生物（蜈蚣）头节 `12_h` / 身体节 `12_b` 各用本节贴图，**绝不回落到整条 `12.svg`**（整条外形套在单节上又长又大、还会把触角算进判定）；客户端视图与权威副本走同一个方法，`r` 也由同一份轮廓的等面积圆算出。
- `Card`、`DropCard`：地面/背包卡；`DropCard` 支持堆叠、飞向玩家拾取；持续冒粒子的时长按**掉落概率**分级（`chance` 由 `rollMobDrops` 带上，`fxDur` 决定：≤5% 3s、<1% 6s、<0.3% 15s、<0.1% 与 Ultra+ 永久；其余只在落地炸一次）。
- `DamageText`：Q 弹飘字，颜色区分伤害/治疗（`HEAL_TEXT_COLOR = #ff94c9`）。
- `InvulnFX`：多来源无敌（绝对到期时间），出生 3 秒；白晕 + 金色血条；无敌期完全免伤。
- 击退按稀有度分配份额（`KNOCKBACK_SHARE`），总位移 `FLOWER_KNOCKBACK = 0.3 × 主角直径`。
- 碰撞：生物用 SVG 轮廓多边形（`contourFromGrid`），墙体用瓦片遮罩/多边形；未就绪时退化为圆。
- **行走碰撞箱（`Mob.walkR / walkSize / walkHull`）只用于与墙体/禁行地形**：`_ensureShape` 里把同一份凸包
  按 `min(视觉直径, 1 格瓦片 0.9 倍正方形的内接圆)` 缩小（`MOB_WALK_LIMIT_R = 0.45 × GARDEN_TILE ≈ 129.6`），
  于是任何体型的生物都能挤进 1 格宽通道。**伤害结算、被玩家推挤、花瓣命中仍用 `r / shape / collSize`，两者不许混用**；
  `moveEntity` 优先取 `walkHull + walkSize`，没有才回落 `hull + drawSize` / 圆。
- **花瓣与生物有没有实体碰撞由数据决定（`PETAL_TRAITS[slug].solid`，8 种花瓣逐个显式声明）**：
  · `solid: false`（目前除蜜以外全部）→ 穿过生物，只在重合瞬间传一次冲量（`PETAL_KB_CD` 冷却）；
  · `solid: true`（蜜）→ 生物被持续推出花瓣轮廓、并沿表面蹭走（揉搓），**花瓣自身不位移**。
  两种情况都【不位移花瓣】，伤害都由 `LocalServer._combatTick` 在重合期间每 tick 结算。
  推出时保留 `PETAL_CONTACT_SKIN` 的穿透量：推成"刚好相切"会让下一 tick 命中判定归零，
  表现就是"卡在轮廓外沿、既打不到也不再受伤"。
- **玩家/生物之间的推挤与伤害、F3 碰撞箱共用同一套几何**：`physicsPushMob(e, m)` 用生物的 SVG 轮廓
  （`mobHitTest`），只有轮廓没就绪才退回两圆。用等面积圆 `m.r` 会让玩家走进大型生物身体里（"大怪穿模"）。
- 花瓣吸附（`Player._syncPetals` 的 pull）**只对 `solid` 花瓣生效** —— 否则无实体碰撞的花瓣会被吸在
  生物轮廓外沿一动不动。
- **伤害口径只有一个入口 `LocalServer._dmg(atk, armor)` = `max(atk - armor, 0)`**：生物打花瓣、打花朵本体、
  花瓣打生物、本体打生物，四个方向全部走它。花瓣与花朵同阵营，**不允许**再出现"本体扣护甲、花瓣吃全额"这类分叉。
- **接触伤害每 tick 结算一次，一次就是【完整面板值】**：数据里的 `dmg` 直接按 tick 生效，没有伤害冷却、
  没有摊平系数、**也没有"单次受伤上限"**（贴着生物 = 25 次/秒 × (dmg − armor)，全额扣）。
  所以"伤害 ≥ 耐久"就是当 tick 直接碎：common 瓢虫 dmg 10 打 common basic hp 10、rare 瓢虫 dmg 90
  打任何低稀有度花瓣，都是**一下没**，不会"贴着磨一会"。**唯一由受击方自己节流的是花朵本体**
  （`FLOWER_HURT_INVULN` 受伤无敌帧，`Player.hurt` 里判）；花瓣与生物都没有无敌帧。
  击退是另一回事：传能仍是**离散事件**（`kbT` + `PetalFX.onHit`），一次接触只传一次动能。
  飘字按 0.12s 聚合一条（数值=窗口内真实累计），避免 25 条/秒刷屏。
- 客户端花瓣状态按 `(slot, sub, gen)` 匹配快照；`gen` 是两端各自维护的计数器，可能差一拍，
  所以 `Player._netPetalFor()` 有 `(slot, sub)` 唯一匹配的兜底，并顺手把 `gen` 对齐到服务端。
  少了这个兜底，一旦错位就会"花瓣永远满血、永远不碎"。
- **快照的 `petals` 必须覆盖"有卡但此刻没有实体"的槽位**（`LocalServer._snapPetals`）。
  花瓣被打碎后 `_destroyPetal` 只打 `dead` 标记并把该槽放进 reload，实体在**下一帧**的
  `_syncPetals` 里才被移出 `p.petals` —— 直接下发 `p.petals` 的话，"这一槽没了"只能靠
  "打碎那一帧刚好发快照"才传得到客户端（快照 25Hz vs 模拟 60Hz）。漏掉的那次客户端既不碎
  也不进装填，会一直画一片**幽灵花瓣**：画面里从生物身上飘过去，服务端却根本没有它，
  一点伤害都结算不到（"花瓣直接飘过去、和瓢虫没有任何交互"的根因）。
- **实体集合以快照为唯一真相**：`Player._netSlotHasLive()` 让客户端只生成"服务端确实有"的花瓣。
  本地 reload 计时会早一两帧跑完，那几帧里服务端还没有这片花瓣（生成出来就是上面那种幽灵，
  还会立刻被快照的 dead 记录打碎）。
- 回归断言：`fix: 花瓣命中生物并结算`（轨道环上放瓢虫，必须掉血）、
  `fix: 花瓣碎裂跨端同步`（服务端打碎后客户端必须同步消失并进入装填）。

### 5.4 数据层（`data.js` + `registry.js`）

- `RARITIES` 共 9 档：`common → unusual → rare → epic → legendary → mythic → ultra → super → eternal`（无 `unique`；个别覆盖表里会出现但不在主序列）。
- `registry.js` 里 **花瓣 1..94 为真实、95..116 为二创；生物 1..83 为真实、84+ 忽略**。二创/缺名项不进入游戏，登记到 `NEEDS_MANUAL`。
- **当前真正启用的花瓣 10 种**（`ENABLED_PETAL_SLUGS`）：`basic, light, rose, stinger, pollen, honey, peas, leaf, faster, third_eye`。其余 registry 数据保留但不加载。
- **装备加成（`PetalFX.bonus`）**：`faster` 给主角加【最大转速】（rad/s，可叠加，与装填无关），
  `third_eye` 给 reach 模式加【伸出距离】（px）。数值在 `PETAL_RARITY_OVERRIDES` 的 `rotSpeed` / `attackRange`，
  `Player.recompute()` 只做求和；`/rot-speed` 的倍率被限制在 0.1~1.0 × 当前动态最大转速。
- **花瓣轨道 = 解析公转 + 残差弹簧**（`Player._syncPetals`）：每帧先按 `rotMax × ROT_SCALE` 把花瓣
  随轨道整体搬运同一角度（零积分误差），弹簧只修"它相对应到位置的残差"。
  绝不能让弹簧直接去追一个高速旋转的目标点 —— 显式积分误差会随角速度累积成半径漂移，
  表现就是"装上 Faster 后 Third Eye 的伸距被吃掉"（两个无关系统互相干扰）。
  这样轨道半径严格等于 `reach`，与转速无关；玩家位移造成的拖尾感仍由残差弹簧给出。
- **装备型饰品（`accessory: true`）**：不进入轨道、没有装填、不参与战斗，固定在人物额头并随朝向转动
  （`Player._drawAccessories`）；`stackable: false` 的花瓣只有最左一格生效，其余在卡面显示为暗灰未装填态。
- **当前真正会生成的生物 3 种**（`SPAWNABLE_MOB_SLUGS`）：`ladybug, bee, centipede`；地图生成区里的 `garden` 组展开为这几种。其他生物可用 `/summon` 手动召唤调试。
- 花瓣 key 是 `'p' + id`（如玫瑰 `p5`），`slug` 才是 i18n/特效匹配用的 `rose`。
- 掉落：按生物稀有度查表，`rollMobDrops()`（返回项带 `chance` = 命中档的有效概率，供掉落粒子分级）；初始装备 = 4× common Basic + 1× common Rose，背包只有 1× common Basic。
- **超长蜈蚣的隐藏掉落**（`CHAIN_LONG_DROPS`）：每节死亡独立掷骰，与普通掉落并存，全部掉 Basic；**不写进掉落表，因此不显示在生物信息栏**。概率 4% / 2% / 0.8% / 0.35% / 0.12% / 0.05% / 0.02% / 0.0003% / 0.0000001%（common → eternal）。
- 难度→稀有度用 S 型曲线（`RARITY_DIFF_T`）；生成区来自 `garden.tmj` 的 `spawn_mobs` 对象层。

### 5.5 地图与渲染（`map.js` / `game.js`）

- `GARDEN_TILE = 288`（原 384 × 0.75）；`WORLD_R = 1125`；`SPEED_SCALE = 5`；`PLAYER_BASE_SPEED = 232`。
- `loadGardenData()` 读 `garden.tmj`，再读引用的 `.tsj`；支持 gzip/zlib 压缩层、Tiled 翻转位（H/V/D）、对象层生成区。
- 碰撞：tileset 的 `objectgroup` 多边形 → 归一化；烘焙瓦片遮罩在 `garden.json`（运行时主要用 tmj 的 shapes/遮罩逻辑）。
- 相机锁定玩家并夹紧到地图边界；屏幕抖动 `HURT_SHAKE = 5.98`，按 `dt*30` 衰减。
- 渲染顺序：草地底色 → 瓦片 → 地面卡/掉落物粒子/掉落卡 → `/tp` 标记 → 尸体 → 生物（按 y 排序）→ **花瓣光环粒子（`game.auraFx`）** → 活玩家（花瓣在它里面画）→ 普通粒子/飘字 → 碰撞箱调试 → 坐标/边缘指示/小地图。
  光环粒子单独一份数组就是为了这个图层：它必须压在花瓣**之下**，所以不能混进 `game.particles`。
- 视口裁剪给屏幕外 2 倍余量；大生物按半径判定，避免贴边消失。
- 小地图 3 档，`M` 切换；位图缓存。**生物点（粉色）只在 F3 调试屏幕打开时绘制**（`game._drawMinimap` 传 `null` 即不画），常规游玩只显示地形与玩家。
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
- 聊天指令：`/local /global /map /guild /squad /whisper(/w) /reply(/r) /help /rot-speed /speed /print-players /unblock /unblock-all /give /tp /sure /init /resphere /summon /kill /kill-mob`。
  **`/show-coord` 与 `/pending crash` 已移除**，调试信息统一走 F3 调试屏幕。
- `/summon <mob_id> <rarity>[<k=v,...>] <count>`：参数用方括号追加在稀有度后，目前只有多节生物支持 `type=normal|long`，
  例：`/summon 3 common[type=long] 1` 生成一条超长蜈蚣；不写参数走自然规则（只有 common 有 0.3% 概率超长）。

### 5.7 花瓣能力 / 特效引擎（`petal-effects.js`）

- 注册：`PetalFX.register(key, { detect(ctx), start(ctx), update(ctx,dt), draw?(ctx2d,ctx) })`，`key === card.type.slug`。
- 只在该花瓣 **reload 完成、弹出到轨道后** 才跑 `detect`；命中后由 `update` 驱动，激活期间跳过轨道弹簧与普通战斗。
- **被动形态**：`PetalFX.register(key, { passive: true, tick(ctx,dt) })` —— 每帧都跑，但不接管位置、不跳过战斗。
- `ctx` 提供 `player/petal/body/type/rarity/stats/dt`、`onOrbit()`、`popped()`、`heal(n)`、`consumePetal()`、`floatText()`。
- **物理能力也归引擎**（行为层不再按 slug / 字段写分支）：
  - `PetalFX.trait(type, key)`：能力字段读取（注册项 `traits` > `type` 字段）。
  - `canDetach` / `detach(body, player)`：脱轨计划（Pollen 惯性滞留、Peas 四向喷射、Honey 等实体死亡再装填）。
  - `flightOf(body)` / `ttlOf(body)`：滞留期飞行参数与存活上限。
  - `onHit(body, player, contact)`：与生物接触的结算，按数据里的 `solid` 分派 ——
    `_softHit`（无实体碰撞：只传一次冲量）/ `_solidHit`（有实体碰撞：把生物推出轮廓 + 沿表面摩擦，花瓣不动）。
    注册项的 `onHit` 优先级最高，但**新增花瓣不要再写 onHit 分支来区分物理形态**，改 `PETAL_TRAITS.solid`。
  - `canAttract(body, player, mob)`：仇恨吸引（`attractMobs` + `maxMobRarity` + 半径）。
- 现有注册：`rose`（主动回血）、`leaf`（被动持续回血）、`honey`（`solid` 实体碰撞 + 仇恨吸引）、
  `pollen` / `peas`（滞留 / 喷射）、`basic` / `light` / `stinger`（无特效，仅登记）。
- 能力字段仍声明在 `data.js` 的 `PETAL_TRAITS`（构建到 `type` 上），注册项的 `traits` 只是可选覆盖，两份不会分叉。
- **装备加成**：`bonus(type, rarity)` 返回 `{ rotSpeed, reach }`（`recompute()` 只做求和，装上即生效）；
  `orbitOffset(ctx, out)` 微调轨道目标点（Faster 的"活泼飘动"）。
- **装备型饰品**：`accessory: true` → 不进轨道/无装填/不参与战斗；`drawAccessory(ctx, acc, player, R)`
  可整段接管绘制，不接管则按 `ACC_*` 版面画在额头。
- **素材渲染接管**（避免"贴图里画死 + 代码又画一个"导致重影）：
  `artVariant(svgId, svgText) -> string` 改写素材文本（卡面 / 世界实体 / 幽灵统一生效），
  `artOverlay(ctx, look, cx, cy, size)` 在素材之上补画可动部件（`look = null` 表示卡面静态居中）。
  两条钩子都按 `svgId` 反查类型，因此 `cards.js`、`sim/*` 都不需要认识任何 slug。

### 5.8 生物 AI 引擎（`ai.js`）

- 与 `PetalFX` 同套路：引擎只跑固定管线，**每个物种一个注册项**（`key === type.slug`）。
- 接口：`register(key, def)`；`def = { init?(mob), create(mob), step(ctx, dt, mob), notifyMoved?(ctx,d), facing?(ctx), speedLimit?(mob), onHurt?(mob,src,applied) }`。
- `Mob` 构造末尾调用 `MobAI.attach(mob)`：选定义 → `init` 声明该物种的移速/转向/游走节奏 → `create` 建运行时状态。
- `Mob.update` 的固定管线：`step` 取移动欲望 → `limitSpeed` 钳物种上限 → 阻尼加速 → `moveEntity` → 撞墙/禁行回馈 `blockedT` → `notifyMoved` 回馈位移。
- 内置：`wander`（默认回落：游走 / 追击 / 逃离）、`bee`（wander + S 型摆头）、`centipede`（**全程弧线**：AI 只改「角速度 curv」，curv 指数阻尼逼近目标曲率，heading 由此积分 —— 换向/追击/逃跑/撞墙都不允许任何角度突变，连掉头也只能绕大弯）。
- 蜈蚣额外两条硬规则：**追击/避墙的最小转弯半径 = 1 倍单节直径**（`turnRadius = visualD`，曲率上限 = 速度/半径）；**游荡 = 大半径长弧**（`arcRadius = max(540, 10.8×visualD)`，common ≈ 594px；稀有度越高 visualD 越大、弧半径随之等比变大；曲率 = 游荡速度/半径，每段 8~16s 才换弯）；**与墙保持 1 个瓦片**（`wallKeep = GARDEN_TILE`，每 0.25s 用 `map.canStandAt` 探测前/左/右三个方向，需要时只改目标曲率方向，仍是弧）。
- **追击寻路只看行走碰撞箱**：`MobAI._util.steer(mob, ai, wantA, dt)` 用 `walkR` 在前方 0.9 格处采样
  `map.canStandAt`，直行不通就按 22.5°/45°/67.5°/90° 左右交替找一个走得通的方向；缓存的是**偏转角**
  （`ai.pathOff`，0.3s 一次），不是绝对角 —— 否则目标一动就每帧重算，会把 `canStandAt` 打成热点。
  `wander`/`bee` 的追击与蜈蚣的追击分支都走它；蜈蚣只把它当"期望角"，曲率仍然连续（不破坏弧线规则）。
- `MobAI._util.walkR(mob)` 是所有"能不能走过去"判断的唯一半径来源；`centipede._wallProbe` 也用它。
- 新增生物：`MOB_TRAITS` 声明体型/速度倍率，需要行为时在 `ai.js` 里 `MobAI.register('slug', {...})`；不注册就自动用 `wander`。
- 休眠（`MOB_ACTIVE_R`）由服务端按距离控制，AI 不需要关心。

### 5.9 调试屏幕（`ui/debug-screen.js`）与移动端触控（`ui/touch.js`）

- **F3 调试屏幕**：按 `F3` 开关（`DebugScreen.toggle()`），`C` 单独切碰撞箱（仅屏幕打开时接管）。
  分栏显示：Frame（**真实 fps / 每秒模拟步数 / 帧耗时 / 逻辑 / 渲染 / JS 堆**）、
  Player（坐标 / 复活区 / 朝向 / 当前与最大移速 / 模式 / 血量 / 无敌）、
  Engine（生物总数 / 屏幕内 / 休眠 / 掉落卡 / 地面卡 / 粒子 / 飘字 / 快照数 / 快照延迟 / 预测偏差）、
  Petals（每槽名称 / 血量百分比 / 状态）。
  只在可见时更新，且限频 5Hz（`_acc >= 0.2`），DOM 元素建一次、之后只改 `textContent`。
  打开时自动打开碰撞箱，并让小地图画出生物点。
  **三条硬规矩**（都是踩过的坑）：
  · `update(dt)` 的 dt 是固定模拟步长，**不能在 F3 里数帧率**（会恒显示 60）。真实 fps / 每秒模拟步数
    由主循环用 rAF 间隔算好写进 `perf.fps / perf.sps`，F3 只负责显示。
  · 朝向显示前必须归一到 `[0,360)`（`facing` 是任意实数；写回时统一过 `wrapAngle`）。
  · 花瓣栏按**装备槽**列（`player.slots`），血量百分比 = 该槽存活实体的 `Σhp / ΣmaxHp` 并 `clamp(0,100)`；
    已碎裂实体的 `hp` 可能是负数，直接乘 100 会显示 -2900%。
  · 碰撞箱层里生物画的是**判定用的 SVG 轮廓**（没有轮廓才画橙红圆兜底）；花瓣圆按 `solid` 分色
    （黄 = 无实体碰撞，橙 = 有实体碰撞），吸附连线只画在真的吸住时。
- **触控层**：`TouchCtl.init(game)` 只在粗指针设备创建（`pointer: coarse` / `maxTouchPoints>0`；
  桌面调试可用 `?touch=1` 强制）。左下半屏浮动摇杆（`--t-stick` 按屏幕短边 0.28 自缩放，84~160px），
  输出写入 `game.touchDir`（`_readDir` 里优先级最高）；右下 `A`=reach（= 空格）、`B`=detect（= Shift），
  按住即置 `game.keys.mouse1 / mouse2`，与键鼠走同一条逻辑通路。
- 排布相关的尺寸全部走 CSS 变量（`--t-stick / --t-btn / --t-knob`），JS 只在 resize/orientationchange 时算一次。
- **拖拽卡牌走 Pointer Events**（`ui/drag.js`）：`pointerdown/pointermove/pointerup/pointercancel` 统一处理鼠标、触摸、触控笔，按 `pointerId` 过滤多指；卡面/卡槽声明 `touch-action: none`（否则系统把手势判成滚动会直接发 `pointercancel`，拖拽必挂），窗口内容区 `.win-body` 用 `pan-y` 保留手指滚动。
  触摸后浏览器会补发一次合成 mouse 事件，`_bindCard` 用 800ms 时间窗把这类事件丢掉，避免"一次点击算两次"。`pointercancel` 视同取消：回滚画廊数量、销毁幽灵、重渲染来源区域。

### 5.10 Boss 血条（`ui/bossbar.js`）

- 只显示 `eternal` 与 `super`；**Eternal 永远优先于 Super**（先按稀有度分层，层内才按距离），与距离无关。
- 1~3 只全部显示，沿屏幕中轴线**上下排布**（`_slotY`，间距 `GAP`）；超过 3 只才择优（排序后取前 3）。
- 显示范围：屏幕矩形向外扩 150%（半宽 `W*0.75`、半高 `H*0.75`），更远的不显示。
- 每条：深色胶囊背板 + 内嵌血量条，名称在上、稀有度在下，均带黑描边。
- **内条与主角血条完全同一套口径**：底色 `#2b2b33`、灰色残影 `#b9bec8`（`ghostHp` 欠阻尼弹簧）、主条 `hpBarColor(dispHp)` 连续渐变、黑色描边；无敌时用 `m.invulnA` 把三者一起插值到「白底 + 金色填充」（生物目前没有无敌来源，恒为 0）。
- **血条图形整体倍率 `BAR_K = 0.7`**：背板宽高、内缩量、内条高度、圆角、描边一起乘 0.7，**中心仍是 (cx, cy)**。
  `_size` 的 `bh = 52.8` -> 屏幕上 **36.96px**（33.6 × 1.1）；内条高度 = `bhv × 0.8`，与背板等比。
- 文字字号统一 **1.8 倍**（名称 16→28.8、稀有度 10→18）。**名称的视觉垂直中心落在条顶边上**
  （基线 = 条顶边 + `(ascent-descent)/2`，用 `measureText` 的实测值），即半个字高压在条上、半个在条外；
  稀有度基线 `cy + bhv×0.4`。行距按**实际条高**（`bh × BAR_K`）算：
  `_slotY = TOP + bhv/2 + i(bhv + GAP)`，`TOP = 30` 是首条顶边，`GAP = 34`。
- 显示 / 隐藏 / 换位由 `items[].a` 与 `items[].y` 阻尼驱动：缩放 `0.72 → 1`、透明度同步，
  显示约 0.10s、隐藏约 0.15s；隐藏时保留最后条目让缩小动画画完（否则会硬切消失）。

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
| `ASSET_VER` | 16 | 素材内容版本（改素材时 +1；16 为强制重拉 12_h/12_b） |
| `RECONCILE_RATE` / `RECONCILE_SNAP` | 14 / 120 | 预测位置向权威位置收敛速率（每秒）与硬吸附阈值（px） |

生物速度口径：追击 = 0.90×玩家最高速（蜜蜂 1.05×）；游荡 = 0.95 × 0.3~0.5 随机 × 0.75（蜜蜂 ×1.2），只有蜜蜂走 S 型。

**击退重量口径（两套，别混用）**：
- 实体分离用 `b.weight = rarityWeight(rarity)`（面积口径，生物/花瓣同一套）。
- **动量传递（击退）用 `petalWeight()` = 同等级生物重量 × 递减份额**：common ×0.5 → eternal ×0.05，
  等比递进（每档 ×0.1^(1/8)）。见 `sim/constants.js` 的 `petalKnockbackWeight`。
  花瓣比同等级生物轻得多，所以动量小得多 —— 想让"花瓣击退更/更不猛"只调这两个端点，
  再配合 `KB_DISPARITY_MIN/MAX`（0.2 / 1.5）：下限必须 ≤ sqrt(最小份额)≈0.224，
  否则高稀有度花瓣会被地板抬到同一档，"越高级推得越轻"的递进就看不出来。

**多节生物（蜈蚣）的三条规则**：
- **尾节不记仇恨**：`noteThreat` 里 `!this._next || this._next.dead` 直接返回 —— 打最尾一节不会让整条掉头
  （按"当前形态"判断，断了半截后新露出的尾节同样适用）。
- **击退沿链传递**：被刚性粘合的节位置由 `_solveChains` 覆盖，冲量若只写 `kbX/kbY` 会被下一帧抹掉。
  现在 `applyKnockback` 把 `CHAIN_KB_SHARE`(0.45) 的比例交给段首（整条被推着走），
  其余由 `Mob.update` 的 `_chainLocked` 分支积分成 `pushX/pushY` 局部偏移（弹性回位）。
- **偏移沿线扩散**：`_solveChains` 每帧对 push 场做一次 `[1,2,1]/4` 平滑后再叠加到轨迹槽位，
  所以"打中间会带弯两侧"。改动这三处时别只改一处，否则会退化成"中段被打没反应"或"身体散架"。

**卡牌 UI 性能**（一碰就卡的根因，别回退）：
- 背包画廊**结构只建一次**（`UI._buildInventory`），之后只更新数量与显隐（`_syncInventoryCounts`）；
  关着时只标 `_invDirty`，打开时才刷新。绝不要恢复成每次操作 `innerHTML=''` 全量重建。
- 卡面绘制走**批量调度**（`CardRenderer.schedulePaint` + 单个共享 `ResizeObserver`）：
  先统一读 `clientWidth`（一次布局）再统一下笔。每卡一个 rAF/RO 会让一次重建产生上百次强制重排。
- `display:none` 的卡不会被绘制（尺寸为 0 自动跳过），恢复可见时由 ResizeObserver 触发。
- **卡面名称**：基准字号统一（`NAME_FS_RATIO`），只有"名字太长"才缩——超过 7 个半角宽
  （CJK 算 2）按比例缩，再用实测宽度兜一道"不超内板 94%"。**缩放不动基线**
  （`NAME_BASE_RATIO` 固定），所以所有卡的文字仍落在同一条底线上。

**装备型饰品（accessory）版面**：`ACC_ART_SIZE_K=0.4992`（眼眶尺寸 = R×0.4992）、`ACC_ART_LIFT_K=0.95`
（头顶 = y − R×0.95）、`ACC_ART_DROP_K=0.5`（再下压自身尺寸的一半 = 落在额头）。
世界里画饰品与任何复用版面的地方都读这三个常量（`sim/constants.js`），不要另写魔法数。
**眼珠**（`petal-effects.js` 的 `PUPIL_*`）是相对素材的比例：眼眶缩小时眼珠要按 1/缩比 反向补偿，
才能做到"眼眶变小、眼珠不变大"；卡面与世界共用同一个 `artOverlay`。

## 7. 代码约定（重要）

1. **缓存版本号**：修改 `js/*.js` 或 `css/style.css` 后，把 `index.html` 里对应文件的 `?v=N` 加 1（只加改到的文件）。修改 `assets/` 下图片/SVG 内容但文件名不变时，把 `js/util.js` 的 `ASSET_VER` 加 1。历史上多次因为忘记 bump 导致“改了没生效”。
2. **i18n**：所有用户可见文本必须走 `I18N.t('...')`，不要在代码/HTML 硬编码中文或英文。**新增 key 一律写进 `js/i18n-extra.js`**（`en_US` + `zh_CN` 成对），不要改 `assets/i18n/` 下抓取生成的语言包。缺失键会显示 `<key>`，这是故意的；旧的 `assets/lang/en.js` 命名空间包已删除，回退链只有「当前语言 → en_US」。
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
3. 行为（追击、S 型、弧线、障碍等）在 `ai.js` 里 `MobAI.register('slug', {...})`；`Mob` 只跑公共管线，不再写物种特判。掉落表在 `data.js`。
4. 视觉尺寸 `MOB_SIZE_SCALE`、贴图朝向 `MOB_ART_ROT`、碰撞轮廓 `mob-shapes.js`。
5. i18n `Mobs/<slug>/Name`；bump 版本号。

**改 UI 文本/布局**：`ui.js` 建 DOM + `css/style.css` 写样式；卡面在 `cards.js`；不要往 `index.html` 加静态 HUD。

## 10. 已知限制 / 待办

- **Net 已抽象但未做真联机验证**：协议/服务端/传输已分层，`WebSocketNet` 骨架在 `js/net/client.js`（连接失败自动回退 `LocalNet`）；本机没有 Node 环境，端到端联机未测。`LocalServer.handleRequest` 是请求入口，`LocalNet.requestSync` 仅本地可用。
- **快照仍是每帧全量**（未池化/未降频）：`LocalNet.step` 每帧推进模拟并立刻投递快照（约 2.5ms/帧，4700 只实体的对象分配是当前 GC 主要来源），本地零延迟优先；`SNAP_DT` 只用于客户端插值步长基准。真服务器应改为按 `SNAP_HZ` 投递 + 对象池。
- **生物实体数远超 `GLOBAL_MAX_MOBS`**：上限按"只"统计，而一条蜈蚣会展开成多节实体（实测约 4500~4900 个视图实体）。
- 只有 Garden 一张图；`/init <map>` 只能初始化当前地图，不能切图（其余 `.tmj` 未被加载）。
- 只有 8 种花瓣（`basic/light/rose/stinger/pollen/honey/peas/leaf`）、3 种可生成生物（瓢虫/蜜蜂/蜈蚣）；大量 registry 数据尚未接入玩法。
- 聊天只有 Local 可用；Squad/Guild/Whisper 是 UI + 提示占位。没有真实多人/账号系统。
- 没有存档：除设置 Cookie 外，装备/图鉴/进度都在内存，刷新即重置。
- 没有音效/音乐。触控已适配（摇杆 + A/B），但**未在真机验证**：`pointer` 事件与 `env(safe-area-inset-*)` 只在桌面用 `?touch=1` 和 headless 尺寸断言验证过。
- 代码仍有几个大文件（`game.js` ~66KB、`net/server.js` ~64KB、`ui.js` ~54KB、`sim/player.js` ~54KB、`assets/registry.js` ~198KB）；改动时尽量局部化，避免整文件重排。

### 待办（按价值排序）

1. **快照降频 + 对象池**：`LocalNet` 里把"模拟推进"与"快照投递"分开，按 `SNAP_HZ` 投递并复用对象；客户端插值已就绪（`_applySnap` 支持任意 `snap.dt`），改完要把自测里"1~2 帧内同步"的断言改成按秒推进。
2. **服务端 tick 降到 25Hz**：与服务端战斗步长、快照频率对齐，客户端预测（零延迟）不受影响；预计再省一半 `net.step` 时间。
3. **真联机**：Node 起 `LocalServer` + 一个 `WebSocketNet` 连接，验证 `request/on/step` 三条契约；目前所有请求都是同进程同步返回。
4. **快照裁剪**：远距离生物只下发 `(netId, x, y, 类型, 稀有度)`，详细字段按复制半径下发（小地图只需前者）。
5. `MOB_SIZE_SCALE` / `MOB_ART_ROT` 仍是代码内表（`sim/mob-shape.js`），可下沉进 `MOB_TYPES`。
6. 图鉴/背包仍无持久化；没有账号系统。
7. 移动端真机回归（`?touch=1` 可桌面预览）：多指同按（摇杆 + A/B）、横屏、刘海安全区、聊天输入时摇杆让位。

## 11. 改动后自检清单

- [ ] 浏览器通过本地 HTTP 打开，控制台无报错。
- [ ] 改过的 JS/CSS 已 bump `index.html` 的 `?v=`；改过素材已 bump `ASSET_VER`。
- [ ] 新文本同时有 `en_US` / `zh_CN` 键。
- [ ] 战斗相关改动确认服务端权威副本同步（否则客户端表现正常但服务端不一致）。
- [ ] 新增/修改实体确认快照字段下发（`hurtT/flash/squash/deathTimer/...`），否则客户端看不到表现。
- [ ] 改动 `.js/.html/.css` 后仍是 UTF-8 无 BOM + CRLF。
