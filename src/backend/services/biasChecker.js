/**
 * VoteVerify - Bias Detection & Quality Control Service
 * Validates AI responses before delivery to users
 * Now with Multi-AI support (Gemini + Cloudflare Workers AI)
 */

import { GoogleGenAI } from "@google/genai";
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
config({ path: path.join(__dirname, '../../../.env') });

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

// Check if multi-AI is available
// Multi-AI enabled: Uses both Gemini and Cloudflare for cross-validation
// Note: Cloudflare tends to be more lenient on hallucination detection
const MULTI_AI_ENABLED = !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);

// Log multi-AI status on module load
if (MULTI_AI_ENABLED) {
  console.log('✅ Multi-AI Bias Detection ENABLED (Gemini + Cloudflare Workers AI)');
} else {
  console.log('⚠️  Multi-AI Bias Detection DISABLED (using Gemini only)');
  console.log('   → Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to .env to enable');
}

/**
 * Get the bias checker system prompt from Python
 */
function getBiasCheckerPrompt() {
  try {
    const result = execSync(`python3 -c "import sys; sys.path.insert(0, '${__dirname}'); from bias_checker import get_bias_checker_prompt; print(get_bias_checker_prompt())"`, {
      cwd: __dirname,
      encoding: 'utf8'
    });
    
    return result.trim();
  } catch (error) {
    console.error('Failed to load bias checker prompt:', error.message);
    throw new Error('Bias checker system prompt not available');
  }
}

/**
 * Evaluate an AI response for bias, hallucinations, and quality
 * @param {Object|String} response - The AI response to evaluate
 * @param {String} context - Context about what was analyzed (e.g., "Barack Obama promise analysis")
 * @returns {Object} Evaluation result
 */
export async function evaluateResponse(response, context = '') {
  console.log(' Evaluating response for bias and quality...');
  
  const systemPrompt = getBiasCheckerPrompt();
  
  // Format the response for evaluation
  const responseText = typeof response === 'string' 
    ? response 
    : JSON.stringify(response, null, 2);
  
  const evaluationPrompt = `
${systemPrompt}

---

## RESPONSE TO EVALUATE

**Context**: ${context}

**Response**:
${responseText}

---

Evaluate this response according to all criteria above and return your analysis in the specified JSON format.
  `.trim();
  
  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: evaluationPrompt
    });
    
    const text = result.text;
    const cleaned = text.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
    const evaluation = JSON.parse(cleaned);
    
    console.log(` Bias Score: ${evaluation.biasDetection.score}/100 (${evaluation.biasDetection.level})`);
    console.log(` Hallucination Score: ${evaluation.hallucinationDetection.score}/100 (${evaluation.hallucinationDetection.level})`);
    console.log(` Satisfaction Score: ${evaluation.overallSatisfaction.score}/100`);
    console.log(`  Decision: ${evaluation.finalDecision.action.toUpperCase()}`);
    
    return evaluation;
    
  } catch (error) {
    console.error('Bias evaluation failed:', error.message);
    throw new Error(`Failed to evaluate response: ${error.message}`);
  }
}

/**
 * Validate a response with automatic reloop if needed
 * @param {Function} generateFn - Function to regenerate the response
 * @param {String} context - Context description
 * @param {Number} maxAttempts - Maximum reloop attempts (default: 3)
 * @returns {Object} { response, evaluation, attempts }
 */
export async function validateWithReloop(generateFn, context, maxAttempts = 3) {
  console.log(' Starting validation with reloop capability...\n');
  
  let attempts = 0;
  let lastResponse = null;
  let lastEvaluation = null;
  const history = [];
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`\n━━━━ ATTEMPT ${attempts}/${maxAttempts} ━━━━\n`);
    
    try {
      // Generate response
      console.log(' Generating response...');
      const response = await generateFn(lastEvaluation);
      lastResponse = response;
      
      // Evaluate response (uses multi-AI if available)
      console.log(' Evaluating quality...');
      const biasCheckResult = await quickBiasCheck(response, context);
      
      // Convert quickBiasCheck result to evaluation format
      let action;
      if (biasCheckResult.rejected) {
        action = 'reject';
      } else if (biasCheckResult.needsReloop) {
        action = 'reloop';
      } else if (biasCheckResult.passed) {
        // Could be 'approve' or 'approve_with_warning'
        // Check if evaluation exists and has decision
        action = biasCheckResult.evaluation?.finalDecision?.action || 'approve';
      } else {
        action = 'reject';
      }
      
      const evaluation = biasCheckResult.evaluation || {
        finalDecision: { action: action },
        biasDetection: { score: 0 },
        hallucinationDetection: { score: 0 },
        overallSatisfaction: { score: 0 }
      };
      
      // Ensure finalDecision has action
      if (!evaluation.finalDecision) {
        evaluation.finalDecision = { action: action };
      } else if (!evaluation.finalDecision.action) {
        evaluation.finalDecision.action = action;
      }
      
      lastEvaluation = evaluation;
      
      // Store in history
      history.push({
        attempt: attempts,
        response: response,
        evaluation: evaluation,
        action: evaluation.finalDecision.action
      });
      
      // Check decision (action already declared above)
      const finalAction = evaluation.finalDecision.action;
      
      if (finalAction === 'approve') {
        console.log('\n Response APPROVED - Quality standards met');
        return {
          success: true,
          response: response,
          evaluation: evaluation,
          attempts: attempts,
          history: history
        };
      }
      
      if (finalAction === 'approve_with_warning') {
        console.log('\n Response APPROVED WITH WARNING - Minor issues noted');
        return {
          success: true,
          response: response,
          evaluation: evaluation,
          attempts: attempts,
          warning: evaluation.finalDecision.reasoning,
          history: history
        };
      }
      
      if (finalAction === 'reject') {
        console.log('\n Response REJECTED - Severe quality issues');
        console.error('Rejection reason:', evaluation.finalDecision.reasoning);
        
        return {
          success: false,
          error: 'Response rejected due to severe quality issues',
          evaluation: evaluation,
          attempts: attempts,
          history: history
        };
      }
      
      if (finalAction === 'reloop') {
        console.log('\n RELOOP REQUIRED');
        console.log('Reason:', evaluation.finalDecision.reasoning);
        console.log('Improvements needed:', evaluation.finalDecision.improvementNeeded);
        
        if (attempts < maxAttempts) {
          console.log('\n⏳ Regenerating with improvements...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Brief pause
        } else {
          console.log('\n⚠️  Max attempts reached - selecting best attempt from history...');
          
          // Calculate quality score for each attempt (lower is better)
          const scoredAttempts = history.map(item => {
            const eval_data = item.evaluation;
            const bias = eval_data.biasDetection?.score || eval_data.averageScores?.bias || 50;
            const hallucination = eval_data.hallucinationDetection?.score || eval_data.averageScores?.hallucination || 50;
            const satisfaction = eval_data.overallSatisfaction?.score || eval_data.averageScores?.satisfaction || 50;
            
            // Quality score: Lower bias + lower hallucination + higher satisfaction = better
            const qualityScore = bias + hallucination + (100 - satisfaction);
            
            return {
              ...item,
              qualityScore: qualityScore,
              metrics: { bias, hallucination, satisfaction }
            };
          });
          
          // Sort by quality score (ascending - lower is better)
          scoredAttempts.sort((a, b) => a.qualityScore - b.qualityScore);
          
          const bestAttempt = scoredAttempts[0];
          
          console.log(`📊 Best attempt: #${bestAttempt.attempt}/${maxAttempts}`);
          console.log(`   Quality score: ${bestAttempt.qualityScore.toFixed(1)}/200`);
          console.log(`   Bias: ${bestAttempt.metrics.bias}/100`);
          console.log(`   Hallucination: ${bestAttempt.metrics.hallucination}/100`);
          console.log(`   Satisfaction: ${bestAttempt.metrics.satisfaction}/100\n`);
          
          return {
            success: true,
            response: bestAttempt.response,
            evaluation: bestAttempt.evaluation,
            attempts: attempts,
            history: history,
            warning: `Max reloop attempts reached (${maxAttempts}). Returning best quality attempt (#${bestAttempt.attempt}) with quality score ${bestAttempt.qualityScore.toFixed(1)}/200.`,
            bestAttemptSelected: true,
            bestAttemptNumber: bestAttempt.attempt,
            allAttempts: scoredAttempts.map(a => ({
              attempt: a.attempt,
              qualityScore: a.qualityScore,
              metrics: a.metrics
            }))
          };
        }
      }
      
    } catch (error) {
      console.error(` Attempt ${attempts} failed:`, error.message);
      
      if (attempts >= maxAttempts) {
        return {
          success: false,
          error: error.message,
          attempts: attempts,
          history: history
        };
      }
      
      console.log(' Retrying...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Should not reach here, but just in case
  return {
    success: false,
    error: 'Validation loop ended unexpectedly',
    response: lastResponse,
    evaluation: lastEvaluation,
    attempts: attempts,
    history: history
  };
}

/**
 * Quick bias check without reloop
 * Automatically uses Multi-AI if Cloudflare credentials are configured
 * @param {Object|String} response - Response to check
 * @param {String} context - Context description
 * @param {Boolean} forceMultiAi - Force multi-AI even if not default
 * @returns {Object} { passed, evaluation, method }
 */
export async function quickBiasCheck(response, context = '', forceMultiAi = false) {
  try {
    // Use multi-AI if enabled or forced
    if (MULTI_AI_ENABLED || forceMultiAi) {
      console.log('🔄 Using Multi-AI bias detection (Gemini + Cloudflare)');
      
      // Dynamically import to avoid circular dependency
      const { quickMultiAiCheck } = await import('./multiAiBiasChecker.js');
      const result = await quickMultiAiCheck(response, context);
      
      return {
        passed: result.passed,
        evaluation: result.evaluation,
        needsReloop: result.needsReloop,
        rejected: result.rejected,
        method: 'multi-ai',
        details: result.details
      };
    }
    
    // Fallback to single-AI (Gemini only)
    console.log('🔷 Using Single-AI bias detection (Gemini only)');
    const evaluation = await evaluateResponse(response, context);
    const action = evaluation.finalDecision.action;
    
    return {
      passed: action === 'approve' || action === 'approve_with_warning',
      evaluation: evaluation,
      needsReloop: action === 'reloop',
      rejected: action === 'reject',
      method: 'single-ai'
    };
  } catch (error) {
    console.error('Quick bias check failed:', error.message);
    return {
      passed: false,
      error: error.message,
      needsReloop: false,
      rejected: false,
      method: 'error'
    };
  }
}

export default {
  evaluateResponse,
  validateWithReloop,
  quickBiasCheck
};

