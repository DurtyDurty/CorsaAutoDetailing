"""Strip secrets and personal data from anything printed or logged."""

from __future__ import annotations

import os
import re

_PATTERNS = [
    (re.compile(r"ya29\.[0-9A-Za-z_\-.]+"), "[access-token]"),
    (re.compile(r"1//[0-9A-Za-z_\-]{20,}"), "[refresh-token]"),
    (re.compile(r"GOCSPX-[0-9A-Za-z_\-]+"), "[client-secret]"),
    (re.compile(r"(?i)(developer[-_ ]?token|refresh[-_ ]?token|client[-_ ]?secret|access[-_ ]?token|authorization)([\"']?\s*[:=]\s*[\"']?)(Bearer\s+)?[^\s\"',}]+"), r"\1\2[redacted]"),
    (re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"), "[email]"),
    # Needs separators, so Google Ads customer ids (always printed as plain digits here) aren't mistaken for phones.
    (re.compile(r"(?<!\d)(?:\+?1[\s.\-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.\-])\d{3}[\s.\-]\d{4}(?!\d)"), "[phone]"),
]

_SECRET_ENV = ("GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CLIENT_ID")


def redact(text: str, env: dict[str, str] | None = None) -> str:
    env = env if env is not None else dict(os.environ)
    for k in _SECRET_ENV:
        v = env.get(k)
        if v and len(v) >= 6:
            text = text.replace(v, f"[{k.lower()}]")
    for pattern, repl in _PATTERNS:
        text = pattern.sub(repl, text)
    return text
