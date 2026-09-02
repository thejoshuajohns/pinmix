# pinmix

shuffle any pinterest board into a new board in one click

pinmix is a tiny browser extension. open a board on pinterest, hit the shuffle button in the corner, and every pin gets saved to a brand new board in a random order. sections come along too, each one shuffled on its own. your original board stays exactly as it was

## how it works

the extension runs on pinterest.com itself so it uses the session you are already signed in with. no separate login, no desktop app, no browser automation

1. it reads the board or section you are looking at
2. it loads every pin, section by section
3. it shuffles them, with an optional seed if you want the same order again later
4. it creates a new board with the same privacy as the original, recreates the sections, and saves the pins into place one by one

open a section instead of a board and the button turns into shuffle this section. that copies just the pins from that section into a new board

## install

pinmix is not on the chrome web store yet, so load it as an unpacked extension

1. grab `pinmix-<version>.zip` from the latest release, or run `npm run build` and use the `dist` folder
2. open `chrome://extensions` (or `edge://extensions`)
3. turn on developer mode
4. click load unpacked and pick the unzipped folder

## use

1. open any board or section on pinterest
2. click the red shuffle button in the bottom right corner
3. change the new board name if you want, add a seed if you want a repeatable order
4. hit shuffle and watch the progress bar
5. open the new board when it finishes

you can stop a shuffle part way through. the pins saved so far stay on the new board

## develop

needs node 22.18 or newer

```bash
npm install
npm run build
npm test
```

`npm run build` writes the extension to `dist`. `npm test` runs the unit tests with node's built in test runner. `npm run typecheck`, `npm run lint`, and `npm run format` are what ci runs

## layout

```text
src/
  content.ts     loads the extension as a module on pinterest pages
  main.ts        watches the url and shows the panel on board pages
  board-page.ts  turns a pinterest url into a username and board slug
  pinterest.ts   the handful of pinterest resource calls pinmix needs
  shuffle.ts     fisher yates shuffle with an optional seed
  mix.ts         load pins per section, shuffle, create the board, save with retries
  panel.ts       the in page panel
  styles.ts      panel styles
static/          manifest and icons copied into dist
tests/           unit tests
```

## heads up

pinmix talks to the same internal endpoints the pinterest website uses. pinterest can change those at any time, and if they do the extension will tell you the request failed. saves are spaced out a little so pinterest does not rate limit you, so a big board takes a few minutes
