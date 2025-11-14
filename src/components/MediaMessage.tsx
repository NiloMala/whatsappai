import { useState, useEffect, useRef } from 'react';
import { EvolutionChat } from '@/integrations/evolutionProxy';
import { Loader2, ImageIcon, Video, Music, FileText, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaMessageProps {
  instance: string;
  messageKey: { id: string };
  mediaType: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
  fileName?: string;
  mimetype?: string;
  seconds?: number;
}

export const MediaMessage = ({ instance, messageKey, mediaType, caption, fileName, mimetype, seconds }: MediaMessageProps) => {
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loadRequested, setLoadRequested] = useState(false);

  // Audio player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const loadMedia = async () => {
    if (loading || base64Data || error) return;

    setLoading(true);
    setLoadRequested(true);

    try {
      console.log(`📥 Carregando ${mediaType} via Evolution API...`, messageKey.id);

      const result = await EvolutionChat.getBase64FromMediaMessage(instance, {
        message: { key: messageKey },
        convertToMp4: mediaType === 'video'
      });

      console.log(`✅ ${mediaType} carregado:`, result);

      if (result?.base64) {
        setBase64Data(result.base64);
      } else {
        console.warn(`⚠️ Nenhum base64 retornado para ${mediaType}`);
        setError(true);
      }
    } catch (err) {
      console.error(`❌ Erro ao carregar ${mediaType}:`, err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load images, but require click for videos/audio
  useEffect(() => {
    if (mediaType === 'image' && !loadRequested) {
      loadMedia();
    }
  }, [mediaType]);

  // Audio player functions
  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

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
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getIcon = () => {
    switch (mediaType) {
      case 'image': return <ImageIcon className="h-5 w-5 text-blue-600" />;
      case 'video': return <Video className="h-5 w-5 text-purple-600" />;
      case 'audio': return <Music className="h-5 w-5 text-green-600" />;
      case 'document': return <FileText className="h-5 w-5 text-orange-600" />;
    }
  };

  const getLabel = () => {
    switch (mediaType) {
      case 'image': return 'Imagem';
      case 'video': return 'Vídeo';
      case 'audio': return seconds ? `Áudio (${seconds}s)` : 'Áudio';
      case 'document': return fileName || 'Documento';
    }
  };

  const getMimeType = () => {
    switch (mediaType) {
      case 'image': return 'image/jpeg';
      case 'video': return 'video/mp4';
      case 'audio': return 'audio/ogg';
      case 'document': return mimetype || 'application/octet-stream';
    }
  };

  return (
    <div className="mb-2">
      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          {getIcon()}
          <div className="flex-1">
            <p className="text-sm font-medium">{getLabel()}</p>
            <div className="flex items-center gap-2 mt-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <p className="text-xs text-muted-foreground">Carregando...</p>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-destructive/20">
          {getIcon()}
          <div className="flex-1">
            <p className="text-sm font-medium">{getLabel()}</p>
            <p className="text-xs text-destructive">Não foi possível carregar</p>
          </div>
        </div>
      )}

      {/* Not loaded yet - show load button */}
      {!loading && !base64Data && !error && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          {getIcon()}
          <div className="flex-1">
            <p className="text-sm font-medium">{getLabel()}</p>
            {caption && <p className="text-xs text-muted-foreground truncate">{caption}</p>}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={loadMedia}
            className="text-xs"
          >
            Carregar
          </Button>
        </div>
      )}

      {/* Loaded media */}
      {base64Data && !loading && (
        <div>
          {mediaType === 'image' && (
            <img
              src={`data:${getMimeType()};base64,${base64Data}`}
              alt={caption || 'Imagem'}
              className="rounded-lg max-w-full h-auto max-h-96 object-contain"
            />
          )}

          {mediaType === 'video' && (
            <video
              controls
              className="rounded-lg max-w-full h-auto max-h-96"
            >
              <source src={`data:${getMimeType()};base64,${base64Data}`} type={getMimeType()} />
              Seu navegador não suporta reprodução de vídeo.
            </video>
          )}

          {mediaType === 'audio' && (
            <div className="bg-muted/30 px-2 py-2 rounded-lg w-full min-w-[200px]">
              <div className="flex items-center gap-2">
                {/* Custom Play/Pause Button */}
                <button
                  onClick={togglePlayPause}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-green-600 hover:bg-green-700 transition-colors flex-shrink-0"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 text-white fill-white" />
                  ) : (
                    <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                  )}
                </button>

                {/* Progress Bar and Time Display */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <div
                    className="h-1.5 bg-gray-300 rounded-full cursor-pointer flex-1 min-w-[100px]"
                    onClick={handleSeek}
                  >
                    <div
                      className="h-full bg-green-600 rounded-full transition-all"
                      style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatTime(duration || seconds || 0)}
                  </span>
                </div>
              </div>

              {/* Hidden audio element */}
              <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                className="hidden"
              >
                <source src={`data:audio/ogg;base64,${base64Data}`} type="audio/ogg" />
                <source src={`data:audio/mpeg;base64,${base64Data}`} type="audio/mpeg" />
                <source src={`data:audio/mp3;base64,${base64Data}`} type="audio/mp3" />
              </audio>
            </div>
          )}

          {mediaType === 'document' && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              {getIcon()}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileName || 'Documento'}</p>
                <p className="text-xs text-muted-foreground">{mimetype}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = `data:${getMimeType()};base64,${base64Data}`;
                  link.download = fileName || 'documento';
                  link.click();
                }}
                className="text-xs"
              >
                Baixar
              </Button>
            </div>
          )}

          {caption && mediaType !== 'document' && (
            <p className="text-sm mt-2 whitespace-pre-line break-words">{caption}</p>
          )}
        </div>
      )}
    </div>
  );
};
