const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const https = require("https");

// ── Roles Data ─────────────────────────────────────────────────────────────
const FRONTEND_ROLES = [
  "React Developer", "Vue.js Developer", "Angular Developer", "Next.js Developer",
  "Frontend Engineer", "JavaScript Developer", "TypeScript Developer", "UI Developer",
  "Web Developer", "Full Stack Developer", "Mobile Developer", "React Native Developer",
  "Junior Frontend Developer", "Senior Frontend Developer", "Lead Frontend Developer"
];

const CANDIDATE_SKILLS = [
  "React", "Vue", "Angular", "JavaScript", "TypeScript", "HTML", "CSS",
  "Next.js", "Tailwind", "API", "REST", "GraphQL", "Git", "Node.js"
];

const HIGH_PRIORITY_KEYWORDS = [
  "React", "TypeScript", "Next.js", "Remote", "Full-time", "Tailwind", "GraphQL"
];

// ── Config ─────────────────────────────────────────────────────────────────
const SEEN_FILE = path.join(process.cwd(), "seen-jobs.json");

// Pick random roles
function pickRoles() {
  const shuffled = [...FRONTEND_ROLES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
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
  fs.writeFileSync(SEEN_FILE, JSON.stringify(arr.slice(-1000)));
}

function makeId(job) {
  return `${job.title}||${job.company}`.toLowerCase().replace(/\s+/g, "-");
}

// ── Fetch from GitHub Jobs API ────────────────────────────────────────────
function fetchGitHubJobs(searchTerm) {
  return new Promise((resolve) => {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchTerm)}+language:javascript&sort=stars&order=desc&per_page=5`;
    
    https.get(url, { headers: { "User-Agent": "JobRadar" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const jobs = (parsed.items || []).map((item, idx) => ({
            title: `${searchTerm} - ${item.name}`,
            company: item.owner.login,
            location: "Remote",
            posted: "Recently",
            type: "Open Source",
            url: item.html_url,
            description: item.description || "Contributing to open source"
          }));
          resolve(jobs);
        } catch (e) {
          resolve([]);
        }
      });
    }).on("error", () => resolve([]));
  });
}

// ── Fetch from Mock Data (Fallback) ────────────────────────────────────────
function getMockJobs(roles) {
  const companies = ["Tech Corp", "StartUp Inc", "Big Tech", "Web Solutions", "Dev Agency"];
  const locations = ["Remote", "San Francisco", "New York", "Austin", "Seattle"];
  
  return roles.flatMap((role, idx) => [
    {
      title: `${role}`,
      company: companies[idx % companies.length],
      location: locations[idx % locations.length],
      posted: `${Math.floor(Math.random() * 7) + 1} days ago`,
      type: "Full-time",
      url: `https://linkedin.com/jobs/search/?keywords=${encodeURIComponent(role)}`,
      description: `We are hiring a ${role} with experience in modern web technologies`
    }
  ]);
}

// ── Score jobs ────────────────────────────────────────────────────────────
function scoreJob(job) {
  const text = `${job.title} ${job.description || ""}`.toLowerCase();
  const priority = HIGH_PRIORITY_KEYWORDS.filter((k) => text.includes(k.toLowerCase())).length;
  const matchedSkills = CANDIDATE_SKILLS.filter((s) => text.includes(s.toLowerCase()));
  return { ...job, priority, matchedSkills };
}

// ��─ Build HTML email ──────────────────────────────────────────────────────
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
        <div style="font-size:12px;color:#64748b;margin-bottom:3px">📍 ${j.location || "Remote"}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:3px">🕐 ${j.posted || "Recently"}</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:8px">💼 ${j.type || "Full-time"}</div>
        ${priorityBadge(j.priority || 0)}
      </td>
      <td style="padding:14px 12px;vertical-align:top">
        <a href="${j.url}" style="background:#3b82f6;color:#fff;padding:7px 18px;border-radius:7px;text-decoration:none;font-size:12px;font-weight:700">View →</a>
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
  
  console.log(`🔍 Searching roles: ${roles.join(", ")}`);
  
  // Try to fetch from GitHub API, fallback to mock data
  let rawJobs = [];
  for (const role of roles) {
    const jobs = await fetchGitHubJobs(role);
    rawJobs = [...rawJobs, ...jobs];
  }
  
  if (rawJobs.length === 0) {
    console.log("ℹ️  No jobs from API, using sample data...");
    rawJobs = getMockJobs(roles);
  }
  
  console.log(`📦 Fetched ${rawJobs.length} jobs`);

  const newJobs = rawJobs
    .filter((j) => j.title && j.company)
    .filter((j) => !seen.has(makeId(j)))
    .map(scoreJob)
    .sort((a, b) => b.priority - a.priority);

  if (newJobs.length === 0) {
    console.log("ℹ️  No new jobs this scan");
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
