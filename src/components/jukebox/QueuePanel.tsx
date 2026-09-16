import { useState } from "react";
import { ListMusic, Trash2, X, Download, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArtCover } from "./ArtCover";
import { useJukebox } from "@/lib/jukebox/store";
import { formatTime } from "@/lib/jukebox/grouping";

export function QueuePanel() {
  const { queue, removeFromQueue, clearQueue, current, moveQueueItem, reorderQueue } = useJukebox();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);

  const exportQueueToJSON = () => {
    if (queue.length === 0) return;

    const playlistData = queue.map((item, index) => ({
      posicao: index + 1,
      titulo: item.track.title,
      artista: item.track.artist,
      album: item.track.album,
      duracao: formatTime(item.track.duration),
      pedidoPor: item.requestedBy,
    }));

    const dataStr = JSON.stringify(playlistData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `playlist-jukebox-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Fila de reprodução exportada com sucesso como JSON!");
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDraggedOverIndex(index);
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = () => {
    setDraggedOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndexStr = e.dataTransfer.getData("text/plain");
    if (sourceIndexStr) {
      const sourceIndex = parseInt(sourceIndexStr, 10);
      if (sourceIndex !== targetIndex && !isNaN(sourceIndex)) {
        reorderQueue(sourceIndex, targetIndex);
        toast.success("Ordem da fila atualizada!");
      }
    }
    setDraggedIndex(null);
    setDraggedOverIndex(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowUp" && (e.altKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (index > 0) {
        moveQueueItem(index, "up");
        setTimeout(() => {
          document.getElementById(`qitem-${index - 1}`)?.focus();
        }, 50);
      }
    } else if (e.key === "ArrowDown" && (e.altKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (index < queue.length - 1) {
        moveQueueItem(index, "down");
        setTimeout(() => {
          document.getElementById(`qitem-${index + 1}`)?.focus();
        }, 50);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      document.getElementById(`qitem-${index - 1}`)?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      document.getElementById(`qitem-${index + 1}`)?.focus();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const item = queue[index];
      if (item) {
        removeFromQueue(item.uid);
        toast.info("Música removida da fila");
        // Focus nearby item
        const nextFocusIdx = index === queue.length - 1 ? index - 1 : index;
        setTimeout(() => {
          document.getElementById(`qitem-${nextFocusIdx}`)?.focus();
        }, 50);
      }
    }
  };

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-surface/60">
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <ListMusic className="size-4 text-primary" />
          Fila ({queue.length})
        </h2>

        <div className="flex items-center gap-1">
          {queue.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={exportQueueToJSON}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 px-2 h-8 rounded-lg hover:bg-primary/10 transition-all"
                title="Exportar fila como JSON"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Salvar</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearQueue}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 px-2 h-8 rounded-lg hover:bg-destructive/10 transition-all"
                title="Esvaziar toda a fila de reprodução"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">Limpar</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {current && (
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-primary/10 p-3 border border-primary/20">
          <ArtCover name={current.track.album} size="sm" url={current.track.coverUrl} />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-primary">Tocando agora</p>
            <p className="truncate text-sm font-medium">{current.track.title}</p>
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
            {queue.map((item, i) => {
              const isFirst = i === 0;
              const isLast = i === queue.length - 1;
              const isDraggedOver = draggedOverIndex === i;

              return (
                <li
                  key={item.uid}
                  id={`qitem-${i}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, i)}
                  onKeyDown={(e) => handleKeyDown(e, i)}
                  tabIndex={0}
                  className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    draggedIndex === i ? "opacity-40 bg-accent/30" : "hover:bg-accent"
                  } ${
                    isDraggedOver
                      ? "border-t-2 border-primary pt-1.5"
                      : "border-t border-transparent"
                  }`}
                  title="Arraste para reordenar, ou use as setas com Alt"
                >
                  {/* Grip handle for Drag and Drop */}
                  <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 opacity-45 group-hover:opacity-100 transition-opacity p-1">
                    <GripVertical className="size-3.5" />
                  </div>

                  <span className="w-5 text-center text-xs tabular-nums text-muted-foreground font-semibold">
                    {i + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.track.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.track.artist} · {formatTime(item.track.duration)}
                      {item.requestedBy !== "Você" && ` · por ${item.requestedBy}`}
                    </p>
                  </div>

                  {/* Move & Action Controls */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
                    {/* Move Up */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-20 disabled:hover:bg-transparent"
                      disabled={isFirst}
                      onClick={() => moveQueueItem(i, "up")}
                      title="Mover para cima"
                    >
                      <ChevronUp className="size-4" />
                    </Button>

                    {/* Move Down */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-20 disabled:hover:bg-transparent"
                      disabled={isLast}
                      onClick={() => moveQueueItem(i, "down")}
                      title="Mover para baixo"
                    >
                      <ChevronDown className="size-4" />
                    </Button>

                    {/* Delete Only From Queue */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeFromQueue(item.uid)}
                      title="Remover da fila"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}
