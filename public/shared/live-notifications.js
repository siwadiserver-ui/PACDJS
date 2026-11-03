/**
 * ⚡ PACD CENTRALIZED NOTIFICATION ENGINE (ENGINEERING ONLY)
 * - 3-segundong polling para walang delay
 * - Engineering at Admin lang ang makakarinig at makakakita
 * - Auto-unlock ng sound sa unang pindot sa browser
 * - May antala (queue) para hindi magpatong-patong ang sabay na request
 * - May requireInteraction para hindi mawala sa screen ng Windows
 */
(function() {
  // 🛑 1. Filter: Engineering at Admin lamang ang makakatanggap ng alert
  function isEngineeringUser() {
    try {
      const userJson = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
      if (!userJson) return false;
      const user = JSON.parse(userJson);
      
      const role = String(user.ROLE || user.role || '').toUpperCase().trim();
      const division = String(user.DIVISION || user.division || '').toUpperCase().trim();

      return (
        role === 'ENGINEERING' || 
        division === 'ENGINEERING' || 
        role === 'ENGR' || 
        role === 'ADMIN' || 
        role === 'SUPERADMIN'
      );
    } catch (e) {
      return false;
    }
  }

  // Kung Commercial ang naka-login, ihinto agad ang script
  if (!isEngineeringUser()) {
    return;
  }

  let isAudioReady = false;
  let audioContext = null;

  let lastIds = {
    sr: null,
    recon: null,
    nsc: null
  };

  const notificationQueue = [];
  let isProcessingQueue = false;

  // 🔊 2. Instant Audio Initializer
  function armAudioEngine() {
    if (isAudioReady) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx && !audioContext) {
        audioContext = new AudioCtx();
      }
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const audioTag = document.getElementById('pacdAlertAudio');
      if (audioTag) {
        audioTag.play().then(() => {
          audioTag.pause();
          audioTag.currentTime = 0;
        }).catch(() => {});
      }

      isAudioReady = true;
      ['click', 'touchstart', 'keydown', 'mousedown'].forEach(evt => {
        window.removeEventListener(evt, armAudioEngine);
      });
    } catch (e) {}
  }

  ['click', 'touchstart', 'keydown', 'mousedown'].forEach(evt => {
    window.addEventListener(evt, armAudioEngine, { passive: true });
  });

  // Humingi ng notification permission sa Windows pagkabukas
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }

  // 🔔 3. Alert Chime Sound
  function playAlertChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContext) audioContext = new AudioCtx();
      if (audioContext.state === 'suspended') audioContext.resume();

      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch (e) {}
  }

// 🍞 In-App Floating Toast (Inilagay sa LOWER RIGHT)
  function showNotificationBanner(title, body, tag) {
    let toast = document.getElementById('globalSystemToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'globalSystemToast';
      toast.style.cssText = `
        position: fixed;
        bottom: 25px; /* 👈 Inilipat sa ibaba */
        right: 25px;  /* 👈 Mananatili sa kanan */
        background: #090d16;
        color: #fff;
        padding: 16px 20px;
        border-radius: 10px;
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        box-shadow: 0 16px 36px rgba(0,0,0,0.5);
        border-left: 6px solid #0284c7;
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-width: 420px;
        transition: opacity 0.3s ease, transform 0.3s ease;
      `;
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <div style="font-weight: 800; color: #38bdf8; display:flex; justify-content:space-between; align-items:center;">
        <span>${title}</span>
        <button style="background:none; border:none; color:#94a3b8; font-size:1.1rem; cursor:pointer;" onclick="document.getElementById('globalSystemToast').style.display='none'">&times;</button>
      </div>
      <div style="font-size: 0.84rem; color: #f8fafc; font-weight: 600; line-height: 1.4;">${body}</div>
    `;
    toast.style.display = 'flex';
    toast.style.opacity = '1';

    setTimeout(() => {
      if (toast) toast.style.opacity = '0';
      setTimeout(() => { if (toast) toast.style.display = 'none'; }, 300);
    }, 20000);

    // Native Windows Desktop Notification (Natural na nasa lower right ng Windows taskbar)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
          body: body,
          tag: tag || undefined,
          requireInteraction: true
        });
        n.onclick = function() {
          window.focus();
          this.close();
        };
      } catch (e) {}
    }
  }

  // 📬 5. Queue Dispatcher para sa magkakasabay na alert
  async function processQueue() {
    if (isProcessingQueue || notificationQueue.length === 0) return;
    isProcessingQueue = true;

    while (notificationQueue.length > 0) {
      const item = notificationQueue.shift();
      playAlertChime();
      showNotificationBanner(item.title, item.body, item.tag);

      if (notificationQueue.length > 0) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    isProcessingQueue = false;
  }

  function dispatchAlert(title, body, tag) {
    notificationQueue.push({ title, body, tag });
    processQueue();
  }

  // ⚡ 6. Mabilisang Polling (Tuwing 3 segundo)
  async function checkLatestTransactions() {
    try {
      const res = await fetch('/api/notifications/latest-events');
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success) return;

      const { serviceRequest, reconnection, newConnection } = json;

      // Baseline sa unang bukas
      if (lastIds.sr === null && lastIds.recon === null && lastIds.nsc === null) {
        lastIds.sr = serviceRequest ? Number(serviceRequest.ID) : 0;
        lastIds.recon = reconnection ? Number(reconnection.ID) : 0;
        lastIds.nsc = newConnection ? Number(newConnection.ID) : 0;
        return;
      }

      let hasNew = false;

      // 🔧 Service Request Check
      if (serviceRequest && Number(serviceRequest.ID) > lastIds.sr) {
        lastIds.sr = Number(serviceRequest.ID);
        hasNew = true;
        dispatchAlert(
          `🔧 Bagong Service Request: ${serviceRequest.REFERENCE_NUMBER}`,
          `${serviceRequest.ACCOUNT_NAME} — ${serviceRequest.REQUEST_DETAILS || 'Service Request'}`,
          `sr-${serviceRequest.ID}`
        );
      }

      // 🔌 Reconnection Check
      if (reconnection && Number(reconnection.ID) > lastIds.recon) {
        lastIds.recon = Number(reconnection.ID);
        hasNew = true;
        dispatchAlert(
          `🔌 Bagong Reconnection: ${reconnection.REFERENCE_NUMBER}`,
          `Account: ${reconnection.ACCOUNT_NAME}`,
          `rec-${reconnection.ID}`
        );
      }

      // 🚰 New Connection Check
      if (newConnection && Number(newConnection.ID) > lastIds.nsc) {
        lastIds.nsc = Number(newConnection.ID);
        hasNew = true;
        dispatchAlert(
          `🚰 Bagong New Connection: ${newConnection.APPLICATION_NUMBER}`,
          `Aplikante: ${newConnection.APPLICANT_NAME}`,
          `nsc-${newConnection.ID}`
        );
      }

      // Awtomatikong i-update ang dashboard at active iframe table
      if (hasNew) {
        if (typeof window.loadDashboardData === 'function') {
          window.loadDashboardData();
        }
        const wsIframe = document.getElementById('wsIframe');
        if (wsIframe && wsIframe.contentWindow) {
          try {
            if (typeof wsIframe.contentWindow.loadDataPool === 'function') {
              wsIframe.contentWindow.loadDataPool();
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    checkLatestTransactions();
    setInterval(checkLatestTransactions, 3000);
  });
})();