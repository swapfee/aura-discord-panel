// Bot sync types - these should match your Discord bot's data structures

export interface NowPlaying {
  title: string;
  artist: string;
  thumbnail: string;
  duration: number; // in seconds
  position: number; // current position in seconds
  requestedBy: string;
  url: string;
}

export interface QueueItem {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number; // in seconds
  requestedBy: string;
  url: string;
  addedAt: string; // ISO timestamp
}

export interface HistoryItem extends QueueItem {
  playedAt: string; // ISO timestamp
}

export interface PlayerStatus {
  isPlaying: boolean;
  isPaused: boolean;
  volume: number; // 0-100
  loop: "off" | "track" | "queue";
  shuffle: boolean;
}

export interface ServerMusicState {
  serverId: string;
  nowPlaying: NowPlaying | null;
  queue: QueueItem[];
  history: HistoryItem[];
  status: PlayerStatus;
  lastUpdated: string;
}

export type BotCommand = 
  | "play"
  | "pause"
  | "skip"
  | "stop"
  | "shuffle"
  | "loop"
  | "volume"
  | "seek"
  | "remove"
  | "clear"
  | "add";

export interface CommandPayload {
  command: BotCommand;
  serverId: string;
  data?: {
    query?: string;
    volume?: number;
    position?: number;
    index?: number;
    loop?: "off" | "track" | "queue";
  };
}

export type BotSyncEvent = 
  | "update_now_playing"
  | "update_queue"
  | "add_history"
  | "update_status"
  | "full_sync";
