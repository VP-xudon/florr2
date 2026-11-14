# florr2 架构评审与重构方案（2026-11）

> 状态核对：2026-11-14（全部阶段落地后复核）。
> **Stage 0 ✅ / Stage 1 ✅ / Stage 2 ✅ / Stage 3 ✅ / Stage 4 ✅ / Stage 5 ✅。**
> 目标：从成熟引擎的视角，把"每个横切关注点只有一条入口"落实到代码里；**不改变现有大文件划分**。
> 阅读顺序：第 0 节（结论/现状）→ 第 1 节（收口后的架构）→ 第 2 节（原问题 → 根治点）→ 第 3 节（验收与遗留）。

---

## 0. 结论

引擎的骨架与"强制所有调用点走同一条路"都已完成：**全项目只有一套实体生命周期、一套快照表现字段表、
一套 25Hz 节奏、一套服务端步进顺序**。旧实现（`ExitFX` 兼容层、`deathTimer`、`petalGhosts`、
`player.webFields`、`entities.js` / `net.js` 空壳）已全部删除，没有留下并行的第二套。

| 关注点 | 收敛前 | 现在（唯一入口） |
|---|---|---|
| 出场 / 退场动画 | 3 套 / 4 套（自算曲线） | `sim/exit.js` 的 `EntityFX`（`KINDS` 注册表） |
| 实体容器 / 回收 | 多套数组 + 各自 `filter` | `createEntitySet(kind)`（内部数组闭包封死） |
| 红闪时长 | `EntityFX.hurt` + 7 处 `hurtT = 0.3` | `EntityFX.hurt / hurtAlpha / drawHurt` |
| 快照表现字段 | 服务端双发 + 客户端手写 `if` | `net/protocol.js` 的 `FX_FIELDS`（get / as / merge） |
| 25 tick/s | `SNAP_DT` / `MOB_TICK_S` / `PETAL_NET_SYNC` / 5 处字面量 | `sim/constants.js` 的 `SNAP_HZ` / `SNAP_DT` |
| 服务端步进顺序 | 8 段编号注释 | `STEP_SYSTEMS` 数组 + 8 个 `sys*` 方法 |
| 场地实体（网） | `server.fields` + `player.webFields` + `game.mobWebs` | 权威 `server.fields` / 镜像 `player.netWebs` |
| 实体 id | `nextId++` + `'p'+seq` + `'w'+index` | `LocalServer.nextEntityId()`（子实体按父 id + 序号） |

---

## 1. 收口后的架构

### 1.1 实体契约（`sim/exit.js`）

```js
// 引擎独占：age / hurtT / exiting / exitT / exitDur / exitAlpha / exitScale / fx / _kind
// 业务独占：hp / x / y / facing / vx / vy / dead（"别再结算我"，不再兼任表现计时）
EntityFX.spawn(ent, kind)      // 唯一创建入口（构造末尾调一次）
EntityFX.tickEntity(ent, dt)   // 单实体计时（不进容器的实体：主玩家、弹体）
EntityFX.tickList(list, dt)    // 表内计时 + 唯一的回收点
EntityFX.hurt(ent, dur)        // 唯一红闪入口
EntityFX.hurtAlpha(ent, maxA)  // 红闪不透明度（maxA 只给"花朵本体比花瓣淡"这一处用）
EntityFX.despawn(ent, opt)     // 唯一离场入口（幂等；opt.dur 覆盖退场时长）
EntityFX.done(ent)             // 退场播完（回收判据）
EntityFX.visual(ent)           // 每帧一次的合成结果 { alpha, scale, exiting, hurt }
EntityFX.draw(ctx, ent, paint) // ★ 唯一绘制入口（translate/scale/alpha 由引擎施加）
EntityFX.drawHurt / drawHurtPoly
EntityFX.pop(age)              // 主角脸部的出场 Q 弹（与实体同一条曲线）
```

曲线参数（`ENTITY_HURT_T` / `ENTER_T` / `EXIT_T` / `DEATH_SCALE` / 四种 enter / 两种 exit）
全部私有在 `exit.js` 内，外部只读 `visual()` 的结果。新增实体类型 = 在 `KINDS` 加一行。

### 1.2 受控实体表（`createEntitySet(kind, idGen?)`）

- `add(e)` → `EntityFX.spawn`；`idGen` 存在时顺便分配全局单调 `netId`。
- `adopt(e)` → 收养"已经在退场中"的实体（不重置退场）。
- `tick / sweep(dt)` → `EntityFX.tickList`，**退场播完才移除，这是唯一的移除路径**。
- 只暴露 `length / get / forEach / find / 迭代器`。**不提供** `push/pop/splice/filter/length=`。
- 使用点：`server.fields`（带 `idGen`）、`player.netWebs`、`player.petalExit`。

普通数组仍然存在（`server.ents`、`player.petals`、`game.mobs`、`game.drops` 等），
但它们**都不是"实体是否存在的真相"**：元素仍然只能由 `EntityFX.done()` 判定后移除，
`filter` 里用的判据就是它（`game.drops` / `ents` 都是这么写的）。

### 1.3 快照表现字段（`net/protocol.js` 的 `FX_FIELDS`）

```js
const FX_FIELDS = {
  hurt:  { merge: 'max',  as: 'hurtT',     get: (m) => m.hurtT || 0 },
  exitT: { merge: 'max',  as: 'exitT',     get: (m) => m.exitT || 0 },
  ult:   { merge: 'bool', as: 'ultActive', get: (m) => (m.ultActive ? 1 : 0) },
};
```

服务端 `_fillEnts` 按 `get()` 写进母体自带的池化对象 `m._snapFx`；客户端 `_applySnap` 按
`merge` 规则回填到视图实体。加字段 = 改这一处，两端都不需要再写第二份清单。
`dev/check_versions.py` 会校验声明唯一性、客户端没有绕过表直接读 `fx.*`。

### 1.4 服务端步进表（`net/server.js`）

```js
const STEP_SYSTEMS = [
  'sysPlayer',    // 玩家权威副本 / 检查点 / 召唤物跟随 / 多体卡重装填
  'sysMobs',      // 醒睡分区 + AI + 移动 + 退场回收 + 弹体（建 this._awake）
  'sysSpawn',     // 人口维持
  'sysPush',      // 玩家↔生物 / 生物↔生物 / Wax / 召唤物 推挤与硬碰撞
  'sysCombat',    // 25 tick/s 战斗
  'sysChains',    // 刚性链解算 + 把玩家顶出链体（必须在所有改坐标的步骤之后）
  'sysFields',    // 场地实体状态与寿命
  'sysMobTraits', // 物种特性（Bumble 产 Pollen）
];
step(dt) { this.t += dt; for (const s of STEP_SYSTEMS) this[s](dt); }
```

顺序即契约，依赖理由写在数组上方与各方法开头。加一步 = 数组加一个名字 + 写同名方法。

---

## 2. 原问题 → 根治点

| 原问题 | 根治点 | 状态 |
|---|---|---|
| P0 实体生命周期没有单一真相 | `EntityFX` 唯一入口 + `createEntitySet` 唯一回收点；`deathTimer` / `petalGhosts` 删除 | ✅ |
| P1 同一状态多个镜像容器 | 网只有 `server.fields` / `player.netWebs`；`player.webFields`、`_tickWebs`、`game.mobWebs` 删除 | ✅ |
| P2 服务端 `step()` 过程式 | `STEP_SYSTEMS` + 8 个 `sys*` | ✅ |
| P3 快照协议两份手写清单 | `FX_FIELDS` 表驱动 + 全量对象池化 + `nextEntityId()` | ✅ |
| P4 渲染 pass 没有统一入口 | 生物 / 花瓣 / 网 / 掉落卡 / 弹体全部走 `EntityFX.draw`（挂载态弹体用 `visual()` + `drawHurt`，因为它要画在父实体坐标系里） | ✅ |
| P5 常量与曲线重复 | 曲线私有在 `exit.js`；`SNAP_HZ/SNAP_DT` 收进 `sim/constants.js` | ✅ |
| P6 死代码与文档漂移 | `entities.js` / `net.js` 删除；`exit.js` 头部 8 行；本文件与 `AGENTS.md` 重写 | ✅ |

### 2.1 本轮顺带修掉的真实 Bug

这些不是"风格问题"，是当时的断链（都会在浏览器里直接表现为报错或功能缺失）：

1. **服务端 `ExitFX is not defined`**：`exit.js` 已不再导出 `ExitFX`，但 `server.js` 仍在
   弹体到期 / 弹体击杀 / 花瓣击杀路径调 `ExitFX.begin/tick/done` → 触发即 `ReferenceError`。
   现全部改 `EntityFX.despawn/tickEntity/done`。
2. **掉落物永不回收、拾取不入包**：`game.js` 用 `d.done` 判定（`DropCard` 没有该字段，恒 `undefined`），
   于是 `filter` 一个都删不掉；同时 `DropCard.update` 里没有任何地方推进 `age`，
   `life` 到期判定永远不成立。现在 `age/exitT` 由 `EntityFX.tickEntity` 推进，
   回收判据是 `EntityFX.done(d)`，拾取入包在"退场播完"时结算。
3. **卸下的花瓣变永久幽灵**：`_syncPetals` 对"已不在装备栏"的实体只 `adopt` 不 `despawn`，
   它既不进 `petals` 也不再计时 → 永远挂在 `petalExit` 里。现在先 `despawn` 再 `adopt`。
4. **场地实体被推进两次**：`_fieldTick` 与 `Player._tickWebs` 各推进一次，网的寿命与退场都按 2 倍速走。
   现在权威侧只有 `_fieldTick`、客户端只有 `netWebs.sweep`。
5. **已碎花瓣被计时两次**：`petals` 的逐实体 tick 与 `petalExit.sweep` 都推进同一个对象，
   退场在 0.05s 就播完了。现在 `petals` 只 tick 未碎的，碎的一律交给 `petalExit`。

### 2.2 明确保留的例外（写进注释，不再是"漏网之鱼"）

- **Hornet 弹体 id** = `父 netId + ':missile:' + 序号`。它是母体的子实体、不进世界人口表，
  两端各自可复现，因此不需要全局 id（`nextEntityId` 的注释里写明了这一条）。
- **挂载态弹体**画在父实体的坐标系里，用 `EntityFX.visual()` + `drawHurt()` 而不是 `EntityFX.draw`
  （后者会把它平移到自己的 `x/y`）。
- **主角不是容器里的实体**：它没有"被回收"的概念，但出场 Q 弹（`EntityFX.pop`）与红闪
  （`EntityFX.hurt / drawHurt`）、计时（`EntityFX.tickEntity`）仍然共用引擎。

---

## 3. 验收与遗留

### 3.1 本轮已核对的静态一致性

- `EntityFX.draw` 调用点：`mob.js`（生物）、`player.js`（花瓣 ×2）、`drops.js`（掉落卡）、
  `render-util.js`（网）。
- 全项目已无 `ExitFX` / `createExitList` / `deathTimer` / `petalGhosts` / `webFields` /
  `_tickWebs` / `mobWebs` / `EntityFX.state` / `advanceExit` 引用。
- 全项目已无 `1 / 25` 字面量与 `hurtT = 0.3` 直接赋值（`dev/check_versions.py` 新增两条规则守住）。
- `index.html` 已移除 `js/entities.js` 与 `js/net.js` 两个空壳脚本，改动过的文件 `?v=` 已 bump。

### 3.2 未完成的验证（环境限制，如实记录）

- **`python dev/check_versions.py` 本次无法执行**：这台机器上的 `python` 只是 Windows Store 的
  占位程序（`python -c "print(1)"` 无输出），也没有 Node。因此新增的检查规则只做了人工等价核对
  （用 `Select-String` 逐条比对），**没有跑过真实脚本**。下次在有 Python 的环境里必须补跑一次。
- **浏览器手测同样未做**：需要在本地 HTTP 服务器下确认
  ① 生物出场/死亡曲线；② 掉落卡堆叠、拾取入包、到期渐隐；
  ③ 蛛网（玩家网 + 蜘蛛网）到期渐大渐隐、F3 虚线圆；④ 花瓣碎裂无重影；⑤ 30s 无控制台报错。
- `_combatTick`（约 280 行）没有继续拆成 `_combatPetals / _combatMobs / _combatContact`：
  它是"每次 25Hz 一次"的单一职责函数，拆开只会让伤害口径多一层间接。

---

## 4. 注释与文档规范（本轮的落地结果）

**只保留三类**：当前契约（≤3 行）、易错点 + 具体数值 + 曾经的现象、数据来源。

**已删除四类**：考古叙事（结论保留、历史进 git / `AGENTS.md`）、跨文件重复（只写在最近的使用处）、
失效数字与失效引用（`见 entities.js Mob.draw` 等）、解释"为什么必须有这个模块"的长篇。

具体动作：

- `sim/exit.js` 头部压缩到 8 行契约（细节在 `AGENTS.md` 5.3.1）。
- 删掉 `entities.js` / `net.js` 两个"只剩注释"的空壳，`index.html` 同步移除。
- 全项目失效引用改为真实位置（`sim/mob.js`、`net/server.js`、`petal-effects.js`、`sim/mob-shape.js`）。
- `AGENTS.md` 新增 `5.3.1 实体生命周期契约`，模块表删除两个空壳，变更记录合并为一节。

---

## 5. 明确不动的部分

- **不改文件划分**：不新建 `engine/`、不拆 `game.js` / `server.js` / `ui.js` / `player.js`。
- **不改 `ui/*`、`cards.js`、`data.js`、`map.js`、`chat.js`**（除注释里的失效引用）。
- **不改玩法数值**。
- **不引入构建链 / 依赖 / 测试框架**；`dev/check_versions.py` 仍是唯一静态检查器。

## 6. 收尾动作（每次改动）

1. `python dev/check_versions.py` → 0 error。
2. 本地 HTTP 打开，控制台无报错，核心玩法手测。
3. 改过的 JS/CSS bump `index.html` 的 `?v=`（只 bump 改到的文件）。
4. `AGENTS.md` 追加变更记录（结论 + 现象 + 涉及文件）。
5. 编码 UTF-8 无 BOM；`.js/.html/.css` 为 CRLF，`.md` 为 LF。
