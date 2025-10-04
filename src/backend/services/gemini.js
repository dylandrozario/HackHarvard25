import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';

// Initialize client only if API key is available
let ai = null;
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'placeholder_key') {
  try {
    ai = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY 
    });
  } catch (error) {
    console.warn('⚠️  Gemini API key invalid or missing. Using mock data.');
  }
}

export async function parsePromisesFromText(rawText, president) {
  if (!ai) {
    return [{
      president: president,
      promise: "Mock promise: Improve healthcare access",
      date: "2021-01-20",
      category: "Healthcare",
      status: "partial",
      source: "https://example.gov/mock",
      evidence: "Mock evidence"
    }];
  }

  const prompt = `
Extract political promises from this text into structured JSON.

Text: ${rawText}

Return ONLY a valid JSON array (no markdown, no explanation):
[
  {
    "president": "${president}",
    "promise": "exact promise text",
    "date": "YYYY-MM-DD",
    "category": "Healthcare|Economy|Immigration|Energy|Defense|Trade|Education",
    "status": "kept|broken|partial",
    "evidence": ["specific bill/EO/action"],
    "sources": ["URL from text"],
    "affectedIndustries": [
      {
        "name": "Industry Name",
        "predictedImpact": "positive|negative|mixed",
        "confidence": 75,
        "reasoning": "brief explanation"
      }
    ]
  }
]
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    
    const text = response.text;
    const cleaned = text.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
    const promises = JSON.parse(cleaned);
    
    return Array.isArray(promises) ? promises : [promises];
    
  } catch (error) {
    console.error('Gemini parsing failed:', error.message);
    return [];
  }
}

export async function analyzePromise(promise) {
  if (!ai) {
    return {
      analysis: `Mock analysis for: ${promise.promise}`,
      confidence: 0.5,
      developments: ["Mock development 1", "Mock development 2"],
      credibilityLevel: "medium",
      error: "Gemini API key not configured"
    };
  }

  const prompt = `
Analyze this political promise:

Promise: "${promise.promise}"
President: ${promise.president}
Date: ${promise.date}
Status: ${promise.status}

Provide current analysis (2-3 sentences), key developments, and updated confidence.

Return ONLY valid JSON:
{
  "analysis": "Current status and impact",
  "confidence": 85,
  "lastUpdated": "2025-10-04",
  "keyDevelopments": ["Development 1", "Development 2"],
  "sources": ["url1", "url2"]
}
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    
    const text = response.text;
    const cleaned = text.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
    return JSON.parse(cleaned);
    
  } catch (error) {
    console.error('Analysis failed:', error.message);
    return {
      analysis: "Analysis unavailable",
      confidence: 0,
      keyDevelopments: [],
      sources: []
    };
  }
}