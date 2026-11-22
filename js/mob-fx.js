// ============================================================================
// 生物通用特性引擎（MobFX）
//
// 与 PetalFX（花瓣能力引擎）完全对称：
//   PetalFX 决定"花瓣能做什么"，MobFX 决定"生物能做什么"。
//
// 【为什么必须有它】
// 新增一种生物特性（目前是大招）天然横跨 4 个层：
//   引擎调度 js/ai.js  /  实体状态 js/sim/mob.js  /
//   场地产出 js/net/server.js  /  客户端表现 js/game.js
// 之前每一层都写死了蜘蛛的参数（圈数 / 步态速率 / 网半径倍数），于是：
//   · 加第二个物种的大招要同时改 4 个文件；
//   · 漏掉一层就是"服务端招放出来了、客户端毫无反应"这类半截 bug。
// 现在：物种只在 MobFX.register('slug', {...}) 里【声明】一次，四层全部改成"向 MobFX 问"。
//       新增物种的大招 = 加一条 register，不动任何一层。
//
// 【声明格式】
//   MobFX.register('spider', {
//     ultimate: {
//       minRarity: 'super',            // 稀有度门槛（Super 及以上才有大招）
//       cooldownTicks: [1000, 1500],   // 冷却区间（1 秒 = 25 tick → 40~60 秒）
//       duration: 4.5,                 // 大招时长（秒）
//       hold: true,                    // 大招期间定在原地（且不参与推挤）
//       spin: { rate: 4.18879 },       // 自转角速度（rad/s，3 秒 2 圈 = TAU×2/3）
//       gaitRate: 8,                   // 大招期间补步态（它不走位，腿要摆动就得补）
//       field: { kind: 'web', mul: 2 }  // 结束产出：一张 2 倍半径的蛛网
//     }
//   });
//
// 引擎【不认识】具体物种，也不认识具体场地实体：
//   · 场地实体种类也走注册（MobFX.registerField('web', {...})），
//     服务器只提供"怎么造"的原语（ctx），知识留在引擎里。
//   · 想加新物种 / 新场地种类，都只是加一条 register。
// ============================================================================

// ---- Hornet 尾针挂点常量（素材 11.svg）----
// 飞针画的是花瓣 9 的素材："底边中点 -> 尖端"的长度归一化到它自己的素材窗口 = 0.8223。
// 尾针绘制尺寸按它换算：size = 尾针长度 / (MISSILE_DART_LEN × 素材窗口单位)，
// 于是画出来的飞针和贴图里那截尾针【一样长】。
const MISSILE_DART_LEN = 0.82230;
// SpriteStore 裁剪比例尚未标定时的兜底（与 _cropRatio 的标定值一致）
const HORNET_TAIL_CROP_FALLBACK = 0.99602;
// 素材解析失败时的兜底挂点 —— 与 11.svg 解析出来的【同一组数】：
//   dx=dy=(85.49−55)/(0.99602×110)=0.2783、axis=45°、size=23.833/(0.99602×110)/0.8223=0.2645。
// 这样无论素材何时就绪，第一枚与之后每一枚尾针的位置/大小都完全一致
//（旧兜底是 0.45/0/0.3，和解析值差了 60%，表现为"发射一次后新针变小又跑位"）。
const HORNET_TAIL_FALLBACK = { dx: 0.27829, dy: 0.27829, axis: Math.PI / 4, size: 0.26454 };

const MobFX = {
  defs: {},        // slug -> 物种特性声明
  fields: {},      // kind -> 场地实体种类（怎么造）
  _projectileSeq: 1,

  async prepareAssets() {
    // 已就绪且 hornetTail 已有值，无需重复
    if (this._assetsReady && this.hornetTail) return true;
    // 先设兜底：确保即使下面精确解析失败，尾针也能显示（不缺失、不全透明）
    this._assetsReady = true;
    this.hornetTail = this.hornetTail || HORNET_TAIL_FALLBACK;
    // fetch 必须自带超时：Loading 现在会等 prepareAssets 真正跑完，不能让一次卡住的请求挂死蒙版。
    const fetchText = async (url, ms = 10000) => {
      const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), ms) : 0;
      try {
        const r = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
        return r.ok ? await r.text() : null;
      } catch (e) { return null; }
      finally { if (timer) clearTimeout(timer); }
    };
    try {
    const raw = await fetchText('assets/mobs/11.svg?v=' + ASSET_VER);
    if (!raw) throw new Error('Hornet SVG load failed');
    // 11.svg 顶部有一段注释，解析前先剥掉
    let source = raw;
    const cmt = source.indexOf('-->');
    if (source.trim().startsWith('<!--') && cmt >= 0) source = source.slice(cmt + 3).trim();
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'image/svg+xml');
    const root = doc.documentElement;
    const group = root.querySelector('g');
    const paths = group ? Array.from(group.children).filter((node) => node.localName === 'path') : [];
    if (!group || paths.length < 2) throw new Error('Hornet tail paths not found');
    // 【关键】去掉尾针后必须保持【原裁剪窗口不变】，否则 11_empty 会按更小的内容框
    // 重新居中 —— 本体被放大、而尾针位置还按原图算，两者坐标系错位
    //（表现就是"尾针偏后 / 偏内"）。这里补一个不可见矩形占住原内容框。
    const measure = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    measure.setAttribute('viewBox', root.getAttribute('viewBox') || '0 0 110 110');
    measure.setAttribute('width', '200'); measure.setAttribute('height', '200');
    measure.style.cssText = 'position:absolute;left:-9999px;top:0';
    measure.appendChild(document.importNode(root, true));
    document.body.appendChild(measure);
    let bb = null;
    let tailBox = null;
    try {
      const b = measure.lastElementChild.getBBox();
      bb = { x: b.x, y: b.y, w: b.width, h: b.height };
      // 尾针 = 【第 1 个 path】那枚三角形（"M96.896 96.896 84.64 75.447l-9.193 9.193z"）：
      //   尖端 P0（离贴图中心最远的点）+ 底边两点 P1/P2。
      // 第 2 个 path 是同一位置的描边细节（形状更大），不能与三角形合并求包围盒，
      // 否则中心被带偏、挂点与尺寸都会错。直接解析三角形的三个顶点：
      //   · 挂点（针与身体相连处）= 底边中点
      //   · 轴向 = 挂点 -> 尖端
      //   · 长度 = |尖端 - 挂点|（导弹本体的可见长度）
      const svgPathPoints = (d) => {
        const out = [];
        const re = /([MmLlHhVv])\s*([-\d.eE+\s]*)/g;
        let m, cmd = 'M', x = 0, y = 0;
        while ((m = re.exec(d || ''))) {
          const c = m[1];
          const a = (m[2].match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || []).map(Number);
          if (c === 'M' || c === 'm') {
            for (let i = 0; i + 1 < a.length; i += 2) {
              if (c === 'M') { x = a[i]; y = a[i + 1]; } else { x += a[i]; y += a[i + 1]; }
              out.push([x, y]);                       // 每一对坐标都入队（三角形 3 个顶点都要）
            }
            cmd = (c === 'M') ? 'L' : 'l';
          } else if (c === 'L' || c === 'l') {
            for (let i = 0; i + 1 < a.length; i += 2) {
              if (c === 'L') { x = a[i]; y = a[i + 1]; } else { x += a[i]; y += a[i + 1]; }
              out.push([x, y]);
            }
          } else if (c === 'H' || c === 'h') {
            for (const v of a) { x = (c === 'H') ? v : x + v; out.push([x, y]); }
          } else {
            for (const v of a) { y = (c === 'V') ? v : y + v; out.push([x, y]); }
          }
        }
        return out;
      };
      const ps = measure.lastElementChild.querySelectorAll('path');
      const tri = (ps[0] ? svgPathPoints(ps[0].getAttribute('d') || '') : []);
      if (tri.length >= 3) {
        const ccx0 = bb ? (bb.x + bb.w / 2) : 55, ccy0 = bb ? (bb.y + bb.h / 2) : 55;
        let tip = tri[0], bestD = -1;
        for (const q of tri) {
          const d = Math.hypot(q[0] - ccx0, q[1] - ccy0);
          if (d > bestD) { bestD = d; tip = q; }
        }
        const rest = tri.filter((q) => q !== tip);
        const m0 = rest[0], m1 = rest[1] || rest[0];
        const mx = (m0[0] + m1[0]) / 2, my = (m0[1] + m1[1]) / 2;   // 底边中点 = 与身体的连接面
        // 尾针的【可见分块】= 第 1 个 path（实心三角）+ 第 2 个 path（同一位置的描边细节）。
        // 挂点取并集包围盒的中心：只取三角形会让挂点偏向三角形的重心。
        let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        for (const node of [ps[0], ps[1]]) {
          if (!node || !node.getBBox) continue;
          const q = node.getBBox();
          bx0 = Math.min(bx0, q.x); by0 = Math.min(by0, q.y);
          bx1 = Math.max(bx1, q.x + q.width); by1 = Math.max(by1, q.y + q.height);
        }
        if (!(bx1 > bx0)) { bx0 = Math.min(tip[0], m0[0], m1[0]); bx1 = Math.max(tip[0], m0[0], m1[0]); }
        if (!(by1 > by0)) { by0 = Math.min(tip[1], m0[1], m1[1]); by1 = Math.max(tip[1], m0[1], m1[1]); }
        tailBox = {
          cx: (bx0 + bx1) / 2, cy: (by0 + by1) / 2,
          tipX: tip[0], tipY: tip[1],
          baseX: mx, baseY: my,
          len: Math.hypot(tip[0] - mx, tip[1] - my)
        };
      }
    } catch (e) { bb = null; }
    measure.remove();
    if (bb && tailBox) {
      // 【坐标口径】必须是 drawMob 的【固定比例裁剪框】(cropRatio × viewBox)，不是内容包围盒：
      // drawSize 对应的就是那个裁剪框。用内容包围盒归一化会把挂点放大 20%+，
      // 尾针看起来就"飘在身体外面"（旧版就是这个 bug）。
      const vbArr = (root.getAttribute('viewBox') || '0 0 110 110')
        .trim().split(/[\s,]+/).map(Number);
      const vbW = vbArr[2] || 110, vbH = vbArr[3] || 110;
      const vbCx = (vbArr[0] || 0) + vbW / 2, vbCy = (vbArr[1] || 0) + vbH / 2;
      const ratio = (typeof SpriteStore !== 'undefined' && SpriteStore._cropRatio)
        ? (SpriteStore._cropRatio() || HORNET_TAIL_CROP_FALLBACK)
        : HORNET_TAIL_CROP_FALLBACK;
      const drawWin = ratio * vbW;               // 1 × drawSize 对应的素材单位
      // 挂点 = "贴图中心 -> 尾针中心"（按向量记录，绘制时随精灵旋转）
      const dx = (tailBox.cx - vbCx) / drawWin;
      const dy = (tailBox.cy - vbCy) / drawWin;
      // 尺寸：让画出来的飞针和贴图里的尾针【一样长】。
      // 飞针素材（花瓣 9）里"底边中点 -> 尖端"的长度 = MISSILE_DART_LEN（归一化到它自己的窗口），
      // 所以 size = 尾针长度 / (MISSILE_DART_LEN × 窗口单位)。
      const size = (tailBox.len / drawWin) / MISSILE_DART_LEN;
      this.hornetTail = {
        dx, dy,
        axis: Math.atan2(tailBox.tipY - tailBox.baseY, tailBox.tipX - tailBox.baseX),
        size
      };
    }
    // 素材解析失败时给一个兜底向量：与上面解析出来的【同一组数】，
    // 这样无论素材早晚就绪，第一枚与之后每一枚尾针的位置/大小都完全一致。
    if (!this.hornetTail) {
      this.hornetTail = {
        dx: HORNET_TAIL_FALLBACK.dx, dy: HORNET_TAIL_FALLBACK.dy,
        axis: HORNET_TAIL_FALLBACK.axis, size: HORNET_TAIL_FALLBACK.size
      };
    }

    const emptyRoot = root.cloneNode(true);
    const emptyGroup = emptyRoot.querySelector('g');
    Array.from(emptyGroup.children).filter((node) => node.localName === 'path').slice(0, 2)
      .forEach((node) => node.remove());
    if (bb) {
      const keep = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      keep.setAttribute('x', bb.x); keep.setAttribute('y', bb.y);
      keep.setAttribute('width', bb.w); keep.setAttribute('height', bb.h);
      keep.setAttribute('fill', 'none'); keep.setAttribute('stroke', 'none');
      emptyGroup.appendChild(keep);
    }
    const serialize = (node) => 'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(node));
    // 派生素材必须等真正解码好：否则 Hornet 首帧会退回整张贴图（尾针显示两遍）。
    await SpriteStore.load('mob11_empty', serialize(emptyRoot));
    // Bumble Bee 尾部产出的 Pollen 走【生物实体】链路（有碰撞箱/红闪/退场/F3），
    // 所以要把 Pollen 花瓣的素材也注册进 SpriteStore 的 mob 键空间，否则它既画不出来、
    // 也提取不到轮廓（mobHitTest 直接返回 null -> 打不到玩家、花瓣也打不到它）。
    const pollen = (typeof PETAL_TYPES !== 'undefined')
      ? PETAL_TYPES.find((t) => t && t.slug === 'pollen') : null;
    if (pollen && pollen.svg != null) {
      await SpriteStore.load('mobpollen', 'assets/petals/' + pollen.svg + '.svg?v=' + ASSET_VER);
    }
    // Wax 等落位实体的素材需要预热：artCanvas 异步构建期间返回 null，
    // 预热可保证首次绘制即可显示。
    // 【碰撞箱只算身体】Hornet(11) / Bumble Bee(27)：把触角（stroke path）从素材里删掉，
    // 生成一份"只有中间椭圆身体"的素材，碰撞轮廓改用它 —— 触角不该撑大碰撞箱。
    for (const id of ['11', '27']) {
      try {
        const txt = await fetchText('assets/mobs/' + id + '.svg?v=' + ASSET_VER);
        if (!txt) continue;
        let src = txt;
        const close = src.indexOf('-->');
        if (src.trim().startsWith('<!--') && close >= 0) src = src.slice(close + 3).trim();
        const doc2 = parser.parseFromString(src, 'image/svg+xml');
        const root2 = doc2.documentElement;
        const g2 = root2.querySelector('g') || root2;
        // 身体的【填充路径】集合：用来区分"触角/腿"和"身体自己的描边"——
        // 两者都是 fill="none" + stroke，唯一的区别是后者的 d 与某条身体路径完全相同。
        // 旧规则把所有 fill="none" 的描边一律当触角删掉，于是蜜蜂身体那圈 4.167 宽的
        // 描边被一起删了 —— 碰撞箱比画面小一圈（用户口径："忽略了描边"）。
        // 尾针 = fill #333 且紧贴右下角（Hornet / Bee 的尾刺，x/y 都 > 70）。
        // 它和它的描边都不属于身体，也不能进 bodyDs（否则它的描边会被当成"身体描边"留下）。
        const isTail = (node) => node.getAttribute('fill') === '#333'
          && /^M9[0-9.]+\s+9[0-9.]+/.test((node.getAttribute('d') || '').trim());
        const bodyDs = new Set();
        for (const node of Array.from(g2.children)) {
          if (node.localName !== 'path' || isTail(node)) continue;
          const f = node.getAttribute('fill');
          if (f && f !== 'none') bodyDs.add((node.getAttribute('d') || '').trim());
        }
        let removed = 0;
        for (const node of Array.from(g2.children)) {
          if (node.localName !== 'path') continue;
          const d = node.getAttribute('d') || '';
          // 身体描边：d 与身体填充路径一致 -> 保留（它才是画面最外沿）
          const isBodyOutline = node.getAttribute('fill') === 'none'
            && bodyDs.has(d.trim());
          // 触角 = 没有 fill（fill="none"）+ 有 stroke 的细线（且不是身体描边）
          const isAntenna = node.getAttribute('stroke') && node.getAttribute('fill') === 'none'
            && !isBodyOutline;
          if (isAntenna || isTail(node)) { node.remove(); removed++; }
        }
        if (removed > 0) {
          // 与 11_empty 同理：补一个不可见矩形占住原内容框，
          // 保证"碰撞素材"和"本体素材"用【同一个裁剪窗口】——
          // 否则碰撞轮廓会按更小的框重新居中，半径偏大、与画面对不上。
          const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          wrap.setAttribute('viewBox', root2.getAttribute('viewBox') || '0 0 110 110');
          wrap.setAttribute('width', '200'); wrap.setAttribute('height', '200');
          wrap.style.cssText = 'position:absolute;left:-9999px;top:0';
          const probe = document.importNode(root2, true);
          wrap.appendChild(probe);
          document.body.appendChild(wrap);
          let bb2 = null;
          try {
            const b2 = probe.getBBox();
            bb2 = { x: b2.x, y: b2.y, w: b2.width, h: b2.height };
          } catch (e) { bb2 = null; }
          wrap.remove();
          if (bb2) {
            const keep2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            keep2.setAttribute('x', bb2.x); keep2.setAttribute('y', bb2.y);
            keep2.setAttribute('width', bb2.w); keep2.setAttribute('height', bb2.h);
            keep2.setAttribute('fill', 'none'); keep2.setAttribute('stroke', 'none');
            g2.appendChild(keep2);
          }
          await SpriteStore.load('mob' + id + '_body',
            'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(root2)));
        }
      } catch (e) { /* 失败就退回整张图，不影响游戏 */ }
    }
    // 尾针位置只用 11.svg 的向量（hornetTail.dx/dy/axis），
    // 不再需要 9.svg 的"尖端超出量"—— 那层补偿已被证明会把尾针推进身体。

    const wax = (typeof PETAL_TYPES !== 'undefined')
      ? PETAL_TYPES.find((t) => t && t.slug === 'wax') : null;
    if (wax && wax.svg != null && typeof CardRenderer !== 'undefined') {
      CardRenderer.artCanvas(wax.svg, 128);
    }
    this._assetsReady = true;
    return true;
    } catch (e) {
      console.warn('[MobFX] prepareAssets failed, using fallback hornetTail:', e);
      this.hornetTail = this.hornetTail || HORNET_TAIL_FALLBACK;
      this._assetsReady = true;
    }
    return true;
  },

  // ---------------- 注册 ----------------
  register(slug, def) {
    this.defs[slug] = def || {};
    return this.defs[slug];
  },

  createMissile(mob) {
    const stats = (mob.type.rarityStats && mob.type.rarityStats[mob.rarity]) || {};
    // 尾针也是实体：碰撞箱同样来自硬编码 .crb（11_missile），
    // 走与生物/花瓣完全相同的 shape/collSize 接口，F3 才能画出一致的轮廓。
    const crb = (typeof CRB !== 'undefined' && CRB.get) ? CRB.get('11_missile') : null;
    const missile = {
      shape: crb || null,
      collSize: crb ? (mob.drawSize * (this.hornetTail ? this.hornetTail.size : 0.3)) : 0,
      artRot: 0,
      id: mob.netId + ':missile:' + (this._projectileSeq++),
      parentId: mob.netId, x: mob.x, y: mob.y, facing: mob.facing + Math.PI,
      vx: 0, vy: 0, hp: stats.missileHp || 1, maxHp: stats.missileHp || 1,
      dmg: stats.missileDmg || 0, armor: mob.armor, life: stats.missileDur || 2,
      flight: false, dead: false,
      radius: mob.drawSize * 0.12,
      // 视觉尺寸随【母体稀有度】固定：发射前挂在尾巴上、发射后在飞，都是同一个实体。
      drawSize: (this.hornetTail ? mob.drawSize * this.hornetTail.size : mob.drawSize * 0.3)
        // 与挂载态同尺寸：发射前后是同一个实体
    };
    // 尾针也是完整实体：出场/退场/红闪统一由引擎维护。
    EntityFX.spawn(missile, 'projectile');
    return missile;
  },

  initMob(mob) {
    const def = this.defOf(mob);
    if (def && def.init) def.init(mob);
  },

  // 尾针受击唯一入口：发射前后是同一个实体对象（只切 flight 标记），
  // 挂载态与飞行态都必须能被打到。
  hurtStinger(mob, missile, damage) {
    if (!missile || missile.dead || missile.exiting || !(damage > 0)) return 0;
    const applied = Math.min(damage, missile.hp);
    missile.hp -= applied;
    EntityFX.hurt(missile);                 // 统一红闪时长/强度
    if (missile.hp <= 0) {
      missile.hp = 0;
      missile.dead = true;
      EntityFX.despawn(missile);
      const st = mob && mob.hornet;
      if (st) {
        if (st.missile === missile) st.missile = null;
        st.reloadT = 0;
      }
      if (mob && mob.ai) mob.ai.hornetMode = 'reload';
    }
    return applied;
  },

  // 尾针在【世界坐标】里的位置与朝向（唯一来源：绘制 / 服务端 tick / F3 全用它）。
  // 做法：把素材里"贴图中心 -> 尾针中心"这个【向量】按精灵自身的旋转角旋转。
  //   · 精灵旋转角 = facing + artRot（与 drawMob 画本体时完全同一个角）
  //   · 于是尾针落在素材画的那个位置；头朝上时该向量恰好指向正下方，
  //     横向分量为 0 —— 不存在"横向偏移"这个参数，也就不会再偏。
  //   · 朝向 = 同一旋转角 + 素材里尾针的中轴角。
  hornetTailPoint(mob, size) {
    const ht = this.hornetTail;
    const rot = mob.facing + (mob.artRot || 0);
    const c = Math.cos(rot), s = Math.sin(rot);
    const lx = (ht ? ht.dx : 0) * mob.drawSize;
    const ly = (ht ? ht.dy : 0) * mob.drawSize;
    return {
      x: mob.x + lx * c - ly * s,
      y: mob.y + lx * s + ly * c,
      a: rot + (ht ? ht.axis : 0),
      size
    };
  },

  registerField(kind, def) {
    this.fields[kind] = def || {};
    return this.fields[kind];
  },
  defOf(mob) {
    const slug = mob && mob.type && mob.type.slug;
    return (slug && this.defs[slug]) || null;
  },
  artSvgOf(mob) {
    const def = this.defOf(mob);
    if (!def) return null;
    if (def.artSvgOf) return def.artSvgOf(mob) || null;
    return def.artSvg || null;
  },
  facingLocked(mob) {
    const def = this.defOf(mob);
    return !!(def && def.facingLocked && def.facingLocked(mob));
  },

  stepMob(mob, dt, player) {
    const def = this.defOf(mob);
    return def && def.step ? def.step(mob, dt, player) : null;
  },

  tickMob(mob, dt, player) {
    const def = this.defOf(mob);
    if (def && def.tick) def.tick(mob, dt, player);
  },

  drawMob(ctx, mob) {
    const def = this.defOf(mob);
    if (def && def.draw) def.draw(ctx, mob, mob._drawScale || 1, mob._drawAlpha == null ? 1 : mob._drawAlpha);
  },

  // 物种自绘的【叠加层】：在实体本体画完之后调用（局部坐标，已含引擎的入场缩放/透明度）。
  // 与 draw 的区别：draw 在【身体之下】（Hornet 尾针挂在那儿），drawOver 在【身体之上】——
  // 兵蚁的翅膀/小牙要盖在身体上又要独立摆动，只能走这一层。引擎依旧不认识具体物种。
  drawOver(ctx, mob) {
    const def = this.defOf(mob);
    if (def && def.drawOver) def.drawOver.call(def, ctx, mob);
  },

  drawMissile(ctx, missile, size, alpha) {
    if (!missile || (missile.dead && !missile.exiting)) return;
    MobFX.drawMissileAt(ctx, missile, missile.x, missile.y,
      missile.facing || 0, size, alpha);
  },

  // 在【指定位置/朝向】画一枚导弹（同一张素材、同一个尖端角）：
  //   · 挂载在尾巴上时用本体的姿态；
  //   · 飞出去后用实体自己的坐标与朝向。
  // 受伤红闪与其它实体同一套（红色蒙层），不再是"贴图不会闪"。
  drawMissileAt(ctx, missile, x, y, facing, size, parentAlpha) {
    if (!missile || (missile.dead && !missile.exiting)) return;
    // 【唯一实体引擎】入场 Q 弹、退场放大渐隐、红闪全部读导弹自己的状态：
    // 挂载态与飞行态是同一条曲线（装载好的新针会像其它实体一样弹出，不再"凭空出现"）。
    const fx = EntityFX.visual(missile);
    const a = (parentAlpha == null ? 1 : parentAlpha) * fx.alpha;
    // 【矢量】优先：128px 位图放大到高稀有度尺寸会糊成"千疮百孔"的一团
    const art = CardRenderer.artImage('9') || CardRenderer.artCanvas('9', 128);
    if (!art) return;
    // 尖端始终对准朝向（挂载/飞行同一条口径）；位置由素材实测的挂点决定。
    drawPetalArt(ctx, art, size * fx.scale, x, y, facing - MISSILE_TIP_ANGLE, 1, a);
    // 红闪：【碰撞箱形状】—— 碰撞箱来自硬编码 CRB（11_missile），归一化坐标以
    // 【素材窗口中心】为原点，所以必须套用与贴图完全相同的变换
    //（平移到 (x,y) → 旋转 facing - 尖端角 → 缩放 size）再填多边形。
    // 客户端快照不带 shape 字段，这里直接查同一份离线 CRB；
    // 缺失时才退回圆 —— 挂载态 / 飞行态 / F3 因此永远是同一个轮廓。
    const hurtA = EntityFX.hurtAlpha(missile);
    if (hurtA > 0) {
      const crb = missile.shape
        || ((typeof CRB !== 'undefined' && CRB.get) ? CRB.get('11_missile') : null);
      const sc = (missile.collSize || size) * fx.scale;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x, y);
      ctx.rotate(facing - MISSILE_TIP_ANGLE);
      EntityFX.drawHurtShape(ctx, missile, 0, 0,
        (crb && crb.pts) || null, sc, size * 0.32 * fx.scale);
      ctx.restore();
    }
  },

  // ---------------- 大招：稀有度门槛 ----------------
  // 口径：只有 Super 及以上（Super / Eternal）稀有度才可能有大招。
  ultimateOf(mob) {
    const d = this.defOf(mob);
    const u = d && d.ultimate;
    if (!u) return null;
    const order = (typeof RARITY_ORDER !== 'undefined') ? RARITY_ORDER : null;
    if (!order) return null;
    const min = u.minRarity || 'super';
    const ri = order.indexOf(mob.rarity);
    const mi = order.indexOf(min);
    if (ri < 0 || mi < 0 || ri < mi) return null;
    return u;
  },

  // 冷却：按区间随机（单位 tick，1 tick = SNAP_DT 秒）
  _ultDelay(u) {
    const cd = (u && u.cooldownTicks) || MOB_ULT_COOLDOWN_TICKS;
    return rand(cd[0], cd[1]) * SNAP_DT;
  },

  // ---------------- 大招状态机（调度 + 通用表现）----------------
  // 返回 null = 本帧不接管（普通 AI 继续跑）；返回向量 = 大招接管中。
  stepUltimate(mob, dt) {
    const u = this.ultimateOf(mob);
    if (!u) return null;
    const ai = mob.ai;
    if (ai.ultActive) {
      ai.ultT += dt;
      let out = { x: 0, y: 0 };
      if (u.during) {
        out = u.during(ai, dt, mob) || out;        // 物种自定义行为（优先于通用表现）
      } else {
        // 通用表现 1：自转。朝向由大招驱动，此时不能被"朝向跟随移动方向"覆盖。
        if (u.spin) {
          const rate = u.spin.rate;
          mob.facing = wrapAngle(mob.facing + rate * dt);
          ai.ultSpin = (ai.ultSpin || 0) + rate * dt;
        }
        // 通用表现 2：补步态。它不走位，步态不会自然推进，腿要摆动只能按固定速率补。
        if (u.gaitRate) mob.gait += u.gaitRate * dt;
      }
      if (ai.ultT >= (ai.ultDur || 0)) {
        ai.ultActive = false;
        this._endUltimate(mob, u);
        ai.ultCd = this._ultDelay(u);               // 重新武装下一次大招
      }
      return out;
    }
    // 冷却中：首次延迟也按同样的区间随机（各生物不同步，不会齐刷刷一起放）
    ai.ultCd = (ai.ultCd == null) ? this._ultDelay(u) : ai.ultCd - dt;
    if (ai.ultCd > 0) return null;
    // 到点：起手
    ai.ultActive = true;
    ai.ultT = 0;
    ai.ultDur = (typeof u.duration === 'function') ? u.duration(ai, mob) : (u.duration || 1);
    this._startUltimate(mob, u);
    return { x: 0, y: 0 };
  },

  _startUltimate(mob, u) {
    mob.ultActive = true;
    if (u.hold) mob.ultHold = { x: mob.x, y: mob.y };   // 定在原地（引擎每帧把它按回锚点）
    mob.ai.ultSpin = 0;
    if (u.start) u.start(mob.ai, mob);
  },

  _endUltimate(mob, u) {
    mob.ultActive = false;
    if (u.hold) mob.ultHold = null;
    if (u.field) {
      // 产出【请求】交给服务端权威生成（客户端只做画面镜像）——
      // 谁被减速必须由服务端说了算，客户端不能自己造一张有减速效果的网。
      mob.ultFieldReq = { kind: u.field.kind, mul: u.field.mul, dur: u.field.dur };
    }
    if (u.end) u.end(mob.ai, mob);
  },

  // ---------------- 各层向引擎查询（不写死物种）----------------
  // 大招期间的定住锚点（没有大招 = null）
  holdOf(mob) { return (mob && mob.ultHold) || null; },
  // 大招期间要补的步态速率（腿继续摆动）
  gaitRateOf(mob) {
    const u = this.ultimateOf(mob);
    return (u && u.gaitRate) || 0;
  },

  // ---------------- 场地实体产出（服务端权威）----------------
  // ctx = { webType(), addWeb(ent), webDur() } —— 服务器提供的原语
  produceField(mob, req, ctx) {
    if (!req) return null;
    const f = this.fields[req.kind];
    if (!f || !f.create) return null;
    const ent = f.create(mob, req, ctx);
    if (!ent) return null;
    if (ctx && ctx.addWeb) ctx.addWeb(ent);
    return ent;
  },

  // ---------------- 客户端镜像（表现，不是逻辑）----------------
  // 大招进行中：腿继续摆（服务端权威的 ultActive，客户端只补表现）
  clientTick(view, dt) {
    if (!view || !view.ultActive) return;
    const rate = this.gaitRateOf(view);
    if (rate) view.gait += rate * dt;
  },
  // 大招结束时的客户端表现：不需要做任何事 —— 大招产出的场地实体（超大蛛网）
  // 由服务端生成并随快照下发，客户端只渲染（见 _applySnap 的 webs 差分）。
};

// ============================================================================
// 场地实体种类：蛛网（蜘蛛自铺的网 / 蜘蛛大招产出的超大网）
// 半径口径 = 【该稀有度对应的 Web 花瓣半径】× 倍率（倍率 1 = 普通网）
// ============================================================================
MobFX.registerField('web', {
  radius(mob, req, ctx) {
    const wt = ctx && ctx.webType ? ctx.webType() : null;
    const base = wt ? (petalStatsFor(wt, mob.rarity).radius || 120) : 120;
    return Math.round(base * (req.mul || 1));
  },
  create(mob, req, ctx) {
    return {
      x: mob.x, y: mob.y,
      r: this.radius(mob, req, ctx),
      t: 0,
      dur: (req.dur != null) ? req.dur : (ctx && ctx.webDur ? ctx.webDur() : 10),
    };
  },
});

// ============================================================================
// 物种声明：蜘蛛（Super / Eternal 大招）
//   · 定在原地不动，原地自转：3 秒 2 圈；
//   · 自转期间八条腿一起摆动（它不走位，步态不会自然推进，按固定速率补）；
//   · 自转满 3 圈（约 4.5 秒）后在原地生成一张【半径 = 同等级蛛网 × 2】的超大蛛网；
//   · 放完立刻恢复正常 AI（引擎在 end 之后重新武装下一次冷却）。
// ============================================================================
MobFX.register('spider', {
  ultimate: {
    minRarity: 'super',
    cooldownTicks: [1000, 1500],                        // 1000~1500 tick = 40~60 秒（1 秒 = 25 tick）
    // 3 圈 ÷ (2 圈 / 3 秒) = 4.5 秒
    duration: SPIDER_ULT_TURNS / SPIDER_ULT_TURNS_PER_SEC,
    hold: true,                                        // 定在原地（且不参与推挤）
    spin: { rate: TAU * SPIDER_ULT_TURNS_PER_SEC },     // 3 秒 2 圈
    gaitRate: MOB_ULT_GAIT_RATE,                       // 腿继续摆动
    field: { kind: 'web', mul: SPIDER_ULT_WEB_MUL },   // 2 倍半径的超大蛛网
  },
});

MobFX.register('hornet', {
  // 本体永远用【去掉尾针】的贴图：尾针不是画死在图里的，而是一个跟随的子实体
  //（见 draw）。这样发射前后是同一个实体、同一张素材、同一尺寸，不会"一发射就变样"。
  artSvgOf(mob) {
    return '11_empty';
  },
  facingLocked(mob) {
    const phase = mob.hornet && mob.hornet.spinPhase;
    return phase === 'aim' || phase === 'return';
  },
  // 尾针（Missile 子实体）绘制：挂载时按本体姿态算位置，飞出去后按自身坐标画。
  // 两者用【同一张素材、同一个尺寸、同一个尖端角】，所以观感完全连续。
  draw(ctx, mob, scale, alpha) {
    // 只画【快照里的那一个实体】：客户端不持有自己的占位尾针（见 init），
    // 所以"挂载态"与"飞行态"永远是同一个 id 的同一份状态。
    const missile = mob.hornetMissile;
    if (!missile || (missile.dead && !missile.exiting)) return;
    // 已经发射：挂载态尾针不再画（飞出去的那枚由 hornetProjectiles 独立绘制）
    if (missile.flight) return;
    const ht = MobFX.hornetTail || { dx: 0.45, dy: 0, axis: 0, size: 0.3 };
    const size = missile.drawSize || (mob.drawSize * ht.size);
    // 挂在尾巴上：位置每帧由本体姿态推出（客户端视图不走 tick 也能跟随）。
    // p.a 已经是【最终旋转角】（含素材尖端方向补偿），drawMissileAt 内部再抵消
    // 素材默认朝向，所以直接传 p.a。
    const p = MobFX.hornetTailPoint(mob, size);
    // 入场/退场/红闪全部由导弹自己的 EntityFX 状态驱动（与飞行态同一套曲线），
    // 本体只提供一个透明度倍率（本体退场时尾针跟着淡出）。
    MobFX.drawMissileAt(ctx, missile, p.x, p.y, p.a, size, alpha);
  },
  init(mob) {
    // 【不在构造时预生成尾针】：客户端视图也会走这里，预生成就会凭空多出一个
    // "占位尾针"实体（与快照镜像并存 = 两个实体，正是用户看到的幽灵碰撞箱）。
    // 真正的尾针由服务端 tick 在第一次需要时创建，客户端只镜像 hornetMissile。
    mob.hornet = {
      mode: 'approach', missile: null, projectiles: [], spinT: 0,
      launchAngle: 0, reloadT: 0, cooldown: 0
    };
  },
  tick(mob, dt) {
    const st = mob.hornet || (mob.hornet = {
      mode: 'wander', missile: null, projectiles: [], spinT: 0,
      launchAngle: 0, reloadT: 0, cooldown: 0
    });
    // 射击冷却：只影响"能不能开下一枪"，不影响走位与瞄准回转
    if (st.cooldown > 0) st.cooldown = Math.max(0, st.cooldown - dt);
    // 【针生成：独立于 hornetMode】无论什么模式，只要没有挂载态针且冷却已结束，
    // 就立即在尾巴位置生成新针——避免 step 把 hornetMode 改成 'wander' 后
    // 针再也不生成、Hornet 原地游荡的情况。
    const hasLiveMissile = st.missile && !st.missile.dead && !st.missile.exiting;
    if (!hasLiveMissile && st.cooldown <= 0) {
      st.missile = MobFX.createMissile(mob);
      // 新针必须出现在【尾巴】位置，而不是本体中心，保证每根针发射前位置一致。
      const sz = st.missile.drawSize || mob.drawSize * ((MobFX.hornetTail && MobFX.hornetTail.size) || 0.3);
      const pt = MobFX.hornetTailPoint(mob, sz);
      st.missile.x = pt.x;
      st.missile.y = pt.y;
      st.missile.facing = pt.a;
    } else if (st.missile) {
      const missile = st.missile;
      // 统一实体引擎推进（age / hurtT / 退场计时），回收只看 EntityFX.done
      EntityFX.tickEntity(missile, dt);
      if (EntityFX.done(missile)) st.missile = null;
      if (!missile.flight && !missile.exiting) {
        // 与 def.draw 用同一个挂点函数：F3 / 受击判定 / 绘制位置三者永远一致
        const sz = missile.drawSize || mob.drawSize * ((MobFX.hornetTail && MobFX.hornetTail.size) || 0.3);
        const pt = MobFX.hornetTailPoint(mob, sz);
        missile.x = pt.x;
        missile.y = pt.y;
        missile.facing = pt.a;
      }
    }
  },
  step(mob, dt, player) {
    const st = mob.hornet || (mob.hornet = {
      mode: 'wander', missile: null, projectiles: [], spinT: 0,
      launchAngle: 0, reloadT: 0, cooldown: 0
    });
    const spinRate = TAU * 3;
    if (st.spinPhase === 'return') {
      // 射击后转身面对玩家：目标角 = 发射角 + π（尾针指向玩家）
      const back = MobAI._util.angNorm(wrapAngle(st.launchAngle) - mob.facing);
      const step = Math.sign(back) * Math.min(Math.abs(back), spinRate * dt);
      mob.facing = wrapAngle(mob.facing + step);
      if (Math.abs(back) <= spinRate * dt) st.spinPhase = null;
      return { x: 0, y: 0 };
    }
    if (st.spinPhase === 'aim' || st.spinPhase === 'hold') {
      // ① 完全转向：把本体转到"尾巴正对玩家"的角度（不是转一半就开火）
      if (st.spinPhase === 'aim') {
        const turn = MobAI._util.angNorm(st.aimFacing - mob.facing);
        const step = Math.sign(turn) * Math.min(Math.abs(turn), spinRate * dt);
        mob.facing = wrapAngle(mob.facing + step);
        if (Math.abs(turn) > spinRate * dt) return { x: 0, y: 0 };
        st.spinPhase = 'hold';
        st.holdT = 0;
      }
      // ② 停住 0.3s：让尾部那枚实体尾针稳稳指向玩家（0.2~0.4s 口径）
      st.holdT = (st.holdT || 0) + dt;
      if (st.holdT < HORNET_AIM_HOLD) return { x: 0, y: 0 };
      // ③ 发射：用的就是原来挂在尾部的【同一个实体】，只切 flight 标记
      const missile = st.missile;
      if (missile && !missile.dead && !missile.exiting) {
        const speed = 1.3 * PLAYER_BASE_SPEED;
        missile.flight = true;
        missile.facing = st.launchAngle;
        missile.vx = Math.cos(st.launchAngle) * speed;
        missile.vy = Math.sin(st.launchAngle) * speed;
        missile.life = (mob.type.rarityStats[mob.rarity] || {}).missileDur || 2;
        (st.projectiles || (st.projectiles = [])).push(missile);
        st.missile = null;
        mob.ai.hornetMode = 'reload';
        st.reloadT = 0;
        const cds = mob.type.shootCd || null;
        st.cooldown = (cds && cds[mob.rarity] != null) ? cds[mob.rarity] : 3;
        st.retreat = false;
      }
      // ④ 完全转回原朝向
      st.spinPhase = 'return';
      return { x: 0, y: 0 };
    }
    if (st.missile && st.missile.exiting) return { x: 0, y: 0 };
    const tgt = mob.topThreat();
    if (!tgt || !mob.canSee(tgt)) {
      mob.ai.hornetMode = 'wander';
      return MobAI.defs.bee.step(mob.ai, dt, mob, player);
    }
    const dx = tgt.x - mob.x, dy = tgt.y - mob.y;
    const d = Math.hypot(dx, dy) || 1;
    const desiredRange = Math.max(220, mob.drawSize * 1.8) * HORNET_RANGE_K;
    // ---- 距离控制：不做近身后撤 ----
    // Hornet 只做两件事：超出射程直线追击，进入射程停下转向瞄准。
    // 追击速度 = 0.95 × 玩家最高速（MOB_TRAITS.hornet.chaseMult）。
    if (d > desiredRange + 12) {
      mob.ai.hornetMode = 'approach';
      return { x: dx / d * mob.chaseSpeed, y: dy / d * mob.chaseSpeed };
    }
    // 导弹还在装填 / 射击冷却没好：原地等，不瞄也不射
    if (!st.missile || st.missile.exiting || st.missile.dead) {
      mob.ai.hornetMode = 'reload';
      return { x: 0, y: 0 };
    }
    if (st.cooldown > 0) {
      mob.ai.hornetMode = 'cooldown';
      return { x: 0, y: 0 };
    }
    if (Math.hypot(mob.vx || 0, mob.vy || 0) > 8) {
      mob.ai.hornetMode = 'stop';
      return { x: 0, y: 0 };
    }
    if (!st.spinPhase) {
      const ri = RARITY_ORDER.indexOf(mob.rarity);
      const lead = ri >= RARITY_ORDER.indexOf('epic') ? clamp(d / Math.max(1, PLAYER_BASE_SPEED * 1.3), 0, 0.7) : 0;
      const px = tgt.x + (tgt.vx || 0) * lead;
      const py = tgt.y + (tgt.vy || 0) * lead;
      st.launchAngle = Math.atan2(py - mob.y, px - mob.x);
      st.baseFacing = mob.facing;
      st.aimFacing = wrapAngle(st.launchAngle - Math.PI);
      st.spinPhase = 'aim';
      mob.ai.hornetMode = 'aim';
    }
    return { x: 0, y: 0 };
  },
});

// ============================================================================
// 物种声明：蚂蚁家族（Soldier / Worker / Baby Ant）
//   三者共用 `AntArt` 的那一套【外观分层】：身体 = 两层静图，翅膀与小牙在中层单独摆动
//   （每秒 1.5 个来回、三物种同一挥幅）。只有素材与轮廓键不同，所以这里只是一个循环。
//   碰撞箱由 Mob._ensureShape 的 bodyKey（mob<id>_body = 只有身体）负责。
//   自然生成 / 召唤物是【同一个物种、同一套东西】：召唤物由 _spawnSummon 挂 followEnt，
//   野生的没有 followEnt → 跟随逻辑自动不生效；阵营交给 registry 的 type 决定
//   （Soldier = Hostile 追人，Worker = Neutral、Baby = Passive 不主动追）。
// ============================================================================
for (const antSlug of ['soldier_ant', 'worker_ant', 'baby_ant', 'queen_ant']) {
  MobFX.register(antSlug, {
    // 底层身体（翅膀之下）；素材没就绪时返回 null -> 退回整张贴图（静止的小牙，先说能看）
    // 【顺带在这里启动解析】：artSvgOf 每只生物构造时调一次，是唯一不依赖 AI/绘制时机的入口，
    // 碰撞箱要等 mob<id>_body 这张图就绪后才会建立（见 Mob._ensureShape）。
    artSvgOf(mob) {
      const r = (typeof AntArt !== 'undefined') ? AntArt.of(mob) : null;
      if (r && !r.mid) AntArt.ensure(r.slug);
      return (r && r.mid) ? r.baseKey.replace(/^mob/, '') : null;
    },
    drawOver(ctx, mob) {
      if (typeof AntArt !== 'undefined') AntArt.drawOver(ctx, mob);
    },
    init(mob) {
      // 尽早开始解析素材：碰撞箱要等 mob<id>_body 这张图就绪后才建立（见 _ensureShape）
      if (typeof AntArt !== 'undefined') AntArt.ensure(mob && mob.type && mob.type.slug);
    },
  });
}
