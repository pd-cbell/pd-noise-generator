import { Prisma, Session } from '@prisma/client';
import prisma from '../prisma';

export class SessionService {
  async startSession(
    data: Prisma.SessionUncheckedCreateInput
  ): Promise<Session> {
    // Start a new session record
    return prisma.session.create({ data });
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

  async getSession(id: string, userId: string): Promise<Session | null> {
    return prisma.session.findFirst({
      where: { id, createdByUserId: userId },
      include: { goldenDemo: true }
    });
  }

  async listSessions(userId: string, goldenDemoId?: string): Promise<Session[]> {
    const where: Prisma.SessionWhereInput = {
        createdByUserId: userId 
    };
    
    if (goldenDemoId) {
        where.goldenDemoId = goldenDemoId;
    }

    return prisma.session.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: { goldenDemo: { select: { name: true } } }
    });
  }
}
