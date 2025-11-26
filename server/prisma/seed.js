"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const templatesDir = path_1.default.join(__dirname, '../../client/public/templates');
        console.log(`[Seed] Reading templates from ${templatesDir}`);
        try {
            const files = yield promises_1.default.readdir(templatesDir);
            const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'index.json');
            console.log(`[Seed] Found JSON files: ${jsonFiles.join(', ')}`);
            for (const file of jsonFiles) {
                const filePath = path_1.default.join(templatesDir, file);
                console.log(`[Seed] Processing ${filePath}...`);
                const content = yield promises_1.default.readFile(filePath, 'utf-8');
                const data = JSON.parse(content);
                const campaignGroups = Array.isArray(data) ? data : [data];
                console.log(`[Seed] Found ${campaignGroups.length} potential campaign groups in ${file}.`);
                for (const group of campaignGroups) {
                    console.log(`[Seed] Current group object structure: ${JSON.stringify(group, null, 2)}`); // Log group structure
                    const meta = group.event_group || group;
                    console.log(`[Seed] Meta object structure (after event_group check): ${JSON.stringify(meta, null, 2)}`); // Log meta structure
                    const items = Array.isArray(meta === null || meta === void 0 ? void 0 : meta.event_group_items) ? meta.event_group_items : [];
                    console.log(`[Seed] meta.event_group_items: ${JSON.stringify(meta === null || meta === void 0 ? void 0 : meta.event_group_items, null, 2)}`); // Log raw items array from meta
                    console.log(`[Seed] Items after Array.isArray check: ${items.length}`); // Log items.length
                    if (!items.length) {
                        console.log(`[Seed] Skipping campaign (no items found after parsing).`);
                        continue;
                    }
                    const campaignName = `${meta.name} (from ${file})`; // Make name unique
                    // Check uniqueness by name to avoid dupes on re-seed
                    const existing = yield prisma.campaign.findFirst({
                        where: { name: campaignName }
                    });
                    if (existing) {
                        console.log(`[Seed] Campaign "${campaignName}" already exists in DB (ID: ${existing.id}). Skipping.`);
                        continue;
                    }
                    yield prisma.campaign.create({
                        data: {
                            name: campaignName,
                            description: meta.description,
                            source: file,
                            items: {
                                create: items.map((item, idx) => ({
                                    order: idx,
                                    payload: typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload,
                                    eventAction: item.event_action || 'trigger',
                                    eventType: item.event_type || 'alert',
                                    dedupKey: item.dedup_key,
                                    delaySeconds: Number(item.delay_seconds) || 0,
                                    repeatCount: Number(item.times) || 1,
                                    intervalSeconds: Number(item.interval_seconds) || 0,
                                }))
                            }
                        }
                    });
                    console.log(`[Seed] Created campaign: "${meta.name}" with ${items.length} steps.`);
                }
            }
        }
        catch (e) {
            console.error('[Seed] Seeding failed:', e);
        }
    });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma.$disconnect();
}));
