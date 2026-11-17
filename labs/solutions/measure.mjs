// The readings of lab 2.3, written once: the generator uses them for the reference, and check.mjs
// recomputes them from the files a participant opens.
const round1 = x => Math.round(x * 10) / 10;
const pct = (a, b) => Math.round((100 * a) / b);
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;

// weeks: one array of weekly session counts per person; responses: {uses, saved} per survey answer
export function summarisePilot(weeks, responses) {
  const staff = weeks.length;
  const everUsed = weeks.filter(w => w.some(x => x > 0)).length;
  const regular = weeks.filter(w => w.filter(x => x > 0).length >= 6).length;
  const nWeeks = weeks[0].length;
  const weeklyActive = mean(Array.from({ length: nWeeks }, (_, k) => weeks.filter(w => w[k] > 0).length / staff));
  const answered = responses.filter(r => r.saved !== '' && r.saved != null);
  return {
    staff, everUsed, everUsedPct: pct(everUsed, staff), regular, regularPct: pct(regular, staff),
    weeklyActivePct: Math.round(100 * weeklyActive),
    responses: responses.length, responseRatePct: pct(responses.length, staff),
    selfReportedUses: round1(mean(responses.map(r => Number(r.uses)))),
    loggedUses: round1(mean(weeks.map(w => mean(w)))),
    selfReportedSaved: round1(mean(answered.map(r => Number(r.saved))))
  };
}

// tasks: {without, draft, check, rework} in minutes
export function summariseTiming(tasks) {
  const net = tasks.map(t => t.without - t.draft - t.check - t.rework);
  return {
    timedTasks: tasks.length,
    grossSaved: round1(mean(tasks.map(t => t.without - t.draft))),
    netSaved: round1(mean(net)),
    noGain: net.filter(x => x <= 0).length,
    noGainPct: pct(net.filter(x => x <= 0).length, tasks.length),
    reworked: tasks.filter(t => t.rework > 0).length,
    checkAndReworkPct: pct(tasks.reduce((a, t) => a + t.check + t.rework, 0), tasks.reduce((a, t) => a + t.without - t.draft, 0))
  };
}
