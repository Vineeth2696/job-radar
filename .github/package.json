# 🎯 Job Radar — 24/7 Cloud Monitor (GitHub Actions)

Runs entirely on GitHub's free cloud. No local machine. No server. Scans LinkedIn every 5 minutes and emails new frontend job matches directly to you.

---

## ✅ Setup (10 minutes, no local needed)

### Step 1 — Create a GitHub repo

1. Go to → **https://github.com/new**
2. Name it `job-radar`
3. Set to **Private**
4. Click **Create repository**

---

### Step 2 — Upload these files

On your new repo page, click **"uploading an existing file"** link.

Drag & drop ALL the files from this zip:
```
job-radar-cloud/
├── .github/workflows/job-radar.yml   ← must keep this path!
├── src/scan.js
├── src/roles.js
├── seen-jobs.json
├── package.json
└── .gitignore
```

> ⚠️ Make sure `.github/workflows/job-radar.yml` keeps its exact path when uploading.

Click **Commit changes**.

---

### Step 3 — Add your secrets

Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these 4 secrets one by one:

| Secret Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your key from [console.anthropic.com](https://console.anthropic.com) |
| `GMAIL_USER` | `vineethkodanda2696@gmail.com` |
| `GMAIL_APP_PASSWORD` | Your 16-char Gmail App Password (see below) |
| `ALERT_EMAIL` | `vineethkodanda2696@gmail.com` |

---

### Step 4 — Get Gmail App Password

1. Go to → https://myaccount.google.com/security
2. Enable **2-Step Verification**
3. Go to → https://myaccount.google.com/apppasswords
4. App: **Mail**, Device: **Other** → name it "Job Radar"
5. Copy the 16-character password → paste as `GMAIL_APP_PASSWORD` secret

---

### Step 5 — Enable Actions & test

1. Go to your repo → **Actions** tab
2. You may see a prompt "Workflows aren't being run" → click **Enable**
3. Click on **"🎯 Job Radar — 24/7 Frontend Monitor"** workflow
4. Click **"Run workflow"** → **"Run workflow"** (green button)
5. Watch it run — check your inbox within ~2 minutes!

---

## ⏰ Schedule

After setup, GitHub automatically runs this every **5 minutes**, 24/7, for free.

> **Note:** GitHub's free tier gives 2,000 Action minutes/month. Each scan takes ~1 minute → ~8,640 runs/month. GitHub gives **unlimited minutes for public repos**. For a private repo, you may hit limits after ~2,000 runs (~1.4 days). **Solution: make the repo public** (your secrets stay private regardless).

To make repo public: **Settings** → **Danger Zone** → **Change visibility** → **Public**

---

## 📬 What you'll receive

Each email shows:
- 🔥 **HIGH MATCH** — jobs matching Angular, React, TypeScript, NestJS (your core skills)
- ✅ **GOOD MATCH** — jobs matching other skills from your resume
- **Apply →** button per job
- Company, location, posted date, job type

---

## 🎛️ Customize roles

To add/remove roles, edit `src/roles.js` directly on GitHub:
1. Click `src/roles.js` in your repo
2. Click the ✏️ pencil icon
3. Edit `FRONTEND_ROLES` array
4. Click **Commit changes**

---

## 📊 Monitor runs

Go to **Actions** tab in your GitHub repo anytime to see:
- Every scan run (green ✅ or red ❌)
- Logs showing what jobs were found
- How many emails were sent

---

## ❓ Troubleshooting

| Issue | Fix |
|---|---|
| Workflow not running | Actions tab → Enable workflows |
| No emails | Check `GMAIL_APP_PASSWORD` secret — must be App Password |
| "Bad credentials" | Regenerate Gmail App Password |
| No jobs found | Check `ANTHROPIC_API_KEY` secret has credits |
| Private repo minutes running out | Make repo Public (secrets stay private) |
