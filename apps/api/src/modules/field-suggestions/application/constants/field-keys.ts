import type { FacilityRecord } from "../../../facility/application/interfaces/facility.repository.interface";

export const FIELD_SUGGESTION_FIELD_KEYS = [
  "displayName",
  "phoneNumber",
  "whatsappNumber",
  "email",
  "websiteUrl",
  "responsibleName",
  "openingHours",
  "taxIdType",
  "cnpj",
  "cpf",
  "address",
] as const;

export type FieldSuggestionFieldKey = (typeof FIELD_SUGGESTION_FIELD_KEYS)[number];

export const FIELD_KEY_LABELS_PT: Record<FieldSuggestionFieldKey, string> = {
  displayName: "Nome",
  phoneNumber: "Telefone",
  whatsappNumber: "WhatsApp",
  email: "E-mail",
  websiteUrl: "Site",
  responsibleName: "Responsável",
  openingHours: "Horário de funcionamento",
  taxIdType: "Tipo de documento",
  cnpj: "CNPJ",
  cpf: "CPF",
  address: "Endereço",
};

export function isFieldSuggestionFieldKey(
  value: string
): value is FieldSuggestionFieldKey {
  return (FIELD_SUGGESTION_FIELD_KEYS as readonly string[]).includes(value);
}

export function snapshotCurrentValue(
  facility: FacilityRecord,
  fieldKey: FieldSuggestionFieldKey
): unknown {
  switch (fieldKey) {
    case "displayName":
      return facility.name;
    case "phoneNumber":
      return facility.phone;
    case "whatsappNumber":
      return facility.whatsapp;
    case "email":
      return facility.email;
    case "websiteUrl":
      return facility.website;
    case "responsibleName":
      return facility.responsibleName;
    case "openingHours":
      return facility.openingHours;
    case "taxIdType":
      return facility.taxIdType;
    case "cnpj":
      return facility.cnpj;
    case "cpf":
      return facility.cpf;
    case "address":
      return {
        neighborhood: facility.neighborhood,
        streetAddress: facility.streetAddress,
        streetNumber: facility.streetNumber,
        addressComplement: facility.addressComplement,
        city: facility.city,
        state: facility.state,
        postalCode: facility.postalCode,
      };
  }
}
