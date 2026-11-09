<?php

declare(strict_types=1);

const ISSUANCE_TYPES = ['Draft', 'For Information', 'For Tender', 'For Construction', 'As-Built'];

const FIELD_COLUMNS = [
    'owner' => 'owner',
    'category' => 'category',
    'program' => 'program',
    'stage' => 'stage',
    'status' => 'status',
    'engineer' => 'engineer',
    'priority' => 'priority',
];

function json_error(int $status, string $message): never
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function text_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

    ini_set('session.use_strict_mode', '1');
    ini_set('session.gc_maxlifetime', (string) (60 * 60 * 24 * 14));
    session_name('DBPASESSID');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 14,
        'path' => '/',
        'secure' => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();

    if (!isset($_SESSION['csrf']) || !is_string($_SESSION['csrf']) || $_SESSION['csrf'] === '') {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $path = __DIR__ . '/config.php';
    if (!is_file($path)) {
        json_error(500, 'Database is not configured. Copy api/config.example.php to api/config.php and add the Hostinger MySQL details.');
    }

    $config = require $path;
    if (!is_array($config) || !is_array($config['db'] ?? null)) {
        json_error(500, 'api/config.php is missing the db settings.');
    }

    $GLOBALS['dbpa_debug'] = !empty($config['debug']);
    $c = $config['db'];
    $host = (string) ($c['host'] ?? 'localhost');
    $port = (int) ($c['port'] ?? 3306);
    $name = (string) ($c['name'] ?? '');
    $user = (string) ($c['user'] ?? '');
    $pass = (string) ($c['pass'] ?? '');

    if ($name === '' || $user === '') {
        json_error(500, 'api/config.php needs a database name and user.');
    }

    try {
        $pdo = new PDO(
            "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
            $user,
            $pass,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
        $pdo->query('SELECT 1 FROM users LIMIT 1');
    } catch (PDOException $e) {
        error_log('DBPA tracker database: ' . $e->getMessage());
        $missingTable = str_contains($e->getMessage(), 'users');
        json_error(
            500,
            $missingTable
                ? 'The tracker tables are missing. In phpMyAdmin, select the database and import database/schema.sql.'
                : 'Could not connect to MySQL. Check the database name, user, and password in api/config.php.'
        );
    }

    return $pdo;
}

function body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_error(400, 'Invalid JSON.');
    }
    return $data;
}

function clean_line(mixed $value, int $max): string
{
    $text = trim((string) $value);
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
    if (text_length($text) > $max) {
        json_error(422, 'One of the fields is too long.');
    }
    return $text;
}

function person_name(mixed $value): string
{
    $name = clean_line($value, 80);
    if ($name === '') {
        json_error(422, 'Enter a name.');
    }
    if (preg_match('/[<>]/', $name)) {
        json_error(422, 'Name contains characters that are not allowed.');
    }
    return $name;
}

function email_address(mixed $value): string
{
    $email = strtolower(trim((string) $value));
    if (text_length($email) > 190 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        json_error(422, 'Enter a valid email address.');
    }
    return $email;
}

function password_value(mixed $value): string
{
    $password = (string) $value;
    $length = text_length($password);
    if ($length < 8) {
        json_error(422, 'Use a password of at least 8 characters.');
    }
    if ($length > 200) {
        json_error(422, 'That password is too long.');
    }
    return $password;
}

function date_or_empty(mixed $value, string $label): string
{
    $date = trim((string) $value);
    if ($date === '') {
        return '';
    }
    $parsed = DateTime::createFromFormat('!Y-m-d', $date);
    $errors = DateTime::getLastErrors();
    if (!$parsed || $parsed->format('Y-m-d') !== $date || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
        json_error(422, $label . ' must be a valid date.');
    }
    return $date;
}

function current_user(PDO $pdo): ?array
{
    $id = $_SESSION['user_id'] ?? null;
    if (!is_int($id) && !(is_string($id) && ctype_digit($id))) {
        return null;
    }

    $stmt = $pdo->prepare('SELECT id, name, email, role FROM users WHERE id = ?');
    $stmt->execute([(int) $id]);
    $row = $stmt->fetch();
    if (!$row) {
        unset($_SESSION['user_id']);
        return null;
    }

    return [
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'role' => $row['role'],
    ];
}

function require_user(PDO $pdo): array
{
    $user = current_user($pdo);
    if (!$user) {
        json_error(401, 'Sign in to continue.');
    }
    return $user;
}

function require_admin(PDO $pdo): array
{
    $user = require_user($pdo);
    if ($user['role'] !== 'admin') {
        json_error(403, 'An administrator needs to do that.');
    }
    return $user;
}

function login_session(int $id): void
{
    session_regenerate_id(true);
    $_SESSION['user_id'] = $id;
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
