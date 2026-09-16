import {
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ArtCover } from "./ArtCover";
import { useJukebox } from "@/lib/jukebox/store";
import { formatTime } from "@/lib/jukebox/grouping";

export function PlayerBar() {
  const {
    current,
    playing,
    progress,
    duration,
    toggle,
    next,
    previous,
    loop,
    setLoop,
    seek,
    settings,
    updateSettings,
  } = useJukebox();

  const total = duration || current?.track.duration || 0;

  return (
    <footer className="border-t border-border bg-surface/90 backdrop-blur">
      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-6 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {current ? (
            <ArtCover name={current.track.album} size="md" url={current.track.coverUrl} />
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
          {current && (
            <div className="ml-3 hidden items-end gap-[3px] h-6 sm:flex" aria-hidden>
              {[1.2, 0.8, 1.4, 0.9, 1.5, 0.7, 1.1, 1.3, 1.0, 0.6].map((speed, i) => (
                <span
                  key={i}
                  className={`eq-bar w-[3px] rounded-full bg-primary/80 transition-all duration-300 ${
                    playing ? "" : "eq-paused"
                  }`}
                  style={{
                    height: `${Math.floor(speed * 12 + 6)}px`,
                    animationDuration: `${speed}s`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-[2] flex-col gap-1">
          <div className="flex items-center justify-center gap-3">
            {/* Shuffle Toggle */}
            <Button
              size="icon"
              variant="ghost"
              className={`rounded-full size-9 ${
                settings.autoShuffle
                  ? "text-primary hover:text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => updateSettings({ autoShuffle: !settings.autoShuffle })}
              title={settings.autoShuffle ? "Modo aleatório ativado" : "Modo aleatório desativado"}
            >
              <Shuffle className="size-4" />
            </Button>

            {/* Previous Track / Restart */}
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full size-9 text-muted-foreground hover:text-foreground"
              onClick={previous}
              title="Voltar / Reiniciar música"
            >
              <SkipBack className="size-5" />
            </Button>

            {/* Play / Pause Toggle */}
            <Button
              size="icon"
              className="size-11 rounded-full bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-all shadow-md"
              onClick={toggle}
              title={playing ? "Pausar" : "Tocar"}
            >
              {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            </Button>

            {/* Next Track */}
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full size-9 text-muted-foreground hover:text-foreground"
              onClick={next}
              title="Próxima música"
            >
              <SkipForward className="size-5" />
            </Button>

            {/* Repeat / Loop Toggle */}
            <Button
              size="icon"
              variant="ghost"
              className={`rounded-full size-9 ${
                loop
                  ? "text-primary hover:text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setLoop(!loop)}
              title={loop ? "Repetir música atual" : "Não repetir"}
            >
              <Repeat className="size-4" />
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
          <Button
            size="icon"
            variant="ghost"
            className="size-8 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (settings.volume > 0) {
                (window as unknown as Record<string, number>)._prevVolume = settings.volume;
                updateSettings({ volume: 0 });
              } else {
                const prevVolume = (window as unknown as Record<string, number>)._prevVolume || 0.8;
                updateSettings({ volume: prevVolume });
              }
            }}
            title={settings.volume === 0 ? "Ativar som" : "Desativar som"}
          >
            {settings.volume === 0 ? (
              <VolumeX className="size-4" />
            ) : (
              <Volume2 className="size-4" />
            )}
          </Button>
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
