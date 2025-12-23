import { useState } from "react";
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, 
  Repeat, Shuffle, Heart, Maximize2, ListMusic
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const NowPlaying = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([75]);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [shuffleOn, setShuffleOn] = useState(false);

  // null means nothing is playing
  const currentTrack = null as {
    title: string;
    artist: string;
    album: string;
    duration: string;
    currentTime: string;
    cover: string;
  } | null;

  const progress = currentTrack ? [35] : [0];

  return (
    <div className="fixed bottom-0 left-16 lg:left-64 right-0 h-24 bg-card/95 backdrop-blur-2xl border-t border-border z-40 transition-all duration-300">
      <div className="h-full flex items-center px-4 gap-4">
        {/* Track Info */}
        <div className="flex items-center gap-4 w-1/4 min-w-0">
          <div className={cn(
            "w-14 h-14 rounded-lg overflow-hidden shrink-0 shadow-lg flex items-center justify-center",
            !currentTrack && "bg-muted"
          )}>
            {currentTrack ? (
              <img 
                src={currentTrack.cover} 
                alt={currentTrack.album}
                className="w-full h-full object-cover"
              />
            ) : (
              <ListMusic className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-foreground truncate">
              {currentTrack?.title || "Nothing playing"}
            </h4>
            <p className="text-xs text-muted-foreground truncate">
              {currentTrack?.artist || "Play something to get started"}
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon-sm"
            onClick={() => setIsLiked(!isLiked)}
            className={cn(isLiked && "text-primary")}
            disabled={!currentTrack}
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
              onClick={() => setShuffleOn(!shuffleOn)}
              className={cn(shuffleOn && "text-primary")}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <SkipBack className="w-5 h-5" />
            </Button>
            <Button 
              variant="hero" 
              size="icon-lg"
              onClick={() => setIsPlaying(!isPlaying)}
              className="rounded-full"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </Button>
            <Button variant="ghost" size="icon">
              <SkipForward className="w-5 h-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon-sm"
              onClick={() => {
                const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
                const currentIndex = modes.indexOf(repeatMode);
                setRepeatMode(modes[(currentIndex + 1) % 3]);
              }}
              className={cn(repeatMode !== "off" && "text-primary")}
            >
              <Repeat className="w-4 h-4" />
              {repeatMode === "one" && (
                <span className="absolute text-[8px] font-bold">1</span>
              )}
            </Button>
          </div>

          {/* Progress Bar */}
          <div className="w-full flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-10 text-right">
              {currentTrack?.currentTime || "0:00"}
            </span>
            <Slider
              value={progress}
              max={100}
              step={1}
              className="flex-1"
              disabled={!currentTrack}
            />
            <span className="text-xs text-muted-foreground w-10">
              {currentTrack?.duration || "0:00"}
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
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted || volume[0] === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
            <Slider
              value={isMuted ? [0] : volume}
              onValueChange={setVolume}
              max={100}
              step={1}
              className="flex-1"
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
