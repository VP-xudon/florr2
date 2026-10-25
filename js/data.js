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
//   basic  = id 1（Basic / 基本）
//   light  = id 2（Light / 轻：外观同 Basic 但更小，按稀有度由 1 个圆组成 1~5 个）
//   rose   = id 5（Rose / 玫瑰，治疗属性非常惊人，不过在战斗时就没那么好用了）
const ENABLED_PETAL_SLUGS = new Set(['basic', 'light', 'rose', 'stinger', 'pollen', 'honey']);
// 不受 reach 模式影响的花瓣（按住空格时轨道半径不放大，保持基础距离）：
//   rose = 治疗型，延长轨道只会让回血更难命中主角，不计算延长效果。
const REACH_IMMUNE_SLUGS = new Set(['rose']);
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
// 手工校正的花瓣稀有度数值（键 = slug）。registry 里这两张卡只有 common 一行，
// 这里按官方 wiki 补齐整表（dmg/hp 直接写实数值，不用倍率推算）。
const PETAL_RARITY_OVERRIDES = {
  // Pollen：伤害/血量逐级 ×3（common 38/5 与 wiki 的 unusual 114/15 自洽）
  pollen: {
    common:    { dmg: 38,    hp: 5 },
    unusual:   { dmg: 114,   hp: 15 },
    rare:      { dmg: 171,   hp: 22.5 },
    epic:      { dmg: 342,   hp: 45 },
    legendary: { dmg: 1026,  hp: 135 },
    mythic:    { dmg: 3078,  hp: 405 },
    ultra:     { dmg: 9234,  hp: 1215 },
    super:     { dmg: 27702, hp: 3645 },
    eternal:   { dmg: 83106, hp: 10935 }
  },
  // Honey：没有伤害，只有血量（rare 起才有）
  honey: {
    rare:      { dmg: 0, hp: 450 },
    epic:      { dmg: 0, hp: 1350 },
    legendary: { dmg: 0, hp: 4050 },
    mythic:    { dmg: 0, hp: 12150 },
    ultra:     { dmg: 0, hp: 36450 },
    super:     { dmg: 0, hp: 109350 },
    eternal:   { dmg: 0, hp: 328050 },
    unique:    { dmg: 0, hp: 328050 }
  }
};

// Pollen 的一卡多体数量（等同"一次放出 N 个 pollen 实体"）
//   common 1 / unusual 2 / rare 2 / epic 及以上 3
const PETAL_SUB_COUNT = {
  pollen: { common: 1, unusual: 2, rare: 2, epic: 3, legendary: 3, mythic: 3, ultra: 3, super: 3, eternal: 3, unique: 3 }
};

// Honey 的「Max Mob Rarity」：只能吸引到这一档及以下的生物（颜色 #d2eb34）
const HONEY_MAX_MOB_RARITY = {
  rare: 'unusual', epic: 'rare', legendary: 'epic', mythic: 'legendary',
  ultra: 'mythic', super: 'ultra', eternal: 'super', unique: 'super'
};
const MAX_MOB_RARITY_COLOR = '#d2eb34';

// 滞留型花瓣：出轨道后 0.5s 脱离（因惯性减速后留在原地，不再跟随）
const PETAL_DETACH_AFTER = { pollen: 0.5, honey: 0.5 };

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
      // 滞留型（Pollen / Honey）：出轨道 PETAL_DETACH_AFTER 秒后脱离，留在原地
      detachAfter: PETAL_DETACH_AFTER[slug] || 0,
      // 一卡多体（Pollen）：每个实体各占一个轨道位、各自结算
      subCount: PETAL_SUB_COUNT[slug] || null,
      // Honey 专属：可吸引的最高生物稀有度表 + 实体未死亡前卡片不重装填
      maxMobRarity: (slug === 'honey') ? HONEY_MAX_MOB_RARITY : null,
      holdReloadUntilDeath: slug === 'honey',
      noDamage: slug === 'honey',
      // reach 模式免疫：轨道半径不随空格（reach）放大（见 entities.js _syncPetals）
      noReach: REACH_IMMUNE_SLUGS.has(slug),
      identified: true,
      wiki: p.wiki || null
    };
    // ---- 手工补全（registry 里这些卡只有 common 一行 / 没有冷却字段）----
    const ov = PETAL_RARITY_OVERRIDES[slug];
    if (ov) {
      t.rarityStats = Object.assign({}, t.rarityStats || {});
      for (const rk in ov) t.rarityStats[rk] = Object.assign({}, t.rarityStats[rk] || {}, ov[rk]);
    }
    if (slug === 'pollen' || slug === 'honey') {
      // 冷却 2.0s，实体的 0.5s 滞留时间单独记（卡面展示为 "2.0s + 0.5s"）
      t.reload = 2.0;
      t.reloadText = '2.0s + 0.5s';
    }
    out.push(t);
    PETAL_BY_ID[id] = t;
  }
  return { list: out, byId: PETAL_BY_ID };
}

// 某花瓣在某稀有度下的「Max Mob Rarity」（Honey 专用）：返回稀有度名或 null
function petalMaxMobRarity(type, rarity) {
  if (!type || !type.maxMobRarity) return null;
  return type.maxMobRarity[rarity] || null;
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
// registry 已统一为英文（type / rarities 键均为英文），无需二次转译：
//   · rarities 的键直接就是英文稀有度（与 RARITY_ORDER 对齐）；
//   · type 为英文类型串，仅 被动/中立/敌对 需映射仇恨代码，其余（Obstacle/Friendly/NPC/…）按 neutral。
const MOB_HOSTILITY = {
  'Passive': 'passive',
  'Neutral': 'neutral',
  'Hostile': 'hostile'
};
// 手工校正的稀有度数值表（键 = 生物 id）。
// registry 里部分生物是旧版数据或压根缺字段（例如 Bee 的 hp/dmg 全是错的、没有 armor），
// 这里按官方最新口径整表覆盖：hp = Health、dmg = Damage、armor = Armor、exp = XP Reward。
// 只覆盖列出的稀有度，其余沿用 registry。
const MOB_RARITY_OVERRIDES = {
  4: {   // Bee 蜜蜂
    common:    { hp: 35,        dmg: 50,     armor: 1,   exp: 1 },
    unusual:   { hp: 131.3,     dmg: 150,    armor: 2,   exp: 1 },
    rare:      { hp: 472.5,     dmg: 450,    armor: 7,   exp: 5 },
    epic:      { hp: 1890,      dmg: 1350,   armor: 22,  exp: 44 },
    legendary: { hp: 11340,     dmg: 4050,   armor: 65,  exp: 405 },
    mythic:    { hp: 110565,    dmg: 12150,  armor: 194, exp: 5870 },
    ultra:     { hp: 5103000,   dmg: 36450,  armor: 583, exp: 213236 },
    super:     { hp: 153090000, dmg: 109350, armor: 583, exp: 13376259 },
    eternal:   { hp: 918540000, dmg: 328050, armor: 583, exp: 13376259 },
    unique:    { hp: 918540000, dmg: 328050, armor: 583, exp: 13376259 }
  }
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
    // 各稀有度数值表：键即英文稀有度（hp/dmg/exp/type）
    let rarityStats = null;
    if (m.rarities) {
      rarityStats = {};
      for (const rk in m.rarities) {
        if (RARITY_ORDER.indexOf(rk) < 0) continue;   // 只认英文稀有度键
        const v = m.rarities[rk] || {};
        rarityStats[rk] = { hp: v.hp || 0, dmg: v.dmg || 0, exp: v.exp || 0, armor: v.armor, hostility: MOB_HOSTILITY[v.type] };
      }
    }
    // 手工覆盖：按 id 整表替换 hp/dmg/armor/exp（见 MOB_RARITY_OVERRIDES）
    const ov = MOB_RARITY_OVERRIDES[id];
    if (ov) {
      rarityStats = rarityStats || {};
      for (const rk in ov) {
        if (RARITY_ORDER.indexOf(rk) < 0) continue;
        rarityStats[rk] = Object.assign({}, rarityStats[rk] || {}, ov[rk]);
      }
    }
    // slug = 官方英文名的小写下划线形式：i18n 的键（Mobs/<slug>/Name、Mobs/<slug>/Description）
    // 与显示语言无关，必须用【原始英文名】算，不能拿翻译后的 name 反推。
    const slug = (m.name || '').toLowerCase().replace(/ /g, '_');
    const t = {
      id, slug, name: I18N.t('Mobs/' + slug + '/Name', m.name), zh: m.zh || '', svg: id,
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

// ---------------- 掉落物表 ----------------
// 官方维基口径：【掉落稀有度分布只取决于生物的稀有度】，所有生物共用同一张表。
//   key   = 生物稀有度
//   value = [[掉落花瓣的稀有度, 概率(0~1)], ...]；概率之和 < 1 的部分表示"本次不掉落"
const MOB_DROP_TABLE = {
  common:    [['common', 0.598], ['unusual', 0.164]],
  unusual:   [['common', 0.485], ['unusual', 0.512]],
  rare:      [['common', 0.001], ['unusual', 0.834], ['rare', 0.165]],
  epic:      [['unusual', 0.067], ['rare', 0.810], ['epic', 0.123]],
  legendary: [['rare', 0.072], ['epic', 0.877], ['legendary', 0.050]],
  mythic:    [['epic', 0.075], ['legendary', 0.917], ['mythic', 0.008]],
  ultra:     [['legendary', 0.312], ['mythic', 0.684], ['ultra', 0.004]],
  super:     [['mythic', 0.357], ['ultra', 0.643]],
  eternal:   [['mythic', 0.357], ['ultra', 0.643]],
  unique:    [['mythic', 0.357], ['ultra', 0.643]]
};

// 每种生物掉哪些花瓣（顺序 = 悬浮框里的展示顺序）。
// Mana Orb 是日后魔法变种的专属掉落：**只登记在数据表里**，
// 既不出现在悬浮框、也不参与实际掷骰掉落（见 DROP_HIDDEN_SLUGS）。
const MOB_DROP_ITEMS = {
  3: ['light', 'rose', 'mana_orb'],      // Ladybug / 瓢虫
  4: ['stinger', 'pollen', 'honey']      // Bee / 蜜蜂（按此顺序展示与掷骰）
};

// 个别生物的每种掉落物有【各自】的稀有度分布。蜜蜂的 Stinger / Pollen / Honey 是三张不同的表：
//   · stinger 没有专属表 -> 沿用 MOB_DROP_TABLE（正好就是官方 Stinger 表）
//   · pollen / honey 用下面这两张；某档稀有度没写 = 这只生物在这一档不掉这件
const MOB_DROP_TABLE_ITEM = {
  pollen: {
    common:    [['unusual', 0.069]],
    unusual:   [['unusual', 0.247]],
    rare:      [['unusual', 0.872], ['rare', 0.070]],
    epic:      [['unusual', 0.338], ['rare', 0.610], ['epic', 0.051]],
    legendary: [['rare', 0.349], ['epic', 0.630], ['legendary', 0.020]],
    mythic:    [['epic', 0.356], ['legendary', 0.641], ['mythic', 0.003]],
    ultra:     [['legendary', 0.628], ['mythic', 0.371], ['ultra', 0.002]],
    super:     [['mythic', 0.662], ['ultra', 0.338]],
    eternal:   [['mythic', 0.662], ['ultra', 0.338]],
    unique:    [['mythic', 0.662], ['ultra', 0.338]]
  },
  honey: {
    rare:      [['rare', 0.070]],
    epic:      [['rare', 0.610], ['epic', 0.051]],
    legendary: [['rare', 0.349], ['epic', 0.630], ['legendary', 0.020]],
    mythic:    [['epic', 0.356], ['legendary', 0.641], ['mythic', 0.003]],
    ultra:     [['legendary', 0.628], ['mythic', 0.371], ['ultra', 0.002]],
    super:     [['mythic', 0.662], ['ultra', 0.338]],
    eternal:   [['mythic', 0.662], ['ultra', 0.338]],
    unique:    [['mythic', 0.662], ['ultra', 0.338]]
  }
};

// 某件掉落物在某生物稀有度下的稀有度分布；null = 这件不掉
function dropDistFor(slug, rarity) {
  const own = MOB_DROP_TABLE_ITEM[slug];
  if (own) return own[rarity] || null;      // 有专属表：没写这一档就是不掉
  return MOB_DROP_TABLE[rarity] || null;    // 没有专属表：走官方通用表
}
// 仅入库、不展示/不掉落的花瓣 slug。
const DROP_HIDDEN_SLUGS = new Set(['mana_orb']);

// 展示用花瓣素材索引：即使花瓣未实装（如 Mana Orb），悬浮框也要能画出它的卡面。
// 直接扫 registry 建立 slug -> { svg, name }，与 ENABLED_PETAL_SLUGS 无关。
const PETAL_ART_BY_SLUG = {};
(function buildPetalArtIndex() {
  const reg = (window.REGISTRY && window.REGISTRY.petals) ? window.REGISTRY.petals : [];
  for (const p of reg) {
    if (p.fanmade || p.id >= FANMADE_PETAL_FROM) continue;
    const nm = p.name ? String(p.name).trim() : (p.zh || '');
    if (!nm) continue;
    const slug = (p.name ? String(p.name).trim() : nm).toLowerCase().replace(/ /g, '_');
    if (PETAL_ART_BY_SLUG[slug]) continue;
    PETAL_ART_BY_SLUG[slug] = { slug, svg: p.id, name: I18N.t('Petals/' + slug + '/Name', nm) };
  }
})();
// 取某 slug 的展示素材；索引里没有时【现场回查 registry 并补进索引】——
// 这样即使索引构建时 registry 尚未就绪（或漏项），悬浮框的掉落物也照样能显示。
function petalArtOf(slug) {
  const hit = PETAL_ART_BY_SLUG[slug];
  if (hit) return hit;
  const reg = (window.REGISTRY && window.REGISTRY.petals) ? window.REGISTRY.petals : [];
  for (const p of reg) {
    const nm = p.name ? String(p.name).trim() : (p.zh || '');
    if (!nm) continue;
    if (String(nm).toLowerCase().replace(/ /g, '_') !== slug) continue;
    PETAL_ART_BY_SLUG[slug] = { slug, svg: p.id, name: I18N.t('Petals/' + slug + '/Name', nm) };
    return PETAL_ART_BY_SLUG[slug];
  }
  return null;
}

// 某生物在某稀有度下的掉落物，按【花瓣种类】分组（悬浮框里一种一行）：
//   [{ slug, name, svg, items: [{ rarity, chance }] }]
function mobDropRows(mobId, rarity) {
  // 键容错：registry 的 id 可能是数字也可能是字符串
  const list = MOB_DROP_ITEMS[mobId] || MOB_DROP_ITEMS[String(mobId)];
  if (!list || !list.length) return [];
  const out = [];
  for (const slug of list) {
    if (DROP_HIDDEN_SLUGS.has(slug)) continue;   // Mana Orb 等：只入库，不在悬浮框显示
    const dist = dropDistFor(slug, rarity);      // 每件掉落物各自的稀有度分布
    if (!dist || !dist.length) continue;         // 这一档不掉这件：整行不显示
    // 素材取不到也要出行（卡面缺失时只是没有贴图，概率照常显示）
    const art = petalArtOf(slug) || { slug, svg: null, name: slug };
    out.push({
      slug, name: art.name, svg: art.svg,
      items: dist.map(([r, c]) => ({ rarity: r, chance: c }))
    });
  }
  return out;
}

// 掷骰掉落（生物死亡时调用）：**每种掉落物各自掷一次**——
// 按该生物【当前稀有度】那一行的分布决定这一件掉落的稀有度，落在"不掉落"区间就没有这一件。
// 返回 [{ slug, svg, name, rarity }, ...]（可能为空 = 这次什么都不掉）。
function rollMobDrops(mobId, rarity) {
  const list = MOB_DROP_ITEMS[mobId] || MOB_DROP_ITEMS[String(mobId)];
  if (!list || !list.length) return [];
  const out = [];
  for (const slug of list) {
    if (DROP_HIDDEN_SLUGS.has(slug)) continue;     // 只入库、不实际掉落
    const dist = dropDistFor(slug, rarity);        // 每件掉落物各自的稀有度分布
    if (!dist || !dist.length) continue;           // 这一档不掉这件
    let r = Math.random();
    let hit = null;
    for (const [pr, ch] of dist) {
      if (r < ch) { hit = pr; break; }
      r -= ch;
    }
    if (!hit) continue;                            // 落在剩余区间：本次这件不掉
    const art = petalArtOf(slug);
    out.push({ slug, svg: art ? art.svg : null, name: art ? art.name : slug, rarity: hit });
  }
  return out;
}

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

// 起始装备（非调试模式）：主槽 = 4 张 common Basic + 1 张 common Rose；
// 背包里天然只留 1 张 common Basic（其余卡全部移除，想拿就靠打怪掉落）。
const starterKeyOf = (slug, fallback) => {
  const t = PETAL_TYPES.find((p) => p.slug === slug);
  return t ? t.key : fallback;
};
const STARTER_BASIC_KEY = starterKeyOf('basic', PETAL_TYPES[0] ? PETAL_TYPES[0].key : 'p1');
const STARTER_ROSE_KEY = starterKeyOf('rose', null);
// 背包初始库存的唯一一张卡（键 = type.key|rarity，与 ui.js 的 _gc 一致）
const STARTER_INV_KEY = STARTER_BASIC_KEY + '|common';

// ---------------- 生物生成（地图自带生成区） ----------------
// garden.tmj 的 mobs / mobs2 对象层就是官方生成区：每个 spawn_mobs 对象带
//   polygon(范围) + difficulty(难度) + density(密度) + mobs(物种权重串)。
// 但 mobs 里像 "garden" 这样的项是【组名】，组成员在 florr 的服务端配置里，
// 地图文件内并不包含 —— 所以这里按公开组成登记一张组表。
// 只登记"已完整实现（渲染/掉落/AI）"的物种；以后加物种只需往数组里加 slug。
// 组内成员写成 [slug, 组内权重]；权重只在组内比较，外层 ":w" 会再乘上来。
const MOB_GROUPS = {
  garden: [['ladybug', 3], ['bee', 2]]
};

// 兜底物种（生成区解析不出任何有效物种时使用）
const DEFAULT_SPAWN_SLUG = 'ladybug';

// 难度 -> 稀有度。difficulty 由地图生成区提供（实测 -5 ~ 75）：
// 每个稀有度有一个"门槛"，难度超过门槛越多，掷中的概率越接近 1（S 型曲线）。
// 所以出生区(-5~0)几乎只有 common/unusual，高难区才会有 legendary 以上。
const RARITY_DIFF_T = [0, 6, 14, 24, 38, 55, 75];   // unusual..super 的门槛
function rollMobRarityByDifficulty(diff) {
  const d = isFinite(diff) ? diff : 0;
  let idx = 0;
  for (let r = 0; r < RARITY_DIFF_T.length; r++) {
    const p = 1 / (1 + Math.exp(-(d - RARITY_DIFF_T[r]) / 6));
    if (Math.random() >= p) break;
    idx = r + 1;
  }
  return RARITY_ORDER[Math.min(idx, RARITY_ORDER.length - 1)];
}

// 解析生成区的 mobs 权重串："rock:0.25;\nant_soldier:1;\ngarden:1;"
//   · "名字:权重" -> 权重（省略按 1）
//   · 纯组名 -> 展开 MOB_GROUPS
// 返回 [{ type, weight }]（只保留 registry 里真实存在的生物）
// 只有"行为已完整实现"的物种才参与地图生成。rock / ant_hole / ant_soldier 等
// 虽然 registry 里有数据，但没有 AI / 掉落 / 战斗行为，生成出来只是站桩的假怪，
// 因此生成表里出现也一律跳过（用 /summon 仍可手动召唤来调试）。
const SPAWNABLE_MOB_SLUGS = new Set(['ladybug', 'bee']);

function parseSpawnMobs(str) {
  const out = [];
  const push = (slug, w) => {
    if (!SPAWNABLE_MOB_SLUGS.has(slug)) return;   // 未实现的物种：不生成
    const t = MOB_TYPES.find((m) => m.slug === slug);
    if (!t) return;                      // 未收录的物种直接跳过，不臆造
    out.push({ type: t, weight: w });
  };
  for (const rawLine of String(str || '').split(/[;\n]+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const ci = line.indexOf(':');
    const slug = (ci >= 0 ? line.slice(0, ci) : line).trim().toLowerCase().replace(/ /g, '_');
    const w = ci >= 0 ? (parseFloat(line.slice(ci + 1)) || 1) : 1;
    if (MOB_GROUPS[slug]) {
      for (const g of MOB_GROUPS[slug]) push(g[0], w * (g[1] || 1));
      continue;
    }
    push(slug, w);
  }
  return out;
}
