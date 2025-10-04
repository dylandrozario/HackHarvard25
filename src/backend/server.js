import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateVerifiedPromises } from './services/dataGenerator.js';
// import { crossVerifyPromise } from './services/crossVertification.js';
import { analyzePromise } from './services/gemini.js';
import { verifyPromise } from './services/perplexity.js';
import { analyzeCombinedPromises, getPromiseStatistics } from './services/combinedAnalysis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

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

// Cross-verify endpoint disabled - function not implemented
/*
app.post('/api/cross-verify', async (req, res) => {
  try {
    const { promise } = req.body;
    
    // Validate input
    if (!promise) {
      return res.status(400).json({ 
        error: 'Promise text is required',
        details: 'Please provide a promise to verify'
      });
    }
    
    console.log('🔄 Cross-verifying promise:', promise.substring(0, 50) + '...');
    
    // Run cross-verification
    const result = await crossVerifyPromise(promise);
    
    console.log('✅ Cross-verification complete. Agreement:', result.agreementScore + '%');
    
    res.json(result);
    
  } catch (error) {
    console.error('❌ Cross-verification error:', error);
    res.status(500).json({ 
      error: 'Cross-verification failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
*/

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