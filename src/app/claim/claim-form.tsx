"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { type ClaimState, submitClaim } from "./actions";

const initial: ClaimState = { status: "idle" };

export function ClaimForm({
  categories,
  defaultCategory,
  defaultAmountKr,
  defaultTarget,
}: {
  categories: ReadonlyArray<{ slug: string; nameSv: string }>;
  defaultCategory?: string | undefined;
  defaultAmountKr?: string | undefined;
  defaultTarget?: string | undefined;
}) {
  const t = useTranslations("claim");
  const [state, action, pending] = useActionState(submitClaim, initial);
  const errs = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("target.label")}</span>
        <input
          name="target"
          required
          defaultValue={defaultTarget}
          placeholder={t("target.placeholder")}
          aria-invalid={Boolean(errs.target)}
          className="rounded border border-[var(--border)] bg-transparent px-3 py-2"
        />
        <span className="text-xs text-[var(--muted)]">{t("target.hint")}</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("category")}</span>
        <select
          name="category"
          required
          defaultValue={defaultCategory ?? ""}
          className="rounded border border-[var(--border)] bg-transparent px-3 py-2"
        >
          <option value="">—</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.nameSv}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("title")}</span>
        <input
          name="title"
          required
          maxLength={120}
          className="rounded border border-[var(--border)] bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t("description")}</span>
        <textarea
          name="description"
          required
          maxLength={280}
          rows={3}
          className="rounded border border-[var(--border)] bg-transparent px-3 py-2"
        />
      </label>

      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium">{t("amount")}</span>
          <input
            name="amountKr"
            type="number"
            min={1}
            step={1}
            required
            defaultValue={defaultAmountKr}
            aria-invalid={Boolean(errs.amountKr)}
            className="rounded border border-[var(--border)] bg-transparent px-3 py-2 tabular-nums"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-medium">{t("email")}</span>
          <input
            name="email"
            type="email"
            required
            className="rounded border border-[var(--border)] bg-transparent px-3 py-2"
          />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          name="consent"
          type="checkbox"
          value="on"
          className="mt-1"
          aria-invalid={Boolean(errs.consent)}
        />
        <span>
          {t.rich("consent", {
            terms: (chunks) => (
              <a href="/terms" target="_blank" className="underline" rel="noreferrer">
                {chunks}
              </a>
            ),
            privacy: (chunks) => (
              <a href="/privacy" target="_blank" className="underline" rel="noreferrer">
                {chunks}
              </a>
            ),
          })}
        </span>
      </label>

      <input type="hidden" name="locale" value="sv" />

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
