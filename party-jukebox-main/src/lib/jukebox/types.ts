export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  year?: number;
  genre?: string;
  duration: number;
  trackNo?: number;
  url: string;
};

export type Library = {
  folder: string;
  scannedAt: string;
  tracks: Track[];
  demo?: boolean;
};

export type QueueItem = {
  uid: string;
  track: Track;
  requestedBy: string;
};

export type Settings = {
  musicFolder: string;
  volume: number;
  crossfade: number;
  normalize: boolean;
  outputLabel: string;
  serverPort: number;
  allowGuests: boolean;
  guestLimit: number;
  guestCanSkip: boolean;
  autoShuffle: boolean;
  fadeOnSkip: boolean;
  partyName: string;
  screenAlwaysOn: boolean;
};

export const defaultSettings: Settings = {
  musicFolder: "C:\\musicas\\jukebox",
  volume: 0.8,
  crossfade: 0,
  normalize: true,
  outputLabel: "Padrão do sistema",
  serverPort: 8099,
  allowGuests: true,
  guestLimit: 3,
  guestCanSkip: false,
  autoShuffle: true,
  fadeOnSkip: true,
  partyName: "Jukebox da Festa",
  screenAlwaysOn: true,
};

export type ArtistGroup = {
  name: string;
  albums: AlbumGroup[];
  trackCount: number;
};

export type AlbumGroup = {
  key: string;
  name: string;
  artist: string;
  year?: number;
  tracks: Track[];
};
