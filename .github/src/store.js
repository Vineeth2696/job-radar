const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../data");
const SEEN_PATH = path.join(DATA_DIR, "seen.json");
const MAX_IDS = 800;

let seen = new Set();

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(SEEN_PATH)) {
      const ids = JSON.parse(fs.readFileSync(SEEN_PATH, "utf8"));
      seen = new Set(ids);
      console.log(`[store] Loaded ${seen.size} previously seen jobs`);
    } else {
      console.log("[store] No cache found — first run");
    }
  } catch (e) {
    console.warn("[store] Load failed:", e.message);
  }
}

function save() {
  try {
    let ids = Array.from(seen);
    if (ids.length > MAX_IDS) ids = ids.slice(-MAX_IDS);
    fs.writeFileSync(SEEN_PATH, JSON.stringify(ids, null, 2));
    console.log(`[store] Saved ${ids.length} seen job IDs`);
  } catch (e) {
    console.warn("[store] Save failed:", e.message);
  }
}

function makeId(job) {
  return `${job.title}||${job.company}`.toLowerCase().replace(/\s+/g, "-");
}

function filterNew(jobs) {
  return jobs.filter((j) => !seen.has(makeId(j)));
}

function markSeen(jobs) {
  jobs.forEach((j) => seen.add(makeId(j)));
  save();
}

load();
module.exports = { filterNew, markSeen };
