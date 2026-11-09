<?php

declare(strict_types=1);

function load_options(PDO $pdo): array
{
    $grouped = [];
    foreach (array_keys(FIELD_COLUMNS) as $key) {
        $grouped[$key] = [];
    }

    $rows = $pdo->query('SELECT id, field_key, label FROM options ORDER BY field_key, sort_order, id')->fetchAll();
    foreach ($rows as $row) {
        if (!isset($grouped[$row['field_key']])) {
            continue;
        }
        $grouped[$row['field_key']][] = [
            'id' => (int) $row['id'],
            'label' => $row['label'],
        ];
    }

    return $grouped;
}

function map_project(array $row, array $issuances): array
{
    return [
        'id' => (int) $row['id'],
        'number' => $row['number'],
        'strata' => $row['strata'],
        'name' => $row['name'],
        'owner' => $row['owner'],
        'category' => $row['category'],
        'program' => $row['program'],
        'stage' => $row['stage'],
        'status' => $row['status'],
        'start' => $row['start_date'] ?? '',
        'review' => $row['review'],
        'due' => $row['due_date'] ?? '',
        'engineer' => $row['engineer'],
        'priority' => $row['priority'],
        'issuedAs' => $row['issued_as'],
        'revision' => $row['revision'],
        'issueDate' => $row['issue_date'] ?? '',
        'notes' => $row['notes'] ?? '',
        'issuedOnly' => (int) $row['issued_only'] === 1,
        'issuances' => $issuances,
    ];
}

function load_projects(PDO $pdo): array
{
    $projects = $pdo->query('SELECT * FROM projects ORDER BY number')->fetchAll();
    $issuanceRows = $pdo->query('SELECT * FROM issuances ORDER BY project_id, sort_order, id')->fetchAll();
    $byProject = [];

    foreach ($issuanceRows as $row) {
        $byProject[(int) $row['project_id']][] = [
            'id' => (int) $row['id'],
            'issuedAs' => $row['issued_as'],
            'revision' => $row['revision'],
            'issueDate' => $row['issue_date'] ?? '',
        ];
    }

    return array_map(
        fn (array $row): array => map_project($row, $byProject[(int) $row['id']] ?? []),
        $projects
    );
}

function find_project(PDO $pdo, int $id): ?array
{
    foreach (load_projects($pdo) as $project) {
        if ($project['id'] === $id) {
            return $project;
        }
    }
    return null;
}

function state_payload(PDO $pdo, array $user): array
{
    return [
        'user' => $user,
        'csrf' => $_SESSION['csrf'],
        'projects' => load_projects($pdo),
        'options' => load_options($pdo),
    ];
}

function respond(PDO $pdo): never
{
    echo json_encode(state_payload($pdo, require_user($pdo)), JSON_UNESCAPED_UNICODE);
    exit;
}

function record_issuance(array $project, array $history): array
{
    if (!in_array($project['issuedAs'], ISSUANCE_TYPES, true)) {
        return $history;
    }

    $entry = [
        'issuedAs' => $project['issuedAs'],
        'revision' => $project['revision'],
        'issueDate' => $project['issueDate'],
    ];
    $latest = $history === [] ? null : $history[count($history) - 1];
    if ($latest && $latest['issuedAs'] === $entry['issuedAs'] && $latest['revision'] === $entry['revision']) {
        $history[count($history) - 1] = $entry;
        return $history;
    }

    $history[] = $entry;
    return $history;
}

function normalize_project(array $input, bool $issuedRequired): array
{
    $number = strtoupper(clean_line($input['number'] ?? '', 40));
    $name = clean_line($input['name'] ?? '', 255);
    if ($number === '' || $name === '') {
        json_error(422, 'Enter a project number and address.');
    }
    if (preg_match('/[\x00-\x1F]/', $number . $name)) {
        json_error(422, 'Enter a project number and address.');
    }

    $notes = trim((string) ($input['notes'] ?? ''));
    $notes = preg_replace("/\r\n?/", "\n", $notes) ?? $notes;
    if (text_length($notes) > 5000) {
        json_error(422, 'Notes are too long.');
    }

    $issuedAs = clean_line($input['issuedAs'] ?? '', 80);
    if ($issuedAs !== '' && !in_array($issuedAs, ISSUANCE_TYPES, true)) {
        json_error(422, 'Choose a valid issuance type.');
    }
    if ($issuedRequired && $issuedAs === '') {
        json_error(422, 'Choose how this project was issued.');
    }

    return [
        'number' => $number,
        'strata' => clean_line($input['strata'] ?? '', 120),
        'name' => $name,
        'owner' => clean_line($input['owner'] ?? '', 100),
        'category' => clean_line($input['category'] ?? '', 100),
        'program' => clean_line($input['program'] ?? '', 100),
        'stage' => clean_line($input['stage'] ?? '', 100),
        'status' => clean_line($input['status'] ?? '', 100),
        'start' => date_or_empty($input['start'] ?? '', 'Start date'),
        'review' => clean_line($input['review'] ?? '', 255),
        'due' => date_or_empty($input['due'] ?? '', 'Due date'),
        'engineer' => clean_line($input['engineer'] ?? '', 100),
        'priority' => clean_line($input['priority'] ?? '', 40),
        'issuedAs' => $issuedAs,
        'revision' => clean_line($input['revision'] ?? '', 40),
        'issueDate' => date_or_empty($input['issueDate'] ?? '', 'Issue date'),
        'notes' => $notes,
    ];
}

function assert_unique_number(PDO $pdo, string $number, int $ignoreId): void
{
    $stmt = $pdo->prepare('SELECT id FROM projects WHERE number = ? AND id <> ?');
    $stmt->execute([$number, $ignoreId]);
    if ($stmt->fetch()) {
        json_error(422, 'This project number already exists.');
    }
}

function write_project(PDO $pdo, array $project, array $history, int $issuedOnly, ?int $id): int
{
    $values = [
        $project['number'],
        $project['strata'],
        $project['name'],
        $project['owner'],
        $project['category'],
        $project['program'],
        $project['stage'],
        $project['status'],
        $project['start'] !== '' ? $project['start'] : null,
        $project['review'],
        $project['due'] !== '' ? $project['due'] : null,
        $project['engineer'],
        $project['priority'],
        $project['issuedAs'],
        $project['revision'],
        $project['issueDate'] !== '' ? $project['issueDate'] : null,
        $project['notes'] !== '' ? $project['notes'] : null,
        $issuedOnly,
    ];

    try {
        $pdo->beginTransaction();
        if ($id === null) {
            $stmt = $pdo->prepare(
                'INSERT INTO projects
                  (number, strata, name, owner, category, program, stage, status, start_date, review, due_date, engineer, priority, issued_as, revision, issue_date, notes, issued_only)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
            );
            $stmt->execute($values);
            $id = (int) $pdo->lastInsertId();
        } else {
            $stmt = $pdo->prepare(
                'UPDATE projects SET
                  number = ?, strata = ?, name = ?, owner = ?, category = ?, program = ?, stage = ?, status = ?,
                  start_date = ?, review = ?, due_date = ?, engineer = ?, priority = ?, issued_as = ?, revision = ?,
                  issue_date = ?, notes = ?, issued_only = ?
                 WHERE id = ?'
            );
            $values[] = $id;
            $stmt->execute($values);
        }
        replace_issuances($pdo, $id, $history);
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
            json_error(422, 'This project number already exists.');
        }
        throw $e;
    }

    return $id;
}

function replace_issuances(PDO $pdo, int $projectId, array $history): void
{
    $pdo->prepare('DELETE FROM issuances WHERE project_id = ?')->execute([$projectId]);
    $stmt = $pdo->prepare(
        'INSERT INTO issuances (project_id, issued_as, revision, issue_date, sort_order) VALUES (?,?,?,?,?)'
    );
    foreach (array_values($history) as $index => $row) {
        $issuedAs = (string) ($row['issuedAs'] ?? '');
        if (!in_array($issuedAs, ISSUANCE_TYPES, true)) {
            continue;
        }
        $revision = clean_line($row['revision'] ?? '', 40);
        $issueDate = date_or_empty($row['issueDate'] ?? '', 'Issue date');
        $stmt->execute([
            $projectId,
            $issuedAs,
            $revision,
            $issueDate !== '' ? $issueDate : null,
            $index,
        ]);
    }
}

function save_project(PDO $pdo, array $input, ?int $id, bool $issuedOnlyOnCreate): void
{
    require_user($pdo);
    $existing = null;
    if ($id !== null) {
        $existing = find_project($pdo, $id);
        if (!$existing) {
            json_error(404, 'That project no longer exists.');
        }
    }

    $issuedRequired = $issuedOnlyOnCreate || ($existing !== null && $existing['issuances'] !== []);
    $project = normalize_project($input, $issuedRequired);
    assert_unique_number($pdo, $project['number'], $id ?? 0);
    $history = record_issuance($project, $existing['issuances'] ?? []);
    $issuedOnly = $existing !== null
        ? ($existing['issuedOnly'] ? 1 : 0)
        : ($issuedOnlyOnCreate ? 1 : 0);
    write_project($pdo, $project, $history, $issuedOnly, $id);
}

function delete_project(PDO $pdo, int $id): void
{
    require_user($pdo);
    $existing = find_project($pdo, $id);
    if (!$existing) {
        json_error(404, 'That project no longer exists.');
    }
    $pdo->prepare('DELETE FROM issuances WHERE project_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM projects WHERE id = ?')->execute([$id]);
}

function update_issue_date(PDO $pdo, int $issuanceId, array $input): void
{
    require_user($pdo);
    $date = date_or_empty($input['issueDate'] ?? '', 'Issue date');
    $stmt = $pdo->prepare(
        'SELECT id, project_id, sort_order FROM issuances WHERE id = ?'
    );
    $stmt->execute([$issuanceId]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error(404, 'That issuance no longer exists.');
    }

    $pdo->prepare('UPDATE issuances SET issue_date = ? WHERE id = ?')->execute([
        $date !== '' ? $date : null,
        $issuanceId,
    ]);

    $latest = $pdo->prepare(
        'SELECT id FROM issuances WHERE project_id = ? ORDER BY sort_order DESC, id DESC LIMIT 1'
    );
    $latest->execute([(int) $row['project_id']]);
    if ((int) $latest->fetchColumn() === $issuanceId) {
        $pdo->prepare('UPDATE projects SET issue_date = ? WHERE id = ?')->execute([
            $date !== '' ? $date : null,
            (int) $row['project_id'],
        ]);
    }
}

function option_field(mixed $value): string
{
    $field = (string) $value;
    if (!isset(FIELD_COLUMNS[$field])) {
        json_error(422, 'Choose a valid field.');
    }
    return $field;
}

function option_label(mixed $value): string
{
    $label = clean_line($value, 100);
    if ($label === '') {
        json_error(422, 'Enter an option name.');
    }
    return $label;
}

function duplicate_option(PDO $pdo, string $field, string $label, int $ignoreId): void
{
    $stmt = $pdo->prepare(
        'SELECT id FROM options WHERE field_key = ? AND LOWER(label) = LOWER(?) AND id <> ?'
    );
    $stmt->execute([$field, $label, $ignoreId]);
    if ($stmt->fetch()) {
        json_error(422, 'This option already exists.');
    }
}

function add_option(PDO $pdo, array $input): void
{
    require_user($pdo);
    $field = option_field($input['field'] ?? '');
    $label = option_label($input['label'] ?? '');
    duplicate_option($pdo, $field, $label, 0);

    $sort = $pdo->prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 FROM options WHERE field_key = ?');
    $sort->execute([$field]);
    try {
        $pdo->prepare('INSERT INTO options (field_key, label, sort_order) VALUES (?,?,?)')->execute([
            $field,
            $label,
            (int) $sort->fetchColumn(),
        ]);
    } catch (PDOException $e) {
        if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
            json_error(422, 'This option already exists.');
        }
        throw $e;
    }
}

function rename_option(PDO $pdo, int $id, array $input): void
{
    require_user($pdo);
    $stmt = $pdo->prepare('SELECT id, field_key, label FROM options WHERE id = ?');
    $stmt->execute([$id]);
    $option = $stmt->fetch();
    if (!$option || !isset(FIELD_COLUMNS[$option['field_key']])) {
        json_error(404, 'That option no longer exists.');
    }

    $label = option_label($input['label'] ?? '');
    if ($label === $option['label']) {
        return;
    }
    duplicate_option($pdo, $option['field_key'], $label, $id);
    $column = FIELD_COLUMNS[$option['field_key']];

    try {
        $pdo->beginTransaction();
        $pdo->prepare('UPDATE options SET label = ? WHERE id = ?')->execute([$label, $id]);
        $pdo->prepare("UPDATE projects SET `$column` = ? WHERE `$column` = ?")->execute([
            $label,
            $option['label'],
        ]);
        $pdo->commit();
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
            json_error(422, 'This option already exists.');
        }
        throw $e;
    }
}

function delete_option(PDO $pdo, int $id): void
{
    require_user($pdo);
    $stmt = $pdo->prepare('SELECT id, field_key, label FROM options WHERE id = ?');
    $stmt->execute([$id]);
    $option = $stmt->fetch();
    if (!$option || !isset(FIELD_COLUMNS[$option['field_key']])) {
        json_error(404, 'That option no longer exists.');
    }

    $column = FIELD_COLUMNS[$option['field_key']];
    $used = $pdo->prepare("SELECT COUNT(*) FROM projects WHERE `$column` = ?");
    $used->execute([$option['label']]);
    if ((int) $used->fetchColumn() > 0) {
        json_error(422, 'Change this option on the projects using it before deleting it.');
    }

    $pdo->prepare('DELETE FROM options WHERE id = ?')->execute([$id]);
}

function list_users(PDO $pdo): array
{
    require_admin($pdo);
    $rows = $pdo->query('SELECT id, name, email, role FROM users ORDER BY name, id')->fetchAll();
    return array_map(fn (array $row): array => [
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'email' => $row['email'],
        'role' => $row['role'],
    ], $rows);
}

function create_user(PDO $pdo, array $input): void
{
    require_admin($pdo);
    $name = person_name($input['name'] ?? '');
    $email = email_address($input['email'] ?? '');
    $password = password_value($input['password'] ?? '');
    $role = (string) ($input['role'] ?? 'member');
    if (!in_array($role, ['admin', 'member'], true)) {
        json_error(422, 'Choose a valid role.');
    }

    try {
        $pdo->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)')->execute([
            $name,
            $email,
            password_hash($password, PASSWORD_DEFAULT),
            $role,
        ]);
    } catch (PDOException $e) {
        if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
            json_error(422, 'Someone already uses that email.');
        }
        throw $e;
    }
}

function delete_user(PDO $pdo, int $id, array $actor): void
{
    if ($id === $actor['id']) {
        json_error(422, 'You cannot remove your own account.');
    }

    $stmt = $pdo->prepare('SELECT id, role FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $target = $stmt->fetch();
    if (!$target) {
        json_error(404, 'That person is no longer on the team.');
    }

    if ($target['role'] === 'admin') {
        $admins = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn();
        if ($admins <= 1) {
            json_error(422, 'The tracker needs at least one administrator.');
        }
    }

    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
}

function change_password(PDO $pdo, array $user, array $input): void
{
    $next = password_value($input['next'] ?? '');
    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $hash = (string) $stmt->fetchColumn();
    if (!password_verify((string) ($input['current'] ?? ''), $hash)) {
        json_error(422, 'The current password is incorrect.');
    }

    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([
        password_hash($next, PASSWORD_DEFAULT),
        $user['id'],
    ]);
}

function sample_definitions(): array
{
    return [
        [
            'project' => [
                'number' => 'DEMO-101', 'strata' => 'SP 102481', 'name' => 'Harbour Apartments',
                'owner' => 'Stella', 'category' => 'WP Design', 'program' => 'Revit',
                'stage' => 'Drafting', 'status' => 'In Progress', 'start' => '2026-11-02',
                'review' => 'Pending', 'due' => '2026-11-18', 'engineer' => 'Demo engineer A',
                'priority' => 'High', 'issuedAs' => '', 'revision' => '', 'issueDate' => '',
                'notes' => 'Confirm drawing revisions.',
            ],
            'history' => [],
            'issuedOnly' => 0,
        ],
        [
            'project' => [
                'number' => 'DEMO-102', 'strata' => 'SP 88421', 'name' => 'Parkside Terrace',
                'owner' => 'Jelly', 'category' => 'WP Design', 'program' => 'CAD/SKP',
                'stage' => 'Review', 'status' => 'Waiting for Approval', 'start' => '2026-11-03',
                'review' => 'Submitted', 'due' => '2026-11-20', 'engineer' => 'Demo engineer B',
                'priority' => 'Normal', 'issuedAs' => '', 'revision' => '', 'issueDate' => '',
                'notes' => 'Awaiting review feedback.',
            ],
            'history' => [],
            'issuedOnly' => 0,
        ],
        [
            'project' => [
                'number' => 'DEMO-103', 'strata' => '', 'name' => 'Westcourt Building',
                'owner' => 'Unassigned', 'category' => '', 'program' => '',
                'stage' => 'Scoping', 'status' => 'New Job', 'start' => '',
                'review' => '', 'due' => '', 'engineer' => '',
                'priority' => '', 'issuedAs' => '', 'revision' => '', 'issueDate' => '',
                'notes' => '',
            ],
            'history' => [],
            'issuedOnly' => 0,
        ],
        [
            'project' => [
                'number' => 'DEMO-104', 'strata' => 'SP 55190', 'name' => 'Cedar Place',
                'owner' => 'Stella', 'category' => 'WP Design', 'program' => 'Revit',
                'stage' => 'Issued', 'status' => 'Approved', 'start' => '2026-09-15',
                'review' => 'Closed', 'due' => '2026-11-04', 'engineer' => 'Demo engineer A',
                'priority' => 'Normal', 'issuedAs' => 'For Construction', 'revision' => 'C',
                'issueDate' => '2026-11-04', 'notes' => 'Issued for construction.',
            ],
            'history' => [
                ['issuedAs' => 'For Tender', 'revision' => 'B', 'issueDate' => '2026-10-20'],
                ['issuedAs' => 'For Construction', 'revision' => 'C', 'issueDate' => '2026-11-04'],
            ],
            'issuedOnly' => 0,
        ],
        [
            'project' => [
                'number' => 'DEMO-105', 'strata' => 'SP 33018', 'name' => 'Bridgeview Residences',
                'owner' => 'Jelly', 'category' => 'WP Design', 'program' => 'REVIT/SKP',
                'stage' => 'Drafting', 'status' => 'For Update / Revision', 'start' => '2026-10-28',
                'review' => 'Comments received', 'due' => '2026-11-12', 'engineer' => 'Demo engineer B',
                'priority' => 'Urgent', 'issuedAs' => '', 'revision' => '', 'issueDate' => '',
                'notes' => 'Revise the floor plans before the next issue.',
            ],
            'history' => [],
            'issuedOnly' => 0,
        ],
    ];
}

function load_sample(PDO $pdo): void
{
    require_user($pdo);
    $count = (int) $pdo->query('SELECT COUNT(*) FROM projects')->fetchColumn();
    if ($count > 0) {
        json_error(422, 'Sample projects can only be loaded into an empty register.');
    }

    foreach (sample_definitions() as $sample) {
        write_project($pdo, $sample['project'], $sample['history'], $sample['issuedOnly'], null);
    }
}
