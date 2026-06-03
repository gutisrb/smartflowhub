import type { OnboardingCopy } from "./types"

const GENERIC = "Ovde upravljate ovim delom Vašeg sistema."

export const DEFAULT_MODULE_COPY: Record<string, string> = {
  "social-chatbot": "Sve poruke sa Instagrama, Facebooka i sajta na jednom mestu — agent odgovara, a Vi uskačete kada treba.",
  "chatter-assistant": "Sve poruke sa Instagrama, Facebooka i sajta na jednom mestu — agent odgovara, a Vi uskačete kada treba.",
  "website-chatbot": "Četbot na Vašem sajtu — hvata posetioce i pretvara ih u kontakte.",
  "agent-leads": "Ovde se sami beleže svi zainteresovani — ime, kontakt, šta su tražili i u kojoj su fazi.",
  "business-crm": "Ovde se sami beleže svi zainteresovani — ime, kontakt, šta su tražili i u kojoj su fazi.",
  "crm-kanban-board": "Vaši kontakti na kanban tabli — povucite ih kroz faze.",
  "multi-tenant-crm": "Pregled kontakata po brendovima.",
  "agent-database": "Vaš katalog — agent odavde vuče tačne podatke i cene kada kupac pita.",
  "calendar": "Termini koje agent zakazuje, pregledno po danima.",
  "chatbot-analytics": "Šta kupci najviše pitaju, šta konvertuje i gde odustaju.",
  "analytics": "Šta kupci najviše pitaju, šta konvertuje i gde odustaju.",
  "email-outreach": "Vaši kontakti, poslate poruke i odgovori — sve na jednom mestu.",
  "pipeline": "Pregled svih prilika kroz faze — od prvog kontakta do zaključenja.",
  "growth-engine": "Centralni pregled svih kontakata i njihovog napretka.",
  "social-jobs": "Vaši oglasi za posao na jednom mestu.",
  "social-candidates": "Kandidati koji su se prijavili — pregledno i organizovano.",
  "settings": "Brendovi, obaveštenja i podešavanja naloga.",
}

export function resolveModuleCopy(stored: OnboardingCopy | null, moduleKey: string): string {
  return stored?.modules?.[moduleKey] ?? DEFAULT_MODULE_COPY[moduleKey] ?? GENERIC
}
