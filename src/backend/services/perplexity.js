import Perplexity from '@perplexity-ai/perplexity_ai';
import 'dotenv/config';

// Initialize client only if API key is available
let client = null;
if (process.env.PERPLEXITY_API_KEY && process.env.PERPLEXITY_API_KEY !== 'placeholder_key') {
  try {
    client = new Perplexity({
      apiKey: process.env.PERPLEXITY_API_KEY
    });
  } catch (error) {
    console.warn('⚠️  Perplexity API key invalid or missing. Using mock data.');
  }
}

export async function findRealPromises(president, yearStart, yearEnd, count = 5) {
  if (!client) {
    return {
      rawText: `Mock data for ${president}: Sample political promises during ${yearStart}-${yearEnd}`,
      sources: ['https://example.gov/sample'],
      verified: false,
      hasContent: true,
      error: 'Perplexity API key not configured'
    };
  }

  const searchQuery = `
Find ${count} specific, verifiable political promises made by ${president} during ${yearStart}-${yearEnd}.

For EACH promise, you MUST provide:
- The exact promise or commitment
- The date it was announced (YYYY-MM-DD)
- Current status: kept, broken, or partial
- Evidence: specific bill number (H.R. ###), Executive Order (EO ###), or official announcement
- Source: Full URL to .gov site, congress.gov, whitehouse.gov, or major news outlet

Format each promise clearly with its source URL.
  `.trim();

  try {
    const completion = await client.chat.completions.create({
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'You are a political fact-checker. Always provide specific source URLs for each claim. Include full https:// URLs in your response.'
        },
        {
          role: 'user',
          content: searchQuery
        }
      ]
    });

    const result = completion.choices[0].message.content;
    
    // Debug logging
    console.log(`\n--- PERPLEXITY RESPONSE for ${president} ---`);
    console.log(result.substring(0, 600));
    console.log('--- END RESPONSE ---\n');
    
    // Extract URLs - more aggressive pattern
    const urlRegex = /https?:\/\/[^\s\)\],]+/g;
    const foundUrls = result.match(urlRegex) || [];
    
    // Clean URLs (remove trailing punctuation)
    const cleanUrls = foundUrls.map(url => 
      url.replace(/[.,;:!?\]]+$/, '')
    );
    
    console.log(`  URLs found: ${cleanUrls.length}`);
    if (cleanUrls.length > 0) {
      console.log(`  Sample URLs:`, cleanUrls.slice(0, 3));
    } else {
      console.log(`  WARNING: No URLs found in response for ${president}`);
      console.log(`  Response had ${result.length} characters`);
    }
    
    // Even if no URLs, still return the text for Gemini to parse
    const hasContent = result.length > 100 && result.includes(president);
    
    return {
      rawText: result,
      sources: cleanUrls,
      verified: cleanUrls.length > 0,
      hasContent: hasContent // New flag
    };
    
  } catch (error) {
    console.error(`Perplexity search failed for ${president}:`, error.message);
    return {
      rawText: '',
      sources: [],
      verified: false,
      hasContent: false,
      error: error.message
    };
  }
}

export async function verifyPromise(promise) {
  if (!client) {
    return {
      verified: false,
      analysis: `Mock verification for: ${promise.promise || 'promise'}`,
      sources: ['https://example.gov/mock'],
      credibilityLevel: 'unverified',
      error: 'Perplexity API key not configured'
    };
  }

  const searchQuery = `
Verify this political promise with authoritative sources:

President: ${promise.president}
Promise: "${promise.promise}"
Date: ${promise.date}

Provide:
1. Confirmation (Yes/No/Partially verified)
2. Original source URL (.gov or major news)
3. Current status (kept/broken/partial)

Include full source URLs in your response.
  `.trim();

  try {
    const completion = await client.chat.completions.create({
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'Provide verification with specific source URLs. Include https:// links.'
        },
        {
          role: 'user',
          content: searchQuery
        }
      ]
    });

    const result = completion.choices[0].message.content;
    const urlRegex = /https?:\/\/[^\s\)\],]+/g;
    const foundUrls = (result.match(urlRegex) || []).map(url => 
      url.replace(/[.,;:!?\]]+$/, '')
    );
    
    return {
      verified: foundUrls.length > 0,
      analysis: result,
      sources: foundUrls,
      credibilityLevel: foundUrls.length >= 2 ? 'high' : foundUrls.length === 1 ? 'medium' : 'low'
    };
    
  } catch (error) {
    console.error('Verification failed:', error.message);
    return {
      verified: false,
      analysis: `Verification failed: ${error.message}`,
      sources: [],
      credibilityLevel: 'unverified'
    };
  }
}