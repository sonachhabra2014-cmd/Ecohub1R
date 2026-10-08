const crypto = require('node:crypto');
const { db } = require('../db');

const MAX_VIDEO_BYTES = 15 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

function parseVideoData(videoData, mimeType) {
  if (typeof videoData !== 'string') return null;
  const match = /^data:(video\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(videoData);
  if (!match || !ALLOWED_VIDEO_TYPES.has(match[1].toLowerCase())) return null;
  if (mimeType && mimeType.toLowerCase() !== match[1].toLowerCase()) return null;

  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_VIDEO_BYTES) return null;
  return { bytes, mimeType: match[1].toLowerCase() };
}

async function verifyPlantingVideo({ videoData, mimeType, filename, challengeText, captureMetadata, existingDisposalId, userNotes = '' }) {
  const video = parseVideoData(videoData, mimeType);
  if (!video) {
    return { available: true, status: 'Rejected', error: 'Upload a supported video under 15 MB.' };
  }

  const videoHash = crypto.createHash('sha256').update(video.bytes).digest('hex');
  const duplicate = db.prepare(`
    SELECT id, disposal_id FROM challenges
    WHERE gov_compliance_hash = ? AND disposal_id != ? AND status = 'Approved'
  `).get(videoHash, existingDisposalId || '');

  if (duplicate) {
    return {
      available: true,
      status: 'Rejected',
      error: 'This exact video has already been approved for another disposal.',
      video_hash: videoHash
    };
  }

  const endpoint = process.env.VIDEO_VERIFIER_URL;
  const apiToken = process.env.VIDEO_VERIFIER_TOKEN;
  if (!endpoint || !apiToken) {
    return { available: false, status: 'Unavailable', error: 'Video AI verifier is not configured.' };
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_base64: video.bytes.toString('base64'),
        mime_type: video.mimeType,
        filename,
        disposal_id: existingDisposalId,
        challenge_text: challengeText,
        capture_metadata: captureMetadata,
        user_notes: userNotes,
        required_checks: [
          'eco_bag_visible',
          'person_performs_challenge_in_video',
          'continuous_live_action',
          'replay_detected',
          'manipulation_detected'
        ]
      }),
      signal: AbortSignal.timeout(60000)
    });
  } catch {
    return { available: false, status: 'Unavailable', error: 'Video AI verifier could not be reached.' };
  }

  if (!response.ok) {
    return { available: false, status: 'Unavailable', error: 'Video AI verifier returned an error.' };
  }

  let result;
  try {
    result = await response.json();
  } catch {
    return { available: false, status: 'Unavailable', error: 'Video AI verifier returned an invalid response.' };
  }

  const confidence = Number(result.confidence);
  const checks = {
    eco_bag_visible: result.eco_bag_visible === true,
    person_performs_challenge_in_video: result.person_performs_challenge_in_video === true,
    continuous_live_action: result.continuous_live_action === true,
    replay_detected: result.replay_detected === true,
    manipulation_detected: result.manipulation_detected === true
  };
  const confidenceValid = Number.isFinite(confidence) && confidence >= 0 && confidence <= 1;
  const evidenceValid = checks.eco_bag_visible &&
    checks.person_performs_challenge_in_video &&
    checks.continuous_live_action &&
    !checks.replay_detected &&
    !checks.manipulation_detected &&
    confidenceValid;

  const completeSequence = evidenceValid && result.required_steps_complete === true;
  const rewardPoints = completeSequence && confidence >= 0.9
    ? 10
    : evidenceValid && confidence >= 0.8
      ? 1
      : 0;

  return {
    available: true,
    status: rewardPoints > 0 ? 'Approved' : 'Rejected',
    confidence: confidenceValid ? confidence : null,
    score: confidenceValid ? Math.round(confidence * 100) : null,
    reward_points: rewardPoints,
    plant_detected: result.eco_bag_visible === true ? 1 : 0,
    watering_detected: result.required_steps_complete === true ? 1 : 0,
    authenticity_score: confidenceValid ? confidence : null,
    duration_seconds: Number.isFinite(Number(result.duration_seconds)) ? Number(result.duration_seconds) : null,
    video_hash: videoHash,
    verification_reference_id: 'ECOHUB_VIDEO_AI_V1',
    gov_compliance_hash: videoHash,
    checks,
    ai_notes: typeof result.explanation === 'string' ? result.explanation.slice(0, 1200) : 'AI video review completed.'
  };
}

module.exports = { verifyPlantingVideo, MAX_VIDEO_BYTES };