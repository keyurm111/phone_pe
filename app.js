document.addEventListener('DOMContentLoaded', () => {
    // Recipient UPI Config
    const RECIPIENT_UPI = 'paytm.s1pmkmg@pty';
    const RECIPIENT_NAME = 'ABHAY MAKWANA';
    const TRANSACTION_NOTE = 'Donation';

    // Campaign Target State
    let currentRaised = 72400;
    let backersCount = 524;
    const targetGoal = 100000;

    // Checkout Form State
    let selectedAmount = 99;
    let donorName = 'John Doe';
    let donorEmail = '';

    // Device / Platform Detection (ported from React detectOS())
    // isDevice: "and" = Android, "ios" = iOS, "des" = Desktop
    let isDevice = 'des';

    function detectOS() {
        // Modern browsers (Chromium-based) — userAgentData API
        if (navigator.userAgentData) {
            const platform = navigator.userAgentData.platform;
            if (platform === 'Android') { isDevice = 'and'; return; }
            if (platform === 'iOS')     { isDevice = 'ios'; return; }
        }
        // Fallback for Safari / older browsers
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        // iOS detection (includes iPadOS 13+ which reports MacIntel)
        if (
            /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        ) {
            isDevice = 'ios';
        } else if (/Android/i.test(ua)) {
            isDevice = 'and';
        } else {
            isDevice = 'des';
        }
    }
    detectOS();

    // Convenience boolean helpers (used by WebView detection below)
    const _isAndroid = isDevice === 'and';
    const _isIOS     = isDevice === 'ios';
    const _isMobile  = _isAndroid || _isIOS;

    // DOM Elements - Config
    const presetPills = document.querySelectorAll('.preset-pill');
    const customAmountInput = document.getElementById('donation-amount-input');
    const nameInput = document.getElementById('donor-name-input');
    const emailInput = document.getElementById('donor-email-input');
    const nameError = document.getElementById('name-error');
    const emailError = document.getElementById('email-error');

    // DOM Elements - Checkout Ticket
    const displayCrossedPrice = document.getElementById('display-crossed-price');
    const displayCurrentPrice = document.getElementById('display-current-price');
    const displaySavingsBadge = document.getElementById('display-savings-badge');
    const radioMethods = document.querySelectorAll('input[name="payment-method"]');
    const inlineQRContainer = document.getElementById('inline-qr-container');
    const qrDisplayAmount = document.getElementById('qr-display-amount');
    const displayRecipientVpa = document.getElementById('display-recipient-vpa');
    const btnCopyVpa = document.getElementById('btn-copy-vpa');
    const btnPlaceOrder = document.getElementById('btn-place-order');

    // DOM Elements - Loader & Modal
    const loaderOverlay = document.getElementById('loader-overlay');
    const loaderTimer = document.getElementById('loader-timer');
    const certificateModal = document.getElementById('certificate-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const certDonorName = document.getElementById('cert-donor-name');
    const certAmount = document.getElementById('cert-amount');
    const certDate = document.getElementById('cert-date');
    const certReceiptId = document.getElementById('cert-receipt-id');
    const btnPrintCert = document.getElementById('btn-print-cert');
    const btnShareCert = document.getElementById('btn-share-cert');
    const shareSuccessMsg = document.getElementById('share-success-msg');
    const confettiContainer = document.getElementById('confetti-container');

    // DOM Elements - Campaign
    const progressValText = document.getElementById('progress-val');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const backersValText = document.getElementById('backers-val');

    // Dynamic Price/Discount Calculator (Matches ratio in user screenshot: 99 saved 350 of 449)
    function updatePricingDisplays() {
        const savedAmount = Math.round(selectedAmount * 3.535);
        const crossedAmount = selectedAmount + savedAmount;

        displayCrossedPrice.innerText = `₹${crossedAmount.toLocaleString('en-IN')}`;
        displayCurrentPrice.innerText = `₹${selectedAmount.toLocaleString('en-IN')}`;
        displaySavingsBadge.innerText = `Saved ₹${savedAmount.toLocaleString('en-IN')}`;
        
        qrDisplayAmount.innerText = selectedAmount.toLocaleString('en-IN');
        certAmount.innerText = `₹${selectedAmount.toLocaleString('en-IN')}`;
        
        // Regenerate QR Code if "Scan QR" is active
        const selectedMethod = document.querySelector('input[name="payment-method"]:checked').value;
        if (selectedMethod === 'qr') {
            generateQRCode();
        }
    }

    // Amount Selection Handlers
    presetPills.forEach(pill => {
        pill.addEventListener('click', () => {
            presetPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedAmount = parseInt(pill.getAttribute('data-amount'));
            customAmountInput.value = selectedAmount;
            updatePricingDisplays();
            openPhonepayy(); // keep PhonePe URL in sync with new amount
        });
    });

    customAmountInput.addEventListener('input', (e) => {
        presetPills.forEach(p => p.classList.remove('active'));
        
        const val = parseInt(e.target.value);
        if (!isNaN(val) && val > 0) {
            selectedAmount = val;
            updatePricingDisplays();
            openPhonepayy(); // keep PhonePe URL in sync with new amount
            
            // Check if matches preset pill and highlight it
            const matchingPreset = document.querySelector(`.preset-pill[data-amount="${val}"]`);
            if (matchingPreset) {
                matchingPreset.classList.add('active');
            }
        }
    });

    // Radio Selection Actions (Re-routing & QR Expansion)
    radioMethods.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const selectedVal = e.target.value;
            
            // Toggle QR Panel
            if (selectedVal === 'qr') {
                inlineQRContainer.style.display = 'flex';
                generateQRCode();
                btnPlaceOrder.innerHTML = `I HAVE PAID <i class="fa-solid fa-circle-check"></i>`;
            } else {
                inlineQRContainer.style.display = 'none';
                btnPlaceOrder.innerHTML = `PROCEED TO PAY <i class="fa-solid fa-chevron-right"></i>`;
            }

            // Visual check state updates
            document.querySelectorAll('.upi-option-row').forEach(row => {
                row.classList.remove('active');
            });
            const selectedLabel = document.querySelector(`label[for="${e.target.id}"]`);
            if (selectedLabel) {
                selectedLabel.classList.add('active');
            }
        });
    });

    // VPA Copy Button
    btnCopyVpa.addEventListener('click', () => {
        navigator.clipboard.writeText(RECIPIENT_UPI).then(() => {
            const icon = btnCopyVpa.querySelector('i');
            icon.className = 'fa-solid fa-check';
            icon.style.color = 'var(--success)';
            
            setTimeout(() => {
                icon.className = 'fa-regular fa-copy';
                icon.style.color = '';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy VPA: ', err);
        });
    });

    // ─── UPI Link Generator (Standard NPCI URI) ───────────────────────────────
    function getUPILink(txnId) {
        const trParam = txnId ? txnId : `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
        return `upi://pay?pa=${encodeURIComponent(RECIPIENT_UPI)}&pn=${encodeURIComponent(RECIPIENT_NAME)}&am=${Number(selectedAmount).toFixed(2)}&cu=INR&tr=${trParam}`;
    }

    // ─── QR Code Engine ───────────────────────────────────────────────────────
    function generateQRCode() {
        const upiLink = getUPILink();
        new QRious({
            element: document.getElementById('upi-qr-canvas'),
            value: upiLink,
            size: 110,
            level: 'H',
            foreground: '#0f1224',
            background: '#ffffff'
        });
    }

    // ─── openPhonepayy() — PhonePe Android native deep-link (Base64 payload) ──
    // Exact port from React component: builds full p2pPaymentCheckoutParams payload
    let paymentUrl = '';
    function openPhonepayy() {
        const generatePhonePeLink = ({ vpa, amount, nickname = 'demo', cbsName = 'ok' }) => {
            if (!vpa)    throw new Error('UPI ID is required');
            if (!amount) throw new Error('Amount is required');

            const orderId = crypto.randomUUID();

            const payload = {
                contact: {
                    cbsName,
                    nickName: nickname,
                    vpa,
                    type: 'VPA'
                },
                p2pPaymentCheckoutParams: {
                    note:                          `OrderNo: ${orderId}`,
                    isByDefaultKnownContact:       true,
                    enableSpeechToText:            false,
                    allowAmountEdit:               false,
                    showQrCodeOption:              false,
                    disableViewHistory:            true,
                    shouldShowUnsavedContactBanner: false,
                    isRecurring:                   false,
                    checkoutType:                  'DEFAULT',
                    transactionContext:            'p2p',
                    initialAmount:                 Number(amount) * 100,  // Paise
                    disableNotesEdit:              true,
                    showKeyboard:                  true,
                    currency:                      'INR',
                    shouldShowMaskedNumber:        true
                }
            };

            const base64Data = btoa(JSON.stringify(payload));
            return `phonepe://native?data=${base64Data}&id=p2ppayment`;
        };

        paymentUrl = generatePhonePeLink({ vpa: RECIPIENT_UPI, amount: selectedAmount });
        console.log('[PhonePe] Native URL generated:', paymentUrl);
    }
    // Pre-generate on load so it is ready when user taps Pay
    openPhonepayy();

    // ─── openPhonepay() — PhonePe simple UPI scheme (fallback / non-Android) ──
    function openPhonepay() {
        const url = `phonepe://upi//pay?pa=${RECIPIENT_UPI}&pn=Shop&am=${selectedAmount}&cu=INR`;
        window.location.href = url;
    }

    // ─── openPaytm() — Paytm deep-link (paytmmp://cash_wallet scheme) ─────────
    // Exact port from React component
    function openPaytm() {
        const url =
            'paytmmp://cash_wallet?pa=' + RECIPIENT_UPI +
            '&pn=Shop' +
            '&am=' + selectedAmount +
            '&cu=INR' +
            '&tn=8715162375' +
            '&featuretype=money_transfer';
        window.location.href = url;
    }

    // ─── paymentHandler() — main routing logic (ported from React) ───────────
    // Routes based on currently selected UPI sub-method and detected platform
    function paymentHandler(upimethod) {
        if (upimethod === 'phonepe') {
            if (isDevice === 'and') {
                // Android: use native PhonePe Base64 deep-link
                window.location.href = paymentUrl;
            } else if (isDevice === 'ios') {
                // iOS: use simple UPI custom scheme
                openPhonepay();
            } else {
                // Desktop: fall back to QR display
                document.getElementById('radio-qr').checked = true;
                document.getElementById('radio-qr').dispatchEvent(new Event('change'));
                return; // skip verification — wait for user to confirm scan
            }
        } else if (upimethod === 'gpay') {
            if (isDevice === 'and') {
                const txnId  = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
                const params = `pa=${encodeURIComponent(RECIPIENT_UPI)}&pn=${encodeURIComponent(RECIPIENT_NAME)}&am=${Number(selectedAmount).toFixed(2)}&cu=INR&tr=${txnId}`;
                window.location.href = `intent://pay?${params}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
            } else if (isDevice === 'ios') {
                const txnId  = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
                const params = `pa=${encodeURIComponent(RECIPIENT_UPI)}&pn=${encodeURIComponent(RECIPIENT_NAME)}&am=${Number(selectedAmount).toFixed(2)}&cu=INR&tr=${txnId}`;
                window.location.href = `tez://upi/pay?${params}`;
            } else {
                document.getElementById('radio-qr').checked = true;
                document.getElementById('radio-qr').dispatchEvent(new Event('change'));
                return;
            }
        } else if (upimethod === 'paytm') {
            // Use paytmmp://cash_wallet scheme (React exact match)
            openPaytm();
        } else if (upimethod === 'qr') {
            // QR already visible — just trigger verification countdown
            triggerVerification();
            return;
        } else {
            // Fallback: generic PhonePe URL
            window.location.href = paymentUrl;
        }

        // ── WebView / In-App Browser Fallback (iOS restricted contexts) ──────
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const isRestrictedWebView = _isIOS && (
            /FBAN|FBAV|Instagram|Messenger|Twitter|Line|Pinterest|WhatsApp/i.test(ua) ||
            (!/Safari/i.test(ua) && /AppleWebKit/i.test(ua))
        );
        if (isRestrictedWebView) {
            navigator.clipboard.writeText(RECIPIENT_UPI).catch(console.error);
            const forceBrowserUrl = window.location.href.replace(/^https?:\/\//i, 'googlechromes://');
            window.location.href = forceBrowserUrl;
        }

        // Auto-trigger verification when user returns from the payment app
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) { triggerVerification(); }
        }, { once: true });
    }

    // Form inputs validation
    function validateForm() {
        donorName = nameInput.value.trim();
        donorEmail = emailInput.value.trim();

        let isValid = true;

        if (!donorName) {
            nameError.style.display = 'block';
            isValid = false;
        } else {
            nameError.style.display = 'none';
        }

        if (donorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) {
            emailError.style.display = 'block';
            isValid = false;
        } else {
            emailError.style.display = 'none';
        }

        return isValid;
    }

    // Place Order / Proceed Payment Click handler
    btnPlaceOrder.addEventListener('click', () => {
        if (!validateForm()) {
            nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Regenerate PhonePe URL with the latest selectedAmount before paying
        openPhonepayy();

        const upimethod = document.querySelector('input[name="payment-method"]:checked').value;
        paymentHandler(upimethod);
    });

    // Verification countdown screen
    function triggerVerification() {
        loaderOverlay.classList.add('active');
        let seconds = 5;
        loaderTimer.innerText = seconds;

        const interval = setInterval(() => {
            seconds--;
            loaderTimer.innerText = seconds;

            if (seconds <= 0) {
                clearInterval(interval);
                loaderOverlay.classList.remove('active');
                
                // Set modal parameters
                certDonorName.innerText = donorName;
                const options = { year: 'numeric', month: 'long', day: 'numeric' };
                certDate.innerText = new Date().toLocaleDateString('en-US', options);
                
                const randomHex = Math.floor(1000000000 + Math.random() * 9000000000);
                certReceiptId.innerText = `TXN-${randomHex}`;

                // Show modal & particles
                certificateModal.classList.add('active');
                launchConfetti();
            }
        }, 1000);
    }

    // Modal Close
    btnCloseModal.addEventListener('click', () => {
        // Add contribution to campaign trackers
        currentRaised += selectedAmount;
        backersCount += 1;
        updateCampaignUI();

        certificateModal.classList.remove('active');
    });

    // Print & PDF
    btnPrintCert.addEventListener('click', () => {
        window.print();
    });

    // Share Click
    btnShareCert.addEventListener('click', () => {
        const shareText = `I just contributed ₹${selectedAmount} to support the Uplift Clean Water initiative. View my certificate and join me!`;
        if (navigator.share) {
            navigator.share({
                title: 'Donation Certificate',
                text: shareText,
                url: window.location.href
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(`${shareText} - ${window.location.href}`).then(() => {
                shareSuccessMsg.style.display = 'block';
                setTimeout(() => {
                    shareSuccessMsg.style.display = 'none';
                }, 3000);
            });
        }
    });

    // Particle/Confetti Engine
    function launchConfetti() {
        confettiContainer.innerHTML = '';
        const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#f97316'];
        
        for (let i = 0; i < 60; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            const scale = Math.random() * 0.8 + 0.4;
            piece.style.transform = `scale(${scale})`;
            piece.style.animationDelay = `${Math.random() * 2}s`;
            piece.style.animationDuration = `${Math.random() * 1.5 + 2}s`;
            
            confettiContainer.appendChild(piece);
        }
    }

    // Campaign UI Update
    function updateCampaignUI() {
        progressValText.innerText = `₹${currentRaised.toLocaleString('en-IN')} / ₹${targetGoal.toLocaleString('en-IN')}`;
        backersValText.innerText = backersCount;
        const pct = Math.min((currentRaised / targetGoal) * 100, 100);
        progressBarFill.style.width = `${pct}%`;
    }

    // Initialize Default State
    displayRecipientVpa.innerText = RECIPIENT_UPI;
    updatePricingDisplays();
    updateCampaignUI();
});
