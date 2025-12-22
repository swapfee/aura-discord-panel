import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Play, Plus, FolderOpen, MoreHorizontal, Music, 
  Heart, Clock, Shuffle
} from "lucide-react";

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  duration: string;
  cover: string;
  isLiked: boolean;
}

const mockPlaylists: Playlist[] = [
  { id: "1", name: "Chill Vibes", trackCount: 42, duration: "2h 34m", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop", isLiked: true },
  { id: "2", name: "Party Mix", trackCount: 67, duration: "4h 12m", cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop", isLiked: false },
  { id: "3", name: "Focus Time", trackCount: 23, duration: "1h 45m", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop", isLiked: true },
  { id: "4", name: "Workout Energy", trackCount: 38, duration: "2h 08m", cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=200&fit=crop", isLiked: false },
  { id: "5", name: "Late Night", trackCount: 31, duration: "1h 56m", cover: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=200&h=200&fit=crop", isLiked: true },
  { id: "6", name: "Road Trip", trackCount: 54, duration: "3h 22m", cover: "https://images.unsplash.com/photo-1446057032654-9d8885db76c6?w=200&h=200&fit=crop", isLiked: false },
];

const DashboardPlaylists = () => {
  const [playlists, setPlaylists] = useState(mockPlaylists);

  const toggleLike = (id: string) => {
    setPlaylists(playlists.map(p => 
      p.id === id ? { ...p, isLiked: !p.isLiked } : p
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Playlists</h1>
          <p className="text-muted-foreground">Your saved playlists and collections.</p>
        </div>
        <Button variant="hero" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Playlist
        </Button>
      </div>

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            My Playlists
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((playlist) => (
              <div 
                key={playlist.id}
                className="group relative rounded-xl overflow-hidden bg-secondary/30 border border-border hover:border-primary/30 transition-all duration-300"
              >
                {/* Cover */}
                <div className="relative aspect-square">
                  <img 
                    src={playlist.cover} 
                    alt={playlist.name} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                  
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="hero" size="icon-lg" className="rounded-full shadow-2xl">
                      <Play className="w-6 h-6 ml-1" />
                    </Button>
                  </div>

                  {/* Actions */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="glass" 
                      size="icon-sm"
                      onClick={() => toggleLike(playlist.id)}
                    >
                      <Heart className={`w-4 h-4 ${playlist.isLiked ? 'fill-primary text-primary' : ''}`} />
                    </Button>
                    <Button variant="glass" size="icon-sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-foreground mb-1 truncate">{playlist.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Music className="w-3 h-3" />
                      {playlist.trackCount} tracks
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {playlist.duration}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button variant="control" size="sm" className="flex-1">
                      <Play className="w-4 h-4 mr-1" />
                      Play
                    </Button>
                    <Button variant="control" size="icon-sm">
                      <Shuffle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPlaylists;
