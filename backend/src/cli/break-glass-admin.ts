import { fileURLToPath } from 'node:url';

import { ConfigurationError } from '../config.js';

export interface BreakGlassStartCommand {
  readonly organizationId: string;
  readonly targetAdminUserId: string;
  readonly newEmail: string;
  readonly externalCaseReference: string;
}

function requiredFlag(flags: ReadonlyMap<string, string>, name: string): string {
  const value = flags.get(name);
  if (
    value === undefined ||
    value.length === 0 ||
    value !== value.trim() ||
    value.includes('\r') ||
    value.includes('\n')
  ) {
    throw new ConfigurationError(`Invalid ${name} argument.`);
  }
  return value;
}

export function parseBreakGlassStartCommand(
  arguments_: readonly string[],
): BreakGlassStartCommand {
  const [command, ...rawFlags] = arguments_;
  if (command !== 'start' || rawFlags.length % 2 !== 0) {
    throw new ConfigurationError('Use break-glass-admin start with all flags.');
  }
  const flags = new Map<string, string>();
  for (let index = 0; index < rawFlags.length; index += 2) {
    const flag = rawFlags[index];
    const value = rawFlags[index + 1];
    if (
      flag === undefined ||
      value === undefined ||
      !flag.startsWith('--') ||
      flags.has(flag)
    ) {
      throw new ConfigurationError('Invalid or duplicate break-glass flag.');
    }
    flags.set(flag, value);
  }
  const allowed = new Set([
    '--organization-id',
    '--target-admin-user-id',
    '--new-email',
    '--case-reference',
  ]);
  if (flags.size !== allowed.size || [...flags.keys()].some((key) => !allowed.has(key))) {
    throw new ConfigurationError('Break-glass requires the exact approved flags.');
  }
  return Object.freeze({
    organizationId: requiredFlag(flags, '--organization-id'),
    targetAdminUserId: requiredFlag(flags, '--target-admin-user-id'),
    newEmail: requiredFlag(flags, '--new-email'),
    externalCaseReference: requiredFlag(flags, '--case-reference'),
  });
}

export async function runBreakGlassStartCli(input: {
  readonly command: BreakGlassStartCommand;
  readonly environment?: Readonly<Record<string, string | undefined>>;
}): Promise<Readonly<Record<string, string>>> {
  void input;
  throw new ConfigurationError(
    'Admin break-glass start is intentionally unavailable until the external two-approver authorization uses an approved asymmetric verifier.',
  );
}

function safeCliFailure(error: unknown): string {
  if (error instanceof ConfigurationError) return error.message;
  return 'admin_break_glass_failed';
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1];
  return entryPoint !== undefined && fileURLToPath(import.meta.url) === entryPoint;
}

if (isMainModule()) {
  try {
    const command = parseBreakGlassStartCommand(process.argv.slice(2));
    const result = await runBreakGlassStartCli({ command });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify({
        level: 'error',
        event: 'admin_break_glass_failed',
        message: safeCliFailure(error),
      })}\n`,
    );
    process.exitCode = 1;
  }
}
