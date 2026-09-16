import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Disc3, Play, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArtCover } from "./ArtCover";
import { useJukebox } from "@/lib/jukebox/store";
import { formatTime, groupByAlbum, sortByName } from "@/lib/jukebox/grouping";
import type { AlbumGroup, Track } from "@/lib/jukebox/types";

function TrackRow({ track, index }: { track: Track; index?: number }) {
  const { enqueue, playNow } = useJukebox();
  return (
    <li className="group flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent">
      <span className="w-6 text-center text-xs tabular-nums text-muted-foreground">
        {index ?? track.trackNo ?? "•"}
      </span>
      <button
        className="min-w-0 flex-1 text-left"
        onClick={() => enqueue(track)}
        title="Adicionar à fila"
      >
        <p className="truncate text-sm font-medium">{track.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {track.artist} · {track.album}
        </p>
      </button>
      <span className="text-xs tabular-nums text-muted-foreground">
        {formatTime(track.duration)}
      </span>
      <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
        <Button size="icon" variant="ghost" className="size-8" onClick={() => enqueue(track)}>
          <Plus className="size-4" />
        </Button>
        <Button size="icon" variant="ghost" className="size-8" onClick={() => playNow(track)}>
          <Play className="size-4" />
        </Button>
      </div>
    </li>
  );
}

function AlbumCard({ album, onOpen }: { album: AlbumGroup; onOpen: () => void }) {
  const { enqueue } = useJukebox();
  const coverUrl = album.tracks.find((t) => t.coverUrl)?.coverUrl;
  return (
    <div className="group rounded-2xl bg-card p-3 transition hover:bg-elevated">
      <button onClick={onOpen} className="block w-full">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl">
          <ArtCover name={album.name} size="lg" url={coverUrl} />
        </div>
        <p className="mt-3 truncate text-left text-sm font-semibold">{album.name}</p>
        <p className="truncate text-left text-xs text-muted-foreground">
          {album.artist}
          {album.year ? ` · ${album.year}` : ""}
        </p>
      </button>
      <Button
        size="sm"
        variant="secondary"
        className="mt-3 w-full gap-2 opacity-0 transition group-hover:opacity-100"
        onClick={() => enqueue(album.tracks)}
      >
        <Plus className="size-4" /> Tocar álbum
      </Button>
    </div>
  );
}

export function LibraryView({
  view,
  search,
}: {
  view: "artistas" | "albuns" | "musicas";
  search: string;
}) {
  const { artists, albums, library, enqueue } = useJukebox();
  const [openArtist, setOpenArtist] = useState<string | null>(null);
  const [openAlbum, setOpenAlbum] = useState<string | null>(null);

  useEffect(() => {
    setOpenArtist(null);
    setOpenAlbum(null);
  }, [view]);

  const q = search.trim().toLowerCase();
  const match = (s: string) => s.toLowerCase().includes(q);

  const filteredTracks = useMemo(
    () =>
      sortByName(
        q
          ? library.tracks.filter((t) => match(t.title) || match(t.artist) || match(t.album))
          : library.tracks,
        (t) => `${t.artist} ${t.title}`,
      ),
    [library.tracks, q],
  );

  if (openAlbum) {
    const album = albums.find((a) => a.key === openAlbum);
    if (album) {
      return (
        <ScrollArea className="h-full">
          <div className="p-6">
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 gap-2"
              onClick={() => setOpenAlbum(null)}
            >
              <ChevronLeft className="size-4" /> Voltar
            </Button>
            <div className="flex flex-wrap items-end gap-5">
              <div className="size-40 overflow-hidden rounded-2xl">
                <ArtCover
                  name={album.name}
                  size="lg"
                  url={album.tracks.find((t) => t.coverUrl)?.coverUrl}
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Álbum</p>
                <h2 className="font-display text-3xl font-bold">{album.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {album.artist}
                  {album.year ? ` · ${album.year}` : ""} · {album.tracks.length} músicas
                </p>
                <Button className="mt-3 gap-2" onClick={() => enqueue(album.tracks)}>
                  <Play className="size-4" /> Tocar álbum
                </Button>
              </div>
            </div>
            <ul className="mt-6 space-y-1">
              {album.tracks.map((t, i) => (
                <TrackRow key={t.id} track={t} index={i + 1} />
              ))}
            </ul>
          </div>
        </ScrollArea>
      );
    }
  }

  if (openArtist) {
    const artist = artists.find((a) => a.name === openArtist);
    if (artist) {
      return (
        <ScrollArea className="h-full">
          <div className="p-6">
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 gap-2"
              onClick={() => setOpenArtist(null)}
            >
              <ChevronLeft className="size-4" /> Voltar
            </Button>
            <h2 className="font-display text-3xl font-bold">{artist.name}</h2>
            <p className="text-sm text-muted-foreground">
              {artist.albums.length} álbuns · {artist.trackCount} músicas
            </p>
            <div className="mt-6 space-y-8">
              {artist.albums.map((album) => (
                <div key={album.key}>
                  <div className="flex items-center gap-3">
                    <ArtCover
                      name={album.name}
                      size="md"
                      url={album.tracks.find((t) => t.coverUrl)?.coverUrl}
                    />
                    <div>
                      <p className="font-display font-semibold">{album.name}</p>
                      <p className="text-xs text-muted-foreground">{album.year ?? ""}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="ml-auto gap-2"
                      onClick={() => enqueue(album.tracks)}
                    >
                      <Plus className="size-4" /> Fila
                    </Button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {album.tracks.map((t, i) => (
                      <TrackRow key={t.id} track={t} index={i + 1} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      );
    }
  }

  if (view === "albuns") {
    const list = q
      ? groupByAlbum(library.tracks.filter((t) => match(t.album) || match(t.artist)))
      : albums;
    return (
      <ScrollArea className="h-full">
        <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {list.map((album) => (
            <AlbumCard key={album.key} album={album} onOpen={() => setOpenAlbum(album.key)} />
          ))}
        </div>
      </ScrollArea>
    );
  }

  if (view === "musicas") {
    return (
      <ScrollArea className="h-full">
        <ul className="space-y-1 p-4">
          {filteredTracks.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i + 1} />
          ))}
        </ul>
      </ScrollArea>
    );
  }

  const list = q ? artists.filter((a) => match(a.name)) : artists;
  return (
    <ScrollArea className="h-full">
      <ul className="divide-y divide-border/60 p-2">
        {list.map((artist) => (
          <li key={artist.name}>
            <button
              onClick={() => setOpenArtist(artist.name)}
              className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition hover:bg-accent"
            >
              <ArtCover
                name={artist.name}
                size="md"
                className="rounded-full"
                url={artist.albums.flatMap((a) => a.tracks).find((t) => t.coverUrl)?.coverUrl}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-semibold">{artist.name}</p>
                <p className="text-xs text-muted-foreground">
                  {artist.albums.length} álbuns · {artist.trackCount} músicas
                </p>
              </div>
              <Disc3 className="size-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
