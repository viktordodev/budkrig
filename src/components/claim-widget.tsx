"use client";

import { formatKr, ore } from "@/lib/money";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClaimWidget({
  minAmountKr,
  stepKr,
  categories,
}: {
  minAmountKr: number;
  stepKr: number;
  categories: ReadonlyArray<{ slug: string; nameSv: string }>;
}) {
  const t = useTranslations("board");
  const router = useRouter();
  const [amountKr, setAmountKr] = useState(minAmountKr);
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ amountKr: String(amountKr) });
    if (target.trim()) params.set("target", target.trim());
    if (category) params.set("category", category);
    router.push(`/claim?${params.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex max-w-2xl flex-col items-center gap-5 py-10 text-center"
    >
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("heroTitle")}</h1>

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="-"
          onClick={() => setAmountKr((v) => Math.max(minAmountKr, v - stepKr))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-lg leading-none transition-colors hover:border-[var(--accent-soft-border)]"
        >
          −
        </button>
        <span className="min-w-[10ch] text-4xl font-bold tabular-nums text-[var(--accent)] sm:text-5xl">
          {formatKr(ore(amountKr * 100))}
        </span>
        <button
          type="button"
          aria-label="+"
          onClick={() => setAmountKr((v) => v + stepKr)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-lg leading-none transition-colors hover:border-[var(--accent-soft-border)]"
        >
          +
        </button>
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={t("heroUrlPlaceholder")}
          className="flex-1 rounded border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--muted)]"
        >
          <option value="">{t("heroCategoryPlaceholder")}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.nameSv}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="shrink-0 rounded bg-[var(--accent)] px-5 py-2 text-sm font-medium text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          {t("heroCta")}
        </button>
      </div>
    </form>
  );
}
