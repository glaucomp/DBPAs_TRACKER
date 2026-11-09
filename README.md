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

When someone adds a project, the tracker can post a short note into a Teams channel. Edits, deletes, and **Load sample projects** stay silent. An administrator chooses the method in **Setup → Microsoft Teams**. The webhook URL, Azure app secret, and Microsoft sign-in are stored in MySQL (`settings`). `api/config.php` is unchanged, and the page never shows the secret or webhook again.

On an existing Hostinger database the `settings` table is created automatically the first time the tracker needs it. New installs get it from `database/schema.sql`. If Teams is unreachable, the project still saves and the toast says Teams was not notified.

### Workflows webhook

1. In the Teams channel, open **Workflows** and create **Post to a channel when a webhook request is received**. Copy the webhook URL.
2. Sign in to the tracker as an administrator and open **Setup → Microsoft Teams**.
3. Choose **Workflows webhook**, paste the URL, and save.
4. Add a project and check the channel.

To stop webhook notifications, clear the field and save, or switch the choice to Microsoft Graph.

### Microsoft Graph

Graph posts the note as a signed-in Microsoft 365 user who is a member of the team. Calls, meetings, and chats are not part of this tracker.

1. In Microsoft Entra, register a single-tenant app.
2. Add a **Web** redirect URI. Setup shows the exact URI for this site (local and the public site are different).
3. Create a client secret.
4. Add delegated Microsoft Graph permissions: `User.Read`, `Team.ReadBasic.All`, `Channel.ReadBasic.All`, and `ChannelMessage.Send`. Grant admin consent. The sign-in also requests `offline_access` so the tracker can refresh the connection.
5. In Setup, choose **Microsoft Graph**, paste the Directory (tenant) ID, Application (client) ID, and client secret, and save.
6. Connect the Microsoft account, then choose the team and channel.

Changing the tenant or client ID disconnects the account. Disconnect leaves the Azure app saved and stops Graph posts until you connect again.
