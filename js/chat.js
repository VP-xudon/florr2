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

// 频道定义。标签颜色对齐稀有度/专用色：local=common(草绿)、squad=heal(粉)、guild=mythic(天蓝)、whisper=rare(紫蓝)。
const CHAT_CHANNELS = [
  { id: 'local',   open: true,  color: RARITIES.common.color, nameKey: 'Chat/Channel/Local' },
  { id: 'squad',   open: false, color: HEAL_TEXT_COLOR,       nameKey: 'Chat/Channel/Squad' },
  { id: 'guild',   open: false, color: RARITIES.mythic.color, nameKey: 'Chat/Channel/Guild' },
  { id: 'whisper', open: false, color: RARITIES.rare.color,   nameKey: 'Chat/Channel/Whisper' }
];
// 发送范围/频道的标签配色（map=橙、global=紫；这两个只在指令/输入框出现，上方四选项卡不加）
const SCOPE_COLORS = {
  local: RARITIES.common.color, squad: HEAL_TEXT_COLOR, guild: RARITIES.mythic.color,
  whisper: RARITIES.rare.color, map: '#ff9f2e', global: '#b57cf0'
};
// 密语模式前缀 / 文字颜色（取自 Whisper 频道色）
const CHAT_WHISPER_COLOR = '#c9a6ff';
// 消息在漂浮态的最长存活时间（秒）：超时后渐隐消失
const CHAT_FADE_T = 6;
// 输入态历史区的最大高度（px）：超出即出现滚动条
const CHAT_MAX_H = 168;
// 系统消息专用色（约定：红 = 系统）
const CHAT_SYS_COLOR = '#ff0000';
// 频道标签 + 玩家名颜色（取自 notice2.PNG 实测）
const CHAT_NAME_COLOR = '#ffe763';

const Chat = {
  channel: 'local',       // 当前发送范围：local / global / map / whisper
  whisperTarget: null,    // 密语对象（whisper 范围时生效）
  lastWhisperFrom: null,  // 最近一次密语对象（/reply 用）
  blocked: null,          // 本地屏蔽名单（Set，/unblock 用）
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
      t.className = 'chat-tab' + (c.open ? ' on' : '');
      t.dataset.ch = c.id;
      t.innerHTML = `<i class="chat-box"><b class="chat-fill"></b></i><span></span>`;
      const sp = t.querySelector('span');
      sp.textContent = this.chanName(c);
      sp.style.color = c.color;   // 参考 notice2.PNG：频道文字按频道着色
      const fill = t.querySelector('.chat-fill');
      // 勾选/取消动画结束后清掉动画类，避免残留影响下次切换
      fill.addEventListener('animationend', () => fill.classList.remove('cbx-checking', 'cbx-unchecking'));
      // 点标签不抢焦点：否则输入框失焦会触发 exit() 收起聊天，勾选后就看不见标签了
      t.addEventListener('mousedown', (e) => e.preventDefault());
      t.addEventListener('click', () => this._toggleChannel(c));
      this.refs.tabs.appendChild(t);
    }
    this._syncChanTag();

    // 收起态显示在输入框里的提示文案（= 点击之前看到的那行字）
    this.refs.input.placeholder =
      I18N.t('UI/Chat/PromptKeyboardOrClick', 'Press [ENTER] or click here to chat');

    // 输入框：Enter 发送/执行指令 / 空格触发范围切换 / Esc 退出；聚焦即视为进入输入态
    this.refs.input.addEventListener('keydown', (e) => {
      e.stopPropagation();                       // 别让游戏的全局快捷键收到
      if (e.key === 'Enter') {
        const text = this.refs.input.value.trim();
        if (!text) { this.exit(); }
        else if (text[0] === '/') {
          this._runCommand(text);            // 指令：本地处理（/summon /resphere 交服务端）
          this.refs.input.value = '';
          this._refreshCmdMode();            // 指令后保持展开，便于查看输出/新前缀
        } else {
          this._sendCurrent(text);           // 普通消息：按当前范围发送/密语
          this.refs.input.value = '';
          this._refreshCmdMode();
          this.exit();
        }
      } else if (e.key === 'Escape') {
        this.exit();
      } else if (e.key === ' ') {
        // 输入范围切换指令后按空格：立即切换（/local /global /map /whisper <名> /reply）或对 squad/guild 报错，并去掉指令
        const val = this.refs.input.value.trim();
        let m = /^\/(local|global|map)$/i.exec(val);
        if (m) { e.preventDefault(); this._setScope(m[1].toLowerCase()); this.refs.input.value = ''; this._refreshCmdMode(); return; }
        m = /^\/(whisper|w)\s+(\S+)$/i.exec(val);
        if (m) { e.preventDefault(); this._setScope('whisper', m[2]); this.refs.input.value = ''; this._refreshCmdMode(); return; }
        m = /^\/(reply|r)$/i.exec(val);
        if (m && this.lastWhisperFrom) { e.preventDefault(); this._setScope('whisper', this.lastWhisperFrom); this.refs.input.value = ''; this._refreshCmdMode(); return; }
        m = /^\/(squad|guild)$/i.exec(val);
        if (m) { e.preventDefault(); this._setScope(m[1].toLowerCase()); this.refs.input.value = ''; this._refreshCmdMode(); return; }
        m = /^\/(squad|guild)-[a-z-]+$/i.exec(val);
        if (m) { e.preventDefault(); this._sys('Chat/Command/Unavailable'); this.refs.input.value = ''; this._refreshCmdMode(); return; }
      }
    });
    // 输入变化：以 / 开头进入"指令提示"态（隐藏 [Local] 前缀，历史区改显匹配指令）
    this.refs.input.addEventListener('input', () => this._refreshCmdMode());
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
    this._refreshCmdMode();
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

  // 频道标签 = 勾选框：点击切换该频道开/关（带勾选动画）。
  //   · 勾选 -> 同时设为当前发送频道；
  //   · 取消当前发送频道 -> 切到仍勾选的第一个；
  //   · 至少保留一个勾选频道（全取消时强制勾回 Local），保证始终有可发送频道。
  _toggleChannel(c) {
    c.open = !c.open;
    if (!CHAT_CHANNELS.some((x) => x.open)) CHAT_CHANNELS[0].open = true;   // 至少订阅一个频道
    for (const t of this.refs.tabs.children) {
      const ch = CHAT_CHANNELS.find((x) => x.id === t.dataset.ch);
      const on = !!(ch && ch.open);
      const was = t.classList.contains('on');
      t.classList.toggle('on', on);
      if (was !== on) this._animBox(t, on);
    }
    // 勾选框只控制"订阅哪些频道"；发送范围由 /local /global /map /whisper 指令切换，此处不改发送范围
  },

  // 播放勾选框动画：on = 绿块放大后变深灰；off = 先变红再缩到中心消失
  _animBox(tabEl, on) {
    const fill = tabEl.querySelector('.chat-fill');
    if (!fill) return;
    fill.classList.remove('cbx-checking', 'cbx-unchecking');
    void fill.offsetWidth;                 // 强制重排，确保重复切换时动画能重新触发
    fill.classList.add(on ? 'cbx-checking' : 'cbx-unchecking');
  },

  // 输入框内的发送范围前缀：[Local] / [Global] / [Map] / [→ 密语对象]
  _scopeName(ch) {
    if (ch === 'global') return I18N.t('Chat/Channel/Global', 'Global');
    if (ch === 'map') return I18N.t('Chat/Channel/Map', 'Map');
    const c = CHAT_CHANNELS.find((x) => x.id === ch);
    return c ? this.chanName(c) : (ch || 'Local');
  },
  _syncChanTag() {
    const tag = this.refs.chanTag;
    if (this.channel === 'whisper') {
      tag.textContent = '[@' + (this.whisperTarget || '') + ']';
      tag.style.color = SCOPE_COLORS.whisper;
    } else {
      tag.textContent = '[' + this._scopeName(this.channel) + ']';
      tag.style.color = SCOPE_COLORS[this.channel] || CHAT_NAME_COLOR;
    }
  },

  // ---- 指令提示态 / 频道切换指令 ----
  // 输入以 / 开头即进入指令态：隐藏 [Local] 前缀，历史区改显匹配的指令列表
  _refreshCmdMode() {
    const val = this.refs.input.value;
    const cmd = val[0] === '/';
    this.refs.chanTag.style.display = cmd ? 'none' : '';
    if (cmd) this._renderHints(val.slice(1).split(/\s+/)[0].toLowerCase());
    else this._renderLog();
  },
  // 枚举 i18n 里的全部指令名（来源：Chat/Command/<name>/Args）
  _allCommands() {
    if (this._cmdsCache) return this._cmdsCache;
    const pack = (window.I18N && I18N.packs && I18N.packs.en_US) || {};
    const names = new Set();
    for (const k in pack) {
      const m = /^Chat\/Command\/([^/]+)\/Args$/.exec(k);
      if (m) names.add(m[1]);
    }
    this._cmdsCache = Array.from(names).sort();
    return this._cmdsCache;
  },
  // 在历史区位置渲染匹配的指令：一条指令一个小半透明栏 = "/名 参数 - 介绍"
  _renderHints(token) {
    const log = this.refs.log;
    log.style.display = '';
    log.textContent = '';
    const list = this._allCommands().filter((n) => n.indexOf(token) === 0);
    for (const name of list) {
      const args = I18N.t('Chat/Command/' + name + '/Args', '');
      const desc = I18N.t('Chat/Command/' + name + '/Description', '');
      const bar = document.createElement('div');
      bar.className = 'chat-hint';
      const c1 = document.createElement('span');
      c1.className = 'chat-hint-cmd';
      c1.textContent = '/' + name + (args ? ' ' + args : '');
      const c2 = document.createElement('span');
      c2.className = 'chat-hint-desc';
      c2.textContent = desc ? '  ' + desc : '';
      bar.appendChild(c1); bar.appendChild(c2);
      log.appendChild(bar);
    }
    log.scrollTop = 0;
    log.style.maxHeight = CHAT_MAX_H + 'px';
  },
  // 执行一条指令（/xxx ...）。squad/guild 相关暂不可用；/resphere 交服务端；其余本地实现。
  _runCommand(text) {
    const parts = text.split(/\s+/);
    const cmd = parts[0].replace(/^\//, '').toLowerCase();
    const args = parts.slice(1);
    if (/^(squad|guild)-/.test(cmd)) { this._sys('Chat/Command/Unavailable'); return; }   // 公会/小队子指令暂不可用
    switch (cmd) {
      case 'local': this._setScope('local'); break;
      case 'global': this._setScope('global'); break;
      case 'map': this._setScope('map'); break;
      case 'guild': this._setScope('guild'); break;    // 仅切输入框；发消息才报错
      case 'squad': this._setScope('squad'); break;
      case 'whisper':
      case 'w':
        if (!args[0]) { this._sys('Chat/Command/WhisperUsage'); break; }
        if (args.length > 1) this._tryWhisper(args[0], args.slice(1).join(' '));   // 带消息：校验在线后发
        else this._setScope('whisper', args[0]);                                  // 仅目标：进入密语模式
        break;
      case 'reply':
      case 'r':
        if (!this.lastWhisperFrom) { this._sys('Chat/Command/NoReply'); break; }
        if (args.length) this._tryWhisper(this.lastWhisperFrom, args.join(' '));
        else this._setScope('whisper', this.lastWhisperFrom);
        break;
      case 'help': this._help(args[0]); break;
      case 'rot-speed': this._rotSpeed(args[0]); break;
      case 'print-players': this._printPlayers(); break;
      case 'unblock': this._unblock(args[0]); break;
      case 'unblock-all': this._unblockAll(); break;
      case 'resphere': this.send(text); break;   // 交服务端
      case 'summon': this.send(text); break;      // 管理员指令，交服务端
      case 'kill': this.send(text); break;        // 交服务端（匹配玩家并杀死）
      case 'kill-mob': this.send(text); break;    // 交服务端
      default: this._sys('Chat/Command/Unknown');
    }
  },
  // 切换发送范围（local / global / map / whisper）
  _setScope(scope, target) {
    this.channel = scope;
    this.whisperTarget = (scope === 'whisper') ? (target || this.whisperTarget || '') : null;
    this._syncChanTag();
  },
  // 按当前范围发送：whisper -> 校验在线后密语；guild/squad -> 发消息才报错；其余 -> 上行服务端
  _sendCurrent(text) {
    if (this.channel === 'whisper' && this.whisperTarget) {
      this._tryWhisper(this.whisperTarget, text);
    } else if (this.channel === 'guild' || this.channel === 'squad') {
      this._sys('Chat/Command/Unavailable');
    } else {
      this.send(text);
    }
  },
  // 发一条密语（单机本地：直接入历史/漂浮）
  _whisper(target, text) {
    this.lastWhisperFrom = target;
    this.push({ kind: 'whisper', channel: 'whisper', target, text });
  },
  // 自己的名字（密语 [@self -> @its] 用）
  _selfName() {
    const p = (this._net && this._net.server && this._net.server.player) || null;
    return (p && p.name) ? p.name : 'You';
  },
  // 匹配玩家：全名 / 忽略大小写，以及 "#0333" -> "Guest #0333"（客人玩家）
  _matchPlayer(input) {
    if (!input) return null;
    const srv = this._net && this._net.server;
    const cands = [];
    if (srv && srv.player) cands.push(srv.player);
    if (srv && Array.isArray(srv.players)) for (const pl of srv.players) cands.push(pl);
    const q = String(input).trim(), ql = q.toLowerCase();
    for (const pl of cands) {
      const pn = pl && pl.name;
      if (!pn) continue;
      if (pn === q || pn.toLowerCase() === ql) return pl;
      if (q[0] === '#' && pn.toLowerCase() === 'guest ' + ql) return pl;
    }
    return null;
  },
  // 发密语前匹配玩家：找不到报错、不能密语自己；用全名记录以便显示
  _tryWhisper(input, text) {
    const pl = this._matchPlayer(input);
    if (!pl) { this._sys('Chat/CommandError/WhisperTargetNotFound'); return false; }
    if (pl.name === this._selfName()) { this._sys('Chat/CommandError/WhisperSelf'); return false; }
    this._whisper(pl.name, text);
    return true;
  },
  // 系统消息（红字）。str 既可是 i18n key，也可是已格式化的文本
  _sys(str) { this.push({ kind: 'sys', channel: this.channel, text: str }); },
  // 帮助输出：与指令匹配提示同格式（一个半透明栏：黄色指令 + 白色介绍）
  _pushHintLine(cmd, desc) {
    const m = { hint: true, cmd: cmd, desc: desc || '', born: performance.now() };
    this.history.push(m);
    this.float.push(m);   // 也进漂浮层：非焦点态也能看到 /help 等输出
    while (this.float.length > 30) this.float.shift();
  },
  _help(cmd) {
    if (cmd) {
      const c = cmd.replace(/^\//, '').toLowerCase();
      const a = I18N.t('Chat/Command/' + c + '/Args', '');
      const d = I18N.t('Chat/Command/' + c + '/Description', '');
      if (d) this._pushHintLine('/' + c + (a ? ' ' + a : ''), d);
      else this._sys('Chat/Command/Unknown');
    } else {
      for (const n of this._allCommands()) {
        const a = I18N.t('Chat/Command/' + n + '/Args', '');
        const d = I18N.t('Chat/Command/' + n + '/Description', '');
        this._pushHintLine('/' + n + (a ? ' ' + a : ''), d);
      }
    }
  },
  _rotSpeed(v) {
    const n = parseFloat(v);
    if (!isFinite(n) || n < 0 || n > 1) { this._sys('Chat/Command/RotSpeed/Usage'); return; }
    ROT_SCALE = n;
    this._sys(I18N.tf('Chat/Command/RotSpeed/Set', { 0: n }, 'Petal rotation speed set to ' + n + '.'));
  },
  _printPlayers() {
    const p = (this._net && this._net.server && this._net.server.player) || null;
    const name = (p && p.name) ? p.name : 'Guest';
    this._sys(I18N.tf('Chat/Command/PrintPlayers', { 0: name + ' (you)' }, 'Players near you: ' + name + ' (you)'));
  },
  _unblock(name) {
    if (!name) { this._sys('Chat/Command/Unknown'); return; }
    this.blocked = this.blocked || new Set();
    if (this.blocked.delete(name)) this._sys(I18N.tf('Chat/Command/Unblocked', { 0: name }, 'Unblocked ' + name + '.'));
    else this._sys(I18N.tf('Chat/Command/NotBlocked', { 0: name }, name + ' is not blocked.'));
  },
  _unblockAll() {
    this.blocked = this.blocked || new Set();
    this.blocked.clear();
    this._sys('Chat/Command/UnblockedAll');
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
      whisper: ev.kind === 'whisper',
      channel: ev.channel || this.channel,
      target: ev.target || null,
      from: ev.from || null,
      text: ev.text,
      // 系统消息的 text 是 i18n key（如 'Chat/Alone'），普通消息的 text 就是原文
      label: ev.kind === 'sys' ? I18N.t(ev.text, ev.text) : ev.text,
      born: performance.now()
    };
    this.history.push(msg);
    this.float.push(msg);
    // 漂浮态只保留最近若干条，避免堆满屏幕（/help 会一次性产生较多行，故上限放宽）
    while (this.float.length > 30) this.float.shift();
    if (this.inputMode) this._renderLog();
  },

  // ---- 渲染 ----
  // 输入态：完整历史（登入以来全部可见消息），超出高度出滚动条
  _renderLog() {
    const log = this.refs.log;
    log.textContent = '';
    if (!this.history.length) { log.style.display = 'none'; return; }   // 无历史：不显示空白信息栏
    log.style.display = '';
    for (const m of this.history) log.appendChild(this._line(m));
    log.scrollTop = log.scrollHeight;      // 始终滚到最新
    log.style.maxHeight = CHAT_MAX_H + 'px';
  },
  _line(m) {
    // 帮助/指令行：与指令提示同格式（一个半透明栏：黄色指令 + 白色介绍）
    if (m.hint) {
      const h = document.createElement('div');
      h.className = 'chat-hint';
      const c1 = document.createElement('span'); c1.className = 'chat-hint-cmd'; c1.textContent = m.cmd;
      const c2 = document.createElement('span'); c2.className = 'chat-hint-desc'; c2.textContent = m.desc ? '  ' + m.desc : '';
      h.appendChild(c1); h.appendChild(c2);
      return h;
    }
    const d = document.createElement('div');
    d.className = 'chat-line' + (m.sys ? ' sys' : (m.whisper ? ' whisper' : ''));
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
    if (m.whisper) {
      // 密语行：[@自己 -> @对象]（发出）；收到方向 [@对象 -> @自己]（单机暂无）
      const me = this._selfName();
      tag.textContent = m.from ? ('[@' + m.from + ' -> @' + me + ']') : ('[@' + me + ' -> @' + (m.target || '') + ']');
      tag.style.color = SCOPE_COLORS.whisper;
      d.appendChild(tag);
      const tx = document.createElement('span');
      tx.className = 'chat-text';
      tx.textContent = m.text;
      d.appendChild(tx);
      return d;
    }
    tag.textContent = '[' + this._scopeName(m.channel) + ']';
    tag.style.color = SCOPE_COLORS[m.channel] || CHAT_NAME_COLOR;
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
