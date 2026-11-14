# florr2 架构评审与重构方案（2026-11）

> 状态核对：2026-11-14（HEAD `8d05545`）。
> **Stage 0 ✅ 完成；Stage 1 🟡 部分完成；Stage 2 🟡 基本完成；Stage 3 🟡 部分完成；Stage 4 ⏳ 未开始；Stage 5 🟡 部分完成。**
> 目标：从成熟引擎的视角，把"每个横切关注点只有一条入口"落实到代码里；**不改变现有大文件划分**。
> 阅读顺序：第 0 节（进度）→ 第 1 节（结论/现状）→ 第 2 节（问题）→ 第 3 节（目标接口）→ 第 4 节（实施步骤）。

---

## 0. 进度总览（2026-11-14 核对）

> 核对方式：逐项对照实际调用点，不以提交说明或旧文档为准。
> 涉及文件：`js/sim/exit.js`、`js/sim/mob.js`、`js/sim/player.js`、`js/sim/drops.js`、`js/net/server.js`、`js/game.js`、`js/render/render-util.js`、`js/mob-fx.js`、`dev/check_versions.py`。
> 标记：✅ 完成 / 🟡 部分完成 / ⏳ 未开始。

| 阶段 | 状态 | 已落地 | 未完成 / 下一步 |
|---|---|---|---|
| 0 | ✅ | 死代码清理、客户端网单源、已确认 bug、文档数字修正 | 无 |
| 1 | 🟡 | `EntityFX` API、`registerKind`、`createEntitySet`、`ExitFX` 兼容层；部分调用点已改用 `EntityFX.hurt/despawn/tickEntity` | `EntityFX.spawn()` 只被 `createEntitySet.add()` 调用，`Mob/Player/花瓣/掉落卡` 仍手写初始化；`EntityFX.draw()` **零调用点**；`Mob.draw`/`player`/`drops`/`drawWebList` 仍手算动画；`deathTimer`、`petalGhosts` 仍在 |
| 2 | 🟡 | `server.fields` 单源、`p.netWebs`、本地减速/F3 改读 `netWebs`、`game.mobWebs` 删除、`drawWebList` 不再跳过退场 | `drawWebList` 仍是独立绘制；玩家网 id 仍是 `'p'+seq`（敌方网是 `nextId++`），没有 `world.nextEntityId()`；`_applySnap` 仍是手工 `find/seen` 差分；`player.webFields` 仍作为客户端兜底 |
| 3 | 🟡 | `_fillEnts` 复用 `_entBuf`、`o.fx` 表现字段入口、`netPetals` 改 `Map` + 数字键、`hornetProjectiles` 服务端/客户端 `Map` 化、`_fillHornetProjectiles` 复用缓冲 | `_snapPetals` 每快照 `new` 对象且按槽扫 `p.petals`；每只生物的 `o.hornetProjectiles` 仍 `.map()` 新对象；`o.fx` 仍每快照新建；旧表现字段仍与 `o.fx` 双发；客户端不是 `FX_FIELDS` 表驱动；`dev/check_versions.py` 没有 `fx` 键一致性检查；没有 `nextEntityId()` |
| 4 | ⏳ | 无 | `LocalServer.step` 仍是 8 段过程式脚本；`1/25` 字面量仍至少 5 处；`hurtT = 0.3` 仍至少 4 处；`_combatTick` 未拆 |
| 5 | 🟡 | Stage 0 已修正花瓣/生物数量、模块表、重复变更记录、硬规则措辞 | `exit.js` 头部仍是旧版长注释；`entities.js Mob.draw` 等失效引用仍在；`AGENTS.md` 还没有 `5.3.1 实体生命周期契约`；注释四类清理未开始 |

**一句话结论**：引擎的"骨架"已经搭好（`EntityFX` / `EntitySet` / `o.fx` / `Map` 索引），但"强制所有调用点走同一条路"还没有发生；Stage 1 与 Stage 3 的收尾是当前最值得继续做的部分。

---

## 1. 结论

项目**不缺模块划分**（`sim/* / net/* / render/* / ui/*` 这一层已经够用，也确实不该再动），
缺的是**每个横切关注点只有一条入口**。

现在"实体怎么出现、怎么消失、怎么被绘制、怎么进快照"这四件事仍有 2~4 套并行实现，
所以每加一个实体，就要在同一批坑里再踩一次。本方案围绕"把每类横切关注点收缩成唯一入口"来做。

### 1.1 现状（按当前代码重新核对）

| 关注点 | 当前实现数量 | 证据（按当前代码） |
|---|---|---|
| 出场动画 | **3 套** | `spawnFade` / `spawnPop`（`sim/constants.js`）；`DropCard` 自己的 `popT` + `easeOutBack`（`c1=1.10158`，`sim/drops.js`）；`drawWebList` 自己的 `grow/over`（`render/render-util.js`） |
| 退场动画 | **4 套** | `EntityFX.despawn/tickEntity`（`sim/exit.js`，`ExitFX` 兼容层）；生物 `dead + deathTimer + ExitFX.tick`（`sim/mob.js`）；花瓣幽灵 `petalGhosts` 手工 `age` + `filter`（`sim/player.js`）；`DropCard.fade/done`（`sim/drops.js`） |
| 实体表 / 镜像容器 | **多套** | `server.fields`（`createEntitySet`）、`player.netWebs`、`player.webFields`、`player.petalGhosts`（普通数组）、`server.hornetProjectiles` / `game.hornetProjectiles`（`Map`）、`game.mobViews`（`Map`） |
| 红闪时长 | **多套** | `EntityFX.hurt/hurtAlpha`（`ENTITY_HURT_T=0.3`）；`server.js` 仍有 4 处直接 `hurtT = 0.3`；`Player.hurt` 直接写 `0.3` |
| 25 tick/s | **多处** | `SNAP_DT`（`net/protocol.js`）、`MOB_TICK_S` / `PETAL_NET_SYNC`（`sim/constants.js`）、`server.js` 内至少 5 处 `1 / 25` 字面量 |
| 快照字段清单 | **两份手写** | 服务端 `_fillEnts` 同时下发旧字段与 `o.fx`；客户端 `_applySnap` 同时读 `e.fx` 与旧字段作为兼容 |
| 统一绘制入口 | **已定义但未使用** | `EntityFX.draw(ctx, ent, paint)` 存在，但全项目 **0 调用点**；`Mob.draw` 仍手写 `spawnFade × spawnPop × ExitFX.scale/alpha` |

`EntityFX.state()` 这个"统一状态读取口"写好了，但目前只被 `ExitFX.alpha/scale` 兼容层间接调用；
`Mob.draw`、`player.drawWebs`、`DropCard.draw`、`MobFX.drawMissileAt` 仍各自手算 alpha/scale。
这就是"新引擎已存在、旧调用点没迁移、于是两套都在维护"的典型症状。

---

## 2. 七个结构性问题（按"能一劳永逸解决多少 bug"排序）

### P0 · 实体生命周期没有单一真相（🟡 部分解决）

**现状**：一个实体身上仍可能同时有 `dead` / `deathTimer` / `exiting` / `exitT` / `exitDur` /
`exitAlpha` / `exitScale` / `age` / `hurtT` / `flash`。

- `EntityFX` 已成为 `exit.js` 的主实现，`ExitFX.begin/tick/done/alpha/scale/sweep` 全部委托给它；
  `EntityFX.hurt` 已用于 `Mob.hurt`，`EntityFX.despawn` 已用于服务端召唤物/花粉/网、玩家网/花瓣。
- 但 `EntityFX.spawn()` **只由 `createEntitySet.add()` 调用**；`Mob` / `Player` / 花瓣 / 掉落卡的构造函数
  仍手写 `age/exiting/exitT/...`，没有走统一创建入口。
- `EntityFX.state()` 只被兼容层间接调用；`EntityFX.draw()` **全项目 0 调用点**，
  `Mob.draw` 仍手写 `spawnFade × spawnPop × ExitFX.scale/alpha`。
- `deathTimer` 仍在 `Mob` / `Player` / 快照 / 客户端里；旧 `exit.js` 里 `deathTimer = exitT` 的反向同步
  已删除，但两套计时并没有合并。
- 回收点仍分裂：`fields.sweep`、`player.netWebs.sweep`、`game._tickMobViews` 的手工 `keep` 循环（0.25s 节流）、
  `player.petalGhosts.filter`、`DropCard.done`。

**为什么这是结构问题，不是小脏**：

- 渲染方必须**自己记得**把入场 alpha、入场 scale、退场 alpha、退场 scale、红闪 alpha 相乘。
  少乘任何一个没有任何机制会报错 —— 只会"这个新实体看起来怪怪的"。
- 回收点每多一个容器，就多一个"忘了推进退场计时"的机会 —— 客户端屏外生物退场播不完就是这一类。

**目标**：一个 `EntityFX`，state 是**引擎算好的一个结果**，渲染只读不算；回收只发生在一个
`EntitySet.tick()` 里。

### P1 · 同一个世界状态有多个镜像容器（🟡 客户端网已收口）

**已完成（Stage 0 / Stage 2）**：

- `game.mobWebs`、`_fieldCtx().addWeb`、`_drawMobWebs`、Legend+ 蜘蛛的本地补网影子已删除。
- 真正的网数据在 `p.netWebs`（`game.js` 的 `_applySnap` 从快照建）；本地减速与 F3 网圈都已改读它。
- `render-util.js` 的 `drawWebList` 不再跳过 `exiting`，退场动画可见。
- 服务端 `server.fields` 成为场地型实体唯一来源，`_snapWebs` 只遍历它。

**剩余**：

- `player.webFields` 仍作为客户端"还没收到快照"时的兜底（`drawWebs` / `resetForSpawn` / `_tickWebs`）。
- `drawWebList` 仍是独立绘制 pass，没有并入实体绘制。
- 玩家网 id 仍是 `'p'+seq`，敌方网是 `nextId++`；没有 `world.nextEntityId()` 统一命名。

**根因**：不是漏改，是**同一份状态允许存在多个容器**。只要容器数量 > 1，就一定会漂。

**目标**：网只有一份 —— 服务端 `world.fields`，客户端 `p.netWebs`。任何"我要读网"的地方只有这一个名字。

### P2 · 服务端 `step()` 是过程式脚本，顺序靠注释保证（⏳ 未解决）

`LocalServer.step` 仍是 8 个编号段落，段落之间有**方向性依赖**
（链解算必须在最后、`_fieldTick` 必须在坐标定稿后、`_bumbleTick` 必须在最后）。
目前这个约束只写在注释里，谁插一段进去就悄悄错。

**目标**：`STEP_SYSTEMS` 显式数组 + 每个系统一个方法，顺序是数据不是注释；开发期断言方法存在。
行为零变化，纯搬移。

### P3 · 快照协议是两份手写字段清单（🟡 部分解决）

新增一个表现字段，仍可能同时要改：`mob.js`（字段产生）、`server._fillEnts`（下发）、
`game._applySnap`（回填）。目前 `o.fx` 只做到"多了一个入口"，没有做到"唯一入口"：

- `_fillEnts` 同时下发旧字段（`hurtT/flash/squash/deathTimer/deathRot/ultActive`）与 `o.fx`；
- `_applySnap` 同时读 `e.fx` 与旧字段，是显式 `if`，不是 `FX_FIELDS` 表驱动；
- `dev/check_versions.py` 没有 `fx` 键集合一致性检查。

已修 / 已改善的部分：

- `_snapWebs()` 不再使用 `'w' + out.length` 下标兜底，改为下发实体自己的 `netId`；客户端按 id 对齐。
- `hornetProjectiles` 服务端改为 `Map<id, projectile>`，`_fillHornetProjectiles()` 复用 `_projectileBuf`；
  客户端同样按 id 复用对象，删掉了旧数组的 `old.find` O(n²) 查找。
- 客户端 `netPetals` 改为复用 `Map<number, state>`，数字键 `slot*1e6 + sub*1e3 + gen`，每次快照 `clear()`。

仍未完成的具体问题：

- `_snapPetals` 每快照 `new` 对象，且每槽 `for (const b of p.petals)` 判 `has` —— O(slots×petals)。
- `_fillEnts` 里每只生物的 `o.hornetProjectiles` 仍 `.map()` 新对象；`o.fx` 也是每快照新建对象。
- 没有 `world.nextEntityId()`；玩家网仍是 `'p'+seq`，与敌方网的单调数字 id 混用。
- `dev/check_versions.py` 尚未增加 `fx` 键集合检查。

**目标**：`SNAPSHOT_SCHEMA` 表驱动；表现字段统一收进 `ent.fx`（一个小对象，池化），快照只搬 `fx`；id 全局单调。

### P4 · 渲染 pass 没有统一入口（⏳ 未解决）

`render()` 里仍是手工多段绘制；`EntityFX.draw` 定义了但没有调用点。
`drawWebList`、`Mob.draw`、`DropCard.draw`、`MobFX.drawMissileAt` 各自计算 alpha/scale。
尸体走 `_drawCorpses`，花瓣在世界绘制里混着画。

**目标**：`drawWorld(kind, ent)` 由 `EntityFX.draw` 统一包装（save/translate/scale/alpha/restore），
渲染顺序按 kind 表排。这样"退场中的实体画不画"只有一个答案（**画**）。

### P5 · 常量与曲线重复（🟡 部分解决）

- 弹入过冲常数仍至少 3 个不同值（`1.70158` / `1.10158` / `0.16`）。
- `PETAL_GHOST_T = 0.1` 与 `FADE_T = 0.1` 同值两名（Stage 0 已删 `PETAL_GHOST_T`）。
- `WEB_POP_T` 是"入场时长"，却和 `FADE_T` 分开管。
- `1/25` 仍至少 5 处（`server.js` 内的 `1 / 25` 字面量 + `SNAP_DT` / `MOB_TICK_S` / `PETAL_NET_SYNC`）。
- `0.3` 红闪仍至少 4 处（`server.js` 的直接赋值）+ `Player.hurt` 的 `0.3`。

### P6 · 死代码与文档漂移（🟡 部分解决）

Stage 0 已删除：`EntityFXLegacy`、`MobFX.clientEnd`、`TEMP PROFILE`。
Stage 0 已修正：`AGENTS.md` 的 19 花瓣 / 6 生物 / 6 可生成、模块表补齐、
三份重复的 `2026-11-09` 记录合并、实体硬规则措辞。

仍存在：

- `js/entities.js` 已是空壳，但注释里仍有"见 `entities.js` `Mob.draw`"（实际在 `sim/mob.js`）。
- `server.js` 里仍有"见 entities.js Mob.draw"的注释。
- `exit.js` 头部仍是旧版长注释（约 17 行，含文件头与常量说明两段），没有压缩成第 6 节约定的 8 行。
- `AGENTS.md` 还没有 `5.3.1 实体生命周期契约`。
- 本文件此前把 Stage 1~3 写成"待做"或"已完成"，与实际代码不一致；本次已按调用点重新核对。

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

**当前实现状态**：

- `ent.age / hurtT / flash / exitT / exitDur / fx` 已存在并由 `EntityFX` 维护（`fx` 懒算缓存）。
- `ent.kind` 尚未落地；目前是 `ent._kind`，且只由 `EntityFX.spawn()` 写入，而 `Mob/Player/花瓣/掉落卡`
  大多没走 `spawn()`。
- `ent.state` 尚未落地；当前用 `ent.exiting` 布尔值。
- `ent.dead` 已降级为业务语义（"别再打我/结算我"），但 `deathTimer` 仍与 `exitT` 并存。

`ent.dead` **降级为业务语义**（"我已经死了，别再打我/结算我"），不再兼任表现计时。
`deathTimer` 删除，由 `exitT` 取代（快照字段一起改）—— **这一条尚未完成**。

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

**当前实现状态**：

- 已实现：`spawn / tickEntity / tickList / hurt / despawn / done / progress / visual / draw / advanceExit`。
- 未实现：`finished`（用 `done` 代替）、单实体 `tick`（用 `tickEntity` 代替）。
- `ExitFX` **仍然存在**，作为兼容层委托给 `EntityFX`；`Mob.draw`、`drops.js`、`drawWebList`、
  `mob-fx.js` 等旧调用点仍在用它。
- `EntityFX.draw` 已实现，但 **0 调用点**。

**`ExitFX` 整体删除**，不再保留别名。所有 `ExitFX.begin/done/sweep/tick/alpha/scale`
调用点一次性迁移到上面六个方法（迁移表见 4.2）—— **这一条尚未完成**。

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

**当前实现状态**：包装器已写好，但**没有任何实体通过它绘制**。因此
"新增实体 = 调 `EntityFX.draw` → 必然有入场、退场、渐显渐隐"这个保证还没有生效。

入场曲线也统一（用户明确要求：入场也要通用，不只是退场）：

```js
EntityFX.registerKind('mob',   { enter: 'pop',    enterT: 0.10, exit: 'growFade' });
EntityFX.registerKind('web',   { enter: 'spring', enterT: 0.18, exit: 'growFade' });
EntityFX.registerKind('drop',  { enter: 'pop',    enterT: 0.10, exit: 'fade', exitT: 0.5 });
EntityFX.registerKind('petal', { enter: 'pop',    enterT: 0.10, exit: 'growFade' });
```

`registerKind` 与 `KINDS` 已存在；但曲线参数并没有全部私有化：
`FADE_T / DEATH_SCALE / spawnFade / spawnPop / deathFade` 仍在 `sim/constants.js` 里全局导出，
`WEB_POP_T / DROP_POP_T / DROP_DESPAWN_T` 也仍在各自文件使用。
目标仍是把曲线参数收进注册表，外部只读 `kind`。

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

**当前实现状态**：

- `createEntitySet(kind)` 已实现，`createExitList` 是它的旧别名。
- 已使用：`server.fields`、`player.webFields`、`player.netWebs`。
- 未使用：`server.ents`（普通数组）、`player.petals`（普通数组）、`petalGhosts`（普通数组）、
  `game.mobs`（普通数组）、掉落卡列表。
- 没有 `onRemove(fn)` 与 `find(id)`（只有 `find(predicate)`）。

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
（缺一个就报错）。**"加字段忘了下发"从"人肉纪律"变成"CI 失败"**。

**当前实现状态**：`o.fx` 已下发，但旧字段仍在；客户端是显式 `if` 回填，不是 `FX_FIELDS`；
`check_versions.py` 没有这条规则；`o.fx` 每快照新建，未池化。

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

**当前实现状态**：未实现。`LocalServer.step` 仍是 8 段过程式代码。

---

## 4. 分阶段实施

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | 死代码 + 已确认 bug + 文档数字 | ✅ 已完成 |
| 1 | 实体引擎收口（核心） | 🟡 部分完成 |
| 2 | 网与场地实体单源 | 🟡 基本完成 |
| 3 | 快照与协议 | 🟡 部分完成 |
| 4 | 服务端系统化 | ⏳ 未开始 |
| 5 | 注释与文档 | 🟡 部分完成（仅 Stage 0 顺带项） |

### 4.1 Stage 0 · 清死代码 + 修已被证实的 bug ✅

| 文件 | 改动 | 核对 |
|---|---|---|
| `js/net/server.js` | 删 `step()` 里的 `TEMP PROFILE`（`_prof` / `_mk` / 8 次 `performance.now()`） | ✅ 无残留 |
| `js/game.js` | 删 `this.mobWebs`、`_fieldCtx()`、`_drawMobWebs()`、Legend+ 蜘蛛的本地补网块、`MobFX.clientEnd` 调用；`_applySnap` 的大招注释改为"只镜像 ultActive"；本地网减速与 F3 网圈改读 `p.netWebs` | ✅ 无 `mobWebs`；减速/F3 读 `netWebs` |
| `js/render/render-util.js` | `drawWebList` 不再跳过 `exiting`（只跳过完全透明的），网退场动画可见 | ✅ |
| `js/mob-fx.js` | 删 `clientEnd`（死接口，返回 `null`） | ✅ 无残留 |
| `js/sim/exit.js` | 删 `EntityFXLegacy` 死别名 | ✅ 无残留 |
| `js/sim/constants.js` + `js/sim/player.js` | 删 `PETAL_GHOST_T`，4 处引用改 `FADE_T` | ✅ 无残留 |
| `AGENTS.md` | 花瓣 14→19、生物 5→6、删"3 种"矛盾句、补 3 个模块、合并重复变更记录、硬规则改 `EntityFX` 口径 | ✅ 已修（本次再补状态口径） |

**当时记录的验收结果**：`python dev/check_versions.py` → 42 脚本、0 错误；浏览器控制台无报错；
站在蛛网上移速下降（本地预测与服务端一致）；F3 能看到网虚线圆；网到期为渐大渐隐。
（本次环境没有可用的 Python，未重新执行该命令；上面是仓库记录值。）

### 4.2 Stage 1 · 实体引擎收口（核心，🟡 部分完成）

**`js/sim/exit.js` 已完成的部分**：`EntityFX`（3.2）+ `registerKind`（3.3）+ `createEntitySet`（3.4）。
`ExitFX` 尚未删除，仍作为兼容层。

**已完成的小步迁移**：

- `Mob.hurt` → `EntityFX.hurt(this)`。
- 服务端召唤物死亡、花粉寿命到期、蛛网到期 → `EntityFX.despawn(...)`。
- 玩家网到期、玩家花瓣碎裂 → `EntityFX.despawn(...)`。
- 客户端全局 Hornet 弹体计时 → `EntityFX.tickEntity(...)`。

**逐调用点迁移清单**：

| 调用点 | 当前代码 | 目标 | 状态 |
|---|---|---|---|
| `sim/mob.js` `draw()` | `spawnFade × spawnPop × ExitFX.scale/alpha` | `EntityFX.draw(ctx, this, paint)`，内部读 `ent.fx` | ❌ 未迁移 |
| `sim/mob.js` `hurt()` 死亡 | `dead=true; deathTimer=0; ExitFX.begin(this)` | `dead=true; EntityFX.despawn(this)` | ❌ 仍用 `ExitFX.begin` |
| `sim/mob.js` `update()` 死亡 | `ExitFX.tick(this, dt)` | `EntityFX.tickEntity(this, dt)` | ❌ |
| `game.js` 中 10 处 `ExitFX.begin` / `_exitBegan` | 各自手工去重 | `EntityFX.despawn`（幂等，删掉 `_exitBegan`） | ❌ |
| `game.js` 独立实体推进 | `EntityFX.tickEntity` / `ExitFX.tick` 混用 | 统一 `EntityFX.tickEntity` | 🟡 部分 |
| `sim/player.js` 网退场 + 幽灵 | `EntityFX.despawn({ghost})` + `petalGhosts.push` | 只 `despawn`，幽灵机制删除 | 🟡 仍推 `petalGhosts` |
| `sim/player.js` 幽灵推进 | `filter(g => g.age < FADE_T)` | 删除（实体自己走 `EntitySet.tick`） | ❌ |
| `sim/player.js` 手算 alpha/scale | `deathFade / spawnFade / spawnPop` | 全部改 `EntityFX.draw` | ❌ |
| `sim/player.js` `_killPetalBody` | 三分支各自决定"怎么消失" | 分支只决定**是否进 reload**，消失一律 `EntityFX.despawn` | 🟡 已用 `despawn`，仍推幽灵 |
| `sim/drops.js` | 自建 `popT/fade/done` + 自算曲线 | `EntityFX.spawn/tick/despawn/draw` | ❌ |
| `render/render-util.js` `drawWebList` | 自算 `pop/over/ex/ea` | 遍历 `EntitySet` + `EntityFX.draw` | ❌ |
| `mob-fx.js` 尾针 alpha | `spawnFade(...)` + `ExitFX.scale/alpha` | `EntityFX.draw` | ❌ |
| `EntityFX.spawn` | 只被 `createEntitySet.add()` 调用 | `Mob/Player/花瓣/掉落卡` 创建时统一调用 | ❌ |
| `deathTimer` | `Mob` / `Player` / 快照 / 客户端仍在用 | 删除，统一 `exitT` | ❌ |

**验收（尚未满足）**：

- 生物出场 0.1s Q 弹 + 渐显；死亡 1.5 倍渐隐；与改造前逐帧观感一致（录屏对比）。
- 花瓣碎裂不再有"第二套幽灵"重影。
- 屏外生物死亡后 0.1s 内从 `mobViews` 消失，不再残留。
- 蛛网 / 玩家网 / 掉落卡 / 尾针四种实体的出场退场曲线肉眼一致。
- F3 花瓣血条/状态正常；30s 无报错。

### 4.3 Stage 2 · 网与场地实体单源（🟡 基本完成）

1. ✅ 服务端：`player.webSink = server.fields`；`server.fields = createEntitySet('web')`；
   `_snapWebs` 只遍历它；`_fieldTick` 统一计时/退场/施加状态（按 `owner` 区分玩家网/敌方网）。
2. ✅ 客户端：`p.netWebs` 是快照网的容器（`createExitList` = `createEntitySet` 别名）；
   `_applySnap` 按 `netId` 做 upsert + 缺失项退场。
3. ✅ 减速/状态：服务端 `_fieldTick` 一份；客户端 `Game` 读 `p.netWebs`。
4. 🟡 F3 虚线圆已读 `p.netWebs`；`drawWebList` **尚未删除**（仍是独立绘制）。
5. 🟡 `'m'+seq` / `'w'+index` 已删除；玩家网的 `'p'+seq` 仍在；`world.nextEntityId()` 尚未实现。

**验收**：玩家网与蜘蛛网同时存在、同时到期、同时减速 —— 功能上已满足；
F3 圆与画面基本重合；一张网到期不影响其它网的 id 对齐 —— 已满足。
代码层的"绘制 pass 合并 / id 统一 / webFields 兜底删除"仍未完成。

### 4.4 Stage 3 · 快照与协议（🟡 部分完成）

1. ❌ `world.nextEntityId()` 单调 id：未实现。生物/敌方网/弹体用 `this.nextId++`，
   玩家网仍用 `'p' + this._webSeq`。
2. 🟡 `_fillEnts` 表现字段收进 `o.fx`：已加 `o.fx`，但旧字段仍双发；`_applySnap` 是显式回填，
   不是 `FX_FIELDS` 表驱动。
3. 🟡 `_snapPetals` 池化：未做；`has` 检查仍按槽扫全部花瓣；客户端 `netPetals` 已完成
   `Map<number, state>` + 数字键 + `clear()` 复用。
4. 🟡 `hornetProjectiles`：服务端 `Map` + `_fillHornetProjectiles` 复用缓冲已完成；
   客户端视图 `Map` 按 id 复用已完成；但 `_fillEnts` 里每只生物的 `o.hornetProjectiles` 仍 `.map()` 新对象。
5. ❌ `dev/check_versions.py` 增加 `fx` 键集合一致性检查：未做。

**验收**：连续 60s `performance.memory` 无单调增长；F3 `snapCount` 稳定；
尾针发射/回收全程不闪、不残留 —— **尚未验证**。

### 4.5 Stage 4 · 服务端系统化（⏳ 未开始）

1. `step()` 拆成 11 个 `sys*` 方法（3.6），`STEP_SYSTEMS` 常量。
2. 每个方法开头一行注释说明"输入依赖 / 输出影响哪一步"。
3. 链的解算顺序写成 `sysChains` 在数组里的位置，不再靠注释。
4. 可选：`_combatTick`（约 280 行）再拆 `_combatPetals / _combatMobs / _combatContact`。
5. `1/25` 统一引用 `SNAP_DT`；`s.hurtT = 0.3` / `b.hurtT = 0.3` / `projectile.hurtT = 0.3`
   改 `EntityFX.hurt(...)`。

**验收**：同 seed + 同输入序列，`Game.stepFrames(600)` 前后快照 diff 一致。

### 4.6 Stage 5 · 注释与文档（🟡 部分完成）

见第 6 节。Stage 0 已完成其中的数字修正、模块表补齐、重复记录合并；
注释重写、失效引用清理、`5.3.1` 契约仍未做。

---

## 5. Bug 类 → 根治点 对照表

| 现象 | 现在的根因 | 当前状态 |
|---|---|---|
| 蛛网"啪"一下消失 | `drawWebList` 跳过 `exiting` | ✅ Stage 0 已修 |
| 站在网上本地不减速 / F3 看不到网 | 读空的 `game.mobWebs` / 读空的 `p.webFields` | ✅ Stage 0 已修（改读 `p.netWebs`） |
| 图例+蜘蛛的网画两遍 | 本地补网影子 + 服务端下发 | ✅ Stage 0 已修 |
| 新实体忘了渐显渐隐 | 没有强制绘制 wrapper | ❌ Stage 1（`EntityFX.draw` 仍 0 调用点） |
| 花瓣碎裂有双重渐隐残影 | `petalGhosts` 第二套 | ❌ Stage 1（`petalGhosts` 仍在） |
| 屏外生物退场播不完 / 永远回收不掉 | 退场计时不在统一 tick 里 | 🟡 表现已修（`_tickMobViews` 先推进 `exiting`），结构收口待 Stage 1 |
| 尾针发射后残留一根针 | 占位对象没走统一退场 | ✅ Stage 3 热修（按 id 复用/清占位），统一退场仍待 Stage 1 |
| 网的 id 下标漂移 → 张冠李戴 | `'w'+index` 兜底 | ✅ 已改为实体 `netId`；玩家网仍 `'p'+seq`，统一 id 待 Stage 3 |
| 加表现字段客户端看不到 | 两份手写字段清单 | 🟡 `o.fx` 入口已有；双清单/兼容分支仍在，静态检查待 Stage 3 |
| 每帧 GC 尖峰、帧率掉 | 快照/镜像每帧分配 | 🟡 `netPetals` / `hornetProjectiles` / `_fillEnts` 已改善；`_snapPetals`、`o.fx`、per-mob 弹体仍分配 |
| 服务端顺序被后续改动破坏 | 过程式 step | ❌ Stage 4 |

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
4. **解释"为什么必须有这个模块"的长篇**（`exit.js` 头部约 17 行）→ 压缩成 8 行，细节进 AGENTS.md。

示例（`exit.js` 头部约 17 行 → 8 行）：

```js
// sim/exit.js — 实体生命周期引擎（无 DOM，可在 Node 加载）
//
// 契约：
//   spawn → tick → despawn → finished，回收只发生在 EntitySet.tick 里。
//   渲染必须走 EntityFX.draw(ctx, ent, paint)：入场/退场/渐隐由引擎统一施加。
//   业务代码不得写 ent.fx / exitT / exitDur，也不得 splice 实体表。
//   绕过引擎直接删元素 = 实体凭空消失，全项目禁止。
```

**当前完成情况**：

- ✅ `AGENTS.md` 数字修正（19 花瓣 / 6 生物 / 6 可生成）。
- ✅ 模块表补 `sim/status.js`、`sim/crb.js`、`render/spider-gait.js`，删 `selftest` 相关行。
- ✅ 三份重复的 `2026-11-09` 记录合并成一份。
- ❌ 新增 `5.3.1 实体生命周期契约`（写 Stage 1 定下的六条规则）—— 未做；当前仍是 5.3 的硬规则框。
- ❌ `exit.js` 头部压缩到 8 行 —— 未做。
- ❌ `entities.js Mob.draw`、`server.js` 同款失效引用 —— 未清。
- ❌ 第 1 类"考古叙事"与第 2 类"重复"注释的大规模清理 —— 未做。

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

---

## 附：本次核对的关键判据

- `EntityFX.draw` 全项目 0 调用点（`Select-String` 仅命中 `exit.js` 自身注释与定义）。
- `EntityFX.spawn` 仅由 `createEntitySet.add()` 调用；`Mob/Player/花瓣/掉落卡` 构造函数未调用。
- `ExitFX` 仍在 `game.js`、`mob.js`、`player.js`、`server.js`、`mob-fx.js`、`render-util.js` 使用。
- `deathTimer` 仍在 `Mob`、`Player`、`_fillEnts`、`_applySnap`、`Player.draw` 使用。
- `petalGhosts` 仍在 `player.js` 的死亡、卸下、碎裂、网到期路径中 `push` 与 `filter`。
- `_snapPetals` 仍每次 `new` 对象；`_fillEnts` 每只生物仍新建 `o.fx` 与 `o.hornetProjectiles` 数组。
- `server.fields` / `p.netWebs` 单源已落地；`drawWebList` 与 `player.webFields` 仍未移除。
- `LocalServer.step` 仍是 8 段过程式代码，没有 `STEP_SYSTEMS`。
- `dev/check_versions.py` 没有 `fx` 键集合检查。
