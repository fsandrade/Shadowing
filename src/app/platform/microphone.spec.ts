import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { MEDIA_DEVICES, MicrophoneService } from './microphone';

function fakeTrack() {
  return { stop: vi.fn() } as unknown as MediaStreamTrack;
}

function fakeStream(tracks: MediaStreamTrack[]) {
  return { getTracks: () => tracks } as unknown as MediaStream;
}

function setup(getUserMedia: MediaDevices['getUserMedia'] | null) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{
      provide: MEDIA_DEVICES,
      useValue: getUserMedia ? ({ getUserMedia } as MediaDevices) : null,
    }],
  });
  return TestBed.inject(MicrophoneService);
}

describe('MicrophoneService', () => {
  it('resolves with the granted stream', async () => {
    const stream = fakeStream([fakeTrack()]);
    const mic = setup(vi.fn().mockResolvedValue(stream) as never);
    await expect(mic.ensure()).resolves.toBe(stream);
    expect(mic.denied()).toBe(false);
  });

  it('prompts only once and reuses the held stream', async () => {
    const stream = fakeStream([fakeTrack()]);
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const mic = setup(getUserMedia as never);
    await mic.ensure();
    await mic.ensure();
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('coalesces concurrent calls into one prompt', async () => {
    const stream = fakeStream([fakeTrack()]);
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const mic = setup(getUserMedia as never);
    await Promise.all([mic.ensure(), mic.ensure(), mic.ensure()]);
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('latches denial and never re-prompts', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new Error('NotAllowed'));
    const mic = setup(getUserMedia as never);

    await expect(mic.ensure()).rejects.toBeDefined();
    expect(mic.denied()).toBe(true);

    await expect(mic.ensure()).rejects.toBeDefined();
    expect(getUserMedia).toHaveBeenCalledOnce();
  });

  it('markDenied latches without a prompt, for an STT not-allowed error', async () => {
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream([]));
    const mic = setup(getUserMedia as never);
    mic.markDenied();
    expect(mic.denied()).toBe(true);
    await expect(mic.ensure()).rejects.toBeDefined();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('resolves null when getUserMedia is unavailable', async () => {
    await expect(setup(null).ensure()).resolves.toBeNull();
  });

  it('release stops every track and allows a later prompt', async () => {
    const track = fakeTrack();
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream([track]));
    const mic = setup(getUserMedia as never);

    await mic.ensure();
    mic.release();
    expect(track.stop).toHaveBeenCalledOnce();

    await mic.ensure();
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });
});
