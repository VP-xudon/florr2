// data.js — 游戏数据：稀有度、花瓣、生物、掉落
// 单一数据源 = assets/registry.js（由 scripts/build_manifest.py 从 wikimod.html / wikipetal.html 生成）。
// 原则（按用户要求）：
//   1) 完全忽略“二创”内容（registry 注明 花瓣 1..94 为真实，95..116 为二创；生物 1..83 为真实）。
//   2) 不臆造名称：名称缺失的项不进入游戏，并汇总到 NEEDS_MANUAL 交用户手填。
'use strict';

// 稀有度（用户指定的精确配色，从低到高）：纯色底板，无渐变
const RARITIES = {
  common:    { name: I18N.t('Rarities/common/Name', 'Common'),       color: '#7EEF6D', weight: 64    }, // 草绿
  unusual:   { name: I18N.t('Rarities/unusual/Name', 'Unusual'),     color: '#FFE65D', weight: 24    }, // 淡黄
  rare:      { name: I18N.t('Rarities/rare/Name', 'Rare'),           color: '#4D52E3', weight: 9     }, // 紫蓝
  epic:      { name: I18N.t('Rarities/epic/Name', 'Epic'),           color: '#861FDE', weight: 3.2   }, // 紫
  legendary: { name: I18N.t('Rarities/legendary/Name', 'Legendary'), color: '#DE1F1F', weight: 1.1   }, // 大红
  mythic:    { name: I18N.t('Rarities/mythic/Name', 'Mythic'),       color: '#1FDBDE', weight: 0.32  }, // 天蓝
  ultra:     { name: I18N.t('Rarities/ultra/Name', 'Ultra'),         color: '#FF2B75', weight: 0.07  }, // 粉红
  super:     { name: I18N.t('Rarities/super/Name', 'Super'),         color: '#2BFFA3', weight: 0.02  }, // 荧光绿
  eternal:   { name: I18N.t('Rarities/eternal/Name', 'Eternal'),     color: '#EEEEEE', weight: 0.004 }  // 苍白（super 上级）
};
const RARITY_ORDER = ['common', 'unusual', 'rare', 'epic', 'legendary', 'mythic', 'ultra', 'super', 'eternal'];

// 生物护甲（armor）默认表：registry 暂无 armor 字段，按稀有度给默认值；
// rarityStats.armor / type.armor 存在时优先生效（瓢虫等被动生物也走这条链路）。
const MOB_ARMOR = { common: 0, unusual: 0, rare: 1, epic: 2, legendary: 3, mythic: 5, ultra: 8, super: 12, eternal: 16 };

// 治疗（Heal）专用色：卡牌悬浮框的 Heal 属性行、玫瑰回血飘字共用同一份，
// 绝不与伤害红(#ff4040) / 生命绿(#7fe08a) 混用。
const HEAL_TEXT_COLOR = '#ff94c9';
// 伤害飘字色（花朵/花瓣对生物造成的伤害），与 Heal 区分开。
const DAMAGE_TEXT_COLOR = '#ff4040';

// ---------------- 可用花瓣白名单 ----------------
// 只有列在这里的花瓣会真正进入游戏（按 slug，slug = 英文名小写、空格转下划线）。
// 其余已识别的花瓣视为「冗余素材」——文件保留但不加载，日后直接往此表加 slug 即可启用。
//   basic = id 1（Basic / 基本）
//   rose  = id 5（Rose / 玫瑰，治疗属性非常惊人，不过在战斗时就没那么好用了）
const ENABLED_PETAL_SLUGS = new Set(['basic', 'rose']);
const DISABLED_PETALS = [];   // 未启用的冗余素材清单（含 id/名称，便于日后检索）

// 二创边界（依据 registry 顶部 note）。如需启用某 ID，请手填 registry 后修改此处。
const FANMADE_PETAL_FROM = 95;   // 花瓣 1..94 真实；95..116 二创
const FANMADE_MOB_FROM   = 84;   // 生物 1..83 真实

// 生物随“等级/稀有度”放大的尺寸系数：common≈当前大小，之后逐级 1.5 / 1.75 / 1.8225 … 收敛增长
const MOB_LEVEL_SCALE = { 1: 1.0, 2: 1.5, 3: 1.75, 4: 1.8225 };
function mobScale(level) {
  if (level <= 4) return MOB_LEVEL_SCALE[level] || 1.0;
  return 1.8225 * Math.pow(1.05, level - 4);   // 之后温和收敛
}

// 需要用户手动识别/填写的项汇总（不臆造）
const NEEDS_MANUAL = [];
function flagManual(kind, id, name, reason) {
  NEEDS_MANUAL.push({ kind, id, name: name || ('#' + id), reason });
}

// ---------------- 花瓣 ----------------
function buildPetalTypes() {
  const reg = (window.REGISTRY && window.REGISTRY.petals) ? window.REGISTRY.petals : [];
  const out = [];
  const PETAL_BY_ID = {};
  for (const p of reg) {
    const id = p.id;
    // 忽略二创
    if (id >= FANMADE_PETAL_FROM) { flagManual('petal', id, p.name, '二创内容已忽略（如需启用请手填 registry）'); continue; }
    // 标记为二创的项忽略
    if (p.fanmade) { flagManual('petal', id, p.name, '标记为二创，已忽略'); continue; }
    // 名称缺失：不臆造，登记待手填
    if (!p.name || !String(p.name).trim()) {
      if (p.zh) {
        // 中文名存在但英文名缺失：用中文名展示，仍登记待补英文名
        flagManual('petal', id, p.zh, '英文名缺失（暂用中文名 ' + p.zh + '，待手填英文名）');
      } else {
        flagManual('petal', id, ('#' + id), '名称完全缺失，已忽略（待手填）');
        continue;
      }
    }
    const slug = (p.name && String(p.name).trim()) ? String(p.name).trim().toLowerCase().replace(/ /g, '_') : '';
    const name = I18N.t('Petals/' + slug + '/Name', (p.name && String(p.name).trim()) ? p.name : p.zh);
    // 白名单：不在可用花瓣表中的一律视为冗余素材（文件保留，不加载；日后加 slug 即可启用）
    if (!ENABLED_PETAL_SLUGS.has(slug)) { DISABLED_PETALS.push({ id, name }); continue; }
    const key = 'p' + id;   // 稳定 key，避免名称冲突
    const t = {
      id, key, name,
      slug,                                    // 供 I18N 查 Description（Petals/<slug>/Description）
      zh: p.zh || '',
      svg: id,                                  // assets/petals/<id>.svg
      dmg: (p.stats && p.stats.dmg) || 0,
      hp: (p.stats && p.stats.hp) || 0,
      heal: (p.stats && p.stats.heal) || 0,      // 治疗量：只有部分花瓣有（如 Rose），0 = 无此属性
      spd: (p.stats && p.stats.spd) || 0,
      // 冷却秒数：优先用显式的 reload；否则回退 stats.spd（历史约定，目前只有 Basic 走这条）。
      // 注意 stats.spd 的本义是移动速度修正值（Rose 为 -12），所以有 reload 字段时以它为准。
      reload: (p.reload != null) ? p.reload : Math.max(0, (p.stats && p.stats.spd) || 0),
      reloadText: p.reloadText || null,          // 冷却的展示文本（如 "3.5s + 1.5s"），为空则按 reload 生成
      rarityMultipliers: p.rarityMultipliers || null,  // 稀有度倍率表（仅Basic有）
      rarityStats: p.rarityStats || null,        // 各稀有度数值表（Rose 有：dmg/hp/heal）
      kind: p.kind || 'misc',
      identified: true,
      wiki: p.wiki || null
    };
    out.push(t);
    PETAL_BY_ID[id] = t;
  }
  return { list: out, byId: PETAL_BY_ID };
}

// 按稀有度取花瓣数值：优先 rarityStats（整表，如 Rose），其次 rarityMultipliers（倍率表，如
// Basic），最后退回基础 stats。dmg/hp/heal 都走这里——绝不在战斗/装填里直接读 type.dmg。
function petalStatsFor(type, rarity) {
  const rs = type.rarityStats && type.rarityStats[rarity];
  if (rs) return { dmg: rs.dmg || 0, hp: rs.hp || 0, heal: rs.heal || 0 };
  const mult = type.rarityMultipliers && type.rarityMultipliers[rarity];
  const s = type;
  if (mult) {
    return { dmg: (s.dmg || 0) * (mult.dmg || 1), hp: (s.hp || 0) * (mult.hp || 1), heal: (s.heal || 0) * (mult.heal || 1) };
  }
  return { dmg: s.dmg || 0, hp: s.hp || 0, heal: s.heal || 0 };
}

// ---------------- 生物 ----------------
// registry 的 rarities 用的是中文键（普通/罕见/…），这里统一映射到英文稀有度键，
// 与 RARITY_ORDER 对齐，方便按 RARITIES[rarity].color 取色、按 I18N 取译名。
const MOB_RARITY_KEY = {
  '普通': 'common', '罕见': 'unusual', '稀有': 'rare', '史诗': 'epic', '传奇': 'legendary',
  '神话': 'mythic', '究极': 'ultra', '超级': 'super', '永恒': 'eternal', '唯一': 'unique'
};
// 注册表中文类型串 -> 仇恨代码
const MOB_HOSTILITY = {
  '被动型生物': 'passive',
  '中立型生物': 'neutral',
  '敌对型生物': 'hostile'
};
function buildMobTypes() {
  const reg = (window.REGISTRY && window.REGISTRY.mobs) ? window.REGISTRY.mobs : [];
  const out = [];
  const MOB_BY_ID = {};
  for (const m of reg) {
    const id = m.id;
    if (id >= FANMADE_MOB_FROM) { flagManual('mob', id, m.name, '二创/超范围内容已忽略（如需启用请手填 registry）'); continue; }
    if (m.fanmade) { flagManual('mob', id, m.name, '标记为二创，已忽略'); continue; }
    if (!m.name || !String(m.name).trim()) { flagManual('mob', id, ('#' + id), '名称缺失，已忽略（待手填）'); continue; }
    // 各稀有度数值表：中文键 -> 英文稀有度键（hp/dmg/exp）
    let rarityStats = null;
    if (m.rarities) {
      rarityStats = {};
      for (const zh in m.rarities) {
        const rk = MOB_RARITY_KEY[zh];
        if (!rk) continue;
        const v = m.rarities[zh] || {};
        rarityStats[rk] = { hp: v.hp || 0, dmg: v.dmg || 0, exp: v.exp || 0, armor: v.armor, hostility: MOB_HOSTILITY[v.type] };
      }
    }
    const t = {
      id, name: I18N.t('Mobs/' + ((m.name || '').toLowerCase().replace(/ /g, '_')) + '/Name', m.name), zh: m.zh || '', svg: id,
      hp: m.hp, dmg: m.dmg, speed: m.speed, size: m.size, tier: m.tier,
      color: m.color || '#888', boss: !!m.boss,
      type: m.type || '', biome: m.biome || '', desc: m.desc || '',
      // 仇恨类型代码：'passive' 被动（永不反击追击）/ 'neutral' 中立（被打才追击）/
      // 'hostile' 敌对（见人就追）。由注册表的中文类型串映射，未识别的按 neutral 处理。
      hostility: MOB_HOSTILITY[m.type] || 'neutral',
      rarities: m.rarities || null,
      rarityStats,                       // 英文稀有度键 -> { hp, dmg, exp, armor }
      ai: m.ai || null                   // 官方 AI 开关（aggro/chase/flee/retaliate…）
    };
    out.push(t);
    MOB_BY_ID[id] = t;
  }
  return { list: out, byId: MOB_BY_ID };
}

const _petals = buildPetalTypes();
const _mobs = buildMobTypes();
const PETAL_TYPES = _petals.list;
const MOB_TYPES = _mobs.list;
const PETAL_BY_ID = _petals.byId;
const MOB_BY_ID = _mobs.byId;

function getPetal(id) { return PETAL_BY_ID[id] || null; }
function getMob(id) { return MOB_BY_ID[id] || null; }
function petalByKey(key) { return PETAL_TYPES.find(t => t.key === key) || null; }

// 调试/手填提示
if (NEEDS_MANUAL.length) {
  console.warn('[数据] 以下项被忽略或需手填（二创/缺失名称，不臆造）：');
  for (const n of NEEDS_MANUAL) console.warn('  -', n.kind, 'id=' + n.id, n.name, '->', n.reason);
}

// 掉落 / 稀有度
function rollRarity(tier) {
  const shift = clamp(tier - 1, 0, 4);
  const entries = [];
  let total = 0;
  RARITY_ORDER.forEach((k, i) => {
    let w = RARITIES[k].weight * Math.pow(1.7, i - shift);
    if (w < 1e-4) w = 1e-4;
    entries.push([k, w]); total += w;
  });
  let r = Math.random() * total;
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
  return 'common';
}

function rollDrop(mob) {
  const type = choice(PETAL_TYPES);
  const rarity = rollRarity(mob.tier);
  return { type, rarity };
}

// 权重选择生物（低 tier 更常见）
function rollMobType(level) {
  const entries = [];
  let total = 0;
  for (const m of MOB_TYPES) {
    const unlock = m.tier <= Math.max(1, Math.ceil(level / 3));
    const w = unlock ? (1 / (m.tier * m.tier)) * (m.boss ? 0.4 : 1) : 0;
    entries.push([m, w]); total += w;
  }
  if (total <= 0) return MOB_TYPES[0];
  let r = Math.random() * total;
  for (const [m, w] of entries) { if ((r -= w) <= 0) return m; }
  return MOB_TYPES[0];
}

// 起始装备用：取第一个花瓣与第一个攻击型花瓣
const STARTER_PETAL_A = PETAL_TYPES[0] ? PETAL_TYPES[0].key : 'p1';
const STARTER_PETAL_B = (PETAL_TYPES.find(t => t.kind === 'attack') || PETAL_TYPES[1] || PETAL_TYPES[0]).key;

// 初始生物：出生点附近固定生成 3 只 Ladybug（id 3），稀有度各一只。
// 距离取 190 世界像素 —— 既"间隔不要太远"，又不会和出生点重叠。
const STARTER_MOB_ID = 3;
const STARTER_MOB_RARITIES = ['common', 'unusual', 'rare', 'epic', 'legendary', 'mythic', 'ultra', 'super'];
const STARTER_MOB_RADIUS = 190;
