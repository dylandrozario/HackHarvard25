/**
 * VoteVerify - Multi-AI Bias Checker
 * Uses both Gemini and Cloudflare Workers AI for cross-validation
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

const geminiAi = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

// Cloudflare Workers AI configuration
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run`;

// Llama 3.1 8B Instruct - Original model (smaller, faster)
const CF_MODEL = process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.1-8b-instruct';

/**
 * Get the bias checker system prompt
 */
function getBiasCheckerPrompt() {
  try {
    // Allow overriding the python binary via env (useful when no venv exists)
    const pythonPath = process.env.PYTHON_PATH || (() => {
      try {
        // Prefer system python3 if available on PATH
        const whichPath = execSync('which python3', { encoding: 'utf8' }).trim();
        return whichPath || 'python3';
      } catch (e) {
        return 'python3';
      }
    })();

    const result = execSync(
      `${pythonPath} -c "from bias_checker import get_bias_checker_prompt; print(get_bias_checker_prompt())"`,
      { cwd: __dirname, encoding: 'utf8' }
    );

    return result.trim();
  } catch (error) {
    console.error('Failed to load bias checker prompt:', error.message);
    console.error('Tip: set PYTHON_PATH to your python binary (e.g. /usr/bin/python3) or create a venv at project root');
    throw new Error('Bias checker system prompt not available');
  }
}

/**
 * Evaluate response using Gemini
 */
async function evaluateWithGemini(response, context) {
  console.log('Gemini evaluation started...');
  
  const systemPrompt = getBiasCheckerPrompt();
  const responseText = typeof response === 'string' 
    ? response 
    : JSON.stringify(response, null, 2);
  
  const prompt = `${systemPrompt}\n\n---\n\n## RESPONSE TO EVALUATE\n\n**Context**: ${context}\n\n**Response**:\n${responseText}\n\n---\n\nEvaluate this response and return your analysis in the specified JSON format.`.trim();
  
  try {
    const result = await geminiAi.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    
    const text = result.text;
    const cleaned = text.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
    const evaluation = JSON.parse(cleaned);
    
    console.log(`Gemini: Bias=${evaluation.biasDetection.score}/100, Hallucination=${evaluation.hallucinationDetection.score}/100, Satisfaction=${evaluation.overallSatisfaction.score}/100`);
    
    return {
      model: 'gemini-2.5-flash',
      evaluation: evaluation,
      success: true
    };
    
  } catch (error) {
    console.error('Gemini evaluation failed:', error.message);
    return {
      model: 'gemini-2.5-flash',
      evaluation: null,
      success: false,
      error: error.message
    };
  }
}

/**
 * Evaluate response using Cloudflare Workers AI (Llama 3.1)
 */
async function evaluateWithCloudflare(response, context) {
  console.log('Cloudflare AI evaluation started...');
  
  const systemPrompt = getBiasCheckerPrompt();
  const responseText = typeof response === 'string' 
    ? response 
    : JSON.stringify(response, null, 2);
  
  const prompt = `${systemPrompt}\n\n---\n\n## RESPONSE TO EVALUATE\n\n**Context**: ${context}\n\n**Response**:\n${responseText}\n\n---\n\nEvaluate this response and return your analysis in the specified JSON format.`.trim();
  
  try {
    const apiResponse = await fetch(`${CF_API_BASE}/${CF_MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a bias detection expert. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2500,  // Increased for larger model
        temperature: 0.1   // Lower temperature for more consistent evaluation
      })
    });
    
    if (!apiResponse.ok) {
      throw new Error(`Cloudflare API error: ${apiResponse.status} ${apiResponse.statusText}`);
    }
    
    const data = await apiResponse.json();
    const text = data.result.response;
    
    // Clean and parse JSON
    const cleaned = text.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
    const evaluation = JSON.parse(cleaned);
    
    // Validate evaluation structure
    if (!evaluation.biasDetection || !evaluation.hallucinationDetection || !evaluation.overallSatisfaction) {
      throw new Error('Cloudflare returned incomplete evaluation structure');
    }
    
    // Warning if hallucination score is suspiciously low
    if (evaluation.hallucinationDetection.score === 0) {
      console.log('⚠️  Cloudflare reported 0% hallucination - this may indicate evaluation issues');
    }
    
    console.log(`Cloudflare (${CF_MODEL}): Bias=${evaluation.biasDetection.score}/100, Hallucination=${evaluation.hallucinationDetection.score}/100, Satisfaction=${evaluation.overallSatisfaction.score}/100`);
    
    return {
      model: CF_MODEL.replace('@cf/meta/', ''),  // Clean model name
      evaluation: evaluation,
      success: true
    };
    
  } catch (error) {
    console.error('Cloudflare evaluation failed:', error.message);
    return {
      model: CF_MODEL.replace('@cf/meta/', ''),  // Clean model name
      evaluation: null,
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate consensus scores from multiple evaluations
 */
function calculateConsensus(evaluations) {
  const successful = evaluations.filter(e => e.success);
  
  if (successful.length === 0) {
    return {
      consensusReached: false,
      error: 'All AI models failed to evaluate'
    };
  }
  
  // Check for suspicious patterns (e.g., model always returns 0 for hallucination)
  const warnings = [];
  successful.forEach(result => {
    if (result.evaluation.hallucinationDetection.score === 0 && 
        result.model.includes('llama')) {
      warnings.push(`${result.model} reported 0% hallucination - may be unreliable for this metric`);
    }
  });
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Model Reliability Warnings:');
    warnings.forEach(w => console.log(`   - ${w}`));
    console.log('');
  }
  
  // Calculate average scores
  const biasScores = successful.map(e => e.evaluation.biasDetection.score);
  const hallucinationScores = successful.map(e => e.evaluation.hallucinationDetection.score);
  const satisfactionScores = successful.map(e => e.evaluation.overallSatisfaction.score);
  
  const avgBias = Math.round(biasScores.reduce((a, b) => a + b, 0) / biasScores.length);
  const avgHallucination = Math.round(hallucinationScores.reduce((a, b) => a + b, 0) / hallucinationScores.length);
  const avgSatisfaction = Math.round(satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length);
  
  // Check for disagreement (difference > 20 points)
  const biasDisagreement = Math.max(...biasScores) - Math.min(...biasScores) > 20;
  const hallucinationDisagreement = Math.max(...hallucinationScores) - Math.min(...hallucinationScores) > 20;
  const satisfactionDisagreement = Math.max(...satisfactionScores) - Math.min(...satisfactionScores) > 20;
  
  const hasDisagreement = biasDisagreement || hallucinationDisagreement || satisfactionDisagreement;
  
  // Determine consensus decision (using stricter thresholds if disagreement)
  let decision;
  let improvementNeeded = [];
  
  if (hasDisagreement) {
    // If models disagree, be more conservative
    if (avgBias > 30 || avgHallucination > 10 || avgSatisfaction < 50) {
      decision = 'reloop';
      
      // Provide specific improvement guidance
      if (avgBias > 30) {
        improvementNeeded.push(`Reduce political bias (current: ${avgBias}/100). Present both perspectives equally and use neutral language.`);
      }
      if (avgHallucination > 10) {
        improvementNeeded.push(`Reduce hallucinations (current: ${avgHallucination}/100). Only cite verifiable facts with proper sources.`);
      }
      if (avgSatisfaction < 50) {
        improvementNeeded.push(`Improve completeness (current: ${avgSatisfaction}/100). Provide more comprehensive analysis with better evidence.`);
      }
      if (hasDisagreement) {
        improvementNeeded.push(`AI models disagree on quality. Please regenerate with more objective, well-sourced content.`);
      }
      
    } else if (avgBias > 20 || avgHallucination > 5 || avgSatisfaction < 70) {
      decision = 'approve_with_warning';
    } else {
      decision = 'approve';
    }
  } else {
    // Normal decision logic when models agree
    if (avgBias > 70 || avgHallucination > 60 || avgSatisfaction < 40) {
      decision = 'reject';
      improvementNeeded.push(`Severe quality issues: Bias=${avgBias}/100, Hallucination=${avgHallucination}/100, Satisfaction=${avgSatisfaction}/100. Cannot be fixed with simple retry.`);
      
    } else if (avgBias > 40 || avgHallucination > 30 || avgSatisfaction < 60) {
      decision = 'reloop';
      
      // Provide specific improvement guidance
      if (avgBias > 40) {
        improvementNeeded.push(`Significant bias detected (${avgBias}/100). Use more neutral language and balanced perspectives.`);
      }
      if (avgHallucination > 30) {
        improvementNeeded.push(`Hallucinations detected (${avgHallucination}/100). Verify all claims and provide proper citations.`);
      }
      if (avgSatisfaction < 60) {
        improvementNeeded.push(`Response lacks depth (${avgSatisfaction}/100). Add more evidence and comprehensive analysis.`);
      }
      
    } else if (avgBias > 20 || avgHallucination > 5 || avgSatisfaction < 80) {
      decision = 'approve_with_warning';
    } else {
      decision = 'approve';
    }
  }
  
  return {
    consensusReached: true,
    modelsUsed: successful.length,
    totalModels: evaluations.length,
    
    averageScores: {
      bias: avgBias,
      hallucination: avgHallucination,
      satisfaction: avgSatisfaction
    },
    
    scoreRanges: {
      bias: { min: Math.min(...biasScores), max: Math.max(...biasScores) },
      hallucination: { min: Math.min(...hallucinationScores), max: Math.max(...hallucinationScores) },
      satisfaction: { min: Math.min(...satisfactionScores), max: Math.max(...satisfactionScores) }
    },
    
    disagreement: {
      detected: hasDisagreement,
      bias: biasDisagreement,
      hallucination: hallucinationDisagreement,
      satisfaction: satisfactionDisagreement
    },
    
    finalDecision: {
      action: decision,
      reasoning: hasDisagreement 
        ? `Models showed disagreement (conservative approach applied). Consensus: Bias=${avgBias}/100, Hallucination=${avgHallucination}/100, Satisfaction=${avgSatisfaction}/100`
        : `Models agree. Consensus: Bias=${avgBias}/100, Hallucination=${avgHallucination}/100, Satisfaction=${avgSatisfaction}/100`,
      improvementNeeded: improvementNeeded.length > 0 ? improvementNeeded.join(' ') : undefined
    }
  };
}

/**
 * Multi-AI bias check with cross-validation
 * @param {Object|String} response - Response to evaluate
 * @param {String} context - Context description
 * @returns {Object} Multi-AI consensus evaluation
 */
export async function multiAiBiasCheck(response, context = '') {
  console.log('Multi-AI Bias Check Starting...');
  console.log(`   Models: Gemini 2.5 Flash + Cloudflare (${CF_MODEL.replace('@cf/meta/', '')})`);
  console.log(`   Context: ${context}\n`);
  
  // Run both evaluations in parallel
  const [geminiResult, cloudflareResult] = await Promise.all([
    evaluateWithGemini(response, context),
    evaluateWithCloudflare(response, context)
  ]);
  
  const evaluations = [geminiResult, cloudflareResult];
  
  // Calculate consensus
  const consensus = calculateConsensus(evaluations);
  
  // Log results
  console.log('\nMULTI-AI CONSENSUS:');
  console.log(`   Models evaluated: ${consensus.modelsUsed}/${consensus.totalModels}`);
  console.log(`   Consensus Bias: ${consensus.averageScores.bias}/100 (range: ${consensus.scoreRanges.bias.min}-${consensus.scoreRanges.bias.max})`);
  console.log(`   Consensus Hallucination: ${consensus.averageScores.hallucination}/100 (range: ${consensus.scoreRanges.hallucination.min}-${consensus.scoreRanges.hallucination.max})`);
  console.log(`   Consensus Satisfaction: ${consensus.averageScores.satisfaction}/100 (range: ${consensus.scoreRanges.satisfaction.min}-${consensus.scoreRanges.satisfaction.max})`);
  console.log(`   Disagreement detected: ${consensus.disagreement.detected ? 'YES ⚠️' : 'NO ✓'}`);
  console.log(`   Final Decision: ${consensus.finalDecision.action.toUpperCase()}\n`);
  
  return {
    method: 'multi-ai-consensus',
    evaluations: evaluations,
    consensus: consensus,
    timestamp: new Date().toISOString(),
    
    // Convenience properties for easy checking
    passed: consensus.finalDecision.action === 'approve' || consensus.finalDecision.action === 'approve_with_warning',
    needsReloop: consensus.finalDecision.action === 'reloop',
    rejected: consensus.finalDecision.action === 'reject'
  };
}

/**
 * Quick multi-AI bias check (returns simple pass/fail)
 */
export async function quickMultiAiCheck(response, context = '') {
  const result = await multiAiBiasCheck(response, context);
  return {
    passed: result.passed,
    needsReloop: result.needsReloop,
    rejected: result.rejected,
    evaluation: result.consensus,
    details: result
  };
}

export default {
  multiAiBiasCheck,
  quickMultiAiCheck
};


