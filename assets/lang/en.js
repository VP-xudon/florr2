// assets/lang/en.js — 英文语言包（目前唯一语言）。
// 官方多语言包可新增 assets/lang/<code>.js，里面调用 I18N.addPack('<code>', {...}) 扩展，
// 之后 I18N.setLang('<code>') 即可切换。所有 key 的命名空间：
//   ui.*       界面文本
//   rarity.*   稀有度显示名（其余语言包覆盖即可换语言，无需改动代码）
//   petal.* / mob.*  由数据层按 id 查表，缺失时回退 registry 原始名称（见 data.js）。
'use strict';

window.I18N.addPack('en', {
  // ---- 界面 ----
  'ui.pname': 'Flower',
  'ui.hint': 'WASD / arrow keys to move · petals attack automatically · B backpack · V pokédex',
  'ui.bag': 'Backpack',
  'ui.dex': 'Pokédex',
  'ui.bagTitle': 'Backpack',
  'ui.bagSection1': 'Equipped petals (slots · click to unequip / drag to another slot)',
  'ui.bagSection2': 'Backpack storage (click → inventory · drag → slot/inventory)',
  'ui.bagHint': 'Tip: click an inventory card to equip it to the flower; click a backpack card to move it into inventory (no effect if full); drag cards between backpack/inventory and any slot or the flower.',
  'ui.dexTitle': 'Pokédex',
  'ui.dexEmpty': '(empty)',
  'ui.dexManualTitle': 'Pending manual fill / ignored (fan-made, names not invented):',
  'ui.dexCount': 'Collected {n} / {m} ({s} species)',
  'ui.deathTitle': 'You died',
  'ui.deathSub': 'Dropped your equipped petals…',
  'ui.deathTimer': 'Respawning…',
  'ui.loading': 'Loading assets…',

  // ---- 稀有度（仅显示名；其余语言包覆盖即可换语言）----
  'rarity.common': 'Common',
  'rarity.unusual': 'Unusual',
  'rarity.rare': 'Rare',
  'rarity.epic': 'Epic',
  'rarity.legendary': 'Legendary',
  'rarity.mythic': 'Mythic',
  'rarity.ultra': 'Ultra',
  'rarity.super': 'Super',

  // ---- 全局聊天 ----
  // 官方 en_US 包未包含这些键，这里按官方英文文案补齐；
  // lang.js 的查找顺序是「当前语言 -> en_US -> en」，所以中文模式下仍优先用中文包。
  'Chat/Alone': 'No one is around to hear you.',
  'Chat/BadChannel': 'You cannot do that.',
  'Chat/Channel/Local': 'Local',
  'Chat/Channel/Squad': 'Squad',
  'Chat/Channel/Guild': 'Guild',
  'Chat/Channel/Whisper': 'Whisper',
  'UI/Chat/PromptTap': 'Tap here to chat',
  'UI/Chat/PromptClick': 'Click here to chat',
  'UI/Chat/PromptKeyboardOrClick': 'Press [ENTER] or click here to chat'
});
