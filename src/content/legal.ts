/**
 * Legal page copy — Swedish, structured so a lawyer's edits are a one-file diff.
 *
 * ⚠️ DRAFT. Not reviewed by a lawyer. Every page renders a banner saying so.
 * The gambling-law assessment, the withdrawal-waiver wording, the third-party
 * brand policy and GDPR retention all block launch — see
 * docs/compliance/launch-gate.md and ADR-0015.
 *
 * The `[[company:*]]` and `[[legal:*]]` placeholders are filled once the
 * company + counsel are engaged.
 */
export interface LegalSection {
  readonly heading: string;
  readonly body: readonly string[];
}

export interface LegalDoc {
  readonly slug: "terms" | "privacy" | "foretagsinformation";
  readonly title: string;
  readonly updated: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
}

export const COMPANY = {
  legalName: "[[company:legal name — AB / enskild firma]]",
  orgNumber: "[[company:org.nr]]",
  vatNumber: "[[company:VAT nr — SE############01]]",
  address: "[[company:geografisk adress]]",
  email: "hej@budkrig.se",
} as const;

export const LEGAL_DOCS: Record<LegalDoc["slug"], LegalDoc> = {
  foretagsinformation: {
    slug: "foretagsinformation",
    title: "Företagsinformation",
    updated: "2026-09-04",
    intro:
      "Informationskrav enligt lagen om elektronisk handel och distansavtalslagen. Budkrig drivs av nedanstående företag.",
    sections: [
      {
        heading: "Tjänsteleverantör",
        body: [
          `Företag: ${COMPANY.legalName}`,
          `Organisationsnummer: ${COMPANY.orgNumber}`,
          `Momsregistreringsnummer: ${COMPANY.vatNumber}`,
          `Adress: ${COMPANY.address}`,
          `E-post: ${COMPANY.email}`,
        ],
      },
      {
        heading: "Vad Budkrig är",
        body: [
          "Budkrig är en betald annonsplacering. Du betalar för att din länk ska visas på en offentlig topplista, sorterad efter det sammanlagda belopp du betalat. Placeringen levereras omedelbart.",
          "Budkrig är inte ett spel om pengar, ett lotteri eller en investering. Beloppet du betalar är ersättning för en annonstjänst.",
        ],
      },
      {
        heading: "Tvistlösning",
        body: [
          "Konsumenter kan vända sig till Allmänna reklamationsnämnden (arn.se) eller EU:s onlineplattform för tvistlösning (ec.europa.eu/consumers/odr).",
        ],
      },
    ],
  },

  terms: {
    slug: "terms",
    title: "Användarvillkor",
    updated: "2026-09-04",
    intro:
      "Dessa villkor gäller mellan dig och företaget bakom Budkrig (se Företagsinformation). Genom att lägga en listning godkänner du villkoren.",
    sections: [
      {
        heading: "1. Tjänsten",
        body: [
          "Budkrig visar en offentlig topplista över länkar (webbadresser eller @-konton). Rangordningen bestäms uteslutande av det sammanlagda belopp en listning har betalat. Ju mer du betalar, desto högre placering.",
          "Att lägga en ny listning kostar minst det belopp som anges vid betalningen. För att flytta upp en befintlig listning betalar du skillnaden upp till det nya beloppet, och minst ett minsta höjningsbelopp över placeringen ovanför.",
        ],
      },
      {
        heading: "2. Betalning och att beloppet inte återbetalas",
        body: [
          "Betalning sker via Stripe. Priset som visas inkluderar moms där moms tas ut.",
          "Betalningen återbetalas inte. Tidigare betalningar tillgodoräknas listningen och nollställs inte om någon annan betalar mer. En listning upphör inte automatiskt.",
          "[[legal:granska formuleringen om icke-återbetalning mot 36 § avtalslagen och 11 kap. distansavtalslagen — ADR-0015]]",
        ],
      },
      {
        heading: "3. Ångerrätt",
        body: [
          "Tjänsten är en digital tjänst som börjar utföras omedelbart. Vid köpet samtycker du uttryckligen till att utförandet påbörjas direkt och bekräftar att du därmed förlorar din ångerrätt enligt 2 kap. 11 § och 2 kap. 12 § distansavtalslagen (2005:59).",
          "[[legal:slutlig formulering och bekräftelseflöde ska godkännas av jurist — ADR-0007 / ADR-0015]]",
        ],
      },
      {
        heading: "4. Ditt innehåll",
        body: [
          "Du ansvarar för att den länk, rubrik och beskrivning du anger är korrekt, laglig och inte gör intrång i någon annans rättigheter.",
          "Du får inte lägga upp länkar till olagligt innehåll, skadlig kod, bedrägerier eller innehåll som strider mot svensk lag eller god sed.",
          "Vi granskar listningar i efterhand och kan dölja eller ta bort en listning som bryter mot villkoren eller lagen. Beloppet återbetalas inte vid borttagning på grund av regelbrott.",
          "[[legal:policy för att lista tredje parts varumärke/domän — verifiering eller anmäl-och-ta-bort — Öppen fråga Q4]]",
        ],
      },
      {
        heading: "5. Utgående länkar",
        body: [
          "Klick på en listning leder till den angivna adressen. Budkrig kontrollerar inte och ansvarar inte för innehållet på länkade webbplatser. En listning innebär inte att företaget bakom Budkrig rekommenderar eller är anslutet till den länkade webbplatsen.",
        ],
      },
      {
        heading: "6. Ansvarsbegränsning",
        body: [
          "Tjänsten tillhandahålls i befintligt skick. Vi ansvarar inte för indirekt skada eller utebliven vinst. Inget i villkoren begränsar ansvar som inte kan begränsas enligt tvingande lag.",
        ],
      },
      {
        heading: "7. Ändringar och tillämplig lag",
        body: [
          "Vi kan ändra dessa villkor. Väsentliga ändringar meddelas på webbplatsen.",
          "Svensk lag tillämpas. Tvist prövas av svensk domstol, med Stockholms tingsrätt som första instans, om inte annat följer av tvingande konsumentskyddsregler.",
        ],
      },
    ],
  },

  privacy: {
    slug: "privacy",
    title: "Integritetspolicy",
    updated: "2026-09-04",
    intro:
      "Denna policy beskriver hur företaget bakom Budkrig behandlar personuppgifter enligt dataskyddsförordningen (GDPR).",
    sections: [
      {
        heading: "Personuppgiftsansvarig",
        body: [`${COMPANY.legalName}, ${COMPANY.orgNumber}. Kontakt: ${COMPANY.email}.`],
      },
      {
        heading: "Vilka uppgifter vi behandlar",
        body: [
          "E-postadress: den du anger vid köp. Används för kvitto, faktura, en länk för att hantera din listning och eventuell viktig information om din listning.",
          "Betalningsuppgifter: hanteras av Stripe. Vi lagrar en referens till betalningen, belopp, betalningsmetod och momsuppgifter — aldrig kortnummer.",
          "IP-adress: lagras endast som en saltad hash, för att begränsa missbruk. Kan inte kopplas tillbaka till en fysisk IP-adress.",
          "Samtycke: vi lagrar att du godkänt villkoren och avstått ångerrätten, med tidpunkt och version.",
        ],
      },
      {
        heading: "Rättslig grund",
        body: [
          "Fullgörande av avtal (leverans av annonstjänsten, kvitto, faktura).",
          "Rättslig förpliktelse (bokföring, moms — faktureringsunderlag sparas i sju år enligt bokföringslagen).",
          "Berättigat intresse (missbruksskydd via IP-hash, säkerhet).",
        ],
      },
      {
        heading: "Lagringstid",
        body: [
          "Faktureringsunderlag: sju år (bokföringslagen).",
          "E-postadress kopplad till en borttagen listning: raderas efter [[legal:antal]] månader om det inte finns en pågående tvist.",
          "Klickhändelser: aggregeras och raderas efter 30 dagar.",
        ],
      },
      {
        heading: "Mottagare (personuppgiftsbiträden)",
        body: [
          "Stripe (betalning, moms), vår e-postleverantör, vår drift- och lagringsleverantör, och en tjänst för URL-säkerhetskontroll. Samtliga inom EU/EES eller under ett giltigt dataskyddsavtal.",
          "[[legal:lista faktiska biträden och bekräfta personuppgiftsbiträdesavtal — ADR-0013 / ADR-0015]]",
        ],
      },
      {
        heading: "Dina rättigheter",
        body: [
          `Du har rätt till tillgång, rättelse, radering, begränsning och dataportabilitet, samt att invända mot behandling. Kontakta oss på ${COMPANY.email}.`,
          "Du kan klaga hos Integritetsskyddsmyndigheten (imy.se).",
        ],
      },
      {
        heading: "Cookies",
        body: [
          "Budkrig använder ingen spårning för marknadsföring och ingen cookie-baserad analys. En teknisk inställning (valt språk) kan sparas lokalt i din webbläsare.",
        ],
      },
    ],
  },
};
