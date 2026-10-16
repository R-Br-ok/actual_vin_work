'use client';

import React from 'react';
import { Wifi, Activity, Clock } from 'lucide-react';

export function DriftIndicator({ rtt, clockOffset, driftInfo, isHost }) {
  const { driftSeconds, currentRate, action } = driftInfo;
  const driftMs = Math.round(driftSeconds * 1000);

  const getStatusColor = () => {
    if (isHost) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (Math.abs(driftMs) <= 100) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (Math.abs(driftMs) <= 500) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-wide">
      {/* Sync Status Badge */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border backdrop-blur-md ${getStatusColor()}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        <span>
          {isHost ? 'Host Master Clock' : action === 'IN_SYNC' ? 'Synced' : action}
        </span>
      </div>

      {/* RTT Badge */}
      <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-line bg-panel-soft/60 text-muted backdrop-blur-md">
        <Wifi size={12} className="text-secondary" />
        <span>RTT: {rtt}ms</span>
      </div>

      {/* Offset Badge */}
      <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-line bg-panel-soft/60 text-muted backdrop-blur-md">
        <Clock size={12} className="text-accent" />
        <span>Offset: {clockOffset > 0 ? `+${clockOffset}` : clockOffset}ms</span>
      </div>

      {/* Drift Badge */}
      {!isHost && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-line bg-panel-soft/60 text-muted backdrop-blur-md">
          <Activity size={12} />
          <span>Drift: {driftMs > 0 ? `+${driftMs}` : driftMs}ms ({currentRate}x)</span>
        </div>
      )}
    </div>
  );
}
