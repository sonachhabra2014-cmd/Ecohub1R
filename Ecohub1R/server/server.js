require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });

const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

// Controllers
const authController = require('./controllers/authController');
const disposalController = require('./controllers/disposalController');
const collectionCentreController = require('./controllers/collectionCentreController');
const ecoCreditsController = require('./controllers/ecoCreditsController');
const companyController = require('./controllers/companyController');
const adminController = require('./controllers/adminController');

// Middlewares
const { authenticate, requireRole, enforceCompanyPrivacy } = require('./middleware/auth');
const { db } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Universal CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// JSON and URL-encoded body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// --- API ROUTES ---

// Health
app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'EcoHub API Engine',
    version: '2026.1.0',
    timestamp: new Date().toISOString()
  });
});

// Public Brands list
app.get('/api/brands', companyController.getAvailableBrands);

// 1. Authentication & OTP
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.get('/api/auth/profile', authenticate, authController.getProfile);
app.post('/api/auth/send-otp', authController.sendOTP);
app.post('/api/auth/verify-otp', authController.verifyOTP);
app.get('/api/auth/verify/:token', authController.verifyEmailToken);
app.get('/api/company-registration/verify/:token', authController.verifyEmailToken);
app.post('/api/auth/register-with-otp', authController.registerWithOTP);
app.post('/api/auth/register-otp', authController.registerWithOTP);

// 2. Disposals & E-Waste Submissions (Step 1 -> Email #1)
app.post('/api/disposals', authenticate, disposalController.submitDisposal);
app.post('/api/disposals/public', disposalController.submitPublicDisposal);
app.get('/api/disposals/my', authenticate, disposalController.getUserDisposals);
app.get('/api/disposals/journey/:id', disposalController.getDisposalJourney);
app.get('/api/disposals/:id', disposalController.getDisposalById);
app.get('/api/ecobags/:bagId', disposalController.getBagInfo);

// 3. Collection Centres & QR Scanning (Step 2 -> Email #2)
app.get('/api/collection-centres', collectionCentreController.getCentres);
app.post('/api/collection-centres/register', collectionCentreController.registerCentre);
app.post('/api/collection-centres/login', collectionCentreController.loginCentre);
app.post('/api/collection-centres/verify-qr', authenticate, requireRole('collection_centre'), collectionCentreController.verifyDisposalQR);
app.post('/api/verify/submit', authenticate, requireRole('collection_centre'), collectionCentreController.verifyDisposalQR);
app.get('/api/collection-centres/dashboard', authenticate, requireRole('collection_centre'), collectionCentreController.getCentreDashboard);

// Admin one-click email approval links for centres
app.get('/api/collection-centres/approve-by-token', collectionCentreController.approveCollectionCentreByToken);
app.get('/api/collection-centres/reject-by-token', collectionCentreController.rejectCollectionCentreByToken);
// Admin: list pending centre applications
app.get('/api/admin/centre-applications', authenticate, requireRole('admin'), adminController.getCentreApplications);
app.post('/api/admin/centre-applications/:id/approve', authenticate, requireRole('admin'), adminController.approveCentreApplication);
app.post('/api/admin/centre-applications/:id/status', authenticate, requireRole('admin'), adminController.updateCentreStatus);

// 4. EcoCredits, Separate Plants & AI Verification (Step 3 -> AI Challenge -> Wallet & Rewards)
app.get('/api/ecocredits/plants', authenticate, ecoCreditsController.getUserPlants);
app.get('/api/ecocredits/challenge/prompt', authenticate, ecoCreditsController.getVideoChallenge);
app.post('/api/ecocredits/challenge', authenticate, ecoCreditsController.submitChallenge);
app.get('/api/ecocredits/wallet', authenticate, ecoCreditsController.getWallet);
app.get('/api/ecocredits/gamification', authenticate, ecoCreditsController.getGamification);

// 5. Company Portal (Registration, EcoBag Ordering, Compliance Analytics, Impact Report)
app.post('/api/companies/apply', companyController.applyCompany);
app.get('/api/companies/approve-by-token', companyController.approveCompanyByToken);
app.get('/api/companies/reject-by-token', companyController.rejectCompanyByToken);
app.get('/api/companies/metrics', authenticate, enforceCompanyPrivacy, companyController.getCompanyMetrics);
app.get('/api/companies/impact-report', authenticate, enforceCompanyPrivacy, companyController.getImpactReport);
app.post('/api/companies/order-bags', authenticate, enforceCompanyPrivacy, companyController.orderBags);
app.get('/api/companies/bags', authenticate, enforceCompanyPrivacy, companyController.getCompanyBags);

// 6. Admin Portal (Global Governance, Company Approvals, Bag QR Printing, AI Queue, Exceptions, Orders, Audit)
app.get('/api/admin/overview', authenticate, requireRole('admin'), adminController.getAdminOverview);
app.get('/api/admin/company-applications', authenticate, requireRole('admin'), adminController.getCompanyApplications);
app.post('/api/admin/company-applications/:id/approve', authenticate, requireRole('admin'), adminController.approveCompanyApplication);
app.post('/api/admin/company-applications/:id/status', authenticate, requireRole('admin'), adminController.updateCompanyStatus);
app.get('/api/admin/exceptions', authenticate, requireRole('admin'), adminController.getVerificationExceptions);
app.post('/api/admin/exceptions/:id/resolve', authenticate, requireRole('admin'), adminController.resolveVerificationException);
app.get('/api/admin/ecobag-orders', authenticate, requireRole('admin'), adminController.getAllEcoBagOrders);
app.post('/api/admin/ecobag-orders/:id/status', authenticate, requireRole('admin'), adminController.updateEcoBagOrderStatus);
app.get('/api/admin/audit-ledger', authenticate, requireRole('admin'), adminController.getAuditLedger);
app.get('/api/admin/bag-qrs', authenticate, requireRole('admin'), adminController.getBagQRsForPrinting);
app.get('/api/admin/ai-queue', authenticate, requireRole('admin'), adminController.getAIReviewQueue);
app.post('/api/admin/ai-override', authenticate, requireRole('admin'), adminController.overrideChallengeStatus);
app.get('/api/admin/email-logs', authenticate, requireRole('admin'), adminController.getEmailLogs);
app.get('/api/admin/users', authenticate, requireRole('admin'), adminController.getAllUsers);
app.get('/api/admin/disposals', authenticate, requireRole('admin'), adminController.getAllDisposals);

// 7. In-App Notifications
app.get('/api/notifications', authenticate, (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 20
  `).all(req.user.id);
  res.json(notifications);
});

app.post('/api/notifications/:id/read', authenticate, (req, res) => {
  db.prepare(`
    UPDATE notifications SET is_read = 1 
    WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Serve Frontend in Production
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 EcoHub Production Server running on port ${PORT}`);
    console.log(`🌐 Base URL: http://localhost:${PORT}`);
    console.log(`📡 Health: http://localhost:${PORT}/api/health`);
    console.log(`====================================================`);
  });
}

module.exports = app;
