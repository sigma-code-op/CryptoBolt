// Fills in today's date on terms.html. Extracted from an inline <script> so
// the page can run under a Content-Security-Policy without 'unsafe-inline'
// in script-src.
document.getElementById('terms-date').textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });