import { db } from "../../../../../infrastructure/database/db";
import type { AnyDatabase } from "@atlasmed/database";
import { sql } from "drizzle-orm";
import type { FacilityLocationRepository } from "../../../application/services/facility-location.service";

/**
 * The only writer of `facilities.location` (spec 0009 R5).
 *
 * Deliberately narrow: a repository that can only read and write the position
 * is one a future caller cannot use to slip a location change past the coverage
 * check, which is how four separate writers accumulated in the first place.
 */
export class DrizzleFacilityLocationRepository implements FacilityLocationRepository {
  constructor(private readonly database: AnyDatabase = db) {}

  async findLocation(
    facilityId: number
  ): Promise<{ lat: number | null; lng: number | null } | null> {
    const rows = (await this.database.execute(sql`
      SELECT
        ST_Y(location::geometry) AS lat,
        ST_X(location::geometry) AS lng
      FROM facilities
      WHERE id = ${facilityId}
    `)) as Array<{ lat: number | null; lng: number | null }>;

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      lat: row.lat == null ? null : Number(row.lat),
      lng: row.lng == null ? null : Number(row.lng),
    };
  }

  async saveLocation(input: {
    facilityId: number;
    lat: number;
    lng: number;
  }): Promise<void> {
    await this.database.execute(sql`
      UPDATE facilities
      SET location = ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326),
          updated_at = NOW()
      WHERE id = ${input.facilityId}
    `);
  }
}
