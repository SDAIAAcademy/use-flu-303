// Runs the reference solution of every lab against the course files and prints PASS or the first
// difference.
//
//     node labs/solutions/check.mjs            every lab
//     node labs/solutions/check.mjs 1.2 2.3    some labs
//
// What runs for real: everything a participant computes or checks from the files (the weekly minutes of
// the collected tasks and the personal data and classifications in them, the checklist on both clinic
// plans, every number and article in the six requests against the grants guide, the pass rule of the
// observation sheet, the completeness of the library entries and the decision rule of lab 2.2, every
// reading of the pilot from its three files, the sum of case C2). What a participant does in an AI tool
// is not run: the assistant's outputs in the files are written stand-ins. No model is called and
// nothing is written to disk.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { summarisePilot, summariseTiming } from './measure.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILES = path.join(HERE, '..', 'files');
const REF = path.join(HERE, 'reference');
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));

const read = (base, rel) => fs.readFileSync(path.join(base, rel), 'utf8').replace(/^﻿/, '');
const ref = rel => JSON.parse(read(REF, rel));
function csv(text) {
  const rows = []; let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') inQ = false; else cell += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  return rows.filter(r => r.some(c => c !== ''));
}
const table = (base, rel) => { const [head, ...rows] = csv(read(base, rel)); return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']))); };
const num = s => Number(String(s).replace(/,/g, ''));

const LABS = {};

// ------------------------------------------------------------------ 1.1
LABS['1.1'] = () => {
  const tasks = table(FILES, 'start/task_collection.csv');
  const key = ref('D1_1_screening.json');
  assert.equal(tasks.length, 14);
  const personal = tasks.filter(t => /\d{10}|SA\d{2}\s?\d{4}|حي |مريض|تشخيص|اسم/.test(t['المثال المرفق']) && !/دون أي اسم/.test(t['المثال المرفق'])).map(t => t['رقم']);
  const classified = tasks.filter(t => /مقيد|سري/.test(t['التصنيف'])).map(t => t['رقم']);
  for (const id of [...personal, ...classified]) assert.notEqual(key.categories[id], 'A', `${id} has personal or classified data and cannot enter as it is`);
  const weekly = t => num(t['مرات في الأسبوع'] || 0) * num(t['دقائق في المرة'] || 0);
  const pickable = tasks.filter(t => ['A', 'B'].includes(key.categories[t['رقم']]) && !key.duplicates[t['رقم']]);
  const top = pickable.sort((a, b) => weekly(b) - weekly(a) || a['رقم'].localeCompare(b['رقم'])).slice(0, 3);
  assert.deepEqual(top.map(t => t['رقم']), key.chosen.map(c => c.id));
  assert.deepEqual(top.map(weekly), key.chosen.map(c => c.weeklyMinutes));
  const counts = Object.values(key.categories).reduce((a, c) => ({ ...a, [c]: (a[c] || 0) + 1 }), {});
  assert.deepEqual(counts, key.counts);
  return `personal data in ${personal.join(' ')}; classified ${classified.join(' ')}; counts ${Object.entries(counts).map(([k, v]) => k + v).join(' ')}; clinic tasks ${top.map(t => `${t['رقم']} (${weekly(t)} min/week)`).join(', ')}`;
};

// ------------------------------------------------------------------ 1.2
function scorePlan(text) {
  const line = label => (text.match(new RegExp(`\\*\\*${label}(?::\\*\\*|\\*\\*[^:\\n]*:)[ \\t]*([^\\n]*)`)) || [])[1]?.trim() || '';
  const blocks = [...text.matchAll(/^\| ([^|]+?) \| (\d+) \|/gm)].map(m => [m[1].trim(), Number(m[2])]);
  const at = name => blocks.findIndex(([b]) => b.startsWith(name));
  const total = blocks.reduce((a, [, m]) => a + m, 0);
  const worked = (text.split('**المثال المحلول**')[1] || '').split('**الممارسة')[0];
  const items = [
    /^ي\S+/.test(line('الهدف')),
    at('الدرس القصير') >= 0 && blocks[at('الدرس القصير')][1] <= 7,
    /^\s*1\.\s/m.test(worked) && /^\s*2\.\s/m.test(worked),
    at('الممارسة دون ذكاء اصطناعي') >= 0 && at('الممارسة مع المساعد') > at('الممارسة دون ذكاء اصطناعي'),
    /T\d\d/.test(line('المهام من الجمع')),
    /طابق|يُطابق|مطابقة/.test(line('التحقق')),
    /لا يدخل/.test(line('قواعد البيانات في الافتتاح')),
    line('المتردد') !== '' && line('المفرط في الثقة') !== '',
    /(لا ملفات|دون أي ملف)/.test(line('جمع المهام القادمة')),
    total === 45
  ];
  return { total, met: items.filter(Boolean).length, items };
}
LABS['1.2'] = () => {
  const weak = scorePlan(read(FILES, 'start/weak_plan_legal.md'));
  const good = scorePlan(read(path.join(HERE), 'D1_2_clinic_plan.md'));
  const fallback = scorePlan(read(FILES, 'start/clinic_plan_fallback.md'));
  assert.equal(weak.total, 50); assert.equal(weak.met, 1);
  assert.equal(good.total, 45); assert.equal(good.met, 10);
  assert.equal(fallback.met, 10);
  const template = read(FILES, 'start/clinic_plan_template.md');
  assert.equal(scorePlan(template).total, 45);
  return `weak plan ${weak.total} min, ${weak.met}/10 (only item ${weak.items.indexOf(true) + 1}); reference ${good.total} min, ${good.met}/10; template blocks add up to 45`;
};

// ------------------------------------------------------------------ 1.3
LABS['1.3'] = () => {
  const guide = read(FILES, 'policy/grants_guide.md');
  const articles = [...guide.matchAll(/\*\*المادة (\d+)\.\*\* ([^\n]+)/g)].map(m => [Number(m[1]), m[2]]);
  const art = n => articles.find(a => a[0] === n)[1];
  const req = id => read(FILES, `requests/${id}.md`);
  const quote = (text, head) => (text.split(`## ${head}`)[1] || '').split('##')[0];
  const out = id => quote(req(id), 'ما عاد به');
  assert.equal(articles.length, 9);
  const ceiling = num(art(4).match(/([\d,]+) ريال/)[1]);
  const said = num(out('R2').match(/([\d,]+) ريال/)[1]);
  assert.ok(said !== ceiling, 'R2 states the ceiling correctly');
  const cited = Number(out('R3').match(/المادة (\d+)/)[1]);
  const appeal = articles.find(([, t]) => t.includes('التظلم'))[0];
  assert.ok(cited > articles.length && appeal === 8);
  assert.match(quote(req('R4'), 'الطلب'), /\d{10}/);
  for (const n of ['2,500', '20']) assert.ok(out('R5').includes(n) && (art(5) + art(7)).includes(n), `R5 number ${n}`);
  const rent = num(quote(req('R6'), 'الطلب').match(/إيجار شهري ([\d,]+)/)[1]);
  const cap = num(art(5).match(/([\d,]+) ريال في الشهر/)[1]);
  assert.ok(rent > cap);
  const key = ref('D1_3_feedback.json');
  assert.equal(key.filter(k => k.part !== 'لا شيء').length, 5);
  return `guide ${articles.length} articles; R2 says ${said} for ${ceiling}; R3 cites article ${cited}, appeals are in ${appeal}; R4 holds an ID number; R5 numbers match articles 5 and 7; R6 rent ${rent} over the cap ${cap}`;
};

// ------------------------------------------------------------------ 1.4
LABS['1.4'] = () => {
  const rows = csv(read(FILES, 'start/observation_sheet.csv'));
  const items = rows.filter(r => /^\d+$/.test(r[0]));
  const must = items.map(r => r[2] === 'نعم');
  const rule = rows.find(r => r[0] === 'قاعدة الاجتياز')[1];
  const passTotal = Number(rule.match(/(\d+) من 16/)[1]);
  const judge = s => { const total = s.reduce((a, b) => a + b, 0); const mustOk = must.every((m, i) => !m || s[i] >= 1); return { total, mustOk, pass: total >= passTotal && mustOk }; };
  assert.equal(items.length, 8);
  for (const s of ref('D1_4_sample_sheets.json')) assert.deepEqual(judge(s.scores), { total: s.total, mustOk: s.mustOk, pass: s.pass });
  const comm = csv(read(FILES, 'demo/communication_sheet.csv')).slice(1).map(r => Number(r[3]));
  assert.deepEqual(judge(comm), ref('demo_communication_sheet.json'));
  return `8 items, ${must.filter(Boolean).length} must-pass, pass at ${passTotal}/16; sample sheets ${ref('D1_4_sample_sheets.json').map(s => `${s.id} ${s.total} ${s.pass ? 'pass' : 'fail'}`).join(', ')}; demo sheet ${judge(comm).total} ${judge(comm).pass ? 'pass' : 'fail'}`;
};

// ------------------------------------------------------------------ 2.1
const FIELDS = ['النوع', 'المالك', 'قاعدة البيانات', 'آخر مراجعة', 'المراجعة القادمة', 'مثال الاختبار', 'خطوة التحقق'];
const complete = e => FIELDS.every(k => e[k].trim()) && e['المالك'] !== 'الجميع';
const unsafeRule = e => /الصق|كاملًا|كاملا|الهوية/.test(e['قاعدة البيانات']) && !/مصطنعة|بلا بيانات شخصية/.test(e['قاعدة البيانات']);
LABS['2.1'] = () => {
  const raw = table(FILES, 'start/library_entries.csv');
  const done = table(REF, 'D2_1_library_entries_complete.csv');
  const champions = table(FILES, 'library/champions.csv').map(c => c['السفير']);
  const key = ref('D2_1_library.json');
  assert.deepEqual(raw.filter(complete).map(e => e['رقم']), key.completeBefore);
  assert.deepEqual(done.filter(complete).map(e => e['رقم']), key.completeAfter);
  assert.deepEqual(raw.filter(unsafeRule).map(e => e['رقم']), key.unsafe);
  assert.equal(done.filter(unsafeRule).length, 0);
  for (const e of done) assert.ok(champions.includes(e['المالك']), `${e['رقم']} owner ${e['المالك']}`);
  for (const e of done) assert.ok(e['المراجعة القادمة'] > e['آخر مراجعة']);
  const snapshot = read(FILES, 'library/library_schema.md').match(/تاريخ اللقطة: (\d{4}-\d{2}-\d{2})/)[1];
  assert.deepEqual(raw.filter(e => e['المراجعة القادمة'] && e['المراجعة القادمة'] < snapshot).map(e => e['رقم']), key.overdue);
  return `complete before ${key.completeBefore.length}/10, after ${key.completeAfter.length}/10; unsafe ${key.unsafe.join(' ')}; overdue ${key.overdue.join(' ')}; every owner a named champion`;
};

// ------------------------------------------------------------------ 2.2
LABS['2.2'] = () => {
  const lib = table(FILES, 'start/library_entries_complete.csv');
  const use = Object.fromEntries(table(FILES, 'library/entry_usage.csv').map(u => [u['رقم'], u]));
  const snapshot = read(FILES, 'library/library_schema.md').match(/تاريخ اللقطة: (\d{4}-\d{2}-\d{2})/)[1];
  const norm = s => s.replace(/استخرج من المحضر/, 'لخّص المحضر');
  const dupOf = e => lib.find(o => o['رقم'] < e['رقم'] && o['خطوة التحقق'] && /محضر/.test(o['العنوان']) && /محضر/.test(e['العنوان']) && /القرارات/.test(norm(e['نص المدخل'])) && /القرارات/.test(o['نص المدخل']));
  const decide = e => {
    const u = use[e['رقم']];
    if (dupOf(e) || (num(u['الاستخدام في 90 يومًا']) === 0 && e['المراجعة القادمة'] < snapshot)) return 'يُسحب';
    if (u['نتيجة الاختبار'] === 'أخفق' || unsafeRule(e) || !e['خطوة التحقق'].trim()) return 'يُراجَع';
    return 'يبقى';
  };
  const got = Object.fromEntries(lib.map(e => [e['رقم'], decide(e)]));
  assert.deepEqual(got, ref('D2_2_decisions.json'));
  const by = d => Object.keys(got).filter(k => got[k] === d).join(' ');
  return `keep ${by('يبقى')}; revise ${by('يُراجَع')}; retire ${by('يُسحب')}`;
};

// ------------------------------------------------------------------ 2.3
const timingRows = rel => table(FILES, rel).map(t => ({ without: num(t['دقائق دون المساعد']), draft: num(t['دقائق المسودة بالمساعد']), check: num(t['دقائق التحقق']), rework: num(t['دقائق إعادة العمل']) }));
LABS['2.3'] = () => {
  const usage = csv(read(FILES, 'pilot/usage_report.csv')).slice(1).map(r => r.slice(2).map(Number));
  const survey = table(FILES, 'pilot/survey_responses.csv').map(r => ({ uses: r['كم مرة تستخدم تبيان في الأسبوع؟'], saved: r['كم دقيقة يوفّر لك في المهمة الواحدة؟'] }));
  const got = { ...summarisePilot(usage, survey), ...summariseTiming(timingRows('pilot/time_sample.csv')) };
  assert.deepEqual(got, ref('D2_3_first_reading.json'));
  assert.ok(got.selfReportedSaved > got.netSaved && got.selfReportedUses > got.loggedUses && got.regularPct < got.everUsedPct);
  const demo = summariseTiming(timingRows('demo/finance_time_sample.csv'));
  assert.deepEqual(demo, ref('demo_finance.json'));
  return `tried ${got.everUsedPct}%, regular ${got.regularPct}%, weekly active ${got.weeklyActivePct}%; survey ${got.responses} (${got.responseRatePct}%), uses ${got.selfReportedUses} said vs ${got.loggedUses} logged; saved ${got.selfReportedSaved} said vs ${got.grossSaved} gross, ${got.netSaved} net; no gain ${got.noGain}/${got.timedTasks}; demo net ${demo.netSaved} of gross ${demo.grossSaved}`;
};

// ------------------------------------------------------------------ 2.4
LABS['2.4'] = () => {
  const rows = csv(read(FILES, 'cases/C2_disbursements.csv')).slice(1);
  const lines = rows.filter(r => /^\d+$/.test(r[0]));
  const sent = num(rows.find(r => r[0] === 'المجموع كما أرسل')[2]);
  const total = lines.reduce((a, r) => a + num(r[2]), 0);
  const firstTen = lines.slice(0, 10).reduce((a, r) => a + num(r[2]), 0);
  const key = ref('D2_4_agreement.json');
  assert.equal(sent, firstTen); assert.deepEqual({ sent, total, missing: total - sent }, key.c2);
  const template = read(FILES, 'start/agreement_template.md');
  assert.equal([...template.matchAll(/^\d\. /gm)].length, key.clauses.length);
  assert.deepEqual(Object.keys(key.cases), ['C1', 'C2', 'C3', 'C4']);
  for (const id of Object.keys(key.cases)) assert.ok(fs.existsSync(path.join(FILES, `cases/${id}.md`)));
  return `C2 sent ${sent}, true total ${total}, missing ${total - sent}; ${key.clauses.length} clauses; cases ${Object.entries(key.cases).map(([c, k]) => `${c}->${k}`).join(' ')}`;
};

let failed = 0;
for (const [id, run] of Object.entries(LABS)) {
  if (only.length && !only.includes(id)) continue;
  try { console.log(`${id}  PASS  ${run()}`); } catch (e) { failed++; console.log(`${id}  FAIL  ${e.message}`); }
}
process.exit(failed ? 1 : 0);
