// net/protocol.js — 传输协议与生成参数（纯数据，可在 Node 中 require）
'use strict';

const SNAP_HZ = 25;                 // 快照频率：与既有 combatAcc（25 tick/s）保持一致
const SNAP_DT = 1 / SNAP_HZ;

// ---- 生物生成参数（按地图生成表，服务端全局管理） ----
// 【密度口径】所有数值都是"生物总只数"，与物种种类数无关：
// 一个区先算出总目标，再按权重【挑】物种（每次生成只出一条），
// 所以以后往 mobs 串里加多少物种，总密度都不变 —— 只会改变构成比例。
const DENSITY_SCALE = 15.0;         // 整体密度倍率（唯一调参入口：下面三个上限都按它缩放）
const PER_ZONE_MAX = Math.round(6 * DENSITY_SCALE);              // 90：单区目标上限
const SPAWN_PER_TILE = 0.012 * DENSITY_SCALE;                    // 0.18：每格面积贡献的目标数量
const GLOBAL_MAX_MOBS = Math.round(110 * DENSITY_SCALE);         // 1650：全图存活上限
const SPAWN_INTERVAL = 0.1;         // 每 0.1s 补 1 只（总量变大，补缺口也要更快）
const MOB_ACTIVE_R = 2200;          // 与玩家距离超过它 -> 生物休眠（不跑 AI、不参与推挤）
const CP_RESPAWN_STAYS = 3;         // 每个复活点的保底复活次数
const HONEY_PULL_R = 700;           // Honey 吸引仇恨的半径（px）：范围要足够大，否则"只吸引到一只"
const HONEY_IMMUNE_T = 40;          // 被蜜影响累计满 40s -> 该生物永久免疫所有蜜
const PETAL_ATTACK_DUR = 0.004;     // 花瓣每次命中(25Hz)按最大耐久比例磨损：攻击也耗耐久，与其它花瓣一视同仁
const HONEY_PUSH = 40;              // 蜜硬碰撞时被生物顶开的冲量(px/s)：配合位置强制分离，使蜜被生物推着走
// 多节生物（一次生成整条、每一节独立结算）由数据表字段 MOB_TYPES[].segmented 声明。
// 这里只保留唯一读取入口，不再维护 slug 白名单 —— 新增多节物种只改数据表。
function isSegmentMob(type) { return !!(type && type.segmented); }
// 花瓣实体的重量：优先取实体自带的 weight（entities.js 按稀有度写入）；
// 缺失时按卡片稀有度即时换算 —— 保证任何来源的花瓣实体都走同一套重量口径。
function petalWeight(b) {
  if (b && b.weight) return b.weight;
  const r = (b && b.card && b.card.rarity) || 'common';
  return (typeof rarityWeight === 'function') ? rarityWeight(r) : 1;
}
// 质量悬殊带来的传递增益【上限】：以"同等级实体之间的击退"为基准 1，最大只允许 1.5 倍。
// 仅作用于【生物击退】；实体之间的推动 / 位移分离不设上限，按反质量自然分配。
const KB_DISPARITY_MAX = 1.5;

// ---------------- 传输层抽象 ----------------
// 只约定「消息」这一种形态：上行 send()、下行 onMessage()。
// 快照是消息的一种（t:'snap'），事件也是（t:'evt'），聊天同样（t:'chat'）。
