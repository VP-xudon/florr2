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
// 中毒（Poison）专用色：生物悬浮框的 Poison 属性行用。
// 官方只给了 {#Colors/poison} 引用（颜色表在游戏本体里，不在语言包里），
// 这里定一支自己的：紫罗兰 —— 与生命绿(#7fe08a)/伤害红(#ff6b6b)/护甲灰蓝都区分得开。
const MOB_POISON_COLOR = '#c58cff';

// ---------------- 可用花瓣白名单 ----------------
// 只有列在这里的花瓣会真正进入游戏（按 slug，slug = 英文名小写、空格转下划线）。
// 其余已识别的花瓣视为「冗余素材」——文件保留但不加载，日后直接往此表加 slug 即可启用。
//   basic  = id 1（Basic / 基本）
//   light  = id 2（Light / 轻：外观同 Basic 但更小，按稀有度由 1 个圆组成 1~5 个）
//   rose   = id 5（Rose / 玫瑰，治疗属性非常惊人，不过在战斗时就没那么好用了）
const ENABLED_PETAL_SLUGS = new Set([
  'basic', 'light', 'rose', 'stinger', 'pollen', 'honey', 'peas', 'leaf',
  'faster', 'third_eye', 'web', 'antennae', 'orange', 'missile', 'wax',
  'rice', 'corn', 'wing', 'ant_egg', 'clover', 'glass', 'basil', 'shovel', 'soil'
]);
// 不受 reach 模式影响的花瓣（按住空格时轨道半径不放大，保持基础距离）：
//   rose = 治疗型，延长轨道只会让回血更难命中主角，不计算延长效果。
// reach 对它【完全无效】：轨道半径不随空格放大（Peas 另有 fixedReach：恒定 detect 距离）
const REACH_IMMUNE_SLUGS = new Set(['rose', 'peas', 'missile']);
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
  // Orange：按现有 Basic 数值预先换算并硬编码，运行时不依赖 Basic。
  // dmg 为基础项（Basic 的 0.5 倍），命中时再加上次单击伤害的 0.5 倍，最终受 maxDamage 限制。
  orange: {
    common:    { dmg: 5,     hp: 10,    maxDamage: 100 },
    unusual:   { dmg: 15,    hp: 30,    maxDamage: 300 },
    rare:      { dmg: 45,    hp: 90,    maxDamage: 900 },
    epic:      { dmg: 135,   hp: 270,   maxDamage: 2700 },
    legendary: { dmg: 405,   hp: 810,   maxDamage: 8100 },
    mythic:    { dmg: 1215,  hp: 2430,  maxDamage: 24300 },
    ultra:     { dmg: 3645,  hp: 7290,  maxDamage: 72900 },
    super:     { dmg: 10935, hp: 21870, maxDamage: 218700 },
    eternal:   { dmg: 32805, hp: 65610, maxDamage: 656100 },
  },
  missile: {
    unusual:   { dmg: 105,    hp: 6 },
    rare:      { dmg: 315,    hp: 18 },
    epic:      { dmg: 945,    hp: 54 },
    legendary: { dmg: 2835,   hp: 162 },
    mythic:    { dmg: 8505,   hp: 486 },
    ultra:     { dmg: 25515,  hp: 1458 },
    super:     { dmg: 76545,  hp: 4374 },
    eternal:   { dmg: 229635, hp: 13122 },
  },
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
  },
  // Peas：4 个绿色小球实体（阵型型），数值表里是【单个小球】的 dmg/hp。
  //   对外显示走【合并口径】（statDisplay='total'）：卡面/悬浮框显示 4 个小球合计的一份数值，
  //   每个小球实体仍是各拿一份（结算不变）。详见 PETAL_STAT_DISPLAY。
  peas: {
    common:    { dmg: 15,    hp: 5 },
    unusual:   { dmg: 45,    hp: 15 },
    rare:      { dmg: 135,   hp: 45 },
    epic:      { dmg: 405,   hp: 135 },
    legendary: { dmg: 1215,  hp: 405 },
    mythic:    { dmg: 3645,  hp: 1215 },
    ultra:     { dmg: 10935, hp: 3645 },
    super:     { dmg: 32805, hp: 10935 },
    eternal:   { dmg: 98415, hp: 32805 },
  },
  // Leaf：从 Unusual 起；持续给主人回血（heal 为每秒计数，连续回血，无反馈）。dmg/hp/heal 均为此花瓣值。
  leaf: {
    unusual:   { dmg: 48,     hp: 36,    heal: 3 },
    rare:      { dmg: 144,    hp: 108,   heal: 9 },
    epic:      { dmg: 432,    hp: 324,   heal: 27 },
    legendary: { dmg: 1296,   hp: 972,   heal: 81 },
    mythic:    { dmg: 3888,   hp: 2916,  heal: 243 },
    ultra:     { dmg: 11664,  hp: 8748,  heal: 420.9 },
    super:     { dmg: 34992,  hp: 26244, heal: 729 },
    eternal:   { dmg: 104976, hp: 78732, heal: 1261.2 },
  },
  // Faster：伤害/血量逐级 ×3（common 12/5 与 wiki 一致）；
  // rotSpeed = 装备后给主角【加】的最大转速（rad/s），可叠加，与装填状态无关。
  faster: {
    common:    { dmg: 12,    hp: 5,     rotSpeed: 0.5 },
    unusual:   { dmg: 36,    hp: 15,    rotSpeed: 0.7 },
    rare:      { dmg: 108,   hp: 45,    rotSpeed: 0.9 },
    epic:      { dmg: 324,   hp: 135,   rotSpeed: 1.1 },
    legendary: { dmg: 972,   hp: 405,   rotSpeed: 1.3 },
    mythic:    { dmg: 2916,  hp: 1215,  rotSpeed: 1.5 },
    ultra:     { dmg: 8748,  hp: 3645,  rotSpeed: 1.7 },
    super:     { dmg: 26244, hp: 10935, rotSpeed: 1.9 },
    eternal:   { dmg: 78732, hp: 32805, rotSpeed: 2.1 },
  },
  // Antennae（触角）：装备型饰品，无伤害/血量。
  //   sight = 【视野放大比例】（0.10 = 看得远 10%）：相机缩放系数 = 1 / (1 + sight)，
  //   即"世界里能看到的范围变大"，由 Game 的相机缩放实现（平滑过渡，不瞬变）。
  // Antennae（触角）：装备型饰品，无伤害/血量。
  //   sight = 【视野扩大比例】（0.111 = 看得远 11.1%）。
  //   相机缩放系数 = 1 / (1 + sight) —— 视野放大 N% 就是"能看到的范围 ×(1+N)"。
  //   数值表对应官方相机缩放：0.9 / 0.85 / 0.8 / 0.75 / 0.7 / 0.5 / 0.35 / 0.2 / 0.1。
  antennae: {
    common:    { dmg: 0, hp: 0, sight: 0.111 },
    unusual:   { dmg: 0, hp: 0, sight: 0.176 },
    rare:      { dmg: 0, hp: 0, sight: 0.25 },
    epic:      { dmg: 0, hp: 0, sight: 0.333 },
    legendary: { dmg: 0, hp: 0, sight: 0.429 },
    mythic:    { dmg: 0, hp: 0, sight: 1.0 },
    ultra:     { dmg: 0, hp: 0, sight: 1.857 },
    super:     { dmg: 0, hp: 0, sight: 4.0 },
    eternal:   { dmg: 0, hp: 0, sight: 9.0 },
  },
  // Web：从 Unusual 起才有；dmg/hp 逐级 ×3；radius = 落地后那张网的半径（px）
  web: {
    unusual:   { dmg: 15,    hp: 15,    radius: 60 },
    rare:      { dmg: 45,    hp: 45,    radius: 70 },
    epic:      { dmg: 135,   hp: 135,   radius: 80 },
    legendary: { dmg: 405,   hp: 405,   radius: 100 },
    mythic:    { dmg: 1215,  hp: 1215,  radius: 150 },
    ultra:     { dmg: 3645,  hp: 3645,  radius: 200 },
    super:     { dmg: 10935, hp: 10935, radius: 250 },
    eternal:   { dmg: 32805, hp: 32805, radius: 300 },
  },
  // Wax（蜡块）：没有伤害，只有血量 + 半径；加载好立刻在玩家旁边落一块蜡，
  // 之后它就"长"在原地挡住生物（有碰撞箱，但不吸引、不造成伤害）。
  wax: {
    common:    { dmg: 0, hp: 1000,    radius: 30 },
    unusual:   { dmg: 0, hp: 3000,    radius: 60 },
    rare:      { dmg: 0, hp: 9000,    radius: 90 },
    epic:      { dmg: 0, hp: 27000,   radius: 120 },
    legendary: { dmg: 0, hp: 81000,   radius: 150 },
    mythic:    { dmg: 0, hp: 243000,  radius: 180 },
    ultra:     { dmg: 0, hp: 729000,  radius: 210 },
    super:     { dmg: 0, hp: 2187000, radius: 240 },
    eternal:   { dmg: 0, hp: 6561000, radius: 270 },
  },
  // Rice：高攻速、低单发的普通攻击花瓣（reload 0.05s）
  rice: {
    common:    { dmg: 4,     hp: 1 },
    unusual:   { dmg: 12,    hp: 3 },
    rare:      { dmg: 36,    hp: 9 },
    epic:      { dmg: 108,   hp: 27 },
    legendary: { dmg: 324,   hp: 81 },
    mythic:    { dmg: 972,   hp: 243 },
    ultra:     { dmg: 2916,  hp: 729 },
    super:     { dmg: 8748,  hp: 2187 },
    eternal:   { dmg: 26244, hp: 6561 },
  },
  // Corn：高血量（200 起）、中速（reload 7s）
  corn: {
    common:    { dmg: 8,      hp: 200 },
    unusual:   { dmg: 24,     hp: 600 },
    rare:      { dmg: 72,     hp: 1800 },
    epic:      { dmg: 216,    hp: 5400 },
    legendary: { dmg: 648,    hp: 16200 },
    mythic:    { dmg: 1944,   hp: 48600 },
    ultra:     { dmg: 5832,   hp: 145800 },
    super:     { dmg: 17496,  hp: 437400 },
    eternal:   { dmg: 52488,  hp: 1312200 },
  },
  // Wing：低血量、中速（reload 3s）。reach 模式下轨道距离按三角函数摆动（见 PETAL_TRAITS）。
  wing: {
    common:    { dmg: 20,     hp: 10 },
    unusual:   { dmg: 60,     hp: 30 },
    rare:      { dmg: 180,    hp: 90 },
    epic:      { dmg: 540,    hp: 270 },
    legendary: { dmg: 1620,   hp: 810 },
    mythic:    { dmg: 4860,   hp: 2430 },
    ultra:     { dmg: 14580,  hp: 7290 },
    super:     { dmg: 43740,  hp: 21870 },
    eternal:   { dmg: 131220, hp: 65610 },
  },
  // Clover（幸运草）：伤害/血量逐级 ×3；luck = 装上后给【玩家附近环境幸运值】加的数值
  // （环境幸运值规则见 LUCK_BASE / luckRarityShift，基准 -0.6 = 60% 降一级）。
  clover: {
    common:    { dmg: 10,     hp: 10,     luck: 0.1 },
    unusual:   { dmg: 30,     hp: 30,     luck: 0.2 },
    rare:      { dmg: 90,     hp: 90,     luck: 0.3 },
    epic:      { dmg: 270,    hp: 270,    luck: 0.4 },
    legendary: { dmg: 810,    hp: 810,    luck: 0.5 },
    mythic:    { dmg: 2430,   hp: 2430,   luck: 0.6 },
    ultra:     { dmg: 7290,   hp: 7290,   luck: 0.7 },
    super:     { dmg: 21870,  hp: 21870,  luck: 0.8 },
    eternal:   { dmg: 65610,  hp: 65610,  luck: 0.9 },
  },
  // Glass（玻璃）：伤害逐级 ×3；【没有血量】（不会被接触打碎，所以 hp 恒为 0）；
  // interval = 两次伤害之间必须间隔的秒数 —— 与 reload（装填）是两回事。
  glass: {
    common:    { dmg: 22,      hp: 0, interval: 1 },
    unusual:   { dmg: 66,      hp: 0, interval: 1 },
    rare:      { dmg: 198,     hp: 0, interval: 1 },
    epic:      { dmg: 594,     hp: 0, interval: 1 },
    legendary: { dmg: 1782,    hp: 0, interval: 1 },
    mythic:    { dmg: 5346,    hp: 0, interval: 1 },
    ultra:     { dmg: 16038,   hp: 0, interval: 1 },
    super:     { dmg: 48114,   hp: 0, interval: 1 },
    eternal:   { dmg: 144342,  hp: 0, interval: 1 },
  },
  // Basil（罗勒）：增疗花瓣 —— 没有伤害、没有血量，【只有】 Healing Bonus（回血增幅）。
  // 数值是百分比：Mythic 45% → Eternal 60%；低档官方没给数值 = 不产出这几档的卡。
  // 结算口径：在 PetalFX 的 ctx.heal 里【最后统一放大】—— 所有回血来源（Leaf 持续 /
  // Rose 一次性）先按自己的数值加起来，再乘 (1 + HealingBonus)，绝不各自提前乘。
  basil: {
    mythic:    { dmg: 0, hp: 0, healBonus: 0.45 },
    ultra:     { dmg: 0, hp: 0, healBonus: 0.50 },
    super:     { dmg: 0, hp: 0, healBonus: 0.55 },
    eternal:   { dmg: 0, hp: 0, healBonus: 0.60 },
  },
  // Ant Egg：Health 恒为 1（不随稀有度成长，官方表就是每档 1）；
  // 不造成伤害（它自己不打人，靠内容物 Soldier Ant）。
  ant_egg: {
    common:    { dmg: 0, hp: 1 },
    unusual:   { dmg: 0, hp: 1 },
    rare:      { dmg: 0, hp: 1 },
    epic:      { dmg: 0, hp: 1 },
    legendary: { dmg: 0, hp: 1 },
    mythic:    { dmg: 0, hp: 1 },
    ultra:     { dmg: 0, hp: 1 },
    super:     { dmg: 0, hp: 1 },
    eternal:   { dmg: 0, hp: 1 },
  },
  // Soil（泥土）：伤害 / 血量 / 花朵生命上限，三列都按官方表逐档给（10 -> 65610）。
  // flowerHp = "Flower Health"：装备时给花朵加的生命上限（多件相加）。
  soil: {
    common:    { dmg: 10,    hp: 10,    flowerHp: 50 },
    unusual:   { dmg: 30,    hp: 30,    flowerHp: 150 },
    rare:      { dmg: 90,    hp: 90,    flowerHp: 450 },
    epic:      { dmg: 270,   hp: 270,   flowerHp: 1350 },
    legendary: { dmg: 810,   hp: 810,   flowerHp: 4050 },
    mythic:    { dmg: 2430,  hp: 2430,  flowerHp: 12150 },
    ultra:     { dmg: 7290,  hp: 7290,  flowerHp: 36450 },
    super:     { dmg: 21870, hp: 21870, flowerHp: 109350 },
    eternal:   { dmg: 65610, hp: 65610, flowerHp: 328050 },
  },
  // Shovel（铲子）：没有伤害/血量，只有【装填时间】—— 按稀有度递减（官方表）。
  // 数值只影响 reload；"+2.0s"是遁地时长，写在 PETAL_TRAITS.shovel.burrow.dur。
  shovel: {
    common:    { dmg: 0, hp: 0, reload: 15.0 },
    unusual:   { dmg: 0, hp: 0, reload: 13.1 },
    rare:      { dmg: 0, hp: 0, reload: 11.8 },
    epic:      { dmg: 0, hp: 0, reload: 10.1 },
    legendary: { dmg: 0, hp: 0, reload: 8.5 },
    mythic:    { dmg: 0, hp: 0, reload: 6.9 },
    ultra:     { dmg: 0, hp: 0, reload: 5.2 },
    super:     { dmg: 0, hp: 0, reload: 3.6 },
    eternal:   { dmg: 0, hp: 0, reload: 2.0 },
  },
  // Third Eye：装备型饰品，没有伤害/血量，只有 attackRange（reach 模式下多伸出去的距离，px）
  third_eye: {
    common:    { dmg: 0, hp: 0, attackRange: 0 },
    unusual:   { dmg: 0, hp: 0, attackRange: 0 },
    rare:      { dmg: 0, hp: 0, attackRange: 0 },
    epic:      { dmg: 0, hp: 0, attackRange: 0 },
    legendary: { dmg: 0, hp: 0, attackRange: 40 },
    mythic:    { dmg: 0, hp: 0, attackRange: 90 },
    ultra:     { dmg: 0, hp: 0, attackRange: 140 },
    super:     { dmg: 0, hp: 0, attackRange: 190 },
    eternal:   { dmg: 0, hp: 0, attackRange: 240 },
  }
};

// 一卡多体的【数量】表：某稀有度这张卡实际由几个独立实体组成（表外稀有度 = 1）
//   light  : common 1 / unusual·rare 2 / epic·legendary 3 / mythic·ultra 5 / super·eternal 6
//            （按约定【不存在 4 个】这种排布；顶层 6 个对应 Duplicator 天赋效果）
//   pollen : common 1 / unusual 2 / rare 2 / epic 及以上 3（等同"一次放出 N 个 pollen 实体"）
//   stinger: Mythic 3 个 / Ultra 及以上 5 个
const PETAL_SUB_COUNT = {
  light: { common: 1, unusual: 2, rare: 2, epic: 3, legendary: 3, mythic: 5, ultra: 5, super: 6, eternal: 6 },
  pollen: { common: 1, unusual: 2, rare: 2, epic: 3, legendary: 3, mythic: 3, ultra: 3, super: 3, eternal: 3 },
  stinger: { mythic: 3, ultra: 5, super: 5, eternal: 5 },
  // Peas：所有稀有度均为 4 个实体（单个绿色小球才是实体，见阵型布局）
  peas: { common: 4, unusual: 4, rare: 4, epic: 4, legendary: 4, mythic: 4, ultra: 4, super: 4, eternal: 4 },
  orange: { common: 3, unusual: 3, rare: 3, epic: 3, legendary: 3, mythic: 3, ultra: 3, super: 3, eternal: 3 },
  // Ant Egg：所有稀有度都是 4 个蛋实体 = 4 只 Soldier Ant 的内容物
  ant_egg: { common: 4, unusual: 4, rare: 4, epic: 4, legendary: 4, mythic: 4, ultra: 4, super: 4, eternal: 4 }
};

const PETAL_FORMATION_ORBIT_SPOTS = { orange: 8 };
const PETAL_FORMATION_ORBIT_OFFSET = {};
const PETAL_FORMATION_ARC_BASE = new Set(['orange']);
const PETAL_FORMATION_AUTO_ROTATE = new Set(['orange']);

// ================= 一卡多体的两种排布模型（重要） =================
// A.【独立多体】Light / Pollen
//    每个实体各占【一个轨道位】，各自独立地绕着主角飞舞、各自被吸附。
//    卡面用通用 LIGHT_LAYOUTS（按数量查表）画出紧凑排布，实体端不套用该布局。
// B.【阵型多体】Stinger / Peas / Orange —— 同类花瓣按这里登记
//    所有子实体按固定布局围绕阵型中心锁定；可按需额外预留轨道角位以避免与其它花瓣重叠。
//    整体运动；外观与卡面一致。但每个子实体仍是独立个体：各自结算碰撞、各自有血量。
//    —— 即"被神秘力量锁定排列在一起"。
//
// 以后要新增这类花瓣，只需两步：
//   1) 在 PETAL_FORMATION_SLUGS 里加上它的 slug
//   2) 在 cards.js 的 FORMATION_LAYOUTS 里登记它的布局：
//      { <实体数>: [ {x, y, k, rot}, ... ] }  // x/y 单位 = 单体直径 D，k = 相对单体缩放，
//                                             // rot = 相对"单体朝向"的额外旋转（弧度）
// 【Ant Egg 不在这里】：它是【light 型】—— 4 个蛋各占一个轨道位、各自公转，
// 不保持紧凑阵型（做成 Peas 那种菱形阵型是错的）。
const PETAL_FORMATION_SLUGS = new Set(['stinger', 'peas', 'orange']);

// ---------------- 一卡多体的【数值显示口径】----------------
// 有些花瓣的官方模板是【合并显示】的：卡面/悬浮框上写的是"这一整张卡合计"的数值，
// 而不是单个实体的数值（Peas：4 个绿色小球合计一份伤害/血量，官方就是这么写的）。
// 这类花瓣必须【显式登记】，否则很容易把"合并值"当成"单体值"用 ——
// 表现就是每个小球都拿到了合计值（伤害翻 4 倍），或者卡面水缸永远是满的。
//   'each'  = 显示【单个实体】的数值（Light / Stinger / Pollen：默认口径）
//   'total' = 显示【整张卡合计】的数值（= 单体值 × 实体数；目前只有 Peas）
// 注意：这只影响【显示】（悬浮框 / 卡面数值 / 卡槽水缸分母）；
// 【实体结算】永远用数据表里的单体值（每个实体各拿一份），两者严格分开。
const PETAL_STAT_DISPLAY = {
  peas: 'total',
};

// 把"数据表里的单体数值"换算成【对外显示的数值】。
// 返回 { dmg, hp, heal, count, mul }：mul = 显示倍数（'total' 口径下 = 实体数）。
// 悬浮框、卡面数值、卡槽水缸分母都走这一个入口，避免三处各写一遍换算而对不上。
function petalDisplayStats(type, rarity) {
  const st = petalStatsFor(type, rarity);
  const n = (type && type.subCount) ? (type.subCount[rarity] || 1) : 1;
  const total = !!(type && type.statDisplay === 'total') && n > 1;
  const mul = total ? n : 1;
  return {
    // 先【原样透传】数据表里的其余字段（rotSpeed / attackRange / sight / radius / duration …），
    // 只覆盖"会随显示口径换算"的三项。
    // 少透传一项，那个属性就会在悬浮框里整行消失（Third Eye / Antennae / Faster 都栽过这里）。
    ...st,
    dmg: (st.dmg || 0) * mul,
    hp: (st.hp || 0) * mul,
    heal: (st.heal || 0) * mul,
    count: n,
    mul: mul
  };
}

// Honey 的「Max Mob Rarity」：只能吸引到这一档及以下的生物（颜色 #d2eb34）
//   · common  【没有这项属性】-> 什么都吸引不了（缺失 = 无吸引，绝不能当成"不限"）
//   · unusual 起才生效：unusual 最高只能吸引 common，之后每档高一档
// 注意：表里【没有】的稀有度必须被视为"吸引不到任何生物"，由 petal-effects.js 的判定保证。
const HONEY_MAX_MOB_RARITY = {
  unusual: 'common', rare: 'unusual', epic: 'rare', legendary: 'epic', mythic: 'legendary',
  ultra: 'mythic', super: 'ultra', eternal: 'super'
};
const MAX_MOB_RARITY_COLOR = '#d2eb34';

// ---- 属性【标签文字】颜色（唯一来源）----
// 每种属性固定一个颜色，与“这一行排在第几位”完全无关。
// （曾用“按行序取色”的数组：只要某张卡缺一项、或新增一项属性，后面所有属性的颜色就会串位。）
// 数值列一律白色；只有需要强调数值的地方才用 row.valueColor 覆盖（如 Max Mob Rarity 的稀有度名）。
const STAT_LABEL_COLORS = {
  health: '#7fe08a',           // 生命绿
  damage: '#ff6b6b',           // 伤害红
  heal: HEAL_TEXT_COLOR,       // 治疗粉（与玫瑰回血飘字同色，绝不与伤害红/生命绿混用）
  armor: '#b8c6d1',            // 护甲灰蓝
  poison: MOB_POISON_COLOR,    // 中毒紫罗兰
  bonus: MAX_MOB_RARITY_COLOR, // 装备类属性：Max Mob Rarity / 转速 / 攻击距离 / 视野 / 幸运 / 间隔 / 半径 / 内容物
  duration: (RARITIES.rare && RARITIES.rare.color) || '#4D52E3'
};

// ---- 花瓣能力声明 ----
// 行为层（运动 / 装填 / 战斗 / UI）只读这些字段，不再按 slug 写分支。
// 新增一种花瓣：registry 登记 + 加进 ENABLED_PETAL_SLUGS，需要特殊能力时在这里声明。
// 字段含义：
//   detachAfter            脱轨延时（>0 = 滞留型：脱离轨道后留在原地）
//   launch                 脱轨瞬间喷射 { count 方向数, speedK 速度倍率, life 存活秒数 }
//   launchRadial           launch 的方向取【脱轨瞬间的轨道角】而不是按 sub 均分（单实体 + 尖端朝外）
//   sticky                 【会不会被生物"吸"过去黏在表面揉搓】。只影响吸附/落点，不影响碰撞——
//                          所有花瓣都是实体、都和生物结算碰撞（分离 + 双向伤害），
//                          该字段不决定"能不能穿过去"。
//   attractMobs            把周围生物的仇恨拉到自己身上
//   holdReloadUntilDeath   实体未死亡前卡片不重新装填
//   noDamage               不造成伤害（只挨打）
//   healOverTime           持续回血，数值单位为「每秒」（展示为 x/s）
//   maxMobRarity           可吸引的最高生物稀有度表
const PETAL_TRAITS = {
  // —— 8 种启用花瓣的吸附属性（唯一来源，行为层只读它）——
  basic: { sticky: false },
  light: { sticky: false },
  rose: { sticky: false },
  stinger: { sticky: false },
  leaf: { reload: 1.8, healOverTime: true, sticky: false },
  orange: { reload: 1.5, sticky: false },
  pollen: { reload: 2.0, reloadText: '2.0s + 0.5s', detachAfter: 0.5, sticky: false },
  // Peas：固定按 detect 的距离公转（不随模式伸/缩），模式只影响它的特殊效果与判定。
  peas: {
    reload: 1.5, detachAfter: 0.05, launch: { count: 4, speedK: 1.3, life: 2.0 },
    sticky: false, fixedReach: 'detect'
  },
  // Missile（导弹）：常态绕玩家公转、【尖端朝外】；reach 模式加载完成即沿当前轨道角
  // 尖端朝前飞出，飞行中不旋转，2s 后消失。orbitK = 贴花系数（比普通花瓣更靠近本体）。
  // 不受 reach 影响（noReach），与 Rose 同一类。
  // 发射走与 Peas 完全相同的那条链路（launch 能力字段 + 引擎默认 detach），
  // launchRadial 只声明"方向取轨道角"。
  missile: {
    reload: 1.5, launchMode: 'reach',
    launch: { count: 1, speedK: 1.3, life: 2.0 }, launchRadial: true,
    orientOutward: true, noReach: true, orbitK: 0.55, sticky: false
  },
  // 蜜会被生物吸住并贴在表面（吸血式"拉仇恨"的载体），其它花瓣保持轨道运动。
  honey: {
    reload: 2.0, reloadText: '2.0s + 0.5s', detachAfter: 0.5,
    sticky: true, attractMobs: true, holdReloadUntilDeath: true, noDamage: true,
    maxMobRarity: HONEY_MAX_MOB_RARITY
  },
  // Faster：普通攻击花瓣（数值见 PETAL_RARITY_OVERRIDES），额外给主角加最大转速。
  // 它"活泼"的飘动由 PetalFX 的 orbitOffset 注册项实现——数据层不描述表现。
  faster: { reload: 2.5, sticky: false },
  // Third Eye：装备型饰品（accessory）——
  //   · 不进入轨道、没有装填、不参与战斗，固定在人物额头并随朝向转动；
  //   · 同种不可堆叠：装备多个时只有最左边那格生效，其余强制为暗灰未装填态；
  //   · 效果 = reach 模式下把花瓣再向外伸 attackRange 像素（见 PETAL_RARITY_OVERRIDES）。
  // sticky 必须显式声明（特性表完整性断言要求每张启用花瓣都有 boolean）
  third_eye: { accessory: true, stackable: false, noDamage: true, sticky: false, reload: 0 },
  // Antennae（触角）：装备型饰品（同 Third Eye 的形态：不进轨道、无战斗、固定在人物身上）。
  //   效果 = 视野扩大：bonus.sight（0.10 = 看得远 10%），由相机缩放实现（平滑过渡）。
  //   同种不可堆叠：视野是全局能力，重复装备没有意义（只有最左边那格生效）。
  antennae: { accessory: true, stackable: false, noDamage: true, sticky: false, reload: 0 },
  // Web：reach 模式下脱轨、顺惯性飞出，0.5s 后自毁并原地张开一张网（由 PetalFX 接管）。
  //   web.duration = 网的存在时长（秒）；web.radius 按稀有度在 PETAL_RARITY_OVERRIDES 里。
  //   装填立刻开始（不像 Honey 那样等实体消失），与 Pollen 同款"放下就走"。
  web: { reload: 3.0, reloadText: '3.0s + 0.5s', detachAfter: 0.05, sticky: false, web: { duration: 10 } },
  // Wax（蜡块）：装填 30s；加载好【立刻】脱轨（不需要 reach），落在玩家旁边；
  // 卡面跟着实体走，实体死了才重新装填（holdReloadUntilDeath）。
  // noDamage = 不造成伤害；不吸引生物（没有 attractMobs）。
  wax: {
    reload: 30, reloadText: '30.0s', sticky: false, noDamage: true,
    autoDetach: true, holdReloadUntilDeath: true
  },
  // Clover（幸运草）：普通攻击花瓣（伤害/血量/幸运都在 PETAL_RARITY_OVERRIDES）。
  // 幸运效果不是"给自己加属性"，而是把玩家附近 CLOVER_LUCK_R 内的环境幸运值抬高 ——
  // 由服务端在生成生物时读取（见 LocalServer._ambientLuck），这里只声明它能给多少。
  // 【同种不可堆叠】（与 Third Eye / Antennae 同口径）：一个玩家只有最左边那格生效。
  // 注意这是"卡不可叠"，不是"效果不可叠"：不同玩家各带一张时，各自那份幸运照常加算
  // （_ambientLuck 是逐玩家求和，见 server.js）。
  clover: { reload: 2.5, reloadText: '2.5s', sticky: false, stackable: false },
  // Basil（罗勒）：增疗花瓣 —— 没有伤害、没有血量、也没有碰撞箱；
  // 它不参与战斗结算（noDamage + noHealth + noPush），只挂着给玩家的回血加成（healBonus）。
  // 图层同 Glass（overMobs）：没有碰撞的花瓣画在生物之上，否则会被生物整个盖住。
  basil: {
    reload: 2.5, reloadText: '2.5s', sticky: false, noDamage: true,
    noPush: true, noKnockback: true, noHealth: true, overMobs: true
  },
  // Glass（玻璃）：没有碰撞箱（不分离、不被推）、不传递击退、也没有血量；
  // 与生物接触时【单向】结算一次伤害（生物那份打不过来：它没有 health），
  // 然后进入 interval 秒的冷却期，期内不再结算 —— 注意 interval ≠ reload。
  glass: {
    reload: 2.5, reloadText: '2.5s', sticky: false,
    noPush: true, noKnockback: true, noHealth: true, overMobs: true
  },
  // Soil（泥土）：普通攻击花瓣（伤害/血量按稀有度，见 PETAL_RARITY_OVERRIDES.soil），
  // 装备即生效的属性（不依赖是否装填）：
  //   · soil.radius = +5：主人物半径平滑增加（多件叠加）；
  //   · flowerHp（按稀有度）= 花朵生命上限增加，现有生命等比放大（血条百分比不变）；
  //   · soil.speedMul = 0.75：最大移速 ×0.75，多件【按乘积】叠加。
  // 三个数值都走 PetalFX.bonus -> Player.recompute 求和/求积，行为层不判断 slug。
  soil: {
    reload: 2.5, reloadText: '2.5s', sticky: false,
    soil: { radius: 5, speedMul: 0.75 }
  },
  // Shovel（铲子）：不参与任何实体碰撞/结算（与 Basil 同口径：noDamage + noHealth +
  // noPush + noKnockback + overMobs），只有一个"使用"效果：
  //   · 装填完成时若处于 detect 模式 -> 【立即遁地】burrow.dur 秒（见 Player._startBurrow）；
  //   · 遁地期间所有花瓣强制禁用（实体下架 + 装填冻结），恢复后全部从 0 重新装填；
  //   · 遁地者隐身（生物感知不到、也没有碰撞箱），只留一片灰色阴影。
  // reload 按稀有度递减，在 PETAL_RARITY_OVERRIDES.shovel 里（15.0s -> 2.0s）。
  shovel: {
    reload: 15.0, reloadText: null, sticky: false,
    noDamage: true, noPush: true, noKnockback: true, noHealth: true, overMobs: true,
    burrow: { mode: 'detect', dur: 2.0 }
  },
  // Ant Egg：60s 装填；不做伤害；一卡 4 个蛋实体（见 PETAL_SUB_COUNT）。
  // 单个蛋实体死亡 -> 原地召唤一只【玩家阵营】的同等级 Soldier Ant（0.25 尺寸/数值）；
  // 该蛋【不立刻重装填】，等召唤物死亡后才开始 60s 冷却。
  ant_egg: {
    reload: 60, reloadText: '60.0s', sticky: false, noDamage: true,
    summon: { slug: 'soldier_ant', scale: 0.25 },
    holdReloadUntilSummonDead: true
  },
  // Rice：极快装填的普通攻击花瓣
  rice: { reload: 0.05, reloadText: '0.05s', sticky: false },
  // Corn：高血量普通攻击花瓣
  corn: { reload: 7.0, reloadText: '7.0s', sticky: false },
  // Wing：reach 模式下轨道距离在 [reach, reach + 2.5×天然reach] 之间按三角函数平滑摆动，
  //   周期 2s；自转每秒 2 圈（独立于公转）；自转轴心 = 外边缘圆弧的圆心
  //   （由 wingPivot 在对位时补偿，见 PetalFX）。
  wing: {
    reload: 3.0, reloadText: '3.0s', sticky: false,
    reachWave: { spanK: 5.0, period: 2.0 },
    selfSpin: TAU * 2,
    // 自转轴心 = 【半月形外边缘那条圆弧的圆心】（用户口径：圆弧要一直落在同一个固定圆上）。
    // 8.svg 的凸包是一条完美圆弧：圆心 (55.000, 47.858)、R=21.4288、拟合残差 0.0009。
    // 实体窗口 = 以内容包围盒中心 (56.698, 52.783) 为心、边长 43.7467 的正方形
    //（含 stroke-width 4.286 的 2.143 外扩，见 cards.js 的 artSvg）。
    // drawArt 的 ox/oy 是"图像平移 / size"，所以偏移 = (窗口中心 − 圆心) / 窗口边长：
    //   (56.698 − 55.000) / 43.7467 = 0.03883
    //   (52.783 − 47.858) / 43.7467 = 0.11259
    // 旧值 (0.5389, 0.8049) 是拿"内容框宽度 39.461"当分母算的（还拟合错了圆心），
    // 偏移被放大十几倍 -> 轴心被甩到形体之外，看起来就是"绕着碰撞圈外沿转"。
    spinOrigin: { x: 0.03883, y: 0.11259 }
  }
};

function buildPetalTypes() {
  const reg = (window.REGISTRY && window.REGISTRY.petals) ? window.REGISTRY.petals : [];
  const out = [];
  const PETAL_BY_ID = {};
  for (const p of reg) {
    const id = p.id;
    // 忽略二创 —— 但【显式列进白名单的优先】：Wax 的 registry id = 96 落在 95+ 区间，
    // 而它确实是官方花瓣；只看 id 区间会把它误判成二创直接丢掉。
    const slugDraft = (p.name && String(p.name).trim())
      ? String(p.name).trim().toLowerCase().replace(/ /g, '_') : '';
    if (id >= FANMADE_PETAL_FROM && !ENABLED_PETAL_SLUGS.has(slugDraft)) {
      flagManual('petal', id, p.name, '二创内容已忽略（如需启用请手填 registry）');
      continue;
    }
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
    const tr = PETAL_TRAITS[slug] || {};   // 该花瓣声明的能力（见 PETAL_TRAITS）
    const t = {
      id, key, name,
      slug,                                    // 供 I18N 查 Description（Petals/<slug>/Description）
      zh: p.zh || '',
      svg: id,                                  // assets/petals/<id>.svg
      dmg: (p.stats && p.stats.dmg) || 0,
      hp: (p.stats && p.stats.hp) || 0,
      heal: (p.stats && p.stats.heal) || 0,      // 治疗量：只有部分花瓣有（如 Rose），0 = 无此属性
      // stats.spd = 【花瓣自身的移动速度】修正（Wing 44 = 飞得快、Rose -12 = 飞得慢），
      // 不是玩家移速加成 —— 绝不能累加到 Player.speed 上（装多张 Wing 会让角色越跑越快）。
      // 玩家侧真正生效的加成只有 PetalFX.bonus 给的 rotSpeed / reach / sight。
      spd: (p.stats && p.stats.spd) || 0,
      // 冷却秒数：优先用显式的 reload；否则取 stats.spd（目前只有 Basic 走这条）。
      // 注意 stats.spd 的本义是移动速度修正值（Rose 为 -12），所以有 reload 字段时以它为准。
      reload: (p.reload != null) ? p.reload : Math.max(0, (p.stats && p.stats.spd) || 0),
      reloadText: p.reloadText || null,          // 冷却的展示文本（如 "3.5s + 1.5s"），为空则按 reload 生成
      rarityMultipliers: p.rarityMultipliers || null,  // 稀有度倍率表（仅Basic有）
      rarityStats: p.rarityStats || null,        // 各稀有度数值表（Rose 有：dmg/hp/heal）
      kind: p.kind || 'misc',
      // ---- 能力字段：全部来自 PETAL_TRAITS，行为层只读字段、不判断 slug ----
      detachAfter: tr.detachAfter || 0,            // 滞留型：脱轨延时（>0 生效）
      launch: tr.launch || null,                    // 喷射参数（Peas）
      // 喷射方向取【脱轨瞬间的轨道角】（Missile）：漏了这一行，方向会退化成"按 sub 均分 + 自转"，
      // 起手就比轨道朝向歪一个素材尖端角（看起来就是"发射瞬间轉一个向"）。
      launchRadial: !!tr.launchRadial,
      launchMode: tr.launchMode || null,
      launchDelay: tr.launchDelay || 0,
      orientOutward: !!tr.orientOutward,
      sticky: !!tr.sticky,                          // 会被生物吸住揉搓（唯一来源，见 PETAL_TRAITS 注释）
      attractMobs: !!tr.attractMobs,                // 吸引周围生物仇恨（Honey）
      holdReloadUntilDeath: !!tr.holdReloadUntilDeath,
      noDamage: !!tr.noDamage,
      // 穿透型（Glass）：没有碰撞箱、不传击退、没有血量（永远打不碎）
      noPush: !!tr.noPush,
      noKnockback: !!tr.noKnockback,
      noHealth: !!tr.noHealth,
      // 图层高于生物（Glass）：Player.draw 跳过，由 game.render 在生物之后补画
      overMobs: !!tr.overMobs,
      // 场地型（Web）：{ duration } —— 落地那张网的存在时长（半径按稀有度，在 rarityStats 里）
      web: tr.web || null,
      // 遁地型（Shovel）：{ mode, dur } —— 该模式下载荷完成后立即遁地 dur 秒
      burrow: tr.burrow || null,
      // 装备加成型（Soil）：{ radius, speedMul } —— 装备即生效的额外半径与移速倍率
      soil: tr.soil || null,
      // 自动落地（Wax）：加载好立刻脱轨，不需要 reach/detect
      autoDetach: !!tr.autoDetach,
      // 装备型（饰品）：不进入轨道、无装填，固定在人物身上（Third Eye）
      accessory: !!tr.accessory,
      // 同种能否多件同时生效；false = 只有最左边那格生效，其余为暗灰未装填态
      stackable: tr.stackable !== false,
      healOverTime: !!tr.healOverTime,              // 持续回血，数值单位为「每秒」（Leaf）
      maxMobRarity: tr.maxMobRarity || null,
      // 一卡多体（Pollen / Stinger）：每个实体各占一个轨道位、各自结算
      subCount: PETAL_SUB_COUNT[slug] || null,
      // 数值显示口径（'each' 单体 / 'total' 合并）：见 PETAL_STAT_DISPLAY。
      // 只影响显示（悬浮框 / 卡面数值 / 卡槽水缸分母），不改实体结算。
      statDisplay: PETAL_STAT_DISPLAY[slug] || 'each',
      // 【阵型多体】（Stinger 起）：整坨只占一个轨道位，子实体按卡面布局锁定成一坨，
      // 外观与卡面一致，但各子实体仍独立结算碰撞与血量
      formation: PETAL_FORMATION_SLUGS.has(slug),
      formationOrbitSpots: PETAL_FORMATION_ORBIT_SPOTS[slug] || 0,
      formationOrbitOffset: PETAL_FORMATION_ORBIT_OFFSET[slug] || 0,
      formationArcBase: PETAL_FORMATION_ARC_BASE.has(slug),
      formationAutoRotate: PETAL_FORMATION_AUTO_ROTATE.has(slug),
      // reach 模式免疫：轨道半径不随空格（reach）放大（见 sim/player.js _syncPetals）
      noReach: REACH_IMMUNE_SLUGS.has(slug),
      // 轨道半径系数（1 = 标准；< 1 = 更贴近本体，如 Missile 的贴花）
      orbitK: (tr.orbitK != null) ? tr.orbitK : 1,
      // 固定轨道距离（'detect'）：无论当前模式如何，都按该模式的距离公转
      fixedReach: tr.fixedReach || null,
      // reach 模式下的轨道距离摆动（Wing）：{ spanK, period }
      //   区间 = [reach, reach + spanK × 天然reach]，按正弦平滑来回，period 秒一个周期
      reachWave: tr.reachWave || null,
      // 自转角速度（Wing = 每秒 2 圈），独立于公转
      selfSpin: tr.selfSpin || 0,
      // 自转轴心偏移（图形中心相对轴心的距离，归一化到绘制尺寸）
      spinOrigin: tr.spinOrigin || null,
      // 内容物：本体死亡时召唤的物种（Ant Egg -> Soldier Ant）
      summon: tr.summon || null,
      holdReloadUntilSummonDead: !!tr.holdReloadUntilSummonDead,
      identified: true,
      wiki: p.wiki || null
    };
    // ---- 手工补全（registry 里这些卡只有 common 一行 / 没有冷却字段）----
    const ov = PETAL_RARITY_OVERRIDES[slug];
    if (ov) {
      t.rarityStats = Object.assign({}, t.rarityStats || {});
      for (const rk in ov) t.rarityStats[rk] = Object.assign({}, t.rarityStats[rk] || {}, ov[rk]);
    }
    // 冷却与展示文案同样来自 PETAL_TRAITS。
    // registry 里这些卡没有 reload 字段，若走 stats.spd 回退会取到"移速修正"值，
    // 得到 16s 这种错误冷却 —— 所以冷却必须由数据表显式声明。
    if (tr.reload != null) t.reload = tr.reload;
    if (tr.reloadText) t.reloadText = tr.reloadText;
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
  // 时长这类"与稀有度无关"的字段没有逐档表，统一从能力声明里兜底（Web: 10s）。
  const dur = (type.web && type.web.duration) || 0;
  const pick = (o) => ({
    dmg: o.dmg || 0, hp: o.hp || 0, heal: o.heal || 0, maxDamage: o.maxDamage || 0,
    // 装备加成类属性（0 = 没有这一项）：转速加成 / reach 加成 / 视野放大
    rotSpeed: o.rotSpeed || 0, attackRange: o.attackRange || 0,
    sight: o.sight || 0,
    // 环境幸运值加成（Clover）/ 两次伤害之间的间隔秒数（Glass）：0 = 没有这一项
    luck: o.luck || 0, interval: o.interval || 0,
    // 回血增幅（Basil）：0 = 没有这一项（0.45 = 回血 +45%）
    healBonus: o.healBonus || 0,
    // 场地型花瓣（Web）：落地网的半径 + 存在时长（0 = 没有这一项）
    radius: o.radius || 0, duration: o.duration || dur,
    // 装填秒数（Shovel 等按稀有度递减的卡）：null = 该稀有度没单独声明
    reload: (o.reload != null) ? o.reload : null,
    // 花朵生命上限加成（Soil 的 Flower Health）：装备时加到主人物身上
    flowerHp: o.flowerHp || 0
  });
  const rs = type.rarityStats && type.rarityStats[rarity];
  if (rs) return pick(rs);
  const mult = type.rarityMultipliers && type.rarityMultipliers[rarity];
  const s = type;
  if (mult) {
    return {
      dmg: (s.dmg || 0) * (mult.dmg || 1),
      hp: (s.hp || 0) * (mult.hp || 1),
      heal: (s.heal || 0) * (mult.heal || 1),
      maxDamage: (s.maxDamage || 0) * (mult.maxDamage || 1),
      rotSpeed: (s.rotSpeed || 0) * (mult.rotSpeed || 1),
      attackRange: (s.attackRange || 0) * (mult.attackRange || 1),
      sight: (s.sight || 0) * (mult.sight || 1),
      luck: (s.luck || 0) * (mult.luck || 1),
      interval: s.interval || 0,
      healBonus: s.healBonus || 0,
      radius: (s.radius || 0) * (mult.radius || 1),
      duration: s.duration || dur,
      reload: null,
      flowerHp: 0
    };
  }
  return pick(s);
}

// 某张卡【按稀有度】的装填秒数 —— 装填计时的唯一入口。
// 取值顺序：rarityStats[rarity].reload（Shovel：15.0s -> 2.0s）> type.reload > stats.spd。
// 客户端预测副本与服务端权威副本都读它，卡面/悬浮框展示也读它，永远不会出现
// "客户端按 15s 装填、服务端按 2s 装填"这种两端各算一套的情况。
function petalReloadOf(card) {
  const t = card && card.type;
  if (!t) return 0;
  const st = petalStatsFor(t, card.rarity);
  if (st && st.reload != null) return st.reload;
  if (t.reload != null) return t.reload;
  return Math.max(0, t.spd || 0);
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
// Missile 素材（assets/petals/9.svg，已含 translate(3.606 9.458)）的三角形三点：
//   底边 (67.096,70.538) - (42.903,48.723)，尖端 (57.328,39.461)。
// 旋转轴心是内容包围盒中心 (55,55)，尖端朝向必须按「中心 -> 尖端」计算。
// SVG 源码（9.svg，viewBox 0 0 110 110，g transform="translate(3.606 9.458)"）：
//   path d="m63.49 61.08-9.768-31.077-14.425 9.262z" 的三个绝对顶点：
//     A(67.096, 70.538) / B(57.328, 39.461) / C(42.903, 48.723)
//   A 的夹角约 30.6°（B、C 各约 74.7°），即尖端在右下方向。
const MISSILE_TIP_ANGLE = Math.atan2(70.538 - 55, 67.096 - 55);
// 手工校正的稀有度数值表（键 = 生物 id）。
// registry 中部分生物缺少字段或数值不完整，
// 这里按官方数据整表覆盖：hp = Health、dmg = Damage、armor = Armor、exp = XP Reward。
// 只覆盖列出的稀有度，其余沿用 registry。
const MOB_RARITY_OVERRIDES = {
  // Soldier Ant 兵蚁（id 7）：官方表逐档写实。
  //   hp 100 → 2.6244e9，dmg 10 → 65610，armor 1/2/7/22/65/194/583(超以上固定)，
  //   exp 1/2/6/44/400/5437/227398/13608888(超以上固定)。
  // 它是 Ant Egg 的内容物，也作为普通敌对生物存在（本作只用于召唤，不自然生成）。
  7: {
    common:    { hp: 100,        dmg: 10,    armor: 1,   exp: 1 },
    unusual:   { hp: 375,        dmg: 30,    armor: 2,   exp: 2 },
    rare:      { hp: 1350,       dmg: 90,    armor: 7,   exp: 6 },
    epic:      { hp: 5400,       dmg: 270,   armor: 22,  exp: 44 },
    legendary: { hp: 32400,      dmg: 810,   armor: 65,  exp: 400 },
    mythic:    { hp: 315900,     dmg: 2430,  armor: 194, exp: 5437 },
    ultra:     { hp: 14580000,   dmg: 7290,  armor: 583, exp: 227398 },
    super:     { hp: 437400000,  dmg: 21870, armor: 583, exp: 13608888 },
    eternal:   { hp: 2624400000, dmg: 65610, armor: 583, exp: 13608888 },
  },
  // Baby Ant 幼蚁（id 5）：官方表整表写实（Passive，被打了才反击）。
  5: {
    common:    { hp: 25,        dmg: 10,    armor: 1,   exp: 1 },
    unusual:   { hp: 93.8,      dmg: 30,    armor: 2,   exp: 2 },
    rare:      { hp: 337.5,     dmg: 90,    armor: 7,   exp: 9 },
    epic:      { hp: 1350,      dmg: 270,   armor: 22,  exp: 67 },
    legendary: { hp: 8100,      dmg: 810,   armor: 65,  exp: 615 },
    mythic:    { hp: 78975,     dmg: 2430,  armor: 194, exp: 8164 },
    ultra:     { hp: 3645000,   dmg: 7290,  armor: 583, exp: 345862 },
    super:     { hp: 109350000, dmg: 21870, armor: 583, exp: 19893553 },
    eternal:   { hp: 656100000, dmg: 65610, armor: 583, exp: 19893553 },
  },
  // Worker Ant 工蚁（id 6）：官方表整表写实（Neutral，与中立瓢虫同一档阵营）：
  //   hp 60 → 1.57464e9，dmg 10 → 65610，armor 1/2/7/22/65/194/583(超以上固定)，
  //   exp 1/1/4/31/279/4105/147030/9345409(超以上固定)。
  // Ant Egg 蚁卵（id 40）：障碍型生物，固定在原地。注意它和花瓣 Ant Egg 是两个东西。
  40: {
    common:    { hp: 150,        dmg: 3,     armor: 1,   exp: 1 },
    unusual:   { hp: 562.5,      dmg: 9,     armor: 2,   exp: 1 },
    rare:      { hp: 2025,       dmg: 27,    armor: 7,   exp: 3 },
    epic:      { hp: 8100,       dmg: 81,    armor: 22,  exp: 21 },
    legendary: { hp: 48600,      dmg: 243,   armor: 65,  exp: 190 },
    mythic:    { hp: 473850,     dmg: 729,   armor: 194, exp: 2614 },
    ultra:     { hp: 21870000,   dmg: 2187,  armor: 583, exp: 106740 },
    super:     { hp: 656100000,  dmg: 6561,  armor: 583, exp: 6475563 },
    eternal:   { hp: 3936600000, dmg: 19683, armor: 583, exp: 6475563 },
  },
  // Queen Ant 蚁后（id 8）：AI 与兵蚁基本一致，额外会产卵（Rare+）。
  8: {
    common:    { hp: 250,        dmg: 10,    armor: 1,   exp: 1 },
    unusual:   { hp: 937.5,      dmg: 30,    armor: 2,   exp: 1 },
    rare:      { hp: 3375,       dmg: 90,    armor: 7,   exp: 4 },
    epic:      { hp: 13500,      dmg: 270,   armor: 22,  exp: 31 },
    legendary: { hp: 81000,      dmg: 810,   armor: 65,  exp: 287 },
    mythic:    { hp: 789750,     dmg: 2430,  armor: 194, exp: 4425 },
    ultra:     { hp: 36450000,   dmg: 7290,  armor: 583, exp: 285763 },
    super:     { hp: 1093500000, dmg: 21870, armor: 583, exp: 15878612 },
    eternal:   { hp: 6561000000, dmg: 65610, armor: 583, exp: 15878612 },
  },
  // Ant Hole 蚁穴（id 9）：障碍型生物（固定不动、无穷重量）。
  9: {
    common:    { hp: 750,          dmg: 15,    armor: 1,   exp: 1 },
    unusual:   { hp: 2812.5,       dmg: 45,    armor: 2,   exp: 2 },
    rare:      { hp: 10125,        dmg: 135,   armor: 7,   exp: 5 },
    epic:      { hp: 40500,        dmg: 405,   armor: 22,  exp: 39 },
    legendary: { hp: 243000,       dmg: 1215,  armor: 65,  exp: 356 },
    mythic:    { hp: 2369250,      dmg: 3645,  armor: 194, exp: 4980 },
    ultra:     { hp: 109350000,    dmg: 10935, armor: 583, exp: 197906 },
    super:     { hp: 3280500000,   dmg: 32805, armor: 583, exp: 12142438 },
    eternal:   { hp: 19683000000,  dmg: 98415, armor: 583, exp: 12142438 },
  },
  6: {
    common:    { hp: 60,        dmg: 10,    armor: 1,   exp: 1 },
    unusual:   { hp: 225,       dmg: 30,    armor: 2,   exp: 1 },
    rare:      { hp: 810,       dmg: 90,    armor: 7,   exp: 4 },
    epic:      { hp: 3240,      dmg: 270,   armor: 22,  exp: 31 },
    legendary: { hp: 19440,     dmg: 810,   armor: 65,  exp: 279 },
    mythic:    { hp: 189540,    dmg: 2430,  armor: 194, exp: 4105 },
    ultra:     { hp: 8748000,   dmg: 7290,  armor: 583, exp: 147030 },
    super:     { hp: 262440000, dmg: 21870, armor: 583, exp: 9345409 },
    eternal:   { hp: 1574640000, dmg: 65610, armor: 583, exp: 9345409 },
  },
  // Spider 蜘蛛（id 21）：hp/dmg/armor/exp 全部按官方最新口径整表覆盖；
  //   poison     = 命中玩家后施加的【中毒总量】（总量固定，按 poisonRate 均摊扣完）
  //   poisonRate = 中毒的每秒伤害（每秒掉多少，决定这次中毒持续多久 = 总量 / 速率）
  21: {
    common:    { hp: 60,         dmg: 15,    armor: 1,   exp: 1,        poison: 40,     poisonRate: 15 },
    unusual:   { hp: 225,        dmg: 45,    armor: 2,   exp: 2,        poison: 120,    poisonRate: 45 },
    rare:      { hp: 810,        dmg: 135,   armor: 7,   exp: 5,        poison: 360,    poisonRate: 135 },
    epic:      { hp: 3240,       dmg: 405,   armor: 22,  exp: 41,       poison: 1080,   poisonRate: 405 },
    legendary: { hp: 19440,      dmg: 1215,  armor: 65,  exp: 379,      poison: 3240,   poisonRate: 1215 },
    mythic:    { hp: 189540,     dmg: 3645,  armor: 194, exp: 5259,     poison: 9720,   poisonRate: 3645 },
    ultra:     { hp: 8748000,    dmg: 10935, armor: 583, exp: 219486,   poison: 29160,  poisonRate: 10935 },
    super:     { hp: 262440000,  dmg: 32805, armor: 583, exp: 13451796, poison: 87480,  poisonRate: 32805 },
    eternal:   { hp: 1574640000, dmg: 98415, armor: 583, exp: 13451796, poison: 262440, poisonRate: 98415 },
  },
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
  },
  27: {  // Bumble Bee 大黄蜂（被动、不会产生仇恨）
    common:    { hp: 25,        dmg: 20,     armor: 1,   exp: 1 },
    unusual:   { hp: 93.8,      dmg: 60,     armor: 2,   exp: 1 },
    rare:      { hp: 337.5,     dmg: 180,    armor: 7,   exp: 10 },
    epic:      { hp: 1350,      dmg: 540,    armor: 22,  exp: 93 },
    legendary: { hp: 8100,      dmg: 1620,   armor: 65,  exp: 877 },
    mythic:    { hp: 78975,     dmg: 4860,   armor: 194, exp: 10568 },
    ultra:     { hp: 3645000,   dmg: 14580,  armor: 583, exp: 492262 },
    super:     { hp: 109350000, dmg: 43740,  armor: 583, exp: 24350794 },
    eternal:   { hp: 656100000, dmg: 131220, armor: 583, exp: 24350794 },
  },
  // Hornet 黄蜂 —— 数值【严格取自官方表 scripts/mobs_real.json（id 11）】：
  //   官方只有两列：hp 与 dmg。HP 是 x3 档（50->150->450->...->328050），
  //   伤害是 x5 档（5->25->125->...->1953125）。hp 与 dmg 必须各归各位。
  //   导弹（尾针）是 Hornet 的延伸，官方没单列第三组数，这里取同档的 hp/dmg
  //   （血量 = 本档 hp，命中伤害 = 本档 dmg），装填时间仍是本地设计（2->10s 递增）。
  11: {  // Hornet 黄蜂
    common:    { hp: 50,     dmg: 5,       armor: 1,   exp: 1,        missileHp: 50,     missileDmg: 5,      missileDur: 2 },
    unusual:   { hp: 150,    dmg: 25,      armor: 2,   exp: 2,        missileHp: 150,    missileDmg: 25,     missileDur: 3 },
    rare:      { hp: 450,    dmg: 125,     armor: 7,   exp: 6,        missileHp: 450,    missileDmg: 125,    missileDur: 4 },
    epic:      { hp: 1350,   dmg: 625,     armor: 22,  exp: 53,       missileHp: 1350,   missileDmg: 625,    missileDur: 5 },
    legendary: { hp: 4050,   dmg: 3125,    armor: 65,  exp: 486,      missileHp: 4050,   missileDmg: 3125,   missileDur: 6 },
    mythic:    { hp: 12150,  dmg: 15625,   armor: 194, exp: 6900,     missileHp: 12150,  missileDmg: 15625,  missileDur: 7 },
    ultra:     { hp: 36450,  dmg: 78125,   armor: 583, exp: 328000,   missileHp: 36450,  missileDmg: 78125,  missileDur: 8 },
    super:     { hp: 109350, dmg: 390625,  armor: 583, exp: 16000000, missileHp: 109350, missileDmg: 390625, missileDur: 9 },
    // 官方表"永恒"档是 0（未收录），按 HP x3 / 伤害 x5 的序列补齐。
    eternal:   { hp: 984150,  dmg: 9765625, armor: 583, exp: 16000000, missileHp: 984150,  missileDmg: 9765625, missileDur: 10 },
  }
};

// ---- 生物行为/体型声明 ----
// 行为代码（Mob 构造、AI、生成器）只读这些字段，不再按 slug 写分支。
//   segmented     一次生成整条（多节生物），由 LocalServer._spawnChain 展开
//   sizeScale     等比体型倍数（绘制与碰撞同一尺寸：diam = 基础直径 × sizeScale，collSize = diam）
//   sPath         走 S 型（持续左右摆头）
//   chaseMult     追击速度 = 该倍率 × 玩家默认最高速度
//   wanderFactor  游荡速度相对同类基准的倍率
const MOB_TRAITS = {
  ladybug: {},
  bee: { sPath: true, sizeScale: 1.395 * 0.9, chaseMult: 1.05, wanderFactor: 1.2 },
  // Bumble Bee：被动（永不记仇恨）、S 形游荡【没有停顿】、游荡速度 = 1.5× 玩家移速，
  // 并且每 0.6s 在尾部生出一颗同等级的 Pollen（数值与卡面召唤的完全一致）。
  bumble_bee: {
    sPath: true, sizeScale: 1.395 * 0.9, wanderSpeedK: 1.5,
    pollenEvery: 0.6
  },
  // Hornet：体型同蜜蜂；血量条正常显示（hideHpBar = false）。
  //   shootCd  = 每次射击后的冷却（秒）：common 3 → super 1（等比例平滑）→ eternal 0.8
  hornet: {
    // 直径 1.4x；尾针挂点与画幅按 drawSize 等比缩放
    sizeScale: 1.395 * 0.9 * 1.4, chaseMult: 0.95,
    shootCd: {
      common: 3.0, unusual: 2.714, rare: 2.429, epic: 2.143, legendary: 1.857,
      mythic: 1.571, ultra: 1.286, super: 1.0, eternal: 0.8
    }
  },
  // Soldier Ant：敌对、直线追击（默认 wander AI 自带 chase/flee + 限速，与瓢虫同一套）。
  // 体型用默认值；speed 必须显式给（registry 没写），否则会被判成障碍物而原地不动。
  // 'player' = 构建类型时解析成"玩家的基础移速"（data.js 执行时常量还没加载，不能直接引用）。
  // 召唤物在此基础上再乘 0.25（见 LocalServer._spawnSummon 的 sizeScale）。
  // follow = 跟随型属性（召唤物）：离领队超过 start 就往回走，走到 stop 之内停下。
  // 两个阈值是【迟滞】，单阈值会在边界上来回抽搐；行为实现在 ai.js 的通用 wander 里，
  // 任何生物都能配，不是召唤物专属代码。
  // 蚂蚁家族【整体小一档】：sizeTier = -1 表示"按稀有度表的下一档"取尺寸
  //（× 1/MOB_DIAM_STEP ≈ 0.708），绘制与碰撞同步，各族之间的相对大小不变。
  soldier_ant: { speed: 'player', follow: { start: 420, stop: 240 }, sizeTier: -1 },
  // 工蚁：与人蚁同一套移速口径（用户要求"速度属性和 Soldier Ant 相同"）；
  // 阵营走 registry（Neutral）= 中立，被打了才反击 —— 不要在这里加仇恨/追击字段。
  worker_ant: { speed: 'player', sizeTier: -1 },
  // 幼蚁：Passive（不会主动生成仇恨），移速走 registry 默认值。
  // 体型校正：主体球（唯一体节）的直径要对齐同级 Worker 的【第一体节（较大的那个球）】。
  // 素材内球径（各自 viewBox 归一化宽度）：Baby 0.8678 / Worker 大球 0.7346，
  // 所以统一缩放取 0.7346 / 0.8678 ≈ 0.8465（绘制与碰撞同一尺寸，见 Mob 构造）。
  baby_ant: { sizeScale: 0.8465, sizeTier: -1 },
  // Ant Egg 蚁卵（生物）：障碍型 —— 速度 0（Mob 构造据此判定 obstacle）、
  // 无穷重量（immovable）：不被推挤、不吃击退，位置固定。
  ant_egg: { speed: 0, chaseMult: 0, immovable: true },
  // Queen Ant 蚁后：移速与兵蚁同一口径；AI 在 ai.js 的 'queen_ant' 里，
  // 产卵参数是【属性】而不是第二套 AI（服务端消费 queenEggReq）。
  queen_ant: {
    speed: 'player',
    sizeTier: -1,
    // 体型对齐：以【头部第一节圆】为标准，和兵蚁同级头一样大。
    // 素材里 蚁后头径 40.83 / viewBox 84.361 = 0.4840，兵蚁头径 29.17 / 44.027 = 0.6626，
    // 所以等比放大 0.6626 / 0.4840 ≈ 1.369（否则整只蚁后看起来比兵蚁还小）。
    sizeScale: 1.369,
    queen: { minRarity: 'rare', max: 7, eggCd: 1.5, hatch: 1.0 }
  },
  // Ant Hole 蚁穴：障碍型（速度 0 + 无穷重量），原地不动。
  // passWith = 蚂蚁家族与它【没有碰撞】：从洞里爬出来的蚂蚁可以直接踩在洞上。
  // hole = 产卵参数（服务端消费）：init 是开局铺的 6 只；之后每掉 step 比例生命补 3 只；
  //   pool 是整局 40 只的构成（5 幼蚁 / 8 工蚁 / 26 兵蚁 / 1 蚁后），抽干即停 ——
  //   总量与占比由池子保证，顺序靠权重随机（前期幼蚁/工蚁更容易先出现）。
  //   蚁后在生命低于 queenAt 时随某一批额外出现。
  ant_hole: {
    speed: 0,
    immovable: true,
    // spawnMin：结构型生成物【整张地图】的保底数量（服务端 _ensureStructureSpawns 消费）。
    // 蚁穴本身按权重参与 garden 组的轮盘（见 MOB_GROUPS），全图期望 7~8 个；
    // 这里只兜住"一整局一个都没随机到"的极小概率，不是"每个生成区保底一只"。
    spawnMin: 1,
    passWith: ['baby_ant', 'worker_ant', 'soldier_ant', 'queen_ant', 'ant_egg'],
    hole: {
      step: 0.07,
      queenAt: 0.4,
      init: [['baby_ant', 3], ['worker_ant', 2], ['soldier_ant', 1]],
      pool: { baby_ant: 5, worker_ant: 8, soldier_ant: 26, queen_ant: 1 }
    }
  },
  // 蜈蚣：节数按稀有度【递减】—— 越高等级个体越短（用户口径）。
  // rare 及以下【不变】（common 11.5 / unusual 11 / rare 9.5 平均）；
  // 高等级整体上浮约 30%（super / eternal 平均 4 -> 5），中间按同一斜率平滑过渡，
  // 仍然保持"越高越短"的单调性（epic 8.5 / legendary 7.5 / mythic 7 / ultra 6）。
  // 理由：巨型体节在狭窄地形里极易卡墙，而且长链的尾巴会被墙反复截断；
  // 高等级本来碰撞箱就大，但 3~5 节又短得不像蜈蚣，所以高段整体加长一档。
  // 自然生成的超长个体（45~60 节）仍然只有 common 才有 0.3% 概率（见 _spawnChain）。
  centipede: {
    segmented: true, sizeScale: 1.4,
    segCount: {
      common: [8, 15], unusual: [8, 14], rare: [7, 12], epic: [7, 10],
      legendary: [6, 9], mythic: [6, 8], ultra: [5, 7], super: [4, 6],
      eternal: [4, 6]
    }
  },
  // 蜘蛛：aggressive 敌对，仇恨半径 500（比通用 1200 小，贴近了才会扑上来）。
  // 追击 1.1× 玩家最高速、游荡 = 追击 × 0.9 —— 这两个由 ai.js 的 spider 定义写死（见 init）。
  //   gait = 有"换帧步态"（八条腿随行进摆动，见 render/spider-gait.js）
  //   碰撞箱【不手写】：默认从【原 SVG 提取】，且只取"去掉腿的身体"
  //     （SpiderGait.bodyUrl() 把 8 条腿的 path 从 SVG 文本里删掉后再提取）。
  //     assets/mobs/21.svg：身体 = 两个同心圆（外圈 r≈10.31 / 内圈 r≈7.37，圆心 55,55），
  //     8 条腿却伸到 ~30 —— 用含腿的轮廓会让碰撞箱大出近 3 倍。
  spider: {
    sightR: 500, gait: true,
    // 蜘蛛免疫自己（和同类）铺的蛛网：网是用来困住猎物的，不该拖慢自己
    immuneStatus: { web: true },
    // 碰撞箱【不手写】：默认从【原 SVG 提取】，且只取"去掉腿的身体"
    // （SpiderGait.bodyUrl() 把 8 条腿的 path 从 SVG 文本里删掉后再提取）。
    // assets/mobs/21.svg：身体 = 两个同心圆（外圈 r≈10.31 / 内圈 r≈7.37 SVG 单位，圆心 55,55），
    // 8 条腿却伸到 ~30 —— 用含腿的轮廓会让碰撞箱大出近 3 倍。
  }
};

// ---- 生物生成播报的专属台词（i18n key，文案在 js/i18n-extra.js）----
// 没登记的生物走默认模板 Chat/Sys/Spawn/Default：A <rarity> <mobname> has been spawned!
// 刻意【不用】官方 Chat/MobSpawned* 模板，也不用 registry 里每只生物的 spawn 文本 ——
// 那套是"某处生成"的官方台本，我们要自己控制默认文案与专属台词。
const MOB_SPAWN_LINES = {
  ladybug: 'Chat/Sys/Spawn/ladybug',
  bee: 'Chat/Sys/Spawn/bee',
  centipede: 'Chat/Sys/Spawn/centipede'
};

// 物种 slug → 官方语言包里的词条键。
// 官方 i18n 用的是【ant_ 前缀】的旧写法（ant_worker / ant_baby / ant_soldier / ant_queen），
// 而 registry 的英文名是 "Worker Ant" → slug = worker_ant。不映射的话
// Mobs/worker_ant/Name 查不到 → 回落英文名，中文环境里整族蚂蚁都是英文且没有简介。
const MOB_I18N_ALIASES = {
  worker_ant: 'ant_worker',
  baby_ant: 'ant_baby',
  soldier_ant: 'ant_soldier',
  queen_ant: 'ant_queen'
};
function mobI18nKey(slug) { return MOB_I18N_ALIASES[slug] || slug; }

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
        if (RARITY_ORDER.indexOf(rk) < 0) continue;
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
    const mt = MOB_TRAITS[slug] || {};
    const t = {
      id, slug,
      // 词条键走别名表（蚂蚁家族的官方键是 ant_*），否则中文名/简介全会缺失
      name: I18N.t('Mobs/' + mobI18nKey(slug) + '/Name', m.name), zh: m.zh || '', svg: id,
      // 速度：优先用 traits 显式声明，否则用 registry。
      // traits 里 speed === 'player' 是【标记】，表示"与玩家基础移速相同"；
      // 在 Mob 构造时才解析成 PLAYER_BASE_SPEED —— data.js 的执行早于 constants.js，
      // 在这里直接引用常量会 ReferenceError（buildMobTypes 是顶层调用）。
      // registry 里没写 speed 的物种（如 Soldier Ant）必须补上，
      // 否则 Mob 的 `!(type.speed > 0)` 会把它判为障碍物，wanderSpeed 恒 0 —— 原地摇晃。
      hp: m.hp, dmg: m.dmg,
      speed: (mt.speed != null) ? mt.speed : m.speed,
      size: m.size, tier: m.tier,
      color: m.color || '#888', boss: !!m.boss,
      type: m.type || '', biome: m.biome || '', desc: m.desc || '',
      // 仇恨类型代码：'passive' 被动（永不反击追击）/ 'neutral' 中立（被打才追击）/
      // 'hostile' 敌对（见人就追）。由注册表的中文类型串映射，未识别的按 neutral 处理。
      hostility: MOB_HOSTILITY[m.type] || 'neutral',
      rarities: m.rarities || null,
      rarityStats,                       // 英文稀有度键 -> { hp, dmg, exp, armor }
      ai: m.ai || null,                  // 官方 AI 开关（aggro/chase/flee/retaliate…）
      // ---- 行为/体型字段：全部来自 MOB_TRAITS，行为层只读字段、不判断 slug ----
      segmented: !!mt.segmented,          // 多节生物：一次生成整条
      segCount: mt.segCount || null,      // 多节生物：稀有度 -> [最少节, 最多节]（越高越短）
      sizeScale: mt.sizeScale || 1,       // 等比体型倍数（绘制与碰撞同尺寸）
      sizeTier: mt.sizeTier || 0,         // 体型档位偏移（±1 档 = 稀有度表整档，见 Mob 构造）
      sPath: !!mt.sPath,                  // S 型游荡
      sightR: mt.sightR || null,          // 视野/仇恨半径（null = 通用 MOB_SIGHT_R）
      immovable: !!mt.immovable,          // 无穷重量：不被推挤/击退（障碍型）
      queen: mt.queen || null,            // 产卵参数（蚁后）：{ minRarity, max, eggCd, hatch }
      passWith: mt.passWith || null,      // 可穿透的物种 slug（蚁穴：蚂蚁家族可在其上行走）
      hole: mt.hole || null,              // 蚁穴产卵参数：{ step, queenAt, init, pool }
      spawnMin: mt.spawnMin || 0,         // 结构型生成物：生成区里列出它时至少保底几只
      follow: mt.follow || null,          // 跟随型（召唤物）：{ start, stop } 两个迟滞阀值
      gait: !!mt.gait,                    // 有换帧步态（蜘蛛：八条腿摆动）
      immuneStatus: mt.immuneStatus || null,   // 状态免疫（{ web: true } = 不受蛛网减速）
      chaseMult: (mt.chaseMult != null) ? mt.chaseMult : null,   // null = 通用追击倍率
      wanderFactor: (mt.wanderFactor != null) ? mt.wanderFactor : 1,
      hideHpBar: !!mt.hideHpBar,
      // 弹幕型（Hornet）：每次射击后的冷却秒数，按稀有度给（common 3 → eternal 0.8）
      shootCd: mt.shootCd || null,
      // 产卵型（Bumble Bee）：每 pollenEvery 秒在尾部生一颗同等级 Pollen（0 = 不产）
      pollenEvery: mt.pollenEvery || 0,
      missileHp: 0, missileDmg: 0, missileDur: 0
    };
    for (const rk in t.rarityStats || {}) {
      const rs = t.rarityStats[rk];
      rs.missileHp = rs.missileHp || 0;
      rs.missileDmg = rs.missileDmg || 0;
      rs.missileDur = rs.missileDur || 0;
    }
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

// Bumble Bee 尾部产出的 Pollen：它是【静止的敌对实体】，走生物实体链路。
// 客户端 _applySnap 用 MOB_BY_ID[typeId] 建视图，所以必须在这里正式登记一个类型，
// 否则服务端生成了、快照也发了，客户端却因为找不到 typeId 直接 continue -> 永远看不见。
const POLLEN_SHOT_ID = 9901;
const POLLEN_SHOT_TYPE = {
  id: POLLEN_SHOT_ID, slug: 'pollen_shot',
  // 名字同样走 i18n（Mobs/pollen_shot/*，见 js/i18n-extra.js）：
  // 它是「生物实体」而不是花瓣，不能借 Petals/pollen 的词条。
  name: I18N.t('Mobs/pollen_shot/Name', 'Pollen'),
  svg: 'pollen', artSvg: 'pollen', type: 'Hostile',
  tier: 1, hp: 1, dmg: 0, armor: 0, exp: 0, speed: 0,
  sizeScale: 0.5, hideHpBar: true,
  rarityStats: {}
};
MOB_BY_ID[POLLEN_SHOT_ID] = POLLEN_SHOT_TYPE;

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
};

// 每种生物掉哪些花瓣（顺序 = 悬浮框里的展示顺序）。
// Mana Orb 是日后魔法变种的专属掉落：**只登记在数据表里**，
// 既不出现在悬浮框、也不参与实际掷骰掉落（见 DROP_HIDDEN_SLUGS）。
// 键用 slug（稳定英文名），不用 registry 的数字 id：
// 数字 id 一旦随 registry 重排就会静默错位到别的生物身上，且没有任何报错。
const MOB_DROP_ITEMS = {
  ladybug: ['light', 'rose', 'mana_orb'],      // Ladybug / 瓢虫
  bee: ['stinger', 'pollen', 'honey'],         // Bee / 蜜蜂（按此顺序展示与掷骰）
  // Soldier Ant / 兵蚁：Clover + Glass（两张【各自独立】的掉率表，见 MOB_DROP_TABLE_ITEM）
  soldier_ant: ['clover', 'glass'],
  // Worker Ant / 工蚁：Leaf + Magic Leaf（隐藏魔法变种）+ Corn；三张表都在 MOB_DROP_TABLE_MOB
  worker_ant: ['leaf', 'magic_leaf', 'corn'],
  // Baby Ant / 幼蚁：Light（走官方通用表）+ Leaf + Magic Leaf + Rice
  baby_ant: ['light', 'leaf', 'magic_leaf', 'rice'],
  // Ant Egg 蚁卵（生物）：掉花瓣 Ant Egg（官方通用分布表）
  ant_egg: ['ant_egg'],
  // Queen Ant 蚁后：Basil + Ant Egg（两张专属表见 MOB_DROP_TABLE_MOB）
  queen_ant: ['basil', 'ant_egg'],
  // Ant Hole 蚁穴：Soil + Shovel（两张专属表见 MOB_DROP_TABLE_MOB.ant_hole；
  // 顺序 = 悬浮框展示顺序 = 掷骰顺序）
  ant_hole: ['soil', 'shovel'],
  centipede: ['leaf', 'peas'],                 // Centipede / 蜈蚣（正常掉落 Leaf + Peas）
  // Spider / 蜘蛛：Faster + Web + Third Eye（Magic Eye 是 Third Eye 的魔法变种，仅登记不显示）
  spider: ['faster', 'web', 'third_eye', 'magic_eye'],
  bumble_bee: ['honey', 'pollen', 'wax'],
  // Hornet / 黄蜂：Missile + Orange + Antennae（Magic Missile 是魔法变种，仅登记不显示）
  hornet: ['missile', 'orange', 'antennae', 'magic_missile']
};

// 个别生物的每种掉落物有【各自】的稀有度分布。蜜蜂的 Stinger / Pollen / Honey 是三张不同的表：
//   · stinger 没有专属表 -> 沿用 MOB_DROP_TABLE（正好就是官方 Stinger 表）
//   · pollen / honey 用下面这两张；某档稀有度没写 = 这只生物在这一档不掉这件
const MOB_DROP_TABLE_ITEM = {
  // Clover / Glass：兵蚁（Soldier Ant）专属两张表（官方 Wiki 的 Clover / Glass 两个页签）。
  // 行 = 生物稀有度，列 = 掉落花瓣的稀有度；表格里空着的格子 = 这一档不掉。
  clover: {
    common:    [['common', 0.598], ['unusual', 0.164]],
    unusual:   [['common', 0.485], ['unusual', 0.512]],
    rare:      [['common', 0.001], ['unusual', 0.834], ['rare', 0.165]],
    epic:      [['unusual', 0.067], ['rare', 0.810], ['epic', 0.123]],
    legendary: [['rare', 0.072], ['epic', 0.877], ['legendary', 0.050]],
    mythic:    [['epic', 0.075], ['legendary', 0.917], ['mythic', 0.008]],
    ultra:     [['legendary', 0.312], ['mythic', 0.684], ['ultra', 0.004]],
    super:     [['mythic', 0.357], ['ultra', 0.643]],
    eternal:   [['mythic', 0.357], ['ultra', 0.643]],
  },
  glass: {
    common:    [['common', 0.638], ['unusual', 0.194]],
    unusual:   [['common', 0.420], ['unusual', 0.579]],
    rare:      [['common', 0.0002], ['unusual', 0.805], ['rare', 0.195]],
    epic:      [['unusual', 0.039], ['rare', 0.815], ['epic', 0.146]],
    legendary: [['rare', 0.043], ['epic', 0.897], ['legendary', 0.060]],
    mythic:    [['epic', 0.045], ['legendary', 0.946], ['mythic', 0.009]],
    ultra:     [['legendary', 0.248], ['mythic', 0.748], ['ultra', 0.005]],
    super:     [['mythic', 0.290], ['ultra', 0.710]],
    eternal:   [['mythic', 0.290], ['ultra', 0.710]],
  },
  // Missile / Magic Missile / Orange：三张相同的 Hornet 专属表，最低档为 Unusual，无 Common 档。
  missile: {
    common:    [['unusual', 0.164]],
    unusual:   [['unusual', 0.512]],
    rare:      [['unusual', 0.834], ['rare', 0.165]],
    epic:      [['unusual', 0.067], ['rare', 0.810], ['epic', 0.123]],
    legendary: [['rare', 0.072], ['epic', 0.877], ['legendary', 0.050]],
    mythic:    [['epic', 0.075], ['legendary', 0.917], ['mythic', 0.008]],
    ultra:     [['legendary', 0.312], ['mythic', 0.684], ['ultra', 0.004]],
    super:     [['mythic', 0.357], ['ultra', 0.643]],
    eternal:   [['mythic', 0.357], ['ultra', 0.643]],
  },
  orange: {
    common:    [['unusual', 0.164]],
    unusual:   [['unusual', 0.512]],
    rare:      [['unusual', 0.834], ['rare', 0.165]],
    epic:      [['unusual', 0.067], ['rare', 0.810], ['epic', 0.123]],
    legendary: [['rare', 0.072], ['epic', 0.877], ['legendary', 0.050]],
    mythic:    [['epic', 0.075], ['legendary', 0.917], ['mythic', 0.008]],
    ultra:     [['legendary', 0.312], ['mythic', 0.684], ['ultra', 0.004]],
    super:     [['mythic', 0.357], ['ultra', 0.643]],
    eternal:   [['mythic', 0.357], ['ultra', 0.643]],
  },
  magic_missile: {
    common:    [['unusual', 0.164]],
    unusual:   [['unusual', 0.512]],
    rare:      [['unusual', 0.834], ['rare', 0.165]],
    epic:      [['unusual', 0.067], ['rare', 0.810], ['epic', 0.123]],
    legendary: [['rare', 0.072], ['epic', 0.877], ['legendary', 0.050]],
    mythic:    [['epic', 0.075], ['legendary', 0.917], ['mythic', 0.008]],
    ultra:     [['legendary', 0.312], ['mythic', 0.684], ['ultra', 0.004]],
    super:     [['mythic', 0.357], ['ultra', 0.643]],
    eternal:   [['mythic', 0.357], ['ultra', 0.643]],
  },
  // Antennae：从 Rare 档起才有（common/unusual 档不掉），分布与 Missile 不同
  antennae: {
    rare:      [['rare', 0.070]],
    epic:      [['rare', 0.610], ['epic', 0.051]],
    legendary: [['rare', 0.349], ['epic', 0.630], ['legendary', 0.020]],
    mythic:    [['epic', 0.356], ['legendary', 0.641], ['mythic', 0.003]],
    ultra:     [['legendary', 0.628], ['mythic', 0.371], ['ultra', 0.002]],
    super:     [['mythic', 0.662], ['ultra', 0.338]],
    eternal:   [['mythic', 0.662], ['ultra', 0.338]],
  },
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
  },
  honey: {
    rare:      [['rare', 0.070]],
    epic:      [['rare', 0.610], ['epic', 0.051]],
    legendary: [['rare', 0.349], ['epic', 0.630], ['legendary', 0.020]],
    mythic:    [['epic', 0.356], ['legendary', 0.641], ['mythic', 0.003]],
    ultra:     [['legendary', 0.628], ['mythic', 0.371], ['ultra', 0.002]],
    super:     [['mythic', 0.662], ['ultra', 0.338]],
    eternal:   [['mythic', 0.662], ['ultra', 0.338]],
  },
  // Peas / Blueberries：掉落稀有度分布（Peas 掉落用；Blueberries 是 Peas 的魔法变种隐藏版，分布同 Peas）。
  // 注意：每档各列【声明宽度之和 < 1】，意味着有一定概率"这一档不掉 Peas"。
  peas: {
    common:    [['common', 0.191], ['unusual', 0.035]],
    unusual:   [['common', 0.510], ['unusual', 0.132]],
    rare:      [['common', 0.243], ['unusual', 0.722], ['rare', 0.035]],
    epic:      [['unusual', 0.582], ['rare', 0.392], ['epic', 0.026]],
    legendary: [['unusual', 0.002], ['rare', 0.591], ['epic', 0.399], ['legendary', 0.010]],
    mythic:    [['epic', 0.596], ['legendary', 0.402], ['mythic', 0.002]],
    ultra:     [['legendary', 0.792], ['mythic', 0.207], ['ultra', 0.001]],
    super:     [['mythic', 0.814], ['ultra', 0.186]],
    eternal:   [['mythic', 0.814], ['ultra', 0.186]],
  },
  // Blueberries：Peas 的魔法变种（隐藏），分布与 Peas 完全一致（见下方 DROP_HIDDEN_SLUGS）
  blueberries: {
    common:    [['common', 0.191], ['unusual', 0.035]],
    unusual:   [['common', 0.510], ['unusual', 0.132]],
    rare:      [['common', 0.243], ['unusual', 0.722], ['rare', 0.035]],
    epic:      [['unusual', 0.582], ['rare', 0.392], ['epic', 0.026]],
    legendary: [['unusual', 0.002], ['rare', 0.591], ['epic', 0.399], ['legendary', 0.010]],
    mythic:    [['epic', 0.596], ['legendary', 0.402], ['mythic', 0.002]],
    ultra:     [['legendary', 0.792], ['mythic', 0.207], ['ultra', 0.001]],
    super:     [['mythic', 0.814], ['ultra', 0.186]],
    eternal:   [['mythic', 0.814], ['ultra', 0.186]],
  },
  // Leaf / Magic Leaf：掉落分布（列从 Unusual 起，无 Common）。Magic Leaf 是 Leaf 的魔法变种隐藏版。
  leaf: {
    common:    [['unusual', 0.035]],
    unusual:   [['unusual', 0.132]],
    rare:      [['unusual', 0.722], ['rare', 0.035]],
    epic:      [['unusual', 0.582], ['rare', 0.392], ['epic', 0.026]],
    legendary: [['unusual', 0.002], ['rare', 0.591], ['epic', 0.399], ['legendary', 0.010]],
    mythic:    [['epic', 0.596], ['legendary', 0.402], ['mythic', 0.002]],
    ultra:     [['legendary', 0.792], ['mythic', 0.207], ['ultra', 0.001]],
    super:     [['mythic', 0.814], ['ultra', 0.186]],
    eternal:   [['mythic', 0.814], ['ultra', 0.186]],
  },
  // Magic Leaf：Leaf 的魔法变种（隐藏），分布与 Leaf 完全一致
  magic_leaf: {
    common:    [['unusual', 0.035]],
    unusual:   [['unusual', 0.132]],
    rare:      [['unusual', 0.722], ['rare', 0.035]],
    epic:      [['unusual', 0.582], ['rare', 0.392], ['epic', 0.026]],
    legendary: [['unusual', 0.002], ['rare', 0.591], ['epic', 0.399], ['legendary', 0.010]],
    mythic:    [['epic', 0.596], ['legendary', 0.402], ['mythic', 0.002]],
    ultra:     [['legendary', 0.792], ['mythic', 0.207], ['ultra', 0.001]],
    super:     [['mythic', 0.814], ['ultra', 0.186]],
    eternal:   [['mythic', 0.814], ['ultra', 0.186]],
  },
  // Web：蜘蛛掉落，比 Faster【低一档】—— 没有 Common 档（Wiki 表的 Common 行只有 16.4% Unusual），
  // 其余各档与 Faster 相同。之前误用通用表（带 Common 档）→ 会出现"Common Web"，与表矛盾。
  web: {
    common:    [['unusual', 0.164]],
    unusual:   [['unusual', 0.512]],
    rare:      [['unusual', 0.834], ['rare', 0.165]],
    epic:      [['unusual', 0.067], ['rare', 0.810], ['epic', 0.123]],
    legendary: [['rare', 0.072], ['epic', 0.877], ['legendary', 0.050]],
    mythic:    [['epic', 0.075], ['legendary', 0.917], ['mythic', 0.008]],
    ultra:     [['legendary', 0.312], ['mythic', 0.684], ['ultra', 0.004]],
    super:     [['mythic', 0.357], ['ultra', 0.643]],
    eternal:   [['mythic', 0.357], ['ultra', 0.643]],
  },
  // Honey / Pollen / Wax：Bumble Bee 的三张专属表（与通用表不同，逐格录入官方表）。
  honey: {
    rare:      [['rare', 0.135]],
    epic:      [['rare', 0.786], ['epic', 0.100]],
    legendary: [['rare', 0.122], ['epic', 0.837], ['legendary', 0.041]],
    mythic:    [['epic', 0.126], ['legendary', 0.867], ['mythic', 0.006]],
    ultra:     [['legendary', 0.394], ['mythic', 0.603], ['ultra', 0.003]],
    super:     [['mythic', 0.438], ['ultra', 0.562]],
    eternal:   [['mythic', 0.438], ['ultra', 0.562]],
  },
  pollen: {
    common:    [['unusual', 0.472]],
    unusual:   [['unusual', 0.922]],
    rare:      [['unusual', 0.541], ['rare', 0.459]],
    epic:      [['unusual', 0.0001], ['rare', 0.640], ['epic', 0.360]],
    legendary: [['rare', 0.0001], ['epic', 0.839], ['legendary', 0.161]],
    mythic:    [['epic', 0.0002], ['legendary', 0.974], ['mythic', 0.026]],
    ultra:     [['legendary', 0.019], ['mythic', 0.968], ['ultra', 0.013]],
    super:     [['mythic', 0.030], ['ultra', 0.970]],
    eternal:   [['mythic', 0.030], ['ultra', 0.970]],
  },
  wax: {
    rare:      [['rare', 0.328]],
    epic:      [['rare', 0.746], ['epic', 0.251]],
    legendary: [['rare', 0.003], ['epic', 0.889], ['legendary', 0.107]],
    mythic:    [['epic', 0.003], ['legendary', 0.980], ['mythic', 0.017]],
    ultra:     [['legendary', 0.077], ['mythic', 0.914], ['ultra', 0.008]],
    super:     [['mythic', 0.104], ['ultra', 0.896]],
    eternal:   [['mythic', 0.104], ['ultra', 0.896]],
  },
  // Third Eye / Magic Eye：蜘蛛专属，Legendary 及以下一档都不掉（Wiki 表只有 Mythic 起）。
  //   Mythic 0.03% / Ultra 4.5% Mythic + 0.02% Ultra / Super+ 96% Mythic + 4% Ultra
  third_eye: {
    mythic:  [['mythic', 0.0003]],
    ultra:   [['mythic', 0.045], ['ultra', 0.0002]],
    super:   [['mythic', 0.96], ['ultra', 0.04]],
    eternal: [['mythic', 0.96], ['ultra', 0.04]],
  },
  // Magic Eye：Third Eye 的魔法变种（隐藏），分布与 Third Eye 完全一致
  magic_eye: {
    mythic:  [['mythic', 0.0003]],
    ultra:   [['mythic', 0.045], ['ultra', 0.0002]],
    super:   [['mythic', 0.96], ['ultra', 0.04]],
    eternal: [['mythic', 0.96], ['ultra', 0.04]],
  },
  // Magic Missile：Missile 的魔法变种隐藏版，掉率完全相同。
  magic_missile: {
    common:    [['unusual', 0.164]],
    unusual:   [['unusual', 0.512]],
    rare:      [['unusual', 0.834], ['rare', 0.165]],
    epic:      [['unusual', 0.067], ['rare', 0.810], ['epic', 0.123]],
    legendary: [['rare', 0.072], ['epic', 0.877], ['legendary', 0.050]],
    mythic:    [['epic', 0.075], ['legendary', 0.917], ['mythic', 0.008]],
    ultra:     [['legendary', 0.312], ['mythic', 0.684], ['ultra', 0.004]],
    super:     [['mythic', 0.357], ['ultra', 0.643]],
    eternal:   [['mythic', 0.357], ['ultra', 0.643]],
  }
};

// 【按生物】的掉落分布：同一件花瓣在不同生物身上可以完全不同表。
//   · 工蚁/幼蚁的 Leaf 表与通用表不同（最低档是 Unusual，且不是通用分布）；
//     Leaf 同时是蜈蚣的掉落，所以【不能】把 Leaf 写成全局专属表 —— 那会把蜈蚣一起改掉；
//   · Magic Leaf（隐藏魔法变种）与 Leaf 同表，工蚁/幼蚁各一份。
// 键：mob slug -> item slug -> 分布（结构与 MOB_DROP_TABLE_ITEM 完全一致）
const MOB_DROP_TABLE_MOB = {
  // 工蚁 / 幼蚁共用的 Leaf 表（官方 Wiki 两页数据完全一致）
  ...(() => {
    const leaf = {
      common:    [['unusual', 0.101]],
      unusual:   [['unusual', 0.348]],
      rare:      [['unusual', 0.883], ['rare', 0.103]],
      epic:      [['unusual', 0.197], ['rare', 0.727], ['epic', 0.076]],
      legendary: [['rare', 0.207], ['epic', 0.763], ['legendary', 0.031]],
      mythic:    [['epic', 0.212], ['legendary', 0.783], ['mythic', 0.005]],
      ultra:     [['legendary', 0.498], ['mythic', 0.500], ['ultra', 0.002]],
      super:     [['mythic', 0.539], ['ultra', 0.461]],
      eternal:   [['mythic', 0.539], ['ultra', 0.461]],
    };
    return {
      worker_ant: {
        leaf,
        magic_leaf: leaf,                    // 魔法变种与本体同表（只入库、不掉落）
        // Corn：Common 档掉 Common+Unusual（Leaf 表里没有 Common 档）
        corn: {
          common:    [['common', 0.455], ['unusual', 0.101]],
          unusual:   [['common', 0.613], ['unusual', 0.348]],
          rare:      [['common', 0.014], ['unusual', 0.883], ['rare', 0.103]],
          epic:      [['unusual', 0.197], ['rare', 0.727], ['epic', 0.076]],
          legendary: [['rare', 0.207], ['epic', 0.763], ['legendary', 0.031]],
          mythic:    [['epic', 0.212], ['legendary', 0.783], ['mythic', 0.005]],
          ultra:     [['legendary', 0.498], ['mythic', 0.500], ['ultra', 0.002]],
          super:     [['mythic', 0.539], ['ultra', 0.461]],
          eternal:   [['mythic', 0.539], ['ultra', 0.461]],
        }
      },
      queen_ant: {
        // Basil：官方 Wiki 的 Basil 页签（只有 Mythic / Ultra 两列）
        basil: {
          mythic:  [['mythic', 0.009]],
          ultra:   [['mythic', 0.748], ['ultra', 0.005]],
          super:   [['mythic', 0.29], ['ultra', 0.71]],
          eternal: [['mythic', 0.29], ['ultra', 0.71]],
        },
        // Ant Egg：官方 Wiki 的 Ant Egg 页签
        ant_egg: {
          common:    [['common', 0.662], ['unusual', 0.306]],
          unusual:   [['common', 0.232], ['unusual', 0.768]],
          rare:      [['common', 0.0000004], ['unusual', 0.697], ['rare', 0.303]],
          epic:      [['unusual', 0.004], ['rare', 0.764], ['epic', 0.231]],
          legendary: [['rare', 0.005], ['epic', 0.897], ['legendary', 0.098]],
          mythic:    [['epic', 0.006], ['legendary', 0.979], ['mythic', 0.015]],
          ultra:     [['legendary', 0.098], ['mythic', 0.895], ['ultra', 0.008]],
          super:     [['mythic', 0.127], ['ultra', 0.873]],
          eternal:   [['mythic', 0.127], ['ultra', 0.873]],
        }
      },
      // 蚁穴（Ant Hole）：Soil / Shovel 两张专属表（官方 Wiki 的两个页签）。
      // 空着的格子 = 该档不掉（与其它专属表同口径：有专属表就不再回落通用表）。
      ant_hole: {
        soil: {
          common:    [['common', 0.598], ['unusual', 0.164]],
          unusual:   [['common', 0.485], ['unusual', 0.512]],
          rare:      [['common', 0.001], ['unusual', 0.834], ['rare', 0.165]],
          epic:      [['unusual', 0.067], ['rare', 0.810], ['epic', 0.123]],
          legendary: [['rare', 0.072], ['epic', 0.877], ['legendary', 0.050]],
          mythic:    [['epic', 0.075], ['legendary', 0.917], ['mythic', 0.008]],
          ultra:     [['legendary', 0.312], ['mythic', 0.684], ['ultra', 0.004]],
          super:     [['mythic', 0.357], ['ultra', 0.643]],
          eternal:   [['mythic', 0.357], ['ultra', 0.643]],
        },
        shovel: {
          common:    [['common', 0.539], ['unusual', 0.133]],
          unusual:   [['common', 0.553], ['unusual', 0.436]],
          rare:      [['common', 0.003], ['unusual', 0.862], ['rare', 0.135]],
          epic:      [['unusual', 0.114], ['rare', 0.786], ['epic', 0.100]],
          legendary: [['rare', 0.122], ['epic', 0.837], ['legendary', 0.041]],
          mythic:    [['epic', 0.126], ['legendary', 0.867], ['mythic', 0.006]],
          ultra:     [['legendary', 0.394], ['mythic', 0.603], ['ultra', 0.003]],
          super:     [['mythic', 0.438], ['ultra', 0.562]],
          eternal:   [['mythic', 0.438], ['ultra', 0.562]],
        }
      },
      baby_ant: {
        leaf,
        magic_leaf: leaf,
        // Rice：与 Leaf 形状相似但数值不同（含 0.00004% 那档）
        rice: {
          common:    [['common', 0.662], ['unusual', 0.306]],
          unusual:   [['common', 0.232], ['unusual', 0.768]],
          rare:      [['common', 0.0000004], ['unusual', 0.697], ['rare', 0.303]],
          epic:      [['unusual', 0.004], ['rare', 0.764], ['epic', 0.231]],
          legendary: [['rare', 0.005], ['epic', 0.897], ['legendary', 0.098]],
          mythic:    [['epic', 0.006], ['legendary', 0.979], ['mythic', 0.015]],
          ultra:     [['legendary', 0.098], ['mythic', 0.895], ['ultra', 0.008]],
          super:     [['mythic', 0.127], ['ultra', 0.873]],
          eternal:   [['mythic', 0.127], ['ultra', 0.873]],
        }
      }
    };
  })()
};

// 某件掉落物在某生物稀有度下的稀有度分布；null = 这件不掉。
// 优先级：【该生物对该件花的专属表】 > 【该件花的全局专属表】 > 官方通用表。
function dropDistFor(slug, rarity, mobSlug) {
  const perMob = mobSlug ? MOB_DROP_TABLE_MOB[mobSlug] : null;
  if (perMob && perMob[slug]) return perMob[slug][rarity] || null;
  const own = MOB_DROP_TABLE_ITEM[slug];
  if (own) return own[rarity] || null;      // 有专属表：没写这一档就是不掉
  return MOB_DROP_TABLE[rarity] || null;    // 没有专属表：走官方通用表
}
// 仅入库、不展示/不掉落的花瓣 slug。
//  · mana_orb      : 瓢虫魔法变种的隐藏掉落（Rose -> Mana Orb）
//  · blueberries   : 蜈蚣魔法变种隐藏掉落（Peas -> Blueberries）
//  · magic_leaf    : 蜈蚣魔法变种隐藏掉落（Leaf -> Magic Leaf）
// 三者与 Mana Orb 同款：仅登记进掉落表"不实装"，被替换后不显示、不参与实际掷骰掉落。
const DROP_HIDDEN_SLUGS = new Set(['mana_orb', 'blueberries', 'magic_leaf', 'magic_eye', 'magic_missile']);

// 魔法变种替换：仅对【特定生物】生效（其他生物掉落照旧，未来由你口述扩展）。
// 当击杀者拥有 magician 战斗属性时，把原始掉落物替换为未实装变种（见 DROP_HIDDEN_SLUGS）。
//   · 瓢虫(3)         : Rose -> Mana Orb
//   · 蜈蚣(14)        : Leaf -> Magic Leaf，Peas -> Blueberries
const MOB_DROP_MAGICIAN = {
  ladybug:   { rose: 'mana_orb' },
  centipede: { leaf: 'magic_leaf', peas: 'blueberries' },
  spider:    { third_eye: 'magic_eye' },     // 蜘蛛：Third Eye -> Magic Eye（未实装变种）
  hornet:    { missile: 'magic_missile' },
  // 工蚁 / 幼蚁：Leaf -> Magic Leaf（两张表完全相同，与官方 Wiki 的 Magic Leaf 页签一致）
  worker_ant: { leaf: 'magic_leaf' },
  baby_ant:   { leaf: 'magic_leaf' }
};

// 掉落表查询入口：对外仍接受「数字 id / slug / type 对象」，内部统一转 slug。
// 这样调用方（服务端事件、图鉴、悬浮框）不必关心 id 与 slug 的区别。
function mobSlugOf(mobKey) {
  if (mobKey && typeof mobKey === 'object') return mobKey.slug || null;
  if (typeof mobKey === 'string' && !/^\d+$/.test(mobKey)) return mobKey;
  const t = (typeof MOB_BY_ID !== 'undefined' && MOB_BY_ID) ? MOB_BY_ID[mobKey] : null;
  return t ? t.slug : null;
}
function mobDropList(mobKey) {
  const slug = mobSlugOf(mobKey);
  return (slug && MOB_DROP_ITEMS[slug]) ? MOB_DROP_ITEMS[slug] : null;
}
function mobMagicianMap(mobKey, magician) {
  if (!magician) return null;
  const slug = mobSlugOf(mobKey);
  return (slug && MOB_DROP_MAGICIAN[slug]) ? MOB_DROP_MAGICIAN[slug] : null;
}

// 展示用花瓣素材索引：即使花瓣未实装（如 Mana Orb），悬浮框也要能画出它的卡面。
// 直接扫 registry 建立 slug -> { svg, name }，与 ENABLED_PETAL_SLUGS 无关。
const PETAL_ART_BY_SLUG = {};
(function buildPetalArtIndex() {
  const reg = (window.REGISTRY && window.REGISTRY.petals) ? window.REGISTRY.petals : [];
  for (const p of reg) {
    // 同上：白名单里的花瓣（Wax）不受 id 区间限制，否则它的掉落物找不到素材
    {
      const sl = (p.name ? String(p.name).trim() : '').toLowerCase().replace(/ /g, '_');
      if (p.fanmade || (p.id >= FANMADE_PETAL_FROM && !ENABLED_PETAL_SLUGS.has(sl))) continue;
    }
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

// 把掉落【宽度表】换算成各档的【有效概率】。
// dist = [[rarity, width], ...]（width 是概率宽度，不是累积阈值！）。
// 掷骰（rollMobDrops）是这样走的：r = 随机数，逐档 `if (r < ch) 命中; r -= ch`。
// 于是第 i 档的真实命中区间 = 该档宽度 与 "前面扣完之后还剩的空间" 取较小者：
//   effective_i = max(0, min(width_i, 1 - Σ(前面各档声明宽度)))
// 这样显示值与实际抽取严格一致，且永远不会为负。
function dropChances(dist) {
  const out = [];
  let used = 0;                                    // 前面各档【声明】宽度之和（与掷骰的 r -= ch 同构）
  for (const [r, c] of dist) {
    const room = Math.max(0, 1 - used);            // 还剩多少概率空间
    out.push({ rarity: r, chance: Math.max(0, Math.min(c, room)) });
    used += c;
  }
  return out;
}

// 某生物在某稀有度下的掉落物，按【花瓣种类】分组（悬浮框里一种一行）：
//   [{ slug, name, svg, items: [{ rarity, chance }] }]
function mobDropRows(mobId, rarity, magician) {
  const list = mobDropList(mobId);
  if (!list || !list.length) return [];
  const magicMap = mobMagicianMap(mobId, magician);
  const mobSlug = mobSlugOf(mobId);              // 按生物区分的掉落表要用它
  const out = [];
  for (const slugRaw of list) {
    const slug = (magicMap && magicMap[slugRaw]) ? magicMap[slugRaw] : slugRaw;  // 魔法变种替换
    if (DROP_HIDDEN_SLUGS.has(slug)) continue;   // Mana Orb 等：只入库，不在悬浮框显示
    const dist = dropDistFor(slug, rarity, mobSlug);   // 每件掉落物各自的稀有度分布
    if (!dist || !dist.length) continue;         // 这一档不掉这件：整行不显示
    // 素材取不到也要出行（卡面缺失时只是没有贴图，概率照常显示）
    const art = petalArtOf(slug) || { slug, svg: null, name: slug };
    out.push({
      slug, name: art.name, svg: art.svg,
      // chance = 该稀有度的【真实】概率宽度，见 dropChances()：
      // 不能直接显示源表里的宽度 —— 掷骰是按顺序 "r -= ch" 逐档扣减的，
      // 源表各档之和略大于 1（如 pollen.ultra = 0.628+0.371+0.002 = 1.001），
      // 末档实际只剩被前面挤剩下的空间（Ultra 显示 0.2% 但实际只有 0.1%）。
      items: dropChances(dist)
    });
  }
  return out;
}

// 超长蜈蚣（chainLong）每一节的【隐藏掉落】：
//   · 不进入 MOB_DROP_TABLE / MOB_DROP_ITEMS，所以【不会显示在生物信息栏】；
//   · 每节死亡独立掷骰一次，且与普通掉落【并存】（不是替换）；
//   · 全部是 Basic 花瓣，靠稀有度体现价值。
const CHAIN_LONG_DROPS = [
  { rarity: 'common',    chance: 0.04 },        // 4%
  { rarity: 'unusual',   chance: 0.02 },        // 2%
  { rarity: 'rare',      chance: 0.008 },       // 0.8%
  { rarity: 'epic',      chance: 0.0035 },      // 0.35%
  { rarity: 'legendary', chance: 0.0012 },      // 0.12%
  { rarity: 'mythic',    chance: 0.0005 },      // 0.05%
  { rarity: 'ultra',     chance: 0.0002 },      // 0.02%
  { rarity: 'super',     chance: 0.000003 },    // 0.0003%
  { rarity: 'eternal',   chance: 0.000000001 }, // 0.0000001%
];

// 掷骰掉落（生物死亡时调用）：**每种掉落物各自掷一次**——
// 按该生物【当前稀有度】那一行的分布决定这一件掉落的稀有度，落在"不掉落"区间就没有这一件。
// 返回 [{ slug, svg, name, rarity, chance }, ...]（可能为空 = 这次什么都不掉）。
//   chance = 命中那一档的【有效概率】（0~1，口径与 dropChances 完全一致）：
//            地面卡片的粒子特效时长按它分级（越稀有喷得越久，见 sim/drops.js）。
function rollMobDrops(mobId, rarity, magician) {
  const list = mobDropList(mobId);
  if (!list || !list.length) return [];
  // 魔法变种替换表（仅特定生物）：击杀者带 magician 属性时启用第二套掉落物表
  const magicMap = mobMagicianMap(mobId, magician);
  const mobSlug = mobSlugOf(mobId);              // 按生物区分的掉落表要用它
  const out = [];
  for (const slugRaw of list) {
    const slug = (magicMap && magicMap[slugRaw]) ? magicMap[slugRaw] : slugRaw;  // 先替换，再判断是否隐藏
    if (DROP_HIDDEN_SLUGS.has(slug)) continue;     // 只入库、不实际掉落
    const dist = dropDistFor(slug, rarity, mobSlug);    // 每件掉落物各自的稀有度分布
    if (!dist || !dist.length) continue;           // 这一档不掉这件
    const chances = dropChances(dist);             // 与掷骰同口径的有效概率
    let r = Math.random();
    let hit = null, hitChance = 0;
    for (let i = 0; i < dist.length; i++) {
      const ch = dist[i][1];
      if (r < ch) { hit = dist[i][0]; hitChance = chances[i] ? chances[i].chance : ch; break; }
      r -= ch;
    }
    if (!hit) continue;                            // 落在剩余区间：本次这件不掉
    const art = petalArtOf(slug);
    out.push({
      slug, svg: art ? art.svg : null, name: art ? art.name : slug,
      rarity: hit, chance: hitChance
    });
  }
  return out;
}

function getPetal(id) { return PETAL_BY_ID[id] || null; }

// 调试/手填提示
if (NEEDS_MANUAL.length) {
  console.warn('[数据] 以下项被忽略或需手填（二创/缺失名称，不臆造）：');
  for (const n of NEEDS_MANUAL) console.warn('  -', n.kind, 'id=' + n.id, n.name, '->', n.reason);
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
// 用户口径：Ant Hole 是【全图物种】—— 它和瓢虫/蜜蜂一样参与 garden 组的轮盘，
// 不是蚂蚁区专属。所以它必须在组表里，而不是只靠某一个生成区里那一条 ant_hole:0.05。
// 权重 0.05 = 与地图里那条专属权重同口径：全图 garden 区合计约 1500 只时，
// 期望 7~8 个蚁穴（各区 0.5% 概率），分散而不是扎堆。
const MOB_GROUPS = {
  garden: [['ladybug', 3], ['bee', 2], ['bumble_bee', 1], ['spider', 2], ['centipede', 1], ['hornet', 1],
           ['ant_hole', 0.05]]
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

// ---------------- 生物衰减值 / 环境幸运值（Clover） ----------------
// 规则（用户口径）：每个【自然生成】的生物出生时，按所在位置的环境幸运值 L 调整稀有度。
//   L = -0.6（默认）-> 60% 概率降一级（这就是"生物衰减 60%"的数值体现）；
//   L = 1.3 -> 必定升一级，另有 30% 概率再升一级；L = 3.5 -> 必定升三级，另有 50% 升四级。
// 统一公式：shift = sign(L) × (floor(|L|) + (rand < frac(|L|) ? 1 : 0))。
// 上限给 4.0（超过按 4.0 取）；自然生成永远不可能到 Eternal（封顶 super）。
const LUCK_BASE = -0.6;
const LUCK_MAX = 4.0;
const LUCK_MAX_RARITY = 'super';
// Clover 抬高环境幸运值的半径（px，圆心 = 玩家）
const CLOVER_LUCK_R = 1000;

function luckRarityShift(luck) {
  const L = Math.min(isFinite(luck) ? luck : 0, LUCK_MAX);
  const a = Math.abs(L);
  const whole = Math.floor(a);
  const frac = a - whole;
  const dir = L < 0 ? -1 : 1;
  return dir * (whole + (Math.random() < frac ? 1 : 0));
}

// 把一次掷骰结果按环境幸运值调整；结果钳在 [common, LUCK_MAX_RARITY]。
function applyLuckToRarity(rarity, luck) {
  const i0 = RARITY_ORDER.indexOf(rarity);
  if (i0 < 0) return rarity;
  const cap = RARITY_ORDER.indexOf(LUCK_MAX_RARITY);
  const i = Math.max(0, Math.min(cap, i0 + luckRarityShift(luck)));
  return RARITY_ORDER[i];
}

// 解析生成区的 mobs 权重串："rock:0.25;\nant_soldier:1;\ngarden:1;"
//   · "名字:权重" -> 权重（省略按 1）
//   · 纯组名 -> 展开 MOB_GROUPS
// 返回 [{ type, weight }]（只保留 registry 里真实存在的生物）
// 只有"行为已完整实现"的物种才参与地图生成。garden.tmj 里目前只剩 rock / dandelion
// 不在表里（它们是植物/障碍，本来就不是生物），会被跳过并在控制台提示一次；
// 蚂蚁全家（ant_hole / queen_ant / ant_egg / soldier_ant / worker_ant / baby_ant）都已收录。
// 蜈蚣 slug = registry 英文名小写转下划线："Centipede" -> "centipede"（id 12）
const SPAWNABLE_MOB_SLUGS = new Set(['ladybug', 'bee', 'bumble_bee', 'centipede', 'spider', 'hornet', 'soldier_ant', 'worker_ant', 'baby_ant', 'ant_egg', 'queen_ant', 'ant_hole']);

// 地图（官方导出的 .tmj）里的名字 → 物种 slug。
// 兵蚁在 TMJ 里的旧写法是 ant_soldier（"兵蚁"词序），而官方英文名是 Soldier Ant（slug = soldier_ant），
// 两者指的是同一只生物。没有这张表，生成表里的 ant_soldier 会被当成"未实装物种"静默跳过。
const MOB_SPAWN_ALIASES = {
  ant_soldier: 'soldier_ant',
  ant_worker: 'worker_ant',
  ant_baby: 'baby_ant',
  ant_queen: 'queen_ant'     // i18n 与旧写法都用 ant_queen（英文名 Queen Ant 的 slug 是 queen_ant）
};

// 未实装物种的提示（每个 slug 只提示一次）：地图表里有、场上却没有，
// 过去只能靠人猜 —— 现在打开控制台就能看到到底跳过了什么。
const _spawnSkipWarned = new Set();

function parseSpawnMobs(str) {
  const out = [];
  const push = (slug, w) => {
    if (!(w > 0)) return;                 // 显式写 0 = 关掉这个物种（组内也一样）
    if (!SPAWNABLE_MOB_SLUGS.has(slug)) {
      if (!_spawnSkipWarned.has(slug)) {
        _spawnSkipWarned.add(slug);
        console.info('[spawn] 生成表里的 "' + slug + '" 尚未实装（或不是生物），已跳过');
      }
      return;
    }
    const t = MOB_TYPES.find((m) => m.slug === slug);
    if (!t) return;                      // 未收录的物种直接跳过，不臆造
    out.push({ type: t, weight: w });
  };
  for (const rawLine of String(str || '').split(/[;\n]+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const ci = line.indexOf(':');
    const raw = (ci >= 0 ? line.slice(0, ci) : line).trim().toLowerCase().replace(/ /g, '_');
    const slug = MOB_SPAWN_ALIASES[raw] || raw;
    // 权重：省略 = 1；显式写数字就用它（0 表示禁用）。
    // 旧写法 `parseFloat(x) || 1` 会把 :0 吞成 1 —— 写 0 反而变成正权重。
    let w = 1;
    if (ci >= 0) {
      const v = parseFloat(line.slice(ci + 1));
      w = Number.isFinite(v) ? Math.max(0, v) : 1;
    }
    if (MOB_GROUPS[slug]) {
      for (const g of MOB_GROUPS[slug]) push(g[0], w * (g[1] || 1));
      continue;
    }
    push(slug, w);
  }
  return out;
}
