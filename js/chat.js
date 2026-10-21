// chat.js — 全局聊天（服务器设定）
// 'use strict';
//
// 设计要点
//   · 聊天是【服务器全局设定】：客户端从不自己往历史里插消息，一律经 Net 上行、
//     由服务端路由后作为事件下行（见 net.js 的 LocalServer.sendChat）。
//     本模块只负责"收到事件 -> 记录/显示"，以及"用户输入 -> 上行"。
//   · 单一容器：收起态与展开态共用【同一个输入框】—— 左右边界、圆角、白底黑边
//     完全一致；打开时只是在它上方追加频道标签与历史，轮廓形状不变。
//   · 漂浮态：非输入态时，近期消息无边框直接叠在画面上，一段时间后渐隐。
//   · 约定：**红色字体一律为系统消息**（系统私信玩家）；普通消息为白字 +
//     金黄色频道标签/玩家名。文字统一 Ubuntu + 黑色描边（与画面内 canvas 同款）。

// 频道定义。颜色取自 notice2.PNG 的标签文字（Local 黄、Squad 粉、Guild 青、Whisper 紫），
// 左侧小方块统一为浅色实心（不在 JS 里上色）。
const CHAT_CHANNELS = [
  { id: 'local',   open: true,  color: '#ffe763', nameKey: 'Chat/Channel/Local' },
  { id: 'squad',   open: false, color: '#ff7a9e', nameKey: 'Chat/Channel/Squad' },
  { id: 'guild',   open: false, color: '#3ad6c8', nameKey: 'Chat/Channel/Guild' },
  { id: 'whisper', open: false, color: '#b98bff', nameKey: 'Chat/Channel/Whisper' }
];
// 消息在漂浮态的最长存活时间（秒）：超时后渐隐消失
const CHAT_FADE_T = 6;
// 输入态历史区的最大高度（px）：超出即出现滚动条
const CHAT_MAX_H = 168;
// 系统消息专用色（约定：红 = 系统）
const CHAT_SYS_COLOR = '#ff0000';
// 频道标签 + 玩家名颜色（取自 notice2.PNG 实测）
const CHAT_NAME_COLOR = '#ffe763';

const Chat = {
  channel: 'local',       // 当前频道
  history: [],            // 登入以来收到的全部可见消息（输入态显示，不删除）
  float: [],              // 漂浮态队列（带过期时间）
  inputMode: false,
  refs: null,
  _net: null,

  // DOM 与样式见 css/style.css 的 #chat 段；这里只负责行为。
  // net 可后补（Game.init 会调 bindNet），因为 UI.init 早于 Game 创建。
  init(net) {
    if (net) this._net = net;
    const root = document.getElementById('ui');
    if (!root) return;
    if (this.refs) return;          // 已初始化

    // 单一容器：收起/展开共用同一个输入框。左右边界由 #chat 固定，
    // 展开时只在输入框【上方】追加标签与历史（#chat 用 bottom 定位，自动向上生长）。
    const box = document.createElement('div');
    box.id = 'chat';
    box.className = 'collapsed';    // collapsed = 收起态（隐藏标签与历史）
    box.innerHTML = `
      <div class="chat-tabs" id="chatTabs"></div>
      <div class="chat-log" id="chatLog"></div>
      <div class="chat-inputrow">
        <span class="chat-chan" id="chatChanTag"></span>
        <input class="chat-input" id="chatInput" type="text" maxlength="200" autocomplete="off" />
      </div>`;
    root.appendChild(box);

    // 漂浮态图层：与输入框独立，保证"无边框直接显示"
    const floatLayer = document.createElement('div');
    floatLayer.id = 'chatFloat';
    floatLayer.className = 'chat-float';
    root.appendChild(floatLayer);

    const $ = (id) => box.querySelector('#' + id);
    this.refs = {
      box, tabs: $('chatTabs'), log: $('chatLog'),
      chanTag: $('chatChanTag'), input: $('chatInput'),
      inputRow: box.querySelector('.chat-inputrow'),
      floatLayer
    };

    // 频道标签
    for (const c of CHAT_CHANNELS) {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'chat-tab' + (c.id === this.channel ? ' on' : '');
      t.dataset.ch = c.id;
      t.innerHTML = `<i class="chat-box"></i><span></span>`;
      const sp = t.querySelector('span');
      sp.textContent = this.chanName(c);
      sp.style.color = c.color;   // 参考 notice2.PNG：频道文字按频道着色，左侧小方块为浅色实心
      t.addEventListener('click', () => this._pickChannel(c));
      this.refs.tabs.appendChild(t);
    }
    this._syncChanTag();

    // 收起态显示在输入框里的提示文案（= 点击之前看到的那行字）
    this.refs.input.placeholder =
      I18N.t('UI/Chat/PromptKeyboardOrClick', 'Press [ENTER] or click here to chat');

    // 输入框：Enter 发送 / Esc 退出；聚焦即视为进入输入态
    this.refs.input.addEventListener('keydown', (e) => {
      e.stopPropagation();                       // 别让游戏的全局快捷键收到
      if (e.key === 'Enter') {
        const text = this.refs.input.value.trim();
        if (text) this.send(text);
        this.refs.input.value = '';
        this.exit();
      } else if (e.key === 'Escape') {
        this.exit();
      }
    });
    this.refs.input.addEventListener('focus', () => this.enter());
    this.refs.input.addEventListener('blur', () => { if (this.inputMode) this.exit(); });
    // 整行（含前缀标签）可点，等价于点输入框
    this.refs.inputRow.addEventListener('mousedown', (e) => {
      if (e.target !== this.refs.input) { e.preventDefault(); this.refs.input.focus(); }
    });

    this._syncChrome();
  },

  chanName(c) { return I18N.t(c.nameKey, c.id); },

  // 网络层后补绑定：聊天必须走 Net 上行（服务器全局设定），不允许本地直插
  bindNet(net) { if (net) this._net = net; },

  // ---- 输入态开关 ----
  // 注意：切换的只是 #chat 上的 .collapsed 类 —— 输入框本身的位置/尺寸/边框不变。
  enter() {
    if (this.inputMode) { this.refs.input.focus(); return; }
    this.inputMode = true;
    this.refs.box.classList.remove('collapsed');
    this._renderLog();
    this._syncChrome();
    this.refs.input.focus();
  },
  exit() {
    if (!this.inputMode) return;
    this.inputMode = false;
    this.refs.box.classList.add('collapsed');
    this.refs.input.blur();
    this._syncChrome();
  },
  toggle() { this.inputMode ? this.exit() : this.enter(); },

  _pickChannel(c) {
    if (!c.open) {
      // 未开放频道：给一条系统提示（红字 = 系统消息），不切换
      this.push({ kind: 'sys', channel: this.channel, text: 'Chat/BadChannel' });
      return;
    }
    this.channel = c.id;
    for (const t of this.refs.tabs.children) {
      t.classList.toggle('on', t.dataset.ch === c.id);
    }
    this._syncChanTag();
  },

  // 输入框内的频道前缀（如 [Local]）
  _syncChanTag() {
    const cur = CHAT_CHANNELS.find((c) => c.id === this.channel) || CHAT_CHANNELS[0];
    this.refs.chanTag.textContent = '[' + this.chanName(cur) + ']';
    this.refs.chanTag.style.color = CHAT_NAME_COLOR;
  },

  // ---- 上行：用户发送 ----
  send(text) {
    if (!this._net) return;
    // 只经网络层上行；服务端路由后再作为事件回来，客户端不自己插历史
    this._net.send({ t: 'chat', channel: this.channel, text });
  },

  // ---- 下行：收到一条消息/事件 ----
  // ev: { kind:'chat', channel, from, text } 普通消息
  //     { kind:'sys',  channel, text }        系统私信（红字）
  push(ev) {
    const msg = {
      sys: ev.kind === 'sys',
      channel: ev.channel || this.channel,
      from: ev.from || null,
      text: ev.text,
      // 系统消息的 text 是 i18n key（如 'Chat/Alone'），普通消息的 text 就是原文
      label: ev.kind === 'sys' ? I18N.t(ev.text, ev.text) : ev.text,
      born: performance.now()
    };
    this.history.push(msg);
    this.float.push(msg);
    // 漂浮态只保留最近几条，避免堆满屏幕
    while (this.float.length > 6) this.float.shift();
    if (this.inputMode) this._renderLog();
  },

  // ---- 渲染 ----
  // 输入态：完整历史（登入以来全部可见消息），超出高度出滚动条
  _renderLog() {
    const log = this.refs.log;
    log.textContent = '';
    for (const m of this.history) log.appendChild(this._line(m));
    log.scrollTop = log.scrollHeight;      // 始终滚到最新
    log.style.maxHeight = CHAT_MAX_H + 'px';
  },
  _line(m) {
    const d = document.createElement('div');
    d.className = 'chat-line' + (m.sys ? ' sys' : '');
    if (m.sys) {
      // 系统消息：整行红字，无频道标签
      const s = document.createElement('span');
      s.className = 'chat-sys';
      s.textContent = m.label;
      d.appendChild(s);
      return d;
    }
    const tag = document.createElement('span');
    tag.className = 'chat-tag';
    tag.textContent = '[' + this.chanName(CHAT_CHANNELS.find((c) => c.id === m.channel) || CHAT_CHANNELS[0]) + ']';
    const nm = document.createElement('span');
    nm.className = 'chat-name';
    nm.textContent = (m.from || 'Guest') + ':';
    const tx = document.createElement('span');
    tx.className = 'chat-text';
    tx.textContent = m.text;
    d.appendChild(tag); d.appendChild(nm); d.appendChild(tx);
    return d;
  },
  // 漂浮态：无边框、无底色，直接叠在画面上；超时渐隐。
  // 由 UI 的覆盖层循环每帧调用（见 ui.js 的 Chat.tick）。
  tick(dt) {
    const layer = this.refs && this.refs.floatLayer;
    if (!layer || this.inputMode) return;
    const now = performance.now();
    // 过期移除
    for (let i = this.float.length - 1; i >= 0; i--) {
      if (now - this.float[i].born > CHAT_FADE_T * 1000) this.float.splice(i, 1);
    }
    // DOM 与队列按索引对齐：不够就补、多了就删，内容变了才重填
    while (layer.children.length < this.float.length) {
      layer.appendChild(this._line(this.float[layer.children.length]));
    }
    while (layer.children.length > this.float.length) {
      layer.removeChild(layer.lastChild);
    }
    for (let i = 0; i < this.float.length; i++) {
      const m = this.float[i];
      const el = layer.children[i];
      if (el._msg !== m) {
        el._msg = m;
        el.textContent = '';
        const src = this._line(m);
        while (src.firstChild) el.appendChild(src.firstChild);
      }
      const age = (now - m.born) / 1000;
      // 最后 1s 渐隐
      const a = age < CHAT_FADE_T - 1 ? 1 : Math.max(0, 1 - (age - (CHAT_FADE_T - 1)));
      el.style.opacity = a.toFixed(3);
    }
  },
  // 输入态与漂浮态互斥显示
  _syncChrome() {
    if (this.refs.floatLayer) {
      this.refs.floatLayer.classList.toggle('hidden', this.inputMode);
    }
  }
};
