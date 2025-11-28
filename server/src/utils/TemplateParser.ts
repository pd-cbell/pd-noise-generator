import { faker } from '@faker-js/faker';

export class TemplateParser {
  /**
   * Parses a string (or stringified JSON) and replaces template tags.
   * Supported tags:
   * - {{faker.module.method}} e.g. {{faker.internet.email}}
   * - {{int(min,max)}} e.g. {{int(10,100)}}
   * - {{randhex(len)}} e.g. {{randhex(16)}}
   * - {{ip}}
   * - {{timestamp(offset_sec)}} e.g. {{timestamp(-60)}}
   */
  static parse(input: string): string {
    if (!input) return input;

    // 1. Faker replacement: {{faker.module.method}}
    let output = input.replace(/\{\{faker\.(\w+)\.(\w+)\}\}/g, (_match, module, method) => {
      // @ts-ignore
      const fn = faker[module]?.[method];
      return typeof fn === 'function' ? fn() : _match;
    });

    // 2. Crux Integers: {{int(min,max)}}
    output = output.replace(/\{\{int\((\d+),(\d+)\)\}\}/g, (_match, min, max) => {
      return faker.number.int({ min: parseInt(min), max: parseInt(max) }).toString();
    });

    // 3. Crux Hex: {{randhex(len)}}
    output = output.replace(/\{\{randhex\((\d+)\)\}\}/g, (_match, len) => {
      return faker.string.hexadecimal({ length: parseInt(len) }).slice(2); // remove 0x prefix if needed? Crux usually implies plain hex.
    });

    // 4. Crux IP: {{ip}}
    output = output.replace(/\{\{ip\}\}/g, () => {
      return faker.internet.ipv4();
    });

    // 5. Crux Timestamp: {{timestamp(offset)}} (ISO 8601)
    output = output.replace(/\{\{timestamp\((\-?\d+)\)\}\}/g, (_match, offset) => {
      const d = new Date();
      d.setSeconds(d.getSeconds() + parseInt(offset));
      return d.toISOString();
    });
    
    // 6. List Choice: {{list(a, b, c)}}
    output = output.replace(/\{\{list\((.*?)\)\}\}/g, (_match, content) => {
        const items = content.split(',').map(s => s.trim());
        return faker.helpers.arrayElement(items);
    });

    return output;
  }

  static parseObject(obj: any): any {
    const str = JSON.stringify(obj);
    const parsed = this.parse(str);
    return JSON.parse(parsed);
  }
}
