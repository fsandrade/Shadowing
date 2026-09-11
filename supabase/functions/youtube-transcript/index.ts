import { parseJson3Captions } from './parse.ts';

const WATCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

// YouTube's caption API is undocumented and changes without notice; fetching
// the watch page's player response is the least-fragile route we found and
// still needs one request per video. When YouTube breaks this (it has before),
// the function errors 4xx/5xx and the client shows "Could not load the video
// subtitles." - the parser above is the part we control and test.
// ponytail: single-language (first en/* track) and no caching beyond the
// browser's localStorage; add a server cache when transcripts get re-fetched.
interface CaptionTrack {
  baseUrl?: string;
  languageCode?: string;
}

function firstEnglishTrack(tracks: unknown): string | null {
  if (!Array.isArray(tracks)) { return null; }
  const english = (tracks as CaptionTrack[])
    .filter((t) => (t.languageCode ?? '').toLowerCase().startsWith('en'))
    .find((t) => typeof t.baseUrl === 'string' && t.baseUrl);
  return english?.baseUrl ?? null;
}

async function captionTrackUrl(videoId: string): Promise<string> {
  const res = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
    headers: { 'User-Agent': WATCH_UA, 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!res.ok) { throw new Error('watch page fetch failed'); }
  const html = await res.text();
  const m = html.match(/captionTracks":(\[.*?\])/s);
  if (!m) { throw new Error('no caption tracks'); }
  const track = firstEnglishTrack(JSON.parse(m[1]));
  if (!track) { throw new Error('no english captions'); }
  return track.includes('fmt') ? track : `${track}&fmt=json3`;
}

async function fetchSegments(videoId: string): Promise<Array<{ start: number; text: string }>> {
  const url = await captionTrackUrl(videoId);
  const res = await fetch(url, { headers: { 'User-Agent': WATCH_UA } });
  if (!res.ok) { throw new Error('caption fetch failed'); }
  return parseJson3Captions(await res.json());
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405 });
  }
  try {
    const { videoId } = await req.json() as { videoId?: unknown };
    if (typeof videoId !== 'string' || !/^[\w-]{6,}$/.test(videoId)) {
      return new Response(JSON.stringify({ error: 'bad videoId' }), { status: 400 });
    }
    const segments = await fetchSegments(videoId);
    return new Response(JSON.stringify({ segments }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'could not fetch captions' }), { status: 502 });
  }
});
