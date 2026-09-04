import type { LegalDoc } from "@/content/legal";

/** Shared shell for the legal pages — draft banner, date, prose. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 rounded border border-amber-400/50 bg-amber-400/10 p-3 text-sm text-amber-800 dark:text-amber-300">
        Utkast — inte granskat av jurist. Se{" "}
        <code className="text-xs">docs/compliance/launch-gate.md</code>.
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="mt-1 text-xs text-[var(--muted)]">Uppdaterad {doc.updated}</p>
      <p className="mt-4 text-sm text-[var(--muted)]">{doc.intro}</p>

      <div className="mt-8 flex flex-col gap-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-semibold">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-2 text-sm leading-relaxed text-[var(--fg)]">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
