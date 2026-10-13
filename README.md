# Application Tracker

A small, dependency-free browser app for tracking job applications.

## Install

No installation or build step is required. Clone or download the repository and open [`index.html`](./index.html) in a modern browser.

## Use

1. Enter the company, job listing URL, location, and optional starting salary.
2. Select **Save application**.
3. Use **Edit** to update details or status, and **Delete** to remove an entry.
4. Select **Export CSV** to download all applications.

## How it works

The app is built with plain HTML, CSS, and JavaScript. Applications are stored in the browser's `localStorage`, so no server or account is needed. New entries start with **Open** status. Entries without an update for 14 days are marked as waiting, while rejected applications are shown in red and scheduled interviews include their date, time, and address.
