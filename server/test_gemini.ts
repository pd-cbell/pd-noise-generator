import dotenv from 'dotenv';
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("No GEMINI_API_KEY found.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        console.log("Fetching available models...");
        // There isn't a direct listModels method on the class instance in some versions, 
        // but let's try to just generate content with a few known models to see which one hits.
        
        const modelsToTry = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-001",
            "gemini-1.5-pro",
            "gemini-pro",
            "gemini-1.0-pro"
        ];

        for (const modelName of modelsToTry) {
            console.log(`Testing model: ${modelName}`);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Hello");
                const response = await result.response;
                console.log(`✅ SUCCESS: ${modelName} responded: ${response.text().substring(0, 20)}...`);
            } catch (e: any) {
                console.log(`❌ FAILED: ${modelName} - ${e.message.split('\n')[0]}`);
            }
        }

    } catch (e: any) {
        console.error("Fatal error:", e);
    }
}

listModels();
