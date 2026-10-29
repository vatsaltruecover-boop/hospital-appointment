// Telegram OTP Verification & Notification Service

class TelegramOTPService {
  constructor() {
    this.activeOtps = new Map(); // phone -> { code, expiresAt }
  }

  // Generate 6-digit random code
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Send OTP (simulated UI banner + optional real Telegram bot API)
  async sendOTP(phoneNumber, clinic) {
    const code = this.generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins
    this.activeOtps.set(phoneNumber, { code, expiresAt });

    const message = `MediPulse Clinic Verification Code: ${code}. Valid for 5 minutes. Do not share this code.`;

    // 1. Show simulated Telegram push banner
    this.showTelegramBanner(clinic.name || 'MediPulse Clinic', code, phoneNumber);

    // 2. Real Telegram Bot API (if configured in clinic settings)
    if (clinic.telegramBotToken && clinic.telegramChatId) {
      try {
        const url = `https://api.telegram.org/bot${clinic.telegramBotToken}/sendMessage`;
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: clinic.telegramChatId,
            text: `[MediPulse OTP Alert]\nRecipient: ${phoneNumber}\n${message}`
          })
        });
      } catch (err) {
        console.warn('Real Telegram API dispatch failed (fallback to mock):', err);
      }
    }

    return { success: true, code };
  }

  // Verify OTP
  verifyOTP(phoneNumber, enteredCode) {
    const record = this.activeOtps.get(phoneNumber);
    if (!record) {
      return { success: false, message: 'No OTP requested for this phone number' };
    }
    if (Date.now() > record.expiresAt) {
      this.activeOtps.delete(phoneNumber);
      return { success: false, message: 'OTP has expired. Please request a new one.' };
    }
    if (record.code.trim() !== enteredCode.trim()) {
      return { success: false, message: 'Invalid OTP code. Please check and try again.' };
    }

    this.activeOtps.delete(phoneNumber);
    return { success: true };
  }

  // Display authentic Telegram-style incoming push notification banner
  showTelegramBanner(clinicName, code, phone) {
    let banner = document.getElementById('telegram-toast-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'telegram-toast-banner';
      banner.className = 'telegram-toast-banner';
      document.body.appendChild(banner);
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    banner.innerHTML = `
      <div class="telegram-icon-box">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .39z"/>
        </svg>
      </div>
      <div class="telegram-toast-content">
        <div class="telegram-toast-title">
          <span>Telegram &bull; ${clinicName}</span>
          <span class="telegram-toast-time">${timeStr}</span>
        </div>
        <div class="telegram-toast-text">
          Your appointment verification code is:
        </div>
        <div class="telegram-otp-badge">${code}</div>
      </div>
    `;

    banner.classList.add('show');

    // Auto dismiss after 9 seconds or when clicked
    clearTimeout(this.bannerTimeout);
    this.bannerTimeout = setTimeout(() => {
      banner.classList.remove('show');
    }, 9000);

    banner.onclick = () => {
      banner.classList.remove('show');
    };
  }
}

export const telegramOTP = new TelegramOTPService();
