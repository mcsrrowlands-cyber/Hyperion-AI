/**
 * Hyperion AI — Agent Orchestrator
 *
 * Wraps the scoring engine and produces formatted outputs per:
 *   Rule 5A  : RAG matrix (mandatory first output)
 *   Rule 5B  : Standardised 8-category comparison table
 *   Rule 4D  : Ranked list with all component scores and weightings visible
 *   Rule 3D  : Financial metric translation (LCOE, payback, NPV)
 *   Rule 7A  : Ask for risk profile before producing ranked/scored output
 *   Rule 6   : Disclaimer footer on every output
 */

import {
  PROFILES,
  TECHNOLOGIES,
  PROFILE_WEIGHTS,
  DISCLAIMER,
  loadAllJurisdictions,
  rankJurisdictions,
  scoreJurisdiction,
  compositeToRag,
  estimateLcoe,
  estimateSimplePayback,
  npvTaxShieldTimingBenefit,
} from "./scoring_engine.js";

export { PROFILES, TECHNOLOGIES };

// ---------------------------------------------------------------------------
// Agent class
// ---------------------------------------------------------------------------

export class HyperionAgent {
  /**
   * @param {string} [basePath=""] — path prefix for JSON files (e.g. "data/")
   */
  constructor(basePath = "") {
    this.basePath = basePath;
    this._jurisdictions = null; // loaded lazily
  }

  /** Load all jurisdiction data (cached after first call). */
  async init() {
    if (!this._jurisdictions) {
      this._jurisdictions = await loadAllJurisdictions(this.basePath);
    }
    return this;
  }

  /** Return the raw array of loaded jurisdiction objects. */
  get jurisdictions() {
    if (!this._jurisdictions) throw new Error("Call init() before accessing jurisdictions.");
    return this._jurisdictions;
  }

  // -------------------------------------------------------------------------
  // Primary query — produces the full output bundle
  // -------------------------------------------------------------------------

  /**
   * Main query entry point. Returns a structured output object.
   *
   * @param {object} options
   * @param {string}   options.profile           — low_risk_core | value_add | esg_impact
   * @param {string}   options.technology         — solar | onshore_wind | offshore_wind
   * @param {string[]} [options.filterIsoCodes]   — if set, only score these jurisdictions
   * @param {boolean}  [options.includeFinancials] — include Rule 3D financial metrics
   * @returns {object} queryResult
   */
  async query({
    profile,
    technology,
    filterIsoCodes = null,
    includeFinancials = false,
  }) {
    await this.init();

    if (!PROFILES[profile]) {
      throw new Error(`Unknown profile '${profile}'. Valid: ${Object.keys(PROFILES).join(", ")}`);
    }
    if (!TECHNOLOGIES.includes(technology)) {
      throw new Error(`Unknown technology '${technology}'. Valid: ${TECHNOLOGIES.join(", ")}`);
    }

    const ranked = rankJurisdictions(
      this._jurisdictions,
      profile,
      technology,
      filterIsoCodes
    );

    const output = {
      meta: {
        profile:      profile,
        profileLabel: PROFILES[profile],
        technology,
        jurisdictionCount: ranked.length,
        timestamp:    new Date().toISOString().slice(0, 10),
      },
      ranked,
      // Precomputed formatted strings for UI rendering
      ragMatrix:       ranked.length === 1 ? formatRagMatrix(ranked[0]) : null,
      comparisonTable: ranked.length > 1  ? formatComparisonTable(ranked) : null,
      rankedSummary:   formatRankedSummary(ranked, profile),
      financials:      includeFinancials ? formatFinancials(ranked, technology) : null,
      disclaimer:      DISCLAIMER,
    };

    return output;
  }

  // -------------------------------------------------------------------------
  // Single jurisdiction deep-dive
  // -------------------------------------------------------------------------

  /**
   * Score and deep-inspect a single jurisdiction by ISO code.
   * @param {string} isoCode
   * @param {string} profile
   * @param {string} technology
   * @returns {object}
   */
  async inspect(isoCode, profile, technology) {
    await this.init();
    const jdata = this._jurisdictions.find(
      (j) => j.jurisdiction.iso_code.toUpperCase() === isoCode.toUpperCase()
    );
    if (!jdata) throw new Error(`Jurisdiction not found: ${isoCode}`);

    const result = scoreJurisdiction(jdata, profile, technology);
    return {
      result,
      ragMatrix:   formatRagMatrix(result),
      financials:  formatFinancials([result], technology, jdata),
      rawData:     jdata,
      disclaimer:  DISCLAIMER,
    };
  }
}

// ---------------------------------------------------------------------------
// Rule 5A — RAG Matrix formatter
// ---------------------------------------------------------------------------

/**
 * Produces a structured RAG matrix for a single scored jurisdiction.
 * @param {object} result — from scoreJurisdiction()
 * @returns {object} ragMatrix
 */
export function formatRagMatrix(result) {
  const { name, componentScores, weights, politicalRiskRaw, operationalDragRaw, alerts } = result;

  const rows = [
    {
      category:  "Political & Sovereign Risk",
      score:     componentScores.political,
      weight:    pct(weights.political),
      rag:       thresholdRag(componentScores.political, 72, 52),
      rationale: `Raw score ${politicalRiskRaw}/100 (higher = lower risk). ` +
                 (componentScores.political >= 72
                   ? "Strong sovereign environment."
                   : componentScores.political >= 52
                     ? "Moderate political risk — monitor."
                     : "Elevated sovereign risk — material concern."),
    },
    {
      category:  "Operational Efficiency (inverted drag)",
      score:     componentScores.operational,
      weight:    pct(weights.operational),
      rag:       thresholdRag(componentScores.operational, 72, 52),
      rationale: `Raw operational drag ${operationalDragRaw}/100 (lower = better). ` +
                 `Inverted to ${componentScores.operational.toFixed(0)}/100 for scoring.`,
    },
    {
      category:  "Support Mechanism Quality",
      score:     componentScores.mechanism_quality,
      weight:    pct(weights.mechanism_quality),
      rag:       thresholdRag(componentScores.mechanism_quality, 72, 52),
      rationale: (() => {
        const tech = result.technologyApplied;
        const isNew = ["bess","green_hydrogen","floating_solar","nuclear_smr","lng_gas","data_centre","natural_gas_lng","biowaste_energy","coal_energy"].includes(tech);
        const code  = isNew
          ? (result.rawNewTechData?.mechanism_type_code ?? "merchant")
          : result.comparisonTable["3_mechanism_type_code"];
        const labels = {
          two_way_cfd:             "Two-way CfD: maximum downside protection; upside capped (Rule 3A).",
          one_way_market_premium:  "One-way premium: floor with uncapped merchant upside (Rule 3A).",
          ancillary_services:      "Ancillary services revenue (FCR/aFRR): market-referenced, no state floor.",
          capacity_market:         "Capacity market payment: revenue floor for availability, not generation.",
          hydrogen_contract:       "Hydrogen offtake contract: state-backed price floor for green H₂.",
          ipcei_grant:             "IPCEI grant / EU Hydrogen Bank: capital grant, not revenue contract.",
          government_contract:     "Government-backed contract (RAB/CfD variant): strong revenue certainty.",
          tolling_arrangement:     "Tolling arrangement: infrastructure fee; no commodity price exposure.",
          corporate_ppa:           "Corporate PPA: long-term offtake from hyperscaler or colocation client; no state backstop.",
          captive_generation:      "Captive generation: on-site power supply for data-centre campus; no merchant exposure.",
          feed_in_tariff:          "Feed-in tariff: guaranteed floor price for biowaste energy output.",
          biowaste_auction_cfd:    "Two-way CfD via bioenergy auction: downside protected, upside capped.",
          coal_capacity_market:    "Capacity market participation: revenue for availability; no generation floor.",
        };
        return labels[code] ?? "No state backstop identified — merchant exposure (Rule 3A: coal typically excluded from renewable support).";
      })(),
    },
    {
      category:  "Permitting Speed",
      score:     componentScores.permitting,
      weight:    pct(weights.permitting),
      rag:       thresholdRag(componentScores.permitting, 72, 52),
      rationale: `P50 permitting: ${result.comparisonTable["1_permitting_window_months_p50"] ?? "—"} months (onshore wind). ` +
                 `Solar: ${result.comparisonTable["1_permitting_window_solar_p50_months"] ?? "—"} months.`,
    },
    {
      category:  "Tax Efficiency",
      score:     componentScores.tax,
      weight:    pct(weights.tax),
      rag:       thresholdRag(componentScores.tax, 72, 52),
      rationale: `Effective CIT: ${result.comparisonTable["4_effective_corporation_tax_rate_pct"]}%. ` +
                 result.comparisonTable["4_key_incentive"],
    },
    {
      category:  "PPA Enforceability",
      score:     componentScores.ppa,
      weight:    pct(weights.ppa),
      rag:       thresholdRag(componentScores.ppa, 72, 52),
      rationale: result.comparisonTable["5_ppa_enforceability_rating"] +
                 " — " + result.comparisonTable["5_ppa_legal_basis"],
    },
    {
      category:  "EU State Aid Risk",
      score:     componentScores.state_aid,
      weight:    pct(weights.state_aid),
      rag:       thresholdRag(componentScores.state_aid, 72, 52),
      rationale: "Rule 4C: EC retrospective clawback exposure. " +
                 (componentScores.state_aid >= 80
                   ? "Low clawback risk."
                   : componentScores.state_aid >= 55
                     ? "Moderate clawback risk — verify EC notification status."
                     : "Elevated clawback risk — scheme may lack EC clearance."),
    },
    {
      category:  "ESG Alignment",
      score:     componentScores.esg_alignment,
      weight:    pct(weights.esg_alignment),
      rag:       thresholdRag(componentScores.esg_alignment, 72, 52),
      rationale: "Additionality, EU RED III alignment, carbon reduction signal.",
    },
  ];

  return {
    jurisdiction:    name,
    ragOverall:      result.ragOverall,
    compositeScore:  result.compositeScore,
    recommendation:  result.recommendation,
    rows,
    alerts,
  };
}

// ---------------------------------------------------------------------------
// Rule 5B — Standardised 8-category comparison table
// ---------------------------------------------------------------------------

/**
 * Produces a side-by-side comparison table across multiple jurisdictions.
 * Categories are identical across every column — no free-text substitutes.
 * @param {object[]} results — array of scored jurisdictions
 * @returns {object} comparisonTable
 */
export function formatComparisonTable(results) {
  const CATEGORIES = [
    { key: "1_permitting",     label: "1 | Permitting Window (P50)" },
    { key: "2_grid",           label: "2 | Grid Connection Cost & Timeline" },
    { key: "3_mechanism",      label: "3 | Primary Support Mechanism" },
    { key: "4_tax",            label: "4 | Effective CIT + Key Incentive" },
    { key: "5_ppa",            label: "5 | PPA Enforceability & Bankability" },
    { key: "6_sovereign",      label: "6 | Sovereign Risk Score" },
    { key: "7_drag",           label: "7 | Operational Drag Score" },
    { key: "8_revenue_floor",  label: "8 | Revenue Floor / Strike Price" },
  ];

  const columns = results.map((r) => {
    const ct = r.comparisonTable;
    return {
      isoCode:    r.isoCode,
      name:       r.name,
      rag:        r.ragOverall,
      composite:  r.compositeScore,
      cells: {
        "1_permitting":    { wind: ct["1_permitting_window_months_p50"],  solar: ct["1_permitting_window_solar_p50_months"] },
        "2_grid":          { cost: ct["2_grid_connection_cost_eur"],       timeline: ct["2_grid_connection_timeline_months"] },
        "3_mechanism":     { description: ct["3_primary_support_mechanism"], typeCode: ct["3_mechanism_type_code"] },
        "4_tax":           { rate: ct["4_effective_corporation_tax_rate_pct"], incentive: ct["4_key_incentive"] },
        "5_ppa":           { rating: ct["5_ppa_enforceability_rating"],    basis: ct["5_ppa_legal_basis"] },
        "6_sovereign":     { score: ct["6_political_risk_score"] },
        "7_drag":          { score: ct["7_operational_drag_score"] },
        "8_revenue_floor": { native: ct["8_revenue_floor_native"],         mechanism: ct["8_revenue_floor_mechanism"] },
      },
    };
  });

  return { categories: CATEGORIES, columns };
}

// ---------------------------------------------------------------------------
// Rule 4D — Ranked summary with all component scores visible
// ---------------------------------------------------------------------------

/**
 * Formats a ranked list with composite score, RAG, and all component sub-scores.
 * Rule 4D: scoring logic must never be opaque.
 * @param {object[]} ranked
 * @param {string} profile
 * @returns {object[]}
 */
export function formatRankedSummary(ranked, profile) {
  const weights = PROFILE_WEIGHTS[profile];
  return ranked.map((r, idx) => ({
    rank:          idx + 1,
    isoCode:       r.isoCode,
    name:          r.name,
    rag:           r.ragOverall,
    composite:     r.compositeScore,
    components:    r.componentScores,
    weights,
    alerts:        r.alerts,
    recommendation:r.recommendation,
  }));
}

// ---------------------------------------------------------------------------
// Rule 3D — Financial metrics
// ---------------------------------------------------------------------------

/**
 * Extracts financial model inputs from jurisdiction JSON and computes
 * LCOE, simple payback, and NPV tax shield timing benefit where possible.
 * Rule 3C: figures shown in native currency first, then EUR equivalent.
 * @param {object[]} results
 * @param {string}   technology
 * @param {object}   [rawData] — only provided for single-jurisdiction inspect()
 * @returns {object[]}
 */
export function formatFinancials(results, technology, rawData = null) {
  return results.map((r) => {
    const jdata = rawData;
    if (!jdata) {
      return {
        isoCode:  r.isoCode,
        name:     r.name,
        note:     "Full financial model inputs require jurisdiction raw data — use inspect() for a single jurisdiction.",
      };
    }

    const fmi = jdata.financial_model_inputs || {};
    let modelKey;
    if (technology === "solar")         modelKey = Object.keys(fmi).find((k) => /solar/i.test(k));
    else if (technology === "offshore_wind") modelKey = Object.keys(fmi).find((k) => /offshore/i.test(k));
    else                                modelKey = Object.keys(fmi).find((k) => /onshore_wind|wind/i.test(k) && !/offshore/i.test(k));

    const model = modelKey ? fmi[modelKey] : null;

    if (!model) {
      return { isoCode: r.isoCode, name: r.name, note: `No financial model inputs found for technology: ${technology}.` };
    }

    const capex   = model.typical_capex_eur_per_mw || model.typical_capex_eur_per_mw_dc;
    const opex    = model.opex_eur_per_mw_per_year;
    const cf      = model.p50_capacity_factor_pct || model.p50_capacity_factor_pct_dc;
    const revenue = model.anzulegender_wert_eur_mwh_approx || model.strike_price_eur_mwh_approx
                  || model.reference_price_eur_mwh_approx || model.toetushind_eur_mwh_approx;

    const lcoe = (capex && opex && cf)
      ? estimateLcoe({ capexEurPerMw: capex, opexEurPerMwYear: opex, capacityFactorPct: cf })
      : null;

    const payback = (capex && opex && cf && revenue)
      ? estimateSimplePayback({ capexEurPerMw: capex, revenueEurMwh: revenue, capacityFactorPct: cf, opexEurPerMwYear: opex })
      : null;

    return {
      isoCode:          r.isoCode,
      name:             r.name,
      technology,
      mechanismType:    model.mechanism_type,
      revenueCeiling:   model.anzulegender_wert_eur_mwh_approx ?? revenue,
      contractYears:    model.contract_term_years,
      capacityFactorPct: cf,
      capexEurPerMw:    capex,
      opexEurPerMwYear: opex,
      lcoeEurMwh:       lcoe,
      simplePaybackYears: payback,
      notes:            model.note || "",
      staleness:        jdata.jurisdiction.data_staleness_warning || "",
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(weight) {
  return `${Math.round(weight * 100)}%`;
}

function thresholdRag(score, greenMin, amberMin) {
  if (score >= greenMin) return "GREEN";
  if (score >= amberMin) return "AMBER";
  return "RED";
}
