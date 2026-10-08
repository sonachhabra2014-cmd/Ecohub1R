const { db } = require('../db');
// Removed circular import
const { signToken } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const smtpTransport = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

const emailFrom = process.env.EMAIL_FROM || process.env.SMTP_USER;

function logEmail(recipientEmail, recipientName, subject, templateName, bodyHtml, attachments = []) {
  try {
    const stmt = db.prepare(`
      INSERT INTO email_logs (recipient_email, recipient_name, subject, template_name, body_html, sent_at, status)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `);
    const result = stmt.run(
      recipientEmail,
      recipientName,
      subject,
      templateName,
      bodyHtml,
      smtpTransport && emailFrom ? 'Pending' : 'Logged'
    );
    if (!smtpTransport || !emailFrom) {
      console.warn(`[EMAIL AUTOMATION] Logged only (SMTP not configured): "${subject}" to ${recipientEmail}`);
      return;
    }

    smtpTransport.sendMail({
      from: emailFrom,
      to: recipientEmail,
      subject,
      html: bodyHtml,
      attachments
    }).then(() => {
      db.prepare("UPDATE email_logs SET status = 'Delivered' WHERE id = ?").run(result.lastInsertRowid);
      console.log(`[EMAIL AUTOMATION] Sent "${subject}" to ${recipientEmail}`);
    }).catch((err) => {
      db.prepare("UPDATE email_logs SET status = 'Failed' WHERE id = ?").run(result.lastInsertRowid);
      console.error(`[EMAIL AUTOMATION] Failed to send "${subject}" to ${recipientEmail}:`, err.message);
    });
  } catch (err) {
    console.error('Error logging email:', err);
  }
}

function createInAppNotification(userId, type, title, message, ctaLink) {
  try {
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, cta_link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `);
    stmt.run(userId, type, title, message, ctaLink);
  } catch (err) {
    console.error('Error creating in-app notification:', err);
  }
}

// EMAIL #1: DISPOSAL CONFIRMATION (PROFESSIONAL CERTIFICATE PASS STYLE)
function sendEmail1DisposalConfirmation({ userEmail, userName, disposalId, centreName, centreAddress, qrCodeData, appointmentInfo, userId }) {
  const subject = `EcoHub Official Disposal Record & Verification Pass [${disposalId}]`;
  const qrContent = qrCodeData && qrCodeData.includes(',') ? qrCodeData.split(',')[1] : null;
  const qrContentId = `ecohub-qr-${disposalId}@ecohub.local`;
  const submissionDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const bodyHtml = `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1f2937; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
      <!-- Official Header -->
      <div style="background: #1f2937; padding: 26px 32px; border-bottom: 4px solid #0f9d58;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">
              ECO<span style="color: #0f9d58;">HUB</span>
            </h1>
            <p style="color: #9ca3af; margin: 4px 0 0 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">
              Evidence-Based E-Waste Verification Platform
            </p>
          </div>
          <div style="text-align: right;">
            <span style="background: rgba(15, 157, 88, 0.15); color: #34d399; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; border: 1px solid rgba(52, 211, 153, 0.3);">
              DIGITAL DISPOSAL PASS
            </span>
          </div>
        </div>
      </div>
      
      <!-- Certificate Pass Body -->
      <div style="padding: 32px;">
        <p style="font-size: 15px; margin-top: 0; color: #374151;">Dear <strong>${userName || 'Responsible Citizen'}</strong>,</p>
        
        <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 24px;">
          Your electronic waste disposal request has been registered in the EcoHub National Audit Registry. Please present this verified digital pass at your selected authorized collection centre.
        </p>

        <!-- Official Record Table / Certificate Card -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px; margin-bottom: 24px;">
          <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Disposal Identification</span>
            <span style="font-size: 11px; color: #0f9d58; font-weight: 600;">CPCB SCHEDULE-IV ALIGNED</span>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; width: 40%;">Disposal ID:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #0f9d58; font-family: monospace; font-size: 15px;">${disposalId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Submission Date:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #1f2937;">${submissionDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Collection Centre:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #1f2937;">${centreName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Centre Address:</td>
              <td style="padding: 6px 0; color: #4b5563;">${centreAddress || 'Authorized Collection Facility'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Verification Status:</td>
              <td style="padding: 6px 0;">
                <span style="display: inline-block; background: #fef3c7; color: #92400e; font-weight: 600; font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid #fde68a;">
                  Pending Authorized Verification
                </span>
              </td>
            </tr>
          </table>
        </div>

        <!-- Verification QR Code -->
        ${qrContent ? `
        <div style="text-align: center; margin: 24px 0; padding: 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px;">
          <p style="margin: 0 0 12px 0; font-weight: 700; color: #1f2937; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">
            Scan Pass at Collection Centre
          </p>
          <div style="display: inline-block; padding: 10px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
            <img src="cid:${qrContentId}" alt="EcoHub Disposal Pass QR" width="220" height="220" style="display: block; width: 220px; height: 220px;" />
          </div>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">
            The collection centre officer will scan this code, capture live hardware photo evidence, and verify GPS coordinates.
          </p>
        </div>` : ''}

        <!-- Trust & Evidence Notice -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0; font-size: 13px; font-weight: 600; color: #166534;">
            🛡️ Tamper-Evident Evidence Trail
          </p>
          <p style="margin: 6px 0 0 0; font-size: 12px; color: #15803d; line-height: 1.5;">
            Once verified at the collection centre, this record is permanently locked with an immutable Trust Score, side-by-side photographic evidence, and verified timestamp. You will instantly receive your verified reward points.
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background: #f8fafc; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #6b7280;">
        EcoHub National E-Waste Verification Platform &bull; Responsible E-Waste. Verified Impact.
      </div>
    </div>
  `;

  const attachments = qrContent ? [{
    filename: `ecohub-${disposalId}-pass.png`,
    content: Buffer.from(qrContent, 'base64'),
    contentType: 'image/png',
    cid: qrContentId
  }] : [];

  logEmail(userEmail, userName, subject, 'disposal_confirmation', bodyHtml, attachments);
  if (userId) {
    createInAppNotification(
      userId,
      'disposal_created',
      'Disposal Record Created',
      `Disposal ID ${disposalId} generated for ${centreName}. Digital pass ready.`,
      '/citizen'
    );
  }
}

// EMAIL #2: VERIFICATION COMPLETED & REWARD CREDITED (CERTIFICATE STYLE)
function sendEmail2ItemReceived({ userEmail, userName, disposalId, centreName, userId, trustScore = 96 }) {
  const subject = `Verified Disposal Certificate & Rewards Unlocked [${disposalId}]`;
  const verificationDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const bodyHtml = `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1f2937; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
      <!-- Official Header -->
      <div style="background: #0f9d58; padding: 26px 32px; text-align: center;">
        <span style="font-size: 28px;">✓</span>
        <h1 style="color: #ffffff; margin: 8px 0 0 0; font-size: 22px; font-weight: 700;">
          E-Waste Disposal Verified & Locked
        </h1>
        <p style="color: #d1fae5; margin: 4px 0 0 0; font-size: 13px;">
          Official Certificate of Responsible E-Waste Disposal
        </p>
      </div>

      <!-- Body Content -->
      <div style="padding: 32px;">
        <p style="font-size: 15px; margin-top: 0; color: #374151;">Dear <strong>${userName || 'EcoHub Contributor'}</strong>,</p>
        
        <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
          Your electronic waste submission with Disposal ID <strong>${disposalId}</strong> has been physically received, photographic evidence verified, and permanently recorded in the EcoHub National Audit Registry.
        </p>

        <!-- Official Locked Record -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; width: 40%;">Disposal ID:</td>
              <td style="padding: 6px 0; font-weight: 700; color: #0f9d58; font-family: monospace;">${disposalId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Verification Date:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #1f2937;">${verificationDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Verified Collection Hub:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #1f2937;">${centreName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Verification Status:</td>
              <td style="padding: 6px 0;">
                <span style="display: inline-block; background: #ecfdf5; color: #065f46; font-weight: 700; font-size: 11px; padding: 3px 8px; border-radius: 4px; border: 1px solid #a7f3d0;">
                  🔒 VERIFIED & LOCKED (READ-ONLY)
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280;">Audit Trust Score:</td>
              <td style="padding: 6px 0; font-weight: 800; color: #0f9d58; font-size: 14px;">${trustScore} / 100</td>
            </tr>
          </table>
        </div>

        <!-- Reward Notice -->
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
          <h3 style="margin: 0 0 6px 0; color: #15803d; font-size: 17px;">Reward Points Credited</h3>
          <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.5;">
            Your verified reward points have been credited to your EcoHub wallet. You can view your points history, redeem brand rewards, and download your Official Green Certificate from your dashboard.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #f8fafc; padding: 16px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #6b7280;">
        EcoHub National E-Waste Verification Platform &bull; Responsible E-Waste. Verified Impact.
      </div>
    </div>
  `;

  logEmail(userEmail, userName, subject, 'item_verified', bodyHtml);
  if (userId) {
    createInAppNotification(
      userId,
      'item_received',
      "E-Waste Disposal Verified & Locked",
      `Disposal ${disposalId} has been verified at ${centreName} with Trust Score ${trustScore}/100. Reward points credited!`,
      '/citizen'
    );
  }
}

// EMAIL #3: BRAND COUPON UNLOCKED REWARD
function sendRewardCouponEmail({ userEmail, userName, brandName, couponCode, discountTitle, expiryDate, userId }) {
  const subject = `🎁 Exclusive ${brandName} Reward Coupon Unlocked! [${couponCode}]`;
  const bodyHtml = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b;">
      <div style="background: #1e1b4b; padding: 24px; text-align: center; border-bottom: 3px solid #818cf8;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🏆 ECOCREDIT REWARD UNLOCKED</h1>
        <p style="color: #c7d2fe; margin: 5px 0 0 0; font-size: 13px;">EcoHub Sustainability Milestone Achievement</p>
      </div>

      <div style="padding: 28px;">
        <p style="font-size: 16px; margin-top: 0;">Congratulations <strong>${userName}</strong>!</p>
        
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          You have achieved <strong>10 verified EcoCredits</strong>! As a token of appreciation from our corporate sustainability partners, your exclusive brand voucher is now ready.
        </p>

        <div style="background: #eef2ff; border: 2px solid #6366f1; border-radius: 12px; padding: 24px; text-align: center; margin: 25px 0;">
          <span style="display: inline-block; background: #4f46e5; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 10px;">
            ${brandName.toUpperCase()} OFFICIAL PARTNER
          </span>
          <h2 style="margin: 0 0 8px 0; color: #312e81; font-size: 22px;">${discountTitle}</h2>
          <div style="background: #ffffff; border: 2px dashed #818cf8; padding: 12px 20px; border-radius: 8px; display: inline-block; margin: 12px 0;">
            <span style="font-size: 26px; font-weight: 800; color: #4338ca; letter-spacing: 0.1em;">${couponCode}</span>
          </div>
          <p style="margin: 8px 0 0 0; font-size: 13px; color: #4b5563;">
            Valid until: <strong>${expiryDate}</strong>
          </p>
        </div>

        <p style="font-size: 14px; color: #475569; line-height: 1.5;">
          Redeem this coupon on the official ${brandName} online store or authorized retail centers during checkout.
        </p>
      </div>

      <div style="background: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
        EcoHub Rewards Program &bull; Empowering Sustainable Choices
      </div>
    </div>
  `;

  logEmail(userEmail, userName, subject, 'reward_coupon_unlocked', bodyHtml);
  if (userId) {
    createInAppNotification(
      userId,
      'coupon_unlocked',
      `Brand Reward: ${discountTitle}`,
      `You unlocked ${couponCode} from ${brandName} for reaching 10 EcoCredits!`,
      '/wallet'
    );
  }
}

// EMAIL #4: EVIDENCE AUDIT VERIFICATION RESULT
function sendAIVerificationEmail({ userEmail, userName, disposalId, status, creditsEarned, notes, userId }) {
  const isApproved = status === 'Approved';
  const subject = isApproved
    ? `Evidence Audit Approved: Trust Score Verified [${disposalId}]`
    : `Verification Audit Notice: Review Required [${disposalId}]`;

  const bodyHtml = `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1f2937;">
      <div style="background: ${isApproved ? '#0f9d58' : '#991b1b'}; padding: 22px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">
          ${isApproved ? 'Hardware Verification Audit Approved' : 'Disposal Audit Notice'}
        </h2>
      </div>

      <div style="padding: 24px;">
        <p>Dear <strong>${userName || 'EcoHub Contributor'}</strong>,</p>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">
          Our EcoHub Evidence Verification Engine has completed cryptographic and photographic review for disposal record <strong>${disposalId}</strong>.
        </p>

        <div style="background: ${isApproved ? '#f0fdf4' : '#fef2f2'}; border-left: 4px solid ${isApproved ? '#0f9d58' : '#ef4444'}; padding: 14px; margin: 16px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; font-weight: 700; color: ${isApproved ? '#166534' : '#991b1b'};">
            Audit Status: ${status}
          </p>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #4b5563;">
            ${notes || 'All evidence factors verified against authorized collection registry.'}
          </p>
          ${isApproved && creditsEarned ? `<p style="margin: 8px 0 0 0; font-size: 15px; font-weight: 800; color: #0f9d58;">+${creditsEarned} Reward Points credited to your wallet!</p>` : ''}
        </div>
      </div>
    </div>
  `;

  logEmail(userEmail, userName, subject, 'ai_verification_result', bodyHtml);
  if (userId) {
    createInAppNotification(
      userId,
      isApproved ? 'challenge_approved' : 'challenge_rejected',
      isApproved ? 'Audit Approved!' : 'Audit Needs Review',
      isApproved ? `Earned +${creditsEarned} points for verified disposal.` : `Verification update: ${notes}`,
      '/citizen'
    );
  }
}

// EMAIL #5: OTP VERIFICATION EMAIL
function sendOTPEmail({ recipient, otpCode }) {
  const subject = `Your EcoHub Verification Code: ${otpCode}`;
  const bodyHtml = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b;">
      <div style="background: #0f172a; padding: 20px; text-align: center; border-bottom: 3px solid #22c55e;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">ECO<span style="color: #22c55e;">HUB</span> SECURITY</h2>
      </div>
      <div style="padding: 24px; text-align: center;">
        <p style="font-size: 15px; color: #334155; margin-top: 0;">Use the one-time passcode below to verify your account & claim your eco-reward:</p>
        <div style="background: #f1f5f9; border: 2px dashed #cbd5e1; display: inline-block; padding: 14px 28px; border-radius: 10px; margin: 16px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #0f172a;">${otpCode}</span>
        </div>
        <p style="font-size: 12px; color: #64748b;">This OTP is valid for 10 minutes. Do not share this code with anyone.</p>
      </div>
    </div>
  `;
  logEmail(recipient, 'EcoHub User', subject, 'otp_verification', bodyHtml);
}

// EMAIL #6: COMPANY CREDENTIALS ON ADMIN APPROVAL
function sendCompanyApprovalEmail({ officialEmail, companyName, companyId, password }) {
  const subject = `EcoHub Corporate Portal Approved: Your Credentials [${companyId}]`;
  const loginUrl = `http://localhost:5173/login`;
  const bodyHtml = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b;">
      <div style="background: #1e1b4b; padding: 24px; text-align: center; border-bottom: 3px solid #6366f1;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Corporate Partnership Approved</h1>
        <p style="color: #c7d2fe; margin: 5px 0 0 0; font-size: 13px;">EcoHub Corporate EPR & Sustainability Portal</p>
      </div>
      <div style="padding: 28px;">
        <p style="font-size: 15px;">Dear <strong>${companyName}</strong> Sustainability Team,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          Your company application has been approved by the EcoHub Administration. Your corporate access credentials have been provisioned:
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; font-size: 14px;"><strong>Company ID / Username:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${companyId}</code></p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Official Email:</strong> <code>${officialEmail}</code></p>
          <p style="margin: 4px 0; font-size: 14px;"><strong>Initial Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${password}</code></p>
        </div>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${loginUrl}" style="background: #4f46e5; color: white; padding: 12px 26px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Sign In to Corporate Portal
          </a>
        </div>
        <p style="font-size: 13px; color: #64748b;">Inside your portal, you can order certified circular EcoBags with company-linked QR codes, monitor user e-waste disposals in real time via Power BI analytics, and download your verified "EcoHub Impact Report" for government submissions.</p>
      </div>
    </div>
  `;
  logEmail(officialEmail, companyName, subject, 'company_approved', bodyHtml);
}

// EMAIL #7: NOTIFY ADMIN OF NEW COMPANY APPLICATION
function sendCompanyApplicationNoticeToAdmin({ applicationData }) {
  const adminEmail = process.env.ADMIN_EMAIL || 'sonachhabra2014@gmail.com';
  const subject = `[Action Required] New EcoHub Company Registration: ${applicationData.company_name}`;
  const adminUrl = `http://localhost:5173/admin`;
  const token = applicationData.verification_token || 'APPROVED';
  const appId = applicationData.id || '';
  const approveLink = `http://localhost:5000/api/companies/approve-by-token?token=${token}&id=${appId}`;
  const rejectLink = `http://localhost:5000/api/companies/reject-by-token?token=${token}&id=${appId}`;

  const bodyHtml = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b;">
      <div style="background: #0f172a; padding: 22px; text-align: center; border-bottom: 3px solid #22c55e;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">🏢 New Corporate Partnership Application</h2>
        <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">EcoHub EPR Corporate Registry & Sustainability</p>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 15px; margin-top: 0;">A new company has submitted registration details on the website for EcoHub partnership:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold; width: 40%;">Company Name:</td><td style="padding: 8px;">${applicationData.company_name}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Registration No:</td><td style="padding: 8px;">${applicationData.registration_number || 'N/A'}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Company Type:</td><td style="padding: 8px;">${applicationData.company_type || 'Private Limited'}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Official Email:</td><td style="padding: 8px;"><a href="mailto:${applicationData.official_email}">${applicationData.official_email}</a></td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Contact Number:</td><td style="padding: 8px;">${applicationData.contact_number || 'N/A'}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Representative:</td><td style="padding: 8px;">${applicationData.representative_name} (${applicationData.designation || 'Lead'})</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">E-Waste Types:</td><td style="padding: 8px;">${applicationData.e_waste_types || 'Consumer Electronics'}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Monthly Capacity:</td><td style="padding: 8px;">${applicationData.monthly_capacity || '50 Tons / Month'}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">EPR Auth No:</td><td style="padding: 8px;">${applicationData.authorization_number || 'Pending verification'}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Facility Address:</td><td style="padding: 8px;">${applicationData.facility_address || applicationData.address || 'N/A'}</td></tr>
        </table>

        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 18px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #166534;">
            Immediate Admin Decision:
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <a href="${approveLink}" style="background: #16a34a; color: #ffffff; font-weight: 800; font-size: 14px; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; box-shadow: 0 2px 8px rgba(22, 163, 74, 0.3);">
              ✅ Approve Company & Issue Credentials
            </a>
            <a href="${rejectLink}" style="background: #dc2626; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 20px; border-radius: 6px; text-decoration: none; display: inline-block; margin-left: 8px;">
              ❌ Reject Application
            </a>
          </div>
          <p style="margin: 10px 0 0 0; font-size: 12px; color: #15803d;">
            Upon approval, unique Company ID and Password will automatically be provisioned and emailed to ${applicationData.official_email}.
          </p>
        </div>

        <p style="text-align: center; margin: 15px 0 0 0;">
          <a href="${adminUrl}" style="color: #4f46e5; text-decoration: underline; font-size: 13px;">
            Open EcoHub Admin Command Center to manage all applications &rarr;
          </a>
        </p>
      </div>
      <div style="background: #f8fafc; padding: 12px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
        EcoHub Central Governance &bull; ${adminEmail}
      </div>
    </div>
  `;
  logEmail(adminEmail, 'EcoHub Admin', subject, 'company_application_notice', bodyHtml);
}

// EMAIL #9: NOTIFY ADMIN OF NEW COMPANY ORDER
function sendCompanyOrderNotificationToAdmin({ companyName, brandCode, quantity, batchCode }) {
  const adminEmail = process.env.ADMIN_EMAIL || 'sonachhabra2014@gmail.com';
  const adminUrl = `http://localhost:5173/admin/orders`;
  const subject = `[EcoHub Order] Company ${companyName} placed a new EcoBag order`;
  const bodyHtml = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b;">
      <div style="background: #0f172a; padding: 22px; text-align: center; border-bottom: 3px solid #22c55e;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">📦 New EcoBag Order Received</h2>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 15px; margin-top: 0;">A company has placed an order for certified circular EcoBags.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Company Name:</td><td style="padding: 8px;">${companyName}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Brand Code:</td><td style="padding: 8px;">${brandCode}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Quantity:</td><td style="padding: 8px;">${quantity}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px; font-weight: bold;">Batch Code:</td><td style="padding: 8px;">${batchCode}</td></tr>
        </table>
        <div style="text-align: center; margin-top: 20px;">
          <a href="${adminUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Orders Dashboard</a>
        </div>
        <p style="font-size: 12px; color: #64748b; margin-top: 24px;">EcoHub Central Governance • ${adminEmail}</p>
      </div>
    </div>
  `;
  logEmail(adminEmail, 'EcoHub Admin', subject, 'company_order_notification', bodyHtml);
}


// Removed stray brace

// EMAIL #8: COLLECTION CENTRE CREDENTIALS (sent after admin approves)
function sendCollectionCentreCredentialsEmail({ email, centreName, assignedCode, password }) {
  const subject = `✅ EcoHub Collection Centre Approved — Your Login Credentials [${assignedCode}]`;
  const loginUrl = `http://localhost:5173/centre/login`;
  const bodyHtml = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;color:#1e293b;">
      <div style="background:#020B20;padding:24px;text-align:center;border-bottom:3px solid #00E676;">
        <h1 style="color:#ffffff;margin:0;font-size:22px;">ECO<span style="color:#00E676;">HUB</span></h1>
        <p style="color:#94a3b8;margin:5px 0 0 0;font-size:13px;">Collection Centre Portal — Verified Access Credentials</p>
      </div>
      <div style="padding:28px;">
        <p style="font-size:16px;margin-top:0;">Welcome, <strong>${centreName}</strong>!</p>
        <p style="font-size:14px;line-height:1.6;color:#334155;">
          Your EcoHub Collection Centre application has been <strong style="color:#16a34a;">approved</strong> by the administrator. Your secure portal access credentials are below:
        </p>

        <div style="background:#f0fdf4;border:2px solid #00E676;border-radius:10px;padding:22px;margin:20px 0;">
          <p style="margin:6px 0;font-size:15px;"><strong>Centre Code / Login ID:</strong> <code style="background:#e2e8f0;padding:2px 8px;border-radius:4px;font-weight:bold;color:#065f46;">${assignedCode}</code></p>
          <p style="margin:6px 0;font-size:15px;"><strong>Login Email:</strong> <code>${email}</code></p>
          <p style="margin:6px 0;font-size:15px;"><strong>Initial Password:</strong> <code style="background:#e2e8f0;padding:2px 8px;border-radius:4px;font-weight:bold;color:#0284c7;">${password}</code></p>
        </div>

        <div style="text-align:center;margin:24px 0;">
          <a href="${loginUrl}" style="background:#00E676;color:#012813;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:800;display:inline-block;font-size:15px;">
            Log In to Collection Centre Portal
          </a>
        </div>

        <p style="font-size:13px;color:#64748b;line-height:1.6;">
          Inside the portal you can: scan disposal QR codes to verify incoming e-waste, log weights, update disposal statuses, and trigger citizen reward emails — all within your own isolated centre dashboard.
        </p>
        <p style="font-size:12px;color:#94a3b8;">Please change your password after first login for security.</p>
      </div>
      <div style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
        EcoHub Authorized Network • ISO 14001 & CPCB Compliant
      </div>
    </div>
  `;
  logEmail(email, centreName, subject, 'collection_centre_credentials', bodyHtml);
}

// EMAIL #9: NOTIFY ADMIN OF NEW COLLECTION CENTRE APPLICATION
function sendCentreApplicationNoticeToAdmin({ appId, centreName, email, phone, address, licenseNumber, officerName, verificationToken }) {
  const adminEmail = process.env.ADMIN_EMAIL || 'sonachhabra2014@gmail.com';
  const subject = `[Action Required] New EcoHub Collection Centre Registration: ${centreName}`;
  const adminUrl = `http://localhost:5173/admin/dashboard`;
  const token = verificationToken || 'TOKEN';
  const approveLink = `http://localhost:5000/api/collection-centres/approve-by-token?token=${token}&id=${appId}`;
  const rejectLink  = `http://localhost:5000/api/collection-centres/reject-by-token?token=${token}&id=${appId}`;

  const bodyHtml = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;color:#1e293b;">
      <div style="background:#020B20;padding:22px;text-align:center;border-bottom:3px solid #38BDF8;">
        <h2 style="color:#ffffff;margin:0;font-size:20px;">♻️ New Collection Centre Registration</h2>
        <p style="color:#94a3b8;margin:4px 0 0 0;font-size:13px;">EcoHub Authorized Network — Admin Approval Required</p>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px;margin-top:0;">A new collection centre has submitted a registration request and is awaiting your approval:</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;font-weight:bold;width:38%;">Centre Name:</td><td style="padding:8px;">${centreName}</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;font-weight:bold;">Official Email:</td><td style="padding:8px;"><a href="mailto:${email}">${email}</a></td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;font-weight:bold;">Contact Number:</td><td style="padding:8px;">${phone || 'N/A'}</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;font-weight:bold;">Address:</td><td style="padding:8px;">${address || 'N/A'}</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;font-weight:bold;">CPCB License No:</td><td style="padding:8px;">${licenseNumber || 'Pending verification'}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Officer Name:</td><td style="padding:8px;">${officerName || 'N/A'}</td></tr>
        </table>

        <div style="background:#f0f9ff;border:1px solid #38BDF8;border-radius:8px;padding:18px;margin:20px 0;text-align:center;">
          <p style="margin:0 0 12px 0;font-size:14px;font-weight:700;color:#0369a1;">Admin Decision — One Click:</p>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
            <a href="${approveLink}" style="background:#16a34a;color:#ffffff;font-weight:800;font-size:14px;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;box-shadow:0 2px 8px rgba(22,163,74,0.3);">
              ✅ Approve Centre &amp; Issue Credentials
            </a>
            <a href="${rejectLink}" style="background:#dc2626;color:#ffffff;font-weight:700;font-size:14px;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-left:8px;">
              ❌ Reject Application
            </a>
          </div>
          <p style="margin:10px 0 0 0;font-size:12px;color:#0369a1;">
            Upon approval, a unique Centre Code and Password will automatically be provisioned and emailed to ${email}.
          </p>
        </div>

        <p style="text-align:center;margin:15px 0 0 0;">
          <a href="${adminUrl}" style="color:#4f46e5;text-decoration:underline;font-size:13px;">Open EcoHub Admin Command Center &rarr;</a>
        </p>
      </div>
      <div style="background:#f8fafc;padding:12px;text-align:center;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
        EcoHub Central Governance • ${adminEmail}
      </div>
    </div>
  `;
  logEmail(adminEmail, 'EcoHub Admin', subject, 'centre_application_notice', bodyHtml);
}

module.exports = {
  sendEmail1DisposalConfirmation,
  sendEmail2ItemReceived,
  sendRewardCouponEmail,
  sendAIVerificationEmail,
  sendOTPEmail,
  sendCompanyApprovalEmail,
  sendCompanyApplicationNoticeToAdmin,
  sendCollectionCentreCredentialsEmail,
  sendCentreApplicationNoticeToAdmin,
  logEmail,
  createInAppNotification,
  sendCompanyOrderNotificationToAdmin
};
