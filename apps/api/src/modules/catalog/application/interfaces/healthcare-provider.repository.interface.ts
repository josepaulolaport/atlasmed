export type HealthcareProviderType = "PRIVATE" | "PUBLIC" | "MIXED" | "OTHER";

export interface HealthcareProviderRecord {
  id: string;
  name: string;
  type: HealthcareProviderType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthcareProviderRepository {
  findAll(params: {
    page: number;
    limit: number;
    isActive?: boolean;
  }): Promise<{ providers: HealthcareProviderRecord[]; total: number }>;

  findById(id: string): Promise<HealthcareProviderRecord | null>;

  create(data: {
    name: string;
    type: HealthcareProviderType;
    isActive?: boolean;
  }): Promise<HealthcareProviderRecord>;

  update(
    id: string,
    data: { name?: string; type?: HealthcareProviderType; isActive?: boolean }
  ): Promise<HealthcareProviderRecord>;
}
