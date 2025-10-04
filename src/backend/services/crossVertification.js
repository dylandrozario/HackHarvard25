import { analyzePromise } from './gemini.js';
import { verifyPromise } from './perplexity.js';

export async function crossVerifyPromise(promiseText) {
  try {
    // Run both AI analyses in parallel for speed
    const [geminiAnalysis, perplexityCheck] = await Promise.all([
      analyzePromise(promiseText),
      verifyPromise(promiseText)
    ]);
    
    // Calculate agreement score
    const agreementScore = calculateAgreement(
      geminiAnalysis.analysis || '',
      perplexityCheck.analysis || ''
    );
    
    // Determine bias warning threshold
    const biasWarning = agreementScore < 60 
      ? 'Low AI consensus - verify with original sources' 
      : null;
    
    return {
      gemini: {
        analysis: geminiAnalysis.analysis || 'No analysis available',
        timestamp: new Date().toISOString()
      },
      perplexity: {
        analysis: perplexityCheck.analysis || 'No analysis available',
        timestamp: new Date().toISOString()
      },
      agreementScore,
      biasWarning,
      verifiedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Cross-verification error:', error);
    throw new Error(`Cross-verification failed: ${error.message}`);
  }
}

function calculateAgreement(text1, text2) {
  // Handle empty inputs
  if (!text1 || !text2) return 0;
  
  // Normalize and tokenize text
  const normalize = (text) => text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 3); // Filter out short words
  
  const words1 = new Set(normalize(text1));
  const words2 = new Set(normalize(text2));
  
  // Calculate Jaccard similarity
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  // Avoid division by zero
  if (union.size === 0) return 0;
  
  return Math.round((intersection.size / union.size) * 100);
}

// Optional: More sophisticated agreement calculation
export function calculateSemanticAgreement(text1, text2) {
  // Extract key phrases and compare
  const extractKeyPhrases = (text) => {
    const phrases = [];
    const sentences = text.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      // Look for definitive statements
      if (sentence.match(/\b(fulfilled|broken|partially|implemented|failed)\b/i)) {
        phrases.push(sentence.trim().toLowerCase());
      }
    }
    
    return phrases;
  };
  
  const phrases1 = extractKeyPhrases(text1);
  const phrases2 = extractKeyPhrases(text2);
  
  // Compare key phrase agreement
  let matches = 0;
  for (const p1 of phrases1) {
    for (const p2 of phrases2) {
      // Simple similarity check
      const similarity = calculateAgreement(p1, p2);
      if (similarity > 50) matches++;
    }
  }
  
  const totalPhrases = Math.max(phrases1.length, phrases2.length);
  return totalPhrases > 0 ? Math.round((matches / totalPhrases) * 100) : 0;
}