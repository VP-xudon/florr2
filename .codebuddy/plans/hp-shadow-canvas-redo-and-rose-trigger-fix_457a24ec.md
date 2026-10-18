---
name: hp-shadow-canvas-redo-and-rose-trigger-fix
overview: 推倒重做卡槽"水缸阴影"：删除 DOM .pshadow 方案，改为画在卡牌 canvas 内板上的顶部下垂阴影（与 reload 阴影同色同级、无缝衔接 reload 扇形阴影）；修复玫瑰永不触发的根因（type.key 是 'p5' 不是 'rose'，引擎改按 slug 匹配）。
todos:
  - id: rose-slug-fix
    content: 修改 petal-effects.js 查表键为 type.slug，修复玫瑰永不触发，bump v2
    status: completed
  - id: hp-shadow-canvas
    content: cards.js 新增 drawHpShadow 内板顶部下垂阴影并在 drawReload 后调用
    status: completed
  - id: ui-shadow-rewire
    content: ui.js 删除 .pshadow 方案，_reloadTick 扩展驱动 hpShadow 平滑值
    status: completed
    dependencies:
      - hp-shadow-canvas
  - id: cleanup-old-shadow
    content: game.js 删除 updatePetalShadows 调用，style.css 删除 .pshadow 规则
    status: completed
    dependencies:
      - ui-shadow-rewire
  - id: version-bump-verify
    content: index.html 版本号统一 bump 并 read_lints 验证
    status: completed
    dependencies:
      - cleanup-old-shadow
---

## 产品概述
修正上批次两项问题：重做卡槽"水缸阴影"（与 reload 装填阴影同一套视觉语言、无缝衔接），并修复玫瑰花瓣永不自动触发回血的 bug。

## 核心功能
- **玫瑰触发修复**：玫瑰只要 reload 完成、弹出至轨道，就每 tick 检测主角血量，一旦不满立刻触发 1.5s 飞向主角回血后退场。根因：花瓣 `type.key` 是 `'p'+id`（玫瑰为 `'p5'`），引擎按 `'rose'` 查表永远查不到——改用 `type.slug` 匹配。
- **水缸阴影重做（移除 DOM 方案）**：
  - 阴影画在卡牌 canvas 内板之上、花瓣图形与名称之下（与 reload 阴影同层级），颜色/透明度与 reload 阴影完全相同（`rgba(18,24,20,0.5)`）
  - 花瓣掉血时阴影从内板顶边**水平下垂**，高度 = 内板高 × (1 - hp/maxHp)，变化平滑过渡
  - 花瓣血量归零 = 整块内板全阴影，恰好等于 reload 起始状态（亮扇形从全阴影中长大退散阴影），两阴影天然兼容
  - 花瓣不在场（装填中）时 hpShadow = 0，视觉完全交给 reload 扇形阴影
  - 删除原 `.pshadow` DOM 层与相关 JS/CSS，卡牌外观其余部分（稀有度描边、花瓣图形、名称、数量角标）不受影响


## 技术栈
纯 HTML/JS/Canvas（无构建工具），沿用 `?v=N` 版本号缓存管理。

## 实现方案
### 1. 玫瑰匹配修复（js/petal-effects.js v1→v2）
- `tick` 中查表键由 `body.card.type.key` 改为 `body.card.type.slug`（data.js 中 slug 为稳定英文名 'rose'/'basic'），注册键 `'rose'` 不变
- 检测频率已是每帧 tick（每 tick 检测），无需改动时机逻辑

### 2. 卡牌内板血量阴影（js/cards.js v20→v21）
- 新增 `drawHpShadow(ctx, st, p, iw, ih)`：`st.hpShadow > 0` 时 clip 内板矩形，`fillStyle` 与 drawReload 相同，从内板顶边向下绘制 `height = ih × hpShadow` 的矩形阴影
- 在 `drawReload` 之后调用（同层级：压暗底板，不遮花瓣图形与名称）

### 3. 阴影驱动与平滑（js/ui.js v61→v62）
- 删除 `_makeCell` 中 `.pshadow` 创建与 `updatePetalShadows` 方法
- `_reloadTick` 扩展：每槽同时计算 reload 进度 key 与 hpShadow 目标值（有花瓣 body → `1 - clamp(hp/maxHp,0,1)`；无 body → 0）
- hpShadow 显示值存 `cv._hpShadowSm`，向目标指数趋近（速率约 10/s），与 reload key 合并成一个去重 key，变化才 `paintCard` 重绘（掉血下垂平滑，且不做无谓重绘）

### 4. 清理旧方案（js/game.js v38→v39、css/style.css v38→v39）
- game.js `updateHUD` 删除 `UI.updatePetalShadows` 调用
- style.css 删除 `.qslot .pshadow` 规则块

### 5. 版本号与验证
- index.html：cards 21、ui 62、game 39、css 39、petal-effects 2；entities 无改动不 bump
- read_lints 验证全部改动文件

## 性能
- hpShadow 平滑为每帧 O(1) 指数趋近；去重 key 保证无变化不重绘（canvas 重绘是唯一开销点，每帧最多 10 张卡）
	
