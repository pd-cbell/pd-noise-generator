import React, { useMemo } from 'react';

interface TrendData {
  ts: number;
  count: number;
}

interface TrendChartProps {
  data: TrendData[];
  height?: number;
  color?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({ 
  data, 
  height = 100, 
  color = '#10B981' // Default to Emerald-500
}) => {
  const points = useMemo(() => {
    if (data.length < 2) return [];

    const now = Date.now();
    const windowStart = now - 15 * 60 * 1000; // 15 mins ago
    
    // Determine scales
    const maxCount = Math.max(...data.map(d => d.count), 5); // Minimum scale of 5
    const minTs = windowStart;
    const maxTs = now;

    return data.map(d => ({
      x: ((d.ts - minTs) / (maxTs - minTs)) * 100, // Percentage 0-100
      y: 100 - (d.count / maxCount) * 100, // Percentage 0-100 (inverted for SVG)
      count: d.count,
      ts: d.ts
    }));
  }, [data]);

  if (points.length < 2) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-gray-400 italic bg-gray-50 rounded-md border border-dashed border-gray-200" style={{ height }}>
        Waiting for trend data...
      </div>
    );
  }

  // Build SVG Path
  const pathD = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ');

  // Build Area Path (close the loop)
  const areaD = `${pathD} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none" 
        className="w-full h-full overflow-visible"
      >
        {/* Grid lines */}
        <line x1="0" y1="25" x2="100" y2="25" stroke="#E5E7EB" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#E5E7EB" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1="75" x2="100" y2="75" stroke="#E5E7EB" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />

        {/* Area Fill */}
        <path d={areaD} fill={color} fillOpacity="0.1" />

        {/* Line Stroke */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />

        {/* Points */}
        {points.map((p, i) => (
          <circle 
            key={p.ts} 
            cx={p.x} 
            cy={p.y} 
            r="3" // Fixed radius
            fill="white" 
            stroke={color} 
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke" // Keeps circles round regardless of aspect ratio
            className="transition-all duration-300"
          >
            <title>{new Date(p.ts).toLocaleTimeString()}: {p.count} incidents</title>
          </circle>
        ))}
      </svg>
      
      {/* X-Axis Labels (Simple start/end) */}
      <div className="absolute bottom-0 left-0 text-[10px] text-gray-400 transform translate-y-full mt-1">
        -15m
      </div>
      <div className="absolute bottom-0 right-0 text-[10px] text-gray-400 transform translate-y-full mt-1">
        Now
      </div>
    </div>
  );
};
