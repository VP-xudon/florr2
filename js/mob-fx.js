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

const MobFX = {
  defs: {},        // slug -> 物种特性声明
  fields: {},      // kind -> 场地实体种类（怎么造）
  _projectileSeq: 1,

  async prepareAssets() {
    if (this._assetsReady) return true;
    const response = await fetch('assets/mobs/11.svg?v=' + ASSET_VER);
    if (!response.ok) throw new Error('Hornet SVG load failed: ' + response.status);
    const raw = await response.text();
    // 11.svg 顶部保留着旧版（已注释）：先剥掉，否则解析出来是空的
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
      // 尾针（前两个 path）的包围盒：它的中心就是"尾针应该挂的位置"——
      // 【运行时从素材测出来】，不写任何偏移常量；素材一改自动跟随。
      // 尾针是前两个 path（三角形 + 带圆头的一根），取它们的【合并包围盒】
      const ps = measure.lastElementChild.querySelectorAll('path');
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = 0; k < Math.min(2, ps.length); k++) {
        const q = ps[k].getBBox();
        x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y);
        x1 = Math.max(x1, q.x + q.width); y1 = Math.max(y1, q.y + q.height);
      }
      tailBox = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
    } catch (e) { bb = null; }
    measure.remove();
    if (bb && tailBox) {
      const winW = Math.max(bb.w, bb.h);
      const ccx = bb.x + bb.w / 2, ccy = bb.y + bb.h / 2;
      // 尾针【尖端】= 尾针包围盒离贴图中心最远的角（11.svg 里 = (99.6,99.6)）
      const tipDx = Math.max(
        Math.abs(tailBox.cx - tailBox.w / 2 - ccx), Math.abs(tailBox.cx + tailBox.w / 2 - ccx));
      const tipDy = Math.max(
        Math.abs(tailBox.cy - tailBox.h / 2 - ccy), Math.abs(tailBox.cy + tailBox.h / 2 - ccy));
      this.hornetTail = {
        // 尾针【中心】挂点（贴图中心 -> 尾针中心）
        off: Math.hypot(tailBox.cx - ccx, tailBox.cy - ccy) / winW,
        // 尾针【尖端】挂点（贴图中心 -> 尾针尖端）—— 用于与 9.svg 的尖端对齐
        tipOut: Math.hypot(tipDx, tipDy) / winW,
        size: Math.max(tailBox.w, tailBox.h) / winW
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
    // 【不 await】：prepareAssets 若阻塞在某个素材上，boot 的 loading 蒙版永远不撤
    // —— 表现就是整个游戏"停摆"。素材加载完会自动可用，晚一两帧毫无影响。
    SpriteStore.load('mob11_empty', serialize(emptyRoot));
    // Bumble Bee 尾部产出的 Pollen 走【生物实体】链路（有碰撞箱/红闪/退场/F3），
    // 所以要把 Pollen 花瓣的素材也注册进 SpriteStore 的 mob 键空间，否则它既画不出来、
    // 也提取不到轮廓（mobHitTest 直接返回 null -> 打不到玩家、花瓣也打不到它）。
    const pollen = (typeof PETAL_TYPES !== 'undefined')
      ? PETAL_TYPES.find((t) => t && t.slug === 'pollen') : null;
    if (pollen && pollen.svg != null) {
      SpriteStore.load('mobpollen', 'assets/petals/' + pollen.svg + '.svg?v=' + ASSET_VER);
    }
    // Wax 是落位实体：首次 draw 时 artCanvas 会返回 null（异步加载），
    // 表现为"装备后第一帧什么都不显示"。这里统一预热，保证一落地就能画出来。
    // 【碰撞箱只算身体】Hornet(11) / Bumble Bee(27)：把触角（stroke path）从素材里删掉，
    // 生成一份"只有中间椭圆身体"的素材，碰撞轮廓改用它 —— 触角不该撑大碰撞箱。
    for (const id of ['11', '27']) {
      try {
        const res = await fetch('assets/mobs/' + id + '.svg?v=' + ASSET_VER);
        if (!res.ok) continue;
        const txt = await res.text();
        let src = txt;
        const close = src.indexOf('-->');
        if (src.trim().startsWith('<!--') && close >= 0) src = src.slice(close + 3).trim();
        const doc2 = parser.parseFromString(src, 'image/svg+xml');
        const root2 = doc2.documentElement;
        const g2 = root2.querySelector('g') || root2;
        let removed = 0;
        for (const node of Array.from(g2.children)) {
          if (node.localName !== 'path') continue;
          const d = node.getAttribute('d') || '';
          // 触角 = 没有 fill（fill="none"）+ 有 stroke 的细线
          const isAntenna = node.getAttribute('stroke') && node.getAttribute('fill') === 'none';
          // 尾针 = fill #333 且紧贴右下角（Hornet 专属，x/y 都 > 70）
          const isTail = node.getAttribute('fill') === '#333'
            && /^M9[0-9.]+\s+9[0-9.]+/.test(d.trim());
          if (isAntenna || isTail) { node.remove(); removed++; }
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
          SpriteStore.load('mob' + id + '_body',
            'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(root2)));
        }
      } catch (e) { /* 失败就退回整张图，不影响游戏 */ }
    }
    // 9.svg：运行时测"画布中心 -> 尖端"的比例（d 是小写 m + 相对 lineto，必须累计）。
    // 挂点公式：off = drawSize×tail.tipOut − size×tipBack
    //   = 让 9.svg 画出来的尖端正好落在 11.svg 尾针尖端的位置。
    try {
      const r9 = await fetch('assets/petals/9.svg?v=' + ASSET_VER);
      if (r9.ok) {
        let s9 = await r9.text();
        const c9 = s9.indexOf('-->');
        if (s9.trim().startsWith('<!--') && c9 >= 0) s9 = s9.slice(c9 + 3).trim();
        const d9 = parser.parseFromString(s9, 'image/svg+xml');
        const svg9 = document.importNode(d9.documentElement, true);
        svg9.style.cssText = 'position:absolute;left:-9999px;top:0';
        document.body.appendChild(svg9);
        const p9 = svg9.querySelectorAll('path');
        if (p9.length) {
          const bb9 = svg9.getBBox();
          const sw9 = parseFloat(p9[0].getAttribute('stroke-width') || '0') / 2;
          const win9 = Math.max(bb9.width + sw9 * 2, bb9.height + sw9 * 2);
          const nums = (p9[0].getAttribute('d') || '').match(/-?\d+(?:\.\d+)?/g) || [];
          const tr = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/.exec(s9) || null;
          const ox = tr ? parseFloat(tr[1]) : 0, oy = tr ? parseFloat(tr[2]) : 0;
          const mx = bb9.x + bb9.width / 2, my = bb9.y + bb9.height / 2;
          let px = 0, py = 0, tip = 0;
          for (let i = 0; i + 1 < nums.length; i += 2) {
            const a = parseFloat(nums[i]), b = parseFloat(nums[i + 1]);
            if (i === 0) { px = a; py = b; } else { px += a; py += b; }
            tip = Math.max(tip, Math.hypot(px + ox - mx, py + oy - my));
          }
          this.missileTipBack = tip / win9;
        }
        svg9.remove();
      }
    } catch (e) { /* 测量失败 -> 挂点用中心，影响只是一点视觉偏差 */ }

    const wax = (typeof PETAL_TYPES !== 'undefined')
      ? PETAL_TYPES.find((t) => t && t.slug === 'wax') : null;
    if (wax && wax.svg != null && typeof CardRenderer !== 'undefined') {
      CardRenderer.artCanvas(wax.svg, 128);
    }
    this._assetsReady = true;
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
    return {
      shape: crb || null,
      collSize: crb ? (mob.drawSize * (this.hornetTail ? this.hornetTail.size : 0.3)) : 0,
      artRot: 0,
      id: mob.netId + ':missile:' + (this._projectileSeq++),
      parentId: mob.netId, x: mob.x, y: mob.y, facing: mob.facing + Math.PI,
      vx: 0, vy: 0, hp: stats.missileHp || 1, maxHp: stats.missileHp || 1,
      dmg: stats.missileDmg || 0, armor: mob.armor, life: stats.missileDur || 2,
      age: 0, hurtT: 0, flight: false, dead: false, exiting: false,
      radius: mob.drawSize * 0.12,
      // 视觉尺寸随【母体稀有度】固定：发射前挂在尾巴上、发射后在飞，都是同一个实体。
      // 尺寸比例来自素材实测（hornetTail），prepareAssets 没跑完时用 0.3 兜底。
      drawSize: (this.hornetTail ? mob.drawSize * this.hornetTail.size : mob.drawSize * 0.3)
        // 与挂载态同尺寸：发射前后是同一个实体
    };
  },

  initMob(mob) {
    const def = this.defOf(mob);
    if (def && def.init) def.init(mob);
  },

  // 尾针受击【统一入口】：不区分"挂在尾巴上"还是"飞出去"——
  // 发射前后是同一个实体对象（只切 flight 标记），受击结算必须一视同仁。
  // 旧实现只认 st.missile（挂载态），发射后移进 projectiles 的那枚完全打不到。
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

  // 兼容旧签名（挂载态）
  hitMissile(mob, damage) {
    return this.hurtStinger(mob, mob && mob.hornet && mob.hornet.missile, damage);
  },

  // 尾针挂点（唯一来源，绘制 / tick / F3 全读它）：
  //   ① 先让 9.svg 的尖端落在 11.svg 尾针尖端的位置（尖端对齐）
  //   ② 再沿"尾巴方向"向本体中心收 0.5×尾针长度（用户口径：更贴近身体）
  hornetTailOffset(mob, size) {
    const ht = this.hornetTail;
    if (!ht) return mob.drawSize * 0.39;
    return mob.drawSize * ht.tipOut - (this.missileTipBack || 0) * size - size * 0.5;
  },

  // 尾针在【世界坐标】里的位置与朝向（唯一来源：绘制 / 服务端 tick / F3 全用它）。
  //   纵向：沿尾巴方向 hornetTailOffset（尖端对齐后再向本体中心收 0.5×长度）
  //   横向：以"头朝上"为基准向左平移 0.4×宽度（用户口径）——
  //         尾巴方向 tailA 的 +90° 就是"本体的左侧"，对任意朝向都成立。
  hornetTailPoint(mob, size) {
    const tailA = mob.facing + Math.PI;
    const off = this.hornetTailOffset(mob, size);
    const latA = tailA + Math.PI / 2;
    const lat = size * 0.4;
    return {
      x: mob.x + Math.cos(tailA) * off + Math.cos(latA) * lat,
      y: mob.y + Math.sin(tailA) * off + Math.sin(latA) * lat,
      a: tailA
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

  drawMissile(ctx, missile, size, alpha) {
    if (!missile || (missile.dead && !missile.exiting)) return;
    MobFX.drawMissileAt(ctx, missile, missile.x, missile.y,
      missile.facing || 0, size, alpha);
  },

  // 在【指定位置/朝向】画一枚导弹（同一张素材、同一个尖端角）：
  //   · 挂载在尾巴上时用本体的姿态；
  //   · 飞出去后用实体自己的坐标与朝向。
  // 受伤红闪与其它实体同一套（红色蒙层），不再是"贴图不会闪"。
  drawMissileAt(ctx, missile, x, y, facing, size, alpha) {
    if (!missile || (missile.dead && !missile.exiting)) return;
    // 【挂载态不做出生渐显】：它一直贴着本体，本体自己已经有出场动画了。
    // 客户端视图不走 tick，missile.age 恒为 0 -> spawnFade(0)=0 -> 尾针永远全透明，
    // 这就是"发射前的 Missile 不显示"的第二个原因。
    // 挂载态：入场动画跟【本体】走（missile.age 在客户端恒为 0，用它就永远透明）；
    // 飞行态：用自己的 age（发射那一刻开始渐显）。
    const attached = !missile.flight;
    let scale = spawnPop(attached ? (missile.hostAge || missile.age || 0) : (missile.age || 0));
    let a = (alpha == null ? 1 : alpha)
      * spawnFade(attached ? (missile.hostAge || missile.age || 0) : (missile.age || 0));
    if (missile.exiting) {
      scale *= ExitFX.scale(missile);
      a = ExitFX.alpha(missile);
    }
    // 【矢量】优先：128px 位图放大到高稀有度尺寸会糊成"千疮百孔"的一团
    const art = CardRenderer.artImage('9') || CardRenderer.artCanvas('9', 128);
    if (!art) return;
    // 尖端始终对准朝向（挂载/飞行同一条口径）；位置由素材实测的挂点决定。
    drawPetalArt(ctx, art, size * scale, x, y, facing - MISSILE_TIP_ANGLE, 1, a);
    // 红闪：与所有实体共用 EntityFX.drawHurt（同一时长、同一强度）
    if (EntityFX.hurtAlpha(missile) > 0) {
      ctx.save();
      ctx.globalAlpha = a;
      EntityFX.drawHurt(ctx, missile, x, y, size * 0.32 * scale);
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

  // 冷却：按区间随机（单位 tick，1 秒 = 25 tick）
  _ultDelay(u) {
    const cd = (u && u.cooldownTicks) || MOB_ULT_COOLDOWN_TICKS;
    return rand(cd[0], cd[1]) * MOB_TICK_S;
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
  // 大招结束：客户端补一张"看起来一样的"场地实体（服务端已权威生成，这里只是画面镜像）
  clientEnd(view, ctx) {
    if (!view) return null;
    const u = this.ultimateOf(view);
    if (!u || !u.field) return null;
    const f = this.fields[u.field.kind];
    if (!f || !f.create) return null;
    const ent = f.create(view, u.field, ctx);
    if (ent && ctx && ctx.addWeb) ctx.addWeb(ent);
    return ent;
  },
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
      pop: 0,
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
    const st = mob.hornet;
    // 【快照优先】真实游戏里客户端视图是 _applySnap 重建的：它自带的 hornet.missile
    // 永远是"刚生成、未发射"的占位对象，如果用它就会一直画挂载尾针（发射后也不消失）。
    // 权威状态在 mob.hornetMissile（服务端每帧下发）；只有完全没收到快照时
    //（离屏/刚创建）才回退到占位对象。
    const snap = mob.hornetMissile;
    // 【this 陷阱】这个 draw 是 register('hornet', {...}) 的注册对象方法，
    // MobFX.drawMob 用 def.draw(...) 调它 —— this 是 def，不是 MobFX。
    // 之前写成 this.hornetTail 恒为 undefined -> `if (!ht) return`
    // -> 挂载尾针【永远不画】；而发射出去的那枚由 game.js 直接调
    // MobFX.drawMissile（不经过 def.draw）所以能看见。这正是用户看到的现象。
    const ht = MobFX.hornetTail;
    if (!ht) return;                      // 素材几何还没测好（前一两帧），下一帧自动出现
    // 不再合成"假尾针"占位：没有实体就不画。发射后服务端把 st.missile 移进
    // projectiles，快照的 hornetMissile 变 null，客户端视图的占位也会同步清掉。
    const missile = snap || (st && st.missile);
    if (!missile || (missile.dead && !missile.exiting)) return;
    // 已经发射：挂载态尾针不再画（飞出去的那枚由 hornetProjectiles 独立绘制）
    if (missile.flight) return;
    // 入场动画跟本体：客户端视图的 missile.age 恒为 0，用它就永远透明
    missile.hostAge = mob.age || 0;
    const size = missile.drawSize || (mob.drawSize * ht.size);
    if (!missile.exiting) {
      // 挂在尾巴上：位置每帧由本体姿态推出（客户端视图不走 tick 也能跟随）。
      // 偏移/尺寸按【11.svg 源码】重新推导（viewBox 0 0 110 110，中心 (55,55)）：
      //   尾针三角形 (96.896,96.896) (84.64,75.447) (75.447,84.64)
      //   -> 质心 (85.66, 85.66)，距中心 43.36 = 0.394×视口；尖端 59.25 = 0.539×视口
      //   三角形斜边长 24.7 = 0.225×视口
      // 取"尾针中心 = 0.394×视口、画幅 = 0.29×视口"。
      // 【换算到 drawSize】：drawSize 对应的是 SpriteStore 的【裁剪窗口】，不是 viewBox 110；
      // 直接拿 0.394×drawSize 会让尾针比素材里更靠近身体中心（表现就是"整体右偏"）。
      // k = 110 / 窗口宽，把"视口比例"换成"裁剪框比例"。
      // 挂点 = 尖端对齐：让 9.svg 画出来的尖端正好落在 11.svg 尾针尖端的位置。
      //   off = drawSize×tipOut(本体侧实测) − size×tipBack(尾针素材侧实测)
      // 两个量都来自素材 getBBox，没有任何手写常数。
      const p = MobFX.hornetTailPoint(mob, size);
      MobFX.drawMissileAt(ctx, missile, p.x, p.y, p.a, size, alpha);
      return;
    }
    MobFX.drawMissile(ctx, missile, size, alpha);
  },
  init(mob) {
    mob.hornet = { mode: 'approach', missile: MobFX.createMissile(mob), projectiles: [], spinT: 0, launchAngle: 0, reloadT: 0 };
  },
  tick(mob, dt) {
    const st = mob.hornet || (mob.hornet = { mode: 'wander', missile: null, projectiles: [], spinT: 0, launchAngle: 0, reloadT: 0 });
    // 射击冷却：只影响"能不能开下一枪"，不影响走位与瞄准回转
    if (st.cooldown > 0) st.cooldown = Math.max(0, st.cooldown - dt);
    if (st.missile) {
      const missile = st.missile;
      if (missile.exiting) {
        ExitFX.tick(missile, dt);
        if (ExitFX.done(missile)) st.missile = null;
      }
      missile.age += dt;
      missile.hurtT = Math.max(0, missile.hurtT - dt);
      if (!missile.flight && !missile.exiting) {
        // 与 def.draw 用同一个挂点函数：F3 / 受击判定 / 绘制位置三者永远一致
        const sz = missile.drawSize || mob.drawSize * ((MobFX.hornetTail && MobFX.hornetTail.size) || 0.3);
        const pt = MobFX.hornetTailPoint(mob, sz);
        missile.x = pt.x;
        missile.y = pt.y;
        missile.facing = pt.a;
      }
    } else if (mob.ai.hornetMode === 'reload') {
      st.reloadT += dt;
      if (st.reloadT >= 0.5) {
        st.missile = MobFX.createMissile(mob);
        mob.ai.hornetMode = 'approach';
        st.reloadT = 0;
      }
    }
  },
  step(mob, dt, player) {
    const st = mob.hornet || (mob.hornet = { mode: 'wander', missile: null, projectiles: [], spinT: 0, launchAngle: 0, reloadT: 0 });
    const spinRate = TAU * 3;
    if (st.spinPhase === 'return') {
      // 射击完【转身面对玩家】（用户口径）：目标 = 发射角（尾针指向玩家的反方向 +π 即面对玩家）
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
    // ---- 距离控制（用户口径）----
    // 只有【近到射击距离的 20%】才会后撤；而且一撤就撤到标准射击距离，
    // 后撤速度 = 1.10× 玩家最高速（比平时的追击/游荡都快）。其余情况一律按原速移动。
    if (st.retreat) {
      if (d >= desiredRange) st.retreat = false;
    } else if (d < desiredRange * 0.2) {
      st.retreat = true;
    }
    if (st.retreat) {
      mob.ai.hornetMode = 'retreat';
      const sp = 1.1 * PLAYER_BASE_SPEED;
      return { x: -dx / d * sp, y: -dy / d * sp };
    }
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
