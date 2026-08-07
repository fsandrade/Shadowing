(function (root) {
  'use strict';

  function stripTags(html) {
    var s = String(html);
    var depth = 0;
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '<') { depth++; continue; }
      if (ch === '>' && depth > 0) { depth--; continue; }
      if (depth === 0) { out += ch; }
    }
    return out;
  }

  function deckOptions(data) {
    var decks = (data && data.decks) || [];
    var total = decks.reduce(function (n, d) { return n + d.lines.length; }, 0);
    return [{ id: 'all', name: 'All', count: total }].concat(
      decks.map(function (d) { return { id: d.id, name: d.name, count: d.lines.length }; })
    );
  }

  function linesFor(data, deckId) {
    var decks = (data && data.decks) || [];
    if (deckId === 'all') {
      return decks.reduce(function (acc, d) { return acc.concat(d.lines); }, []);
    }
    var deck = decks.find(function (d) { return d.id === deckId; });
    return deck ? deck.lines.slice() : [];
  }

  function shuffle(list, rng) {
    var random = rng || Math.random;
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.min(Math.floor(random() * (i + 1)), i);
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function pauseMs(speechMs, slack) {
    return Math.max(0, Math.round(speechMs * slack));
  }

 
 
  function safetyTimeoutMs(text, rate) {
    return Math.round((String(text).length / 12 / rate + 5) * 1000);
  }

  function nextIndex(i, len) {
    return len > 0 ? (i + 1) % len : 0;
  }

  function formatClock(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    var mm = Math.floor(s / 60);
    var ss = s % 60;
    return (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function isEnglish(v) { return /^en/i.test(v.lang || ''); }

  function pickVoice(voices, preferredName) {
    var list = voices || [];
    if (!list.length) { return null; }
    var byName = preferredName && list.find(function (v) { return v.name === preferredName; });
    if (byName) { return byName; }
    var naturalUs = list.find(function (v) {
      return /^en-US$/i.test(v.lang || '') && /natural/i.test(v.name || '');
    });
    if (naturalUs) { return naturalUs; }
    var us = list.find(function (v) { return /^en-US$/i.test(v.lang || ''); });
    if (us) { return us; }
    var anyEnglish = list.find(isEnglish);
    return anyEnglish || list[0];
  }

  function hasEnglishVoice(voices) {
    return (voices || []).some(isEnglish);
  }

  function normalizeSpeech(text) {
    return String(text == null ? '' : text)
      .toLowerCase()
      .replace(/'/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function wordSimilarity(base, transcript) {
    var a = normalizeSpeech(base);
    var b = normalizeSpeech(transcript);
    var m = a.length, n = b.length;
    if (!m && !n) { return 1; }
    if (!m || !n) { return 0; }
    var dp = [];
    for (var i = 0; i <= m; i++) {
      dp[i] = [];
      for (var j = 0; j <= n; j++) { dp[i][j] = 0; }
    }
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    return (2 * dp[m][n]) / (m + n);
  }

  function starsFor(base, transcript) {
    if (!normalizeSpeech(transcript).length) { return null; }
    var sim = wordSimilarity(base, transcript);
    if (sim < 0.45) { return 0; }
    if (sim < 0.60) { return 1; }
    if (sim < 0.70) { return 2; }
    if (sim < 0.80) { return 3; }
    if (sim < 0.95) { return 4; }
    return 5;
  }

  var API = {
    stripTags: stripTags,
    deckOptions: deckOptions,
    linesFor: linesFor,
    shuffle: shuffle,
    pauseMs: pauseMs,
    safetyTimeoutMs: safetyTimeoutMs,
    nextIndex: nextIndex,
    formatClock: formatClock,
    pickVoice: pickVoice,
    hasEnglishVoice: hasEnglishVoice,
    normalizeSpeech: normalizeSpeech,
    wordSimilarity: wordSimilarity,
    starsFor: starsFor,
  };

  root.ShadowingCore = API;
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})(typeof window !== 'undefined' ? window : globalThis);
