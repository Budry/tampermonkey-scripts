// ==UserScript==
// @name         Claude Usage Progress - limits
// @namespace    https://claude.ai
// @version      1.0
// @description  Přidání výpisu kolik max % mohu aktuálně mít využito
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const RESET_DAY = 6;       // sobota: 0=neděle, 1=pondělí, ..., 6=sobota
    const RESET_HOUR = 18;     // 18:00
    const RESET_MINUTE = 0;

    const BADGE_CLASS = 'tm-expected-usage';

    let observer = null;
    let debounceTimer = null;
    let intervalId = null;

    function isUsageSettingsOpen() {
        return window.location.hash === '#settings/usage';
    }

    function getLastReset(now) {
        const reset = new Date(now);
        reset.setHours(RESET_HOUR, RESET_MINUTE, 0, 0);

        const daysSinceResetDay = (now.getDay() - RESET_DAY + 7) % 7;
        reset.setDate(now.getDate() - daysSinceResetDay);

        if (now < reset) {
            reset.setDate(reset.getDate() - 7);
        }

        return reset;
    }

    function getNextReset(now) {
        const last = getLastReset(now);
        const next = new Date(last);
        next.setDate(last.getDate() + 7);
        return next;
    }

    function getExpectedUsagePercent() {
        const now = new Date();
        const lastReset = getLastReset(now);
        const nextReset = getNextReset(now);

        const elapsed = now - lastReset;
        const total = nextReset - lastReset;

        return Math.min(100, Math.max(0, (elapsed / total) * 100));
    }

    function findResetSpan() {
        const spans = document.querySelectorAll('span');

        for (const span of spans) {
            const text = span.textContent || '';

            if (!text.includes('Resets')) {
                continue;
            }

            const container = span.closest('div.flex.w-full.flex-row.flex-wrap');

            if (!container) {
                continue;
            }

            const containerText = container.textContent || '';

            if (
                containerText.includes('All models') &&
                containerText.includes('used')
            ) {
                return span;
            }
        }

        return null;
    }

    function enhanceUsageBlock() {
        if (!isUsageSettingsOpen()) {
            return false;
        }

        const resetSpan = findResetSpan();

        if (!resetSpan) {
            return false;
        }

        const expected = getExpectedUsagePercent();

        let badge = resetSpan.parentElement.querySelector(`.${BADGE_CLASS}`);

        if (!badge) {
            badge = document.createElement('span');
            badge.className = BADGE_CLASS;

            badge.style.display = 'block';
            badge.style.marginTop = '2px';
            badge.style.fontSize = '11px';
            badge.style.lineHeight = '1.2';
            badge.style.color = 'rgba(142, 142, 160, 0.95)';
            badge.style.whiteSpace = 'nowrap';

            resetSpan.insertAdjacentElement('afterend', badge);
        }

        badge.textContent = `Rovnoměrně bys teď měl mít vyčerpáno cca ${expected.toFixed(1)} %`;

        return true;
    }

    function scheduleEnhance() {
        if (!isUsageSettingsOpen()) {
            return;
        }

        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            enhanceUsageBlock();
        }, 500);
    }

    function start() {
        scheduleEnhance();

        observer = new MutationObserver(() => {
            scheduleEnhance();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Stačí aktualizace jednou za minutu.
        intervalId = setInterval(() => {
            if (isUsageSettingsOpen()) {
                enhanceUsageBlock();
            }
        }, 60 * 1000);
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', start, {once: true});
    } else {
        start();
    }

    window.addEventListener('hashchange', scheduleEnhance);
})();
