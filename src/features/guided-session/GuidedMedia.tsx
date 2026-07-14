import { useEffect, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GuidedMedia as GuidedMediaItem } from "./guided-session-types";

export function GuidedMedia({ media, onOpenInternal }: { media: GuidedMediaItem[]; onOpenInternal?: (target: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const updateConnectivity = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    return () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, []);

  if (!media.length) return null;

  return (
    <section aria-labelledby="guided-media-title" className="space-y-3 border-t pt-4">
      <h2 id="guided-media-title" className="text-sm font-semibold">Demostraciones y referencias</h2>
      {media.map((item) => {
        const expanded = expandedId === item.id;
        if (item.kind === "internal") {
          return (
            <Button type="button" variant="outline" size="lg" className="h-11 w-full" key={item.id} onClick={() => onOpenInternal?.(item.url.replace(/^#/, ""))}>
              <ExternalLink aria-hidden="true" /> Abrir en la app: {item.label}
            </Button>
          );
        }
        if (item.kind === "youtube" && item.youtubeId) {
          const params = new URLSearchParams({ playsinline: "1", rel: "0" });
          if (item.startSeconds) params.set("start", String(item.startSeconds));
          if (item.endSeconds) params.set("end", String(item.endSeconds));
          return (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3" key={item.id}>
              {!expanded ? (
                <Button type="button" variant="outline" size="lg" className="h-11 w-full" onClick={() => setExpandedId(item.id)}>
                  <Play aria-hidden="true" /> Ver demostración: {item.label}
                </Button>
              ) : online ? (
                <div className="aspect-video w-full min-w-0 overflow-hidden rounded-lg bg-black">
                  <iframe
                    className="size-full border-0"
                    src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?${params.toString()}`}
                    title={item.label}
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm font-medium text-amber-800 dark:text-amber-100">
                  El video necesita conexión
                </p>
              )}
              <a className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline" href={item.url} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden="true" className="size-4" /> Abrir en YouTube
              </a>
            </div>
          );
        }
        return (
          <a className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted" href={item.url} target="_blank" rel="noreferrer" key={item.id}>
            <ExternalLink aria-hidden="true" className="size-4" /> Abrir referencia: {item.label}
          </a>
        );
      })}
    </section>
  );
}
