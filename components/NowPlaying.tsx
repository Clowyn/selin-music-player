'use client';

import { usePlayerStore } from '@/store/playerStore';
import { motion, AnimatePresence } from 'framer-motion';

export default function NowPlaying() {
  const { currentSong, currentPlaylist, setQueueOpen } = usePlayerStore();

  return (
    <div className="flex flex-col items-center justify-center text-center p-4 space-y-2 min-h-[120px]">
      <AnimatePresence mode="wait">
        {currentSong ? (
          <motion.div
            key={currentSong.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-2 w-full cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setQueueOpen(true)}
            title="Sırayı ve Çalma Listesini Aç"
            role="button"
            tabIndex={0}
          >
            {currentPlaylist && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setQueueOpen(true);
                }}
                className="text-xs font-semibold px-3 py-1 bg-white/10 text-purple-300 rounded-full backdrop-blur-md mb-2 cursor-pointer hover:opacity-80"
              >
                {currentPlaylist.name}
              </span>
            )}
            <h1
              onClick={(e) => {
                e.stopPropagation();
                setQueueOpen(true);
              }}
              className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-300 truncate w-full px-4 cursor-pointer hover:opacity-80"
            >
              {currentSong.title}
            </h1>
            <h2
              onClick={(e) => {
                e.stopPropagation();
                setQueueOpen(true);
              }}
              className="text-lg text-purple-200/80 font-medium truncate w-full px-4 cursor-pointer hover:opacity-80"
            >
              {currentSong.artist}
            </h2>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-gray-400 font-medium text-lg"
          >
            Bir şarkı seçin
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
