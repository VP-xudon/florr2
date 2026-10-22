/* 调试：看修正版脚本实际算出的 w_rid 用了哪种密钥组合 */
const vm = require('vm')
const fs = require('fs')
const crypto = require('crypto')

const ENC_TAB = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52]
const getMixinKey = (orig) => ENC_TAB.map(n => orig[n]).join('').slice(0, 32)
const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex')
const webKey = (url) => url.slice(url.lastIndexOf('/') + 1, url.lastIndexOf('.'))

const IMG_URL = 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png'
const SUB_URL = 'https://i0.hdslb.com/bfs/wbi/a1b2c3d4e5f60718293a4b5c6d7e8f90.png'
const PLAYURL = 'https://api.bilibili.com/x/player/wbi/playurl?aid=170001&cid=12345678&qn=32&fnver=0&fnval=16&fourk=1'

const FAKE_PROTOBUF = "window.protobuf={Root:{fromJSON:function(){return {lookupType:function(){return null}}}}};"
const FAKE_REACTIVITY = "window.VueReactivity={ref:function(v){return {value:v}},reactive:function(v){return v},watch:function(){},toRaw:function(v){return v}};"
const FAKE_DEXIE = "window.Dexie=function BF(name){this.name=name};window.Dexie.prototype.version=function(){return {stores:function(){return this}}};window.Dexie.maxKey={};window.Dexie.prototype.history=new Proxy({},{get:function(t,p){if(p==='toArray'||p==='each')return function(){return Promise.resolve([])};if(p==='get')return function(){return Promise.resolve(undefined)};return function(){return t}}});"

const sandbox = {
  console: { log: (...a) => console.log('[vm]', ...a), error: (...a) => console.log('[vm-err]', ...a), warn: () => {} },
  localStorage: (() => { const s = new Map(); return { getItem: k => s.has(k) ? s.get(k) : null, setItem: (k, v) => s.set(k, String(v)), removeItem: k => s.delete(k), clear: () => s.clear() } })(),
  document: { readyState: 'loading', cookie: '', createElement: () => ({ appendChild() {}, set textContent(v) {} }), documentElement: { appendChild() {} }, addEventListener() {} },
  location: { host: 'www.bilibili.com', href: 'https://www.bilibili.com/', search: '', pathname: '/', hostname: 'www.bilibili.com' },
  setTimeout, clearTimeout, queueMicrotask: f => Promise.resolve().then(f),
  TextEncoder, TextDecoder, URL, URLSearchParams, Response: class { clone() {} }, fetch: () => Promise.reject(new Error('x')),
}
const recorded = []
sandbox.XMLHttpRequest = class {
  constructor() { this._l = {}; this.readyState = 0; this.status = 0; this.responseText = ''; this.upload = { addEventListener() {} } }
  addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f) }
  removeEventListener() {} dispatchEvent() { return true }
  open(m, u) { recorded.push({ m, u }); this._u = u; this.readyState = 1 }
  setRequestHeader() {} getResponseHeader() { return null } getAllResponseHeaders() { return '' } abort() {}
  send() { this.status = 200; this.responseText = ''; this.readyState = 4; this._fire('readystatechange'); this._fire('load'); this._fire('loadend') }
  _fire(t) { if (typeof this['on' + t] === 'function') this['on' + t]({ type: t }); (this._l[t] || []).slice().forEach(f => f({ type: t })) }
}
const ctx = vm.createContext(sandbox)
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.globalThis = sandbox

sandbox.localStorage.setItem('wbi_img_url', IMG_URL)
sandbox.localStorage.setItem('wbi_sub_url', SUB_URL)
vm.runInContext(FAKE_PROTOBUF + '\n' + FAKE_REACTIVITY + '\n' + FAKE_DEXIE, ctx)
const body = fs.readFileSync(process.argv[2], 'utf8')
vm.runInContext(body.slice(body.indexOf('\n', body.indexOf('==/UserScript==')) + 1), ctx, { filename: 'x.user.js' })
vm.runInContext(`(function(){var x=new XMLHttpRequest();x.open('GET',${JSON.stringify(PLAYURL)},true);x.send(null)})()`, ctx)

setTimeout(() => {
  const last = recorded[recorded.length - 1]
  console.log('重写后的 URL:')
  console.log(last.u)
  const u = new URL('https:' + last.u)
  const params = Object.fromEntries(u.searchParams)
  const got = params.w_rid
  const img = webKey(IMG_URL), sub = webKey(SUB_URL)
  console.log('\nimg_key =', img)
  console.log('sub_key =', sub)
  const chr = /[!'()*]/g
  const q = Object.keys(params).filter(k => k !== 'w_rid').sort()
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]).replace(chr, ''))).join('&')
  console.log('query   =', q)
  console.log('\ngot     =', got)
  const cands = {
    'mixin(img+sub)': md5(q + getMixinKey(img + sub)),
    'mixin(img+img)': md5(q + getMixinKey(img + img)),
    'mixin(sub+sub)': md5(q + getMixinKey(sub + sub)),
    'mixin(sub+img)': md5(q + getMixinKey(sub + img)),
    'no mixin': md5(q),
  }
  for (const k in cands) console.log(k.padEnd(16), cands[k], cands[k] === got ? '  <== 匹配!' : '')
}, 100)
