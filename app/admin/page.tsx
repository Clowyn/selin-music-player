'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Playlist, Song, BackgroundMedia, CharacterSprite } from '@/lib/types';
import { CheckCircle2, XCircle, Loader2, Upload, Plus, Trash2, PlayCircle, Image as ImageIcon, Sparkles, Music } from 'lucide-react';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('playlists');
  
  // Data states
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [media, setMedia] = useState<BackgroundMedia[]>([]);
  const [sprites, setSprites] = useState<CharacterSprite[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [newPlaylist, setNewPlaylist] = useState({ name: '', mood_description: '' });

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [plRes, songsRes, mediaRes, spritesRes] = await Promise.all([
        supabase.from('playlists').select('*').order('created_at', { ascending: false }),
        supabase.from('songs').select('*').order('track_order', { ascending: true }),
        supabase.from('background_media').select('*').order('display_order', { ascending: true }),
        supabase.from('character_sprites').select('*').order('created_at', { ascending: false })
      ]);
      
      if (plRes.data) setPlaylists(plRes.data);
      if (songsRes.data) setSongs(songsRes.data);
      if (mediaRes.data) setMedia(mediaRes.data);
      if (spritesRes.data) setSprites(spritesRes.data);
    } catch {
      showMessage('Veriler yüklenirken hata oluştu', 'error');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('admin_auth') === 'true') {
      Promise.resolve().then(() => {
        setIsAuthenticated(true);
        fetchData();
      });
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      
      const data = await res.json();
      if (data.authenticated) {
        sessionStorage.setItem('admin_auth', 'true');
        setIsAuthenticated(true);
        fetchData();
      } else {
        setAuthError('Hatalı şifre');
      }
    } catch {
      setAuthError('Bağlantı hatası');
    }
    setIsLoading(false);
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('playlists').insert([newPlaylist]);
    if (!error) {
      showMessage('Playlist eklendi', 'success');
      setNewPlaylist({ name: '', mood_description: '' });
      fetchData();
    } else {
      showMessage('Hata: ' + error.message, 'error');
    }
  };

  const uploadFile = async (bucket: string, file: File, path: string) => {
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSongUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPlaylistId) return;
    
    setIsLoading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const url = await uploadFile('audio-files', file, fileName);
      
      await supabase.from('songs').insert([{
        playlist_id: selectedPlaylistId,
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: 'Bilinmeyen Sanatçı',
        file_url: url,
        track_order: songs.filter(s => s.playlist_id === selectedPlaylistId).length + 1
      }]);
      showMessage('Şarkı eklendi', 'success');
      fetchData();
    } catch (err) {
      const error = err as Error;
      showMessage('Hata: ' + error.message, 'error');
    }
    setIsLoading(false);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPlaylistId) return;
    
    setIsLoading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const url = await uploadFile('photos-videos', file, fileName);
      const isVideo = file.type.startsWith('video/');
      
      await supabase.from('background_media').insert([{
        playlist_id: selectedPlaylistId,
        media_url: url,
        media_type: isVideo ? 'video' : 'image',
        display_order: media.filter(m => m.playlist_id === selectedPlaylistId).length + 1
      }]);
      showMessage('Medya eklendi', 'success');
      fetchData();
    } catch (err) {
      const error = err as Error;
      showMessage('Hata: ' + error.message, 'error');
    }
    setIsLoading(false);
  };

  const handleSpriteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const url = await uploadFile('sprites', file, fileName);
      
      await supabase.from('character_sprites').insert([{
        name: file.name.split('.')[0],
        image_url: url,
        is_active: true
      }]);
      showMessage('Karakter eklendi', 'success');
      fetchData();
    } catch (err) {
      const error = err as Error;
      showMessage('Hata: ' + error.message, 'error');
    }
    setIsLoading(false);
  };

  const toggleSprite = async (id: string, current: boolean) => {
    await supabase.from('character_sprites').update({ is_active: !current }).eq('id', id);
    fetchData();
  };
  
  const deleteItem = async (table: string, id: string) => {
    if (!confirm('Emin misiniz?')) return;
    await supabase.from(table).delete().eq('id', id);
    fetchData();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="bg-neutral-900 p-8 rounded-2xl shadow-xl w-full max-w-md border border-neutral-800">
          <h1 className="text-2xl font-bold mb-6 text-center text-pink-400">Admin Girişi</h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifre"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 focus:outline-none focus:border-pink-500 transition"
              />
            </div>
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            <button
              disabled={isLoading}
              className="w-full bg-pink-600 hover:bg-pink-500 text-white py-3 rounded-lg font-medium transition flex justify-center items-center"
            >
              {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'playlists', label: 'Çalma Listeleri', icon: Music },
    { id: 'songs', label: 'Şarkılar', icon: PlayCircle },
    { id: 'media', label: 'Arkaplan Medya', icon: ImageIcon },
    { id: 'sprites', label: 'Karakterler', icon: Sparkles },
  ];

  return (
    <div className="space-y-8">
      {message.text && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-900/90 text-green-200' : 'bg-red-900/90 text-red-200'
        } z-50 backdrop-blur-sm border ${message.type === 'success' ? 'border-green-700' : 'border-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400">
          Yönetim Paneli
        </h1>
        <button 
          onClick={() => { sessionStorage.removeItem('admin_auth'); setIsAuthenticated(false); }}
          className="text-sm text-neutral-400 hover:text-white transition"
        >
          Çıkış Yap
        </button>
      </div>

      <div className="flex space-x-1 bg-neutral-900 p-1 rounded-xl">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-neutral-800 text-pink-400 shadow-sm' 
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 min-h-[500px]">
        {isLoading && <div className="flex justify-center my-8"><Loader2 className="animate-spin w-8 h-8 text-pink-500" /></div>}
        
        {activeTab === 'playlists' && (
          <div className="space-y-8">
            <form onSubmit={handleCreatePlaylist} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-neutral-950 p-4 rounded-xl">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Playlist Adı</label>
                <input required value={newPlaylist.name} onChange={e => setNewPlaylist({...newPlaylist, name: e.target.value})} className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 focus:border-pink-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Açıklama / Ruh Hali</label>
                <input value={newPlaylist.mood_description} onChange={e => setNewPlaylist({...newPlaylist, mood_description: e.target.value})} className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 focus:border-pink-500 outline-none" />
              </div>
              <button type="submit" className="bg-pink-600/20 text-pink-400 hover:bg-pink-600 hover:text-white px-4 py-2 rounded font-medium flex justify-center items-center gap-2 transition">
                <Plus className="w-4 h-4" /> Ekle
              </button>
            </form>

            <div className="grid gap-4">
              {playlists.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-neutral-950 p-4 rounded-xl border border-neutral-800 hover:border-neutral-700 transition">
                  <div>
                    <h3 className="font-semibold text-lg">{p.name}</h3>
                    <p className="text-sm text-neutral-400">{p.mood_description}</p>
                  </div>
                  <button onClick={() => deleteItem('playlists', p.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded transition">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(activeTab === 'songs' || activeTab === 'media') && (
          <div className="space-y-6">
            <div className="bg-neutral-950 p-4 rounded-xl flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm text-neutral-400 mb-1">Playlist Seç</label>
                <select 
                  value={selectedPlaylistId} 
                  onChange={e => setSelectedPlaylistId(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 focus:border-pink-500 outline-none"
                >
                  <option value="">Seçiniz...</option>
                  {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className={`cursor-pointer ${!selectedPlaylistId ? 'opacity-50 cursor-not-allowed' : ''} bg-pink-600/20 text-pink-400 hover:bg-pink-600 hover:text-white px-6 py-2 rounded font-medium flex justify-center items-center gap-2 transition`}>
                  <Upload className="w-4 h-4" /> {activeTab === 'songs' ? 'Şarkı Yükle (.mp3, .m4a)' : 'Medya Yükle'}
                  <input 
                    type="file" 
                    className="hidden" 
                    accept={activeTab === 'songs' ? 'audio/*' : 'image/*,video/*'} 
                    onChange={activeTab === 'songs' ? handleSongUpload : handleMediaUpload} 
                    disabled={!selectedPlaylistId || isLoading}
                  />
                </label>
              </div>
            </div>

            {selectedPlaylistId && activeTab === 'songs' && (
              <div className="grid gap-3">
                {songs.filter(s => s.playlist_id === selectedPlaylistId).map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                    <div>
                      <p className="font-medium">{s.title}</p>
                      <p className="text-xs text-neutral-500">{s.artist}</p>
                    </div>
                    <button onClick={() => deleteItem('songs', s.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {selectedPlaylistId && activeTab === 'media' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {media.filter(m => m.playlist_id === selectedPlaylistId).map(m => (
                  <div key={m.id} className="relative group rounded-xl overflow-hidden aspect-video bg-neutral-950 border border-neutral-800">
                    {m.media_type === 'video' ? (
                      <video src={m.media_url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={m.media_url} alt="Medya" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <button onClick={() => deleteItem('background_media', m.id)} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sprites' && (
          <div className="space-y-6">
            <div className="bg-neutral-950 p-4 rounded-xl">
              <label className="cursor-pointer bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white px-6 py-2 rounded font-medium inline-flex justify-center items-center gap-2 transition">
                <Upload className="w-4 h-4" /> Karakter Yükle (PNG, GIF)
                <input type="file" className="hidden" accept="image/*" onChange={handleSpriteUpload} disabled={isLoading} />
              </label>
            </div>
            
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {sprites.map(s => (
                <div key={s.id} className={`bg-neutral-950 p-4 rounded-xl border flex flex-col items-center gap-3 transition ${s.is_active ? 'border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'border-neutral-800 opacity-50'}`}>
                  <img src={s.image_url} alt={s.name} className="w-16 h-16 object-contain" />
                  <p className="text-xs truncate w-full text-center">{s.name}</p>
                  <div className="flex gap-2">
                    <button onClick={() => toggleSprite(s.id, s.is_active)} className="text-xs bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded">
                      {s.is_active ? 'Gizle' : 'Göster'}
                    </button>
                    <button onClick={() => deleteItem('character_sprites', s.id)} className="text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 px-2 py-1 rounded">
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
