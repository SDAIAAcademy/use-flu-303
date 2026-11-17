// Writes the Warif Endowments Authority file pack (labs/files/) and the trainer's reference files
// (labs/solutions/reference/, labs/solutions/*.md).
//
//     node labs/_tools/prepare_files.mjs
//
// Deterministic: no clock, no network, and the only random numbers come from a fixed seed, so every
// participant and every answer key match. Everything about Warif is fictional.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D1 from './day1.mjs';
import * as D2 from './day2.mjs';
import { summarisePilot, summariseTiming } from '../solutions/measure.mjs';

const LABS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = path.join(LABS, 'files');
const SOL = path.join(LABS, 'solutions');
const REF = path.join(SOL, 'reference');
const SEED = 3030;

let written = 0;
function write(base, rel, text) {
  const file = path.join(base, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.replace(/\r\n/g, '\n'), 'utf8');
  written++;
}
// A spreadsheet opens a UTF-8 file with Arabic correctly only when it starts with a byte order mark
const csv = rows => '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n') + '\n';
const json = v => JSON.stringify(v, null, 2) + '\n';
const mdTable = (head, rows) => `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${rows.map(r => `| ${r.join(' | ')} |`).join('\n')}\n`;
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

for (const dir of [FILES, REF]) fs.rmSync(dir, { recursive: true, force: true });
for (const f of fs.existsSync(SOL) ? fs.readdirSync(SOL) : []) if (f.endsWith('.md')) fs.rmSync(path.join(SOL, f));

// ================================================================ lab 1.1
write(FILES, 'rules/unit_ai_rules.md', D1.unitRules);
const TASK_HEAD = ['رقم', 'المرسل', 'المهمة كما كتبها', 'المثال المرفق', 'التصنيف', 'مرات في الأسبوع', 'دقائق في المرة'];
write(FILES, 'start/task_collection.csv', csv([[...TASK_HEAD, 'الفئة (A/B/C/D)', 'السبب'],
  ...D1.tasks.map(t => [t.id, t.from, t.text, t.sample, t.cls, t.perWeek || '', t.minutes || '', '', ''])]));
write(FILES, 'start/escalation_note_template.md', `# مذكرة تصعيد

**إلى:**
**المهمة:** (رقمها في جدول الجمع)
**ما طُلب:**
**لماذا لا يملكه السفير:**
**المطلوب ممن يصله التصعيد:**
**ما يحدث حتى القرار:**
`);
const weekly = t => t.perWeek * t.minutes;
const pickable = D1.tasks.filter(t => (t.cat === 'A' || t.cat === 'B') && !t.dup);
const chosen = [...pickable].sort((a, b) => weekly(b) - weekly(a) || a.id.localeCompare(b.id)).slice(0, 3);
const r11 = {
  counts: Object.fromEntries(Object.keys(D1.CATS).map(k => [k, D1.tasks.filter(t => t.cat === k).length])),
  categories: Object.fromEntries(D1.tasks.map(t => [t.id, t.cat])),
  duplicates: Object.fromEntries(D1.tasks.filter(t => t.dup).map(t => [t.id, t.dup])),
  chosen: chosen.map(t => ({ id: t.id, weeklyMinutes: weekly(t), cat: t.cat })),
  escalate: D1.escalations.map(e => e.task)
};
write(REF, 'D1_1_screening.json', json(r11));
write(REF, 'D1_1_task_collection.csv', csv([[...TASK_HEAD, 'الفئة (A/B/C/D)', 'السبب'],
  ...D1.tasks.map(t => [t.id, t.from, t.text, t.sample, t.cls, t.perWeek || '', t.minutes || '', t.cat, t.why])]));
write(SOL, 'D1_1_task_screening.md', `# المختبر 1.1 · فرز المهام المجموعة (الحل المرجعي)

## الفرز

${mdTable(['رقم', 'الفئة', 'السبب'], D1.tasks.map(t => [t.id, `${t.cat} · ${D1.CATS[t.cat]}`, t.why]))}
العدد: ${Object.entries(r11.counts).map(([k, n]) => `${k} ${n}`).join('، ')}. T12 نسخة من T02.

## المهام الثلاث للعيادة

بأكبر وقت أسبوعي بين ما يدخل العيادة (A وB، دون النسخ المكررة):

${mdTable(['رقم', 'الفئة', 'دقائق في الأسبوع'], chosen.map(t => [t.id, t.cat, weekly(t)]))}
مهمتان من الثلاث تحتاجان إلى تجريد قبل العيادة: هذا ما يجعل نموذج الجمع الآمن مهمًا.

## مذكرتا التصعيد

${D1.escalations.map(e => `### ${e.task}\n\n**إلى:** ${e.to}\n\n${e.note}\n`).join('\n')}`);

// ================================================================ lab 1.2
write(FILES, 'start/clinic_plan_template.md', D1.planTemplate);
write(FILES, 'start/checklist.md', `# قائمة تحقق خطة العيادة\n\n${mdTable(['#', 'البند', 'كيف تعرف أنه مستوفى'], D1.checklist.map(([k, t], i) => [i + 1, k, t]))}`);
write(FILES, 'start/weak_plan_legal.md', D1.weakPlan);
const strip = s => s.replace(/فهد سالم الدوسري/g, 'المستفيد س').replace(/\d{10}/g, '0000000000').replace(/أم عبدالله القحطاني، حي النسيم، شارع 12/g, 'الأسرة (أ)، الحي (ب)');
write(FILES, 'start/chosen_tasks.md', `# المهام الثلاث للعيادة (ملف بديل لمن لم يُنهِ المختبر 1.1)

${chosen.map(t => `## ${t.id} · ${t.text}\n\n- المرسل: ${t.from}\n- الوقت: ${t.perWeek} مرات في الأسبوع، ${t.minutes} دقيقة في المرة\n- المثال (${t.cat === 'B' ? 'مجرّد' : 'كما أُرسل'}): ${strip(t.sample)}\n`).join('\n')}`);
write(FILES, 'start/clinic_plan_fallback.md', D1.referencePlan.replace('(الحل المرجعي)', '(خطة بديلة للمختبر 1.4)'));
write(SOL, 'D1_2_clinic_plan.md', D1.referencePlan);

// ================================================================ lab 1.3
write(FILES, 'policy/grants_guide.md', D1.guide);
for (const r of D1.requests) {
  write(FILES, `requests/${r.id}.md`, `# ${r.id} · من ${r.from}

## الطلب كما كُتب في «${D1.ASSISTANT}»

> ${r.request}

## ما عاد به «${D1.ASSISTANT}»

> ${r.output}

## كيف تحقق الزميل

> ${r.check}

المصدر المرفق: \`policy/grants_guide.md\`
`);
}
write(FILES, 'start/feedback_sheet.csv', csv([['الطلب', 'ما نجح', 'تغيير واحد في الطلب', 'تحقق واحد يُضاف'], ...D1.requests.map(r => [r.id, '', '', ''])]));
write(REF, 'D1_3_feedback.json', json(D1.requests.map(r => ({ id: r.id, part: r.part, issue: r.issue }))));
write(SOL, 'D1_3_feedback_ai_off.md', `# المختبر 1.3 · ملاحظات على ستة طلبات (الحل المرجعي)

خمس مشكلات وحالة سليمة واحدة.

${D1.requests.map(r => `## ${r.id} · موضع الضعف: ${r.part}

${r.issue}

- **ما نجح:** ${r.feedback.worked}
- **تغيير واحد في الطلب:** ${r.feedback.change}
- **تحقق واحد يُضاف:** ${r.feedback.check}
`).join('\n')}`);

// ================================================================ lab 1.4
write(FILES, 'clinic/role_cards.md', D1.roleCards);
write(FILES, 'start/observation_sheet.csv', csv([['#', 'البند', 'إلزامي', 'الدرجة (0/1/2)', 'الدليل مما رأيت أو سمعت'],
  ...D1.sheet.map(([k, must], i) => [i + 1, k, must ? 'نعم' : '', '', '']),
  [], ['قاعدة الاجتياز', `${D1.PASS_TOTAL} من 16 على الأقل، وكل بند إلزامي بدرجة 1 أو أكثر`]]));
const judge = scores => {
  const total = scores.reduce((a, b) => a + b, 0);
  const mustOk = D1.sheet.every(([, must], i) => !must || scores[i] >= 1);
  return { total, mustOk, pass: total >= D1.PASS_TOTAL && mustOk };
};
const r14 = D1.sampleSheets.map(s => ({ id: s.id, who: s.who, scores: s.scores, ...judge(s.scores) }));
write(REF, 'D1_4_sample_sheets.json', json(r14));
write(FILES, 'demo/communication_sheet.csv', csv([['#', 'البند', 'إلزامي', 'الدرجة'], ...D1.sheet.map(([k, must], i) => [i + 1, k, must ? 'نعم' : '', D1.demo.commSheet.scores[i]])]));
write(REF, 'demo_communication_sheet.json', json(judge(D1.demo.commSheet.scores)));
write(SOL, 'D1_4_practice_clinic.md', `# المختبر 1.4 · العيادة التدريبية المرصودة (مرجع المدرب)

لا حل واحد لهذا المختبر: الناتج ورقة ملاحظة لكل مشارك. هذه ثلاث أوراق مصطنعة لمعايرة المقيِّمين قبل الجولات.

${mdTable(['الورقة', 'الدرجات', 'المجموع', 'البندان الإلزاميان', 'النتيجة'], r14.map(s => [s.id, s.scores.join(' '), `${s.total} من 16`, s.mustOk ? 'مستوفيان' : `غير مستوفى: البند ${D1.sheet.map(([, must], i) => must && s.scores[i] < 1 ? i + 1 : null).filter(Boolean).join(' و')}`, s.pass ? 'اجتياز' : 'لم يجتز']))}
الورقة S-B مجموعها مرتفع ولم تجتز: الملاحظة على التحقق صفر. هذا ما تمنعه قاعدة البنود الإلزامية.
`);

// ================================================================ lab 2.1
write(FILES, 'library/champions.csv', csv([['الإدارة', 'السفير'], ...D2.champions]));
write(FILES, 'library/library_schema.md', `# مخطط مدخل في مكتبة وارِف المشتركة

كل مدخل له الحقول السبعة كلها. المدخل الناقص لا يُنشر.

${mdTable(['الحقل', 'ما يُكتب فيه'], [
  ['النوع', D2.TYPES.join(' أو ')],
  ['المالك', 'شخص واحد باسمه من قائمة السفراء أو من فريقه، لا إدارة ولا «الجميع»'],
  ['قاعدة البيانات', 'ما يجوز إدخاله وما لا يجوز، على قواعد الجهة: عام فقط، بلا بيانات شخصية'],
  ['آخر مراجعة', 'تاريخ بصيغة YYYY-MM-DD'],
  ['المراجعة القادمة', 'ستة أشهر بعد آخر مراجعة على الأكثر'],
  ['مثال الاختبار', 'مثال مصطنع يُشغَّل عليه المدخل، وما ينبغي أن يخرج'],
  ['خطوة التحقق', 'ما يُطابق على أي مصدر بعد كل استخدام']
])}
تاريخ اللقطة: ${D2.SNAPSHOT}. منه تُعرف المدخلات التي فات تاريخ مراجعتها.
`);
const ENTRY_HEAD = ['رقم', 'العنوان', 'الإدارة', ...D2.FIELDS, 'نص المدخل'];
const rowOf = (e, f) => [e.id, e.title, e.dept, ...D2.FIELDS.map(k => f[k] ?? ''), e.body];
const done = f => D2.FIELDS.every(k => String(f[k] || '').trim()) && f['المالك'] !== 'الجميع';
const completeFields = e => ({ ...e.raw, ...(e.fix || {}) });
write(FILES, 'start/library_entries.csv', csv([ENTRY_HEAD, ...D2.entries.map(e => rowOf(e, e.raw))]));
write(REF, 'D2_1_library_entries_complete.csv', csv([ENTRY_HEAD, ...D2.entries.map(e => rowOf(e, completeFields(e)))]));
write(FILES, 'start/library_entries_complete.csv', csv([ENTRY_HEAD, ...D2.entries.map(e => rowOf(e, completeFields(e)))]));
const r21 = {
  completeBefore: D2.entries.filter(e => done(e.raw)).map(e => e.id),
  completeAfter: D2.entries.filter(e => done(completeFields(e))).map(e => e.id),
  missingOwner: D2.entries.filter(e => !e.raw['المالك'] || e.raw['المالك'] === 'الجميع').map(e => e.id),
  missingDates: D2.entries.filter(e => !e.raw['آخر مراجعة']).map(e => e.id),
  missingCheck: D2.entries.filter(e => !e.raw['خطوة التحقق']).map(e => e.id),
  unsafe: D2.unsafe,
  overdue: D2.entries.filter(e => e.raw['المراجعة القادمة'] && e.raw['المراجعة القادمة'] < D2.SNAPSHOT).map(e => e.id),
  duplicates: Object.fromEntries(D2.entries.filter(e => e.dup).map(e => [e.id, e.dup]))
};
write(REF, 'D2_1_library.json', json(r21));
write(SOL, 'D2_1_library_entries.md', `# المختبر 2.1 · عشرة مدخلات من الأقران (الحل المرجعي)

- المدخلات المكتملة قبل العمل: ${r21.completeBefore.length} من 10 (${r21.completeBefore.join('، ')}). بعده: ${r21.completeAfter.length} من 10.
- مالك ناقص أو ليس شخصًا: ${r21.missingOwner.join('، ')}. تاريخ مراجعة ناقص: ${r21.missingDates.join('، ')}. خطوة تحقق فارغة: ${r21.missingCheck.join('، ')}.
- قاعدة بيانات تكسر قواعد الجهة: ${r21.unsafe.join('، ')} (يطلب لصق سجل المستفيد كاملًا).
- لا يُطلب في هذا المختبر تعليم المدخلات المكررة أو التي فات تاريخ مراجعتها: يكتشفها المشارك في 2.2 حين يطبق قاعدة القرار، والمرجع في حل المختبر 2.2.

## ما أُضيف أو تغيّر

${mdTable(['رقم', 'الحقل', 'القيمة المرجعية'], D2.entries.flatMap(e => Object.entries(e.fix || {}).map(([k, v]) => [e.id, k, v])))}
الجدول الكامل: \`solutions/reference/D2_1_library_entries_complete.csv\`.
`);

// ================================================================ lab 2.2
write(FILES, 'library/entry_usage.csv', csv([['رقم', 'الاستخدام في 90 يومًا', 'نتيجة الاختبار', 'ملاحظة الاختبار'],
  ...D2.entries.map(e => [e.id, D2.usage[e.id].uses, D2.usage[e.id].test, D2.usage[e.id].note])]));
write(FILES, 'library/entry_tests.md', D2.entryTests);
write(FILES, 'start/retire_note_template.md', `# مذكرة سحب

- **المدخل:**
- **السبب:**
- **ما يحل محله:**
- **ما يحدث للمستخدمين:**
- **السجل:**
`);
const decide = e => {
  const f = completeFields(e), u = D2.usage[e.id];
  if (e.dup || (u.uses === 0 && f['المراجعة القادمة'] < D2.SNAPSHOT)) return 'يُسحب';
  if (u.test === 'أخفق' || D2.unsafe.includes(e.id) && f['قاعدة البيانات'] === e.raw['قاعدة البيانات'] || !f['خطوة التحقق']) return 'يُراجَع';
  return 'يبقى';
};
const r22 = Object.fromEntries(D2.entries.map(e => [e.id, decide(e)]));
write(REF, 'D2_2_decisions.json', json(r22));
write(SOL, 'D2_2_review_retire.md', `# المختبر 2.2 · راجع مدخلين أو اسحبهما (الحل المرجعي)

## القاعدة

${D2.decisionRule.map(([d, w], i) => `${i + 1}. **${d}** ${w}.`).join('\n')}

## القرارات

${mdTable(['رقم', 'الاستخدام', 'الاختبار', 'القرار'], D2.entries.map(e => [e.id, D2.usage[e.id].uses, D2.usage[e.id].test, r22[e.id]]))}
يُراجَع: ${D2.entries.filter(e => r22[e.id] === 'يُراجَع').map(e => e.id).join('، ')}. يُسحب: ${D2.entries.filter(e => r22[e.id] === 'يُسحب').map(e => e.id).join('، ')}.

## مراجعة L09

> ${D2.revisedL09}

يُعاد اختباره على الأسئلة الخمسة المعروفة: السؤالان اللذان أخفقا يصيران «لا يذكره الدليل، يُسأل القسم» و«مرة واحدة بطلب جديد بعد ستة أشهر (المادة 9)».

## مراجعة L05

> ${D2.revisedL05}

${D2.retireNote}`);

// ================================================================ lab 2.3
const R = rng(SEED);
const normal = (m, s) => { const u = Math.max(R(), 1e-9), v = R(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const between = ([a, b]) => a + Math.floor(R() * (b - a + 1));
const profileNames = Object.keys(D2.PROFILES);
function pickProfile() { let x = R(), acc = 0; for (const p of profileNames) { acc += D2.PROFILES[p].share; if (x < acc) return p; } return profileNames.at(-1); }
const staff = [];
let n = 0;
for (const [dept, size] of D2.PILOT) for (let i = 0; i < size; i++) {
  const profile = pickProfile();
  const P = D2.PROFILES[profile];
  const weeks = Array.from({ length: D2.WEEKS }, () => (R() < P.active ? between(P.sessions) : 0));
  if (profile === 'جرّب مرة') weeks[between([0, 1])] = 1;
  staff.push({ id: `U${String(++n).padStart(3, '0')}`, dept, profile, weeks });
}
write(FILES, 'pilot/usage_report.csv', csv([['المستخدم', 'الإدارة', ...Array.from({ length: D2.WEEKS }, (_, w) => `جلسات الأسبوع ${w + 1}`)],
  ...staff.map(s => [s.id, s.dept, ...s.weeks])]));
const responses = [];
for (const s of staff) {
  const P = D2.PROFILES[s.profile];
  if (R() >= P.answer) continue;
  const actual = s.weeks.reduce((a, b) => a + b, 0) / D2.WEEKS;
  const used = s.weeks.some(x => x > 0);
  responses.push({
    id: `S${String(responses.length + 1).padStart(3, '0')}`, dept: s.dept,
    uses: used ? Math.max(1, Math.round(actual * 1.3 + normal(0.5, 0.8))) : 0,
    saved: used ? Math.max(0, Math.round(normal(...P.saved))) : '',
    checks: used ? (R() < 0.82 ? 'نعم' : 'لا') : '',
    satisfaction: used ? Math.min(5, Math.max(1, Math.round(normal(3.9, 0.8)))) : ''
  });
}
write(FILES, 'pilot/survey_responses.csv', csv([['رقم الاستجابة', 'الإدارة', 'كم مرة تستخدم تبيان في الأسبوع؟', 'كم دقيقة يوفّر لك في المهمة الواحدة؟', 'هل تتحقق دائمًا من المخرج؟', 'رضاك من 1 إلى 5'],
  ...responses.map(r => [r.id, r.dept, r.uses, r.saved, r.checks, r.satisfaction])]));
const users = staff.filter(s => s.weeks.some(x => x > 0));
const sampled = [];
const pool = [...users];
while (sampled.length < D2.TIME_SAMPLE.people) sampled.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
const TASK_KINDS = ['خطاب', 'ملخص محضر', 'رد على استفسار', 'جدول متابعة'];
const timing = sampled.sort((a, b) => a.id.localeCompare(b.id)).flatMap((s, i) => [0, 1].map(k => {
  const without = Math.round(normal(38, 9));
  const draft = Math.round(without * (0.3 + R() * 0.3));
  const check = between([5, 12]);
  const rework = R() < D2.TIME_SAMPLE.reworkChance ? between([8, 22]) : 0;
  return { person: `P${String(i + 1).padStart(2, '0')}`, dept: s.dept, task: TASK_KINDS[(i + k) % TASK_KINDS.length], without, draft, check, rework };
}));
write(FILES, 'pilot/time_sample.csv', csv([['الشخص', 'الإدارة', 'نوع المهمة', 'دقائق دون المساعد', 'دقائق المسودة بالمساعد', 'دقائق التحقق', 'دقائق إعادة العمل'],
  ...timing.map(t => [t.person, t.dept, t.task, t.without, t.draft, t.check, t.rework])]));
write(FILES, 'start/measurement_plan_template.md', D2.planTemplate);
const r23 = { ...summarisePilot(staff.map(s => s.weeks), responses), ...summariseTiming(timing) };
write(REF, 'D2_3_first_reading.json', json(r23));
write(SOL, 'D2_3_measurement.md', `# المختبر 2.3 · خطة قياس وقراءة أولى (الحل المرجعي)

## الخطة

${mdTable(['المؤشر', 'النوع', 'التعريف بالضبط', 'المصدر', 'التكرار', 'ما لا يقوله'], [
  ['الاستخدام المنتظم', 'استخدام', 'نسبة الموظفين الذين لهم جلسة في 6 أسابيع على الأقل من 8', 'تقرير الاستخدام', 'شهري', 'هل كان الاستخدام نافعًا'],
  ['الوقت الصافي في المهمة', 'قيمة', 'دقائق المهمة دون المساعد ناقص (المسودة والتحقق وإعادة العمل)، في عينة توقيت', 'عينة التوقيت', 'كل شهرين', 'أثر الجودة ولا المهام التي لم تُقس'],
  ['نسبة المهام بلا مكسب صافٍ', 'قيمة', 'نسبة المهام في العينة التي وقتها الصافي صفر أو أقل', 'عينة التوقيت', 'كل شهرين', 'سبب الخسارة'],
  ['إعادة العمل', 'جودة', 'نسبة المهام في العينة التي احتاجت إعادة عمل بعد التحقق', 'عينة التوقيت', 'كل شهرين', 'الأخطاء التي لم يكتشفها أحد'],
  ['الرضا والتحقق المعلن', 'استخدام', 'متوسط الرضا ونسبة «أتحقق دائمًا» بين المجيبين، مع نسبة الاستجابة', 'الاستبيان', 'ربع سنوي', 'رأي من لم يجب']
])}
## القراءة الأولى

${mdTable(['الرقم', 'القيمة'], [
  ['الموظفون في التجربة', r23.staff],
  ['جرّبوا مرة على الأقل', `${r23.everUsed} (${r23.everUsedPct}%)`],
  ['يستخدمون بانتظام (6 أسابيع من 8)', `${r23.regular} (${r23.regularPct}%)`],
  ['متوسط النشطين في الأسبوع', `${r23.weeklyActivePct}%`],
  ['استجابات الاستبيان', `${r23.responses} (${r23.responseRatePct}%)`],
  ['متوسط الجلسات الأسبوعية المعلن بين المجيبين', r23.selfReportedUses],
  ['متوسط الجلسات الأسبوعية في تقرير الاستخدام، كل الموظفين', r23.loggedUses],
  ['الدقائق الموفرة في المهمة بحسب المجيبين', r23.selfReportedSaved],
  ['المكسب الإجمالي في المهمة في العينة (دون التحقق وإعادة العمل)', r23.grossSaved],
  ['الوقت الصافي الموفر في المهمة في العينة', r23.netSaved],
  ['مهام العينة بلا مكسب صافٍ', `${r23.noGain} من ${r23.timedTasks} (${r23.noGainPct}%)`],
  ['مهام العينة التي احتاجت إعادة عمل', `${r23.reworked} من ${r23.timedTasks}`]
])}
**الفقرة:** جرّب المساعدَ ${r23.everUsedPct}% من موظفي التجربة، ويستخدمه بانتظام ${r23.regularPct}% فقط. أجاب عن الاستبيان ${r23.responseRatePct}%، وأكثرهم من المستخدمين الكثيفين: معدل الجلسات المعلن بينهم ${r23.selfReportedUses} في الأسبوع مقابل ${r23.loggedUses} في التقرير لكل الموظفين. يقول المجيبون إن المساعد يوفّر ${r23.selfReportedSaved} دقيقة في المهمة، والعينة المؤقتة تقول ${r23.netSaved} دقيقة صافية بعد التحقق وإعادة العمل، و${r23.noGainPct}% من المهام لم توفّر شيئًا. لا نعرف بعد أثر الجودة، ولا ما يحدث في المهام التي لم تُقس. الشهر القادم: عينة توقيت ثانية بالحجم نفسه، وسؤال في الاستبيان عن آخر مهمة بدل المتوسط.
`);
// a Finance timing for the slides of session 3 (not the lab's data)
const RD = rng(D2.demoFinance.seed);
const demoTiming = Array.from({ length: D2.demoFinance.tasks }, (_, i) => {
  const without = 30 + Math.floor(RD() * 21);
  const draft = Math.round(without * (0.35 + RD() * 0.25));
  const check = 6 + Math.floor(RD() * 6);
  const rework = RD() < 0.3 ? 10 + Math.floor(RD() * 10) : 0;
  return { person: `F${i + 1}`, dept: 'المالية', task: 'مذكرة صرف', without, draft, check, rework };
});
write(FILES, 'demo/finance_time_sample.csv', csv([['الشخص', 'الإدارة', 'نوع المهمة', 'دقائق دون المساعد', 'دقائق المسودة بالمساعد', 'دقائق التحقق', 'دقائق إعادة العمل'],
  ...demoTiming.map(t => [t.person, t.dept, t.task, t.without, t.draft, t.check, t.rework])]));
write(REF, 'demo_finance.json', json(summariseTiming(demoTiming)));

// ================================================================ lab 2.4
for (const c of D2.cases) write(FILES, `cases/${c.id}.md`, `# ${c.id} · ${c.title}\n\n${c.text}\n`);
write(FILES, 'cases/C2_disbursements.csv', csv([['#', 'النوع', 'المبلغ (ريال)'], ...D2.disbursements.map(([t, a], i) => [i + 1, t, a]),
  [], ['المجموع كما أرسل', '', D2.disbursements.slice(0, D2.SUM_ROWS).reduce((a, [, x]) => a + x, 0)]]));
write(FILES, 'start/agreement_template.md', D2.agreementTemplate);
const total = D2.disbursements.reduce((a, [, x]) => a + x, 0);
const sent = D2.disbursements.slice(0, D2.SUM_ROWS).reduce((a, [, x]) => a + x, 0);
const r24 = { clauses: D2.clauses.map(c => c[0]), cases: Object.fromEntries(D2.cases.map(c => [c.id, c.clause])), c2: { sent, total, missing: total - sent } };
write(REF, 'D2_4_agreement.json', json(r24));
write(SOL, 'D2_4_unit_agreement.md', `# المختبر 2.4 · اتفاق الوحدة (الحل المرجعي)

## الاتفاق

**المالك:** سهام الجريسي، سفيرة الإدارة · **يعتمده:** ضيف الله الرويثي · **المراجعة:** بعد ستة أشهر، وبعد كل حادثة

${D2.clauses.map(([id, name, text], i) => `${i + 1}. **${name}** (${id}): ${text}.`).join('\n')}

## الحالات والبنود

${mdTable(['الحالة', 'ما فشل', 'البند الذي كان سيمنعها'], D2.cases.map(c => [c.id, c.title, `${c.clause} · ${D2.clauses.find(k => k[0] === c.clause)[1]}`]))}
في C2: المجموع المرسل ${sent.toLocaleString('en')} ريال، والصحيح ${total.toLocaleString('en')}، والفرق ${(total - sent).toLocaleString('en')} ريال (الصفان 11 و12).
وC3 يمسّ البند K1 أيضًا، لكن ما كان سيمنعه هو المراجعة الثانية لما يخرج إلى مستفيد (K7).

${D2.returnMessage}`);

// ================================================================ the answer key
write(SOL, 'answer_key.md', `# مفتاح ما زُرع في ملفات ${D1.ORG}

للمدرب. كل ما في الملفات اصطناعي. البذرة ${SEED} لأرقام التجربة في المختبر 2.3.

| المختبر | الملف | المزروع | النتيجة المرجعية |
|---|---|---|---|
| 1.1 | \`start/task_collection.csv\` | بيانات شخصية في T03 وT06 وT07 وT11، ومستند مقيد T01 وسري T07 وT09، وطلبان خارج الدور T05 وT13، ونسخة مكررة T12 | ${Object.entries(r11.counts).map(([k, v]) => `${k} ${v}`).join('، ')}؛ المهام الثلاث ${r11.chosen.map(c => c.id).join(' و')} |
| 1.2 | \`start/weak_plan_legal.md\` | خطة من 50 دقيقة بلا مثال محلول ولا ممارسة دون ذكاء اصطناعي ولا قواعد بيانات، وجمع للمهام بالملفات عبر البريد | تستوفي بندًا واحدًا من عشرة؛ المرجع يستوفي العشرة |
| 1.3 | \`requests/R1.md\` إلى \`R6.md\` | طلب بلا سياق، ورقم خاطئ مع تحقق شكلي، ومادة مختلقة مع تحقق بسؤال المساعد، وبيانات شخصية، وتفويض قرار، وحالة سليمة R5 | خمس مشكلات وحالة سليمة |
| 1.4 | بطاقات الأدوار | المتردد يكتب طلبًا بلا مصدر، والمفرط في الثقة يلصق اسمًا ويقبل أول مخرج | ورقة لكل مشارك؛ أوراق المعايرة: S-A تجتاز، S-B وS-C لا |
| 2.1 | \`start/library_entries.csv\` | مالك ناقص (L02، L06، L09)، وتواريخ ناقصة (L04، L08)، وقاعدة بيانات غير آمنة (L05)، وخطوة تحقق فارغة (L10)، ومراجعة فائتة (L03)، ونسخة (L07) | ${r21.completeBefore.length} مكتملة قبل، ${r21.completeAfter.length} بعد |
| 2.2 | \`library/entry_usage.csv\`، \`entry_tests.md\` | اختبار يخفق في L05 وL09، واستخدام صفري مع مراجعة فائتة في L03 | يُراجَع L05 وL09، ويُسحب L03 وL07 |
| 2.3 | \`pilot/*.csv\` | استجابة للاستبيان أعلى عند المستخدمين الكثيفين، ومبالغة في الجلسات والوقت المعلن، وتحقق وإعادة عمل في عينة التوقيت | جرّب ${r23.everUsedPct}%، منتظم ${r23.regularPct}%، معلن ${r23.selfReportedSaved} دقيقة، صافٍ ${r23.netSaved} |
| 2.4 | \`cases/\` | مرجع مختلق، ومجموع لعشرة صفوف من اثني عشر، ومبلغ خاطئ خرج إلى مستفيد، ومهمة لم تُتفق في محضر | C1 K2، C2 K1، C3 K7، C4 K3؛ الفرق في C2 ${(total - sent).toLocaleString('en')} ريال |
`);

console.log(`wrote ${written} files`);
