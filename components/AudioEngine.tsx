'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';

export default function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const {
    currentSong,
    isPlaying,
    volume,
    setCurrentTime,
    setDuration,
    nextSong,
    prevSong,
    play,
    pause
  } = usePlayerStore();

  const playPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    
    if (isPlaying) {
      const promise = audio.play();
      playPromiseRef.current = promise;
      
      if (promise !== undefined) {
        promise
          .then(() => {
            playPromiseRef.current = null;
          })
          .catch(error => {
            playPromiseRef.current = null;
            if (error.name === 'NotAllowedError') {
              // Autoplay blocked by browser policy
              pause();
            }
            // AbortError is normal when play is rapidly interrupted by pause or song switch; ignore silently
          });
      }
    } else {
      if (playPromiseRef.current) {
        playPromiseRef.current
          .then(() => {
            audio.pause();
          })
          .catch(() => {
            // Ignore interruption
          });
      } else {
        audio.pause();
      }
    }
  }, [isPlaying, pause]);

  useEffect(() => {
    if (!audioRef.current || !currentSong) return;
    
    if (audioRef.current.src !== currentSong.audio_url) {
      audioRef.current.src = currentSong.audio_url;
      if (isPlaying) {
        audioRef.current.play().catch(error => {
          if (error.name !== 'AbortError') {
            console.warn('Auto-play prevented:', error);
          }
        });
      }
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: 'Selin Player',
        artwork: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ]
      });

      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('previoustrack', prevSong);
      navigator.mediaSession.setActionHandler('nexttrack', nextSong);
    }
  }, [currentSong, isPlaying, play, pause, prevSong, nextSong]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    nextSong();
  };

  return (
    <audio
      id="player-audio"
      ref={audioRef}
      preload="auto"
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onEnded={handleEnded}
      className="hidden"
    />
  );
}
