(function (root) {
  'use strict';

  function stripTags(html) {
    return String(html).replace(/<[^>]*>/g, '');
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
  };

  root.ShadowingCore = API;
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})(typeof window !== 'undefined' ? window : globalThis);
