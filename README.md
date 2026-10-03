# Personal Dashboard

A small set of pages for a personal library, employees, expenses, students, study time, medicines, and screen time. Every page stays behind Google sign-in. Records are stored in Cloud Firestore for the signed-in user, using the Firebase project already configured for this app.

## Run it locally

```bash
node server.js
```

Then open [http://localhost:43123](http://localhost:43123).

`npm start` runs the same server. The port defaults to `43123`. Set `PORT` to change it.

## Sign-in and data

- Google sign-in uses the Firebase config in `js/tracker.js` (`techcoderlabz-project`).
- Until sign-in finishes, the page content is hidden and only the sign-in screen is shown.
- Each record lives under `users/{uid}/...` in Firestore. Collections are `books`, `employees`, `expenses`, `students`, `studies`, `medicines`, and `screenTime`.
- Existing `localStorage` lists for employees, expenses, medicines, and screen time are copied into Firestore once, then removed from the browser.

## Firestore rules

Client access only works after these rules are published in the Firebase console (Firestore → Rules), or with:

```bash
firebase deploy --only firestore:rules
```

The rules in `firestore.rules` allow a signed-in user to read and write only their own `users/{uid}` tree.

Also add this site under Firebase Authentication → Settings → Authorized domains. `localhost` is usually allowed already. Use `http://localhost:43123` rather than `127.0.0.1` if Google sign-in reports an unauthorized domain.
