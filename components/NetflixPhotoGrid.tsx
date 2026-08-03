'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

// All 39 personal photos from public directory (/1.jpeg to /39.jpeg)
const LOCAL_PHOTOS = Array.from({ length: 39 }, (_, i) => `/${i + 1}.jpeg`);

export function NetflixPhotoGrid() {
  const [photos, setPhotos] = useState<string[]>(LOCAL_PHOTOS);

  useEffect(() => {
    async function loadPhotos() {
      const { data } = await supabase
        .from('background_media')
        .select('media_url')
        .eq('media_type', 'image')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        const dbUrls = data.map((item: { media_url: string }) => item.media_url);
        // Combine DB photos with local photos for maximum variety
        setPhotos([...dbUrls, ...LOCAL_PHOTOS]);
      }
    }

    loadPhotos();
  }, []);

  // Distribute all 39 photos into 5 distinct scrolling columns
  const col1 = photos.slice(0, 8);
  const col2 = photos.slice(8, 16);
  const col3 = photos.slice(16, 24);
  const col4 = photos.slice(24, 32);
  const col5 = photos.slice(32, 39);

  const columns = [
    { items: col1, direction: 'up', speed: 28 },
    { items: col2, direction: 'down', speed: 34 },
    { items: col3, direction: 'up', speed: 25 },
    { items: col4, direction: 'down', speed: 32 },
    { items: col5, direction: 'up', speed: 30 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 bg-black">
      {/* Netflix 3D tilted grid wall */}
      <div className="absolute inset-0 flex justify-center gap-3 md:gap-5 -rotate-6 scale-125 opacity-50">
        {columns.map((col, idx) => {
          // Triple items to ensure seamless infinite looping animation
          const itemsToLoop = [...col.items, ...col.items, ...col.items];
          return (
            <div key={idx} className="flex-1 min-w-[120px] md:min-w-[180px] overflow-hidden">
              <motion.div
                animate={{
                  y: col.direction === 'up' ? ['0%', '-50%'] : ['-50%', '0%'],
                }}
                transition={{
                  repeat: Infinity,
                  duration: col.speed,
                  ease: 'linear',
                }}
                className="flex flex-col gap-3"
              >
                {itemsToLoop.map((url, i) => (
                  <div
                    key={i}
                    className="relative w-full aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-white/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Personal Memory"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Netflix dark gradient and vignette overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-pink-950/70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.85)_100%)]" />
    </div>
  );
}
