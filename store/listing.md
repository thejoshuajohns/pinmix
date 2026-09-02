# store listing

everything the chrome web store and edge add-ons forms ask for, ready to paste. the images in this folder are the exact sizes each store wants

## files

- `screenshot-1-shuffle.png` 1280x800, the panel on a board
- `screenshot-2-done.png` 1280x800, the finished state
- `screenshot-3-before-after.png` 1280x800, the original board next to its shuffled copy
- `promo-small.png` 440x280, small promo tile
- `promo-marquee.png` 1400x560, marquee promo tile
- `icon-128.png` 128x128, the store icon with the 16px transparent padding the store asks for
- the screenshots and tiles are flat 24 bit pngs with no alpha, which the store requires

## name

pinmix

## summary (132 characters max)

shuffle any pinterest board into a new board in one click. sections come along, your original stays untouched

## description

pinmix adds one button to pinterest. open a board, hit shuffle, and every pin gets saved to a brand new board in a random order. your original board is never touched, so you can always go back

what it does

- shuffles a whole board into a new board with the same privacy as the original
- keeps your sections if you want, each one shuffled on its own, or mixes every pin together
- shuffles a single section into a new section right next to the original on the same board
- takes an optional seed, so the same seed always gives the same order
- shows live progress and lets you stop part way, keeping what was saved so far
- tells you straight away if the name you picked is already taken

how it works

pinmix runs on pinterest.com itself and uses the session you are already signed in with. there is no separate login, no account, no server, and nothing leaves your browser. it talks only to pinterest, the same way the pinterest website does

things to know

pinterest has no official api for this, so pinmix uses the same internal calls the pinterest site uses. if pinterest changes those, the extension will tell you the request failed until an update goes out. big boards take a few minutes because saves are spaced out to stay under pinterest's rate limits

pinmix is open source at https://github.com/thejoshuajohns/pinmix

## category

productivity

## language

english

## single purpose description

pinmix shuffles the pins of a pinterest board or section into a new board or section in a random order

## permission justification

host permissions on pinterest domains: the extension only works on pinterest board pages. it needs to run there to add its button and to call pinterest's own endpoints with the user's signed in session. it requests no other permissions

## remote code

no, the extension does not use remote code. everything ships inside the package

## data usage disclosure

- does not collect or transmit any user data
- no personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity, or website content is collected
- certify that data is not sold, not used for unrelated purposes, and not used for creditworthiness or lending

## privacy policy url

https://github.com/thejoshuajohns/pinmix/blob/main/PRIVACY.md

## homepage url

https://github.com/thejoshuajohns/pinmix

## support url

https://github.com/thejoshuajohns/pinmix/issues
