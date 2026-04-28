/**
 * Job Radar — Cloud Scanner
 * Runs on GitHub Actions every 15 minutes, 24/7.
 * Finds new LinkedIn frontend jobs and emails them to Vineeth.
 */

require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");
const nodemailer = require("nodemailer");
const { FRONTEND_ROLES, CANDIDATE_SKILLS, HIGH_PRIORITY } = require("./roles");
const { filterNew, markSeen } = require("./store");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Rotate role batches across runs ──────────────────────────────────────────
// We pick a batch based on current time so each run covers different roles
function getRoleBatch() {
  const batchSize = 6;
  const buckets = Math.ceil(FRONTEND_ROLES.length / batchSize);
  const bucket = Math.floor(Date.now() / (15 * 60 * 1000)) % buckets;
  const start = bucket * batchSize;
  const batch = FRONTEND_ROLES.slice(start, start + batchSize);
  return batch.length >= 3 ? batch : FRONTEND_ROLES.slice(0, batchSize);
}

// ── Score how well a job matches Vineeth's profile ───────────────────────────
function scoreJob(job) {
  const text = `${job.title} ${job.description || ""}`.toLowerCase();
  const matched = CANDIDATE_SKILLS.filter((s) => text.includes(s.toLowerCase()));
  const priority = HIGH_PRIORITY.filter((k) => text.includes(k.toLowerCase())).length;
  return { ...job, matchedSkills: matched, priority };
}

// ── Fetch jobs via Anthropic + web search ────────────────────────────────────
async function fetchJobs(roles) {
  console.log(`[scan] Searching roles: ${roles.join(", ")}`);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: `You are a job search assistant. Use web search to find REAL, CURRENT job postings from LinkedIn.
Return ONLY a raw JSON array — no markdown, no backticks, no explanation:
[{"title":"...","company":"...","location":"...","posted":"X days ago","type":"Full-time/Remote/Contract","url":"...","description":"1-2 sentence summary"}]
If no results found, return an empty array: []`,
    messages: [
      {
        role: "user",
        content: `Search LinkedIn for CURRENT job postings for these roles: ${roles.join(", ")}.
No location filter — include US remote and on-site positions.
Find 5-8 real, recent job listings posted within the last few days. Return only the JSON array.`,
      },
    ],
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    const cleaned = text.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const jobs = JSON.parse(match[0]);
    return Array.isArray(jobs) ? jobs.map(scoreJob) : [];
  } catch (e) {
    console.warn("[scan] JSON parse failed:", e.message);
    return [];
  }
}

// ── Build HTML email ──────────────────────────────────────────────────────────
function buildEmail(jobs) {
  const high = jobs.filter((j) => j.priority >= 3);
  const subject =
    high.length > 0
      ? `🔥 ${high.length} High-Match Frontend Job${high.length > 1 ? "s" : ""} Found! (${jobs.length} total)`
      : `🎯 ${jobs.length} New Frontend Job${jobs.length > 1 ? "s" : ""} Found`;

  const jobRows = jobs
    .sort((a, b) => b.priority - a.priority)
    .map(
      (j) => `
<tr>
  <td style="padding:16px 12px;border-bottom:1px solid #1e2840;vertical-align:top">
    <div style="font-weight:700;font-size:15px;color:#e2e8f0;margin-bottom:3px">${j.title}</div>
    <div style="color:#4f8ef7;font-size:13px;font-family:monospace;margin-bottom:6px">${j.company}</div>
    <div style="font-size:12px;color:#94a3b8;margin-bottom:8px">${j.description || ""}</div>
    ${
      j.matchedSkills?.length
        ? `<div>${j.matchedSkills.map((s) => `<span style="background:#1e2840;color:#93c5fd;padding:1px 8px;border-radius:3px;font-size:11px;font-family:monospace;margin-right:4px">${s}</span>`).join("")}</div>`
        : ""
    }
  </td>
  <td style="padding:16px 12px;border-bottom:1px solid #1e2840;vertical-align:top;white-space:nowrap;min-width:160px">
    <div style="font-size:12px;color:#64748b;margin-bottom:3px">📍 ${j.location || "Not specified"}</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:3px">🕐 ${j.posted || "Recently"}</div>
    <div style="font-size:12px;color:#64748b;margin-bottom:10px">💼 ${j.type || "Full-time"}</div>
    ${
      j.priority >= 3
        ? `<span style="background:#5b21b6;color:white;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700">🔥 HIGH MATCH</span>`
        : j.priority >= 1
        ? `<span style="background:#14532d;color:#86efac;padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700">✅ GOOD MATCH</span>`
        : ""
    }
  </td>
  <td style="padding:16px 12px;border-bottom:1px solid #1e2840;vertical-align:top">
    <a href="${j.url || "https://www.linkedin.com/jobs/"}" style="background:#4f8ef7;color:white;padding:7px 18px;border-radius:7px;text-decoration:none;font-size:12px;font-weight:700">Apply →</a>
  </td>
</tr>`
    )
    .join("");

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0d14;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:720px;margin:0 auto;padding:28px 20px">
  <div style="background:linear-gradient(135deg,#4f8ef7,#7c3aed);border-radius:14px;padding:28px;text-align:center;margin-bottom:24px">
    <div style="font-size:32px;margin-bottom:8px">🎯</div>
    <h1 style="color:white;margin:0;font-size:22px;font-weight:800">Job Radar Alert</h1>
    <p style="color:rgba(255,255,255,0.75);margin:8px 0 0;font-size:14px">${jobs.length} new frontend job${jobs.length > 1 ? "s" : ""} • ${new Date().toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"})}</p>
  </div>
  <div style="background:#161b2e;border-radius:12px;border:1px solid #1e2840;overflow:hidden;margin-bottom:20px">
    <table style="width:100%;border-collapse:collapse">
      <thead><tr style="background:#0d1117">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:.08em">Position</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:.08em">Details</th>
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:.08em">Link</th>
      </tr></thead>
      <tbody>${jobRows}</tbody>
    </table>
  </div>
  <div style="text-align:center;color:#334155;font-size:12px">Job Radar • GitHub Actions • 24/7 • Built for Vineeth Kodanda</div>
</div></body></html>`;

  return { subject, html };
}

// ── Send email ────────────────────────────────────────────────────────────────
async function sendEmail(jobs) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });

  const { subject, html } = buildEmail(jobs);

  const info = await transporter.sendMail({
    from: `"Job Radar 🎯" <${process.env.GMAIL_USER}>`,
    to: process.env.ALERT_EMAIL,
    subject,
    html,
  });

  console.log(`[email] Sent: ${info.messageId}`);
  console.log(`[email] Subject: ${subject}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = new Date().toISOString();
  console.log(`\n════════════════════════════════════════`);
  console.log(`  🎯 Job Radar Scan — ${startedAt}`);
  console.log(`════════════════════════════════════════`);

  const roles = getRoleBatch();
  console.log(`[scan] Role batch (${roles.length}): ${roles.join(", ")}`);

  // Fetch
  const allJobs = await fetchJobs(roles);
  console.log(`[scan] Raw jobs returned: ${allJobs.length}`);

  if (allJobs.length === 0) {
    console.log("[scan] No jobs found this run — exiting");
    return;
  }

  // Deduplicate
  const newJobs = filterNew(allJobs);
  console.log(`[scan] New jobs (not seen before): ${newJobs.length}`);

  if (newJobs.length === 0) {
    console.log("[scan] All jobs already seen — no email needed");
    markSeen(allJobs); // still update cache
    return;
  }

  // Email
  await sendEmail(newJobs);
  markSeen(newJobs);

  console.log(`\n✓ Done — ${newJobs.length} new job(s) emailed to ${process.env.ALERT_EMAIL}`);
  console.log(`════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error("[fatal]", err.message);
  console.error(err.stack);
  process.exit(1);
});
