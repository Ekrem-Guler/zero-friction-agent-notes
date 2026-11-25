"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  Wrench,
  Lightbulb,
  Folder,
  Plus,
  Settings,
  LogOut,
  Loader2,
  ExternalLink,
  RefreshCw,
  Trash2,
  Sparkles,
  Mic,
  Check,
  Calendar,
  KeyRound,
  Search,
  X,
} from "lucide-react";
import type {
  ClientNote,
  ClientSettings,
  ClientSpace,
  UsageStats,
} from "@/lib/serializers";
import { CaptureBar } from "./CaptureBar";
import { SettingsModal } from "./SettingsModal";
import { PinLockScreen } from "./PinLockScreen";

interface NotesWorkspaceProps {
  initialAuthenticated: boolean;
}

export function NotesWorkspace({ initialAuthenticated }: NotesWorkspaceProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [loading, setLoading] = useState(initialAuthenticated);
  const [spaces, setSpaces] = useState<ClientSpace[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats>({
    monthlySystemSpendUsd: 0,
    monthlyByokSpendUsd: 0,
    totalNotesCount: 0,
  });

  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastError, setToastError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [addingSpace, setAddingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceDesc, setNewSpaceDesc] = useState("");

  const fetchBootstrap = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as {
        spaces: ClientSpace[];
        notes: ClientNote[];
        settings: ClientSettings;
        usageStats: UsageStats;
      };
      setSpaces(data.spaces);
      setNotes(data.notes);
      setSettings(data.settings);
      setUsageStats(data.usageStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      if (cancelled) return;
      if (res.status === 401) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as {
          spaces: ClientSpace[];
          notes: ClientNote[];
          settings: ClientSettings;
          usageStats: UsageStats;
        };
        if (!cancelled) {
          setSpaces(data.spaces);
          setNotes(data.notes);
          setSettings(data.settings);
          setUsageStats(data.usageStats);
        }
      }
      if (!cancelled) setLoading(false);
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  // Silent live update whenever background AI agent is processing any note
  const hasProcessingNotes = useMemo(
    () => notes.some((n) => n.status === "processing"),
    [notes]
  );

  useEffect(() => {
    if (!authenticated || !hasProcessingNotes) return;
    const interval = setInterval(() => {
      void fetchBootstrap();
    }, 1300);
    return () => clearInterval(interval);
  }, [authenticated, hasProcessingNotes, fetchBootstrap]);

  useEffect(() => {
    if (!toastError) return;
    const t = setTimeout(() => setToastError(null), 5000);
    return () => clearTimeout(t);
  }, [toastError]);

  const spaceMap = useMemo(() => {
    const map = new Map<string, ClientSpace>();
    for (const s of spaces) map.set(s.id, s);
    return map;
  }, [spaces]);

  const countsBySpace = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notes) {
      counts[n.spaceId] = (counts[n.spaceId] || 0) + 1;
    }
    return counts;
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes.filter((n) => {
      if (activeTab !== "all" && n.spaceId !== activeTab) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.rawText.toLowerCase().includes(q) ||
        (n.metadata.categoryTag || "").toLowerCase().includes(q) ||
        (n.metadata.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [notes, activeTab, searchQuery]);

  async function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSpaceName.trim(),
          description: newSpaceDesc.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        space?: ClientSpace;
        error?: string;
      };
      if (!res.ok || !data.space) {
        setToastError(data.error || "Başlık oluşturulamadı.");
        return;
      }
      setSpaces((prev) =>
        prev.some((s) => s.id === data.space!.id)
          ? prev
          : [...prev, data.space!]
      );
      setActiveTab(data.space.id);
      setNewSpaceName("");
      setNewSpaceDesc("");
      setAddingSpace(false);
    } catch {
      setToastError("Başlık eklenirken hata oluştu.");
    }
  }

  async function handleDeleteCustomSpace(spaceId: string) {
    try {
      const res = await fetch(`/api/spaces/${spaceId}`, { method: "DELETE" });
      if (!res.ok) return;
      setActiveTab("all");
      await fetchBootstrap();
    } catch {
      setToastError("Başlık silinemedi.");
    }
  }

  async function handleAcceptSuggestedSpace(
    noteId: string,
    suggestedName: string
  ) {
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: suggestedName,
          moveNoteId: noteId,
        }),
      });
      if (res.ok) {
        await fetchBootstrap();
      }
    } catch {
      setToastError("Önerilen başlık açılamadı.");
    }
  }

  async function handlePatchNote(
    noteId: string,
    payload: Record<string, unknown>
  ) {
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        note?: ClientNote;
      };
      if (res.ok && data.note) {
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? data.note! : n))
        );
      }
    } catch {
      setToastError("Güncellenemedi.");
    }
  }

  async function handleDeleteNote(noteId: string) {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    await fetch(`/api/notes/${noteId}`, { method: "DELETE" }).catch(() => null);
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthenticated(false);
  }

  if (!authenticated) {
    return (
      <PinLockScreen
        onUnlocked={() => {
          setLoading(true);
          setAuthenticated(true);
        }}
      />
    );
  }

  const activeSpace = activeTab === "all" ? null : spaceMap.get(activeTab);
  const aiConfigured = Boolean(
    settings &&
      (settings.hasGeminiByok ||
        settings.hasOpenaiByok ||
        settings.hasSystemKey)
  );

  function renderSpaceIcon(kind: string) {
    if (kind === "tasks") return <CheckSquare className="h-3.5 w-3.5" />;
    if (kind === "resources") return <Wrench className="h-3.5 w-3.5" />;
    if (kind === "ideas") return <Lightbulb className="h-3.5 w-3.5" />;
    return <Folder className="h-3.5 w-3.5" />;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6 sm:py-8">
      {/* Top Minimal Header */}
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-sm">
            Z
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
                ZeroNote
              </h1>
              {hasProcessingNotes && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Ajan çalışıyor
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500">
              Sadece yaz ve çık — niyet analizi ve araştırma otomatik
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
          >
            <Settings className="h-3.5 w-3.5 text-emerald-400" />
            <span>Bağlam & AI</span>
          </button>

          {settings?.passwordProtectionEnabled && (
            <button
              type="button"
              onClick={() => void handleLogout()}
              title="Kilitle / Çıkış"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Subtle onboarding banner if no AI API key is configured yet */}
      {settings && !aiConfigured && (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-left text-xs text-amber-200 transition hover:bg-amber-500/15"
        >
          <span className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              AI özetleme, sesli not ve web araştırmasını aktif etmek için{" "}
              <strong>Ayarlar</strong> menüsünden Gemini veya OpenAI API
              anahtarınızı bağlayın.
            </span>
          </span>
          <span className="shrink-0 rounded-lg bg-amber-400/20 px-2.5 py-1 font-semibold text-amber-200">
            Bağla →
          </span>
        </button>
      )}

      {/* Toast Error */}
      {toastError && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-200">
          <span>{toastError}</span>
          <button type="button" onClick={() => setToastError(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Zero-Friction Capture Bar */}
      <section className="mb-6">
        <CaptureBar
          onNoteCreated={(newNote) => {
            setNotes((prev) => [newNote, ...prev]);
          }}
          onError={(msg) => setToastError(msg)}
        />
      </section>

      {/* Spaces Navigation + Search */}
      <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              activeTab === "all"
                ? "bg-zinc-100 text-zinc-950"
                : "border border-zinc-800/80 bg-zinc-900/50 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Tümü</span>
            <span className="rounded-full bg-black/15 px-1.5 py-0.2 text-[10px]">
              {notes.length}
            </span>
          </button>

          {spaces.map((sp) => {
            const active = activeTab === sp.id;
            const count = countsBySpace[sp.id] || 0;
            return (
              <button
                key={sp.id}
                type="button"
                onClick={() => setActiveTab(sp.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-emerald-500 text-zinc-950"
                    : "border border-zinc-800/80 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700"
                }`}
              >
                {renderSpaceIcon(sp.kind)}
                <span>{sp.name}</span>
                <span
                  className={`rounded-full px-1.5 text-[10px] ${
                    active ? "bg-zinc-950/20 text-zinc-950" : "text-zinc-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setAddingSpace((v) => !v)}
            className="flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:border-emerald-500/50 hover:text-emerald-300"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Başlık Aç</span>
          </button>
        </div>

        {/* Instant Filter */}
        <div className="relative w-full sm:w-52">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Notlarda ara..."
            className="w-full rounded-xl border border-zinc-800/90 bg-zinc-900/60 py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none"
          />
        </div>
      </section>

      {/* Manual Space Creation Form */}
      {addingSpace && (
        <form
          onSubmit={handleCreateSpace}
          className="mb-4 flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3.5 sm:flex-row sm:items-center"
        >
          <input
            type="text"
            autoFocus
            maxLength={36}
            value={newSpaceName}
            onChange={(e) => setNewSpaceName(e.target.value)}
            placeholder="Yeni başlık adı (örn: Yatırım, SaaS Projem, Okunacaklar)"
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none"
          />
          <input
            type="text"
            maxLength={120}
            value={newSpaceDesc}
            onChange={(e) => setNewSpaceDesc(e.target.value)}
            placeholder="AI için kısa ipucu (isteğe bağlı)"
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
            >
              Oluştur
            </button>
            <button
              type="button"
              onClick={() => setAddingSpace(false)}
              className="rounded-xl border border-zinc-800 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800"
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}

      {/* Custom Space Header Info + Delete option */}
      {activeSpace && !activeSpace.isSystem && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-3.5 py-2 text-xs text-zinc-400">
          <span>
            Özel Başlık: <strong className="text-zinc-200">{activeSpace.name}</strong>
            {activeSpace.description ? ` — ${activeSpace.description}` : ""}
          </span>
          <button
            type="button"
            onClick={() => void handleDeleteCustomSpace(activeSpace.id)}
            className="text-rose-400 hover:underline"
          >
            Başlığı Sil (Notlar Fikirler&apos;e taşınır)
          </button>
        </div>
      )}

      {/* Notes Content Area */}
      <main className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800/80 py-14 text-center">
            <p className="text-sm text-zinc-400">
              Henüz burada bir kayıt yok.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Yukarıdaki kutuya tek bir kelime (örn. &quot;Semrush&quot;) veya
              yarım bir görev yazıp Enter&apos;a basın.
            </p>
          </div>
        ) : activeSpace?.kind === "resources" ? (
          /* Dedicated Structured Table View for Tools & Resources */
          <div className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/50">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/90 text-[11px] uppercase tracking-wider text-zinc-400">
                    <th className="py-3 pl-4 pr-3 font-medium">Araç / Kaynak</th>
                    <th className="px-3 py-3 font-medium">Kategori</th>
                    <th className="px-3 py-3 font-medium">
                      Özet & Projendeki Kullanımı
                    </th>
                    <th className="py-3 pl-3 pr-4 text-right font-medium">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {filteredNotes.map((note) => (
                    <tr
                      key={note.id}
                      className="group transition hover:bg-zinc-900/80"
                    >
                      <td className="align-top py-3.5 pl-4 pr-3 sm:w-52">
                        <div className="flex items-center gap-1.5 font-semibold text-zinc-100 text-sm">
                          <span>{note.title}</span>
                          {note.metadata.officialUrl && (
                            <a
                              href={note.metadata.officialUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:text-emerald-300"
                              title={note.metadata.officialUrl}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-zinc-500">
                          Ham not: &ldquo;{note.rawText}&rdquo;
                        </div>
                      </td>

                      <td className="align-top px-3 py-3.5 sm:w-40">
                        {note.metadata.categoryTag && (
                          <span className="inline-block rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                            {note.metadata.categoryTag}
                          </span>
                        )}
                        {note.metadata.pricingHint && (
                          <div className="mt-1 text-[11px] text-zinc-400">
                            {note.metadata.pricingHint}
                          </div>
                        )}
                      </td>

                      <td className="align-top px-3 py-3.5">
                        {note.status === "processing" ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Araştırılıyor...
                          </span>
                        ) : (
                          <>
                            <p className="text-zinc-200 leading-relaxed">
                              {note.summary}
                            </p>
                            {note.metadata.projectUseCase && (
                              <p className="mt-1.5 rounded-lg bg-zinc-950/70 px-2.5 py-1.5 text-[11px] text-emerald-300/90 border border-zinc-800/80">
                                <strong>Senin için:</strong>{" "}
                                {note.metadata.projectUseCase}
                              </p>
                            )}
                          </>
                        )}
                      </td>

                      <td className="align-top py-3.5 pl-3 pr-4 text-right sm:w-36">
                        <div className="flex items-center justify-end gap-1">
                          <select
                            value={note.spaceId}
                            onChange={(e) =>
                              void handlePatchNote(note.id, {
                                spaceId: e.target.value,
                              })
                            }
                            className="rounded-lg border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-[11px] text-zinc-300 focus:outline-none"
                          >
                            {spaces.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              void handlePatchNote(note.id, {
                                action: "reprocess",
                              })
                            }
                            title="Yeniden Araştır"
                            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteNote(note.id)}
                            title="Sil"
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Unified / Tasks / Ideas / Custom Card Stream */
          <div className="space-y-3">
            {filteredNotes.map((note) => {
              const sp = spaceMap.get(note.spaceId);
              const isTaskSpace = sp?.kind === "tasks";
              const isDone = Boolean(note.metadata.isCompleted);

              return (
                <article
                  key={note.id}
                  className={`rounded-2xl border p-4 transition ${
                    note.status === "processing"
                      ? "border-emerald-500/40 bg-zinc-900/90 animate-pulse"
                      : "border-zinc-800/90 bg-zinc-900/55 hover:border-zinc-700/80"
                  }`}
                >
                  {/* Optional AI Space Creation Suggestion Banner */}
                  {note.suggestedSpace && (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                        <span>
                          AI Önerisi: Bu not için{" "}
                          <strong>&ldquo;{note.suggestedSpace}&rdquo;</strong>{" "}
                          başlığı açılsın mı?
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handleAcceptSuggestedSpace(
                              note.id,
                              note.suggestedSpace!
                            )
                          }
                          className="rounded-lg bg-indigo-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-400"
                        >
                          + Aç ve Taşı
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handlePatchNote(note.id, {
                              dismissSuggestion: true,
                            })
                          }
                          className="text-[11px] text-indigo-300/80 hover:underline"
                        >
                          Yoksay
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-1 items-start gap-3">
                      {isTaskSpace && (
                        <button
                          type="button"
                          onClick={() =>
                            void handlePatchNote(note.id, {
                              toggleCompleted: true,
                            })
                          }
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                            isDone
                              ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                              : "border-zinc-700 bg-zinc-950 hover:border-emerald-500/60"
                          }`}
                        >
                          {isDone && <Check className="h-3.5 w-3.5" />}
                        </button>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={`text-sm font-semibold ${
                              isDone
                                ? "line-through text-zinc-500"
                                : "text-zinc-100"
                            }`}
                          >
                            {note.title}
                          </h3>

                          {activeTab === "all" && sp && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300">
                              {renderSpaceIcon(sp.kind)}
                              <span>{sp.name}</span>
                            </span>
                          )}

                          {note.inputType === "voice" && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300">
                              <Mic className="h-2.5 w-2.5 text-emerald-400" />
                              Sesli
                            </span>
                          )}

                          {note.metadata.categoryTag && (
                            <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                              {note.metadata.categoryTag}
                            </span>
                          )}

                          {note.metadata.dueDate && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                              <Calendar className="h-3 w-3" />
                              {note.metadata.dueDate}
                            </span>
                          )}

                          {note.metadata.officialUrl && (
                            <a
                              href={note.metadata.officialUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Siteyi Aç</span>
                            </a>
                          )}
                        </div>

                        {/* Summary */}
                        <p className="mt-1.5 text-xs leading-relaxed text-zinc-300">
                          {note.status === "processing" ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {note.summary}
                            </span>
                          ) : (
                            note.summary
                          )}
                        </p>

                        {/* Resource Use-case callout */}
                        {note.metadata.projectUseCase && (
                          <p className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-xs text-emerald-300/90">
                            <strong>Senin için:</strong>{" "}
                            {note.metadata.projectUseCase}
                          </p>
                        )}

                        {/* Idea Next Step callout */}
                        {note.metadata.nextStep && (
                          <p className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-300">
                            <strong className="text-emerald-400">
                              İlk Adım:
                            </strong>{" "}
                            {note.metadata.nextStep}
                          </p>
                        )}

                        {/* Subtasks Checklist */}
                        {note.metadata.subtasks &&
                          note.metadata.subtasks.length > 0 && (
                            <ul className="mt-2.5 space-y-1.5 rounded-xl border border-zinc-800/70 bg-zinc-950/60 p-2.5">
                              {note.metadata.subtasks.map((st) => (
                                <li
                                  key={st.id}
                                  onClick={() =>
                                    void handlePatchNote(note.id, {
                                      toggleSubtaskId: st.id,
                                    })
                                  }
                                  className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300 hover:text-zinc-100"
                                >
                                  <span
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                      st.done
                                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                                        : "border-zinc-700"
                                    }`}
                                  >
                                    {st.done && <Check className="h-3 w-3" />}
                                  </span>
                                  <span
                                    className={
                                      st.done
                                        ? "line-through text-zinc-500"
                                        : ""
                                    }
                                  >
                                    {st.text}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}

                        {/* Raw Input Preservation & Tags Footer */}
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                          <span>Ham girdi: &ldquo;{note.rawText}&rdquo;</span>
                          <div className="flex items-center gap-1.5">
                            {(note.metadata.tags || []).map((t) => (
                              <span
                                key={t}
                                className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Re-route / Reprocess / Delete Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      <select
                        value={note.spaceId}
                        onChange={(e) =>
                          void handlePatchNote(note.id, {
                            spaceId: e.target.value,
                          })
                        }
                        title="Başka başlığa taşı"
                        className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300 focus:outline-none"
                      >
                        {spaces.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() =>
                          void handlePatchNote(note.id, { action: "reprocess" })
                        }
                        title="Yeniden Analiz Et"
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeleteNote(note.id)}
                        title="Sil"
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {settingsOpen && settings && (
        <SettingsModal
          settings={settings}
          usageStats={usageStats}
          onClose={() => setSettingsOpen(false)}
          onSaved={(updated) => {
            setSettings(updated);
            setSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}
