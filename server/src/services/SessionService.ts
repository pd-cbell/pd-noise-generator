import { Prisma, Session, Role, SessionSource } from '@prisma/client';
import prisma from '../prisma';

export class SessionService {
  private async resolveLaunchSnapshots(params: {
    mappingProfileId?: string | null;
    launchedByUserId?: string | null;
    launchedByName?: string | null;
    launchedByEmail?: string | null;
  }) {
    let mappingProfileName: string | null = null;
    let launchedByName = params.launchedByName || null;
    let launchedByEmail = params.launchedByEmail || null;

    if (params.mappingProfileId) {
      const profile = await prisma.mappingProfile.findUnique({
        where: { id: params.mappingProfileId },
        select: { name: true },
      });
      mappingProfileName = profile?.name || null;
    }

    if (params.launchedByUserId && (!launchedByName || !launchedByEmail)) {
      const user = await prisma.user.findUnique({
        where: { id: params.launchedByUserId },
        select: { name: true, email: true },
      });
      launchedByName = launchedByName || user?.name || null;
      launchedByEmail = launchedByEmail || user?.email || null;
    }

    return { mappingProfileName, launchedByName, launchedByEmail };
  }

  async startSession(
    data: Prisma.SessionUncheckedCreateInput
  ): Promise<Session> {
    // Start a new session record
    return prisma.session.create({ data });
  }

  async startTrackRunSession(params: {
    goldenDemoId: string;
    sessionOwnerUserId: string;
    trackRunId: string;
    source: SessionSource;
    mappingProfileId?: string | null;
    launchedByUserId?: string | null;
    launchedByName?: string | null;
    launchedByEmail?: string | null;
    name?: string | null;
  }): Promise<Session> {
    const snapshots = await this.resolveLaunchSnapshots(params);
    const goldenDemo = await prisma.goldenDemo.findUnique({
      where: { id: params.goldenDemoId },
      select: { name: true },
    });
    return prisma.session.create({
      data: {
        goldenDemoId: params.goldenDemoId,
        createdByUserId: params.sessionOwnerUserId,
        name: params.name || goldenDemo?.name || null,
        source: params.source,
        trackRunId: params.trackRunId,
        mappingProfileId: params.mappingProfileId || null,
        mappingProfileName: snapshots.mappingProfileName,
        launchedByUserId: params.launchedByUserId || null,
        launchedByName: snapshots.launchedByName,
        launchedByEmail: snapshots.launchedByEmail,
      },
    });
  }

  async endSession(
    id: string,
    metricsSnapshot: any, // JSON
    notes?: string
  ): Promise<Session> {
    return prisma.session.update({
      where: { id },
      data: {
        endedAt: new Date(),
        metricsSnapshotJson: metricsSnapshot,
        notes: notes
      },
    });
  }

  async endSessionByTrackRunId(trackRunId: string, metricsSnapshot: any = {}): Promise<void> {
    const existing = await prisma.session.findFirst({
      where: { trackRunId },
      select: { id: true, endedAt: true },
    });
    if (!existing || existing.endedAt) return;
    await prisma.session.update({
      where: { id: existing.id },
      data: {
        endedAt: new Date(),
        metricsSnapshotJson: metricsSnapshot,
      },
    });
  }

  async getSession(id: string, userId: string, role: Role): Promise<any | null> {
    const where: Prisma.SessionWhereInput =
      role === Role.ADMIN
        ? { id }
        : {
            id,
            OR: [
              { createdByUserId: userId },
              { launchedByUserId: userId },
              { goldenDemo: { isShared: true } },
            ],
          };
    return prisma.session.findFirst({
      where,
      include: { goldenDemo: { select: { id: true, name: true, createdByUserId: true, isShared: true } } }
    });
  }

  async listSessions(userId: string, role: Role, goldenDemoId?: string): Promise<any[]> {
    let where: Prisma.SessionWhereInput;

    if (role === Role.ADMIN) {
      where = goldenDemoId ? { goldenDemoId } : {};
    } else if (goldenDemoId) {
      where = {
        goldenDemoId,
        goldenDemo: {
          OR: [{ createdByUserId: userId }, { isShared: true }],
        },
      };
    } else {
      where = {
        OR: [{ createdByUserId: userId }, { launchedByUserId: userId }],
      };
    }

    return prisma.session.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: {
        goldenDemo: { select: { id: true, name: true, createdByUserId: true, isShared: true } },
      }
    });
  }
}
