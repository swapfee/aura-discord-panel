import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  Sliders, Waves, Volume2, Zap, Music, RotateCcw
} from "lucide-react";

interface Filter {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: React.ReactNode;
}

const DashboardFilters = () => {
  const [filters, setFilters] = useState<Filter[]>([
    { id: "bassboost", name: "Bass Boost", description: "Enhance low frequencies", enabled: true, icon: <Waves className="w-5 h-5" /> },
    { id: "nightcore", name: "Nightcore", description: "Speed up and pitch shift", enabled: false, icon: <Zap className="w-5 h-5" /> },
    { id: "8d", name: "8D Audio", description: "Spatial surround effect", enabled: false, icon: <Music className="w-5 h-5" /> },
    { id: "vaporwave", name: "Vaporwave", description: "Slow down and pitch down", enabled: false, icon: <Waves className="w-5 h-5" /> },
    { id: "karaoke", name: "Karaoke", description: "Remove vocals from track", enabled: false, icon: <Music className="w-5 h-5" /> },
    { id: "tremolo", name: "Tremolo", description: "Volume oscillation effect", enabled: false, icon: <Waves className="w-5 h-5" /> },
  ]);

  const [eqBands, setEqBands] = useState([
    { freq: "32Hz", value: [50] },
    { freq: "64Hz", value: [60] },
    { freq: "125Hz", value: [55] },
    { freq: "250Hz", value: [50] },
    { freq: "500Hz", value: [45] },
    { freq: "1kHz", value: [50] },
    { freq: "2kHz", value: [55] },
    { freq: "4kHz", value: [60] },
    { freq: "8kHz", value: [55] },
    { freq: "16kHz", value: [50] },
  ]);

  const [volume, setVolume] = useState([80]);
  const [speed, setSpeed] = useState([100]);
  const [pitch, setPitch] = useState([100]);

  const toggleFilter = (id: string) => {
    setFilters(filters.map(f => 
      f.id === id ? { ...f, enabled: !f.enabled } : f
    ));
  };

  const resetEQ = () => {
    setEqBands(eqBands.map(band => ({ ...band, value: [50] })));
  };

  const updateBand = (index: number, value: number[]) => {
    const newBands = [...eqBands];
    newBands[index].value = value;
    setEqBands(newBands);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Filters & Equalizer</h1>
        <p className="text-muted-foreground">Customize your audio experience with filters and EQ settings.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Audio Filters */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" />
              Audio Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {filters.map((filter) => (
                <div 
                  key={filter.id}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    filter.enabled 
                      ? 'bg-primary/10 border-primary/30' 
                      : 'bg-secondary/30 border-border hover:border-border/80'
                  }`}
                  onClick={() => toggleFilter(filter.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${
                      filter.enabled ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {filter.icon}
                    </div>
                    <Switch 
                      checked={filter.enabled} 
                      onCheckedChange={() => toggleFilter(filter.id)}
                    />
                  </div>
                  <h4 className="font-medium text-foreground text-sm">{filter.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{filter.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Controls */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-primary" />
              Quick Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Volume */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">Volume</span>
                <span className="text-sm text-muted-foreground">{volume[0]}%</span>
              </div>
              <Slider
                value={volume}
                onValueChange={setVolume}
                max={200}
                step={1}
              />
            </div>

            {/* Speed */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">Playback Speed</span>
                <span className="text-sm text-muted-foreground">{speed[0] / 100}x</span>
              </div>
              <Slider
                value={speed}
                onValueChange={setSpeed}
                min={50}
                max={200}
                step={5}
              />
            </div>

            {/* Pitch */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">Pitch</span>
                <span className="text-sm text-muted-foreground">{pitch[0] > 100 ? '+' : ''}{pitch[0] - 100}%</span>
              </div>
              <Slider
                value={pitch}
                onValueChange={setPitch}
                min={50}
                max={150}
                step={1}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Equalizer */}
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Waves className="w-5 h-5 text-primary" />
            10-Band Equalizer
          </CardTitle>
          <Button variant="outline" size="sm" onClick={resetEQ}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 h-48 px-4">
            {eqBands.map((band, index) => (
              <div key={band.freq} className="flex flex-col items-center gap-3 flex-1">
                <div className="h-36 flex items-center">
                  <Slider
                    orientation="vertical"
                    value={band.value}
                    onValueChange={(v) => updateBand(index, v)}
                    max={100}
                    step={1}
                    className="h-full"
                  />
                </div>
                <span className="text-xs text-muted-foreground">{band.freq}</span>
              </div>
            ))}
          </div>

          {/* Presets */}
          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border">
            <span className="text-sm text-muted-foreground mr-2">Presets:</span>
            <Button variant="control" size="sm">Flat</Button>
            <Button variant="control" size="sm">Bass Heavy</Button>
            <Button variant="control" size="sm">Vocal</Button>
            <Button variant="control" size="sm">Electronic</Button>
            <Button variant="control" size="sm">Rock</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardFilters;
