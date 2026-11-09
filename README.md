# Việc cần làm hôm nay

A small daily task log built with plain HTML, CSS and vanilla JavaScript modules. There is no build step. Your tasks are stored in the browser with localStorage.

## Commands

Install once:

    npm install
    npx playwright install chromium

Then use:

- `npm start` serves the page at http://localhost:4173 (needs Python 3).
- `npm test` runs the unit tests with `node --test tests/unit/`.
- `npm run test:e2e` runs the Playwright tests on the desktop and mobile projects. It starts the server by itself.

## Where things live

- `index.html` is the page, and `src/` holds the scripts.
- `docs/project/` holds the specs, decisions and the design system (`design-system.css`).
- `tests/unit/` and `tests/e2e/` hold the tests.

All asset links are relative so the site also works from a GitHub Pages subpath.
