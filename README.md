# Covey

Covey is a minimal, family-focused calendar that brings your iCloud calendars into beautifully designed interface that can live anywhere in your home. It can run locally on a computer or server or can be added to an iPad Home Screen like an app. No third party services or subscriptions needed. 

## Features

- Month and week calendar views
- Create, update, and delete events in iCloud Calendar
- Optional reminders and dinner calendars
- Sync status indicator with offline and retry states
- Light and dark themes, including scheduled theme changes
- Multiple color palettes and adjustable text size
- Calendar visibility filters
- Preferences saved in the browser
- Minimal interface that fades secondary controls when idle
- Responsive layout for desktop and mobile devices
- App icon, launch splash screen, and iOS Home Screen support
- Open-source project designed to run on your own infrastructure

## Calendars

Covey comes with support for three calendars out of the box. A family calendar for all family activity, dinner calendar to track meals and reminders calendar for general family reminders.

In the future we will be adding support for separate individual calendars. 

## Requirements

- Node.js 20.6 or newer
- An iCloud account
- An Apple app-specific password

## iCloud setup

Covey connects to iCloud using CalDAV. Apple requires an app-specific password for third-party applications; your normal Apple ID password will not work.

1. Sign in to [appleid.apple.com](https://appleid.apple.com).
2. Open **Sign-In and Security**.
3. Select **App-Specific Passwords**.
4. Generate a password for Covey and save it somewhere secure.

You will use your Apple ID email address and this generated password in Covey's environment configuration.

## Configuration

Copy the sample configuration file to `.env`:

```sh
cp .env_sample .env
```

Then open `.env` and set the required values:

```dotenv
ICLOUD_EMAIL=you@example.com
ICLOUD_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
CALENDAR_NAME=Family
```

`CALENDAR_NAME` must match the name of an existing iCloud calendar. Calendar names are matched case-insensitively.

The following settings are optional:

```dotenv
REMINDERS_CALENDAR=Reminders
DINNER_CALENDAR=Dinner
PORT=3000
```

- `REMINDERS_CALENDAR` enables a separate calendar for reminders.
- `DINNER_CALENDAR` enables a separate calendar for dinner planning.
- Leave either value blank or unset to disable that calendar type.
- `PORT` changes the local server port; it defaults to `3000`.

Never commit `.env` or share your app-specific password. The `.env` file is intended for local or server-side use only.

## Running locally

Install dependencies and start the server:

```sh
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

The server reads `.env` at startup. If you change your configuration, stop and restart Covey.

## How it works

Covey is a small Node.js application:

- `server.js` runs the Express web server and exposes the calendar API.
- `tsdav` handles CalDAV communication with iCloud.
- `ical.js` parses and generates iCalendar data.
- `index.html` contains the web application UI.
- `style.css` contains the shared stylesheet.

Calendar events are read from and written to iCloud through the server. The browser does not connect directly to iCloud.

## Privacy and local storage

Covey does not provide a separate hosted account system. The iCloud credentials configured in `.env` are used by the server to access the configured calendars.

Interface preferences—such as theme, text size, selected view, and calendar visibility—are stored in your browser's `localStorage`. These preferences remain local to that browser and are not uploaded to Covey.

Your calendar data remains in iCloud, subject to Apple's account and calendar settings.

## Add Covey to an iPad Home Screen

Run Covey on a computer or server that your device can reach, then open its address in Safari on iOS or iPadOS. Use **Share → Add to Home Screen**.

Covey includes iOS-specific app icons and a launch screen, so the Home Screen shortcut uses the Covey branding rather than a generic browser icon.

## Open source

Covey is open source and intended to be self-hosted and adapted to your needs. Contributions, fixes, and ideas are welcome.

Project repository: [github.com/vinceangeloni/Covey](https://github.com/vinceangeloni/Covey)

## License

No license has been declared for this repository yet. Until a license is added, standard copyright restrictions apply to reuse of the source code.
