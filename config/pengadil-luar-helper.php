<?php

declare(strict_types=1);

function pengadilLuarNegeriList(): array
{
    return [
        'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
        'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah',
        'Sarawak', 'Selangor', 'Terengganu',
        'WP Kuala Lumpur', 'WP Putrajaya', 'WP Labuan',
    ];
}

function pengadilLuarJenisList(): array
{
    return [
        'Pengadil Negeri',
        'Pengadil Kebangsaan',
        'Kelas 1',
        'Kelas 2',
        'Kelas 3',
        'Penilai Pengadil',
    ];
}

function normalizePengadilLuarNegeri(string $value): ?string
{
    $value = trim($value);
    $aliases = [
        'kuala lumpur' => 'WP Kuala Lumpur',
        'kl' => 'WP Kuala Lumpur',
        'putrajaya' => 'WP Putrajaya',
        'labuan' => 'WP Labuan',
    ];
    $lower = strtolower($value);
    if (isset($aliases[$lower])) {
        return $aliases[$lower];
    }

    foreach (pengadilLuarNegeriList() as $negeri) {
        if (strcasecmp($value, $negeri) === 0) {
            return $negeri;
        }
    }

    return null;
}

function normalizePengadilLuarJenis(string $value): ?string
{
    $value = trim($value);
    if ($value === '') {
        return 'Pengadil Negeri';
    }

    $aliases = [
        'keb' => 'Pengadil Kebangsaan',
        'kebangsaan' => 'Pengadil Kebangsaan',
        'negeri' => 'Pengadil Negeri',
        'k1' => 'Kelas 1',
        'k2' => 'Kelas 2',
        'k3' => 'Kelas 3',
        'penilai' => 'Penilai Pengadil',
        'ra' => 'Penilai Pengadil',
    ];
    $lower = strtolower($value);
    if (isset($aliases[$lower])) {
        return $aliases[$lower];
    }

    foreach (pengadilLuarJenisList() as $jenis) {
        if (strcasecmp($value, $jenis) === 0) {
            return $jenis;
        }
    }

    return null;
}
