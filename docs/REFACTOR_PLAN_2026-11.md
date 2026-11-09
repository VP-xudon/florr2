# florr2 架构评审与重构方案（2026-11）

> 状态：**Stage 0 已完成**（见文末进度表）。Stage 1~5 待实施。
> 目标：从成熟引擎的视角，把"每个横切关注点只有一条入口"落实到代码里；**不改变现有大文件划分**。
> 阅读顺序：第 1 节（结论）→ 第 2 节（问题）→ 第 3 节（目标接口）→ 第 4 节（实施步骤）。

---

## 1. 结论

项目**不缺模块划分**（`sim/* / net/* / render/* / ui/*` 这一层已经够用，也确实不该再动），
缺的是**每个横切关注点只有一条入口**。

现在"实体怎么出现、怎么消失、怎么被绘制、怎么进快照"这四件事各有 2~6 套并行实现，
所以每加一个实体，就要在同一批坑里再踩一次。本方案围绕"把每类横切关注点收缩成唯一入口"来做。

### 1.1 现状（用代码数出来的）

| 关注点 | 现有实现数量 | 证据 |
|---|---|---|
| 出场动画 | **3 套** | `spawnPop`（c1=1.70158，`constants.js:351`）、掉落卡自己一套（c1=1.10158、`DROP_POP_T=0.34`，`drops.js:116`）、蛛网自己一套（`1+0.16*sin`，`render-util.js:60`） |
| 退场动画 | **4 套** | `ExitFX`（`exit.js:22`）、`EntityFX.despawn`（`exit.js:133`）、`petalGhosts` 手工 `age`+`filter`（`player.js:253/793`）、`DropCard.fade/done`（`drops.js:110`）、生物 `dead+deathTimer`（`mob.js:174`） |
| 实体表 | **4 套** | `createExitList`（`player.webFields`）、`game.mobWebs`、`player.netWebs`、`player.petalGhosts`（普通数组） |
| 红闪时长 | 2 套 | `ENTITY_HURT_T=0.3`（`exit.js:97`）+ `server.js:1104` 硬写 `s.hurtT = 0.3` |
| 25 tick/s | 3 处 | `server.js:1113` 字面量 `1/25`、`protocol.SNAP_DT`、`constants.MOB_TICK_S` |
| 快照字段清单 | 2 处手写 | 服务端 `_fillEnts`（`server.js:2066-2119`）+ 客户端 `_applySnap`（`game.js:456-571`） |

`EntityFX.state()`（`exit.js:160`）这个"统一状态读取口"写好了，但**全项目零调用点** ——
`Mob.draw` 仍然手写 `spawnFade × spawnPop × ExitFX.scale/alpha`（`mob.js:594-604`）。
这就是"新引擎已存在、旧调用点没迁移、于是两套都在维护"的典型症状。

---

## 2. 七个结构性问题（按"能一劳永逸解决多少 bug"排序）

### P0 · 实体生命周期没有单一真相

**现状**：一个实体身上同时有 `dead` / `deathTimer` / `exiting` / `exitT` / `exitDur` /
`exitAlpha` / `exitScale` / `age` / `hurtT` / `flash`，其中 `deathTimer` 和 `exitT` 是**同一个量**，
`exit.js:41` 里还专门写了一句反向同步：

```js
if (ent.deathTimer != null) ent.deathTimer = ent.exitT;
```

**为什么这是结构问题，不是小脏**：

- 渲染方必须**自己记得**把入场 alpha、入场 scale、退场 alpha、退场 scale、红闪 alpha 相乘。
  少乘任何一个没有任何机制会报错 —— 只会"这个新实体看起来怪怪的"。
- 于是出现 `mob-fx.js:375` 手动 `spawnFade(...)` 算尾针 alpha、`player.js:1106/1167` 手动
  `deathFade(...)` 算花瓣幽灵、`DropCard.draw` 手动乘 `pop*breathe*fade`。
- 回收点也分裂：`ExitFX.sweep`（受控表）、`game.js:1400` 手写 `if (m.dead && ExitFX.done(m))`、
  `player.js:253` 手写 `filter(g => g.age < PETAL_GHOST_T)`、`drops.js:111` 手写 `this.done = true`。
  **每多一个容器，就多一个"忘了推进退场计时"的机会** —— 客户端屏外生物退场播不完就是这一类。

**目标**：一个 `EntityFX`，state 是**引擎算好的一个结果**，渲染只读不算；回收只发生在一个
`EntitySet.tick()` 里。

### P1 · 同一个世界状态有多个镜像容器

这是目前**已经在产生 bug**的地方：

- `game.js:86` 建了 `this.mobWebs`，客户端只在"Legend+ 蜘蛛补网"这一条路径里填过它，
  而那条路径本身又与服务端下发的网重复。
- 真正的网数据在 `p.netWebs`（`game.js:416-431` 从快照建）。
- `player.js:1097` 画网：`if (netWebs.length) 画 netWebs; else 画 webFields`。
- `game.js:937` 本地蛛网减速：读 `this.mobWebs` → 通常为空 → **网站在上面不减速**。
- `game.js:1462` F3 网圈：读 `p.webFields` → 客户端永不生成 → **F3 看不到网**。
- `render-util.js:56` `if (f.exiting) continue;` → 退场动画被跳过 → **网"啪"一下消失**。

**根因**：不是漏改，是**同一份状态允许存在 3 个容器**。只要容器数量 > 1，就一定会漂。

**目标**：网只有一份 —— 服务端 `world.fields`，客户端 `p.netWebs`。任何"我要读网"的地方只有这一个名字。
（Stage 0 已把客户端收成一份；服务端侧合并留给 Stage 2。）

### P2 · 服务端 `step()` 是过程式脚本，顺序靠注释保证

`server.js:821-1136`，315 行、8 个编号段落，段落之间有**方向性依赖**
（链解算必须在最后、`_fieldTick` 必须在坐标定稿后、`_bumbleTick` 必须在最后）。
目前这个约束只写在注释里，谁插一段进去就悄悄错。

**目标**：`STEP_SYSTEMS` 显式数组 + 每个系统一个方法，顺序是数据不是注释；开发期断言方法存在。
行为零变化，纯搬移。

### P3 · 快照协议是两份手写字段清单

新增一个表现字段，要同时改：`mob.js`（字段产生）、`server._fillEnts`（下发）、
`game._applySnap`（回填）。三处没有任何机制保证一致。所有"客户端看不到受伤/挤压/死亡旋转"
的 bug 都是这个形状。

附带的具体问题：

- `_snapWebs()` 的 id 兜底是 `'w' + out.length`（`server.js:2051`）—— **下标一变 id 就变**，
  客户端会认为"旧的消失 + 新的出现"，退场与减速全部错位。
- `hornetProjectiles` 每快照 `.map(新对象)`（`2108-2114`），客户端每快照 `.map` + `old.find`
  （`game.js:537-555`），O(n²) + 每帧分配。
- 客户端 `map[q.slot + '|' + (q.sub||0) + '|' + (q.gen||0)]`（`game.js:406-408`）
  每快照新建对象 + 数百次字符串拼接，25Hz 下是稳定的 GC 源。
- `_snapPetals` 每槽 `for (const b of p.petals)` 判 `has`（`2030`）—— O(slots×petals)，纯浪费。

**目标**：`SNAPSHOT_SCHEMA` 表驱动；表现字段统一收进 `ent.fx`（一个小对象），快照只搬 `fx`；id 全局单调。

### P4 · 渲染 pass 没有统一入口

`render()` 里手工 10 段，`_drawMobWebs`（画空表）与 `player.drawWebs`（画 netWebs）是两份重复职责，
尸体走 `_drawCorpses`，花瓣在世界绘制里混着画。

**目标**：`drawWorld(kind, ent)` 由 `EntityFX.draw` 统一包装（save/translate/scale/alpha/restore），
渲染顺序按 kind 表排。这样"退场中的实体画不画"只有一个答案（**画**）。

### P5 · 常量与曲线重复

- 弹入过冲常数 3 个不同值（1.70158 / 1.10158 / 0.16）。
- `PETAL_GHOST_T = 0.1` 与 `FADE_T = 0.1` 同值两名（Stage 0 已删）。
- `WEB_POP_T` 是"入场时长"，却和 `FADE_T` 分开管。
- `1/25` 三处、`0.3` 红闪两处。

### P6 · 死代码与文档漂移

- `EntityFXLegacy`、`MobFX.clientEnd`、`TEMP PROFILE`（Stage 0 已删）。
- `AGENTS.md` 曾写 14 种花瓣 / 5 种生物 / 3 种可生成生物 —— 实际 19 / 6 / 6（Stage 0 已修）。
- `sim/crb.js`、`sim/status.js`、`render/spider-gait.js` 三个模块缺失于模块表（Stage 0 已补）。
- `AGENTS.md` 曾有三份 `2026-11-09 变更记录`，其中两份几乎重复（Stage 0 已合并）。
- `entities.js` 已是 8 行空壳，但很多注释还在说"见 entities.js Mob.draw"（实际在 `sim/mob.js:592`）。

---

## 3. 目标架构（接口级）

### 3.1 实体契约

```js
// 引擎独占（业务代码不许写）：
ent.kind        // 'mob' | 'petal' | 'web' | 'drop' | 'projectile' | 'summon' | 'fx'
ent.state       // 'spawning' | 'alive' | 'exiting'
ent.age         // 入场计时
ent.hurtT       // 红闪计时
ent.flash       // 白闪计时
ent.exitT       // 退场计时
ent.exitDur
ent.fx          // ★ 引擎每帧算好的一份 { alpha, scale, hurt, flash, rot }
// 业务独占：hp / x / y / facing / vx / vy / dead ...
```

`ent.dead` **降级为业务语义**（"我已经死了，别再打我/结算我"），不再兼任表现计时。
`deathTimer` 删除，由 `exitT` 取代（快照字段一起改）。

### 3.2 `EntityFX`（唯一生命周期 API）

```js
EntityFX.spawn(ent, kind)       // 唯一创建入口：初始化 age/hurt/flash/state/fx
EntityFX.tick(ent, dt)          // 唯一计时入口：age++ / hurt-- / flash-- / spawning→alive / exitT++
EntityFX.hurt(ent, dur)         // 唯一红闪入口（默认 ENTITY_HURT_T）
EntityFX.despawn(ent, opt)      // 唯一离场入口：state='exiting'，opt={ dur }
EntityFX.finished(ent)          // 退场播完
EntityFX.visual(ent)            // 算出并返回 ent.fx（每帧一次，幂等）
EntityFX.draw(ctx, ent, paint)  // ★ 唯一绘制入口（见 3.3）
```

**`ExitFX` 整体删除**，不再保留别名。所有 `ExitFX.begin/done/sweep/tick/alpha/scale`
调用点一次性迁移到上面六个方法（迁移表见 4.2）。

### 3.3 强制统一动画的关键：绘制包装器

这是"不能靠自觉"的部分。**实体画面只能通过它画**：

```js
EntityFX.draw(ctx, ent, (c, fx) => {
  // 这里画本体，坐标系已经是实体中心、缩放/透明度已经乘好
});

// 内部等价于：
const fx = EntityFX.visual(ent);
if (!(fx.alpha > 0.001) || !(fx.scale > 0.001)) return;
ctx.save();
ctx.translate(ent.x, ent.y);
ctx.scale(fx.scale, fx.scale);
ctx.globalAlpha *= fx.alpha;
paint(ctx, ent, fx);
ctx.restore();
```

于是：

- 新增实体 = 调 `EntityFX.draw` → **必然**有入场、退场、渐显渐隐，想漏都漏不掉。
- 画布上不再出现"某个实体忘了乘 alpha"。
- 入场曲线也统一（用户明确要求：入场也要通用，不只是退场）：

```js
EntityFX.registerKind('mob',   { enter: 'pop',    enterT: 0.10, exit: 'growFade' });
EntityFX.registerKind('web',   { enter: 'spring', enterT: 0.18, exit: 'growFade' });
EntityFX.registerKind('drop',  { enter: 'pop',    enterT: 0.10, exit: 'fade', exitT: 0.5 });
EntityFX.registerKind('petal', { enter: 'pop',    enterT: 0.10, exit: 'growFade' });
```

曲线参数只在注册表里，`spawnFade / spawnPop / deathFade / WEB_POP_T / PETAL_GHOST_T /
DROP_POP_T / DROP_DESPAWN_T` 全部转为**引擎内部私有**。

### 3.4 `EntitySet`（唯一容器）

```js
function createEntitySet(kind) {
  // add(ent)      -> EntityFX.spawn
  // tick(dt)      -> 逐个 EntityFX.tick，然后 finished 的唯一回收点
  // forEach / find(id) / sortedByY() / length / toArray()
  // onRemove(fn)  -> 供 byId 索引同步（Map 只是索引，不是所有者）
}
```

规则写死：

1. **容器是唯一所有者**，`Map<id, ent>` 只能做索引，删只在 `tick` 里发生。
2. `tick` **必须覆盖全部元素**（屏外也不例外）—— 这条直接根治"屏外生物退场播不完/永远回收不掉"。
3. 不提供 `push/pop/splice/filter/length=`（沿用现在 `createExitList` 的封锁思路，只是把范围扩到所有实体）。

### 3.5 快照 schema

```js
// 表现字段全部走一个小对象（池化），新增字段只改这里一处：
o.fx = { hurt: m.hurtT || 0, flash: m.flash || 0, squash: m.squash || 0,
         rot: m.deathRot || 0, exitT: m.exitT || 0, ult: m.ultActive ? 1 : 0 };
```

客户端 `_applySnap` 用表驱动回填：

```js
for (const k in FX_FIELDS) v[k] = Math.max(v[k] || 0, e.fx[k]);
```

`dev/check_versions.py` 增加一条静态检查：`_fillEnts` / `_applySnap` 引用的 `fx.*` 键集合必须一致
（缺一个就报错）。**"加字段忘了下发"从"人肉纪律"变成"CI 失败"。**

### 3.6 服务端系统表

```js
const STEP_SYSTEMS = [
  'sysPlayerInput',      // 1  玩家权威副本 + PetalFX 静音
  'sysCheckpoints',      // 2  复活点
  'sysSummons',          // 3  召唤物跟随/退场
  'sysPetalRespawn',     // 4  多体卡独立重装填
  'sysMobs',             // 5  AI + 移动 + 醒睡分区 + 退场回收
  'sysSpawn',            // 6  人口维持
  'sysPush',             // 7  玩家↔生物、生物↔生物、蜡块、召唤物
  'sysCombat',           // 8  25Hz 战斗
  'sysChains',           // 9  刚性链解算（必须倒数第二）
  'sysFields',           // 10 场地实体 + 状态施加
  'sysMobTraits',        // 11 物种特性（Bumble 产花粉）
];
step(dt) { this.t += dt; for (const s of STEP_SYSTEMS) this[s](dt); }
```

注释从"编号 + 为什么在这个位置"变成一行 `// 顺序即契约：见 STEP_SYSTEMS`，
具体理由集中写在数组上方。

---

## 4. 分阶段实施

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | 死代码 + 已确认 bug + 文档数字 | ✅ 已完成 |
| 1 | 实体引擎收口（核心） | 待做 |
| 2 | 网与场地实体单源 | 待做 |
| 3 | 快照与协议 | 待做 |
| 4 | 服务端系统化 | 待做 |
| 5 | 注释与文档 | 待做 |

### 4.1 Stage 0 · 清死代码 + 修已被证实的 bug ✅

| 文件 | 改动 |
|---|---|
| `js/net/server.js` | 删 `step()` 里的 `TEMP PROFILE`（`_prof` / `_mk` / 8 次 `performance.now()`） |
| `js/game.js` | 删 `this.mobWebs`、`_fieldCtx()`、`_drawMobWebs()`、Legend+ 蜘蛛的本地补网块、`MobFX.clientEnd` 调用；`_applySnap` 的大招注释改为"只镜像 ultActive"；本地网减速与 F3 网圈改读 `p.netWebs` |
| `js/render/render-util.js` | `drawWebList` 不再跳过 `exiting`（只跳过完全透明的），网退场动画可见 |
| `js/mob-fx.js` | 删 `clientEnd`（死接口，返回 `null`） |
| `js/sim/exit.js` | 删 `EntityFXLegacy` 死别名 |
| `js/sim/constants.js` + `js/sim/player.js` | 删 `PETAL_GHOST_T`，4 处引用改 `FADE_T` |
| `AGENTS.md` | 花瓣 14→19、生物 5→6、删"3 种"矛盾句、补 3 个模块、合并重复变更记录、硬规则改 `EntityFX` 口径 |

**验收结果**：`python dev/check_versions.py` → 42 脚本、0 错误；浏览器控制台无报错；
站在蛛网上移速下降（本地预测与服务端一致）；F3 能看到网虚线圆；网到期为渐大渐隐。

### 4.2 Stage 1 · 实体引擎收口（核心）

**`js/sim/exit.js` 全量重写**（文件名与加载顺序不动）：`EntityFX`（3.2）+ `registerKind`（3.3）
+ `createEntitySet`（3.4）。`ExitFX` 消失。

逐调用点迁移清单：

| 调用点 | 现在 | 改为 |
|---|---|---|
| `mob.js:595-604` 入场/退场组合 | `spawnFade × spawnPop × ExitFX.scale/alpha` | `EntityFX.draw(ctx, this, paint)`，内部读 `ent.fx` |
| `mob.js:452` 退场计时 | `ExitFX.tick(this, dt)` | `EntityFX.tick(this, dt)` |
| `mob.js:174-177` 死亡 | `dead=true; deathTimer=0; ExitFX.begin` | `dead=true; EntityFX.despawn(this)` |
| `game.js` 中 10 处 `ExitFX.begin` / 手写 `if (!x.exiting)` | 各自去重 | `EntityFX.despawn`（幂等，删掉 `_exitBegan` 这类手工去重字段） |
| `game.js:673-680/712-735` 独立实体推进 | `tickEntity` + `advanceExit` 两个 | `EntityFX.tick`（一个） |
| `player.js:203-206` 网退场 + 幽灵 | `despawn({ghost})` + `petalGhosts.push` | 只 `despawn`，幽灵机制删除 |
| `player.js:253/793` 幽灵推进 | `filter(g => g.age < T)` | 删除（实体自己走 `EntitySet.tick`） |
| `player.js:1106/1167/1147/1276-1278` 手算 alpha/scale | `deathFade / spawnFade / spawnPop` | 全部改 `EntityFX.draw` |
| `player.js:344-368` `_killPetalBody` | 三分支各自决定"怎么消失" | 分支只决定**是否进 reload**，消失一律 `EntityFX.despawn` |
| `drops.js:107-144` | 自建 `popT/fade/done` + 自算曲线 | `EntityFX.spawn/tick/despawn/draw` |
| `render-util.js:53-70` `drawWebList` | 自算 `pop/over/ex/ea` | 遍历 `EntitySet` + `EntityFX.draw` |
| `mob-fx.js:368-380` 尾针 alpha | `spawnFade(...)` 手算 | `EntityFX.draw` |

**必须一起改的字段**（否则会静默错）：`deathTimer` 删除 → 快照 `o.deathTimer` 与
`_applySnap` 的 `p.deathTimer` 同步改成 `exitT`；尸体绘制 `player.js:1330` 的 `deathTimer/0.35` 改读 `exitT`。

**验收**（逐条手动验证）：

- 生物出场 0.1s Q 弹 + 渐显；死亡 1.5 倍渐隐；与改造前逐帧观感一致（录屏对比）。
- 花瓣碎裂不再有"第二套幽灵"重影（原来实体已渐隐 + 幽灵再渐隐一次，实际是双重叠加）。
- 屏外生物死亡后 0.1s 内从 `mobViews` 消失，不再残留。
- 蛛网 / 玩家网 / 掉落卡 / 尾针四种实体的出场退场曲线肉眼一致。
- F3 花瓣血条/状态正常；30s 无报错。

### 4.3 Stage 2 · 网与场地实体单源

1. 服务端：`player.webFields` + `server.mobWebs` 合并为 `world.fields`（`createEntitySet('web')`），
   `_snapWebs` 只遍历它。
2. 客户端：只保留 `p.netWebs`（`createEntitySet('web')`）；`_applySnap` 的网差分改成 `EntitySet` 的 upsert/diff。
3. 减速/状态：服务端 `_fieldTick` 一份；客户端 `Game` 一份，读 `p.netWebs`。
4. F3 虚线圆读 `p.netWebs`；`drawWebList` 彻底删除（并入实体绘制 pass）。
5. id：全部改用 `world.nextEntityId()`（见 Stage 3），删除 `'p'+seq` / `'m'+seq` / `'w'+index` 三套命名。

**验收**：玩家网与蜘蛛网同时存在、同时到期、同时减速；F3 圆与画面完全重合；
一张网到期不影响其它网的 id 对齐。

### 4.4 Stage 3 · 快照与协议

1. `world.nextEntityId()` 单调 id，快照里 `id` 全部来自它。
2. `_fillEnts` 表现字段收进 `o.fx`（池化对象），`_applySnap` 表驱动回填。
3. `_snapPetals` 池化；`has` 检查改成按槽预建位图；客户端 `netPetals` 改成 `Map<number, state>`
   + 数字键 `slot*1e6 + sub*1e3 + gen`，复用同一个 Map（`clear()` 而不是 `new`）。
4. `hornetProjectiles` 池化 + `Map<id, obj>` 索引，客户端同样按 id 复用（删掉 `old.find` 的 O(n²)）。
5. `dev/check_versions.py` 增加 `fx` 键集合一致性检查。

**验收**：连续 60s `performance.memory` 无单调增长；F3 `snapCount` 稳定；
尾针发射/回收全程不闪、不残留。

### 4.5 Stage 4 · 服务端系统化

1. `step()` 拆成 11 个 `sys*` 方法（3.6），`STEP_SYSTEMS` 常量。
2. 每个方法开头一行注释说明"输入依赖 / 输出影响哪一步"。
3. 链的解算顺序写成 `sysChains` 在数组里的位置，不再靠注释。
4. 可选：`_combatTick`（284 行）再拆 `_combatPetals / _combatMobs / _combatContact`。
5. `1/25` 统一引用 `SNAP_DT`；`s.hurtT = 0.3` 改 `EntityFX.hurt(s)`。

**验收**：同 seed + 同输入序列，`Game.stepFrames(600)` 前后快照 diff 一致。

### 4.6 Stage 5 · 注释与文档

见第 6 节。

---

## 5. Bug 类 → 根治点 对照表

| 现象 | 现在的根因 | 被哪一步根治 |
|---|---|---|
| 蛛网"啪"一下消失 | `drawWebList` 跳过 `exiting` | Stage 0（已修）/ Stage 1（结构） |
| 站在网上本地不减速 / F3 看不到网 | 读空的 `game.mobWebs` / 读空的 `p.webFields` | Stage 0（已修） |
| 图例+蜘蛛的网画两遍 | 本地补网影子 + 服务端下发 | Stage 0（已修） |
| 新实体忘了渐显渐隐 | 没有强制绘制 wrapper | Stage 1 |
| 花瓣碎裂有双重渐隐残影 | `petalGhosts` 第二套 | Stage 1 |
| 屏外生物退场播不完 / 永远回收不掉 | 退场计时不在统一 tick 里 | Stage 1 |
| 尾针发射后残留一根针 | 占位对象没走统一退场 | Stage 1 |
| 网的 id 下标漂移 → 张冠李戴 | `'w'+index` 兜底 | Stage 2/3 |
| 加表现字段客户端看不到 | 两份手写字段清单 | Stage 3 |
| 每帧 GC 尖峰、帧率掉 | 快照/镜像每帧分配 | Stage 3 |
| 服务端顺序被后续改动破坏 | 过程式 step | Stage 4 |

---

## 6. 注释重写规范

**只保留三类注释**：

1. **当前契约**：这个函数/字段怎么用、调用方必须满足什么（≤3 行）。
2. **易错点 + 具体数值 + 曾经的现象**（项目最有价值的部分，保留）。
3. **数据来源**（registry id、官方表、生成脚本）。

**必须删除四类**：

1. **考古叙事**：`"原来是 X，现在是 Y，之前踩过坑"` —— 结论保留，历史删掉
   （历史属于 git log 与 AGENTS.md 的变更记录）。
2. **重复**：同一件事在 `mob.js` / `server.js` / `game.js` 各写一遍。
   **只写在使用者最近的那一处**，其它地方一行注释 + 指向。
3. **失效数字与失效引用**：`14 种花瓣`、`3 种生物`、`见 entities.js Mob.draw`（实际在 `sim/mob.js`）、
   `自测 / headless` 残留。
4. **解释"为什么必须有这个模块"的长篇**（`exit.js:1-20` 20 行）→ 压缩成 8 行，细节进 AGENTS.md。

示例（`exit.js` 头部 20 行 → 8 行）：

```js
// sim/exit.js — 实体生命周期引擎（无 DOM，可在 Node 加载）
//
// 契约：
//   spawn → tick → despawn → finished，回收只发生在 EntitySet.tick 里。
//   渲染必须走 EntityFX.draw(ctx, ent, paint)：入场/退场/渐隐由引擎统一施加。
//   业务代码不得写 ent.fx / exitT / exitDur，也不得 splice 实体表。
//   绕过引擎直接删元素 = 实体凭空消失，全项目禁止。
```

`AGENTS.md` 同步项：

- 数字修正（19 花瓣 / 6 生物 / 6 可生成）。
- 模块表补 3 个模块，删 `selftest` 相关行。
- 三份重复的 2026-11-09 记录合并成一份，每条只保留"结论 + 现象 + 涉及文件"。
- 新增 `5.3.1 实体生命周期契约`，写 Stage 1 定下的六条规则。

---

## 7. 明确不动的部分（避免过度改造）

- **不改文件划分**：不新建 `engine/`、不拆 `game.js` / `server.js` / `ui.js` / `player.js`。
  所有重构都在原文件内进行，`index.html` 的加载顺序除删除 `ExitFX` 外无变化。
- **不改 `ui/*`、`cards.js`、`data.js`、`map.js`、`chat.js`**（除 Stage 3 的 `netPetals` 结构）。
- **不改玩法数值**。
- **不引入构建链 / 依赖 / 测试框架**（`dev/check_versions.py` 继续是唯一静态检查器，只加两条规则）。

---

## 8. 每个阶段的固定收尾动作

1. `python dev/check_versions.py` → 0 error。
2. 浏览器（本地 HTTP）无控制台报错，核心玩法手动验证。
3. 改过的 JS/CSS bump `index.html` 的 `?v=`（只 bump 改到的文件）。
4. `AGENTS.md` 追加该阶段的变更记录（结论 + 现象 + 涉及文件）。
5. 编码保持 UTF-8 无 BOM；`.js/.html/.css` 为 CRLF，`.md` 为 LF。
