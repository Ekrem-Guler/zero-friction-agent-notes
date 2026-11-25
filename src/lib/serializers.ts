import type {
  AIProviderName,
  NoteInputType,
  NoteMetadata,
  NoteRow,
  NoteStatus,
  ProjectRow,
  SpaceKind,
  SpaceRow,
} from "@/db/schema";

export interface ClientProject {
  id: string;
  name: string;
  description: string;
  color: string;
  position: number;
  isDefault: boolean;
}

export interface ClientSpace {
  id: string;
  name: string;
  kind: SpaceKind;
  description: string;
  icon: string;
  position: number;
  isSystem: boolean;
}

export interface ClientNote {
  id: string;
  projectId: string;
  parentId: string | null;
  spaceId: string;
  rawText: string;
  inputType: NoteInputType;
  status: NoteStatus;
  title: string;
  summary: string;
  metadata: NoteMetadata;
  suggestedSpace: string | null;
  providerUsed: string;
  usedByok: boolean;
  costUsd: number;
  createdAt: number;
  updatedAt: number;
}

export interface ClientSettings {
  userContext: string;
  activeProvider: AIProviderName;
  preferByok: boolean;
  hasGeminiByok: boolean;
  maskedGeminiKey: string;
  hasOpenaiByok: boolean;
  maskedOpenaiKey: string;
  hasSystemKey: boolean;
  monthlySystemBudgetUsd: number;
  passwordProtectionEnabled: boolean;
}

export interface UsageStats {
  monthlySystemSpendUsd: number;
  monthlyByokSpendUsd: number;
  totalNotesCount: number;
}

export function serializeProject(row: ProjectRow): ClientProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    position: row.position,
    isDefault: row.isDefault,
  };
}

export function serializeSpace(row: SpaceRow): ClientSpace {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    description: row.description,
    icon: row.icon,
    position: row.position,
    isSystem: row.isSystem,
  };
}

export function serializeNote(row: NoteRow): ClientNote {
  let metadata: NoteMetadata = {};
  try {
    metadata = JSON.parse(row.metadataJson || "{}") as NoteMetadata;
  } catch {
    metadata = {};
  }
  return {
    id: row.id,
    projectId: row.projectId || "default",
    parentId: row.parentId ?? null,
    spaceId: row.spaceId,
    rawText: row.rawText,
    inputType: row.inputType,
    status: row.status,
    title: row.title,
    summary: row.summary,
    metadata,
    suggestedSpace: row.suggestedSpace,
    providerUsed: row.providerUsed,
    usedByok: row.usedByok,
    costUsd: row.costUsd,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
