export interface Playlist {
  id: string;
  name: string;
  mood_description: string | null;
  cover_url: string | null;
  created_at: string;
}

export interface Song {
  id: string;
  playlist_id: string;
  title: string;
  artist: string;
  audio_url: string;
  duration: number;
  track_order: number;
  created_at: string;
}

export interface BackgroundMedia {
  id: string;
  playlist_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  display_order: number;
  created_at: string;
}

export interface CharacterSprite {
  id: string;
  name: string;
  image_url: string;
  is_active: boolean;
}

export type RepeatMode = 'off' | 'single' | 'all';
