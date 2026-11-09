# DBPA Tracker

Design register for CORE Consulting Engineers. The screens are a React app styled with Tailwind. Projects, issuance history, dropdowns, and team logins are stored in MySQL through a small PHP API, which is what Hostinger shared hosting can run.

## Publish on Hostinger

1. In hPanel, open **Websites → Manage → Databases → MySQL Databases**. Create a database and a user, and add the user to the database with all privileges. Note the host (usually `localhost`), database name, user, and password.
2. Open **phpMyAdmin**, select that database, and import `database/schema.sql`.
3. On your computer, copy `api/config.example.php` to `api/config.php` and fill in those four database values.
4. Install dependencies and build the site:

   ```bash
   npm install
   npm run build
   ```

5. Upload **the contents** of `dist/` into `public_html` (`index.html`, `assets/`, `.htaccess`, the logo, and the favicon).
6. Upload the whole `api/` folder to `public_html/api`, including `config.php`. Do not upload `node_modules`.
7. Open the site. The first visit asks you to create the administrator. After that, sign in and add the rest of the team from **Setup**.

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
- **Setup** edits the dropdowns. Administrators also add and remove team accounts.
