import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import { generateVerifiedPromises } from './services/dataGenerator.js';
import { analyzePromise } from './services/gemini.js';
import { verifyPromise } from './services/perplexity.js';

const app = express();
app.use(cors());
app.use(express.json());

const CACHE_FILE = './data/promises.json';

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Votify API - Political Promise Tracker',
    version: '1.0.0',
    endpoints: {
      'GET /api/promises': 'Get all cached promises',
      'GET /api/promises/generate': 'Generate new verified promises',
      'POST /api/analyze-promise': 'Analyze specific promise',
      'GET /api/stats': 'Get dashboard statistics'
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