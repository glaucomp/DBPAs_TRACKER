<?php

declare(strict_types=1);

ini_set('display_errors', '0');

require __DIR__ . '/bootstrap.php';
require __DIR__ . '/repository.php';
require __DIR__ . '/teams.php';
require __DIR__ . '/teams_graph.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    dispatch();
} catch (Throwable $e) {
    error_log('DBPA tracker: ' . $e->getMessage());
    if (!headers_sent()) {
        http_response_code(500);
    }
    $message = 'Something went wrong. Please try again.';
    if (!empty($GLOBALS['dbpa_debug'])) {
        $message .= ' ' . $e->getMessage();
    }
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
}

function dispatch(): void
{
    start_session();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $route = $_GET['r'] ?? '/';
    if (!is_string($route)) {
        json_error(400, 'Invalid route.');
    }
    $path = '/' . trim($route, '/');

    if ($method === 'GET' && ($path === '/' || $path === '/health')) {
        health();
        return;
    }

    if ($method !== 'GET' && $method !== 'HEAD') {
        $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        $known = $_SESSION['csrf'] ?? '';
        if (!is_string($sent) || !is_string($known) || $known === '' || !hash_equals($known, $sent)) {
            json_error(419, 'Your session expired. Reload the page and try again.');
        }
    }

    $pdo = db();

    if ($method === 'GET' && $path === '/session') {
        $count = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
        echo json_encode([
            'installed' => $count > 0,
            'user' => current_user($pdo),
            'csrf' => $_SESSION['csrf'],
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    if ($method === 'POST' && $path === '/install') {
        install_admin($pdo, body());
        respond($pdo);
    }

    if ($method === 'POST' && $path === '/login') {
        sign_in($pdo, body());
        respond($pdo);
    }

    if ($method === 'POST' && $path === '/logout') {
        sign_out();
    }

    if ($method === 'GET' && $path === '/state') {
        respond($pdo);
    }

    if ($method === 'POST' && $path === '/projects') {
        $input = body();
        $teamsWarning = save_project($pdo, $input, null, !empty($input['issuedOnly']));
        $extra = $teamsWarning !== null ? ['teamsWarning' => $teamsWarning] : [];
        respond($pdo, $extra);
    }

    if ($method === 'PUT' && preg_match('#^/projects/(\d+)$#', $path, $matches)) {
        save_project($pdo, body(), (int) $matches[1], false);
        respond($pdo);
    }

    if ($method === 'DELETE' && preg_match('#^/projects/(\d+)$#', $path, $matches)) {
        delete_project($pdo, (int) $matches[1]);
        respond($pdo);
    }

    if ($method === 'PATCH' && preg_match('#^/issuances/(\d+)$#', $path, $matches)) {
        update_issue_date($pdo, (int) $matches[1], body());
        respond($pdo);
    }

    if ($method === 'POST' && $path === '/options') {
        add_option($pdo, body());
        respond($pdo);
    }

    if ($method === 'PUT' && preg_match('#^/options/(\d+)$#', $path, $matches)) {
        rename_option($pdo, (int) $matches[1], body());
        respond($pdo);
    }

    if ($method === 'DELETE' && preg_match('#^/options/(\d+)$#', $path, $matches)) {
        delete_option($pdo, (int) $matches[1]);
        respond($pdo);
    }

    if ($method === 'GET' && $path === '/settings/teams/callback') {
        try {
            teams_graph_finish_connect($pdo, $_GET);
        } catch (Throwable $e) {
            error_log('DBPA tracker Teams sign-in: ' . $e->getMessage());
            teams_graph_browser_redirect('failed');
        }
    }

    if ($method === 'GET' && $path === '/settings/teams') {
        require_admin($pdo);
        teams_settings_json($pdo);
    }

    if ($method === 'PUT' && $path === '/settings/teams') {
        save_teams_webhook($pdo, body());
        teams_settings_json($pdo);
    }

    if ($method === 'PUT' && $path === '/settings/teams/method') {
        save_teams_method($pdo, body());
        teams_settings_json($pdo);
    }

    if ($method === 'PUT' && $path === '/settings/teams/graph') {
        save_teams_graph_app($pdo, body());
        teams_settings_json($pdo);
    }

    if ($method === 'POST' && $path === '/settings/teams/graph/connect') {
        echo json_encode([
            'authorizeUrl' => teams_graph_connect_url($pdo),
            'csrf' => $_SESSION['csrf'],
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    if ($method === 'POST' && $path === '/settings/teams/graph/disconnect') {
        teams_graph_disconnect($pdo);
        teams_settings_json($pdo);
    }

    if ($method === 'GET' && $path === '/settings/teams/graph/teams') {
        require_admin($pdo);
        echo json_encode([
            'teams' => teams_graph_teams($pdo),
            'csrf' => $_SESSION['csrf'],
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    if ($method === 'GET' && preg_match('#^/settings/teams/graph/channels/([0-9a-fA-F-]{36})$#', $path, $matches)) {
        require_admin($pdo);
        echo json_encode([
            'channels' => teams_graph_channels($pdo, $matches[1]),
            'csrf' => $_SESSION['csrf'],
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    if ($method === 'PUT' && $path === '/settings/teams/graph/target') {
        save_teams_graph_target($pdo, body());
        teams_settings_json($pdo);
    }

    if ($method === 'GET' && $path === '/users') {
        echo json_encode([
            'users' => list_users($pdo),
            'csrf' => $_SESSION['csrf'],
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    if ($method === 'POST' && $path === '/users') {
        create_user($pdo, body());
        echo json_encode([
            'users' => list_users($pdo),
            'csrf' => $_SESSION['csrf'],
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    if ($method === 'DELETE' && preg_match('#^/users/(\d+)$#', $path, $matches)) {
        delete_user($pdo, (int) $matches[1], require_admin($pdo));
        echo json_encode([
            'users' => list_users($pdo),
            'csrf' => $_SESSION['csrf'],
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    if ($method === 'POST' && $path === '/password') {
        $user = require_user($pdo);
        change_password($pdo, $user, body());
        echo json_encode(['ok' => true, 'csrf' => $_SESSION['csrf'], 'user' => $user], JSON_UNESCAPED_UNICODE);
        return;
    }

    if ($method === 'POST' && $path === '/sample') {
        load_sample($pdo);
        respond($pdo);
    }

    json_error(404, 'Unknown request.');
}

function health(): never
{
    try {
        $pdo = db();
        $pdo->query('SELECT 1');
        echo json_encode(['ok' => true, 'service' => 'dbpa-tracker', 'database' => true]);
    } catch (Throwable $e) {
        if (!headers_sent()) {
            http_response_code(500);
        }
        echo json_encode(['ok' => false, 'service' => 'dbpa-tracker', 'database' => false]);
    }
    exit;
}

function install_admin(PDO $pdo, array $input): void
{
    $count = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    if ($count > 0) {
        json_error(403, 'An administrator already exists. Sign in instead.');
    }
    if (($input['confirm'] ?? null) !== ($input['password'] ?? null)) {
        json_error(422, 'The passwords do not match.');
    }

    $pdo->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)')->execute([
        person_name($input['name'] ?? ''),
        email_address($input['email'] ?? ''),
        password_hash(password_value($input['password'] ?? ''), PASSWORD_DEFAULT),
        'admin',
    ]);
    login_session((int) $pdo->lastInsertId());
}

function sign_in(PDO $pdo, array $input): void
{
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $password = (string) ($input['password'] ?? '');
    $stmt = $pdo->prepare('SELECT id, password_hash FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    if (!$row || !password_verify($password, $row['password_hash'])) {
        json_error(401, 'Email or password is incorrect.');
    }
    login_session((int) $row['id']);
}

function sign_out(): never
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'],
            'domain' => $params['domain'],
            'secure' => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => 'Lax',
        ]);
    }
    session_destroy();
    start_session();
    echo json_encode([
        'ok' => true,
        'user' => null,
        'csrf' => $_SESSION['csrf'],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
