import { inject, Injectable, InjectionToken, signal } from '@angular/core';

export const MEDIA_DEVICES = new InjectionToken<MediaDevices | null>('MEDIA_DEVICES', {
  providedIn: 'root',
  factory: () => {
    if (typeof navigator === 'undefined') { return null; }

    const devices = (navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices;
    return devices && typeof devices.getUserMedia === 'function' ? devices : null;
  },
});

@Injectable({ providedIn: 'root' })
export class MicrophoneService {
  private readonly devices = inject(MEDIA_DEVICES);
  private readonly deniedState = signal(false);
  private stream: MediaStream | null = null;
  private pending: Promise<MediaStream | null> | null = null;

  readonly denied = this.deniedState.asReadonly();

  ensure(): Promise<MediaStream | null> {
    if (this.deniedState()) { return Promise.reject(new Error('microphone-denied')); }
    if (this.stream) { return Promise.resolve(this.stream); }
    if (this.pending) { return this.pending; }
    if (!this.devices) { return Promise.resolve(null); }

    this.pending = this.devices.getUserMedia({ audio: true }).then(
      (stream) => {
        this.pending = null;
        // Android Chrome hands the microphone exclusively to a live capture:
        // while this stream stayed open, SpeechRecognition heard nothing.
        // The grant is all we need, so stop the tracks right away and leave
        // the mic free for the recognizer.
        stream.getTracks().forEach((t) => t.stop());
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

  markDenied(): void {
    this.deniedState.set(true);
  }

  release(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
