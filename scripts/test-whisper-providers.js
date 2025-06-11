#!/usr/bin/env node

/**
 * Whisper Provider Benchmark Script
 * 
 * This script helps you test and compare different Whisper providers
 * to find the best one for your latency requirements.
 */

const fs = require('fs');
const path = require('path');

// Test audio file (you'll need to provide a short audio file)
const TEST_AUDIO_PATH = './test-audio.webm'; // 5-10 second audio file

const providers = {
  openai: {
    name: 'OpenAI Whisper API',
    endpoint: 'https://api.openai.com/v1/audio/transcriptions',
    costPerMinute: 0.006,
    expectedLatency: '200-500ms'
  },
  assemblyai: {
    name: 'AssemblyAI',
    endpoint: 'https://api.assemblyai.com/v2/transcript',
    costPerMinute: 0.015, // $0.00025/sec * 60
    expectedLatency: '300-800ms'
  },
  deepgram: {
    name: 'Deepgram',
    endpoint: 'https://api.deepgram.com/v1/listen',
    costPerMinute: 0.0049,
    expectedLatency: '200-600ms'
  }
};

async function testProvider(providerKey, apiKey) {
  const provider = providers[providerKey];
  if (!provider) {
    throw new Error(`Unknown provider: ${providerKey}`);
  }

  console.log(`\n🧪 Testing ${provider.name}...`);
  console.log(`Expected latency: ${provider.expectedLatency}`);
  console.log(`Cost per minute: $${provider.costPerMinute}`);

  if (!fs.existsSync(TEST_AUDIO_PATH)) {
    console.log(`⚠️  Test audio file not found: ${TEST_AUDIO_PATH}`);
    console.log('   Please provide a 5-10 second WebM audio file for testing');
    return null;
  }

  const audioBuffer = fs.readFileSync(TEST_AUDIO_PATH);
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer]), 'test.webm');

  const startTime = Date.now();
  
  try {
    let response;
    
    switch (providerKey) {
      case 'openai':
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'json');
        response = await fetch(provider.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData,
        });
        break;
        
      case 'assemblyai':
        // AssemblyAI requires two-step process
        const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
          method: 'POST',
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/octet-stream',
          },
          body: audioBuffer,
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.statusText}`);
        }
        
        const { upload_url } = await uploadResponse.json();
        
        response = await fetch(provider.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio_url: upload_url,
            real_time: true,
          }),
        });
        break;
        
      case 'deepgram':
        response = await fetch(provider.endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'audio/webm',
          },
          body: audioBuffer,
        });
        break;
    }

    const endTime = Date.now();
    const latency = endTime - startTime;

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const result = await response.json();
    let transcription = '';
    
    switch (providerKey) {
      case 'openai':
        transcription = result.text || '';
        break;
      case 'assemblyai':
        transcription = result.text || '';
        break;
      case 'deepgram':
        transcription = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        break;
    }

    return {
      provider: provider.name,
      latency,
      transcription: transcription.trim(),
      success: true,
      costPerMinute: provider.costPerMinute
    };

  } catch (error) {
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    return {
      provider: provider.name,
      latency,
      error: error.message,
      success: false,
      costPerMinute: provider.costPerMinute
    };
  }
}

async function runBenchmark() {
  console.log('🚀 Whisper Provider Benchmark');
  console.log('=============================\n');

  // Check for API keys
  const apiKeys = {
    openai: process.env.OPENAI_API_KEY,
    assemblyai: process.env.ASSEMBLYAI_API_KEY,
    deepgram: process.env.DEEPGRAM_API_KEY
  };

  const results = [];

  for (const [providerKey, apiKey] of Object.entries(apiKeys)) {
    if (!apiKey) {
      console.log(`⚠️  No API key found for ${providers[providerKey]?.name || providerKey}`);
      continue;
    }

    const result = await testProvider(providerKey, apiKey);
    if (result) {
      results.push(result);
    }
  }

  // Display results
  console.log('\n📊 Benchmark Results');
  console.log('===================\n');

  const successfulResults = results.filter(r => r.success);
  
  if (successfulResults.length === 0) {
    console.log('❌ No successful tests. Check your API keys and test audio file.');
    return;
  }

  // Sort by latency
  successfulResults.sort((a, b) => a.latency - b.latency);

  successfulResults.forEach((result, index) => {
    const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    
    console.log(`${rank} ${result.provider}`);
    console.log(`   Latency: ${result.latency}ms`);
    console.log(`   Cost: $${result.costPerMinute}/minute`);
    console.log(`   Transcription: "${result.transcription}"`);
    console.log('');
  });

  // Recommendations
  console.log('💡 Recommendations:');
  console.log('===================\n');

  const fastest = successfulResults[0];
  const cheapest = successfulResults.reduce((a, b) => a.costPerMinute < b.costPerMinute ? a : b);
  const bestOverall = successfulResults.find(r => r.latency < 500 && r.costPerMinute < 0.01);

  console.log(`🏃 Fastest: ${fastest.provider} (${fastest.latency}ms)`);
  console.log(`💰 Cheapest: ${cheapest.provider} ($${cheapest.costPerMinute}/min)`);
  
  if (bestOverall) {
    console.log(`⭐ Best Overall: ${bestOverall.provider} (${bestOverall.latency}ms, $${bestOverall.costPerMinute}/min)`);
  }

  console.log('\n📝 Usage in your app:');
  console.log('====================\n');
  
  console.log('1. Set your preferred provider in the dropdown');
  console.log('2. Adjust chunk interval based on your needs:');
  console.log('   - 500ms: Fastest response, higher cost');
  console.log('   - 1000ms: Good balance');
  console.log('   - 2000ms: Lower cost, slower response');
}

// Run the benchmark
if (require.main === module) {
  runBenchmark().catch(console.error);
}

module.exports = { testProvider, runBenchmark }; 