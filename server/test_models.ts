import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("No API KEY");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function list() {
    try {
        // Note: The SDK might not expose listModels directly on the main class in all versions, 
        // but usually we can just try to generate content with a known model or check documentation.
        // Actually, for this debug, let's just try to hit the model directly and catch the error more verbosely if possible.
        // But wait, the error message 'Call ListModels' suggests it's possible. 
        // The JS SDK doesn't always expose ListModels easily.
        
        // Let's try 'gemini-1.5-flash' again but maybe the user is in a region where it's not available?
        
        // Let's try a very standard one.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log("Success with gemini-1.5-flash:", result.response.text());
    } catch (e: any) {
        console.error("Error with gemini-1.5-flash:", e.message);
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Hello");
        console.log("Success with gemini-pro:", result.response.text());
    } catch (e: any) {
        console.error("Error with gemini-pro:", e.message);
    }
}

list();
