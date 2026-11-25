"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, FolderInput, X, Loader2 } from "lucide-react";
import type { ClientProject } from "@/lib/serializers";

export type DeleteDialogState =
  | {
      kind: "note";
      noteId: string;
      title: string;
      childCount: number;
    }
  | {
      kind: "space";
      spaceId: string;
      name: string;
      noteCount: number;
    }
  | {
      kind: "project";
      projectId: string;
      name: string;
      totalNotesCount: number;
    };

interface ConfirmDialogProps {
  dialog: DeleteDialogState;
  otherProjects: ClientProject[];
  onClose: () => void;
  onConfirmNoteDelete: (noteId: string) => Promise<void>;
  onConfirmSpaceDelete: (spaceId: string) => Promise<void>;
  onConfirmProjectDelete: (
    projectId: string,
    mode: "move" | "delete_all",
    targetProjectId?: string
  ) => Promise<void>;
}

export function ConfirmDialog({
  dialog,
  otherProjects,
  onClose,
  onConfirmNoteDelete,
  onConfirmSpaceDelete,
  onConfirmProjectDelete,
}: ConfirmDialogProps) {
  const [projectMode, setProjectMode] = useState<"move" | "delete_all">(
    "move"
  );
  const [targetProjectId, setTargetProjectId] = useState<string>(
    otherProjects[0]?.id || "default"
  );
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      if (dialog.kind === "note") {
        await onConfirmNoteDelete(dialog.noteId);
      } else if (dialog.kind === "space") {
        await onConfirmSpaceDelete(dialog.spaceId);
      } else {
        const effectiveMode =
          dialog.totalNotesCount === 0 ? "delete_all" : projectMode;
        await onConfirmProjectDelete(
          dialog.projectId,
          effectiveMode,
          effectiveMode === "move" ? targetProjectId : undefined
        );
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl shadow-zinc-300/60"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900">
                {dialog.kind === "note"
                  ? "Notu Sil"
                  : dialog.kind === "space"
                    ? "Başlığı Sil"
                    : "Projeyi Sil"}
              </h3>
              <p className="text-xs text-zinc-500">
                Bu işlem geri alınamaz.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm text-zinc-700">
          {dialog.kind === "note" && (
            <>
              <p>
                <strong className="text-zinc-900">
                  &ldquo;{dialog.title}&rdquo;
                </strong>{" "}
                notunu silmek istediğinize emin misiniz?
              </p>
              {dialog.childCount > 0 && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Bu notun altında <strong>{dialog.childCount}</strong> yorum/alt
                  not bulunuyor. Üst not silindiğinde alt yorumlar silinmez,
                  bağımsız olarak korunur.
                </p>
              )}
            </>
          )}

          {dialog.kind === "space" && (
            <p>
              <strong className="text-zinc-900">
                &ldquo;{dialog.name}&rdquo;
              </strong>{" "}
              başlığını silmek istediğinize emin misiniz?
              {dialog.noteCount > 0 && (
                <span className="block mt-1.5 text-xs text-zinc-500">
                  İçindeki {dialog.noteCount} not silinmez,{" "}
                  <strong>Fikirler</strong> başlığına aktarılır.
                </span>
              )}
            </p>
          )}

          {dialog.kind === "project" && (
            <>
              <p>
                <strong className="text-zinc-900">
                  &ldquo;{dialog.name}&rdquo;
                </strong>{" "}
                projesini silmek üzeresiniz.
              </p>

              {dialog.totalNotesCount > 0 ? (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-zinc-500">
                    Bu projenin içinde{" "}
                    <strong className="text-zinc-800">
                      {dialog.totalNotesCount} not/yorum
                    </strong>{" "}
                    var. Ne yapmak istersiniz?
                  </p>

                  {/* Option 1: Move notes to another project */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                      projectMode === "move"
                        ? "border-blue-500 bg-blue-50/50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="projectDeleteMode"
                      checked={projectMode === "move"}
                      onChange={() => setProjectMode("move")}
                      className="mt-1 accent-blue-600"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900">
                        <FolderInput className="h-3.5 w-3.5 text-blue-600" />
                        <span>Notları başka projeye taşı ve sil</span>
                      </div>
                      {projectMode === "move" && otherProjects.length > 0 && (
                        <select
                          value={targetProjectId}
                          onChange={(e) => setTargetProjectId(e.target.value)}
                          className="w-full rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-blue-500 focus:outline-none"
                        >
                          {otherProjects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </label>

                  {/* Option 2: Permanently delete all notes in this project */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                      projectMode === "delete_all"
                        ? "border-rose-500 bg-rose-50/60"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="projectDeleteMode"
                      checked={projectMode === "delete_all"}
                      onChange={() => setProjectMode("delete_all")}
                      className="mt-1 accent-rose-600"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Projedeki tüm notları da kalıcı olarak sil</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        Bu projeye ait tüm notlar ve yorumlar tamamen silinir.
                      </p>
                    </div>
                  </label>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  Bu projede hiç not yok. Doğrudan silinecek.
                </p>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleConfirm()}
            className="flex items-center gap-1.5 rounded-full bg-rose-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            <span>
              {dialog.kind === "project" &&
              dialog.totalNotesCount > 0 &&
              projectMode === "move"
                ? "Taşı ve Sil"
                : "Evet, Sil"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
