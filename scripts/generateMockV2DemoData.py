#!/usr/bin/env python3
"""Gera o dataset demonstrativo v2 a partir do KML autorizado e da malha IBGE.

Dependencia de geracao: shapely. Os artefatos gerados nao dependem de Python
em runtime e sao versionados junto ao aplicativo.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, mapping, shape
from shapely.ops import transform, unary_union


KML_NS = {"k": "http://www.opengis.net/kml/2.2"}
ORGANIZATION_ID = "org_tche_fertilidade"
DATASET_ID = "demo_clientes_26_1_mt_2026_08"
UF_ID = "51"
UF_CODE = "MT"
GENERATED_AT = "2026-08-05T00:00:00.000Z"


def slug(value: str, limit: int = 44) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    compact = re.sub(r"[^a-z0-9]+", "_", ascii_value).strip("_") or "registro"
    return compact[:limit].rstrip("_")


def stable_id(prefix: str, source: str) -> str:
    digest = hashlib.sha1(source.encode("utf-8")).hexdigest()[:8]
    return f"{prefix}_{slug(source)}_{digest}"


def node_name(node: ET.Element) -> str:
    name = node.find("k:name", KML_NS)
    return (name.text or "").strip() if name is not None else ""


def direct_owner(document: ET.Element, parents: dict[ET.Element, ET.Element]) -> str:
    current = parents.get(document)
    while current is not None:
        if current.tag.endswith("Folder"):
            return node_name(current)
        current = parents.get(current)
    return ""


def polygonal_only(geometry: Any) -> Polygon | MultiPolygon:
    if isinstance(geometry, (Polygon, MultiPolygon)):
        return geometry
    if isinstance(geometry, GeometryCollection):
        polygons = [item for item in geometry.geoms if isinstance(item, (Polygon, MultiPolygon))]
        if polygons:
            return unary_union(polygons)
    return Polygon()


def parse_polygon(placemark: ET.Element) -> tuple[Polygon | MultiPolygon, bool]:
    coordinate_node = placemark.find("./k:LineString/k:coordinates", KML_NS)
    if coordinate_node is None or not (coordinate_node.text or "").strip():
        return Polygon(), False

    coordinates = []
    for token in coordinate_node.text.split():
        values = token.split(",")
        coordinates.append((float(values[0]), float(values[1])))
    if len(coordinates) < 4:
        return Polygon(), False
    if coordinates[0] != coordinates[-1]:
        coordinates.append(coordinates[0])

    polygon: Polygon | MultiPolygon = Polygon(coordinates)
    repaired = not polygon.is_valid
    if repaired:
        polygon = polygonal_only(polygon.buffer(0))
    return polygon, repaired


def approximate_area_hectares(geometry: Polygon | MultiPolygon) -> float:
    if geometry.is_empty:
        return 0.0
    latitude = geometry.representative_point().y
    radius = 6_371_008.8
    cos_latitude = math.cos(math.radians(latitude))
    projected = transform(
        lambda x, y, z=None: (
            math.radians(x) * radius * cos_latitude,
            math.radians(y) * radius,
        ),
        geometry,
    )
    return round(abs(projected.area) / 10_000.0, 2)


def extract_talhao_code(name: str) -> str | None:
    match = re.search(r"\bT0*(\d+)\b", name, flags=re.IGNORECASE)
    return f"T{int(match.group(1)):02d}" if match else None


def choose_balanced_owners(owner_counts: Counter[str]) -> set[str]:
    """Seleciona 18 titulares/35 propriedades para Victor, mantendo titular inteiro."""
    items = sorted(owner_counts.items(), key=lambda item: item[0].casefold())
    states: dict[tuple[int, int], list[str]] = {(0, 0): []}
    for owner, property_count in items:
        for (owner_count, total), selected in list(states.items())[::-1]:
            key = owner_count + 1, total + property_count
            if key[0] <= 18 and key[1] <= 35 and key not in states:
                states[key] = [*selected, owner]
    selected = states.get((18, 35))
    if selected is None:
        raise RuntimeError("Nao foi possivel dividir 18 titulares e 35 propriedades por colaborador")
    return set(selected)


def iso_date(base: datetime, offset_days: int) -> str:
    return (base + timedelta(days=offset_days)).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def generate(args: argparse.Namespace) -> dict[str, Any]:
    root = ET.parse(args.kml).getroot()
    parents = {child: node for node in root.iter() for child in node}
    municipality_features = json.loads(args.municipal_boundaries.read_text(encoding="utf-8"))["features"]
    municipality_records = json.loads(args.municipalities.read_text(encoding="utf-8-sig"))
    municipality_names = {str(item["id"]): item["nome"] for item in municipality_records}
    municipalities = [
        (str(feature["properties"]["codarea"]), shape(feature["geometry"]))
        for feature in municipality_features
    ]

    documents: list[dict[str, Any]] = []
    occurrence_by_owner_name: Counter[tuple[str, str]] = Counter()
    repaired_geometries = 0

    for document in root.findall(".//k:Document", KML_NS):
        owner_name = direct_owner(document, parents)
        property_name = node_name(document)
        occurrence_by_owner_name[(owner_name, property_name)] += 1
        occurrence = occurrence_by_owner_name[(owner_name, property_name)]
        property_source_key = f"{owner_name}|{property_name}|{occurrence}"
        property_id = stable_id("propriedade", property_source_key)

        contour_groups: defaultdict[str, list[Polygon | MultiPolygon]] = defaultdict(list)
        for placemark in document.findall(".//k:Placemark", KML_NS):
            polygon, repaired = parse_polygon(placemark)
            repaired_geometries += int(repaired)
            if not polygon.is_empty:
                contour_groups[node_name(placemark)].append(polygon)
        if not contour_groups:
            continue

        talhoes = []
        property_polygons = []
        for talhao_name, polygon_parts in sorted(contour_groups.items(), key=lambda item: item[0].casefold()):
            logical_geometry = polygonal_only(unary_union(polygon_parts))
            talhao_id = stable_id("talhao", f"{property_id}|{talhao_name}")
            talhoes.append({
                "id": talhao_id,
                "nome": talhao_name,
                "codigo": extract_talhao_code(talhao_name),
                "geometry": logical_geometry,
                "part_count": len(polygon_parts),
                "area_hectares": approximate_area_hectares(logical_geometry),
            })
            property_polygons.append(logical_geometry)

        property_geometry = polygonal_only(unary_union(property_polygons))
        representative_point = property_geometry.representative_point()
        overlaps = []
        for municipality_id, municipality_geometry in municipalities:
            if not municipality_geometry.intersects(property_geometry):
                continue
            intersection = municipality_geometry.intersection(property_geometry).area
            ratio = intersection / property_geometry.area if property_geometry.area else 0.0
            if ratio >= 0.01:
                overlaps.append((municipality_id, ratio))
        overlaps.sort(key=lambda item: item[1], reverse=True)
        if not overlaps:
            containing = [
                municipality_id
                for municipality_id, municipality_geometry in municipalities
                if municipality_geometry.covers(representative_point)
            ]
            if not containing:
                raise RuntimeError(f"Propriedade sem Municipio identificado: {owner_name} / {property_name}")
            overlaps = [(containing[0], 1.0)]

        municipality_id = overlaps[0][0]
        documents.append({
            "owner_name": owner_name,
            "property_name": property_name,
            "property_id": property_id,
            "municipality_id": municipality_id,
            "municipality_name": municipality_names[municipality_id],
            "municipality_overlaps": overlaps,
            "property_geometry": property_geometry,
            "property_area_hectares": approximate_area_hectares(property_geometry),
            "talhoes": talhoes,
        })

    documents.sort(key=lambda item: (item["owner_name"].casefold(), item["property_name"].casefold()))
    owner_counts = Counter(document["owner_name"] for document in documents)
    victor_owners = choose_balanced_owners(owner_counts)

    users = [
        {
            "id": "usr_admin_cesar",
            "organizacao_id": ORGANIZATION_ID,
            "nome": "César",
            "email": "admin.cesar@example.com",
            "perfil": "admin",
            "status": "ativo",
            "observacoes": "Conta administrativa demonstrativa.",
        },
        {
            "id": "usr_admin_bruna",
            "organizacao_id": ORGANIZATION_ID,
            "nome": "Bruna",
            "email": "admin.bruna@example.com",
            "perfil": "admin",
            "status": "ativo",
            "observacoes": "Conta administrativa demonstrativa.",
        },
        {
            "id": "usr_colaborador_victor",
            "organizacao_id": ORGANIZATION_ID,
            "nome": "Victor",
            "email": "colaborador.victor@example.com",
            "perfil": "colaborador",
            "status": "ativo",
            "observacoes": "Conta de Colaborador demonstrativa com vínculos diretos.",
        },
        {
            "id": "usr_colaborador_bruna_brito",
            "organizacao_id": ORGANIZATION_ID,
            "nome": "Bruna Brito",
            "email": "colaborador.bruna.brito@example.com",
            "perfil": "colaborador",
            "status": "ativo",
            "observacoes": "Conta de Colaborador demonstrativa com vínculos diretos.",
        },
    ]
    credentials = [
        {"usuario_id": "usr_admin_cesar", "email": "admin.cesar@example.com", "senha": "admin123"},
        {"usuario_id": "usr_admin_bruna", "email": "admin.bruna@example.com", "senha": "admin123"},
        {"usuario_id": "usr_colaborador_victor", "email": "colaborador.victor@example.com", "senha": "colab123"},
        {"usuario_id": "usr_colaborador_bruna_brito", "email": "colaborador.bruna.brito@example.com", "senha": "colab123"},
    ]

    producers = []
    producer_by_name = {}
    for owner_name in sorted(owner_counts, key=str.casefold):
        producer_id = stable_id("produtor", owner_name)
        user_id = stable_id("usr_produtor", owner_name)
        email = f"produtor.{hashlib.sha1(owner_name.encode('utf-8')).hexdigest()[:10]}@example.com"
        producer_by_name[owner_name] = {"id": producer_id, "usuario_id": user_id}
        users.append({
            "id": user_id,
            "organizacao_id": ORGANIZATION_ID,
            "nome": owner_name,
            "email": email,
            "perfil": "produtor",
            "status": "ativo",
            "observacoes": "Conta de Produtor demonstrativa derivada do KML autorizado.",
        })
        producers.append({
            "id": producer_id,
            "organizacao_id": ORGANIZATION_ID,
            "usuario_id": user_id,
            "nome": owner_name,
            "status": "ativo",
        })
        credentials.append({"usuario_id": user_id, "email": email, "senha": "prod123"})

    properties = []
    links = []
    talhao_records = []
    geometry_features = []
    visits = []
    notebooks = []
    materials = []
    base_date = datetime(2026, 8, 5, 12, 0, tzinfo=timezone.utc)

    for index, document in enumerate(documents):
        producer = producer_by_name[document["owner_name"]]
        collaborator_id = (
            "usr_colaborador_victor"
            if document["owner_name"] in victor_owners
            else "usr_colaborador_bruna_brito"
        )
        collaborator_name = "Victor" if collaborator_id == "usr_colaborador_victor" else "Bruna Brito"
        property_id = document["property_id"]
        properties.append({
            "id": property_id,
            "organizacao_id": ORGANIZATION_ID,
            "titular_id": producer["id"],
            "nome": document["property_name"],
            "municipio_id": document["municipality_id"],
            "municipio_nome": document["municipality_name"],
            "uf_id": UF_ID,
            "uf_sigla": UF_CODE,
            "status": "ativa",
        })
        links.extend([
            {
                "id": stable_id("vinculo", f"{producer['usuario_id']}|{property_id}|titular"),
                "organizacao_id": ORGANIZATION_ID,
                "usuario_id": producer["usuario_id"],
                "propriedade_id": property_id,
                "tipo_vinculo": "titular",
                "status": "ativo",
            },
            {
                "id": stable_id("vinculo", f"{collaborator_id}|{property_id}|colaborador"),
                "organizacao_id": ORGANIZATION_ID,
                "usuario_id": collaborator_id,
                "propriedade_id": property_id,
                "tipo_vinculo": "colaborador",
                "status": "ativo",
            },
        ])

        for talhao in document["talhoes"]:
            record = {
                "id": talhao["id"],
                "organizacao_id": ORGANIZATION_ID,
                "propriedade_id": property_id,
                "nome": talhao["nome"],
                "status": "ativo",
            }
            if talhao["codigo"]:
                record["codigo"] = talhao["codigo"]
            talhao_records.append(record)
            geometry_features.append({
                "type": "Feature",
                "id": f"geometria_{talhao['id']}",
                "properties": {
                    "geometria_id": f"geometria_{talhao['id']}",
                    "propriedade_id": property_id,
                    "talhao_id": talhao["id"],
                    "talhao_nome": talhao["nome"],
                    "area_mapeada_ha": talhao["area_hectares"],
                    "partes": talhao["part_count"],
                    "fonte": "Clientes_26.1.kml",
                },
                "geometry": mapping(talhao["geometry"]),
            })

        first_talhao_id = document["talhoes"][0]["id"] if document["talhoes"] else None
        visit_status = ("agendada", "realizada", "cancelada")[index % 3]
        visit_date = iso_date(base_date, 10 + index) if visit_status == "agendada" else iso_date(base_date, -10 - index)
        visit = {
            "id": stable_id("visita", property_id),
            "organizacao_id": ORGANIZATION_ID,
            "propriedade_id": property_id,
            "tecnico_responsavel": collaborator_name,
            "responsavel_usuario_id": collaborator_id,
            "data_visita": visit_date,
            "objetivo": "consultoria",
            "status": visit_status,
            "observacoes": "Registro demonstrativo para validação dos fluxos do aplicativo.",
            "fotos": [],
            "registro_legado": True,
        }
        if first_talhao_id and index % 2 == 0:
            visit["talhao_id"] = first_talhao_id
        visits.append(visit)

        notebook = {
            "id": stable_id("caderno", property_id),
            "organizacao_id": ORGANIZATION_ID,
            "propriedade_id": property_id,
            "responsavel_usuario_id": collaborator_id,
            "colaborador_responsavel": collaborator_name,
            "data_atividade": iso_date(base_date, -20 - index),
            "tipo_atividade": "observacao",
            "observacoes": "Registro demonstrativo de acompanhamento da Propriedade.",
            "visivel_para_produtor": index % 4 != 0,
            "fotos": [],
            "estado_caderno": "registrado_legado",
            "registro_legado": True,
            "data_criacao": iso_date(base_date, -20 - index),
        }
        if first_talhao_id and index % 2 == 1:
            notebook["talhao_id"] = first_talhao_id
        notebooks.append(notebook)

    kml_hash = hashlib.sha256(args.kml.read_bytes()).hexdigest()
    seed = {
        "dataset": {
            "id": DATASET_ID,
            "tipo": "demonstracao",
            "fonte": args.kml.name,
            "fonte_sha256": kml_hash,
            "gerado_em": GENERATED_AT,
        },
        "organizacao": {"id": ORGANIZATION_ID, "nome": "Tchê Fertilidade", "status": "ativa"},
        "usuarios": users,
        "produtores": producers,
        "propriedades": properties,
        "usuarios_propriedades": links,
        "talhoes": talhao_records,
        "visitas": visits,
        "cadernos": notebooks,
        "materiais": materials,
    }
    geometry_collection = {
        "type": "FeatureCollection",
        "name": DATASET_ID,
        "features": geometry_features,
    }
    credential_seed = {
        "dataset_id": DATASET_ID,
        "tipo": "credenciais_demonstrativas",
        "credentials": credentials,
    }
    assignment = {
        "dataset_id": DATASET_ID,
        "victor": sorted(victor_owners, key=str.casefold),
        "bruna_brito": sorted(set(owner_counts) - victor_owners, key=str.casefold),
    }

    args.seed_output.parent.mkdir(parents=True, exist_ok=True)
    args.geometry_output.parent.mkdir(parents=True, exist_ok=True)
    args.credentials_output.parent.mkdir(parents=True, exist_ok=True)
    args.assignment_output.parent.mkdir(parents=True, exist_ok=True)
    args.seed_output.write_text(json.dumps(seed, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    args.geometry_output.write_text(
        json.dumps(geometry_collection, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    args.credentials_output.write_text(
        json.dumps(credential_seed, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    args.assignment_output.write_text(json.dumps(assignment, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "dataset_id": DATASET_ID,
        "usuarios": len(users),
        "produtores": len(producers),
        "propriedades": len(properties),
        "vinculos": len(links),
        "talhoes": len(talhao_records),
        "geometrias": len(geometry_features),
        "visitas": len(visits),
        "cadernos": len(notebooks),
        "materiais": len(materials),
        "credenciais": len(credentials),
        "geometrias_reparadas": repaired_geometries,
        "victor_produtores": len(victor_owners),
        "victor_propriedades": sum(owner_counts[name] for name in victor_owners),
        "bruna_brito_produtores": len(owner_counts) - len(victor_owners),
        "bruna_brito_propriedades": sum(owner_counts.values()) - sum(owner_counts[name] for name in victor_owners),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kml", type=Path, required=True)
    parser.add_argument("--municipal-boundaries", type=Path, required=True)
    parser.add_argument("--municipalities", type=Path, required=True)
    parser.add_argument("--seed-output", type=Path, required=True)
    parser.add_argument("--geometry-output", type=Path, required=True)
    parser.add_argument("--credentials-output", type=Path, required=True)
    parser.add_argument("--assignment-output", type=Path, required=True)
    return parser.parse_args()


if __name__ == "__main__":
    result = generate(parse_args())
    print(json.dumps(result, ensure_ascii=False, indent=2))
