import { test as base, expect } from '@playwright/test';

export { expect };
export type { Page } from '@playwright/test';

/** Every spec imports `test` from here, not from '@playwright/test'.
 *
 *  Why (2026-10-08 dev/test/deploy review): a scene can look "stuck" while it is actually throwing
 *  every frame. The tween/destroy race cost two rounds of raising timeouts (5s -> 15s -> 60s)
 *  before a `pageerror` listener showed the real TypeError, and only 5 of 26 specs listened.
 *  This auto fixture makes every test fail on any uncaught exception or console.error.
 *
 *  A test that provokes errors on purpose opts out explicitly, with the patterns it expects:
 *    test.use({ allowConsoleErrors: [/expected message/] });
 *  Never allowlist a `pageerror` (an uncaught exception) — fix it instead. */
type Options = { allowConsoleErrors: RegExp[] };

/** Messages the TEST MACHINE produces, not the game: a headless runner has no audio device, and
 *  Chromium reports that as a console error. Allowlisting it here keeps the check about the
 *  software, not the room it runs in. Keep this list tiny and explained. */
const ENVIRONMENT_NOISE = [/The AudioContext encountered an error from the audio device/];

export const test = base.extend<Options & { jsErrorGuard: void }>({
  allowConsoleErrors: [[], { option: true }],
  jsErrorGuard: [async ({ page, allowConsoleErrors }, use, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if ([...ENVIRONMENT_NOISE, ...allowConsoleErrors].some((re) => re.test(text))) return;
      errors.push(`console.error: ${text}`);
    });
    await use();
    // Report errors only when the test otherwise passed, so a real assertion failure stays the headline.
    if (testInfo.status === testInfo.expectedStatus) {
      expect(errors, `JavaScript errors during the test:\n${errors.join('\n')}`).toEqual([]);
    }
  }, { auto: true }],
});
