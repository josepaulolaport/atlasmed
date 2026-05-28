export interface Clinic {
  id: string;
  name: string;
  address?: string;
  territoryId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialty?: string;
  clinicIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateClinicRequest {
  name: string;
  address?: string;
  territoryId?: string;
}

export interface UpdateClinicRequest {
  name?: string;
  address?: string | null;
  territoryId?: string | null;
}

export interface CreateDoctorRequest {
  firstName: string;
  lastName: string;
  specialty?: string;
  clinicIds: string[];
}

export interface UpdateDoctorRequest {
  firstName?: string;
  lastName?: string;
  specialty?: string | null;
  clinicIds?: string[];
}
