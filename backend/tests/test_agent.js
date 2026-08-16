const path = require('path');
// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { runResearchAgent } = require('../services/research/researchAgent');

async function testAgent() {
  const prompt = 'What are the top 3 interview trends for Senior React Developers in 2026?';
  console.log(`Starting Agent Test with prompt: "${prompt}"\n`);
  
  try {
    const result = await runResearchAgent(prompt);
    
    console.log('\n--- FINAL RESULT ---');
    console.log('ANSWER:\n', result.answer);
    console.log('\nSOURCES:');
    result.sources.forEach((s, i) => {
      console.log(`${i + 1}. ${s.title} (${s.url})`);
    });
    
    console.log('\nSTEPS / LOGS:');
    result.steps.forEach((step) => {
      console.log(`\n[Step ${step.stepNumber}] Called: ${step.toolName}`);
      console.log(`Thought: ${step.thought}`);
      console.log(`Query: ${step.query}`);
      console.log(`Results: Found ${step.results.length} items`);
      step.results.forEach((r, idx) => {
        console.log(`  - (${idx + 1}) [${r.title}](${r.url})`);
      });
    });
  } catch (error) {
    console.error('Agent test failed:', error);
  }
}

testAgent();
