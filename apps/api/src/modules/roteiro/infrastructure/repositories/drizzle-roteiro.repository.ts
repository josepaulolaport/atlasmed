import { sql } from "drizzle-orm";
import { db } from "../../../../infrastructure/database/db";
import type {
  CreateRoteiroInput,
  RoteiroCandidate,
  RoteiroPoint,
  RoteiroParams,
  RoteiroRepository,
  ScoreCandidatesInput,
  StoredRoteiro,
  StoredRoteiroStop,
} from "../../application/interfaces/roteiro.repository.interface";

/**
 * CBO for *MEDICO ORTOPEDISTA E TRAUMATOLOGISTA* in `registry.occupations`.
 *
 * A single exact code, not a prefix. The neighbouring `2232xx` codes are
 * dentists and `3225xx`/`3226xx` are technicians — counting by prefix would
 * fold all three into one number. Measured on the production clone: clinics
 * with ≥5 of these convert at 21–26 %, those with ≤4 at 3.6–4.8 %
 * (spec 0016 §4.9).
 */
const ORTHOPAEDIST_CBO = "225270";

/** Metres per kilometre — the geography casts below work in metres. */
const M_PER_KM = 1000;

/**
 * How many coverage-overdue clinics ride along with the merit shortlist,
 * regardless of their score. Only one can win the reserved slot, but the
 * selector needs a few to choose from once buckets and duplicates are applied.
 */
const COVERAGE_SHORTLIST_DEPTH = 5;

/**
 * How capacity splits between "how many orthopaedists" and "what share of the
 * staff they are" (§4.2f).
 *
 * Count leads because absolute capacity is what a rep sells into, but the share
 * carries real independent signal: inside the ≥5-orthopaedist band the count
 * treats as identical, a high share converts at 32.3 % against 11.4 %. Weighting
 * the share to zero is what let a staffing cooperative with 131 registered
 * surgeons top the ranking.
 */
const CAPACITY_COUNT_WEIGHT = 0.6;
const CAPACITY_RATIO_WEIGHT = 0.4;

/**
 * The legs the agent is already committed to driving today.
 *
 * `[origin → first booking, booking → booking, …]`, plus a final leg from the
 * last booking back to itself so the region *around* the day's last stop stays
 * reachable — otherwise a rep whose last visit is at 16:00 gets nothing offered
 * near it for the rest of the afternoon.
 *
 * A clinic is reachable when it sits inside the ellipse of **any** leg, which
 * is exactly "on the way to something I am already doing".
 */
function buildLegs(
  origin: RoteiroPoint,
  fixedPoints: Array<{ lat: number; lng: number }>,
): Array<{ from: RoteiroPoint; to: RoteiroPoint }> {
  if (fixedPoints.length === 0) return [];
  const points = [origin, ...fixedPoints.map((p) => ({ lat: p.lat, lng: p.lng }))];
  const legs: Array<{ from: RoteiroPoint; to: RoteiroPoint }> = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    legs.push({ from: points[i]!, to: points[i + 1]! });
  }
  const last = points[points.length - 1]!;
  legs.push({ from: last, to: last });
  return legs;
}

interface CandidateRow extends Record<string, unknown> {
  profile_id: number;
  facility_id: number;
  facility_name: string;
  cnes_code: string | null;
  unit_type: string | null;
  municipality: string | null;
  neighborhood: string | null;
  funnel_stage: string;
  bucket: string;
  lat: number;
  lng: number;
  straight_line_km: string;
  ortho_n: number;
  ortho_total: number;
  ortho_ratio: string;
  /** False means CNES has no staff row at all — not that the facility has none. */
  registry_known: boolean;
  assignment_started_at: string | Date | null;
  theirs_qty: string | null;
  ours_qty: string | null;
  days_since_interaction: number | null;
  days_since_purchase: number | null;
  purchase_interval_days: number;
  last_suggested_at: string | Date | null;
  coverage_overdue: boolean;
  t_raw: string;
  h_raw: string;
  n_raw: string;
  v_raw: string;
  k_raw: string;
  c_raw: string;
  q_raw: string;
  merit: string;
}

export class DrizzleRoteiroRepository implements RoteiroRepository {
  async findParams(verticalId: number): Promise<RoteiroParams | null> {
    const rows = await db.execute<Record<string, unknown>>(sql`
      select * from roteiro_params where vertical_id = ${verticalId}
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      verticalId: Number(row.vertical_id),
      dailyLimit: Number(row.daily_limit),
      weights: row.weights as RoteiroParams["weights"],
      bucketRatios: row.bucket_ratios as RoteiroParams["bucketRatios"],
      cooldownDays: row.cooldown_days as RoteiroParams["cooldownDays"],
      coverageHorizonDays: row.coverage_horizon_days as RoteiroParams["coverageHorizonDays"],
      serviceMinutes: row.service_minutes as RoteiroParams["serviceMinutes"],
      unitTypePolicy: row.unit_type_policy as RoteiroParams["unitTypePolicy"],
      reachRadiusKm: Number(row.reach_radius_km),
      detourBudgetKm: Number(row.detour_budget_km),
      tauSeconds: Number(row.tau_seconds),
      remoteThresholdSeconds: Number(row.remote_threshold_seconds),
      headroomUnknown: Number(row.headroom_unknown),
      capacityUnknown: Number(row.capacity_unknown),
      workdayStart: String(row.workday_start),
      workdayEnd: String(row.workday_end),
      lunchStart: String(row.lunch_start),
      lunchMinutes: Number(row.lunch_minutes),
      maxGenerationsPerDay: Number(row.max_generations_per_day),
    };
  }

  async countAssignedProfiles(input: { userId: number; verticalId: number }): Promise<number> {
    const rows = await db.execute<{ n: string }>(sql`
      select count(*)::text as n
      from facility_vertical_profiles p
      join facility_vertical_rep_assignments a
        on a.facility_vertical_profile_id = p.id and a.ended_at is null
      where p.is_active and p.vertical_id = ${input.verticalId} and a.user_id = ${input.userId}
    `);
    return Number(rows[0]?.n ?? 0);
  }

  async createDraft(input: CreateRoteiroInput): Promise<StoredRoteiro> {
    return db.transaction(async (tx) => {
      // Regenerating replaces the live draft rather than colliding with the
      // partial unique index that allows one per agent per day.
      await tx.execute(sql`
        update roteiros set status = 'SUPERSEDED', updated_at = now()
        where user_id = ${input.userId} and scope_date = ${input.scopeDate}::date
          and status = 'DRAFT'
      `);

      const inserted = (await tx.execute(sql`
        insert into roteiros (
          user_id, created_by_user_id, vertical_id, scope_date, origin,
          reach_mode, anchor_profile_id, reach_bound_km, travel_source,
          params_snapshot, notices
        ) values (
          ${input.userId}, ${input.createdByUserId}, ${input.verticalId},
          ${input.scopeDate}::date,
          st_setsrid(st_makepoint(${input.origin.lng}, ${input.origin.lat}), 4326),
          ${input.reachMode}, ${input.anchorProfileId}, ${input.reachBoundKm},
          ${input.travelSource},
          ${JSON.stringify(input.paramsSnapshot)}::jsonb,
          ${JSON.stringify(input.notices)}::jsonb
        )
        returning id, version
      `)) as unknown as Array<{ id: number }>;
      const roteiroId = Number(inserted[0]?.id);

      for (const stop of input.stops) {
        await tx.execute(sql`
          insert into roteiro_stops (
            roteiro_id, position, facility_vertical_profile_id, bucket, modality,
            merit_score, score_breakdown, travel_seconds_from_prev, service_minutes,
            planned_starts_at, planned_ends_at, source, is_coverage_slot
          ) values (
            ${roteiroId}, ${stop.position}, ${stop.facilityVerticalProfileId},
            ${stop.bucket}, ${stop.modality}, ${stop.meritScore},
            ${JSON.stringify(stop.scoreBreakdown)}::jsonb,
            ${stop.travelSecondsFromPrev}, ${stop.serviceMinutes},
            ${stop.plannedStartsAt.toISOString()}, ${stop.plannedEndsAt.toISOString()},
            ${stop.source}, ${stop.isCoverageSlot}
          )
        `);
      }

      const stored = await this.loadRoteiro(roteiroId, tx);
      if (!stored) throw new Error(`roteiro ${roteiroId} vanished after insert`);
      return stored;
    });
  }

  async findById(id: number): Promise<StoredRoteiro | null> {
    return this.loadRoteiro(id, db);
  }

  async linkStop(input: {
    roteiroId: number;
    position: number;
    calendarId: number;
    interactionId: number;
  }): Promise<void> {
    await db.execute(sql`
      update roteiro_stops
      set calendar_id = ${input.calendarId},
          interaction_id = ${input.interactionId},
          updated_at = now()
      where roteiro_id = ${input.roteiroId} and position = ${input.position}
    `);
  }

  async markConfirmed(input: { roteiroId: number; confirmedAt: Date }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        update roteiros
        set status = 'CONFIRMED', confirmed_at = ${input.confirmedAt.toISOString()},
            version = version + 1, updated_at = now()
        where id = ${input.roteiroId}
      `);
      // The write that makes the coverage rotation turn (§4.3.1). Set here, on
      // confirm, and nowhere else.
      await tx.execute(sql`
        update facility_vertical_profiles p
        set last_suggested_at = ${input.confirmedAt.toISOString()}
        from roteiro_stops s
        where s.roteiro_id = ${input.roteiroId}
          and s.facility_vertical_profile_id = p.id
      `);
    });
  }

  /**
   * `db` and a transaction handle differ in type but share `execute`, which is
   * all this needs — so it takes the loosest shape both satisfy.
   */
  private async loadRoteiro(
    id: number,
    runner: Pick<typeof db, "execute">,
  ): Promise<StoredRoteiro | null> {
    const rows = (await runner.execute(sql`
      select r.id, r.user_id, r.created_by_user_id, r.vertical_id,
             to_char(r.scope_date, 'YYYY-MM-DD') as scope_date,
             r.status::text as status, r.reach_mode::text as reach_mode,
             r.reach_bound_km, r.travel_source::text as travel_source,
             r.anchor_profile_id, r.version, r.notices
      from roteiros r where r.id = ${id}
    `)) as unknown as Record<string, unknown>[];
    const row = rows[0];
    if (!row) return null;

    const stopRows = (await runner.execute(sql`
      select s.position, s.facility_vertical_profile_id, s.bucket::text as bucket,
             s.modality::text as modality, s.merit_score, s.score_breakdown,
             s.travel_seconds_from_prev, s.service_minutes,
             s.planned_starts_at, s.planned_ends_at, s.is_coverage_slot,
             s.source::text as source, s.calendar_id, s.interaction_id,
             p.facility_id, f.name as facility_name
      from roteiro_stops s
      join facility_vertical_profiles p on p.id = s.facility_vertical_profile_id
      join facilities f on f.id = p.facility_id
      where s.roteiro_id = ${id}
      order by s.position
    `)) as unknown as Record<string, unknown>[];

    return {
      id: Number(row.id),
      userId: Number(row.user_id),
      createdByUserId: Number(row.created_by_user_id),
      verticalId: Number(row.vertical_id),
      scopeDate: String(row.scope_date),
      status: row.status as StoredRoteiro["status"],
      reachMode: row.reach_mode as StoredRoteiro["reachMode"],
      reachBoundKm: Number(row.reach_bound_km),
      travelSource: row.travel_source as StoredRoteiro["travelSource"],
      anchorProfileId: row.anchor_profile_id === null ? null : Number(row.anchor_profile_id),
      version: Number(row.version),
      notices: (row.notices as unknown[]) ?? [],
      stops: stopRows.map((s) => ({
        position: Number(s.position),
        facilityVerticalProfileId: Number(s.facility_vertical_profile_id),
        facilityId: Number(s.facility_id),
        facilityName: String(s.facility_name),
        bucket: s.bucket as StoredRoteiroStop["bucket"],
        modality: s.modality as StoredRoteiroStop["modality"],
        serviceMinutes: Number(s.service_minutes),
        travelSecondsFromPrev:
          s.travel_seconds_from_prev === null ? null : Number(s.travel_seconds_from_prev),
        plannedStartsAt: new Date(String(s.planned_starts_at)),
        plannedEndsAt: new Date(String(s.planned_ends_at)),
        isCoverageSlot: Boolean(s.is_coverage_slot),
        source: s.source as StoredRoteiroStop["source"],
        meritScore: Number(s.merit_score),
        scoreBreakdown: (s.score_breakdown as Record<string, unknown>) ?? {},
        calendarId: s.calendar_id === null ? null : Number(s.calendar_id),
        interactionId: s.interaction_id === null ? null : Number(s.interaction_id),
      })),
    };
  }

  async searchAddableClinics(input: {
    userId: number;
    verticalId: number;
    query: string | null;
    limit: number;
  }) {
    const term = input.query?.trim();
    const rows = (await db.execute(sql`
      select p.id as profile_id, f.id as facility_id, f.name as facility_name,
             mu.name as municipality, rf.neighborhood as neighborhood,
             p.purchase_funnel_stage::text as funnel_stage
      from facility_vertical_profiles p
      join facilities f on f.id = p.facility_id
      join facility_vertical_rep_assignments a
        on a.facility_vertical_profile_id = p.id and a.ended_at is null
      left join municipalities mu on mu.id = f.municipality_id
      left join registry.facilities rf on rf.cnes_id = f.cnes_code
      where p.is_active
        and p.vertical_id = ${input.verticalId}
        and a.user_id = ${input.userId}
        and f.location is not null
        ${term ? sql`and f.name ilike ${'%' + term + '%'}` : sql``}
      order by f.name
      limit ${input.limit}
    `)) as unknown as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      facilityVerticalProfileId: Number(row.profile_id),
      facilityId: Number(row.facility_id),
      facilityName: String(row.facility_name),
      municipality: row.municipality === null ? null : String(row.municipality),
      neighborhood: row.neighborhood === null ? null : String(row.neighborhood),
      funnelStage: String(row.funnel_stage),
    }));
  }

  async locateFacilities(input: { facilityIds: number[]; verticalId: number }) {
    if (input.facilityIds.length === 0) return [];
    const rows = (await db.execute(sql`
      select f.id as facility_id, f.name as facility_name,
             st_y(f.location::geometry) as lat, st_x(f.location::geometry) as lng,
             p.id as profile_id
      from facilities f
      left join facility_vertical_profiles p
        on p.facility_id = f.id and p.vertical_id = ${input.verticalId}
      where f.id in ${input.facilityIds} and f.location is not null
    `)) as unknown as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      facilityId: Number(row.facility_id),
      facilityVerticalProfileId: row.profile_id === null ? null : Number(row.profile_id),
      facilityName: String(row.facility_name),
      lat: Number(row.lat),
      lng: Number(row.lng),
    }));
  }

  /**
   * The merit query — spec 0016 §4.2, one statement.
   *
   * Order matters and is not incidental: **reachability filters before merit
   * ranks**. Shortlisting by merit first is correct on a compact book and
   * broken on a spread one — a rep standing in Belém was offered Porto Velho,
   * Parauapebas, São Luís and Manaus, every one scoring well and not one
   * reachable that day (§4.1).
   *
   * Percentile ranks are computed **within the candidate set**, never against a
   * global maximum: one outlier facility with 131 registered surgeons would
   * otherwise flatten every other clinic to near zero.
   */
  async scoreCandidates(input: ScoreCandidatesInput): Promise<RoteiroCandidate[]> {
    const { params, origin } = input;
    const w = params.weights;
    const originGeog = sql`st_setsrid(st_makepoint(${origin.lng}, ${origin.lat}), 4326)::geography`;
    const boundM = input.reachBoundKm * M_PER_KM;

    /**
     * LIVRE is a circle around the rep. ANCORA is the ellipse whose foci are the
     * rep and the visit they have already committed to: a clinic is "on the
     * way" while the detour it adds to that unavoidable drive stays inside the
     * budget. The region around the anchor is inside the ellipse already, so
     * "near the destination" needs no separate rule.
     */
    const legs = buildLegs(origin, input.fixedPoints);
    const reachPredicate =
      legs.length === 0
        ? sql`st_dwithin(f.location::geography, ${originGeog}, ${boundM})`
        : sql.join(
            legs.map((leg) => {
              const from = sql`st_setsrid(st_makepoint(${leg.from.lng}, ${leg.from.lat}), 4326)::geography`;
              const to = sql`st_setsrid(st_makepoint(${leg.to.lng}, ${leg.to.lat}), 4326)::geography`;
              return sql`(
                st_distance(f.location::geography, ${from})
                + st_distance(f.location::geography, ${to})
              ) <= st_distance(${from}, ${to}) + ${boundM}`;
            }),
            sql` or `,
          );

    const rows = await db.execute<CandidateRow>(sql`
      with cand as (
        select
          p.id                              as profile_id,
          f.id                              as facility_id,
          f.name                            as facility_name,
          f.cnes_code                       as cnes_code,
          ut.name                           as unit_type,
          mu.name                           as municipality,
          rf.neighborhood                   as neighborhood,
          p.purchase_funnel_stage::text     as funnel_stage,
          p.purchase_interval_days::int     as purchase_interval_days,
          p.last_valid_purchase_date        as last_purchase,
          p.last_suggested_at               as last_suggested_at,
          a.started_at                      as assignment_started_at,
          st_y(f.location::geometry)        as lat,
          st_x(f.location::geometry)        as lng,
          round((st_distance(f.location::geography, ${originGeog}) / ${M_PER_KM})::numeric, 1)
                                            as straight_line_km,
          case
            when p.purchase_funnel_stage = 'NEVER_PURCHASED' then 'PROSPECTAR'
            when p.purchase_funnel_stage in ('CHURN', 'INACTIVE') then 'RECUPERAR'
            else 'MANTER'
          end                               as bucket
        from facility_vertical_profiles p
        join facilities f on f.id = p.facility_id
        join facility_vertical_rep_assignments a
          on a.facility_vertical_profile_id = p.id and a.ended_at is null
        left join registry.facilities rf on rf.cnes_id = f.cnes_code
        left join registry.unit_types ut on ut.cnes_id = rf.unit_type_code
        left join municipalities mu on mu.id = f.municipality_id
        where p.is_active
          and p.vertical_id = ${input.verticalId}
          and a.user_id = ${input.userId}
          and f.location is not null
          and ${reachPredicate}
          -- §4.2g: a unit type may be switched off entirely, which also removes
          -- it from the cobertura denominator.
          and coalesce(
                (${JSON.stringify(params.unitTypePolicy)}::jsonb -> coalesce(ut.name, '') ->> 'eligible')::boolean,
                (${JSON.stringify(params.unitTypePolicy)}::jsonb -> '*' ->> 'eligible')::boolean,
                true) = true
          ${
            input.excludeProfileIds.length > 0
              ? sql`and p.id not in ${input.excludeProfileIds}`
              : sql``
          }
          -- Already committed for this window.
          and not exists (
            select 1 from interactions i
            where i.facility_id = f.id and i.status in ('SCHEDULED', 'IN_PROGRESS')
          )
      ),
      -- Both halves of capacity in one pass (§4.2f): how many orthopaedists,
      -- and what share of the facility's staff they are.
      ortho as (
        select
          o.facility_cnes_id,
          count(distinct o.professional_cnes_id)
            filter (where o.occupation_cnes_id = ${ORTHOPAEDIST_CBO})::int as n,
          count(distinct o.professional_cnes_id)::int                       as total
        from registry.facility_professional_occupations o
        group by 1
      ),
      metric as (
        select s.facility_vertical_profile_id as profile_id,
               sum(s.theirs_qty) as theirs_qty,
               sum(s.ours_qty)   as ours_qty
        from facility_metric_snapshots s
        group by 1
      ),
      last_done as (
        select i.facility_id, max(i.actual_ended_at) as ended_at
        from interactions i
        where i.status = 'COMPLETED'
        group by 1
      ),
      raw as (
        select
          c.*,
          coalesce(o.n, 0)                                        as ortho_n,
          coalesce(o.total, 0)                                    as ortho_total,
          case when coalesce(o.total, 0) = 0 then 0::numeric
               else o.n::numeric / o.total end                    as ortho_ratio,
          -- Absent is not zero (§15.5.3). No staff row means CNES has not told
          -- us anything about this facility, which is a different claim from
          -- "it employs no orthopaedists" — and the one a failed load produces.
          (o.facility_cnes_id is not null)                         as registry_known,
          m.theirs_qty, m.ours_qty,
          (${input.today}::date - c.last_purchase)                as days_since_purchase,
          (${input.today}::date - ld.ended_at::date)              as days_since_interaction,
          -- §4.3.1 coverage: overdue when never committed to, or older than the
          -- bucket's horizon. NULL is the most overdue state there is.
          (c.last_suggested_at is null
           or c.last_suggested_at < ${input.today}::date - make_interval(days =>
                coalesce((${JSON.stringify(params.coverageHorizonDays)}::jsonb ->> c.bucket)::int, 180)))
                                                                   as coverage_overdue,
          -- §4.2a timing ramp: peaks just BEFORE the expected reorder, because
          -- the point of the visit is to be there when the decision is made.
          -- A stage lookup would treat a clinic two days into its window and one
          -- forty days in as identical, which is the distinction reps act on.
          case
            when c.last_purchase is null then 0.50
            else (
              select case
                when v <  0.35 then 0.10
                when v <  0.50 then 0.10 + 0.90 * (v - 0.35) / 0.15
                when v <= 1.20 then 1.00
                when v <= 2.00 then 1.00 - 0.45 * (v - 1.20) / 0.80
                when v <= 3.00 then 0.55 - 0.20 * (v - 2.00) / 1.00
                else 0.35
              end
              from (select (${input.today}::date - c.last_purchase)::numeric
                           / nullif(c.purchase_interval_days, 0) as v) ramp
            )
          end::numeric                                             as t_raw,
          case c.funnel_stage
            when 'CHURN' then 1.00 when 'INACTIVE' then 0.60 else 0.00
          end::numeric                                             as k_raw,
          -- §4.2g fit, from the configurable unit-type policy. '*' catches the
          -- staffing cooperatives and administrative units without enumerating
          -- them — the trap that put a co-op with 131 surgeons top of the list.
          coalesce(
            (${JSON.stringify(params.unitTypePolicy)}::jsonb -> coalesce(c.unit_type, '') ->> 'fit')::numeric,
            (${JSON.stringify(params.unitTypePolicy)}::jsonb -> '*' ->> 'fit')::numeric,
            0.05)                                                  as q_raw
        from cand c
        left join ortho  o  on o.facility_cnes_id = c.cnes_code
        left join metric m  on m.profile_id = c.profile_id
        left join last_done ld on ld.facility_id = c.facility_id
      ),
      scored as (
        select
          r.*,
          -- §4.2f — count says how much orthopaedic capacity exists, ratio says
          -- how much of the facility that capacity *is*. Measured inside the
          -- >=5 band the count alone treats as equal, a high share converts at
          -- 32.3% against 11.4%. A hospital with 120 physicians of whom 3 are
          -- orthopaedists is not the prospect a clinic with 14 of whom 12 are.
          -- A facility CNES knows nothing about sits at the neutral mid-band
          -- rather than at the bottom. Ranking the unknown last would mean a
          -- partial registry load silently buries whole stretches of the book,
          -- and it would bury them hardest where a visit is most warranted.
          case when not r.registry_known then ${params.capacityUnknown}::numeric
               else (${CAPACITY_COUNT_WEIGHT} * percent_rank() over (order by r.ortho_n)
                     + ${CAPACITY_RATIO_WEIGHT} * percent_rank() over (order by r.ortho_ratio))::numeric
          end                                                                     as c_raw,
          case when r.theirs_qty is null then ${params.headroomUnknown}::numeric
               else percent_rank() over (order by coalesce(r.theirs_qty, 0))::numeric
          end                                                                     as h_raw,
          percent_rank() over (order by coalesce(r.ours_qty, 0))::numeric          as v_raw,
          case
            when r.days_since_interaction is null then 1.00::numeric
            else least(1.0, r.days_since_interaction::numeric
                            / greatest(21, least(90, r.purchase_interval_days)))
          end                                                                     as n_raw
        from raw r
      ),
      ranked as (
        select
          s.*,
          round(${w.t}::numeric * s.t_raw + ${w.h}::numeric * s.h_raw
              + ${w.n}::numeric * s.n_raw + ${w.v}::numeric * s.v_raw
              + ${w.k}::numeric * s.k_raw + ${w.c}::numeric * s.c_raw
              + ${w.q}::numeric * s.q_raw, 5)                                     as merit
        from scored s
      ),
      windowed as (
        select
          r.*,
          row_number() over (order by r.merit desc) as merit_rank,
          case when r.coverage_overdue then
            row_number() over (
              partition by r.coverage_overdue
              -- Every never-covered clinic shares a null last_suggested_at,
              -- which is one enormous tie — today it is the entire book. The
              -- older assignment is the more overdue one.
              order by r.last_suggested_at asc nulls first,
                       r.assignment_started_at asc nulls first,
                       r.merit desc)
          end                                       as coverage_rank
        from ranked r
      )
      select
        w.profile_id, w.facility_id, w.facility_name, w.cnes_code, w.unit_type,
        w.municipality, w.neighborhood, w.funnel_stage, w.bucket, w.lat, w.lng, w.straight_line_km,
        w.ortho_n, w.ortho_total, w.ortho_ratio, w.registry_known, w.assignment_started_at,
        w.theirs_qty, w.ours_qty, w.days_since_interaction,
        w.days_since_purchase, w.purchase_interval_days, w.last_suggested_at,
        w.coverage_overdue,
        w.t_raw, w.h_raw, w.n_raw, w.v_raw, w.k_raw, w.c_raw, w.q_raw, w.merit
      from windowed w
      -- The shortlist is the top slice by merit **plus** the most
      -- coverage-overdue clinics regardless of merit.
      --
      -- The union is not an optimisation, it is the only reason the §4.3.1
      -- coverage slot can ever be filled. A clinic that is overdue is very
      -- often low-merit — that is precisely why nobody has been — so a
      -- merit-ordered shortlist truncated at 4N drops it before selection ever
      -- sees it, and the reserved slot silently stays empty forever.
      where w.merit_rank <= ${input.limit}
         or w.coverage_rank <= ${COVERAGE_SHORTLIST_DEPTH}
         ${
           input.includeProfileIds.length > 0
             ? sql`or w.profile_id in ${input.includeProfileIds}`
             : sql``
         }
      order by w.merit desc
    `);

    return rows.map((row) => this.toCandidate(row, w));
  }

  private toCandidate(row: CandidateRow, w: RoteiroParams["weights"]): RoteiroCandidate {
    const num = (v: string | null): number => Number(v ?? 0);
    /**
     * The driver hands timestamps back as strings, not `Date`s.
     *
     * Both of these feed the §4.3.1 coverage ordering, which compares them with
     * `.getTime()`. Left as strings that call throws, and the unit tests could
     * not see it — the fake repository supplies real `Date`s, so only a run
     * against Postgres exposes the difference.
     */
    const date = (v: unknown): Date | null =>
      v === null || v === undefined ? null : v instanceof Date ? v : new Date(String(v));
    const component = (
      raw: string,
      weight: number,
      detail: Record<string, unknown>,
    ): { raw: number; weighted: number } & Record<string, unknown> => ({
      raw: Number(Number(raw).toFixed(4)),
      weighted: Number((Number(raw) * weight).toFixed(4)),
      ...detail,
    });

    return {
      facilityVerticalProfileId: Number(row.profile_id),
      facilityId: Number(row.facility_id),
      facilityName: row.facility_name,
      cnesCode: row.cnes_code,
      unitType: row.unit_type,
      municipality: row.municipality,
      neighborhood: row.neighborhood,
      funnelStage: row.funnel_stage as RoteiroCandidate["funnelStage"],
      bucket: row.bucket as RoteiroCandidate["bucket"],
      lat: Number(row.lat),
      lng: Number(row.lng),
      straightLineKm: Number(row.straight_line_km),
      registryKnown: row.registry_known === true,
      orthopaedistCount: Number(row.ortho_n),
      totalProfessionalCount: Number(row.ortho_total),
      orthopaedistShare: Number(row.ortho_ratio),
      assignmentStartedAt: date(row.assignment_started_at),
      theirsQty: row.theirs_qty === null ? null : Number(row.theirs_qty),
      oursQty: row.ours_qty === null ? null : Number(row.ours_qty),
      daysSinceLastInteraction:
        row.days_since_interaction === null ? null : Number(row.days_since_interaction),
      daysSinceLastPurchase:
        row.days_since_purchase === null ? null : Number(row.days_since_purchase),
      purchaseIntervalDays: Number(row.purchase_interval_days),
      lastSuggestedAt: date(row.last_suggested_at),
      coverageOverdue: row.coverage_overdue,
      meritScore: num(row.merit),
      components: {
        t: component(row.t_raw, w.t, {
          stage: row.funnel_stage,
          daysSinceLastPurchase:
            row.days_since_purchase === null ? null : Number(row.days_since_purchase),
          intervalDays: Number(row.purchase_interval_days),
        }),
        h: component(row.h_raw, w.h, {
          theirsQty: row.theirs_qty === null ? null : Number(row.theirs_qty),
          surveyed: row.theirs_qty !== null,
        }),
        n: component(row.n_raw, w.n, {
          daysSinceLastInteraction:
            row.days_since_interaction === null ? null : Number(row.days_since_interaction),
        }),
        v: component(row.v_raw, w.v, {
          oursQty: row.ours_qty === null ? null : Number(row.ours_qty),
        }),
        k: component(row.k_raw, w.k, { stage: row.funnel_stage }),
        c: component(row.c_raw, w.c, {
          registryKnown: row.registry_known === true,
          orthopaedists: Number(row.ortho_n),
          totalProfessionals: Number(row.ortho_total),
          orthopaedistShare: Number(Number(row.ortho_ratio).toFixed(3)),
        }),
        q: component(row.q_raw, w.q, { unitType: row.unit_type }),
      },
    };
  }
}
