"""
Hyperion AI — Scoring Engine
Rule 4A: Dual risk scores (political + operational) — never blended into a single opaque composite.
Rule 4B: Profile-driven dynamic re-weighting.
Rule 4D: Component sub-scores and weightings always visible.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DATA_DIR = Path(__file__).parent

SCHEMA_ID = "hyperion-jurisdiction-v1"

PROFILES: dict[str, str] = {
    "low_risk_core": "Low Risk Core Infrastructure",
    "value_add":     "Value-Add / Development",
    "esg_impact":    "ESG Impact",
}

TECHNOLOGIES: list[str] = ["solar", "onshore_wind", "offshore_wind"]

# ---------------------------------------------------------------------------
# Profile weight tables
# Rule 4B: each profile shifts emphasis across eight scoring dimensions.
# All weights must sum to exactly 1.0.
#
# Dimensions:
#   political          — Rule 4A(i): expropriation, retroactive cuts, track record
#   operational        — Rule 4A(ii): grid queue, permitting, bureaucratic friction (inverted drag)
#   mechanism_quality  — strength of revenue floor (two-way CfD > one-way premium > merchant)
#   permitting         — speed to reach ready-to-build (months, technology-specific)
#   tax                — effective CIT + timing incentives
#   ppa                — PPA enforceability and bankability
#   state_aid          — EU State Aid clawback risk (non-EU = no risk)
#   esg_alignment      — RES target alignment, additionality, carbon reduction
# ---------------------------------------------------------------------------

PROFILE_WEIGHTS: dict[str, dict[str, float]] = {
    "low_risk_core": {
        # Stability and revenue certainty dominate — Rule 4B(i)
        "political":         0.30,
        "operational":       0.15,
        "mechanism_quality": 0.22,
        "permitting":        0.08,
        "tax":               0.08,
        "ppa":               0.10,
        "state_aid":         0.07,
        "esg_alignment":     0.00,
    },
    "value_add": {
        # Speed to market and return uplift dominate — Rule 4B(ii)
        "political":         0.12,
        "operational":       0.15,
        "mechanism_quality": 0.10,
        "permitting":        0.25,
        "tax":               0.20,
        "ppa":               0.08,
        "state_aid":         0.05,
        "esg_alignment":     0.05,
    },
    "esg_impact": {
        # Additionality and carbon alignment alongside financial return — Rule 4B(iii)
        "political":         0.15,
        "operational":       0.10,
        "mechanism_quality": 0.15,
        "permitting":        0.10,
        "tax":               0.08,
        "ppa":               0.10,
        "state_aid":         0.07,
        "esg_alignment":     0.25,
    },
}

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ComponentScores:
    political: float
    operational: float
    mechanism_quality: float
    permitting: float
    tax: float
    ppa: float
    state_aid: float
    esg_alignment: float

    def as_dict(self) -> dict[str, float]:
        return {
            "political":         round(self.political, 1),
            "operational":       round(self.operational, 1),
            "mechanism_quality": round(self.mechanism_quality, 1),
            "permitting":        round(self.permitting, 1),
            "tax":               round(self.tax, 1),
            "ppa":               round(self.ppa, 1),
            "state_aid":         round(self.state_aid, 1),
            "esg_alignment":     round(self.esg_alignment, 1),
        }


@dataclass
class JurisdictionScore:
    """
    Full scored result for one jurisdiction.
    Rule 4A: political_risk_raw and operational_drag_raw are always surfaced separately.
    Rule 4D: component_scores and weights always accompany the composite.
    """
    name: str
    iso_code: str
    composite_score: float
    profile_applied: str
    technology_applied: str
    component_scores: ComponentScores
    weights: dict[str, float]

    # Rule 4A — raw dual scores (never merged)
    political_risk_raw: int       # higher = lower risk = better
    operational_drag_raw: int     # higher = more drag = worse

    # Rule 5A — stop/go signal
    rag_overall: str              # GREEN / AMBER / RED

    # Rule 5B — comparison table fields for standardised output
    comparison_table: dict

    alerts: list[str] = field(default_factory=list)
    recommendation: str = ""

    @property
    def rag_colour(self) -> str:
        return self.rag_overall


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_all_jurisdictions(data_dir: Path = DATA_DIR) -> list[dict]:
    """Load every file tagged with the hyperion-jurisdiction-v1 schema."""
    jurisdictions: list[dict] = []
    for path in sorted(data_dir.glob("*.json")):
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
            if data.get("_schema") == SCHEMA_ID:
                jurisdictions.append(data)
        except (json.JSONDecodeError, OSError):
            continue
    return jurisdictions


# ---------------------------------------------------------------------------
# Sub-scorers — all return 0–100 where higher = better
# ---------------------------------------------------------------------------

def _score_political(jdata: dict) -> float:
    """Rule 4A(i): sovereign quality score (already 0–100 higher=better)."""
    return float(jdata["comparison_table"]["6_political_risk_score"])


def _score_operational(jdata: dict) -> float:
    """Rule 4A(ii): invert operational drag so higher = less drag = better."""
    return 100.0 - float(jdata["comparison_table"]["7_operational_drag_score"])


def _score_mechanism(jdata: dict, profile: str) -> float:
    """
    Rule 3A: never conflate mechanism types. Score each according to profile.
    two_way_cfd:          maximum downside protection, upside capped — best for low_risk_core.
    one_way_market_premium: floor but uncapped upside — balanced.
    merchant / absent:    no state backstop — best for value_add, worst for low_risk_core.
    """
    mechanism = jdata["comparison_table"].get("3_mechanism_type_code", "")

    table = {
        "two_way_cfd": {
            "low_risk_core": 95.0,
            "value_add":     52.0,
            "esg_impact":    78.0,
        },
        "one_way_market_premium": {
            "low_risk_core": 80.0,
            "value_add":     76.0,
            "esg_impact":    80.0,
        },
    }
    merchant_scores = {"low_risk_core": 25.0, "value_add": 90.0, "esg_impact": 48.0}

    row = table.get(mechanism, merchant_scores)
    if isinstance(row, dict):
        return row.get(profile, 60.0)
    return float(row)


def _score_permitting(jdata: dict, technology: str) -> float:
    """
    Shorter permitting timeline → higher score.
    Normalised linearly: 6 months = 100, 96 months = 0.
    """
    ct = jdata["comparison_table"]
    permitting_section = jdata.get("permitting", {})

    if technology == "solar":
        months = ct.get("1_permitting_window_solar_p50_months")
    elif technology == "offshore_wind":
        try:
            months = permitting_section["offshore_wind"]["timeline_p50_months"]
        except (KeyError, TypeError):
            months = ct.get("1_permitting_window_months_p50")
    else:  # onshore_wind (default)
        months = ct.get("1_permitting_window_months_p50")

    if months is None:
        months = 36.0
    months = float(months)
    return max(0.0, min(100.0, 100.0 - ((months - 6.0) / 90.0) * 100.0))


def _score_tax(jdata: dict) -> float:
    """
    Rule 3B: lower effective CIT = higher score.
    Normalised: 0% CIT = 100, 40% CIT = 0.
    Distributed-profit models (Estonia, Latvia — 0% retained) score near 100.
    """
    rate = jdata["comparison_table"].get("4_effective_corporation_tax_rate_pct")
    if rate is None:
        rate = 25.0
    rate = float(rate)
    return max(0.0, min(100.0, 100.0 - (rate / 40.0) * 100.0))


def _score_ppa(jdata: dict) -> float:
    """Rule 5B category 5: PPA enforceability rating → numeric score."""
    rating = jdata["comparison_table"].get("5_ppa_enforceability_rating", "Medium")
    mapping = {
        "Very High":   95.0,
        "High":        85.0,
        "Medium-High": 72.0,
        "Medium":      55.0,
        "Low-Medium":  38.0,
        "Low":         22.0,
        "Very Low":    10.0,
    }
    return mapping.get(rating, 55.0)


def _score_state_aid(jdata: dict) -> float:
    """
    Rule 4C: EU State Aid retrospective clawback risk.
    Non-EU members have no EC clawback exposure — score 88 (non-zero because
    national retroactive risk remains possible).
    """
    if not jdata["jurisdiction"].get("eu_member", False):
        return 88.0

    try:
        risk_str = jdata["eu_state_aid"]["retrospective_clawback_risk"]["assessment"]
    except (KeyError, TypeError):
        risk_str = "Medium"

    mapping = {
        "Very Low":   95.0,
        "Low":        88.0,
        "Low-Medium": 75.0,
        "Medium":     55.0,
        "High":       25.0,
        "Very High":  10.0,
    }
    return mapping.get(risk_str, 55.0)


def _score_esg(jdata: dict) -> float:
    """
    Proxy ESG/additionality score.
    Components: EU RED III membership, positive support mechanism availability,
    positive permitting signal for solar (cleanest technology).
    """
    score = 50.0
    if jdata["jurisdiction"].get("eu_member"):
        score += 15.0  # EU RED III + Green Deal alignment
    rag = jdata.get("rag_matrix", {})
    if rag.get("support_mechanism_availability", {}).get("rag") == "GREEN":
        score += 10.0
    if rag.get("permitting_window_solar", {}).get("rag") == "GREEN":
        score += 10.0
    if rag.get("political_risk", {}).get("rag") == "GREEN":
        score += 10.0
    return min(95.0, score)


# ---------------------------------------------------------------------------
# Alert generation
# ---------------------------------------------------------------------------

def _generate_alerts(jdata: dict, profile: str) -> list[str]:
    """
    Surface material warnings per Rules 1B, 3A, 4A, 4B, 4C.
    Alerts are additive — all relevant warnings are shown.
    """
    alerts: list[str] = []
    ct = jdata["comparison_table"]
    mechanism = ct.get("3_mechanism_type_code", "")
    name = jdata["jurisdiction"]["name"]

    # Rule 3A — merchant exposure conflict for low_risk_core
    if profile == "low_risk_core" and mechanism not in ("two_way_cfd", "one_way_market_premium"):
        alerts.append(
            "ALERT [Rule 3A]: No state-backed revenue floor identified. Merchant exposure "
            "conflicts with Low Risk Core Infrastructure profile — heavily penalised."
        )

    # Rule 4A — retroactive policy incidents
    retroactive = jdata.get("sovereign_risk", {}).get("retroactive_policy_incidents", [])
    high_sev = [i for i in retroactive if "high" in str(i.get("severity", "")).lower()]
    if high_sev:
        alerts.append(
            f"ALERT [Rule 4A(i)]: {len(high_sev)} HIGH-severity retroactive policy "
            f"incident(s) recorded for {name}. Review sovereign_risk section before committing capital."
        )

    # Rule 3C — non-EUR currency risk for low_risk_core
    currency = jdata["jurisdiction"].get("currency_native", "EUR")
    if currency != "EUR" and profile == "low_risk_core":
        alerts.append(
            f"ALERT [Rule 3C]: Non-EUR currency ({currency}). FX volatility materially "
            "affects revenue certainty — incompatible with Low Risk Core profile without hedging."
        )

    # Rule 4A(ii) — high operational drag
    drag = ct.get("7_operational_drag_score", 0)
    if drag >= 75:
        alerts.append(
            f"ALERT [Rule 4A(ii)]: Operational drag score {drag}/100 (HIGH). "
            "Verify grid connection queue and permitting timeline before assuming development schedule."
        )

    # Rule 4A(i) — low political risk score
    pol = ct.get("6_political_risk_score", 100)
    if pol < 65:
        alerts.append(
            f"ALERT [Rule 4A(i)]: Political risk score {pol}/100 (BELOW THRESHOLD). "
            "Sub-investment-grade sovereign environment — not recommended for low-risk profiles."
        )

    # Rule 4C — EU State Aid clawback
    if jdata["jurisdiction"].get("eu_member"):
        try:
            sa_risk = jdata["eu_state_aid"]["retrospective_clawback_risk"]["assessment"]
            if sa_risk in ("High", "Very High"):
                alerts.append(
                    f"ALERT [Rule 4C]: EU State Aid retrospective clawback risk rated '{sa_risk}'. "
                    "Scheme may lack formal EC notification clearance — material clawback exposure."
                )
        except (KeyError, TypeError):
            pass

    # Rule 5A — RED overall stop/go
    if jdata.get("rag_matrix", {}).get("overall_stop_go") == "RED":
        alerts.append(
            "STOP [Rule 5A]: Jurisdiction overall RAG is RED. "
            "Do not proceed without specific mitigation for all flagged material concerns."
        )

    return alerts


# ---------------------------------------------------------------------------
# RAG derivation
# ---------------------------------------------------------------------------

def _composite_to_rag(score: float) -> str:
    """Convert numeric composite to RAG. Thresholds are profile-agnostic."""
    if score >= 72.0:
        return "GREEN"
    elif score >= 52.0:
        return "AMBER"
    return "RED"


# ---------------------------------------------------------------------------
# Core scoring function
# ---------------------------------------------------------------------------

def score_jurisdiction(jdata: dict, profile: str, technology: str) -> JurisdictionScore:
    """
    Score a single jurisdiction against a user profile and technology.
    Returns a JurisdictionScore with all components visible (Rule 4D).
    """
    if profile not in PROFILE_WEIGHTS:
        raise ValueError(f"Unknown profile '{profile}'. Valid: {list(PROFILES)}")
    if technology not in TECHNOLOGIES:
        raise ValueError(f"Unknown technology '{technology}'. Valid: {TECHNOLOGIES}")

    weights = PROFILE_WEIGHTS[profile]

    components = ComponentScores(
        political=         _score_political(jdata),
        operational=       _score_operational(jdata),
        mechanism_quality= _score_mechanism(jdata, profile),
        permitting=        _score_permitting(jdata, technology),
        tax=               _score_tax(jdata),
        ppa=               _score_ppa(jdata),
        state_aid=         _score_state_aid(jdata),
        esg_alignment=     _score_esg(jdata),
    )

    raw = components.as_dict()
    composite = sum(weights[k] * raw[k] for k in weights)
    rag = _composite_to_rag(composite)
    alerts = _generate_alerts(jdata, profile)

    if rag == "GREEN":
        rec = "Proceed — jurisdiction meets profile criteria. Commission site-level due diligence."
    elif rag == "AMBER":
        rec = "Proceed with conditions — resolve flagged alerts before committing capital."
    else:
        rec = "Do not proceed without specific mitigation for all flagged material concerns."

    return JurisdictionScore(
        name=                jdata["jurisdiction"]["name"],
        iso_code=            jdata["jurisdiction"]["iso_code"],
        composite_score=     round(composite, 1),
        profile_applied=     profile,
        technology_applied=  technology,
        component_scores=    components,
        weights=             weights,
        political_risk_raw=  jdata["comparison_table"]["6_political_risk_score"],
        operational_drag_raw=jdata["comparison_table"]["7_operational_drag_score"],
        rag_overall=         rag,
        comparison_table=    jdata["comparison_table"],
        alerts=              alerts,
        recommendation=      rec,
    )


# ---------------------------------------------------------------------------
# Batch ranking
# ---------------------------------------------------------------------------

def rank_jurisdictions(
    profile: str,
    technology: str,
    target_iso_codes: Optional[list[str]] = None,
    data_dir: Path = DATA_DIR,
) -> list[JurisdictionScore]:
    """
    Load, score, and rank all (or selected) jurisdictions.
    Returns list sorted descending by composite_score.
    Rule 7A: caller must have confirmed profile before calling this function.
    """
    all_data = load_all_jurisdictions(data_dir)

    if target_iso_codes:
        codes = {c.upper() for c in target_iso_codes}
        all_data = [j for j in all_data if j["jurisdiction"]["iso_code"].upper() in codes]

    scored = [score_jurisdiction(j, profile, technology) for j in all_data]
    return sorted(scored, key=lambda s: s.composite_score, reverse=True)


# ---------------------------------------------------------------------------
# Financial metric helpers — Rule 3D
# ---------------------------------------------------------------------------

def estimate_lcoe(
    capex_eur_per_mw: float,
    opex_eur_per_mw_year: float,
    capacity_factor_pct: float,
    project_life_years: int = 25,
    wacc_pct: float = 7.0,
) -> float:
    """
    Levelised Cost of Energy (LCOE) in EUR/MWh.
    Rule 3C: inputs must be in EUR (caller responsible for conversion).
    Rule 3D outputs are nominal unless stated otherwise.
    """
    wacc = wacc_pct / 100.0
    hours_per_year = 8_760
    annual_output_mwh = (capacity_factor_pct / 100.0) * hours_per_year  # per MW installed

    # Capital recovery factor
    crf = (wacc * (1 + wacc) ** project_life_years) / ((1 + wacc) ** project_life_years - 1)
    annualised_capex = capex_eur_per_mw * crf

    total_annual_cost = annualised_capex + opex_eur_per_mw_year
    return round(total_annual_cost / annual_output_mwh, 2)


def estimate_simple_payback(
    capex_eur_per_mw: float,
    revenue_eur_mwh: float,
    capacity_factor_pct: float,
    opex_eur_per_mw_year: float,
) -> float:
    """
    CapEx payback period in years (simple, pre-tax).
    Rule 3D: does not account for tax shield or financing structure.
    """
    hours_per_year = 8_760
    annual_revenue = revenue_eur_mwh * (capacity_factor_pct / 100.0) * hours_per_year
    net_annual = annual_revenue - opex_eur_per_mw_year
    if net_annual <= 0:
        return float("inf")
    return round(capex_eur_per_mw / net_annual, 2)


def npv_tax_shield_timing_benefit(
    capex_eur: float,
    cit_rate_pct: float,
    accelerated_pct: float,
    straight_line_years: int,
    wacc_pct: float,
) -> float:
    """
    Rule 3B: NPV of the tax shield timing benefit from accelerated depreciation
    vs straight-line, at the stated WACC.
    Returns EUR value of the timing advantage.
    """
    wacc = wacc_pct / 100.0
    cit = cit_rate_pct / 100.0
    accel = accelerated_pct / 100.0

    # Accelerated: deduct `accel * capex` in year 1, remainder over `straight_line_years`
    accel_deductions: list[float] = [accel * capex_eur] + [
        ((1 - accel) * capex_eur / (straight_line_years - 1)) if straight_line_years > 1 else 0.0
        for _ in range(straight_line_years - 1)
    ]

    # Straight-line baseline
    sl_annual = capex_eur / straight_line_years
    sl_deductions = [sl_annual] * straight_line_years

    max_years = max(len(accel_deductions), len(sl_deductions))
    npv_accel = sum(
        cit * (accel_deductions[i] if i < len(accel_deductions) else 0.0) / (1 + wacc) ** (i + 1)
        for i in range(max_years)
    )
    npv_sl = sum(
        cit * (sl_deductions[i] if i < len(sl_deductions) else 0.0) / (1 + wacc) ** (i + 1)
        for i in range(max_years)
    )
    return round(npv_accel - npv_sl, 2)


# ---------------------------------------------------------------------------
# Disclaimer — Rule 6 (verbatim, non-negotiable)
# ---------------------------------------------------------------------------

DISCLAIMER = (
    "This output is produced by Hyperion AI for indicative jurisdiction-screening purposes only. "
    "It does not constitute legal or financial advice. Users should obtain qualified local legal "
    "and financial counsel before committing capital. "
    "Hyperion AI complies with SRA Standards and Regulations (15/12/24 edition)."
)
