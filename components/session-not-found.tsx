import { AppHeader } from "@/components/app-shell";
import { SourceCommandTabs } from "@/components/home/source-command-tabs";

export function SessionNotFound() {
  return (
    <>
      <AppHeader />
      <main className="grid min-h-[calc(100vh-49px)] place-items-center px-5 py-12 text-center">
        <section className="grid w-full max-w-[380px] gap-7">
          <div className="grid gap-4">
            <h1 className="m-0 text-2xl font-semibold">Session not found</h1>
            <p className="m-0 text-sm leading-6 text-muted-foreground">
              The link may be wrong, expired, or the stored session payload is missing.
            </p>
          </div>
          <SourceCommandTabs />
        </section>
      </main>
    </>
  );
}
