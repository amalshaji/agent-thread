import { Sparkles } from "lucide-react";

import { AppHeader } from "@/components/app-shell";
import { CopyCommandRow } from "@/components/home/copy-command-row";

const commands = ["bunx agent-thread@latest", "npx agent-thread@latest", "pnpx agent-thread@latest"];

export default function HomePage() {
  return (
    <>
      <AppHeader />
      <main className="grid min-h-[calc(100vh-49px)] place-items-center px-5 py-12 text-center">
        <section className="grid w-full max-w-[380px] gap-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div className="grid gap-3">
            <h1 className="m-0 text-[24px] font-semibold leading-tight text-foreground">Share agent sessions</h1>
            <p className="m-0 text-sm leading-6 text-muted-foreground">
              Upload Claude Code sessions or Codex threads as public links in one command.
            </p>
          </div>
          <div className="grid gap-2">
            {commands.map((command) => (
              <CopyCommandRow key={command} command={command} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
