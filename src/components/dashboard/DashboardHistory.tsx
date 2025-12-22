import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Play, Plus, Clock, History as HistoryIcon, Search
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface HistoryItem {
  id: string;
  title: string;
  artist: string;
  duration: string;
  playedAt: string;
  playedBy: string;
  cover: string;
}

const mockHistory: HistoryItem[] = [
  { id: "1", title: "Blinding Lights", artist: "The Weeknd", duration: "3:20", playedAt: "2 min ago", playedBy: "Alex", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop" },
  { id: "2", title: "Starboy", artist: "The Weeknd", duration: "3:50", playedAt: "6 min ago", playedBy: "Jordan", cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop" },
  { id: "3", title: "Levitating", artist: "Dua Lipa", duration: "3:23", playedAt: "10 min ago", playedBy: "Sam", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop" },
  { id: "4", title: "Save Your Tears", artist: "The Weeknd", duration: "3:35", playedAt: "14 min ago", playedBy: "Casey", cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop" },
  { id: "5", title: "Don't Start Now", artist: "Dua Lipa", duration: "3:03", playedAt: "18 min ago", playedBy: "Alex", cover: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=100&h=100&fit=crop" },
  { id: "6", title: "Watermelon Sugar", artist: "Harry Styles", duration: "2:54", playedAt: "22 min ago", playedBy: "Jordan", cover: "https://images.unsplash.com/photo-1446057032654-9d8885db76c6?w=100&h=100&fit=crop" },
  { id: "7", title: "Circles", artist: "Post Malone", duration: "3:35", playedAt: "26 min ago", playedBy: "Sam", cover: "https://images.unsplash.com/photo-1504898770365-14faca6a7320?w=100&h=100&fit=crop" },
  { id: "8", title: "Mood", artist: "24kGoldn", duration: "2:20", playedAt: "30 min ago", playedBy: "Casey", cover: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=100&h=100&fit=crop" },
  { id: "9", title: "Dynamite", artist: "BTS", duration: "3:19", playedAt: "35 min ago", playedBy: "Alex", cover: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=100&h=100&fit=crop" },
  { id: "10", title: "Positions", artist: "Ariana Grande", duration: "2:52", playedAt: "40 min ago", playedBy: "Jordan", cover: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=100&h=100&fit=crop" },
];

const DashboardHistory = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">History</h1>
          <p className="text-muted-foreground">Previously played tracks in this session.</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search history..." 
            className="pl-9 bg-secondary/50 border-border"
          />
        </div>
      </div>

      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-primary" />
            Recently Played
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {mockHistory.map((item) => (
              <div 
                key={item.id}
                className="flex items-center gap-4 px-3 py-3 rounded-lg group hover:bg-secondary/50 transition-colors"
              >
                <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                  <img src={item.cover} alt={item.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-5 h-5 text-foreground" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.artist}</p>
                </div>
                <div className="hidden md:block text-sm text-muted-foreground w-24">
                  {item.playedBy}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground w-20">
                  <Clock className="w-3 h-3" />
                  {item.duration}
                </div>
                <div className="text-sm text-muted-foreground w-24 text-right">
                  {item.playedAt}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon-sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm">
                    <Play className="w-4 h-4" />
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

export default DashboardHistory;
