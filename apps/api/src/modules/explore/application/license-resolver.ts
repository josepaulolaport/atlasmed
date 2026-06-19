const COUNCIL_ACRONYMS: Record<string, string> = {
  "15": "CRBM",
  "17": "CRFa",
  "18": "CRBio",
  "19": "CREF",
  "66": "COREN",
  "69": "CRF",
  "70": "CREFITO",
  "71": "CRM",
  "72": "CRMV",
  "74": "CRN",
  "75": "CRO",
  "77": "CRP",
  "78": "CRQ",
};

function cleanLicenseNumber(value: string): string {
  return value.replace(/^['"]+|['"]+$/g, "").trim();
}

function formatLicenseNumber(value: string): string {
  const cleaned = cleanLicenseNumber(value);
  if (/^\d+[A-Za-z]$/.test(cleaned)) {
    return `${cleaned.slice(0, -1)}-${cleaned.slice(-1).toUpperCase()}`;
  }
  return cleaned;
}

function councilNameToAcronym(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("medicina") && !normalized.includes("veterinaria")) {
    return "CRM";
  }
  if (normalized.includes("fisioterapia") || normalized.includes("terapia ocup")) {
    return "CREFITO";
  }
  if (normalized.includes("enfermagem")) return "COREN";
  if (normalized.includes("odontologia")) return "CRO";
  if (normalized.includes("psicologia")) return "CRP";
  if (normalized.includes("nutricao")) return "CRN";
  if (normalized.includes("farmacia")) return "CRF";
  if (normalized.includes("fonoaudiologia")) return "CRFa";
  if (normalized.includes("biomedicina")) return "CRBM";
  if (normalized.includes("educacao fisica")) return "CREF";

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function resolveCouncilAcronym(
  councilCode: string | null | undefined,
  councilName: string | null | undefined,
): string | null {
  if (councilCode) {
    const acronym = COUNCIL_ACRONYMS[councilCode.trim()];
    if (acronym) return acronym;
  }

  if (councilName && !councilName.toLowerCase().includes("não encontrado")) {
    return councilNameToAcronym(councilName);
  }

  return councilCode?.trim() ?? null;
}

export interface LicenseParts {
  councilCode?: string | null;
  councilName?: string | null;
  licenseState?: string | null;
  licenseNumber?: string | null;
}

export function formatLicenseLabel(parts: LicenseParts): string | null {
  const licenseNumber = parts.licenseNumber
    ? cleanLicenseNumber(String(parts.licenseNumber))
    : null;
  if (!licenseNumber) return null;

  const acronym = resolveCouncilAcronym(parts.councilCode, parts.councilName);
  const state = parts.licenseState?.trim();
  const prefix =
    acronym && state ? `${acronym}-${state}` : acronym ?? "Registro";

  return `${prefix} ${formatLicenseNumber(licenseNumber)}`;
}

interface LicenseEntry {
  councilCode?: string | null;
  councilName?: string | null;
  licenseState?: string | null;
  licenseNumber?: string | null;
}

export function formatLicenseEntries(entries: LicenseEntry[]): string | null {
  const byKey = new Map<string, LicenseEntry>();

  for (const entry of entries) {
    const licenseNumber = entry.licenseNumber
      ? cleanLicenseNumber(String(entry.licenseNumber))
      : null;
    if (!licenseNumber) continue;

    const key = `${entry.councilCode ?? ""}:${licenseNumber}`;
    const existing = byKey.get(key);
    if (!existing || (!existing.licenseState && entry.licenseState)) {
      byKey.set(key, { ...entry, licenseNumber });
    }
  }

  const labels = [...byKey.values()]
    .map((entry) => formatLicenseLabel(entry))
    .filter((label): label is string => Boolean(label));

  if (labels.length === 0) return null;

  return [...new Set(labels)].join(", ");
}
