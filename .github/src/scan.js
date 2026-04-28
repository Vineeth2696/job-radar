const Anthropic = require("@anthropic-ai/sdk");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const { FRONTEND_ROLES, CANDIDATE_SKILLS, HIGH_PRIORITY_KEYWORDS } = require("./roles");

// ── Config ─────────────────────────────────────────────────────────────────
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SEEN_FILE = path.join(__dirname, "../seen-jobs.json");

// Pick 6 random roles each scan so we rotate across all 22
function pickRoles() {
  const shuffled = [...FRONTEND_ROLES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 6);
}

// ── Deduplication ──────────────────────────────────────────────────────────
function loadSeen() {
  try {
    if (fs.existsSync(SEEN_FILE)) {
      return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, "utf8")));
    }
  } catch (_) {}
  return new Set();
}

function saveSeen(seen) {
  const arr = [...seen];
  // Keep only last 1000 to prevent bloat
  fs.writeFileSync(SEEN_FILE, JSON.stringify(arr.slice(-1000)));
}

function makeId(job) {
  return `${job.title}||${job.company}`.toLowerCase().replace(/\s+/g, "-");
}

// ── Fetch jobs via Anthropic + web search ─────────────────────────────────
async function fetchJobs(roles) {
  console.log(`🔍 Searching roles: ${roles.join(", ")}`);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: `You are a job search assistant. Use web search to find REAL, CURRENT job postings from LinkedIn.
Return ONLY a raw JSON array (no markdown, no backticks, no explanation):
[{"title":"...","company":"...","location":"...","posted":"X days ago","type":"Full-time/Remote/etc","url":"...","description":"1-2 sentence summary"}]
Return 5-8 real recent jobs. If none found return [].`,
    messages: [{
      role: "user",
      content: `Search LinkedIn NOW for current job openings for these frontend roles: ${roles.join(", ")}.
No location filter — include remote and all US positions.
Find real postings from the last few days. Return only the JSON array.`
    }],
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    const match = text.replace(/```json|```/g, "").trim().match(/\[[\s\S]*\]/);
    if (!match) return [];
    const jobs = JSON.parse(match[0]);
    return Array.isArray(jobs) ? jobs : [];
  } catch (e) {
    console.warn("⚠️  Could not parse job JSON:", e.message);
    return [];
  }
}

// ── Score jobs by skill match ──────────────────────────────────────────────
function scoreJob(job) {
  const text = `${job.title} ${job.description || ""}`.toLowerCase();
  const priority = HIGH_PRIORITY_KEYWORDS.filter((k) => text.includes(k.toLowerCase())).length;
  const matchedSkills = CANDIDATE_SKILLS.filter((s) => text.includes(s.toLowerCase()));
  return { ...job, priority, matchedSkills };
}

// ── Build HTML email ──────────────────────────────────────────────────────
function buildEmail(jobs) {
  const priorityBadge = (p) =>
    p >= 3 ? `<span style="background:#7c3aed;color:#fff;padding:2px 9px;border-radius:10px;font-size:11px">🔥 HIGH MATCH</span>`
    : p >= 1 ? `<span style="background:#166534;color:#fff;padding:2px 9px;border-radius:10px;font-size:11px">✅ GOOD MATCH</span>`
    : "";

  const rows = jobs.map((j) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:14px 12px;vertical-align:top">
        <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:3px">${j.title}</div>
        <div style="color:#3b82f6;font-size:13px;margin-bottom:5px;font-family:monospace">${j.company}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:6px">${j.description || ""}</div>
        ${j.matchedSkills?.length ? `<div>${j.matchedSkills.map((s) => `<span style="background:#eff6ff;color:#3b82f6;padding:2px 7px;border-radius:4px;font-size:11px;margin-right:3px;font-family:monospace">${s}</span>`).join("")}</div>` : ""}
      </td>
      <td style="padding:14px 12px;vertical-align:top;white-space:nowrap;min-width:130px">
        <div style="font-size:12px;color:#64748b;margin-bottom:3px">📍 ${j.location || "Remote / US"}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:3px">🕐 ${j.posted || "Recently"}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:8px">💼 ${j.type || "Full-time"}</div>
        ${priorityBadge(j.priority || 0)}
      </td>
      <td style="padding:14px 12px;vertical-align:top">
        <a href="${j.url || "https://linkedin.com/jobs"}" style="background:#3b82f6;color:#fff;padding:7px 18px;border-radius:7px;text-decoration:none;font-size:12px;font-weight:700">Apply →</a>
      </td>
    </tr>`).join("");

  const high = jobs.filter((j) => j.priority >= 3).length;
  const good = jobs.filter((j) => j.priority >= 1 && j.priority < 3).length;

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:680px;margin:0 auto;padding:24px">
  <div style="background:linear-gradient(135deg,#3b82f6,#7c3aed);border-radius:14px;padding:26px;text-align:center;margin-bottom:20px">
    <div style="font-size:30px;margin-bottom:6px">🎯</div>
    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">Job Radar Alert</h1>
    <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px">
      ${jobs.length} new frontend job${jobs.length > 1 ? "s" : ""} • ${new Date().toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"})}
    </p>
  </div>
  <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap">
    <span style="background:#f3e8ff;color:#7c3aed;padding:5px 13px;border-radius:20px;font-size:12px;font-weight:700">🔥 ${high} High Match</span>
    <span style="background:#dcfce7;color:#166534;padding:5px 13px;border-radius:20px;font-size:12px;font-weight:700">✅ ${good} Good Match</span>
    <span style="background:#dbeafe;color:#1d4ed8;padding:5px 13px;border-radius:20px;font-size:12px;font-weight:700">💼 ${jobs.length} Total</span>
  </div>
  <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:20px">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Position</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Details</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Link</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div style="text-align:center;color:#94a3b8;font-size:12px">
    Job Radar • GitHub Actions • Running 24/7 for Vineeth Kodanda
  </div>
</div></body></html>`;
}

// ── Send email ────────────────────────────────────────────────────────────
async function sendEmail(jobs) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  const high = jobs.filter((j) => j.priority >= 3).length;
  const subject = high > 0
    ? `🔥 ${high} High-Match Frontend Job${high > 1 ? "s" : ""} Found! (${jobs.length} total)`
    : `🎯 ${jobs.length} New Frontend Job${jobs.length > 1 ? "s" : ""} Found`;

  await transporter.sendMail({
    from: `"Job Radar 🎯" <${process.env.GMAIL_USER}>`,
    to: process.env.ALERT_EMAIL,
    subject,
    html: buildEmail(jobs),
    text: jobs.map((j, i) => `${i + 1}. ${j.title} @ ${j.company}\n   ${j.location} | ${j.posted}\n   ${j.url}`).join("\n\n"),
  });

  console.log(`✅ Email sent: "${subject}"`);
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🎯 Job Radar — ${new Date().toISOString()}`);
  console.log(`📋 Tracking ${FRONTEND_ROLES.length} frontend roles\n`);

  const seen = loadSeen();
  const roles = pickRoles();
  const rawJobs = await fetchJobs(roles);
  console.log(`📦 Fetched ${rawJobs.length} jobs from LinkedIn`);

  const newJobs = rawJobs
    .filter((j) => j.title && j.company)
    .filter((j) => !seen.has(makeId(j)))
    .map(scoreJob)
    .sort((a, b) => b.priority - a.priority);

  if (newJobs.length === 0) {
    console.log("ℹ️  No new jobs this scan — nothing to email");
    // Still update seen list with found jobs to deduplicate next scan
    rawJobs.forEach((j) => seen.add(makeId(j)));
    saveSeen(seen);
    return;
  }

  console.log(`✨ ${newJobs.length} NEW jobs found:`);
  newJobs.forEach((j) => console.log(`   - ${j.title} @ ${j.company} [priority:${j.priority}]`));

  await sendEmail(newJobs);

  newJobs.forEach((j) => seen.add(makeId(j)));
  saveSeen(seen);

  console.log(`\n✅ Done — ${newJobs.length} jobs emailed to ${process.env.ALERT_EMAIL}`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
