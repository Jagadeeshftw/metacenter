"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { IconPlayerPlayFilled } from "@tabler/icons-react";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The demo video from YouTube, as a facade: the poster renders with the page, and the player
 * (about 1 MB of YouTube script) is mounted only once the page has loaded and the slot is on
 * screen. With `autoplay`, it then starts muted (browsers block autoplay with sound; the subtitles
 * are built into the video) and pauses when it scrolls out of view. A click mounts it at once.
 */
export function DemoVideo({ autoplay = false, priority = false, className }: { autoplay?: boolean; priority?: boolean; className?: string }) {
  const id = site.demo.youtubeId;
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // watch the slot; mount when it is at least half on screen after the page has loaded
  useEffect(() => {
    if (!id || !box.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting && e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] });
    io.observe(box.current);
    return () => io.disconnect();
  }, [id]);

  useEffect(() => {
    if (!autoplay || !visible || mounted) return;
    const go = () => setMounted(true);
    if (document.readyState === "complete") {
      const t = window.setTimeout(go, 400);
      return () => window.clearTimeout(t);
    }
    window.addEventListener("load", go, { once: true });
    return () => window.removeEventListener("load", go);
  }, [autoplay, visible, mounted]);

  // pause when scrolled away, resume when back (YouTube iframe API over postMessage)
  useEffect(() => {
    if (!mounted || !autoplay) return;
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: visible ? "playVideo" : "pauseVideo", args: [] }), "*");
  }, [visible, mounted, autoplay]);

  const params = new URLSearchParams({
    autoplay: "1",
    mute: autoplay ? "1" : "0",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
  });

  return (
    <div ref={box} className={cn("relative aspect-video w-full overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      {mounted && id ? (
        <iframe
          ref={frame}
          src={`https://www.youtube-nocookie.com/embed/${id}?${params}`}
          title="Metacenter demo video"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => id && setMounted(true)}
          disabled={!id}
          aria-label={id ? `Play the demo video (${site.demo.length})` : "Demo video"}
          className="group absolute inset-0 h-full w-full cursor-pointer disabled:cursor-default"
        >
          <Image
            src={site.demo.poster}
            alt="Metacenter dashboard at distribution 288: headroom 96.1%, coverage 25.49×, reserve 2.408 BTC"
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            priority={priority}
            className="object-cover"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          {id && (
            <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-transform group-hover:scale-105 md:h-20 md:w-20">
              <IconPlayerPlayFilled size={30} />
            </span>
          )}
          <span className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-left text-xs text-white/90 md:text-sm">
            <span>Demo · {site.demo.length}</span>
            <span className="num text-white/70">distribution 288 · 4 Oct 2026</span>
          </span>
        </button>
      )}
    </div>
  );
}
