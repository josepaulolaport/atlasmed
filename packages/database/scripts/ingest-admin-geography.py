#!/usr/bin/env python3
"""Load IBGE Malha + CNES municipality dict into public admin geography tables.

PKs are integer identity (omit id on insert). Stable keys = ibge_id / cnes_code.
No sentinel unknown rows — facilities must map to a real municipality.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path

import psycopg
import shapefile

REPO = Path(__file__).resolve().parents[3]
CACHE = REPO / ".cache" / "geo"
UF_SHP = CACHE / "ibge_uf" / "BR_UF_2024"
MUN_SHP = CACHE / "ibge_mun" / "BR_Municipios_2024"
CNES_MUN = CACHE / "cnes_municipio" / "MUNICIPIO.txt"
BAIRROS_DIR = CACHE / "bairros"


def require_env() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL required")
    return url


def shape_to_multipolygon_geojson(shape) -> str | None:
    geom = shape.__geo_interface__
    gtype = geom.get("type")
    if gtype == "Polygon":
        geom = {"type": "MultiPolygon", "coordinates": [geom["coordinates"]]}
    elif gtype == "MultiPolygon":
        pass
    else:
        return None
    return json.dumps(geom)


def state_id_by_ibge(cur: psycopg.Cursor, ibge: str) -> int:
    cur.execute("SELECT id FROM states WHERE ibge_id = %s", (ibge,))
    row = cur.fetchone()
    if not row:
        raise SystemExit(f"missing state ibge_id={ibge}")
    return int(row[0])


def mun_id_by_ibge(cur: psycopg.Cursor, ibge: str) -> int:
    cur.execute("SELECT id FROM municipalities WHERE ibge_id = %s", (ibge,))
    row = cur.fetchone()
    if not row:
        raise SystemExit(f"missing municipality ibge_id={ibge}")
    return int(row[0])


def load_states(conn: psycopg.Connection) -> int:
    if not UF_SHP.with_suffix(".shp").exists():
        raise SystemExit(f"missing {UF_SHP}.shp")
    reader = shapefile.Reader(str(UF_SHP))
    fields = [f[0] for f in reader.fields[1:]]
    sql = """
    INSERT INTO states (
      name, ibge_id, cnes_code, abbreviation, boundary,
      boundary_min_lng, boundary_min_lat, boundary_max_lng, boundary_max_lat,
      boundary_area_sq_km, created_at, updated_at
    ) VALUES (
      %(name)s, %(ibge_id)s, %(cnes_code)s, %(abbreviation)s,
      ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)), 3)),
      ST_XMin(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)),
      ST_YMin(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)),
      ST_XMax(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)),
      ST_YMax(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)),
      %(area_km2)s, now(), now()
    )
    ON CONFLICT (ibge_id) DO UPDATE SET
      name = EXCLUDED.name,
      abbreviation = EXCLUDED.abbreviation,
      boundary = EXCLUDED.boundary,
      boundary_min_lng = EXCLUDED.boundary_min_lng,
      boundary_min_lat = EXCLUDED.boundary_min_lat,
      boundary_max_lng = EXCLUDED.boundary_max_lng,
      boundary_max_lat = EXCLUDED.boundary_max_lat,
      boundary_area_sq_km = EXCLUDED.boundary_area_sq_km,
      updated_at = now()
    """
    n = 0
    with conn.cursor() as cur:
        for sr in reader.iterShapeRecords():
            rec = dict(zip(fields, sr.record))
            geojson = shape_to_multipolygon_geojson(sr.shape)
            if not geojson:
                continue
            ibge = str(rec["CD_UF"]).strip()
            cur.execute(
                sql,
                {
                    "name": str(rec["NM_UF"]).strip(),
                    "ibge_id": ibge,
                    "cnes_code": ibge,
                    "abbreviation": str(rec["SIGLA_UF"]).strip().upper(),
                    "geojson": geojson,
                    "area_km2": float(rec["AREA_KM2"]) if rec.get("AREA_KM2") is not None else None,
                },
            )
            n += 1
    conn.commit()
    return n


def load_municipalities(conn: psycopg.Connection) -> int:
    if not MUN_SHP.with_suffix(".shp").exists():
        raise SystemExit(f"missing {MUN_SHP}.shp")
    reader = shapefile.Reader(str(MUN_SHP))
    fields = [f[0] for f in reader.fields[1:]]
    sql = """
    INSERT INTO municipalities (
      state_id, name, ibge_id, cnes_code, boundary,
      boundary_min_lng, boundary_min_lat, boundary_max_lng, boundary_max_lat,
      boundary_area_sq_km, created_at, updated_at
    ) VALUES (
      %(state_id)s, %(name)s, %(ibge_id)s, %(cnes_code)s,
      ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)), 3)),
      ST_XMin(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)),
      ST_YMin(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)),
      ST_XMax(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)),
      ST_YMax(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)),
      %(area_km2)s, now(), now()
    )
    ON CONFLICT (ibge_id) DO UPDATE SET
      state_id = EXCLUDED.state_id,
      name = EXCLUDED.name,
      cnes_code = COALESCE(EXCLUDED.cnes_code, municipalities.cnes_code),
      boundary = EXCLUDED.boundary,
      boundary_min_lng = EXCLUDED.boundary_min_lng,
      boundary_min_lat = EXCLUDED.boundary_min_lat,
      boundary_max_lng = EXCLUDED.boundary_max_lng,
      boundary_max_lat = EXCLUDED.boundary_max_lat,
      boundary_area_sq_km = EXCLUDED.boundary_area_sq_km,
      updated_at = now()
    """
    n = 0
    seen_cnes: set[str] = set()
    state_cache: dict[str, int] = {}
    with conn.cursor() as cur:
        for sr in reader.iterShapeRecords():
            rec = dict(zip(fields, sr.record))
            geojson = shape_to_multipolygon_geojson(sr.shape)
            if not geojson:
                continue
            ibge = str(rec["CD_MUN"]).strip()
            uf = str(rec["CD_UF"]).strip()
            if uf not in state_cache:
                state_cache[uf] = state_id_by_ibge(cur, uf)
            cnes = ibge[:6] if len(ibge) >= 6 else ibge
            if cnes in seen_cnes:
                cnes = None
            else:
                seen_cnes.add(cnes)
            cur.execute(
                sql,
                {
                    "state_id": state_cache[uf],
                    "name": str(rec["NM_MUN"]).strip(),
                    "ibge_id": ibge,
                    "cnes_code": cnes,
                    "geojson": geojson,
                    "area_km2": float(rec["AREA_KM2"]) if rec.get("AREA_KM2") is not None else None,
                },
            )
            n += 1
            if n % 500 == 0:
                conn.commit()
                print(f"  municipalities {n}…", flush=True)
    conn.commit()
    return n


def apply_cnes_municipio_dict(conn: psycopg.Connection) -> int:
    if not CNES_MUN.exists():
        print("  skip CNES MUNICIPIO.txt (missing)")
        return 0
    updated = 0
    with conn.cursor() as cur, CNES_MUN.open("rb") as fh:
        for i, raw in enumerate(fh):
            if i == 0:
                continue
            line = raw.decode("latin-1")
            if len(line) < 48:
                continue
            code6 = line[0:6].strip()
            name = line[6:46].strip()
            uf = line[46:48].strip().upper()
            if not code6 or not name:
                continue
            cur.execute(
                """
                UPDATE municipalities m
                SET cnes_code = %(code6)s,
                    name = COALESCE(NULLIF(%(name)s, ''), m.name),
                    updated_at = now()
                FROM states s
                WHERE m.state_id = s.id
                  AND s.abbreviation = %(uf)s
                  AND left(m.ibge_id, 6) = %(code6)s
                """,
                {"code6": code6, "name": name, "uf": uf},
            )
            updated += cur.rowcount
    conn.commit()
    return updated


def load_neighborhoods(conn: psycopg.Connection) -> int:
    if not BAIRROS_DIR.exists():
        print("  skip bairros (cache missing)")
        return 0
    sql = """
    INSERT INTO neighborhoods (
      municipality_id, name, ibge_id, boundary,
      boundary_min_lng, boundary_min_lat, boundary_max_lng, boundary_max_lat,
      boundary_area_sq_km, created_at, updated_at
    ) VALUES (
      %(municipality_id)s, %(name)s, %(ibge_id)s,
      ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)), 3)),
      ST_XMin(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)),
      ST_YMin(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)),
      ST_XMax(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)),
      ST_YMax(ST_SetSRID(ST_GeomFromGeoJSON(%(geojson)s), 4326)),
      NULL, now(), now()
    )
    ON CONFLICT (ibge_id) DO UPDATE SET
      municipality_id = EXCLUDED.municipality_id,
      name = EXCLUDED.name,
      boundary = EXCLUDED.boundary,
      boundary_min_lng = EXCLUDED.boundary_min_lng,
      boundary_min_lat = EXCLUDED.boundary_min_lat,
      boundary_max_lng = EXCLUDED.boundary_max_lng,
      boundary_max_lat = EXCLUDED.boundary_max_lat,
      updated_at = now()
    """
    n = 0
    skipped = 0
    mun_cache: dict[str, int] = {}
    with conn.cursor() as cur:
        for zpath in sorted(BAIRROS_DIR.glob("*_bairros_CD2022.zip")):
            with tempfile.TemporaryDirectory() as td:
                with zipfile.ZipFile(zpath) as zf:
                    zf.extractall(td)
                shps = list(Path(td).rglob("*.shp"))
                if not shps:
                    continue
                reader = shapefile.Reader(str(shps[0]))
                fields = [f[0] for f in reader.fields[1:]]
                for sr in reader.iterShapeRecords():
                    rec = dict(zip(fields, sr.record))
                    geojson = shape_to_multipolygon_geojson(sr.shape)
                    if not geojson:
                        skipped += 1
                        continue
                    cd_mun = str(rec.get("CD_MUN") or "").strip()
                    cd_bairro = str(rec.get("CD_BAIRRO") or "").strip()
                    name = str(rec.get("NM_BAIRRO") or "").strip()
                    if not cd_mun or not cd_bairro or not name:
                        skipped += 1
                        continue
                    if cd_mun not in mun_cache:
                        try:
                            mun_cache[cd_mun] = mun_id_by_ibge(cur, cd_mun)
                        except SystemExit:
                            skipped += 1
                            continue
                    cur.execute(
                        sql,
                        {
                            "municipality_id": mun_cache[cd_mun],
                            "name": name,
                            "ibge_id": cd_bairro,
                            "geojson": geojson,
                        },
                    )
                    n += 1
                    if n % 1000 == 0:
                        conn.commit()
                        print(f"  neighborhoods {n}…", flush=True)
            print(f"  done {zpath.name}", flush=True)
    conn.commit()
    print(f"  neighborhoods skipped={skipped}")
    return n


def backfill_facilities(conn: psycopg.Connection) -> dict[str, int]:
    """Map facilities → municipalities via city/state text. Unmatched stay NULL → ingest fails."""
    with conn.cursor() as cur:
        by_cnes = 0  # cnes_unit_id removed; CNES mun join no longer available
        cur.execute(
            """
            UPDATE facilities f
            SET municipality_id = m.id, updated_at = now()
            FROM municipalities m
            JOIN states s ON s.id = m.state_id
            WHERE f.municipality_id IS NULL
              AND f.city IS NOT NULL
              AND f.state IS NOT NULL
              AND upper(trim(f.state)) = s.abbreviation
              AND upper(unaccent(trim(f.city))) = upper(unaccent(m.name))
            """
        )
        by_name = cur.rowcount
        cur.execute("SELECT count(*) FROM facilities WHERE municipality_id IS NULL")
        remaining = cur.fetchone()[0]
    conn.commit()
    return {"by_cnes": by_cnes, "by_name": by_name, "remaining_null": remaining}


def main() -> None:
    url = require_env()
    print("Connecting…")
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
        conn.commit()

        print("Loading states…")
        print(f"  states={load_states(conn)}")
        print("Loading municipalities…")
        print(f"  municipalities={load_municipalities(conn)}")
        print("Applying CNES MUNICIPIO dict…")
        print(f"  cnes_updates={apply_cnes_municipio_dict(conn)}")
        print("Loading neighborhoods…")
        print(f"  neighborhoods={load_neighborhoods(conn)}")
        print("Backfilling facilities.municipality_id…")
        stats = backfill_facilities(conn)
        print(f"  backfill={stats}")
        if stats["remaining_null"]:
            raise SystemExit(
                f"{stats['remaining_null']} facilities still lack municipality_id — fix data, no unknown sentinel"
            )
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM states")
            n_states = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM municipalities")
            n_muns = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM neighborhoods")
            n_nbh = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM facilities")
            n_fac = cur.fetchone()[0]
        print(
            json.dumps(
                {
                    "states": n_states,
                    "municipalities": n_muns,
                    "neighborhoods": n_nbh,
                    "facilities": n_fac,
                },
                indent=2,
            )
        )
    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
