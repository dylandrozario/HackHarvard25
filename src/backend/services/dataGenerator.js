import { findRealPromises } from './perplexity.js';
import { parsePromisesFromText } from './gemini.js';

export async function generateVerifiedPromises(options = {}) {
  const { promisesPerPresident = 5 } = options;
  
  const presidents = [
    { name: 'George W. Bush', start: 2001, end: 2008 },
    { name: 'Barack Obama', start: 2009, end: 2016 },
    { name: 'Donald Trump', start: 2017, end: 2020 },
    { name: 'Joe Biden', start: 2021, end: 2024 }
  ];
  
  const allPromises = [];
  
  for (const pres of presidents) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Finding promises for ${pres.name} (${pres.start}-${pres.end})`);
    console.log('='.repeat(60));
    
    // Step 1: Perplexity finds real promises
    const searchResult = await findRealPromises(
      pres.name, 
      pres.start, 
      pres.end, 
      promisesPerPresident
    );
    
    // Check if we got useful content (even without URLs)
    if (!searchResult.hasContent && !searchResult.verified) {
      console.log(`❌ No usable data found for ${pres.name}`);
      console.log(`   Error: ${searchResult.error || 'No content returned'}`);
      continue;
    }
    
    if (searchResult.verified) {
      console.log(`✅ Found verified data with ${searchResult.sources.length} sources`);
    } else if (searchResult.hasContent) {
      console.log(`⚠️  Found content but no source URLs (will mark as unverified)`);
    }
    
    // Step 2: Gemini structures the data
    console.log(`   Parsing with Gemini...`);
    const promises = await parsePromisesFromText(searchResult.rawText, pres.name);
    
    if (promises.length === 0) {
      console.log(`❌ Gemini failed to parse promises for ${pres.name}`);
      continue;
    }
    
    // Step 3: Add verification metadata
    const verifiedPromises = promises.map((p, idx) => ({
      ...p,
      verified: searchResult.verified,
      credibilityLevel: searchResult.sources.length >= 2 ? 'high' : 
                       searchResult.sources.length === 1 ? 'medium' : 
                       searchResult.hasContent ? 'low' : 'unverified',
      realSources: searchResult.sources.length > 0 ? searchResult.sources : 
                   (p.sources || []),
      dataSource: 'perplexity+gemini',
      generatedAt: new Date().toISOString()
    }));
    
    allPromises.push(...verifiedPromises);
    console.log(`✅ Successfully parsed ${verifiedPromises.length} promises for ${pres.name}`);
    console.log(`   Credibility: ${verifiedPromises[0]?.credibilityLevel || 'unknown'}`);
    
    // Rate limiting - 3 seconds between presidents
    if (pres !== presidents[presidents.length - 1]) {
      console.log(`   Waiting 3 seconds before next president...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('GENERATION COMPLETE');
  console.log('='.repeat(60));
  
  const stats = {
    total: allPromises.length,
    verified: allPromises.filter(p => p.verified).length,
    high: allPromises.filter(p => p.credibilityLevel === 'high').length,
    medium: allPromises.filter(p => p.credibilityLevel === 'medium').length,
    low: allPromises.filter(p => p.credibilityLevel === 'low').length,
    unverified: allPromises.filter(p => p.credibilityLevel === 'unverified').length
  };
  
  console.log(`\nTotal Promises: ${stats.total}`);
  console.log(`  ✅ Verified: ${stats.verified}`);
  console.log(`  🟢 High credibility: ${stats.high}`);
  console.log(`  🟡 Medium credibility: ${stats.medium}`);
  console.log(`  🟠 Low credibility: ${stats.low}`);
  console.log(`  ⚪ Unverified: ${stats.unverified}\n`);
  
  if (allPromises.length === 0) {
    console.error('⚠️  WARNING: No promises generated at all!');
    console.error('   Check your Perplexity API key and rate limits');
  }
  
  return { promises: allPromises, stats };
}