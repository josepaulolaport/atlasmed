import type { FacilityRecord } from "../../../facility/application/interfaces/facility.repository.interface";

export const FIELD_SUGGESTION_FIELD_KEYS = [
  "displayName",
  "phoneNumber",
  "whatsappNumber",
  "email",
  "websiteUrl",
  "responsibleName",
  "openingHours",
  "legalDocumentType",
  "legalDocument",
  "address",
  /**
   * Spec 0009 R5 / decision 4: a pin move is a suggestion like any other edit,
   * and the single edit most able to destroy a rep assertion — it can shift a
   * clinic out of the patch its rep holds. It is never applied without review.
   */
  "coordinates",
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
  legalDocumentType: "Tipo de documento",
  legalDocument: "Documento legal",
  address: "Endereço",
  coordinates: "Localização no mapa",
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
    case "legalDocumentType":
      return facility.legalDocumentType;
    case "legalDocument":
      return facility.legalDocument;
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
    case "coordinates":
      return { lat: facility.lat, lng: facility.lng };
  }
}
