"""Resolves a human-facing cluster name to the exact area_name_en DLD's
API filters on. See config/clusters.yml for why this indirection exists --
the marketing name and the DLD area name frequently differ.
"""
from __future__ import annotations

import yaml

from .config import CONFIG_DIR


def load_clusters() -> list[dict]:
    path = CONFIG_DIR / "clusters.yml"
    if not path.exists():
        return []
    data = yaml.safe_load(path.read_text()) or {}
    return data.get("clusters", [])


def resolve_area(name: str) -> tuple[str, str]:
    """Resolve a configured display name or DLD area name, rejecting typos."""
    for cluster in load_clusters():
        if name == cluster.get("display_name") or name == cluster.get("area_name_en"):
            return cluster["area_name_en"], cluster.get("display_name", name)
    raise ValueError(f"Unknown cluster or DLD area: {name}. Use --raw-area for an unconfigured DLD area.")
