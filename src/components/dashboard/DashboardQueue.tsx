import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Play, Pause, Trash2, GripVertical, MoreHorizontal,
  Clock, User, ListMusic
} from "lucide-react";

interface QueueItem {
  id: string;
  title: string;
  artist: string;
  duration: string;
  requestedBy: string;
  cover: string;
}

const mockQueue: QueueItem[] = [
  { id: "1", title: "Blinding Lights", artist: "The Weeknd", duration: "3:20", requestedBy: "Alex", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop" },
  { id: "2", title: "Starboy", artist: "The Weeknd", duration: "3:50", requestedBy: "Jordan", cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop" },
  { id: "3", title: "Levitating", artist: "Dua Lipa", duration: "3:23", requestedBy: "Sam", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop" },
  { id: "4", title: "Save Your Tears", artist: "The Weeknd", duration: "3:35", requestedBy: "Casey", cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop" },
  { id: "5", title: "Don't Start Now", artist: "Dua Lipa", duration: "3:03", requestedBy: "Alex", cover: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=100&h=100&fit=crop" },
  { id: "6", title: "Watermelon Sugar", artist: "Harry Styles", duration: "2:54", requestedBy: "Jordan", cover: "https://images.unsplash.com/photo-1446057032654-9d8885db76c6?w=100&h=100&fit=crop" },
  { id: "7", title: "Circles", artist: "Post Malone", duration: "3:35", requestedBy: "Sam", cover: "https://images.unsplash.com/photo-1504898770365-14faca6a7320?w=100&h=100&fit=crop" },
  { id: "8", title: "Mood", artist: "24kGoldn", duration: "2:20", requestedBy: "Casey", cover: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=100&h=100&fit=crop" },
];

const DashboardQueue = () => {
  const [queue, setQueue] = useState(mockQueue);
  const [nowPlayingIndex, setNowPlayingIndex] = useState(0);

  const removeFromQueue = (id: string) => {
    setQueue(queue.filter(item => item.id !== id));
  };

  const totalDuration = queue.reduce((acc, item) => {
    const [mins, secs] = item.duration.split(':').map(Number);
    return acc + mins * 60 + secs;
  }, 0);

  const formatTotalDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Queue</h1>
          <p className="text-muted-foreground">
            {queue.length} tracks • {formatTotalDuration(totalDuration)} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Queue
          </Button>
          <Button variant="hero" size="sm">
            <Play className="w-4 h-4 mr-2" />
            Play All
          </Button>
        </div>
      </div>

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-primary" />
            Up Next
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs text-muted-foreground border-b border-border">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Title</div>
              <div className="col-span-2">
                <User className="w-3 h-3 inline mr-1" />
                Requested By
              </div>
              <div className="col-span-2">
                <Clock className="w-3 h-3 inline mr-1" />
                Duration
              </div>
              <div className="col-span-2"></div>
            </div>

            {/* Queue Items */}
            {queue.map((item, index) => (
              <div 
                key={item.id}
                className={`grid grid-cols-12 gap-4 px-3 py-3 rounded-lg group transition-colors ${
                  index === nowPlayingIndex 
                    ? 'bg-primary/10 border border-primary/20' 
                    : 'hover:bg-secondary/50'
                }`}
              >
                <div className="col-span-1 flex items-center">
                  <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab mr-2" />
                  <span className="text-sm text-muted-foreground group-hover:hidden">
                    {index + 1}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon-sm" 
                    className="hidden group-hover:flex"
                    onClick={() => setNowPlayingIndex(index)}
                  >
                    {index === nowPlayingIndex ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="col-span-5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                    <img src={item.cover} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      index === nowPlayingIndex ? 'text-primary' : 'text-foreground'
                    }`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{item.artist}</p>
                  </div>
                </div>
                <div className="col-span-2 flex items-center">
                  <span className="text-sm text-muted-foreground">{item.requestedBy}</span>
                </div>
                <div className="col-span-2 flex items-center">
                  <span className="text-sm text-muted-foreground">{item.duration}</span>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => removeFromQueue(item.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardQueue;
