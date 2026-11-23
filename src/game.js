/* ============================================================
   暗线 · 鲸选
   ruleset_id: AX-KX-01 · 单文件离线原型
   ============================================================ */
(function () {
  'use strict';

  var A = window.ASSETS || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  };
  var svg = function (id, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#' + id + '"></use></svg>';
  };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ---------------- 配置（规则与内容同源） ---------------- */
  var CFG = {
    ruleset: 'AX-KX-01',
    domain: 'kestrel.1947',
    invite: 'K7',
    slot: 'K-07',
    city: '布宜诺斯艾利斯',
    time: '07:40',
    /* 暗门入口：不认地址栏，只认「四件、按评语次序」的自提单 */
    cartOrder: ['d1', 'd2', 'd5', 'd8'],
    batch: '1947'
  };

  var COPY = {
    note: '____.lertsek\n。上签价的莺夜在位四后\n。的看人给是才，话的里子镜',
    b64: 'U0hJUFBJTkc=',
    morse: '—·—  ——···',
    domain: 'kestrel.1947',
    invite: 'K7'
  };

  /* ---------------- 应用 ---------------- */
  var APPS = {
    chat: { name: '黑匣子', title: '黑匣子 · 频道 03', icon: 'i-chat', glyph: 'dark', w: 392, h: 570, x: 26, y: 52 },
    mall: { name: '鲸选商城', title: '鲸选商城 · 离线镜像', icon: 'i-whale', glyph: 'mall', w: 1040, h: 712, x: 438, y: 22 },
    tool: { name: '解码器', title: '解码器 · 烛台工具箱', icon: 'i-key', glyph: 'tool', w: 478, h: 618, x: 64, y: 118 },
    notes: { name: '线索本', title: '线索本 · N-17', icon: 'i-note', glyph: 'dark', w: 438, h: 626, x: 512, y: 86 }
  };

  /* ---------------- 状态 ---------------- */
  var S = {
    run: 0,
    started: false,
    t0: 0, tEnd: 0,
    sound: true,
    zTop: 20,
    wins: {},
    lastReply: 0,
    flags: {},
    clues: [],
    chat: [],
    clock: { h: 3, m: 12, s: 0 },
    ledgerPrompted: false,
    startOpen: false
  };

  var M = { route: 'home', hist: ['home'], idx: 0, img: 1, folded: false, src: false, cart: [], batch: '', svc: { topic: '', threads: {} } };
  var T = { tab: 'b64' };
  var N = { tab: 'task' };
  var K = { busy: false, attempts: 0 };

  function resetFlags() {
    return {
      mission: false, sampleFound: false, noteRead: false, priceSeen: false,
      noticeRead: false, foldedSeen: false, shippingKnown: false, channelOpen: false,
      kestrelOpen: false, ledgerSeen: false, cartReady: false, reported: false, ending: null
    };
  }

  /* ---------------- 声音 ---------------- */
  var AC = null;
  function audio() {
    if (!S.sound) return null;
    try {
      if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
      return AC;
    } catch (e) { return null; }
  }
  function tone(freq, dur, type, gain, slideTo) {
    var ac = audio(); if (!ac) return;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.value = gain == null ? 0.03 : gain;
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur);
  }
  function sfx(kind) {
    if (!S.sound) return;
    if (kind === 'open') tone(660, .05, 'sine', .02);
    else if (kind === 'recv') { tone(440, .07, 'sine', .028); setTimeout(function () { tone(620, .09, 'sine', .022); }, 70); }
    else if (kind === 'send') tone(920, .04, 'triangle', .02);
    else if (kind === 'err') { tone(180, .16, 'sawtooth', .022, 120); }
    else if (kind === 'ok') { tone(520, .1, 'sine', .03); setTimeout(function () { tone(700, .1, 'sine', .028); }, 100); setTimeout(function () { tone(940, .16, 'sine', .024); }, 200); }
    else if (kind === 'wind') { tone(320, .08, 'triangle', .018, 200); }
  }

  /* ---------------- 时间 ---------------- */
  function nowStr() { return pad(S.clock.h) + ':' + pad(S.clock.m); }
  function tickClock() {
    S.clock.s++;
    if (S.clock.s >= 60) { S.clock.s = 0; S.clock.m++; }
    if (S.clock.m >= 60) { S.clock.m = 0; S.clock.h = (S.clock.h + 1) % 24; }
    var c = $('#tbClock'); if (c) c.innerHTML = '<span>' + nowStr() + '</span><small>2026/11/19 周四</small>';
  }

  /* ---------------- 提示与线索 ---------------- */
  function addClue(id, title, body) {
    for (var i = 0; i < S.clues.length; i++) if (S.clues[i].id === id) return;
    S.clues.push({ id: id, title: title, body: body, t: nowStr() });
    if (N.tab === 'clue') renderNotesBody();
        }
  /* v2.5 起停用：右下角提示条不再弹出。函数留空壳，避免散落的调用点改坏控制流。 */
  function toast() {}

  function objectives() {
    var f = S.flags;
    return [
      { id: 'notice', label: '在公告里找到旧货架的去向', done: f.noticeRead },
      { id: 'b64', label: '解出公告里那串字母', done: f.shippingKnown },
      { id: 'src', label: '在页面源码里找到拆掉的通道脚本', done: f.channelOpen },
      { id: 'cart', label: '按评语次序把四件日用品放进购物车', done: f.cartReady },
      { id: 'door', label: '结算自提单，进 S07 归档区', done: f.kestrelOpen },
      { id: 'note', label: '翻出样品底板上的刻字', done: f.noteRead },
      { id: 'ledger', label: '用盘点口令调出交接单', done: f.ledgerSeen },
      { id: 'report', label: '向老鸦上报 K-07', done: f.reported }
    ];
  }

  function checkObjectives(prev) {
    var list = objectives();
    var done = list.filter(function (o) { return o.done; }).length;
    if (prev != null && done !== prev) toast('案卷更新', '已完成 ' + done + ' / ' + list.length + ' 项', '');
    if (N.tab === 'task') renderNotesBody();
       }

  /* ============================================================
     窗口系统
     ============================================================ */
  function chromeHTML(id) {
    var a = APPS[id];
    return '<div class="titlebar" data-drag>' +
      '<div class="appicon">' + svg(a.icon) + '</div>' +
      '<div class="title"><b>' + a.title + '</b></div>' +
      '<div class="wbtns">' +
      '<button class="wbtn" data-act="min" title="最小化">' + svg('i-min') + '</button>' +
      '<button class="wbtn" data-act="max" title="最大化">' + svg('i-max') + '</button>' +
      '<button class="wbtn close" data-act="close" title="关闭">' + svg('i-close') + '</button>' +
      '</div></div><div class="wbody"></div><div class="resize-grip" data-resize></div>';
  }

  function openApp(id) {
    var cfg = APPS[id];
    if (!cfg || cfg.hidden) return;
    var rec = S.wins[id];
    if (!rec) {
      var vw = window.innerWidth, vh = window.innerHeight - 52;
      var w = Math.min(cfg.w, vw - 16), h = Math.min(cfg.h, vh - 16);
      var x = Math.max(6, Math.min(cfg.x == null ? (vw - w) / 2 : cfg.x, vw - w - 6));
      var y = Math.max(6, Math.min(cfg.y == null ? (vh - h) / 2 : cfg.y, vh - h - 6));
      var el = document.createElement('div');
      el.className = 'win'; el.dataset.app = id;
      el.style.cssText = 'width:' + w + 'px;height:' + h + 'px;left:' + x + 'px;top:' + y + 'px;';
      el.innerHTML = chromeHTML(id);
      $('#winLayer').appendChild(el);
      rec = S.wins[id] = { el: el, min: false, max: false };
      bindWin(el, id);
      renderApp(id, $('.wbody', el));
    }
    rec.min = false;
    rec.el.classList.remove('min');
    focusWin(id);
    syncTaskbar();
    sfx('open');
  }

  function focusWin(id) {
    var rec = S.wins[id]; if (!rec) return;
    rec.el.style.zIndex = ++S.zTop;
    S.winsOrder = id;
  }

  function closeApp(id) {
    var rec = S.wins[id]; if (!rec) return;
    rec.el.remove(); delete S.wins[id];
    syncTaskbar();
  }

  function bindWin(el, id) {
    el.addEventListener('pointerdown', function () { focusWin(id); }, true);
    var bar = $('.titlebar', el);
    if (bar) bar.addEventListener('pointerdown', startDrag);
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]');
      if (!t || !el.contains(t)) return;
      onAct(id, t.dataset.act, t, e);
    });
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.shiftKey) return;
      var t = e.target;
      if (!t || !t.matches('input,textarea')) return;
      if (id === 'chat' && t.matches('[data-chat-input]')) { e.preventDefault(); sendChat(t.value); }
      if (id === 'mall' && t.matches('[data-svc-input]')) { e.preventDefault(); svcSend(); }
      if (id === 'mall' && t.matches('[data-dark-code]')) { e.preventDefault(); darkEnter(); }
    });
    var grip = $('[data-resize]', el);
    if (grip) grip.addEventListener('pointerdown', startResize);
  }

  function startDrag(e) {
    if (e.button !== 0 || e.target.closest('.wbtn')) return;
    var bar = e.currentTarget;
    var el = bar.parentElement;
    if (el.classList.contains('max')) return;
    var r = el.getBoundingClientRect();
    var ox = e.clientX - r.left, oy = e.clientY - r.top;
    el.style.zIndex = ++S.zTop;
    function mv(ev) {
      var x = Math.max(-el.offsetWidth + 90, Math.min(ev.clientX - ox, window.innerWidth - 90));
      var y = Math.max(0, Math.min(ev.clientY - oy, window.innerHeight - 52 - 44));
      el.style.left = x + 'px'; el.style.top = y + 'px';
    }
    function up() {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    e.preventDefault();
  }

  function startResize(e) {
    if (e.button !== 0) return;
    var el = e.currentTarget.parentElement;
    if (el.classList.contains('max')) return;
    var w0 = el.offsetWidth, h0 = el.offsetHeight, x0 = e.clientX, y0 = e.clientY;
    function mv(ev) {
      var w = Math.max(320, Math.min(w0 + ev.clientX - x0, window.innerWidth - el.offsetLeft - 4));
      var h = Math.max(220, Math.min(h0 + ev.clientY - y0, window.innerHeight - 52 - el.offsetTop - 4));
      el.style.width = w + 'px'; el.style.height = h + 'px';
    }
    function up() {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    e.preventDefault(); e.stopPropagation();
  }

  function onAct(id, act, el, e) {
    if (act === 'min') {
      var rec = S.wins[id];
      if (rec) { rec.min = true; rec.el.classList.add('min'); }
      syncTaskbar(); return;
    }
    if (act === 'max') {
      var r2 = S.wins[id];
      if (r2) { r2.max = !r2.max; r2.el.classList.toggle('max', r2.max); }
      return;
    }
    if (act === 'close') { closeApp(id); return; }

    if (id === 'chat') return chatAct(act, el);
    if (id === 'mall') return mallAct(act, el);
    if (id === 'tool') return toolAct(act, el);
    if (id === 'notes') return notesAct(act, el);
    if (act === 'nolink') { toast('镜像', el.dataset.msg || '镜像只读。', ''); }
  }

  function renderApp(id, body) {
    if (id === 'chat') renderChatApp(body);
    else if (id === 'mall') renderMallApp(body);
    else if (id === 'tool') renderToolApp(body);
    else if (id === 'notes') renderNotesApp(body);
  }

  /* ============================================================
     桌面 / 任务栏 / 开始菜单
     ============================================================ */
  function renderDesktopIcons() {
    var box = $('#deskIcons'); if (!box) return;
    var order = ['mall', 'chat', 'tool', 'notes'];
    box.innerHTML = order.filter(function (id) { return APPS[id] && !APPS[id].hidden; }).map(function (id) {
      var a = APPS[id];
      return '<div class="dicon" data-app="' + id + '">' +
        '<div class="glyph ' + a.glyph + '">' + svg(a.icon) + '</div>' +
        '<span>' + a.name + '</span></div>';
    }).join('');
    box.onclick = function (e) {
      var t = e.target.closest('[data-app]'); if (!t) return;
      openApp(t.dataset.app);
    };
  }

  function renderTaskbar() {
    var box = $('#tbCenter'); if (!box) return;
    var order = ['chat', 'mall', 'tool', 'notes'];
    box.innerHTML = '<button class="tb-btn" data-act="start" title="开始">' + svg('i-grid') + '</button>' +
      order.filter(function (id) { return APPS[id] && !APPS[id].hidden; }).map(function (id) {
        return '<button class="tb-btn" data-act="tb" data-app="' + id + '" title="' + APPS[id].name + '">' + svg(APPS[id].icon) + '</button>';
      }).join('');
    box.onclick = function (e) {
      var t = e.target.closest('[data-act]'); if (!t) return;
      if (t.dataset.act === 'start') { toggleStart(); return; }
      if (t.dataset.act === 'tb') {
        var id = t.dataset.app;
        var rec = S.wins[id];
        if (!rec) { openApp(id); }
        else if (rec.min) { rec.min = false; rec.el.classList.remove('min'); focusWin(id); syncTaskbar(); }
        else if (rec.el.style.zIndex == S.zTop) { rec.min = true; rec.el.classList.add('min'); syncTaskbar(); }
        else { focusWin(id); syncTaskbar(); }
      }
    };
    syncTaskbar();
  }

  function syncTaskbar() {
    $$('#tbCenter .tb-btn[data-app]').forEach(function (b) {
      var rec = S.wins[b.dataset.app];
      b.classList.toggle('active', !!(rec && !rec.min));
    });
  }

  function renderStartMenu() {
    var box = $('#startMenu'); if (!box) return;
    var order = ['chat', 'mall', 'tool', 'notes'];
    var apps = order.filter(function (id) { return APPS[id] && !APPS[id].hidden; });
    box.innerHTML =
      '<div class="sm-head"><div class="sm-avatar">N</div><div class="who">夜莺 · 终端 N-17<small>离线 · 单机 · 无外联</small></div></div>' +
      '<div class="sm-search">' + svg('i-search') + '<input placeholder="搜索应用" data-sm-search></div>' +
      '<div class="sm-grid">' + apps.map(function (id) {
        return '<div class="sm-app" data-app="' + id + '"><div class="g">' + svg(APPS[id].icon) + '</div><span>' + APPS[id].name + '</span></div>';
      }).join('') + '</div>' +
      '<div class="sm-foot"><button data-act="help">' + svg('i-note') + '操作说明</button>' +
      '<button data-act="reset">' + svg('i-power') + '重置终端</button></div>';
    box.onclick = function (e) {
      var app = e.target.closest('[data-app]');
      if (app) { openApp(app.dataset.app); closeStart(); return; }
      var act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'help') { closeStart(); showHelp(); }
      if (act.dataset.act === 'reset') { closeStart(); confirmReset(); }
    };
    var search = $('[data-sm-search]', box);
    if (search) search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      $$('.sm-app', box).forEach(function (a) {
        var name = APPS[a.dataset.app].name.toLowerCase();
        a.style.display = (!q || name.indexOf(q) >= 0) ? '' : 'none';
      });
    });
  }

  function toggleStart() {
    var box = $('#startMenu');
    S.startOpen = !S.startOpen;
    box.classList.toggle('open', S.startOpen);
  }
  function closeStart() {
    S.startOpen = false;
    $('#startMenu').classList.remove('open');
  }

  document.addEventListener('pointerdown', function (e) {
    if (S.startOpen && !e.target.closest('#startMenu') && !e.target.closest('[data-act="start"]')) closeStart();
  });

  /* ---------------- 模态 ---------------- */
  function modal(html, isStatic) {
    var root = $('#modalRoot'), box = $('#modalBox');
    box.innerHTML = html;
    box.dataset.static = isStatic ? '1' : '';
    root.classList.add('open');
  }
  function closeModal() { $('#modalRoot').classList.remove('open'); }
  $('#modalRoot').addEventListener('click', function (e) {
    if (e.target.id === 'modalRoot' && !$('#modalBox').dataset.static) { closeModal(); return; }
    var t = e.target.closest('[data-act]'); if (!t) return;
    var act = t.dataset.act;
    if (act === 'start-game') { closeModal(); startGame(); }
    if (act === 'help-close') closeModal();
    if (act === 'ending') chooseEnding(t.dataset.key);
    if (act === 'result-reset') { closeModal(); resetGame(); }
    if (act === 'result-stay') closeModal();
    if (act === 'reset-yes') { closeModal(); resetGame(); }
    if (act === 'reset-no') closeModal();
  });

  function showHelp() {
    modal('<div class="eyebrow">操作说明</div><h2>这台终端怎么用</h2>' +
      '<ul class="tut-list" style="padding-left:18px;margin:10px 0 0">' +
      '<li>拖动<b>标题栏</b>移动窗口；任务栏图标可切换与最小化。</li>' +
      '<li>所有线索都在网页里：<b>图片、参数、评价、被折叠的提问、页面源码的注释</b>。</li>' +
      '<li><b>解码器</b>可解 Base64、摩斯与逐行倒序；<b>线索本</b>记录任务与发现。</li>' +
      '</ul><div class="modal-actions"><button class="btn primary" data-act="help-close">知道了</button></div>', false);
  }

  function confirmReset() {
    modal('<div class="eyebrow">重置终端</div><h2>清空今晚的记录？</h2>' +
      '<p>任务、线索、聊天记录都会消失。这一晚要重新开始。</p>' +
      '<div class="modal-actions"><button class="btn danger" data-act="reset-yes">重置</button>' +
      '<button class="btn ghost" data-act="reset-no">取消</button></div>', false);
  }

  function tutorial() {
    modal('<div class="eyebrow">频道 03 · 任务简报</div><h2>你有一晚的时间</h2>' +
      '<p>你是「夜莺」。桌面上挂着一份鲸选商城的离线镜像——一家只卖日用品的百货店；旧货架十月就下架归档了，目录上找不到。</p>' +
      '<p>老鸦要三样东西：<b>旧货架的位置</b>、一张<b>自提单</b>的次序，和<b>交接单的盘点口令</b>。拿到之后，还要报一票货的交接信息。</p>' +
      '<ul class="tut-list" style="padding-left:18px;margin:12px 0 0">' +
      '<li>拖动<b>标题栏</b>移动窗口；任务栏切换应用。</li>' +
      '<li>线索藏在<b>店铺公告、买家评价、页面源码</b>里。</li>' +
      '<li><b>解码器</b>：Base64 / 摩斯 / 逐行倒序。<b>线索本</b>：任务与已发现的线索。</li>' +
      '</ul>' +
      '<div class="modal-actions"><button class="btn primary" data-act="start-game">开始</button></div>', true);
  }

  /* ============================================================
     聊天
     ============================================================ */
  function chatBox() {
    var app = $('.win[data-app="chat"]');
    return app ? $('.chat-body', app) : null;
  }
  function scrollChat() { var b = chatBox(); if (b) b.scrollTop = b.scrollHeight; }

  function paintMsg(m, box) {
    box = box || chatBox(); if (!box) return;
    var t = $('[data-typing]', box); if (t) t.remove();
    if (m.who === 'sys') {
      box.insertAdjacentHTML('beforeend', '<div class="sysline">' + m.html + '</div>');
    } else {
      box.insertAdjacentHTML('beforeend', '<div class="msg ' + (m.who === 'me' ? 'me' : 'them') + '">' +
        m.html + '<span class="meta">' + (m.who === 'me' ? '夜莺' : '老鸦') + ' · ' + m.t + '</span></div>');
    }
    box.scrollTop = box.scrollHeight;
  }

  function chatPush(who, html) {
    var m = { who: who, html: html, t: nowStr() };
    S.chat.push(m);
    paintMsg(m);
    if (who === 'them') sfx('recv');
  }

  function showTyping() {
    var b = chatBox(); if (!b) return;
    var old = $('[data-typing]', b); if (old) old.remove();
    b.insertAdjacentHTML('beforeend', '<div class="typing" data-typing><i></i><i></i><i></i></div>');
    b.scrollTop = b.scrollHeight;
  }
  function hideTyping() { var b = chatBox(); if (!b) return; var t = $('[data-typing]', b); if (t) t.remove(); }

  async function dm(html, delay, after) {
    var run = S.run;
    showTyping();
    await sleep(delay == null ? 800 : delay);
    if (run !== S.run) return false;
    hideTyping();
    chatPush('them', html);
    if (after) await sleep(after);
    return true;
  }

  function renderChatApp(body) {
    body.innerHTML =
      '<div class="chat-app">' +
      '<div class="chat-top">' +
      '<div class="chat-av">' + svg('i-owl') + '</div>' +
      '<div class="chat-id"><b>老鸦</b><small><i class="dot"></i>在线 · 频道 03</small></div>' +
      '<div class="chat-lock">' + svg('i-lock') + '端到端</div>' +
      '</div>' +
      '<div class="chat-body" data-chat-body></div>' +
      '<div class="chat-compose">' +
      '<div class="chat-input">' +
      '<textarea data-chat-input rows="1" placeholder="敲个字，让老鸦知道你在"></textarea>' +
      '<button class="send-btn" data-act="send" title="发送">' + svg('i-send') + '</button>' +
      '</div></div></div>';
    var box = $('[data-chat-body]', body);
    S.chat.forEach(function (m) { paintMsg(m, box); });
    var ta = $('[data-chat-input]', body);
    ta.addEventListener('input', function () {
      ta.style.height = 'auto';
      ta.style.height = Math.min(92, ta.scrollHeight) + 'px';
    });
    box.scrollTop = box.scrollHeight;
  }

  function chatAct(act, el) {
    if (act === 'send') { sendChat($('[data-chat-input]', $('.win[data-app="chat"]')).value); return; }
  }

  function sendChat(text) {
    var t = (text || '').trim();
    if (!t) return;
    var app = $('.win[data-app="chat"]');
    var ta = app ? $('[data-chat-input]', app) : null;
    if (ta) { ta.value = ''; ta.style.height = 'auto'; }
    chatPush('me', esc(t));
    sfx('send');
    setTimeout(function () { handleUser(t); }, 320);
  }

  function normalize(t) {
    return t.toLowerCase().replace(/[\s,，.。、:：;；!！?？"'“”‘’]/g, '');
  }

  function handleUser(text) {
    var n = normalize(text);
    if (!S.flags.mission) { startMission(); return; }
    if (S.flags.reported) { dm('频道要关了。别再发。', 600); return; }

    var pr = parseReport(text);
    if (S.flags.ledgerSeen && (pr.slot || pr.city || pr.time || /报告|上报|情报/.test(n))) {
      checkReport(text); return;
    }
    if (S.flags.channelOpen && !S.flags.ledgerSeen && n.indexOf('k7') >= 0) {
      dm('K7 别在聊天里发。门在购物车里，不在地址栏。', 600); return;
    }

    var now = Date.now();
    if (now - S.lastReply > 7000) {
      S.lastReply = now;
      var pool = [
        '我在。',
        '别问，问就是不知道。',
        '频道只转话，不教人做事。',
        '时间不多。03 点这班船不等人。',
        '手别停。我看不见你的屏幕。',
        '……'
      ];
      dm(pool[Math.floor(Math.random() * pool.length)], 700);
    }
  }

  async function startMission() {
    if (S.flags.mission) return;
    S.flags.mission = true;
    S.t0 = Date.now();
    await dm('……在。', 850);
    await dm('任务简单。鲸选商城，三号仓的离线镜像，已经挂在你桌面上了。', 1500);
    await dm('七天前，我们的人在里昂收了一只黑檀木盒。盒子跟着旧货架一起归档了，底板上刻着门牌号。', 1700);
    await dm('把门牌号、那张自提单的次序，还有归档区的盘点口令，带回来。', 1300);
    await dm('然后——我要 <em>K-07</em> 那一票的交接城市和时间。', 1500);
    await dm('提醒一次：别在目录里找门。也别去问客服，它只答商品。源码里那段旧脚本还作数。', 1500);
    toast('任务已下发', '目标：鲸选商城 · 三号仓镜像。先去店铺公告。', '');
    setTimeout(function () { openApp('mall'); }, 500);
  }

  function parseReport(text) {
    var n = normalize(text);
    var flat = n.replace(/[\-_–—－]/g, '');
    var raw = String(text).replace(/\s+/g, '');
    return {
      slot: flat.indexOf('k07') >= 0 || flat.indexOf('k7') >= 0,
      city: n.indexOf('布宜诺斯艾利斯') >= 0 || n.indexOf('布宜') >= 0 || n.indexOf('buenos') >= 0,
      time: /0?7[:：.．]40/.test(raw) || n.indexOf('0740') >= 0 || n.indexOf('740') >= 0 ||
            n.indexOf('7点40') >= 0 || n.indexOf('七点四十') >= 0
    };
  }

  function checkReport(text) {
    var m = parseReport(text);
    if (m.slot && m.city && m.time) { reportSuccess(); return; }
    if (m.slot && m.city) { dm('少了时间。K-07 那一行最后一个字段，照抄，别漏前面那个 0。', 800); return; }
    if (m.slot && m.time) { dm('少了城市。K-07 那一行，城市那栏。', 800); return; }
    if (m.city && m.time) { dm('货号呢。', 600); return; }
    if (m.slot) { dm('城市和时间呢。一行写完，别拆开发。', 800); return; }
    dm('对不上货单。照抄 K-07 那一行：货号、城市、时间。', 800);
  }

  async function reportSuccess() {
    S.flags.reported = true; S.tEnd = Date.now();
    chatPush('sys', '上报已送达 · 频道 03');
    await dm('收到。K-07，布宜诺斯艾利斯，07:40。', 900);
    await dm('……', 1700);
    await dm('K-07 那一栏的货名，你看见了？', 1300);
    checkObjectives();
    setTimeout(openEndingChoice, 900);
  }

  function openEndingChoice() {
    modal('<div class="eyebrow">频道 03 · 最后一条</div><h2>货单上的名字是你</h2>' +
      '<p>K-07 那一栏写着 <span class="code">N-17 / 夜莺</span>。委托人一栏是空的，承运一栏写着「以旧换新」。</p>' +
      '<p class="fine">老鸦在等你的补充。你只有一次机会。</p>' +
      '<div style="margin-top:16px">' +
      '<button class="choice" data-act="ending" data-key="a"><b>补发一条：货名是 N-17，代号「夜莺」</b><span>照实上报。把自己的名字交出去。</span></button>' +
      '<button class="choice" data-act="ending" data-key="b"><b>补发一条：货号更正为 K-05</b><span>把那一票改成里昂。让别人替你上车。</span></button>' +
      '<button class="choice" data-act="ending" data-key="c"><b>不再发送，直接断线</b><span>关掉终端。不上报，也不留下。</span></button>' +
      '</div>', true);
  }

  const ENDINGS = {
    a: {
      title: '〈自己人〉',
      text: '你补发了那四个字。三秒后，老鸦回了两个字：「等着。」\n十分钟后，频道里出现一条不是你写的消息：「K-07 取消，货主自留。」\n天亮时，你的桌面被清空了一半。剩下的一半，是一条新地址。'
    },
    b: {
      title: '〈替身〉',
      text: '你把 K-07 改成了 K-05。老鸦没有追问。\n第二天，里昂的车按时到了，接走一箱黄铜齿轮。\n里昂那条线从此再没有消息。你在给自己泡第二杯咖啡。'
    },
    c: {
      title: '〈消失的一行〉',
      text: '你关掉终端，拔掉网线，把刻着字的底板烧了。\n第二天，货单上 K-07 还在，货名却空了。\n没有人来找你。你只是变成了没人认领的一行。'
    }
  };

  async function chooseEnding(key) {
    closeModal();
    S.flags.ending = key;
    if (key === 'a') {
      await dm('……', 900);
      await dm('烛台不卖自己人。接头取消。你现在开始跑，别回头。', 1500);
    } else if (key === 'b') {
      await dm('收到。K-05，里昂，05:10。已派车。', 1100);
      await dm('……', 1500);
    } else {
      closeApp('mall'); closeApp('tool'); closeApp('chat');
      chatPush('sys', '频道 03 · 连接已终止');
      chatPush('sys', '终端 N-17 · 无上报记录');
      toast('连接终止', '频道 03 已关闭。', 'error');
    }
    await sleep(700);
    showResult();
  }

  function showResult() {
    var secs = Math.max(1, Math.round(((S.tEnd || Date.now()) - S.t0) / 1000));
    var mins = Math.floor(secs / 60);
    var grade = mins < 15 ? 'S' : (mins < 25 ? 'A' : 'B');
    var e = ENDINGS[S.flags.ending] || ENDINGS.c;
    var found = S.clues.length;
    modal('<div class="result">' +
      '<div class="grade">' + grade + '</div>' +
      '<div class="eyebrow">案卷封存 · 2026/11/19</div>' +
      '<h2>' + e.title + '</h2>' +
      '<p class="epi">' + e.text.replace(/\n/g, '<br>') + '</p>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + pad(mins) + ':' + pad(secs % 60) + '</b><span>用时</span></div>' +
      '<div class="stat"><b>' + found + '</b><span>线索</span></div>' +
      '</div>' +
      '<div class="modal-actions" style="justify-content:center">' +
      '<button class="btn primary" data-act="result-reset">重开一局</button>' +
      '<button class="btn ghost" data-act="result-stay">留在桌面</button>' +
      '</div></div>', true);
    sfx('ok');
  }

  /* ============================================================
     商城
     ============================================================ */
  var PRODUCTS = [
    {
      id: 'p1', name: '「夜莺」1920 复刻留声机', sub: '胡桃木 · 黄铜大喇叭 · 附备用唱针',
      price: '1,947.00', sales: 3, img: A.phonograph, badge: '复刻',
      orderNote: '这三件都是给它配的。',
      params: [['品牌', '鲸选自营'], ['型号', 'S07-1947'], ['产地', '里昂'], ['材质', '胡桃木 / 黄铜'], ['唱片规格', '78 转'], ['附注', '附赠备用唱针一枚']],
      detail: '1920 年款式的复刻，机身取自里昂一间旧工坊的模具。摇柄是后配的，转起来有一点松。<br><br>卖家备注：这一批只有三台，编号连着。买主大多是收着听的，不是收着看的。',
      reviews: [
        { name: '老周', stars: '★★★★★', date: '2026-10-03', text: '声音比想象中好。摇柄有点松，不影响。' },
        { name: '匿名', stars: '★★★★', date: '2026-10-11', text: '买给我父亲的。他说这机器他年轻时见过。' },
        { name: '匿名', stars: '★', date: '2026-10-18', text: '客服说，这批是 1947 年那批的复刻。' },
        { name: '布宜诺斯艾利斯的雨', stars: '★★★★★', date: '2026-10-20', text: '跟八音盒、台灯、磨一起买的。就为等这一台。' }
      ]
    },
    {
      id: 'p2', name: '黄铜八音盒 · 天鹅绒内衬', sub: '发条完好 · 曲目《雨港》',
      price: '680.00', sales: 12, img: A.musicbox, badge: '',
      orderNote: '先上发条，后面才听得下去。',
      params: [['品牌', '鲸选自营'], ['型号', 'S07-0412'], ['产地', '里昂'], ['材质', '黄铜 / 天鹅绒'], ['附注', '发条已上油']],
      detail: '盒盖内侧有一圈旧绒，边上磨掉了一点。发条还能走满三分半。',
      reviews: [
        { name: '匿名', stars: '★★★★★', date: '2026-09-26', text: '曲子上头。晚上听有点瘆人。' },
        { name: '匿名', stars: '★★★★★', date: '2026-10-06', text: '和灯、磨、留声机拼的一单。先上发条，后面才听得下去。' }
      ]
    },
    {
      id: 'p3', name: '绿罩黄铜台灯', sub: '暖光 · 铜质灯柱 · 老式插头',
      price: '129.00', sales: 88, img: A.lamp, badge: '',
      orderNote: '盒子先响，我才开的灯。',
      params: [['品牌', '鲸选自营'], ['型号', 'S07-1180'], ['材质', '黄铜 / 玻璃'], ['附注', '插头为老式两脚，已改线']],
      detail: '罩子是老的，灯柱后配。亮起来是那种偏黄的暖光。',
      reviews: [
        { name: '匿名', stars: '★★★★', date: '2026-10-02', text: '比照片旧，但光很正。' },
        { name: '匿名', stars: '★★★★', date: '2026-10-09', text: '跟八音盒一个单子。盒子先响，我才开的灯。' }
      ]
    },
    {
      id: 'p4', name: '手摇咖啡磨 · 木箱款', sub: '黄铜摇柄 · 可调粗细',
      price: '268.00', sales: 41, img: A.grinder, badge: '',
      orderNote: '灯亮着磨豆子。',
      params: [['品牌', '鲸选自营'], ['型号', 'S07-0771'], ['材质', '橡木 / 黄铜 / 铸铁'], ['附注', '磨芯完好']],
      detail: '摇起来有点沉。磨出来的粉不算均匀，但手冲够用。',
      reviews: [
        { name: '匿名', stars: '★★★★★', date: '2026-09-19', text: '早上磨豆子，比电动的有仪式感。' },
        { name: '匿名', stars: '★★★★', date: '2026-10-12', text: '灯亮着磨豆子，说是配乐也行。' }
      ]
    },
    {
      id: 'p5', name: '旧唱片 · 随机款（3 张）', sub: '78 转 · 套封有磨损',
      price: '45.00', sales: 233, img: A.records, badge: '清仓',
      params: [['品牌', '三号仓'], ['型号', 'S07-0001'], ['数量', '3 张随机'], ['附注', '不挑款，可能有划痕']],
      detail: '从三号仓的箱底翻出来的。不挑款，随机发三张。<br><br>有人买来听，也有人买来当摆设。',
      reviews: [{ name: '匿名', stars: '★★★', date: '2026-10-08', text: '有一张裂了。这个价钱，算了。单买的，没跟别的凑一单。' }]
    },
    {
      id: 'p6', name: '橡木收纳盒 · 黄铜包边', sub: '带提手 · 内衬亚麻',
      price: '99.00', sales: 9, img: A.woodbox, badge: '',
      params: [['品牌', '鲸选自营'], ['型号', 'S07-0550'], ['材质', '橡木 / 黄铜'], ['尺寸', '24 × 15 × 12 cm']],
      detail: '盒盖合得不太严，但提手牢。放唱片、放信、放不想让人看见的东西。',
      reviews: [{ name: '匿名', stars: '★★★★', date: '2026-09-30', text: '比想象中小一点，做工还行。单独下的单，没凑。' }]
    },
    {
      id: 'p7', name: '黄铜齿轮组 · 拆机件', sub: '大小 11 枚 · 有氧化',
      price: '320.00', sales: 6, img: A.gears, badge: '',
      params: [['品牌', '三号仓'], ['型号', 'S07-0320'], ['材质', '黄铜'], ['附注', '拆机件，不保证啮合']],
      detail: '从旧钟表里拆出来的。齿有磨损，氧化没清。有人拿去修钟，有人拿去压纸。',
      reviews: [{ name: '匿名', stars: '★★★★', date: '2026-10-15', text: '成色比照片好，值这个价。单拍，拆机件。' }]
    }
  ];

  var GAL = [
    { src: A.samplebox, cap: '1 / 7 · 正面', style: '' },
    { src: A.samplebox, cap: '2 / 7 · 锁扣特写', style: 'object-position:62% 56%;transform:scale(1.9)' },
    { src: A.samplebox, cap: '3 / 7 · 木纹', style: 'object-position:16% 72%;transform:scale(2.2) brightness(.94)' },
    { src: A.samplebox, cap: '4 / 7 · 底板边缘', style: 'object-position:50% 94%;transform:scale(1.7) brightness(.78)' },
    { src: A.samplebox, cap: '5 / 7 · 侧面', style: 'object-position:6% 44%;transform:scale(1.55)' },
    { src: A.woodbox, cap: '6 / 7 · 外包装', style: '' },
    { src: null, cap: '7 / 7 · 载入失败', broken: true }
  ];

  var NOTES = [
    { d: '2026-09-12', tag: '置顶', t: '【系统迁移】本镜像停止交易，仅保留浏览。旧货架自 S07 起下架归档，货架上的东西不再上架。' },
    { d: '2026-09-18', tag: '', t: '【自提】冬歇前只走自提。系统按归档年号后四位分配批次：1947。别写在群里。' },
    { d: '2026-10-02', tag: '', t: '【客服】商品问答自动应答已上线，只认商品问题。请勿再往外发 U0hJUFBJTkc= 那一串。' },
    { d: '2026-10-27', tag: '', t: '【失物】三号仓拾到黄铜钥匙一枚，失主请联系值班员老周。' },
    { d: '2026-11-02', tag: '', t: '【冬歇】11 月 20 日起本店进入冬歇。明年见。' }
  ];

  var ADDR = {
    home: 'http://jingxuan-mall.local/',
    plaza: 'http://jingxuan-mall.local/all',
    notice: 'http://jingxuan-mall.local/notice',
    service: 'http://jingxuan-mall.local/service',
    orders: 'http://jingxuan-mall.local/orders',
    'item:s07': 'http://jingxuan-mall.local/item/S07-0000',
    'item:p1': 'http://jingxuan-mall.local/item/S07-1947',
    cart: 'http://jingxuan-mall.local/cart',
    dark: 'http://kestrel.1947/'
  };

  function mallGo(route) {
    if (!route) return;
    M.hist = M.hist.slice(0, M.idx + 1);
    M.hist.push(route); M.idx = M.hist.length - 1;
    M.route = route; M.src = false;
    renderMallPage();
  }

  function renderMallApp(body) {
    body.innerHTML =
      '<div class="browser">' +
      '<div class="browser-top"><div class="bt-tab"><span class="fav">鲸</span><b>鲸选商城 · 镜像</b><span class="x" data-act="tab-close" title="关闭">×</span></div></div>' +
      '<div class="browser-bar">' +
      '<button class="navbtn" data-act="back" title="后退">' + svg('i-back') + '</button>' +
      '<button class="navbtn" data-act="fwd" title="前进">' + svg('i-fwd') + '</button>' +
      '<button class="navbtn" data-act="reload" title="刷新">' + svg('i-reload') + '</button>' +
      '<div class="urlbar">' + svg('i-lock') + '<input data-url readonly spellcheck="false" autocomplete="off" title="离线镜像 · 地址栏只读"></div>' +
      '<button class="mini-btn cartbtn" data-act="go" data-route="cart" title="购物车">购物车 <b data-cart-count>0</b></button>' +
      '<button class="mini-btn" data-act="source">源码</button>' +
      '<button class="mini-btn" data-act="home">首页</button>' +
      '</div>' +
      '<div class="page" data-page></div>' +
      '</div>';
    renderMallPage();
  }

  /* 归档区任何一条（旧物 / 样品 / 未登记件）的详情页都算暗色路由：
     它们长在 S07 上，不该切回商城的米色皮肤。 */
  function archiveItemByRoute(r) {
    if (!r || r.indexOf('item:') !== 0) return null;
    var id = r.slice(5);
    if (typeof SAMPLE_ITEM !== 'undefined' && SAMPLE_ITEM && id === (SAMPLE_ITEM.id || 's07')) return SAMPLE_ITEM;
    var p = PRODUCTS.filter(function (x) { return x.id === id; })[0];
    if (p) return p;
    return SHADOW.filter(function (x) { return x.id === id; })[0] || null;
  }
  function isArchiveRoute(r) {
    if (r === 'dark') return true;
    return !!archiveItemByRoute(r);
  }
  function archiveCode(a) {
    if (a.code) return a.code;
    var row = (a.params || []).filter(function (x) { return x[0] === '型号'; })[0];
    return row ? row[1] : (a.id || '—');
  }

  function renderMallPage() {
    var app = $('.win[data-app="mall"]'); if (!app) return;
    var page = $('[data-page]', app); if (!page) return;
    var keep = M.src;
    var dark = isArchiveRoute(M.route);
    page.classList.toggle('src', keep);
    page.classList.toggle('dark', dark);
    page.innerHTML = keep ? pageSource() : buildPage();
    var url = $('[data-url]', app);
    if (url) {
      var ai = archiveItemByRoute(M.route);
      url.value = (M.route === 'dark')
        ? (S.flags.ledgerSeen ? 'http://kestrel.1947/ledger' : 'http://kestrel.1947/')
        : (ai ? 'http://kestrel.1947/s07/' + archiveCode(ai)
          : (M.route.indexOf('item:') === 0
            ? 'http://jingxuan-mall.local/item/' + M.route.slice(5)
            : (ADDR[M.route] || ADDR.home)));
    }
    var tab = $('.bt-tab', app);
    if (tab) {
      $('b', tab).textContent = dark ? 'S07 · 归档区 · 只读' : '鲸选商城 · 镜像';
      $('.fav', tab).textContent = '鲸';
      tab.classList.toggle('dark', dark);
    }
    updateCartBadge();
    var back = $('[data-act="back"]', app), fwd = $('[data-act="fwd"]', app);
    if (back) back.disabled = M.idx <= 0;
    if (fwd) fwd.disabled = M.idx >= M.hist.length - 1;
    page.scrollTop = 0;
  }

  /* ---------------- 购物车 / 自提单 ---------------- */
  function cartProduct(id) {
    return PRODUCTS.concat(DAILY).filter(function (x) { return x.id === id; })[0] || null;
  }
  function cartTotal() {
    var sum = M.cart.reduce(function (a, id) {
      var p = cartProduct(id);
      return a + (p ? parseFloat(p.price.replace(/,/g, '')) : 0);
    }, 0);
    return sum.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function updateCartBadge() {
    var b = $('[data-cart-count]', $('.win[data-app="mall"]'));
    if (b) b.textContent = M.cart.length;
  }
  function cartAdd(id) {
    var p = cartProduct(id); if (!p) return;
    var app = $('.win[data-app="mall"]');
    if (S.flags.ledgerSeen) { toast('单子已出', '暗门已经开了，别再下单。', ''); return; }
    if (M.cart.indexOf(id) >= 0) {
      toast('已在车里', '「' + p.name + '」已经在购物车里了。', '');
      sfx('err'); return;
    }
    M.cart.push(id);
    updateCartBadge();
    var btn = $('[data-act="cart-add"][data-id="' + id + '"]', app);
    if (btn) { btn.classList.add('in'); btn.textContent = '已在购物车 · 第 ' + M.cart.length + ' 件'; }
    if (M.cart.length === 1 && CFG.cartOrder.indexOf(id) >= 0) {
      addClue('cart', '购物车 · 自提单', '暗门只认自提单：四件日用品，次序照买家评价里写的先后。\n直接结算，自提批次由系统按年号分配。');
    }
    toast('已加入购物车', p.name + ' · 第 ' + M.cart.length + ' 件', 'success');
    sfx('send');
  }
  function cartRemove(i) {
    if (i < 0 || i >= M.cart.length) return;
    var p = cartProduct(M.cart[i]);
    M.cart.splice(i, 1);
    updateCartBadge();
    toast('已移出', p ? p.name : '这一件', '');
    sfx('wind');
    renderMallPage();
  }
  function cartSay(text, kind) {
    var msg = $('[data-cart-msg]', $('.win[data-app="mall"]'));
    if (!msg) return;
    msg.className = 'cart-msg ' + (kind || '');
    msg.textContent = text;
  }
  function submitOrder() {
    if (K.busy || S.flags.ledgerSeen) return;
    var app = $('.win[data-app="mall"]'); if (!app) return;
    if (S.flags.cartReady) { mallGo('dark'); return; }
    if (!M.cart.length) { cartSay('车是空的。这单是四件。', 'err'); sfx('err'); return; }
    var four = M.cart.filter(function (id) { return CFG.cartOrder.indexOf(id) >= 0; });
    if (!four.length) { cartSay('车里没有那一单的四件。次序照评价。', 'err'); sfx('err'); return; }
    if (four.length !== CFG.cartOrder.length) {
      cartSay('单子里只有 ' + four.length + ' 件。这单是 ' + CFG.cartOrder.length + ' 件。', 'err'); sfx('err'); return;
    }
    for (var i = 0; i < CFG.cartOrder.length; i++) {
      if (four[i] !== CFG.cartOrder[i]) {
        cartSay('第 ' + (i + 1) + ' 件不对。评语里写过谁先进车。', 'err'); sfx('err'); return;
      }
    }
    K.busy = true;
    S.flags.cartReady = true;
    M.batch = CFG.batch;
    addClue('cartok', '自提单 · 已受理', '四件 · 次序正确 · 系统按年号分配批次 ' + CFG.batch + '\n自提点：' + CFG.domain);
    cartSay('单号匹配 · 正在分配自提点 …', 'ok');
    toast('自提单已受理', '自提点：kestrel.1947 · 只走这一趟', 'success');
    sfx('ok');
    checkObjectives();
    var run = S.run;
    setTimeout(function () {
      K.busy = false;
      if (run !== S.run || !S.flags.cartReady || S.flags.ledgerSeen) return;
      if (M.route === 'cart') mallGo('dark'); else renderMallPage();
    }, 1500);
  }

  function buildPage() {
    var r = M.route;    if (r === 'home') return pageHome();
    if (r === 'plaza') return pagePlaza();
    if (r === 'notice') return pageNotice();
    if (r === 'service') return pageService();
    if (r === 'orders') return pageOrders();
    if (r === 'cart') return pageCart();
    if (r === 'dark') return pageDark();
    if (r.indexOf('item:') === 0) {
      var id = r.slice(5);
      var p = PRODUCTS.filter(function (x) { return x.id === id; })[0];
      if (p) return pageArchiveItem(p);
      if (id === (SAMPLE_ITEM.id || 's07')) return pageSample();
      var d = DAILY.filter(function (x) { return x.id === id; })[0];
      if (d) return pageDailyProduct(d);
      var s = SHADOW.filter(function (x) { return x.id === id; })[0];
      if (s) return pageShadow(s);
      return pageHome();
    }
    return pageHome();
  }

  function shopHead() {
    return '<div class="shop-head">' +
      '<div class="brand"><div class="mark">' + svg('i-whale') + '</div>' +
      '<div class="name">鲸选商城<small>JINGXUAN MALL · 三号仓</small></div></div>' +
      '<div class="searchbox">' + svg('i-search') +
      '<input data-search placeholder="搜日用品或编号">' +
      '<button data-act="search">搜索</button>' +
      '<span class="snote" data-search-note></span></div>' +
      '<div style="font-size:11px;color:#8d8474;display:flex;gap:14px;white-space:nowrap">' +
      '<span style="cursor:pointer" data-act="go" data-route="orders">我的订单</span></div>' +
      '</div>';
  }

  function shopNav(active) {
    var items = [['home', '首页'], ['plaza', '全部商品'], ['notice', '店铺公告'], ['orders', '我的订单'], ['cart', '购物车']];
    return '<div class="shop-nav">' + items.map(function (it) {
      return '<a data-act="go" data-route="' + it[0] + '" class="' + (it[0] === active ? 'on' : '') + '">' + it[1] + '</a>';
    }).join('') + '</div>';
  }

  function footerHTML() {
    return '<div class="footer">' +
      '<div class="links"><span data-act="go" data-route="notice">店铺公告</span>' +
      '<span data-act="svc-open" data-id="">客服 · 仅商品问题</span>' +
      '<span data-act="go" data-route="orders">我的订单</span>' +
      '<span data-act="nolink" data-msg="隐私政策已随镜像一同归档。">隐私政策</span></div>' +
      '<em>鲸选商城 · 三号仓 · 本页为离线镜像，除自提单外交易功能已停用。</em>' +
      '镜像时间 2026-11-19 03:12 · 维护：老周</div>';
  }

  function cardHTML(p) {
    return '<div class="prod-card" data-act="go" data-route="item:' + p.id + '">' +
      '<div class="thumb"><img src="' + p.img + '" alt="' + esc(p.name) + '" loading="lazy">' +
      (p.badge ? '<span class="badge">' + p.badge + '</span>' : '') + '</div>' +
      '<div class="info"><h3>' + esc(p.name) + '</h3><div class="sub">' + esc(p.sub) + '</div>' +
      '<div class="row"><span class="price"><small>¥</small>' + p.price + '</span>' +
      '<span class="sales">已售 ' + p.sales + '</span></div></div></div>';
  }

  function sampleZone() {
    return '<div class="sample-zone">' +
      '<div class="zh"><b>清仓样品 · 仅陈列</b><small>不参与促销 · 不补货</small></div>' +
      '<div class="sample-card" data-act="go" data-route="item:s07">' +
      '<img src="' + A.samplebox + '" alt="样品">' +
      '<div class="sc-main"><h4>样品 · 勿拍</h4><p>黑檀木盒 · 黄铜齿轮锁 · 锁已坏，钥匙遗失</p></div>' +
      '<div class="sc-price">¥0.00<small>已售 0 · 仅剩 1</small></div></div></div>';
  }

  function pageHome() {
    return '<div class="shop-strip">离线镜像 · 2026-11-19 03:12 · 只读模式 · 三号仓</div>' +
      '<div class="page-inner">' + shopHead() + shopNav('home') +
      '<div class="hero">' +
      '<div class="veil"></div>' +
      '<div class="copy"><div class="kicker">三号仓 · 百货</div>' +
      '<h1>过冬的东西，这一页都有</h1>' +
      '<p>纸巾、洗洁精、拖鞋、电池——都是厂里发的、家里用的。旧货架十月就下架归档了，别问。</p>' +
      '<span class="cta" data-act="go" data-route="plaza">全部商品 →</span></div></div>' +
      dailyHTML() + footerHTML() + '</div>';
  }

  function pagePlaza() {
    return '<div class="shop-strip">全部商品 · 8 件日用百货 · 旧货架已归档</div>' +
      '<div class="page-inner">' + shopHead() + shopNav('plaza') +
      dailyHTML() + footerHTML() + '</div>';
  }

  function pageShadow(s) {
    return '<div class="aq-strip">S07 · 归档区 · 未登记件 · 图像遮蔽</div>' +
      '<div class="aq-inner">' + aqHeadHTML() +
      '<div class="aq-crumb"><span data-act="go" data-route="home">商城</span> / ' +
      '<span data-act="go" data-route="dark">S07 · 归档区</span> / ' + s.id + '</div>' +
      '<div class="pdp-main">' +
      '<div class="gallery"><div class="aqmask" style="height:300px;border-radius:10px"><span class="lvt">分级 ' + s.lv + '</span></div></div>' +
      '<div class="pdp-info">' +
      '<div class="tagline">S07 · 未登记 · 不对外</div>' +
      '<h1>' + esc(s.name) + '</h1><div class="sub">' + esc(s.sub) + '</div>' +
      '<div class="pdp-price"><span class="big">' + esc(s.price) + '</span><span class="note">价格不公开 · 只对委托人</span></div>' +
      '<div class="pdp-meta"><span>编号 <b>' + s.id + '</b></span><span>分级 <b>' + s.lv + '</b></span><span>库存 <b>未标</b></span></div>' +
      '<div class="pdp-actions"><button class="btn-shop primary" disabled>需委托人确认</button>' +
      '<button class="btn-shop ghost" data-act="go" data-route="dark">回归档区</button></div>' +
      '<div class="pdp-notice">' + esc(s.note) + '。图像与详情均不在镜像里，只留编号。</div>' +
      '</div></div>' +
      '<div class="detail-block"><h2>详情</h2><p>这一条没有配图，也没有规格。归档员只写了编号、分级和一句话备注；真要查，得在交接单上找。</p></div>' +
      '<div class="aq-foot"><span data-act="go" data-route="dark">← 回归档区</span><span>离开时不要留痕 · S07 / W2-11</span></div>' +
      '</div>';
  }

  /* 日用品的详情页：和旧货那页同一套版式，但抬头挂的是这家店。 */
  function pageDailyProduct(d) {
    var i = M.cart.indexOf(d.id);
    var cs = CS[d.id] || { n: '鲸选商城官方旗舰店', s: '鲸选' };
    var params = d.params.map(function (r) {
      return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>';
    }).join('');
    var reviews = d.reviews.map(function (r) {
      return '<div class="review-item"><div class="top"><span class="avatar-dot">' + esc(r.name.slice(0, 1)) + '</span>' + esc(r.name) +
        '<span class="stars">' + r.stars + '</span><span>' + r.date + '</span></div><p>' + esc(r.text) + '</p></div>';
    }).join('');
    return '<div class="shop-strip">离线镜像 · 只读 · 冬歇期只走自提</div>' +
      '<div class="page-inner">' + shopHead() + shopNav('plaza') +
      '<div class="pdp-top"><span data-act="go" data-route="home">首页</span> / <span data-act="go" data-route="plaza">全部商品</span> / ' + esc(d.name) + '</div>' +
      '<div class="pdp-main">' +
      '<div class="gallery"><div class="main-img"><img src="' + d.img + '" alt="' + esc(d.name) + '"><div class="cap">主图 · 三号仓实拍</div></div></div>' +
      '<div class="pdp-info">' +
      '<div class="tagline">' + esc(cs.n) + ' · 店铺直营</div>' +
      '<h1>' + esc(d.name) + '</h1><div class="sub">' + esc(d.sub) + '</div>' +
      '<div class="pdp-price"><span class="big"><small>¥</small>' + d.price + '</span><span class="note">含税 · 不包邮 · 冬歇前最后一批</span></div>' +
      '<div class="pdp-meta"><span>已售 <b>' + d.sales + '</b></span><span>库存 <b>' + d.stock + '</b></span><span>店铺 <b>' + esc(cs.s || cs.n) + '</b></span></div>' +
      '<div class="pdp-actions"><button class="btn-shop primary' + (i >= 0 ? ' in' : '') + '" data-act="cart-add" data-id="' + d.id + '">' +
      (i >= 0 ? '已在购物车 · 第 ' + (i + 1) + ' 件' : '加入购物车') + '</button>' +
      '<button class="btn-shop ghost" data-act="svc-open" data-id="' + d.id + '">问客服</button></div>' +
      '<div class="pdp-notice">除自提单外，下单、支付与物流均已停用。</div>' +
      '</div></div>' +
      '<div class="params"><table>' + params + '</table></div>' +
      '<div class="detail-block"><h2>商品详情</h2><p>' + esc(d.detail) + '</p></div>' +
      '<div class="review-sec"><div class="review-head"><h2>买家评价</h2><span class="r">' + d.reviews.length + ' 条</span></div>' + reviews + '</div>' +
      footerHTML() + '</div>';
  }

  function pageProduct(p) {
    if (p.id === 'p1' && !S.flags.priceSeen) {
      S.flags.priceSeen = true;
      addClue('price', '价签 · 四位数', '「夜莺」1920 复刻留声机 · ¥1,947.00 · 型号 S07-1947');
      toast('记下一笔', '「夜莺」的价签：¥1,947.00', '');
      checkObjectives();
    }
    if (p.orderNote) {
      addClue('ord:' + p.id, '评语 · ' + p.name + ' · 次序', '“' + p.orderNote + '”\n这单四件，买家把先后写在了评语里。');
    }
    var params = p.params.map(function (r, i) {
      return '<tr' + (p.id === 'p1' && r[0] === '型号' ? ' class="special"' : '') + '><td>' + r[0] + '</td><td>' + esc(r[1]) + '</td></tr>';
    }).join('');
    var reviews = p.reviews.map(function (r) {
      return '<div class="review-item"><div class="top"><span class="avatar-dot">' + r.name.slice(0, 1) + '</span>' + esc(r.name) +
        '<span class="stars">' + r.stars + '</span><span>' + r.date + '</span></div><p>' + esc(r.text) + '</p></div>';
    }).join('');
    return '<div class="shop-strip">离线镜像 · 只读 · 冬歇期只走自提</div>' +
      '<div class="page-inner">' + shopHead() + shopNav('plaza') +
      '<div class="pdp-top"><span data-act="go" data-route="home">首页</span> / <span data-act="go" data-route="plaza">全部商品</span> / ' + esc(p.name) + '</div>' +
      '<div class="pdp-main">' +
      '<div class="gallery"><div class="main-img"><img src="' + p.img + '" alt="' + esc(p.name) + '"><div class="cap">主图 · 三号仓实拍</div></div></div>' +
      '<div class="pdp-info">' +
      '<div class="tagline">S07 · JINGXUAN MALL</div>' +
      '<h1>' + esc(p.name) + '</h1><div class="sub">' + esc(p.sub) + '</div>' +
      '<div class="pdp-price"><span class="big"><small>¥</small>' + p.price + '</span><span class="note">含税 · 不包邮 · 冬歇前最后一批</span></div>' +
      '<div class="pdp-meta"><span>已售 <b>' + p.sales + '</b></span><span>型号 <b>' + esc((p.params.filter(function (x) { return x[0] === '型号'; })[0] || ['', '—'])[1]) + '</b></span><span>库存 <b>有限</b></span></div>' +
      '<div class="pdp-actions"><button class="btn-shop primary' + (M.cart.indexOf(p.id) >= 0 ? ' in' : '') + '" data-act="cart-add" data-id="' + p.id + '">' +
      (M.cart.indexOf(p.id) >= 0 ? '已在购物车 · 第 ' + (M.cart.indexOf(p.id) + 1) + ' 件' : '加入购物车') + '</button>' +
      '<button class="btn-shop ghost" data-act="svc-open" data-id="' + p.id + '">联系客服</button></div>' +
      '<div class="pdp-notice">除自提单外，下单、支付与物流均已停用。</div>' +
      '</div></div>' +
      '<div class="params"><table>' + params + '</table></div>' +
      '<div class="detail-block"><h2>商品详情</h2><p>' + p.detail + '</p></div>' +
      '<div class="review-sec"><div class="review-head"><h2>买家评价</h2><span class="r">' + p.reviews.length + ' 条</span></div>' + reviews + '</div>' +
      footerHTML() + '</div>';
  }

  /* 归档件详情页：和商城的商品详情页共用一套骨架（主图 / 价格 / 参数 / 详情 / 评价），
     但整页落在 S07 的暗色皮肤里，头部换成归档区自己的 — 同一家店的第二张脸。 */
  function pageArchiveItem(p) {
    if (p.id === 'p1' && !S.flags.priceSeen) {
      S.flags.priceSeen = true;
      addClue('price', '价签 · 四位数', '「夜莺」1920 复刻留声机 · ¥1,947.00 · 型号 S07-1947');
      toast('记下一笔', '「夜莺」的价签：¥1,947.00', '');
      checkObjectives();
    }
    var params = (p.params || []).map(function (r) {
      return '<tr' + (p.id === 'p1' && r[0] === '型号' ? ' class="special"' : '') + '><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>';
    }).join('');
    var reviews = (p.reviews || []).map(function (r) {
      return '<div class="review-item"><div class="top"><span class="avatar-dot">' + esc(r.name.slice(0, 1)) + '</span>' + esc(r.name) +
        '<span class="stars">' + r.stars + '</span><span>' + r.date + '</span></div><p>' + esc(r.text) + '</p></div>';
    }).join('');
    return '<div class="aq-strip">S07 · 归档区 · 只读镜像 · 不在商城目录里</div>' +
      '<div class="aq-inner">' + aqHeadHTML() +
      '<div class="aq-crumb"><span data-act="go" data-route="home">商城</span> / ' +
      '<span data-act="go" data-route="dark">S07 · 归档区</span> / ' + esc(p.name) + '</div>' +
      '<div class="pdp-main">' +
      '<div class="gallery"><div class="main-img"><img src="' + p.img + '" alt="' + esc(p.name) + '">' +
      '<div class="cap">归档照 · 三号仓二层</div></div></div>' +
      '<div class="pdp-info">' +
      '<div class="tagline">S07 · 归档件 · 只读</div>' +
      '<h1>' + esc(p.name) + '</h1><div class="sub">' + esc(p.sub) + '</div>' +
      '<div class="pdp-price"><span class="big"><small>¥</small>' + p.price + '</span><span class="note">价签没撤 · 不参与交易</span></div>' +
      '<div class="pdp-meta"><span>归档号 <b>' + esc(codeOf(p)) + '</b></span><span>状态 <b>已下架</b></span><span>库存 <b>1</b></span></div>' +
      '<div class="pdp-actions"><button class="btn-shop primary" disabled>已归档 · 不可下单</button>' +
      '<button class="btn-shop ghost" data-act="go" data-route="dark">回归档区</button></div>' +
      '<div class="pdp-notice">这一件不再上架。要看流转，只在交接单上。</div>' +
      '</div></div>' +
      '<div class="params"><table>' + params + '</table></div>' +
      '<div class="detail-block"><h2>归档记录</h2><p>' + p.detail + '</p></div>' +
      '<div class="review-sec"><div class="review-head"><h2>买家评价</h2><span class="r">' + (p.reviews || []).length + ' 条</span></div>' + reviews + '</div>' +
      '<div class="aq-foot"><span data-act="go" data-route="dark">← 回归档区</span><span>离开时不要留痕 · S07 / W2-11</span></div>' +
      '</div>';
  }

  function seenSample() {
    if (S.flags.sampleFound) return;
    S.flags.sampleFound = true;
    addClue('sample', '样品 · 勿拍（S07-0000）', '价格 ¥0.00 · 已售 0 · 库存 1 · 不发货，不议价\n黑檀木盒，黄铜齿轮锁，锁已坏。');
    toast('找到了', '样品 · 勿拍：0 销量，0 元，库存 1。', 'success');
    checkObjectives();
  }
  function seenNote() {
    if (S.flags.noteRead) return;
    S.flags.noteRead = true;
    addClue('note', '图 7 · 底板刻字（由外向内）', COPY.note + '\n（每行倒过来读，桌面解码器可解。）');
    toast('图 7', '底板刻字：每一行都是从外圈往里刻的。', 'success');
    checkObjectives();
    sfx('wind');
  }
  function seenFold() {
    if (S.flags.foldedSeen) return;
    S.flags.foldedSeen = true;
    addClue('fold', '被折叠的提问', '提问（布宜诺斯艾利斯的雨）：U0hJUFBJTkc= 还作数吗？老地方。\n店主：作数。客服只答商品，去源码里翻那段旧脚本。');
    toast('被折叠的提问', '有人用一串字母问了一句「还作数吗」。', '');
    checkObjectives();
  }

  function plateHTML() {
    var lines = COPY.note.split('\n');
    return '<div class="plate"><div class="glow"></div><div class="carve">' +
      lines.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') +
      '</div><div class="hint">图 7 · 由外向内</div></div>';
  }

  function mainImageHTML() {
    var g = GAL[M.img - 1];
    if (M.img === 7) {
      return plateHTML() +
        '<div class="cap">7 / 7 · 底板刻字（由外向内）</div>' +
        '<div class="zoom" data-act="copy" data-copy="note">复制刻字</div>';
    }
    return '<img src="' + g.src + '" alt="" style="' + g.style + '">' +
      '<div class="cap">' + g.cap + '</div>' +
      '<div class="zoom" data-act="nolink" data-msg="原图已在镜像中被压缩。">查看原图</div>';
  }

  function renderMainImage() {
    var app = $('.win[data-app="mall"]'); if (!app) return;
    var box = $('.main-img', app); if (!box) return;
    box.innerHTML = mainImageHTML();
    $$('.thumbs .th', app).forEach(function (t) { t.classList.toggle('on', +t.dataset.i === M.img); });
  }

  function thumbsHTML() {
    return '<div class="thumbs">' + GAL.map(function (g, i) {
      var n = i + 1;
      if (g.broken) {
        return '<div class="th broken" data-act="img" data-i="' + n + '" style="' + (M.img === n ? 'border-color:#17695f;box-shadow:0 0 0 2px rgba(23,105,95,.18)' : '') + '"><span class="n">' + n + '</span><span class="bl">载入失败</span></div>';
      }
      return '<div class="th' + (M.img === n ? ' on' : '') + '" data-act="img" data-i="' + n + '">' +
        '<img src="' + g.src + '" alt="" style="' + g.style + '"><span class="n">' + n + '</span></div>';
    }).join('') + '</div>';
  }

  function pageSample() {
    seenSample();
    var note = '<div class="qa-item"><div class="qa-q"><b>问</b><span>真的不卖吗？</span></div><div class="qa-a"><b>店主</b><span>不卖。样品只是摆着。</span></div></div>' +
      '<div class="qa-item"><div class="qa-q"><b>问</b><span>图七为什么是糊的？</span></div><div class="qa-a"><b>店主</b><span>拍虚了。老周手抖。</span></div></div>' +
      '<div class="qa-item"><div class="qa-q"><b>问</b><span>盒子能打开吗？</span></div><div class="qa-a"><b>店主</b><span>锁坏了。别试。</span></div></div>';

    var a = SAMPLE_ITEM;
    return '<div class="aq-strip">S07 · 归档区 · 只读镜像 · 不在商城目录里</div>' +
      '<div class="aq-inner">' + aqHeadHTML() +
      '<div class="aq-crumb"><span data-act="go" data-route="home">商城</span> / ' +
      '<span data-act="go" data-route="dark">S07 · 归档区</span> / 样品 · 勿拍</div>' +
      '<div class="pdp-main">' +
      '<div class="gallery"><div class="main-img">' + mainImageHTML() + '</div>' + thumbsHTML() + '</div>' +
      '<div class="pdp-info">' +
      '<div class="tagline">S07-0000 · 图 7 / 7 载入失败</div>' +
      '<h1>样品 · 勿拍</h1>' +
      '<div class="sub">黑檀木盒 · 黄铜齿轮锁 · 锁已坏，钥匙遗失</div>' +
      '<div class="pdp-price"><span class="big"><small>¥</small>0.00</span><span class="note">不发货 · 不议价 · 库存 1</span></div>' +
      '<div class="pdp-meta"><span>编号 <b>S07-0000</b></span><span>已售 <b>0</b></span><span>图 <b>7 张</b></span></div>' +
      '<div class="pdp-actions"><button class="btn-shop primary" data-act="plinth">翻第 7 张照片</button>' +
      '<button class="btn-shop ghost" data-act="nolink" data-msg="样品仅陈列。不发货，不议价。">拍下（不发货）</button></div>' +
      '<div class="pdp-notice">本件为归档样品，不参与任何交易。图片共 7 张，第 7 张载入失败——底板刻字要从外圈往里读。</div>' +
      '</div></div>' +
      '<div class="params"><table>' + a.params.map(function (r) {
        return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>';
      }).join('') + '</table></div>' +
      '<div class="detail-block"><h2>归档记录</h2><p>' + esc(a.detail) + '</p>' +
      '<div class="quote">拍照：老周 · 2026-09-07 · 图七重拍了一次，还是反光。</div></div>' +
      '<div class="review-sec"><div class="review-head"><h2>买家评价</h2><span class="r">' + a.reviews.length + ' 条</span></div>' +
      a.reviews.map(function (r) {
        return '<div class="review-item"><div class="top"><span class="avatar-dot">' + esc(r.name.slice(0, 1)) + '</span>' + esc(r.name) +
          '<span class="stars">' + r.stars + '</span><span>' + r.date + '</span></div><p>' + esc(r.text) + '</p></div>';
      }).join('') + '</div>' +
      '<div class="qa-sec"><h3>问大家（3 条 · 1 条被折叠）</h3>' + note +
      '<div class="fold-note"><span>有 1 条提问已被折叠，仅提问者与店主可见。</span>' +
      '<button data-act="fold">' + (M.folded ? '收起' : '展开') + '</button></div>' +
      '<div class="folded' + (M.folded ? ' open' : '') + '">' +
      '<div class="u"><span>布宜诺斯艾利斯的雨</span><span>2026-09-07</span></div>' +
      '<div class="qa-q"><b>问</b><span class="b64"><span class="code">U0hJUFBJTkc=</span> 还作数吗？老地方。</span>' +
      '<button class="copybtn" data-act="copy" data-copy="b64" style="margin-left:8px">复制</button></div>' +
      '<div class="qa-a"><b>店主</b><span>作数。客服只答商品，去源码里翻那段旧脚本。</span></div>' +
      '</div></div>' +
      '<div class="aq-foot"><span data-act="go" data-route="dark">← 回归档区</span><span>离开时不要留痕 · S07 / W2-11</span></div>' +
      '</div>';
  }

  function pageNotice() {
    if (!S.flags.noticeRead) {
      S.flags.noticeRead = true;
      addClue('notice', '店铺公告 · 迁移', '旧货架自 S07 起下架归档。自提批次由系统按年号分配：1947。\n官话：商品问答里别再发 U0hJUFBJTkc= 那一串。');
      checkObjectives();
    }
    return '<div class="shop-strip">店铺公告 · 只读</div>' +
      '<div class="page-inner">' + shopHead() + shopNav('notice') +
      '<div class="section-head"><h2>店铺公告</h2><span class="sub">' + NOTES.length + ' 条</span></div>' +
      NOTES.map(function (n) {
        return '<div class="review-item"><div class="top"><span>' + n.d + '</span>' +
          (n.tag ? '<span style="color:#17695f;border:1px solid #cfe0da;padding:0 5px;border-radius:3px">' + n.tag + '</span>' : '') +
          '</div><p>' + esc(n.t) + '</p></div>';
      }).join('') + footerHTML() + '</div>';
  }

  function pageOrders() {
    return '<div class="shop-strip">我的订单 · 镜像只读</div>' +
      '<div class="page-inner">' + shopHead() + shopNav('orders') +
      '<div class="section-head"><h2>我的订单</h2><span class="sub">共 1 条记录</span></div>' +
      '<div class="review-item"><div class="top"><span>20260907-0003</span><span style="color:#a4462f">已取消</span><span>2026-09-07</span></div>' +
      '<p>商品：样品 · 勿拍（S07-0000）<br>取消原因：买家未取。</p></div>' +
      '<div style="font-size:11.5px;color:#a2988a;margin-top:10px">镜像期间无法下单或查看物流。' +
      '<span class="dask" data-act="svc-open" data-id="">这一单有问题？问客服</span></div>' +
      footerHTML() + '</div>';
  }

  function cartRowHTML(id, i) {
    var p = cartProduct(id); if (!p) return '';
    var thumb = p.img
      ? '<img src="' + p.img + '" alt="">'
      : '<span class="ph">' + esc(p.name.slice(0, 1)) + '</span>';
    return '<div class="cart-row' + (p.img ? '' : ' noimg') + '"><span class="idx">' + (i + 1) + '</span>' +
      thumb +
      '<div class="ci"><b>' + esc(p.name) + '</b><small>' + esc(p.sub) + '</small></div>' +
      '<span class="pr">¥' + p.price + '</span>' +
      '<button class="rm" data-act="cart-rm" data-i="' + i + '" title="移出">×</button></div>';
  }

  function pageCart() {
    var n = M.cart.length;
    var four = M.cart.filter(function (id) { return CFG.cartOrder.indexOf(id) >= 0; }).length;
    var ok = S.flags.cartReady;
    return '<div class="shop-strip">自提单 · 离线镜像 · 仅自提</div>' +
      '<div class="page-inner">' + shopHead() + shopNav('cart') +
      '<div class="section-head"><h2>购物车</h2><span class="sub">' + n + ' 件 · 冬歇期只走自提</span></div>' +
      '<div class="cart-wrap">' +
      '<div class="cart-list">' +
      (n ? M.cart.map(cartRowHTML).join('') :
        '<div class="cart-empty">车是空的。<br>日用百货都在「全部商品」里，一件一件加进来。</div>') +
      (four && four < 4 ? '<div class="cart-tail">这单还差 ' + (4 - four) + ' 件。一共四件。</div>' : '') +
      (four > 4 ? '<div class="cart-tail warn">多了 ' + (four - 4) + ' 件。这一单只有四件。</div>' : '') +
      (n > four ? '<div class="cart-tail">日用品 ' + (n - four) + ' 件单独走普通货，不占自提单。' : '') +
      '</div>' +
      '<div class="cart-side">' +
      '<div class="cart-total"><span>合计</span><b>¥' + cartTotal() + '</b></div>' +
      '<button class="btn-shop primary" data-act="checkout">' + (ok ? '再次前往自提点' : '结算 · 前往自提点') + '</button>' +
      '<div class="cart-msg ' + (ok ? 'ok' : '') + '" data-cart-msg>' + (ok ? '单子已受理 · 自提点 kestrel.1947' : '') + '</div>' +
      '<p class="cart-note">次序对不上，系统就不给自提点。冬歇期间没有别的通道。' +
      '<span class="dask" data-act="svc-open" data-id="">单子有问题？问客服</span></p>' +
      '</div></div>' +
      footerHTML() + '</div>';
  }

  /* 日用品归商城的货架：正常在售、带价格和库存、可以直接加购。
     暗门那一页不再摆它们 —— 那一页只留没编进目录的条目。 */
  var DAILY = [
    { id: 'd1', name: '抽取式纸巾', sub: '3 层 · 120 抽', price: '12.90', unit: '包', stock: '240', sales: 1863,
      img: 'https://aka.doubaocdn.com/s/wS3DWzDeRd',
      review: '和电池、毛巾、洗洁精拼的一单。纸巾是这单第一件——先擦手。',
      params: [['规格', '3 层 · 120 抽 / 包'], ['材质', '原生木浆'], ['单张尺寸', '190 × 130 mm'], ['装箱', '24 包 / 箱'], ['保质期', '3 年']],
      detail: '一箱二十四包，压花面朝上用。厂里发的那种，柔软、不掉屑，擦完手不黏。冬歇前最后一批，压在三号仓二层。',
      reviews: [
        { name: '买过三次的人', stars: '★★★★★', date: '2026-11-08', text: '和电池、毛巾、洗洁精拼的一单。纸巾是这单第一件——先擦手。' },
        { name: '夜班 · 老 K', stars: '★★★★☆', date: '2026-10-30', text: '纸够厚，不掉屑。就是出库慢，冬歇前别囤太多。' },
        { name: '匿名', stars: '★★★☆☆', date: '2026-10-12', text: '抽的时候一次带出两张，有点费。' }
      ],
      qa: [
        { s: '还发货吗？', k: '发货|快递|物流|20 号|冬歇', a: '19 号之前下单还能出库；20 号起暂停发货，只走自取。' },
        { s: '掉屑吗？', k: '掉屑|屑|质量', a: '原生木浆，擦手不掉屑；压花面朝外更服帖。' },
        { s: '能便宜吗？', k: '便宜|优惠|打折|少点', a: '不议价。冬歇清仓，这一包已经到底了。' }
      ] },
    { id: 'd2', name: '洗洁精', sub: '1.5 L · 柠檬', price: '19.90', unit: '瓶', stock: '96', sales: 742,
      img: 'https://aka.doubaocdn.com/s/CaOTK5jq5g',
      review: '第二件。纸巾擦完才洗，别弄反。',
      params: [['容量', '1.5 L'], ['香型', '柠檬'], ['用途', '餐具 / 果蔬'], ['稀释', '1 : 200'], ['保质期', '2 年']],
      detail: '一瓶兑两百份水，够洗一个月的碗。按压泵口，冬天手冷别硬拧。瓶身没标签的那批，编号印在底上。',
      reviews: [
        { name: '隔壁厂 · 老周', stars: '★★★★★', date: '2026-11-09', text: '第二件。纸巾擦完才洗，别弄反。' },
        { name: '匿名', stars: '★★★★☆', date: '2026-10-20', text: '去油可以，冲两遍就没味了。' },
        { name: '匿名', stars: '★★★☆☆', date: '2026-09-28', text: '泵头有点紧，别的都行。' }
      ],
      qa: [
        { s: '冲得干净吗？', k: '干净|残留|冲', a: '两遍水就干净，泡沫不多，洗完不用再擦。' },
        { s: '能洗别的吗？', k: '洗什么|餐具|水果|别的', a: '碗筷和果蔬可以；别碰伤口，也别和漂白水混着用。' },
        { s: '20 号以后还能下单吗？', k: '下单|20 号|冬歇', a: '20 号起下单通道关了，只能自取。' }
      ] },
    { id: 'd3', name: '一次性拖鞋', sub: '均码 · 无纺布', price: '4.50', unit: '双', stock: '400', sales: 5210,
      img: 'https://aka.doubaocdn.com/s/vXVBA6tGso',
      review: '单买的，出差带着方便。',
      params: [['尺码', '均码 · 36–45'], ['材质', '无纺布 + EVA 底'], ['鞋底', '8 mm'], ['包装', '一双 / 袋 · 独立'], ['用途', '客房 / 出差 / 酒店']],
      detail: '一次性的，但底不薄。出差带着，进屋换上，别直接踩地毯。整箱是 100 双，拆卖按双算。',
      reviews: [
        { name: '出差的人', stars: '★★★★☆', date: '2026-11-06', text: '单买的，出差带着方便。' },
        { name: '匿名', stars: '★★★★☆', date: '2026-10-21', text: '比酒店那种厚一点，底不硌脚。' },
        { name: '匿名', stars: '★★★☆☆', date: '2026-09-15', text: '均码，脚特别大的勉强。' }
      ],
      qa: [
        { s: '均码能穿多大？', k: '尺码|多大|码数|码', a: '36 到 45 都塞得进去，底是软的，不挤脚。' },
        { s: '湿水会滑吗？', k: '滑|湿|浴室', a: '底有纹，湿了会滑一点，浴室里慢点走。' },
        { s: '一袋几双？', k: '几双|一袋|数量', a: '一双一袋，独立包装，不串味。' }
      ] },
    { id: 'd4', name: '保温杯 500 ml', sub: '不锈钢 · 双层', price: '89.00', unit: '个', stock: '130', sales: 318,
      img: 'https://aka.doubaocdn.com/s/GMKVyUl6Dw',
      review: '单买。装一杯能顶一天。',
      params: [['容量', '500 ml'], ['材质', '304 不锈钢 · 双层'], ['保温', '6 小时 ≥ 60 ℃'], ['口径', '5 cm'], ['附件', '旋盖 · 滤网']],
      detail: '双层真空，装一杯顶一天。杯口窄，洗的时候用刷子。杯身有一道划痕，出库时蹭的，不算残次。',
      reviews: [
        { name: '匿名', stars: '★★★★☆', date: '2026-11-03', text: '单买。装一杯能顶一天。' },
        { name: '匿名', stars: '★★★★★', date: '2026-11-01', text: '掉地上一次，杯身没凹。' },
        { name: '匿名', stars: '★★★☆☆', date: '2026-10-05', text: '有点重，通勤带着累。' }
      ],
      qa: [
        { s: '能保温多久？', k: '保温|多久|热', a: '装满开水，六小时还有六十度，够撑一个上午。' },
        { s: '装茶会有味吗？', k: '味|茶|串味', a: '不锈钢内壁不吸味，喝完及时冲就行。' },
        { s: '杯身那道划痕？', k: '划痕|瑕疵|伤', a: '出库蹭的，不影响用；介意可以换别件。' }
      ] },
    { id: 'd5', name: '白毛巾', sub: '34 × 76 cm · 纯棉', price: '15.00', unit: '条', stock: '88', sales: 906,
      img: 'https://aka.doubaocdn.com/s/PqCW7Uxx1h',
      review: '第三件。洗完擦干，毛巾就该第三件。',
      params: [['尺寸', '34 × 76 cm'], ['材质', '纯棉 · 32 支'], ['克重', '380 g'], ['工艺', '平织 · 无绣字'], ['洗涤', '40 ℃ 以下']],
      detail: '厚实的一条，洗三次会更软。第一次洗会掉一点浮毛，正常。仓库里那批标签缝在角上，洗完别剪。',
      reviews: [
        { name: '匿名', stars: '★★★★★', date: '2026-11-07', text: '第三件。洗完擦干，毛巾就该第三件。' },
        { name: '匿名', stars: '★★★★☆', date: '2026-10-18', text: '吸水快，不掉毛。' },
        { name: '匿名', stars: '★★★☆☆', date: '2026-09-30', text: '第一次洗有浮毛，之后就好了。' }
      ],
      qa: [
        { s: '掉毛吗？', k: '掉毛|毛', a: '头两次洗会掉点浮毛，之后就不掉了。' },
        { s: '会缩水吗？', k: '缩水|洗|尺寸', a: '会缩一点，三四个点，不影响用。' },
        { s: '能机洗吗？', k: '机洗|洗衣机', a: '能，装洗衣袋，别跟带拉链的一起搅。' }
      ] },
    { id: 'd6', name: '牙膏 120 g', sub: '薄荷 · 防蛀', price: '9.90', unit: '支', stock: '210', sales: 1544,
      img: 'https://aka.doubaocdn.com/s/o8aiqU5ieK',
      review: '单买的，囤着慢慢用。',
      params: [['净含量', '120 g'], ['香型', '薄荷'], ['功效', '防蛀 · 含氟'], ['适用', '成人'], ['保质期', '3 年']],
      detail: '氟含量 0.14%，薄荷不冲。冬天水管冷，先漱口再刷。管子软，挤到后面费点劲。',
      reviews: [
        { name: '匿名', stars: '★★★★☆', date: '2026-11-04', text: '单买的，囤着慢慢用。' },
        { name: '匿名', stars: '★★★★★', date: '2026-10-22', text: '薄荷不辣嘴，早起刷完不齁。' },
        { name: '匿名', stars: '★★★☆☆', date: '2026-10-02', text: '管子软，挤到后面费劲。' }
      ],
      qa: [
        { s: '薄荷冲不冲？', k: '薄荷|辣|冲', a: '不冲，凉的但不辣嘴。' },
        { s: '含氟吗？', k: '氟|防蛀', a: '含氟 0.14%，防蛀够用；小孩别用这支。' },
        { s: '保质期多久？', k: '保质期|过期|多久', a: '三年，管子尾部有钢印日期。' }
      ] },
    { id: 'd7', name: '封箱胶带', sub: '48 mm × 100 m', price: '6.50', unit: '卷', stock: '60', sales: 289,
      img: 'https://aka.doubaocdn.com/s/29TmDaWYoA',
      review: '单拍，封箱子用。',
      params: [['规格', '48 mm × 100 m'], ['材质', 'BOPP · 透明'], ['厚度', '45 μm'], ['适用', '纸箱封口'], ['耐温', '-10 ~ 60 ℃']],
      detail: '一卷一百米，封十个箱子够用。冬天冷，粘之前先用手把胶面捂热。切口的边不好找，顺着划痕扯。',
      reviews: [
        { name: '匿名', stars: '★★★★☆', date: '2026-11-02', text: '单拍，封箱子用。' },
        { name: '匿名', stars: '★★★★☆', date: '2026-10-14', text: '粘得住，撕的时候不留胶。' },
        { name: '匿名', stars: '★★★☆☆', date: '2026-09-25', text: '低温下确实差一点。' }
      ],
      qa: [
        { s: '粘得住纸箱吗？', k: '粘|纸箱|牢', a: '普通纸箱一贴就牢，粗糙面多压一道。' },
        { s: '冬天粘不住？', k: '冬天|低温|冷', a: '先把胶面捂热，贴完压三十秒。' },
        { s: '一卷多长？', k: '多长|米|长度', a: '100 米，封十个中等箱子差不多。' }
      ] },
    { id: 'd8', name: '五号电池', sub: '碱性 · 12 粒', price: '24.90', unit: '板', stock: '150', sales: 1120,
      img: 'https://aka.doubaocdn.com/s/NS2ssQ4Pq0',
      review: '这一单最后一件。屋里那盏灯不亮就换它。',
      params: [['型号', 'AA · 五号'], ['类型', '碱性'], ['电压', '1.5 V'], ['规格', '12 粒 / 板'], ['保存', '阴凉 · 别混放']],
      detail: '碱性 12 粒一板，日期新。别新旧混着用，漏液的多半是混放。屋里那盏灯不亮，先换它。',
      reviews: [
        { name: '匿名', stars: '★★★★★', date: '2026-11-10', text: '这一单最后一件。屋里那盏灯不亮就换它。' },
        { name: '匿名', stars: '★★★★☆', date: '2026-10-25', text: '电量足，遥控器能用一年。' },
        { name: '匿名', stars: '★★★☆☆', date: '2026-09-19', text: '有一粒外壳有点划。' }
      ],
      qa: [
        { s: '能用多久？', k: '多久|续航|电量', a: '遥控器、手电这类小电器，一年往上；闪光灯就短。' },
        { s: '会漏液吗？', k: '漏液|漏|坏', a: '别新旧混用、别放暖气边，正常不会漏。' },
        { s: '一板几粒？', k: '几粒|数量|一板', a: '十二粒一板，不拆卖。' }
      ] }
  ];

  /* 没指向具体商品时（总台 / 旧货线）用这三句。 */
  var GEN_QA = [
    { s: '样品什么时候发货？', k: '样品', a: '样品仅陈列，不发货、不议价。' },
    { s: '冬歇之后还开吗？', k: '冬歇|开门|开张|之后', a: '11 月 20 日起冬歇，明年见。' },
    { s: '我的单子有问题找谁？', k: '单子|订单|售后', a: '报单号。我这边只能查镜像里的记录。' }
  ];

  function dailyHTML() {
    var cards = DAILY.map(function (d) {
      var i = M.cart.indexOf(d.id);
      return '<div class="dcard"><div class="dthumb" data-act="go" data-route="item:' + d.id + '">' +
        '<img src="' + d.img + '" alt="' + esc(d.name) + '" loading="lazy" ' +
        'onerror="this.parentNode.classList.add(\'miss\')"><span>' + esc(d.name) + '</span></div>' +
        '<div class="dbody"><b data-act="go" data-route="item:' + d.id + '">' + esc(d.name) + '</b>' +
        '<small>' + esc(d.sub) + '</small>' +
        '<span class="dp">¥' + d.price + '<em> / ' + d.unit + '</em></span>' +
        '<p class="drev">“' + esc(d.review) + '”<em>买家 · ' + d.sales + ' 人买过</em></p>' +
        '<div class="dfoot"><button class="add' + (i >= 0 ? ' in' : '') + '" data-act="cart-add" data-id="' + d.id + '">' +
        (i >= 0 ? '已在车 · 第 ' + (i + 1) + ' 件' : '加入购物车') + '</button>' +
        '<span class="dask" data-act="go" data-route="item:' + d.id + '">详情</span>' +
        '<span class="dask" data-act="svc-open" data-id="' + d.id + '">问客服</span></div></div></div>';
    }).join('');
    return '<div class="daily">' +
      '<div class="section-head"><h2>日用百货</h2><span class="sub">' + DAILY.length + ' 件 · 常年有货</span></div>' +
      '<div class="dgrid">' + cards + '</div>' +
      '<p class="dnote">旧货架已经下架归档了，这一页只剩下日子要用的东西。</p></div>';
  }

  /* 暗门那一页：和商城共用同一个头部、同一套导航、同一张页脚，
     但只放不在目录里的东西（D-09…D-14）。交接单另要盘点口令。 */
  var ODD = [
    { id: 'D-09', name: '低温保温箱', spec: '3 L · 编号已磨掉', price: '面议', stock: '1', note: '07:40 布宜诺斯艾利斯 · 待取' },
    { id: 'D-10', name: '空白证件', spec: '四国 · 未填写', price: '面议', stock: '12', note: '不出境也得备着' },
    { id: 'D-11', name: '现金袋', spec: '未清点', price: '面议', stock: '2', note: '交接前再点' },
    { id: 'D-12', name: 'SIM 卡', spec: '未激活 · 一次性', price: '面议', stock: '30', note: '每批换一张' },
    { id: 'D-13', name: '一次性手套', spec: '无粉 · 400 副', price: '面议', stock: '400', note: '不留指纹' },
    { id: 'D-14', name: 'N-17', spec: '货物：夜莺 ×1', price: '待取', stock: '1', note: '07:40 布宜诺斯艾利斯 · 委托人 —', hot: true }
  ];

  function lockHTML() {
    return '<div class="aq-lock">' +
      '<div class="lk"><b>交接单还锁着</b><span>盘点口令才调得出来</span></div>' +
      '<div class="aq-row"><input data-dark-code placeholder="盘点口令" autocomplete="off" spellcheck="false">' +
      '<button data-act="dark-enter">核对</button></div>' +
      '<div class="aq-msg" data-dark-msg></div>' +
      '<div data-dark-log></div>' +
      '</div>';
  }

  function aqTable() {
    return '<table class="aq-table"><thead><tr><th>编号</th><th>品名</th><th>规格</th><th>价格</th><th>库存</th><th>备注</th></tr></thead><tbody>' +
      ODD.map(function (r) {
        return '<tr' + (r.hot ? ' class="hot"' : '') + '><td class="code">' + r.id + '</td>' +
          '<td class="name">' + r.name + '</td><td class="dim">' + r.spec + '</td>' +
          '<td class="price">' + r.price + '</td><td>' + r.stock + '</td><td class="note">' + r.note + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td colspan="6">补给单正文不在镜像里。这 6 条没编进目录，编号接在 D-08 后面。</td></tr></tfoot></table>';
  }

  function codeOf(a) {
    var row = (a.params || []).filter(function (x) { return x[0] === '型号'; })[0];
    return row ? row[1] : (a.code || '—');
  }

  var SAMPLE_ITEM = {
    id: 's07', name: '样品 · 勿拍', sub: '黑檀木盒 · 黄铜齿轮锁 · 锁已坏', price: '0.00',
    img: A.samplebox, code: 'S07-0000', plinth: true,
    params: [
      ['编号', 'S07-0000'], ['材质', '黑檀木 / 黄铜'], ['尺寸', '180 × 120 × 90 mm'],
      ['状态', '锁已坏 · 不可开启'], ['归档', '2026-09-12 · 三号仓二层']
    ],
    detail: '照 1947 年那批的盒子做的，锁早就坏了，谁也没打开过。图一共七张，第七张拍虚了——底板那块刻字要从外圈往里读。',
    reviews: [
      { name: '夜班 · 老周', stars: '★★☆☆☆', date: '2026-09-20', text: '锁坏了。别试，试了也开不了。' },
      { name: '匿名', stars: '★☆☆☆☆', date: '2026-10-02', text: '第七张拍虚了。就这样留着吧。' }
    ]
  };

  /* 未登记件：图像一律遮蔽，只给编号和大类。 */
  var SHADOW = [
    { id: 'X-01', name: '无编号冷藏箱', sub: '2 号箱 · 温度未标', price: '面议', lv: 'B', note: '不出库 · 需委托人确认' },
    { id: 'X-02', name: '成套证件', sub: '五国 · 已盖章', price: '面议', lv: 'B', note: '不出库 · 分批取' },
    { id: 'X-03', name: '一次性手机', sub: '十台装 · 未激活', price: '面议', lv: 'B', note: '不出库 · 每批换' },
    { id: 'X-04', name: '长条箱 · 铅封', sub: '1.8 m · 货号已涂', price: '需口令', lv: 'C', note: '只在交接单上出现' },
    { id: 'X-05', name: 'N-17', sub: '货物：夜莺 ×1', price: '待取', lv: 'C', note: '07:40 布宜诺斯艾利斯 · 委托人 —', hot: true }
  ];

  function aqCard(a) {
    return '<div class="aqcard" data-act="go" data-route="item:' + (a.id || 's07') + '" title="查看归档记录">' +
      '<div class="aqthumb"><img src="' + a.img + '" alt="">' +
      (a.plinth ? '<span class="aqbadge warn">7 / 7 载入失败</span>' : '<span class="aqbadge">已归档</span>') + '</div>' +
      '<div class="aqbody"><b>' + esc(a.name) + '</b><small>' + esc(a.sub) + '</small>' +
      '<div class="aqmeta"><span>' + esc(codeOf(a)) + '</span><span class="aqp">¥' + a.price + '</span></div></div>' +
      (a.plinth ? '<button class="aqmore" data-act="plinth">翻第 7 张照片</button>' : '') +
      '</div>';
  }

  function shadowCard(s) {
    return '<div class="aqcard blur' + (s.hot ? ' hot' : '') + '" data-act="go" data-route="item:' + s.id + '">' +
      '<div class="aqmask"><span class="lvt">分级 ' + s.lv + '</span></div>' +
      '<div class="aqbody"><b>' + esc(s.name) + '</b><small>' + esc(s.sub) + '</small>' +
      '<div class="aqmeta"><span>' + s.id + '</span><span class="aqp">' + s.price + '</span></div>' +
      '<div class="shnote">' + esc(s.note) + '</div></div>' +
      '<div class="aqbadge film">图像已遮蔽</div>' +
      '</div>';
  }

  function aqHeadHTML() {
    return '<div class="aq-head"><span class="mk">' + svg('i-whale') + '</span>' +
      '<div class="tt"><b>S07 旧货架</b><small>归档区 · 只出库给自提单</small></div>' +
      '<span class="aq-tag">ARCHIVE / W2-11</span></div>';
  }

  function pageDark() {
    if (!S.flags.kestrelOpen) {
      S.flags.kestrelOpen = true;
      sfx('ok');
      toast('已进门', 'S07 · 归档区。商城目录上没有这一页。', 'success');
      addClue('odd', '不在目录上的条目', 'D-09…D-14：低温箱、空白证件、现金袋、SIM 卡、手套，全写「面议」。\nD-14 是 N-17，货物写「夜莺 ×1」，07:40 布宜诺斯艾利斯 · 待取。\n未登记件 X-01…X-05 一律遮蔽，只给编号。');
      checkObjectives();
    }
    return '<div class="aq-strip">S07 · 归档区 · 只读镜像 · 不在商城目录里</div>' +
      '<div class="aq-inner">' +
      aqHeadHTML() +
      '<div class="aq-crumb"><span data-act="go" data-route="home">商城</span> / S07 · 归档区</div>' +
      '<div class="aq-sec"><b>归档件 · 8 件</b><span>全部下架 · 不再上架</span></div>' +
      '<div class="aqgrid">' + PRODUCTS.map(aqCard).join('') + aqCard(SAMPLE_ITEM) + '</div>' +
      '<div class="aq-sec"><b>未登记件 · 5 件</b><span>图像一律遮蔽 · 只认编号</span></div>' +
      '<div class="aqgrid four">' + SHADOW.map(shadowCard).join('') + '</div>' +
      '<div class="aq-sec"><b>不在目录上的条目</b><span>6 条 · 未上架 · 仅内网可见</span></div>' +
      aqTable() +
      (S.flags.ledgerSeen ? ledgerHTML() : lockHTML()) +
      '<div class="aq-foot"><span data-act="go" data-route="home">← 回商城</span>' +
      '<span>离开时不要留痕 · S07 / W2-11</span></div>' +
      '</div>';
  }

  /* 每件商品挂在它自己品牌的「官方旗舰店」上（店名 + 短名 + 品类线），
     后端是同一套自动应答；会话按商品分开存，互不串台。 */
  var CS = {
    d1: { n: '柔序官方旗舰店', s: '柔序', l: '纸品' },
    d2: { n: '洁澈官方旗舰店', s: '洁澈', l: '清洁' },
    d3: { n: '步安官方旗舰店', s: '步安', l: '鞋服' },
    d4: { n: '恒暖官方旗舰店', s: '恒暖', l: '器具' },
    d5: { n: '棉野官方旗舰店', s: '棉野', l: '织物' },
    d6: { n: '净齿官方旗舰店', s: '净齿', l: '个护' },
    d7: { n: '固封官方旗舰店', s: '固封', l: '耗材' },
    d8: { n: '劲鹿官方旗舰店', s: '劲鹿', l: '五金' }
  };

  function svcBot() {
    var p = svcTopicProduct();
    if (!p) return { n: '鲸选商城官方旗舰店', s: '鲸选', l: '售后', m: '售后总台 · 自动应答 · 在线' };
    var b = CS[p.id] || { n: '鲸选旧货官方旗舰店', s: '鲸选旧货', l: '旧货' };
    return { n: b.n, s: b.s, l: b.l, m: b.l + ' · 自动应答 · 在线' };
  }

  function svcThread() {
    var k = M.svc.topic || '_';
    if (!M.svc.threads[k]) M.svc.threads[k] = { msgs: [] };
    return M.svc.threads[k];
  }

  function svcMsgsHTML() {
    var bot = svcBot(), th = svcThread();
    return th.msgs.map(function (m) {
      return '<div class="svc-msg' + (m.who === 'me' ? ' me' : '') + (m.who === 'sys' ? ' sys' : '') + '">' +
        '<span class="who">' + (m.who === 'me' ? '你' : esc(m.nm || bot.n)) + ' · ' + m.t + '</span>' + m.html + '</div>';
    }).join('');
  }

  function svcTopicProduct() {
    return M.svc.topic ? cartProduct(M.svc.topic) : null;
  }

  function svcTopicName() {
    var p = svcTopicProduct();
    return p ? p.name : '';
  }

  function pageService() {
    var prod = svcTopicProduct();
    var topic = prod ? prod.name : '';
    var bot = svcBot(), th = svcThread();
    if (!th.msgs.length) {
      th.msgs.push({ who: 'bot', nm: bot.n, t: nowStr(), html: '您好，这里是「' + esc(bot.n) + '」。自动应答只处理商品问题；11 月 20 日起冬歇，发货与退换暂停。' });
      th.msgs.push({ who: 'bot', nm: bot.n, t: nowStr(), html: topic ? '这一件是「' + esc(topic) + '」——有什么问题？' : '请问要咨询哪一件？' });
    }
    return '<div class="shop-strip">商品咨询 · 自动应答 · 镜像只读</div>' +
      '<div class="page-inner">' + shopHead() + shopNav('') +
      '<div class="service-wrap">' +
      '<div class="service-head"><div class="av">' + svg('i-whale') + '</div>' +
      '<div class="id"><b>' + esc(bot.n) + '</b><small>' + esc(bot.m) + '</small></div>' +
      '<div class="badge">三号仓 · 在线</div></div>' +
      '<div class="svc-topic">' + (topic
        ? '正在咨询：<b>' + esc(topic) + '</b>'
        : '未指向具体商品 —— 从商品卡上的「问客服」进来更准') + '</div>' +
      (prod ? '<div class="svc-prod"><img src="' + prod.img + '" alt="">' +
        '<div class="pp"><b>' + esc(prod.name) + '</b><small>' + esc(prod.sub) + '</small>' +
        '<span class="ppr">¥' + prod.price + ' <em>/ ' + prod.unit + '</em> · 这一件还没下单</span></div></div>' : '') +
      '<div class="svc-body" data-svc-body>' + svcMsgsHTML() + '</div>' +
      '<div class="svc-quick">' + svcQuickHTML() + '</div>' +
      '<div class="svc-input"><input data-svc-input placeholder="给 ' + esc(bot.s || bot.n) + ' 留言…">' +
      '<button data-act="svc-send">发送</button></div>' +
      '<div style="font-size:10.5px;color:#a2988a;margin-top:8px;line-height:1.7">自动应答只处理业务关键词。本路会话只对这一件，换商品会另起一路。</div>' +
      '</div>' + footerHTML() + '</div>';
  }

  /* 快捷提问跟商品走：每家店有自己那三句（数据挂在 DAILY.qa 上）。 */
  function svcQA() {
    var p = svcTopicProduct();
    return (p && p.qa && p.qa.length) ? p.qa : GEN_QA;
  }

  function svcQuickHTML() {
    return svcQA().map(function (x) {
      return '<button data-act="svc-quick" data-q="' + esc(x.s) + '">' + esc(x.s) + '</button>';
    }).join('');
  }

  function paintService() {
    var app = $('.win[data-app="mall"]'); if (!app) return;
    var body = $('[data-svc-body]', app); if (!body) return;
    body.innerHTML = svcMsgsHTML();
    body.scrollTop = body.scrollHeight;
  }

  function serviceReply(raw) {
    var t = raw.toLowerCase();
    var decoded = '';
    try { decoded = b64decode(raw); } catch (e) { decoded = ''; }
    if (/shipping/.test(t) || /shipping/i.test(decoded)) return '这不是商品关键词。自动应答只认发货、退换、尺码这类词。';
    /* 先按这一件自己的问答表答，答不上的再走通用关键词。 */
    var qa = svcQA();
    for (var i = 0; i < qa.length; i++) {
      try { if (new RegExp(qa[i].k).test(raw)) return qa[i].a; } catch (e) {}
    }
    if (/发货|快递|物流|寄/.test(t)) return '11 月 20 日起冬歇，暂停发货。急件请自取。';
    if (/样品/.test(t)) return '样品仅陈列，不发货、不议价。';
    if (/退|换|退款/.test(t)) return '镜像期间不办理退换。';
    if (/图七|糊|拍虚|图 7/.test(t)) return '图七是拍虚的，老周手抖。';
    if (/便宜|优惠|打折|少点/.test(t)) return '不议价。冬歇清仓，价格已经到底。';
    if (/在吗|你好|您好|谁/.test(t)) return '在的，请说这一件的问题。';
    return '这个问题我记下了，稍后回您。';
  }

  function svcSend(q) {
    var app = $('.win[data-app="mall"]'); if (!app) return;
    var input = $('[data-svc-input]', app);
    var text = (q != null ? q : (input ? input.value : '')).trim();
    if (!text) return;
    if (input) input.value = '';
    var th = svcThread(), bot = svcBot();
    th.msgs.push({ who: 'me', t: nowStr(), html: esc(text) });
    paintService(); sfx('send');
    setTimeout(function () {
      var reply = serviceReply(text);
      var sys = /通道 07 已切换/.test(reply);
      th.msgs.push({ who: sys ? 'sys' : 'bot', nm: sys ? '系统' : bot.n, t: nowStr(), html: reply });
      paintService(); sfx('recv');
    }, 520);
  }

  /* ---------------- 源码面板 ---------------- */
  function pageSource() {
    var map = {
      'item:s07': [
        '<!DOCTYPE html>',
        '<html lang="zh-CN">',
        '<!-- 三号仓镜像 / 样品页 S07-0000 / 维护：老周 -->',
        '<!-- TODO(老周): 图七重拍。底板反光，字全是反的。 -->',
        '<div class="item" data-sku="S07-0000">',
        '  <h1>样品 · 勿拍</h1>',
        '  <div class="price">0.00</div>',
        '<!-- 客服通道那套 10 月拆了，旧脚本还在 service 页源码里 -->',
        '  <div class="gallery">',
        '    ... 7 张，第 7 张 404 ...',
        '  </div>',
        '  <!-- 问大家：折叠的那条不要删，店主还要用 -->',
        '</div>',
        '</html>'
      ],
      home: [
        '<!DOCTYPE html>',
        '<html lang="zh-CN">',
        '<!-- 首页 / 镜像缓存 2026-11-19 03:12 -->',
        '<!-- 旧货架自 S07 起下架归档，目录里不再有 -->',
        '<div class="hero">...过冬的东西，这一页都有...</div>',
        '<div class="grid">...8 件日用百货...</div>',
        '<!-- 冬歇前把旧货架处理掉。老周 -->',
        '<!-- 客服通道 10 月拆了，旧脚本没删，扔在 service 页的源码里。 -->',
        '</html>'
      ],
      service: [
        '<!DOCTYPE html>',
        '<html lang="zh-CN">',
        '<!-- 商品问答 / 自动应答 v1.0 / 维护：老周 -->',
        '<div class="service">',
        '  <div class="head">自动应答 · 只认商品关键词</div>',
        '  <div class="qa">发货 / 退换 / 尺码 / 保质期 …</div>',
        '</div>',
        '<!-- 下面这段是 2026-10 拆下来的旧客服脚本，先别删，账还没结 -->',
        '<!-- channel.js v3 / 只留通道 7 -->',
        '<!-- openChannel(7): if (msg === "SHIPPING") return CH[7].morse(); -->',
        '<!-- CH[7].morse = "—·—  ——···"   // 两段，空格分开 -->',
        '<!-- CH[7].rule  = "四件日用品 · 次序照买家评价" -->',
        '<!-- 门不认地址栏。这段一删，门就再也开不了了。 -->',
        '</html>'
      ],
      dark: [
        '<!DOCTYPE html>',
        '<!-- S07 归档区 / 不在商城目录里 -->',
        '<!-- 只能由自提单跳进来。地址栏直连不给解析。 -->',
        '<div class="archive">S07 旧货架</div>',
        '  <div class="grid">...归档件 8 件（含样品 S07-0000 的坏图）...</div>',
        '  <div class="grid masked">...X-01…X-05，图像一律遮蔽...</div>',
        '  <!-- 不在目录上的条目 D-09…D-14，编号接在 D-08 后面 -->',
        '  <form action="/ledger">',
        '    <input name="code" placeholder="盘点口令">',
        '  </form>',
        '  <!-- 口令在摩斯里，不在页面上。 -->',
        '</html>'
      ],
      cart: [
        '<!DOCTYPE html>',
        '<!-- 购物车 / 自提单模块：冬歇期唯一还活着的入口 -->',
        '<!-- TODO(老周): 买家在评语里写了「第几件」，别删。删了单子就配不上。 -->',
        '<form class="cart" action="/checkout" method="post">',
        '  <!-- 批次由系统按年号自己填，买家不用写。 -->',
        '  <button>结算 · 前往自提点</button>',
        '</form>',
        '<!-- 自提点不写在这儿。系统按单子分配。 -->'
      ]
    };
    var lines = map[M.route] || [
      '<!DOCTYPE html>',
      '<!-- 镜像页 / ' + esc(M.route) + ' -->',
      '<!-- 内容由三号仓镜像生成，交易功能已停用 -->',
      '<p>离线只读页面。</p>'
    ];
    return '<div class="source-panel">' + lines.map(function (l) {
      return (/^\s*<!--/.test(l) || /<!--/.test(l)) ? '<span class="cm">' + esc(l) + '</span>' : esc(l);
    }).join('\n') + '</div>';
  }

  /* 源码面板打开时看一眼：service / home 的源码里那段旧脚本一露脸，就算接上通道 07。 */
  function sourceGate() {
    if (S.flags.channelOpen) return;
    var app = $('.win[data-app="mall"]'); if (!app) return;
    var pan = $('.source-panel', app); if (!pan) return;
    if (!/openChannel\(7\)/.test(pan.textContent)) return;
    S.flags.channelOpen = true;
    addClue('src', '页面源码 · 拆掉的客服脚本', 'service 页源码留着 channel.js v3：\nopenChannel(7): if (msg === "SHIPPING") return CH[7].morse();\nCH[7].morse = —·—  ——···（两段，空格分开）\nCH[7].rule = 四件日用品 · 次序照买家评价');
    toast('源码里有东西', '旧客服脚本没删干净：openChannel(7) 还留着。', 'success');
    sfx('ok');
    checkObjectives();
    setTimeout(function () {
      dm('客服只会答商品。<em>service 页的源码</em>里有一段拆掉的旧脚本，两段摩斯在那儿。', 1200);
    }, 500);
  }

  function showPlinth() {
    if (!S.flags.noteRead) {
      S.flags.noteRead = true;
      addClue('note', '底板刻字 · S07-0000', '三行由外向内倒刻：门不认地址栏 / 四件日用品，次序在买家评价里 / 口令在 service 页源码那两段摩斯里。');
      checkObjectives();
    }
    modal('<div class="eyebrow">归档件 S07-0000 · 图 7 / 载入失败</div><h2>底板刻字</h2>' +
      '<p style="font-family:var(--mono);line-height:2;color:#9fd8cb;letter-spacing:.04em">' +
      '把照片翻过来，字是从外圈往里刻的。<br>' +
      '…… 门不认地址栏。<br>' +
      '…… 四件日用品，次序写在买家评价里。<br>' +
      '…… 交接单的口令，在 service 页源码那两段摩斯里。</p>' +
      '<div class="modal-actions"><button class="btn primary" data-act="help-close">记下了</button></div>', false);
    sfx('ok');
  }

  function mallAct(act, el) {
    if (act === 'go') { mallGo(el.dataset.route); return; }
    if (act === 'tab-close') { closeApp('mall'); return; }
    if (act === 'dark-enter') { darkEnter(); return; }
    if (act === 'cart-add') { cartAdd(el.dataset.id); return; }
    if (act === 'cart-rm') { cartRemove(+el.dataset.i); return; }
    if (act === 'checkout') { submitOrder(); return; }
    if (act === 'back') { if (M.idx > 0) { M.idx--; M.route = M.hist[M.idx]; M.src = false; renderMallPage(); } return; }
    if (act === 'fwd') { if (M.idx < M.hist.length - 1) { M.idx++; M.route = M.hist[M.idx]; M.src = false; renderMallPage(); } return; }
    if (act === 'home') { mallGo('home'); return; }
    if (act === 'reload') { renderMallPage(); sfx('open'); return; }
    if (act === 'source') { M.src = !M.src; renderMallPage(); if (M.src) sourceGate(); return; }
    if (act === 'img') {
      M.img = +el.dataset.i;
      if (M.img === 7) seenNote();
      renderMainImage();
      return;
    }
    if (act === 'fold') {
      M.folded = !M.folded;
      if (M.folded) seenFold();
      var f = $('.folded', $('.win[data-app="mall"]'));
      if (f) f.classList.toggle('open', M.folded);
      var btn = $('[data-act="fold"]', $('.win[data-app="mall"]'));
      if (btn) btn.textContent = M.folded ? '收起' : '展开';
      return;
    }
    if (act === 'copy') { doCopy(el.dataset.copy, el); return; }
    if (act === 'plinth') { showPlinth(); return; }
    if (act === 'search') { doSearch(); return; }
    if (act === 'svc-send') { svcSend(); return; }
    if (act === 'svc-open') { M.svc.topic = el.dataset.id || ''; mallGo('service'); return; }    if (act === 'svc-quick') { svcSend(el.dataset.q); return; }
    if (act === 'nolink') { toast('镜像', el.dataset.msg || '镜像只读。', ''); return; }
  }

  function searchNote(text) {
    var app = $('.win[data-app="mall"]'); if (!app) return;
    var n = $('[data-search-note]', app); if (!n) return;
    n.textContent = text;
    clearTimeout(searchNote._t);
    searchNote._t = setTimeout(function () { if (n) n.textContent = ''; }, 4200);
  }

  function doSearch() {
    var app = $('.win[data-app="mall"]'); if (!app) return;
    var input = $('[data-search]', app); if (!input) return;
    var q = input.value.trim();
    if (!q) { searchNote('输入一个词，或者一个编号。'); return; }
    if (/样品|清仓|s07|归档|旧货架/i.test(q)) { searchNote('旧货架已归档，目录上查不到这一件。'); return; }
    var hit = PRODUCTS.filter(function (p) {
      return p.name.toLowerCase().indexOf(q.toLowerCase()) >= 0 || p.sub.indexOf(q) >= 0;
    })[0];
    if (hit) { searchNote('「' + hit.name + '」随旧货架下架了，目录里没有。'); return; }
    var d = DAILY.filter(function (x) {
      return x.name.toLowerCase().indexOf(q.toLowerCase()) >= 0 || x.sub.indexOf(q) >= 0;
    })[0];
    if (d) { mallGo('plaza'); searchNote('「' + d.name + '」在全部商品里。'); return; }
    searchNote('镜像只索引在架的日用百货。');
  }

  function flashLabel(el, text) {
    if (!el) return;
    if (!el.dataset.label) el.dataset.label = el.textContent;
    el.textContent = text;
    clearTimeout(flashLabel._t);
    flashLabel._t = setTimeout(function () { el.textContent = el.dataset.label; }, 1800);
  }

  function doCopy(key, el) {
    var text = COPY[key];
    if (!text) return;
    function done() { flashLabel(el, '已复制'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { flashLabel(el, '复制失败'); }
      ta.remove();
    }
  }

  /* ============================================================
     解码器
     ============================================================ */
  var MORSE = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
    I: '..', J: '.---', K: '-.-', L: '-...', M: '--', N: '-.', O: '---', P: '.--.',
    Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
    Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.'
  };

  function morseDecode(s) {
    var clean = s.replace(/—|–|－/g, '-').replace(/·|•|。/g, '.').replace(/\u3000/g, ' ');
    var groups = clean.trim().split(/\s+/).filter(Boolean);
    var out = groups.map(function (g) {
      g = g.replace(/[^.\-]/g, '');
      if (!g) return '';
      for (var k in MORSE) if (MORSE[k] === g) return k;
      return '?';
    }).join('');
    return out;
  }

  function b64decode(s) {
    var clean = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    var bin = atob(clean);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
  function b64encode(s) {
    return btoa(unescape(encodeURIComponent(s)));
  }

  function renderToolApp(body) {
    body.innerHTML =
      '<div class="tool">' +
      '<div class="tool-tabs">' +
      '<button class="tool-tab' + (T.tab === 'b64' ? ' on' : '') + '" data-act="tab" data-tab="b64">Base64</button>' +
      '<button class="tool-tab' + (T.tab === 'morse' ? ' on' : '') + '" data-act="tab" data-tab="morse">摩斯</button>' +
      '<button class="tool-tab' + (T.tab === 'rev' ? ' on' : '') + '" data-act="tab" data-tab="rev">倒序</button>' +
      '<button class="tool-tab' + (T.tab === 'table' ? ' on' : '') + '" data-act="tab" data-tab="table">字符表</button>' +
      '</div>' +
      '<div class="tool-body">' +
      '<div data-panel="b64" style="display:' + (T.tab === 'b64' ? 'block' : 'none') + '">' +
      '<div class="tool-label">密文 / 明文</div>' +
      '<textarea data-in="b64" placeholder="把那段字母粘进来，例如 U0hJUFBJTkc="></textarea>' +
      '<div class="tool-actions"><button class="primary" data-act="run" data-mode="b64d">Base64 解码</button>' +
      '<button data-act="run" data-mode="b64e">编码</button>' +
      '<button data-act="clear" data-mode="b64">清空</button></div>' +
      '<div class="tool-label">结果</div><div class="tool-out" data-out="b64"><span class="ph">等待输入。</span></div>' +
      '<div class="tool-note">离线解码。谜题里出现的字母串，先试试 Base64。</div></div>' +
      '<div data-panel="morse" style="display:' + (T.tab === 'morse' ? 'block' : 'none') + '">' +
      '<div class="tool-label">点划串（每段之间用空格）</div>' +
      '<textarea data-in="morse" placeholder="—·—  ——···"></textarea>' +
      '<div class="tool-actions"><button class="primary" data-act="run" data-mode="morse">译成字母</button>' +
      '<button data-act="clear" data-mode="morse">清空</button></div>' +
      '<div class="tool-label">结果</div><div class="tool-out" data-out="morse"><span class="ph">等待输入。</span></div>' +
      '<div class="tool-note">支持「—」「-」「·」「.」四种写法，空格分段，逐段还原成一个字符。</div></div>' +
      '<div data-panel="rev" style="display:' + (T.tab === 'rev' ? 'block' : 'none') + '">' +
      '<div class="tool-label">逐行倒序（保留换行）</div>' +
      '<textarea data-in="rev" placeholder="把刻字粘进来，三行一起。"></textarea>' +
      '<div class="tool-actions"><button class="primary" data-act="run" data-mode="rev">倒过来</button>' +
      '<button data-act="clear" data-mode="rev">清空</button></div>' +
      '<div class="tool-label">结果</div><div class="tool-out" data-out="rev"><span class="ph">等待输入。</span></div>' +
      '<div class="tool-note">每一行单独翻转，换行原样保留。镜像文字都用这个。</div></div>' +
      '<div data-panel="table" style="display:' + (T.tab === 'table' ? 'block' : 'none') + '">' +
      '<div class="tool-label">摩斯字符表</div><div class="morse-grid">' +
      Object.keys(MORSE).map(function (k) {
        return '<div><b>' + k + '</b><span>' + MORSE[k].replace(/\./g, '·').replace(/-/g, '—') + '</span></div>';
      }).join('') +
      '</div><div class="tool-note">数字前四位为常用编码。0 到 9 都在表里。</div></div>' +
      '</div></div>';
  }

  function toolAct(act, el) {
    if (act === 'tab') {
      T.tab = el.dataset.tab;
      $$('.tool-tab').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === T.tab); });
      $$('[data-panel]').forEach(function (p) { p.style.display = p.dataset.panel === T.tab ? 'block' : 'none'; });
      return;
    }
    if (act === 'run') { runTool(el.dataset.mode); return; }
    if (act === 'clear') {
      var ta = $('[data-in="' + el.dataset.mode + '"]');
      if (ta) ta.value = '';
      var out = $('[data-out="' + el.dataset.mode + '"]');
      if (out) out.innerHTML = '<span class="ph">等待输入。</span>';
      return;
    }
  }

  function runTool(mode) {
    var app = $('.win[data-app="tool"]'); if (!app) return;
    var key = mode.replace(/[de]$/, '');
    var ta = $('[data-in="' + key + '"]', app);
    var out = $('[data-out="' + key + '"]', app);
    if (!ta || !out) return;
    var v = ta.value;
    out.className = 'tool-out';
    try {
      if (v.trim() === '') { out.innerHTML = '<span class="ph">先输入内容。</span>'; return; }
      var res = '';
      if (mode === 'b64d') res = b64decode(v);
      else if (mode === 'b64e') res = b64encode(v);
      else if (mode === 'morse') res = morseDecode(v);
      else if (mode === 'rev') res = v.split('\n').map(function (l) { return Array.from(l).reverse().join(''); }).join('\n');
      out.textContent = res;
      sfx('ok');
      if (mode === 'b64d' && /shipping/i.test(res)) {
        if (!S.flags.shippingKnown) { S.flags.shippingKnown = true; checkObjectives(); }
        toast('解出来了', 'SHIPPING —— 去商城「源码」里找它。');
      }
    } catch (e) {
      out.className = 'tool-out err';
      out.textContent = '解不开。检查一下格式，或者换个工具。';
      sfx('err');
    }
  }

  /* ============================================================
     线索本
     ============================================================ */
  function renderNotesApp(body) {
    body.innerHTML = '<div class="notes-app">' +
      '<div class="notes-tabs">' +
      '<button class="notes-tab' + (N.tab === 'task' ? ' on' : '') + '" data-act="tab" data-tab="task">任务</button>' +
      '<button class="notes-tab' + (N.tab === 'clue' ? ' on' : '') + '" data-act="tab" data-tab="clue">线索 ' + S.clues.length + '</button>' +
      '</div><div class="notes-body" data-notes-body></div></div>';
    renderNotesBody();
  }

  function renderNotesBody() {
    var app = $('.win[data-app="notes"]'); if (!app) return;
    var body = $('[data-notes-body]', app); if (!body) return;
    if (N.tab === 'task') {
      var list = objectives();
      var done = list.filter(function (o) { return o.done; }).length;
      body.innerHTML =
        '<div class="progress"><div class="pt"><span>案卷进度</span><span>' + done + ' / ' + list.length + '</span></div>' +
        '<div class="bar"><div class="fill" style="width:' + (done / list.length * 100) + '%"></div></div></div>' +
        list.map(function (o) {
          return '<div class="task' + (o.done ? ' done' : '') + '"><div class="box">✓</div><div>' +
            '<div class="label">' + esc(o.label) + '</div>' +
            '</div></div>';
        }).join('') +
        '<div style="margin-top:12px;display:flex;gap:8px">' +
        '<button class="btn ghost" data-act="open-chat" style="font-size:11.5px;padding:6px 11px">打开频道</button></div>';
    } else {
      body.innerHTML = S.clues.length ? S.clues.map(function (c) {
        return '<div class="clue"><div class="ch"><b>' + esc(c.title) + '</b><small>' + c.t + '</small></div>' +
          '<div class="cb">' + esc(c.body) + '</div></div>';
      }).join('') : '<div class="empty">还没有记下任何东西。<br>线索会自动存进来。</div>';
    }
  }

  function notesAct(act, el) {
    if (act === 'tab') { N.tab = el.dataset.tab; renderNotesApp($('[data-app="notes"] .wbody')); return; }
    if (act === 'open-chat') { openApp('chat'); return; }
  }

  /* ============================================================
     暗网页面（长在商城里的内页，同一套头部/导航/页脚）
     ============================================================ */
  function ledgerHTML(light) {
    var rows = [
      { slot: 'K-03', city: '新加坡', time: '03:40', cargo: '旧唱片 ×2', status: '已取' },
      { slot: 'K-05', city: '里昂', time: '05:10', cargo: '黄铜齿轮 ×1', status: '待取' },
      { slot: 'K-07', city: '布宜诺斯艾利斯', time: '07:40', cargo: 'N-17 / 夜莺 ×1', status: '待取' }
    ];
    return '<div class="ledger' + (light ? ' light' : '') + '">' +
      '<div class="lh"><b>OPERATION LEDGER</b><span>镜像 2026-11-19 03:12 · 只读</span></div>' +
      '<table class="ltable"><thead><tr><th>货号</th><th>交接城市</th><th>时间</th><th>货物</th><th>状态</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr' + (r.slot === CFG.slot ? ' class="hit"' : '') + '><td class="slot">' + r.slot + '</td>' +
          '<td>' + r.city + '</td><td>' + r.time + '</td>' +
          '<td class="cargo">' + r.cargo + '<small>' + (r.slot === CFG.slot ? '委托人：—　承运：以旧换新' : '') + '</small></td>' +
          '<td class="status">' + r.status + '</td></tr>';
      }).join('') +
      '</tbody></table>' +
      '<div class="lfoot">本页不提供联络方式。离开时不要留痕。<br>CANDLE 演练节点 / 03 / 非真实网络</div>' +
      '</div>';
  }

  function normalizeCode(v) {
    var t = v.trim().toUpperCase().replace(/\s+/g, '');
    if (/[·.—–－]/.test(t)) return morseDecode(v).toUpperCase();
    return t;
  }

  async function darkEnter() {
    var app = $('.win[data-app="mall"]'); if (!app || K.busy || S.flags.ledgerSeen) return;
    var input = $('[data-dark-code]', app), msg = $('[data-dark-msg]', app), log = $('[data-dark-log]', app);
    var c = normalizeCode(input ? input.value : '');
    if (!c) {
      if (msg) { msg.className = 'aq-msg err'; msg.textContent = '口令是空的。'; }
      sfx('err'); return;
    }
    if (c !== CFG.invite) {
      K.attempts++;
      if (msg) {
        msg.className = 'aq-msg err';
        msg.textContent = '口令不对。' + (K.attempts >= 2 ? '源码里那段脚本写着两段摩斯，解码器能翻。' : '');
      }
      sfx('err'); return;
    }
    K.busy = true;
    if (msg) { msg.className = 'aq-msg'; msg.textContent = ''; }
    var run = S.run;
    function line(txt) {
      if (log) log.insertAdjacentHTML('beforeend', '<div class="kx-line"><span class="ok">&gt; ' + txt + '</span></div>');
    }
    line('口令核对 ……… 通过');
    sfx('ok');
    await sleep(420);
    if (run !== S.run) { K.busy = false; return; }
    line('调取交接单 ………… 只读');
    await sleep(460);
    if (run !== S.run) { K.busy = false; return; }
    S.flags.kestrelOpen = true;
    S.flags.ledgerSeen = true;
    addClue('ledger', '货单 · K-07', 'K-07 · 布宜诺斯艾利斯 · 07:40 · 货物：N-17 / 夜莺 ×1 · 待取\n' +
      '交接单只有三条：K-03 新加坡 03:40、K-05 里昂 05:10、K-07 布宜诺斯艾利斯 07:40。\n' +
      'K-07 的货物就是 N-17，上面那页 D-14 也是 N-17——同一批活。');
    toast('口令通过', '交接单调出来了：K-07 那一行。', 'success');
    checkObjectives();
    renderMallPage();
    setTimeout(function () {
      var pg = $('[data-page]', app), led = $('.ledger', app);
      if (pg && led) pg.scrollTop = Math.max(0, led.offsetTop - 26);
    }, 60);
    if (!S.ledgerPrompted) {
      S.ledgerPrompted = true;
      setTimeout(function () { dm('看到了。报 <em>K-07</em>：货号、城市、时间。一行，别写废话。', 1000); }, 800);
    }
    K.busy = false;
  }

  /* ============================================================
     启动 / 重置
     ============================================================ */
  function resetGame() {
    S.run++;
    Object.keys(S.wins).forEach(function (id) { closeApp(id); });
    S.wins = {};
    S.flags = resetFlags();
    S.clues = [];
    S.chat = [];
    S.t0 = 0; S.tEnd = 0;
    S.ledgerPrompted = false;
    S.lastReply = 0;
    S.clock = { h: 3, m: 12, s: 0 };
    M.route = 'home'; M.hist = ['home']; M.idx = 0; M.img = 1; M.folded = false; M.src = false;
    M.cart = []; M.batch = '';
    M.svc.topic = ''; M.svc.threads = {};
    T.tab = 'b64'; N.tab = 'task';
    K.busy = false; K.attempts = 0;
    renderDesktopIcons();
    renderTaskbar();
    renderStartMenu();
    startGame();
    toast('终端已重置', '03:12。这一晚重新开始。', '');
  }

  function startGame() {
    S.started = true;
    S.run++;
    S.t0 = 0;
    openApp('chat');
    chatPush('sys', '频道 03 · 端到端加密 · 本频道不存云端');
    chatPush('them', '夜莺，醒了就敲个字。别打电话。');
    setTimeout(function () {
      toast('频道 03', '老鸦在线。敲个字回应。', '');
    }, 500);
  }

  /* ---------------- 启动动画 ---------------- */
  var BOOT = [
    ['挂载离线镜像 /dev/mirror3', 'ok'],
    ['校验终端指纹 N-17', 'ok'],
    ['载入鲸选商城镜像（只读）', 'ok'],
    ['频道 03 · 端到端加密', 'wait'],
    ['等待操作员…', 'wait']
  ];

  function boot() {
    var log = $('#bootLog'), bar = $('#bootBar');
    BOOT.forEach(function (line, i) {
      setTimeout(function () {
        if (!log) return;
        var cls = line[1] === 'ok' ? 'ok' : 'pending';
        log.insertAdjacentHTML('beforeend', '<div>' + line[0] +
          ' <span class="dim" style="color:#3d464c">' + new Array(Math.max(4, 24 - line[0].length)).join('.') + '</span> ' +
          '<span class="' + cls + '">' + (line[1] === 'ok' ? '[ ok ]' : '[ .. ]') + '</span></div>');
        if (bar) bar.style.width = ((i + 1) / BOOT.length * 100) + '%';
      }, 260 + i * 300);
    });
    setTimeout(function () {
      $('#boot').classList.add('hide');
      setTimeout(function () { tutorial(); }, 500);
    }, 2150);
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    if (A.wallpaper) $('#wall').style.backgroundImage = 'url("' + A.wallpaper + '")';
    renderDesktopIcons();
    renderTaskbar();
    renderStartMenu();
    setInterval(tickClock, 1000);
    tickClock();
    var sound = $('#soundBtn');
    sound.innerHTML = svg('i-sound');
    sound.addEventListener('click', function () {
      S.sound = !S.sound;
      sound.innerHTML = svg(S.sound ? 'i-sound' : 'i-mute');
      if (S.sound) sfx('ok');
      toast('声音', S.sound ? '已开启。' : '已静音。', '');
    });
    window.addEventListener('resize', function () {
      Object.keys(S.wins).forEach(function (id) {
        var w = S.wins[id];
        if (w.el.classList.contains('max')) return;
        var maxW = window.innerWidth - 8, maxH = window.innerHeight - 52 - 8;
        if (w.el.offsetWidth > maxW) w.el.style.width = maxW + 'px';
        if (w.el.offsetHeight > maxH) w.el.style.height = maxH + 'px';
        if (w.el.offsetLeft > window.innerWidth - 90) w.el.style.left = Math.max(0, window.innerWidth - 90) + 'px';
      });
    });
    // 首次交互解锁音频
    document.addEventListener('pointerdown', function once() {
      audio(); document.removeEventListener('pointerdown', once);
    });
    // 调试快捷键（不玩流程也能看后面几页）
    document.addEventListener('keydown', function (e) {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
      var step = JUMP_MAP[e.code];
      if (!step) return;
      e.preventDefault();
      jump(step);
    });
    boot();
  }

  /* 调试跳转：控制台里 __AX.jump('ledger')；或 Alt+Shift+1/2/3/4
     1 商城首页 · 2 购物车（四件已装好）· 3 暗门附页 · 4 口令后的交接单 */
  var JUMP_MAP = { Digit1: 'home', Digit2: 'cart', Digit3: 'dark', Digit4: 'ledger' };
  function jump(step) {
    var f = S.flags;
    if (step === 'reset') { resetGame(); return; }
    if (step === 'chat') { openApp('chat'); return; }
    openApp('mall');
    M.src = false;
    if (step === 'home') {
      mallGo('home');
    } else if (step === 'cart' || step === 'door') {
      f.sampleFound = f.noteRead = f.priceSeen = f.foldedSeen = f.channelOpen = true;
      M.cart = CFG.cartOrder.slice();
      M.batch = CFG.batch;
      f.cartReady = step === 'door';
      if (step === 'door') f.kestrelOpen = true;
      checkObjectives();
      mallGo(step === 'cart' ? 'cart' : 'dark');
    } else if (step === 'dark') {
      f.kestrelOpen = true; f.ledgerSeen = false;
      checkObjectives();
      mallGo('dark');
    } else if (step === 'ledger') {
      f.kestrelOpen = true; f.ledgerSeen = true;
      checkObjectives();
      mallGo('dark');
      setTimeout(function () {
        var app = $('.win[data-app="mall"]'), pg = $('[data-page]', app), led = $('.ledger', app);
        if (pg && led) pg.scrollTop = Math.max(0, led.offsetTop - 26);
      }, 60);
    } else {
      return;
    }
    toast('已跳转', '调试跳转：' + step, '');
    sfx('ok');
  }

  window.__AX = { S: S, M: M, COPY: COPY, CFG: CFG, parseReport: parseReport, openApp: openApp, resetGame: resetGame, mallGo: mallGo, jump: jump };
  init();
})();
