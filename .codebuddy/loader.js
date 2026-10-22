/*
 * beefreely 依赖加载器（修正版，插入到 user.js 中）
 *
 * 背景：原脚本通过 @require 从 cdn.jsdelivr.net 加载 protobufjs / @vue/reactivity / dexie。
 * 国内网络访问 jsDelivr 不稳定，油猴一旦加载 @require 失败就会直接放弃执行整个脚本。
 *
 * 本加载器改为由脚本自行加载三个依赖：
 *   1. 页面已存在可用的全局对象 -> 直接复用；
 *   2. localStorage 中有缓存 -> 同步 eval（不会推迟请求钩子的安装时机）；
 *   3. 否则并发请求多个 CDN 镜像，取第一个可用者，并写入 localStorage 缓存；
 *   4. 若 eval 被页面 CSP 拦截，回退为 <script> 标签注入。
 * 注意：本文件内不要使用反引号与 ${}（由 transform.js 原样拼接进 user.js）。
 */
(function(){
'use strict';
bfLog('脚本已注入 (document-start)，当前站点: '+location.host);
var BF_LIBS=[
 {name:'protobufjs',g:'protobuf',check:function(v){return !!(v&&v.Root&&typeof v.Root.fromJSON==='function')},urls:[
  'https://cdn.jsdelivr.net/npm/protobufjs@8.6.5/dist/protobuf.min.js',
  'https://fastly.jsdelivr.net/npm/protobufjs@8.6.5/dist/protobuf.min.js',
  'https://testingcf.jsdelivr.net/npm/protobufjs@8.6.5/dist/protobuf.min.js',
  'https://quantil.jsdelivr.net/npm/protobufjs@8.6.5/dist/protobuf.min.js',
  'https://unpkg.com/protobufjs@8.6.5/dist/protobuf.min.js',
  'https://npm.elemecdn.com/protobufjs@8.6.5/dist/protobuf.min.js',
  'https://lib.baomitu.com/protobufjs/8.6.5/dist/protobuf.min.js']},
 {name:'@vue/reactivity',g:'VueReactivity',check:function(v){return !!(v&&typeof v.ref==='function'&&typeof v.reactive==='function'&&typeof v.toRaw==='function')},urls:[
  'https://cdn.jsdelivr.net/npm/@vue/reactivity@3.5.39/dist/reactivity.global.min.js',
  'https://fastly.jsdelivr.net/npm/@vue/reactivity@3.5.39/dist/reactivity.global.min.js',
  'https://testingcf.jsdelivr.net/npm/@vue/reactivity@3.5.39/dist/reactivity.global.min.js',
  'https://quantil.jsdelivr.net/npm/@vue/reactivity@3.5.39/dist/reactivity.global.min.js',
  'https://unpkg.com/@vue/reactivity@3.5.39/dist/reactivity.global.min.js',
  'https://npm.elemecdn.com/@vue/reactivity@3.5.39/dist/reactivity.global.min.js']},
 {name:'dexie',g:'Dexie',check:function(v){return typeof v==='function'&&v.maxKey!==undefined},urls:[
  'https://cdn.jsdelivr.net/npm/dexie@4.4.4/dist/dexie.min.js',
  'https://fastly.jsdelivr.net/npm/dexie@4.4.4/dist/dexie.min.js',
  'https://testingcf.jsdelivr.net/npm/dexie@4.4.4/dist/dexie.min.js',
  'https://quantil.jsdelivr.net/npm/dexie@4.4.4/dist/dexie.min.js',
  'https://unpkg.com/dexie@4.4.4/dist/dexie.min.js',
  'https://npm.elemecdn.com/dexie@4.4.4/dist/dexie.min.js',
  'https://lib.baomitu.com/dexie/4.4.4/dist/dexie.min.js']}
];
var BF_CACHE_PREFIX='beefreely_lib_v1_';
var BF_TIMEOUT=15000;
function bfLog(){try{console.log.apply(console,['[beefreely]'].concat([].slice.call(arguments)))}catch(e){}}
function bfErr(){try{console.error.apply(console,['[beefreely]'].concat([].slice.call(arguments)))}catch(e){}}
function bfLSGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function bfLSSet(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}}
function bfDefine(code,g,check){(0,eval)(code);var v=window[g];if(!check(v))throw new Error('依赖 '+g+' 校验失败');return v}
function bfFetchText(url){return new Promise(function(resolve,reject){var x=new XMLHttpRequest();x.open('GET',url,true);x.timeout=BF_TIMEOUT;x.onreadystatechange=function(){if(x.readyState!==4)return;if(x.status===200||x.status===0)resolve(x.responseText||'');else reject(new Error('HTTP '+x.status))};x.onerror=function(){reject(new Error('network error'))};x.ontimeout=function(){reject(new Error('timeout'))};x.send()})}
function bfInjectScriptTag(url){return new Promise(function(resolve,reject){var s=document.createElement('script');s.src=url;s.onload=function(){s.parentNode&&s.parentNode.removeChild(s);resolve()};s.onerror=function(){s.parentNode&&s.parentNode.removeChild(s);reject(new Error('script load error'))};(document.head||document.documentElement).appendChild(s)})}
function bfLoadFromMirrors(lib){return new Promise(function(resolve,reject){var settled=false,failed=0;function onFail(){failed++;if(!settled&&failed>=lib.urls.length)reject(new Error('所有镜像均无法加载 '+lib.name))}lib.urls.forEach(function(url){bfFetchText(url).then(function(code){if(settled)return;try{bfDefine(code,lib.g,lib.check);bfLSSet(BF_CACHE_PREFIX+lib.g,code);settled=true;bfLog(lib.name+' 加载成功: '+url);resolve()}catch(e){onFail()}}).catch(onFail)})})}
function bfLoadByScriptTag(lib){var chain=Promise.reject(new Error('start'));lib.urls.forEach(function(url){chain=chain.catch(function(){return bfInjectScriptTag(url).then(function(){if(!lib.check(window[lib.g]))throw new Error('依赖 '+lib.g+' 校验失败')})})});return chain}
function bfEnsure(lib){if(lib.check(window[lib.g]))return Promise.resolve();var cached=bfLSGet(BF_CACHE_PREFIX+lib.g);if(cached){try{bfDefine(cached,lib.g,lib.check);return Promise.resolve()}catch(e){}}return bfLoadFromMirrors(lib).catch(function(e){bfLog('镜像下载失败，尝试 script 标签注入: '+(e&&e.message));return bfLoadByScriptTag(lib)})}
function bfStart(){if(window.__beefreelyStarted)return;window.__beefreelyStarted=true;__bfMain(window.VueReactivity,window.Dexie,window.protobuf)}
function bfBoot(){var rest=[];BF_LIBS.forEach(function(l){if(l.check(window[l.g]))return;var c=bfLSGet(BF_CACHE_PREFIX+l.g);if(c){try{bfDefine(c,l.g,l.check);return}catch(e){}}rest.push(l)});if(!rest.length){bfLog('依赖已就绪（页面全局或本地缓存），脚本启动');bfStart();return}bfLog('正在从 CDN 加载依赖库: '+rest.map(function(l){return l.name}).join(', '));Promise.all(rest.map(bfEnsure)).then(bfStart,function(e){bfErr('依赖库加载失败，脚本无法运行，请检查网络后刷新重试: '+(e&&e.message))})}
