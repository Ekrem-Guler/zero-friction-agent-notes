"use client";

import { useState } from "react";
import { X, KeyRound, ShieldCheck, User, Save, Trash2, Loader2 } from "lucide-react";
import type { ClientSettings, UsageStats } from "@/lib/serializers";
import type { AIProviderName } from "@/db/schema";

interface SettingsModalProps {
  settings: ClientSettings;
  usageStats: UsageStats;
  onClose: () => void;
  onSaved: (updated: ClientSettings) => void;
}

export function SettingsModal({
  settings,
  usageStats,
  onClose,
  onSaved,
}: SettingsModalProps) {
  const [userContext, setUserContext] = useState(settings.userContext);
  const [activeProvider, setActiveProvider] = useState<AIProviderName>(
    settings.activeProvider
  );
  const [preferByok, setPreferByok] = useState(settings.preferByok);
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState(
    String(settings.monthlySystemBudgetUsd)
  );
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  async function handleSave(extraFlags?: {
    clearGeminiKey?: boolean;
    clearOpenaiKey?: boolean;
  }) {
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userContext,
          activeProvider,
          preferByok,
          geminiApiKey: geminiKey.trim() || undefined,
          openaiApiKey: openaiKey.trim() || undefined,
          monthlySystemBudgetUsd: Number(monthlyBudget) || 2.0,
          ...extraFlags,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        settings?: ClientSettings;
        error?: string;
      };
      if (res.ok && data.settings) {
        setGeminiKey("");
        setOpenaiKey("");
        onSaved(data.settings);
        setStatusMsg("Ayarlar kaydedildi.");
      } else {
        setStatusMsg(data.error || "Kaydedilemedi.");
      }
    } catch {
      setStatusMsg("Bağlantı hatası.");
    } finally {
      setSaving(false);
    }
  }

  const budgetPercent = Math.min(
    100,
    Math.round(
      (usageStats.monthlySystemSpendUsd /
        Math.max(0.01, settings.monthlySystemBudgetUsd)) *
        100
    )
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              Ajan Ayarları, Bağlam & BYOK
            </h2>
            <p className="text-xs text-zinc-400">
              Kişisel bağlamınızı ve kendi AI anahtarlarınızı yönetin
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {/* 1. Personal Context */}
          <section className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <User className="h-3.5 w-3.5 text-emerald-400" />
              <span>Kişisel Bağlamım (User Context)</span>
            </label>
            <p className="text-xs text-zinc-400">
              AI ajanı araştırdığı araçları ve fikirleri buradaki profilinize göre
              yorumlar.
            </p>
            <textarea
              rows={3}
              maxLength={600}
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              placeholder='Örn: "Tek kişilik Micro-SaaS ürünleri geliştiriyorum. Next.js ve TypeScript kullanıyorum. Pazarlama ve büyüme araçlarıyla ilgileniyorum."'
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none"
            />
          </section>

          {/* 2. Provider & BYOK Keys */}
          <section className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
                <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
                <span>Kendi AI Anahtarını Bağla (BYOK — Sınırsız)</span>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferByok}
                  onChange={(e) => setPreferByok(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>BYOK Öncelikli</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveProvider("gemini")}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                  activeProvider === "gemini"
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <div className="font-semibold">Google Gemini</div>
                <div className="text-[11px] opacity-80">
                  Web Araştırması + Ses (Önerilen)
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveProvider("openai")}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                  activeProvider === "openai"
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                    : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <div className="font-semibold">OpenAI</div>
                <div className="text-[11px] opacity-80">
                  GPT-4o-mini + Whisper Ses
                </div>
              </button>
            </div>

            {/* Gemini Key */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300">Gemini API Anahtarı</span>
                {settings.hasGeminiByok && (
                  <span className="flex items-center gap-2 font-mono text-[11px] text-emerald-400">
                    {settings.maskedGeminiKey}
                    <button
                      type="button"
                      onClick={() => void handleSave({ clearGeminiKey: true })}
                      className="text-rose-400 hover:underline inline-flex items-center gap-0.5"
                      title="Anahtarı Sil"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={
                  settings.hasGeminiByok
                    ? "Yeni anahtarla değiştirmek için yazın..."
                    : "AIzaSy... (AES-256 ile şifrelenerek saklanır)"
                }
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>

            {/* OpenAI Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300">OpenAI API Anahtarı</span>
                {settings.hasOpenaiByok && (
                  <span className="flex items-center gap-2 font-mono text-[11px] text-emerald-400">
                    {settings.maskedOpenaiKey}
                    <button
                      type="button"
                      onClick={() => void handleSave({ clearOpenaiKey: true })}
                      className="text-rose-400 hover:underline inline-flex items-center gap-0.5"
                      title="Anahtarı Sil"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={
                  settings.hasOpenaiByok
                    ? "Yeni anahtarla değiştirmek için yazın..."
                    : "sk-... (AES-256 ile şifrelenerek saklanır)"
                }
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
          </section>

          {/* 3. Cost Guardrail / Circuit Breaker */}
          <section className="space-y-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Maliyet Sigortası & Kullanım Özeti</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Bu Ay Sistem Kotası Tüketimi</span>
                <span className="font-mono text-zinc-200">
                  ${usageStats.monthlySystemSpendUsd.toFixed(4)} / $
                  {settings.monthlySystemBudgetUsd.toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>
              <div className="flex justify-between pt-1 text-[11px] text-zinc-500">
                <span>
                  BYOK (Kendi Anahtarın) Tahmini Tüketim: $
                  {usageStats.monthlyByokSpendUsd.toFixed(4)}
                </span>
                <span>Toplam Not: {usageStats.totalNotesCount}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="text-xs text-zinc-400">
                Sistem Anahtarı Aylık Sert Tavan (USD):
              </label>
              <input
                type="number"
                step="0.5"
                min="0.1"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                className="w-24 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-right font-mono text-xs text-zinc-100 focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
          </section>

          {statusMsg && (
            <p className="text-xs text-emerald-400">{statusMsg}</p>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-800 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Kapat
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>Kaydet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
