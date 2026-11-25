"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  Wrench,
  Lightbulb,
  Folder,
  FolderKanban,
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
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  ArrowLeft,
  SquarePen,
} from "lucide-react";
import type {
  ClientNote,
  ClientProject,
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

const PROJECT_DOT_COLORS: Record<string, string> = {
  emerald: "bg-emerald-400",
  blue: "bg-blue-400",
  violet: "bg-violet-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
};

export function NotesWorkspace({ initialAuthenticated }: NotesWorkspaceProps) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [loading, setLoading] = useState(initialAuthenticated);

  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [spaces, setSpaces] = useState<ClientSpace[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats>({
    monthlySystemSpendUsd: 0,
    monthlyByokSpendUsd: 0,
    totalNotesCount: 0,
  });

  const [activeProjectId, setActiveProjectId] = useState<string>("default");
  const [activeSpaceTab, setActiveSpaceTab] = useState<string>("all");
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [composeHeroMode, setComposeHeroMode] = useState<boolean>(false);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastError, setToastError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // New project form state
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  // New space form state
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
        projects: ClientProject[];
        spaces: ClientSpace[];
        notes: ClientNote[];
        settings: ClientSettings;
        usageStats: UsageStats;
      };
      setProjects(data.projects || []);
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
          projects: ClientProject[];
          spaces: ClientSpace[];
          notes: ClientNote[];
          settings: ClientSettings;
          usageStats: UsageStats;
        };
        if (!cancelled) {
          setProjects(data.projects || []);
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

  const activeProject = useMemo(
    () =>
      projects.find((p) => p.id === activeProjectId) ||
      projects[0] || {
        id: "default",
        name: "Genel Alan",
        description: "",
        color: "emerald",
        position: 0,
        isDefault: true,
      },
    [projects, activeProjectId]
  );

  const spaceMap = useMemo(() => {
    const map = new Map<string, ClientSpace>();
    for (const s of spaces) map.set(s.id, s);
    return map;
  }, [spaces]);

  const countsByProject = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notes) {
      const pid = n.projectId || "default";
      counts[pid] = (counts[pid] || 0) + 1;
    }
    return counts;
  }, [notes]);

  const projectNotes = useMemo(
    () => notes.filter((n) => (n.projectId || "default") === activeProject.id),
    [notes, activeProject.id]
  );

  const countsBySpaceInProject = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of projectNotes) {
      counts[n.spaceId] = (counts[n.spaceId] || 0) + 1;
    }
    return counts;
  }, [projectNotes]);

  const sidebarFilteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projectNotes.filter((n) => {
      if (activeSpaceTab !== "all" && n.spaceId !== activeSpaceTab) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.rawText.toLowerCase().includes(q) ||
        (n.metadata.categoryTag || "").toLowerCase().includes(q) ||
        (n.metadata.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [projectNotes, activeSpaceTab, searchQuery]);

  const centerNotes = useMemo(() => {
    if (focusedNoteId) {
      const found = projectNotes.find((n) => n.id === focusedNoteId);
      return found ? [found] : sidebarFilteredNotes;
    }
    return sidebarFilteredNotes;
  }, [focusedNoteId, projectNotes, sidebarFilteredNotes]);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        project?: ClientProject;
        error?: string;
      };
      if (!res.ok || !data.project) {
        setToastError(data.error || "Proje oluşturulamadı.");
        return;
      }
      setProjects((prev) =>
        prev.some((p) => p.id === data.project!.id)
          ? prev
          : [...prev, data.project!]
      );
      setActiveProjectId(data.project.id);
      setActiveSpaceTab("all");
      setFocusedNoteId(null);
      setComposeHeroMode(false);
      setNewProjectName("");
      setNewProjectDesc("");
      setAddingProject(false);
    } catch {
      setToastError("Proje eklenirken hata oluştu.");
    }
  }

  async function handleDeleteProject(projectId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      if (activeProjectId === projectId) {
        setActiveProjectId("default");
        setFocusedNoteId(null);
      }
      await fetchBootstrap();
    } catch {
      setToastError("Proje silinemedi.");
    }
  }

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
      setActiveSpaceTab(data.space.id);
      setFocusedNoteId(null);
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
      setActiveSpaceTab("all");
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
    if (focusedNoteId === noteId) setFocusedNoteId(null);
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

  const activeSpace =
    activeSpaceTab === "all" ? null : spaceMap.get(activeSpaceTab);
  const aiConfigured = Boolean(
    settings &&
      (settings.hasGeminiByok ||
        settings.hasOpenaiByok ||
        settings.hasSystemKey)
  );
  const showCenteredHero =
    !loading && (projectNotes.length === 0 || composeHeroMode) && !focusedNoteId;

  function renderSpaceIcon(kind: string) {
    if (kind === "tasks") return <CheckSquare className="h-3.5 w-3.5" />;
    if (kind === "resources") return <Wrench className="h-3.5 w-3.5" />;
    if (kind === "ideas") return <Lightbulb className="h-3.5 w-3.5" />;
    return <Folder className="h-3.5 w-3.5" />;
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#1e1f20] text-zinc-200 select-none">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-emerald-400 text-xs font-bold text-zinc-950">
            Z
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-100">
            ZeroNote
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setSidebarOpen(false);
            setMobileDrawerOpen(false);
          }}
          title="Kenar çubuğunu gizle"
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* New Note / Center Prompt Button */}
      <div className="px-3 py-2">
        <button
          type="button"
          onClick={() => {
            setFocusedNoteId(null);
            setComposeHeroMode(true);
            setMobileDrawerOpen(false);
          }}
          className="flex w-full items-center gap-2.5 rounded-full bg-[#282a2c] px-3.5 py-2.5 text-xs font-medium text-zinc-100 transition hover:bg-zinc-700/80"
        >
          <SquarePen className="h-4 w-4 text-blue-400" />
          <span>Yeni Not / Ajan Ekranı</span>
        </button>
      </div>

      {/* Projects Section */}
      <div className="px-3 pt-2 pb-2 border-b border-zinc-800/80">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            <FolderKanban className="h-3.5 w-3.5" />
            <span>Projeler</span>
          </span>
          <button
            type="button"
            onClick={() => setAddingProject((v) => !v)}
            title="Yeni Proje Oluştur"
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-blue-300"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {addingProject && (
          <form
            onSubmit={handleCreateProject}
            className="mb-2 space-y-1.5 rounded-xl border border-zinc-700/80 bg-[#131314] p-2.5"
          >
            <input
              type="text"
              autoFocus
              maxLength={40}
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Proje adı (örn: SaaS Fikrim)"
              className="w-full rounded-lg border border-zinc-800 bg-[#1e1f20] px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500/50 focus:outline-none"
            />
            <input
              type="text"
              maxLength={140}
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              placeholder="Proje bağlamı (AI için ipucu)"
              className="w-full rounded-lg border border-zinc-800 bg-[#1e1f20] px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500/50 focus:outline-none"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setAddingProject(false)}
                className="rounded-lg px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-800"
              >
                İptal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-500 px-2.5 py-1 text-[11px] font-semibold text-zinc-950 hover:bg-blue-400"
              >
                Ekle
              </button>
            </div>
          </form>
        )}

        <div className="max-h-40 space-y-0.5 overflow-y-auto pr-0.5">
          {projects.map((prj) => {
            const isActive = prj.id === activeProject.id;
            const count = countsByProject[prj.id] || 0;
            const dotClass =
              PROJECT_DOT_COLORS[prj.color] || PROJECT_DOT_COLORS.emerald;

            return (
              <div
                key={prj.id}
                className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition cursor-pointer ${
                  isActive
                    ? "bg-[#004a77]/45 text-blue-200 font-medium"
                    : "text-zinc-300 hover:bg-zinc-800/70"
                }`}
                onClick={() => {
                  setActiveProjectId(prj.id);
                  setFocusedNoteId(null);
                  setComposeHeroMode(false);
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
                  <span className="truncate">{prj.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-zinc-500">{count}</span>
                  {!prj.isDefault && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteProject(prj.id);
                      }}
                      title="Projeyi Sil"
                      className="hidden rounded p-0.5 text-zinc-500 hover:text-rose-400 group-hover:inline-flex"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Notes Navigation List for Selected Project */}
      <div className="flex flex-1 flex-col min-h-0 px-3 pt-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Proje Notları
          </span>
          {focusedNoteId && (
            <button
              type="button"
              onClick={() => setFocusedNoteId(null)}
              className="text-[11px] text-blue-400 hover:underline"
            >
              Tümünü Gör
            </button>
          )}
        </div>

        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Proje içinde ara..."
            className="w-full rounded-xl border border-zinc-800 bg-[#131314] py-1.5 pl-8 pr-2.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none"
          />
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto pr-1 pb-2">
          {sidebarFilteredNotes.length === 0 ? (
            <p className="px-2 py-4 text-center text-[11px] text-zinc-500">
              Bu projede henüz not yok.
            </p>
          ) : (
            sidebarFilteredNotes.map((n) => {
              const sp = spaceMap.get(n.spaceId);
              const isSelected = focusedNoteId === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setFocusedNoteId(n.id);
                    setComposeHeroMode(false);
                    setMobileDrawerOpen(false);
                  }}
                  className={`flex w-full flex-col gap-0.5 rounded-xl px-2.5 py-2 text-left transition ${
                    isSelected
                      ? "bg-[#282a2c] text-zinc-100 ring-1 ring-blue-500/40"
                      : "text-zinc-300 hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {n.status === "processing" ? (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-blue-400" />
                    ) : n.metadata.isCompleted ? (
                      <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                    ) : (
                      <span className="shrink-0 text-zinc-500">
                        {renderSpaceIcon(sp?.kind || "custom")}
                      </span>
                    )}
                    <span className="truncate text-xs font-medium">
                      {n.title || n.rawText}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pl-4 text-[10px] text-zinc-500">
                    <span className="truncate">{sp?.name || "Not"}</span>
                    <span>
                      {new Date(n.createdAt).toLocaleTimeString("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Sidebar Bottom Controls */}
      <div className="border-t border-zinc-800/80 p-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
        >
          <Settings className="h-4 w-4 text-blue-400" />
          <span>Bağlam & AI</span>
        </button>

        {settings?.passwordProtectionEnabled && (
          <button
            type="button"
            onClick={() => void handleLogout()}
            title="Kilitle / Çıkış"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#131314] text-zinc-100">
      {/* Desktop Left Sidebar */}
      {sidebarOpen && (
        <aside className="hidden md:block w-72 shrink-0 border-r border-zinc-800/80">
          {sidebarContent}
        </aside>
      )}

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative z-50 w-72 max-w-[85vw] h-full border-r border-zinc-800 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Center Gemini-Style Canvas */}
      <div className="flex flex-1 flex-col min-w-0 h-full">
        {/* Top Minimal Header */}
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800/60">
          <div className="flex items-center gap-2 min-w-0">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                title="Kenar çubuğunu aç"
                className="hidden md:flex rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  PROJECT_DOT_COLORS[activeProject.color] ||
                  PROJECT_DOT_COLORS.emerald
                }`}
              />
              <h1 className="truncate text-sm font-semibold text-zinc-100">
                {activeProject.name}
              </h1>
              {activeProject.description && (
                <span className="hidden lg:inline truncate max-w-xs text-xs text-zinc-500">
                  — {activeProject.description}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasProcessingNotes && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-2.5 py-1 text-[11px] font-medium text-blue-300">
                <Loader2 className="h-3 w-3 animate-spin" />
                Ajan işliyor
              </span>
            )}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-[#1e1f20] px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              <span className="hidden sm:inline">
                {settings?.activeProvider === "openai" ? "OpenAI" : "Gemini"}
              </span>
            </button>
          </div>
        </header>

        {/* Space Filter Pills inside Active Project */}
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-zinc-800/40">
          <button
            type="button"
            onClick={() => {
              setActiveSpaceTab("all");
              setFocusedNoteId(null);
              setComposeHeroMode(false);
            }}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
              activeSpaceTab === "all" && !composeHeroMode
                ? "bg-zinc-100 text-zinc-950"
                : "bg-[#1e1f20] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <span>Tümü</span>
            <span className="opacity-70">{projectNotes.length}</span>
          </button>

          {spaces.map((sp) => {
            const active = activeSpaceTab === sp.id && !composeHeroMode;
            const count = countsBySpaceInProject[sp.id] || 0;
            return (
              <button
                key={sp.id}
                type="button"
                onClick={() => {
                  setActiveSpaceTab(sp.id);
                  setFocusedNoteId(null);
                  setComposeHeroMode(false);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-blue-500 text-zinc-950"
                    : "bg-[#1e1f20] text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {renderSpaceIcon(sp.kind)}
                <span>{sp.name}</span>
                <span className="opacity-70">{count}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setAddingSpace((v) => !v)}
            className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-blue-400/50 hover:text-blue-300"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Başlık Aç</span>
          </button>
        </div>

        {/* Manual Space Creation Inline Form */}
        {addingSpace && (
          <form
            onSubmit={handleCreateSpace}
            className="mx-auto mt-3 flex w-full max-w-3xl flex-col gap-2 rounded-2xl border border-zinc-800 bg-[#1e1f20] p-3 sm:flex-row sm:items-center"
          >
            <input
              type="text"
              autoFocus
              maxLength={36}
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              placeholder="Yeni başlık adı (örn: Yatırım, Pazarlama)"
              className="flex-1 rounded-xl border border-zinc-800 bg-[#131314] px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500/50 focus:outline-none"
            />
            <input
              type="text"
              maxLength={120}
              value={newSpaceDesc}
              onChange={(e) => setNewSpaceDesc(e.target.value)}
              placeholder="AI için kısa ipucu (isteğe bağlı)"
              className="flex-1 rounded-xl border border-zinc-800 bg-[#131314] px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500/50 focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="rounded-xl bg-blue-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-blue-400"
              >
                Oluştur
              </button>
              <button
                type="button"
                onClick={() => setAddingSpace(false)}
                className="rounded-xl border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                Vazgeç
              </button>
            </div>
          </form>
        )}

        {/* API Key Banner / Toast Error */}
        <div className="mx-auto w-full max-w-3xl px-4 pt-3 space-y-2">
          {settings && !aiConfigured && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-left text-xs text-amber-200 hover:bg-amber-500/15"
            >
              <span className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  AI özetleme ve sesli not için <strong>Bağlam & AI</strong>{" "}
                  ayarlarından Gemini veya OpenAI API anahtarınızı ekleyin.
                </span>
              </span>
              <span className="shrink-0 rounded-lg bg-amber-400/20 px-2.5 py-1 font-semibold">
                Ekle →
              </span>
            </button>
          )}

          {toastError && (
            <div className="flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
              <span>{toastError}</span>
              <button type="button" onClick={() => setToastError(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Center Main Content */}
        {showCenteredHero ? (
          /* Gemini-style Centered Hero Prompt Screen */
          <main className="flex flex-1 flex-col items-center justify-center px-4 pb-12">
            <div className="w-full max-w-2xl space-y-6">
              <div className="text-center space-y-2">
                <h2 className="bg-gradient-to-r from-blue-400 via-emerald-300 to-indigo-300 bg-clip-text text-3xl sm:text-4xl font-semibold tracking-tight text-transparent">
                  {activeProject.name}
                </h2>
                <p className="text-sm text-zinc-400">
                  {activeProject.description ||
                    "Aklına geleni tek kelimeyle yaz veya sesle bırak — arka plandaki ajan araştırıp düzenlesin."}
                </p>
              </div>

              <CaptureBar
                activeProjectId={activeProject.id}
                activeProjectName={activeProject.name}
                onNoteCreated={(newNote) => {
                  setNotes((prev) => [newNote, ...prev]);
                  setComposeHeroMode(false);
                }}
                onError={(msg) => setToastError(msg)}
              />

              {projectNotes.length > 0 && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setComposeHeroMode(false)}
                    className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-4"
                  >
                    Bu projedeki {projectNotes.length} nota dön
                  </button>
                </div>
              )}
            </div>
          </main>
        ) : (
          /* Notes Stream + Docked Gemini-style Bottom Prompt Bar */
          <>
            <main className="flex-1 overflow-y-auto px-4 py-4">
              <div className="mx-auto w-full max-w-3xl space-y-3">
                {focusedNoteId && (
                  <button
                    type="button"
                    onClick={() => setFocusedNoteId(null)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#1e1f20] px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Tüm {activeProject.name} Notları</span>
                  </button>
                )}

                {activeSpace && !activeSpace.isSystem && !focusedNoteId && (
                  <div className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-[#1e1f20]/70 px-3.5 py-2 text-xs text-zinc-400">
                    <span>
                      Özel Başlık:{" "}
                      <strong className="text-zinc-200">
                        {activeSpace.name}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteCustomSpace(activeSpace.id)}
                      className="text-rose-400 hover:underline"
                    >
                      Başlığı Sil
                    </button>
                  </div>
                )}

                {loading ? (
                  <div className="flex items-center justify-center py-16 text-zinc-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : centerNotes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 py-12 text-center text-xs text-zinc-500">
                    Bu filtrede henüz not bulunmuyor. Aşağıdaki kutudan
                    ekleyebilirsiniz.
                  </div>
                ) : activeSpace?.kind === "resources" && !focusedNoteId ? (
                  /* Structured Table View for Araçlar & Kaynaklar */
                  <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#1e1f20]/70">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800 bg-[#1e1f20] text-[11px] uppercase tracking-wider text-zinc-400">
                            <th className="py-3 pl-4 pr-3 font-medium">
                              Araç / Kaynak
                            </th>
                            <th className="px-3 py-3 font-medium">Kategori</th>
                            <th className="px-3 py-3 font-medium">
                              Özet & Proje Kullanımı
                            </th>
                            <th className="py-3 pl-3 pr-4 text-right font-medium">
                              İşlem
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/70">
                          {centerNotes.map((note) => (
                            <tr
                              key={note.id}
                              className="transition hover:bg-zinc-800/40"
                            >
                              <td className="align-top py-3.5 pl-4 pr-3 sm:w-48">
                                <div className="flex items-center gap-1.5 font-semibold text-zinc-100 text-sm">
                                  <span>{note.title}</span>
                                  {note.metadata.officialUrl && (
                                    <a
                                      href={note.metadata.officialUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-400 hover:text-blue-300"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                  )}
                                </div>
                                <div className="mt-1 text-[11px] text-zinc-500">
                                  &ldquo;{note.rawText}&rdquo;
                                </div>
                              </td>
                              <td className="align-top px-3 py-3.5 sm:w-36">
                                {note.metadata.categoryTag && (
                                  <span className="inline-block rounded-lg border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-300">
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
                                  <span className="inline-flex items-center gap-1.5 text-blue-300">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Araştırılıyor...
                                  </span>
                                ) : (
                                  <>
                                    <p className="text-zinc-200 leading-relaxed">
                                      {note.summary}
                                    </p>
                                    {note.metadata.projectUseCase && (
                                      <p className="mt-1.5 rounded-lg border border-zinc-800 bg-[#131314] px-2.5 py-1.5 text-[11px] text-emerald-300/90">
                                        <strong>Senin için:</strong>{" "}
                                        {note.metadata.projectUseCase}
                                      </p>
                                    )}
                                  </>
                                )}
                              </td>
                              <td className="align-top py-3.5 pl-3 pr-4 text-right">
                                <div className="flex items-center justify-end gap-1">
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
                                    onClick={() =>
                                      void handleDeleteNote(note.id)
                                    }
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
                  /* Conversational / Card Stream in the Center Column */
                  centerNotes.map((note) => {
                    const sp = spaceMap.get(note.spaceId);
                    const isTaskSpace = sp?.kind === "tasks";
                    const isDone = Boolean(note.metadata.isCompleted);

                    return (
                      <article
                        key={note.id}
                        className={`rounded-2xl border p-4 transition ${
                          note.status === "processing"
                            ? "border-blue-500/40 bg-[#1e1f20] animate-pulse"
                            : "border-zinc-800/90 bg-[#1e1f20]/75 hover:border-zinc-700"
                        }`}
                      >
                        {note.suggestedSpace && (
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                              <span>
                                AI Önerisi: Bu not için{" "}
                                <strong>
                                  &ldquo;{note.suggestedSpace}&rdquo;
                                </strong>{" "}
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
                                    : "border-zinc-600 bg-[#131314] hover:border-emerald-500"
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

                                {sp && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#131314] px-2.5 py-0.5 text-[11px] text-zinc-300 border border-zinc-800">
                                    {renderSpaceIcon(sp.kind)}
                                    <span>{sp.name}</span>
                                  </span>
                                )}

                                {note.inputType === "voice" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                                    <Mic className="h-2.5 w-2.5 text-blue-400" />
                                    Sesli
                                  </span>
                                )}

                                {note.metadata.categoryTag && (
                                  <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[11px] text-blue-300">
                                    {note.metadata.categoryTag}
                                  </span>
                                )}

                                {note.metadata.dueDate && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                                    <Calendar className="h-3 w-3" />
                                    {note.metadata.dueDate}
                                  </span>
                                )}

                                {note.metadata.officialUrl && (
                                  <a
                                    href={note.metadata.officialUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    <span>Site</span>
                                  </a>
                                )}
                              </div>

                              <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300">
                                {note.status === "processing" ? (
                                  <span className="inline-flex items-center gap-1.5 text-blue-300">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    {note.summary}
                                  </span>
                                ) : (
                                  note.summary
                                )}
                              </p>

                              {note.metadata.projectUseCase && (
                                <p className="mt-2 rounded-xl border border-zinc-800 bg-[#131314] px-3 py-2 text-xs text-emerald-300/90">
                                  <strong>Projendeki Kullanımı:</strong>{" "}
                                  {note.metadata.projectUseCase}
                                </p>
                              )}

                              {note.metadata.nextStep && (
                                <p className="mt-2 rounded-xl border border-zinc-800 bg-[#131314] px-3 py-2 text-xs text-zinc-300">
                                  <strong className="text-blue-400">
                                    İlk Adım:
                                  </strong>{" "}
                                  {note.metadata.nextStep}
                                </p>
                              )}

                              {note.metadata.subtasks &&
                                note.metadata.subtasks.length > 0 && (
                                  <ul className="mt-2.5 space-y-1.5 rounded-xl border border-zinc-800/80 bg-[#131314] p-2.5">
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
                                          {st.done && (
                                            <Check className="h-3 w-3" />
                                          )}
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

                              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
                                <span>
                                  Ham not: &ldquo;{note.rawText}&rdquo;
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {(note.metadata.tags || []).map((t) => (
                                    <span
                                      key={t}
                                      className="rounded-md bg-[#131314] px-1.5 py-0.5 text-[10px] text-zinc-400"
                                    >
                                      #{t}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Move between Spaces / Projects & Actions */}
                          <div className="flex shrink-0 flex-col sm:flex-row items-end sm:items-center gap-1">
                            {projects.length > 1 && (
                              <select
                                value={note.projectId}
                                onChange={(e) =>
                                  void handlePatchNote(note.id, {
                                    projectId: e.target.value,
                                  })
                                }
                                title="Başka projeye taşı"
                                className="rounded-lg border border-zinc-800 bg-[#131314] px-2 py-1 text-[11px] text-zinc-300 focus:outline-none"
                              >
                                {projects.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            )}

                            <select
                              value={note.spaceId}
                              onChange={(e) =>
                                void handlePatchNote(note.id, {
                                  spaceId: e.target.value,
                                })
                              }
                              title="Başka başlığa taşı"
                              className="rounded-lg border border-zinc-800 bg-[#131314] px-2 py-1 text-[11px] text-zinc-300 focus:outline-none"
                            >
                              {spaces.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() =>
                                  void handlePatchNote(note.id, {
                                    action: "reprocess",
                                  })
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
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </main>

            {/* Docked Gemini-style Center Prompt Box */}
            <div className="px-4 pb-4 pt-2 bg-gradient-to-t from-[#131314] via-[#131314] to-transparent">
              <div className="mx-auto w-full max-w-3xl">
                <CaptureBar
                  activeProjectId={activeProject.id}
                  activeProjectName={activeProject.name}
                  onNoteCreated={(newNote) => {
                    setNotes((prev) => [newNote, ...prev]);
                  }}
                  onError={(msg) => setToastError(msg)}
                />
              </div>
            </div>
          </>
        )}
      </div>

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
