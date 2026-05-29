const PILLARS = [
  { id:'p1', label:'Shared Vision & Values', color:'#4AABA3', positioning:'When consistently championed by leaders and lived by teams, it builds clarity and belonging. Our shared vision & mission inspires us to move forward with purpose; our values unite and guide us every day. They shape decision-making and give meaning to every achievement.' },
  { id:'p2', label:'Decisive & Visible Leadership', color:'#CC3535', positioning:'When leaders act—visibly, transparently, and with conviction—they inspire the organisation to perform, collaborate, and commit to shared goals.' },
  { id:'p3', label:'Communication & Transparency', color:'#529E52', positioning:'We build trust and alignment by committing to open, honest, and timely communication at all levels. We share not only successes but also challenges and decisions—creating clarity, reducing uncertainty.' },
  { id:'p4', label:'Recognition & Reward', color:'#E07878', positioning:'Recognition and Reward should be framed less as a "perk" and more as an active driver of your desired culture—shaping what gets celebrated, emulated, and repeated.' },
  { id:'p5', label:'Engagement', color:'#8B7AB8', positioning:'Deep commitment, belonging, and enthusiasm. We cultivate deep connection, commitment, and enthusiasm among every individual and team.' },
  { id:'p6', label:'Continuous Improvement', color:'#AAAA28', positioning:'Fostering an environment where all members seek to improve processes, products, and themselves constantly. We never stand still. We look for ways to learn, adapt, and do things better—for ourselves, our customers, and our business.' }
];

const MONTHS = [
  {num:1,label:'January'}, {num:2,label:'February'}, {num:3,label:'March'},
  {num:4,label:'April'}, {num:5,label:'May'}, {num:6,label:'June'},
  {num:7,label:'July'}, {num:8,label:'August'}, {num:9,label:'September'},
  {num:10,label:'October'}, {num:11,label:'November'}, {num:12,label:'December'}
];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const generateId = () => Math.random().toString(36).substr(2, 9);

// ── State ─────────────────────────────────────────────────────────────────
// Loaded from server on startup; saved back on every change.
const state = { activities:{}, activeTab:'overview', backlog:[] };

function initState(serverState) {
  Object.assign(state, serverState);
  state.activeTab = 'overview';
  if (!state.activities) state.activities = {};
  PILLARS.forEach(p => {
    if (!state.activities[p.id]) state.activities[p.id] = [];
    state.activities[p.id].forEach(a => {
      if (!a.id) a.id = generateId();
      if (!a.children) a.children = [];
    });
  });
  if (!state.backlog) state.backlog = [];
  state.editingActivity  = null;
  state.editingBacklog   = null;
  state.expandedActivities  = new Set();
  state.editingSubTask      = null;
  state.ganttExpandedParents = new Set();
  state.ganttActiveRow       = null;
}

async function loadState() {
  try {
    const res = await fetch('/api/state');
    return res.ok ? await res.json() : {};
  } catch(e) { return {}; }
}

function saveState() {
  fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  }).catch(console.error);
}

const totalCount  = () => Object.values(state.activities).reduce((s,a)=>s+a.length,0);
const pillarCount = id => (state.activities[id]||[]).length;
const highCount   = () => Object.values(state.activities).flat().filter(a=>a.priority==='High').length;
const ownerCount  = () => new Set(Object.values(state.activities).flat().map(a=>a.owner).filter(Boolean)).size;
const doneCount   = () => Object.values(state.activities).flat().filter(a=>a.status==='Done').length;
const scheduledCount = () => Object.values(state.activities).flat().filter(a=>a.startMonth && a.endMonth).length;

const priorityBadge = p => { const m={High:'badge-high',Medium:'badge-medium',Low:'badge-low'}; return `<span class="badge ${m[p]||'badge-low'}">${p}</span>`; };
const statusBadge   = s => { const m={Planned:'badge-planned','In Progress':'badge-inprogress',Done:'badge-done'}; return `<span class="badge ${m[s]||'badge-planned'}">${s}</span>`; };
const supportTags   = (support) => {
  if (!support || support.length === 0) return '';
  const map = {
    BrandComms: { cls:'badge-brandcomms', icon:'ti-paint', label:'Brand & Comms' },
    GGL:        { cls:'badge-ggl',        icon:'ti-world', label:'GGL' }
  };
  return `<div class="support-tags">${support.map(s => {
    const t = map[s]; if (!t) return '';
    return `<span class="badge support-tag ${t.cls}"><i class="ti ${t.icon}" style="font-size:10px" aria-hidden="true"></i> ${t.label}</span>`;
  }).join('')}</div>`;
};
const supportCheckboxes = (pfx, support) => {
  const has = (v) => (support||[]).includes(v) ? 'checked' : '';
  return `<div class="support-check-row">
    <label class="support-check-label"><input type="checkbox" id="${pfx}-brandcomms" ${has('BrandComms')} /><span class="badge support-tag badge-brandcomms"><i class="ti ti-paint" style="font-size:10px" aria-hidden="true"></i> Brand &amp; Comms</span></label>
    <label class="support-check-label"><input type="checkbox" id="${pfx}-ggl" ${has('GGL')} /><span class="badge support-tag badge-ggl"><i class="ti ti-world" style="font-size:10px" aria-hidden="true"></i> GGL</span></label>
  </div>`;
};
const readSupportCheckboxes = (pfx) => {
  const support = [];
  if (document.getElementById(`${pfx}-brandcomms`)?.checked) support.push('BrandComms');
  if (document.getElementById(`${pfx}-ggl`)?.checked)        support.push('GGL');
  return support;
};
function fmtDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return null;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDateShort(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return null;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
function getMonthsFromActivity(a) {
  if (a.startDate && a.endDate) {
    const s = new Date(a.startDate + 'T00:00:00'), e = new Date(a.endDate + 'T00:00:00');
    return { sm: s.getMonth()+1, em: e.getMonth()+1 };
  }
  return { sm: a.startMonth ? parseInt(a.startMonth) : null, em: a.endMonth ? parseInt(a.endMonth) : null };
}
function fmtPeriod(month, week) {
  if (!month) return null;
  const m = MONTHS.find(x=>x.num===parseInt(month));
  if (!m) return null;
  return MONTHS_SHORT[m.num-1] + (week ? ` W${week}` : '');
}
function monthRangeBadge(a) {
  if (a.startDate || a.endDate) {
    const s = fmtDateShort(a.startDate), e = fmtDateShort(a.endDate);
    if (s && e) return `<span class="badge badge-q3">${s} – ${e}</span>`;
    if (s)      return `<span class="badge badge-q3">From ${s}</span>`;
    if (e)      return `<span class="badge badge-tbd">To ${e}</span>`;
  }
  const s = fmtPeriod(a.startMonth, a.startWeek);
  const e = fmtPeriod(a.endMonth,   a.endWeek);
  if (s && e) return `<span class="badge badge-q3">${s} – ${e}</span>`;
  if (s)      return `<span class="badge badge-q3">From ${s}</span>`;
  if (e)      return `<span class="badge badge-tbd">To ${e}</span>`;
  return `<span class="badge badge-tbd">No date set</span>`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerHTML = `<i class="ti ti-check"></i> ${msg}`;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2500);
}

function setTab(id) { state.editingActivity=null; state.editingSubTask=null; state.activeTab=id; render(); window.scrollTo({top:0,behavior:'smooth'}); }

function render() {
  renderNav();
  const main = document.getElementById('mainContent');
  if (state.activeTab==='overview') main.innerHTML = renderOverview();
  else if (state.activeTab==='gantt') main.innerHTML = renderGantt();
  else if (state.activeTab==='backlog') main.innerHTML = renderBacklog();
  else {
    const idx = PILLARS.findIndex(p=>p.id===state.activeTab);
    if (idx>=0) main.innerHTML = renderPillarPanel(PILLARS[idx], idx);
  }
}

function renderNav() {
  const topTabs = [
    {id:'overview', label:'Overview', icon:'ti-layout-dashboard'},
    {id:'backlog',  label:'Backlog',  icon:'ti-stack-2'},
    {id:'gantt',    label:'Timeline', icon:'ti-calendar-stats'}
  ];
  const pillarTabs = [
    ...PILLARS.map((p,i) => ({id:p.id, label:`T${i+1}`, title:p.label, color:p.color}))
  ];

  document.getElementById('topNav').innerHTML = topTabs.map(t => {
    const count = t.id==='backlog' ? state.backlog.length : t.id==='gantt' ? scheduledCount() : totalCount();
    return `<button class="top-nav-btn ${state.activeTab===t.id?'active':''}" onclick="setTab('${t.id}')">
      <i class="ti ${t.icon}" aria-hidden="true"></i>${t.label}${count>0?` <span class="tab-count">${count}</span>`:''}
    </button>`;
  }).join('<div class="top-nav-divider"></div>');

  document.getElementById('tabNav').innerHTML = pillarTabs.map(t => {
    const count = t.id==='gantt' ? scheduledCount() : pillarCount(t.id);
    const dot = t.color ? `<span style="width:8px;height:8px;border-radius:50%;background:${t.color};flex-shrink:0;display:inline-block"></span>` : `<i class="ti ${t.icon}" aria-hidden="true"></i>`;
    const hoverAttr = t.title ? `onmouseenter="showPillarTip(event,'${t.title.replace(/'/g,'\\\'')}')" onmouseleave="hidePillarTip()"` : '';
    return `<button class="tab-btn ${state.activeTab===t.id?'active':''}" onclick="setTab('${t.id}')" ${hoverAttr}>
      ${dot} ${t.label}${count>0?` <span class="tab-count">${count}</span>`:''}
    </button>`;
  }).join('');
}

/* ── OVERVIEW ── */
function renderOverview() {
  const maxCount = Math.max(...PILLARS.map(p=>pillarCount(p.id)), 1);

  const pillarCols = PILLARS.map((p, i) => {
    const count = pillarCount(p.id);
    const barW  = Math.round((count / maxCount) * 100);
    const sched = (state.activities[p.id]||[]).filter(a=>a.startMonth&&a.endMonth).length;
    const activities = state.activities[p.id] || [];
    const activityList = activities.length === 0
      ? `<div style="font-size:11px;color:var(--text-light);text-align:center;padding:6px 0;font-style:italic">No activities yet</div>`
      : `<div class="pillar-col-activities">
          ${activities.map(a =>
            `<div class="pillar-col-activity-item" style="border-left-color:${p.color}" onclick="event.stopPropagation();setTab('${p.id}')">${escHtml(a.name)}${(a.support&&a.support.length)?`<span style="margin-left:6px">${a.support.map(s=>s==='BrandComms'?`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#c2410c;margin-left:2px" title="Brand &amp; Comms"></span>`:s==='GGL'?`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#1e1e1e;margin-left:2px" title="GGL"></span>`:``).join('')}</span>`:''}</div>`
          ).join('')}
        </div>`;
    return `<div class="pillar-col" onclick="setTab('${p.id}')">
      <div class="pillar-col-header" style="background:${p.color}">
        <span class="pillar-col-num">Theme ${i+1}</span>
        <span class="pillar-col-name">${p.label}</span>
      </div>
      <div class="pillar-col-body">
        <div class="pillar-col-count">${count}</div>
        <div class="pillar-col-count-label">${count===1?'activity':'activities'}</div>
        <div class="pillar-col-mini-bar" style="width:100%"><div class="pillar-col-mini-fill" style="width:${barW}%;background:${p.color}"></div></div>
        ${activityList}
      </div>
    </div>`;
  }).join('');

  return `
    <div class="pillars-grid">${pillarCols}</div>
    <div class="overview-bars">
      <div class="perf-code-bar">
        <div class="overview-bar-title large">Derivco Performance Code</div>
        <div class="perf-code-pillars">
          <span class="perf-code-pillar"><span class="perf-code-pillar-num">P1</span>Commercial</span>
          <span class="perf-code-pillar"><span class="perf-code-pillar-num">P2</span>Operations</span>
          <span class="perf-code-pillar"><span class="perf-code-pillar-num">P3</span>Delivery</span>
          <span class="perf-code-pillar active"><span class="perf-code-pillar-num">P4</span><span class="perf-code-pill">People</span></span>
          <span class="perf-code-pillar"><span class="perf-code-pillar-num">P5</span>Innovation</span>
        </div>
      </div>
      <div class="overview-bar" style="background:#0D2147">
        <div class="overview-bar-title large">Foundation</div>
        <div class="overview-bar-items">
          <span class="overview-bar-item">Our Edge</span>
          <span class="overview-bar-item">Values</span>
          <span class="overview-bar-item">Principles</span>
        </div>
      </div>
    </div>
    `;
}

/* ── PILLAR PANEL ── */
function renderPillarPanel(p, idx) {
  const activities = state.activities[p.id] || [];
  const actContent = activities.length===0
    ? `<div class="activity-empty"><i class="ti ti-clipboard-list" aria-hidden="true"></i>No activities yet — add the first one below</div>`
    : `<div class="activities-head"><span>Activity</span><span>Owner</span><span>Period</span><span>Status</span><span>Move to</span></div>
       ${activities.map((a,i) => {
          const isEditing = state.editingActivity && state.editingActivity.pillarId===p.id && state.editingActivity.idx===i;
          if (isEditing) return renderEditRow(p, a, i);
          const key = a.id || `${p.id}-${i}`;
          const isExpanded = state.expandedActivities.has(key);
          const children = a.children || [];
          const childBadge = children.length > 0 ? `<span class="child-count-badge">${children.length} sub-task${children.length>1?'s':''}</span>` : '';
          const chevron = `<button class="expand-btn ${isExpanded?'open':''}" onclick="toggleExpand('${key}')" aria-label="${isExpanded?'Collapse':'Expand'} sub-tasks" title="Toggle sub-tasks"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>`;
          const childrenBlock = isExpanded ? renderChildRows(p, a, i, key, children) : '';
          return `<div class="activity-row">
            <span class="activity-name-cell"><div class="activity-name-wrap">${chevron}<div><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="background:${p.color};color:#fff;border-radius:20px;padding:3px 14px;font-size:13px;font-weight:600;white-space:nowrap;display:inline-block">${escHtml(a.name)}</span>${childBadge}</div>${supportTags(a.support)}</div></div></span>
            <span class="activity-owner-cell">${escHtml(a.owner||'—')}</span>
            <span>${monthRangeBadge(a)}</span>
            <span>${statusBadge(a.status)}</span>
            <div style="display:flex;align-items:center;gap:4px">
              <select class="move-activity-select" onchange="moveActivity('${p.id}',${i},this.value);this.value=''" aria-label="Move to theme">
                <option value="">Move…</option>
                ${PILLARS.filter(x=>x.id!==p.id).map((x,xi)=>`<option value="${x.id}">T${PILLARS.indexOf(x)+1} — ${x.label}</option>`).join('')}
                <option value="__backlog__">Backlog</option>
              </select>
              <button class="edit-btn" onclick="startEdit('${p.id}',${i})" aria-label="Edit activity"><i class="ti ti-pencil" aria-hidden="true"></i></button>
              <button class="del-btn" onclick="deleteActivity('${p.id}',${i})" aria-label="Remove activity"><i class="ti ti-x" aria-hidden="true"></i></button>
            </div>
          </div>${childrenBlock}`;}).join('')}`;

  const nextBtn = idx < PILLARS.length-1
    ? `<button class="btn-primary" onclick="setTab('${PILLARS[idx+1].id}')" style="font-size:13px;padding:8px 16px">Next: T${idx+2} <i class="ti ti-arrow-right"></i></button>`
    : `<button class="btn-primary" onclick="setTab('gantt')" style="font-size:13px;padding:8px 16px"><i class="ti ti-calendar-stats"></i> Build timeline</button>`;

  return `
    <div class="pillar-panel-header" style="background:${p.color}">
      <div class="pillar-panel-eyebrow">Theme ${idx+1} of 6</div>
      <div class="pillar-panel-title">${p.label}</div>
      <div class="pillar-panel-positioning">${p.positioning}</div>
    </div>
    <div class="section-header"><div class="section-title">Activities (${activities.length})</div></div>
    <div class="activities-table">${actContent}</div>
    <div class="add-form">
      <div class="add-form-title"><i class="ti ti-plus-circle" aria-hidden="true" style="color:${p.color}"></i> Add an activity</div>
      <div class="form-grid">
        <div class="form-group"><label>Activity / initiative</label><input type="text" id="inp-name-${p.id}" placeholder="Describe the activity..." onkeydown="if(event.key==='Enter')addActivity('${p.id}')" /></div>
        <div class="form-group"><label>Owner</label><input type="text" id="inp-owner-${p.id}" placeholder="Person or team" /></div>
        <div class="form-group"><label>Priority</label><select id="inp-priority-${p.id}"><option value="High">High</option><option value="Medium" selected>Medium</option><option value="Low">Low</option></select></div>
        <div class="form-group"><label>Status</label><select id="inp-status-${p.id}"><option value="Planned" selected>Planned</option><option value="In Progress">In Progress</option><option value="Done">Done</option></select></div>
      </div>
      <div class="form-grid-dates">
        <div class="form-group"><label>Start date</label><input type="date" id="inp-startdate-${p.id}" /></div>
        <div class="range-arrow">→</div>
        <div class="form-group"><label>End date</label><input type="date" id="inp-enddate-${p.id}" /></div>
      </div>
      <div class="form-group" style="margin-bottom:10px">
        <label>Support needed</label>
        ${supportCheckboxes(`inp-support-${p.id}`, [])}
      </div>
      <div class="form-actions">
        <div class="form-hint"><i class="ti ti-device-floppy" aria-hidden="true"></i> Saved automatically · Press Enter to add quickly</div>
        <button class="btn-primary" onclick="addActivity('${p.id}')" style="background:${p.color}"><i class="ti ti-plus"></i> Add activity</button>
      </div>
    </div>
    <div class="nav-footer">
      <button class="btn-primary" onclick="setTab('overview')" style="background:#475569;font-size:13px;padding:8px 16px"><i class="ti ti-arrow-left"></i> Overview</button>
      ${nextBtn}
    </div>`;
}

/* ── GANTT ── */
function renderGantt() {
  const allActs = [];
  PILLARS.forEach(p => {
    (state.activities[p.id]||[]).forEach((a,i) => allActs.push({...a, pillarId:p.id, pillarLabel:p.label, pillarColor:p.color, idx:i}));
  });

  if (allActs.length === 0) {
    return `<div class="gantt-hint"><i class="ti ti-info-circle" aria-hidden="true"></i> Add activities to your themes first, then come back here to schedule them on the timeline.</div>
      <div class="gantt-wrap"><div class="gantt-empty"><i class="ti ti-calendar-off" aria-hidden="true"></i><strong>No activities to schedule yet</strong>Start by adding activities in the pillar tabs, then set their months here.</div></div>`;
  }

  const scheduled = allActs.filter(a => a.startMonth && a.endMonth).length;
  const hintText = scheduled === 0
    ? 'Set a start and end month for each activity using the dropdowns — the bar chart updates instantly.'
    : `${scheduled} of ${allActs.length} activities scheduled. Set remaining months to complete your timeline.`;

  const dateInput = (id, val, onChange) => `<input type="date" class="gantt-date-input" id="${id}" value="${val||''}" onchange="${onChange}" />`;

  let tableRows = '';
  let currentPillar = null;

  const YEAR_START = new Date('2026-04-01T00:00:00');
  const YEAR_END   = new Date('2026-12-31T00:00:00');
  const YEAR_DAYS  = (YEAR_END - YEAR_START) / 86400000 + 1;
  const TODAY = new Date(); TODAY.setHours(0,0,0,0);
  const todayPct = Math.max(0, Math.min(100, ((TODAY - YEAR_START) / 86400000) / YEAR_DAYS * 100));
  const todayLine = (todayPct > 0 && todayPct < 100)
    ? `<div style="position:absolute;top:0;bottom:0;left:${todayPct.toFixed(2)}%;width:0;border-left:2px dotted #ef4444;opacity:0.6;pointer-events:none;z-index:4"></div>`
    : '';
  const getEndDt = (item) => {
    if (item.endDate) return new Date(item.endDate+'T00:00:00');
    if (item.endMonth) { const m=parseInt(item.endMonth); return new Date(2026, m, 0); }
    return null;
  };
  const rowStatusChip = (item) => {
    if (item.status==='Done') return `<span style="display:inline-flex;align-items:center;gap:2px;background:#d1fae5;color:#065f46;border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;white-space:nowrap;margin-left:5px"><i class="ti ti-check" style="font-size:9px"></i>Done</span>`;
    const endDt = getEndDt(item);
    if (endDt && endDt < TODAY) return `<span style="display:inline-flex;align-items:center;gap:2px;background:#fef3c7;color:#854d0e;border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;white-space:nowrap;margin-left:5px"><i class="ti ti-alert-triangle" style="font-size:9px"></i>Overdue</span>`;
    return '';
  };
  const VISIBLE_MONTHS = MONTHS_SHORT.slice(3); // Apr–Dec
  const monthTicks = VISIBLE_MONTHS.map(m => `<div class="gantt-month-tick">${m}</div>`).join('');
  const trackSegs  = VISIBLE_MONTHS.map(() => `<div class="gantt-track-seg"></div>`).join('');

  // Week divider lines — 3 equally-spaced lines per month (4 visual quarters each)
  const _monthStarts = [4,5,6,7,8,9,10,11,12].map(m => new Date(`2026-${String(m).padStart(2,'0')}-01T00:00:00`));
  _monthStarts.push(new Date('2027-01-01T00:00:00')); // sentinel
  const _weekPcts = [];
  for (let i = 0; i < _monthStarts.length - 1; i++) {
    const mStart = (_monthStarts[i]   - YEAR_START) / 86400000;
    const mLen   = (_monthStarts[i+1] - _monthStarts[i]) / 86400000;
    for (let q = 1; q <= 3; q++) {
      _weekPcts.push(((mStart + mLen * q / 4) / YEAR_DAYS * 100).toFixed(2));
    }
  }
  const weekLines = _weekPcts.map(p =>
    `<div style="position:absolute;top:0;bottom:0;left:${p}%;width:1px;background:rgba(0,0,0,0.045);pointer-events:none"></div>`
  ).join('');

  const buildBar = (a, color, isSubTask, deleteHtml = '') => {
    const delOverlay = deleteHtml ? `<div style="position:absolute;right:4px;top:50%;transform:translateY(-50%);z-index:3">${deleteHtml}</div>` : '';
    if (!a.startDate && !a.endDate && !a.startMonth) return `<td class="gantt-bar-cell"><div class="gantt-bar-track">${trackSegs}</div>${weekLines}${todayLine}${delOverlay}</td>`;
    let leftPct = 0, widthPct = 100;
    if (a.startDate || a.endDate) {
      const s = a.startDate ? new Date(a.startDate+'T00:00:00') : YEAR_START;
      const e = a.endDate   ? new Date(a.endDate+'T00:00:00')   : YEAR_END;
      leftPct  = Math.max(0, Math.min(100, ((s - YEAR_START) / 86400000) / YEAR_DAYS * 100));
      widthPct = Math.max(0.5, Math.min(100 - leftPct, ((e - s) / 86400000 + 1) / YEAR_DAYS * 100));
    } else if (a.startMonth && a.endMonth) {
      leftPct  = Math.max(0, (parseInt(a.startMonth) - 4) / 9 * 100);
      widthPct = Math.max(0.5, (parseInt(a.endMonth) - parseInt(a.startMonth) + 1) / 9 * 100);
    }
    const isDone = a.status === 'Done';
    const endDt  = getEndDt(a);
    const isPast = endDt && endDt < TODAY && !isDone;
    const barColor   = isDone ? '#22c55e' : isPast ? '#ef4444' : color;
    const barOpacity = isDone ? '0.85'    : isPast ? '0.85'   : '1';
    const doneOverlay = isDone ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;border-radius:inherit;pointer-events:none"><i class="ti ti-check" style="color:rgba(255,255,255,0.95);font-size:12px;font-weight:900"></i></div>` : '';
    const barClass = isSubTask ? 'gantt-bar-subtask' : 'gantt-bar-parent';
    return `<td class="gantt-bar-cell">
      <div class="gantt-bar-track">${trackSegs}</div>
      ${weekLines}
      ${todayLine}
      <div class="gantt-bar-abs ${barClass}" style="left:${leftPct.toFixed(1)}%;width:${widthPct.toFixed(1)}%;background:${barColor};opacity:${barOpacity}">${doneOverlay}</div>
      ${delOverlay}
    </td>`;
  };

  allActs.forEach(a => {
    if (a.pillarId !== currentPillar) {
      currentPillar = a.pillarId;
      const pCount = (state.activities[a.pillarId]||[]).length;
      tableRows += `<tr class="gantt-pillar-row" style="background:${a.pillarColor}15">
        <td colspan="5" style="background:${a.pillarColor}">${a.pillarLabel} <span style="font-weight:400;opacity:0.75;font-size:11px;margin-left:6px">${pCount} activit${pCount===1?'y':'ies'}</span></td>
      </tr>`;
    }

    const sm = a.startMonth ? parseInt(a.startMonth) : null;
    const em = a.endMonth   ? parseInt(a.endMonth)   : null;

    const ganttKey = a.id || `${a.pillarId}-${a.idx}`;
    const children = a.children || [];
    const hasChildren = children.length > 0;
    const isCollapsed = !state.ganttExpandedParents.has(ganttKey);
    const chevron = hasChildren
      ? `<button onclick="toggleGanttParent('${ganttKey}')" style="background:none;border:none;cursor:pointer;color:var(--text-light);padding:0 4px 0 0;font-size:12px;display:inline-flex;align-items:center;flex-shrink:0;transition:transform 0.15s;transform:rotate(${isCollapsed?'0deg':'90deg'})"><i class="ti ti-chevron-right"></i></button>`
      : `<span style="display:inline-block;width:16px;flex-shrink:0"></span>`;
    const subBadge = hasChildren ? `<span style="font-size:10px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:1px 6px;color:var(--text-light);margin-left:4px">${children.length}</span>` : '';

    const isActive = state.ganttActiveRow === ganttKey;
    const activeStyle = isActive ? `background:${a.pillarColor}22;border-left:3px solid ${a.pillarColor};` : '';
    tableRows += `<tr class="gantt-row-parent" onclick="setGanttActiveRow('${ganttKey}')" style="${activeStyle}cursor:pointer">
      <td class="td-name" style="padding-left:${isActive?'21':'24'}px">
        <div style="display:flex;align-items:center">${chevron}<div><div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">${escHtml(a.name)}${subBadge}</div><div style="margin-top:4px"><select onchange="updateGanttStatus('${a.pillarId}',${a.idx},this.value);setGanttActiveRow('${ganttKey}')" style="font-size:11px;padding:2px 6px;border-radius:20px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;appearance:none;-webkit-appearance:none;padding-right:18px;background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%228%22 height=%228%22 viewBox=%220 0 8 8%22><path fill=%22%23666%22 d=%22M0 2l4 4 4-4z%22/></svg>');background-repeat:no-repeat;background-position:right 5px center;background-size:8px"><option value="Planned" ${a.status==='Planned'?'selected':''}>Planned</option><option value="In Progress" ${a.status==='In Progress'?'selected':''}>In Progress</option><option value="Done" ${a.status==='Done'?'selected':''}>Done</option></select></div></div></div>
      </td>
      <td class="td-owner">${escHtml(a.owner||'—')}</td>
      <td class="td-sel">${dateInput(`gsd-${a.pillarId}-${a.idx}`, a.startDate, `updateGanttDate('${a.pillarId}',${a.idx},'startDate',this.value)`)}</td>
      <td class="td-sel">${dateInput(`ged-${a.pillarId}-${a.idx}`, a.endDate,   `updateGanttDate('${a.pillarId}',${a.idx},'endDate',this.value)`)}</td>
      ${buildBar(a, a.pillarColor, false, `<button class="del-btn" onclick="deleteActivity('${a.pillarId}',${a.idx})" aria-label="Delete activity"><i class="ti ti-x" aria-hidden="true"></i></button>`)}
    </tr>`;

    if (hasChildren && !isCollapsed) {
      children.forEach((c, ci) => {
        const csm = c.startMonth ? parseInt(c.startMonth) : null;
        const cem = c.endMonth   ? parseInt(c.endMonth)   : null;
        tableRows += `<tr class="gantt-row-sub">
          <td class="td-name" style="padding-left:28px">
            <div style="display:flex;align-items:center;gap:6px">
              ${children.length > 1 ? `<div style="display:flex;flex-direction:column;gap:1px;flex-shrink:0">
                <button onclick="event.stopPropagation();moveSubTask('${a.pillarId}',${a.idx},${ci},-1)" ${ci===0?'disabled':''} style="background:none;border:none;border-radius:3px;padding:1px 3px;cursor:${ci===0?'default':'pointer'};color:${ci===0?'#ddd':'#b0b8cc'};font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center" onmouseover="if(!this.disabled)this.style.color='var(--navy)'" onmouseout="this.style.color='${ci===0?'#ddd':'#b0b8cc'}'" title="Move up"><i class="ti ti-chevron-up"></i></button>
                <button onclick="event.stopPropagation();moveSubTask('${a.pillarId}',${a.idx},${ci},1)" ${ci===children.length-1?'disabled':''} style="background:none;border:none;border-radius:3px;padding:1px 3px;cursor:${ci===children.length-1?'default':'pointer'};color:${ci===children.length-1?'#ddd':'#b0b8cc'};font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center" onmouseover="if(!this.disabled)this.style.color='var(--navy)'" onmouseout="this.style.color='${ci===children.length-1?'#ddd':'#b0b8cc'}'" title="Move down"><i class="ti ti-chevron-down"></i></button>
              </div>` : `<div style="width:18px;flex-shrink:0"></div>`}
              <span style="color:#bcc4d8;font-size:13px;flex-shrink:0"><i class="ti ti-corner-down-right"></i></span>
              <div>
                <div style="font-size:12px;font-weight:400;color:var(--text-muted);font-style:italic">${escHtml(c.name)}</div>
                <div style="margin-top:3px"><select onchange="updateSubGanttStatus('${a.pillarId}',${a.idx},${ci},this.value)" style="font-size:11px;padding:2px 6px;border-radius:20px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;appearance:none;-webkit-appearance:none;padding-right:18px;background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%228%22 height=%228%22 viewBox=%220 0 8 8%22><path fill=%22%23666%22 d=%22M0 2l4 4 4-4z%22/></svg>');background-repeat:no-repeat;background-position:right 5px center;background-size:8px"><option value="Planned" ${c.status==='Planned'?'selected':''}>Planned</option><option value="In Progress" ${c.status==='In Progress'?'selected':''}>In Progress</option><option value="Done" ${c.status==='Done'?'selected':''}>Done</option></select></div>
              </div>
            </div>
          </td>
          <td class="td-owner" style="font-size:12px">${escHtml(c.owner||'—')}</td>
          <td class="td-sel">${dateInput(`gsds-${a.pillarId}-${a.idx}-${ci}`, c.startDate, `updateSubGanttDate('${a.pillarId}',${a.idx},${ci},'startDate',this.value)`)}</td>
          <td class="td-sel">${dateInput(`geds-${a.pillarId}-${a.idx}-${ci}`, c.endDate,   `updateSubGanttDate('${a.pillarId}',${a.idx},${ci},'endDate',this.value)`)}</td>
          ${buildBar(c, a.pillarColor, true, `<button class="del-btn" onclick="deleteSubTask('${a.pillarId}',${a.idx},${ci})" aria-label="Delete sub-task"><i class="ti ti-x" aria-hidden="true"></i></button>`)}
        </tr>`;
      });
    }
  });

  const legend = PILLARS.filter(p => pillarCount(p.id) > 0).map(p =>
    `<div class="gantt-legend-item"><div class="gantt-legend-dot" style="background:${p.color}"></div>${p.label}</div>`
  ).join('');

  return `
    <div class="gantt-hint"><i class="ti ti-info-circle" aria-hidden="true"></i>${hintText}</div>
    <div style="display:flex;align-items:center;gap:18px;padding:0 0 12px 0;flex-wrap:wrap">
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)"><span style="display:inline-block;width:28px;height:10px;border-radius:5px;background:var(--navy);opacity:0.5"></span>Scheduled</span>
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)"><span style="display:inline-block;width:28px;height:10px;border-radius:5px;background:#22c55e;opacity:0.85"></span>Done</span>
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)"><span style="display:inline-block;width:28px;height:10px;border-radius:5px;background:#ef4444;opacity:0.85"></span>Overdue</span>
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)"><span style="display:inline-block;width:0;height:14px;border-left:2px dotted #ef4444;opacity:0.6"></span>Today</span>
    </div>
    <div class="gantt-wrap">
      <table class="gantt-table" aria-label="H2 2026 activity timeline">
          <thead>
            <tr>
              <th class="col-name">Activity</th>
              <th class="col-owner">Owner</th>
              <th class="col-month-sel">Start date</th>
              <th class="col-month-sel">End date</th>
              <th class="col-timeline"><div class="gantt-month-ticks">${monthTicks}</div>${weekLines}</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      <div class="gantt-legend">${legend}</div>
    </div>`;
}

function updateGanttDate(pillarId, idx, field, value) {
  const a = state.activities[pillarId] && state.activities[pillarId][idx];
  if (!a) return;
  a[field] = value || null;
  saveState(); render();
}
function updateSubGanttDate(pillarId, parentIdx, ci, field, value) {
  const a = state.activities[pillarId] && state.activities[pillarId][parentIdx];
  if (!a || !a.children || !a.children[ci]) return;
  a.children[ci][field] = value || null;
  saveState(); render();
}
function moveSubTask(pillarId, parentIdx, ci, dir) {
  const a = state.activities[pillarId] && state.activities[pillarId][parentIdx];
  if (!a || !a.children) return;
  const newIdx = ci + dir;
  if (newIdx < 0 || newIdx >= a.children.length) return;
  const tmp = a.children[ci];
  a.children[ci] = a.children[newIdx];
  a.children[newIdx] = tmp;
  saveState(); render();
}

function updateGanttStatus(pillarId, idx, value) {
  const a = state.activities[pillarId] && state.activities[pillarId][idx];
  if (!a) return;
  a.status = value;
  saveState(); render();
}
function updateSubGanttStatus(pillarId, parentIdx, ci, value) {
  const a = state.activities[pillarId] && state.activities[pillarId][parentIdx];
  if (!a || !a.children || !a.children[ci]) return;
  a.children[ci].status = value;
  saveState(); render();
}

function setGanttActiveRow(key) {
  state.ganttActiveRow = state.ganttActiveRow === key ? null : key;
  render();
}

function toggleGanttParent(key) {
  if (state.ganttExpandedParents.has(key)) state.ganttExpandedParents.delete(key);
  else state.ganttExpandedParents.add(key);
  render();
}

function updateSubGanttMonth(pillarId, parentIdx, ci, field, value) {
  const a = state.activities[pillarId] && state.activities[pillarId][parentIdx];
  if (!a || !a.children || !a.children[ci]) return;
  a.children[ci][field] = value ? parseInt(value) : null;
  saveState(); render();
}

function updateGanttMonth(pillarId, idx, field, value) {
  const a = state.activities[pillarId] && state.activities[pillarId][idx];
  if (!a) return;
  a[field] = value ? parseInt(value) : null;
  if (a.startMonth && a.endMonth && a.endMonth < a.startMonth) {
    if (field === 'startMonth') a.endMonth = a.startMonth;
    else a.startMonth = a.endMonth;
  }
  saveState();
  render();
}

/* ── PARENT / CHILD ── */
function renderChildRows(p, a, parentIdx, key, children) {
  const subRows = children.map((c, ci) => {
    const isEditingSub = state.editingSubTask && state.editingSubTask.key===key && state.editingSubTask.ci===ci;
    const subMO = (cur) => `<option value="">Not set</option>` + MONTHS.map(m=>`<option value="${m.num}" ${parseInt(cur)===m.num?'selected':''}>${m.label}</option>`).join('');
    const subWO = (cur) => `<option value="">—</option>` + [1,2,3,4].map(w=>`<option value="${w}" ${parseInt(cur)===w?'selected':''}>W${w}</option>`).join('');
    if (isEditingSub) {
      return `<div class="child-row-edit">
        <div class="edit-inner" style="grid-template-columns:1fr 120px 95px auto;margin-bottom:8px">
          <div><div class="edit-label">Sub-task</div><input id="esub-name-${key}-${ci}" value="${escAttr(c.name)}" onkeydown="if(event.key==='Enter')saveSubEdit('${p.id}',${parentIdx},${ci});if(event.key==='Escape')cancelSubEdit();" /></div>
          <div><div class="edit-label">Owner</div><input id="esub-owner-${key}-${ci}" value="${escAttr(c.owner||'')}" onkeydown="if(event.key==='Escape')cancelSubEdit();" /></div>
          <div><div class="edit-label">Status</div><select id="esub-status-${key}-${ci}"><option value="Planned" ${c.status==='Planned'?'selected':''}>Planned</option><option value="In Progress" ${c.status==='In Progress'?'selected':''}>In Progress</option><option value="Done" ${c.status==='Done'?'selected':''}>Done</option></select></div>
          <div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 16px 1fr auto;gap:8px;align-items:end">
          <div><div class="edit-label">Start date</div><input type="date" id="esub-startdate-${key}-${ci}" value="${c.startDate||''}" /></div>
          <div style="display:flex;align-items:center;justify-content:center;padding-bottom:2px;color:var(--text-light)">→</div>
          <div><div class="edit-label">End date</div><input type="date" id="esub-enddate-${key}-${ci}" value="${c.endDate||''}" /></div>
          <div class="edit-btns" style="padding-bottom:1px"><button class="btn-save" onclick="saveSubEdit('${p.id}',${parentIdx},${ci})"><i class="ti ti-check" aria-hidden="true"></i> Save</button><button class="btn-cancel" onclick="cancelSubEdit()">Cancel</button></div>
        </div>
      </div>`;
    }
    return `<div class="child-row">
      <span class="child-indicator">${children.length > 1 ? `<div style="display:flex;flex-direction:column;gap:1px">
        <button onclick="moveSubTask('${p.id}',${parentIdx},${ci},-1)" ${ci===0?'disabled':''} style="background:none;border:none;border-radius:3px;padding:1px 3px;cursor:${ci===0?'default':'pointer'};color:${ci===0?'#ddd':'#b0b8cc'};font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center;transition:color 0.15s" onmouseover="if(!this.disabled)this.style.color='var(--navy)'" onmouseout="this.style.color='${ci===0?'#ddd':'#b0b8cc'}'" title="Move up"><i class="ti ti-chevron-up"></i></button>
        <button onclick="moveSubTask('${p.id}',${parentIdx},${ci},1)" ${ci===children.length-1?'disabled':''} style="background:none;border:none;border-radius:3px;padding:1px 3px;cursor:${ci===children.length-1?'default':'pointer'};color:${ci===children.length-1?'#ddd':'#b0b8cc'};font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center;transition:color 0.15s" onmouseover="if(!this.disabled)this.style.color='var(--navy)'" onmouseout="this.style.color='${ci===children.length-1?'#ddd':'#b0b8cc'}'" title="Move down"><i class="ti ti-chevron-down"></i></button>
      </div>` : `<i class="ti ti-corner-down-right" aria-hidden="true"></i>`}</span>
      <span class="child-name-cell">${escHtml(c.name)}</span>
      <span class="child-owner-cell">${escHtml(c.owner||'—')}</span>
      <span>${statusBadge(c.status)}</span>
      <span>${monthRangeBadge(c)}</span>
      <div class="act-actions">
        <button class="edit-btn" onclick="startSubEdit('${key}','${p.id}',${parentIdx},${ci})" aria-label="Edit sub-task"><i class="ti ti-pencil" aria-hidden="true"></i></button>
        <button class="del-btn" onclick="deleteSubTask('${p.id}',${parentIdx},${ci})" aria-label="Remove sub-task"><i class="ti ti-x" aria-hidden="true"></i></button>
      </div>
    </div>`;
  }).join('');

  return `<div class="children-wrap">
    ${subRows}
    <div class="add-subtask-row">
      <input class="inp-name" type="text" id="sub-name-${key}" placeholder="New sub-task..." onkeydown="if(event.key==='Enter')addSubTask('${p.id}',${parentIdx},'${key}')" />
      <input class="inp-owner" type="text" id="sub-owner-${key}" placeholder="Owner" onkeydown="if(event.key==='Enter')addSubTask('${p.id}',${parentIdx},'${key}')" />
      <select id="sub-status-${key}"><option value="Planned">Planned</option><option value="In Progress">In Progress</option><option value="Done">Done</option></select>
      <input type="date" id="sub-startdate-${key}" class="gantt-date-input" style="width:140px" />
      <input type="date" id="sub-enddate-${key}"   class="gantt-date-input" style="width:140px" />
      <button class="btn-add-sub" onclick="addSubTask('${p.id}',${parentIdx},'${key}')"><i class="ti ti-plus" aria-hidden="true"></i> Add</button>
    </div>
  </div>`;
}

function toggleExpand(key) {
  if (state.expandedActivities.has(key)) state.expandedActivities.delete(key);
  else state.expandedActivities.add(key);
  render();
}

function addSubTask(pillarId, parentIdx, key) {
  const nameEl = document.getElementById(`sub-name-${key}`);
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { if(nameEl){ nameEl.focus(); nameEl.style.borderColor='#ef4444'; setTimeout(()=>nameEl.style.borderColor='',1500); } return; }
  const owner  = (document.getElementById(`sub-owner-${key}`)  || {}).value || '';
  const status = (document.getElementById(`sub-status-${key}`) || {}).value || 'Planned';
  const a = state.activities[pillarId][parentIdx];
  if (!a) return;
  if (!a.children) a.children = [];
  a.children.push({
    name, owner: owner.trim(), status,
    startDate: (document.getElementById(`sub-startdate-${key}`) || {}).value || null,
    endDate:   (document.getElementById(`sub-enddate-${key}`)   || {}).value || null
  });
  state.expandedActivities.add(key);
  saveState(); render(); showToast('Sub-task added');
}

function deleteSubTask(pillarId, parentIdx, subIdx) {
  if (!confirm('Remove this sub-task?')) return;
  const a = state.activities[pillarId][parentIdx];
  if (a && a.children) { a.children.splice(subIdx, 1); saveState(); render(); showToast('Sub-task removed'); }
}

function startSubEdit(key, pillarId, parentIdx, ci) {
  state.editingSubTask = { key, pillarId, parentIdx, ci };
  state.expandedActivities.add(key);
  render();
  const el = document.getElementById(`esub-name-${key}-${ci}`);
  if (el) { el.focus(); el.select(); }
}

function saveSubEdit(pillarId, parentIdx, ci) {
  const est = state.editingSubTask;
  if (!est) return;
  const nameEl = document.getElementById(`esub-name-${est.key}-${ci}`);
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { if(nameEl){ nameEl.focus(); nameEl.style.borderColor='#ef4444'; setTimeout(()=>nameEl.style.borderColor='',1500); } return; }
  const a = state.activities[pillarId][parentIdx];
  if (a && a.children && a.children[ci]) {
    a.children[ci].name      = name;
    a.children[ci].owner     = (document.getElementById(`esub-owner-${est.key}-${ci}`)     || {}).value?.trim() || '';
    a.children[ci].status    = (document.getElementById(`esub-status-${est.key}-${ci}`)    || {}).value || 'Planned';
    a.children[ci].startDate = (document.getElementById(`esub-startdate-${est.key}-${ci}`) || {}).value || null;
    a.children[ci].endDate   = (document.getElementById(`esub-enddate-${est.key}-${ci}`)   || {}).value || null;
  }
  state.editingSubTask = null;
  saveState(); render(); showToast('Sub-task updated');
}

function cancelSubEdit() { state.editingSubTask = null; render(); }

/* ── INLINE EDIT ── */
function renderEditRow(p, a, idx) {
  const sel = (id, val, opts) => `<select id="${id}">${opts.map(o=>`<option value="${o.v}" ${a[val]===o.v?'selected':''}>${o.l}</option>`).join('')}</select>`;
  const monthOpts = (cur) => `<option value="">Not set</option>` + MONTHS.map(m=>`<option value="${m.num}" ${parseInt(cur)===m.num?'selected':''}>${m.label}</option>`).join('');
  const weekOpts  = (cur) => `<option value="">—</option>` + [1,2,3,4].map(w=>`<option value="${w}" ${parseInt(cur)===w?'selected':''}>W${w}</option>`).join('');
  return `<div class="activity-row-edit">
    <div class="edit-inner" style="grid-template-columns: 1fr 120px 95px auto">
      <div>
        <div class="edit-label">Activity</div>
        <input id="edit-name-${p.id}-${idx}" value="${escAttr(a.name)}" placeholder="Activity name..." onkeydown="if(event.key==='Enter')saveEdit('${p.id}',${idx});if(event.key==='Escape')cancelEdit();" />
      </div>
      <div>
        <div class="edit-label">Owner</div>
        <input id="edit-owner-${p.id}-${idx}" value="${escAttr(a.owner||'')}" placeholder="Owner" onkeydown="if(event.key==='Escape')cancelEdit();" />
      </div>
      <div>
        <div class="edit-label">Priority</div>
        ${sel(`edit-priority-${p.id}-${idx}`,'priority',[{v:'High',l:'High'},{v:'Medium',l:'Medium'},{v:'Low',l:'Low'}])}
      </div>
      <div class="edit-btns" style="align-items:flex-end">
        <div>
          <div class="edit-label">Status</div>
          ${sel(`edit-status-${p.id}-${idx}`,'status',[{v:'Planned',l:'Planned'},{v:'In Progress',l:'In Progress'},{v:'Done',l:'Done'}])}
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 16px 1fr auto;gap:8px;align-items:end;margin-top:8px">
      <div><div class="edit-label">Start date</div><input type="date" id="edit-startdate-${p.id}-${idx}" value="${a.startDate||''}" /></div>
      <div style="display:flex;align-items:center;justify-content:center;padding-bottom:2px;color:var(--text-light)">→</div>
      <div><div class="edit-label">End date</div><input type="date" id="edit-enddate-${p.id}-${idx}" value="${a.endDate||''}" /></div>
      <div class="edit-btns" style="padding-bottom:1px">
        <button class="btn-save" onclick="saveEdit('${p.id}',${idx})"><i class="ti ti-check" aria-hidden="true"></i> Save</button>
        <button class="btn-cancel" onclick="cancelEdit()">Cancel</button>
      </div>
    </div>
    <div style="margin-top:8px">
      <div class="edit-label">Support needed</div>
      ${supportCheckboxes(`edit-support-${p.id}-${idx}`, a.support)}
    </div>
  </div>`;
}

function startEdit(pillarId, idx) {
  state.editingActivity = { pillarId, idx };
  render();
  const el = document.getElementById(`edit-name-${pillarId}-${idx}`);
  if (el) { el.focus(); el.select(); }
}

function saveEdit(pillarId, idx) {
  const a = state.activities[pillarId] && state.activities[pillarId][idx];
  if (!a) return;
  const nameEl = document.getElementById(`edit-name-${pillarId}-${idx}`);
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { if(nameEl){ nameEl.focus(); nameEl.style.borderColor='#ef4444'; setTimeout(()=>nameEl.style.borderColor='',1500); } return; }
  a.name      = name;
  a.owner     = document.getElementById(`edit-owner-${pillarId}-${idx}`).value.trim();
  a.priority  = document.getElementById(`edit-priority-${pillarId}-${idx}`).value;
  a.status    = document.getElementById(`edit-status-${pillarId}-${idx}`).value;
  a.startDate = document.getElementById(`edit-startdate-${pillarId}-${idx}`)?.value || null;
  a.endDate   = document.getElementById(`edit-enddate-${pillarId}-${idx}`)?.value   || null;
  a.support   = readSupportCheckboxes(`edit-support-${pillarId}-${idx}`);
  state.editingActivity = null;
  saveState(); render(); showToast('Activity updated');
}

function cancelEdit() { state.editingActivity = null; render(); }

/* ── ACTIVITY CRUD ── */
function addActivity(pillarId) {
  const nameEl = document.getElementById('inp-name-'+pillarId);
  const name = nameEl.value.trim();
  if (!name) { nameEl.focus(); nameEl.style.borderColor='#ef4444'; setTimeout(()=>nameEl.style.borderColor='',1500); return; }
  state.activities[pillarId].push({
    id:        generateId(),
    name,
    owner:     document.getElementById('inp-owner-'+pillarId).value.trim(),
    priority:  document.getElementById('inp-priority-'+pillarId).value,
    status:    document.getElementById('inp-status-'+pillarId).value,
    startDate: document.getElementById('inp-startdate-'+pillarId).value || null,
    endDate:   document.getElementById('inp-enddate-'+pillarId).value   || null,
    support:   readSupportCheckboxes(`inp-support-${pillarId}`),
    children:  []
  });
  saveState(); render(); showToast('Activity added');
}

function moveActivity(fromPillarId, idx, toPillarId) {
  if (!toPillarId) return;
  const a = state.activities[fromPillarId] && state.activities[fromPillarId][idx];
  if (!a) return;
  if (toPillarId === '__backlog__') {
    if (!confirm(`Move "${a.name}" to Backlog?`)) return;
    if (!state.backlog) state.backlog = [];
    state.backlog.push({ id: generateId(), name: a.name, owner: a.owner||'', priority: a.priority||'Medium', notes: '' });
    state.activities[fromPillarId].splice(idx, 1);
    saveState(); render(); showToast('Moved to Backlog');
    return;
  }
  const dest = PILLARS.find(p => p.id === toPillarId);
  if (!confirm(`Move "${a.name}" to ${dest ? dest.label : toPillarId}?`)) return;
  state.activities[toPillarId].push({...a, id: a.id || generateId()});
  state.activities[fromPillarId].splice(idx, 1);
  saveState(); render();
  showToast(`Moved to ${dest ? dest.label : toPillarId}`);
}

function deleteActivity(pillarId, idx) {
  if (!confirm('Remove this activity?')) return;
  state.activities[pillarId].splice(idx,1);
  saveState(); render(); showToast('Activity removed');
}

function confirmClear() {
  if (!confirm('Clear ALL activities and timeline data? This cannot be undone.')) return;
  PILLARS.forEach(p=>state.activities[p.id]=[]);
  saveState(); render(); showToast('All data cleared');
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escAttr(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

/* ── BACKLOG ── */
function renderBacklog() {
  const items = state.backlog;
  const pillarOpts = `<option value="">Move to theme...</option>` + PILLARS.map((p,i)=>`<option value="${p.id}">P${i+1} — ${p.label}</option>`).join('');

  const rows = items.length === 0
    ? `<div class="backlog-empty"><i class="ti ti-inbox" aria-hidden="true"></i><strong>Backlog is empty</strong>Capture ideas here before assigning them to a pillar.</div>`
    : `<div class="backlog-head"><span>Idea / Activity</span><span>Owner</span><span>Priority</span><span>Move to pillar</span><span></span></div>
       ${items.map((item, i) => {
          if (state.editingBacklog === i) {
            return `<div class="backlog-row-edit">
              <div class="backlog-edit-inner">
                <div><div class="edit-label">Idea / Activity</div><input id="bl-edit-name-${i}" value="${escAttr(item.name)}" onkeydown="if(event.key==='Enter')saveBacklogEdit(${i});if(event.key==='Escape')cancelBacklogEdit();" /></div>
                <div><div class="edit-label">Owner</div><input id="bl-edit-owner-${i}" value="${escAttr(item.owner||'')}" onkeydown="if(event.key==='Escape')cancelBacklogEdit();" /></div>
                <div><div class="edit-label">Priority</div><select id="bl-edit-priority-${i}"><option value="High" ${item.priority==='High'?'selected':''}>High</option><option value="Medium" ${item.priority==='Medium'?'selected':''}>Medium</option><option value="Low" ${item.priority==='Low'?'selected':''}>Low</option></select></div>
                <div class="edit-btns"><button class="btn-save" onclick="saveBacklogEdit(${i})"><i class="ti ti-check" aria-hidden="true"></i> Save</button><button class="btn-cancel" onclick="cancelBacklogEdit()">Cancel</button></div>
              </div>
              <div class="backlog-edit-notes"><div class="edit-label" style="margin-bottom:4px">Notes</div><input id="bl-edit-notes-${i}" value="${escAttr(item.notes||'')}" placeholder="Any extra context..." /></div>
            </div>`;
          }
          return `<div class="backlog-row">
            <div>
              <div class="backlog-name-cell">${escHtml(item.name)}</div>
              ${item.notes ? `<div class="backlog-notes">${escHtml(item.notes)}</div>` : ''}
            </div>
            <span style="font-size:13px;color:var(--text-muted)">${escHtml(item.owner||'—')}</span>
            <span>${priorityBadge(item.priority)}</span>
            <select class="move-select" onchange="moveBacklogItem(${i}, this.value); this.value=''">
              ${pillarOpts}
            </select>
            <div class="act-actions">
              <button class="edit-btn" onclick="startBacklogEdit(${i})" aria-label="Edit"><i class="ti ti-pencil" aria-hidden="true"></i></button>
              <button class="del-btn" onclick="deleteBacklogItem(${i})" aria-label="Remove"><i class="ti ti-x" aria-hidden="true"></i></button>
            </div>
          </div>`;
        }).join('')}`;

  return `
    <div class="backlog-hint-banner">
      <i class="ti ti-lightbulb" aria-hidden="true"></i>
      Park ideas and activities here before they're ready to be assigned to a pillar. Use the dropdown to promote an item when it's time.
    </div>
    <div class="backlog-table">${rows}</div>
    <div class="backlog-add-form">
      <div class="add-form-title"><i class="ti ti-plus-circle" aria-hidden="true" style="color:var(--text-muted)"></i> Add to backlog</div>
      <div class="backlog-form-grid">
        <div class="form-group">
          <label>Idea / Activity</label>
          <input type="text" id="bl-name" placeholder="Describe the idea..." onkeydown="if(event.key==='Enter')addBacklogItem()" />
        </div>
        <div class="form-group">
          <label>Owner</label>
          <input type="text" id="bl-owner" placeholder="Person or team" />
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select id="bl-priority">
            <option value="High">High</option>
            <option value="Medium" selected>Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label>Notes (optional)</label>
        <input type="text" id="bl-notes" placeholder="Any extra context..." />
      </div>
      <div class="form-actions">
        <div class="form-hint"><i class="ti ti-device-floppy" aria-hidden="true"></i> Saved automatically · Press Enter to add quickly</div>
        <button class="btn-primary" onclick="addBacklogItem()"><i class="ti ti-plus"></i> Add to backlog</button>
      </div>
    </div>`;
}

function startBacklogEdit(idx) {
  state.editingBacklog = idx;
  render();
  const el = document.getElementById(`bl-edit-name-${idx}`);
  if (el) { el.focus(); el.select(); }
}

function saveBacklogEdit(idx) {
  const nameEl = document.getElementById(`bl-edit-name-${idx}`);
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { if(nameEl){ nameEl.focus(); nameEl.style.borderColor='#ef4444'; setTimeout(()=>nameEl.style.borderColor='',1500); } return; }
  state.backlog[idx].name     = name;
  state.backlog[idx].owner    = (document.getElementById(`bl-edit-owner-${idx}`)    || {}).value?.trim() || '';
  state.backlog[idx].priority = (document.getElementById(`bl-edit-priority-${idx}`) || {}).value || 'Medium';
  state.backlog[idx].notes    = (document.getElementById(`bl-edit-notes-${idx}`)    || {}).value?.trim() || '';
  state.editingBacklog = null;
  saveState(); render(); showToast('Backlog item updated');
}

function cancelBacklogEdit() { state.editingBacklog = null; render(); }

function addBacklogItem() {
  const nameEl = document.getElementById('bl-name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { if(nameEl){ nameEl.focus(); nameEl.style.borderColor='#ef4444'; setTimeout(()=>nameEl.style.borderColor='',1500); } return; }
  state.backlog.push({
    id:       generateId(),
    name,
    owner:    document.getElementById('bl-owner').value.trim(),
    priority: document.getElementById('bl-priority').value,
    notes:    document.getElementById('bl-notes').value.trim()
  });
  saveState(); render(); showToast('Added to backlog');
}

function deleteBacklogItem(idx) {
  if (!confirm('Remove this item from the backlog?')) return;
  state.backlog.splice(idx, 1);
  saveState(); render(); showToast('Item removed');
}

function moveBacklogItem(idx, pillarId) {
  if (!pillarId) return;
  const item = state.backlog[idx];
  if (!item) return;
  const pillar = PILLARS.find(p=>p.id===pillarId);
  state.activities[pillarId].push({
    id:         generateId(),
    name:       item.name,
    owner:      item.owner,
    priority:   item.priority,
    timeline:   'TBD',
    status:     'Planned',
    startMonth: null,
    endMonth:   null,
    children:   []
  });
  state.backlog.splice(idx, 1);
  saveState(); render();
  showToast(`Moved to ${pillar ? pillar.label : pillarId}`);
}

/* ── EXPORT ── */
function openExport()  { document.getElementById('exportModal').classList.add('open'); }
function closeExport() { document.getElementById('exportModal').classList.remove('open'); }

function exportCSV() {
  const rows = [['Pillar','Type','Parent Activity','Activity / Sub-task','Owner','Priority','Timeline','Status','Start Month','End Month']];
  PILLARS.forEach(p => (state.activities[p.id]||[]).forEach(a => {
    const sm = a.startMonth ? MONTHS.find(m=>m.num===parseInt(a.startMonth))?.label||'' : '';
    const em = a.endMonth   ? MONTHS.find(m=>m.num===parseInt(a.endMonth))?.label||''   : '';
    rows.push([p.label,'Activity','',a.name,a.owner||'',a.priority,a.timeline,a.status,sm,em]);
    (a.children||[]).forEach(c => rows.push([p.label,'Sub-task',a.name,c.name,c.owner||'','','',c.status,'','']));
  }));
  if (state.backlog && state.backlog.length) {
    state.backlog.forEach(item => rows.push(['Backlog','Activity','',item.name,item.owner||'',item.priority,'','','','']));
  }
  const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  download('H2_2026_People_Plan.csv','text/csv',csv);
  closeExport(); showToast('CSV exported');
}

function exportJSON() {
  download('H2_2026_People_Plan.json','application/json',JSON.stringify({exported:new Date().toISOString(),plan:'H2 2026 People Workshop Plan',activities:state.activities},null,2));
  closeExport(); showToast('JSON exported');
}

function importJSON(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.activities) { showToast('Invalid backup file'); return; }
      if (!confirm(`This will replace your current plan with the backup from ${data.exported ? new Date(data.exported).toLocaleDateString() : 'unknown date'}. Continue?`)) return;
      PILLARS.forEach(p => { state.activities[p.id] = data.activities[p.id] || []; });
      if (data.backlog) state.backlog = data.backlog;
      PILLARS.forEach(p => {
        (state.activities[p.id]||[]).forEach(a => {
          if (!a.id) a.id = generateId();
          if (!a.children) a.children = [];
        });
      });
      saveState(); render();
      showToast('Plan restored from backup');
    } catch(err) {
      showToast('Could not read file — is it a valid JSON backup?');
    }
    input.value = '';
  };
  reader.readAsText(file);
}

function download(filename, mime, content) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content],{type:mime}));
  a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}

document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeExport(); });
document.getElementById('exportModal').addEventListener('click', e=>{ if(e.target===e.currentTarget) closeExport(); });

function showPillarTip(e, text) {
  const tip = document.getElementById('pillar-tooltip');
  tip.textContent = text;
  tip.classList.add('visible');
  movePillarTip(e);
}
function movePillarTip(e) {
  const tip = document.getElementById('pillar-tooltip');
  const x = e.clientX, y = e.clientY;
  tip.style.left = (x - tip.offsetWidth / 2) + 'px';
  tip.style.top  = (y - tip.offsetHeight - 10) + 'px';
}
function hidePillarTip() {
  document.getElementById('pillar-tooltip').classList.remove('visible');
}

// ── Async startup: load state from server, then render ────────────────────
(async () => {
  const serverState = await loadState();
  initState(serverState);
  render();
})();

// ── Override the final render() call added at build time ───────────────────
// (The bare render() at the end of the file is replaced by async startup)