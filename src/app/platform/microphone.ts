import { inject, Injectable, InjectionToken, signal } from '@angular/core';

export const MEDIA_DEVICES = new InjectionToken<MediaDevices | null>('MEDIA_DEVICES', {
  providedIn: 'root',
  factory: () => {
    if (typeof navigator === 'undefined') { return null; }
    // The DOM types declare mediaDevices and getUserMedia as always present, but
    // they are absent in insecure contexts and older browsers, so probe for real.
    const devices = (navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices;
    return devices && typeof devices.getUserMedia === 'function' ? devices : null;
  },
});

/**
 * Holds one microphone grant for the session. Denial is a latch: once the user
 * says no, we never prompt again, because a second prompt on every line would
 * be hostile and browsers suppress it anyway.
 */
@Injectable({ providedIn: 'root' })
export class MicrophoneService {
  private readonly devices = inject(MEDIA_DEVICES);
  private readonly deniedState = signal(false);
  private stream: MediaStream | null = null;
  private pending: Promise<MediaStream | null> | null = null;

  readonly denied = this.deniedState.asReadonly();

  /** Rejects when denied; resolves with null where the API is absent. */
  ensure(): Promise<MediaStream | null> {
    if (this.deniedState()) { return Promise.reject(new Error('microphone-denied')); }
    if (this.stream) { return Promise.resolve(this.stream); }
    if (this.pending) { return this.pending; }
    if (!this.devices) { return Promise.resolve(null); }

    this.pending = this.devices.getUserMedia({ audio: true }).then(
      (stream) => {
        this.pending = null;
        this.stream = stream;
        return stream;
      },
      (err: unknown) => {
        this.pending = null;
        this.markDenied();
        throw err;
      },
    );
    return this.pending;
  }

  /** Latches denial without prompting — used when STT reports `not-allowed`. */
  markDenied(): void {
    this.deniedState.set(true);
  }

  release(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
