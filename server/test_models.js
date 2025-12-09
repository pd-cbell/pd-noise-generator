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
const generative_ai_1 = require("@google/generative-ai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("No API KEY");
    process.exit(1);
}
const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
function list() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Note: The SDK might not expose listModels directly on the main class in all versions, 
            // but usually we can just try to generate content with a known model or check documentation.
            // Actually, for this debug, let's just try to hit the model directly and catch the error more verbosely if possible.
            // But wait, the error message 'Call ListModels' suggests it's possible. 
            // The JS SDK doesn't always expose ListModels easily.
            // Let's try 'gemini-1.5-flash' again but maybe the user is in a region where it's not available?
            // Let's try a very standard one.
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const result = yield model.generateContent("Hello");
            console.log("Success with gemini-1.5-flash:", result.response.text());
        }
        catch (e) {
            console.error("Error with gemini-1.5-flash:", e.message);
        }
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = yield model.generateContent("Hello");
            console.log("Success with gemini-pro:", result.response.text());
        }
        catch (e) {
            console.error("Error with gemini-pro:", e.message);
        }
    });
}
list();
