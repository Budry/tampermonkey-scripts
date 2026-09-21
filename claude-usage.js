// ==UserScript==
// @name         Claude Usage Progress - limits
// @namespace    https://claude.ai
// @version      1.1
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

    const SESSION_DURATION_MS = 5 * 60 * 60 * 1000; // 5h limit "Current session"

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

    function getExpectedWeeklyPercent() {
        const now = new Date();
        const lastReset = getLastReset(now);
        const nextReset = getNextReset(now);

        const elapsed = now - lastReset;
        const total = nextReset - lastReset;

        return Math.min(100, Math.max(0, (elapsed / total) * 100));
    }

    function parseSessionResetDate(resetText, now) {
        const match = resetText.match(/Resets at (\d{1,2}):(\d{2})\s*(AM|PM)/i);

        if (!match) {
            return null;
        }

        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const meridiem = match[3].toUpperCase();

        if (meridiem === 'PM' && hours !== 12) {
            hours += 12;
        } else if (meridiem === 'AM' && hours === 12) {
            hours = 0;
        }

        const candidate = new Date(now);
        candidate.setHours(hours, minutes, 0, 0);

        if (candidate <= now) {
            candidate.setDate(candidate.getDate() + 1);
        }

        return candidate;
    }

    function getExpectedSessionPercent(resetText) {
        const now = new Date();
        const nextReset = parseSessionResetDate(resetText, now);

        if (!nextReset) {
            return null;
        }

        const lastReset = new Date(nextReset.getTime() - SESSION_DURATION_MS);
        const elapsed = now - lastReset;

        return Math.min(100, Math.max(0, (elapsed / SESSION_DURATION_MS) * 100));
    }

    function findUsageRow(labelText) {
        const labelSpans = document.querySelectorAll('span.text-body.text-primary');

        for (const labelSpan of labelSpans) {
            if ((labelSpan.textContent || '').trim() !== labelText) {
                continue;
            }

            const row = labelSpan.closest('div.flex.w-full.flex-wrap.items-center.justify-between');

            if (row) {
                return row;
            }
        }

        return null;
    }

    function findResetSpanInRow(row) {
        return row.querySelector('div.w-52 > span.text-footnote.text-secondary');
    }

    function upsertBadge(resetSpan, text) {
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

        badge.textContent = text;
    }

    function enhanceRow(labelText, computeExpectedPercent) {
        const row = findUsageRow(labelText);

        if (!row) {
            return false;
        }

        const resetSpan = findResetSpanInRow(row);

        if (!resetSpan) {
            return false;
        }

        const expected = computeExpectedPercent(resetSpan.textContent || '');

        if (expected === null || Number.isNaN(expected)) {
            return false;
        }

        upsertBadge(resetSpan, `Rovnoměrně bys teď měl mít vyčerpáno cca ${expected.toFixed(1)} %`);

        return true;
    }

    function enhanceUsageBlock() {
        if (!isUsageSettingsOpen()) {
            return false;
        }

        const weeklyOk = enhanceRow('This week', getExpectedWeeklyPercent);
        const sessionOk = enhanceRow('Current session', getExpectedSessionPercent);

        return weeklyOk || sessionOk;
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
