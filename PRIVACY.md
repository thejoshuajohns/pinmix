# privacy policy

last updated september 2 2026

pinmix is a browser extension that shuffles pinterest boards. this is everything it does with your data

## what it touches

- it runs only on pinterest pages. it has no access to any other site
- it reads the board or section you are looking at, and the ids of the pins on it, using the pinterest session you are already signed in with
- it creates a new board or section on your pinterest account and saves pins into it, because that is the thing you asked it to do
- it reads your pinterest csrf cookie in order to make those requests, the same way the pinterest website does

## what it does not do

- it does not send anything to any server other than pinterest
- it does not collect, store, or transmit personal data
- it does not use analytics, tracking, or advertising
- it does not have an account, a backend, or a database
- it does not read or change anything on pinterest beyond the board or section you shuffle and the new one it creates

## where things live

everything happens inside your browser tab. nothing is stored between sessions. the source code is public at https://github.com/thejoshuajohns/pinmix so you can check all of this yourself

## contact

questions go to the github issues on the repository above
