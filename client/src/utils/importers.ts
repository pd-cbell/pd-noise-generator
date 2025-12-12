export type ImportedGoldenDemoEvent = {
  id: string;
  type: string;
  logicalServiceName: string;
  summary: string;
  offsetMinutes?: number;
  offsetSeconds?: number;
  payloadText: string;
  repeatCount?: number;
  severity?: string;
  slackMessageTemplate?: string;
  intervalSeconds?: number;
  importMeta?: Record<string, any>;
  changeRoutingKey?: string;
  integrationKey?: string;
};

export type ImportFormat = 'campaignFailure' | 'cruxEventGroup' | 'unknown';

const safeStringify = (obj: any) => {
  try {
    return JSON.stringify(obj || {}, null, 2);
  } catch {
    return '{}';
  }
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}`;
};

const coerceLogicalService = (item: any, parsedPayload?: any): string => {
  return (
    item?.logicalServiceName ||
    item?.serviceName ||
    item?.service ||
    parsedPayload?.payload?.custom_details?.service_name ||
    ''
  );
};

export function detectImportFormat(data: any): ImportFormat {
  if (!data) return 'unknown';
  if (Array.isArray(data)) {
    // Heuristic: event_group_items inside entries -> crux
    if (data.some((entry) => entry?.event_group || entry?.event_group_items)) {
      return 'cruxEventGroup';
    }
    return 'campaignFailure';
  }

  if (data.event_group || data.event_group_items) return 'cruxEventGroup';
  if (data.items || data.steps || data.events) return 'campaignFailure';
  return 'unknown';
}

export function convertCampaignFailureToGoldenDemoItems(data: any): ImportedGoldenDemoEvent[] {
  const rawItems: any[] =
    (data && Array.isArray(data) && data) ||
    data?.items ||
    data?.steps ||
    data?.events ||
    [];

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('Unsupported campaign failure format: expected an array of items or items/steps/events properties.');
  }

  const normalized: ImportedGoldenDemoEvent[] = rawItems.map((item: any, idx: number) => {
    const logicalServiceName = coerceLogicalService(item, item.payload);
    if (!logicalServiceName) {
      throw new Error(`Missing logicalServiceName/service for item at index ${idx}.`);
    }
    const payload = item.payload || {};
    const type = item.eventType || item.type || 'alert';
    const summary = item.summary || item.stepName || payload.summary || '';
    const delaySeconds =
      typeof item.delaySeconds === 'number'
        ? item.delaySeconds
        : typeof item.offsetSeconds === 'number'
        ? item.offsetSeconds
        : undefined;
    const offsetMinutes =
      typeof item.offsetMinutes === 'number'
        ? item.offsetMinutes
        : typeof delaySeconds === 'number'
        ? Math.round(delaySeconds / 60)
        : 0;

    return {
      id: item.id || item.stepName || `import-${idx}`,
      type,
      logicalServiceName,
      summary,
      offsetMinutes,
      payloadText: safeStringify(payload),
      repeatCount: item.repeatCount || item.times || 1,
      severity: item.severity,
      slackMessageTemplate: item.slackMessageTemplate,
    };
  });

  return normalized;
}

export function convertCruxEventGroupToGoldenDemoItems(data: any): ImportedGoldenDemoEvent[] {
  const entries = Array.isArray(data) ? data : [data];
  const items: any[] = [];
  entries.forEach((entry: any) => {
    const group = entry?.event_group || entry;
    const groupItems = Array.isArray(group?.event_group_items) ? group.event_group_items : [];
    if (!groupItems.length) return;
    groupItems.forEach((item: any) => {
      items.push({ ...item, _group: group });
    });
  });

  if (!items.length) {
    throw new Error('Unsupported Crux format: expected event_group.event_group_items array.');
  }

  const normalized: ImportedGoldenDemoEvent[] = items.map((item: any, idx: number) => {
    let parsedPayload: any = {};
    if (typeof item.payload === 'string') {
      try {
        parsedPayload = JSON.parse(item.payload);
      } catch (e: any) {
        throw new Error(`Invalid payload JSON at index ${idx}: ${e.message || e}`);
      }
    } else if (item.payload) {
      parsedPayload = item.payload;
    }

    const logicalServiceName = coerceLogicalService(item, parsedPayload);
    if (!logicalServiceName) {
      throw new Error(`Missing logicalServiceName/service_name in payload for item at index ${idx}.`);
    }

    const type = item.event_type || item.eventType || 'alert';
    const delaySeconds = Number(item.delay_seconds) || 0;
    const repeatCount = Number(item.times) || 1;
    const intervalSeconds = Number(item.interval_seconds) || 0;

    return {
      id: item.id || item.stepName || generateId(),
      type,
      logicalServiceName,
      summary: item.summary || parsedPayload?.payload?.summary || item.name || '',
      offsetMinutes: Math.round(delaySeconds / 60),
      payloadText: safeStringify(parsedPayload),
      repeatCount,
      intervalSeconds,
      importMeta: {
        source: 'crux',
        eventAction: item.event_action,
        dedupKey: item.dedup_key,
        groupName: item._group?.name,
        groupHash: item._group?.hash_id,
      },
    };
  });

  return normalized;
}
