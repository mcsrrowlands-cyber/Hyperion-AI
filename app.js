/**
 * Hyperion AI — Frontend Application
 * Connects the UI to HyperionAgent, renders all output modes.
 */

import { HyperionAgent, PROFILES, TECHNOLOGIES } from './hyperion_agent.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_JURISDICTIONS = [
  { iso: 'AT', name: 'Austria' },       { iso: 'BE', name: 'Belgium' },
  { iso: 'BG', name: 'Bulgaria' },      { iso: 'HR', name: 'Croatia' },
  { iso: 'CY', name: 'Cyprus' },        { iso: 'CZ', name: 'Czechia' },
  { iso: 'DK', name: 'Denmark' },       { iso: 'EE', name: 'Estonia' },
  { iso: 'FI', name: 'Finland' },       { iso: 'FR', name: 'France' },
  { iso: 'DE', name: 'Germany' },       { iso: 'GR', name: 'Greece' },
  { iso: 'HU', name: 'Hungary' },       { iso: 'IE', name: 'Ireland' },
  { iso: 'IT', name: 'Italy' },         { iso: 'LV', name: 'Latvia' },
  { iso: 'LT', name: 'Lithuania' },     { iso: 'LU', name: 'Luxembourg' },
  { iso: 'MT', name: 'Malta' },         { iso: 'NL', name: 'Netherlands' },
  { iso: 'NO', name: 'Norway' },        { iso: 'PL', name: 'Poland' },
  { iso: 'PT', name: 'Portugal' },      { iso: 'RO', name: 'Romania' },
  { iso: 'SK', name: 'Slovakia' },      { iso: 'SI', name: 'Slovenia' },
  { iso: 'ES', name: 'Spain' },         { iso: 'SE', name: 'Sweden' },
  { iso: 'CH', name: 'Switzerland' },   { iso: 'GB', name: 'United Kingdom' },
];

const COMPONENT_LABELS = {
  political:         'Political Risk',
  operational:       'Operational Eff.',
  mechanism_quality: 'Revenue Floor',
  permitting:        'Permitting Speed',
  tax:               'Tax Efficiency',
  ppa:               'PPA Enforceability',
  state_aid:         'State Aid Safety',
  esg_alignment:     'ESG Alignment',
};

const TECH_LABELS = {
  solar:           '☀️ Solar PV',
  onshore_wind:    '💨 Onshore Wind',
  offshore_wind:   '🌊 Offshore Wind',
  bess:            '🔋 Battery Storage (BESS)',
  green_hydrogen:  '🌿 Green Hydrogen',
  floating_solar:  '🏞️ Floating Solar',
  nuclear_smr:     '⚛️ Nuclear SMR',
  lng_gas:         '🔥 LNG & Gas Infrastructure',
  data_centre:     '🖥️ Data-Centre Power Infrastructure',
  natural_gas_lng: '⚡ Natural Gas & LNG',
  biowaste_energy: '♻️ Biowaste to Energy',
  coal_energy:     '⛏️ Coal Energy',
};

const REGION_GROUPS = {
  nordic:          { label: 'Nordic',          emoji: '❄️',  isos: ['DK','FI','NO','SE'] },
  british_isles:   { label: 'British Isles',   emoji: '🌬️', isos: ['GB','IE'] },
  western_europe:  { label: 'Western Europe',  emoji: '🏛️', isos: ['NL','BE','LU','FR'] },
  dach:            { label: 'DACH',            emoji: '⚙️',  isos: ['DE','AT','CH'] },
  southern_europe: { label: 'Southern Europe', emoji: '☀️',  isos: ['ES','PT','IT','GR','CY','MT'] },
  eastern_europe:  { label: 'Eastern Europe',  emoji: '📈',  isos: ['PL','HU','SK','SI','RO','BG','HR','CZ'] },
  baltics:         { label: 'Baltics',         emoji: '⚡',  isos: ['EE','LV','LT'] },
};

const SUGGESTIONS = {
  solar: [
    'Which target market has the highest solar irradiation and fastest permitting?',
    'Compare CfD vs one-way premium mechanisms for solar across my markets',
    'What are typical LCOE and payback periods for utility solar in my top jurisdictions?',
  ],
  onshore_wind: [
    'Which region has the best onshore wind resource and lowest permitting risk?',
    'Where can I get the strongest revenue floor for onshore wind?',
    'Compare political risk scores across my target markets',
  ],
  offshore_wind: [
    'Which countries have active offshore wind auction pipelines in my target markets?',
    'What grid connection timelines and costs should I expect offshore?',
    'Where are the best CfD strike prices for offshore wind?',
  ],
  bess: [
    'Which markets have the deepest ancillary services revenue and fastest grid connection for utility BESS?',
    'Compare capacity market participation rules for battery storage across my target jurisdictions',
    'What are the permitting timelines and key consenting risks for grid-scale BESS in each market?',
  ],
  green_hydrogen: [
    'Which countries have active EU Hydrogen Bank auction access and IPCEI eligibility?',
    'Compare electrolyser permitting pathways and hydrogen contract structures across my target markets',
    'Where is the strongest government-backed hydrogen offtake available in Europe?',
  ],
  floating_solar: [
    'Which markets combine strong solar irradiance, suitable water bodies, and streamlined consenting for floating PV?',
    'How does floating solar permitting differ from ground-mounted in my target jurisdictions?',
    'Which countries include floating solar in their existing renewable auction frameworks?',
  ],
  nuclear_smr: [
    'Which European jurisdictions have active SMR programmes and government contract availability?',
    'Compare nuclear licensing timelines and regulatory frameworks for SMR in my target markets',
    'What is the political and stranded-asset risk of SMR investment in each target jurisdiction?',
  ],
  lng_gas: [
    'Which markets have existing LNG regasification capacity and third-party access rights under ENTSO-G data?',
    'Compare EU Taxonomy Article 10 compliance risk for new LNG infrastructure across target jurisdictions',
    'What capacity market or tolling structures are available for gas infrastructure investment in each market?',
  ],
  data_centre: [
    'Which markets offer the best grid stability, low electricity prices, and fast permitting for hyperscale data centres?',
    'Compare renewable PPA availability and corporate green power access across my target jurisdictions',
    'What are the planning consenting requirements for large data-centre campuses in each market?',
  ],
  natural_gas_lng: [
    'Which markets have active capacity markets supporting new gas-fired power investment?',
    'Compare EU Taxonomy Article 10 compliance requirements for gas CCGT plants across my target jurisdictions',
    'What are the stranded-asset and regulatory phase-out risks for gas power in each target market?',
  ],
  biowaste_energy: [
    'Which markets have dedicated bioenergy auction or feed-in tariff frameworks?',
    'Compare EU RED III sustainability criteria compliance requirements for biowaste feedstocks across my targets',
    'What are the permitting and waste regulatory timelines for energy-from-waste facilities in each market?',
  ],
  coal_energy: [
    'Which European jurisdictions still operate capacity markets where coal-fired generation can participate?',
    'Compare coal phase-out timelines and stranded-asset risk across my target markets',
    'What are the EU Taxonomy and CBAM implications for coal power investment in each jurisdiction?',
  ],
};
const COMMON_SUGGESTIONS = [
  'Compare the top 3 jurisdictions for my profile and flag material risks',
  'Which market has the lowest combined political risk and operational drag?',
  'Summarise EU State Aid clawback risks across my target markets',
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  profile:     null,
  technology:  null,
  scope:       'all',
  selected:    new Set(),  // ISO codes for compare/inspect
  currentStep: 1,
  budget:      null,       // { code, label, min, max }
  top10:       [],         // top 10 jurisdictions from auto-analysis
};

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

const agent = new HyperionAgent();

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const $profileGrid    = document.getElementById('profile-grid');
const $techRow        = document.getElementById('tech-row');
const $resultsPanel   = document.getElementById('results-panel');
const $resultsContent = document.getElementById('results-content');
const $backBtn        = document.getElementById('back-btn');
const $nextBtn        = document.getElementById('next-btn');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flag(iso) {
  return [...(iso === 'UK' ? 'GB' : iso).toUpperCase().slice(0, 2)]
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
}

function ragIcon(rag) {
  return rag === 'GREEN' ? '✅' : rag === 'AMBER' ? '⚠️' : '🛑';
}

function barColorClass(score) {
  if (score >= 72) return 'g';
  if (score >= 52) return 'a';
  return 'r';
}

function escHtml(str) {
  return String(str ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function metaPill(label, value) {
  return `<span class="meta-pill">${escHtml(label)}: <strong>${escHtml(value)}</strong></span>`;
}

function ragBadge(rag, extraStyle = '') {
  const icon = rag === 'GREEN' ? '✓' : rag === 'AMBER' ? '~' : '✗';
  const s = extraStyle ? ` style="${extraStyle}"` : '';
  return `<span class="rag-badge ${rag}"${s}>${icon} ${rag}</span>`;
}

function mechBadge(code) {
  const labels = {
    two_way_cfd:                          'Two-Way CfD',
    one_way_market_premium:               'One-Way Premium',
    merchant:                             'Merchant',
    quota_certificate_with_minimum_price: 'Quota + Min Price',
  };
  const label = labels[code] ?? code.replace(/_/g, ' ');
  return `<span class="mech-badge">${escHtml(label)}</span>`;
}

function buildMiniBar(score, colorClass) {
  const pct = Math.min(100, Math.max(0, Number(score) || 0));
  return `<div class="mini-bar-track"><div class="mini-bar-fill ${colorClass}" style="width:${pct}%"></div></div>`;
}

function buildCellHtml(catKey, cell) {
  if (cell == null) return '—';
  switch (catKey) {
    case '1_permitting': {
      const wind  = cell.wind  ?? '—';
      const solar = cell.solar ?? null;
      return `<div class="cell-primary">${wind}<span class="cell-unit"> mo</span></div>
              <div class="cell-detail">Onshore wind P50</div>
              ${solar != null ? `<div class="cell-sub-row">☀️ ${solar} mo solar</div>` : ''}`;
    }
    case '2_grid':
      return `<div class="cell-label-row"><span class="cell-label">Cost</span><span class="cell-val">${escHtml(String(cell.cost ?? '—'))}</span></div>
              <div class="cell-label-row"><span class="cell-label">Timeline</span><span class="cell-val">${escHtml(String(cell.timeline ?? '—'))} mo</span></div>`;
    case '3_mechanism': {
      const desc  = String(cell.description ?? '—');
      const short = desc.length > 110 ? desc.slice(0, 110) + '…' : desc;
      return `${cell.typeCode ? mechBadge(cell.typeCode) : ''}
              <div class="cell-detail">${escHtml(short)}</div>`;
    }
    case '4_tax': {
      const raw     = cell.rate ?? '—';
      const parsed  = parseFloat(String(raw));
      const display = isNaN(parsed) ? escHtml(String(raw)) : `${parsed}%`;
      const inc     = String(cell.incentive ?? '—');
      const short   = inc.length > 110 ? inc.slice(0, 110) + '…' : inc;
      return `<div class="cell-primary">${display}<span class="cell-unit"> CIT</span></div>
              <div class="cell-detail">${escHtml(short)}</div>`;
    }
    case '5_ppa': {
      const basis = String(cell.basis ?? '');
      const short = basis.length > 100 ? basis.slice(0, 100) + '…' : basis;
      return `<div class="cell-primary">${escHtml(String(cell.rating ?? '—'))}</div>
              ${short ? `<div class="cell-detail">${escHtml(short)}</div>` : ''}`;
    }
    case '6_sovereign': {
      const s = Number(cell.score);
      return `<div class="cell-primary">${isNaN(s) ? (cell.score ?? '—') : s}<span class="cell-unit">/100</span></div>
              ${!isNaN(s) ? buildMiniBar(s, barColorClass(s)) : ''}
              <div class="cell-detail">higher = lower risk</div>`;
    }
    case '7_drag': {
      const s   = Number(cell.score);
      const inv = 100 - (isNaN(s) ? 50 : s);
      return `<div class="cell-primary">${isNaN(s) ? (cell.score ?? '—') : s}<span class="cell-unit">/100</span></div>
              ${!isNaN(s) ? buildMiniBar(inv, barColorClass(inv)) : ''}
              <div class="cell-detail">higher = more drag</div>`;
    }
    case '8_revenue_floor':
      return `<div class="cell-primary cell-primary--sm">${escHtml(String(cell.native ?? '—'))}</div>
              ${cell.mechanism ? mechBadge(cell.mechanism) : ''}`;
    default:
      return escHtml(typeof cell === 'string' ? cell : JSON.stringify(cell));
  }
}

// ---------------------------------------------------------------------------
// Wizard navigation
// ---------------------------------------------------------------------------

function showStep(n) {
  state.currentStep = n;

  [1, 2, 3, 4].forEach(i => {
    document.getElementById(`wizard-pane-${i}`).classList.toggle('hidden', i !== n);
  });

  document.querySelectorAll('.ws-item').forEach(item => {
    const s = parseInt(item.dataset.step, 10);
    item.classList.toggle('active', s === n);
    item.classList.toggle('completed', s < n);
  });

  [1, 2, 3].forEach(i => {
    document.getElementById(`ws-conn-${i}`).classList.toggle('filled', i < n);
  });

  $backBtn.style.visibility = n === 1 ? 'hidden' : 'visible';
  $nextBtn.classList.toggle('hidden', n === 4 || n === 1);

  if (n === 4) {
    initScopeChat();
  } else {
    syncNextButton();
  }
}

function syncNextButton() {
  const pane1Btn = document.getElementById('pane1-next-btn');
  if (state.currentStep === 1) {
    $nextBtn.disabled = !state.profile;
    if (pane1Btn) pane1Btn.disabled = !state.profile;
  }
  if (state.currentStep === 2) $nextBtn.disabled = !state.technology;
  if (state.currentStep === 3) $nextBtn.disabled = !state.budget;
}

// ---------------------------------------------------------------------------
// Event listeners — profile selection
// ---------------------------------------------------------------------------

$profileGrid.querySelectorAll('.profile-card').forEach(card => {
  card.addEventListener('click', () => {
    $profileGrid.querySelectorAll('.profile-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.profile = card.dataset.profile;
    syncNextButton();
  });
});

// Technology selection
$techRow.querySelectorAll('.tech-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $techRow.querySelectorAll('.tech-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.technology = btn.dataset.tech;
    syncNextButton();
  });
});

// Budget selection
document.getElementById('budget-grid').querySelectorAll('.budget-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('budget-grid').querySelectorAll('.budget-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.budget = {
      code:  btn.dataset.budget,
      label: btn.dataset.budgetLabel,
      min:   parseFloat(btn.dataset.budgetMin),
      max:   btn.dataset.budgetMax === '0' ? Infinity : parseFloat(btn.dataset.budgetMax),
    };
    syncNextButton();
  });
});


// ---------------------------------------------------------------------------
// Wizard back / next
// ---------------------------------------------------------------------------

$backBtn.addEventListener('click', () => {
  if (state.currentStep > 1) showStep(state.currentStep - 1);
});

$nextBtn.addEventListener('click', () => {
  if (state.currentStep < 4) showStep(state.currentStep + 1);
});

// ---------------------------------------------------------------------------
// Scope chat — core helpers
// ---------------------------------------------------------------------------

const BOLT_SVG = `<img src="Logo4.png" width="22" height="22" alt="" style="display:block;mix-blend-mode:multiply">`;

function postBotHtml(html) {
  const $msgs = document.getElementById('chat-messages');
  const div   = document.createElement('div');
  div.className = 'msg-bubble msg-assistant';
  div.innerHTML = `<div class="msg-avatar">${BOLT_SVG}</div><div class="msg-content">${html}</div>`;
  $msgs.appendChild(div);
  $msgs.scrollTop = $msgs.scrollHeight;
  return div;
}

// ---------------------------------------------------------------------------
// Scope chat — init (called by showStep(4))
// ---------------------------------------------------------------------------

async function initScopeChat() {
  // Reset
  chatHistory.length = 0;
  document.getElementById('chat-messages').innerHTML    = '';
  document.getElementById('chat-suggestions').innerHTML = '';
  state.scope = 'all';
  state.selected.clear();
  state.top10 = [];

  buildContextBanner();
  chatSystemPrompt = buildScopeSystemPrompt();

  // Disable input while scoring runs
  const $inp  = document.getElementById('chat-input');
  const $send = document.getElementById('chat-send');
  $inp.disabled    = true;
  $inp.placeholder = 'Hyperion is analysing all 30 jurisdictions…';
  $send.disabled   = true;

  const profileLabel = PROFILES[state.profile]      || state.profile      || '';
  const techLabel    = TECH_LABELS[state.technology] || state.technology   || '';

  const loadingDiv = postBotHtml(`
    <p>Running Hyperion scoring engine for <strong>${escHtml(profileLabel)}</strong> profile, <strong>${escHtml(techLabel)}</strong> technology…</p>
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;opacity:0.7;font-size:13px">
      <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
      <span>Scoring all 30 European jurisdictions</span>
    </div>
  `);

  try {
    const result = await agent.query({
      profile:           state.profile,
      technology:        state.technology,
      filterIsoCodes:    null,
      includeFinancials: false,
    });

    state.top10 = (result.rankedSummary || []).slice(0, 10);

    // Render full 30-jurisdiction ranking in the results panel immediately
    $resultsPanel.classList.remove('hidden');
    renderRanked(result);

    // Update system prompt with full results context
    chatSystemPrompt = buildSystemPrompt(result);

    loadingDiv.remove();

    // Build top 10 list HTML
    const top10Html = state.top10.map((r, i) => `
      <div class="top10-row">
        <span class="top10-rank">#${i + 1}</span>
        ${ragBadge(r.rag)}
        <span class="top10-flag">${flag(r.isoCode)}</span>
        <strong class="top10-name">${escHtml(r.name)}</strong>
        <span class="top10-score">${r.composite.toFixed(0)}/100</span>
        ${r.alerts?.length ? `<span class="top10-alerts">⚠ ${r.alerts.length} alert${r.alerts.length > 1 ? 's' : ''}</span>` : ''}
      </div>
    `).join('');

    postBotHtml(`
      <p>Based on your <strong>${escHtml(profileLabel)}</strong> profile and <strong>${escHtml(techLabel)}</strong> technology, here are the <strong>10 most favourable European jurisdictions</strong>:</p>
      <div class="top10-list">${top10Html}</div>
      <p style="margin-top:12px">What would you like to do next?</p>
      <div class="scope-options">
        <button class="scope-opt-btn" data-scope="compare">
          <span class="scope-opt-icon">⚖️</span>
          <span class="scope-opt-body">
            <strong class="scope-opt-title">Compare top markets</strong>
            <span class="scope-opt-desc">Side-by-side across all 8 scoring categories</span>
          </span>
        </button>
        <button class="scope-opt-btn" data-scope="inspect">
          <span class="scope-opt-icon">🔍</span>
          <span class="scope-opt-body">
            <strong class="scope-opt-title">Deep-dive into a market</strong>
            <span class="scope-opt-desc">Full RAG matrix, alerts, and financial metrics</span>
          </span>
        </button>
        <button class="scope-opt-btn" data-scope="all">
          <span class="scope-opt-icon">📊</span>
          <span class="scope-opt-body">
            <strong class="scope-opt-title">View full 30-jurisdiction ranking</strong>
            <span class="scope-opt-desc">Scroll to the complete ranked dashboard below</span>
          </span>
        </button>
      </div>
    `);

    document.querySelectorAll('.scope-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => handleScopeSelection(btn.dataset.scope), { once: true });
    });

    // Enable chat
    $inp.disabled    = false;
    $inp.placeholder = 'Ask about any jurisdiction, permitting timelines, risk scores…';
    buildSuggestions(state.technology);

  } catch (err) {
    loadingDiv.remove();
    postBotHtml(`<p style="color:var(--red)">Analysis failed: ${escHtml(err.message)}</p>`);
    $inp.disabled    = false;
    $inp.placeholder = 'Type a question…';
  }
}

function buildScopeSystemPrompt() {
  const profile = PROFILES[state.profile]      || state.profile      || '';
  const tech    = TECH_LABELS[state.technology] || state.technology   || '';
  const budget  = state.budget?.label           || 'Not specified';

  return `You are Hyperion AI, a European energy CapEx jurisdiction intelligence system.

Investor context:
- Investment Profile: ${profile}
- Technology: ${tech}
- Budget: ${budget}
- Coverage: All 30 European jurisdictions (top 10 being identified by scoring engine)

All outputs are indicative only — not legal or financial advice.`;
}

// ---------------------------------------------------------------------------
// Scope chat — selection handlers
// ---------------------------------------------------------------------------

function handleScopeSelection(scope) {
  state.scope = scope;
  state.selected.clear();

  // Lock buttons, highlight chosen
  document.querySelectorAll('.scope-opt-btn').forEach(b => {
    b.disabled = true;
    b.classList.toggle('selected', b.dataset.scope === scope);
  });

  const label = { all: 'Rank all 30 jurisdictions', compare: 'Compare selected jurisdictions', inspect: 'Single jurisdiction deep-dive' }[scope];
  renderMessage('user', label);
  chatHistory.push({ role: 'user', content: label });

  if (scope === 'all') {
    // Full ranking already rendered — just scroll to it
    setTimeout(() => $resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  } else if (scope === 'compare') {
    const top10Isos = new Set(state.top10.map(r => r.isoCode));
    const ordered = [
      ...state.top10.map(r => ALL_JURISDICTIONS.find(j => j.iso === r.isoCode)).filter(Boolean),
      ...ALL_JURISDICTIONS.filter(j => !top10Isos.has(j.iso)),
    ];
    const reply = 'Select jurisdictions to compare side-by-side (2–8). Your top 10 are highlighted:';
    postBotHtml(`
      <p>${escHtml(reply)}</p>
      <div class="chat-j-chips" id="chat-j-chips">
        ${ordered.map(j =>
          `<button class="chat-j-chip${top10Isos.has(j.iso) ? ' top10-chip' : ''}" data-iso="${j.iso}">${flag(j.iso)} ${escHtml(j.name)}</button>`
        ).join('')}
      </div>
      <div class="chat-run-row">
        <button class="chat-run-btn" id="chat-run-btn" disabled>▶&nbsp; Run Analysis</button>
        <span class="chat-run-hint" id="chat-run-hint">Select at least 2</span>
      </div>
    `);
    chatHistory.push({ role: 'assistant', content: reply });
    wireCompareChips();

  } else {
    const top10Isos = new Set(state.top10.map(r => r.isoCode));
    const ordered = [
      ...state.top10.map(r => ALL_JURISDICTIONS.find(j => j.iso === r.isoCode)).filter(Boolean),
      ...ALL_JURISDICTIONS.filter(j => !top10Isos.has(j.iso)),
    ];
    const reply = 'Select a jurisdiction for the deep-dive. Your top 10 are highlighted:';
    postBotHtml(`
      <p>${escHtml(reply)}</p>
      <div class="chat-j-chips" id="chat-j-chips">
        ${ordered.map(j =>
          `<button class="chat-j-chip${top10Isos.has(j.iso) ? ' top10-chip' : ''}" data-iso="${j.iso}">${flag(j.iso)} ${escHtml(j.name)}</button>`
        ).join('')}
      </div>
    `);
    chatHistory.push({ role: 'assistant', content: reply });
    wireInspectChips();
  }
}

function wireCompareChips() {
  document.getElementById('chat-j-chips').querySelectorAll('.chat-j-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const iso = chip.dataset.iso;
      if (state.selected.has(iso)) {
        state.selected.delete(iso);
        chip.classList.remove('selected');
      } else if (state.selected.size < 8) {
        state.selected.add(iso);
        chip.classList.add('selected');
      }
      const n      = state.selected.size;
      const runBtn = document.getElementById('chat-run-btn');
      const hint   = document.getElementById('chat-run-hint');
      runBtn.disabled = n < 2;
      hint.textContent = n < 2 ? `Select at least 2 (${n} chosen)` : `${n} selected — ready`;
      if (n >= 2 && !runBtn.dataset.wired) {
        runBtn.dataset.wired = '1';
        runBtn.addEventListener('click', triggerAnalysis, { once: true });
      }
    });
  });
}

function wireInspectChips() {
  document.getElementById('chat-j-chips').querySelectorAll('.chat-j-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#chat-j-chips .chat-j-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      state.selected.clear();
      state.selected.add(chip.dataset.iso);

      if (!document.getElementById('chat-run-btn')) {
        const name = ALL_JURISDICTIONS.find(j => j.iso === chip.dataset.iso)?.name ?? chip.dataset.iso;
        postBotHtml(`
          <p>Ready to deep-dive into <strong>${flag(chip.dataset.iso)} ${escHtml(name)}</strong>.</p>
          <button class="chat-run-btn" id="chat-run-btn">▶&nbsp; Run Analysis</button>
        `);
        document.getElementById('chat-run-btn').addEventListener('click', triggerAnalysis, { once: true });
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Scope chat — trigger analysis
// ---------------------------------------------------------------------------

async function triggerAnalysis() {
  const runBtn = document.getElementById('chat-run-btn');
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    runBtn.style.cssText += ';display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:80px';
  }

  const confirmMsg = {
    all:     'Run full jurisdiction ranking',
    compare: `Compare: ${[...state.selected].map(iso => ALL_JURISDICTIONS.find(j => j.iso === iso)?.name ?? iso).join(', ')}`,
    inspect: `Deep-dive: ${ALL_JURISDICTIONS.find(j => state.selected.has(j.iso))?.name ?? [...state.selected][0]}`,
  }[state.scope];
  renderMessage('user', confirmMsg);

  const typing = renderTyping();

  $resultsPanel.classList.remove('hidden');
  $resultsContent.innerHTML = '<div class="loading-block"><div class="spinner"></div>Running analysis…</div>';

  try {
    let lastResult = null;

    if (state.scope === 'inspect') {
      const isoCode = [...state.selected][0];
      lastResult = await agent.inspect(isoCode, state.profile, state.technology);
      renderInspect(lastResult);
    } else {
      let filterCodes = null;
      if (state.scope === 'compare') {
        filterCodes = [...state.selected];
      }
      lastResult = await agent.query({
        profile:           state.profile,
        technology:        state.technology,
        filterIsoCodes:    filterCodes,
        includeFinancials: false,
      });
      if (state.scope === 'compare') renderCompare(lastResult);
      else                           renderRanked(lastResult);
    }

    typing.remove();

    // Switch to full results-aware system prompt
    chatSystemPrompt = buildSystemPrompt(lastResult);
    chatHistory.length = 0;

    // Summary bot message
    let summaryHtml = '<p><strong>Analysis complete.</strong> Full dashboard shown below.</p>';
    if (lastResult.rankedSummary?.length) {
      const top3 = lastResult.rankedSummary.slice(0, 3)
        .map(r => `<li>${ragBadge(r.rag)} <strong>${escHtml(r.name)}</strong> — ${r.composite.toFixed(0)}/100</li>`)
        .join('');
      summaryHtml += `<ul class="chat-summary-list">${top3}</ul>`;
    }
    summaryHtml += '<p>Ask me anything about the results — permitting, support mechanisms, sovereign risk, or financials.</p>';
    postBotHtml(summaryHtml);

    // Enable free-form Q&A
    document.getElementById('chat-input').placeholder = 'Ask about jurisdictions, permitting timelines, tax incentives, risk scores…';
    buildSuggestions(state.technology);

    setTimeout(() => $resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);

  } catch (err) {
    typing.remove();
    postBotHtml(`<p style="color:var(--red)">Analysis failed: ${escHtml(err.message)}. Check that the server is running and all JSON files are present.</p>`);
    if (runBtn) { runBtn.disabled = false; runBtn.textContent = '▶ Try Again'; }
  }
}

// ---------------------------------------------------------------------------
// Chat — state
// ---------------------------------------------------------------------------

const chatHistory = [];
let chatSystemPrompt  = '';

// ---------------------------------------------------------------------------
// Chat — system prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(queryResult) {
  const profile  = PROFILES[state.profile]      || state.profile  || 'Not set';
  const tech     = TECH_LABELS[state.technology] || state.technology || 'Not set';
  const budget   = state.budget?.label           || 'Not specified';
  let topResults = [];
  if (queryResult?.rankedSummary) {
    topResults = queryResult.rankedSummary.slice(0, 20).map(r => ({
      rank: r.rank, country: r.name, iso: r.isoCode,
      rag: r.rag, composite: r.composite, alerts: r.alerts?.length ?? 0,
    }));
  } else if (queryResult?.result) {
    const r = queryResult.result;
    topResults = [{ rank: 1, country: r.name, iso: r.isoCode,
      rag: r.ragOverall, composite: r.compositeScore, alerts: r.alerts?.length ?? 0 }];
  }

  return `You are Hyperion AI, a European energy CapEx jurisdiction intelligence system. You assist investors in evaluating and comparing European markets for renewable energy capital expenditure.

INVESTOR CONTEXT:
- Investment Profile: ${profile}
- Technology: ${tech}
- Budget Envelope: ${budget}
- Coverage: All 30 European jurisdictions

JURISDICTION SCORES (ranked for this profile and technology):
${JSON.stringify(topResults, null, 2)}

MANDATORY ANALYTICAL RULES:
1. SRA compliance: all outputs are indicative only — not legal or financial advice.
2. Never conflate mechanism types: two-way CfD (capped upside, clawback) ≠ one-way premium (uncapped upside, no clawback) ≠ merchant (no state backstop).
3. Cite numeric scores with their component breakdown when making claims about jurisdictions.
4. Keep political risk score and operational drag score separate — never silently blend them.
5. Evaluate tax incentives as NPV timing benefits, not headline percentages.
6. Flag retroactive policy risk, EU State Aid clawback risk, and non-EUR currency risk explicitly.
7. Close every substantive response with: "Source: Hyperion AI scoring engine — verify all parameters against primary sources before committing capital."

Respond as a precise, data-driven energy CapEx analyst. Be specific, cite scores, flag risks clearly.`;
}

// ---------------------------------------------------------------------------
// Chat — context banner
// ---------------------------------------------------------------------------

function buildContextBanner() {
  const pills = [
    state.profile    ? { low_risk_core: '🏛️ Low Risk Core', value_add: '📈 Value-Add', esg_impact: '🌱 ESG Impact' }[state.profile] : null,
    state.technology ? TECH_LABELS[state.technology] : null,
    state.budget     ? state.budget.label            : null,
    '30 Jurisdictions',
  ].filter(Boolean);
  document.getElementById('ctx-pills').innerHTML =
    pills.map(p => `<span class="summary-pill">${escHtml(p)}</span>`).join('');
}

// ---------------------------------------------------------------------------
// Chat — suggested questions
// ---------------------------------------------------------------------------

function buildSuggestions(technology) {
  const techQ = (SUGGESTIONS[technology] ?? []).slice(0, 3);
  const all   = [...techQ, ...COMMON_SUGGESTIONS].slice(0, 5);
  const $el   = document.getElementById('chat-suggestions');
  $el.innerHTML = all.map(q =>
    `<button class="suggestion-chip">${escHtml(q)}</button>`
  ).join('');
  $el.querySelectorAll('.suggestion-chip').forEach(chip =>
    chip.addEventListener('click', () => sendChatMessage(chip.textContent))
  );
}

// ---------------------------------------------------------------------------
// Chat — auto-open message
// ---------------------------------------------------------------------------

function buildAutoMessage() {
  const tech    = TECH_LABELS[state.technology] || state.technology || 'renewable energy';
  const budget  = state.budget?.label           || 'an unspecified budget';
  const profile = PROFILES[state.profile]       || state.profile   || 'an unspecified profile';
  return `I am assessing ${tech} infrastructure with a budget of ${budget} across all European markets. My investment profile is "${profile}". Please provide an executive summary of the key opportunities and material risks across the top 10 jurisdictions, ranked by composite score, and flag any STOP-level concerns.`;
}

// ---------------------------------------------------------------------------
// Chat — message rendering
// ---------------------------------------------------------------------------

function renderMarkdown(text) {
  const esc = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/\*\*(.+?)\*\*/g,  '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g,  '<em>$1</em>')
    .replace(/`([^`\n]+)`/g,    '<code class="inline-code">$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g,   '<br>')
    .replace(/^/,     '<p>')
    .replace(/$/,     '</p>');
}

function renderMessage(role, content) {
  const $msgs = document.getElementById('chat-messages');
  const div   = document.createElement('div');
  div.className = `msg-bubble msg-${role}`;
  if (role === 'user') {
    div.innerHTML = `<div class="msg-content">${escHtml(content)}</div>`;
  } else if (role === 'assistant') {
    div.innerHTML = `<div class="msg-avatar">${BOLT_SVG}</div><div class="msg-content">${renderMarkdown(content)}</div>`;
  } else {
    div.innerHTML = `<div class="msg-content msg-error-content">${escHtml(content)}</div>`;
  }
  $msgs.appendChild(div);
  $msgs.scrollTop = $msgs.scrollHeight;
  return div;
}

function renderTyping() {
  const $msgs = document.getElementById('chat-messages');
  const div   = document.createElement('div');
  div.className = 'msg-bubble msg-assistant msg-typing';
  div.innerHTML = `<div class="msg-avatar">${BOLT_SVG}</div><div class="msg-content"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
  $msgs.appendChild(div);
  $msgs.scrollTop = $msgs.scrollHeight;
  return div;
}

// ---------------------------------------------------------------------------
// Chat — Claude API call
// ---------------------------------------------------------------------------

async function callClaudeApi(messages) {
  console.log('[Hyperion] fetch POST /api/chat', { messageCount: messages.length });
  let resp;
  try {
    resp = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-access-token':  window.HYPERION_ACCESS_TOKEN ?? '',
      },
      body: JSON.stringify({ system: chatSystemPrompt, messages }),
    });
  } catch {
    throw new Error('Cannot reach the Hyperion server. Run server.ps1 first, then open http://localhost:8000');
  }
  if (resp.status === 405) {
    throw new Error('Server not running. Open a terminal and run:  powershell -ExecutionPolicy Bypass -File server.ps1  then open http://localhost:8000');
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.detail ?? `Server error ${resp.status}`);
  }
  const data = await resp.json();
  return data.content ?? '';
}

async function checkServer() {
  try {
    const r = await fetch('/api/health');
    if (r.ok) return;
  } catch { /* fall through */ }
  showServerBanner();
}

function showServerBanner() {
  const existing = document.getElementById('server-banner');
  if (existing) return;
  const banner = document.createElement('div');
  banner.id = 'server-banner';
  banner.innerHTML = `
    <span>⚠️ <strong>Server not running.</strong> Chat will not work until you start it.</span>
    <span class="server-banner-cmd">powershell -ExecutionPolicy Bypass -File server.ps1</span>
    <span>then open <strong>http://localhost:8000</strong></span>
    <button onclick="this.parentElement.remove();checkServer()">Retry</button>
  `;
  document.body.prepend(banner);
}

checkServer();

// ---------------------------------------------------------------------------
// About Me — editable bubble with localStorage persistence
// ---------------------------------------------------------------------------

document.getElementById('pane1-next-btn')?.addEventListener('click', () => showStep(2));

// ---------------------------------------------------------------------------
// Chat — send a message
// ---------------------------------------------------------------------------

async function sendChatMessage(text) {
  if (!text?.trim()) return;
  const $send  = document.getElementById('chat-send');
  const $input = document.getElementById('chat-input');
  $send.disabled = true;
  $input.value   = '';
  renderMessage('user', text);
  chatHistory.push({ role: 'user', content: text });
  document.getElementById('chat-suggestions').innerHTML = '';
  const typing = renderTyping();
  try {
    const reply = await callClaudeApi(chatHistory);
    typing.remove();
    renderMessage('assistant', reply);
    chatHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    typing.remove();
    renderMessage('error', `Analysis failed: ${err.message}`);
  }
  $send.disabled = false;
}

// ---------------------------------------------------------------------------
// Chat — initialise panel
// ---------------------------------------------------------------------------

function initChat(queryResult) {
  chatSystemPrompt = buildSystemPrompt(queryResult);
  chatHistory.length = 0;
}

// ---------------------------------------------------------------------------
// Chat — event listeners
// ---------------------------------------------------------------------------

document.getElementById('chat-send').addEventListener('click', () => {
  sendChatMessage(document.getElementById('chat-input').value.trim());
});

document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage(e.target.value.trim());
  }
});

document.getElementById('chat-input').addEventListener('input', e => {
  document.getElementById('chat-send').disabled = !e.target.value.trim();
});

document.getElementById('ctx-edit-btn').addEventListener('click', () => {
  showStep(3);
  document.getElementById('query-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------------------------------------------------------------------------
// Render: Ranked (all 30 or filtered)
// ---------------------------------------------------------------------------

function renderRanked(queryResult) {
  const { meta, rankedSummary } = queryResult;

  const groups = {
    GREEN: rankedSummary.filter(r => r.rag === 'GREEN'),
    AMBER: rankedSummary.filter(r => r.rag === 'AMBER'),
    RED:   rankedSummary.filter(r => r.rag === 'RED'),
  };

  const groupLabel = {
    GREEN: '✅ Proceed — meets profile criteria',
    AMBER: '⚠️ Proceed with conditions',
    RED:   '🛑 Material concerns — do not proceed without mitigation',
  };

  let html = `
    <div class="results-header">
      <div>
        <div class="results-title">Jurisdiction Ranking</div>
      </div>
      <div class="results-meta-pills">
        ${metaPill('Profile', PROFILES[meta.profile])}
        ${metaPill('Technology', TECH_LABELS[meta.technology])}
        ${metaPill('Jurisdictions', meta.jurisdictionCount)}
        ${metaPill('Date', meta.timestamp)}
      </div>
    </div>
  `;

  for (const rag of ['GREEN', 'AMBER', 'RED']) {
    if (groups[rag].length === 0) continue;
    html += `<div class="ranked-group">
      <div class="ranked-group-title ${rag}">${groupLabel[rag]} (${groups[rag].length})</div>`;
    groups[rag].forEach(item => {
      html += buildRankedCardHtml(item);
    });
    html += `</div>`;
  }

  html += buildNewAnalysisBtn();
  $resultsContent.innerHTML = html;
  attachRankedCardListeners();
}

function buildRankedCardHtml(item) {
  return `
    <div class="ranked-card" data-iso="${item.isoCode}">
      <div class="ranked-card-top">
        <span class="rank-num">#${item.rank}</span>
        <span class="country-flag">${flag(item.isoCode)}</span>
        <span class="country-name">${escHtml(item.name)}</span>
        ${ragBadge(item.rag)}
        <div class="score-cell">
          <div class="composite-score">${item.composite}<span class="denom">/100</span></div>
          ${buildMiniBar(item.composite, barColorClass(item.composite))}
        </div>
        <span class="expand-icon">▼</span>
      </div>
      <div class="ranked-card-detail" style="display:none">
        ${buildComponentBarsHtml(item.components, item.weights)}
        ${buildAlertsHtml(item.alerts)}
        <div class="inline-rec">${escHtml(item.recommendation)}</div>
      </div>
    </div>
  `;
}

function attachRankedCardListeners() {
  $resultsContent.querySelectorAll('.ranked-card-top').forEach(top => {
    top.addEventListener('click', () => {
      const detail = top.nextElementSibling;
      const icon   = top.querySelector('.expand-icon');
      const isOpen = detail.style.display === 'block';
      detail.style.display = isOpen ? 'none' : 'block';
      icon.classList.toggle('open', !isOpen);
    });
  });
}

// ---------------------------------------------------------------------------
// Render: Compare (Rule 5B side-by-side)
// ---------------------------------------------------------------------------

function renderCompare(queryResult) {
  const { meta, rankedSummary, comparisonTable, ranked } = queryResult;

  if (!comparisonTable) {
    renderRanked(queryResult);
    return;
  }

  const { categories, columns } = comparisonTable;

  // Build comparison table HTML
  let tableHtml = `
    <div class="comparison-wrap">
      <table class="comparison-table">
        <thead>
          <tr>
            <th class="cat-th">Category</th>
            ${columns.map(col => `
              <th>
                <div class="comp-col-header">
                  <span class="comp-col-flag">${flag(col.isoCode)}</span>
                  <span class="comp-col-name">${escHtml(col.name)}</span>
                  ${ragBadge(col.rag)}
                  <span style="font-size:14px;font-weight:800;color:#f8fafc">${col.composite}</span>
                  <div style="width:100%;height:3px;background:rgba(255,255,255,0.15);border-radius:2px;margin-top:2px">
                    <div style="width:${col.composite}%;height:100%;background:rgba(255,255,255,0.55);border-radius:2px"></div>
                  </div>
                </div>
              </th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${categories.map((cat, idx) => `
            <tr${idx % 2 === 0 ? ' class="row-stripe"' : ''}>
              <td class="cat-td">${escHtml(cat.label)}</td>
              ${columns.map(col => `<td class="data-cell">${buildCellHtml(cat.key, col.cells[cat.key])}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Component scores table
  const compKeys = Object.keys(COMPONENT_LABELS);
  let scoreTableHtml = `
    <div class="comparison-wrap">
      <table class="comparison-table">
        <thead>
          <tr>
            <th class="cat-th">Dimension (0–100)</th>
            ${columns.map(col => `<th><div class="comp-col-header"><span class="comp-col-flag">${flag(col.isoCode)}</span><span class="comp-col-name">${escHtml(col.name)}</span></div></th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${compKeys.map(k => {
            const wtPct = Math.round((rankedSummary[0]?.weights[k] ?? 0) * 100);
            return `
              <tr>
                <td class="cat-td">${COMPONENT_LABELS[k]} <small style="color:#94a3b8">(${wtPct}%)</small></td>
                ${rankedSummary.map(item => {
                  const score = item.components[k];
                  const colorClass = barColorClass(score);
                  const color = score >= 72 ? 'color:#16a34a' : score >= 52 ? 'color:#b45309' : 'color:#b91c1c';
                  return `<td style="font-weight:700;${color}">${score}${buildMiniBar(score, colorClass)}</td>`;
                }).join('')}
              </tr>
            `;
          }).join('')}
          <tr style="background:#f8fafc">
            <td class="cat-td" style="font-weight:700">Composite Score</td>
            ${rankedSummary.map(item => `
              <td style="font-weight:800;font-size:15px">
                ${item.composite}
                ${buildMiniBar(item.composite, barColorClass(item.composite))}
                ${ragBadge(item.rag, 'display:block;margin-top:4px;width:fit-content')}
              </td>
            `).join('')}
          </tr>
        </tbody>
      </table>
    </div>
  `;

  $resultsContent.innerHTML = `
    <div class="results-header">
      <div>
        <div class="results-title">Jurisdiction Comparison</div>
      </div>
      <div class="results-meta-pills">
        ${metaPill('Profile', PROFILES[meta.profile])}
        ${metaPill('Technology', TECH_LABELS[meta.technology])}
        ${metaPill('Comparing', `${columns.length} jurisdictions`)}
      </div>
    </div>
    <div class="section-header">Standardised Comparison (Rule 5B)</div>
    ${tableHtml}
    <div class="section-header">Component Score Breakdown (Rule 4D)</div>
    ${scoreTableHtml}
    ${buildAlertsForAll(rankedSummary)}
    ${buildNewAnalysisBtn()}
  `;
}

function buildAlertsForAll(rankedSummary) {
  const withAlerts = rankedSummary.filter(r => r.alerts.length > 0);
  if (withAlerts.length === 0) return '';
  let html = `<div class="section-header">Alerts</div>`;
  withAlerts.forEach(item => {
    html += `<div style="margin-bottom:8px"><strong>${flag(item.isoCode)} ${escHtml(item.name)}</strong></div>`;
    html += buildAlertsHtml(item.alerts);
  });
  return html;
}

// ---------------------------------------------------------------------------
// Render: Inspect (single jurisdiction deep-dive)
// ---------------------------------------------------------------------------

function renderInspect(inspectResult) {
  const { result, ragMatrix, financials, rawData } = inspectResult;
  const { name, isoCode, compositeScore, ragOverall, recommendation } = result;

  const recIcon = ragIcon(ragOverall);

  $resultsContent.innerHTML = `
    <div class="results-header">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:32px">${flag(isoCode)}</span>
        <div>
          <div class="results-title">${escHtml(name)}</div>
          <div style="font-size:13px;color:#64748b">${escHtml(isoCode)} · ${escHtml(TECH_LABELS[result.technologyApplied])}</div>
        </div>
        ${ragBadge(ragOverall, 'font-size:13px;padding:5px 14px')}
        <span style="font-size:26px;font-weight:800">${compositeScore}<span style="font-size:14px;font-weight:400;color:#64748b">/100</span></span>
      </div>
      <div class="results-meta-pills">
        ${metaPill('Profile', PROFILES[result.profileApplied])}
        ${metaPill('Technology', TECH_LABELS[result.technologyApplied])}
      </div>
    </div>

    <div class="rec-box ${ragOverall}">
      <span class="rec-icon">${recIcon}</span>
      <span>${escHtml(recommendation)}</span>
    </div>

    <div class="section-header">RAG Matrix (Rule 5A)</div>
    ${buildRagMatrixTableHtml(ragMatrix)}

    ${ragMatrix.alerts.length > 0 ? `<div class="section-header">Alerts</div>${buildAlertsHtml(ragMatrix.alerts)}` : ''}

    <div class="section-header">Financial Model Inputs (Rule 3D)</div>
    ${buildFinancialsHtml(financials)}

    ${buildNewAnalysisBtn()}
  `;
}

// ---------------------------------------------------------------------------
// RAG Matrix table builder
// ---------------------------------------------------------------------------

function buildRagMatrixTableHtml(ragMatrix) {
  const { rows } = ragMatrix;
  return `
    <div class="rag-matrix-wrap">
      <table class="rag-matrix-table">
        <thead>
          <tr>
            <th>Dimension</th>
            <th style="text-align:center">Score</th>
            <th style="text-align:center">Weight</th>
            <th style="text-align:center">RAG</th>
            <th>Rationale</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              <td style="font-weight:600">${escHtml(row.category)}</td>
              <td class="rag-score-cell">${row.score.toFixed(0)}</td>
              <td class="rag-weight-cell">${row.weight}</td>
              <td style="text-align:center">${ragBadge(row.rag)}</td>
              <td class="rag-rationale-cell">${escHtml(row.rationale)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Financial metrics builder
// ---------------------------------------------------------------------------

function buildFinancialsHtml(financials) {
  if (!financials || financials.length === 0) return '<p style="color:#64748b;font-size:13px">No financial data available.</p>';

  const f = financials[0];
  if (f.note) return `<p style="color:#64748b;font-size:13px">${escHtml(f.note)}</p>`;

  const rows = [
    ['Mechanism Type',      f.mechanismType,                'Rule 3A: revenue floor classification'],
    ['Revenue Ceiling / Floor', f.revenueCeiling != null ? `EUR ${f.revenueCeiling} /MWh (indicative)` : '—', 'Verify current auction results before use'],
    ['Contract Term',       f.contractYears != null ? `${f.contractYears} years` : '—', ''],
    ['Capacity Factor (P50)', f.capacityFactorPct != null ? `${f.capacityFactorPct}%` : '—', 'Site-specific — use local wind/solar assessment'],
    ['CapEx (typical)',     f.capexEurPerMw != null ? `EUR ${Number(f.capexEurPerMw).toLocaleString()} /MW` : '—', 'Rule 3C: EUR native'],
    ['OpEx (typical)',      f.opexEurPerMwYear != null ? `EUR ${Number(f.opexEurPerMwYear).toLocaleString()} /MW/yr` : '—', ''],
    ['LCOE (25yr, 7% WACC)', f.lcoeEurMwh != null ? `EUR ${f.lcoeEurMwh} /MWh` : '—', 'Rule 3D: nominal, pre-tax, no financing'],
    ['Simple CapEx Payback', f.simplePaybackYears != null ? (f.simplePaybackYears === Infinity ? 'Cash-flow negative' : `${f.simplePaybackYears} years`) : '—', 'Pre-tax, unlevered'],
  ];

  const tableHtml = `
    <div class="fin-wrap">
      <table class="fin-table">
        <thead><tr><th>Metric</th><th>Value</th><th>Note</th></tr></thead>
        <tbody>
          ${rows.map(([metric, value, note]) => `
            <tr>
              <td style="font-weight:600">${escHtml(metric)}</td>
              <td class="fin-metric">${escHtml(value)}</td>
              <td style="font-size:11px;color:#64748b">${escHtml(note)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  const staleNote = f.staleness
    ? `<div class="staleness-note">⚠️ Staleness warning: ${escHtml(f.staleness)}</div>`
    : '';

  const finNotes = f.notes
    ? `<p style="font-size:12px;color:#64748b;margin-top:8px">${escHtml(f.notes)}</p>`
    : '';

  return tableHtml + staleNote + finNotes;
}

// ---------------------------------------------------------------------------
// Component bars HTML
// ---------------------------------------------------------------------------

function buildComponentBarsHtml(components, weights) {
  const keys = Object.keys(COMPONENT_LABELS);
  const rows = keys.map(k => {
    const score  = components[k] ?? 0;
    const wt     = Math.round((weights[k] ?? 0) * 100);
    const cls    = barColorClass(score);
    return `
      <div class="comp-bar-row">
        <span class="comp-bar-label">${COMPONENT_LABELS[k]}</span>
        <div class="comp-bar-track">
          <div class="comp-bar-fill ${cls}" style="width:${score}%"></div>
        </div>
        <span class="comp-bar-val">${score.toFixed(0)}</span>
        <span class="comp-bar-wt">${wt}%</span>
      </div>
    `;
  }).join('');
  return `<div class="component-bars">${rows}</div>`;
}

// ---------------------------------------------------------------------------
// Alerts HTML
// ---------------------------------------------------------------------------

function buildAlertsHtml(alerts) {
  if (!alerts || alerts.length === 0) return '';
  return `<div class="alert-list">${alerts.map(a => {
    const isStop = a.startsWith('STOP');
    return `<div class="alert-item${isStop ? ' stop' : ''}">
      <span class="alert-icon">${isStop ? '🛑' : '⚠️'}</span>
      <span>${escHtml(a)}</span>
    </div>`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------------------
// "New Analysis" button
// ---------------------------------------------------------------------------

function buildNewAnalysisBtn() {
  return `
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;text-align:center">
      <button onclick="document.getElementById('query-panel').scrollIntoView({behavior:'smooth'})"
              style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:10px 24px;
                     font-size:14px;font-weight:600;cursor:pointer;color:#374151">
        ← Run a new analysis
      </button>
    </div>
  `;
}
