<?php
/**
 * Public Application Settings API
 * GET: Return public settings needed for application forms (any logged-in user)
 */
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

requireAuth();

try {
    $pdo = getDbConnection();
    $rows = $pdo->query("SELECT setting_key, setting_value FROM application_settings")->fetchAll(PDO::FETCH_ASSOC);
    $all = [];
    foreach ($rows as $row) {
        $all[$row['setting_key']] = $row['setting_value'];
    }

    $public = [
        'applications_open'      => $all['applications_open']      ?? '0',
        'berdaftar_open'         => $all['berdaftar_open']         ?? '0',
        'bertulis_open'          => $all['bertulis_open']          ?? '0',
        'kelas1_open'            => $all['kelas1_open']            ?? '0',
        'penilai_open'           => $all['penilai_open']           ?? '0',
        'berdaftar_open_date'    => $all['berdaftar_open_date']    ?? '',
        'berdaftar_close_date'   => $all['berdaftar_close_date']   ?? '',
        'bertulis_open_date'     => $all['bertulis_open_date']     ?? '',
        'bertulis_close_date'    => $all['bertulis_close_date']    ?? '',
        'kelas1_open_date'       => $all['kelas1_open_date']       ?? '',
        'kelas1_close_date'      => $all['kelas1_close_date']      ?? '',
        'application_year'       => $all['application_year']       ?? (string)date('Y'),
        'payment_amount'         => $all['payment_amount']         ?? '80.00',
        'payment_bank_name'      => $all['payment_bank_name']      ?? '',
        'payment_account_name'   => $all['payment_account_name']   ?? '',
        'payment_account_no'     => $all['payment_account_no']     ?? '',
        'min_verified_matches'      => $all['min_verified_matches']      ?? '20',
        'fam_bank_name'           => $all['fam_bank_name']           ?? 'Bank Islam Persatuan Bolasepak Malaysia',
        'fam_account_no'          => $all['fam_account_no']           ?? '1213 1010 0061 21',
        'bertulis_fee'            => $all['bertulis_fee']             ?? '50.00',
        'bertulis_min_age'        => $all['bertulis_min_age']         ?? '15',
        'bertulis_max_age'        => $all['bertulis_max_age']         ?? '40',
        'kelas1_fee'              => $all['kelas1_fee']               ?? '300.00',
        'kelas1_max_age'          => $all['kelas1_max_age']           ?? '32',
        'kelas1_min_fitness_rounds' => $all['kelas1_min_fitness_rounds'] ?? '7',
    ];

    jsonResponse(['error' => false, 'settings' => $public]);
} catch (Exception $e) {
    jsonResponse(['error' => true, 'message' => 'Ralat sistem.'], 500);
}
