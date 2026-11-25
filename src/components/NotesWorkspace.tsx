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
  MoreHorizontal,
  Layers,
  FileText,
  MessageSquare,
  CornerDownRight,
  ChevronRight,
  ArrowUpRight,
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
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

function renderHighlightedText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-zinc-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

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
  const [viewMode, setViewMode] = useState<"ai" | "titles" | "raw">("ai");
  const [openMenuNoteId, setOpenMenuNoteId] = useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastError, setToastError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

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
      if (n.parentId && !n.metadata.promotedToSpace) continue;
      const pid = n.projectId || "default";
      counts[pid] = (counts[pid] || 0) + 1;
    }
    return counts;
  }, [notes]);

  const projectNotes = useMemo(
    () => notes.filter((n) => (n.projectId || "default") === activeProject.id),
    [notes, activeProject.id]
  );

  const visibleProjectNotes = useMemo(
    () =>
      projectNotes.filter(
        (n) => !n.parentId || Boolean(n.metadata.promotedToSpace)
      ),
    [projectNotes]
  );

  const countsBySpaceInProject = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of visibleProjectNotes) {
      counts[n.spaceId] = (counts[n.spaceId] || 0) + 1;
    }
    return counts;
  }, [visibleProjectNotes]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return visibleProjectNotes.filter((n) => {
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
  }, [visibleProjectNotes, activeSpaceTab, searchQuery]);

  const focusedNote = useMemo(
    () =>
      focusedNoteId
        ? projectNotes.find((n) => n.id === focusedNoteId) || null
        : null,
    [focusedNoteId, projectNotes]
  );

  const noteMap = useMemo(() => {
    const map = new Map<string, ClientNote>();
    for (const n of projectNotes) map.set(n.id, n);
    return map;
  }, [projectNotes]);

  const childCountsByNoteId = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of projectNotes) {
      if (n.parentId) {
        counts[n.parentId] = (counts[n.parentId] || 0) + 1;
      }
    }
    return counts;
  }, [projectNotes]);

  const focusedBreadcrumbs = useMemo(() => {
    const trail: ClientNote[] = [];
    let cursor = focusedNote;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      trail.unshift(cursor);
      cursor = cursor.parentId ? noteMap.get(cursor.parentId) || null : null;
    }
    return trail;
  }, [focusedNote, noteMap]);

  const focusedChildren = useMemo(() => {
    if (!focusedNote) return [];
    return projectNotes
      .filter((n) => n.parentId === focusedNote.id)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [focusedNote, projectNotes]);

  const groupedSections = useMemo(() => {
    const targetSpaces =
      activeSpaceTab === "all"
        ? spaces
        : spaces.filter((s) => s.id === activeSpaceTab);

    return targetSpaces
      .map((sp) => ({
        space: sp,
        items: filteredNotes.filter((n) => n.spaceId === sp.id),
      }))
      .filter((sec) => activeSpaceTab !== "all" || sec.items.length > 0);
  }, [spaces, activeSpaceTab, filteredNotes]);

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
      setComposeHeroMode(false);
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
    setOpenMenuNoteId(null);
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

  const aiConfigured = Boolean(
    settings &&
      (settings.hasGeminiByok ||
        settings.hasOpenaiByok ||
        settings.hasSystemKey)
  );
  const showCenteredHero =
    !loading && (projectNotes.length === 0 || composeHeroMode) && !focusedNote;

  function renderSpaceIcon(kind: string) {
    if (kind === "tasks") return <CheckSquare className="h-3.5 w-3.5" />;
    if (kind === "resources") return <Wrench className="h-3.5 w-3.5" />;
    if (kind === "ideas") return <Lightbulb className="h-3.5 w-3.5" />;
    return <Folder className="h-3.5 w-3.5" />;
  }

  function renderNoteActionsMenu(note: ClientNote) {
    const isOpen = openMenuNoteId === note.id;
    return (
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenuNoteId(isOpen ? null : note.id);
          }}
          title="Seçenekler"
          className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {isOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-8 z-30 w-52 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl shadow-zinc-200/70"
          >
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Başlık Değiştir
            </div>
            <div className="mb-1.5 space-y-0.5">
              {spaces.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setOpenMenuNoteId(null);
                    void handlePatchNote(note.id, { spaceId: s.id });
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs ${
                    note.spaceId === s.id
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  <span>{s.name}</span>
                  {note.spaceId === s.id && <Check className="h-3 w-3" />}
                </button>
              ))}
            </div>

            {projects.length > 1 && (
              <>
                <div className="border-t border-zinc-100 pt-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Projeye Taşı
                </div>
                <div className="mb-1.5 space-y-0.5">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setOpenMenuNoteId(null);
                        void handlePatchNote(note.id, { projectId: p.id });
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs ${
                        note.projectId === p.id
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-zinc-700 hover:bg-zinc-100"
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      {note.projectId === p.id && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="border-t border-zinc-100 pt-1 space-y-0.5">
              {note.parentId && (
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenuNoteId(null);
                    void handlePatchNote(note.id, {
                      togglePromotedToSpace: true,
                    });
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-blue-700 hover:bg-blue-50 font-medium"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>
                    {note.metadata.promotedToSpace
                      ? "Sadece Yorum Olarak Tut"
                      : "Ayrı Not Yap"}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpenMenuNoteId(null);
                  void handlePatchNote(note.id, { toggleShowRaw: true });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>
                  {note.metadata.showRawOnly
                    ? "AI Özetini Göster"
                    : "Ham Girdi Olarak Göster"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenuNoteId(null);
                  void handlePatchNote(note.id, { action: "reprocess" });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Yeniden Analiz Et</span>
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteNote(note.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Notu Sil</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#f8f9fa] text-zinc-800 select-none">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-xs font-semibold text-white">
            Z
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
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
          className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900"
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
          className="flex w-full items-center gap-2.5 rounded-full bg-[#e8eef7] px-4 py-2.5 text-xs font-medium text-zinc-900 transition hover:bg-[#dce5f2]"
        >
          <SquarePen className="h-4 w-4 text-blue-600" />
          <span>Yeni Not / Ajan</span>
        </button>
      </div>

      {/* Scrollable Sidebar Body: Projects + Categories + Notes */}
      <div className="flex-1 overflow-y-auto px-3 space-y-4 pb-3">
        {/* 1. Projects Section */}
        <section className="pt-1">
          <div className="mb-1.5 flex items-center justify-between px-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Projeler</span>
            </span>
            <button
              type="button"
              onClick={() => setAddingProject((v) => !v)}
              title="Yeni Proje Oluştur"
              className="rounded-full p-1 text-zinc-500 hover:bg-zinc-200/70 hover:text-blue-600"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {addingProject && (
            <form
              onSubmit={handleCreateProject}
              className="mb-2 space-y-1.5 rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-xs"
            >
              <input
                type="text"
                autoFocus
                maxLength={40}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Proje adı (örn: SaaS Fikrim)"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
              <input
                type="text"
                maxLength={140}
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="AI için kısa bağlam (isteğe bağlı)"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setAddingProject(false)}
                  className="rounded-lg px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-zinc-800"
                >
                  Ekle
                </button>
              </div>
            </form>
          )}

          <div className="space-y-0.5">
            {projects.map((prj) => {
              const isActive = prj.id === activeProject.id;
              const count = countsByProject[prj.id] || 0;
              const dotClass =
                PROJECT_DOT_COLORS[prj.color] || PROJECT_DOT_COLORS.emerald;

              return (
                <div
                  key={prj.id}
                  onClick={() => {
                    setActiveProjectId(prj.id);
                    setFocusedNoteId(null);
                    setComposeHeroMode(false);
                  }}
                  className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition cursor-pointer ${
                    isActive
                      ? "bg-[#d3e3fd]/60 text-blue-950 font-semibold"
                      : "text-zinc-700 hover:bg-zinc-200/60"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`}
                    />
                    <span className="truncate">{prj.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-zinc-400">{count}</span>
                    {!prj.isDefault && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteProject(prj.id);
                        }}
                        title="Projeyi Sil"
                        className="hidden rounded p-0.5 text-zinc-400 hover:text-rose-600 group-hover:inline-flex"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. Categories / Spaces (Moved cleanly from top header into sidebar) */}
        <section className="border-t border-zinc-200/80 pt-3">
          <div className="mb-1.5 flex items-center justify-between px-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Layers className="h-3.5 w-3.5" />
              <span>Başlıklar</span>
            </span>
            <button
              type="button"
              onClick={() => setAddingSpace((v) => !v)}
              title="Yeni Başlık Aç"
              className="rounded-full p-1 text-zinc-500 hover:bg-zinc-200/70 hover:text-blue-600"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {addingSpace && (
            <form
              onSubmit={handleCreateSpace}
              className="mb-2 space-y-1.5 rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-xs"
            >
              <input
                type="text"
                autoFocus
                maxLength={36}
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="Başlık adı (örn: Yatırım)"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
              <input
                type="text"
                maxLength={120}
                value={newSpaceDesc}
                onChange={(e) => setNewSpaceDesc(e.target.value)}
                placeholder="AI için ipucu (isteğe bağlı)"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setAddingSpace(false)}
                  className="rounded-lg px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-zinc-800"
                >
                  Aç
                </button>
              </div>
            </form>
          )}

          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveSpaceTab("all");
                setFocusedNoteId(null);
                setComposeHeroMode(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition ${
                activeSpaceTab === "all" && !composeHeroMode
                  ? "bg-zinc-200/80 font-semibold text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-200/50"
              }`}
            >
              <span>Tümü</span>
              <span className="text-[11px] text-zinc-400">
                {visibleProjectNotes.length}
              </span>
            </button>

            {spaces.map((sp) => {
              const active = activeSpaceTab === sp.id && !composeHeroMode;
              const count = countsBySpaceInProject[sp.id] || 0;
              return (
                <div
                  key={sp.id}
                  onClick={() => {
                    setActiveSpaceTab(sp.id);
                    setFocusedNoteId(null);
                    setComposeHeroMode(false);
                  }}
                  className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition cursor-pointer ${
                    active
                      ? "bg-zinc-200/80 font-semibold text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-200/50"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {renderSpaceIcon(sp.kind)}
                    <span className="truncate">{sp.name}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-zinc-400">{count}</span>
                    {!sp.isSystem && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteCustomSpace(sp.id);
                        }}
                        title="Başlığı Sil"
                        className="hidden rounded p-0.5 text-zinc-400 hover:text-rose-600 group-hover:inline-flex"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Notes List inside Selected Project */}
        <section className="border-t border-zinc-200/80 pt-3">
          <div className="mb-2 flex items-center justify-between px-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Notlar
            </span>
            {focusedNoteId && (
              <button
                type="button"
                onClick={() => setFocusedNoteId(null)}
                className="text-[11px] font-medium text-blue-600 hover:underline"
              >
                Liste
              </button>
            )}
          </div>

          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ara..."
              className="w-full rounded-xl border border-zinc-200/90 bg-white py-1.5 pl-8 pr-2.5 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-blue-400 focus:outline-none"
            />
          </div>

          <div className="space-y-0.5">
            {filteredNotes.length === 0 ? (
              <p className="px-2 py-4 text-center text-[11px] text-zinc-400">
                Henüz not yok.
              </p>
            ) : (
              filteredNotes.map((n) => {
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
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${
                      isSelected
                        ? "bg-white text-zinc-900 shadow-xs ring-1 ring-zinc-200"
                        : "text-zinc-700 hover:bg-zinc-200/50"
                    }`}
                  >
                    {n.status === "processing" ? (
                      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-blue-600" />
                    ) : n.metadata.isCompleted ? (
                      <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                    ) : (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                    )}
                    <span className="truncate text-xs font-medium">
                      {n.title || n.rawText}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Sidebar Bottom Controls */}
      <div className="border-t border-zinc-200/80 p-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200/60"
        >
          <Settings className="h-4 w-4 text-blue-600" />
          <span>Bağlam & AI</span>
        </button>

        {settings?.passwordProtectionEnabled && (
          <button
            type="button"
            onClick={() => void handleLogout()}
            title="Kilitle / Çıkış"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div
      onClick={() => setOpenMenuNoteId(null)}
      className="flex h-screen w-full overflow-hidden bg-white text-zinc-900"
    >
      {/* Desktop Left Sidebar */}
      {sidebarOpen && (
        <aside className="hidden md:block w-72 shrink-0 border-r border-zinc-200/80">
          {sidebarContent}
        </aside>
      )}

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-zinc-950/25 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside className="relative z-50 w-72 max-w-[85vw] h-full border-r border-zinc-200 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Center Clean White Canvas */}
      <div className="flex flex-1 flex-col min-w-0 h-full bg-white">
        {/* Ultra-minimal Top Header (No bulky category tabs!) */}
        <header className="flex items-center justify-between gap-2 px-5 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                title="Kenar çubuğunu aç"
                className="hidden md:flex rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  PROJECT_DOT_COLORS[activeProject.color] ||
                  PROJECT_DOT_COLORS.emerald
                }`}
              />
              <span className="truncate text-sm font-semibold text-zinc-900">
                {activeProject.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!showCenteredHero && !focusedNote && filteredNotes.length > 0 && (
              <div className="inline-flex items-center rounded-full bg-zinc-100 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setViewMode("ai")}
                  className={`rounded-full px-2.5 py-1 font-medium transition ${
                    viewMode === "ai"
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Özetli
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("titles")}
                  className={`rounded-full px-2.5 py-1 font-medium transition ${
                    viewMode === "titles"
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Başlık
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("raw")}
                  className={`rounded-full px-2.5 py-1 font-medium transition ${
                    viewMode === "raw"
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  Ham Girdiler
                </button>
              </div>
            )}
            {hasProcessingNotes && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-medium text-blue-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                Ajan işliyor
              </span>
            )}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden sm:inline">
                {settings?.activeProvider === "openai" ? "OpenAI" : "Gemini"}
              </span>
            </button>
          </div>
        </header>

        {/* API Key Banner / Toast Error */}
        <div className="mx-auto w-full max-w-3xl px-5 space-y-2">
          {settings && !aiConfigured && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-left text-xs text-amber-900 hover:bg-amber-50"
            >
              <span className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  AI özetleme ve sesli not için <strong>Bağlam & AI</strong>{" "}
                  ayarlarından Gemini veya OpenAI API anahtarınızı ekleyin.
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-amber-200/70 px-3 py-1 font-semibold text-amber-900">
                Ekle →
              </span>
            </button>
          )}

          {toastError && (
            <div className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800">
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
          <main className="flex flex-1 flex-col items-center justify-center px-5 pb-14">
            <div className="w-full max-w-2xl space-y-7">
              <div className="text-center space-y-2">
                <h2 className="font-editorial text-4xl sm:text-5xl tracking-tight text-zinc-900">
                  {activeProject.name}
                </h2>
                <p className="text-sm text-zinc-500 max-w-md mx-auto">
                  {activeProject.description ||
                    "Aklına geleni tek kelimeyle yaz veya sesle bırak — arka plandaki ajan araştırıp düzenlesin."}
                </p>
              </div>

              <CaptureBar
                activeProjectId={activeProject.id}
                activeProjectName={activeProject.name}
                spaces={spaces}
                activeSpaceId={activeSpaceTab}
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
                    className="text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-4"
                  >
                    Bu projedeki {projectNotes.length} nota dön
                  </button>
                </div>
              )}
            </div>
          </main>
        ) : focusedNote ? (
          /* Distraction-Free Focused Note Reading View (No heavy card!) */
          <>
            <main className="flex-1 overflow-y-auto px-5 py-6">
              <div className="mx-auto w-full max-w-2xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <nav className="flex flex-wrap items-center gap-1 text-xs text-zinc-500">
                    <button
                      type="button"
                      onClick={() => setFocusedNoteId(null)}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>{activeProject.name}</span>
                    </button>
                    {focusedBreadcrumbs.slice(0, -1).map((crumb) => (
                      <span
                        key={crumb.id}
                        className="inline-flex items-center gap-1"
                      >
                        <ChevronRight className="h-3 w-3 text-zinc-300" />
                        <button
                          type="button"
                          onClick={() => setFocusedNoteId(crumb.id)}
                          className="max-w-[160px] truncate rounded-full px-2 py-1 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
                        >
                          {crumb.title || crumb.rawText}
                        </button>
                      </span>
                    ))}
                  </nav>
                  <div className="flex items-center gap-1.5">
                    {focusedNote.parentId && (
                      <button
                        type="button"
                        onClick={() =>
                          void handlePatchNote(focusedNote.id, {
                            togglePromotedToSpace: true,
                          })
                        }
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          focusedNote.metadata.promotedToSpace
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                        }`}
                      >
                        {focusedNote.metadata.promotedToSpace ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Ayrı Not</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            <span>Ayrı Not Yap</span>
                          </>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void handlePatchNote(focusedNote.id, {
                          toggleShowRaw: true,
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        focusedNote.metadata.showRawOnly || viewMode === "raw"
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>
                        {focusedNote.metadata.showRawOnly
                          ? "AI Özetini Göster"
                          : "Ham Girdi Göster"}
                      </span>
                    </button>
                    {renderNoteActionsMenu(focusedNote)}
                  </div>
                </div>

                {focusedNote.suggestedSpace && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-indigo-50/80 px-4 py-2.5 text-xs text-indigo-900">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                      <span>
                        AI Önerisi: Bu not için{" "}
                        <strong>&ldquo;{focusedNote.suggestedSpace}&rdquo;</strong>{" "}
                        başlığı açılsın mı?
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleAcceptSuggestedSpace(
                            focusedNote.id,
                            focusedNote.suggestedSpace!
                          )
                        }
                        className="rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
                      >
                        + Aç ve Taşı
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handlePatchNote(focusedNote.id, {
                            dismissSuggestion: true,
                          })
                        }
                        className="text-[11px] text-indigo-700 hover:underline"
                      >
                        Yoksay
                      </button>
                    </div>
                  </div>
                )}

                {focusedNote.metadata.showRawOnly || viewMode === "raw" ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>
                        {spaceMap.get(focusedNote.spaceId)?.name || "Not"}
                      </span>
                      <span>•</span>
                      <span>Ham Girdi Görünümü</span>
                    </div>

                    <h1 className="font-editorial text-3xl sm:text-4xl leading-tight text-zinc-900 whitespace-pre-wrap">
                      {focusedNote.rawText}
                    </h1>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span>
                      {spaceMap.get(focusedNote.spaceId)?.name || "Not"}
                    </span>
                    {focusedNote.metadata.categoryTag && (
                      <>
                        <span>•</span>
                        <span className="text-blue-700 font-medium">
                          {focusedNote.metadata.categoryTag}
                        </span>
                      </>
                    )}
                    {focusedNote.metadata.dueDate && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <Calendar className="h-3 w-3" />
                          {focusedNote.metadata.dueDate}
                        </span>
                      </>
                    )}
                    {focusedNote.inputType === "voice" && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Mic className="h-3 w-3 text-blue-600" />
                          Sesli not
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-start gap-3">
                    {spaceMap.get(focusedNote.spaceId)?.kind === "tasks" && (
                      <button
                        type="button"
                        onClick={() =>
                          void handlePatchNote(focusedNote.id, {
                            toggleCompleted: true,
                          })
                        }
                        className={`mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                          focusedNote.metadata.isCompleted
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-zinc-300 bg-white hover:border-emerald-600"
                        }`}
                      >
                        {focusedNote.metadata.isCompleted && (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}

                    <h1
                      className={`font-editorial text-3xl sm:text-4xl leading-tight ${
                        focusedNote.metadata.isCompleted
                          ? "line-through text-zinc-400"
                          : "text-zinc-900"
                      }`}
                    >
                      {focusedNote.title}
                    </h1>
                  </div>

                  {(focusedNote.status === "processing" ||
                    focusedNote.summary) && (
                    <p className="text-[15px] leading-relaxed text-zinc-700">
                      {focusedNote.status === "processing" ? (
                        <span className="inline-flex items-center gap-2 text-blue-600">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {focusedNote.summary}
                        </span>
                      ) : (
                        renderHighlightedText(focusedNote.summary)
                      )}
                    </p>
                  )}

                  {focusedNote.metadata.officialUrl && (
                    <a
                      href={focusedNote.metadata.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>{focusedNote.metadata.officialUrl}</span>
                    </a>
                  )}

                  {focusedNote.metadata.projectUseCase && (
                    <div className="border-l-2 border-emerald-500 pl-4 py-1 text-sm text-zinc-700">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-0.5">
                        Projendeki Kullanımı
                      </span>
                      {focusedNote.metadata.projectUseCase}
                    </div>
                  )}

                  {focusedNote.metadata.nextStep && (
                    <div className="border-l-2 border-blue-500 pl-4 py-1 text-sm text-zinc-700">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-blue-700 mb-0.5">
                        İlk Adım
                      </span>
                      {focusedNote.metadata.nextStep}
                    </div>
                  )}

                  {focusedNote.metadata.subtasks &&
                    focusedNote.metadata.subtasks.length > 0 && (
                      <div className="pt-2 space-y-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                          Alt Adımlar
                        </div>
                        <ul className="divide-y divide-zinc-100">
                          {focusedNote.metadata.subtasks.map((st) => (
                            <li
                              key={st.id}
                              onClick={() =>
                                void handlePatchNote(focusedNote.id, {
                                  toggleSubtaskId: st.id,
                                })
                              }
                              className="flex cursor-pointer items-center gap-3 py-2.5 text-sm text-zinc-700 hover:text-zinc-950"
                            >
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                  st.done
                                    ? "border-emerald-600 bg-emerald-600 text-white"
                                    : "border-zinc-300"
                                }`}
                              >
                                {st.done && <Check className="h-3 w-3" />}
                              </span>
                              <span
                                className={
                                  st.done ? "line-through text-zinc-400" : ""
                                }
                              >
                                {st.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  <div className="border-t border-zinc-100 pt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                    <span>Ham girdi: &ldquo;{focusedNote.rawText}&rdquo;</span>
                    {focusedNote.providerUsed === "raw-only" && (
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] text-zinc-500">
                        Sadece Ham Not
                      </span>
                    )}
                  </div>
                  </div>
                )}

                {/* Nested Child Notes / Threaded Comments Section (Grouped by Heading) */}
                <section className="border-t border-zinc-200/80 pt-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-700">
                      <MessageSquare className="h-4 w-4 text-zinc-400" />
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Alt Notlar & Yorumlar
                      </h2>
                      <span className="font-mono text-[11px] text-zinc-400">
                        {focusedChildren.length}
                      </span>
                    </div>
                  </div>

                  {focusedChildren.length === 0 ? (
                    <p className="text-xs text-zinc-400">
                      Bu notun altına henüz yorum eklenmemiş. Aşağıdaki kutudan
                      yorum ekleyebilir, istersen sonradan &ldquo;Ayrı not
                      yap&rdquo; ile ana listeye çıkarabilirsin.
                    </p>
                  ) : (
                    <div className="divide-y divide-zinc-100 border-l-2 border-zinc-200 pl-3.5">
                      {focusedChildren.map((child) => {
                        const childSpace = spaceMap.get(child.spaceId);
                        const isChildTask = childSpace?.kind === "tasks";
                        const childDone = Boolean(child.metadata.isCompleted);
                        const childRaw =
                          viewMode === "raw" ||
                          Boolean(child.metadata.showRawOnly);
                        const isPromoted = Boolean(
                          child.metadata.promotedToSpace
                        );
                        const grandChildCount =
                          childCountsByNoteId[child.id] || 0;

                        return (
                          <div
                            key={child.id}
                            onClick={() => setFocusedNoteId(child.id)}
                            className="group flex cursor-pointer items-center justify-between gap-2 py-2.5 px-2 -mx-2 rounded-xl transition hover:bg-zinc-50"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                              {isChildTask ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handlePatchNote(child.id, {
                                      toggleCompleted: true,
                                    });
                                  }}
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                    childDone
                                      ? "border-emerald-600 bg-emerald-600 text-white"
                                      : "border-zinc-300 bg-white hover:border-emerald-600"
                                  }`}
                                >
                                  {childDone && <Check className="h-3 w-3" />}
                                </button>
                              ) : (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300 group-hover:bg-blue-500" />
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`truncate text-sm font-medium ${
                                      childDone
                                        ? "line-through text-zinc-400"
                                        : "text-zinc-900"
                                    }`}
                                  >
                                    {childRaw
                                      ? child.rawText
                                      : child.title || child.rawText}
                                  </span>

                                  {isPromoted && childSpace && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                      <Check className="h-2.5 w-2.5" />
                                      <span>{childSpace.name}</span>
                                    </span>
                                  )}

                                  {grandChildCount > 0 && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                                      <MessageSquare className="h-2.5 w-2.5" />
                                      {grandChildCount}
                                    </span>
                                  )}

                                  {!childRaw &&
                                    child.status === "processing" && (
                                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600" />
                                    )}
                                </div>

                                {!childRaw &&
                                  viewMode === "ai" &&
                                  child.status !== "processing" &&
                                  child.summary && (
                                    <p className="truncate text-xs text-zinc-500 mt-0.5">
                                      {renderHighlightedText(child.summary)}
                                    </p>
                                  )}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              {!isPromoted && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handlePatchNote(child.id, {
                                      togglePromotedToSpace: true,
                                    });
                                  }}
                                  className="hidden sm:inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 opacity-0 transition hover:border-blue-300 hover:text-blue-700 group-hover:opacity-100"
                                >
                                  <ArrowUpRight className="h-3 w-3" />
                                  <span>Ayrı not yap</span>
                                </button>
                              )}
                              <div className="opacity-60 group-hover:opacity-100">
                                {renderNoteActionsMenu(child)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </main>

            <div className="px-5 pb-5 pt-2 bg-gradient-to-t from-white via-white to-transparent">
              <div className="mx-auto w-full max-w-2xl">
                <CaptureBar
                  activeProjectId={activeProject.id}
                  activeProjectName={activeProject.name}
                  spaces={spaces}
                  activeSpaceId={activeSpaceTab}
                  parentNoteId={focusedNote.id}
                  parentNoteTitle={focusedNote.title || focusedNote.rawText}
                  onNoteCreated={(newNote) => {
                    setNotes((prev) => [newNote, ...prev]);
                  }}
                  onError={(msg) => setToastError(msg)}
                />
              </div>
            </div>
          </>
        ) : (
          /* Clean Sectioned List View (Tümü groups all spaces; single space uses the same clean structure) */
          <>
            <main className="flex-1 overflow-y-auto px-5 py-3">
              <div className="mx-auto w-full max-w-3xl space-y-8 pb-4">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-zinc-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : filteredNotes.length === 0 ? (
                  <div className="py-16 text-center text-sm text-zinc-400">
                    Bu başlıkta henüz not yok. Aşağıdaki kutudan ekleyebilirsiniz.
                  </div>
                ) : (
                  groupedSections.map(({ space: sp, items }) => {
                    const isTaskSpace = sp.kind === "tasks";
                    const isResourceSpace = sp.kind === "resources";

                    return (
                      <section key={sp.id} className="space-y-1">
                        {/* Clean Section Header */}
                        <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2">
                          <div className="flex items-center gap-2 text-zinc-800">
                            <span className="text-zinc-400">
                              {renderSpaceIcon(sp.kind)}
                            </span>
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                              {sp.name}
                            </h2>
                            <span className="font-mono text-[11px] text-zinc-400">
                              {items.length}
                            </span>
                          </div>
                        </div>

                        {/* Compact, High-Clarity Rows under Each Heading */}
                        <div className="divide-y divide-zinc-100">
                          {items.map((note) => {
                            const isDone = Boolean(note.metadata.isCompleted);
                            const isRaw =
                              viewMode === "raw" ||
                              Boolean(note.metadata.showRawOnly);

                            return (
                              <div
                                key={note.id}
                                onClick={() => setFocusedNoteId(note.id)}
                                className="group flex cursor-pointer items-center justify-between gap-3 py-2.5 px-2 -mx-2 rounded-xl transition hover:bg-zinc-50"
                              >
                                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                  {isTaskSpace ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handlePatchNote(note.id, {
                                          toggleCompleted: true,
                                        });
                                      }}
                                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                        isDone
                                          ? "border-emerald-600 bg-emerald-600 text-white"
                                          : "border-zinc-300 bg-white hover:border-emerald-600"
                                      }`}
                                    >
                                      {isDone && <Check className="h-3 w-3" />}
                                    </button>
                                  ) : (
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300 group-hover:bg-blue-500" />
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`truncate text-sm font-medium ${
                                          isDone
                                            ? "line-through text-zinc-400"
                                            : "text-zinc-900"
                                        }`}
                                      >
                                        {isRaw
                                          ? note.rawText
                                          : note.title || note.rawText}
                                      </span>

                                      {!isRaw &&
                                        isResourceSpace &&
                                        note.metadata.categoryTag && (
                                          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                            {note.metadata.categoryTag}
                                          </span>
                                        )}

                                      {!isRaw &&
                                        isResourceSpace &&
                                        note.metadata.officialUrl && (
                                          <a
                                            href={note.metadata.officialUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            title={note.metadata.officialUrl}
                                            className="shrink-0 text-zinc-400 hover:text-blue-600"
                                          >
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        )}

                                      {!isRaw && note.metadata.dueDate && (
                                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-amber-700">
                                          <Calendar className="h-3 w-3" />
                                          {note.metadata.dueDate}
                                        </span>
                                      )}

                                      {!isRaw &&
                                        note.metadata.subtasks &&
                                        note.metadata.subtasks.length > 0 && (
                                          <span className="shrink-0 font-mono text-[10px] text-zinc-400">
                                            {
                                              note.metadata.subtasks.filter(
                                                (s) => s.done
                                              ).length
                                            }
                                            /{note.metadata.subtasks.length}
                                          </span>
                                        )}

                                      {note.parentId &&
                                        noteMap.get(note.parentId) && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setFocusedNoteId(note.parentId);
                                            }}
                                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-200"
                                            title="Üst nota git"
                                          >
                                            <CornerDownRight className="h-2.5 w-2.5" />
                                            <span className="max-w-[110px] truncate">
                                              {noteMap.get(note.parentId)!
                                                .title ||
                                                noteMap.get(note.parentId)!
                                                  .rawText}
                                            </span>
                                          </button>
                                        )}

                                      {(childCountsByNoteId[note.id] || 0) >
                                        0 && (
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                                          <MessageSquare className="h-2.5 w-2.5" />
                                          {childCountsByNoteId[note.id]}
                                        </span>
                                      )}

                                      {!isRaw && note.status === "processing" && (
                                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600" />
                                      )}
                                    </div>

                                    {!isRaw &&
                                      viewMode === "ai" &&
                                      note.status !== "processing" &&
                                      note.summary && (
                                        <p className="truncate text-xs text-zinc-500 mt-0.5">
                                          {renderHighlightedText(note.summary)}
                                        </p>
                                      )}
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-1 opacity-60 group-hover:opacity-100">
                                  {note.suggestedSpace && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleAcceptSuggestedSpace(
                                          note.id,
                                          note.suggestedSpace!
                                        );
                                      }}
                                      className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100"
                                    >
                                      + {note.suggestedSpace}
                                    </button>
                                  )}
                                  {renderNoteActionsMenu(note)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })
                )}
              </div>
            </main>

            {/* Docked Gemini-style Center Prompt Box */}
            <div className="px-5 pb-5 pt-2 bg-gradient-to-t from-white via-white to-transparent">
              <div className="mx-auto w-full max-w-3xl">
                <CaptureBar
                  activeProjectId={activeProject.id}
                  activeProjectName={activeProject.name}
                  spaces={spaces}
                  activeSpaceId={activeSpaceTab}
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
