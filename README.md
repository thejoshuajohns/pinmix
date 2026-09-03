# pinmix

shuffle any pinterest board into a new board in one click

pinmix is a tiny browser extension. open a board on pinterest, hit the shuffle button in the corner, and every pin gets saved to a brand new board in a random order. sections come along too, each one shuffled on its own, or you can mix everything together. your original board stays exactly as it was

## how it works

the extension runs on pinterest.com itself so it uses the session you are already signed in with. no separate login, no desktop app, no browser automation, no servers of its own

1. it reads the board or section you are looking at
2. it creates the new board or section first, so a name that is already taken fails straight away
3. it loads every pin, section by section
4. it shuffles them, with an optional seed if you want the same order again later
5. it saves the pins into place. with keep sections on, every section is recreated and shuffled on its own. with it off, the sections are dissolved and every pin is mixed together on the board

open a section instead of a board and the button turns into shuffle this section. that adds a new shuffled copy of the section to the same board, right next to the original

## install

pinmix is on the [chrome web store](https://chromewebstore.google.com/detail/pinmix/cbodhnnocahjfnkehfgpoikjdjadeejd). add it there and you are done

you can also load it unpacked if you would rather build it yourself

1. grab `pinmix-<version>.zip` from the [latest release](https://github.com/thejoshuajohns/pinmix/releases/latest) and unzip it, or run `npm run build` and use the `dist` folder
2. open `chrome://extensions` (or `edge://extensions`)
3. turn on developer mode
4. click load unpacked and pick the folder

## use

1. open any board or section on pinterest
2. click the red shuffle button in the bottom right corner
3. change the name if you want, add a seed if you want a repeatable order, and pick whether sections stay
4. hit shuffle and watch the progress bar
5. open the new board or section when it finishes

you can stop a shuffle part way through. the pins saved so far stay where they are

## privacy

pinmix only runs on pinterest pages, only talks to pinterest with your own signed in session, and sends nothing anywhere else. there is no tracking, no analytics, and no account of its own. the full policy is in [PRIVACY.md](PRIVACY.md)

## develop

needs node 22.18 or newer

```bash
npm install
npm run build
npm test
```

`npm run build` writes the extension to `dist`. `npm test` runs the unit tests with node's built in test runner. `npm run typecheck`, `npm run lint`, and `npm run format` are what ci runs. pushing a `v*` tag builds the zip and attaches it to a github release

## layout

```text
src/
  content.ts     loads the extension as a module on pinterest pages
  main.ts        watches the url and shows the panel on board pages
  board-page.ts  turns a pinterest url into a username, board slug, and section slug
  pinterest.ts   the handful of pinterest resource calls pinmix needs
  shuffle.ts     fisher yates shuffle with an optional seed
  mix.ts         create the board or section, load pins, shuffle, save with retries
  panel.ts       the in page panel
  styles.ts      panel styles
static/          manifest and icons copied into dist
tests/           unit tests
```

## heads up

pinmix talks to the same internal endpoints the pinterest website uses. pinterest can change those at any time, and if they do the extension will tell you the request failed. saves are spaced out a little so pinterest does not rate limit you, so a big board takes a few minutes
