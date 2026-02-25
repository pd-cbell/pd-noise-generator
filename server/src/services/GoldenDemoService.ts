import { Prisma, GoldenDemo, Role } from '@prisma/client';
import prisma from '../prisma';

export class GoldenDemoService {
  async listGoldenDemos(userId: string, role: Role, vertical?: string): Promise<GoldenDemo[]> {
    const where: Prisma.GoldenDemoWhereInput = {};
    if (role !== Role.ADMIN) {
      where.OR = [{ createdByUserId: userId }, { isShared: true }];
    }
    if (vertical) {
      where.vertical = vertical;
    }
    return prisma.goldenDemo.findMany({ where, orderBy: { updatedAt: 'desc' } });
  }

  async getGoldenDemo(id: string, userId?: string, role?: Role): Promise<GoldenDemo | null> {
    if (!userId || !role || role === Role.ADMIN) {
      return prisma.goldenDemo.findFirst({ where: { id } });
    }
    return prisma.goldenDemo.findFirst({
      where: { id, OR: [{ createdByUserId: userId }, { isShared: true }] },
    });
  }

  async createGoldenDemo(
    data: Omit<Prisma.GoldenDemoUncheckedCreateInput, 'id' | 'createdAt' | 'updatedAt'>,
    role: Role
  ): Promise<GoldenDemo> {
    // Basic validation
    if (!data.name || data.name.trim() === '') {
      throw new Error('Golden Demo name cannot be empty.');
    }
    if (!data.vertical || data.vertical.trim() === '') {
      throw new Error('Golden Demo vertical cannot be empty.');
    }
    if (!data.maturityLevel || data.maturityLevel.trim() === '') {
      throw new Error('Golden Demo maturity level cannot be empty.');
    }
    if (!data.narrative || data.narrative.trim() === '') {
      throw new Error('Golden Demo narrative cannot be empty.');
    }
    try {
      JSON.parse(JSON.stringify(data.configJson)); // Check if configJson is valid JSON
    } catch (error) {
      throw new Error('Golden Demo configJson is not valid JSON.');
    }

    if (role === Role.VIEWER && data.isShared) {
      throw new Error('Forbidden: viewers cannot share Golden Demos.');
    }

    try {
      return await prisma.goldenDemo.create({ data });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new Error('Conflict: Golden Demo name already exists for this user.');
      }
      throw error;
    }
  }

  async updateGoldenDemo(
    id: string,
    userId: string,
    role: Role,
    data: Prisma.GoldenDemoUpdateInput
  ): Promise<GoldenDemo> {
    // Basic validation
    if (data.name && typeof data.name === 'string' && data.name.trim() === '') {
      throw new Error('Golden Demo name cannot be empty.');
    }
    if (data.vertical && typeof data.vertical === 'string' && data.vertical.trim() === '') {
      throw new Error('Golden Demo vertical cannot be empty.');
    }
    if (data.maturityLevel && typeof data.maturityLevel === 'string' && data.maturityLevel.trim() === '') {
      throw new Error('Golden Demo maturity level cannot be empty.');
    }
    if (data.narrative && typeof data.narrative === 'string' && data.narrative.trim() === '') {
      throw new Error('Golden Demo narrative cannot be empty.');
    }
    if (data.configJson) {
      try {
        JSON.parse(JSON.stringify(data.configJson)); // Check if configJson is valid JSON
      } catch (error) {
        throw new Error('Golden Demo configJson is not valid JSON.');
      }
    }

    if (role === Role.VIEWER) {
      const existing = await prisma.goldenDemo.findFirst({
        where: { id, createdByUserId: userId },
        select: { isShared: true },
      });
      if (!existing || existing.isShared) {
        throw new Error('Forbidden: viewers cannot edit shared Golden Demos.');
      }
      if (data.isShared) {
        throw new Error('Forbidden: viewers cannot share Golden Demos.');
      }
    }

    const where = role === Role.ADMIN ? { id } : { id, createdByUserId: userId };
    try {
      return await prisma.goldenDemo.update({ where, data });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new Error('Conflict: Golden Demo name already exists for this user.');
      }
      throw error;
    }
  }

  async deleteGoldenDemo(id: string, userId: string, role: Role): Promise<GoldenDemo> {
    if (role === Role.VIEWER) {
      const existing = await prisma.goldenDemo.findFirst({
        where: { id, createdByUserId: userId },
        select: { isShared: true },
      });
      if (!existing || existing.isShared) {
        throw new Error('Forbidden: viewers cannot delete shared Golden Demos.');
      }
    }

    const where = role === Role.ADMIN ? { id } : { id, createdByUserId: userId };
    return prisma.goldenDemo.delete({ where });
  }
}
