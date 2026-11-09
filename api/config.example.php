<?php

declare(strict_types=1);

/**
 * Copy this file to api/config.php and fill in the MySQL details from Hostinger hPanel
 * (Websites → Manage → Databases → MySQL Databases). The host is often "localhost".
 * config.php is not part of the app source. Do not upload it to a public repository.
 */
return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'u000000000_dbpa',
        'user' => 'u000000000_dbpa',
        'pass' => 'paste-the-database-password',
    ],
    'debug' => false,
];
