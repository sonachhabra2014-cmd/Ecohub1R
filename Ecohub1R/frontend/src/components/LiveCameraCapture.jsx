import React, { useEffect, useRef, useState } from 'react';

// Debug logging helper (opt-out via localStorage ecohub_debug = '0').
function debugLog(label, data) {
  try {
    if (localStorage.getItem('ecohub_debug') === '0') return;
    // eslint-disable-next-line no-console
    console.log(`[EcoHub:Camera] ${label}`, data);
  } catch (e) {
    /* logging must never break capture */
  }
}

function getDeviceId() {
  const storageKey = 'ecohub_capture_device_id';
  let deviceId = localStorage.getItem(storageKey);
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(storageKey, deviceId);
  }
  return deviceId;
}

export default function LiveCameraCapture({ value, onCapture, altText = 'Live camera capture' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setCameraError('Please choose an image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setCameraError('Please choose an image smaller than 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setCameraError('The selected image could not be read. Please try another file.');
    reader.onload = () => {
      setCameraError('');
      debugLog('file upload captured', {
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        data_url_prefix: String(reader.result).slice(0, 32)
      });
      onCapture(reader.result, {
        capture_method: 'file_upload',
        captured_at: new Date().toISOString(),
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        device_id: getDeviceId(),
        device_info: {
          user_agent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const releaseCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const stopCamera = () => {
    releaseCamera();
    setCameraActive(false);
  };

  useEffect(() => () => releaseCamera(), []);

  const startCamera = async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Live camera access requires a supported browser on HTTPS or localhost.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraActive(true);
      debugLog('live camera started');
    } catch (error) {
      releaseCamera();
      setCameraActive(false);
      setCameraError(error.message || 'Could not access the camera. Allow camera permission and try again.');
      debugLog('live camera failed to start', { message: error.message });
    }
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraError('Wait for the live camera preview, then capture the photo.');
      return;
    }

    // Geolocation is best-effort evidence enrichment only. A denied/failed
    // location lookup must NEVER block the capture, otherwise the image never
    // reaches state and users see false "image missing" errors.
    let position = null;
    if (navigator.geolocation) {
      try {
        position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 30000
          });
        });
      } catch (geoError) {
        debugLog('geolocation unavailable, capturing without GPS', { message: geoError?.message });
      }
    }

    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Could not capture the live camera frame.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const metadata = {
      capture_method: 'live_camera',
      captured_at: new Date().toISOString(),
      gps_lat: position ? position.coords.latitude : null,
      gps_lng: position ? position.coords.longitude : null,
      gps_accuracy: position ? position.coords.accuracy : null,
      has_gps: Boolean(position),
      device_id: getDeviceId(),
      device_info: {
        user_agent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      }
    };
    debugLog('live camera captured', {
      width: canvas.width,
      height: canvas.height,
      data_url_prefix: dataUrl.slice(0, 32),
      capture_method: metadata.capture_method,
      has_gps: metadata.has_gps
    });
    // Hand the frame to the parent first so preview + state update instantly.
    onCapture(dataUrl, metadata);
    stopCamera();
  };

  return (
    <div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label="Live camera preview"
        style={{ display: cameraActive ? 'block' : 'none', width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '6px' }}
      />
      {value && !cameraActive && (
        <img src={value} alt={altText} style={{ maxHeight: '140px', maxWidth: '100%', borderRadius: '6px' }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
        {cameraActive ? (
          <>
            <button type="button" onClick={capturePhoto}>Capture photo</button>
            <button type="button" onClick={stopCamera}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" onClick={startCamera}>
              {value ? 'Retake with camera' : 'Open live camera'}
            </button>
            <label style={{ cursor: 'pointer' }}>
              <span style={{ display: 'inline-block', padding: '2px 6px' }}>
                {value ? 'Replace image' : 'Upload image'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </>
        )}
      </div>
      {cameraError && <p role="alert" style={{ color: '#b91c1c', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>{cameraError}</p>}
    </div>
  );
}
