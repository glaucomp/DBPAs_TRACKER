# DBPA Tracker

Design register for CORE Consulting Engineers. The screens are a React app styled with Tailwind. Projects, issuance history, dropdowns, and team logins are stored in MySQL through a small PHP API, which is what Hostinger shared hosting can run.

## Publish on Hostinger

Hostinger deploys this git repository. The site root has to be the built page, not the Vite source. `npm run build` writes that page to `index.html`, `assets/`, and `.htaccess` in the repository root. Those files are committed and go out with `git push`.

1. In hPanel, open **Websites → Manage → Databases → MySQL Databases**. Create a database and a user, and add the user to the database with all privileges. Note the host (usually `localhost`), database name, user, and password.
2. Open **phpMyAdmin**, select that database, and import `database/schema.sql`.
3. On the server, copy `api/config.example.php` to `api/config.php` and fill in those four database values. `config.php` is not in git.
4. After a change to the React app, build, commit, and push:

   ```bash
   npm install
   npm run build
   git add index.html assets .htaccess
   git commit -m "Build the tracker for Hostinger"
   git push
   ```

5. If hPanel does not deploy on push by itself, open **Advanced → GIT** and deploy `main`.
6. Open the site. The first visit asks you to create the administrator. After that, sign in and add the rest of the team from **Setup**.

The dropdowns from the original tracker (assignees, stages, statuses, programs, engineers, priorities) are already in the database. Rename or delete them in **Setup**. **Load sample projects** on an empty register fills in the demo jobs so you can see the overview; delete them when you are ready for live work.

PHP 8.1 or newer is required. In hPanel, set the site’s PHP version to 8.1, 8.2, or 8.3 if it is older.

## Run it locally

Create a MySQL database, import `database/schema.sql`, and fill in `api/config.php`. Then, in two terminals:

```bash
php -S 127.0.0.1:8080 dev-router.php
npm run dev
```

Open http://localhost:5173.

## What the register does

- **Overview** groups open jobs by status and flags due or overdue dates.
- **Projects** is the full register. Completed jobs stay here and are left off the overview.
- **Issued DBPAs** lists every issuance. Editing the latest issue opens the project. Editing an earlier issue changes only that issue date, and the older revisions stay in the history.
- **My Projects** filters by the person the work is assigned to.
- **Setup** edits the dropdowns. Administrators also add and remove team accounts, and can connect a Microsoft Teams channel.

## Microsoft Teams

When someone adds a project, the tracker can post a short Adaptive Card into a Teams channel. Edits, deletes, and **Load sample projects** stay silent. The webhook URL is stored in MySQL (`settings`); `api/config.php` is unchanged.

1. In the Teams channel, open **Workflows** and create **Post to a channel when a webhook request is received**. Copy the webhook URL.
2. Sign in to the tracker as an administrator and open **Setup**.
3. Under **Microsoft Teams**, paste the URL and save. The tracker only confirms that a webhook is configured; it never shows the URL again.
4. Add a project and check the channel for the card. If Teams is unreachable, the project still saves and the toast says Teams was not notified.

To stop notifications, clear the field on Setup and save. On an existing Hostinger database the `settings` table is created automatically the first time the tracker needs it (when an administrator opens or saves the Teams setting, or when someone adds a project and the notifier checks for a webhook); new installs get it from `database/schema.sql`.
