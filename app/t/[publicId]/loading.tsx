import { AppHeader } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function ThreadLoading() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-[1360px] grid-cols-1 gap-0 px-5 py-7 md:grid-cols-[256px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border pr-4 md:block">
          <Skeleton className="mb-4 h-4 w-16" />
          <div className="grid gap-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-7 w-full" />
            ))}
          </div>
        </aside>
        <section className="grid max-w-[820px] gap-5 md:px-10">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </section>
      </main>
    </>
  );
}
