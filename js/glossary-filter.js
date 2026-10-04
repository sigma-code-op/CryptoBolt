// ---------------------------------------------------------------------------
// glossary.html: live filter for the term list. Progressive enhancement only:
// without JavaScript every term stays visible and the A-Z links still work.
// Kept as its own file because the site's CSP has no 'unsafe-inline' for scripts.
// ---------------------------------------------------------------------------
(function () {
    var input = document.getElementById('gloss-filter');
    var count = document.getElementById('gloss-count');
    var empty = document.getElementById('gloss-empty');
    var items = Array.prototype.slice.call(document.querySelectorAll('.mk-gloss-item'));
    var sections = Array.prototype.slice.call(document.querySelectorAll('.mk-gloss-letter'));
    var azLinks = Array.prototype.slice.call(document.querySelectorAll('.mk-gloss-az a'));
    if (!input || !items.length) return;

    function apply() {
        var q = input.value.trim().toLowerCase();
        var words = q ? q.split(/\s+/) : [];
        var shown = 0;

        items.forEach(function (item) {
            var hay = item.getAttribute('data-search') || '';
            var match = words.every(function (w) { return hay.indexOf(w) !== -1; });
            item.hidden = !match;
            if (match) shown++;
        });

        sections.forEach(function (section) {
            var any = section.querySelector('.mk-gloss-item:not([hidden])');
            section.hidden = !any;
        });

        azLinks.forEach(function (a) {
            var target = document.getElementById(a.getAttribute('href').slice(1));
            a.hidden = !!(target && target.closest('section') && target.closest('section').hidden);
        });

        empty.hidden = shown !== 0;
        count.textContent = q ? shown + ' of ' + items.length + ' terms match' : '';
    }

    input.addEventListener('input', apply);

    // Landing on #term while a filter hides it would show nothing: clear the filter first.
    window.addEventListener('hashchange', function () {
        var target = location.hash && document.getElementById(location.hash.slice(1));
        if (target && target.hidden) {
            input.value = '';
            apply();
            target.scrollIntoView();
        }
    });
})();