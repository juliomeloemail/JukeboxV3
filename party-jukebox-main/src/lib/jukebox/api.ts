import type { Library, Settings } from "./types";

/**
 * The desktop build (Electron) runs a small local server that scans the music
 * folder and serves audio to phones on the same Wi-Fi. In the web preview that
 * server does not exist, so we fall back to a demo library.
 */
let resolvedBase: string | null | undefined;

function candidates(): string[] {
  if (typeof window === "undefined") return [];
  const list: string[] = [];
  const { protocol, origin } = window.location;
  if (protocol === "http:" || protocol === "https:") list.push(origin);
  list.push("http://127.0.0.1:8099");
  return Array.from(new Set(list));
}

async function ping(base: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 1500);
  try {
    const res = await fetch(`${base}/jb/api/health`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function getBase(): Promise<string | null> {
  if (resolvedBase !== undefined) return resolvedBase;
  for (const base of candidates()) {
    if (await ping(base)) {
      resolvedBase = base;
      return base;
    }
  }
  resolvedBase = null;
  return null;
}

export async function fetchLibrary(): Promise<Library | null> {
  const base = await getBase();
  if (!base) return null;
  const res = await fetch(`${base}/jb/api/library`);
  if (!res.ok) return null;
  const data = (await res.json()) as Library;
  return {
    ...data,
    tracks: data.tracks.map((t) => ({ ...t, url: `${base}${t.url}` })),
  };
}

export async function rescanLibrary(folder?: string): Promise<Library | null> {
  const base = await getBase();
  if (!base) return null;
  const res = await fetch(`${base}/jb/api/rescan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ folder }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Library;
  return { ...data, tracks: data.tracks.map((t) => ({ ...t, url: `${base}${t.url}` })) };
}

export type NetworkInfo = { addresses: string[]; port: number; guestUrl: string | null };

export async function fetchNetwork(): Promise<NetworkInfo | null> {
  const base = await getBase();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/jb/api/network`);
    if (!res.ok) return null;
    return (await res.json()) as NetworkInfo;
  } catch {
    return null;
  }
}

export async function pushSettings(settings: Settings) {
  const base = await getBase();
  if (!base) return;
  try {
    await fetch(`${base}/jb/api/settings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    });
  } catch {
    /* offline is fine */
  }
}

export type GuestRequest = { uid: string; trackId: string; requestedBy: string };

export async function fetchGuestRequests(): Promise<GuestRequest[]> {
  const base = await getBase();
  if (!base) return [];
  try {
    const res = await fetch(`${base}/jb/api/requests?consume=1`);
    if (!res.ok) return [];
    return (await res.json()) as GuestRequest[];
  } catch {
    return [];
  }
}

export async function publishNowPlaying(payload: unknown) {
  const base = await getBase();
  if (!base) return;
  try {
    await fetch(`${base}/jb/api/now-playing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore */
  }
}
