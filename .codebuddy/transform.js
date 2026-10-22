/*
 * 将修复应用到 beefreely.min.user.js：
 *  A. 移除 3 个 jsDelivr @require（改为脚本内建加载器，国内网络不通时油猴不会因 @require 失败而整体不执行）
 *  B. 版本号 3.0.2 -> 3.0.3，并附本地修正说明
 *  C. 把结尾的 IIFE 改成 __bfMain 函数，由加载器在依赖就绪后调用
 *  D. 修复 WBI 签名：sub_key 误用 img_key_url（官方 src/constants/sign.ts 同名 bug）
 *  E. nav 响应拦截处捕获 wbi_img/sub_url 写入 localStorage 并刷新内存中的密钥
 *  F. playurl 重签名前从 localStorage 刷新密钥，保证签名始终使用最新密钥
 */
const fs = require('fs')
const path = require('path')

const INPUT = process.argv[2]
const OUTPUT = process.argv[3]
const LOADER = process.argv[4]

let code = fs.readFileSync(INPUT, 'utf8')
const loader = fs.readFileSync(LOADER, 'utf8')
const original = code

function replaceOnce(src, from, to, label) {
  const parts = src.split(from)
  if (parts.length !== 2) {
    throw new Error(`[${label}] 锚点匹配次数=${parts.length - 1}（要求恰好 1 次）\n锚点: ${from.slice(0, 120)}`)
  }
  return parts.join(to)
}

// --- A. 移除 @require ---
code = replaceOnce(code,
  '// @require      https://cdn.jsdelivr.net/npm/protobufjs@8.6.5/dist/protobuf.min.js\n', '',
  'remove-require-protobufjs')
code = replaceOnce(code,
  '// @require      https://cdn.jsdelivr.net/npm/@vue/reactivity@3.5.39/dist/reactivity.global.min.js\n', '',
  'remove-require-reactivity')
code = replaceOnce(code,
  '// @require      https://cdn.jsdelivr.net/npm/dexie@4.4.4/dist/dexie.min.js\n', '',
  'remove-require-dexie')
if (/@require/.test(code)) throw new Error('仍存在 @require 行')

// --- A2. 补裸域 @match（*.bilibili.com 在不同管理器中对裸域覆盖不一致）---
code = replaceOnce(code,
  '// @match        *://*.bilibili.com/*\n',
  '// @match        *://*.bilibili.com/*\n// @match        *://bilibili.com/*\n',
  'add-bare-domain-match')

// --- B. 版本号 + 修正说明 ---
code = replaceOnce(code, '// @version      3.0.2', '// @version      3.0.3', 'version')
code = replaceOnce(code, '// ==/UserScript==\n', '// ==/UserScript==\n\n' +
  '/* 本地修正版（基于官方 3.0.2 构建，修正项见下）\n' +
  ' * 1. 不再使用 @require 强依赖 cdn.jsdelivr.net（国内网络不通时油猴会因依赖加载失败而整体不执行脚本），\n' +
  ' *    改为脚本内建的多 CDN 回退加载 + localStorage 缓存。\n' +
  ' * 2. 修复 WBI 签名 bug：sub_key 原先误用 img_key_url（与官方 src/constants/sign.ts 中的笔误一致），\n' +
  ' *    导致 /x/player/wbi/playurl 重签名错误、1080p 高清播放地址获取失败。\n' +
  ' * 3. 从 /x/web-interface/nav 响应中捕获 wbi_img/sub_url 存入 localStorage，并在每次签名前刷新密钥，\n' +
  ' *    避免本地没有缓存密钥时签名无效。\n' +
  ' */\n', 'header-comment')

// --- C. IIFE -> __bfMain，由加载器调用 ---
code = replaceOnce(code,
  '(function(e,t,n){"use strict";',
  loader + '\nfunction __bfMain(e,t,n){"use strict";',
  'iife-head')
code = replaceOnce(code,
  '})(VueReactivity,Dexie,protobuf);',
  '}\nbfBoot();\n})();',
  'iife-tail')

// --- D. sub_key 拼写修复 ---
code = replaceOnce(code,
  'to=$a(eo.img_key_url),no=$a(eo.img_key_url),ro=new Int32Array(4)',
  'to=$a(eo.img_key_url),no=$a(eo.sub_key_url),ro=new Int32Array(4)',
  'fix-sub-key')

// --- E. nav 响应捕获 wbi 密钥 ---
code = replaceOnce(code,
  'e.url.includes(`/x/web-interface/nav`)&&(e.type===`xhr`&&(e.response=e=>{try{if(JSON.parse(e.responseText).data.isLogin){Wa.isLogin.value=!0;return}}catch{}e.responseText=JSON.stringify(Ga)}),e.type===`fetch`&&(e.response=e=>{e.json=Ga}))',
  'e.url.includes(`/x/web-interface/nav`)&&(e.type===`xhr`&&(e.response=e=>{try{let t=JSON.parse(e.responseText),n=t?.data?.wbi_img;if(n){localStorage.setItem(`wbi_img_url`,n.img_url),localStorage.setItem(`wbi_sub_url`,n.sub_url),eo.img_key_url=n.img_url,eo.sub_key_url=n.sub_url,to=$a(eo.img_key_url),no=$a(eo.sub_key_url)}if(t.data.isLogin){Wa.isLogin.value=!0;return}}catch{}e.responseText=JSON.stringify(Ga)}),e.type===`fetch`&&(e.response=e=>{e.json=Ga}))',
  'fix-nav-capture')

// --- F. 签名前刷新密钥 ---
code = replaceOnce(code,
  'Reflect.set(t,`qn`,80),Reflect.set(t,`try_look`,1),e.url=`//api.bilibili.com/x/player/wbi/playurl?${so(t,to,no)}`',
  'Reflect.set(t,`qn`,80),Reflect.set(t,`try_look`,1),eo.img_key_url=localStorage.getItem(`wbi_img_url`)||eo.img_key_url,eo.sub_key_url=localStorage.getItem(`wbi_sub_url`)||eo.sub_key_url,to=$a(eo.img_key_url),no=$a(eo.sub_key_url),e.url=`//api.bilibili.com/x/player/wbi/playurl?${so(t,to,no)}`',
  'fix-playurl-refresh')

// --- 自检 ---
if (code.indexOf('no=$a(eo.sub_key_url)') < 0) throw new Error('修复 D 未生效')
if (code.indexOf('wbi_img_url`,n.img_url') < 0) throw new Error('修复 E 未生效')
if (code.indexOf('eo.sub_key_url=localStorage.getItem') < 0) throw new Error('修复 F 未生效')
if (code.indexOf('function __bfMain(e,t,n)') < 0) throw new Error('修复 C 未生效')
if (code.indexOf('bfBoot();') < 0) throw new Error('bfBoot 调用未生效')

fs.writeFileSync(OUTPUT, code, 'utf8')
console.log('OK 输入=' + INPUT + ' (' + original.length + ' chars)')
console.log('OK 输出=' + OUTPUT + ' (' + code.length + ' chars, +' + (code.length - original.length) + ')')
