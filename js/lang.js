// lang.js — 语言包接口（i18n）。
// 设计：
//   - 所有用户可见文本都通过 t(key) 取当前语言字符串，绝不在代码里硬编码文案。
//   - 官方包（florr.io/static/i18n）的键形如 Rarities/common/Name、Petals/basic/Name、
//     Mobs/rock/Name、UI/Death/Title 等，且值可能带格式化 DSL：
//        {#A#B}            -> t(A)，缺失则 t(B)
//        {Key/with/slash}  -> t(Key)（仅含 '/'，避开 {0} 这类占位符）
//        <c val="...">..</c> -> 纯文本显示时去标签
//   - 缺失时回退英文(en_US)，再缺失显示 <键名>（不偏袒任何语言：
//     绝不静默显示英文 fallback —— 缺失的键必须在界面上显眼可见，便于补充译文）。
//   - 仅内置英文(en_US)；官方多语言包可在 assets/i18n/<code>/<code>.js 里调用
//     I18N.addPack('<code>', {...}) 扩展，再 I18N.setLang('<code>') 切换。
'use strict';

window.I18N = (function () {
  const packs = {};          // code -> { key: text }
  let current = 'en_US';

  function addPack(code, dict) {
    if (!packs[code]) packs[code] = {};
    Object.assign(packs[code], dict);
  }
  function setLang(code) { if (packs[code]) current = code; }
  function hasLang(code) { return !!packs[code]; }
  function lang() { return current; }

  // 查找顺序：当前语言 -> en_US（官方英文，永远注册）-> null。
  // 中文包只有 2282 条，覆盖不到全部键，所以这条回退链是必需的：
  // 缺键时显示英文，而不是把 key 本身当文案显示出来。
  // （旧的 assets/lang/en.js 自建命名空间包已删除，不再参与查找。）
  function lookup(key) {
    const order = [current, 'en_US'];
    for (let i = 0; i < order.length; i++) {
      const d = packs[order[i]];
      if (d && d[key] != null) return d[key];
    }
    return null;
  }

  // 解析官方 i18n 格式化 DSL（见文件头注释），返回纯文本
  function resolveRefs(s) {
    if (typeof s !== 'string') return s;
    let out = s, prev, guard = 0;
    do {
      prev = out;
      out = out.replace(/\{#([^#]+)#([^}]*)\}/g, function (m, a, b) {
        const va = lookup(a), vb = lookup(b);
        if (va && va !== a) return va;
        if (vb && vb !== b) return vb;
        return va || vb || '';
      });
      out = out.replace(/\{#([A-Za-z0-9_.\/]+)\}/g, function (m, k) {   // {#Key} 单井引用（如 /w 复用 /whisper 的 Args/Description）
        const v = lookup(k);
        return (v && v !== k) ? v : m;
      });
      out = out.replace(/\{([A-Za-z0-9_.\/]+\/[A-Za-z0-9_.\/]+)\}/g, function (m, k) {
        const v = lookup(k);
        return (v && v !== k) ? v : m;
      });
    } while (out !== prev && guard++ < 8);
    out = out.replace(/<c[ =][^>]*>/g, '').replace(/<\/c>/g, '');   // 仅清 <c ...>/<c=...> 颜色标签，勿误伤 <count> 等占位符
    return out;
  }

  function t(key, fallback) {
    const raw = lookup(key);
    if (raw != null) return resolveRefs(raw);
    // 调用方显式给了兜底就用兜底（ui/chat 里有大量 t(key, '默认文案') 的用法）；
    // 没给兜底才显示 <键名>，让缺失的键在界面上明显可见，便于补齐译文。
    return (fallback != null) ? String(fallback) : '<' + key + '>';
  }
  // 带参数：先替换 {0},{1}... 再解析引用
  function tf(key, params, fallback) {
    let s = t(key, fallback);
    if (params) for (const k in params) s = String(s).split('{' + k + '}').join(params[k]);
    return s;
  }
  // 可选文案：查不到就用默认值（不显示 <键名>）。用于"本来就可能没有"的内容
  // （生物简介、额外说明等）—— 这类缺失不是错误，不该在界面上报警。
  function opt(key, dflt) {
    const raw = lookup(key);
    return raw != null ? resolveRefs(raw) : (dflt == null ? '' : dflt);
  }

  return { packs, addPack, setLang, hasLang, lang, t, tf, opt };
})();

// 注册官方英文包（由 assets/i18n/en_US/en_US.js 提供 window.I18N_EN）并设为当前语言
if (typeof window.I18N_EN !== 'undefined') {
  I18N.addPack('en_US', window.I18N_EN);
  I18N.setLang('en_US');
}

// 注册官方简体中文包（由 assets/i18n/zh_CN/zh_CN.js 提供 window.I18N_ZH_CN）。
// 现在两个包都在 index.html 里【无条件同步加载】：设置窗口的语言下拉框需要在
// 任意时刻都能切换/预览，不能再靠查询串决定加载哪个包。
if (typeof window.I18N_ZH_CN !== 'undefined') {
  I18N.addPack('zh_CN', window.I18N_ZH_CN);
}

// 当前语言来自用户设置（Cookie，见 util.js 的 window.Settings），重启后生效。
// 设置的值不可用（包没加载上/写错）时回退英文，绝不留空白。
(function applySavedLang() {
  const want = (typeof Settings !== 'undefined') ? Settings.get('lang') : 'en_US';
  if (want && I18N.hasLang(want)) I18N.setLang(want);
  else I18N.setLang('en_US');
})();
