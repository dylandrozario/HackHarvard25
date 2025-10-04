import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// BRONZE: GENERATE HISTORICAL PROMISES
export async function generateHistoricalPromises(president, yearStart, yearEnd) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not found in environment variables');
  }

  const prompt = `You are a political historian analyzing ${president}'s presidency from ${yearStart}-${yearEnd}.

Generate exactly 15-20 major political promises made during this period. Return ONLY valid JSON array, no markdown.

CRITICAL CREDIBILITY REQUIREMENTS:
- Evidence MUST include specific Executive Orders, Bills, or Actions with numbers
- Sources MUST be FULL URLs, not just domain names
- Evidence MUST be verifiable facts, not vague statements

Example of GOOD evidence:
"evidence": ["Executive Order 13767 signed Jan 25, 2017", "H.R. 6147 appropriated $1.6B for border wall"]
"sources": ["https://www.whitehouse.gov/presidential-actions/executive-order-border-security-immigration-enforcement-improvements/"]

Example of BAD evidence:
"evidence": ["Executive order", "Congressional action"]
"sources": ["https://www.whitehouse.gov/"]

For each promise:
1. Extract exact promise text
2. Determine affected industries (2-5 max)
3. Predict impact direction (positive/negative) per industry
4. Provide confidence score based on economic theory

CRITICAL: Base predictions on ECONOMIC LOGIC at time promise was made:
- "Build nuclear plants" → Nuclear POSITIVE, Coal/Gas NEGATIVE
- "Immigration crackdown" → Agriculture NEGATIVE (labor), Border Security POSITIVE

Return JSON:
[
  {
    "president": "${president}",
    "promise": "exact promise text",
    "date": "YYYY-MM-DD",
    "category": "Energy|Healthcare|Immigration|Trade|Economy|Defense",
    "status": "kept|broken|partial",
    "affectedIndustries": [
      {
        "name": "Nuclear Energy",
        "predictedImpact": "positive",
        "confidence": 85,
        "reasoning": "Direct government investment"
      }
    ],
    "evidence": ["Specific bill/action/speech"],
    "sources": ["credible URL 1", "credible URL 2"]
  }
]`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    const text = response.text;
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error(`Failed to generate promises: ${error.message}`);
  }
}

// BRONZE: ANALYZE PROMISE (when user clicks)
export async function analyzePromise(promise) {
  const prompt = `Provide detailed analysis of this political promise's current status.

Promise: "${promise.promise}"
President: ${promise.president}
Date Made: ${promise.date}
Status: ${promise.status}
Affected Industries: ${promise.affectedIndustries?.map(i => i.name).join(', ')}

Provide:
1. Current status update (2-3 sentences)
2. Key developments since ${promise.date}
3. Updated confidence score (0-100)
4. Recent credible sources

Return ONLY valid JSON:
{
  "analysis": "Detailed 3-4 sentence analysis",
  "confidence": 85,
  "lastUpdated": "2025-10-04",
  "keyDevelopments": [
    "Development 1 with date",
    "Development 2 with date"
  ],
  "sources": ["URL 1", "URL 2"]
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    const text = response.text;
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error(`Failed to analyze promise: ${error.message}`);
  }
}