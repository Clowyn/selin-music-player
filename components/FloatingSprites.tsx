'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { CharacterSprite } from '@/lib/types';

interface SpriteInstance {
  id: string;
  sprite: CharacterSprite | { image_url: string; isFallback: boolean };
  x: number;
  targetX: number;
  duration: number;
  delay: number;
  size: number;
  key: number;
}

const FALLBACK_SPRITES = [
  { image_url: '🐱', isFallback: true },
  { image_url: '⚡', isFallback: true },
  { image_url: '🐰', isFallback: true },
  { image_url: '🦊', isFallback: true },
];

export function FloatingSprites() {
  const [sprites, setSprites] = useState<CharacterSprite[]>([]);
  const [activeInstances, setActiveInstances] = useState<SpriteInstance[]>([]);
  const nextKey = useRef(0);

  useEffect(() => {
    async function fetchSprites() {
      const { data, error } = await supabase
        .from('character_sprites')
        .select('*')
        .eq('is_active', true);
      
      if (!error && data && data.length > 0) {
        setSprites(data);
      }
    }
    fetchSprites();
  }, []);

  useEffect(() => {
    const availableSprites = sprites.length > 0 ? sprites : FALLBACK_SPRITES;

    const spawnSprite = () => {
      const spriteIndex = Math.floor(Math.random() * availableSprites.length);
      const sprite = availableSprites[spriteIndex];
      
      const newInstance: SpriteInstance = {
        id: Math.random().toString(36).substr(2, 9),
        sprite,
        x: Math.random() * 100,
        targetX: Math.random() * 100,
        duration: 10 + Math.random() * 8, // 10-18s
        delay: Math.random() * 2,
        size: 35 + Math.random() * 20, // 35-55px
        key: nextKey.current++,
      };

      setActiveInstances(prev => {
        // Limit max on screen
        const next = [...prev, newInstance];
        if (next.length > 6) return next.slice(1);
        return next;
      });
      
      // Clean up after animation
      setTimeout(() => {
        setActiveInstances(prev => prev.filter(inst => inst.id !== newInstance.id));
      }, (newInstance.duration + newInstance.delay) * 1000);
    };

    // Initial spawn
    for(let i=0; i<4; i++) spawnSprite();

    const interval = setInterval(spawnSprite, 4000);
    
    return () => clearInterval(interval);
  }, [sprites]);

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      <AnimatePresence>
        {activeInstances.map((inst) => (
          <motion.div
            key={inst.id}
            initial={{ 
              y: '110vh', 
              x: `${inst.x}vw`,
              opacity: 0,
              rotate: 0 
            }}
            animate={{ 
              y: '-10vh',
              x: `${inst.targetX}vw`,
              opacity: [0, 1, 1, 0],
              rotate: [-15, 15, -15, 15]
            }}
            transition={{
              duration: inst.duration,
              delay: inst.delay,
              ease: 'linear',
            }}
            className="absolute drop-shadow-lg flex items-center justify-center"
            style={{ 
              width: inst.size, 
              height: inst.size,
              fontSize: inst.size * 0.8
            }}
          >
            {('isFallback' in inst.sprite && inst.sprite.isFallback) ? (
              <span>{inst.sprite.image_url}</span>
            ) : (
              <img 
                src={inst.sprite.image_url} 
                alt="sprite" 
                className="w-full h-full object-contain" 
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
