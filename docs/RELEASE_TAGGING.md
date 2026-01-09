# Release Tagging Guide

**Purpose**: Tag and release v0.1-demo for production deployment  
**Audience**: You (the developer/operator)  
**Version**: v0.1-demo

---

## Pre-Flight Checks

Before creating a release tag, verify the codebase is in good state.

### 1. Frontend Build Verification

**Command** (from workspace root):
```powershell
Push-Location frontend
npm run build
Pop-Location
```

**Expected Output**:
```
vite v5.4.21 building for production...
✓ 1234 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.28 kB
dist/assets/index-abc123.css    245.67 kB │ gzip: 34.12 kB
dist/assets/index-xyz789.js     844.23 kB │ gzip: 267.89 kB
✓ built in 12.34s
```

**Check**:
- [ ] Build completes without errors
- [ ] No TypeScript compilation errors
- [ ] dist/ directory created with index.html and assets
- [ ] Bundle size reasonable (~800-900 KB JS, ~250 KB CSS)

**Troubleshooting**:
If build fails:
```powershell
# Clean and rebuild
cd frontend
Remove-Item -Recurse -Force node_modules, dist
npm install
npm run build
```

---

### 2. Backend Syntax Validation

**Command** (from workspace root):
```powershell
Push-Location backend
python -m compileall app workflow src -q
if ($LASTEXITCODE -eq 0) {
    Write-Output "`n✓ Python syntax validation passed"
} else {
    Write-Output "`n✗ Syntax errors found"
}
Pop-Location
```

**Expected Output**:
```
✓ Python syntax validation passed
```

**Check**:
- [ ] No syntax errors in app/, workflow/, src/
- [ ] Exit code 0 (success)

**Troubleshooting**:
If syntax errors found:
```powershell
# Run without -q to see details
cd backend
python -m compileall app workflow src
```

---

### 3. Backend Unit Tests (Optional)

**Command** (from workspace root):
```powershell
Push-Location backend
.venv\Scripts\python -m pytest
Pop-Location
```

**Expected Output**:
```
======================== test session starts ========================
collected 20 items

tests/test_csf_hospital.py ............                      [ 60%]
tests/test_csf_practitioner.py ....                          [ 80%]
tests/test_license_ohio_tddd.py ....                         [100%]

======================== 20 passed in 5.23s =========================
```

**Check**:
- [ ] All tests pass (or expected failures documented)
- [ ] No critical test failures

---

### 4. Docker Compose Verification (If Available)

**Command** (from workspace root):
```powershell
# Check if docker-compose.yml exists
if (Test-Path docker-compose.yml) {
    Write-Output "Docker Compose found, testing..."
    docker compose up -d
    Start-Sleep -Seconds 10
    
    # Check health
    curl http://localhost:8001/health
    
    # Cleanup
    docker compose down
} else {
    Write-Output "No docker-compose.yml - skipping"
}
```

**Expected**:
- [ ] Containers start successfully
- [ ] Backend health check returns 200 OK
- [ ] No container errors in logs

**Note**: Docker Compose is optional for this project (uses local dev mode).

---

### 5. Manual Smoke Test (Recommended)

**Local Dev Mode**:

1. Start backend:
   ```powershell
   cd backend
   .venv\Scripts\python -m uvicorn src.api.main:app --reload --host 127.0.0.1 --port 8001
   ```

2. Start frontend (new terminal):
   ```powershell
   cd frontend
   npm run dev
   ```

3. Test in browser:
   - [ ] Home page loads: http://localhost:5173
   - [ ] Console loads: http://localhost:5173/console
   - [ ] CSF page loads: http://localhost:5173/csf
   - [ ] Submit one Hospital CSF form → get decision
   - [ ] Backend health: http://localhost:8001/health

4. Stop servers (Ctrl+C in both terminals)

---

## Release Process

### 1. Check Git Status

**Command**:
```bash
git status
```

**Expected**:
- Shows modified files (RELEASE_NOTES.md, VERSION, etc.)
- Shows untracked files (new docs, if any)

**Review**:
- [ ] All desired changes are present
- [ ] No unexpected modifications
- [ ] No sensitive data (API keys, passwords, etc.)

---

### 2. Stage All Changes

**Command**:
```bash
git add -A
```

**What it does**:
- Stages all modified files
- Stages all new files
- Stages deletions

**Verify**:
```bash
git status
```

Should show files in "Changes to be committed" (green).

---

### 3. Commit Release

**Command**:
```bash
git commit -m "Release v0.1-demo: hosted deploy + release notes"
```

**Commit Message Convention**:
```
Release v0.1-demo: hosted deploy + release notes

- Add RELEASE_NOTES.md with feature summary and deployment guide
- Add VERSION file (v0.1-demo)
- Add recruiter-safe hosting implementation
- Add admin access documentation (private)
- Add operator guide (private)
- Add hosted smoke test checklist
- Harden CORS for production deployment
- Add backend admin endpoint authentication
- Gate demo content behind admin mode
```

**Verify**:
```bash
git log -1
```

Should show your commit message.

---

### 4. Create Git Tag

**Command**:
```bash
git tag v0.1-demo
```

**Tag Naming**:
- Format: `v<major>.<minor>-<label>`
- Example: `v0.1-demo` (demo/portfolio release)
- Future: `v0.2-beta`, `v1.0.0` (production release)

**Verify Tag Created**:
```bash
git tag -l
```

Should show `v0.1-demo` in list.

**View Tag Details**:
```bash
git show v0.1-demo
```

---

### 5. Push to Remote

**Command**:
```bash
git push origin main --tags
```

**What it does**:
- Pushes commits to `main` branch
- Pushes all tags (including new `v0.1-demo`)

**Flags**:
- `origin` - Remote repository name (usually GitHub)
- `main` - Branch name
- `--tags` - Include all tags in push

**Expected Output**:
```
Enumerating objects: 15, done.
Counting objects: 100% (15/15), done.
Delta compression using up to 8 threads
Compressing objects: 100% (10/10), done.
Writing objects: 100% (10/10), 1.23 KiB | 1.23 MiB/s, done.
Total 10 (delta 5), reused 0 (delta 0), pack-reused 0
To https://github.com/yourusername/AutoComply-AI-fresh.git
   abc1234..def5678  main -> main
 * [new tag]         v0.1-demo -> v0.1-demo
```

**Check**:
- [ ] Commits pushed successfully
- [ ] Tag pushed successfully (`[new tag] v0.1-demo`)

---

### 6. Verify on GitHub

**Steps**:
1. Visit your GitHub repository
2. Check "Releases" tab or "Tags" tab
3. Verify `v0.1-demo` tag is visible
4. Click tag to see tagged commit

**Optional - Create GitHub Release**:
1. Go to "Releases" → "Draft a new release"
2. Choose tag: `v0.1-demo`
3. Release title: `AutoComply AI v0.1-demo`
4. Description: Copy from RELEASE_NOTES.md (summary section)
5. Attach: None (or optional screenshots)
6. Mark as: "Pre-release" (since it's demo, not production)
7. Click "Publish release"

---

## Post-Release Actions

### Update Deployment

If already deployed to Render/Vercel/Netlify:

**Render.com**:
1. Go to Render dashboard
2. Select your backend service
3. Click "Manual Deploy" → "Deploy latest commit"
4. Select your frontend static site
5. Click "Manual Deploy" → "Deploy latest commit"

**Vercel/Netlify**:
- Automatic deployment should trigger on push to `main`
- Check deployment logs for success

### Verify Deployment

Run hosted smoke test (see docs/HOSTED_SMOKE_TEST.md):
```bash
# Backend health
curl https://your-backend.onrender.com/health

# Frontend pages
# Visit: https://your-frontend.onrender.com
# Visit: https://your-frontend.onrender.com/console
# Visit: https://your-frontend.onrender.com/csf
```

---

## Rollback (If Needed)

### Undo Last Commit (Not Pushed)

```bash
# Undo commit, keep changes staged
git reset --soft HEAD~1

# Undo commit and staging, keep changes in working directory
git reset HEAD~1

# Undo commit and discard changes (DANGEROUS)
git reset --hard HEAD~1
```

### Delete Tag (Not Pushed)

```bash
# Delete local tag
git tag -d v0.1-demo
```

### Delete Tag (Already Pushed)

```bash
# Delete remote tag
git push origin :refs/tags/v0.1-demo

# Delete local tag
git tag -d v0.1-demo
```

### Revert to Previous Version

```bash
# Find previous tag
git tag -l

# Checkout previous tag
git checkout v0.0.9

# Or revert specific commit
git revert <commit-hash>
```

---

## Future Release Process

### Semantic Versioning

For production releases, use semantic versioning:

- **v1.0.0** - Major release (breaking changes)
- **v1.1.0** - Minor release (new features, backwards compatible)
- **v1.1.1** - Patch release (bug fixes only)

### Release Branches

For larger teams:
```bash
# Create release branch
git checkout -b release/v0.2-beta

# Make release prep commits
git commit -m "Bump version to v0.2-beta"

# Merge to main
git checkout main
git merge release/v0.2-beta

# Tag and push
git tag v0.2-beta
git push origin main --tags
```

### Automated Releases

Consider GitHub Actions for CI/CD:
```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build frontend
        run: cd frontend && npm install && npm run build
      - name: Test backend
        run: cd backend && python -m pytest
      - name: Create GitHub Release
        uses: actions/create-release@v1
```

---

## Checklist Summary

**Pre-Flight**:
- [ ] Frontend builds successfully (`npm run build`)
- [ ] Backend syntax valid (`python -m compileall`)
- [ ] Manual smoke test passes (local dev mode)
- [ ] All desired changes committed

**Release**:
- [ ] `git status` - Review changes
- [ ] `git add -A` - Stage all changes
- [ ] `git commit -m "Release v0.1-demo: ..."` - Commit
- [ ] `git tag v0.1-demo` - Create tag
- [ ] `git push origin main --tags` - Push to GitHub

**Post-Release**:
- [ ] Verify tag on GitHub
- [ ] Create GitHub Release (optional)
- [ ] Deploy to hosting platform
- [ ] Run hosted smoke test
- [ ] Update README with production URLs (if needed)

---

**Status**: Ready to tag v0.1-demo  
**Next Tag**: v0.2-beta (with PostgreSQL, JWT auth)

---

*AutoComply AI - Release Tagging Guide*  
*Last Updated: January 8, 2026*
