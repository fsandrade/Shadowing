const test = require('node:test');
const assert = require('node:assert');

const STT = require('../js/stt.js');

class FakeRecognition {
  constructor() {
    this.lang = '';
    this.continuous = undefined;
    this.interimResults = undefined;
    this.maxAlternatives = undefined;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.started = false;
    this.stopped = false;
    this.aborted = false;
    FakeRecognition.last = this;
  }
  start() { this.started = true; }
  stop() { this.stopped = true; }
  abort() { this.aborted = true; }
}

function fireResult(rec, transcript, isFinal) {
  rec.onresult({
    resultIndex: 0,
    results: [{ 0: { transcript: transcript }, isFinal: isFinal }],
  });
}

test('supported() is false when no recognition API exists', () => {
  delete global.SpeechRecognition;
  delete global.webkitSpeechRecognition;
  assert.strictEqual(STT.supported(), false);
});

test('supported() is true when webkitSpeechRecognition exists', () => {
  delete global.SpeechRecognition;
  global.webkitSpeechRecognition = FakeRecognition;
  assert.strictEqual(STT.supported(), true);
});

test('supported() is true when SpeechRecognition exists', () => {
  delete global.webkitSpeechRecognition;
  global.SpeechRecognition = FakeRecognition;
  assert.strictEqual(STT.supported(), true);
});

test('recognize throws when no recognition API exists', () => {
  delete global.SpeechRecognition;
  delete global.webkitSpeechRecognition;
  assert.throws(() => STT.recognize({}));
});

test('recognize starts a one-shot interim session and reports onInterim', () => {
  global.SpeechRecognition = FakeRecognition;
  const interim = [];
  const session = STT.recognize({
    lang: 'pt-BR',
    onInterim: (t) => interim.push(t),
  });
  session.start();
  const rec = FakeRecognition.last;
  assert.strictEqual(rec.started, true);
  assert.strictEqual(rec.lang, 'pt-BR');
  assert.strictEqual(rec.continuous, false);
  assert.strictEqual(rec.interimResults, true);

  fireResult(rec, 'hello ', false);
  fireResult(rec, 'hello world', true);
  assert.deepStrictEqual(interim, ['hello ']);
});

test('onResult is called once with the final text when recognition ends', () => {
  global.SpeechRecognition = FakeRecognition;
  const results = [];
  const session = STT.recognize({ onResult: (t) => results.push(t) });
  session.start();
  const rec = FakeRecognition.last;
  fireResult(rec, 'final words', true);
  rec.onend();
  assert.deepStrictEqual(results, ['final words']);
});

test('onResult receives an empty string when nothing was said', () => {
  global.SpeechRecognition = FakeRecognition;
  const results = [];
  const session = STT.recognize({ onResult: (t) => results.push(t) });
  session.start();
  FakeRecognition.last.onend();
  assert.deepStrictEqual(results, ['']);
});

test('onError forwards the API error code', () => {
  global.SpeechRecognition = FakeRecognition;
  const errors = [];
  const session = STT.recognize({ onError: (code) => errors.push(code) });
  session.start();
  FakeRecognition.last.onerror({ error: 'not-allowed' });
  assert.deepStrictEqual(errors, ['not-allowed']);
});

test('abort suppresses onend, onresult and onerror', () => {
  global.SpeechRecognition = FakeRecognition;
  const results = [];
  const errors = [];
  const session = STT.recognize({
    onResult: (t) => results.push(t),
    onError: (code) => errors.push(code),
  });
  session.start();
  const rec = FakeRecognition.last;
  session.abort();
  assert.strictEqual(rec.aborted, true);
  fireResult(rec, 'late', true);
  rec.onerror({ error: 'aborted' });
  rec.onend();
  assert.deepStrictEqual(results, []);
  assert.deepStrictEqual(errors, []);
});

test('stop is graceful and does not abort', () => {
  global.SpeechRecognition = FakeRecognition;
  const session = STT.recognize({});
  session.start();
  session.stop();
  const rec = FakeRecognition.last;
  assert.strictEqual(rec.stopped, true);
  assert.strictEqual(rec.aborted, false);
});