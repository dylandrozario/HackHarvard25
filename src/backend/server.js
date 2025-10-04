import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateVerifiedPromises } from './services/dataGenerator.js';
import { analyzePromise } from './services/gemini.js';
import { verifyPromise } from './services/perplexity.js';
import { analyzeCombinedPromises, getPromiseStatistics } from './services/combinedAnalysis.js';
import { evaluateResponse, validateWithReloop, quickBiasCheck } from './services/biasChecker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));  // Increased limit for large promise datasets

const CACHE_FILE = './data/promises.json';

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Votify API - Political Promise Tracker',
    version: '1.0.0',
    endpoints: {
      'GET /api/promises': 'Get all promises (includes stock data if enriched)',
      'GET /api/promises/generate': 'Generate new verified promises',
      'GET /api/promises/enrich': 'Add stock market analysis to existing promises',
      'POST /api/analyze-promise': 'Analyze specific promise',
      'POST /api/analyze-combined': 'Analyze multiple promises with overall score and verdict',
      'POST /api/analyze-combined-validated': 'Analyze promises with bias detection and auto-reloop',
      'POST /api/bias-check': 'Check a response for bias and quality issues',
      'GET /api/stats': 'Get dashboard statistics',
      'GET /api/system-prompt': 'Get VoteVerify system prompt for analysis'
    }
  });
});

// Get all promises
app.get('/api/promises', async (req, res) => {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf8');
    const promises = JSON.parse(data);
    res.json(promises);
  } catch (error) {
    res.status(404).json({ 
      error: 'No promises cached',
      message: 'Use GET /api/promises/generate to create data'
    });
  }
});

// Generate new promises
app.get('/api/promises/generate', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 5;
    
    console.log(`Starting promise generation (${count} per president)...`);
    
    const result = await generateVerifiedPromises({ 
      promisesPerPresident: count 
    });
    
    // Save to cache
    await fs.mkdir('./data', { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(result.promises, null, 2));
    
    res.json({
      success: true,
      stats: result.stats,
      promises: result.promises
    });
    
  } catch (error) {
    console.error('Generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enrich promises with stock market data (updates promises.json in place)
app.get('/api/promises/enrich', async (req, res) => {
  try {
    console.log('Starting stock market enrichment...');
    
    // Check if base promises exist
    try {
      await fs.access(CACHE_FILE);
    } catch {
      return res.status(404).json({ 
        error: 'No promises to enrich',
        message: 'Generate promises first using GET /api/promises/generate'
      });
    }
    
    // Run Python stock analyzer (it will update promises.json in place)
    const pythonScript = path.join(__dirname, 'services', 'stock_analyzer.py');
    const venvPython = path.join(__dirname, '../../venv/bin/python3');
    const pythonCommand = venvPython; // Use venv python if available
    
    const result = execSync(
      `"${pythonCommand}" "${pythonScript}"`,
      { 
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        cwd: __dirname
      }
    );
    
    console.log(result);
    
    // Read updated promises
    const enrichedData = await fs.readFile(CACHE_FILE, 'utf8');
    const enrichedPromises = JSON.parse(enrichedData);
    
    // Calculate stats
    const withStock = enrichedPromises.filter(
      p => p.actualMarketImpact && p.actualMarketImpact.industries && p.actualMarketImpact.industries.length > 0
    ).length;
    
    res.json({
      success: true,
      message: 'Stock market analysis complete (promises.json updated)',
      stats: {
        total: enrichedPromises.length,
        withStockData: withStock,
        percentage: ((withStock / enrichedPromises.length) * 100).toFixed(1)
      },
      promises: enrichedPromises
    });
    
  } catch (error) {
    console.error('Enrichment failed:', error);
    res.status(500).json({ 
      error: 'Stock enrichment failed',
      message: error.message 
    });
  }
});

// Analyze promise
app.post('/api/analyze-promise', async (req, res) => {
  try {
    const { promise } = req.body;
    
    if (!promise) {
      return res.status(400).json({ error: 'Promise object required' });
    }
    
    const analysis = await analyzePromise(promise);
    res.json(analysis);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze combined promises (overall assessment)
app.post('/api/analyze-combined', async (req, res) => {
  try {
    const { promises, president } = req.body;
    
    if (!promises || !Array.isArray(promises) || promises.length === 0) {
      return res.status(400).json({ 
        error: 'Array of promises required',
        message: 'Please provide an array of promise objects in the request body'
      });
    }
    
    // If no president specified, try to extract from first promise
    const presidentName = president || promises[0].president || 'Unknown';
    
    console.log(`Analyzing ${promises.length} promises for ${presidentName}...`);
    
    // Get basic statistics
    const stats = getPromiseStatistics(promises);
    
    // Get AI-powered combined analysis
    const analysis = await analyzeCombinedPromises(promises, presidentName);
    
    res.json({
      success: true,
      president: presidentName,
      promisesAnalyzed: promises.length,
      statistics: stats,
      analysis: analysis,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Combined analysis failed:', error);
    res.status(500).json({ 
      error: 'Failed to analyze combined promises',
      message: error.message 
    });
  }
});

// Analyze combined promises with bias detection and auto-reloop
app.post('/api/analyze-combined-validated', async (req, res) => {
  try {
    const { promises, president, maxAttempts = 3 } = req.body;
    
    if (!promises || !Array.isArray(promises) || promises.length === 0) {
      return res.status(400).json({ 
        error: 'Array of promises required',
        message: 'Please provide an array of promise objects in the request body'
      });
    }
    
    const presidentName = president || promises[0].president || 'Unknown';
    
    console.log(`Analyzing ${promises.length} promises for ${presidentName} with bias detection...`);
    
    // Generator function that can be called multiple times if reloop needed
    const generateAnalysis = async (previousEvaluation) => {
      console.log('🤖 Generating analysis...');
      
      // Get basic statistics
      const stats = getPromiseStatistics(promises);
      
      // Get AI-powered combined analysis
      const analysis = await analyzeCombinedPromises(promises, presidentName);
      
      return {
        president: presidentName,
        promisesAnalyzed: promises.length,
        statistics: stats,
        analysis: analysis,
        generatedAt: new Date().toISOString()
      };
    };
    
    // Validate with automatic reloop
    const result = await validateWithReloop(
      generateAnalysis,
      `${presidentName} combined promise analysis`,
      maxAttempts
    );
    
    if (result.success) {
      res.json({
        success: true,
        validated: true,
        ...result.response,
        qualityCheck: {
          biasScore: result.evaluation.biasDetection.score,
          hallucinationScore: result.evaluation.hallucinationDetection.score,
          satisfactionScore: result.evaluation.overallSatisfaction.score,
          decision: result.evaluation.finalDecision.action,
          attempts: result.attempts
        },
        warning: result.warning || null
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        attempts: result.attempts,
        lastEvaluation: result.evaluation
      });
    }
    
  } catch (error) {
    console.error('Validated combined analysis failed:', error);
    res.status(500).json({ 
      error: 'Failed to analyze and validate combined promises',
      message: error.message 
    });
  }
});

// Check a response for bias and quality issues
app.post('/api/bias-check', async (req, res) => {
  try {
    const { response, context = 'Promise analysis' } = req.body;
    
    if (!response) {
      return res.status(400).json({ 
        error: 'Response required',
        message: 'Please provide a response object or text to evaluate'
      });
    }
    
    console.log(`Running bias check on: ${context}`);
    
    const result = await quickBiasCheck(response, context);
    
    res.json({
      success: true,
      passed: result.passed,
      needsReloop: result.needsReloop,
      rejected: result.rejected,
      evaluation: result.evaluation,
      checkedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Bias check failed:', error);
    res.status(500).json({ 
      error: 'Failed to check for bias',
      message: error.message 
    });
  }
});

// Get VoteVerify system prompt
app.get('/api/system-prompt', (req, res) => {
  try {
    const pythonScriptPath = path.join(__dirname, 'services', 'system_prompt.py');
    
    // Execute Python script to get system prompt
    const result = execSync(
      `python3 -c "import sys; sys.path.insert(0, '${path.join(__dirname, 'services')}'); from system_prompt import get_system_prompt; print(get_system_prompt())"`,
      { 
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large prompt
      }
    );
    
    const systemPrompt = result.trim();
    
    res.json({
      success: true,
      systemPrompt: systemPrompt,
      length: systemPrompt.length,
      metadata: {
        version: '1.0.0',
        type: 'VoteVerify Comprehensive Analysis System',
        features: [
          'Dual scoring system (1-5 and 0-100)',
          'Fuzzy matching algorithm',
          'Citation requirements',
          'URL generation',
          'Backend integration (Perplexity + Gemini)',
          'Credibility assessment'
        ]
      }
    });
    
  } catch (error) {
    console.error('Error fetching system prompt:', error);
    res.status(500).json({ 
      error: 'Failed to fetch system prompt',
      message: error.message 
    });
  }
});

// Get stats
app.get('/api/stats', async (req, res) => {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf8');
    const promises = JSON.parse(data);
    
    const stats = {
      total: promises.length,
      kept: promises.filter(p => p.status === 'kept').length,
      broken: promises.filter(p => p.status === 'broken').length,
      partial: promises.filter(p => p.status === 'partial').length,
      verified: promises.filter(p => p.verified).length,
      byPresident: {},
      byCategory: {}
    };
    
    promises.forEach(p => {
      stats.byPresident[p.president] = (stats.byPresident[p.president] || 0) + 1;
      stats.byCategory[p.category] = (stats.byCategory[p.category] || 0) + 1;
    });
    
    res.json(stats);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run Python VoteVerify validation on a promise
 * Calls test_voteverify.py analyze_backend_promise()
 */
async function runVoteVerifyValidation(promise) {
  return new Promise((resolve, reject) => {
    // Create temporary file with promise data
    const tempFile = path.join('./data', `temp_promise_${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(promise));
    
    // Run Python validation script
    const python = spawn('python3', [
      './python/validate_promise.py',  // We'll create this wrapper script
      tempFile
    ]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      // Clean up temp file
      fs.unlinkSync(tempFile);
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          reject(new Error('Failed to parse Python output: ' + output));
        }
      } else {
        reject(new Error('Python validation failed: ' + error));
      }
    });
  });
}

/**
 * Run bias checker on VoteVerify result
 * Calls bias_checker.py
 */
async function runBiasChecker(voteverifyResult) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join('./data', `temp_result_${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(voteverifyResult));
    
    const python = spawn('python3', [
      './python/check_bias.py',
      tempFile
    ]);
    
    let output = '';
    let error = '';
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    python.on('close', (code) => {
      fs.unlinkSync(tempFile);
      
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          reject(new Error('Failed to parse bias checker output'));
        }
      } else {
        reject(new Error('Bias checker failed: ' + error));
      }
    });
  });
}

/**
 * API Endpoint: Validate single promise with full pipeline
 * POST /api/validate-promise
 */
app.post('/api/validate-promise', async (req, res) => {
  try {
    const { promise } = req.body;
    
    if (!promise) {
      return res.status(400).json({ error: 'Promise object required' });
    }
    
    console.log(`Validating promise: ${promise.promise.substring(0, 50)}...`);
    
    // Layer 1: VoteVerify scoring
    console.log('  Running VoteVerify analysis...');
    const voteverifyResult = await runVoteVerifyValidation(promise);
    
    console.log(`  VoteVerify scores: ${voteverifyResult.primary_score}/5, ${voteverifyResult.detailed_score}/100`);
    
    // Layer 2: Bias checking
    console.log('  Running bias checker...');
    const biasResult = await runBiasChecker(voteverifyResult);
    
    console.log(`  Bias check: ${biasResult.finalDecision.action}`);
    
    // Combined result
    const validation = {
      promise: promise.promise,
      president: promise.president,
      voteverify: {
        primary_score: voteverifyResult.primary_score,
        detailed_score: voteverifyResult.detailed_score,
        confidence: voteverifyResult.confidence,
        analysis: voteverifyResult.analysis
      },
      biasCheck: {
        biasScore: biasResult.biasDetection.score,
        hallucinationScore: biasResult.hallucinationDetection.score,
        citationQuality: biasResult.citationQuality.score,
        accuracyScore: biasResult.accuracyVerification.score,
        overallScore: biasResult.overallSatisfaction.score,
        decision: biasResult.finalDecision.action,
        issues: biasResult.finalDecision.improvementNeeded || []
      },
      finalDecision: biasResult.finalDecision.action,
      timestamp: new Date().toISOString()
    };
    
    res.json(validation);
    
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ 
      error: 'Validation failed',
      details: error.message 
    });
  }
});

/**
 * API Endpoint: Validate sample of promises with statistical sampling
 * POST /api/validate-sample
 */
app.post('/api/validate-sample', async (req, res) => {
  try {
    const promises = JSON.parse(fs.readFileSync('./data/promises.json', 'utf-8'));
    const sampleSize = req.body.sampleSize || 10;
    const qualityThreshold = req.body.qualityThreshold || 0.8;
    
    console.log(`\nStatistical Validation Pipeline`);
    console.log(`Total promises: ${promises.length}`);
    console.log(`Sample size: ${sampleSize}`);
    console.log(`Quality threshold: ${qualityThreshold * 100}%\n`);
    
    // Select random sample
    const shuffled = [...promises].sort(() => Math.random() - 0.5);
    const sample = shuffled.slice(0, sampleSize);
    
    const results = {
      total: sample.length,
      passed: 0,
      warned: 0,
      failed: 0,
      details: []
    };
    
    // Validate each sample
    for (let i = 0; i < sample.length; i++) {
      const promise = sample[i];
      console.log(`[${i+1}/${sample.length}] Validating: ${promise.promise.substring(0, 50)}...`);
      
      try {
        // Run full validation pipeline
        const voteverifyResult = await runVoteVerifyValidation(promise);
        const biasResult = await runBiasChecker(voteverifyResult);
        
        const decision = biasResult.finalDecision.action;
        
        if (decision === 'approve') {
          results.passed++;
          console.log(`  ✅ APPROVED`);
        } else if (decision === 'approve_with_warning') {
          results.warned++;
          console.log(`  ⚠️  APPROVED WITH WARNING`);
        } else if (decision === 'reloop') {
          results.failed++;
          console.log(`  ❌ RELOOP NEEDED`);
        } else {
          results.failed++;
          console.log(`  ❌ REJECTED`);
        }
        
        results.details.push({
          promise: promise.promise.substring(0, 60) + '...',
          president: promise.president,
          primary_score: voteverifyResult.primary_score,
          detailed_score: voteverifyResult.detailed_score,
          bias_score: biasResult.biasDetection.score,
          hallucination_score: biasResult.hallucinationDetection.score,
          decision: decision
        });
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`  ❌ ERROR: ${error.message}`);
        results.failed++;
      }
    }
    
    // Calculate pass rate
    const passRate = (results.passed + results.warned) / results.total;
    
    console.log(`\n📊 Results: ${results.passed} approved, ${results.warned} warned, ${results.failed} failed`);
    console.log(`Pass rate: ${(passRate * 100).toFixed(1)}%`);
    
    const success = passRate >= qualityThreshold;
    
    res.json({
      success,
      passRate: (passRate * 100).toFixed(1) + '%',
      threshold: (qualityThreshold * 100) + '%',
      results,
      message: success 
        ? 'Quality threshold met - all promises validated' 
        : 'Quality threshold NOT met - regenerate failed promises'
    });
    
  } catch (error) {
    console.error('Sampling validation error:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VOTIFY API SERVER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  Server running on: http://localhost:${PORT}
  
  Ready to generate promises!
  Visit: http://localhost:${PORT}/api/promises/generate
  
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});