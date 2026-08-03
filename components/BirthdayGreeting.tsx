'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Volume2, VolumeX } from 'lucide-react';

import { NetflixPhotoGrid } from '@/components/NetflixPhotoGrid';

// SETTINGS FOR SPLASH MUSIC:
// Place your audio file in selin-player/public/dilerim-ki.mp3 (or edit URL below)
const SPLASH_AUDIO_URL = '/dilerim-ki.mp3'; 
const SNIPPET_START_TIME = 132; // 2:12 in seconds
const SNIPPET_END_TIME = 181;   // 3:01 in seconds

export function BirthdayGreeting() {
  const [isVisible, setIsVisible] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const forceShow = searchParams.get('greeting') === 'true';
    const hasSeen = localStorage.getItem('selin_greeting_seen');

    if (forceShow || !hasSeen) {
      Promise.resolve().then(() => setIsVisible(true));
      
      const duration = 3500;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#ec4899', '#f472b6', '#a855f7', '#8b5cf6']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#ec4899', '#f472b6', '#a855f7', '#8b5cf6']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, []);

  const seekToStart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = SNIPPET_START_TIME;
    }
  };

  const handleLoadedMetadata = () => {
    seekToStart();
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      // If current time reaches or exceeds 3:01 (181s), loop back to 2:12 (132s)
      if (audioRef.current.currentTime >= SNIPPET_END_TIME) {
        audioRef.current.currentTime = SNIPPET_START_TIME;
      }
    }
  };

  // Try to play splash audio as soon as visible or on first user interaction
  useEffect(() => {
    if (!isVisible || !audioRef.current) return;

    const audio = audioRef.current;
    audio.volume = 0.8;

    const attemptPlay = () => {
      seekToStart();
      audio.play().then(() => {
        setIsPlayingAudio(true);
      }).catch(() => {
        // Autoplay blocked by browser policy; wait for first user tap/click anywhere
        const handleFirstTouch = () => {
          seekToStart();
          audio.play().then(() => {
            setIsPlayingAudio(true);
          }).catch(() => {});
          window.removeEventListener('click', handleFirstTouch);
          window.removeEventListener('touchstart', handleFirstTouch);
        };
        window.addEventListener('click', handleFirstTouch);
        window.addEventListener('touchstart', handleFirstTouch);
      });
    };

    attemptPlay();
  }, [isVisible]);

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !audioMuted;
    setAudioMuted(!audioMuted);
  };

  const handleDismiss = () => {
    // Fade out splash music smoothly over 500ms
    if (audioRef.current && isPlayingAudio) {
      const audio = audioRef.current;
      const fadeInterval = setInterval(() => {
        if (audio.volume > 0.1) {
          audio.volume -= 0.1;
        } else {
          audio.pause();
          clearInterval(fadeInterval);
        }
      }, 50);
    }

    localStorage.setItem('selin_greeting_seen', 'true');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black overflow-hidden"
        >
          {/* Netflix-style animated photo grid background */}
          <NetflixPhotoGrid />

          {/* Background audio element */}
          <audio
            ref={audioRef}
            src={SPLASH_AUDIO_URL}
            preload="auto"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
          />

          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
            className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-500/20 via-transparent to-transparent pointer-events-none" />
            
            {/* Audio Mute/Unmute Indicator Button */}
            {isPlayingAudio && (
              <button
                onClick={toggleMute}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-pink-300 transition-colors"
                title={audioMuted ? "Sesi Aç" : "Sesi Kapat"}
              >
                {audioMuted ? <VolumeX size={18} /> : <Volume2 size={18} className="animate-pulse" />}
              </button>
            )}

            <motion.div 
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="text-6xl mb-6 inline-block"
            >
              🎂
            </motion.div>
            
            <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-purple-300 mb-4 font-serif">
              İyi ki Doğdun Sevgilimmm
            </h1>
            
            <p className="text-pink-100/90 text-lg mb-8 leading-relaxed font-light">
              Bunu sana özel hazırladım, umarım bu şarkılar her anında eşlik eder. Müziğin ve anılarımızın buluştuğu yer... <br/>
              <span className="text-2xl mt-2 inline-block">💖</span>
            </p>
            
            <button
              onClick={handleDismiss}
              className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-pink-500 hover:from-pink-400 to-purple-600 hover:to-purple-500 text-white font-semibold text-lg shadow-lg shadow-pink-500/25 transform transition hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              Müziğe Başla ♪
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
