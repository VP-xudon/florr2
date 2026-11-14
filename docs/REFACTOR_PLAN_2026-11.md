# florr2 架构与关键契约

本文描述运行时代码的组织方式、每个横切关注点的唯一入口，以及改动时必须同时满足的约束。
不记录开发过程；行为与数值以代码为准。

---

## 1. 分层

```
index.html            按固定顺序加载全部脚本（经典脚本，共享全局作用域）
js/main.js            启动引导：资源清单 → 地图 → Game → 后台加载素材
js/game.js            主循环、输入、相机、渲染、快照镜像、掉落拾取
js/net/*              协议 / 权威世界 / 客户端网络门面
js/sim/*              纯模拟：玩家、生物、掉落、物理、状态、生命周期
js/render/*           通用绘制工具与一次性特效
js/ui/*               DOM 覆盖层：窗口、拖拽、悬浮框、小地图、触控、调试屏、Boss 条
js/map.js             Tiled 地图解析、碰撞、瓦片与小地图位图
js/data.js            由 registry 构建类型表与数值
js/*-fx.js            花瓣能力（PetalFX）、生物特性（MobFX）
assets/               注册表、语言包、预制碰撞轮廓、地图与素材
```

`js/sim/*` 与 `js/net/server.js` 不依赖 DOM；除渲染与 UI 外都可在 Node 中加载。

---

## 2. 实体生命周期（`js/sim/exit.js`）

所有实体（生物、花瓣、蛛网、掉落卡、弹体、召唤物）的出现与消失共用一条通道：

```js
EntityFX.spawn(ent, kind);      // 创建或复活：入场计时从 0 开始
EntityFX.tickEntity(ent, dt);   // 单实体计时（不进容器的实体）
list.sweep(dt);                 // 容器内计时 + 唯一常规回收点
EntityFX.despawn(ent, opt);     // 唯一离场入口（幂等，opt.dur 可覆盖时长）
EntityFX.done(ent);             // 退场播完
EntityFX.visual(ent);           // { alpha, scale, exiting, hurt }
EntityFX.draw(ctx, ent, paint); // 唯一绘制入口：translate/scale/alpha 由引擎施加
EntityFX.hurt(ent, dur);        // 红闪
EntityFX.hurtAlpha(ent, maxA);
EntityFX.drawHurt(ctx, ent, x, y, r, maxA);
EntityFX.drawHurtPoly(ctx, ent, hull, size, x, y, rot, maxA);
EntityFX.pop(age);              // 主角脸部的入场 Q 弹
```

不变量：

- 入场与退场曲线只存在于 `KINDS` 表，外部只读 `visual()`；新增种类 = 加一行。
- 一律禁止用 `splice / pop / filter / length = 0` 直接删除实体。普通数组若必须过滤，
  判据只能是 `EntityFX.done(x)`。
- 退场计时每帧推进，屏幕外也不例外；实体从快照中消失时必须补一次 `despawn`。
- `dead` 是业务标记（停止结算），不承担表现计时；表现计时归引擎。
- 花瓣等可复活的实体现世后再入场时，用 `petalExit.reclaim(ent)` 取消本次离场并重新 `spawn`。

受控容器 `createEntitySet(kind, idGen?)`：

| 成员 | 语义 |
|---|---|
| `add(e)` | `spawn` + 可选分配 `netId` |
| `adopt(e)` | 收养已在退场中的实体，不重置退场 |
| `reclaim(e)` | 取消离场并重新入场（复活） |
| `sweep(dt)` | 推进并移除播完的实体 |
| `length / get / forEach / find / 迭代器` | 只读访问 |

内部数组封闭在闭包内，不提供 `push / splice / pop / clear`。
使用点：`server.fields`、`player.netWebs`、`player.petalExit`。

---

## 3. 快照协议（`js/net/protocol.js`）

表现字段只声明一次：

```js
const FX_FIELDS = {
  hurt:  { merge: 'max',  as: 'hurtT',     get: (m) => m.hurtT || 0 },
  exitT: { merge: 'max',  as: 'exitT',     get: (m) => m.exitT || 0 },
  ult:   { merge: 'bool', as: 'ultActive', get: (m) => (m.ultActive ? 1 : 0) },
};
```

- 服务端 `_fillEnts` 按 `get()` 写入母体自带的池化对象 `m._snapFx`。
- 客户端 `_applySnap` 按 `merge` 回填视图实体（`max` 取较大值，避免 25Hz 快照压平红闪）。
- 加字段只改这一处；`dev/check_versions.py` 校验声明唯一且客户端不绕过表读取。

对象池：

| 池 | 位置 |
|---|---|
| `_entBuf` + 每只母体的 `_snapFx / _snapMissile` | `_fillEnts` |
| `_petalBuf` | `_snapPetals` |
| `_webBuf` | `_snapWebs` |
| `_projectileBuf` | `_fillHornetProjectiles` |

池化对象只在本步内有效。`LocalNet` 同步消费；`WebSocketNet` 在发送前序列化。
任何模块不得把快照对象或数组留到下一帧。

花瓣身份键 `petalNetKey(slot, sub, gen)` 是服务端快照与客户端匹配的唯一键。

---

## 4. 权威步进（`js/net/server.js`）

```js
const STEP_SYSTEMS = [
  'sysPlayer',    // 输入、检查点、召唤物跟随、多体卡重装填
  'sysMobs',      // 醒睡分区、AI、移动、退场回收、弹体
  'sysSpawn',     // 人口维持
  'sysPush',      // 玩家↔生物、生物↔生物、Wax、召唤物
  'sysCombat',    // 25 tick/s 战斗
  'sysChains',    // 刚性链解算与玩家顶出
  'sysFields',    // 场地实体状态与寿命
  'sysMobTraits', // 物种特性产出
];

step(dt) {
  this.t += dt;
  for (const name of STEP_SYSTEMS) this[name](dt);
}
```

顺序即契约：`sysChains` 必须在所有改坐标的步骤之后，`sysFields` 在坐标定稿之后，
`sysMobTraits` 最后。新增一步 = 数组加名字 + 同名方法。

醒睡分区：`this.ents` 是全图人口，`this._act` 是近处醒着的个体，`this._rest` 是休眠个体。
`sysMobs` 每步重建 `_act / _awake`，其余系统只遍历 `_awake`。

实体 id：`LocalServer.nextEntityId()` 是唯一来源；子实体使用 `父 id + ':missile:' + 序号` 形式，
两端可复现，不进入世界人口表。

---

## 5. 场地实体与网

- 权威：`server.fields`（`createEntitySet('web', idGen)`），玩家网与蜘蛛网共用。
- 镜像：`player.netWebs`，只由快照 `snap.webs` 建立，`Player.update` 中 `sweep` 推进。
- `Player.spawnWeb()` 仅在 `LocalServer` 注入 `webSink` 时生效；客户端调用返回 `null`，
  无法本地生成带减速效果的网。
- 状态施加在 `sysFields`（`_fieldTick`），按 `owner` 区分玩家与生物。

---

## 6. 常量归属

| 常量 | 位置 |
|---|---|
| `SNAP_HZ = 25` / `SNAP_DT = 1/25` | `js/sim/constants.js` |
| 实体入场/退场/红闪曲线 | `js/sim/exit.js` 私有 |
| 无敌时长与淡入 | `InvulnFX`（`js/sim/constants.js`） |
| 击退份额与总位移 | `js/sim/constants.js` |
| 生物体型/速度倍率 | `js/sim/mob-shape.js` + `MOB_TRAITS` |

---

## 7. 静态检查

```powershell
python dev/check_versions.py
```

检查项：脚本与资源引用存在、跨文件顶层重名、i18n 键缺失、`index.html` 版本号、
`FX_FIELDS` 单一声明、客户端直接读取 `fx.*`、`1 / 25` 与 `hurtT = 0.3` 字面量。

---

## 8. 注释与文档

只保留两类：

1. 当前功能与接口说明；
2. 难以从代码直接看出的原因、数值来源或几何推导。

不记录改动过程、旧实现对比、调试经历与主观判断。
