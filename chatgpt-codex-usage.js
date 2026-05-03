// ==UserScript==
// @name         ChatGPT Codex Usage Progress - limits
// @namespace    https://chatgpt.com
// @version      1.0
// @description  Přidání výpisu kolik max % mohu aktuálně mít využito
// @match        https://chatgpt.com/codex/cloud/settings/analytics
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const BADGE_CLASS = 'tm-expected-usage';
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    let observer = null;
    let debounceTimer = null;
    let intervalId = null;

    function parseResetDate(text) {
        const normalized = (text || '').replace(/\s+/g, ' ').trim();

        const czechMatch = normalized.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2})/);
        if (czechMatch) {
            const [, day, month, year, hour, minute] = czechMatch;
            return new Date(
                Number(year),
                Number(month) - 1,
                Number(day),
                Number(hour),
                Number(minute),
                0,
                0
            );
        }

        const englishMatch = normalized.match(/([A-Z][a-z]+ \d{1,2}, \d{4}, \d{1,2}:\d{2}(?:\s?[AP]M)?)/);
        if (englishMatch) {
            const parsed = new Date(englishMatch[1]);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }

        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }

        return null;
    }

    function getExpectedRemainingPercent(nextReset) {
        const now = new Date();
        const lastReset = new Date(nextReset.getTime() - WEEK_MS);
        const elapsed = now - lastReset;
        const total = nextReset - lastReset;

        return Math.min(100, Math.max(0, 100 - (elapsed / total) * 100));
    }

    function findUsageArticle() {
        const articles = document.querySelectorAll('article');

        for (const article of articles) {
            const text = (article.textContent || '').replace(/\s+/g, ' ').trim();

            const looksLikeWeeklyLimit =
                /týden|week/i.test(text) &&
                /limit/i.test(text) &&
                (/obnov/i.test(text) || /reset/i.test(text));

            if (!looksLikeWeeklyLimit) {
                continue;
            }

            const resetSpan = Array.from(article.querySelectorAll('span')).find((span) => {
                const spanText = (span.textContent || '').trim();
                return /obnov/i.test(spanText) || /reset/i.test(spanText);
            });

            if (resetSpan) {
                return {article, resetSpan};
            }
        }

        return null;
    }

    function enhanceUsageBlock() {
        const usageBlock = findUsageArticle();

        if (!usageBlock) {
            return false;
        }

        const {article, resetSpan} = usageBlock;
        const nextReset = parseResetDate(resetSpan.textContent || '');

        if (!nextReset) {
            return false;
        }

        const expected = getExpectedRemainingPercent(nextReset);
        const footer = resetSpan.parentElement;

        if (!footer) {
            return false;
        }

        let badge = article.querySelector(`.${BADGE_CLASS}`);

        if (!badge) {
            badge = document.createElement('div');
            badge.className = BADGE_CLASS;

            badge.style.marginTop = '4px';
            badge.style.fontSize = '11px';
            badge.style.lineHeight = '1.2';
            badge.style.color = 'rgba(142, 142, 160, 0.95)';
            badge.style.whiteSpace = 'normal';

            footer.insertAdjacentElement('afterend', badge);
        }

        badge.textContent = `Rovnoměrně by ti teď mělo zbývat cca ${expected.toFixed(1)} %`;

        return true;
    }

    function scheduleEnhance() {
        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            const success = enhanceUsageBlock();

            if (success && observer) {
                observer.disconnect();
                observer = null;
            }
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

        intervalId = setInterval(() => {
            enhanceUsageBlock();
        }, 60 * 1000);

        setTimeout(() => {
            if (observer) {
                observer.disconnect();
                observer = null;
            }
        }, 30 * 1000);
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', start, {once: true});
    } else {
        start();
    }
})();
