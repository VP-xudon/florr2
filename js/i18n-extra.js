// i18n-extra.js — 本项目自己新增文案的唯一落点。
// 官方语言包（assets/i18n/<code>/<code>.js）由脚本抓取生成，不要往里加键；
// 需要新文案时在这里 addPack 增量注册（en_US / zh_CN 必须成对）。
'use strict';

(function () {
  if (typeof I18N === 'undefined' || typeof I18N.addPack !== 'function') return;

  const EN = {
    // ---- F3 调试屏幕 ----
    'F3/Title': 'Debug screen (F3)',
    'F3/Frame': 'Frame',
    'F3/Player': 'Player',
    'F3/Engine': 'Engine',
    'F3/Petals': 'Petals',
    'F3/Fps': 'FPS',
    'F3/FrameMs': 'Frame',
    'F3/UpdateMs': 'Update',
    'F3/RenderMs': 'Render',
    'F3/X': 'X',
    'F3/Y': 'Y',
    'F3/Region': 'Checkpoint',
    'F3/Facing': 'Facing',
    'F3/Speed': 'Speed',
    'F3/MaxSpeed': 'Max',
    'F3/Mode': 'Mode',
    'F3/Hp': 'HP',
    'F3/Invuln': 'Invulnerable',
    'F3/Equipped': 'Equipped',
    'F3/Mobs': 'Mobs',
    'F3/Visible': 'On screen',
    'F3/Asleep': 'Sleeping',
    'F3/Drops': 'Drops',
    'F3/Cards': 'Ground cards',
    'F3/Particles': 'Particles',
    'F3/Texts': 'Damage texts',
    'F3/Tick': 'Snapshots',
    'F3/SnapAge': 'Snapshot age',
    'F3/PredErr': 'Prediction error',
    'F3/RotSpeed': 'Spin',
    'F3/Reload': 'Reload',
    'F3/Steps': 'Sim steps',
    'F3/Dead': 'dead',
    'F3/Heap': 'JS heap',
    'F3/None': 'none',
    'F3/Hint': 'F3: toggle this screen    C: collision boxes',

    // ---- 移动端触控 ----
    'Touch/Reach': 'Reach',
    'Touch/Detect': 'Detect',
    'Touch/Stick': 'Move',

    // ---- /summon 参数 ----
    'Chat/Command/summon/BadParam':
      'Invalid parameter. Segmented mobs accept [type=normal] or [type=long], e.g. /summon 3 common[type=long] 1',

    // ---- 全服击杀公告 ----
    'Chat/Sys/BossDestroyed': '{0} {1} {2} was destroyed by {3}',

    // ---- 全服生成公告（super / eternal 才播）----
    // 默认模板：A <rarity> <mobname> has been spawned!
    // {0}=A/An  {1}=稀有度名  {2}=生物名
    'Chat/Sys/Spawn/Default': '{0} {1} {2} has been spawned!',
    // 专属台词：登记了台词的生物不再用默认模板（整句替换，颜色仍按稀有度）
    'Chat/Sys/Spawn/ladybug': 'A red-and-black figure rises above the horizon.',
    'Chat/Sys/Spawn/bee': 'A deep buzzing drifts in from somewhere far away.',
    'Chat/Sys/Spawn/centipede': 'Is that a giant train in the distance?'
  };

  const ZH = {
    'F3/Title': '调试屏幕（F3）',
    'F3/Frame': '帧',
    'F3/Player': '玩家',
    'F3/Engine': '引擎',
    'F3/Petals': '花瓣',
    'F3/Fps': '帧率',
    'F3/FrameMs': '帧耗时',
    'F3/UpdateMs': '逻辑',
    'F3/RenderMs': '渲染',
    'F3/X': 'X 坐标',
    'F3/Y': 'Y 坐标',
    'F3/Region': '复活区',
    'F3/Facing': '朝向',
    'F3/Speed': '当前移速',
    'F3/MaxSpeed': '最大移速',
    'F3/Mode': '模式',
    'F3/Hp': '血量',
    'F3/Invuln': '无敌剩余',
    'F3/Equipped': '装备槽',
    'F3/Mobs': '生物总数',
    'F3/Visible': '屏幕内',
    'F3/Asleep': '休眠',
    'F3/Drops': '掉落卡',
    'F3/Cards': '地面卡',
    'F3/Particles': '粒子',
    'F3/Texts': '飘字',
    'F3/Tick': '快照数',
    'F3/SnapAge': '快照延迟',
    'F3/PredErr': '预测偏差',
    'F3/RotSpeed': '转速',
    'F3/Reload': '装填',
    'F3/Steps': '模拟步/秒',
    'F3/Dead': '已碎',
    'F3/Heap': 'JS 堆',
    'F3/None': '无',
    'F3/Hint': 'F3：开关本屏幕    C：碰撞箱',

    'Touch/Reach': '远距',
    'Touch/Detect': '侦测',
    'Touch/Stick': '移动',

    'Chat/Command/summon/BadParam':
      '参数无效。多节生物支持 [type=normal] 或 [type=long]，例如 /summon 3 common[type=long] 1',

    'Chat/Sys/BossDestroyed': '{3} 摧毁了 {1} {2}',

    // ---- 全服生成公告（super / eternal 才播）----
    // 中文没有冠词，{0}（A/An）不参与拼接；默认：一只<稀有度><生物名>已在某处生成！
    'Chat/Sys/Spawn/Default': '一只{1}{2}已在某处生成！',
    'Chat/Sys/Spawn/ladybug': '一个红黑相间的身影浮现于地平线之上。',
    'Chat/Sys/Spawn/bee': '巨大的嗡嗡声从远处隐约传来。',
    'Chat/Sys/Spawn/centipede': '远方是一列巨型火车吗？'
  };

  I18N.addPack('en_US', EN);
  I18N.addPack('zh_CN', ZH);
})();
