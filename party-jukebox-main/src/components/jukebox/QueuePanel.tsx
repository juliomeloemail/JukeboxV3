import { ListMusic, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArtCover } from "./ArtCover";
import { useJukebox } from "@/lib/jukebox/store";
import { formatTime } from "@/lib/jukebox/grouping";

export function QueuePanel() {
  const { queue, removeFromQueue, clearQueue, current } = useJukebox();

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-surface/60">
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <ListMusic className="size-4 text-primary" />
          Fila ({queue.length})
        </h2>
        {queue.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearQueue}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {current && (
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-primary/10 p-3">
          <ArtCover name={current.track.album} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-primary">Tocando agora</p>
            <p className="truncate text-sm">{current.track.title}</p>
            <p className="truncate text-xs text-muted-foreground">{current.track.artist}</p>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1 px-2">
        {queue.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            A fila está vazia. Toque em uma música para adicionar.
          </p>
        ) : (
          <ul className="space-y-1 pb-4">
            {queue.map((item, i) => (
              <li
                key={item.uid}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent"
              >
                <span className="w-5 text-center text-xs tabular-nums text-muted-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{item.track.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.track.artist} · {formatTime(item.track.duration)}
                    {item.requestedBy !== "Você" && ` · ${item.requestedBy}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 opacity-0 group-hover:opacity-100"
                  onClick={() => removeFromQueue(item.uid)}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}
