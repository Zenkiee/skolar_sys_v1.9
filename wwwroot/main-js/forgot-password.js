// ── helpers ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function getCsrf() {
    return document.querySelector('input[name="__RequestVerificationToken"]')?.value ?? '';
}

function showMsg(text, isError = true) {
    const el = $('forgotMessage');
    el.textContent = text;
    el.style.color = isError ? '#c0392b' : '#2ecc71';
}

function showStep(formId, title, subtitle) {
    document.querySelectorAll('.forgot-form').forEach(f => f.classList.remove('active'));
    document.getElementById(formId).classList.add('active');
    $('forgotTitle').textContent = title;
    $('forgotSubtitle').textContent = subtitle;
    showMsg('');
}

function getLoginUrl() {
    const role = sessionStorage.getItem('resetRole') ?? 'learner';
    return `/Home/Account?role=${role}`;
}

// ── OTP countdown ─────────────────────────────────────────────────────────────
let timerHandle = null;

function startTimer(seconds = 60) {
    clearInterval(timerHandle);
    const btn = $('resendBtn');
    const span = $('otpTimer');
    btn.disabled = true;
    let left = seconds;
    span.textContent = left;
    timerHandle = setInterval(() => {
        left--;
        span.textContent = left;
        if (left <= 0) {
            clearInterval(timerHandle);
            btn.disabled = false;
            btn.textContent = 'Resend';
        }
    }, 1000);
}

// ── OTP digit auto-advance ────────────────────────────────────────────────────
document.querySelectorAll('.otp-digit').forEach((input, i, all) => {
    input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(0, 1);
        if (input.value && i < all.length - 1) all[i + 1].focus();
    });
    input.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && !input.value && i > 0) all[i - 1].focus();
    });
    input.addEventListener('paste', e => {
        e.preventDefault();
        const digits = (e.clipboardData.getData('text').replace(/\D/g, '')).slice(0, 6);
        [...digits].forEach((d, j) => { if (all[i + j]) all[i + j].value = d; });
        const next = all[Math.min(i + digits.length, all.length - 1)];
        next?.focus();
    });
});

function getOtpValue() {
    return [...document.querySelectorAll('.otp-digit')].map(d => d.value).join('');
}

function clearOtp() {
    document.querySelectorAll('.otp-digit').forEach(d => d.value = '');
    document.querySelector('.otp-digit')?.focus();
}

// ── STEP 1: submit email ──────────────────────────────────────────────────────
$('emailForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('resetEmail').value.trim();
    const role  = new URLSearchParams(location.search).get('role') ?? 'learner';
    sessionStorage.setItem('resetRole', role);

    showMsg('Sending verification code…', false);

    const res = await fetch('/Home/VerifyResetAccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrf() },
        body: JSON.stringify({ email, role })
    });

    const data = await res.json();

    if (!res.ok) { showMsg(data.error ?? 'Something went wrong.'); return; }

    showStep('otpForm',
        'Check Your Email',
        `We sent a 6-digit code to ${email}. It expires in 10 minutes.`);
    clearOtp();
    startTimer();
});

// ── STEP 2: resend OTP ────────────────────────────────────────────────────────
$('resendBtn').addEventListener('click', async () => {
    const email = $('resetEmail').value.trim();
    const role  = sessionStorage.getItem('resetRole') ?? 'learner';

    showMsg('Resending code…', false);

    const res = await fetch('/Home/VerifyResetAccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrf() },
        body: JSON.stringify({ email, role })
    });

    const data = await res.json();

    if (!res.ok) { showMsg(data.error ?? 'Failed to resend.'); return; }

    showMsg('A new code was sent!', false);
    clearOtp();
    startTimer();
});

// ── STEP 2: verify OTP ───────────────────────────────────────────────────────
$('otpForm').addEventListener('submit', async e => {
    e.preventDefault();
    const otp = getOtpValue();

    if (otp.length !== 6) { showMsg('Enter the full 6-digit code.'); return; }

    const res = await fetch('/Home/VerifyOtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrf() },
        body: JSON.stringify({ otp })
    });

    const data = await res.json();

    if (!res.ok) { showMsg(data.error ?? 'Invalid code.'); return; }

    showStep('resetForm', 'Create New Password',
        'Your identity is verified. Enter your new password below.');
});

// ── STEP 3: reset password ────────────────────────────────────────────────────
$('resetForm').addEventListener('submit', async e => {
    e.preventDefault();

    const res = await fetch('/Home/ResetPassword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrf() },
        body: JSON.stringify({
            newPassword: $('newPassword').value,
            confirmPassword: $('confirmNewPassword').value
        })
    });

    const data = await res.json();

    if (!res.ok) { showMsg(data.error ?? 'Reset failed.'); return; }

    showMsg('Password reset! Redirecting to login…', false);
    setTimeout(() => location.href = getLoginUrl(), 2000);
});

// ── back links ────────────────────────────────────────────────────────────────
$('backToEmail').addEventListener('click', e => {
    e.preventDefault();
    clearInterval(timerHandle);
    showStep('emailForm', 'Forgot Password',
        'Enter your registered email address first, then create a new password.');
});

$('backToLogin').addEventListener('click', e => {
    e.preventDefault();
    location.href = getLoginUrl();
});

$('backToLoginTwo').addEventListener('click', e => {
    e.preventDefault();
    location.href = getLoginUrl();
});

function togglePassword(id, btn) {
    const input = document.getElementById(id);
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
}
