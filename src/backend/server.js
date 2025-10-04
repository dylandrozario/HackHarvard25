import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { analyzePromise } from './services/gemini.js';

const app = express();
app.use(cors());
app.use(express.json());

// Load promises from file
const promises = JSON.parse(readFileSync('./data/promises.json', 'utf8'));

app.get('/', (req, res) => {
  res.json({
    message: '🥉 Votify Bronze API',
    totalPromises: promises.length,
    endpoints: {
      'GET /api/promises': 'Get all promises',
      'POST /api/analyze-promise': 'Analyze a promise'
    }
  });
});

// Get all promises (instant now!)
app.get('/api/promises', (req, res) => {
  res.json(promises);
});

// Analyze promise
app.post('/api/analyze-promise', async (req, res) => {
  try {
    const { promise } = req.body;
    const analysis = await analyzePromise(promise);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('\n🥉 Votify Bronze - Ready!');
  console.log(`📊 Loaded ${promises.length} promises`);
  console.log('📍 http://localhost:3000\n');
});