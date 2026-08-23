#!/usr/bin/env mjs
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';

// Determine Vault Path
const DEFAULT_VAULT_PATH = '/Users/johhn/Library/Mobile Documents/iCloud~md~obsidian/Documents/Smartflow';
const vaultPath = process.env.OBSIDIAN_VAULT_PATH || DEFAULT_VAULT_PATH;

function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`🧠 SMARTFLOW SECOND BRAIN: ${title}`);
  console.log('='.repeat(60));
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// Helper to audit migration files for RLS settings
function auditRLSMigrations() {
  const migrationsDir = './supabase/migrations';
  if (!fs.existsSync(migrationsDir)) {
    return { error: 'Migrations directory not found' };
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  const createdTables = new Set();
  const rlsEnabledTables = new Set();

  files.forEach(file => {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    // Match CREATE TABLE public.name or CREATE TABLE name (handling IF NOT EXISTS)
    const createTableRegex = /create table\s+(?:if not exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi;
    let match;
    while ((match = createTableRegex.exec(content)) !== null) {
      createdTables.add(match[1].toLowerCase());
    }

    // Match ALTER TABLE public.name ENABLE ROW LEVEL SECURITY
    const alterRlsRegex = /alter table\s+(?:public\.)?([a-zA-Z0-9_]+)\s+enable\s+row\s+level\s+security/gi;
    let rlsMatch;
    while ((rlsMatch = alterRlsRegex.exec(content)) !== null) {
      rlsEnabledTables.add(rlsMatch[1].toLowerCase());
    }
  });

  const missingRLS = [];
  createdTables.forEach(table => {
    // Exclude views or specific tables if needed, but flag general ones
    if (!rlsEnabledTables.has(table)) {
      missingRLS.push(table);
    }
  });

  return {
    totalCreated: createdTables.size,
    rlsEnabledCount: rlsEnabledTables.size,
    missingRLS: missingRLS
  };
}

// Commands
async function handleStart() {
  printHeader('SESSION START');
  
  const statusFile = path.join(vaultPath, 'wiki/status.md');
  if (!fs.existsSync(statusFile)) {
    console.error(`❌ Status file not found at: ${statusFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(statusFile, 'utf8');
  
  // Extract frontmatter and Current section
  const lines = content.split('\n');
  let inFrontmatter = false;
  let frontmatter = '';
  let currentSection = [];
  let capturingCurrent = false;

  for (const line of lines) {
    if (line.trim() === '---') {
      if (!inFrontmatter && frontmatter === '') {
        inFrontmatter = true;
        continue;
      } else if (inFrontmatter) {
        inFrontmatter = false;
        continue;
      }
    }
    if (inFrontmatter) {
      frontmatter += line + '\n';
      continue;
    }

    if (line.startsWith('## Current')) {
      capturingCurrent = true;
      currentSection.push(line);
      continue;
    } else if (line.startsWith('## Previous') || line.startsWith('---') && capturingCurrent && currentSection.length > 5) {
      if (line.startsWith('## Previous')) {
        break; // Stop at previous sessions
      }
    }

    if (capturingCurrent) {
      currentSection.push(line);
    }
  }

  console.log(`\n📅 Frontmatter:\n${frontmatter.trim()}`);
  console.log(`\n📌 Current Status:\n${currentSection.join('\n').trim()}`);

  // Git status check
  try {
    const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    const gitChanges = execSync('git status --short', { encoding: 'utf8' }).trim();
    console.log(`\n🌿 Git Branch: ${gitBranch}`);
    if (gitChanges) {
      console.log(`⚠️ Uncommitted changes:\n${gitChanges}`);
    } else {
      console.log('✅ Git working tree clean.');
    }
  } catch (err) {
    console.log('⚠️ Could not fetch git status.');
  }
  
  console.log('\n🚀 PROTOCOL: Announce your plan and start coding!');
}

async function updateVaultStatus(summary) {
  const statusFile = path.join(vaultPath, 'wiki/status.md');
  const logFile = path.join(vaultPath, 'log.md');

  if (!fs.existsSync(statusFile) || !fs.existsSync(logFile)) {
    console.error('❌ Status or Log files missing from vault.');
    process.exit(1);
  }

  const today = getTodayDate();
  let statusContent = fs.readFileSync(statusFile, 'utf8');

  // Update frontmatter date
  statusContent = statusContent.replace(/updated: \d{4}-\d{2}-\d{2}/, `updated: ${today}`);

  // Find the Current section and convert it to Previous
  const currentRegex = /(## Current \(\d{4}-\d{2}-\d{2}\)[^]*?)(?=## Previous|---|$)/;
  const match = statusContent.match(currentRegex);

  if (match) {
    const oldCurrent = match[1].trim();
    // Convert to Previous
    const previousHeader = oldCurrent.replace('## Current', '## Previous');
    
    // Create new Current section
    const newCurrent = `## Current (${today}) — Session Update

**Summary of last session:**
* ${summary}

### Next Actions
- [ ] Continue task implementation
- [ ] Verify the next phase

`;

    // Insert new Current, and push the old current down to previous
    statusContent = statusContent.replace(oldCurrent, `${newCurrent}\n---\n\n${previousHeader}\n`);
  } else {
    console.warn('⚠️ Could not parse "## Current" section cleanly. Appending new updates.');
  }

  // Write status
  fs.writeFileSync(statusFile, statusContent, 'utf8');
  console.log(`✅ Updated ${statusFile}`);

  // Append to log.md
  let logContent = fs.readFileSync(logFile, 'utf8');
  const logEntry = `## [${today}] session | ${summary}\n`;
  
  if (logContent.includes('## Session History')) {
    logContent = logContent.replace('## Session History', `## Session History\n\n${logEntry}`);
  } else {
    logContent += `\n${logEntry}`;
  }
  fs.writeFileSync(logFile, logContent, 'utf8');
  console.log(`✅ Appended to ${logFile}`);
}

async function handleEnd(summaryInput) {
  printHeader('SESSION END');

  let summary = summaryInput;
  if (!summary) {
    const arg = process.argv.slice(3).join(' ');
    if (arg) {
      summary = arg;
    }
  }

  if (!summary) {
    console.log('Please provide a session summary via argument or standard input:');
    summary = await new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question('Summary of changes: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  if (!summary) {
    console.error('❌ Summary is required to end the session.');
    process.exit(1);
  }

  await updateVaultStatus(summary);

  // Git operations
  try {
    console.log('\n📤 Pushing updates to GitHub...');
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "Second Brain: session | ${summary}"`, { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    console.log('✅ Successfully committed and pushed to GitHub.');
  } catch (err) {
    console.log('⚠️ Git push failed or nothing to commit. Make sure to push manually.');
  }
}

async function handleSyncCommit() {
  printHeader('SYNC COMMIT TO VAULT');
  try {
    const lastCommitMsg = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
    if (!lastCommitMsg) {
      console.error('❌ No commit message found.');
      process.exit(1);
    }
    console.log(`💬 Last commit message: "${lastCommitMsg}"`);
    await updateVaultStatus(`Git Commit: ${lastCommitMsg}`);
    console.log('✅ Vault updated automatically based on git commit.');
  } catch (err) {
    console.error('❌ Failed to sync commit to vault:', err.message);
  }
}

async function handleLint() {
  printHeader('WIKI LINT & HEALTH REPORT');
  
  let brokenLinks = 0;
  let totalLinks = 0;
  let outdatedFiles = 0;
  const brokenLinkList = [];
  const outdatedFileList = [];
  // status.md is read at the start of every session, so its size is a real cost,
  // not a tidiness concern. It reached 109 KB / 39 sections before anyone noticed
  // — the Current section was buried under four months of history.
  const OVERSIZE_BYTES = 20000;
  const oversizeList = [];

  const readDirRecursive = (dir) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      file = path.join(dir, file);
      const stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        results = results.concat(readDirRecursive(file));
      } else {
        if (file.endsWith('.md') && !file.endsWith('wiki/health.md')) results.push(file);
      }
    });
    return results;
  };

  const allMdFiles = readDirRecursive(vaultPath);
  console.log(`Checking ${allMdFiles.length} files in the vault...\n`);

  allMdFiles.forEach((filePath) => {
    const relativePath = path.relative(vaultPath, filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    // Flag files that have grown past the point of being readable in one sitting
    // Archives are supposed to be big — that is the point of moving history there.
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > OVERSIZE_BYTES && !relativePath.includes('archive/')) {
      oversizeList.push({ path: relativePath, kb: (bytes / 1024).toFixed(1) });
    }

    // Check frontmatter date age
    const match = content.match(/updated: (\d{4}-\d{2}-\d{2})/);
    if (match) {
      const updatedDate = new Date(match[1]);
      const ageInDays = (new Date() - updatedDate) / (1000 * 60 * 60 * 24);
      if (ageInDays > 14) {
        outdatedFileList.push({ path: relativePath, date: match[1] });
        outdatedFiles++;
      }
    }

    // Check for broken links — strip inline code first to avoid false positives
    const strippedContent = content.replace(/`[^`\n]+`/g, ''); // remove `inline code`
    const linkRegex = /\[\[(.*?)(?:\|.*?)?\]\]/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(strippedContent)) !== null) {
      totalLinks++;
      const rawTarget = linkMatch[1];
      // Normalize: strip .md suffix if present (so [[CLAUDE.md]] and [[CLAUDE]] both resolve)
      const linkTarget = rawTarget.replace(/\.md$/i, '');
      const targetPaths = [
        path.join(vaultPath, `${linkTarget}.md`),
        path.join(vaultPath, `wiki/${linkTarget}.md`),
      ];

      const exists = targetPaths.some(p => fs.existsSync(p));
      if (!exists) {
        brokenLinkList.push({ file: relativePath, target: rawTarget });
        brokenLinks++;
      }
    }
  });

  // Dynamic RLS Audit
  const rlsReport = auditRLSMigrations();

  // Create Autonomous Health Report
  const healthFile = path.join(vaultPath, 'wiki/health.md');
  const today = getTodayDate();
  
  let healthMd = `---
type: health
updated: ${today}
---
# 🧠 Second Brain Health Report

*This report is generated automatically by the background health daemon.*

## 📊 Summary Metrics
*   **Last Updated:** ${today}
*   **Total Wiki Files Checked:** ${allMdFiles.length}
*   **Total Vault Links Checked:** ${totalLinks}
*   **Broken Links:** ${brokenLinks === 0 ? '🟢 None' : `🔴 ${brokenLinks}`}
*   **Outdated Pages (>2 weeks old):** ${outdatedFiles === 0 ? '🟢 None' : `🟡 ${outdatedFiles}`}
*   **Oversized Pages (>20 KB):** ${oversizeList.length === 0 ? '🟢 None' : `🟠 ${oversizeList.length}`}

---

## ❌ Broken Links
${brokenLinks === 0 ? '_No broken links found._' : brokenLinkList.map(item => `*   In \`[[${item.file}]]\`: links to nonexistent \`[[${item.target}]]\``).join('\n')}

---

## ⏳ Outdated Wiki Pages
${outdatedFiles === 0 ? '_All pages up to date._' : outdatedFileList.map(item => `*   \`${item.path}\` (last updated: ${item.date})`).join('\n')}

---

## 📦 Oversized Pages
_Read at session start, so size is a context cost. Archive history out of these._
${oversizeList.length === 0 ? '_All pages a reasonable size._' : oversizeList.map(item => `*   \`${item.path}\` — **${item.kb} KB** ⚠️`).join('\n')}

---

## 🔒 Database Security Audit (RLS)
*   **RLS-Enabled Tables:** ${rlsReport.rlsEnabledCount}
*   **Total Created Tables (Migration Scan):** ${rlsReport.totalCreated}
*   **Tables Missing RLS (Static Warning):**
${rlsReport.missingRLS && rlsReport.missingRLS.length > 0 
  ? rlsReport.missingRLS.map(t => `    *   \`${t}\` ⚠️`).join('\n')
  : '    *   🟢 All tables have RLS config statements.'}
`;

  fs.writeFileSync(healthFile, healthMd, 'utf8');
  console.log(`✅ Autonomous Health Report written to: ${healthFile}`);

  console.log('\n' + '-'.repeat(40));
  console.log(`Scan complete:
🔗 Total links verified: ${totalLinks}
❌ Broken links found: ${brokenLinks}
⏳ Outdated pages: ${outdatedFiles}
🔒 RLS Warnings flagged: ${rlsReport.missingRLS ? rlsReport.missingRLS.length : 0}`);
}

async function handleStatus() {
  printHeader('HEALTH STATUS');

  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    console.log(`🌿 Current codebase branch: ${branch}`);
  } catch (err) {}

  const rlsReport = auditRLSMigrations();
  console.log('\n🔒 RLS Table Warning Audit (from migration scan):');
  if (rlsReport.missingRLS && rlsReport.missingRLS.length > 0) {
    rlsReport.missingRLS.forEach(t => console.log(`  - ⚠️ ${t} (RLS Disabled/Missing config)`));
  } else {
    console.log('  - 🟢 All tables have RLS enabled.');
  }

  const indexFile = path.join(vaultPath, 'index.md');
  if (fs.existsSync(indexFile)) {
    console.log(`\n📚 Second brain index found at: ${indexFile}`);
  } else {
    console.log(`\n❌ Second brain index missing at: ${indexFile}`);
  }
}

// CLI Router
const cmd = process.argv[2];
if (cmd === 'start') {
  handleStart();
} else if (cmd === 'end') {
  handleEnd();
} else if (cmd === 'sync-commit') {
  handleSyncCommit();
} else if (cmd === 'lint') {
  handleLint();
} else if (cmd === 'status') {
  handleStatus();
} else {
  console.log(`Usage: node scripts/brain.mjs [start|end|sync-commit|lint|status]`);
}
