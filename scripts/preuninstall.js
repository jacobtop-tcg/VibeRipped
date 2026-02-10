#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

try {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');

  if (!fs.existsSync(settingsPath)) {
    process.exit(0);
  }

  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

  if (!Array.isArray(settings.statuslineProviders)) {
    process.exit(0);
  }

  const before = settings.statuslineProviders.length;
  settings.statuslineProviders = settings.statuslineProviders.filter(
    (p) => p.name !== 'VibeRipped'
  );

  if (settings.statuslineProviders.length < before) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    console.log('VibeRipped removed from Claude Code statusline providers.');
  }
} catch {
  // Silent failure — don't break npm uninstall
}
