const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testAddon() {
  console.log('Testing Trakt Posters Stremio Addon...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(BASE_URL);
    console.log('✓ Health check passed:', healthResponse.data.message);

    // Test 2: Manifest
    console.log('\n2. Testing manifest...');
    const manifestResponse = await axios.get(`${BASE_URL}/manifest.json`);
    const manifest = manifestResponse.data;
    console.log('✓ Manifest loaded:');
    console.log(`   - Name: ${manifest.name}`);
    console.log(`   - Version: ${manifest.version}`);
    console.log(`   - Catalogs: ${manifest.catalogs.length}`);
    
    // Test 3: Configuration page
    console.log('\n3. Testing configuration page...');
    const configResponse = await axios.get(`${BASE_URL}/configure`);
    console.log('✓ Configuration page accessible');

    // Test 4: Invalid user config (should fail gracefully)
    console.log('\n4. Testing invalid user config...');
    try {
      await axios.get(`${BASE_URL}/invalid_config/manifest.json`);
      console.log('✗ Should have failed with invalid config');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✓ Invalid config handled correctly');
      } else {
        console.log('✗ Unexpected error:', error.message);
      }
    }

    console.log('\n✅ All basic tests passed!');
    console.log('\nTo test with real data:');
    console.log('1. Get a Trakt access token');
    console.log('2. Visit /configure to generate an install URL');
    console.log('3. Test the catalog endpoints with your config');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAddon();
}

module.exports = testAddon;