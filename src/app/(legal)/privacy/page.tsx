import { LEGAL_DOCS } from "@/content/legal";
import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: LEGAL_DOCS.privacy.title };

export default function PrivacyPage() {
  return <LegalPage doc={LEGAL_DOCS.privacy} />;
}
