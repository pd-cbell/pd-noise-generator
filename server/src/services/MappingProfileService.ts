import { MappingProfile, Prisma, ServiceMapping } from '@prisma/client';
import prisma from '../prisma';

export type ServiceMappingInput = {
  logicalServiceName: string;
  incidentServiceId?: string | null;
  incidentServiceName?: string | null;
  incidentRoutingKeyOverride?: string | null;
  changeRoutingKeyOverride?: string | null;
  changeServiceId?: string | null;
  changeServiceName?: string | null;
  useIncidentForChange?: boolean;
};

export type MappingProfileInput = {
  name: string;
  description?: string | null;
  globalIncidentRoutingKey?: string | null;
  serviceMappings?: ServiceMappingInput[];
};

export type MappingProfileUpdateInput = {
  name?: string;
  description?: string | null;
  globalIncidentRoutingKey?: string | null;
  serviceMappings?: ServiceMappingInput[];
};

export type MappingProfileWithMappings = MappingProfile & {
  serviceMappings: ServiceMapping[];
};

export class MappingProfileService {
  async getMappingProfiles(userId: string): Promise<MappingProfileWithMappings[]> {
    return prisma.mappingProfile.findMany({
      where: { userId },
      include: { serviceMappings: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMappingProfileById(
    id: string,
    userId: string
  ): Promise<MappingProfileWithMappings | null> {
    return prisma.mappingProfile.findFirst({
      where: { id, userId },
      include: { serviceMappings: true },
    });
  }

  async createMappingProfile(
    data: MappingProfileInput,
    userId: string
  ): Promise<MappingProfileWithMappings> {
    const createPayload: Prisma.MappingProfileCreateInput = {
      name: data.name,
      description: data.description ?? undefined,
      globalIncidentRoutingKey: data.globalIncidentRoutingKey ?? undefined,
      user: { connect: { id: userId } },
      serviceMappings: data.serviceMappings
        ? {
            create: data.serviceMappings.map((mapping) => ({
              logicalServiceName: mapping.logicalServiceName,
              incidentServiceId: mapping.incidentServiceId ?? null,
              incidentServiceName: mapping.incidentServiceName ?? null,
              incidentRoutingKeyOverride: mapping.incidentRoutingKeyOverride ?? null,
              changeRoutingKeyOverride: mapping.changeRoutingKeyOverride ?? null,
              changeServiceId: mapping.changeServiceId ?? null,
              changeServiceName: mapping.changeServiceName ?? null,
              useIncidentForChange: mapping.useIncidentForChange ?? false,
            })),
          }
        : undefined,
    };

    return prisma.mappingProfile.create({
      data: createPayload,
      include: { serviceMappings: true },
    });
  }

  async updateMappingProfile(
    id: string,
    userId: string,
    data: MappingProfileUpdateInput
  ): Promise<MappingProfileWithMappings> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.mappingProfile.findFirst({ where: { id, userId } });
      if (!existing) {
        throw new Error('Mapping Profile not found');
      }

      if (data.serviceMappings) {
        await tx.serviceMapping.deleteMany({ where: { mappingProfileId: id } });
      }

      const updated = await tx.mappingProfile.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          globalIncidentRoutingKey: data.globalIncidentRoutingKey,
          serviceMappings: data.serviceMappings
            ? {
                create: data.serviceMappings.map((mapping) => ({
                  logicalServiceName: mapping.logicalServiceName,
                  incidentServiceId: mapping.incidentServiceId ?? null,
                  incidentServiceName: mapping.incidentServiceName ?? null,
                  incidentRoutingKeyOverride: mapping.incidentRoutingKeyOverride ?? null,
                  changeRoutingKeyOverride: mapping.changeRoutingKeyOverride ?? null,
                  changeServiceId: mapping.changeServiceId ?? null,
                  changeServiceName: mapping.changeServiceName ?? null,
                  useIncidentForChange: mapping.useIncidentForChange ?? false,
                })),
              }
            : undefined,
        },
        include: { serviceMappings: true },
      });

      return updated;
    });
  }

  async addMappingsToProfile(
    id: string,
    userId: string,
    mappings: ServiceMappingInput[]
  ): Promise<MappingProfileWithMappings> {
    return prisma.$transaction(async (tx) => {
      const existingProfile = await tx.mappingProfile.findFirst({ where: { id, userId } });
      if (!existingProfile) {
        throw new Error('Mapping Profile not found');
      }

      for (const mapping of mappings) {
        const existingMapping = await tx.serviceMapping.findFirst({
          where: {
            mappingProfileId: id,
            logicalServiceName: mapping.logicalServiceName,
          },
        });

        if (existingMapping) {
          await tx.serviceMapping.update({
            where: { id: existingMapping.id },
            data: {
              incidentServiceId: mapping.incidentServiceId ?? null,
              incidentServiceName: mapping.incidentServiceName ?? null,
              incidentRoutingKeyOverride: mapping.incidentRoutingKeyOverride ?? null,
              changeRoutingKeyOverride: mapping.changeRoutingKeyOverride ?? null,
              changeServiceId: mapping.changeServiceId ?? null,
              changeServiceName: mapping.changeServiceName ?? null,
              useIncidentForChange: mapping.useIncidentForChange ?? false,
            },
          });
        } else {
          await tx.serviceMapping.create({
            data: {
              mappingProfileId: id,
              logicalServiceName: mapping.logicalServiceName,
              incidentServiceId: mapping.incidentServiceId ?? null,
              incidentServiceName: mapping.incidentServiceName ?? null,
              incidentRoutingKeyOverride: mapping.incidentRoutingKeyOverride ?? null,
              changeRoutingKeyOverride: mapping.changeRoutingKeyOverride ?? null,
              changeServiceId: mapping.changeServiceId ?? null,
              changeServiceName: mapping.changeServiceName ?? null,
              useIncidentForChange: mapping.useIncidentForChange ?? false,
            },
          });
        }
      }

      return tx.mappingProfile.findUniqueOrThrow({
        where: { id },
        include: { serviceMappings: true },
      });
    });
  }

  async deleteMappingProfile(id: string, userId: string): Promise<void> {
    const existing = await prisma.mappingProfile.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new Error('Mapping Profile not found');
    }
    await prisma.mappingProfile.delete({
      where: { id },
    });
  }
}
