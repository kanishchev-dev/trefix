import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import type { ReactElement } from "react";

export default function HomePage(): ReactElement {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.94),_rgba(240,244,255,1))] px-6 py-10 text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-500">admin</p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Frontend admin shell connected to the auth backend.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            The public login, forgot-password, and reset-password flows are wired to the backend.
            Session state is stored in httpOnly cookies via the Next API layer.
          </p>
        </section>

        <Card className="max-w-2xl border-slate-200/80 bg-white/80 shadow-xl shadow-slate-200/60 backdrop-blur">
          <CardHeader>
            <CardTitle>Authentication is connected</CardTitle>
            <CardDescription>
              Use <span className="font-mono">/login</span> to enter the admin app. Sessions,
              recovery, and verification are handled by the backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Open login
            </Link>
            <Link
              href="/forgot-password"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-slate-50"
            >
              Password recovery
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
