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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/30 p-4 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl shadow-zinc-300/60">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Ajan Ayarları, Bağlam & BYOK
            </h2>
            <p className="text-xs text-zinc-500">
              Kişisel bağlamınızı ve kendi AI anahtarlarınızı yönetin
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* 1. Personal Context */}
          <section className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              <User className="h-3.5 w-3.5 text-blue-600" />
              <span>Kişisel Bağlamım (User Context)</span>
            </label>
            <p className="text-xs text-zinc-500">
              AI ajanı araştırdığı araçları ve fikirleri buradaki profilinize göre
              yorumlar.
            </p>
            <textarea
              rows={3}
              maxLength={600}
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              placeholder='Örn: "Tek kişilik Micro-SaaS ürünleri geliştiriyorum. Next.js ve TypeScript kullanıyorum. Pazarlama ve büyüme araçlarıyla ilgileniyorum."'
              className="w-full rounded-2xl border border-zinc-200 bg-[#f8f9fa] p-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </section>

          {/* 2. Provider & BYOK Keys */}
          <section className="space-y-3 rounded-2xl border border-zinc-200/80 bg-[#f8f9fa] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-700">
                <KeyRound className="h-3.5 w-3.5 text-blue-600" />
                <span>Kendi AI Anahtarını Bağla (BYOK)</span>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferByok}
                  onChange={(e) => setPreferByok(e.target.checked)}
                  className="accent-blue-600"
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
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                }`}
              >
                <div className="font-semibold">Google Gemini</div>
                <div className="text-[11px] opacity-80">
                  Web Araştırması + Ses
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveProvider("openai")}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                  activeProvider === "openai"
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
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
                <span className="text-zinc-700 font-medium">
                  Gemini API Anahtarı
                </span>
                {settings.hasGeminiByok && (
                  <span className="flex items-center gap-2 font-mono text-[11px] text-emerald-700">
                    {settings.maskedGeminiKey}
                    <button
                      type="button"
                      onClick={() => void handleSave({ clearGeminiKey: true })}
                      className="text-rose-600 hover:underline inline-flex items-center gap-0.5"
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
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* OpenAI Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-700 font-medium">
                  OpenAI API Anahtarı
                </span>
                {settings.hasOpenaiByok && (
                  <span className="flex items-center gap-2 font-mono text-[11px] text-emerald-700">
                    {settings.maskedOpenaiKey}
                    <button
                      type="button"
                      onClick={() => void handleSave({ clearOpenaiKey: true })}
                      className="text-rose-600 hover:underline inline-flex items-center gap-0.5"
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
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </section>

          {/* 3. Cost Guardrail / Circuit Breaker */}
          <section className="space-y-2.5 rounded-2xl border border-zinc-200/80 bg-[#f8f9fa] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-700">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Maliyet Sigortası & Kullanım Özeti</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Bu Ay Sistem Kotası Tüketimi</span>
                <span className="font-mono text-zinc-800">
                  ${usageStats.monthlySystemSpendUsd.toFixed(4)} / $
                  {settings.monthlySystemBudgetUsd.toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>
              <div className="flex justify-between pt-1 text-[11px] text-zinc-500">
                <span>
                  BYOK Tahmini Tüketim: $
                  {usageStats.monthlyByokSpendUsd.toFixed(4)}
                </span>
                <span>Toplam Not: {usageStats.totalNotesCount}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="text-xs text-zinc-600">
                Sistem Anahtarı Aylık Sert Tavan (USD):
              </label>
              <input
                type="number"
                step="0.5"
                min="0.1"
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                className="w-24 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-right font-mono text-xs text-zinc-900 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </section>

          {statusMsg && (
            <p className="text-xs text-emerald-700 font-medium">{statusMsg}</p>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Kapat
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
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
