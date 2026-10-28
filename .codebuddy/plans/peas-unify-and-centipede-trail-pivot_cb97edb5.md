---
name: peas-unify-and-centipede-trail-pivot
overview: 把 Peas 彻底并入普通花瓣管线（44.svg 重做为带高光的单球、卡面单球≈0.7×rose、实体与卡面共用同一归一化窗口），并修好蜈蚣两处：真轨迹跟随（生成即铺满轨迹，不再整条平移）+ 头/身贴图以绿色身体为旋转中心（消掉"断脖子"）。
todos:
  - id: rebuild-44-asset
    content: "重写 tools/make_single_pea.py：用 viewBox 取景（不删任何 path）从四球原图裁出单球，保留 #709d45 本体与 #8ac255 高光，并校验 path 数量与 fill 集合"
    status: completed
  - id: scale-44-to-rose
    content: 用 path_points 离线测量 rose 与 Basic 包围盒，把单球缩放到 0.7×rose 且不超过 PETAL_CARD_REF[0]，写回 assets/petals/44.svg
    status: completed
    dependencies:
      - rebuild-44-asset
  - id: unify-petal-window
    content: js/cards.js：让 asset() 与 artSvg() 共用同一 uniformWindow 基准（PETAL_ENT_REF），消除卡面与实体的比例差
    status: completed
    dependencies:
      - scale-44-to-rose
  - id: seed-chain-trail
    content: js/net.js：_spawnChain 预置头节轨迹至整链长度，_solveChains 兜底改为按 gap 逐点补点，修复"整条平移"
    status: completed
  - id: center-head-pivot
    content: 重做 assets/mobs/12_h.svg（及 12_b）：只平移内容使绿色身体圆心落在画布中心，viewBox 边长与缩放不变
    status: completed
  - id: regen-shapes-and-bump
    content: 运行 tools/gen_mob_shapes_vector.py 重建 assets/mob-shapes.js，并 bump ASSET_VER 与 index.html 各脚本版本号
    status: completed
    dependencies:
      - center-head-pivot
      - rebuild-44-asset
      - unify-petal-window
---

## 产品概述
修正豌豆（Peas）的卡面与实体渲染一致性，并修复蜈蚣（Centipede）的移动轨迹与头部旋转中心。

## 核心功能需求

### 一、豌豆渲染（大修，彻底并入普通花瓣管线）
- **素材**：`44.svg` 必须是**一颗**豌豆，且保留原素材中间的**浅色高光部分**，不得变成纯深绿实心圆。
- **卡面**：单颗豌豆的显示尺寸约为 rose 的 **0.7 倍**；4 颗菱形排布时整簇略微溢出卡框，视觉上贴近原版 44.svg 的四球排布。
- **实体**：一颗豌豆实体的视觉大小必须与卡面上同一颗豌豆**严格同比例**（此前实体比卡面小一整圈）。
- **逻辑**：除 reach 炸开外，Peas 必须与 Stinger 完全相同的"一卡多体"路径 —— 不保留任何 Peas 专属渲染分支、专属系数或专属绘制方法。

### 二、蜈蚣运动与旋转
- **轨迹移动**：整条虫必须沿头部**实际走过的路径**爬行，会拐弯、有延迟感；当前"每节与头同步平移"是错误的。
- **头部旋转中心**：以**绿色身体圆的圆心**为旋转轴，触角允许偏出中心；当前转到较大角度时会出现"断脖子"，必须消除。
- **既有约束保持不变**：身体各节紧密相连、移速为瓢虫游荡速度的 0.5 倍、体型为同稀有度的 1.4 倍、相邻节不互相推挤。

## 视觉预期
- 卡面上 4 颗带浅色高光的绿色小球，大小与 rose 同量级（略小），排列与素材原图一致。
- 世界里每颗豌豆与卡面同一颗观感一致，不再"卡面大、实体小"。
- 蜈蚣转身时身体沿旧路径逐节跟随形成 S 形，头部原地转向而身体不脱节、脖子不断。


## 技术栈
沿用现有纯前端架构：原生 JS（`js/*.js`）+ Canvas 2D + 离线 SVG 素材 + Python 素材处理脚本（`tools/*.py`），无构建步骤。不做框架层改动。

## 实现方案

### 一、豌豆：三处根因，逐层修

**根因 1：素材被"删路径"的方式重建，高光丢失**
上一版 `tools/make_single_pea.py` 用**字符串删除**其它三颗球的 `<path>`，只能保留"最大包围盒 + 其聚类成员"，无法保证高光路径被正确归属（高光与本体同色系、包围盒更小，容易误删/误留）。

**改为 viewBox 取景，一条路径都不删**：
- 把 `44.svg` 恢复为原始四球素材（`git show HEAD:assets/petals/44.svg`，PowerShell 重定向为 UTF-16，需按 `utf-16` 解码）。
- 用 `tools/fit_mob_viewbox.py` 的 `path_points` + `compose_transforms` 算出**每颗球**的变换后包围盒，聚成 4 组。
- 选最上面那颗，把 `<svg>` 的 `viewBox` 精确设成这颗球的包围盒（正方形、以球心为中心）。
- **其余 3 颗球因落在 viewBox 之外被自然裁掉，不需要删除任何 `<path>`** → 本体的 `#709d45` 与高光的 `#8ac255` 100% 保留。
- 校验：输出文件中 `<path>` 数量必须与原始一致，且 `fill` 集合包含 `#709d45` 与 `#8ac255`。

**根因 2：卡面尺寸的"尺子"来自素材包围盒，需要按 rose 标定**
- `js/cards.js` 的 `uniformWindow(cx,cy,bw,bh,refW,refH)` 是**固定窗口**（`w = refW`，仅当 `bw > w` 才放大），所以花瓣在卡面上的相对大小 ∝ `bb_w / refW`。
- 目标：单颗豌豆 ≈ 0.7 × rose。
- 做法：离线测量 rose 与 Basic 的实测包围盒（同一套 `path_points` 算法），得到 `bb_rose_w`；再对 44.svg 施加一个**外层 `<g scale(K)>`**，使 `bb_pea_w = 0.7 * bb_rose_w`，并保证 `bb_pea_w <= PETAL_CARD_REF[0]`（否则窗口会被撑大，导致实际尺寸偏离目标）。
- 不引入任何 Peas 专属常数到 `js/cards.js`；比例全部固化在素材本身。

**根因 3：卡面与实体用的基准窗口不同（这是"实体小一圈"的全局性缺陷）**
- 卡面：`asset()` → `uniformWindow(..., PETAL_CARD_REF = [68.2557, 79.3829])`，该值是 Basic 的 **vb（含名称文字区域）**。
- 实体：`artSvg()` → `uniformWindow(..., PETAL_ENT_REF = Basic 的实测内容包围盒)`。
- 两者分母不同 ⇒ 同一张素材在卡面与实体的相对占比天然不等（对 Basic 自身也不等），这与"该花瓣是不是 Peas"无关，是**所有花瓣共有**的不一致。
- 修法：把卡面的窗口基准也统一到 `PETAL_ENT_REF`（Basic 实测内容包围盒），即 `asset()` 与 `artSvg()` 共用同一个 `uniformWindow` 参考尺寸；名称文字本来就由 `drawName()` 用固定比例（`NAME_FS_RATIO`/`NAME_BASE_RATIO`）画在内板底部，**不依赖 vb**，因此窗口基准换掉不影响文字布局。
- 该改动会让所有花瓣的"卡面:实体"比例一致；单个花瓣在卡面上看起来会比现在略大（因为分母变小），与实体的比例关系才正确。
- 若实测发现 rose/basic 的卡面观感偏差过大，再单独把 `PETAL_CARD_REF` 收敛为一个与 `PETAL_ENT_REF` 等比的值（保持同一把尺子），不得为 Peas 单独开分支。

**Peas 的阵型逻辑保持不变**：`PEAS_LAYOUTS = { 4: formDiamond(0.4357, 1) }`、`k = 1`、`FORMATION_LAYOUTS.peas`，与 Stinger 同构；实体侧 `formOff/formRot/formK` 已接入绘制，无需改动。

### 二、蜈蚣：轨迹不生效的真正原因 + 头部旋转中心

**根因 A：轨迹永远"不够长"，每帧都走外推分支**
- `_solveChains()` 只在 `_trail.length < 2` 时补**一个** 4000px 外的远点；而尾节需要的弧长 `acc`（整条链长，约 10~15 节 × 每节 gap）远大于头在生成后几秒内累积的真实轨迹长度。
- 于是 `_trailAt(trail, acc)` 每帧都命中"超过轨迹总长 → 沿最后切线外推"分支，所有节都落在同一条直线上 → **看起来就是整条平移**。
- 修法：
  1. `_spawnChain` 生成时，为头节**预置轨迹**：按各节实际 gap 自尾向头依次生成一串点（沿 `-facing` 方向），使轨迹总长 ≥ 整条链长 + 余量；这样第一帧就是"沿轨迹铺开"的正确解算，且后续真实移动会逐点替换掉预置点。
  2. `_solveChains` 内的兜底改为**按 gap 补点**而非"一个远点"：当轨迹总长不足 `acc` 时，沿最后一段切线按 `TRAIL_MIN` 间隔逐点追加，直到够用。这样 `_trailAt` 的插值与切线始终有效，头一拐弯就能立刻呈现弯曲。
  3. 轨迹裁剪 `maxLen = acc + 320` 保持；补点后 `_trailAt` 不再长期依赖外推。
- 保留 `GLUE = 0.92`、`radOf = shape.r * drawSize`、极小行波（0.05×半径），并把 `_solveChains()` 维持在 `step()` 最末尾。

**根因 B：贴图的旋转中心 = 画布中心，而绿色身体不在画布中心**
- `drawMob()` 的绘制流程是 `translate(x,y) → rotate(rot) → drawImage(cv, -size/2, -size/2, size, size)`，而 `artCanvas` 的裁剪框 `_cropRect` 是**居中**正方形 ⇒ 旋转轴恒为画布几何中心。
- `12_h.svg` 里绿色身体偏在一侧、触角把整体包围盒拉偏，导致旋转轴不在身体圆心 → 大角度时颈部脱开。
- 修法：对 `12_h.svg` 计算**绿色身体路径**的包围盒（按填充色识别主体圆，或用面积最大的闭合路径），然后只平移内容（在原有 `<g>` 外层加 `translate(dx,dy)`），使**身体圆心落在画布中心**；`viewBox` 边长与缩放保持不变（保证尺寸不变，只是取景平移）。
- 同理核查 `12_b.svg`（身体节应已居中，若略有偏移一并平移）。
- 平移后**必须重新生成** `assets/mob-shapes.js`（`tools/gen_mob_shapes_vector.py`），使 `12_h`/`12_b` 的轮廓坐标与新取景一致，碰撞圆随身体居中。

## 性能与可靠性
- 轨迹预置与补点均为 O(节数)，每帧一次，规模在几十个点内，无分配热点（补点用 `push`，裁剪用 `length =` 截断）。
- `_trailAt` 线性扫描轨迹；轨迹长度被 `acc + 320` 限制，点距 `TRAIL_MIN = 1px`，最坏点数约数百，仍极廉价。
- 素材与脚本改动后统一 bump `ASSET_VER` 与 `index.html` 的 `?v=`，避免浏览器缓存导致"改了没效果"。

## 风险与回滚
- 统一卡面窗口基准（`PETAL_CARD_REF` → `PETAL_ENT_REF`）会影响所有花瓣的卡面视觉大小。若观感偏差过大，回滚方式为恢复 `PETAL_CARD_REF` 单独常量，同时把实体窗口基准对齐到它（两者取其一，但必须同一个）。
- 素材平移/缩放均通过外层 `<g>` 实现，原始路径数据不动，可随时撤销。

