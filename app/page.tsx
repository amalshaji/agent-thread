import { AppHeader } from "@/components/app-shell";
import { SourceCommandTabs } from "@/components/home/source-command-tabs";

export default function HomePage() {
  return (
    <>
      <AppHeader />
      <main className="grid min-h-[calc(100vh-49px)] place-items-center px-5 py-12 text-center">
        <section className="grid w-full max-w-[380px] gap-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg border border-border bg-[#fbfaf8]">
            <img src="/agent-thread-icon.svg" alt="" aria-hidden="true" className="size-8" />
          </div>
          <div className="grid gap-3">
            <h1 className="m-0 text-[24px] font-semibold leading-tight text-foreground">Share agent sessions</h1>
            <p className="m-0 text-sm leading-6 text-muted-foreground">
              Export Claude Code sessions or Codex threads to public links in one command.
            </p>
          </div>
          <SourceCommandTabs />
        </section>
      </main>
    </>
  );
}
