import { Suspense } from "react";
import { isAuthenticated } from "@/lib/auth";
import { NotesWorkspace } from "@/components/NotesWorkspace";

async function AuthenticatedApp() {
  const authed = await isAuthenticated();
  return <NotesWorkspace initialAuthenticated={authed} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <AuthenticatedApp />
    </Suspense>
  );
}
