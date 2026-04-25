import Link from "next/link";

import { AppHeader } from "@/components/app-shell";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <AppHeader />
      <main className="grid min-h-[calc(100vh-49px)] place-items-center px-5 py-12 text-center">
        <section className="grid max-w-sm gap-4">
          <h1 className="m-0 text-2xl font-semibold">Session not found</h1>
          <p className="m-0 text-sm leading-6 text-muted-foreground">
            The link may be wrong, expired, or the stored session payload is missing.
          </p>
          <Link href="/" className={buttonVariants({ className: "mx-auto" })}>
            Go home
          </Link>
        </section>
      </main>
    </>
  );
}
