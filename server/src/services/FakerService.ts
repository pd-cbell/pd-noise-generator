import { faker } from '@faker-js/faker';

export class FakerService {
  
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
        const parts = path.split('.').slice(1); // Remove 'faker' prefix
        let current: any = faker;
        
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
                  // Naive arg parsing: splits by comma, parses numbers/booleans/strings
                  args = argsString.split(',').map((arg: string) => {
                      arg = arg.trim();
                      if (!isNaN(Number(arg))) return Number(arg);
                      if (arg === 'true') return true;
                      if (arg === 'false') return false;
                      // Remove quotes if present
                      if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
                          return arg.slice(1, -1);
                      }
                      return arg;
                  });
               }
            }
          }

          if (current[part] === undefined) {
            console.warn(`FakerService: Unknown token ${path} (at '${part}')`);
            return match;
          }
          current = current[part];

          // If it's a function and we are at the end OR it's a method call in the middle (less common in faker v9 but possible)
          // Actually in Faker v9, most things are methods.
          // If we parsed args, we MUST call it.
          // If we didn't parse args, but it is a function, we usually call it (unless it's a module).
          // Heuristic: If it has args, call it. If it is a function and we are at the last part, call it.
          
          const isFunc = typeof current === 'function';
          if (isFunc && (args.length > 0 || i === parts.length - 1)) {
             try {
                 current = current.apply(faker, args);
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
