import { spawn } from 'node:child_process';

export function openInBrowser(url: string): void {
  try {
    const platform = process.platform;
    let command: string;
    let args: string[];

    if (platform === 'darwin') {
      command = 'open';
      args = [url];
    } else if (platform === 'win32') {
      command = 'cmd';
      args = ['/c', 'start', url];
    } else {
      command = 'xdg-open';
      args = [url];
    }

    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    });

    child.unref();
  } catch {
    // Best-effort — if the command fails, the user can copy the URL manually.
  }
}
