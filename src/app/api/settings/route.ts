import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { ensureDbReady } from "@/db";
import { appSettings, type AILanguageMode, type AIProviderName } from "@/db/schema";
import { isAuthenticated, isPasswordProtectionEnabled } from "@/lib/auth";
import { decryptSecret, encryptSecret, maskApiKey } from "@/lib/crypto";
import type { ClientSettings } from "@/lib/serializers";

export async function PUT(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    userContext?: string;
    activeProvider?: AIProviderName;
    aiLanguage?: AILanguageMode;
    preferByok?: boolean;
    geminiApiKey?: string;
    clearGeminiKey?: boolean;
    openaiApiKey?: string;
    clearOpenaiKey?: boolean;
    hfApiKey?: string;
    clearHfKey?: boolean;
    hfModel?: string;
    monthlySystemBudgetUsd?: number;
  };

  const db = await ensureDbReady();
  const existingRows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, "owner"));
  const current = existingRows[0];

  let nextEncryptedGemini = current?.encryptedGeminiKey || "";
  if (body.clearGeminiKey) {
    nextEncryptedGemini = "";
  } else if (body.geminiApiKey && body.geminiApiKey.trim().length > 0) {
    nextEncryptedGemini = encryptSecret(body.geminiApiKey.trim());
  }

  let nextEncryptedOpenai = current?.encryptedOpenaiKey || "";
  if (body.clearOpenaiKey) {
    nextEncryptedOpenai = "";
  } else if (body.openaiApiKey && body.openaiApiKey.trim().length > 0) {
    nextEncryptedOpenai = encryptSecret(body.openaiApiKey.trim());
  }

  let nextEncryptedHf = current?.encryptedHfKey || "";
  if (body.clearHfKey) {
    nextEncryptedHf = "";
  } else if (body.hfApiKey && body.hfApiKey.trim().length > 0) {
    nextEncryptedHf = encryptSecret(body.hfApiKey.trim());
  }

  const nextHfModel =
    typeof body.hfModel === "string" && body.hfModel.trim().length > 0
      ? body.hfModel.trim().slice(0, 100)
      : (current?.hfModel || "Qwen/Qwen2.5-7B-Instruct");

  const nextProvider: AIProviderName =
    body.activeProvider === "openai" ||
    body.activeProvider === "gemini" ||
    body.activeProvider === "huggingface"
      ? body.activeProvider
      : (current?.activeProvider ?? "gemini");

  const nextLanguage: AILanguageMode =
    body.aiLanguage === "tr" ||
    body.aiLanguage === "en" ||
    body.aiLanguage === "auto"
      ? body.aiLanguage
      : (current?.aiLanguage ?? "auto");

  const nextBudget =
    typeof body.monthlySystemBudgetUsd === "number" &&
    Number.isFinite(body.monthlySystemBudgetUsd) &&
    body.monthlySystemBudgetUsd >= 0.1
      ? Number(body.monthlySystemBudgetUsd.toFixed(2))
      : (current?.monthlySystemBudgetUsd ?? 2.0);

  const nextContext =
    typeof body.userContext === "string"
      ? body.userContext.slice(0, 600)
      : (current?.userContext ?? "");

  const nextPreferByok =
    typeof body.preferByok === "boolean"
      ? body.preferByok
      : (current?.preferByok ?? true);

  await db
    .update(appSettings)
    .set({
      userContext: nextContext,
      activeProvider: nextProvider,
      aiLanguage: nextLanguage,
      preferByok: nextPreferByok,
      encryptedGeminiKey: nextEncryptedGemini,
      encryptedOpenaiKey: nextEncryptedOpenai,
      encryptedHfKey: nextEncryptedHf,
      hfModel: nextHfModel,
      monthlySystemBudgetUsd: nextBudget,
      updatedAt: Date.now(),
    })
    .where(eq(appSettings.id, "owner"));

  const rawGemini = decryptSecret(nextEncryptedGemini);
  const rawOpenai = decryptSecret(nextEncryptedOpenai);
  const rawHf = decryptSecret(nextEncryptedHf);
  const hasSystemKey = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.HF_TOKEN?.trim() ||
      process.env.HUGGINGFACE_API_KEY?.trim()
  );

  const settings: ClientSettings = {
    userContext: nextContext,
    activeProvider: nextProvider,
    aiLanguage: nextLanguage,
    preferByok: nextPreferByok,
    hasGeminiByok: Boolean(rawGemini),
    maskedGeminiKey: maskApiKey(rawGemini),
    hasOpenaiByok: Boolean(rawOpenai),
    maskedOpenaiKey: maskApiKey(rawOpenai),
    hasHfByok: Boolean(rawHf),
    maskedHfKey: maskApiKey(rawHf),
    hfModel: nextHfModel,
    hasSystemKey,
    monthlySystemBudgetUsd: nextBudget,
    passwordProtectionEnabled: isPasswordProtectionEnabled(),
  };

  return NextResponse.json({ settings });
}
