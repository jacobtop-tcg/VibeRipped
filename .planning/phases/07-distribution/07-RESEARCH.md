# Phase 7: Distribution - Research

**Researched:** 2026-02-09
**Domain:** npm package publishing and CLI distribution
**Confidence:** HIGH

## Summary

npm package publishing is a well-established, mature workflow with clear best practices and minimal platform-specific gotchas. VibeRipped's current structure already has the critical components in place: proper `package.json` with `bin` field, correct shebang (`#!/usr/bin/env node`), and executable permissions on the bin script. The main work involves enriching package metadata, creating comprehensive documentation, and setting up distribution hygiene (`.gitignore` updates, `files` field, LICENSE).

The npm ecosystem handles cross-platform bin script installation automatically—npm creates appropriate symlinks on Unix systems and `.cmd` wrappers on Windows when the shebang is present. Version 0.1.0 suggests this is a pre-release ready to become 1.0.0 on distribution.

**Primary recommendation:** Use `files` field in package.json (whitelist approach) rather than `.npmignore` for strictest control over published package contents. Test with `npm pack --dry-run` before actual publish.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| npm | 8+ | Package manager and registry | Universal Node.js package distribution, 2M+ packages |
| semantic versioning | 2.0.0 | Version numbering scheme | Required by npm ecosystem, MAJOR.MINOR.PATCH convention |
| shields.io | Current | README badges | De facto standard for npm package badges (version, downloads, license) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| markdown | CommonMark | README formatting | Required for npm.js website rendering and GitHub |
| asciinema + agg | Current | Terminal recording to animated GIF | Optional: visual CLI demo for README |
| npm pack | Built-in | Package testing | Pre-publish validation—always use before first publish |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| npm | Yarn/pnpm for personal dev | npm required for publishing to npmjs.com |
| shields.io badges | Custom badges | Shields.io is ecosystem standard, auto-updates |
| `files` field | `.npmignore` | `.npmignore` is blacklist (easier to leak files), `files` is whitelist (safer) |

**Installation:**
No additional dependencies required—npm is bundled with Node.js. Package already uses Commander.js and write-file-atomic.

## Architecture Patterns

### Recommended package.json Structure
```json
{
  "name": "viberipped",
  "version": "1.0.0",
  "description": "Deterministic micro-exercise rotation engine for Claude Code",
  "main": "engine.js",
  "type": "commonjs",
  "bin": {
    "vibripped": "./bin/vibripped.js"
  },
  "files": [
    "bin/",
    "lib/",
    "engine.js",
    "statusline.js",
    "statusline-orchestrator.sh",
    "LICENSE",
    "README.md"
  ],
  "scripts": {
    "test": "node --test",
    "prepublishOnly": "npm test"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/username/viberipped.git"
  },
  "homepage": "https://github.com/username/viberipped",
  "bugs": {
    "url": "https://github.com/username/viberipped/issues"
  },
  "keywords": [
    "exercise",
    "rotation",
    "productivity",
    "claude-code",
    "cli",
    "fitness",
    "micro-breaks"
  ],
  "author": "Author Name <email@example.com>",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "commander": "^14.0.3",
    "write-file-atomic": "^7.0.0"
  }
}
```

### Pattern 1: Bin Script Executable Setup
**What:** Node.js CLI scripts require shebang and executable permissions
**When to use:** Every npm package with `bin` field

**Already correct in VibeRipped:**
```bash
# Source: https://exploringjs.com/nodejs-shell-scripting/ch_creating-shell-scripts.html
# bin/vibripped.js has:
#!/usr/bin/env node
# And permissions: -rwxr-xr-x

# npm automatically:
# - Creates symlink to bin script in global install location
# - Creates .cmd wrapper for Windows compatibility
# - Preserves executable permissions from published package
```

### Pattern 2: README Structure for CLI Tools
**What:** Standard sections users expect in npm CLI package README
**When to use:** All published CLI tools

**Structure:**
```markdown
# Package Name

[Badges: version, downloads, license, test status]

One-sentence description.

## Features
- Bullet list of key capabilities

## Installation
npm install -g package-name

## Quick Start
# Minimal example to get started

## Usage
### Command 1
Description and examples

### Command 2
Description and examples

## Configuration
File locations, environment variables, config format

## CLI Reference
Full command documentation (or link to wiki/docs)

## Demo
[Animated GIF or asciinema recording]

## Contributing
Link to CONTRIBUTING.md or brief guidelines

## License
MIT © [Year] [Author]
```

### Pattern 3: Pre-publish Validation Workflow
**What:** Test package contents before publishing
**When to use:** Every publish, especially first publish
**Example:**
```bash
# Source: https://docs.npmjs.com/cli/v11/commands/npm-publish/
# 1. Validate package contents
npm pack --dry-run

# 2. Create tarball and inspect
npm pack
tar -tzf viberipped-1.0.0.tgz

# 3. Test local installation in separate directory
mkdir /tmp/test-install && cd /tmp/test-install
npm install /path/to/viberipped-1.0.0.tgz
vibripped --help

# 4. Clean up
rm viberipped-1.0.0.tgz
```

### Pattern 4: Semantic Versioning Bump Workflow
**What:** Update version, tag, and publish in sequence
**When to use:** Every release
**Example:**
```bash
# Source: https://docs.npmjs.com/about-semantic-versioning/
# For v1.0.0 initial release
npm version 1.0.0 -m "Release v%s"

# For subsequent releases:
npm version patch  # 1.0.0 -> 1.0.1 (bug fixes)
npm version minor  # 1.0.0 -> 1.1.0 (new features, backward compatible)
npm version major  # 1.0.0 -> 2.0.0 (breaking changes)

# npm version automatically:
# - Updates package.json version
# - Creates git commit
# - Creates git tag

# Then:
npm publish
git push && git push --tags
```

### Anti-Patterns to Avoid
- **Using `.npmignore` instead of `files` field:** Blacklist approach is error-prone—easy to accidentally publish test files, .env, or other sensitive content
- **Forgetting repository/bugs/homepage fields:** npm.js website shows these prominently; omitting them looks unprofessional
- **Publishing without testing:** `npm pack` dry-run is cheap insurance against broken installs
- **Hardcoding absolute paths in bin scripts:** Use `path.join(__dirname, '../lib/...')` for portability
- **Using `prepublish` lifecycle script:** Deprecated and confusing—use `prepublishOnly` for pre-publish checks or `prepare` for build steps

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| README badges | Custom SVG badge generation | shields.io API | Auto-updates, caching, 500+ integrations, ecosystem standard |
| Version bumping | Manual package.json editing | `npm version` command | Atomic commit+tag, prevents mistakes, follows git best practices |
| Package content filtering | Manual file copying before publish | `files` field in package.json | npm handles it, respects .gitignore properly, less error-prone |
| Terminal demo recording | Screenshot stitching | asciinema + agg | Scriptable, reproducible, professional appearance |
| CLI argument parsing | Custom argv parsing | Already using Commander.js | (Already correct) |
| Cross-platform bin scripts | Platform detection in JS | Shebang + npm's automatic handling | (Already correct) |

**Key insight:** npm's publishing pipeline is battle-tested—use its built-in features rather than inventing workarounds. The `files` field, `npm version`, and `npm pack --dry-run` prevent 99% of first-time publishing problems.

## Common Pitfalls

### Pitfall 1: Publishing Unwanted Files
**What goes wrong:** Test fixtures, .env files, coverage reports, or development artifacts leak into published package, bloating download size or exposing secrets.

**Why it happens:** Relying on `.gitignore` or `.npmignore` (blacklist approach) rather than explicit `files` field (whitelist approach). Default npm behavior includes everything not in `.gitignore`.

**How to avoid:**
- Use `files` field in package.json to explicitly list what to include
- Always run `npm pack --dry-run` to preview package contents before first publish
- Check tarball contents: `tar -tzf package-name-version.tgz`

**Warning signs:**
- Package size unexpectedly large (check on npmjs.com after publish)
- `npm pack` output shows unexpected files
- Users report missing dependencies because devDependencies were published instead of dependencies

**Sources:**
- [npm developers docs](https://docs.npmjs.com/cli/v9/using-npm/developers/)
- [Expertly Ignoring Files from Your npm Package](https://www.bomberbot.com/npm/expertly-ignoring-files-from-your-npm-package/)

### Pitfall 2: Broken Global Install Due to Incorrect Dependencies
**What goes wrong:** After `npm install -g`, command fails with "Cannot find module" errors for packages listed in `devDependencies` rather than `dependencies`.

**Why it happens:** Global installs do NOT install devDependencies. If runtime code requires a package only listed as devDependency, global install breaks.

**How to avoid:**
- Ensure all runtime imports are in `dependencies`
- Use `devDependencies` only for test runners, linters, build tools
- Test global install: `npm link` in development directory, then run command
- Better: Test in clean environment: `npm pack && npm install -g ./package-name-1.0.0.tgz`

**Warning signs:**
- Works locally with `node bin/script.js` but fails when installed globally
- Error message: "Cannot find module 'package-name'"
- Package appears in devDependencies but is imported by runtime code

**Sources:**
- [Common npm mistakes by Jacob Page](https://medium.com/@jacob.h.page/common-npm-mistakes-51bf8989079f)
- [npm Common Errors](https://docs.npmjs.com/common-errors/)

### Pitfall 3: Missing or Incorrect Repository Field Causes npm Warnings
**What goes wrong:** `npm publish` shows warning "No repository field" or "repository shorthand format corrected." npmjs.com package page doesn't link to GitHub repo.

**Why it happens:** Omitting repository field entirely, or using deprecated shorthand format `"repository": "github:user/repo"` instead of full object format.

**How to avoid:**
- Use full object format:
  ```json
  "repository": {
    "type": "git",
    "url": "https://github.com/username/viberipped.git"
  }
  ```
- Alternatively, use `npm pkg fix` to auto-correct format
- Set `homepage` and `bugs` fields to GitHub URLs as well for complete integration

**Warning signs:**
- npm publish output shows repository field warnings
- npmjs.com package page shows "No repository" or incorrect link
- Users can't find source code easily

**Sources:**
- [GitHub URLs in package.json](https://dev.to/michalbryxi/github-urls-in-package-json-5412)
- [Best practices for publishing your npm package](https://mikbry.com/blog/javascript/npm/best-practices-npm-package)

### Pitfall 4: Forgetting Executable Permissions in Git
**What goes wrong:** Bin script has executable permissions locally but after `git clone` and `npm install -g`, command fails with "Permission denied."

**Why it happens:** Git doesn't track file permissions by default, or permissions weren't committed. When npm installs, it tries to set permissions but may fail if not present in source.

**How to avoid:**
- Set executable bit: `chmod +x bin/vibripped.js`
- Verify permissions in git: `git ls-files -s bin/vibripped.js` (should show 100755 not 100644)
- Stage permission change: `git add --chmod=+x bin/vibripped.js`
- npm handles permission setup during install if source file is executable

**Warning signs:**
- Command works locally but fails after fresh clone
- Error: "EACCES: permission denied"
- `ls -la bin/vibripped.js` shows `-rw-r--r--` instead of `-rwxr-xr-x`

**Note:** VibeRipped already has correct permissions (`-rwxr-xr-x`) on `bin/vibripped.js`.

**Sources:**
- [Making Your NPM Package Executable](https://dev.to/orkhanhuseyn/making-your-npm-package-executable-1j0b)
- [Creating cross-platform shell scripts](https://exploringjs.com/nodejs-shell-scripting/ch_creating-shell-scripts.html)

### Pitfall 5: Version Already Published Error
**What goes wrong:** `npm publish` fails with "You cannot publish over the previously published version."

**Why it happens:** Attempting to republish same version. npm registry is immutable—once a version is published, it's permanent.

**How to avoid:**
- Always bump version before publishing: `npm version patch/minor/major`
- Check current published version: `npm view viberipped version`
- Use `npm version` workflow (automatically commits and tags)
- For urgent fixes after publish: bump patch version, can't replace existing version

**Warning signs:**
- Error message mentions "previously published version"
- `npm view package-name version` shows same version as local package.json

**Sources:**
- [npm publish docs](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
- [npm version cheatsheet](https://gist.github.com/jonlabelle/706b28d50ba75bf81d40782aa3c84b3e)

## Code Examples

Verified patterns from official sources:

### Pre-publish Checklist Script
```bash
# Source: https://docs.npmjs.com/cli/v11/commands/npm-publish/
#!/usr/bin/env bash
# run-before-publish.sh

echo "1. Running tests..."
npm test || exit 1

echo "2. Checking package contents..."
npm pack --dry-run

echo "3. Verifying repository field..."
npm pkg get repository

echo "4. Current version:"
npm pkg get version

echo "Ready to publish? Run:"
echo "  npm version [patch|minor|major]"
echo "  npm publish"
echo "  git push && git push --tags"
```

### Testing Global Install Locally
```bash
# Source: https://dev.to/scooperdev/use-npm-pack-to-test-your-packages-locally-486e
# Create test package tarball
npm pack

# Install globally from tarball
npm install -g ./viberipped-1.0.0.tgz

# Test the command
vibripped --help
vibripped config --kettlebell --dumbbells
vibripped test

# Uninstall after testing
npm uninstall -g viberipped
```

### shields.io Badge URLs for README
```markdown
<!-- Source: https://shields.io/badges/npm-version -->
![npm version](https://img.shields.io/npm/v/viberipped.svg)
![npm downloads](https://img.shields.io/npm/dm/viberipped.svg)
![license](https://img.shields.io/npm/l/viberipped.svg)
![Node.js version](https://img.shields.io/node/v/viberipped.svg)

<!-- Or with links: -->
[![npm version](https://img.shields.io/npm/v/viberipped.svg)](https://www.npmjs.com/package/viberipped)
[![npm downloads](https://img.shields.io/npm/dm/viberipped.svg)](https://www.npmjs.com/package/viberipped)
[![license](https://img.shields.io/npm/l/viberipped.svg)](https://github.com/username/viberipped/blob/main/LICENSE)
```

### Recommended .gitignore Additions
```gitignore
# Source: https://gitignore.pro/templates/node
# VibeRipped already has:
node_modules/

# Should add for distribution phase:
*.tgz
coverage/
.nyc_output/
.DS_Store
.env
.env.local
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `prepublish` script | `prepublishOnly` or `prepare` | npm 4 (2017) | `prepublish` ran on `npm install` (confusing); `prepublishOnly` only runs on `npm publish` |
| `.npmignore` blacklist | `files` whitelist | Best practice since ~2019 | `files` field is safer—explicit about what's included, reduces leak risk |
| ISC default license | Still ISC default | 2016-present | ISC is functionally equivalent to MIT, just shorter text |
| Manual version bumping | `npm version` command | Built-in since npm 1.0 | Atomic commit+tag prevents common mistakes |
| Shorthand repository format | Full object format | Recommended since npm 6 | Shorthand shows warnings, full format future-proof |

**Deprecated/outdated:**
- **`prepublish` script:** Use `prepublishOnly` (runs only on publish) or `prepare` (runs on both publish and install)
- **Shorthand repository format (`"repository": "github:user/repo"`):** Use full object format with `type` and `url` fields to avoid warnings
- **Omitting `engines` field:** Modern packages should specify minimum Node.js version for compatibility

## Open Questions

1. **Should VibeRipped be published under personal or organization scope?**
   - What we know: npm supports scoped packages like `@username/viberipped` or unscoped `viberipped`
   - What's unclear: User's preference—personal name, organization, or keep unscoped
   - Recommendation: Start unscoped for simplicity; can deprecate and republish as scoped later if needed

2. **What GitHub username/org will host the public repository?**
   - What we know: package.json needs repository URL before publishing
   - What's unclear: GitHub account details
   - Recommendation: Get GitHub URL from user before writing README and updating package.json

3. **Should README include animated GIF demo?**
   - What we know: Terminal recordings are best practice for CLI tools; asciinema + agg can generate GIFs
   - What's unclear: User's willingness to create demo recording
   - Recommendation: Include demo section in README structure; mark optional; provide recording script if user wants it

4. **What author name and email to use in package.json?**
   - What we know: Author field should include name and optionally email
   - What's unclear: User's preference for public contact info
   - Recommendation: Ask user for `"author": "Name <email>"` string before updating package.json

5. **Should CHANGELOG.md be created now or deferred?**
   - What we know: CHANGELOG is best practice for versioned packages; this is v1.0.0 initial release
   - What's unclear: Whether user wants changelog discipline from start
   - Recommendation: Optional for v1.0.0; recommend adding in future phases if project continues development

## Sources

### Primary (HIGH confidence)
- [npm package.json documentation](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) - Official package metadata specification
- [npm publish documentation](https://docs.npmjs.com/cli/v11/commands/npm-publish/) - Official publishing workflow
- [npm semantic versioning guide](https://docs.npmjs.com/about-semantic-versioning/) - Version numbering requirements
- [npm developers guide](https://docs.npmjs.com/cli/v9/using-npm/developers/) - File inclusion rules and publishing best practices
- [npm scripts documentation](https://docs.npmjs.com/cli/v6/using-npm/scripts/) - Lifecycle script execution order
- [Semantic Versioning 2.0.0 specification](https://semver.org/) - Official semver standard

### Secondary (MEDIUM confidence)
- [Creating cross-platform shell scripts](https://exploringjs.com/nodejs-shell-scripting/ch_creating-shell-scripts.html) - Node.js shell scripting guide, authoritative source
- [Making Your NPM Package Executable](https://dev.to/orkhanhuseyn/making-your-npm-package-executable-1j0b) - Verified with official docs
- [Expertly Ignoring Files from Your npm Package](https://www.bomberbot.com/npm/expertly-ignoring-files-from-your-npm-package/) - Comprehensive guide, cross-verified with npm docs
- [Best practices for publishing your npm package](https://mikbry.com/blog/javascript/npm/best-practices-npm-package) - Good practices, matches official recommendations
- [Use npm pack to test your packages locally](https://dev.to/scooperdev/use-npm-pack-to-test-your-packages-locally-486e) - Testing workflow, verified approach
- [GitHub URLs in package.json](https://dev.to/michalbryxi/github-urls-in-package-json-5412) - Repository field formats, verified
- [Common npm mistakes by Jacob Page](https://medium.com/@jacob.h.page/common-npm-mistakes-51bf8989079f) - Pitfalls guide, common issues
- [npm version cheatsheet](https://gist.github.com/jonlabelle/706b28d50ba75bf81d40782aa3c84b3e) - Quick reference, verified commands

### Secondary (MEDIUM confidence, continued)
- [Shields.io homepage](https://shields.io/) - Official badge service documentation
- [Shields.io NPM badges](https://shields.io/badges/npm-version) - Badge URL formats and parameters
- [Make your project README stand out with animated GIFs/SVGs](https://dev.to/brpaz/make-your-project-readme-file-stand-out-with-animated-gifs-svgs-4kpe) - Visual demo best practices
- [Enhance Your Readme With Asciinema](https://www.cesarsotovalero.net/blog/enhance-your-readme-with-asciinema.html) - Terminal recording workflows
- [About package README files | npm Docs](https://docs.npmjs.com/about-package-readme-files/) - Official README guidance
- [Understanding the ISC License](https://knowledge.buka.sh/understanding-the-isc-license-in-npm-projects-a-developers-guide/) - License choice explanation

### Tertiary (LOW confidence)
- WebSearch results for README structure examples - Multiple sources, no single authoritative pattern
- WebSearch results for .gitignore templates - Common patterns but project-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - npm publishing is mature, well-documented, stable across years
- Architecture: HIGH - package.json fields and npm commands are standardized, no ambiguity
- Pitfalls: HIGH - All pitfalls verified with official docs or multiple credible sources
- Code examples: HIGH - All examples from official documentation or verified sources

**Research date:** 2026-02-09
**Valid until:** 90+ days (npm publishing practices are very stable; major changes announced well in advance)

**Notes:**
- VibeRipped's existing structure is already npm-publish-ready with correct shebang, permissions, and basic package.json
- Main tasks are enrichment (metadata, README, LICENSE) rather than structural fixes
- Zero breaking changes expected—this is about making existing code public, not refactoring
