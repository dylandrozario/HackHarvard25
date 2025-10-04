import { GoogleGenAI } from "@google/genai";
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
config({ path: path.join(__dirname, '../../../.env') });

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

/**
 * Analyze multiple promises together and provide an overall assessment
 * @param {Array} promises - Array of promise objects
 * @param {string} presidentName - Name of the president
 * @returns {Object} Combined analysis with overall scores and verdict
 */
export async function analyzeCombinedPromises(promises, presidentName) {
  if (!promises || promises.length === 0) {
    throw new Error('No promises provided for analysis');
  }

  // Prepare structured summary of all promises
  const promiseDetails = promises.map((p, idx) => {
    const stockInfo = p.actualMarketImpact && p.actualMarketImpact.industries 
      ? `\n   Market Data: ${p.actualMarketImpact.industries.length} industries analyzed, ` +
        `${p.actualMarketImpact.industries.filter(i => i.predictionAccuracy === 'correct').length} predictions correct`
      : '';
    
    return `
Promise ${idx + 1}:
  Text: "${p.promise}"
  Date: ${p.date}
  Category: ${p.category}
  Status: ${p.status}
  Evidence: ${p.evidence?.join('; ') || 'None'}
  Affected Industries: ${p.affectedIndustries?.map(i => i.name).join(', ') || 'None'}${stockInfo}
  Credibility: ${p.credibilityLevel || 'unknown'}
  Sources: ${p.realSources?.length || 0} verified sources
    `.trim();
  }).join('\n\n');

  const prompt = `
You are analyzing the OVERALL promise-keeping record for ${presidentName} based on ${promises.length} campaign promises.

${promiseDetails}

Provide a comprehensive overall assessment following the VoteVerify System Prompt guidelines.

Your analysis must include:

1. **OVERALL SCORE (0-100)**: 
   - Calculate based on the fuzzy matching algorithm across all promises
   - Consider: promise fulfillment rate, consistency, and impact
   - Formula guidance: (kept promises × 100) + (partial promises × 50) / total promises, adjusted for quality and context

2. **OVERALL RATING (1-5)**: 
   - 5 = Excellent (90-100): Nearly all promises kept with strong execution
   - 4 = Good (75-89): Most promises kept with minor gaps
   - 3 = Fair (60-74): Mixed record with some fulfillment
   - 2 = Poor (40-59): Many broken promises
   - 1 = Very Poor (0-39): Failed to deliver on most commitments

3. **PROMISE-KEEPING ANALYSIS**: 
   - Count and categorize: kept, partial, broken
   - Identify patterns (which categories performed best/worst)
   - Note any contradictions or inconsistencies
   - Assess follow-through quality

4. **MARKET PREDICTION ACCURACY** (if stock data available):
   - Analyze how many industry impact predictions were correct vs incorrect
   - Identify which sectors saw unexpected outcomes
   - Explain discrepancies (e.g., policy worked but macro factors dominated)
   - Calculate overall prediction accuracy rate

5. **STRENGTHS** (list 2-4):
   - Areas where promises were consistently kept
   - Categories with strong execution
   - Notable achievements or positive patterns

6. **WEAKNESSES** (list 2-4):
   - Areas where promises were broken or unfulfilled
   - Categories with poor execution
   - Notable failures or negative patterns

7. **SCORE JUSTIFICATION**:
   - Explain the mathematical calculation of the 0-100 score
   - Break down points awarded/deducted for each promise
   - Show how individual promise scores contributed to overall score

8. **FINAL VERDICT** (2-3 sentences):
   - Summarize the president's overall promise-keeping record
   - Provide historical context
   - Offer balanced assessment of strengths vs weaknesses

Return ONLY valid JSON (no markdown, no code blocks):
{
  "president": "${presidentName}",
  "overallScore": 75,
  "overallRating": 4,
  "promiseBreakdown": {
    "total": ${promises.length},
    "kept": 0,
    "partial": 0,
    "broken": 0,
    "keepRate": 0.0
  },
  "marketAccuracy": {
    "totalPredictions": 0,
    "correct": 0,
    "incorrect": 0,
    "mixed": 0,
    "accuracyRate": 0.0,
    "analysis": "Detailed analysis of market prediction accuracy..."
  },
  "categoryAnalysis": [
    {
      "category": "Economy",
      "promiseCount": 2,
      "kept": 1,
      "performance": "good|fair|poor"
    }
  ],
  "strengths": [
    "Strength 1 with specific examples",
    "Strength 2 with specific examples"
  ],
  "weaknesses": [
    "Weakness 1 with specific examples",
    "Weakness 2 with specific examples"
  ],
  "scoreJustification": "Detailed breakdown: Started with base of 50. Promise 1 (kept): +25 points. Promise 2 (partial): +12 points...",
  "verdict": "2-3 sentence final assessment with historical context",
  "confidence": "high|medium|low",
  "analysisDate": "${new Date().toISOString()}"
}
  `.trim();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    
    const text = response.text;
    const cleaned = text.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
    const result = JSON.parse(cleaned);
    
    // Add metadata
    result.promisesAnalyzed = promises.length;
    result.dataSource = 'gemini-2.5-flash';
    result.generatedAt = new Date().toISOString();
    
    return result;
    
  } catch (error) {
    console.error('Combined analysis failed:', error.message);
    throw new Error(`Failed to generate combined analysis: ${error.message}`);
  }
}

/**
 * Get overall statistics for a set of promises
 * @param {Array} promises - Array of promise objects
 * @returns {Object} Statistical summary
 */
export function getPromiseStatistics(promises) {
  const stats = {
    total: promises.length,
    kept: promises.filter(p => p.status === 'kept').length,
    broken: promises.filter(p => p.status === 'broken').length,
    partial: promises.filter(p => p.status === 'partial').length,
    withStockData: promises.filter(p => 
      p.actualMarketImpact && 
      p.actualMarketImpact.industries && 
      p.actualMarketImpact.industries.length > 0
    ).length,
    verified: promises.filter(p => p.verified).length,
    highCredibility: promises.filter(p => p.credibilityLevel === 'high').length
  };
  
  stats.keepRate = (stats.kept / stats.total * 100).toFixed(1);
  stats.verificationRate = (stats.verified / stats.total * 100).toFixed(1);
  
  // Category breakdown
  stats.byCategory = {};
  promises.forEach(p => {
    if (!stats.byCategory[p.category]) {
      stats.byCategory[p.category] = { total: 0, kept: 0, broken: 0, partial: 0 };
    }
    stats.byCategory[p.category].total++;
    stats.byCategory[p.category][p.status]++;
  });
  
  // Market prediction accuracy
  if (stats.withStockData > 0) {
    let totalPredictions = 0;
    let correctPredictions = 0;
    
    promises.forEach(p => {
      if (p.actualMarketImpact?.industries) {
        p.actualMarketImpact.industries.forEach(ind => {
          totalPredictions++;
          if (ind.predictionAccuracy === 'correct') {
            correctPredictions++;
          }
        });
      }
    });
    
    stats.marketAccuracy = {
      total: totalPredictions,
      correct: correctPredictions,
      rate: totalPredictions > 0 
        ? (correctPredictions / totalPredictions * 100).toFixed(1)
        : 0
    };
  }
  
  return stats;
}

