import { MappingProfile } from '../store/useStore';

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
  _simulatorConfig: SimulatorConfig
): ResolvedTarget {
  const { logicalServiceName, type } = logicalTarget;

  if (!profile) {
    return {
      effectiveServiceName: logicalServiceName,
      effectiveRoutingKey: null,
      effectiveChangeRoutingKey: null,
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
      effectiveChangeRoutingKey: null,
      usedProfileId: profile.id,
      notes: 'Mapping not found; using logical service name and profile/global keys.',
      isMapped: false,
      hasRoutingKey: !!fallbackRoutingKey,
    };
  }

  if (type === 'change') {
    const effectiveChangeName =
      mapping.changeServiceName ??
      mapping.incidentServiceName ??
      logicalServiceName;
    const effectiveChangeId = mapping.changeServiceId ?? mapping.incidentServiceId;
    const effectiveChangeRoutingKey =
      mapping.changeRoutingKeyOverride && mapping.changeRoutingKeyOverride.trim().length > 0
        ? mapping.changeRoutingKeyOverride.trim()
        : null;


    return {
      effectiveServiceName: effectiveChangeName,
      effectiveServiceId: effectiveChangeId ?? undefined,
      effectiveRoutingKey: null,
      effectiveChangeRoutingKey: effectiveChangeRoutingKey,
      usedProfileId: profile.id,
      notes: effectiveChangeRoutingKey
        ? 'Resolved change event using explicit change routing key mapping.'
        : 'Change service selected without an explicit change routing key; change remains unmapped.',
      isMapped: !!effectiveChangeRoutingKey,
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
