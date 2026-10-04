// ---------------------------------------------------------------------------
// contact.html form submission handler. Extracted from an inline <script> so
// the page can run under a Content-Security-Policy without 'unsafe-inline'
// in script-src. Depends on js/00-config.js (CW_CONFIG) loaded earlier.
// ---------------------------------------------------------------------------

const contactForm = document.getElementById('contact-form');
const statusBox = document.getElementById('contact-status');
const submitBtn = document.getElementById('contact-submit-btn');
const CONTACT_FALLBACK_EMAIL = 'info@cryptobolt.io';

function showStatus(message, kind) {
    // Errors interrupt screen readers (role=alert); success/progress messages wait their turn (role=status).
    statusBox.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    statusBox.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
    statusBox.textContent = message;
    statusBox.classList.remove('hidden', 'text-[#14d38a]', 'bg-[#14d38a]/10', 'border', 'border-[#14d38a]/20', 'text-[#ff4d6a]', 'bg-[#ff4d6a]/10', 'border-[#ff4d6a]/20', 'text-amber-300', 'bg-amber-500/10', 'border-amber-500/20');
    if (kind === 'success') statusBox.classList.add('text-[#14d38a]', 'bg-[#14d38a]/10', 'border', 'border-[#14d38a]/20');
    else if (kind === 'error') statusBox.classList.add('text-[#ff4d6a]', 'bg-[#ff4d6a]/10', 'border', 'border-[#ff4d6a]/20');
    else statusBox.classList.add('text-amber-300', 'bg-amber-500/10', 'border', 'border-amber-500/20');
}

function openMailtoFallback(name, email, topic, message) {
    const subject = encodeURIComponent(`[CryptoBolt] ${topic} — from ${name}`);
    const body = encodeURIComponent(`${message}\n\n—\nFrom: ${name} (${email})`);
    window.location.href = `mailto:${CONTACT_FALLBACK_EMAIL}?subject=${subject}&body=${body}`;
}

// Clear, field-specific validation messages instead of the browser's generic bubble.
// The form has novalidate so these run first; the server still re-validates everything.
function fieldProblem(id, text) {
    const el = document.getElementById(id);
    el.setAttribute('aria-invalid', 'true');
    el.setAttribute('aria-describedby', 'contact-status');
    return { el, text };
}

function validateContactForm() {
    ['contact-name', 'contact-email', 'contact-message'].forEach((id) => {
        const el = document.getElementById(id);
        el.removeAttribute('aria-invalid');
        el.removeAttribute('aria-describedby');
    });
    const name = document.getElementById('contact-name').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const message = document.getElementById('contact-message').value.trim();
    if (!name) return fieldProblem('contact-name', 'Please enter your name so we know who to reply to.');
    if (!email) return fieldProblem('contact-email', 'Please enter your email address so we can reply.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fieldProblem('contact-email', 'That email address does not look right. It should look like name@example.com.');
    if (!message) return fieldProblem('contact-message', 'Please write a message. A few details about what happened helps us fix it faster.');
    return null;
}

contactForm.setAttribute('novalidate', '');

contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const problem = validateContactForm();
    if (problem) {
        showStatus(problem.text, 'error');
        problem.el.focus();
        return;
    }
    const name = document.getElementById('contact-name').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const topic = document.getElementById('contact-topic').value;
    const message = document.getElementById('contact-message').value.trim();
    const company = document.getElementById('contact-company').value; // honeypot
    if (!name || !email || !message) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const apiBase = (typeof CW_CONFIG !== 'undefined' && CW_CONFIG.apiBaseUrl) ? CW_CONFIG.apiBaseUrl : '';

    try {
        const res = await fetch(`${apiBase}/api/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, topic, message, company }),
        });

        if (res.ok) {
            showStatus("Message sent — we'll get back to you soon.", 'success');
            contactForm.reset();
        } else if (res.status === 503) {
            // Backend is reachable but SMTP isn't configured yet on this deployment — fall back gracefully.
            showStatus("This deployment's contact form isn't fully set up yet — opening your email app instead.", 'warning');
            openMailtoFallback(name, email, topic, message);
        } else {
            const body = await res.json().catch(() => ({}));
            showStatus(body.error || 'Could not send your message. Opening your email app instead.', 'error');
            openMailtoFallback(name, email, topic, message);
        }
    } catch {
        // Backend unreachable (not deployed yet, wrong apiBaseUrl, offline, etc.) — fall back to mailto so the form still "works".
        showStatus("Couldn't reach the server — opening your email app instead.", 'warning');
        openMailtoFallback(name, email, topic, message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '✉ Send message';
    }
});