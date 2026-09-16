import { Pause, Play, SkipForward, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ArtCover } from "./ArtCover";
import { useJukebox } from "@/lib/jukebox/store";
import { formatTime } from "@/lib/jukebox/grouping";

export function PlayerBar() {
  const { current, playing, progress, duration, toggle, next, seek, settings, updateSettings } =
    useJukebox();

  const total = duration || current?.track.duration || 0;

  return (
    <footer className="border-t border-border bg-surface/90 backdrop-blur">
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-6 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {current ? (
            <ArtCover name={current.track.album} size="md" />
          ) : (
            <div className="size-14 rounded-xl bg-muted" />
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold">
              {current?.track.title ?? "Nada tocando"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {current ? `${current.track.artist} · ${current.track.album}` : "Escolha uma música"}
            </p>
            {current && current.requestedBy !== "Você" && (
              <p className="truncate text-[11px] text-primary">pedido de {current.requestedBy}</p>
            )}
          </div>
          {playing && (
            <div className="ml-2 hidden items-end gap-[3px] sm:flex" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="jb-eq-bar h-5 w-[3px] rounded-full bg-primary"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-[2] flex-col gap-1">
          <div className="flex items-center justify-center gap-2">
            <Button size="icon" className="size-11 rounded-full" onClick={toggle}>
              {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            </Button>
            <Button size="icon" variant="ghost" className="rounded-full" onClick={next}>
              <SkipForward className="size-5" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
            <span>{formatTime(progress)}</span>
            <Slider
              value={[Math.min(progress, total)]}
              max={Math.max(total, 1)}
              step={1}
              onValueChange={([v]) => seek(v ?? 0)}
              className="flex-1"
            />
            <span>{formatTime(total)}</span>
          </div>
        </div>

        <div className="hidden flex-1 items-center justify-end gap-2 md:flex">
          <Volume2 className="size-4 text-muted-foreground" />
          <Slider
            value={[settings.volume * 100]}
            max={100}
            step={1}
            onValueChange={([v]) => updateSettings({ volume: (v ?? 0) / 100 })}
            className="w-32"
          />
        </div>
      </div>
    </footer>
  );
}
