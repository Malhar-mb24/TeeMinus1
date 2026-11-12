import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";

export interface ForegroundAppSample {
  processName: string | null;
  idleMs: number;
  timestampMs: number;
}

const POWERSHELL_SAMPLER_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class EmberWin32 {
  [StructLayout(LayoutKind.Sequential)]
  public struct LASTINPUTINFO {
    public uint cbSize;
    public uint dwTime;
  }

  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

  [DllImport("user32.dll")]
  public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

  public static uint GetForegroundProcessId() {
    IntPtr hwnd = GetForegroundWindow();
    if (hwnd == IntPtr.Zero) return 0;
    uint pid = 0;
    GetWindowThreadProcessId(hwnd, out pid);
    return pid;
  }

  public static uint GetIdleMilliseconds() {
    LASTINPUTINFO lii = new LASTINPUTINFO();
    lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
    if (!GetLastInputInfo(ref lii)) return 0;
    uint ticks = unchecked((uint)Environment.TickCount);
    return ticks - lii.dwTime;
  }
}
"@ | Out-Null

Write-Output '{"ready":true}'
[Console]::Out.Flush()

while (($line = [Console]::In.ReadLine()) -ne $null) {
  if ($line -eq 'EXIT') { break }
  $targetPid = [EmberWin32]::GetForegroundProcessId()
  $idleMs = [EmberWin32]::GetIdleMilliseconds()
  $procName = $null
  if ($targetPid -gt 0) {
    $proc = Get-Process -Id $targetPid
    if ($proc -and $proc.ProcessName) {
      $procName = "$($proc.ProcessName).exe"
    }
  }
  $payload = @{
    processName = $procName
    idleMs = [int64]$idleMs
    timestampMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  } | ConvertTo-Json -Compress
  Write-Output $payload
  [Console]::Out.Flush()
}
`;

/**
 * Persistent Windows Win32 foreground process + idle sampler.
 * Reads ONLY foreground executable names and OS idle time (no window titles, keystrokes, or screenshots).
 */
export class Win32ForegroundSampler {
  private child: ChildProcessWithoutNullStreams | null = null;
  private lineReader: readline.Interface | null = null;
  private readyPromise: Promise<void> | null = null;
  private pendingResolvers: Array<(sample: ForegroundAppSample) => void> = [];

  async start(): Promise<void> {
    if (process.platform !== "win32") {
      throw new Error("Win32ForegroundSampler requires Windows (win32).");
    }
    if (this.child && this.readyPromise) {
      return this.readyPromise;
    }

    const encodedScript = Buffer.from(POWERSHELL_SAMPLER_SCRIPT, "utf16le").toString(
      "base64"
    );

    this.child = spawn(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        encodedScript,
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    this.lineReader = readline.createInterface({
      input: this.child.stdout,
      crlfDelay: Infinity,
    });

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out starting Windows foreground app sampler."));
      }, 10_000);

      const onError = (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      };
      this.child?.once("error", onError);

      this.lineReader?.on("line", (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const parsed = JSON.parse(trimmed) as {
            ready?: boolean;
            processName?: string | null;
            idleMs?: number;
            timestampMs?: number;
          };
          if (parsed.ready) {
            clearTimeout(timeout);
            this.child?.off("error", onError);
            resolve();
            return;
          }
          const resolver = this.pendingResolvers.shift();
          if (resolver) {
            resolver({
              processName:
                typeof parsed.processName === "string" && parsed.processName.trim()
                  ? parsed.processName.trim()
                  : null,
              idleMs: Number.isFinite(parsed.idleMs) ? Number(parsed.idleMs) : 0,
              timestampMs: Number.isFinite(parsed.timestampMs)
                ? Number(parsed.timestampMs)
                : Date.now(),
            });
          }
        } catch {
          // Ignore unexpected stdout noise
        }
      });

      this.child?.once("exit", () => {
        while (this.pendingResolvers.length > 0) {
          const resolver = this.pendingResolvers.shift();
          resolver?.({ processName: null, idleMs: 0, timestampMs: Date.now() });
        }
      });
    });

    return this.readyPromise;
  }

  async sample(): Promise<ForegroundAppSample> {
    await this.start();
    if (!this.child || this.child.killed) {
      return { processName: null, idleMs: 0, timestampMs: Date.now() };
    }

    return new Promise<ForegroundAppSample>((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.pendingResolvers.indexOf(onSample);
        if (idx >= 0) this.pendingResolvers.splice(idx, 1);
        resolve({ processName: null, idleMs: 0, timestampMs: Date.now() });
      }, 3000);

      const onSample = (sample: ForegroundAppSample) => {
        clearTimeout(timer);
        resolve(sample);
      };

      this.pendingResolvers.push(onSample);
      this.child?.stdin.write("SAMPLE\n");
    });
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    try {
      this.child.stdin.write("EXIT\n");
      this.child.stdin.end();
    } catch {
      // ignore closed pipe
    }
    this.lineReader?.close();
    this.child.kill();
    this.child = null;
    this.lineReader = null;
    this.readyPromise = null;
  }
}
