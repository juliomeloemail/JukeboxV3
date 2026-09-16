import { useState } from "react";
import { Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/jukebox/grouping";

export function ArtCover({
  name,
  className,
  size = "md",
  url,
}: {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  url?: string;
}) {
  const [error, setError] = useState(false);
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  if (url && !error) {
    return (
      <img
        src={url}
        alt={name}
        className={cn(
          "object-cover rounded-xl shadow-lg shrink-0",
          size === "sm" && "size-11",
          size === "md" && "size-14",
          size === "lg" && "size-full",
          className,
        )}
        onError={() => setError(true)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg",
        size === "sm" && "size-11",
        size === "md" && "size-14",
        size === "lg" && "size-full",
        className,
      )}
      style={{ filter: `hue-rotate(${hue}deg)` }}
      aria-hidden
    >
      <Music
        className={cn(
          "opacity-80 text-white drop-shadow-sm",
          size === "sm" && "size-5",
          size === "md" && "size-6",
          size === "lg" && "size-16",
        )}
      />
      <span className="absolute bottom-1 right-1 text-[8px] opacity-60 font-medium tracking-tight bg-black/20 px-1 rounded">
        {initials(name)}
      </span>
    </div>
  );
}
