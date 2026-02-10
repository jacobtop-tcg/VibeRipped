#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

try {
  const claudeDir = path.join(os.homedir(), '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');
  const statuslinePath = path.join(__dirname, '..', 'statusline.js');

  // Claude Code must be installed (i.e. ~/.claude/ exists)
  if (!fs.existsSync(claudeDir)) {
    process.exit(0);
  }

  // Read existing settings or start fresh
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }

  if (!Array.isArray(settings.statuslineProviders)) {
    settings.statuslineProviders = [];
  }

  // Don't add a duplicate
  const exists = settings.statuslineProviders.some(
    (p) => p.name === 'VibeRipped'
  );
  if (exists) {
    process.exit(0);
  }

  settings.statuslineProviders.push({
    name: 'VibeRipped',
    path: statuslinePath,
    enabled: true,
  });

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  console.log('VibeRipped added to Claude Code statusline providers.');
  console.log('Run `viberipped setup` to configure your exercises.');
} catch {
  // Silent failure — don't break npm install
}
