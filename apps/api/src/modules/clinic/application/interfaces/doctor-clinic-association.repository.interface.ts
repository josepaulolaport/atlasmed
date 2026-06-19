export interface DoctorClinicAssociationRecord {
  id: string;
  doctorId: string;
  clinicId: string;
  sourceActive: boolean;
  sourceFirstSeenAt: Date | null;
  sourceLastSeenAt: Date | null;
  confirmedAt: Date | null;
  confirmedByUserId: string | null;
  endedAt: Date | null;
  endedByUserId: string | null;
  endReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DoctorClinicAssociationWithDoctorRecord
  extends DoctorClinicAssociationRecord {
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
    specialty: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}

export type DoctorClinicView = "source" | "confirmed" | "pending" | "all";

export interface DoctorClinicAssociationRepository {
  findByDoctorAndClinic(
    doctorId: string,
    clinicId: string
  ): Promise<DoctorClinicAssociationRecord | null>;

  findActiveByClinicWithDoctors(params: {
    clinicId: string;
    view: DoctorClinicView;
    page: number;
    limit: number;
    search?: string;
  }): Promise<{
    associations: DoctorClinicAssociationWithDoctorRecord[];
    total: number;
  }>;

  findActiveSourceAssociationsByProvider(sourceProvider: string): Promise<
    Array<{
      association: DoctorClinicAssociationRecord;
      doctorExternalSourceId: string;
      clinicExternalSourceId: string;
    }>
  >;

  confirmAssociation(params: {
    doctorId: string;
    clinicId: string;
    confirmedByUserId: string;
  }): Promise<DoctorClinicAssociationRecord>;

  manuallyAssociate(params: {
    doctorId: string;
    clinicId: string;
    confirmedByUserId: string;
  }): Promise<DoctorClinicAssociationRecord>;

  endAssociation(params: {
    doctorId: string;
    clinicId: string;
    endedByUserId: string;
    endReason: string;
  }): Promise<DoctorClinicAssociationRecord | null>;

  upsertSourceAssociation(params: {
    doctorId: string;
    clinicId: string;
    sourceLastSeenAt: Date;
  }): Promise<{ association: DoctorClinicAssociationRecord; created: boolean }>;

  markSourceInactive(params: {
    associationId: string;
    sourceLastSeenAt: Date;
  }): Promise<DoctorClinicAssociationRecord>;

  restoreSourceActive(associationId: string): Promise<DoctorClinicAssociationRecord>;

  endAssociationById(params: {
    associationId: string;
    endedByUserId: string;
    endReason: string;
  }): Promise<DoctorClinicAssociationRecord>;

  createConfirmedAssociations(params: {
    doctorId: string;
    clinicIds: string[];
    confirmedByUserId?: string;
  }): Promise<void>;
}
