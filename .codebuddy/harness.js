/* beefreely 修正版端到端验证 harness（Node vm 模拟页面环境） */
const vm = require('vm')
const fs = require('fs')
const crypto = require('crypto')

const ENC_TAB = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52]
const getMixinKey = (orig) => ENC_TAB.map(n => orig[n]).join('').slice(0, 32)
const md5 = (s) => crypto.createHash('md5').update(s, 'utf8').digest('hex')
const webKey = (url) => url.slice(url.lastIndexOf('/') + 1, url.lastIndexOf('.'))
function expectedWrid(params, imgUrl, subUrl) {
  const p = { ...params }
  delete p.w_rid // w_rid 本身不参与签名
  const mixin = getMixinKey(webKey(imgUrl) + webKey(subUrl))
  const chr = /[!'()*]/g
  const query = Object.keys(p).sort().map(k => encodeURIComponent(k) + '=' + encodeURIComponent(String(p[k]).replace(chr, ''))).join('&')
  return md5(query + mixin)
}

const IMG_URL = 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png'
const SUB_URL = 'https://i0.hdslb.com/bfs/wbi/a1b2c3d4e5f60718293a4b5c6d7e8f90.png'
const PLAYURL = 'https://api.bilibili.com/x/player/wbi/playurl?aid=170001&cid=12345678&qn=32&fnver=0&fnval=16&fourk=1'

/* 伪造的三个依赖库（仅验证加载链路用） */
const FAKE_PROTOBUF = "window.protobuf={Root:{fromJSON:function(){return {lookupType:function(){return null}}}}};"
const FAKE_REACTIVITY = "window.VueReactivity={ref:function(v){return {value:v}},reactive:function(v){return v},watch:function(){},toRaw:function(v){return v}};"
const FAKE_DEXIE = [
  "window.Dexie=function BF(name){this.name=name};",
  "window.Dexie.prototype.version=function(){return {stores:function(){return this}}};",
  "window.Dexie.maxKey={};",
  "window.Dexie.prototype.history=(function(){var self=new Proxy({},{get:function(t,p){",
  "if(p==='toArray'||p==='each')return function(){return Promise.resolve([])};",
  "if(p==='get'||p==='first'||p==='last')return function(){return Promise.resolve(undefined)};",
  "if(p==='put'||p==='add'||p==='update'||p==='bulkPut'||p==='delete'||p==='bulkDelete'||p==='clear'||p==='count')return function(){return Promise.resolve(0)};",
  "return function(){return self}}});return self})();",
].join('\n')

class FakeResponse { clone() { return new FakeResponse() } }

function createPage(opts = {}) {
  const store = new Map()
  const localStorage = {
    getItem: k => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => { store.set(String(k), String(v)) },
    removeItem: k => { store.delete(String(k)) },
    clear: () => store.clear(),
  }
  if (opts.localStorage) for (const k of Object.keys(opts.localStorage)) store.set(k, String(opts.localStorage[k]))

  const mkEl = (tag) => {
    const e = {
      tagName: String(tag).toUpperCase(), children: [], parentNode: null, _attrs: {}, style: {}, dataset: {},
      appendChild(c) { c.parentNode = this; this.children.push(c); return c },
      removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c },
      setAttribute(k, v) { this._attrs[k] = v }, getAttribute(k) { return k in this._attrs ? this._attrs[k] : null },
      addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true },
    }
    // 模拟 <script src> 在离线环境下加载失败
    Object.defineProperty(e, 'src', {
      get() { return this._src },
      set(v) {
        this._src = v
        if (e.tagName === 'SCRIPT' && v) {
          setTimeout(() => { if (typeof e.onerror === 'function') e.onerror({ type: 'error' }) }, 0)
        }
      },
    })
    return e
  }

  const log = []
  const errors = []
  const sandbox = {
    console: {
      log: (...a) => log.push(a.map(String).join(' ')),
      error: (...a) => { log.push('ERROR: ' + a.map(String).join(' ')); errors.push(a.map(String).join(' ')) },
      warn: (...a) => log.push('WARN: ' + a.map(String).join(' ')),
    },
    localStorage,
    document: null,
    location: {
      host: 'www.bilibili.com', hostname: 'www.bilibili.com',
      href: 'https://www.bilibili.com/video/BV1xx411c7mD', pathname: '/video/BV1xx411c7mD',
      search: '', protocol: 'https:', origin: 'https://www.bilibili.com',
    },
    navigator: { userAgent: 'harness', language: 'zh-CN' },
    setTimeout, clearTimeout, setInterval, clearInterval,
    queueMicrotask: (f) => Promise.resolve().then(f),
    TextEncoder, TextDecoder, URL, URLSearchParams,
    Response: FakeResponse,
    fetch: () => Promise.reject(new Error('harness: no network')),
    requestAnimationFrame: (f) => setTimeout(f, 0),
    Event: class { constructor(t) { this.type = t } },
    performance: { now: () => Date.now() },
  }
  const document = {
    readyState: 'loading', cookie: '', visibilityState: 'visible',
    documentElement: mkEl('html'), head: mkEl('head'), body: mkEl('body'),
    createElement: mkEl, createEvent: () => ({ initEvent() {} }),
    getElementsByTagName: () => [], querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
  }
  document.documentElement.appendChild(document.head)
  document.documentElement.appendChild(document.body)
  sandbox.document = document

  const recorded = { opened: [], sent: [] }
  const responder = opts.responder || (() => null)
  class FakeXHR {
    constructor() {
      this.readyState = 0; this.status = 0; this.statusText = ''
      this.responseText = ''; this.response = null; this.responseType = ''
      this.timeout = 0; this.withCredentials = false
      this._l = {}; this._headers = {}
      this.upload = { addEventListener() {}, removeEventListener() {} }
    }
    addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f) }
    removeEventListener(t, f) { const a = this._l[t] || []; const i = a.indexOf(f); if (i >= 0) a.splice(i, 1) }
    dispatchEvent() { return true }
    open(method, url) { this._m = method; this._u = String(url); recorded.opened.push({ method, url: String(url) }); this.readyState = 1 }
    setRequestHeader(k, v) { this._headers[k] = v }
    getResponseHeader() { return null }
    getAllResponseHeaders() { return '' }
    abort() { this._aborted = true }
    send(data) {
      const r = responder(this._u)
      if (r && r.error) { this.readyState = 4; this.status = 0; this._fire('error'); return }
      this.readyState = 3
      this.status = r ? (r.status || 200) : 200
      this.responseText = r ? (r.text || '') : ''
      this.readyState = 4
      recorded.sent.push({ url: this._u, data })
      this._fire('readystatechange'); this._fire('load'); this._fire('loadend')
    }
    _fire(t) {
      const h = this['on' + t]
      if (typeof h === 'function') { try { h({ type: t, target: this, currentTarget: this }) } catch (e) { errors.push('event:' + e.message) } }
      ;(this._l[t] || []).slice().forEach(f => { try { f({ type: t, target: this, currentTarget: this }) } catch (e) { errors.push('event:' + e.message) } })
    }
  }
  sandbox.XMLHttpRequest = FakeXHR

  const ctx = vm.createContext(sandbox)
  sandbox.window = sandbox
  sandbox.self = sandbox
  sandbox.top = sandbox
  sandbox.parent = sandbox
  sandbox.globalThis = sandbox
  document.defaultView = sandbox

  return { ctx, sandbox, localStorage: store, log, errors, recorded }
}

const stripMeta = (code) => code.slice(code.indexOf('\n', code.indexOf('==/UserScript==')) + 1)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
function fireXhr(ctx, url) {
  vm.runInContext(`(function(){var x=new XMLHttpRequest();x.open('GET',${JSON.stringify(url)},true);x.send(null)})()`, ctx)
}
function runJs(ctx, body, file) { vm.runInContext(body, ctx, { filename: file || 'beefreely.user.js' }) }

/* ---------- 场景 ---------- */
const results = []
function check(name, cond, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' })
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail ? '  | ' + detail : ''))
}

async function scenarioFixedWithCachedKeys() {
  console.log('\n[场景1] 修正版 + localStorage 已有 wbi 密钥 + 依赖全局已存在 -> playurl 签名')
  const page = createPage({
    localStorage: { wbi_img_url: IMG_URL, wbi_sub_url: SUB_URL },
  })
  runJs(page.ctx, FAKE_PROTOBUF + '\n' + FAKE_REACTIVITY + '\n' + FAKE_DEXIE)
  runJs(page.ctx, stripMeta(fs.readFileSync(FIXED, 'utf8')))
  check('脚本加载后安装了请求钩子(__ajaxHooker)', !!page.sandbox.__ajaxHooker)
  check('写入了伪装登录 Cookie', /DedeUserID=/.test(page.sandbox.document.cookie), page.sandbox.document.cookie.slice(0, 40))
  fireXhr(page.ctx, PLAYURL)
  await sleep(80)
  const last = page.recorded.opened[page.recorded.opened.length - 1]
  check('playurl 请求被重写', !!last && last.url.includes('api.bilibili.com/x/player/wbi/playurl'), last && last.url.slice(0, 90))
  const u = new URL('https:' + last.url)
  check('qn=80 且 try_look=1', u.searchParams.get('qn') === '80' && u.searchParams.get('try_look') === '1')
  const params = Object.fromEntries(u.searchParams)
  const exp = expectedWrid(params, IMG_URL, SUB_URL)
  check('w_rid 与参考实现一致', params.w_rid === exp, 'got=' + params.w_rid + ' exp=' + exp)
}

async function scenarioOriginalRegression() {
  console.log('\n[场景2-回归对照] 原版 3.0.2 同样条件下 -> 签名应当错误（证明 bug 存在）')
  const page = createPage({
    localStorage: { wbi_img_url: IMG_URL, wbi_sub_url: SUB_URL },
  })
  runJs(page.ctx, FAKE_PROTOBUF + '\n' + FAKE_REACTIVITY + '\n' + FAKE_DEXIE)
  runJs(page.ctx, stripMeta(fs.readFileSync(ORIGINAL, 'utf8')))
  fireXhr(page.ctx, PLAYURL)
  await sleep(80)
  const last = page.recorded.opened[page.recorded.opened.length - 1]
  const u = new URL('https:' + last.url)
  const params = Object.fromEntries(u.searchParams)
  const exp = expectedWrid(params, IMG_URL, SUB_URL)
  check('原版 w_rid 与参考实现不一致（bug 复现）', params.w_rid !== exp, 'got=' + params.w_rid + ' exp=' + exp)
}

async function scenarioNavCapture() {
  console.log('\n[场景3] 修正版 + localStorage 无密钥 -> nav 响应捕获密钥后签名')
  const page = createPage({
    responder: (url) => url.includes('/x/web-interface/nav')
      ? { status: 200, text: JSON.stringify({ code: 0, data: { isLogin: false, wbi_img: { img_url: IMG_URL, sub_url: SUB_URL }, face: '', level_info: { current_level: 3 } } }) }
      : null,
  })
  runJs(page.ctx, FAKE_PROTOBUF + '\n' + FAKE_REACTIVITY + '\n' + FAKE_DEXIE)
  runJs(page.ctx, stripMeta(fs.readFileSync(FIXED, 'utf8')))
  check('初始无 wbi 密钥', !page.localStorage.has('wbi_img_url') && !page.localStorage.has('wbi_sub_url'))
  fireXhr(page.ctx, 'https://api.bilibili.com/x/web-interface/nav')
  await sleep(80)
  check('nav 响应中的 wbi_img_url 已写入 localStorage', page.localStorage.get('wbi_img_url') === IMG_URL)
  check('nav 响应中的 wbi_sub_url 已写入 localStorage', page.localStorage.get('wbi_sub_url') === SUB_URL)
  fireXhr(page.ctx, PLAYURL)
  await sleep(80)
  const last = page.recorded.opened[page.recorded.opened.length - 1]
  const u = new URL('https:' + last.url)
  const params = Object.fromEntries(u.searchParams)
  const exp = expectedWrid(params, IMG_URL, SUB_URL)
  check('nav 捕获后 w_rid 与参考实现一致', params.w_rid === exp, 'got=' + params.w_rid + ' exp=' + exp)
}

async function scenarioLoaderAsyncMirrors() {
  console.log('\n[场景4] 依赖加载器：无全局、无缓存 -> 多 CDN 镜像回退加载')
  const page = createPage({
    responder: (url) => {
      if (url.includes('protobuf')) return { status: 200, text: FAKE_PROTOBUF }
      if (url.includes('reactivity')) return { status: 200, text: FAKE_REACTIVITY }
      if (url.includes('dexie')) return { status: 200, text: FAKE_DEXIE }
      return null
    },
  })
  check('加载前无依赖全局', page.sandbox.protobuf === undefined && page.sandbox.Dexie === undefined)
  runJs(page.ctx, stripMeta(fs.readFileSync(FIXED, 'utf8')))
  await sleep(300)
  check('异步加载后脚本已启动(__ajaxHooker)', !!page.sandbox.__ajaxHooker)
  check('protobuf 已加载', typeof page.sandbox.protobuf?.Root?.fromJSON === 'function')
  check('VueReactivity 已加载', typeof page.sandbox.VueReactivity?.ref === 'function')
  check('Dexie 已加载', typeof page.sandbox.Dexie === 'function')
  check('依赖已写入 localStorage 缓存', page.localStorage.get('beefreely_lib_v1_protobuf') === FAKE_PROTOBUF
    && page.localStorage.get('beefreely_lib_v1_VueReactivity') === FAKE_REACTIVITY
    && page.localStorage.get('beefreely_lib_v1_Dexie') === FAKE_DEXIE)
  check('无未捕获错误', page.errors.length === 0, page.errors.join(' ; ').slice(0, 200))
}

async function scenarioLoaderSyncCache() {
  console.log('\n[场景5] 依赖加载器：仅有 localStorage 缓存 -> 同步加载（不推迟钩子安装）')
  const page = createPage({
    localStorage: {
      beefreely_lib_v1_protobuf: FAKE_PROTOBUF,
      beefreely_lib_v1_VueReactivity: FAKE_REACTIVITY,
      beefreely_lib_v1_Dexie: FAKE_DEXIE,
    },
  })
  runJs(page.ctx, stripMeta(fs.readFileSync(FIXED, 'utf8')))
  check('同步路径：runInContext 返回时钩子已安装', !!page.sandbox.__ajaxHooker)
  fireXhr(page.ctx, 'https://api.bilibili.com/x/web-interface/nav')
  await sleep(50)
  check('同步路径下同样正常工作', page.errors.length === 0, page.errors.join(' ; ').slice(0, 200))
}

async function scenarioLoaderAllFail() {
  console.log('\n[场景6] 依赖加载器：所有镜像均失败 -> 明确报错且不静默')
  const page = createPage({ responder: () => ({ error: true }) })
  runJs(page.ctx, stripMeta(fs.readFileSync(FIXED, 'utf8')))
  await sleep(300)
  check('脚本未启动', !page.sandbox.__ajaxHooker)
  check('控制台有明确错误提示', page.log.some(l => l.includes('依赖库加载失败')), page.log.filter(l => l.includes('ERROR')).join(' | ').slice(0, 160))
}

const ORIGINAL = process.argv[2]
const FIXED = process.argv[3]

;(async () => {
  await scenarioFixedWithCachedKeys()
  await scenarioOriginalRegression()
  await scenarioNavCapture()
  await scenarioLoaderAsyncMirrors()
  await scenarioLoaderSyncCache()
  await scenarioLoaderAllFail()
  const failed = results.filter(r => !r.pass)
  console.log('\n===== 总计 ' + results.length + ' 项，失败 ' + failed.length + ' 项 =====')
  process.exit(failed.length ? 1 : 0)
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2) })
