import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiRequest, getToken } from '../api';

const MAX_VIDEO_BYTES = 15 * 1024 * 1024;
const MIN_RECORDING_SECONDS = 3;

function readVideo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected video.'));
    reader.readAsDataURL(file);
  });
}

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location access is required for the live video challenge.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Allow location access before recording.')), {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });
}

function getDeviceId() {
  const key = 'ecohub_capture_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export default function CitizenVideoChallenge() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const disposalId = params.get('disposal_id') || '';
  const accessToken = params.get('access') || '';
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [captureMetadata, setCaptureMetadata] = useState(null);
  const [recording, setRecording] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingStartedAtRef = useRef(0);

  useEffect(() => {
    if (!getToken() || !disposalId || !accessToken) return undefined;
    let cancelled = false;
    apiRequest(`/api/ecocredits/challenge/prompt?disposal_id=${encodeURIComponent(disposalId)}&access_token=${encodeURIComponent(accessToken)}`)
      .then((data) => { if (!cancelled) setChallenge(data); })
      .catch((error) => { if (!cancelled) setMessage(error.message || 'Could not obtain a live challenge.'); });
    return () => { cancelled = true; };
  }, [disposalId, accessToken]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const startRecording = async () => {
    setMessage('');
    setResult(null);
    setRecordedVideo(null);
    if (!challenge?.challenge_token) {
      setMessage('A valid server-issued challenge is required before recording.');
      return;
    }
    try {
      const position = await getLocation();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      const mimeType = ['video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('This browser cannot record a supported video format.');

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      setCaptureMetadata({
        capture_method: 'live_camera',
        captured_at: new Date(recordingStartedAtRef.current).toISOString(),
        gps_lat: position.coords.latitude,
        gps_lng: position.coords.longitude,
        gps_accuracy: position.coords.accuracy,
        device_id: getDeviceId(),
        device_info: { user_agent: navigator.userAgent, platform: navigator.platform, language: navigator.language }
      });
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        const durationSeconds = (Date.now() - recordingStartedAtRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (durationSeconds < MIN_RECORDING_SECONDS) {
          setMessage('Record continuously for at least three seconds to pass liveness review.');
          return;
        }
        if (!blob.size || blob.size > MAX_VIDEO_BYTES) {
          setMessage('The live recording must be non-empty and no larger than 15 MB.');
          return;
        }
        setRecordedVideo(new File([blob], `ecohub-live-${Date.now()}.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`, { type: mimeType }));
        setCaptureMetadata((current) => ({ ...current, duration_seconds: durationSeconds }));
        setVideoUrl(URL.createObjectURL(blob));
      };
      recorder.start(250);
      setRecording(true);
      setVideoUrl('');
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setRecording(false);
      setMessage(error.message || 'Could not start the live camera. Check camera and location permissions.');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setResult(null);
    if (!getToken()) {
      setMessage('Sign in to submit this challenge.');
      return;
    }
    if (!disposalId || !accessToken || !challenge?.challenge_token || !recordedVideo || !captureMetadata) {
      setMessage('Open this challenge from its email and record the required live video.');
      return;
    }

    setSubmitting(true);
    try {
      const videoData = await readVideo(recordedVideo);
      const response = await apiRequest('/api/ecocredits/challenge', {
        method: 'POST',
        body: JSON.stringify({
          disposal_id: disposalId,
          access_token: accessToken,
          challenge_token: challenge.challenge_token,
          capture_method: 'live_camera',
          capture_metadata: captureMetadata,
          filename: recordedVideo.name,
          mime_type: recordedVideo.type,
          video_data: videoData,
          user_notes: notes.trim()
        })
      });
      setResult(response);
      setMessage(response.message || 'AI video review completed.');
    } catch (error) {
      setMessage(error.message || 'AI verification could not be completed. No credits were awarded.');
    } finally {
      setSubmitting(false);
    }
  };

  const loginRedirect = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1rem' }}>
      <section style={{ background: '#fff', border: '1px solid #dbe3e8', borderRadius: 8, padding: '1.5rem' }}>
        <p style={{ marginTop: 0, color: '#087f5b', fontWeight: 700 }}>ECOHUB / VIDEO REVIEW</p>
        <h1 style={{ marginTop: 0 }}>EcoBag action challenge</h1>
        <p>Record the requested action live. Gallery uploads are not accepted. AI review checks liveness, the EcoBag and required action, replay/manipulation signals, and capture metadata.</p>
        {disposalId ? <p>Disposal record: <strong>{disposalId}</strong></p> : <p role="alert">The challenge link is missing its disposal ID.</p>}

        {!getToken() && (
          <p><Link to={loginRedirect}>Sign in to continue</Link></p>
        )}

        {challenge && (
          <div style={{ padding: '1rem', border: '1px solid #b7d4e3', borderRadius: 6, background: '#f0f9ff', margin: '1rem 0' }}>
            <strong>Live challenge</strong>
            <p style={{ marginBottom: 0 }}>{challenge.challenge_text}</p>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          {recording && <video ref={(element) => { if (element && streamRef.current) element.srcObject = streamRef.current; }} autoPlay playsInline muted style={{ display: 'block', width: '100%', maxHeight: 360, background: '#101820' }} />}
          {videoUrl && <video src={videoUrl} controls playsInline style={{ display: 'block', width: '100%', maxHeight: 360, marginTop: 16, background: '#101820' }} />}

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            {!recording ? (
              <button type="button" onClick={startRecording} disabled={!challenge?.challenge_token || submitting} style={{ padding: '0.75rem 1rem', border: '1px solid #087f5b', borderRadius: 6, color: '#087f5b', background: '#fff', fontWeight: 700 }}>
                Record live video
              </button>
            ) : (
              <button type="button" onClick={stopRecording} style={{ padding: '0.75rem 1rem', border: 0, borderRadius: 6, color: '#fff', background: '#b91c1c', fontWeight: 700 }}>
                Stop recording
              </button>
            )}
          </div>

          <label htmlFor="challenge-notes" style={{ display: 'block', fontWeight: 700, marginTop: 20, marginBottom: 8 }}>Notes (optional)</label>
          <textarea id="challenge-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={500} style={{ width: '100%', boxSizing: 'border-box' }} />

          <button type="submit" disabled={submitting || recording || !recordedVideo || !getToken()} style={{ marginTop: 16, padding: '0.75rem 1rem', background: '#087f5b', color: '#fff', border: 0, borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
            {submitting ? 'Sending video for AI review…' : 'Submit video for AI review'}
          </button>
        </form>

        {message && <p role="status" style={{ marginTop: 16, color: result?.ai_result?.status === 'Approved' ? '#087f5b' : '#9a3412' }}>{message}</p>}
        {result?.ai_result?.status === 'Approved' && (
          <p><strong>{result.ai_result.reward_points} EcoCredits</strong> were added to your wallet after video approval. <Link to="/citizen/wallet">View wallet</Link></p>
        )}
        {result?.ai_result?.status === 'Rejected' && <p>No EcoCredits were awarded for this video.</p>}
      </section>
    </main>
  );
}