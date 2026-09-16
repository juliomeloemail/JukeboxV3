import { useState } from "react";
import { Disc3, ListMusic, Music2, Radio, Search, Users } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { LibraryView } from "@/components/jukebox/LibraryView";
import { PlayerBar } from "@/components/jukebox/PlayerBar";
import { QueuePanel } from "@/components/jukebox/QueuePanel";
import { SettingsDialog } from "@/components/jukebox/SettingsDialog";
import { JukeboxProvider, useJukebox } from "@/lib/jukebox/store";
import { cn } from "@/lib/utils";

type View = "artistas" | "albuns" | "musicas";

const navItems: Array<{ id: View; label: string; icon: typeof Music2 }> = [
  { id: "artistas", label: "Artistas", icon: Users },
  { id: "albuns", label: "Álbuns", icon: Disc3 },
  { id: "musicas", label: "Músicas", icon: Music2 },
];

export function JukeboxApp() {
  return (
    <JukeboxProvider>
      <JukeboxScreen />
    </JukeboxProvider>
  );
}

function JukeboxScreen() {
  const [view, setView] = useState<View>("artistas");
  const [search, setSearch] = useState("");
  const { library, demoMode, settings, queue, network } = useJukebox();

  return (
    <div className="jb-stage flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Radio className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold leading-none">{settings.partyName}</h1>
            <p className="text-[11px] text-muted-foreground">
              {library.tracks.length} músicas · {queue.length} na fila
            </p>
          </div>
        </div>

        <div className="relative ml-auto w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar artista, álbum ou música"
            className="pl-9"
          />
        </div>

        {demoMode && <Badge variant="secondary">Modo demonstração</Badge>}
        {network?.guestUrl && <Badge>{network.guestUrl}</Badge>}
        <SettingsDialog />
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-52 shrink-0 flex-col gap-1 border-r border-border bg-sidebar p-3 md:flex">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                view === item.id
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          ))}
          <div className="mt-auto rounded-xl bg-sidebar-accent/60 p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-2 font-semibold text-sidebar-foreground">
              <ListMusic className="size-4" /> Pedidos
            </p>
            <p className="mt-1">
              {settings.allowGuests
                ? "Convidados podem pedir músicas pelo celular."
                : "Pedidos pelo celular desligados."}
            </p>
          </div>
        </nav>

        <main className="min-w-0 flex-1">
          <div className="flex gap-2 border-b border-border p-2 md:hidden">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  "flex-1 rounded-lg px-3 py-2 text-sm",
                  view === item.id ? "bg-accent text-primary" : "text-muted-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="h-full">
            <LibraryView view={view} search={search} />
          </div>
        </main>

        <div className="hidden w-80 shrink-0 lg:block">
          <QueuePanel />
        </div>
      </div>

      <PlayerBar />
      <Toaster position="top-right" />
    </div>
  );
}
