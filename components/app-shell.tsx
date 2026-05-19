import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  publicId?: string;
  className?: string;
};

export function AppHeader({ publicId, className }: AppHeaderProps) {
  return (
    <header className={cn("app-switcher", className)}>
      <div className="switcher-brand">
        <div className="switcher-mark">
          <img src="/agent-thread-icon.svg" alt="" aria-hidden="true" />
        </div>
        <b>agent thread</b>
        {publicId ? <span className="switcher-dim">/ {publicId}</span> : null}
      </div>
      <div className="switcher-right">
        {publicId ? (
          <Badge variant="secondary" className="hidden border-0 px-2 py-0.5 font-mono text-[11px] sm:inline-flex">
            public
          </Badge>
        ) : null}
        {publicId ? <span className="hidden sm:inline">anyone with the link</span> : null}
        <ThemeToggle />
      </div>
    </header>
  );
}
