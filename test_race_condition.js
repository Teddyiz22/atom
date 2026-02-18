#!/usr/bin/env node

/**
 * Race Condition Test Script
 * 
 * This script tests the race condition fix by sending multiple concurrent
 * requests to the /api/place-order endpoint to verify that:
 * 1. Only one order succeeds when balance is insufficient for multiple orders
 * 2. User locking prevents concurrent orders from the same user
 * 3. Database transactions maintain consistency
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'https://atomgameshop.com'; // Change to your server URL
const TEST_CONFIG = {
  // Test user credentials (you'll need to provide valid session cookie)
  sessionCookie: 'sessionId=s%3Ab76e318c8b04a97011c19fc941bdc5b0158cfe0829ecd07b6843ebc8872d8946.q5HqYevM3rrj2LIRQyNzKgK2Id9noaxtXOuyOlaJ9Lo',
  csrfToken: '1n1LgyGK-oNYoVZPJ315UXz4o8piViRU1GbI', // You'll need to get a valid CSRF token
  
  // Order details
  orderData: {
    userid: "186874428",
    zoneid: "2973", 
    product_id: "1955",
    currency: "MMK"
  },
  
  // Number of concurrent requests to send
  concurrentRequests: 10,
  
  // Delay between request batches (ms)
  batchDelay: 100
};

// Helper function to make a purchase request
async function makePurchaseRequest(requestId) {
  try {
    const response = await axios.post(`${BASE_URL}/api/place-order`, TEST_CONFIG.orderData, {
      headers: {
        'Cookie': TEST_CONFIG.sessionCookie,
        'X-Csrf-Token': TEST_CONFIG.csrfToken,
        'Content-Type': 'application/json',
        'User-Agent': `RaceConditionTest-${requestId}`
      },
      timeout: 10000 // 10 second timeout
    });
    
    return {
      requestId,
      success: true,
      status: response.status,
      data: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      requestId,
      success: false,
      status: error.response?.status || 0,
      error: error.response?.data || error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Main test function
async function runRaceConditionTest() {
  console.log('🧪 Starting Race Condition Test');
  console.log(`📊 Configuration:`);
  console.log(`   - Base URL: ${BASE_URL}`);
  console.log(`   - Concurrent Requests: ${TEST_CONFIG.concurrentRequests}`);
  console.log(`   - Product ID: ${TEST_CONFIG.orderData.product_id}`);
  console.log(`   - User ID: ${TEST_CONFIG.orderData.userid}`);
  console.log('');

  // Send concurrent requests
  console.log('🚀 Sending concurrent requests...');
  const startTime = Date.now();
  
  const promises = [];
  for (let i = 1; i <= TEST_CONFIG.concurrentRequests; i++) {
    promises.push(makePurchaseRequest(i));
  }
  
  // Wait for all requests to complete
  const results = await Promise.all(promises);
  const endTime = Date.now();
  
  // Analyze results
  console.log('📈 Test Results:');
  console.log(`   - Total Time: ${endTime - startTime}ms`);
  console.log(`   - Total Requests: ${results.length}`);
  
  const successful = results.filter(r => r.success && r.status === 200);
  const failed = results.filter(r => !r.success || r.status !== 200);
  const rateLimited = results.filter(r => r.status === 429);
  const userLocked = results.filter(r => r.status === 429 && r.error?.message?.includes('already being processed'));
  const insufficientBalance = results.filter(r => r.status === 400 && r.error?.message?.includes('Insufficient balance'));
  
  console.log(`   - Successful Orders: ${successful.length}`);
  console.log(`   - Failed Requests: ${failed.length}`);
  console.log(`   - Rate Limited: ${rateLimited.length}`);
  console.log(`   - User Locked: ${userLocked.length}`);
  console.log(`   - Insufficient Balance: ${insufficientBalance.length}`);
  console.log('');
  
  // Detailed results
  console.log('📋 Detailed Results:');
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const message = result.success 
      ? `SUCCESS (${result.status}): ${result.data?.message || 'Order placed'}`
      : `FAILED (${result.status}): ${result.error?.message || result.error}`;
    
    console.log(`   ${status} Request ${result.requestId}: ${message}`);
  });
  
  console.log('');
  
  // Test evaluation
  console.log('🔍 Test Evaluation:');
  
  if (successful.length <= 1) {
    console.log('✅ PASS: Race condition prevented - only 0-1 orders succeeded');
  } else {
    console.log('❌ FAIL: Race condition detected - multiple orders succeeded');
  }
  
  if (userLocked.length > 0) {
    console.log('✅ PASS: User locking is working - concurrent requests blocked');
  } else if (rateLimited.length > 0) {
    console.log('✅ PASS: Rate limiting is working - requests throttled');
  } else {
    console.log('⚠️  WARNING: No user locking or rate limiting detected');
  }
  
  if (failed.length > 0 && successful.length <= 1) {
    console.log('✅ PASS: System properly rejected excess requests');
  }
  
  console.log('');
  console.log('🏁 Test Complete');
}

// Run the test
if (require.main === module) {
  runRaceConditionTest().catch(error => {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  });
}

module.exports = { runRaceConditionTest, makePurchaseRequest };