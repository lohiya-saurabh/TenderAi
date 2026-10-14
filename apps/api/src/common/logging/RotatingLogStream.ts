import fs from 'node:fs';
import path from 'node:path';

export interface RotatingLogStreamOptions {
  filePath: string;
  maxBytes?: number; // default: 10MB (10,485,760 bytes)
  maxFiles?: number; // default: 5 backups (api.log.1 ... api.log.5)
}

/**
 * Robust zero-dependency rotating file log stream for Node.js.
 * Uses atomic file descriptors with synchronous append and rotation
 * to prevent asynchronous race conditions and buffer loss during crashes.
 */
export class RotatingLogStream {
  private readonly targetPath: string;
  private readonly maxBytes: number;
  private readonly maxFiles: number;
  private currentSize: number = 0;
  private fd: number | null = null;
  private isRotating: boolean = false;

  constructor(options: RotatingLogStreamOptions) {
    this.targetPath = path.resolve(options.filePath);
    this.maxBytes = options.maxBytes ?? 10 * 1024 * 1024; // 10 MB
    this.maxFiles = options.maxFiles ?? 5;

    this.ensureDirectory();
    this.openFile();
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private openFile(): void {
    try {
      this.fd = fs.openSync(this.targetPath, 'a', 0o600);
      const stats = fs.fstatSync(this.fd);
      this.currentSize = stats.size;
    } catch (err) {
      this.fd = null;
      this.currentSize = 0;
      process.stderr.write(`[RotatingLogStream] Failed to open log file ${this.targetPath}: ${String(err)}\n`);
    }
  }

  /**
   * Synchronously rotates backup files when maximum file size is reached:
   * api.log.5 -> deleted
   * api.log.4 -> api.log.5
   * api.log.1 -> api.log.2
   * api.log   -> api.log.1
   */
  public rotate(): void {
    if (this.isRotating) return;
    this.isRotating = true;

    try {
      if (this.fd !== null) {
        fs.closeSync(this.fd);
        this.fd = null;
      }

      if (fs.existsSync(this.targetPath)) {
        // Prune or roll existing backups
        for (let i = this.maxFiles; i >= 1; i--) {
          const currentBackup = `${this.targetPath}.${i}`;
          if (i === this.maxFiles) {
            if (fs.existsSync(currentBackup)) {
              fs.unlinkSync(currentBackup);
            }
          } else {
            const nextBackup = `${this.targetPath}.${i + 1}`;
            if (fs.existsSync(currentBackup)) {
              fs.renameSync(currentBackup, nextBackup);
            }
          }
        }

        // Rename the active log file to .1
        const firstBackup = `${this.targetPath}.1`;
        fs.renameSync(this.targetPath, firstBackup);
      }
    } catch (err) {
      process.stderr.write(`[RotatingLogStream] Warning: log rotation failed: ${String(err)}\n`);
    } finally {
      this.openFile();
      this.isRotating = false;
    }
  }

  /**
   * Writes a line or chunk to the rotated log file stream.
   */
  public write(chunk: string): void {
    const byteLength = Buffer.byteLength(chunk, 'utf8');

    if (this.currentSize + byteLength >= this.maxBytes) {
      this.rotate();
    }

    if (this.fd !== null) {
      try {
        fs.writeSync(this.fd, chunk);
        this.currentSize += byteLength;
      } catch (err) {
        process.stderr.write(`[RotatingLogStream] Write error: ${String(err)}\n`);
      }
    }
  }

  public end(): Promise<void> {
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {
        // ignore on cleanup
      }
      this.fd = null;
    }
    return Promise.resolve();
  }
}
