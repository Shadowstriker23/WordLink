"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, Loader2 } from "lucide-react";

export function WordAudio({
  word,
  autoPlay = false,
  size = "h-5 w-5",
  className = "",
  delay = 400,
  volume = 0.3,
}: {
  word: string;
  autoPlay?: boolean;
  size?: string;
  className?: string;
  delay?: number;
  volume?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const triedRef = useRef(false);

  const play = useCallback(() => {
    const a = audioRef.current;
    if (!a || error) return;
    a.currentTime = 0;
    a.play()
      .then(() => setPlaying(true))
      .catch(() => {
        // 浏览器自动播放策略拦截，忽略即可（用户可手动点击）
      });
  }, [error]);

  // 设置音量
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // 自动播放（单词详情页进入时）
  useEffect(() => {
    if (autoPlay && word && !triedRef.current) {
      triedRef.current = true;
      const t = setTimeout(play, delay);
      return () => clearTimeout(t);
    }
  }, [word, autoPlay, delay, play]);

  return (
    <>
      <audio
        ref={audioRef}
        src={`/api/tts?word=${encodeURIComponent(word)}`}
        preload={autoPlay ? "auto" : "none"}
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
      />
      <button
        onClick={play}
        className={`text-muted transition-colors hover:text-primary ${className}`}
        title="发音"
        disabled={error}
      >
        {error ? (
          <span className="text-xs text-danger" title="发音不可用">
            无音
          </span>
        ) : playing ? (
          <Loader2 className={`${size} animate-spin`} />
        ) : (
          <Volume2 className={size} />
        )}
      </button>
    </>
  );
}
