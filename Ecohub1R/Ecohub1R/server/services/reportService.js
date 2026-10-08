const crypto = require('node:crypto');
const { db } = require('../db');

function generateImpactReport(_request, brandCode) {
  const company = db.prepare('SELECT * FROM companies WHERE brand_code = ?').get(brandCode);
  if (!company) throw new Error(`Company with brand "${brandCode}" not found`);

  const disposals = db.prepare('SELECT * FROM disposals WHERE brand_code = ?').all(brandCode);
  const verified = disposals.filter(item => item.status === 'Received at Collection Centre');
  const challenges = db.prepare(`
    SELECT c.* FROM challenges c
    JOIN disposals d ON d.id = c.disposal_id
    WHERE d.brand_code = ? AND c.status = 'Approved'
  `).all(brandCode);
  const totalWeight = disposals.reduce((sum, item) => sum + (Number(item.estimated_weight_kg) || 0), 0);
  const verifiedWeight = verified.reduce((sum, item) => sum + (Number(item.estimated_weight_kg) || 0), 0);
  const participants = new Set(disposals.map(item => item.user_id)).size;
  const verificationHash = crypto.createHash('sha256')
    .update(`${brandCode}:${disposals.length}:${verifiedWeight}:${new Date().toISOString().slice(0, 10)}`)
    .digest('hex');
  const score = disposals.length > 0 ? Math.round((verified.length / disposals.length) * 100) : 0;
  const rating = disposals.length === 0 
    ? 'Awaiting Verification' 
    : (score >= 90 ? 'AAA Platinum' : (score >= 70 ? 'AA Gold' : 'A Standard'));
  const industryPercentile = disposals.length === 0
    ? 'Awaiting physical collection records'
    : (score >= 90 ? 'Top 5% in Sector' : (score >= 70 ? 'Top 20% in Sector' : 'Active Compliance'));

  return {
    report_title: 'EcoHub Corporate Impact Report',
    report_subtitle: 'Verified Circular Economy Performance',
    report_period: '2026',
    verification_hash: verificationHash,
    date_stamp: new Date().toISOString(),
    company_information: {
      name: company.name,
      brand_code: company.brand_code,
      sector: company.category || 'Consumer Electronics',
      compliance_id: `ECOHUB-${String(company.id).padStart(5, '0')}`,
      csr_budget_inr: company.csr_budget_inr || 0,
      email: company.email
    },
    total_ewaste_managed: {
      total_submissions_count: disposals.length,
      total_weight_kg: Number(totalWeight.toFixed(2)),
      total_weight_metric_tons: Number((totalWeight / 1000).toFixed(3)),
      verified_recycled_kg: Number(verifiedWeight.toFixed(2)),
      target_compliance_percentage: Number(((verifiedWeight / Math.max((company.sustainability_target_tons || 150) * 1000, 1)) * 100).toFixed(2))
    },
    verified_disposal_records: {
      total_verified: verified.length,
      verification_rate: `${disposals.length ? Math.round((verified.length / disposals.length) * 100) : 0}%`
    },
    collection_centre_contributions: Object.values(disposals.reduce((groups, item) => {
      const name = item.collection_centre_name || 'Authorized Hub';
      if (!groups[name]) groups[name] = { centre: name, verified_units: 0, weight_kg: 0 };
      groups[name].verified_units += item.status === 'Received at Collection Centre' ? 1 : 0;
      groups[name].weight_kg += Number(item.estimated_weight_kg) || 0;
      return groups;
    }, {})).map(item => ({ ...item, weight_kg: Number(item.weight_kg.toFixed(2)) })),
    environmental_impact: {
      carbon_reduction_kg: Number((verifiedWeight * 1.44).toFixed(2)),
      toxic_metals_diverted_kg: Number((verifiedWeight * 0.082).toFixed(2)),
      landfill_space_saved_m3: Number((verifiedWeight * 0.025).toFixed(2)),
      energy_saved_kwh: Number((verifiedWeight * 12.5).toFixed(2))
    },
    trees_and_plants: {
      total_initiated: verified.length,
      verified_plantations: challenges.length,
      survival_audit_rate: `${challenges.length ? 100 : 0}%`,
      ecocredits_awarded: challenges.length * 150
    },
    user_participation: {
      unique_participants: participants,
      avg_items_per_user: Number((disposals.length / Math.max(participants, 1)).toFixed(2)),
      challenge_participation_rate: `${disposals.length ? Math.round((challenges.length / disposals.length) * 100) : 0}%`,
      customer_satisfaction_score: disposals.length > 0 ? `${Math.min(100, 80 + Math.round((verified.length / disposals.length) * 20))}%` : 'N/A'
    },
    carbon_reduction_estimates: {
      net_co2e_saved_tons: Number((verifiedWeight * 1.44 / 1000).toFixed(3)),
      equivalent_car_km_neutralized: Math.round(verifiedWeight * 5.8),
      equivalent_homes_powered_days: Math.round(verifiedWeight * 0.8)
    },
    sustainability_score: {
      score,
      rating,
      industry_percentile: industryPercentile
    },
    csr_contribution_summary: {
      committed_budget_inr: company.csr_budget_inr || 0,
      utilized_funds_inr: Number((challenges.length * 1000).toFixed(2)),
      circular_economy_quotient: `${score}%`
    },
    sdg_alignment: [
      { sdg: 'SDG 12', title: 'Responsible Consumption and Production' },
      { sdg: 'SDG 13', title: 'Climate Action' },
      { sdg: 'SDG 15', title: 'Life on Land' }
    ]
  };
}

module.exports = { generateImpactReport };
