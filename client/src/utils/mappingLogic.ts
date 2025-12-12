import { MappingProfile, ServiceMapping } from '../store/useStore';

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
  // New field to indicate if mapping was found
  isMapped: boolean;
  // New field to indicate if routing key is present
  hasRoutingKey: boolean;
}

export function resolveServicePreview(
  logicalTarget: LogicalEventTarget,
  profile: MappingProfile | null,
  simulatorConfig: SimulatorConfig
): ResolvedTarget {
  const { logicalServiceName, type } = logicalTarget;

  if (!profile) {
    return {
      effectiveServiceName: logicalServiceName,
      effectiveRoutingKey: null,
      effectiveChangeRoutingKey: simulatorConfig.pdChangeEventsRoutingKey ?? null,
      notes: 'No mapping profile provided; using logical service name and default keys.',
      isMapped: false,
      hasRoutingKey: false,
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
      isMapped: false,
      hasRoutingKey: !!fallbackRoutingKey || !!simulatorConfig.pdChangeEventsRoutingKey,
    };
  }

  if (type === 'change') {
    const useIncidentMapping =
      mapping.useIncidentForChange || (!mapping.changeServiceId && !mapping.changeServiceName);
    const effectiveChangeName = useIncidentMapping
      ? mapping.incidentServiceName ?? logicalServiceName
      : mapping.changeServiceName ?? logicalServiceName;
    const effectiveChangeId = useIncidentMapping ? mapping.incidentServiceId : mapping.changeServiceId;
    const effectiveChangeRoutingKey = mapping.changeRoutingKeyOverride ?? simulatorConfig.pdChangeEventsRoutingKey ?? null;


    return {
      effectiveServiceName: effectiveChangeName,
      effectiveServiceId: effectiveChangeId ?? undefined,
      effectiveRoutingKey: null,
      effectiveChangeRoutingKey: effectiveChangeRoutingKey,
      usedProfileId: profile.id,
      notes: useIncidentMapping
        ? 'Resolved change event using incident mapping (useIncidentForChange=true or no explicit change mapping).'
        : 'Resolved change event using explicit change mapping.',
      isMapped: true,
      hasRoutingKey: !!effectiveChangeRoutingKey,
    };
  }

  const routingKey =
    mapping.incidentRoutingKeyOverride ?? profile.globalIncidentRoutingKey ?? null;

  return {
    effectiveServiceName: mapping.incidentServiceName ?? logicalServiceName,
    effectiveServiceId: mapping.incidentServiceId ?? undefined,
    effectiveRoutingKey: routingKey,
    effectiveChangeRoutingKey: null, // Incident events don't use change routing key
    usedProfileId: profile.id,
    notes: mapping.incidentRoutingKeyOverride
      ? 'Resolved incident/alert using mapping override routing key.'
      : 'Resolved incident/alert using mapping; falling back to profile/global routing key if present.',
    isMapped: true,
    hasRoutingKey: !!routingKey,
  };
}
