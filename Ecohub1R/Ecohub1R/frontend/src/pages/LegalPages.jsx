import React from "react";
import StaticLegalPage from "./StaticLegalPage";

export function PrivacyPolicyPage() {
  return (
    <StaticLegalPage title="Privacy Policy & Data Security" lastUpdated="September 28, 2026">
      <h3>1. Information Collection & Cryptographic Hashing</h3>
      <p>
        EcoHub collects minimal personal identifiers necessary to facilitate certified electronic waste disposal, namely user email, name, device categories, serial numbers / IMEIs, and intake photos. Images uploaded by users or captured live by collection centres are bound to cryptographic SHA-256 hashes for anti-spoofing and audit verification.
      </p>

      <h3>2. Geofencing & Location Permissions</h3>
      <p>
        HTML5 Geolocation is accessed strictly at the moment of intake verification to evaluate proximity against registered collection centres within an allowed 50-meter variance. Location data is not used for passive tracking.
      </p>

      <h3>3. Enterprise Data Isolation</h3>
      <p>
        Corporate brand data, recovery metrics, and ESG compliance reports are partitioned using tenant isolation, ensuring zero cross-brand data leakage between participating manufacturers.
      </p>

      <h3>4. Compliance with Environmental & Privacy Regulations</h3>
      <p>
        All digital chain-of-custody logs are archived in append-only records complying with the Ministry of Environment, Forest and Climate Change (MoEFCC) E-Waste (Management) Rules and applicable digital privacy frameworks.
      </p>
    </StaticLegalPage>
  );
}

export function TermsPage() {
  return (
    <StaticLegalPage title="Terms & Conditions of Service" lastUpdated="September 28, 2026">
      <h3>1. Acceptance of Terms</h3>
      <p>
        By accessing or registering with EcoHub, individuals and organizations agree to adhere to verified e-waste disposal protocols, anti-fraud terms, and safe hardware handling standards.
      </p>

      <h3>2. Anti-Spoofing & Mandatory Evidence Matching</h3>
      <p>
        Users and collection centre officers agree that only genuine physical electronic waste items verified via live hardware camera capture and GPS geofencing qualify for Trust Score calculation and the award of 150 EcoCredits. Any submission of fraudulent photos, stock imagery, or non-e-waste items results in immediate record flagging and account suspension.
      </p>

      <h3>3. Immutability of Verified Records</h3>
      <p>
        Once a disposal record is transitioned to "Verified & Locked" following successful collection centre intake, it is cryptographically tamper-sealed and strictly read-only.
      </p>

      <h3>4. Extended Producer Responsibility (EPR) Fulfillment</h3>
      <p>
        Corporate partners are entitled to verified digital impact reports for their authorized brand categories to prove compliance with statutory national recycling quotas.
      </p>
    </StaticLegalPage>
  );
}

export function AboutUsPage() {
  return (
    <StaticLegalPage title="About EcoHub" lastUpdated="September 28, 2026">
      <h3>Our Mission</h3>
      <p>
        EcoHub is a national evidence-based e-waste verification and circular economy exchange. Our mission is to eliminate e-waste from municipal landfills by building cryptographic accountability, real-time geofenced verification, and direct citizen rewards into every device return.
      </p>

      <h3>Bridging Citizens, Hubs, and Technology Brands</h3>
      <p>
        We connect environmentally conscious citizens with authorized local collection points and multinational electronics producers (Samsung, HP, Dell, Apple, Lenovo). Through transparent technology, every recycled device contributes directly to verifiable carbon offset ledgers and circular component recovery.
      </p>

      <h3>Key Platform Capabilities</h3>
      <ul>
        <li>Automated SHA-256 evidence matching between citizen upload and counter intake.</li>
        <li>50-meter GPS geofencing ensuring zero remote fraud.</li>
        <li>Instant 150 EcoCredit rewards and official ESG green certification.</li>
        <li>Direct-to-regulator audited Extended Producer Responsibility (EPR) reporting.</li>
      </ul>
    </StaticLegalPage>
  );
}

export function ContactPage() {
  return (
    <StaticLegalPage title="Contact Us & Support" lastUpdated="September 28, 2026">
      <h3>National Helpdesk & Inquiries</h3>
      <p>
        For inquiries regarding collection centre accreditation, corporate partnership onboardings, or verified disposal records, our compliance desk is available Monday through Saturday.
      </p>

      <div style={{ background: "var(--bg-page)", border: "1px solid var(--border)", borderRadius: "10px", padding: "1.5rem", margin: "1.5rem 0" }}>
        <p style={{ margin: "0 0 0.5rem" }}>📍 <strong>Headquarters:</strong> National Clean Tech Hub, CPCB Regulatory Zone, New Delhi, India</p>
        <p style={{ margin: "0 0 0.5rem" }}>📞 <strong>Toll-Free Helpline:</strong> 1800-ECO-HUB (1800-326-482)</p>
        <p style={{ margin: "0 0 0.5rem" }}>✉️ <strong>Official Email:</strong> support@ecohub.gov.in / compliance@ecohub-portal.org</p>
        <p style={{ margin: 0 }}>⏱️ <strong>Operating Hours:</strong> 9:00 AM – 6:00 PM IST</p>
      </div>

      <h3>Technical & Fraud Reporting</h3>
      <p>
        If you suspect collection centre collusion, GPS spoofing, or fraudulent disposal submissions, contact our cryptographic audit team directly at <code>audit@ecohub-portal.org</code>.
      </p>
    </StaticLegalPage>
  );
}

export function FAQPage() {
  return (
    <StaticLegalPage title="Frequently Asked Questions (FAQ)" lastUpdated="September 28, 2026">
      <h3>1. How do I dispose of my old electronics on EcoHub?</h3>
      <p>
        Select your device category (Laptop, Mobile, Monitor, Charger, Battery, Other), attach a photo of your hardware, and select an authorized collection centre nearby. You will instantly receive a unique Disposal ID (EH-2026-XXXXX) and digital pass.
      </p>

      <h3>2. What happens when I bring my device to the collection centre?</h3>
      <p>
        The staff officer scans your Disposal ID, checks the physical device against your initial reference photo, snaps a live verification photo at the counter, and verifies facility GPS coordinates. If the Trust Score reaches &ge; 85, your record is locked and 150 EcoCredits are credited instantly.
      </p>

      <h3>3. How do companies register for EPR compliance?</h3>
      <p>
        Companies register via the dedicated Corporate Portal. Each registration enters a "Pending Backend Compliance Approval" status until compliance administrators review their statutory credentials. Once approved, the enterprise receives an automated confirmation email unlocking their live ESG dashboard.
      </p>

      <h3>4. Why is camera access required at the collection centre?</h3>
      <p>
        To prevent stock image fraud, collection centre staff must use live hardware camera capture with gallery uploads disabled. This ensures proof of physical custody at the designated recycling point.
      </p>
    </StaticLegalPage>
  );
}
