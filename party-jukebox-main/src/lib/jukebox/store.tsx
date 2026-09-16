import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { demoLibrary } from "./demo-library";
import {
  fetchGuestRequests,
  fetchLibrary,
  fetchNetwork,
  publishNowPlaying,
  pushSettings,
  rescanLibrary,
  type NetworkInfo,
} from "./api";
import { groupByAlbum, groupByArtist } from "./grouping";
import { defaultSettings, type Library, type QueueItem, type Settings, type Track } from "./types";

const SETTINGS_KEY = "jukebox.settings.v1";

type JukeboxValue = {
  library: Library;
  loading: boolean;
  demoMode: boolean;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  artists: ReturnType<typeof groupByArtist>;
  albums: ReturnType<typeof groupByAlbum>;
  queue: QueueItem[];
  current: QueueItem | null;
  playing: boolean;
  progress: number;
  duration: number;
  network: NetworkInfo | null;
  enqueue: (tracks: Track | Track[], requestedBy?: string) => void;
  playNow: (track: Track) => void;
  removeFromQueue: (uid: string) => void;
  clearQueue: () => void;
  toggle: () => void;
  next: () => void;
  seek: (seconds: number) => void;
  rescan: (folder?: string) => Promise<void>;
};

const Ctx = createContext<JukeboxValue | null>(null);

let uidCounter = 0;
const nextUid = () => `q${Date.now().toString(36)}-${uidCounter++}`;

export function JukeboxProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useState<Library>(demoLibrary);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(true);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [current, setCurrent] = useState<QueueItem | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // load saved settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) setSettings({ ...defaultSettings, ...JSON.parse(saved) });
    } catch {
      /* ignore */
    }
  }, []);

  // initial library load
  useEffect(() => {
    let alive = true;
    (async () => {
      const lib = await fetchLibrary();
      if (!alive) return;
      if (lib) {
        setLibrary(lib);
        setDemoMode(false);
        setNetwork(await fetchNetwork());
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const nextSettings = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
      } catch {
        /* ignore */
      }
      void pushSettings(nextSettings);
      return nextSettings;
    });
  }, []);

  const artists = useMemo(() => groupByArtist(library.tracks), [library.tracks]);
  const albums = useMemo(() => groupByAlbum(library.tracks), [library.tracks]);

  const startTrack = useCallback((item: QueueItem) => {
    setCurrent(item);
    setProgress(0);
    setDuration(item.track.duration || 0);
    setPlaying(true);
  }, []);

  const next = useCallback(() => {
    setQueue((q) => {
      if (q.length === 0) {
        setCurrent(null);
        setPlaying(false);
        return q;
      }
      const [head, ...rest] = q;
      startTrack(head!);
      return rest;
    });
  }, [startTrack]);

  const enqueue = useCallback(
    (tracks: Track | Track[], requestedBy = "Você") => {
      const list = Array.isArray(tracks) ? tracks : [tracks];
      if (list.length === 0) return;
      const items = list.map((track) => ({ uid: nextUid(), track, requestedBy }));
      setCurrent((cur) => {
        if (cur) {
          setQueue((q) => [...q, ...items]);
        } else {
          const [first, ...rest] = items;
          setQueue((q) => [...q, ...rest]);
          startTrack(first!);
        }
        return cur;
      });
      toast.success(
        list.length === 1 ? `"${list[0]!.title}" na fila` : `${list.length} músicas na fila`,
      );
    },
    [startTrack],
  );

  const playNow = useCallback(
    (track: Track) => {
      startTrack({ uid: nextUid(), track, requestedBy: "Você" });
    },
    [startTrack],
  );

  const removeFromQueue = useCallback((uid: string) => {
    setQueue((q) => q.filter((i) => i.uid !== uid));
  }, []);

  const clearQueue = useCallback(() => setQueue([]), []);

  const toggle = useCallback(() => {
    setCurrent((cur) => {
      if (!cur) {
        next();
        return cur;
      }
      setPlaying((p) => !p);
      return cur;
    });
  }, [next]);

  const seek = useCallback((seconds: number) => {
    setProgress(seconds);
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.duration)) audio.currentTime = seconds;
  }, []);

  // audio element control (real files)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current?.track.url) return;
    if (audio.src !== current.track.url) {
      audio.src = current.track.url;
      audio.load();
    }
    if (playing) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }, [current, playing]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = settings.volume;
  }, [settings.volume]);

  // demo ticker so the UI works without real audio files
  useEffect(() => {
    if (!playing || !current || current.track.url) return;
    const id = setInterval(() => {
      setProgress((p) => {
        if (p + 1 >= (current.track.duration || 1)) {
          next();
          return 0;
        }
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, current, next]);

  // guest requests polling
  useEffect(() => {
    if (demoMode || !settings.allowGuests) return;
    const id = setInterval(async () => {
      const reqs = await fetchGuestRequests();
      if (reqs.length === 0) return;
      const byId = new Map(library.tracks.map((t) => [t.id, t]));
      const items = reqs
        .map((r) => {
          const track = byId.get(r.trackId);
          return track ? { uid: r.uid, track, requestedBy: r.requestedBy } : null;
        })
        .filter(Boolean) as QueueItem[];
      if (items.length === 0) return;
      setCurrent((cur) => {
        if (cur) {
          setQueue((q) => [...q, ...items]);
        } else {
          const [first, ...rest] = items;
          setQueue((q) => [...q, ...rest]);
          startTrack(first!);
        }
        return cur;
      });
      toast(`${items.length} pedido(s) dos convidados`);
    }, 3000);
    return () => clearInterval(id);
  }, [demoMode, settings.allowGuests, library.tracks, startTrack]);

  // publish state for guest screens
  useEffect(() => {
    if (demoMode) return;
    void publishNowPlaying({
      partyName: settings.partyName,
      current: current?.track ?? null,
      queue: queue.map((q) => ({
        title: q.track.title,
        artist: q.track.artist,
        by: q.requestedBy,
      })),
      playing,
    });
  }, [demoMode, current, queue, playing, settings.partyName]);

  // auto shuffle when queue runs dry
  useEffect(() => {
    if (!settings.autoShuffle || current || queue.length > 0 || library.tracks.length === 0) return;
    const pick = library.tracks[Math.floor(Math.random() * library.tracks.length)]!;
    startTrack({ uid: nextUid(), track: pick, requestedBy: "Automático" });
  }, [settings.autoShuffle, current, queue.length, library.tracks, startTrack]);

  const rescan = useCallback(
    async (folder?: string) => {
      setLoading(true);
      const lib = await rescanLibrary(folder ?? settings.musicFolder);
      if (lib) {
        setLibrary(lib);
        setDemoMode(false);
        setNetwork(await fetchNetwork());
        toast.success(`${lib.tracks.length} músicas encontradas`);
      } else {
        toast.error("Servidor local não encontrado — usando acervo de demonstração.");
      }
      setLoading(false);
    },
    [settings.musicFolder],
  );

  const value: JukeboxValue = {
    library,
    loading,
    demoMode,
    settings,
    updateSettings,
    artists,
    albums,
    queue,
    current,
    playing,
    progress,
    duration,
    network,
    enqueue,
    playNow,
    removeFromQueue,
    clearQueue,
    toggle,
    next,
    seek,
    rescan,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => next()}
        hidden
      />
    </Ctx.Provider>
  );
}

export function useJukebox() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useJukebox precisa estar dentro de JukeboxProvider");
  return ctx;
}
