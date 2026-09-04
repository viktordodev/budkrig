import { LEGAL_DOCS } from "@/content/legal";
import type { Metadata } from "next";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: LEGAL_DOCS.foretagsinformation.title };

export default function ForetagsinformationPage() {
  return <LegalPage doc={LEGAL_DOCS.foretagsinformation} />;
}
