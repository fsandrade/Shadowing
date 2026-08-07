(function () {
  'use strict';

  var C = window.ShadowingCore;



  var synth = window.speechSynthesis || {
    getVoices: function () { return []; },
    speak: function () { }, cancel: function () { }, resume: function () { },
    addEventListener: function () { },
    speaking: false, paused: false,
  };

  var els = {
    decks: document.getElementById('decks'),
    decksList: document.querySelector('.decks-list'),
    lines: document.getElementById('lines'),
    banner: document.getElementById('banner'),
    play: document.getElementById('play'),
    next: document.getElementById('next'),
    shuffle: document.getElementById('shuffle'),
    blur: document.getElementById('blur'),
    rate: document.getElementById('rate'),
    rateOut: document.getElementById('rateOut'),
    slack: document.getElementById('slack'),
    slackOut: document.getElementById('slackOut'),
    voice: document.getElementById('voice'),
    snackbar: document.getElementById('snackbar'),
    snackbarClose: document.querySelector('.snackbar-close'),
    edgeLink: document.getElementById('edge-link'),
    help: document.getElementById('help'),
    helpModal: document.getElementById('helpModal'),
    helpClose: document.getElementById('helpClose'),
    durations: document.getElementById('durations'),
    clock: document.getElementById('clock'),
  };

  var state = {
    data: null,
    deckId: 'all',
    lines: [],
    index: 0,
    playing: false,
    generation: 0,
    blur: false,
    rate: 1,
    slack: 1,
    voiceName: '',
    durationMin: 0,
    remainingMs: 0,
    resumedAt: 0,
    spokenCount: 0,
    timer: null,
    timerResolve: null,
    speechFailures: 0,
    speechUnsupported: false,
    noEnglishVoice: false,
    bannerSource: null,
  };

  function showBanner(html, source) {
    state.bannerSource = source;
    els.banner.innerHTML = html;
    els.banner.classList.add('show');
  }




  function clearBanner(source) {
    if (state.bannerSource !== source) { return; }
    state.bannerSource = null;
    els.banner.classList.remove('show');
  }




  function audioBlocked() {
    return state.speechUnsupported || state.noEnglishVoice;
  }

  function setControlsEnabled(on) {
    var enabled = on && !audioBlocked();
    els.play.disabled = !enabled;
    els.next.disabled = !enabled;
    els.shuffle.disabled = !enabled;
  }

  function renderDecks() {
    els.decksList.innerHTML = '';
    C.deckOptions(state.data).forEach(function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.deckId = opt.id;
      b.setAttribute('aria-current', String(opt.id === state.deckId));
      b.innerHTML = '<span></span><span class="count"></span>';
      b.firstChild.textContent = opt.name;
      b.lastChild.textContent = opt.count;
      b.addEventListener('click', function () { selectDeck(opt.id); });
      els.decksList.appendChild(b);
    });
  }

  function renderLines() {
    els.lines.innerHTML = '';
    state.lines.forEach(function (line, i) {
      var p = document.createElement('p');

      var num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(i + 1);
      p.appendChild(num);

      var content = document.createElement('span');
      content.className = 'text';
      content.innerHTML = line;
      p.appendChild(content);

      p.addEventListener('click', function () { onLineClick(i); });
      els.lines.appendChild(p);
    });
    highlight(state.index);
  }

  function highlight(i) {
    var kids = els.lines.children;
    for (var k = 0; k < kids.length; k++) { kids[k].classList.remove('current'); }
    var el = kids[i];
    if (!el) { return; }
    el.classList.add('current');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  var voices = [];

  function currentVoice() {
    return C.pickVoice(voices, state.voiceName);
  }

  function loadVoices() {
    voices = synth.getVoices() || [];
    if (!voices.length) { return; }
    els.voice.innerHTML = '';
    voices.filter(function (v) { return /^en/i.test(v.lang); })
      .forEach(function (v) {
        var o = document.createElement('option');
        o.value = v.name;
        o.textContent = v.name + ' (' + v.lang + ')';
        els.voice.appendChild(o);
      });
    var chosen = currentVoice();
    if (chosen) {
      state.voiceName = chosen.name;
      els.voice.value = chosen.name;
    }
    state.noEnglishVoice = !C.hasEnglishVoice(voices);
    if (state.noEnglishVoice) {




      stop();
      showBanner('Nenhuma voz em ingl&ecirc;s instalada neste navegador. ' +
        'Instale uma voz en-US no Windows para praticar com &aacute;udio.', 'no-voice');
    } else {
      clearBanner('no-voice');
    }


    setControlsEnabled(state.lines.length > 0);
  }



  function speak(text) {
    return new Promise(function (resolve) {
      if (!window.SpeechSynthesisUtterance) { resolve(); return; }
      var settled = false;
      var timer = null;
      function finish() {
        if (settled) { return; }
        settled = true;
        clearTimeout(timer);
        resolve();
      }
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = state.rate;
      var v = currentVoice();
      if (v) { u.voice = v; }
      u.onend = finish;
      u.onerror = finish;
      timer = setTimeout(finish, C.safetyTimeoutMs(text, state.rate));


      synth.cancel();
      synth.speak(u);
    });
  }

  function onLineClick(i) {
    state.index = i;
    highlight(i);




    if (state.playing) { play(); return; }
    speak(C.stripTags(state.lines[i]));
  }

  function selectDeck(id) {
    state.deckId = id;
    state.lines = C.linesFor(state.data, id);
    state.index = 0;
    stop();
    renderDecks();
    renderLines();
    setControlsEnabled(state.lines.length > 0);
    saveSettings();
  }




  function bump() {
    state.generation++;
    clearTimeout(state.timer);
    state.timer = null;




    if (state.timerResolve) {
      var resumeWait = state.timerResolve;
      state.timerResolve = null;
      resumeWait();
    }
    synth.cancel();
    return state.generation;
  }






  function accrue() {
    if (!state.playing) { return; }
    var used = Date.now() - state.resumedAt;
    state.remainingMs += state.durationMin > 0 ? -used : used;
    state.resumedAt = Date.now();
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      state.timerResolve = resolve;
      state.timer = setTimeout(function () {
        state.timerResolve = null;
        resolve();
      }, ms);
    });
  }

  function setPlayLabel() {
    els.play.innerHTML = state.playing ? '\u23F8 Pause' : '\u25B6 Play';
  }

  function setBlur(on) {
    state.blur = on;
    els.lines.classList.toggle('blurred', on);
    els.blur.setAttribute('aria-pressed', String(on));
    saveSettings();
  }

  function stop() {
    bump();
    accrue();
    state.playing = false;
    setPlayLabel();
  }

  function play() {
    if (!state.lines.length) { return; }
    bump();
    accrue();
    state.playing = true;
    state.resumedAt = Date.now();


    state.bannerSource = null;
    els.banner.classList.remove('show');
    setPlayLabel();


    runLoop().catch(stop);
  }

  function pause() {
    stop();
  }







  function startPlaying() {
    if (!state.playing) { state.speechFailures = 0; }
    play();
  }

  function togglePlay() {
    if (state.playing) {
      pause();
    } else {
      startPlaying();
    }
  }

  function nextLine() {
    var passed = els.lines.children[state.index];
    state.index = C.nextIndex(state.index, state.lines.length);
    if (passed) { passed.classList.add('spoken'); }
    highlight(state.index);
    if (state.playing) { play(); } else { bump(); }
  }

  function doShuffle() {
    var wasPlaying = state.playing;
    state.lines = C.shuffle(state.lines);
    state.index = 0;
    stop();
    renderLines();
    if (wasPlaying) { play(); }
  }

  async function runLoop() {
    var gen = state.generation;
    while (state.playing && gen === state.generation) {
      var text = C.stripTags(state.lines[state.index]);
      highlight(state.index);

      var t0 = performance.now();
      await speak(text);
      if (gen !== state.generation || !state.playing) { return; }




      var speechMs = performance.now() - t0;
      if (speechMs < 150 && text.length > 15) {
        state.speechFailures++;
        if (state.speechFailures >= 3) {
          stop();
          showBanner('A voz selecionada n&atilde;o est&aacute; produzindo &aacute;udio. ' +
            'Escolha outra voz no menu <b>voz</b> &mdash; vozes Natural exigem ' +
            'conex&atilde;o com a internet.', 'dead-voice');
          return;
        }
      } else {
        state.speechFailures = 0;
        state.spokenCount++;
      }

      if (sessionExpired()) { finishSession(); return; }



      var waitMs = Math.max(400, C.pauseMs(performance.now() - t0, state.slack));
      var NS = 'http://www.w3.org/2000/svg';
      var RING_R = 8, RING_LEN = 2 * Math.PI * RING_R;
      var ring = document.createElementNS(NS, 'svg');
      ring.setAttribute('class', 'ring');
      ring.setAttribute('viewBox', '0 0 20 20');
      ring.setAttribute('width', '18');
      ring.setAttribute('height', '18');
      ring.setAttribute('aria-hidden', 'true');
      var mkCircle = function (cls, offset) {
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', '10'); c.setAttribute('cy', '10'); c.setAttribute('r', String(RING_R));
        c.setAttribute('fill', 'none'); c.setAttribute('stroke-width', '3');
        c.setAttribute('class', cls);
        if (offset !== undefined) {
          c.setAttribute('stroke-dasharray', RING_LEN.toFixed(2));
          c.setAttribute('stroke-dashoffset', offset.toFixed(2));
        }
        return c;
      };
      ring.appendChild(mkCircle('ring-track'));
      var ringFill = mkCircle('ring-fill', RING_LEN);
      ring.appendChild(ringFill);
      var lineEl = els.lines.children[state.index];
      if (lineEl) { lineEl.appendChild(ring); }
      var started = performance.now();
      (function tick() {
        var p = (performance.now() - started) / waitMs;
        if (p >= 1) { p = 1; }
        ringFill.setAttribute('stroke-dashoffset', (RING_LEN * (1 - p)).toFixed(2));
        if (p < 1 && ring.isConnected) { requestAnimationFrame(tick); }
      })();

      await wait(waitMs);
      if (ring.isConnected) { ring.remove(); }
      if (gen !== state.generation || !state.playing) { return; }


      if (sessionExpired()) { finishSession(); return; }

      var passed = els.lines.children[state.index];
      state.index = C.nextIndex(state.index, state.lines.length);
      if (passed) { passed.classList.add('spoken'); }
    }
  }


  function elapsedNow() {
    return state.playing ? Date.now() - state.resumedAt : 0;
  }

  function tickClock() {
    if (state.durationMin > 0) {
      var left = state.remainingMs - elapsedNow();
      els.clock.textContent = C.formatClock(left / 1000);
    } else {
      els.clock.textContent = C.formatClock((state.remainingMs + elapsedNow()) / 1000);
    }
  }

  function sessionExpired() {
    return state.durationMin > 0 && (state.remainingMs - elapsedNow()) <= 0;
  }

  function finishSession() {
    var spoken = state.spokenCount;
    var minutes = state.durationMin;
    stop();
    state.remainingMs = minutes * 60000;
    state.spokenCount = 0;
    tickClock();
    showBanner('Sess&atilde;o conclu&iacute;da: ' + minutes + ' min &middot; ' +
      spoken + (spoken === 1 ? ' frase repetida.' : ' frases repetidas.'), 'summary');
  }

  function selectDuration(min) {
    stop();
    state.durationMin = min;
    state.remainingMs = min * 60000;
    state.spokenCount = 0;
    Array.prototype.forEach.call(els.durations.children, function (b) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.min) === min));
    });
    tickClock();
    saveSettings();
  }

  function bindControls() {
    els.rate.addEventListener('input', function () {
      state.rate = Number(els.rate.value);
      els.rateOut.textContent = state.rate.toFixed(2) + '\u00d7';
      saveSettings();
    });
    els.slack.addEventListener('input', function () {
      state.slack = Number(els.slack.value);
      els.slackOut.textContent = state.slack.toFixed(2) + '\u00d7';
      saveSettings();
    });
    els.voice.addEventListener('change', function () {
      state.voiceName = els.voice.value;
      saveSettings();
    });

    els.play.addEventListener('click', togglePlay);
    els.next.addEventListener('click', nextLine);
    els.shuffle.addEventListener('click', doShuffle);
    els.blur.addEventListener('click', function () { setBlur(!state.blur); });
    els.snackbarClose.addEventListener('click', function () { hideEdgeTip(true); });

    els.help.addEventListener('click', openHelp);
    els.helpClose.addEventListener('click', closeHelp);
    els.helpModal.addEventListener('click', function (e) {
      if (e.target === els.helpModal) { closeHelp(); }
    });







    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (b) { b.blur(); }
    });


    setInterval(function () {
      if (synth.speaking && !synth.paused) { synth.resume(); }
    }, 10000);
  }

  var STORE_KEY = 'shadowing.settings';

  var EDGE_TIP_KEY = 'shadowing.edgeTip';

  var helpFocus = null;

  function openHelp() {
    helpFocus = document.activeElement;
    els.helpModal.classList.add('show');
    els.helpClose.focus();
  }

  function closeHelp() {
    els.helpModal.classList.remove('show');
    if (helpFocus && helpFocus.focus) { helpFocus.focus(); }
    helpFocus = null;
  }

  function isEdgeBrowser() {
    return /Edg\//i.test(navigator.userAgent || '');
  }

  var edgeTipTimer = null;

  function hideEdgeTip(remember) {
    clearTimeout(edgeTipTimer);
    edgeTipTimer = null;
    els.snackbar.classList.remove('show');
    if (remember) {
      try { localStorage.setItem(EDGE_TIP_KEY, '1'); } catch (e) { }
    }
  }

  function maybeShowEdgeTip() {
    if (isEdgeBrowser()) { return; }
    if (!window.matchMedia || !matchMedia('(pointer: fine)').matches) { return; }
    var tipped = false;
    try { tipped = localStorage.getItem(EDGE_TIP_KEY) === '1'; } catch (e) { }
    if (tipped) { return; }
    var target = /^https?:/.test(location.protocol)
      ? location.href
      : 'https://fsandrade.github.io/Shadowing/';
    els.edgeLink.href = 'microsoft-edge:' + target;
    els.snackbar.classList.add('show');
    edgeTipTimer = setTimeout(function () { hideEdgeTip(false); }, 8000);
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        deckId: state.deckId,
        rate: state.rate,
        slack: state.slack,
        voiceName: state.voiceName,
        durationMin: state.durationMin,
        blur: state.blur,
      }));
    } catch (e) { }
  }

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch (e) { return {}; }
  }

  function bindKeyboard() {
    document.addEventListener('keydown', function (e) {




      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) { return; }


      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) { return; }



      if (els.play.disabled) { return; }
      if (e.key === 'Escape' && els.helpModal.classList.contains('show')) {
        e.preventDefault(); closeHelp(); return;
      }
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nextLine(); }
      else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        highlight(state.index);



        startPlaying();
      }
    });
  }

  function init() {
    if (!window.SHADOWING || !window.SHADOWING.decks) {
      showBanner('N&atilde;o encontrei <code>data/data.js</code>. ' +
        'Rode <code>scripts/build.ps1</code> para gerar o arquivo.', 'missing-data');
      setControlsEnabled(false);
      return;
    }
    if (!('speechSynthesis' in window)) {
      showBanner('Este navegador n&atilde;o suporta s&iacute;ntese de voz. ' +
        'As frases continuam vis&iacute;veis para leitura.', 'unsupported');
      state.speechUnsupported = true;
      setControlsEnabled(false);
    }
    state.data = window.SHADOWING;

    var saved = loadSettings();
    state.rate = Number(saved.rate) || 1;
    state.slack = Number(saved.slack) || 1;
    state.voiceName = saved.voiceName || '';
    state.blur = saved.blur === true;
    els.rate.value = state.rate;
    els.slack.value = state.slack;
    els.rateOut.textContent = state.rate.toFixed(2) + '\u00d7';
    els.slackOut.textContent = state.slack.toFixed(2) + '\u00d7';

    bindControls();
    bindKeyboard();
    maybeShowEdgeTip();
    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);

    els.durations.addEventListener('click', function (e) {
      if (e.target.dataset.min !== undefined) { selectDuration(Number(e.target.dataset.min)); }
    });
    selectDuration(Number(saved.durationMin) || 0);

    setInterval(tickClock, 250);

    var wanted = saved.deckId || 'all';
    selectDeck(C.linesFor(state.data, wanted).length ? wanted : 'all');
    setBlur(state.blur);
  }

  init();

  window.__shadowing = { state: state, els: els };
})();
