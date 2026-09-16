import type { AlbumGroup, ArtistGroup, Track } from "./types";

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

export function sortByName<T>(items: T[], key: (item: T) => string) {
  return [...items].sort((a, b) => collator.compare(key(a), key(b)));
}

export function groupByArtist(tracks: Track[]): ArtistGroup[] {
  const map = new Map<string, Track[]>();
  for (const t of tracks) {
    const list = map.get(t.artist) ?? [];
    list.push(t);
    map.set(t.artist, list);
  }
  const groups: ArtistGroup[] = [...map.entries()].map(([name, list]) => ({
    name,
    trackCount: list.length,
    albums: groupByAlbum(list),
  }));
  return sortByName(groups, (g) => g.name);
}

export function groupByAlbum(tracks: Track[]): AlbumGroup[] {
  const map = new Map<string, Track[]>();
  for (const t of tracks) {
    const key = `${t.artist}::${t.album}`;
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  const albums: AlbumGroup[] = [...map.entries()].map(([key, list]) => {
    const first = list[0]!;
    return {
      key,
      name: first.album,
      artist: first.artist,
      ...(first.year !== undefined ? { year: first.year } : {}),
      tracks: [...list].sort(
        (a, b) => (a.trackNo ?? 0) - (b.trackNo ?? 0) || collator.compare(a.title, b.title),
      ),
    };
  });
  return sortByName(albums, (a) => `${a.artist} - ${a.name}`);
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function initials(text: string) {
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}
