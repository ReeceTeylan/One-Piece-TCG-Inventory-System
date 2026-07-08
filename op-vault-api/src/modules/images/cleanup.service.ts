import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { STORAGE_PROVIDER, StorageProvider } from './storage/storage.interface';

export interface CleanupReport {
  startedAt: string;
  durationMs: number;
  storageCount: number;
  referencedCount: number;
  deleted: string[];
  skipped: string[];
  errors: { key: string; error: string }[];
  aborted?: string;
}

const PREFIX = 'cards/';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private prisma: PrismaService,
    private audit: ActivityLogsService,
    @Inject(STORAGE_PROVIDER) private storage: StorageProvider,
  ) {}

  /** Weekly orphan-image sweep (Sundays 03:00). */
  @Cron(CronExpression.EVERY_WEEK)
  async scheduledCleanup(): Promise<CleanupReport> {
    return this.runCleanup();
  }

  /**
   * Compare storage files against DB references and delete anything storage-side
   * that no CardImage row points to. Never deletes referenced (active) images.
   */
  async runCleanup(): Promise<CleanupReport> {
    const startedAt = new Date();
    const started = Date.now();
    const deleted: string[] = [];
    const skipped: string[] = [];
    const errors: { key: string; error: string }[] = [];

    // 1. All keys referenced by the database (main + derived thumbnail).
    const images = await this.prisma.cardImage.findMany({ select: { storageKey: true } });
    const referenced = new Set<string>();
    for (const img of images) {
      referenced.add(img.storageKey);
      referenced.add(img.storageKey.replace('.webp', '_thumb.webp'));
    }

    // 2. Everything currently on storage.
    const stored = await this.storage.list(PREFIX);

    // 3. Safety guard: if the DB has zero references but storage has files, this
    //    is almost certainly a query/DB problem, not thousands of real orphans.
    //    Abort rather than wipe the whole bucket.
    if (referenced.size === 0 && stored.length > 0) {
      const report: CleanupReport = {
        startedAt: startedAt.toISOString(), durationMs: Date.now() - started,
        storageCount: stored.length, referencedCount: 0,
        deleted: [], skipped: stored, errors: [],
        aborted: 'No DB image references found; skipping to avoid mass deletion.',
      };
      this.logger.warn(report.aborted);
      return report;
    }

    // 4. Delete orphans (stored files with no DB reference).
    for (const key of stored) {
      if (referenced.has(key)) { skipped.push(key); continue; }
      try {
        await this.storage.delete(key);
        deleted.push(key);
      } catch (e) {
        errors.push({ key, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const report: CleanupReport = {
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - started,
      storageCount: stored.length,
      referencedCount: referenced.size,
      deleted, skipped, errors,
    };

    this.logger.log(
      `Image cleanup: ${deleted.length} deleted, ${skipped.length} kept, ` +
      `${errors.length} errors, ${report.durationMs}ms (storage=${stored.length}, refs=${referenced.size})`,
    );
    if (errors.length) this.logger.error(`Cleanup errors: ${JSON.stringify(errors)}`);

    // 5. Persist an audit record so cleanups are traceable.
    try {
      await this.audit.log({
        action: 'images.cleanup',
        entityType: 'CardImage',
        metadata: {
          deleted: deleted.length, skipped: skipped.length, errors: errors.length,
          durationMs: report.durationMs, sampleDeleted: deleted.slice(0, 20),
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to write cleanup audit log: ${e instanceof Error ? e.message : e}`);
    }

    return report;
  }
}
