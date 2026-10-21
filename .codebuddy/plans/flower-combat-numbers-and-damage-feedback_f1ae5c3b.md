---
name: flower-combat-numbers-and-damage-feedback
overview: 修正花朵战斗数值（体伤 20、基础血量 100、受伤红闪、死亡/重生后仇恨豁免）、核对生物护甲实现，并让玫瑰回血弹出 Heal 粉色反馈数字；同时把伤害反馈改成「真实造成的伤害」（秒杀只弹实际掉血），并修复「不管血量多少一碰就死」（invuln 未生效 + 接触伤害 25 tick/s 全量结算）。
todos:
  - id: flower-stats
    content: entities.js：新增 FLOWER_BASE_HP/BODY_DMG/HURT_INVULN 常量，recompute 设 maxHp=100 与 bodyDmg=20，hurt() 增加 invuln 免伤与受伤无敌帧
    status: completed
  - id: mob-hurt-applied
    content: entities.js：Mob.hurt() 改为返回 {applied,killed}，applied 按剩余血量截断
    status: completed
    dependencies:
      - flower-stats
  - id: combat-real-damage
    content: game.js：_combatTick 用 applied 累加 pendDmg，一击毙命时立即弹出累计真实伤害飘字
    status: completed
    dependencies:
      - mob-hurt-applied
  - id: mob-attack-cadence
    content: game.js：生物对玩家与花瓣的伤害改走 m.hitCd 攻击冷却（MOB_TOUCH_CD=0.5s），修复一碰即死
    status: completed
    dependencies:
      - combat-real-damage
  - id: aggro-exempt
    content: game.js：死亡当帧与 respawn() 清空全场 mob.threat，实现重生后仇恨豁免
    status: completed
    dependencies:
      - combat-real-damage
  - id: rose-heal-feedback
    content: petal-effects.js + data.js + ui.js：新增 HEAL_TEXT_COLOR=#ff94c9 与 textSink 钩子，heal() 返回实际回血量，玫瑰回血从花朵弹出粉色飘字
    status: completed
    dependencies:
      - combat-real-damage
  - id: verify-armor-and-bump
    content: 核对生物护甲已参与双方 max(攻-甲,0) 结算并汇报；递增 index.html 各 ?v= 版本号并跑 lint
    status: completed
    dependencies:
      - aggro-exempt
      - rose-heal-feedback
---

## 产品概述
修正 florr.io 复刻项目中「花朵战斗数值 + 伤害反馈」相关的一组缺陷。当前花朵本体没有体伤、受击没有无敌保护导致一碰即死、生物护甲虽已结算但需核对、玫瑰回血无任何反馈、且伤害飘字显示的是"面板伤害"而非"真实造成的伤害"。

## 核心功能
- **花朵数值**：体伤基础值 20；基础血量 100；换卡/重算后数值不被覆盖
- **受击保护**：受伤后进入短暂无敌帧，杜绝"不管血量多少一碰就死"；生物对玩家/花瓣的伤害按攻击节奏（冷却）结算，而非 25 tick/s 全量抽血
- **受伤红闪**：确认保留并生效（花朵受击时本体红色滤镜 0.3s）
- **仇恨豁免**：花朵死亡当帧立即从所有生物的仇恨表（threat）中移除；重生后依然豁免，不会恢复追击
- **护甲核对**：确认生物护甲已参与双方伤害结算（`max(攻-甲, 0)`），并汇报实现方式与数据来源
- **玫瑰回血反馈**：回血时从花朵处弹出飘字，颜色 `#ff94c9`（与 Heal 属性同色），数值为**实际回血量**（不足则按缺口），样式与攻击飘字一致（Ubuntu 800 + 黑描边 + Q 弹 + 上浮渐隐）
- **真实伤害反馈**：飘字只显示实际造成的伤害——打出 80000 但生物仅剩 300 血被秒杀时只弹 300；且一击毙命时也保证弹出反馈


## 技术栈
- 纯前端 vanilla JS + Canvas 2D，无构建步骤、无框架（沿用现有架构）
- 改动集中在 4 个既有文件：`js/entities.js`、`js/game.js`、`js/petal-effects.js`、`js/data.js`
- 复用现有基础设施：`DamageText`（飘字）、`MobAI`/`PetalFX`（接口库模式）、`spawnText`、`fmtNum`、`damp`
- 版本号沿用 `?v=` 查询串缓存刷新机制

## 实现方案

### 一、花朵数值与受击保护（js/entities.js）
在文件顶部常量区新增：
```js
const FLOWER_BASE_HP = 100;     // 花朵基础血量
const FLOWER_BODY_DMG = 20;     // 花朵本体伤害（体伤）基础值
const FLOWER_HURT_INVULN = 0.5; // 受伤后无敌帧时长（秒）
```
- `recompute()`：`this.maxHp = FLOWER_BASE_HP; this.bodyDmg = FLOWER_BODY_DMG;`（与 maxHp 同源，保证 `_resetPlayer` / 换卡重算后稳定为 20，不被覆盖）
- `hurt(dmg, src)` 增加无敌判定与无敌帧设置：
```js
hurt(dmg, src) {
  if (this.dead || dmg <= 0) return false;
  if (this.invuln > 0) return false;          // 无敌帧内完全免伤
  this.hp -= dmg;
  this.hurtT = 0.3;                            // 受伤红闪（保留现有 0.3s）
  this.invuln = FLOWER_HURT_INVULN;            // 挨打后给一段无敌，避免同帧/下一 tick 继续掉血
  if (this.hp <= 0) { ... this.die(); return true; }
  return false;
}
```
- 受伤红闪（`draw()` 503-509）已实现，**不改动**，仅确认 `hurtT` 链路畅通；修好"一碰就死"后即可正常看见

### 二、生物护甲核对（只读核对 + 汇报）
`Mob` 构造（760-761）已实现：
```js
this.armor = (rs && rs.armor != null) ? rs.armor
  : (type.armor != null) ? type.armor : (MOB_ARMOR[this.rarity] || 0);
```
且 `_combatTick` 双方结算均为 `Math.max(攻 - 甲, 0)`。**结论：护甲已真实生效**，数据来源优先级为 registry 各稀有度表 → registry type 级 → `data.js` 的 `MOB_ARMOR` 稀有度默认表（registry 目前未提供 armor 字段，故走默认表）。本项只核对并汇报，不改逻辑；若后续要在界面展示护甲，另开需求。

### 三、伤害反馈改为真实数值 + 一击毙命必弹（js/entities.js + js/game.js）
`Mob.hurt` 的返回值从布尔改为结构化结果，让调用方拿到"实际造成的伤害"：
```js
// 返回 { applied, killed }：applied = 本击实际造成的伤害（不会超过剩余血量）
hurt(dmg, src) {
  if (this.dead || dmg <= 0) return { applied: 0, killed: false };
  const applied = Math.min(dmg, this.hp);
  this.hp -= applied;
  this.hurtT = 0.3;
  if (src && this.hostility !== 'passive') { /* threat 累计逻辑不变 */ }
  if (this.hp <= 0) { this.hp = 0; this.dead = true; this.deathTimer = 0; return { applied, killed: true }; }
  return { applied, killed: false };
}
```
`game.js _combatTick` 两处调用点同步改造：
```js
const r = m.hurt(toMob, p);
m.pendDmg = (m.pendDmg || 0) + r.applied;          // 只累加真实伤害
if (!(m.dmgTextT > 0)) m.dmgTextT = 0.12;
if (r.killed) {
  // 一击毙命：立即把累计伤害弹出（不等 0.12s 聚合窗口），保证必有反馈
  this.spawnText(m.x + rand(-m.r * 0.2, m.r * 0.2), m.y - m.r * 0.5,
    String(Math.round(m.pendDmg)), '#ff4040');
  m.pendDmg = 0; m.dmgTextT = 0;
  this._onMobKilled(m);
}
```
效果：打 80000 秒杀 300 血的怪 → `applied = 300` → 只弹 `300`；多花瓣同帧命中仍按 0.12s 窗口聚合成一个总数。

### 四、生物攻击节奏（js/game.js）
复用 `Mob.hitCd`（已定义但闲置）作为"生物攻击冷却"，让接触伤害按事件结算而非每 tick 全量：
```js
const MOB_TOUCH_CD = 0.5;   // 生物对玩家/花瓣的最小攻击间隔（秒）
```
在 `_combatTick` 的花朵分支中，`toFlower > 0` 与 `toPetal > 0` 统一受 `m.hitCd` 节制：冷却中跳过伤害（但仍保留碰撞挤出），造成伤害时置 `m.hitCd = MOB_TOUCH_CD`。配合 `hurt()` 的 `FLOWER_HURT_INVULN` 无敌帧，形成双保险：任何伤害值的生物都不可能一碰秒杀满血花朵。

### 五、仇恨豁免（js/game.js）
在死亡检测处与重生处显式清空全场仇恨表：
```js
// 死亡当帧：立即从所有生物的仇恨表移除（死亡期间 + 重生后都豁免）
if (p.dead && !this._deathShown) {
  for (const m of this.mobs) m.threat.length = 0;
  this._deathShown = true;
  UI.showDeathScreen(p.killedBy);
}
```
`respawn()` 中同样兜底清空（`for (const m of this.mobs) m.threat.length = 0;`）。`topThreat()` 跳过 `dead` 实体的逻辑保留作双保险。

### 六、玫瑰回血反馈（js/petal-effects.js + js/game.js）
- 新增统一颜色常量（避免 ui.js 与特效各写一份）：
```js
// js/data.js
const HEAL_TEXT_COLOR = '#ff94c9';   // 治疗飘字 / 卡牌 Heal 属性行同色
```
`ui.js` 的 `STAT_COLORS` 第三项改为引用该常量。
- `PetalFX` 增加文字输出钩子与返回实际回血量的 `heal`：
```js
PetalFX.textSink = null;    // (x, y, text, color) => void，由 game 注入（内部转 spawnText）
// _ctx 内：
heal: (n) => {
  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + (n || 0));
  return player.hp - before;                       // 实际回血量（血量有缺口时可能小于 n）
},
floatText: (text, color, x, y) => { if (PetalFX.textSink) PetalFX.textSink(x, y, text, color); },
```
- rose 的 `update` 结尾：
```js
const got = ctx.heal(ctx.stats.heal);
if (got > 0) ctx.floatText('+' + fmtNum(got), HEAL_TEXT_COLOR, ctx.player.x, ctx.player.y - ctx.player.r - 6);
ctx.consumePetal();
```
- `game.js` 初始化处注入：`PetalFX.textSink = (x, y, text, color) => this.spawnText(x, y, text, color);`
- 飘字自动复用 `DamageText`（Ubuntu 800 + 黑描边 + Q 弹 + 上浮渐隐），样式与攻击反馈完全一致，仅颜色与出发位置（花朵本体上方）不同

## 实现细节
- **性能**：所有改动均为 O(1)/O(mobs) 每帧；`spawnText` 走现有 `dmgTexts` 池，无新增 DOM/Canvas 层；清空 threat 表用 `length = 0` 原地复用数组，避免 GC
- **数值安全**：`applied = Math.min(dmg, this.hp)` 保证不会出现负血量与超额飘字；`heal` 返回差值保证回血飘字不超过实际缺口
- **兼容性**：`Mob.hurt` 返回值形态变化，调用点仅 `game.js` 两处，已同步；`Player.hurt` 签名不变
- **调试参数**：`?hp=N` 逻辑不受影响（仍会覆盖 maxHp/hp）
- **缓存刷新**：改动文件后统一递增 `index.html` 中对应 `?v=`

## 架构设计
数据流（伤害与反馈）：
```
_combatTick (25 tick/s)
  ├─ 花瓣 vs 昆虫:  toMob = max(攻-甲,0) → Mob.hurt() → {applied,killed}
  │      └─ pendDmg += applied ; killed → 立即 spawnText(累计真实伤害)
  ├─ 花朵 vs 昆虫:  toMob = max(bodyDmg-甲,0) → 同上
  │                toFlower = max(m.dmg-甲,0) → m.hitCd 节制 → Player.hurt()
  │                      └─ invuln>0 免伤 ; 否则扣血 + hurtT 红闪 + invuln 无敌帧
  └─ 死亡 → 清空全场 mob.threat（仇恨豁免）→ showDeathScreen
PetalFX.tick → rose → ctx.heal() 返回实际回血量 → ctx.floatText() → game.spawnText()
```
设计原则延续现有模式：AI/特效只输出"意图"或"事件"，具体数值结算集中在 `_combatTick`，文字统一走 `DamageText` + `spawnText` 单一出口。

## 目录结构
```
project-root/
├── js/
│   ├── entities.js   # [MODIFY] 新增 FLOWER_BASE_HP/FLOWER_BODY_DMG/FLOWER_HURT_INVULN 常量；
│   │                 #          recompute() 设 bodyDmg=20 与 maxHp=100；
│   │                 #          Player.hurt() 增加 invuln 判定与受伤无敌帧；
│   │                 #          Mob.hurt() 改为返回 {applied,killed}（applied 不超过剩余血量）
│   ├── game.js       # [MODIFY] _combatTick： pendDmg 累加 applied、一击毙命立即弹飘字；
│   │                 #          生物对玩家/花瓣伤害走 m.hitCd 攻击冷却（MOB_TOUCH_CD）；
│   │                 #          死亡当帧与 respawn() 清空全场 mob.threat（仇恨豁免）；
│   │                 #          初始化处注入 PetalFX.textSink -> spawnText
│   ├── petal-effects.js # [MODIFY] 新增 HEAL_TEXT_COLOR 引用、PetalFX.textSink 钩子；
│   │                 #          _ctx.heal() 返回实际回血量、新增 _ctx.floatText()；
│   │                 #          rose update 结束时弹出 '+实际回血量' 粉色飘字（从花朵上方）
│   ├── data.js       # [MODIFY] 新增导出常量 HEAL_TEXT_COLOR = '#ff94c9'（ui.js 特效共用）
│   ├── ui.js         # [MODIFY] 卡牌悬浮框 STAT_COLORS 第三项改用 HEAL_TEXT_COLOR 常量
│   └── index.html    # [MODIFY] 递增 entities.js / game.js / petal-effects.js / data.js / ui.js 的 ?v=
```

## 关键代码结构
```js
// Mob.hurt 的新契约（调用方依赖 applied 做真实伤害反馈）
hurt(dmg, src): { applied: number, killed: boolean }

// Player.hurt 的免伤契约（invuln 由 respawn 与受伤自身共同设置）
hurt(dmg, src): boolean   // invuln > 0 时直接返回 false，不扣血、不触发红闪
```

