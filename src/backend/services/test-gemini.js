import 'dotenv/config';
import { generateHistoricalPromises, analyzePromise } from './gemini.js';

async function test() {
  try {
    console.log('🧪 Testing Gemini API...\n');
    
    const promises = await generateHistoricalPromises('Trump', 2016, 2020);
    
    console.log(`✅ Generated ${promises.length} promises\n`);
    console.log('First promise:');
    console.log(JSON.stringify(promises[0], null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();