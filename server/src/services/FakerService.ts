import { faker } from '@faker-js/faker';

export class FakerService {
  private parseArgValue(rawArg: string): any {
    const arg = rawArg.trim();
    if (!arg.length) return '';
    if (!isNaN(Number(arg))) return Number(arg);
    if (arg === 'true') return true;
    if (arg === 'false') return false;
    if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
      return arg.slice(1, -1);
    }
    return arg;
  }

  private buildArgs(argsString: string): any[] {
    if (!argsString.trim()) return [];
    const parts = argsString.split(',').map((p) => p.trim()).filter(Boolean);
    const hasNamedArgs = parts.some((p) => p.includes('='));
    if (!hasNamedArgs) {
      return parts.map((p) => this.parseArgValue(p));
    }
    const named: Record<string, any> = {};
    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx).trim();
      const value = part.slice(eqIdx + 1).trim();
      if (key) named[key] = this.parseArgValue(value);
    }
    return [named];
  }

  private resolveLegacyAliases(parts: string[]): string[] {
    if (parts.length >= 2 && parts[0] === 'datatype' && parts[1] === 'uuid') {
      return ['string', 'uuid'];
    }
    if (parts.length >= 2 && parts[0] === 'datatype' && parts[1].startsWith('number')) {
      return ['number', parts[1].replace(/^number/, 'int')];
    }
    if (parts.length >= 2 && parts[0] === 'internet' && parts[1] === 'ip') {
      return ['internet', 'ipv4'];
    }
    return parts;
  }
  
  /**
   * Generates a Slack message, potentially enhanced by a persona, and renders faker tokens.
   */
  public getPersonaDrivenSlackMessage(templateString: string, persona: string | null = null): string {
    let message = templateString;

    if (persona) {
      switch (persona.toLowerCase()) {
        case 'anxious':
          message = `*Urgent!* :fearful: ${message} I'm really worried about this. Can someone *please* look?`;
          break;
        case 'professional':
          message = `*Incident Update*: ${message} Please investigate and provide an ETA.`;
          break;
        case 'casual':
          message = `Hey team, ${message} Looks like something's up. Anyone free to check it out? :man-shrugging:`;
          break;
        case 'sarcastic':
          message = `*Surprise, surprise*! :eyeroll: ${message} Because we *totally* needed another one of these.`;
          break;
        default:
          // Use original message if persona is unknown
          break;
      }
    }
    return this.renderString(message);
  }

  /**
   * Renders a string with {{faker...}} tokens.
   */
  public renderString(templateString: string): string {
    return templateString.replace(/\{\{(.*?)\}\}/g, (match, token) => {
        const path = token.trim();
        if (!path.startsWith('faker.')) {
          return match;
        }

        // Split by dots, but we need to handle "method(arg)" carefully if we want to support nested properties (though usually faker is flat-ish after module).
        // Simple approach: split by dot. If a part has '(', parse it.
        const parts = this.resolveLegacyAliases(path.split('.').slice(1)); // Remove 'faker' prefix
        let current: any = faker;
        let parent: any = faker;
        
        for (let i = 0; i < parts.length; i++) {
          let part = parts[i];
          let args: any[] = [];
          
          // Check for arguments: "alpha(3)"
          if (part.includes('(') && part.endsWith(')')) {
            const matchArgs = part.match(/^(.*?)\((.*?)\)$/);
            if (matchArgs) {
               part = matchArgs[1];
               const argsString = matchArgs[2];
               if (argsString) {
                  args = this.buildArgs(argsString);
               }
            }
          }

          if (current[part] === undefined) {
            console.warn(`FakerService: Unknown token ${path} (at '${part}')`);
            return match;
          }
          parent = current;
          current = current[part];

          // If it's a function and we are at the end OR it's a method call in the middle (less common in faker v9 but possible)
          // Actually in Faker v9, most things are methods.
          // If we parsed args, we MUST call it.
          // If we didn't parse args, but it is a function, we usually call it (unless it's a module).
          // Heuristic: If it has args, call it. If it is a function and we are at the last part, call it.
          
          const isFunc = typeof current === 'function';
          if (isFunc && (args.length > 0 || i === parts.length - 1)) {
             try {
                 current = current.apply(parent, args);
             } catch (e) {
                 console.warn(`FakerService: Failed to execute ${part}`, e);
                 return match;
             }
          }
        }

        return current;
    });
  }

  /**
   * Generates a payload object from a JSON template string containing mustache-style tokens.
   * E.g. "{{faker.internet.ip}}" -> "192.168.1.1"
   */
  public generatePayload(templateString: string): object {
    try {
      const renderedString = this.renderString(templateString);
      return JSON.parse(renderedString);
    } catch (error: any) {
      console.error("FakerService: Failed to generate payload", error);
      throw new Error(`Failed to render template: ${error.message}`);
    }
  }
}

export const fakerService = new FakerService();
