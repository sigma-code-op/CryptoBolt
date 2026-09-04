// Fills in the current year for every '#footer-year' element on the page.
// Extracted from an inline <script> so the page can run under a
// Content-Security-Policy without 'unsafe-inline' in script-src.
document.querySelectorAll('#footer-year').forEach((el) => {
    el.innerText = new Date().getFullYear();
});