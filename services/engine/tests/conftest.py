import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from engine.actions import Action
from engine.cash.profile import CompanyProfile, base_calendar

PROFILE_DICT = json.loads((ROOT / "fixtures" / "company_demo_agency.json").read_text())


@pytest.fixture(scope="session")
def profile() -> CompanyProfile:
    return CompanyProfile.from_dict(PROFILE_DICT)


@pytest.fixture(scope="session")
def profile_dict() -> dict:
    return PROFILE_DICT


@pytest.fixture(scope="session")
def base(profile) -> list:
    return base_calendar(profile, 180)


def project(**overrides) -> Action:
    params = dict(
        total_revenue_cents=80_000_000,
        initial_cost_cents=38_000_000,
        advance_pct=0,
        collection_days=60,
        hires=2,
    )
    params.update(overrides)
    return Action("accept_project", params)
