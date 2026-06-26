#!/usr/bin/env node
/**
 * DeepSeek MCP Configuration Wizard
 *
 * Interactive setup script for configuring DeepSeek credentials.
 * Prompts the user for their DeepSeek email, password, and a master
 * password used for AES-256-GCM encryption. Credentials are stored
 * encrypted at ~/.deepseek-mcp/credentials.enc.
 *
 * Usage: npx tsx src/setup.ts  OR  npm run setup
 */

import * as readline from 'node:readline';
import { CredentialManager } from './credential-manager.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const BANNER = `
===============================================
  DeepSeek MCP - Configuration Wizard
===============================================
This tool will securely store your DeepSeek
credentials using AES-256-GCM encryption.

Your credentials will be encrypted with a
master password that YOU choose. You will need
this master password every time the MCP server
starts.

  Credentials location: ~/.deepseek-mcp/
  Encryption:           AES-256-GCM (PBKDF2)
===============================================
`;

function clearScreen(): void {
  process.stdout.write('\x1Bc');
}

function printSeparator(): void {
  console.log('─'.repeat(50));
}

// ── Prompt helpers ──────────────────────────────────────────────────────────

interface PromptOptions {
  /** Hide input (for passwords) */
  hideInput?: boolean;
}

function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function prompt(rl: readline.Interface, question: string, options?: PromptOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    if (options?.hideInput && process.stdin.isTTY) {
      // Manual password input with asterisks suppressed
      process.stdout.write(question);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;

      if (stdin.isTTY) {
        stdin.setRawMode(true);
      }

      let password = '';

      const onData = (chunk: Buffer): void => {
        const str = chunk.toString();

        for (const ch of str) {
          if (ch === '\n' || ch === '\r') {
            if (stdin.isTTY) {
              stdin.setRawMode(wasRaw ?? false);
            }
            stdin.removeListener('data', onData);
            process.stdout.write('\n');
            resolve(password);
            return;
          } else if (ch === '') {
            // Ctrl+C
            if (stdin.isTTY) {
              stdin.setRawMode(wasRaw ?? false);
            }
            stdin.removeListener('data', onData);
            process.exit(1);
          } else if (ch === '' || ch === '\b') {
            // Backspace
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write('\b \b');
            }
          } else {
            password += ch;
            process.stdout.write('*');
          }
        }
      };

      stdin.on('data', onData);
    } else {
      rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    }
  });
}

// ── Validation ──────────────────────────────────────────────────────────────

function validateEmail(email: string): string | null {
  if (!email) {
    return 'Email is required.';
  }
  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < 1) {
    return 'Password cannot be empty.';
  }
  return null;
}

function validateMasterPassword(password: string): string | null {
  if (!password) {
    return 'Master password is required.';
  }
  if (password.length < 8) {
    return 'Master password must be at least 8 characters.';
  }
  return null;
}

// ── Claude Desktop Configuration ────────────────────────────────────────────

function printClaudeDesktopConfig(): void {
  console.log('\n');
  printSeparator();
  console.log('  Claude Desktop App Configuration');
  printSeparator();
  console.log(`
To use this MCP server with Claude Desktop App,
add the following to your Claude Desktop config file:

  macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
  Windows: %APPDATA%\\Claude\\claude_desktop_config.json

Configuration JSON:

{
  "mcpServers": {
    "deepseek": {
      "command": "npx",
      "args": [
        "tsx",
        "${process.cwd().replace(/\\/g, '\\\\')}/src/index.ts"
      ],
      "env": {
        "DEEPSEEK_MASTER_PASSWORD": "<your-master-password>"
      }
    }
  }
}

Replace <your-master-password> with the master password
you just created above.

Alternatively, if you have built the project:

{
  "mcpServers": {
    "deepseek": {
      "command": "node",
      "args": [
        "${process.cwd().replace(/\\/g, '\\\\')}/dist/index.js"
      ],
      "env": {
        "DEEPSEEK_MASTER_PASSWORD": "<your-master-password>"
      }
    }
  }
}
`);
  printSeparator();
}

// ── Main setup flow ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  clearScreen();
  console.log(BANNER);

  const rl = createInterface();

  try {
    const credentialManager = new CredentialManager();

    // Check for existing credentials
    if (credentialManager.hasCredentials()) {
      console.log('NOTE: Existing credentials found at ~/.deepseek-mcp/credentials.enc');
      const overwrite = await prompt(rl, 'Do you want to overwrite them? (y/N): ');
      if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
        console.log('\nKeeping existing credentials. Setup cancelled.');
        rl.close();
        return;
      }
      console.log('');
    }

    // ── Collect DeepSeek email ──────────────────────────────────────────
    let email = '';
    while (true) {
      email = await prompt(rl, 'DeepSeek email: ');
      const error = validateEmail(email);
      if (!error) break;
      console.log(`  ERROR: ${error}`);
    }

    // ── Collect DeepSeek password ───────────────────────────────────────
    let password = '';
    while (true) {
      password = await prompt(rl, 'DeepSeek password: ', { hideInput: true });
      const error = validatePassword(password);
      if (!error) break;
      console.log(`  ERROR: ${error}`);
    }

    // ── Collect master password ─────────────────────────────────────────
    console.log('\n  A master password is used to encrypt your credentials.');
    console.log('  It must be at least 8 characters and is NOT your DeepSeek password.');

    let masterPassword = '';
    while (true) {
      masterPassword = await prompt(rl, '\nMaster password: ', { hideInput: true });
      const error = validateMasterPassword(masterPassword);
      if (!error) break;
      console.log(`  ERROR: ${error}`);
    }

    // Confirm master password
    let confirmMaster = '';
    while (true) {
      confirmMaster = await prompt(rl, 'Confirm master password: ', { hideInput: true });
      if (confirmMaster === masterPassword) break;
      console.log('  ERROR: Passwords do not match. Please try again.');
    }

    // ── Save credentials ────────────────────────────────────────────────
    console.log('\nSaving credentials...');
    printSeparator();

    try {
      await credentialManager.saveCredentials(email, password, masterPassword);
      console.log('SUCCESS: Credentials saved and encrypted successfully!');
      console.log('         Location: ~/.deepseek-mcp/credentials.enc');
    } catch (error) {
      console.error(
        `\nFAILED: Could not save credentials: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      rl.close();
      process.exit(1);
    }

    // ── Display Claude Desktop configuration ────────────────────────────
    printClaudeDesktopConfig();

    // ── Summary ─────────────────────────────────────────────────────────
    console.log('\nSetup complete! Next steps:');
    console.log('  1. Copy the JSON configuration above into your Claude Desktop config');
    console.log('  2. Replace <your-master-password> with your chosen master password');
    console.log('  3. Restart Claude Desktop App');
    console.log('  4. You can now use DeepSeek tools through the MCP server\n');

    rl.close();
  } catch (error) {
    console.error(`\nSetup failed: ${error instanceof Error ? error.message : String(error)}`);
    rl.close();
    process.exit(1);
  }
}

// ── Entry point ─────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
