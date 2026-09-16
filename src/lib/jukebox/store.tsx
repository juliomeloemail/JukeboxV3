/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-empty */
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
// @ts-expect-error jsmediatags has no default type definitions for the browser minified distribution
import jsmediatags from "jsmediatags/dist/jsmediatags.min.js";

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

async function readAudioMetadata(file: File): Promise<{
  title?: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  coverBlob?: Blob;
  year?: number;
}> {
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess: (tag) => {
        const { title, artist, album, picture, year } = tag.tags;
        let coverUrl: string | undefined;
        let coverBlob: Blob | undefined;

        if (picture) {
          try {
            const { data, format } = picture;
            coverBlob = new Blob([new Uint8Array(data)], { type: format });
            coverUrl = URL.createObjectURL(coverBlob);
          } catch (e) {
            console.error("[Jukebox Metadata] Erro ao criar ObjectURL da capa:", e);
          }
        }

        resolve({
          title: title ? title.trim() : undefined,
          artist: artist ? artist.trim() : undefined,
          album: album ? album.trim() : undefined,
          coverUrl,
          coverBlob,
          year: year ? parseInt(year, 10) : undefined,
        });
      },
      onError: (err) => {
        console.warn("[Jukebox Metadata] jsmediatags falhou para o arquivo:", file.name, err);
        resolve({});
      },
    });
  });
}

const DB_NAME = "JukeboxFilesDB";
const STORE_NAME = "files";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFileToDB(id: string, file: Blob | File): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(file, id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("[IndexedDB] Falha ao salvar arquivo:", id, e);
  }
}

async function getFileFromDB(id: string): Promise<File | Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as File | Blob) || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("[IndexedDB] Falha ao ler arquivo:", id, e);
    return null;
  }
}

async function clearFilesDB(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error("[IndexedDB] Falha ao limpar banco de dados:", e);
  }
}

const SETTINGS_KEY = "jukebox.settings.v1";
const LIBRARY_KEY = "jukebox.library.v2";

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
  loop: boolean;
  setLoop: (loop: boolean) => void;
  previous: () => void;
  enqueue: (tracks: Track | Track[], requestedBy?: string) => void;
  playNow: (track: Track) => void;
  removeFromQueue: (uid: string) => void;
  clearQueue: () => void;
  toggle: () => void;
  next: () => void;
  seek: (seconds: number) => void;
  rescan: (folder?: string) => Promise<void>;
  moveQueueItem: (index: number, direction: "up" | "down") => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
};

const Ctx = createContext<JukeboxValue | null>(null);

function selectDirectoryFallback(): Promise<FileList | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.multiple = true;
    input.style.display = "none";
    document.body.appendChild(input);

    input.onchange = () => {
      resolve(input.files);
      try {
        document.body.removeChild(input);
      } catch {}
    };

    const handleCancel = () => {
      resolve(null);
      try {
        document.body.removeChild(input);
      } catch {}
    };

    input.oncancel = handleCancel;
    input.click();
  });
}

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
  const [loop, setLoop] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [history, setHistory] = useState<QueueItem[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Keep references to prevent state-read stale closures and double updates in Concurrent Mode / Strict Mode
  const currentRef = useRef<QueueItem | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const historyRef = useRef<QueueItem[]>([]);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const seek = useCallback((seconds: number) => {
    setProgress(seconds);
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.duration)) audio.currentTime = seconds;
  }, []);

  // load saved settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) setSettings({ ...defaultSettings, ...JSON.parse(saved) });
    } catch {
      /* ignore */
    }
  }, []);

  // Monitor connection to the party network
  useEffect(() => {
    const handleOnline = () => {
      toast.success("Conexão restabelecida com a rede da festa!", {
        id: "party-network-status",
        duration: 3000,
      });
    };

    const handleOffline = () => {
      toast.error("Conexão com a rede da festa perdida. Tentando reconectar automaticamente...", {
        id: "party-network-status",
        duration: Infinity,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check in case they are already offline
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // initial library load with localStorage cache check
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const savedLib = localStorage.getItem(LIBRARY_KEY);
        if (savedLib) {
          const parsed = JSON.parse(savedLib);
          if (parsed && parsed.tracks && parsed.tracks.length > 0) {
            // Revive blob URLs from IndexedDB
            const revivedTracks = await Promise.all(
              parsed.tracks.map(async (track: Track) => {
                if (track.id.startsWith("local-")) {
                  const file = await getFileFromDB(track.id);
                  if (file) {
                    const freshUrl = URL.createObjectURL(file);
                    let freshCoverUrl = track.coverUrl;
                    if (track.coverUrl && track.coverUrl.startsWith("blob:")) {
                      const coverFile = await getFileFromDB(`cover-${track.id}`);
                      if (coverFile) {
                        freshCoverUrl = URL.createObjectURL(coverFile);
                      }
                    }
                    return {
                      ...track,
                      url: freshUrl,
                      coverUrl: freshCoverUrl,
                    };
                  }
                }
                return track;
              }),
            );

            // Re-apply revived tracks
            parsed.tracks = revivedTracks;

            if (alive) {
              setLibrary(parsed);
              setDemoMode(false);
              setNetwork(await fetchNetwork());
              setLoading(false);
            }
            return;
          }
        }
      } catch (e) {
        console.error("Erro ao carregar biblioteca do localStorage", e);
      }

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

  // Save custom library to localStorage when updated
  useEffect(() => {
    if (demoMode || !library || library.tracks.length === 0) return;
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    } catch (e) {
      console.error("Erro ao salvar biblioteca no localStorage", e);
    }
  }, [library, demoMode]);

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
    const prev = currentRef.current;
    if (prev) {
      setHistory((h) => [...h.slice(-19), prev]);
    }
    setCurrent(item);
    setHasStarted(true);
    setProgress(0);
    setDuration(item.track.duration || 0);
    setPlaying(true);
  }, []);

  const next = useCallback(() => {
    const q = queueRef.current;
    if (q.length === 0) {
      setCurrent(null);
      setPlaying(false);
    } else {
      const [head, ...rest] = q;
      setQueue(rest);
      startTrack(head!);
    }
  }, [startTrack]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      seek(0);
      return;
    }
    const h = historyRef.current;
    if (h.length === 0) {
      seek(0);
      return;
    }
    const nextHistory = [...h];
    const prevTrack = nextHistory.pop()!;
    setHistory(nextHistory);

    const cur = currentRef.current;
    if (cur) {
      setQueue((q) => [cur, ...q]);
    }
    setCurrent(prevTrack);
    setProgress(0);
    setDuration(prevTrack.track.duration || 0);
    setPlaying(true);
  }, [seek]);

  const enqueue = useCallback(
    (tracks: Track | Track[], requestedBy = "Você") => {
      const list = Array.isArray(tracks) ? tracks : [tracks];
      if (list.length === 0) return;
      const items = list.map((track) => ({ uid: nextUid(), track, requestedBy }));

      const cur = currentRef.current;
      if (cur) {
        setQueue((q) => [...q, ...items]);
      } else {
        const [first, ...rest] = items;
        setQueue((q) => [...q, ...rest]);
        startTrack(first!);
      }
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

  const moveQueueItem = useCallback((index: number, direction: "up" | "down") => {
    setQueue((q) => {
      const nextQ = [...q];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= nextQ.length) return q;

      const temp = nextQ[index]!;
      nextQ[index] = nextQ[targetIndex]!;
      nextQ[targetIndex] = temp;
      return nextQ;
    });
  }, []);

  const reorderQueue = useCallback((startIndex: number, endIndex: number) => {
    setQueue((q) => {
      const nextQ = [...q];
      const [removed] = nextQ.splice(startIndex, 1);
      if (removed) {
        nextQ.splice(endIndex, 0, removed);
      }
      return nextQ;
    });
  }, []);

  const clearQueue = useCallback(() => setQueue([]), []);

  const toggle = useCallback(() => {
    const cur = currentRef.current;
    if (!cur) {
      next();
    } else {
      setPlaying((p) => !p);
    }
  }, [next]);

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
          if (loop) {
            seek(0);
          } else {
            next();
          }
          return 0;
        }
        return p + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing, current, next, loop, seek]);

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
      const cur = currentRef.current;
      if (cur) {
        setQueue((q) => [...q, ...items]);
      } else {
        const [first, ...rest] = items;
        setQueue((q) => [...q, ...rest]);
        startTrack(first!);
      }
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

  // auto shuffle when queue runs dry (only after playing has started)
  useEffect(() => {
    if (
      !hasStarted ||
      !settings.autoShuffle ||
      current ||
      queue.length > 0 ||
      library.tracks.length === 0
    )
      return;
    const pick = library.tracks[Math.floor(Math.random() * library.tracks.length)]!;
    startTrack({ uid: nextUid(), track: pick, requestedBy: "Automático" });
  }, [hasStarted, settings.autoShuffle, current, queue.length, library.tracks, startTrack]);

  const rescan = useCallback(
    async (folder?: string) => {
      setLoading(true);
      const targetFolder = folder ?? settings.musicFolder;

      const lib = await rescanLibrary(targetFolder);
      if (lib && lib.folderExists) {
        setLibrary(lib);
        setDemoMode(false);
        setNetwork(await fetchNetwork());
        toast.success(`Sucesso! ${lib.tracks.length} músicas encontradas em "${lib.folder}".`);
        setLoading(false);
        return;
      }

      toast.info(
        `Caminho "${targetFolder}" não foi encontrado ou não está acessível diretamente. Iniciando seletor de diretório local fallback...`,
        {
          duration: 4000,
        },
      );

      try {
        let scannedFiles: { file: File; relativePath: string }[] = [];
        let folderName = "";

        const isIframe = typeof window !== "undefined" && window.self !== window.top;
        const useDirectoryPicker =
          typeof window !== "undefined" && "showDirectoryPicker" in window && !isIframe;

        console.log(
          "[Jukebox Scan] Iniciando escaneamento de diretório. isIframe:",
          isIframe,
          "useDirectoryPicker:",
          useDirectoryPicker,
        );

        if (useDirectoryPicker) {
          try {
            console.log("[Jukebox Scan] Tentando abrir o seletor nativo (showDirectoryPicker)...");
            const dirHandle = await (window as any).showDirectoryPicker({
              mode: "read",
            });
            folderName = dirHandle.name;
            console.log(
              "[Jukebox Scan] showDirectoryPicker aberto. Nome do diretório:",
              folderName,
            );

            async function walkDirectoryHandle(
              dir: any,
              relativePath = "",
            ): Promise<{ file: File; relativePath: string }[]> {
              const res: { file: File; relativePath: string }[] = [];
              for await (const entry of dir.values()) {
                const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
                if (entry.kind === "file") {
                  try {
                    const file = await entry.getFile();
                    res.push({ file, relativePath: entryPath });
                  } catch (e) {
                    console.error(
                      "[Jukebox Scan] Erro ao ler arquivo do FileSystemHandle:",
                      entry.name,
                      e,
                    );
                  }
                } else if (entry.kind === "directory") {
                  try {
                    const sub = await walkDirectoryHandle(entry, entryPath);
                    res.push(...sub);
                  } catch (e) {
                    console.error(
                      "[Jukebox Scan] Erro ao varrer subdiretório do FileSystemHandle:",
                      entry.name,
                      e,
                    );
                  }
                }
              }
              return res;
            }

            scannedFiles = await walkDirectoryHandle(dirHandle);
            console.log(
              "[Jukebox Scan] Varredura recursiva nativa finalizada. Encontrados no total:",
              scannedFiles.length,
              "arquivos de qualquer tipo.",
            );
          } catch (pickerError: any) {
            if (pickerError.name === "AbortError") {
              console.log("[Jukebox Scan] Seleção de diretório pelo seletor nativo cancelada.");
              toast.error("Seleção de diretório cancelada.");
              setLoading(false);
              return;
            }
            console.warn(
              "[Jukebox Scan] showDirectoryPicker falhou (ou não permitido no frame), ativando input fallback...",
              pickerError,
            );
            const fileList = await selectDirectoryFallback();
            if (fileList && fileList.length > 0) {
              const array = Array.from(fileList);
              folderName = array[0]?.webkitRelativePath?.split("/")[0] || "Diretório Local";
              scannedFiles = array.map((file) => {
                const parts = file.webkitRelativePath.split("/");
                const relativePath = parts.slice(1).join("/");
                return { file, relativePath };
              });
              console.log(
                "[Jukebox Scan] Seletor fallback finalizado. Pasta raiz:",
                folderName,
                "Encontrados:",
                scannedFiles.length,
                "arquivos.",
              );
            } else {
              console.log("[Jukebox Scan] Nenhum arquivo foi selecionado no seletor fallback.");
              toast.error("Nenhum arquivo selecionado.");
              setLoading(false);
              return;
            }
          }
        } else {
          console.log(
            "[Jukebox Scan] Pulando seletor nativo por restrições de iFrame. Abrindo seletor fallback...",
          );
          const fileList = await selectDirectoryFallback();
          if (fileList && fileList.length > 0) {
            const array = Array.from(fileList);
            folderName = array[0]?.webkitRelativePath?.split("/")[0] || "Diretório Local";
            scannedFiles = array.map((file) => {
              const parts = file.webkitRelativePath.split("/");
              const relativePath = parts.slice(1).join("/");
              return { file, relativePath };
            });
            console.log(
              "[Jukebox Scan] Seletor fallback finalizado. Pasta raiz:",
              folderName,
              "Encontrados:",
              scannedFiles.length,
              "arquivos.",
            );
          } else {
            console.log("[Jukebox Scan] Nenhum arquivo selecionado no seletor fallback.");
            toast.error("Nenhum arquivo selecionado.");
            setLoading(false);
            return;
          }
        }

        const audioExtensions = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"];
        console.log("[Jukebox Scan] Filtrando arquivos de áudio compatíveis com:", audioExtensions);
        const audioFiles = scannedFiles.filter(({ file }) =>
          audioExtensions.some((ext) => file.name.toLowerCase().endsWith(ext)),
        );

        console.log(
          `[Jukebox Scan] Filtragem finalizada. Compatíveis: ${audioFiles.length} de ${scannedFiles.length} arquivos totais.`,
        );

        if (audioFiles.length === 0) {
          console.warn("[Jukebox Scan] Nenhum arquivo de áudio compatível encontrado.");
          toast.error(
            "Nenhum arquivo de áudio compatível (.mp3, .wav, .m4a, etc.) foi encontrado no diretório.",
          );
          setLoading(false);
          return;
        }

        console.log("[Jukebox Metadata] Iniciando extração de metadados das músicas...");
        // Clear previous IndexedDB entries before writing fresh files
        await clearFilesDB();

        const localTracks = await Promise.all(
          audioFiles.map(async ({ file, relativePath }, idx) => {
            const metadata = await readAudioMetadata(file);

            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            const cleanName = nameWithoutExt.replace(/^\d+\s*[-.]?\s*/, "").trim();

            const parts = cleanName.split(/\s*[-—_]\s*/);
            let fallbackTitle = cleanName;
            let fallbackArtist = "Desconhecido";

            if (parts.length > 1) {
              fallbackArtist = parts[0]?.trim() || "Desconhecido";
              fallbackTitle = parts.slice(1).join(" - ").trim();
            }

            const segments = relativePath.split("/").filter(Boolean);
            let fallbackAlbum = "Sem álbum";

            if (segments.length >= 3) {
              fallbackArtist = segments[segments.length - 3]!;
              fallbackAlbum = segments[segments.length - 2]!;
            } else if (segments.length === 2) {
              fallbackArtist = segments[0]!;
              fallbackAlbum = "Sem álbum";
            }

            const formatString = (str: string) => {
              return str
                .replace(/[_-]+/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .split(" ")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(" ");
            };

            const artist =
              metadata.artist ||
              (fallbackArtist !== "Desconhecido" ? formatString(fallbackArtist) : "Desconhecido");
            const title = metadata.title || fallbackTitle;
            const album =
              metadata.album ||
              (fallbackAlbum !== "Sem álbum" ? formatString(fallbackAlbum) : "Sem álbum");

            const trackId = `local-${idx}-${Date.now().toString(36)}`;

            // Save file and cover blob to IndexedDB
            await saveFileToDB(trackId, file);
            if (metadata.coverBlob) {
              await saveFileToDB(`cover-${trackId}`, metadata.coverBlob);
            }

            const trackObj: Track = {
              id: trackId,
              title: title,
              artist: artist,
              album: album,
              year: metadata.year,
              duration: 210,
              url: URL.createObjectURL(file),
              coverUrl: metadata.coverUrl,
            };

            console.log(
              `[Jukebox Metadata] [${idx + 1}/${audioFiles.length}] Map: "${file.name}" -> Title: "${trackObj.title}", Artist: "${trackObj.artist}", Album: "${trackObj.album}" (Capa: ${trackObj.coverUrl ? "Sim" : "Não"})`,
            );

            return trackObj;
          }),
        );

        console.log("[Jukebox Scan] Ordenando a biblioteca local por Artista, Álbum e Título...");
        localTracks.sort(
          (a, b) =>
            a.artist.localeCompare(b.artist, "pt-BR") ||
            a.album.localeCompare(b.album, "pt-BR") ||
            a.title.localeCompare(b.title, "pt-BR"),
        );

        const localLib = {
          folder: folderName,
          folderExists: true,
          scannedAt: new Date().toISOString(),
          tracks: localTracks,
        };

        console.log("[Jukebox State] Atualizando estado global da biblioteca para:", localLib);
        setLibrary(localLib);
        console.log("[Jukebox State] Desativando demoMode...");
        setDemoMode(false);

        console.log("[Jukebox State] Buscando informações de rede...");
        setNetwork(await fetchNetwork());

        console.log("[Jukebox State] Tudo pronto! Sucesso na atualização do estado.");
        toast.success(
          `Sucesso! ${localTracks.length} músicas carregadas do diretório "${folderName}".`,
        );
      } catch (err: any) {
        console.error("[Jukebox Scan] Erro crítico no processo de varredura:", err);
        toast.error("Erro ao selecionar diretório: " + (err.message || String(err)));
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
    loop,
    setLoop,
    previous,
    enqueue,
    playNow,
    removeFromQueue,
    clearQueue,
    toggle,
    next,
    seek,
    rescan,
    moveQueueItem,
    reorderQueue,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => {
          if (loop) {
            seek(0);
            const audio = audioRef.current;
            if (audio) void audio.play().catch(() => {});
          } else {
            next();
          }
        }}
        onError={(e) => {
          const audio = e.currentTarget;
          if (audio.src && audio.src.startsWith("blob:")) {
            console.warn("Acesso ao arquivo local expirou após recarregamento:", audio.src);
            setPlaying(false);
            toast.error("O acesso aos arquivos locais expirou devido ao recarregamento.", {
              description:
                "Clique em 'Reler pasta' para re-vincular e autorizar as músicas de forma segura.",
              action: {
                label: "Reler pasta",
                onClick: () => {
                  void rescan();
                },
              },
              duration: 10000,
            });
          }
        }}
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
