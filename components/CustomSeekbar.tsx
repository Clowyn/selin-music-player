'use client';

import { usePlayerStore } from '@/store/playerStore';
import { ChangeEvent, useState } from 'react';

const formatTime = (time: number) => {
  if (isNaN(time) || time < 0) return '0:00';
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function CustomSeekbar() {
  const { currentTime, duration, seekTo } = usePlayerStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  const displayTime = isDragging ? dragTime : currentTime;
  const max = duration || 0;
  const progressPercent = max > 0 ? (displayTime / max) * 100 : 0;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setDragTime(val);
  };

  const handlePointerDown = () => {
    setIsDragging(true);
    setDragTime(currentTime);
  };
  
  const handlePointerUp = () => {
    setIsDragging(false);
    seekTo(dragTime);
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-purple-200 font-medium px-1">
        <span>{formatTime(displayTime)}</span>
        <span>{formatTime(max - displayTime)}</span>
      </div>
      
      <div className="relative w-full h-8 flex items-center group touch-none">
        {/* Track background */}
        <div className="absolute left-0 right-0 h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm pointer-events-none">
          {/* Progress fill */}
          <div 
            className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        {/* Invisible range input for interaction */}
        <input 
          type="range"
          min="0"
          max={max}
          step="0.1"
          value={displayTime}
          onChange={handleChange}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
        
        {/* Custom Thumb - Hello Kitty style text emoji */}
        <div 
          className="absolute w-6 h-6 flex items-center justify-center transform -translate-x-1/2 pointer-events-none transition-transform group-active:scale-125"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="bg-white rounded-full p-1 shadow-lg border-2 border-pink-400 text-xs flex items-center justify-center w-8 h-8">
            🐱
          </div>
        </div>
      </div>
    </div>
  );
}
