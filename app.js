/* =====================================================================
   CONFIG: paste the two "Publish to web" CSV links here.
   In the Market Matrix sheet: File > Share > Publish to web, choose the
   "Jobs" tab and "Comma-separated values (.csv)", publish, copy the link.
   Repeat for the "Requirements" tab. Publish ONLY these two tabs.
   ===================================================================== */
const JOBS_CSV_URL = "PASTE_JOBS_CSV_URL_HERE";
const REQS_CSV_URL = "PASTE_REQUIREMENTS_CSV_URL_HERE";
/* ===================================================================== */

(function () {
  'use strict';

  const C = { green: '#2F4F3A', greenSoft: '#6F8F72', brown: '#7A5230', tan: '#C9A27E', sand: '#E3D3B5', ink: '#2B2620', muted: '#7D7466', grid: '#EFE7D6' };
  const PALETTE = [C.green, C.brown, C.tan, C.greenSoft, '#A47148', '#4F6B57', '#B89A6A', '#8C6A4F'];

  /* ---------- column matching (by header name, case-insensitive) ---------- */
  const JOB_FIELDS = {
    id: ['id', 'jobid'],
    date: ['date', 'dateposted', 'datefound', 'posted', 'dateadded'],
    company: ['company', 'employer', 'companyname'],
    role: ['role', 'jobtitle', 'title', 'position'],
    family: ['rolefamily', 'family'],
    seniority: ['seniority', 'senioritylevel', 'level'],
    link: ['link', 'url', 'joblink', 'adlink', 'joburl'],
    remote: ['remotetype', 'remote', 'workmode', 'remotestatus'],
    location: ['location', 'locations'],
    languages: ['languagesrequired', 'languages', 'language', 'languagerequired'],
    salary: ['salary', 'salaryrange', 'pay', 'compensation'],
    years: ['yearsofexperience', 'yearsexperience', 'experience', 'yoe', 'experienceyears'],
    industry: ['industry', 'sector'],
    portfolio: ['portfolioorworksamplesasked', 'portfolioorworksamples', 'portfolioasked', 'portfolio', 'worksamples', 'worksamplesasked'],
    certs: ['certifications', 'certification', 'certs'],
    score: ['matchscore', 'match', 'score', 'matchpercent', 'matchscorepercent']
  };
  const REQ_FIELDS = {
    jobId: ['jobid', 'id', 'job'],
    requirement: ['requirement', 'skill', 'requirementname', 'name'],
    type: ['type', 'category', 'requirementtype'],
    priority: ['musthaveornicetohave', 'mustornice', 'mustnice', 'priority', 'importance', 'musthave'],
    has: ['hasit', 'shehasit', 'has', 'meets', 'match', 'yespartialno']
  };
  const REQUIRED_JOB = ['id', 'date', 'company', 'role', 'family', 'seniority', 'link', 'remote', 'languages', 'salary', 'portfolio', 'score'];
  const REQUIRED_REQ = ['jobId', 'requirement', 'type', 'priority', 'has'];
  const LABELS = { id: 'ID', date: 'date', company: 'company', role: 'role', family: 'role family', seniority: 'seniority', link: 'link', remote: 'remote type', location: 'location', languages: 'languages required', salary: 'salary', years: 'years of experience', industry: 'industry', portfolio: 'portfolio or work samples asked', certs: 'certifications', score: 'match score', jobId: 'job ID', requirement: 'requirement', type: 'type', priority: 'Must-have or Nice-to-have', has: 'has it (Yes / Partial / No)' };

  const normKey = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  function resolveColumns(headers, fields) {
    const map = {}; const used = new Set();
    const normed = headers.map((h) => ({ raw: h, n: normKey(h) }));
    // pass 1: exact alias match
    for (const [field, aliases] of Object.entries(fields)) {
      for (const a of aliases) {
        const hit = normed.find((h) => h.n === a && !used.has(h.raw));
        if (hit) { map[field] = hit.raw; used.add(hit.raw); break; }
      }
    }
    // pass 2: header contains a longer alias
    for (const [field, aliases] of Object.entries(fields)) {
      if (map[field]) continue;
      for (const a of aliases) {
        if (a.length < 5) continue;
        const hit = normed.find((h) => h.n.includes(a) && !used.has(h.raw));
        if (hit) { map[field] = hit.raw; used.add(hit.raw); break; }
      }
    }
    return map;
  }

  /* ---------- value parsing ---------- */
  const clean = (v) => (v == null ? '' : String(v).trim());

  function parseScore(v) {
    const s = clean(v).replace(',', '.');
    const m = s.match(/-?\d+(\.\d+)?/);
    if (!m) return null;
    let n = parseFloat(m[0]);
    if (!s.includes('%') && n > 0 && n <= 1 && s.includes('.')) n *= 100;
    return Math.max(0, Math.min(100, n));
  }

  function parseDate(v) {
    const s = clean(v);
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12);
    m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/); // European day/month/year
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], 12);
    const t = Date.parse(s);
    if (isNaN(t)) return null;
    const d = new Date(t); d.setHours(12, 0, 0, 0); return d;
  }

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() || 7) - 1), 12);
    return { key: t.getUTCFullYear() + '-W' + String(week).padStart(2, '0'), monday };
  }

  const fmtDate = (d) => (d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  function normPriority(v) {
    const s = clean(v).toLowerCase();
    if (/must/.test(s) || s === 'required') return 'Must-have';
    if (/nice|optional|bonus|plus|preferred/.test(s)) return 'Nice-to-have';
    return 'Unspecified';
  }
  function normHas(v) {
    const s = clean(v).toLowerCase();
    if (/partial/.test(s)) return 'Partial';
    if (/^y/.test(s)) return 'Yes';
    if (/^n/.test(s)) return 'No';
    return '';
  }
  function normType(v) {
    const s = clean(v).toLowerCase();
    if (/hard/.test(s)) return 'Hard skill';
    if (/tool|software|platform/.test(s)) return 'Tool';
    if (/soft/.test(s)) return 'Soft skill';
    if (/portfolio|sample/.test(s)) return 'Portfolio';
    if (/lang/.test(s)) return 'Language';
    if (/cert/.test(s)) return 'Certification';
    return clean(v) || 'Other';
  }
  function isRemoteConfirmed(v) {
    const s = clean(v).toLowerCase();
    if (!/remote/.test(s)) return false;
    return !/(unconfirmed|not confirmed|unclear|unknown|tbc|tbd|\?|hybrid|on.?site|office)/.test(s);
  }
  function asksPortfolio(v) {
    const s = clean(v).toLowerCase();
    if (!s) return false;
    return !/^(no|none|n\/a|na|-|false|0|not asked|not mentioned)$/.test(s);
  }
  function splitLanguages(v) {
    return clean(v).replace(/\([^)]*\)/g, '').split(/[,;\/|+&]|\band\b|\bor\b/i)
      .map((x) => x.trim()).filter((x) => x && !/^(none|n\/a|-)$/i.test(x))
      .map((x) => x.charAt(0).toUpperCase() + x.slice(1));
  }
  const safeUrl = (u) => (/^https?:\/\//i.test(clean(u)) ? clean(u) : '');

  function parseSalary(raw) {
    const s = clean(raw);
    if (!s || !/\d/.test(s)) return null;
    const cur = /€|eur/i.test(s) ? 'EUR' : /£|gbp/i.test(s) ? 'GBP' : /chf/i.test(s) ? 'CHF' : /pln|zł/i.test(s) ? 'PLN' : /\$|usd/i.test(s) ? 'USD' : 'Unknown';
    const period = /(hour|hr\b|\/h\b|per h\b|hourly)/i.test(s) ? 'hour'
      : /(month|\/mo\b|\bmo\b|\/m\b|pcm|monthly|mensual|monat)/i.test(s) ? 'month'
      : /(\bday\b|daily|\/d\b)/i.test(s) ? 'day' : 'year';
    const re = /(\d{1,3}(?:[.,\u00a0 ]\d{3})+|\d+(?:[.,]\d+)?)\s*(k\b|K\b|thousand)?/g;
    const nums = []; let m; let anyK = false;
    while ((m = re.exec(s))) {
      const t = m[1]; let v;
      if (/^\d{1,3}([.,\u00a0 ]\d{3})+$/.test(t)) v = parseFloat(t.replace(/[.,\u00a0 ]/g, ''));
      else v = parseFloat(t.replace(',', '.'));
      if (m[2]) { v *= 1000; anyK = true; }
      nums.push(v);
    }
    let vals = nums.map((v) => (anyK && v < 1000 ? v * 1000 : v));
    const floor = period === 'year' ? 1000 : period === 'month' ? 100 : 1;
    vals = vals.filter((v) => v >= floor).slice(0, 2);
    if (!vals.length) return null;
    const min = Math.min(...vals), max = Math.max(...vals);
    const mult = period === 'month' ? 12 : period === 'year' ? 1 : null;
    return { min, max, cur, period, annualMin: mult ? min * mult : null, annualMax: mult ? max * mult : null };
  }

  /* ---------- data loading ---------- */
  function sourceUrls() {
    let jobs = JOBS_CSV_URL, reqs = REQS_CSV_URL;
    // Local testing only: allow ?jobs=...&reqs=... overrides on localhost.
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      const p = new URLSearchParams(location.search);
      if (p.get('jobs')) jobs = p.get('jobs');
      if (p.get('reqs')) reqs = p.get('reqs');
    }
    return { jobs, reqs };
  }
  const isPlaceholder = (u) => !u || /^PASTE_/.test(u);

  async function loadCsv(url, name) {
    if (isPlaceholder(url)) throw new Error('The ' + name + ' link has not been added yet.');
    const sep = url.includes('?') ? '&' : '?';
    let res;
    try { res = await fetch(url + sep + '_cb=' + Date.now(), { cache: 'no-store' }); }
    catch (e) { throw new Error('The ' + name + ' tab could not be reached. Check your connection or the link.'); }
    if (!res.ok) throw new Error('The ' + name + ' tab returned an error (' + res.status + ').');
    const text = await res.text();
    if (/^\s*<(!doctype|html)/i.test(text)) throw new Error('The ' + name + ' link returned a web page instead of CSV. Check that the tab is published as CSV.');
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() });
    return { rows: parsed.data, headers: parsed.meta.fields || [] };
  }

  /* ---------- state ---------- */
  const state = { jobs: [], reqs: [], reqsByJob: new Map(), charts: {}, sort: { key: 'score', dir: -1 }, search: '' };

  function buildJobs(rows, map) {
    return rows.map((r, i) => {
      const g = (f) => (map[f] ? clean(r[map[f]]) : '');
      const date = parseDate(g('date'));
      return {
        id: g('id') || 'row-' + (i + 2), date, week: date ? isoWeek(date) : null,
        company: g('company'), role: g('role'), family: g('family'), seniority: g('seniority'),
        link: safeUrl(g('link')), remote: g('remote'), remoteOk: isRemoteConfirmed(g('remote')),
        location: g('location'), languagesRaw: g('languages'), languages: splitLanguages(g('languages')),
        salaryRaw: g('salary'), salary: parseSalary(g('salary')), years: g('years'), industry: g('industry'),
        portfolioRaw: g('portfolio'), portfolio: asksPortfolio(g('portfolio')), certs: g('certs'), score: parseScore(g('score'))
      };
    }).filter((j) => j.company || j.role);
  }
  function buildReqs(rows, map) {
    return rows.map((r) => {
      const g = (f) => (map[f] ? clean(r[map[f]]) : '');
      return { jobId: g('jobId'), name: g('requirement'), type: normType(g('type')), priority: normPriority(g('priority')), has: normHas(g('has')) };
    }).filter((q) => q.name);
  }

  /* ---------- helpers ---------- */
  function canonicalGroups(values) {
    // groups case-insensitively, keeps the most common spelling
    const counts = new Map();
    for (const v of values) {
      if (!v) continue;
      const k = v.toLowerCase().replace(/\s+/g, ' ');
      if (!counts.has(k)) counts.set(k, new Map());
      const m = counts.get(k); m.set(v, (m.get(v) || 0) + 1);
    }
    const out = new Map();
    for (const [k, m] of counts) out.set(k, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    return out;
  }
  const keyOf = (v) => clean(v).toLowerCase().replace(/\s+/g, ' ');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const pct = (n) => (n == null || isNaN(n) ? 'n/a' : Math.round(n) + '%');
  const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  const money = (n, cur) => {
    const sym = { EUR: '\u20ac', GBP: '\u00a3', USD: '$' }[cur] || '';
    const v = n >= 1000 ? Math.round(n / 1000) + 'k' : String(Math.round(n));
    return sym ? sym + v : v + (cur && cur !== 'Unknown' ? ' ' + cur : '');
  };
  const shortLabel = (s, n) => (s.length > n ? s.slice(0, n - 1) + '\u2026' : s);

  function showEmpty(boxId, msg) {
    const box = document.getElementById(boxId);
    const id = box.querySelector('canvas') ? box.querySelector('canvas').id : null;
    if (id && state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
    box.style.height = 'auto';
    box.innerHTML = '';
    box.appendChild(el('div', 'empty', msg));
    if (id) { const c = el('canvas'); c.id = id; c.hidden = true; box.appendChild(c); }
  }
  function chart(boxId, canvasId, config, height) {
    const box = document.getElementById(boxId);
    if (state.charts[canvasId]) { state.charts[canvasId].destroy(); delete state.charts[canvasId]; }
    box.innerHTML = '';
    const c = el('canvas'); c.id = canvasId; box.appendChild(c);
    box.style.height = (height || 300) + 'px';
    config.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 300 } }, config.options || {});
    state.charts[canvasId] = new Chart(c, config);
  }
  const isNarrow = () => window.innerWidth < 520;

  function hBarStacked(boxId, canvasId, labels, datasets) {
    const n = isNarrow() ? 20 : 34;
    chart(boxId, canvasId, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        indexAxis: 'y',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: { callbacks: { title: (it) => labels[it[0].dataIndex] } } },
        scales: {
          x: { stacked: true, ticks: { precision: 0 }, grid: { color: C.grid } },
          y: { stacked: true, ticks: { autoSkip: false, callback: (v) => shortLabel(labels[v], n), font: { size: 11 } }, grid: { display: false } }
        }
      }
    }, Math.max(140, labels.length * 24 + 70));
  }

  /* ---------- filters ---------- */
  function fillSelect(id, values) {
    const s = document.getElementById(id); const cur = s.value;
    s.length = 1;
    for (const v of values) { const o = el('option', null, v); o.value = v; s.appendChild(o); }
    if (values.includes(cur)) s.value = cur;
  }
  function setupFilters() {
    const sortU = (a) => [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y));
    fillSelect('f-family', sortU([...canonicalGroups(state.jobs.map((j) => j.family)).values()]));
    fillSelect('f-seniority', sortU([...canonicalGroups(state.jobs.map((j) => j.seniority)).values()]));
    fillSelect('f-language', sortU([...canonicalGroups(state.jobs.flatMap((j) => j.languages)).values()]));
    const dates = state.jobs.map((j) => j.date).filter(Boolean).sort((a, b) => a - b);
    if (dates.length) {
      for (const id of ['f-from', 'f-to']) { const i = document.getElementById(id); i.min = ymd(dates[0]); i.max = ymd(dates[dates.length - 1]); }
    }
  }
  function filteredJobs() {
    const fam = keyOf(document.getElementById('f-family').value);
    const sen = keyOf(document.getElementById('f-seniority').value);
    const lang = keyOf(document.getElementById('f-language').value);
    const from = parseDate(document.getElementById('f-from').value);
    const to = parseDate(document.getElementById('f-to').value);
    return state.jobs.filter((j) => {
      if (fam && keyOf(j.family) !== fam) return false;
      if (sen && keyOf(j.seniority) !== sen) return false;
      if (lang && !j.languages.some((l) => keyOf(l) === lang)) return false;
      if (from && (!j.date || j.date < from)) return false;
      if (to && (!j.date || j.date > to)) return false;
      return true;
    });
  }

  /* ---------- sections ---------- */
  function renderKpis(jobs) {
    const box = document.getElementById('kpis'); box.innerHTML = '';
    const scores = jobs.map((j) => j.score).filter((s) => s != null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const remote = jobs.length ? (jobs.filter((j) => j.remoteOk).length / jobs.length) * 100 : null;
    const weekAgo = new Date(); weekAgo.setHours(0, 0, 0, 0); weekAgo.setDate(weekAgo.getDate() - 6);
    const fresh = jobs.filter((j) => j.date && j.date >= weekAgo).length;
    const filtered = jobs.length !== state.jobs.length;
    const cards = [
      ['Jobs tracked', String(jobs.length), filtered ? 'of ' + state.jobs.length + ' in total' : 'in the Market Matrix'],
      ['Average match', pct(avg), scores.length ? 'across ' + scores.length + ' scored jobs' : 'no scores yet'],
      ['Remote confirmed', pct(remote), jobs.length ? jobs.filter((j) => j.remoteOk).length + ' of ' + jobs.length + ' jobs' : ''],
      ['New this week', String(fresh), 'added in the last 7 days']
    ];
    for (const [l, v, n] of cards) {
      const k = el('div', 'kpi'); k.appendChild(el('div', 'label', l)); k.appendChild(el('div', 'value', v)); k.appendChild(el('div', 'note', n)); box.appendChild(k);
    }
  }

  function countByReq(reqs) {
    // distinct jobs per requirement, split by priority
    const names = canonicalGroups(reqs.map((q) => q.name));
    const agg = new Map();
    for (const q of reqs) {
      const k = keyOf(q.name);
      if (!agg.has(k)) agg.set(k, { name: names.get(k), must: new Set(), nice: new Set(), other: new Set(), no: new Set(), partial: new Set(), mustGap: new Set() });
      const a = agg.get(k);
      (q.priority === 'Must-have' ? a.must : q.priority === 'Nice-to-have' ? a.nice : a.other).add(q.jobId);
      if (q.has === 'No') a.no.add(q.jobId);
      if (q.has === 'Partial') a.partial.add(q.jobId);
      if ((q.has === 'No' || q.has === 'Partial') && q.priority === 'Must-have') a.mustGap.add(q.jobId);
    }
    return [...agg.values()];
  }

  function renderTop(reqs, type, boxId, canvasId) {
    const list = countByReq(reqs.filter((q) => q.type === type))
      .map((a) => ({ ...a, total: a.must.size + a.nice.size + a.other.size }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)).slice(0, 20);
    if (!list.length) return showEmpty(boxId, 'No ' + type.toLowerCase() + ' requirements in the data yet.');
    const ds = [
      { label: 'Must-have', data: list.map((a) => a.must.size), backgroundColor: C.green, borderRadius: 3 },
      { label: 'Nice-to-have', data: list.map((a) => a.nice.size), backgroundColor: C.tan, borderRadius: 3 }
    ];
    if (list.some((a) => a.other.size)) ds.push({ label: 'Not marked', data: list.map((a) => a.other.size), backgroundColor: C.sand, borderRadius: 3 });
    hBarStacked(boxId, canvasId, list.map((a) => a.name), ds);
  }

  function renderGaps(reqs) {
    const list = countByReq(reqs.filter((q) => q.has === 'No' || q.has === 'Partial'))
      .map((a) => ({ ...a, total: a.no.size + a.partial.size }))
      .sort((a, b) => b.total - a.total || b.mustGap.size - a.mustGap.size).slice(0, 15);
    if (!list.length) return showEmpty('box-gaps', 'No requirements marked No or Partial for these filters.');
    hBarStacked('box-gaps', 'c-gaps', list.map((a) => a.name), [
      { label: 'No', data: list.map((a) => a.no.size), backgroundColor: C.brown, borderRadius: 3 },
      { label: 'Partial', data: list.map((a) => a.partial.size), backgroundColor: C.tan, borderRadius: 3 }
    ]);
    const ch = state.charts['c-gaps'];
    ch.options.plugins.tooltip.callbacks.footer = (it) => 'Must-have in ' + list[it[0].dataIndex].mustGap.size + ' of these jobs';
    ch.update();
  }

  function renderBreakdown(jobs, field, boxId, canvasId) {
    const names = canonicalGroups(jobs.map((j) => j[field]));
    const agg = new Map();
    for (const j of jobs) {
      const k = keyOf(j[field]) || '(not set)';
      if (!agg.has(k)) agg.set(k, { name: names.get(k) || 'Not set', n: 0, scores: [] });
      const a = agg.get(k); a.n++; if (j.score != null) a.scores.push(j.score);
    }
    const list = [...agg.values()].sort((a, b) => b.n - a.n);
    if (!list.length) return showEmpty(boxId, 'No jobs for these filters.');
    chart(boxId, canvasId, {
      type: 'bar',
      data: { labels: list.map((a) => a.name), datasets: [{ label: 'Jobs', data: list.map((a) => a.n), backgroundColor: list.map((_, i) => PALETTE[i % PALETTE.length]), borderRadius: 4 }] },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (it) => { const s = list[it.dataIndex].scores; return s.length ? 'Average match ' + pct(s.reduce((x, y) => x + y, 0) / s.length) : ''; } } } },
        scales: { x: { ticks: { precision: 0 }, grid: { color: C.grid } }, y: { grid: { display: false } } }
      }
    }, Math.max(160, list.length * 34 + 50));
  }

  function renderSalary(jobs) {
    const listed = jobs.filter((j) => j.salary);
    const note = document.getElementById('salary-note');
    const sum = document.getElementById('salary-summary'); sum.innerHTML = ''; sum.className = 'salary-summary';
    note.textContent = 'Salary is listed for ' + listed.length + ' of ' + jobs.length + ' jobs. Only listed salaries are shown, converted to yearly where the ad gives a monthly figure.';
    if (!listed.length) return showEmpty('box-salary', 'No salaries listed for these filters.');
    const byCur = new Map();
    for (const j of listed) { const c = j.salary.cur; if (!byCur.has(c)) byCur.set(c, []); byCur.get(c).push(j); }
    for (const [cur, js] of byCur) {
      const yearly = js.filter((j) => j.salary.annualMin != null);
      const text = yearly.length
        ? cur + ': ' + js.length + ' listed, median ' + money(median(yearly.map((j) => j.salary.annualMin)), cur) + ' to ' + money(median(yearly.map((j) => j.salary.annualMax)), cur) + ' a year'
        : cur + ': ' + js.length + ' listed (hourly or daily rates)';
      sum.appendChild(el('span', 'pill', text));
    }
    const main = [...byCur.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const cur = main[0];
    const rows = main[1].filter((j) => j.salary.annualMin != null)
      .sort((a, b) => (b.salary.annualMin + b.salary.annualMax) - (a.salary.annualMin + a.salary.annualMax)).slice(0, 25);
    if (!rows.length) return showEmpty('box-salary', 'No yearly or monthly salaries to chart.');
    const labels = rows.map((j) => (j.company || 'Unknown') + ', ' + (j.role || ''));
    const tickLabels = isNarrow() ? rows.map((j) => j.company || 'Unknown') : labels;
    const n = isNarrow() ? 14 : 40;
    chart('box-salary', 'c-salary', {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Yearly range (' + cur + ')', data: rows.map((j) => [j.salary.annualMin, j.salary.annualMax === j.salary.annualMin ? j.salary.annualMax * 1.005 : j.salary.annualMax]), backgroundColor: C.greenSoft, borderRadius: 4, borderSkipped: false }] },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: (it) => labels[it[0].dataIndex], label: (it) => { const s = rows[it.dataIndex].salary; return money(s.annualMin, cur) + ' to ' + money(s.annualMax, cur) + ' a year' + (s.period === 'month' ? ' (from monthly)' : ''); }, afterLabel: (it) => 'As listed: ' + rows[it.dataIndex].salaryRaw } } },
        scales: { x: { ticks: { callback: (v) => money(v, cur) }, grid: { color: C.grid } }, y: { ticks: { autoSkip: false, callback: (v) => shortLabel(tickLabels[v], n), font: { size: 11 } }, grid: { display: false } } }
      }
    }, Math.max(160, rows.length * 24 + 60));
  }

  function renderPortfolio(jobs, reqs) {
    const box = document.getElementById('portfolio-stats'); box.innerHTML = '';
    const asking = jobs.filter((j) => j.portfolio);
    const big = el('div', 'big-stat', jobs.length ? pct((asking.length / jobs.length) * 100) : 'n/a');
    box.appendChild(big);
    box.appendChild(el('p', 'hint', asking.length + ' of ' + jobs.length + ' jobs ask for a portfolio or work samples.'));
    const fams = canonicalGroups(jobs.map((j) => j.family)); const agg = new Map();
    for (const j of jobs) { const k = keyOf(j.family) || '(not set)'; if (!agg.has(k)) agg.set(k, { name: fams.get(k) || 'Not set', n: 0, p: 0 }); const a = agg.get(k); a.n++; if (j.portfolio) a.p++; }
    const ul = el('ul', 'stat-list');
    for (const a of [...agg.values()].sort((x, y) => y.p / y.n - x.p / x.n)) {
      const li = el('li'); li.appendChild(el('span', null, a.name)); li.appendChild(el('span', 'num', a.p + ' of ' + a.n + ' (' + pct((a.p / a.n) * 100) + ')')); ul.appendChild(li);
    }
    if (agg.size) box.appendChild(ul);

    // what they ask for: Portfolio-type requirements, else the text in the jobs column
    let items = countByReq(reqs.filter((q) => q.type === 'Portfolio')).map((a) => ({ name: a.name, n: new Set([...a.must, ...a.nice, ...a.other]).size }));
    if (!items.length) {
      const g = canonicalGroups(asking.map((j) => j.portfolioRaw).filter((v) => !/^(yes|y|true)$/i.test(v)));
      const m = new Map(); for (const j of asking) { const k = keyOf(j.portfolioRaw); if (g.has(k)) m.set(k, (m.get(k) || 0) + 1); }
      items = [...m.entries()].map(([k, n]) => ({ name: g.get(k), n }));
    }
    items.sort((a, b) => b.n - a.n); items = items.slice(0, 15);
    if (!items.length) return showEmpty('box-portfolio', 'No details on portfolio or sample asks yet.');
    const labels = items.map((a) => a.name); const n = isNarrow() ? 22 : 34;
    chart('box-portfolio', 'c-portfolio', {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Jobs', data: items.map((a) => a.n), backgroundColor: C.brown, borderRadius: 4 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { title: (it) => labels[it[0].dataIndex] } } }, scales: { x: { ticks: { precision: 0 }, grid: { color: C.grid } }, y: { ticks: { autoSkip: false, callback: (v) => shortLabel(labels[v], n) }, grid: { display: false } } } }
    }, Math.max(140, items.length * 28 + 50));
  }

  function renderWeekly(jobs, reqs) {
    const dated = jobs.filter((j) => j.week);
    const weeks = new Map();
    for (const j of dated) { const w = j.week; if (!weeks.has(w.key)) weeks.set(w.key, { key: w.key, monday: w.monday, jobs: [] }); weeks.get(w.key).jobs.push(j); }
    const list = [...weeks.values()].sort((a, b) => a.monday - b.monday);
    if (!list.length) { showEmpty('box-weeks', 'No dated jobs yet.'); }
    else {
      chart('box-weeks', 'c-weeks', {
        type: 'bar',
        data: { labels: list.map((w) => w.key.replace(/^\d{4}-/, '') + ' (' + fmtDate(w.monday) + ')'), datasets: [{ label: 'Jobs', data: list.map((w) => w.jobs.length), backgroundColor: C.green, borderRadius: 4 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { ticks: { precision: 0 }, grid: { color: C.grid } }, x: { grid: { display: false }, ticks: { maxRotation: 60, font: { size: 10 } } } } }
      }, 260);
    }
    if (list.length < 3) return showEmpty('box-rising', 'Not enough data yet. Rising skills need at least 3 weeks of jobs (' + list.length + ' so far).');
    const recentKeys = new Set(list.slice(-2).map((w) => w.key));
    const recentIds = new Set(); const priorIds = new Set();
    for (const w of list) for (const j of w.jobs) (recentKeys.has(w.key) ? recentIds : priorIds).add(j.id);
    const names = canonicalGroups(reqs.map((q) => q.name));
    const m = new Map();
    for (const q of reqs) {
      if (q.type === 'Language') continue;
      const k = keyOf(q.name); if (!m.has(k)) m.set(k, { r: new Set(), p: new Set() });
      if (recentIds.has(q.jobId)) m.get(k).r.add(q.jobId); else if (priorIds.has(q.jobId)) m.get(k).p.add(q.jobId);
    }
    const rows = [...m.entries()].map(([k, a]) => ({ name: names.get(k), r: a.r.size, p: a.p.size, delta: (a.r.size / (recentIds.size || 1) - a.p.size / (priorIds.size || 1)) * 100 }))
      .filter((a) => a.r >= 2 && a.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 10);
    if (!rows.length) return showEmpty('box-rising', 'No skills are clearly rising in the last 2 weeks.');
    const labels = rows.map((a) => a.name); const n = isNarrow() ? 22 : 34;
    chart('box-rising', 'c-rising', {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Change in share of jobs (points)', data: rows.map((a) => Math.round(a.delta * 10) / 10), backgroundColor: C.greenSoft, borderRadius: 4 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { title: (it) => labels[it[0].dataIndex], label: (it) => { const a = rows[it.dataIndex]; return '+' + a.delta.toFixed(1) + ' points: ' + a.r + ' of ' + recentIds.size + ' recent jobs vs ' + a.p + ' of ' + priorIds.size + ' before'; } } } }, scales: { x: { ticks: { callback: (v) => '+' + v }, grid: { color: C.grid } }, y: { ticks: { autoSkip: false, callback: (v) => shortLabel(labels[v], n) }, grid: { display: false } } } }
    }, Math.max(140, rows.length * 28 + 50));
  }

  const COLS = [
    ['score', 'Match'], ['company', 'Company'], ['role', 'Role'], ['date', 'Date'], ['family', 'Family'], ['seniority', 'Seniority'],
    ['remote', 'Remote'], ['location', 'Location'], ['languagesRaw', 'Languages'], ['salaryRaw', 'Salary']
  ];
  function renderTable(jobs) {
    const q = state.search.toLowerCase();
    let rows = q ? jobs.filter((j) => [j.company, j.role, j.location, j.family].join(' ').toLowerCase().includes(q)) : jobs.slice();
    const { key, dir } = state.sort;
    rows.sort((a, b) => {
      let x = a[key], y = b[key];
      if (key === 'date') { x = x ? x.getTime() : null; y = y ? y.getTime() : null; }
      if (x == null || x === '') return 1; if (y == null || y === '') return -1;
      if (typeof x === 'number') return (x - y) * dir;
      return String(x).localeCompare(String(y)) * dir;
    });
    const table = document.getElementById('jobs-table');
    const thead = table.tHead; thead.innerHTML = '';
    const tr = el('tr');
    for (const [k, label] of COLS) {
      const th = el('th'); const b = el('button', null, label + (key === k ? (dir < 0 ? ' \u2193' : ' \u2191') : ''));
      b.type = 'button'; b.addEventListener('click', () => { state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : (k === 'score' || k === 'date' ? -1 : 1) }; renderTable(filteredJobs()); });
      th.setAttribute('aria-sort', key === k ? (dir < 0 ? 'descending' : 'ascending') : 'none');
      th.appendChild(b); tr.appendChild(th);
    }
    thead.appendChild(tr);
    const tbody = table.tBodies[0]; tbody.innerHTML = '';
    for (const j of rows) {
      const r = el('tr');
      for (const [k] of COLS) {
        const td = el('td');
        if (k === 'date') { td.textContent = j.date ? fmtDate(j.date) + ' ' + j.date.getFullYear() : ''; td.className = 'nowrap'; }
        else if ((k === 'company' || k === 'role') && j.link) { const a = el('a', null, j[k] || 'Open ad'); a.href = j.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; td.appendChild(a); }
        else if (k === 'score') { if (j.score != null) td.appendChild(el('span', 'score ' + (j.score >= 70 ? 'high' : j.score >= 50 ? 'mid' : ''), pct(j.score))); }
        else td.textContent = j[k] || '';
        r.appendChild(td);
      }
      tbody.appendChild(r);
    }
    document.getElementById('table-count').textContent = 'Showing ' + rows.length + ' of ' + state.jobs.length + ' jobs. Tap a column to sort; company and role open the job ad.';
  }

  /* ---------- render ---------- */
  function render() {
    const jobs = filteredJobs();
    const ids = new Set(jobs.map((j) => j.id));
    const reqs = state.reqs.filter((q) => ids.has(q.jobId));
    renderKpis(jobs);
    renderTop(reqs, 'Hard skill', 'box-hard', 'c-hard');
    renderTop(reqs, 'Tool', 'box-tools', 'c-tools');
    renderGaps(reqs);
    renderBreakdown(jobs, 'family', 'box-family', 'c-family');
    renderBreakdown(jobs, 'seniority', 'box-seniority', 'c-seniority');
    renderSalary(jobs);
    renderPortfolio(jobs, reqs);
    renderWeekly(jobs, reqs);
    renderTable(jobs);
  }

  function alertCard(kind, title, body) {
    const a = el('div', 'alert alert-' + kind); a.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    a.appendChild(el('h3', null, title)); a.appendChild(el('p', null, body));
    document.getElementById('alerts').appendChild(a);
  }

  async function load() {
    document.getElementById('alerts').innerHTML = '';
    document.getElementById('status').textContent = 'Loading the latest data...';
    const src = sourceUrls();
    const [jr, rr] = await Promise.allSettled([loadCsv(src.jobs, 'Jobs'), loadCsv(src.reqs, 'Requirements')]);
    if (jr.status === 'rejected') {
      alertCard('error', 'We could not load the job data', jr.reason.message + ' The dashboard will fill in as soon as the Jobs tab is available.');
    }
    if (rr.status === 'rejected') {
      alertCard('error', 'We could not load the requirements', rr.reason.message + ' Skill charts will stay empty until it loads.');
    }
    const missing = [];
    if (jr.status === 'fulfilled') {
      const map = resolveColumns(jr.value.headers, JOB_FIELDS);
      REQUIRED_JOB.forEach((f) => { if (!map[f]) missing.push('Jobs: ' + LABELS[f]); });
      state.jobs = buildJobs(jr.value.rows, map);
    } else state.jobs = [];
    if (rr.status === 'fulfilled') {
      const map = resolveColumns(rr.value.headers, REQ_FIELDS);
      REQUIRED_REQ.forEach((f) => { if (!map[f]) missing.push('Requirements: ' + LABELS[f]); });
      state.reqs = buildReqs(rr.value.rows, map);
    } else state.reqs = [];
    if (missing.length && (jr.status === 'fulfilled' || rr.status === 'fulfilled')) {
      alertCard('info', 'Some columns were not found', 'These columns are missing or renamed, so related charts may be empty: ' + missing.join(', ') + '.');
    }
    if (jr.status === 'fulfilled' && !state.jobs.length) alertCard('info', 'No jobs yet', 'The Jobs tab loaded but has no rows yet. Check back after the next search run.');
    setupFilters();
    render();
    const now = new Date();
    document.getElementById('status').textContent = jr.status === 'fulfilled'
      ? state.jobs.length + ' jobs and ' + state.reqs.length + ' requirements, loaded at ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : 'Data not loaded';
  }

  /* ---------- init ---------- */
  function init() {
    if (typeof Chart === 'undefined' || typeof Papa === 'undefined') {
      alertCard('error', 'The dashboard could not start', 'A required script did not load. Check your connection and reload the page.');
      return;
    }
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    Chart.defaults.color = C.muted;
    Chart.defaults.plugins.tooltip.backgroundColor = C.ink;
    ['f-family', 'f-seniority', 'f-language', 'f-from', 'f-to'].forEach((id) => document.getElementById(id).addEventListener('change', render));
    document.getElementById('f-reset').addEventListener('click', () => { ['f-family', 'f-seniority', 'f-language', 'f-from', 'f-to'].forEach((id) => { document.getElementById(id).value = ''; }); render(); });
    document.getElementById('t-search').addEventListener('input', (e) => { state.search = e.target.value; renderTable(filteredJobs()); });
    document.getElementById('reload').addEventListener('click', load);
    let w = window.innerWidth;
    window.addEventListener('resize', () => { if ((w < 520) !== (window.innerWidth < 520)) { w = window.innerWidth; render(); } });
    // wait briefly for the web font so chart labels are measured correctly
    const fontReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('11px Inter'), document.fonts.load('600 12px Inter')]) : Promise.resolve();
    Promise.race([fontReady, new Promise((r) => setTimeout(r, 1500))]).catch(() => {}).then(load);
  }
  init();
})();
