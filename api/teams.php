<?php

declare(strict_types=1);

const TEAMS_WEBHOOK_KEY = 'teams_webhook_url';

const TEAMS_WEBHOOK_HOST_SUFFIXES = [
    'webhook.office.com',
    'logic.azure.com',
    'powerplatform.com',
];

function ensure_settings_table(PDO $pdo): void
{
    static $ready = false;
    if ($ready) {
        return;
    }

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS settings (
          setting_key VARCHAR(40) NOT NULL,
          setting_value TEXT NOT NULL,
          PRIMARY KEY (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $ready = true;
}

function setting_get(PDO $pdo, string $key): string
{
    try {
        $stmt = $pdo->prepare('SELECT setting_value FROM settings WHERE setting_key = ?');
        $stmt->execute([$key]);
        $value = $stmt->fetchColumn();
        return is_string($value) ? $value : '';
    } catch (PDOException $e) {
        // If the settings table does not exist yet, treat the value as unset.
        if ($e->getCode() === '42S02') {
            return '';
        }
        throw $e;
    }
}

function setting_put(PDO $pdo, string $key, string $value): void
{
    ensure_settings_table($pdo);
    $stmt = $pdo->prepare(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
    );
    $stmt->execute([$key, $value]);
}

function setting_delete(PDO $pdo, string $key): void
{
    ensure_settings_table($pdo);
    $pdo->prepare('DELETE FROM settings WHERE setting_key = ?')->execute([$key]);
}

function teams_webhook_url(PDO $pdo): string
{
    return setting_get($pdo, TEAMS_WEBHOOK_KEY);
}

function teams_is_configured(PDO $pdo): bool
{
    ensure_settings_table($pdo);
    return teams_notify_ready($pdo);
}

function teams_webhook_host_allowed(string $host): bool
{
    $host = strtolower($host);
    foreach (TEAMS_WEBHOOK_HOST_SUFFIXES as $suffix) {
        if ($host === $suffix || str_ends_with($host, '.' . $suffix)) {
            return true;
        }
    }
    return false;
}

function validate_teams_webhook_url(string $url): string
{
    $url = trim($url);
    if ($url === '') {
        return '';
    }

    if (text_length($url) > 2000) {
        json_error(422, 'That webhook URL is too long.');
    }

    $parts = parse_url($url);
    if (
        !is_array($parts)
        || ($parts['scheme'] ?? '') !== 'https'
        || empty($parts['host'])
        || !teams_webhook_host_allowed((string) $parts['host'])
    ) {
        json_error(
            422,
            'Paste a Teams Workflows webhook URL (https, from webhook.office.com, logic.azure.com, or powerplatform.com).'
        );
    }

    return $url;
}

function save_teams_webhook(PDO $pdo, array $input): void
{
    require_admin($pdo);
    ensure_settings_table($pdo);
    $url = validate_teams_webhook_url((string) ($input['webhookUrl'] ?? ''));

    if ($url === '') {
        setting_delete($pdo, TEAMS_WEBHOOK_KEY);
        return;
    }

    setting_put($pdo, TEAMS_WEBHOOK_KEY, $url);
}

/**
 * Posts a new-project Adaptive Card to Teams.
 * Returns null on success or when no webhook is configured; otherwise a short warning.
 */
function notify_teams_new_project(PDO $pdo, array $project, array $user): ?string
{
    try {
        if (teams_notify_method($pdo) === 'graph') {
            return teams_graph_notify($pdo, $project, $user);
        }
    } catch (Throwable $e) {
        error_log('DBPA tracker Teams: ' . $e->getMessage());
        return 'Teams was not notified.';
    }

    $url = teams_webhook_url($pdo);
    if ($url === '') {
        return null;
    }

    $owner = $project['owner'] !== '' ? $project['owner'] : 'Unassigned';
    $status = $project['status'] !== '' ? $project['status'] : '—';
    $due = $project['due'] !== '' ? $project['due'] : '—';
    $by = $user['name'] !== '' ? $user['name'] : $user['email'];

    $payload = [
        'type' => 'message',
        'attachments' => [[
            'contentType' => 'application/vnd.microsoft.card.adaptive',
            'contentUrl' => null,
            'content' => [
                '$schema' => 'http://adaptivecards.io/schemas/adaptive-card.json',
                'type' => 'AdaptiveCard',
                'version' => '1.4',
                'body' => [
                    [
                        'type' => 'TextBlock',
                        'size' => 'Medium',
                        'weight' => 'Bolder',
                        'text' => 'New project: ' . $project['number'],
                        'wrap' => true,
                    ],
                    [
                        'type' => 'TextBlock',
                        'text' => $project['name'],
                        'wrap' => true,
                    ],
                    [
                        'type' => 'FactSet',
                        'facts' => [
                            ['title' => 'Owner', 'value' => $owner],
                            ['title' => 'Status', 'value' => $status],
                            ['title' => 'Due', 'value' => $due],
                            ['title' => 'Added by', 'value' => $by],
                        ],
                    ],
                ],
            ],
        ]],
    ];

    if (!function_exists('curl_init')) {
        error_log('DBPA tracker Teams: cURL is not available.');
        return 'Teams was not notified.';
    }

    $body = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if ($body === false) {
        return 'Teams was not notified.';
    }

    $ch = curl_init($url);
    if ($ch === false) {
        return 'Teams was not notified.';
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
    ]);

    $response = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($response === false || $status < 200 || $status >= 300) {
        error_log('DBPA tracker Teams webhook failed: HTTP ' . $status . ' ' . $error);
        return 'Teams was not notified.';
    }

    return null;
}
