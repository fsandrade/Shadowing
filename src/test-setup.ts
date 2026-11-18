const domWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;

try {
  const storage = domWindow?.localStorage;
  if (storage && globalThis.localStorage !== storage) {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => storage,
    });
  }
} catch {
}
