import { environment } from '../../environments/environment';

interface HCaptcha {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  execute(widgetId: string, options: { async: true }): Promise<{ response: string }>;
  reset(widgetId: string): void;
}

declare global {
  interface Window { hcaptcha?: HCaptcha }
}

const SCRIPT_URL = 'https://js.hcaptcha.com/1/api.js?render=explicit';
const LOAD_TIMEOUT_MS = 8000;
const SOLVE_TIMEOUT_MS = 15000;

let api: Promise<HCaptcha> | null = null;
let widget: string | null = null;

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (reason) => { clearTimeout(timer); reject(reason); },
    );
  });
}

function loadScript(): Promise<HCaptcha> {
  if (window.hcaptcha) { return Promise.resolve(window.hcaptcha); }

  return withTimeout(new Promise<HCaptcha>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="${SCRIPT_URL}"]`);
    const script = existing ?? document.createElement('script');

    const settle = () => {
      if (window.hcaptcha) { resolve(window.hcaptcha); } else { reject(new Error('hCaptcha unavailable')); }
    };

    script.addEventListener('load', settle, { once: true });
    script.addEventListener('error', () => reject(new Error('hCaptcha script failed')), { once: true });

    if (!existing) {
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
  }), LOAD_TIMEOUT_MS, 'hCaptcha load');
}

function container(): HTMLElement {
  const found = document.getElementById('hcaptcha-host');
  if (found) { return found; }

  const host = document.createElement('div');
  host.id = 'hcaptcha-host';
  host.style.display = 'none';
  document.body.append(host);
  return host;
}

export function captchaConfigured(): boolean {
  return !!environment.hcaptchaSiteKey;
}

export async function solveCaptcha(): Promise<string | null> {
  if (!captchaConfigured()) { return null; }

  try {
    api ??= loadScript();
    const hcaptcha = await api;

    widget ??= hcaptcha.render(container(), {
      sitekey: environment.hcaptchaSiteKey,
      size: 'invisible',
    });

    hcaptcha.reset(widget);
    const { response } = await withTimeout(
      hcaptcha.execute(widget, { async: true }),
      SOLVE_TIMEOUT_MS,
      'hCaptcha challenge',
    );
    return response || null;
  } catch (reason) {
    console.warn('Progress will not be saved:', reason);
    api = null;
    widget = null;
    return null;
  }
}
