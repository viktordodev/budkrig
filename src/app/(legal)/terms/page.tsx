import { LEGAL_DOCS } from "@/content/legal";
import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: LEGAL_DOCS.terms.title };

export default function TermsPage() {
  return <LegalPage doc={LEGAL_DOCS.terms} />;
}
