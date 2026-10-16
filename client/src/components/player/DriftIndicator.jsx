'use client';

import React, { useState } from 'react';
import { Activity, Gauge, Wifi } from 'lucide-react';
import { DRIFT_STATUS } from '../../hooks/useDriftCorrection';
import { cn } from '../../lib/utils';

const STATUS_META = {
  [DRIFT_STATUS.ALIGNED]: { label: 'Aligned', tone: 'good' },
  [DRIFT_STATUS.SPEED_UP]: { label: 'Catching up', tone: 'warn' },
  [DRIFT_STATUS.SLOW_DOWN]: { label: 'Easing back', tone: 'warn' },
  [DRIFT_STATUS.HARD_SEEK]: { label: 'Re-synced', tone: 'bad' },
  [DRIFT_STATUS.BUFFERING]: { label: 'Buffering', tone: 'warn' },
  [DRIFT_STATUS.PAUSED]: { label: 'Paused', tone: 'idle' },
  [DRIFT_STATUS.BLOCKED]: { label: 'Tap to play', tone: 'warn' },
  [DRIFT_STATUS.MASTER]: { label: 'Master clock', tone: 'good' },
  [DRIFT_STATUS.IDLE]: { label: 'Syncing', tone: 'idle' },
};

const TONE_DOT = {
  good: 'bg-emerald-400 shadow-emerald-400/70',
  warn: 'bg-amber-400 shadow-amber-400/70',
  bad: 'bg-rose-400 shadow-rose-400/70',
  idle: 'bg-slate-400 shadow-slate-400/40',
};

const fmtMs = (ms) => `${ms > 0 ? '+' : ''}${ms}ms`;

/**
 * Live telemetry pill: RTT · Drift · Playback rate (click for clock offset details).
 */
export function DriftIndicator({ rtt, clockOffset, driftInfo, isHost, isSynced }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[driftInfo.status] || STATUS_META[DRIFT_STATUS.IDLE];
  const tone = !isSynced ? 'idle' : meta.tone;

  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className="glass-overlay pointer-events-auto flex flex-col items-stretch rounded-2xl px-3 py-1.5 text-left font-mono text-[11px] text-app-text/90 transition hover:border-white/20"
      title="Sync telemetry — click for details"
    >
      <span className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 font-sans font-semibold">
          <span className={cn('h-1.5 w-1.5 rounded-full shadow-[0_0_8px]', TONE_DOT[tone])} />
          {isSynced ? meta.label : 'Clock sync…'}
        </span>
        <span className="flex items-center gap-1 text-app-text/75" aria-label="Round trip time">
          <Wifi size={11} className="text-secondary" />
          {rtt}ms
        </span>
        <span className="flex items-center gap-1 text-app-text/75" aria-label="Drift">
          <Activity size={11} className="text-accent-soft" />
          {isHost ? '—' : fmtMs(driftInfo.driftMs)}
        </span>
        <span className="flex items-center gap-1 text-app-text/75" aria-label="Playback rate">
          <Gauge size={11} className="text-amber-300" />
          {Number(driftInfo.rate || 1).toFixed(2)}×
        </span>
      </span>
      {expanded && (
        <span className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t border-white/10 pt-1.5 text-[10px] text-muted">
          <span>offset θ</span>
          <span className="text-right text-app-text/80">{fmtMs(clockOffset)}</span>
          <span>expected</span>
          <span className="text-right text-app-text/80">{driftInfo.expected.toFixed(2)}s</span>
          <span>actual</span>
          <span className="text-right text-app-text/80">{driftInfo.actual.toFixed(2)}s</span>
          <span>role</span>
          <span className="text-right text-app-text/80">{isHost ? 'host' : 'viewer'}</span>
        </span>
      )}
    </button>
  );
}
