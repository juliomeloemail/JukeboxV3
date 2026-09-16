import { cn } from "@/lib/utils";
import { initials } from "@/lib/jukebox/grouping";

export function ArtCover({
  name,
  className,
  size = "md",
}: {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className={cn(
        "jb-art relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-display font-semibold text-foreground/90 shadow-lg",
        size === "sm" && "size-11 text-xs",
        size === "md" && "size-14 text-sm",
        size === "lg" && "size-full text-2xl",
        className,
      )}
      style={{ filter: `hue-rotate(${hue}deg)` }}
      aria-hidden
    >
      <span className="drop-shadow">{initials(name)}</span>
    </div>
  );
}
