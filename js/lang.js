// lang.js — 语言包接口（i18n）。
// 设计：
//   - 所有用户可见文本都通过 t(key) 取当前语言字符串，绝不在代码里硬编码文案。
//   - 官方包（florr.io/static/i18n）的键形如 Rarities/common/Name、Petals/basic/Name、
//     Mobs/rock/Name、UI/Death/Title 等，且值可能带格式化 DSL：
//        {#A#B}            -> t(A)，缺失则 t(B)
//        {Key/with/slash}  -> t(Key)（仅含 '/'，避开 {0} 这类占位符）
//        <c val="...">..</c> -> 纯文本显示时去标签
//   - 缺失时回退英文(en_US)，再缺失回退 fallback 参数或 key 本身（保证永不崩溃/空白）。
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

  function lookup(key) {
    const d = packs[current] || packs.en_US || {};
    if (d[key] != null) return d[key];
    if (packs.en && packs.en[key] != null) return packs.en[key];   // 自定义英文兜底
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
      out = out.replace(/\{([A-Za-z0-9_.\/]+\/[A-Za-z0-9_.\/]+)\}/g, function (m, k) {
        const v = lookup(k);
        return (v && v !== k) ? v : m;
      });
    } while (out !== prev && guard++ < 8);
    out = out.replace(/<c[^>]*>/g, '').replace(/<\/c>/g, '');
    return out;
  }

  function t(key, fallback) {
    const raw = lookup(key);
    const s = raw != null ? raw : (fallback != null ? fallback : key);
    return resolveRefs(s);
  }
  // 带参数：先替换 {0},{1}... 再解析引用
  function tf(key, params, fallback) {
    let s = t(key, fallback);
    if (params) for (const k in params) s = String(s).split('{' + k + '}').join(params[k]);
    return s;
  }

  return { packs, addPack, setLang, hasLang, lang, t, tf };
})();

// 注册官方英文包（由 assets/i18n/en_US/en_US.js 提供 window.I18N_EN）并设为当前语言
if (typeof window.I18N_EN !== 'undefined') {
  I18N.addPack('en_US', window.I18N_EN);
  I18N.setLang('en_US');
}
