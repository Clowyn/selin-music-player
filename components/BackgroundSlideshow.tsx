'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { BackgroundMedia } from '@/lib/types';
import { usePlayerStore } from '@/store/playerStore';

// All 39 personal photos from public directory (/1.jpeg to /39.jpeg)
const LOCAL_PHOTOS = Array.from({ length: 39 }, (_, i) => ({
  id: `local-${i + 1}`,
  playlist_id: 'default',
  media_url: `/${i + 1}.jpeg`,
  media_type: 'image' as const,
  display_order: i + 1,
  created_at: new Date().toISOString()
}));

export function BackgroundSlideshow() {
  const currentPlaylistId = usePlayerStore((state) => state.currentPlaylist?.id);
  const [mediaItems, setMediaItems] = useState<BackgroundMedia[]>(LOCAL_PHOTOS);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    async function fetchMedia() {
      if (!currentPlaylistId) {
        setMediaItems(LOCAL_PHOTOS);
        return;
      }
      
      const { data, error } = await supabase
        .from('background_media')
        .select('*')
        .eq('playlist_id', currentPlaylistId)
        .order('display_order', { ascending: true });
        
      if (!error && data && data.length > 0) {
        setMediaItems(data);
        setCurrentIndex(0);
      } else {
        setMediaItems(LOCAL_PHOTOS);
      }
    }
    
    fetchMedia();
  }, [currentPlaylistId]);

  useEffect(() => {
    if (mediaItems.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % mediaItems.length);
    }, 8000);
    
    return () => clearInterval(interval);
  }, [mediaItems.length]);

  return (
    <div className="fixed inset-0 z-0 bg-gradient-to-br from-purple-900 via-pink-900 to-rose-900 overflow-hidden">
      <AnimatePresence mode="popLayout">
        {mediaItems.length > 0 && (
          <motion.div
            key={mediaItems[currentIndex].id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0"
          >
            {mediaItems[currentIndex].media_type === 'video' ? (
              <video
                src={mediaItems[currentIndex].media_url}
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover opacity-60"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={mediaItems[currentIndex].media_url}
                alt="Background"
                className="w-full h-full object-cover opacity-60"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/40" />
    </div>
  );
}
