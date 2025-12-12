import { MappingProfile, ServiceMapping } from '@prisma/client';

export type EventType = 'incident' | 'alert' | 'change' | 'note' | 'automation';

export interface LogicalEventTarget {
  logicalServiceName: string;
  type: EventType;
}

export interface SimulatorConfig {
  pdChangeEventsRoutingKey?: string | null;
}

export interface ResolvedTarget {
  effectiveServiceName?: string;
  effectiveServiceId?: string;
  effectiveRoutingKey?: string | null;
  effectiveChangeRoutingKey?: string | null;
  usedProfileId?: string;
  notes?: string;
}

export type MappingProfileWithMappings = MappingProfile & { serviceMappings: ServiceMapping[] };

export function resolveEventTarget(
  logicalTarget: LogicalEventTarget,
  profile: MappingProfileWithMappings | null,
  simulatorConfig: SimulatorConfig
): ResolvedTarget {
  const { logicalServiceName, type } = logicalTarget;

  if (!profile) {
    return {
      effectiveServiceName: logicalServiceName,
      effectiveRoutingKey: null,
      effectiveChangeRoutingKey: simulatorConfig.pdChangeEventsRoutingKey ?? null,
      notes: 'No mapping profile provided; using logical service name and default keys.',
    };
  }

  const mapping = profile.serviceMappings.find(
    (item) => item.logicalServiceName === logicalServiceName
  );

  if (!mapping) {
    const fallbackRoutingKey =
      type === 'change' ? null : profile.globalIncidentRoutingKey ?? null;

    return {
      effectiveServiceName: logicalServiceName,
      effectiveRoutingKey: fallbackRoutingKey,
      effectiveChangeRoutingKey: simulatorConfig.pdChangeEventsRoutingKey ?? null,
      usedProfileId: profile.id,
      notes: 'Mapping not found; using logical service name and profile/global keys.',
    };
  }

  if (type === 'change') {
    const useIncidentMapping =
      mapping.useIncidentForChange || (!mapping.changeServiceId && !mapping.changeServiceName);
    const effectiveChangeName = useIncidentMapping
      ? mapping.incidentServiceName ?? logicalServiceName
      : mapping.changeServiceName ?? logicalServiceName;
    const effectiveChangeId = useIncidentMapping ? mapping.incidentServiceId : mapping.changeServiceId;

    return {
      effectiveServiceName: effectiveChangeName,
      effectiveServiceId: effectiveChangeId ?? undefined,
      effectiveRoutingKey: null,
      effectiveChangeRoutingKey: mapping.changeRoutingKeyOverride ?? simulatorConfig.pdChangeEventsRoutingKey ?? null,
      usedProfileId: profile.id,
      notes: useIncidentMapping
        ? 'Resolved change event using incident mapping (useIncidentForChange=true or no explicit change mapping).'
        : 'Resolved change event using explicit change mapping.',
    };
  }

  const routingKey =
    mapping.incidentRoutingKeyOverride ?? profile.globalIncidentRoutingKey ?? null;

  return {
    effectiveServiceName: mapping.incidentServiceName ?? logicalServiceName,
    effectiveServiceId: mapping.incidentServiceId ?? undefined,
    effectiveRoutingKey: routingKey,
    effectiveChangeRoutingKey: null,
    usedProfileId: profile.id,
    notes: mapping.incidentRoutingKeyOverride
      ? 'Resolved incident/alert using mapping override routing key.'
      : 'Resolved incident/alert using mapping; falling back to profile/global routing key if present.',
  };
}
