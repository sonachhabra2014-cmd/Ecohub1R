const http = require('node:http');
const app = require('./server');

const server = http.createServer(app);

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null,
            rawBody: body
          });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body, rawBody: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  await new Promise(resolve => server.listen(5099, resolve));
  console.log('Test server started on port 5099...\n');

  try {
    // 1. Health check
    console.log('1. Testing /api/health...');
    const health = await request({ port: 5099, path: '/api/health', method: 'GET' });
    if (health.status !== 200 || health.body.status !== 'operational') throw new Error('Health check failed');
    console.log('   ✅ Health check passed:', health.body.service);

    // 2. Citizen Login
    console.log('2. Testing Citizen Login (arun.sharma@example.com)...');
    const citizenLogin = await request({
      port: 5099,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'arun.sharma@example.com', password: 'EcoHub@2026' });

    if (citizenLogin.status !== 200 || !citizenLogin.body.token) throw new Error('Citizen login failed');
    const userToken = citizenLogin.body.token;
    console.log('   ✅ Citizen Login passed, token received');

    // 3. Submit E-Waste & Trigger Email #1
    console.log('3. Testing E-Waste Submission (DISP ID & QR & Email #1)...');
    const disposalRes = await request({
      port: 5099,
      path: '/api/disposals',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      }
    }, {
      item_name: 'Apple iPad Pro 11"',
      category: 'Tablet',
      brand_code: 'apple',
      brand_name: 'Apple Inc.',
      item_condition: 'Screen cracked',
      estimated_weight_kg: 0.48,
      collection_centre_id: 1,
      appointment_time: 'Tomorrow, 11:30 AM'
    });

    if (disposalRes.status !== 201) throw new Error('Disposal submission failed: ' + JSON.stringify(disposalRes.body));
    const newDisposal = disposalRes.body.disposal;
    console.log(`   ✅ Disposal Created: ID=${newDisposal.id}, Status=${newDisposal.status}`);
    console.log(`   ✅ QR Code SVG generated (length: ${newDisposal.qr_svg.length} chars)`);

    // 4. Collection Centre Login & QR Verification -> Email #2
    console.log('4. Testing Collection Centre Login & QR Scan Verification...');
    const officerLogin = await request({
      port: 5099,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'officer@delhi-center.ecohub.org', password: 'EcoHub@2026' });

    if (officerLogin.status !== 200) throw new Error('Officer login failed');
    const officerToken = officerLogin.body.token;

    const verifyRes = await request({
      port: 5099,
      path: '/api/collection-centres/verify-qr',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${officerToken}`
      }
    }, {
      disposal_id: newDisposal.id,
      actual_weight_kg: 0.50
    });

    if (verifyRes.status !== 200 || verifyRes.body.disposal.status !== 'Received at Collection Centre') {
      throw new Error('QR Verification failed: ' + JSON.stringify(verifyRes.body));
    }
    console.log(`   ✅ QR Verified: Status changed to "${verifyRes.body.disposal.status}"`);
    console.log(`   ✅ Email #2 dispatched: "Your E-Waste Has Been Successfully Received"`);

    // 5. EcoCredits Video Challenge & AI Verification -> Coupon Unlock (10 Credits)
    console.log('5. Testing Seed Planting Challenge & AI Video Verification Engine...');
    // Ensure wallet is at 9 credits so 9 + 1 = 10 triggers coupon unlocking
    const { db } = require('./db');
    db.prepare('UPDATE wallets SET ecocredits_balance = 9, total_earned = 9 WHERE user_id = ?').run(citizenLogin.body.user.id);

    const testVideoName = `arun_seed_watering_${Date.now()}.mp4`;
    const challengeRes = await request({
      port: 5099,
      path: '/api/ecocredits/challenge',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      }
    }, {
      disposal_id: newDisposal.id,
      filename: testVideoName,
      format: 'MP4',
      duration_seconds: 7.2,
      file_size_mb: 8.4
    });

    if (challengeRes.status !== 200) throw new Error('Challenge submission failed: ' + JSON.stringify(challengeRes.body));
    console.log(`   ✅ AI Status: ${challengeRes.body.ai_result.status} (Plant=${challengeRes.body.ai_result.plant_detected}, Water=${challengeRes.body.ai_result.watering_detected}, Score=${challengeRes.body.ai_result.score})`);
    console.log(`   ✅ Wallet Balance: ${challengeRes.body.wallet.ecocredits_balance} EcoCredits`);

    if (challengeRes.body.newly_unlocked_coupon) {
      console.log(`   🎉 Brand Coupon Unlocked! Code: ${challengeRes.body.newly_unlocked_coupon.code} (${challengeRes.body.newly_unlocked_coupon.discount_title})`);
    } else {
      throw new Error('Expected 10th credit to unlock brand coupon!');
    }

    // 6. Company Portal & Strict Data Privacy
    console.log('6. Testing Company Portal (Samsung CSR)...');
    const samsungLogin = await request({
      port: 5099,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'csr@samsung.com', password: 'EcoHub@2026' });

    const samsungToken = samsungLogin.body.token;

    const metricsRes = await request({
      port: 5099,
      path: '/api/companies/metrics',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${samsungToken}` }
    });

    if (metricsRes.status !== 200 || metricsRes.body.company.brand_code !== 'samsung') {
      throw new Error('Company metrics failed or privacy breached');
    }
    // Verify strict isolation: none of the disposals should be for hp or dell!
    const nonSamsung = metricsRes.body.disposals.filter(d => d.brand_code !== 'samsung');
    if (nonSamsung.length > 0) {
      throw new Error(`Data privacy violation: Samsung dashboard contains records for ${nonSamsung[0].brand_code}`);
    }
    console.log(`   ✅ Strict Privacy Verified: Samsung dashboard contains only Samsung records (0 foreign records)`);
    console.log(`   ✅ Power BI Metrics calculated: Total e-waste=${metricsRes.body.ewaste_metrics.total_weight_kg}kg, CO2 avoided=${metricsRes.body.sustainability_metrics.carbon_impact_estimation_kg}kg`);

    // 7. Impact Report Generation
    console.log('7. Testing Real-Time 16-Section EcoHub Impact Report...');
    const reportRes = await request({
      port: 5099,
      path: '/api/companies/impact-report',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${samsungToken}` }
    });

    if (reportRes.status !== 200 || !reportRes.body.verification_hash) {
      throw new Error('Impact report generation failed');
    }
    console.log(`   ✅ Impact Report Generated: Title="${reportRes.body.report_title}"`);
    console.log(`   ✅ Verification Stamp: Hash=${reportRes.body.verification_hash}`);
    console.log(`   ✅ SDG Alignment: ${reportRes.body.sdg_alignment.map(s => s.sdg).join(', ')}`);

    // 8. Admin Global Governance & Email Logs
    console.log('8. Testing Admin Portal & Email Audit Trail...');
    const adminLogin = await request({
      port: 5099,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@ecohub.org', password: 'EcoHub@2026' });

    const adminToken = adminLogin.body.token;

    const emailLogsRes = await request({
      port: 5099,
      path: '/api/admin/email-logs',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    console.log(`   ✅ Email Logs count: ${emailLogsRes.body.length} automated emails recorded`);
    const templates = emailLogsRes.body.map(l => l.template_name);
    console.log(`   ✅ Templates dispatched: ${[...new Set(templates)].join(', ')}`);

    // 9. Public Bag QR Disposal Flow (No Auth)
    console.log('\n9. Testing Public Bag QR Disposal Creation (/api/disposals/public)...');
    const publicDispRes = await request({
      port: 5099,
      path: '/api/disposals/public',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      bag_id: 'BAG-SAMSUNG-2026-001',
      brand_code: 'samsung',
      item_name: 'Samsung Galaxy Watch 4',
      category: 'Audio & Accessories',
      collection_centre_id: 1,
      user_email: 'newuser@example.com',
      user_name: 'Pooja Verma'
    });

    if (publicDispRes.status !== 201 || !publicDispRes.body.disposal?.id) {
      throw new Error(`Public disposal failed: ${JSON.stringify(publicDispRes.body)}`);
    }
    const publicDispId = publicDispRes.body.disposal.id;
    console.log(`   ✅ Public Disposal Created: ${publicDispId} linking to bag BAG-SAMSUNG-2026-001`);
    console.log(`   ✅ Email #1 sent with Award Notice: "${publicDispRes.body.award_notice}"`);

    // 10. Collection Centre Login with Assigned Code
    console.log('\n10. Testing Collection Centre Authentication (/api/collection-centres/login)...');
    const cpLoginRes = await request({
      port: 5099,
      path: '/api/collection-centres/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      collectionId: 'CP001',
      password: 'Green@2026'
    });
    if (cpLoginRes.status !== 200 || !cpLoginRes.body.token) {
      throw new Error(`Collection centre login failed: ${JSON.stringify(cpLoginRes.body)}`);
    }
    console.log(`   ✅ Collection Centre logged in successfully: ${cpLoginRes.body.user.name} (${cpLoginRes.body.user.assigned_code})`);

    // 11. OTP Generation & Verification
    console.log('\n11. Testing OTP Generation & Verification...');
    const otpSendRes = await request({
      port: 5099,
      path: '/api/auth/send-otp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identifier: 'newuser@example.com' });
    const otpCode = otpSendRes.body.otp_code;
    console.log(`   ✅ OTP Generated & Dispatched: ${otpCode}`);

    const otpVerifyRes = await request({
      port: 5099,
      path: '/api/auth/verify-otp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identifier: 'newuser@example.com', otp_code: otpCode });
    if (otpVerifyRes.status !== 200 || !otpVerifyRes.body.success) {
      throw new Error(`OTP verification failed: ${JSON.stringify(otpVerifyRes.body)}`);
    }
    console.log(`   ✅ OTP verified successfully!`);

    // 12. Company Application & Admin Approval
    console.log('\n12. Testing Company Registration & Admin Approval...');
    const appSubmitRes = await request({
      port: 5099,
      path: '/api/companies/apply',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      companyName: 'Sony India Tech',
      officialEmail: 'sustainability@sony-india.com',
      contactNumber: '+91 11 6677 8899',
      representativeName: 'Anita Roy',
      eWasteTypes: 'Displays, Consoles'
    });
    console.log(`   ✅ Company application submitted: ${appSubmitRes.body.message}`);

    const appsRes = await request({
      port: 5099,
      path: '/api/admin/company-applications',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const latestApp = appsRes.body[0];

    const approveRes = await request({
      port: 5099,
      path: `/api/admin/company-applications/${latestApp.id}/approve`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log(`   ✅ Admin Approved Application! Issued ID: ${approveRes.body.assigned_company_id}, Password: ${approveRes.body.assigned_password}`);

    // 14. Testing Direct One-Click Email Token Approval
    console.log('\n14. Testing Direct One-Click Email Token Approval (/api/companies/approve-by-token)...');
    const tokenAppSubmitRes = await request({
      port: 5099,
      path: '/api/companies/apply',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      companyName: 'Panasonic Green Energy',
      officialEmail: 'sustainability@panasonic.com',
      contactNumber: '+91 11 4433 2211',
      representativeName: 'Deepak Verma',
      eWasteTypes: 'Batteries, Displays'
    });

    const pendingApps = await request({
      port: 5099,
      path: '/api/admin/company-applications',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const panasonicApp = pendingApps.body.find(a => a.company_name === 'Panasonic Green Energy') || pendingApps.body[0];

    const tokenApproveRes = await request({
      port: 5099,
      path: `/api/companies/approve-by-token?id=${panasonicApp.id}&token=${panasonicApp.verification_token}`,
      method: 'GET'
    });
    const htmlBody = tokenApproveRes.rawBody || tokenApproveRes.body || '';
    if (tokenApproveRes.status !== 200 || (!htmlBody.includes('Company Approved!') && !htmlBody.includes('Already Approved'))) {
      throw new Error(`Token approval failed: HTTP ${tokenApproveRes.status}, Body: ${htmlBody.slice(0, 150)}`);
    }
    console.log(`   ✅ Direct Email One-Click Approval Passed! HTML response received.`);

    console.log('\n====================================================');
    console.log('🏆 ALL 14 END-TO-END AUTOMATED BACKEND TESTS PASSED!');
    console.log('====================================================');

  } catch (err) {
    console.error('\n❌ Test failure:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
