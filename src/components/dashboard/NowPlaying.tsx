import { useState, useEffect } from "react";
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  Repeat, Shuffle, Heart, Maximize2, ListMusic, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useBot } from "@/contexts/BotContext";

// Format seconds to mm:ss
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const NowPlaying = () => {
  const { musicState, sendCommand, isLoading, isConnected } = useBot();
  const [localVolume, setLocalVolume] = useState([50]);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  const nowPlaying = musicState?.nowPlaying;
  const status = musicState?.status;

  // Sync local volume with bot status
  useEffect(() => {
    if (status?.volume !== undefined) {
      setLocalVolume([status.volume]);
    }
  }, [status?.volume]);

  // Calculate progress percentage
  const progress = nowPlaying 
    ? [(nowPlaying.position / nowPlaying.duration) * 100] 
    : [0];

  const handlePlayPause = async () => {
    if (status?.isPlaying) {
      await sendCommand("pause");
    } else {
      await sendCommand("play");
    }
  };

  const handleSkipForward = async () => {
    await sendCommand("skip");
  };

  const handleShuffle = async () => {
    await sendCommand("shuffle");
  };

  const handleRepeat = async () => {
    const nextMode = status?.loop === "off" ? "track" : status?.loop === "track" ? "queue" : "off";
    await sendCommand("loop", { loop: nextMode });
  };

  const handleVolumeChange = async (value: number[]) => {
    setLocalVolume(value);
    await sendCommand("volume", { volume: value[0] });
  };

  const handleSeek = async (value: number[]) => {
    if (!nowPlaying) return;
    const position = Math.floor((value[0] / 100) * nowPlaying.duration);
    await sendCommand("seek", { position });
  };

  const toggleMute = async () => {
    if (isMuted) {
      setIsMuted(false);
      await sendCommand("volume", { volume: localVolume[0] });
    } else {
      setIsMuted(true);
      await sendCommand("volume", { volume: 0 });
    }
  };

  return (
    <div className="fixed bottom-0 left-16 lg:left-64 right-0 h-24 bg-card/95 backdrop-blur-2xl border-t border-border z-40 transition-all duration-300">
      <div className="h-full flex items-center px-4 gap-4">
        {/* Track Info */}
        <div className="flex items-center gap-4 w-1/4 min-w-0">
          <div className={cn(
            "w-14 h-14 rounded-lg overflow-hidden shrink-0 shadow-lg flex items-center justify-center",
            !nowPlaying && "bg-muted"
          )}>
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
            <h4 className="text-sm font-medium text-foreground truncate">
              {nowPlaying?.title || "Nothing playing"}
            </h4>
            <p className="text-xs text-muted-foreground truncate">
              {nowPlaying?.artist || "Play something to get started"}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon-sm"
            onClick={() => setIsLiked(!isLiked)}
            className={cn(isLiked && "text-primary")}
            disabled={!nowPlaying}
          >
            <Heart className={cn("w-4 h-4", isLiked && "fill-current")} />
          </Button>
        </div>

        {/* Controls */}
        <div className="flex-1 flex flex-col items-center gap-2 max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon-sm"
              onClick={handleShuffle}
              disabled={isLoading || !isConnected}
              className={cn(status?.shuffle && "text-primary")}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              disabled={isLoading || !isConnected}
            >
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button 
              variant="hero" 
              size="icon-lg"
              onClick={handlePlayPause}
              disabled={isLoading || !isConnected || !nowPlaying}
              className="rounded-full"
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
              onClick={handleSkipForward}
              disabled={isLoading || !isConnected}
            >
              <SkipForward className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon-sm"
              onClick={handleRepeat}
              disabled={isLoading || !isConnected}
              className={cn(status?.loop !== "off" && "text-primary")}
            >
              <Repeat className="w-4 h-4" />
              {status?.loop === "track" && (
                <span className="absolute text-[8px] font-bold">1</span>
              )}
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="w-full flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-10 text-right">
              {nowPlaying ? formatTime(nowPlaying.position) : "0:00"}
            </span>
            <Slider
              value={progress}
              onValueChange={handleSeek}
              max={100}
              step={1}
              className="flex-1"
              disabled={!nowPlaying || !isConnected}
            />
            <span className="text-xs text-muted-foreground w-10">
              {nowPlaying ? formatTime(nowPlaying.duration) : "0:00"}
            </span>
          </div>
        </div>

        {/* Volume & Actions */}
        <div className="flex items-center gap-2 w-1/4 justify-end">
          <Button variant="ghost" size="icon-sm">
            <ListMusic className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 w-32">
            <Button 
              variant="ghost" 
              size="icon-sm"
              onClick={toggleMute}
            >
              {isMuted || localVolume[0] === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
            <Slider
              value={isMuted ? [0] : localVolume}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1"
              disabled={!isConnected}
            />
          </div>
          <Button variant="ghost" size="icon-sm">
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NowPlaying;
