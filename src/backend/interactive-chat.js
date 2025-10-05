#!/usr/bin/env node

/**
 * VoteVerify Interactive Terminal Chat
 * 
 * An interactive CLI that queries the backend for presidential promises,
 * analyzes fulfillment, and shows stock market predictions vs reality.
 */

import readline from 'readline';
import { analyzePromise } from './services/gemini.js';
import { quickBiasCheck, validateWithReloop } from './services/biasChecker.js';
import fs from 'fs/promises';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
};

// Helper functions for colored output
const log = {
  header: (text) => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(80)}\n${text}\n${'='.repeat(80)}${colors.reset}\n`),
  success: (text) => console.log(`${colors.green}✅ ${text}${colors.reset}`),
  error: (text) => console.log(`${colors.red}❌ ${text}${colors.reset}`),
  info: (text) => console.log(`${colors.blue}ℹ️  ${text}${colors.reset}`),
  warning: (text) => console.log(`${colors.yellow}⚠️  ${text}${colors.reset}`),
  data: (label, value) => console.log(`${colors.dim}${label}:${colors.reset} ${colors.bright}${value}${colors.reset}`),
  section: (text) => console.log(`\n${colors.bright}${colors.magenta}${text}${colors.reset}`),
  stock: (text) => console.log(`${colors.cyan}${text}${colors.reset}`),
};

// Load promises from cache
async function loadPromises() {
  try {
    const data = await fs.readFile('./data/promises.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// Find promises by president name
function findPromisesByPresident(promises, presidentName) {
  const searchName = presidentName.toLowerCase();
  return promises.filter(p => 
    p.president.toLowerCase().includes(searchName)
  );
}

// Format promise status with color
function formatStatus(status) {
  switch (status.toLowerCase()) {
    case 'kept':
      return `${colors.green}✓ Kept${colors.reset}`;
    case 'broken':
      return `${colors.red}✗ Broken${colors.reset}`;
    case 'partial':
      return `${colors.yellow}◐ Partial${colors.reset}`;
    default:
      return `${colors.dim}? Unknown${colors.reset}`;
  }
}

// Format prediction accuracy
function formatAccuracy(accuracy) {
  switch (accuracy) {
    case 'correct':
      return `${colors.green}✅ Correct${colors.reset}`;
    case 'incorrect':
      return `${colors.red}❌ Incorrect${colors.reset}`;
    case 'mixed':
      return `${colors.yellow}🟡 Mixed${colors.reset}`;
    default:
      return `${colors.dim}? Unknown${colors.reset}`;
  }
}

// Display promise details
function displayPromise(promise, index, total) {
  console.log(`\n${colors.bright}${colors.bgBlue} Promise ${index + 1}/${total} ${colors.reset}`);
  console.log(`${colors.dim}${'─'.repeat(80)}${colors.reset}`);
  
  log.data('President', promise.president);
  log.data('Date', promise.date);
  log.data('Category', promise.category);
  log.data('Status', formatStatus(promise.status));
  
  console.log(`\n${colors.bright}Promise:${colors.reset}`);
  console.log(`  ${promise.promise.substring(0, 200)}${promise.promise.length > 200 ? '...' : ''}`);
  
  if (promise.evidence && promise.evidence.length > 0) {
    console.log(`\n${colors.bright}Evidence:${colors.reset}`);
    promise.evidence.forEach((ev, i) => {
      console.log(`  ${i + 1}. ${ev.substring(0, 100)}${ev.length > 100 ? '...' : ''}`);
    });
  }
  
  // Display sources and credibility
  if (promise.realSources && promise.realSources.length > 0) {
    log.section('SOURCES & CITATIONS');
    console.log(`  ${colors.dim}Credibility: ${promise.credibilityLevel || 'unknown'}${colors.reset}`);
    console.log(`  ${colors.dim}Verified: ${promise.verified ? 'Yes ✓' : 'No'}${colors.reset}\n`);
    promise.realSources.slice(0, 5).forEach((source, i) => {
      console.log(`  ${i + 1}. ${colors.cyan}${source}${colors.reset}`);
    });
    if (promise.realSources.length > 5) {
      console.log(`  ${colors.dim}... and ${promise.realSources.length - 5} more sources${colors.reset}`);
    }
  } else if (promise.sources && promise.sources.length > 0) {
    log.section('SOURCES');
    console.log(`  ${colors.dim}Credibility: ${promise.credibilityLevel || 'unknown'}${colors.reset}\n`);
    promise.sources.slice(0, 5).forEach((source, i) => {
      console.log(`  ${i + 1}. ${colors.cyan}${source}${colors.reset}`);
    });
    if (promise.sources.length > 5) {
      console.log(`  ${colors.dim}... and ${promise.sources.length - 5} more sources${colors.reset}`);
    }
  }
  
  // Display affected industries (predictions)
  if (promise.affectedIndustries && promise.affectedIndustries.length > 0) {
    log.section(' PREDICTED INDUSTRY IMPACT');
    promise.affectedIndustries.forEach((industry, i) => {
      console.log(`\n  ${i + 1}. ${colors.bright}${industry.name}${colors.reset}`);
      console.log(`     Predicted: ${industry.predictedImpact} (confidence: ${industry.confidence}%)`);
      console.log(`     ${colors.dim}${industry.reasoning.substring(0, 120)}...${colors.reset}`);
    });
  }
  
  // Display actual market impact
  if (promise.actualMarketImpact && promise.actualMarketImpact.industries && promise.actualMarketImpact.industries.length > 0) {
    log.section(' ACTUAL STOCK MARKET PERFORMANCE');
    
    promise.actualMarketImpact.industries.forEach((industry, i) => {
      console.log(`\n  ${i + 1}. ${colors.bright}${industry.industry}${colors.reset}`);
      console.log(`     Tickers: ${industry.tickers.join(', ')}`);
      
      if (industry.impact6mo) {
        const change6mo = industry.impact6mo.averageChange;
        const color = change6mo >= 0 ? colors.green : colors.red;
        console.log(`     6-month change: ${color}${change6mo > 0 ? '+' : ''}${change6mo.toFixed(2)}%${colors.reset}`);
      }
      
      if (industry.impact12mo) {
        const change12mo = industry.impact12mo.averageChange;
        const color = change12mo >= 0 ? colors.green : colors.red;
        console.log(`     12-month change: ${color}${change12mo > 0 ? '+' : ''}${change12mo.toFixed(2)}%${colors.reset}`);
      }
      
      console.log(`     Predicted: ${industry.predictedImpact}`);
      console.log(`     Accuracy: ${formatAccuracy(industry.predictionAccuracy)}`);
    });
    
    console.log(`\n  ${colors.dim}Data source: ${promise.actualMarketImpact.dataSource}${colors.reset}`);
  } else {
    log.warning('No stock market data available for this promise');
  }
  
  console.log(`\n${colors.dim}${'─'.repeat(80)}${colors.reset}`);
}

// Display statistics
function displayStats(promises, presidentName) {
  const kept = promises.filter(p => p.status === 'kept').length;
  const broken = promises.filter(p => p.status === 'broken').length;
  const partial = promises.filter(p => p.status === 'partial').length;
  const withStock = promises.filter(p => 
    p.actualMarketImpact && 
    p.actualMarketImpact.industries && 
    p.actualMarketImpact.industries.length > 0
  ).length;
  
  log.section(' SUMMARY STATISTICS');
  console.log(`\n  Total promises: ${colors.bright}${promises.length}${colors.reset}`);
  console.log(`  ${colors.green}✓ Kept: ${kept}${colors.reset}`);
  console.log(`  ${colors.red}✗ Broken: ${broken}${colors.reset}`);
  console.log(`  ${colors.yellow}◐ Partial: ${partial}${colors.reset}`);
  console.log(`  ${colors.cyan}With stock data: ${withStock}${colors.reset}`);
}

// Get detailed analysis from VoteVerify
async function getDetailedAnalysis(promise) {
  log.info('Generating detailed VoteVerify analysis with quality validation...\n');
  
  try {
    // Generator function for reloop
    const generateAnalysis = async (previousEvaluation) => {
      console.log(`${colors.dim}Generating AI analysis...${colors.reset}`);
      return await analyzePromise(promise);
    };
    
    // Validate with automatic reloop if needed
    const result = await validateWithReloop(
      generateAnalysis,
      `${promise.president} - ${promise.promise.substring(0, 50)}...`,
      3  // Max 3 attempts
    );
    
    // Handle validation results
    if (!result.success) {
      // Response rejected after all attempts
      log.error('Unable to generate reliable analysis after multiple attempts.');
      console.log(`${colors.dim}The system detected quality issues in all attempts. Please try a different promise.${colors.reset}\n`);
      return;
    }
    
    // Show attempt info if reloop was needed
    if (result.attempts > 1) {
      console.log(`${colors.green}✓ Quality validated after ${result.attempts} attempts${colors.reset}\n`);
    }
    
    // Use the validated analysis
    const analysis = result.response;
    
    log.section(' VOTEVERIFY DETAILED ANALYSIS');
    console.log(`\n${analysis.analysis}\n`);
    
    if (analysis.confidence) {
      log.data('Confidence Score', `${analysis.confidence}/100`);
    }
    
    // Display sources if available
    if (analysis.sources && analysis.sources.length > 0) {
      log.section('📚 ANALYSIS SOURCES');
      analysis.sources.forEach((source, i) => {
        console.log(`  ${i + 1}. ${colors.cyan}${source}${colors.reset}`);
      });
      console.log();
    }
    
    // Also show promise original sources
    if (promise.realSources && promise.realSources.length > 0) {
      log.section('PROMISE ORIGINAL SOURCES');
      console.log(`  ${colors.dim}Verified by Perplexity + Gemini${colors.reset}`);
      console.log(`  ${colors.dim}Credibility: ${promise.credibilityLevel || 'unknown'}${colors.reset}\n`);
      promise.realSources.slice(0, 5).forEach((source, i) => {
        console.log(`  ${i + 1}. ${colors.cyan}${source}${colors.reset}`);
      });
      if (promise.realSources.length > 5) {
        console.log(`  ${colors.dim}... and ${promise.realSources.length - 5} more${colors.reset}`);
      }
      console.log();
    }
    
  } catch (error) {
    log.error(`Failed to generate analysis: ${error.message}`);
  }
}

// Get combined analysis for all promises (with reloop validation)
async function getCombinedAnalysis(promises, presidentName) {
  log.info('Calling backend API for combined analysis with quality validation...\n');
  
  try {
    // Use the validated endpoint that includes automatic reloop
    const response = await fetch('http://localhost:3000/api/analyze-combined-validated', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promises: promises,
        president: presidentName,
        maxAttempts: 3
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.error);
    }
    
    const data = await response.json();
    
    // Check if validation succeeded
    if (!data.success) {
      log.error('Unable to generate reliable overall assessment after multiple attempts.');
      console.log(`${colors.dim}The system detected quality issues in all attempts.${colors.reset}\n`);
      return;
    }
    
    // Show attempt info if reloop was needed
    if (data.qualityCheck && data.qualityCheck.attempts > 1) {
      console.log(`${colors.green}✓ Quality validated after ${data.qualityCheck.attempts} attempts${colors.reset}`);
      console.log(`${colors.dim}  Bias: ${data.qualityCheck.biasScore}/100 | Hallucination: ${data.qualityCheck.hallucinationScore}/100 | Satisfaction: ${data.qualityCheck.satisfactionScore}/100${colors.reset}\n`);
    }
    
    const result = data.analysis;
    
    // Display results
    log.header(` OVERALL ASSESSMENT: ${presidentName.toUpperCase()}`);
    
    console.log(`\n${colors.bright}Overall Score: ${result.overallScore}/100${colors.reset}`);
    console.log(`${colors.bright}Overall Rating: ${result.overallRating}/5${colors.reset}`);
    console.log(`${colors.bright}Confidence: ${result.confidence}${colors.reset}\n`);
    
    log.section(' PROMISE BREAKDOWN');
    console.log(`  Total Promises: ${result.promiseBreakdown.total}`);
    console.log(`  ${colors.green}✓ Kept: ${result.promiseBreakdown.kept}${colors.reset}`);
    console.log(`  ${colors.red}✗ Broken: ${result.promiseBreakdown.broken}${colors.reset}`);
    console.log(`  ${colors.yellow}◐ Partial: ${result.promiseBreakdown.partial}${colors.reset}`);
    console.log(`  Keep Rate: ${result.promiseBreakdown.keepRate}%`);
    
    if (result.marketAccuracy) {
      log.section(' MARKET PREDICTION ACCURACY');
      const market = result.marketAccuracy;
      console.log(`  Total Predictions: ${market.totalPredictions}`);
      console.log(`  ${colors.green}✓ Correct: ${market.correct}${colors.reset}`);
      console.log(`  ${colors.red}✗ Incorrect: ${market.incorrect}${colors.reset}`);
      console.log(`  Accuracy Rate: ${market.accuracyRate}%`);
      console.log(`\n${market.analysis}\n`);
    }
    
    if (result.categoryAnalysis && result.categoryAnalysis.length > 0) {
      log.section(' CATEGORY PERFORMANCE');
      result.categoryAnalysis.forEach(cat => {
        const perf = cat.performance === 'good' ? colors.green : 
                     cat.performance === 'fair' ? colors.yellow : colors.red;
        console.log(`  ${cat.category}: ${cat.kept}/${cat.promiseCount} kept ${perf}(${cat.performance})${colors.reset}`);
      });
      console.log();
    }
    
    log.section('STRENGTHS');
    result.strengths.forEach((s, i) => {
      console.log(`  ${i + 1}. ${colors.green}${s}${colors.reset}`);
    });
    
    log.section('WEAKNESSES');
    result.weaknesses.forEach((w, i) => {
      console.log(`  ${i + 1}. ${colors.red}${w}${colors.reset}`);
    });
    
    log.section('SCORE JUSTIFICATION');
    console.log(`\n${result.scoreJustification}\n`);
    
    log.section('FINAL VERDICT');
    console.log(`\n${result.verdict}\n`);
    
    console.log(`${colors.dim}Generated at: ${result.analysisDate}${colors.reset}\n`);
    
  } catch (error) {
    log.error(`Failed to get combined analysis: ${error.message}`);
    log.warning('Make sure the backend server is running on http://localhost:3000');
  }
}

// Main chat loop
async function startChat() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.bright}${colors.cyan}VoteVerify>${colors.reset} `
  });
  
  // Welcome message
  log.header('VOTEVERIFY INTERACTIVE CHAT');
  console.log('Ask me about any U.S. President\'s promises, fulfillment, and market impact!\n');
  console.log(`${colors.dim}Commands:${colors.reset}`);
  console.log('  - Type a president\'s name (e.g., "Biden", "Obama", "Trump")');
  console.log('  - Type "analyze <number>" to get detailed AI analysis of a promise');
  console.log('  - Type "overall" to get combined analysis of all current promises');
  console.log('  - Type "list" to see all available presidents');
  console.log('  - Type "exit" to quit\n');
  
  // Load promises
  const promises = await loadPromises();
  
  if (!promises) {
    log.error('No promise data found!');
    log.info('Run this first: curl http://localhost:3000/api/promises/generate');
    log.info('Then enrich with stock data: curl http://localhost:3000/api/promises/enrich\n');
    rl.close();
    return;
  }
  
  log.success(`Loaded ${promises.length} promises from database\n`);
  
  let currentPromises = [];
  
  // Check if stdin is a TTY (interactive terminal)
  if (!process.stdin.isTTY) {
    log.warning('Non-interactive mode detected. For full experience, run directly in terminal.\n');
  }
  
  rl.prompt();
  
  rl.on('line', async (input) => {
    const trimmed = input.trim().toLowerCase();
    
    if (!trimmed) {
      rl.prompt();
      return;
    }
    
    if (trimmed === 'exit' || trimmed === 'quit') {
      log.info('Goodbye! 👋\n');
      rl.close();
      return;
    }
    
    if (trimmed === 'list') {
      const presidents = [...new Set(promises.map(p => p.president))];
      log.section(' AVAILABLE PRESIDENTS');
      presidents.forEach((pres, i) => {
        const count = promises.filter(p => p.president === pres).length;
        console.log(`  ${i + 1}. ${pres} (${count} promise${count > 1 ? 's' : ''})`);
      });
      console.log();
      rl.prompt();
      return;
    }
    
    if (trimmed.startsWith('analyze ')) {
      const num = parseInt(trimmed.split(' ')[1]);
      
      if (!currentPromises.length) {
        log.error('Search for a president first!');
        rl.prompt();
        return;
      }
      
      if (isNaN(num) || num < 1 || num > currentPromises.length) {
        log.error(`Please specify a number between 1 and ${currentPromises.length}`);
        rl.prompt();
        return;
      }
      
      const promise = currentPromises[num - 1];
      await getDetailedAnalysis(promise);
      
      rl.prompt();
      return;
    }
    
    if (trimmed === 'overall' || trimmed === 'summary') {
      if (!currentPromises.length) {
        log.error('Search for a president first!');
        rl.prompt();
        return;
      }
      
      await getCombinedAnalysis(currentPromises, currentPromises[0].president);
      
      rl.prompt();
      return;
    }
    
    // Search for president
    const found = findPromisesByPresident(promises, input);
    
    if (found.length === 0) {
      log.error(`No promises found for "${input}"`);
      log.info('Try "list" to see available presidents\n');
      rl.prompt();
      return;
    }
    
    currentPromises = found;
    
    log.header(`${found[0].president.toUpperCase()} - PROMISES TRACKER`);
    
    // Display each promise
    found.forEach((promise, index) => {
      displayPromise(promise, index, found.length);
    });
    
    // Display statistics
    displayStats(found, input);
    
    console.log(`\n${colors.dim}Tips:${colors.reset}`);
    console.log(`${colors.dim}   • Type "analyze <number>" for detailed AI analysis of a specific promise${colors.reset}`);
    console.log(`${colors.dim}   • Type "overall" for combined analysis and overall score across all ${found.length} promises${colors.reset}\n`);
    
    rl.prompt();
  });
  
  rl.on('close', () => {
    process.exit(0);
  });
}

// Start the chat
startChat().catch(console.error);

