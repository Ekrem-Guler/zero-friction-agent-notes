import type {
  AIProviderName,
  NoteInputType,
  NoteMetadata,
  NoteRow,
  NoteStatus,
  SpaceKind,
  SpaceRow,
} from "@/db/schema";

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
