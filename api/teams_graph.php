<?php

declare(strict_types=1);

const TEAMS_GRAPH_SCOPE = 'offline_access User.Read Team.ReadBasic.All Channel.ReadBasic.All ChannelMessage.Send';

const TEAMS_GRAPH_KEYS = [
    'method' => 'teams_notify_method',
    'tenant' => 'teams_graph_tenant_id',
    'client' => 'teams_graph_client_id',
    'secret' => 'teams_graph_client_secret',
    'refresh' => 'teams_graph_refresh_token',
    'access' => 'teams_graph_access_token',
    'expires' => 'teams_graph_access_expires',
    'account' => 'teams_graph_account',
    'team' => 'teams_graph_team_id',
    'team_name' => 'teams_graph_team_name',
    'channel' => 'teams_graph_channel_id',
    'channel_name' => 'teams_graph_channel_name',
];

function teams_notify_method(PDO $pdo): string
{
    return setting_get($pdo, TEAMS_GRAPH_KEYS['method']) === 'graph' ? 'graph' : 'webhook';
}

function teams_graph_guid(string $value): string
{
    $value = trim($value);
    if (!preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $value)) {
        return '';
    }
    return strtolower($value);
}

function teams_graph_app_ready(PDO $pdo): bool
{
    return teams_graph_guid(setting_get($pdo, TEAMS_GRAPH_KEYS['tenant'])) !== ''
        && teams_graph_guid(setting_get($pdo, TEAMS_GRAPH_KEYS['client'])) !== ''
        && setting_get($pdo, TEAMS_GRAPH_KEYS['secret']) !== '';
}

function teams_graph_can_post(PDO $pdo): bool
{
    return teams_graph_app_ready($pdo)
        && setting_get($pdo, TEAMS_GRAPH_KEYS['refresh']) !== ''
        && teams_graph_guid(setting_get($pdo, TEAMS_GRAPH_KEYS['team'])) !== ''
        && teams_graph_channel_id(setting_get($pdo, TEAMS_GRAPH_KEYS['channel']), false) !== '';
}

function teams_notify_ready(PDO $pdo): bool
{
    if (teams_notify_method($pdo) === 'graph') {
        return teams_graph_can_post($pdo);
    }
    return teams_webhook_url($pdo) !== '';
}

function teams_graph_channel_id(string $value, bool $strict): string
{
    $value = trim($value);
    if ($value !== '' && strlen($value) <= 200 && preg_match('/^[A-Za-z0-9:@._-]+$/', $value)) {
        return $value;
    }
    if ($strict) {
        json_error(422, 'Choose a channel from the list.');
    }
    return '';
}

function teams_request_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function teams_graph_redirect_uri(bool $failSoft = false): string
{
    $origin = teams_graph_browser_origin();
    if ($origin === '') {
        if ($failSoft) {
            return '';
        }
        json_error(400, 'The site address is not valid for Microsoft sign-in.');
    }

    return $origin . '/api/index.php?r=' . rawurlencode('/settings/teams/callback');
}

function teams_graph_browser_origin(): string
{
    $headerOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (is_string($headerOrigin) && is_string($host) && teams_graph_origin_usable($headerOrigin, $host)) {
        return rtrim($headerOrigin, '/');
    }

    if (!is_string($host) || !preg_match('/^[A-Za-z0-9.-]+(?::\d{1,5})?$/', $host)) {
        return '';
    }

    return (teams_request_is_https() ? 'https' : 'http') . '://' . $host;
}

function teams_graph_origin_usable(string $origin, string $hostHeader): bool
{
    $parts = parse_url($origin);
    if (!is_array($parts)) {
        return false;
    }
    $scheme = $parts['scheme'] ?? '';
    $originHost = strtolower((string) ($parts['host'] ?? ''));
    if (($scheme !== 'http' && $scheme !== 'https') || $originHost === '') {
        return false;
    }
    if (!preg_match('/^[a-z0-9.-]+$/', $originHost)) {
        return false;
    }
    if (isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
        return false;
    }
    $path = $parts['path'] ?? '';
    if ($path !== '' && $path !== '/') {
        return false;
    }
    if ($scheme === 'http' && $originHost !== 'localhost' && $originHost !== '127.0.0.1') {
        return false;
    }

    $headerHost = strtolower($hostHeader);
    $headerName = preg_replace('/:\d+$/', '', $headerHost) ?? $headerHost;
    $originPort = isset($parts['port']) ? ':' . $parts['port'] : '';
    $sameHost = ($originHost . $originPort) === $headerHost || $originHost === $headerName;
    if ($sameHost) {
        return true;
    }

    return $headerName === '127.0.0.1' || $headerName === 'localhost' || $headerName === '[::1]';
}

function teams_graph_redirect_is_ours(string $redirect): bool
{
    $parts = parse_url($redirect);
    if (!is_array($parts) || ($parts['path'] ?? '') !== '/api/index.php') {
        return false;
    }
    parse_str((string) ($parts['query'] ?? ''), $query);
    if (($query['r'] ?? '') !== '/settings/teams/callback' || count($query) !== 1) {
        return false;
    }
    $host = strtolower((string) ($parts['host'] ?? ''));
    if ($host === '' || !preg_match('/^[a-z0-9.-]+$/', $host)) {
        return false;
    }
    $scheme = $parts['scheme'] ?? '';
    if ($scheme === 'https') {
        return true;
    }
    return $scheme === 'http' && ($host === 'localhost' || $host === '127.0.0.1');
}

function teams_settings_public(PDO $pdo): array
{
    ensure_settings_table($pdo);
    $method = teams_notify_method($pdo);
    $graphReady = teams_graph_can_post($pdo);

    return [
        'method' => $method,
        'configured' => $method === 'graph' ? $graphReady : teams_webhook_url($pdo) !== '',
        'webhookConfigured' => teams_webhook_url($pdo) !== '',
        'graph' => [
            'appConfigured' => teams_graph_app_ready($pdo),
            'tenantId' => teams_graph_guid(setting_get($pdo, TEAMS_GRAPH_KEYS['tenant'])),
            'clientId' => teams_graph_guid(setting_get($pdo, TEAMS_GRAPH_KEYS['client'])),
            'secretConfigured' => setting_get($pdo, TEAMS_GRAPH_KEYS['secret']) !== '',
            'connected' => setting_get($pdo, TEAMS_GRAPH_KEYS['refresh']) !== '',
            'account' => setting_get($pdo, TEAMS_GRAPH_KEYS['account']),
            'teamId' => teams_graph_guid(setting_get($pdo, TEAMS_GRAPH_KEYS['team'])),
            'teamName' => setting_get($pdo, TEAMS_GRAPH_KEYS['team_name']),
            'channelId' => teams_graph_channel_id(setting_get($pdo, TEAMS_GRAPH_KEYS['channel']), false),
            'channelName' => setting_get($pdo, TEAMS_GRAPH_KEYS['channel_name']),
            'ready' => $graphReady,
            'redirectUri' => teams_graph_redirect_uri(),
        ],
    ];
}

function teams_settings_json(PDO $pdo): never
{
    $payload = teams_settings_public($pdo);
    $payload['csrf'] = $_SESSION['csrf'];
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function save_teams_method(PDO $pdo, array $input): void
{
    require_admin($pdo);
    $method = (string) ($input['method'] ?? '');
    if ($method !== 'webhook' && $method !== 'graph') {
        json_error(422, 'Choose a webhook or Microsoft Graph.');
    }
    setting_put($pdo, TEAMS_GRAPH_KEYS['method'], $method);
}

function save_teams_graph_app(PDO $pdo, array $input): void
{
    require_admin($pdo);
    $tenant = teams_graph_guid((string) ($input['tenantId'] ?? ''));
    $client = teams_graph_guid((string) ($input['clientId'] ?? ''));
    if ($tenant === '' || $client === '') {
        json_error(422, 'Enter the Directory (tenant) ID and Application (client) ID from the Azure app.');
    }

    $secret = trim((string) ($input['clientSecret'] ?? ''));
    $existingSecret = setting_get($pdo, TEAMS_GRAPH_KEYS['secret']);
    if ($secret === '') {
        $secret = $existingSecret;
    }
    if ($secret === '') {
        json_error(422, 'Enter the client secret from the Azure app.');
    }
    if (strlen($secret) > 500) {
        json_error(422, 'That client secret is too long.');
    }

    $previousTenant = teams_graph_guid(setting_get($pdo, TEAMS_GRAPH_KEYS['tenant']));
    $previousClient = teams_graph_guid(setting_get($pdo, TEAMS_GRAPH_KEYS['client']));
    if ($previousTenant !== $tenant || $previousClient !== $client) {
        teams_graph_clear_connection($pdo);
    }

    setting_put($pdo, TEAMS_GRAPH_KEYS['tenant'], $tenant);
    setting_put($pdo, TEAMS_GRAPH_KEYS['client'], $client);
    setting_put($pdo, TEAMS_GRAPH_KEYS['secret'], $secret);
}

function teams_graph_clear_connection(PDO $pdo): void
{
    foreach (['refresh', 'access', 'expires', 'account', 'team', 'team_name', 'channel', 'channel_name'] as $name) {
        setting_delete($pdo, TEAMS_GRAPH_KEYS[$name]);
    }
    unset($_SESSION['teams_oauth_state'], $_SESSION['teams_oauth_started'], $_SESSION['teams_oauth_redirect']);
}

function teams_graph_connect_url(PDO $pdo): string
{
    require_admin($pdo);
    if (!teams_graph_app_ready($pdo)) {
        json_error(422, 'Save the Azure app before connecting a Microsoft account.');
    }

    $redirect = teams_graph_redirect_uri();
    $state = bin2hex(random_bytes(16));
    $_SESSION['teams_oauth_state'] = $state;
    $_SESSION['teams_oauth_started'] = time();
    $_SESSION['teams_oauth_redirect'] = $redirect;

    $query = http_build_query([
        'client_id' => setting_get($pdo, TEAMS_GRAPH_KEYS['client']),
        'response_type' => 'code',
        'redirect_uri' => $redirect,
        'response_mode' => 'query',
        'scope' => TEAMS_GRAPH_SCOPE,
        'state' => $state,
        'prompt' => 'select_account',
    ], '', '&', PHP_QUERY_RFC3986);

    $tenant = setting_get($pdo, TEAMS_GRAPH_KEYS['tenant']);
    return 'https://login.microsoftonline.com/' . rawurlencode($tenant) . '/oauth2/v2.0/authorize?' . $query;
}

function teams_graph_browser_redirect(string $code): never
{
    if ($code !== 'connected' && $code !== 'denied' && $code !== 'failed') {
        $code = 'failed';
    }
    header('Cache-Control: no-store');
    header('Location: /?view=setup&teams=' . $code, true, 302);
    exit;
}

function teams_graph_finish_connect(PDO $pdo, array $query): never
{
    $user = current_user($pdo);
    if (!$user || $user['role'] !== 'admin') {
        teams_graph_browser_redirect('failed');
    }

    $expected = $_SESSION['teams_oauth_state'] ?? '';
    $started = (int) ($_SESSION['teams_oauth_started'] ?? 0);
    $redirect = $_SESSION['teams_oauth_redirect'] ?? '';
    unset($_SESSION['teams_oauth_state'], $_SESSION['teams_oauth_started'], $_SESSION['teams_oauth_redirect']);

    $state = (string) ($query['state'] ?? '');
    $fresh = $started > 0 && (time() - $started) <= 900;
    if (!$fresh || !is_string($expected) || $expected === '' || !hash_equals($expected, $state)) {
        teams_graph_browser_redirect('failed');
    }
    if (!is_string($redirect) || !teams_graph_redirect_is_ours($redirect)) {
        teams_graph_browser_redirect('failed');
    }

    $error = (string) ($query['error'] ?? '');
    if ($error === 'access_denied') {
        teams_graph_browser_redirect('denied');
    }
    if ($error !== '') {
        error_log('DBPA tracker Teams sign-in: ' . substr($error, 0, 80));
        teams_graph_browser_redirect('failed');
    }

    $code = (string) ($query['code'] ?? '');
    if ($code === '' || strlen($code) > 2000 || !teams_graph_app_ready($pdo)) {
        teams_graph_browser_redirect('failed');
    }

    $token = teams_graph_token_request($pdo, [
        'grant_type' => 'authorization_code',
        'code' => $code,
        'redirect_uri' => $redirect,
        'scope' => TEAMS_GRAPH_SCOPE,
    ]);
    if ($token === null) {
        teams_graph_browser_redirect('failed');
    }

    teams_graph_store_token($pdo, $token);
    $account = teams_graph_load_account($pdo);
    if ($account === '') {
        teams_graph_clear_connection($pdo);
        teams_graph_browser_redirect('failed');
    }
    setting_put($pdo, TEAMS_GRAPH_KEYS['account'], $account);
    teams_graph_browser_redirect('connected');
}

function teams_graph_disconnect(PDO $pdo): void
{
    require_admin($pdo);
    teams_graph_clear_connection($pdo);
}

/**
 * @param array<string, string> $fields
 * @return array<string, mixed>|null
 */
function teams_graph_token_request(PDO $pdo, array $fields): ?array
{
    $fields['client_id'] = setting_get($pdo, TEAMS_GRAPH_KEYS['client']);
    $fields['client_secret'] = setting_get($pdo, TEAMS_GRAPH_KEYS['secret']);
    $tenant = setting_get($pdo, TEAMS_GRAPH_KEYS['tenant']);
    $url = 'https://login.microsoftonline.com/' . rawurlencode($tenant) . '/oauth2/v2.0/token';
    $response = teams_graph_curl('POST', $url, null, http_build_query($fields, '', '&', PHP_QUERY_RFC3986));
    $json = $response['json'];
    if ($response['status'] < 200 || $response['status'] >= 300 || !is_array($json) || !is_string($json['access_token'] ?? null)) {
        $errorCode = is_array($json) ? (string) ($json['error'] ?? '') : '';
        error_log('DBPA tracker Teams token: HTTP ' . $response['status'] . ' ' . substr($errorCode, 0, 80));
        if ($errorCode === 'invalid_grant') {
            teams_graph_clear_connection($pdo);
        }
        return null;
    }
    return $json;
}

/**
 * @param array<string, mixed> $token
 */
function teams_graph_store_token(PDO $pdo, array $token): void
{
    $expiresIn = (int) ($token['expires_in'] ?? 3600);
    if ($expiresIn < 60) {
        $expiresIn = 60;
    }
    setting_put($pdo, TEAMS_GRAPH_KEYS['access'], (string) $token['access_token']);
    setting_put($pdo, TEAMS_GRAPH_KEYS['expires'], (string) (time() + $expiresIn - 120));
    if (is_string($token['refresh_token'] ?? null) && $token['refresh_token'] !== '') {
        setting_put($pdo, TEAMS_GRAPH_KEYS['refresh'], $token['refresh_token']);
    }
}

function teams_graph_access_token(PDO $pdo): ?string
{
    $refresh = setting_get($pdo, TEAMS_GRAPH_KEYS['refresh']);
    if ($refresh === '' || !teams_graph_app_ready($pdo)) {
        return null;
    }

    $cached = setting_get($pdo, TEAMS_GRAPH_KEYS['access']);
    $expires = (int) setting_get($pdo, TEAMS_GRAPH_KEYS['expires']);
    if ($cached !== '' && $expires > time()) {
        return $cached;
    }

    $token = teams_graph_token_request($pdo, [
        'grant_type' => 'refresh_token',
        'refresh_token' => $refresh,
        'scope' => TEAMS_GRAPH_SCOPE,
    ]);
    if ($token === null) {
        return null;
    }
    teams_graph_store_token($pdo, $token);
    return (string) $token['access_token'];
}

function teams_graph_load_account(PDO $pdo): string
{
    $response = teams_graph_api($pdo, 'GET', 'https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName');
    if ($response === null || $response['status'] < 200 || $response['status'] >= 300) {
        return '';
    }
    $json = $response['json'];
    $mail = is_array($json) ? trim((string) ($json['mail'] ?? '')) : '';
    if ($mail === '' && is_array($json)) {
        $mail = trim((string) ($json['userPrincipalName'] ?? ''));
    }
    $name = is_array($json) ? trim((string) ($json['displayName'] ?? '')) : '';
    $label = $name !== '' && $mail !== '' ? $name . ' · ' . $mail : ($mail !== '' ? $mail : $name);
    if (text_length($label) > 180) {
        $label = function_exists('mb_substr') ? mb_substr($label, 0, 180) : substr($label, 0, 180);
    }
    return $label;
}

function teams_graph_teams(PDO $pdo): array
{
    require_admin($pdo);
    teams_graph_require_connection($pdo);
    $rows = teams_graph_collect($pdo, 'https://graph.microsoft.com/v1.0/me/joinedTeams?$select=id,displayName');
    $teams = [];
    foreach ($rows as $row) {
        $id = teams_graph_guid((string) ($row['id'] ?? ''));
        $name = trim((string) ($row['displayName'] ?? ''));
        if ($id === '' || $name === '') {
            continue;
        }
        $teams[] = ['id' => $id, 'name' => $name];
    }
    usort($teams, static fn (array $a, array $b): int => strcasecmp($a['name'], $b['name']));
    return $teams;
}

function teams_graph_channels(PDO $pdo, string $teamId): array
{
    require_admin($pdo);
    teams_graph_require_connection($pdo);
    $teamId = teams_graph_guid($teamId);
    if ($teamId === '') {
        json_error(422, 'Choose a team.');
    }
    $known = false;
    foreach (teams_graph_teams($pdo) as $team) {
        if ($team['id'] === $teamId) {
            $known = true;
            break;
        }
    }
    if (!$known) {
        json_error(422, 'That team is not available to the connected account.');
    }

    $url = 'https://graph.microsoft.com/v1.0/teams/' . rawurlencode($teamId) . '/channels?$select=id,displayName';
    $rows = teams_graph_collect($pdo, $url);
    $channels = [];
    foreach ($rows as $row) {
        $id = teams_graph_channel_id((string) ($row['id'] ?? ''), false);
        $name = trim((string) ($row['displayName'] ?? ''));
        if ($id === '' || $name === '') {
            continue;
        }
        $channels[] = ['id' => $id, 'name' => $name];
    }
    usort($channels, static fn (array $a, array $b): int => strcasecmp($a['name'], $b['name']));
    return $channels;
}

function save_teams_graph_target(PDO $pdo, array $input): void
{
    require_admin($pdo);
    teams_graph_require_connection($pdo);
    $teamId = teams_graph_guid((string) ($input['teamId'] ?? ''));
    $channelId = teams_graph_channel_id((string) ($input['channelId'] ?? ''), true);
    if ($teamId === '') {
        json_error(422, 'Choose a team.');
    }

    $teamName = '';
    foreach (teams_graph_teams($pdo) as $team) {
        if ($team['id'] === $teamId) {
            $teamName = $team['name'];
            break;
        }
    }
    if ($teamName === '') {
        json_error(422, 'That team is not available to the connected account.');
    }

    $channelName = '';
    foreach (teams_graph_channels($pdo, $teamId) as $channel) {
        if ($channel['id'] === $channelId) {
            $channelName = $channel['name'];
            break;
        }
    }
    if ($channelName === '') {
        json_error(422, 'That channel is not available to the connected account.');
    }

    setting_put($pdo, TEAMS_GRAPH_KEYS['team'], $teamId);
    setting_put($pdo, TEAMS_GRAPH_KEYS['team_name'], $teamName);
    setting_put($pdo, TEAMS_GRAPH_KEYS['channel'], $channelId);
    setting_put($pdo, TEAMS_GRAPH_KEYS['channel_name'], $channelName);
}

function teams_graph_require_connection(PDO $pdo): void
{
    if (teams_graph_access_token($pdo) === null) {
        json_error(422, 'Connect a Microsoft account first.');
    }
}

/**
 * @return list<array<string, mixed>>
 */
function teams_graph_collect(PDO $pdo, string $url): array
{
    $items = [];
    for ($guard = 0; $guard < 8 && $url !== '' && count($items) < 200; $guard++) {
        if (!str_starts_with($url, 'https://graph.microsoft.com/')) {
            json_error(502, 'Microsoft Graph returned an unexpected address.');
        }
        $response = teams_graph_api($pdo, 'GET', $url);
        if ($response === null || $response['status'] < 200 || $response['status'] >= 300 || !is_array($response['json'])) {
            json_error(502, 'Microsoft Graph did not return that list. Check the app permissions and admin consent.');
        }
        $value = $response['json']['value'] ?? [];
        if (is_array($value)) {
            foreach ($value as $row) {
                if (is_array($row)) {
                    $items[] = $row;
                }
                if (count($items) >= 200) {
                    break;
                }
            }
        }
        $next = $response['json']['@odata.nextLink'] ?? '';
        $url = is_string($next) ? $next : '';
    }
    return $items;
}

/**
 * Returns null when Graph is selected but not finished.
 * Returns a short warning when a finished connection fails to post.
 */
function teams_graph_notify(PDO $pdo, array $project, array $user): ?string
{
    if (!teams_graph_can_post($pdo)) {
        return null;
    }

    $token = teams_graph_access_token($pdo);
    if ($token === null) {
        error_log('DBPA tracker Teams: Microsoft Graph token could not be refreshed.');
        return 'Teams was not notified.';
    }

    $teamId = setting_get($pdo, TEAMS_GRAPH_KEYS['team']);
    $channelId = setting_get($pdo, TEAMS_GRAPH_KEYS['channel']);
    $url = 'https://graph.microsoft.com/v1.0/teams/' . rawurlencode($teamId)
        . '/channels/' . rawurlencode($channelId) . '/messages';
    $response = teams_graph_api($pdo, 'POST', $url, teams_graph_project_message($project, $user));
    if ($response === null || $response['status'] < 200 || $response['status'] >= 300) {
        $status = $response['status'] ?? 0;
        error_log('DBPA tracker Teams Graph post failed: HTTP ' . $status);
        return 'Teams was not notified.';
    }
    return null;
}

function teams_graph_project_message(array $project, array $user): array
{
    $by = $user['name'] !== '' ? $user['name'] : $user['email'];
    $lines = [
        '<b>New project: ' . teams_graph_html((string) $project['number']) . '</b>',
        teams_graph_html((string) $project['name']),
        'Owner: ' . teams_graph_html($project['owner'] !== '' ? (string) $project['owner'] : 'Unassigned'),
        'Status: ' . teams_graph_html($project['status'] !== '' ? (string) $project['status'] : '—'),
        'Due: ' . teams_graph_html($project['due'] !== '' ? (string) $project['due'] : '—'),
        'Added by: ' . teams_graph_html((string) $by),
    ];

    return [
        'body' => [
            'contentType' => 'html',
            'content' => implode('<br>', $lines),
        ],
    ];
}

function teams_graph_html(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * @return array{status: int, json: mixed}|null
 */
function teams_graph_api(PDO $pdo, string $method, string $url, ?array $json = null): ?array
{
    $token = teams_graph_access_token($pdo);
    if ($token === null) {
        return null;
    }
    $body = $json === null ? null : json_encode($json, JSON_UNESCAPED_UNICODE);
    if ($json !== null && $body === false) {
        return null;
    }
    $response = teams_graph_curl($method, $url, $token, $body);
    if ($response['status'] !== 401) {
        return $response;
    }

    setting_delete($pdo, TEAMS_GRAPH_KEYS['access']);
    setting_delete($pdo, TEAMS_GRAPH_KEYS['expires']);
    $token = teams_graph_access_token($pdo);
    if ($token === null) {
        return $response;
    }
    return teams_graph_curl($method, $url, $token, $body);
}

/**
 * @return array{status: int, json: mixed}
 */
function teams_graph_curl(string $method, string $url, ?string $token, ?string $body): array
{
    $parts = parse_url($url);
    $host = strtolower((string) ($parts['host'] ?? ''));
    $allowed = $host === 'graph.microsoft.com' || $host === 'login.microsoftonline.com';
    if (!$allowed || ($parts['scheme'] ?? '') !== 'https' || !function_exists('curl_init')) {
        return ['status' => 0, 'json' => null];
    }

    $ch = curl_init($url);
    if ($ch === false) {
        return ['status' => 0, 'json' => null];
    }

    $headers = ['Accept: application/json'];
    if ($token !== null) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    if ($body !== null && $token !== null) {
        $headers[] = 'Content-Type: application/json';
    }
    if ($body !== null && $token === null) {
        $headers[] = 'Content-Type: application/x-www-form-urlencoded';
    }

    $options = [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
    ];
    if ($body !== null) {
        $options[CURLOPT_POSTFIELDS] = $body;
    }
    curl_setopt_array($ch, $options);

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($raw === false) {
        error_log('DBPA tracker Teams transport: ' . curl_error($ch));
        curl_close($ch);
        return ['status' => 0, 'json' => null];
    }
    curl_close($ch);

    return ['status' => $status, 'json' => json_decode($raw, true)];
}
