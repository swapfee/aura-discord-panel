// src/components/dashboard/NowPlaying.tsx
import { useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  Heart,
  ListMusic,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useBot } from "@/contexts/BotContext";

// ---------------------------------------------
// Helpers
// ---------------------------------------------
const formatTime = (seconds?: number): string => {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// ---------------------------------------------
// Component
// ---------------------------------------------
const NowPlaying = () => {
  const {
    sendCommand,
    loading,
    currentServerId,
  } = useBot();

  // Until realtime bot state exists
  const isConnected = Boolean(currentServerId);
  const isLoading = loading;

  // Stubbed music state (SAFE)
  const musicState = null;
  const nowPlaying = musicState?.nowPlaying;
  const status = musicState?.status;

  const [localVolume, setLocalVolume] = useState<number[]>([50]);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  const progress =
    nowPlaying && nowPlaying.duration > 0
      ? [(nowPlaying.position / nowPlaying.duration) * 100]
      : [0];

  const safeCommand = async (
    fn: () => Promise<any>
  ) => {
    if (!isConnected || isLoading) return;
    try {
      await fn();
    } catch (e) {
      console.error(e);
    }
  };

  // ---------------------------------------------
  // UI
  // ---------------------------------------------
  return (
    <div className="fixed bottom-0 left-16 lg:left-64 right-0 h-24 bg-card/95 backdrop-blur-2xl border-t border-border z-40">
      <div className="h-full flex items-center px-4 gap-4">

        {/* Track Info */}
        <div className="flex items-center gap-4 w-1/4 min-w-0">
          <div
            className={cn(
              "w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center",
              !nowPlaying && "bg-muted"
            )}
          >
            {nowPlaying ? (
              <img
                src={nowPlaying.thumbnail}
                alt={nowPlaying.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <ListMusic className="w-6 h-6 text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0">
            <h4 className="text-sm font-medium truncate">
              {nowPlaying?.title || "Nothing playing"}
            </h4>
            <p className="text-xs text-muted-foreground truncate">
              {nowPlaying?.artist || "Select a server and play music"}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsLiked(!isLiked)}
            disabled={!nowPlaying}
            className={cn(isLiked && "text-primary")}
          >
            <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
          </Button>
        </div>

        {/* Controls */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!isConnected}
              onClick={() => safeCommand(() => sendCommand("shuffle"))}
            >
              <Shuffle className="w-4 h-4" />
            </Button>

            <Button variant="ghost" size="icon" disabled>
              <SkipBack className="w-5 h-5" />
            </Button>

            <Button
              variant="hero"
              size="icon-lg"
              disabled={!isConnected}
              onClick={() =>
                safeCommand(() =>
                  sendCommand("play")
                )
              }
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : status?.isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              disabled={!isConnected}
              onClick={() => safeCommand(() => sendCommand("skip"))}
            >
              <SkipForward className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!isConnected}
              onClick={() =>
                safeCommand(() =>
                  sendCommand("loop", { loop: "off" })
                )
              }
            >
              <Repeat className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-full flex items-center gap-3">
            <span className="text-xs w-10 text-right">
              {formatTime(nowPlaying?.position)}
            </span>
            <Slider
              value={progress}
              max={100}
              step={1}
              disabled
            />
            <span className="text-xs w-10">
              {formatTime(nowPlaying?.duration)}
            </span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 w-1/4 justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!isConnected}
            onClick={() =>
              safeCommand(() =>
                sendCommand("volume", {
                  volume: isMuted ? localVolume[0] : 0,
                })
              )
            }
          >
            {isMuted ? <VolumeX /> : <Volume2 />}
          </Button>

          <Slider
            value={isMuted ? [0] : localVolume}
            max={100}
            step={1}
            disabled={!isConnected}
            onValueChange={(v) => {
              setLocalVolume(v);
              safeCommand(() =>
                sendCommand("volume", { volume: v[0] })
              );
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default NowPlaying;
