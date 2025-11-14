// Simple test script for the API
import fetch from 'node-fetch';

const API_URL = 'http://localhost:4000';

async function testAPI() {
  console.log('🧪 Testing Adventure Works API...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${API_URL}/api/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);

    // Test products endpoint
    console.log('\n2. Testing products endpoint...');
    const productsResponse = await fetch(`${API_URL}/api/products`);
    const products = await productsResponse.json();
    console.log('✅ Products loaded:', products.length, 'products');

    // Test categories endpoint
    console.log('\n3. Testing categories endpoint...');
    const categoriesResponse = await fetch(`${API_URL}/api/categories`);
    const categories = await categoriesResponse.json();
    console.log('✅ Categories:', categories);

    // Test signup
    console.log('\n4. Testing user signup...');
    const signupResponse = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpassword123',
        name: 'Test User'
      })
    });
    
    if (signupResponse.ok) {
      const signupData = await signupResponse.json();
      console.log('✅ User created successfully');
      
      // Test signin
      console.log('\n5. Testing user signin...');
      const signinResponse = await fetch(`${API_URL}/api/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'testpassword123'
        })
      });
      
      if (signinResponse.ok) {
        const signinData = await signinResponse.json();
        console.log('✅ User signed in successfully');
        console.log('✅ API integration test completed successfully!');
      } else {
        console.log('❌ Signin failed:', await signinResponse.text());
      }
    } else {
      console.log('❌ Signup failed:', await signupResponse.text());
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPI();





