/**
 * VoteVerify - Bias Detection & Quality Control Service
 * Validates AI responses before delivery to users
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
      
      // Evaluate response
      console.log(' Evaluating quality...');
      const evaluation = await evaluateResponse(response, context);
      lastEvaluation = evaluation;
      
      // Store in history
      history.push({
        attempt: attempts,
        response: response,
        evaluation: evaluation,
        action: evaluation.finalDecision.action
      });
      
      // Check decision
      const action = evaluation.finalDecision.action;
      
      if (action === 'approve') {
        console.log('\n Response APPROVED - Quality standards met');
        return {
          success: true,
          response: response,
          evaluation: evaluation,
          attempts: attempts,
          history: history
        };
      }
      
      if (action === 'approve_with_warning') {
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
      
      if (action === 'reject') {
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
      
      if (action === 'reloop') {
        console.log('\n RELOOP REQUIRED');
        console.log('Reason:', evaluation.finalDecision.reasoning);
        console.log('Improvements needed:', evaluation.finalDecision.improvementNeeded);
        
        if (attempts < maxAttempts) {
          console.log('\n⏳ Regenerating with improvements...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Brief pause
        } else {
          console.log('\n  Max attempts reached - returning last attempt');
          return {
            success: false,
            error: 'Max reloop attempts reached',
            response: response,
            evaluation: evaluation,
            attempts: attempts,
            history: history
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
 * @param {Object|String} response - Response to check
 * @param {String} context - Context description
 * @returns {Object} { passed, evaluation }
 */
export async function quickBiasCheck(response, context = '') {
  try {
    const evaluation = await evaluateResponse(response, context);
    const action = evaluation.finalDecision.action;
    
    return {
      passed: action === 'approve' || action === 'approve_with_warning',
      evaluation: evaluation,
      needsReloop: action === 'reloop',
      rejected: action === 'reject'
    };
  } catch (error) {
    console.error('Quick bias check failed:', error.message);
    return {
      passed: false,
      error: error.message,
      needsReloop: false,
      rejected: false
    };
  }
}

export default {
  evaluateResponse,
  validateWithReloop,
  quickBiasCheck
};

