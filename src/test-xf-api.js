const fetch = require('node-fetch');

async function testXFAPI(word = 'through') {
  try {
    console.log(`Testing XF Dictionary API for word: ${word}`);
    console.log('----------------------------------------');

    const response = await fetch(`YOUR_XF_DICTIONARY_API_ENDPOINT?word=${encodeURIComponent(word)}`, {
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Print formatted results
    console.log('Results:');
    console.log('----------------------------------------');
    
    // Print pronunciations
    if (data.pronunciations && data.pronunciations.length > 0) {
      console.log('\nPronunciations:');
      data.pronunciations[0].entries.forEach(entry => {
        entry.textual.forEach(t => {
          console.log(`- ${t.pronunciation}`);
        });
      });
    }
    
    // Print frequency information
    if (data.wordFrequencies && data.wordFrequencies.length > 0) {
      const freq = data.wordFrequencies[0].frequencies[0];
      if (freq) {
        console.log(`\nFrequency band: ${freq.frequencyBand}`);
      }
    }
    
    // Print definitions and examples
    console.log('\nDefinitions and Examples:');
    data.items.forEach(item => {
      console.log(`\n[${item.partOfSpeech}]`);
      
      item.definitions.forEach((def, index) => {
        console.log(`${index + 1}. ${def.definition}`);
        
        if (def.examples && def.examples.length > 0) {
          console.log('   Examples:');
          def.examples.forEach(example => {
            console.log(`   • ${example}`);
          });
        }
      });
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Get word from command line argument or use default
const word = process.argv[2] || 'through';
testXFAPI(word); 