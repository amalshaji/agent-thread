import { AppIcon } from "@/components/app-icon";
import { AppHeader } from "@/components/app-shell";
import { SourceCommandTabs } from "@/components/home/source-command-tabs";

function GitHubLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.29 9.43 7.86 10.96.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.33-1.29-1.68-1.29-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18.92-.26 1.91-.38 2.89-.39.98.01 1.97.13 2.89.39 2.21-1.49 3.18-1.18 3.18-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.14 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      <AppHeader />
      <main className="grid min-h-[calc(100vh-49px)] place-items-center px-5 py-12 text-center">
        <section className="grid w-full max-w-[380px] gap-8">
          <div className="app-hero-mark mx-auto flex size-12 items-center justify-center rounded-lg border border-border">
            <AppIcon className="size-8" />
          </div>
          <div className="grid gap-3">
            <h1 className="m-0 text-[24px] font-semibold leading-tight text-foreground">Share agent sessions</h1>
            <p className="m-0 text-sm leading-6 text-muted-foreground">
              Export Claude Code sessions or Codex threads to public links in one command.
            </p>
          </div>
          <SourceCommandTabs />
          <a
            href="https://github.com/amalshaji/agent-thread"
            target="_blank"
            rel="noreferrer"
            className="mx-auto inline-flex h-8 max-w-full items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="View amalshaji/agent-thread on GitHub"
          >
            <GitHubLogo className="size-3.5 shrink-0" />
            <span className="truncate">amalshaji/agent-thread</span>
          </a>
        </section>
      </main>
    </>
  );
}
