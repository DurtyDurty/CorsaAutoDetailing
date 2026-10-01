"""Read ads/.env (git-ignored) without printing or logging any value."""

from __future__ import annotations

import os
from pathlib import Path

from .config import ADS_DIR


def load_env(path: Path = ADS_DIR / ".env") -> dict[str, str]:
    """Process environment wins over the file, so CI or a shell can override."""
    values: dict[str, str] = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip().strip('"').strip("'")
    values.update({k: v for k, v in os.environ.items() if k.startswith("GOOGLE_ADS_")})
    return values
