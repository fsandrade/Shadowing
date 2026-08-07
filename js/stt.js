(function (root) {
  'use strict';

  function findRecognition() {
    if (typeof root.SpeechRecognition !== 'undefined') { return root.SpeechRecognition; }
    if (typeof root.webkitSpeechRecognition !== 'undefined') { return root.webkitSpeechRecognition; }
    return null;
  }

  function supported() {
    return !!findRecognition();
  }

  function recognize(opts) {
    var Recognition = findRecognition();
    if (!Recognition) {
      throw new Error('SpeechRecognition is not available in this browser.');
    }
    var settings = opts || {};
    var rec = new Recognition();
    rec.lang = settings.lang || 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    var ended = false;
    var finalText = '';

    rec.onresult = function (event) {
      var live = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var result = event.results[i];
        var transcript = (result[0] && result[0].transcript) || '';
        if (result.isFinal) {
          finalText += transcript;
        } else {
          live += transcript;
        }
      }
      if (settings.onInterim && live) {
        settings.onInterim(finalText + live);
      }
    };

    rec.onerror = function (event) {
      if (ended) { return; }
      if (settings.onError) { settings.onError((event && event.error) || null); }
    };

    rec.onend = function () {
      if (ended) { return; }
      ended = true;
      if (settings.onResult) { settings.onResult(finalText); }
    };

    return {
      start: function () {
        try {
          rec.start();
        } catch (e) {
          if (settings.onError) { settings.onError((e && e.message) || 'recognition-start-failed'); }
        }
      },
      stop: function () {
        try { rec.stop(); } catch (e) { }
      },
      abort: function () {
        if (ended) { return; }
        ended = true;
        try { rec.abort(); } catch (e) { }
      },
    };
  }

  var API = {
    supported: supported,
    recognize: recognize,
  };

  root.ShadowingSTT = API;
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
})(typeof window !== 'undefined' ? window : globalThis);