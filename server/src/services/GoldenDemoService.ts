import { Prisma, GoldenDemo } from '@prisma/client';
import prisma from '../prisma';

export class GoldenDemoService {
  async listGoldenDemos(userId: string, vertical?: string): Promise<GoldenDemo[]> {
    const where: Prisma.GoldenDemoWhereInput = {
      createdByUserId: userId,
    };
    if (vertical) {
      where.vertical = vertical;
    }
    return prisma.goldenDemo.findMany({ where });
  }

  async getGoldenDemo(id: string, userId?: string): Promise<GoldenDemo | null> {
    return prisma.goldenDemo.findFirst({
      where: userId ? { id, createdByUserId: userId } : { id },
    });
  }

  async createGoldenDemo(
    data: Omit<Prisma.GoldenDemoUncheckedCreateInput, 'id' | 'createdAt' | 'updatedAt'>
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

    return prisma.goldenDemo.create({ data });
  }

  async updateGoldenDemo(
    id: string,
    userId: string,
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

    return prisma.goldenDemo.update({
      where: { id, createdByUserId: userId },
      data,
    });
  }

  async deleteGoldenDemo(id: string, userId: string): Promise<GoldenDemo> {
    return prisma.goldenDemo.delete({
      where: { id, createdByUserId: userId },
    });
  }
}
