/**
 * Hyperion AI — Scoring Engine (JavaScript / Browser)
 *
 * Rule 4A : Dual risk scores (political + operational) — never blended.
 * Rule 4B : Profile-driven dynamic re-weighting.
 * Rule 4D : Component sub-scores and weightings always visible in output.
 * Rule 3A : Support-mechanism types never conflated.
 * Rule 3B : Tax incentives evaluated as NPV timing benefits.
 * Rule 3D : Financial metric helpers (LCOE, payback, NPV tax shield).
 * Rule 6  : Disclaimer footer — verbatim, non-negotiable.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCHEMA_ID = "hyperion-jurisdiction-v1";

export const PROFILES = {
  low_risk_core: "Low Risk Core Infrastructure",
  value_add:     "Value-Add / Development",
  esg_impact:    "ESG Impact",
};

export const TECHNOLOGIES = [
  "solar", "onshore_wind", "offshore_wind",
  "bess", "green_hydrogen", "floating_solar", "nuclear_smr", "lng_gas",
  "data_centre", "natural_gas_lng", "biowaste_energy", "coal_energy",
];

/**
 * All 30 jurisdiction JSON file paths, relative to the site root.
 * Update this list if files are moved to a sub-folder.
 */
export const JURISDICTION_FILES = [
  "Austria.json",    "Belgium.json",     "Bulgaria.json",  "Croatia.json",
  "Cyprus.json",     "Czechia.json",     "Denmark.json",   "Estonia.json",
  "Finland.json",    "France.json",      "Germany.json",   "Greece.json",
  "Hungary.json",    "Ireland.json",     "Italy.json",     "Latvia.json",
  "Lithuania.json",  "Luxembourg.json",  "Malta.json",     "Netherlands.json",
  "Norway.json",     "Poland.json",      "Portugal.json",  "Romania.json",
  "Slovakia.json",   "Slovenia.json",    "Spain.json",     "Sweden.json",
  "Switzerland.json","UK.json",
];

// ---------------------------------------------------------------------------
// Technology-specific weight tables (5 factors each, summing to 1.0).
// These are BLENDED with profile weights in getEffectiveWeights().
// For the 3 original technologies no tech weights exist — pure profile weights apply.
// ---------------------------------------------------------------------------

export const TECHNOLOGY_WEIGHTS = {
  bess: {
    // Grid access & ancillary services market depth are the critical factors for BESS.
    political: 0.15, operational: 0.30, mechanism_quality: 0.20,
    permitting: 0.25, tax: 0.10, ppa: 0.00, state_aid: 0.00, esg_alignment: 0.00,
  },
  green_hydrogen: {
    // Mechanism (H2 Bank/IPCEI) and policy stability dominate; novel regulatory pathway.
    political: 0.25, operational: 0.10, mechanism_quality: 0.30,
    permitting: 0.20, tax: 0.00, ppa: 0.00, state_aid: 0.15, esg_alignment: 0.00,
  },
  floating_solar: {
    // Additional water-body consent adds permitting weight vs ground solar.
    political: 0.20, operational: 0.15, mechanism_quality: 0.25,
    permitting: 0.30, tax: 0.10, ppa: 0.00, state_aid: 0.00, esg_alignment: 0.00,
  },
  nuclear_smr: {
    // Nuclear policy is the binary gate; permitting timelines are extreme.
    political: 0.35, operational: 0.05, mechanism_quality: 0.20,
    permitting: 0.30, tax: 0.00, ppa: 0.00, state_aid: 0.10, esg_alignment: 0.00,
  },
  lng_gas: {
    political: 0.30, operational: 0.20, mechanism_quality: 0.15,
    permitting: 0.25, tax: 0.00, ppa: 0.00, state_aid: 0.10, esg_alignment: 0.00,
  },
  data_centre: {
    // Power availability and grid stability are the critical gate factors for data-centre CapEx.
    political: 0.25, operational: 0.30, mechanism_quality: 0.15,
    permitting: 0.20, tax: 0.10, ppa: 0.00, state_aid: 0.00, esg_alignment: 0.00,
  },
  natural_gas_lng: {
    // Gas-fired power generation: stranded-asset political risk and EU taxonomy dominate.
    political: 0.30, operational: 0.20, mechanism_quality: 0.15,
    permitting: 0.25, tax: 0.00, ppa: 0.00, state_aid: 0.10, esg_alignment: 0.00,
  },
  biowaste_energy: {
    // Mechanism quality and waste-policy stability drive viability; sustainability criteria critical.
    political: 0.20, operational: 0.15, mechanism_quality: 0.25,
    permitting: 0.25, tax: 0.00, ppa: 0.00, state_aid: 0.15, esg_alignment: 0.00,
  },
  coal_energy: {
    // Stranded-asset political risk and permitting hostility dominate; no state support in most EU markets.
    political: 0.35, operational: 0.15, mechanism_quality: 0.15,
    permitting: 0.25, tax: 0.10, ppa: 0.00, state_aid: 0.00, esg_alignment: 0.00,
  },
};

/**
 * Blend profile weights with technology-specific weights (60/40 split).
 * For technologies without a TECHNOLOGY_WEIGHTS entry, pure profile weights apply.
 * Result is renormalised to sum exactly 1.0.
 */
function getEffectiveWeights(profile, technology) {
  const pw = PROFILE_WEIGHTS[profile];
  const tw = TECHNOLOGY_WEIGHTS[technology];
  if (!tw) return pw;

  const blended = {};
  Object.keys(pw).forEach(k => {
    blended[k] = 0.60 * pw[k] + 0.40 * (tw[k] ?? 0);
  });
  const sum = Object.values(blended).reduce((a, b) => a + b, 0);
  Object.keys(blended).forEach(k => { blended[k] = blended[k] / sum; });
  return blended;
}

// ---------------------------------------------------------------------------
// Profile weight tables
// Rule 4B: each profile shifts emphasis across eight scoring dimensions.
// All weights must sum to 1.0.
// ---------------------------------------------------------------------------

export const PROFILE_WEIGHTS = {
  low_risk_core: {
    political:         0.30,  // Sovereign quality dominates — Rule 4B(i)
    operational:       0.15,
    mechanism_quality: 0.22,  // Revenue floor certainty — penalise merchant
    permitting:        0.08,
    tax:               0.08,
    ppa:               0.10,
    state_aid:         0.07,
    esg_alignment:     0.00,
  },
  value_add: {
    political:         0.12,  // Tolerate moderate political risk — Rule 4B(ii)
    operational:       0.15,
    mechanism_quality: 0.10,  // Merchant upside acceptable
    permitting:        0.25,  // Speed to market is primary driver
    tax:               0.20,  // Timing benefit / accelerated depreciation
    ppa:               0.08,
    state_aid:         0.05,
    esg_alignment:     0.05,
  },
  esg_impact: {
    political:         0.15,
    operational:       0.10,
    mechanism_quality: 0.15,
    permitting:        0.10,
    tax:               0.08,
    ppa:               0.10,
    state_aid:         0.07,
    esg_alignment:     0.25,  // Additionality + carbon alignment — Rule 4B(iii)
  },
};

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

/**
 * Load a single jurisdiction JSON from a URL/path.
 * @param {string} path
 * @returns {Promise<object|null>}
 */
async function loadJurisdiction(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const data = await res.json();
    return data._schema === SCHEMA_ID ? data : null;
  } catch {
    return null;
  }
}

/**
 * Load all jurisdiction JSON files in parallel.
 * @param {string} [basePath=""] - Path prefix (e.g. "data/" if files are in a subfolder)
 * @returns {Promise<object[]>}
 */
export async function loadAllJurisdictions(basePath = "") {
  const results = await Promise.all(
    JURISDICTION_FILES.map((f) => loadJurisdiction(basePath + f))
  );
  return results.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Sub-scorers — all return 0–100 where higher = better
// ---------------------------------------------------------------------------

/** Rule 4A(i): sovereign quality score (already 0–100, higher = better). */
function scorePolitical(jdata) {
  return Number(jdata.comparison_table["6_political_risk_score"]);
}

/** Rule 4A(ii): invert operational drag so higher = less drag = better. */
function scoreOperational(jdata) {
  return 100 - Number(jdata.comparison_table["7_operational_drag_score"]);
}

/**
 * Rule 3A: never conflate mechanism types.
 * Covers legacy types (solar/wind) plus 5 new technology mechanism types.
 * For new technologies, mechanism is read from jdata.new_technology_data[technology].
 */
function scoreMechanism(jdata, profile, technology) {
  const ntd = jdata.new_technology_data?.[technology];
  const isNewTech = TECHNOLOGY_WEIGHTS[technology] != null;

  const mechanism = isNewTech
    ? (ntd?.mechanism_type_code ?? "merchant")
    : (jdata.comparison_table["3_mechanism_type_code"] || "");

  const table = {
    two_way_cfd:                          { low_risk_core: 95, value_add: 52, esg_impact: 78 },
    one_way_market_premium:               { low_risk_core: 80, value_add: 76, esg_impact: 80 },
    quota_certificate_with_minimum_price: { low_risk_core: 70, value_add: 70, esg_impact: 70 },
    // BESS
    ancillary_services:                   { low_risk_core: 55, value_add: 78, esg_impact: 60 },
    capacity_market:                      { low_risk_core: 72, value_add: 62, esg_impact: 58 },
    // Green Hydrogen
    hydrogen_contract:                    { low_risk_core: 85, value_add: 68, esg_impact: 92 },
    ipcei_grant:                          { low_risk_core: 70, value_add: 82, esg_impact: 90 },
    // Nuclear SMR
    government_contract:                  { low_risk_core: 88, value_add: 48, esg_impact: 68 },
    // LNG & Gas / Natural Gas
    tolling_arrangement:                  { low_risk_core: 55, value_add: 80, esg_impact: 42 },
    // Data-centre
    corporate_ppa:                        { low_risk_core: 65, value_add: 80, esg_impact: 72 },
    captive_generation:                   { low_risk_core: 60, value_add: 75, esg_impact: 55 },
    // Biowaste to Energy
    feed_in_tariff:                       { low_risk_core: 82, value_add: 65, esg_impact: 82 },
    biowaste_auction_cfd:                 { low_risk_core: 88, value_add: 60, esg_impact: 85 },
  };
  const merchantScores = { low_risk_core: 25, value_add: 90, esg_impact: 48 };

  const row = table[mechanism] ?? merchantScores;
  return row[profile] ?? 60;
}

/**
 * Shorter permitting timeline → higher score.
 * Each technology uses its own normalisation range to reflect realistic timescales.
 * New technology data is read from jdata.new_technology_data[technology].
 */
function scorePermitting(jdata, technology) {
  const ct  = jdata.comparison_table;
  const ntd = jdata.new_technology_data?.[technology];

  // [minMonths, maxMonths] define the normalisation range (min → 100, max → 0).
  const RANGES = {
    solar:           [6,   96],
    onshore_wind:    [6,   96],
    offshore_wind:   [6,   96],
    bess:            [6,   60],
    green_hydrogen:  [12,  120],
    floating_solar:  [6,   96],
    nuclear_smr:     [24,  240],
    lng_gas:         [12,  96],
    data_centre:     [6,   60],   // Planning consent for hyperscale facilities
    natural_gas_lng: [12,  96],   // Environmental permitting for gas plant
    biowaste_energy: [12,  84],   // Waste/environmental permits — complex but bounded
    coal_energy:     [24,  180],  // New coal faces extreme environmental opposition and public inquiry risk
  };

  const DEFAULTS = {
    bess: 18, green_hydrogen: 48, floating_solar: 24,
    nuclear_smr: 180, lng_gas: 36,
    data_centre: 24, natural_gas_lng: 36, biowaste_energy: 30, coal_energy: 60,
  };

  let months;
  switch (technology) {
    case "solar":
      months = ct["1_permitting_window_solar_p50_months"];
      break;
    case "offshore_wind":
      months = jdata.permitting?.offshore_wind?.timeline_p50_months
            ?? ct["1_permitting_window_months_p50"];
      break;
    case "bess":
    case "green_hydrogen":
    case "floating_solar":
    case "nuclear_smr":
    case "lng_gas":
    case "data_centre":
    case "natural_gas_lng":
    case "biowaste_energy":
    case "coal_energy":
      months = ntd?.permitting_p50_months;
      if (months == null) months = DEFAULTS[technology];
      break;
    default:
      months = ct["1_permitting_window_months_p50"];
  }

  if (months == null) months = 36;
  months = Number(months);

  const [minM, maxM] = RANGES[technology] ?? [6, 96];
  return Math.max(0, Math.min(100, 100 - ((months - minM) / (maxM - minM)) * 100));
}

/**
 * Rule 3B: lower effective CIT → higher score.
 * Normalised: 0% CIT = 100, 40% CIT = 0.
 * Estonia/Latvia distributed-profit model (effective 0% retained) scores near 100.
 */
function scoreTax(jdata) {
  const raw = jdata.comparison_table["4_effective_corporation_tax_rate_pct"] ?? 25;
  // Some JSON files store a descriptive string (e.g. "15% CIT …"); parseFloat
  // extracts the leading number correctly whereas Number() returns NaN.
  let rate = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (isNaN(rate)) rate = 25;
  return Math.max(0, Math.min(100, 100 - (rate / 40) * 100));
}

/** Rule 5B category 5: PPA enforceability rating → numeric score. */
function scorePpa(jdata) {
  const rating = jdata.comparison_table["5_ppa_enforceability_rating"] || "Medium";
  const mapping = {
    "Very High":   95,
    "High":        85,
    "Medium-High": 72,
    "Medium":      55,
    "Low-Medium":  38,
    "Low":         22,
    "Very Low":    10,
  };
  return mapping[rating] ?? 55;
}

/**
 * Rule 4C: EU State Aid retrospective clawback risk.
 * Non-EU members have no EC clawback exposure.
 */
function scoreStateAid(jdata) {
  if (!jdata.jurisdiction.eu_member) return 88;

  const riskStr = jdata.eu_state_aid?.retrospective_clawback_risk?.assessment || "Medium";
  const mapping = {
    "Very Low":   95,
    "Low":        88,
    "Low-Medium": 75,
    "Medium":     55,
    "High":       25,
    "Very High":  10,
  };
  return mapping[riskStr] ?? 55;
}

/**
 * Proxy ESG/additionality score.
 * EU RED III membership, positive support mechanism, positive solar permitting signal.
 * Technology-specific adjustments applied: green hydrogen +15, nuclear SMR −20, LNG −35.
 */
function scoreEsg(jdata, technology = null) {
  let score = 50;
  if (jdata.jurisdiction.eu_member) score += 15;
  const rag = jdata.rag_matrix || {};
  if (rag.support_mechanism_availability?.rag === "GREEN") score += 10;
  if (rag.permitting_window_solar?.rag === "GREEN") score += 10;
  if (rag.political_risk?.rag === "GREEN") score += 10;

  if (technology === "green_hydrogen")  score += 15;  // Strong additionality signal
  if (technology === "biowaste_energy") score += 10;  // Circular economy; waste diversion
  if (technology === "nuclear_smr")     score -= 20;  // ESG-divisive; EU taxonomy excluded
  if (technology === "lng_gas")         score -= 35;  // Fossil fuel; stranded-asset risk
  if (technology === "natural_gas_lng") score -= 30;  // Gas-fired power; taxonomy transitional only
  if (technology === "coal_energy")     score -= 50;  // Highest carbon emitter; EU taxonomy excluded; severe stranded-asset risk

  return Math.min(95, Math.max(0, score));
}

// ---------------------------------------------------------------------------
// Alert generation
// ---------------------------------------------------------------------------

/**
 * Surface material warnings per Rules 1B, 3A, 4A, 4B, 4C.
 * @param {object} jdata
 * @param {string} profile
 * @returns {string[]}
 */
function generateAlerts(jdata, profile) {
  const alerts = [];
  const ct = jdata.comparison_table;
  const mechanism = ct["3_mechanism_type_code"] || "";
  const name = jdata.jurisdiction.name;

  // Rule 3A — merchant exposure conflict for low_risk_core
  if (profile === "low_risk_core" &&
      mechanism !== "two_way_cfd" &&
      mechanism !== "one_way_market_premium") {
    alerts.push(
      "ALERT [Rule 3A]: No state-backed revenue floor identified. " +
      "Merchant exposure conflicts with Low Risk Core Infrastructure profile — heavily penalised."
    );
  }

  // Rule 4A(i) — retroactive policy incidents
  const retroactive = jdata.sovereign_risk?.retroactive_policy_incidents || [];
  const highSev = retroactive.filter(
    (i) => String(i.severity || "").toLowerCase().startsWith("high")
  );
  if (highSev.length > 0) {
    alerts.push(
      `ALERT [Rule 4A(i)]: ${highSev.length} HIGH-severity retroactive policy incident(s) ` +
      `recorded for ${name}. Review sovereign_risk section before committing capital.`
    );
  }

  // Rule 3C — non-EUR currency risk for low_risk_core
  const currency = jdata.jurisdiction.currency_native || "EUR";
  if (currency !== "EUR" && profile === "low_risk_core") {
    alerts.push(
      `ALERT [Rule 3C]: Non-EUR currency (${currency}). ` +
      "FX volatility materially affects revenue certainty — incompatible with Low Risk Core " +
      "profile without explicit hedging."
    );
  }

  // Rule 4A(ii) — high operational drag
  const drag = ct["7_operational_drag_score"] || 0;
  if (drag >= 75) {
    alerts.push(
      `ALERT [Rule 4A(ii)]: Operational drag score ${drag}/100 (HIGH). ` +
      "Verify grid connection queue and permitting timeline before assuming development schedule."
    );
  }

  // Rule 4A(i) — low political risk score
  const pol = ct["6_political_risk_score"] || 100;
  if (pol < 65) {
    alerts.push(
      `ALERT [Rule 4A(i)]: Political risk score ${pol}/100 (BELOW THRESHOLD). ` +
      "Sub-investment-grade sovereign environment — not recommended for low-risk profiles."
    );
  }

  // Rule 4C — EU State Aid clawback
  if (jdata.jurisdiction.eu_member) {
    const saRisk = jdata.eu_state_aid?.retrospective_clawback_risk?.assessment;
    if (saRisk === "High" || saRisk === "Very High") {
      alerts.push(
        `ALERT [Rule 4C]: EU State Aid retrospective clawback risk rated '${saRisk}'. ` +
        "Scheme may lack formal EC notification clearance — material clawback exposure present."
      );
    }
  }

  // Rule 5A — RED overall stop/go
  if (jdata.rag_matrix?.overall_stop_go === "RED") {
    alerts.push(
      "STOP [Rule 5A]: Jurisdiction overall RAG is RED. " +
      "Do not proceed without specific mitigation for all flagged material concerns."
    );
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// RAG derivation
// ---------------------------------------------------------------------------

/** Convert numeric composite to RAG. Thresholds are profile-agnostic. */
export function compositeToRag(score) {
  if (score >= 72) return "GREEN";
  if (score >= 52) return "AMBER";
  return "RED";
}

// ---------------------------------------------------------------------------
// Core scoring function
// ---------------------------------------------------------------------------

/**
 * Score a single jurisdiction against a user profile and technology.
 * Returns a result object with all components visible (Rule 4D).
 *
 * @param {object} jdata  — parsed jurisdiction JSON
 * @param {string} profile — one of: low_risk_core | value_add | esg_impact
 * @param {string} technology — one of: solar | onshore_wind | offshore_wind
 * @returns {object}
 */
export function scoreJurisdiction(jdata, profile, technology) {
  if (!PROFILE_WEIGHTS[profile]) {
    throw new Error(`Unknown profile '${profile}'. Valid: ${Object.keys(PROFILES).join(", ")}`);
  }
  if (!TECHNOLOGIES.includes(technology)) {
    throw new Error(`Unknown technology '${technology}'. Valid: ${TECHNOLOGIES.join(", ")}`);
  }

  // Blend profile weights with technology-specific weights where applicable (Rule 4B).
  const weights = getEffectiveWeights(profile, technology);

  const components = {
    political:         scorePolitical(jdata),
    operational:       scoreOperational(jdata),
    mechanism_quality: scoreMechanism(jdata, profile, technology),
    permitting:        scorePermitting(jdata, technology),
    tax:               scoreTax(jdata),
    ppa:               scorePpa(jdata),
    state_aid:         scoreStateAid(jdata),
    esg_alignment:     scoreEsg(jdata, technology),
  };

  const composite = Object.keys(weights).reduce(
    (sum, k) => sum + weights[k] * components[k],
    0
  );

  const rag = compositeToRag(composite);
  const alerts = generateAlerts(jdata, profile);

  let recommendation;
  if (rag === "GREEN") {
    recommendation = "Proceed — jurisdiction meets profile criteria. Commission site-level due diligence.";
  } else if (rag === "AMBER") {
    recommendation = "Proceed with conditions — resolve flagged alerts before committing capital.";
  } else {
    recommendation = "Do not proceed without specific mitigation for all flagged material concerns.";
  }

  return {
    name:               jdata.jurisdiction.name,
    isoCode:            jdata.jurisdiction.iso_code,
    compositeScore:     Math.round(composite * 10) / 10,
    profileApplied:     profile,
    technologyApplied:  technology,
    // Rule 4D — component scores and weights always visible
    componentScores:    Object.fromEntries(
      Object.entries(components).map(([k, v]) => [k, Math.round(v * 10) / 10])
    ),
    weights,
    // Rule 4A — raw dual scores never merged
    politicalRiskRaw:   jdata.comparison_table["6_political_risk_score"],
    operationalDragRaw: jdata.comparison_table["7_operational_drag_score"],
    // Rule 5A — stop/go
    ragOverall:         rag,
    // Rule 5B — standardised comparison data
    comparisonTable:    jdata.comparison_table,
    // New technology raw data (null for legacy tech types)
    rawNewTechData:     jdata.new_technology_data?.[technology] ?? null,
    alerts,
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// Batch ranking
// ---------------------------------------------------------------------------

/**
 * Score and rank an array of jurisdiction data objects.
 * Returns array sorted descending by compositeScore.
 * Rule 7A: caller must confirm user profile before calling.
 *
 * @param {object[]} jurisdictionsData
 * @param {string} profile
 * @param {string} technology
 * @param {string[]} [filterIsoCodes] — if provided, only score these codes
 * @returns {object[]}
 */
export function rankJurisdictions(jurisdictionsData, profile, technology, filterIsoCodes = null) {
  let data = jurisdictionsData;
  if (filterIsoCodes && filterIsoCodes.length > 0) {
    const codes = new Set(filterIsoCodes.map((c) => c.toUpperCase()));
    data = data.filter((j) => codes.has(j.jurisdiction.iso_code.toUpperCase()));
  }
  return data
    .map((j) => scoreJurisdiction(j, profile, technology))
    .sort((a, b) => b.compositeScore - a.compositeScore);
}

// ---------------------------------------------------------------------------
// Financial metric helpers — Rule 3D
// ---------------------------------------------------------------------------

/**
 * Levelised Cost of Energy (LCOE) in EUR/MWh.
 * Rule 3C: all inputs must be in EUR (caller responsible for FX conversion).
 * @param {object} params
 * @param {number} params.capexEurPerMw
 * @param {number} params.opexEurPerMwYear
 * @param {number} params.capacityFactorPct   — e.g. 28 for 28%
 * @param {number} [params.projectLifeYears=25]
 * @param {number} [params.waccPct=7]
 * @returns {number} LCOE in EUR/MWh (nominal)
 */
export function estimateLcoe({
  capexEurPerMw,
  opexEurPerMwYear,
  capacityFactorPct,
  projectLifeYears = 25,
  waccPct = 7,
}) {
  const wacc = waccPct / 100;
  const hoursPerYear = 8_760;
  const annualOutputMwh = (capacityFactorPct / 100) * hoursPerYear;

  // Capital recovery factor
  const crf = (wacc * Math.pow(1 + wacc, projectLifeYears)) /
              (Math.pow(1 + wacc, projectLifeYears) - 1);

  const annualisedCapex = capexEurPerMw * crf;
  const totalAnnualCost = annualisedCapex + opexEurPerMwYear;
  return Math.round((totalAnnualCost / annualOutputMwh) * 100) / 100;
}

/**
 * Simple pre-tax CapEx payback period in years.
 * Rule 3D: does not account for tax shield or financing.
 * @param {object} params
 * @returns {number} years (Infinity if project is cash-flow negative)
 */
export function estimateSimplePayback({
  capexEurPerMw,
  revenueEurMwh,
  capacityFactorPct,
  opexEurPerMwYear,
}) {
  const hoursPerYear = 8_760;
  const annualRevenue = revenueEurMwh * (capacityFactorPct / 100) * hoursPerYear;
  const netAnnual = annualRevenue - opexEurPerMwYear;
  if (netAnnual <= 0) return Infinity;
  return Math.round((capexEurPerMw / netAnnual) * 100) / 100;
}

/**
 * NPV of the tax shield timing benefit from accelerated depreciation vs straight-line.
 * Rule 3B: expressed as EUR value of the timing advantage — not as a headline percentage.
 * @param {object} params
 * @param {number} params.capexEur
 * @param {number} params.citRatePct       — e.g. 21 for 21%
 * @param {number} params.acceleratedPct   — fraction deducted in year 1, e.g. 40 for 40%
 * @param {number} params.straightLineYears
 * @param {number} params.waccPct
 * @returns {number} NPV timing benefit in EUR
 */
export function npvTaxShieldTimingBenefit({
  capexEur,
  citRatePct,
  acceleratedPct,
  straightLineYears,
  waccPct,
}) {
  const wacc = waccPct / 100;
  const cit  = citRatePct / 100;
  const accel = acceleratedPct / 100;

  // Accelerated schedule: front-load `accel` in year 1, spread remainder
  const accelDeductions = [accel * capexEur];
  const remainder = (1 - accel) * capexEur;
  const remainingYears = straightLineYears - 1;
  for (let i = 0; i < remainingYears; i++) {
    accelDeductions.push(remainingYears > 0 ? remainder / remainingYears : 0);
  }

  // Straight-line baseline
  const slAnnual = capexEur / straightLineYears;

  let npvAccel = 0;
  let npvSl    = 0;
  const maxYears = Math.max(accelDeductions.length, straightLineYears);

  for (let i = 0; i < maxYears; i++) {
    const disc = Math.pow(1 + wacc, i + 1);
    npvAccel += cit * (accelDeductions[i] || 0) / disc;
    npvSl    += cit * (i < straightLineYears ? slAnnual : 0) / disc;
  }

  return Math.round((npvAccel - npvSl) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Disclaimer — Rule 6 (verbatim, non-negotiable)
// ---------------------------------------------------------------------------

export const DISCLAIMER =
  "This output is produced by Hyperion AI for indicative jurisdiction-screening purposes only. " +
  "It does not constitute legal or financial advice. Users should obtain qualified local legal " +
  "and financial counsel before committing capital. " +
  "Hyperion AI complies with SRA Standards and Regulations (15/12/24 edition).";
