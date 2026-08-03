'use client';

import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/playerStore';

export interface YTPlayer {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (vol: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, options: unknown) => YTPlayer;
    };
    onYouTubeIframeAPIReady: (() => void) | undefined;
    ytPlayer: YTPlayer | null;
  }
}

export default function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const [isYtApiReady, setIsYtApiReady] = useState(false);
  const loadedYoutubeIdRef = useRef<string | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

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

  // 1. Inject YouTube iFrame API script dynamically if not present & initialize YT.Player
  useEffect(() => {
    const initYTPlayer = () => {
      if (!window.YT || !window.YT.Player) return;
      if (ytPlayerRef.current) return;

      try {
        ytPlayerRef.current = new window.YT.Player('youtube-player', {
          height: '0',
          width: '0',
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
          },
          events: {
            onReady: () => {
              window.ytPlayer = ytPlayerRef.current;
              setIsYtApiReady(true);
            },
            onStateChange: (event: { data: number }) => {
              // State 0 is ENDED
              if (event.data === 0) {
                usePlayerStore.getState().nextSong();
              }
            },
          },
        });
      } catch (err) {
        console.error('Error initializing YouTube Player:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      initYTPlayer();
    } else {
      const existingScript = document.getElementById('yt-iframe-api');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
          document.head.appendChild(tag);
        }
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initYTPlayer();
      };
    }
  }, []);

  // 2. Playback management depending on currentSong (YouTube vs HTML5 Audio)
  useEffect(() => {
    if (!currentSong) return;

    if (currentSong.youtube_id) {
      // Pause HTML5 audio
      if (audioRef.current) {
        audioRef.current.pause();
      }

      if (isYtApiReady && ytPlayerRef.current) {
        if (loadedYoutubeIdRef.current !== currentSong.youtube_id) {
          loadedYoutubeIdRef.current = currentSong.youtube_id;
          if (typeof ytPlayerRef.current.loadVideoById === 'function') {
            ytPlayerRef.current.loadVideoById(currentSong.youtube_id);
          }
        }

        if (isPlaying) {
          if (typeof ytPlayerRef.current.playVideo === 'function') {
            ytPlayerRef.current.playVideo();
          }
        } else {
          if (typeof ytPlayerRef.current.pauseVideo === 'function') {
            ytPlayerRef.current.pauseVideo();
          }
        }
      }
    } else {
      // Standard MP3 track - Pause YouTube player if active
      if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch {}
      }
      loadedYoutubeIdRef.current = null;

      // Handle HTML5 Audio
      if (audioRef.current) {
        const audio = audioRef.current;
        if (audio.src !== currentSong.audio_url) {
          audio.src = currentSong.audio_url;
        }

        if (isPlaying) {
          const promise = audio.play();
          playPromiseRef.current = promise;
          if (promise !== undefined) {
            promise
              .then(() => {
                playPromiseRef.current = null;
              })
              .catch((error) => {
                playPromiseRef.current = null;
                if (error.name === 'NotAllowedError') {
                  pause();
                }
              });
          }
        } else {
          if (playPromiseRef.current) {
            playPromiseRef.current.then(() => audio.pause()).catch(() => {});
          } else {
            audio.pause();
          }
        }
      }
    }
  }, [currentSong, isPlaying, isYtApiReady, pause]);

  // Sync YouTube play/pause state when isPlaying changes
  useEffect(() => {
    if (currentSong?.youtube_id && isYtApiReady && ytPlayerRef.current) {
      if (isPlaying) {
        if (typeof ytPlayerRef.current.playVideo === 'function') {
          ytPlayerRef.current.playVideo();
        }
      } else {
        if (typeof ytPlayerRef.current.pauseVideo === 'function') {
          ytPlayerRef.current.pauseVideo();
        }
      }
    }
  }, [isPlaying, currentSong?.youtube_id, isYtApiReady]);

  // Volume sync for both HTML5 audio and YouTube API player
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      try {
        ytPlayerRef.current.setVolume(volume * 100);
      } catch {}
    }
  }, [volume]);

  // Periodic time & duration sync for YouTube API player
  useEffect(() => {
    if (!currentSong?.youtube_id || !isYtApiReady) return;

    const interval = setInterval(() => {
      if (ytPlayerRef.current) {
        if (typeof ytPlayerRef.current.getCurrentTime === 'function') {
          const time = ytPlayerRef.current.getCurrentTime();
          if (typeof time === 'number' && !isNaN(time)) {
            setCurrentTime(time);
          }
        }
        if (typeof ytPlayerRef.current.getDuration === 'function') {
          const dur = ytPlayerRef.current.getDuration();
          if (typeof dur === 'number' && !isNaN(dur) && dur > 0) {
            setDuration(dur);
          }
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [currentSong?.youtube_id, isYtApiReady, setCurrentTime, setDuration]);

  // MediaSession Metadata sync
  useEffect(() => {
    if (!currentSong) return;

    if ('mediaSession' in navigator) {
      const artworkUrl =
        currentSong.cover_url ||
        (currentSong.youtube_id ? `https://img.youtube.com/vi/${currentSong.youtube_id}/hqdefault.jpg` : null);

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: 'Selin Player',
        artwork: artworkUrl
          ? [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
          : [
              { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            ],
      });

      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('previoustrack', prevSong);
      navigator.mediaSession.setActionHandler('nexttrack', nextSong);
    }
  }, [currentSong, play, pause, prevSong, nextSong]);

  const handleTimeUpdate = () => {
    if (!currentSong?.youtube_id && audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (!currentSong?.youtube_id && audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    if (!currentSong?.youtube_id) {
      nextSong();
    }
  };

  return (
    <>
      <audio
        id="player-audio"
        ref={audioRef}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className="hidden"
      />
      <div id="youtube-player" className="hidden" />
    </>
  );
}
