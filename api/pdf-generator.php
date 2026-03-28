<?php

declare(strict_types=1);

/**
 * PDF Generator for Official Referee Application Form
 * Generates professional PDF document for email attachment
 */
class ApplicationPDFGenerator
{
    private array $application;
    private int $applicationId;
    
    public function __construct(array $application, int $applicationId)
    {
        $this->application = $application;
        $this->applicationId = $applicationId;
    }
    
    /**
     * Generate complete HTML content for PDF conversion
     */
    public function generateHTML(): string
    {
        $refNo = 'REF-' . str_pad((string)$this->applicationId, 6, '0', STR_PAD_LEFT);
        $date = date('d/m/Y H:i');
        
        $html = '<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Borang Permohonan Pengadil - ' . $refNo . '</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: "Segoe UI", Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #000;
            padding: 40px;
            background: #fff;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
        }
        
        .header {
            text-align: center;
            border-bottom: 4px solid #000;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        .header-logo {
            width: 80px;
            height: 80px;
            margin: 0 auto 15px;
            background: #000;
            color: #FADA00;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 32px;
        }
        
        .header-title {
            font-size: 22pt;
            font-weight: bold;
            color: #000;
            margin-bottom: 5px;
            text-transform: uppercase;
        }
        
        .header-subtitle {
            font-size: 11pt;
            color: #666;
            margin-bottom: 3px;
        }
        
        .ref-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding: 15px;
            background: #f8f9fa;
            border-left: 5px solid #FADA00;
        }
        
        .ref-number {
            font-size: 14pt;
            font-weight: bold;
            color: #000;
        }
        
        .ref-date {
            font-size: 10pt;
            color: #666;
        }
        
        .document-title {
            background: linear-gradient(135deg, #000 0%, #333 100%);
            color: #FADA00;
            padding: 15px;
            text-align: center;
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 25px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .status-badge {
            display: inline-block;
            background: #FFF3CD;
            color: #856404;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 10pt;
            border: 2px solid #FFE69C;
            margin: 0 auto 30px;
            text-align: center;
        }
        
        .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        
        .section-header {
            background: #000;
            color: #FADA00;
            padding: 10px 15px;
            font-weight: bold;
            font-size: 13pt;
            margin-bottom: 15px;
            border-radius: 4px;
        }
        
        .field-row {
            display: flex;
            padding: 8px 15px;
            border-bottom: 1px solid #e9ecef;
        }
        
        .field-row:last-child {
            border-bottom: none;
        }
        
        .field-label {
            font-weight: 600;
            width: 200px;
            color: #495057;
            flex-shrink: 0;
        }
        
        .field-value {
            flex: 1;
            color: #000;
        }
        
        .match-list {
            margin-top: 10px;
        }
        
        .match-item {
            background: #f8f9fa;
            padding: 12px 15px;
            margin-bottom: 10px;
            border-left: 4px solid #FADA00;
            border-radius: 4px;
        }
        
        .match-item strong {
            color: #000;
            display: block;
            margin-bottom: 5px;
            font-size: 11pt;
        }
        
        .match-details {
            font-size: 10pt;
            color: #495057;
            line-height: 1.8;
        }
        
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 3px solid #000;
            text-align: center;
        }
        
        .footer-title {
            font-weight: bold;
            font-size: 11pt;
            color: #000;
            margin-bottom: 10px;
        }
        
        .footer-text {
            font-size: 9pt;
            color: #666;
            line-height: 1.8;
            margin-bottom: 8px;
        }
        
        .footer-contact {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #dee2e6;
            font-size: 9pt;
            color: #666;
        }
        
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 72pt;
            color: rgba(250, 218, 0, 0.08);
            font-weight: bold;
            z-index: -1;
            pointer-events: none;
        }
        
        @media print {
            body {
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <div class="watermark">PAHANG FA</div>
    <div class="container">
        <div class="header">
            <div class="header-logo">PFA</div>
            <div class="header-title">Persatuan Bola Sepak Pahang</div>
            <div class="header-subtitle">Pahang Football Association</div>
            <div class="header-subtitle">Sistem Pendaftaran Pengadil</div>
        </div>
        
        <div class="ref-section">
            <div>
                <div class="ref-number">' . $this->escapeHtml($refNo) . '</div>
                <div class="ref-date">Tarikh: ' . $date . '</div>
            </div>
            <div class="status-badge">⏳ MENUNGGU SEMAKAN</div>
        </div>
        
        <div class="document-title">Salinan Borang Permohonan Pengadil</div>';
        
        // MAKLUMAT PERIBADI
        $html .= '
        <div class="section">
            <div class="section-header">📋 MAKLUMAT PERIBADI</div>
            <div class="field-row">
                <div class="field-label">Nama Penuh:</div>
                <div class="field-value">' . $this->escapeHtml($this->application['nama_penuh']) . '</div>
            </div>
            <div class="field-row">
                <div class="field-label">No. Kad Pengenalan:</div>
                <div class="field-value">' . $this->escapeHtml($this->application['no_kp']) . '</div>
            </div>
            <div class="field-row">
                <div class="field-label">Jantina:</div>
                <div class="field-value">' . $this->escapeHtml($this->application['jantina']) . '</div>
            </div>
            <div class="field-row">
                <div class="field-label">Emel:</div>
                <div class="field-value">' . $this->escapeHtml($this->application['emel']) . '</div>
            </div>
            <div class="field-row">
                <div class="field-label">No. Telefon:</div>
                <div class="field-value">' . $this->escapeHtml($this->application['no_telefon']) . '</div>
            </div>
            <div class="field-row">
                <div class="field-label">Alamat:</div>
                <div class="field-value">';
        
        $html .= $this->escapeHtml($this->application['alamat1']) . '<br>';
        if (!empty($this->application['alamat2'])) {
            $html .= $this->escapeHtml($this->application['alamat2']) . '<br>';
        }
        $html .= $this->escapeHtml($this->application['poskod']) . ' ' . $this->escapeHtml($this->application['daerah']) . '<br>';
        $html .= $this->escapeHtml($this->application['negeri']);
        
        $html .= '</div>
            </div>
        </div>';
        
        // MAKLUMAT PEKERJAAN
        $html .= '
        <div class="section">
            <div class="section-header">💼 MAKLUMAT PEKERJAAN</div>
            <div class="field-row">
                <div class="field-label">Status Kerja:</div>
                <div class="field-value">' . $this->escapeHtml($this->application['status_kerja']) . '</div>
            </div>';
        
        if ($this->application['status_kerja'] === 'Bekerja') {
            if (!empty($this->application['jawatan'])) {
                $html .= '
            <div class="field-row">
                <div class="field-label">Jawatan:</div>
                <div class="field-value">' . $this->escapeHtml($this->application['jawatan']) . '</div>
            </div>';
            }
            
            if (!empty($this->application['nama_majikan'])) {
                $html .= '
            <div class="field-row">
                <div class="field-label">Nama Majikan:</div>
                <div class="field-value">' . $this->escapeHtml($this->application['nama_majikan']) . '</div>
            </div>';
            }
            
            if (!empty($this->application['alamat_majikan1'])) {
                $html .= '
            <div class="field-row">
                <div class="field-label">Alamat Majikan:</div>
                <div class="field-value">';
                
                $html .= $this->escapeHtml($this->application['alamat_majikan1']) . '<br>';
                if (!empty($this->application['alamat_majikan2'])) {
                    $html .= $this->escapeHtml($this->application['alamat_majikan2']) . '<br>';
                }
                if (!empty($this->application['poskod_majikan'])) {
                    $html .= $this->escapeHtml($this->application['poskod_majikan']) . ' ';
                    $html .= $this->escapeHtml($this->application['daerah_majikan'] ?? '') . '<br>';
                }
                if (!empty($this->application['negeri_majikan'])) {
                    $html .= $this->escapeHtml($this->application['negeri_majikan']);
                }
                
                $html .= '</div>
            </div>';
            }
        }
        
        $html .= '
        </div>';
        
        // MAKLUMAT WARIS
        $html .= '
        <div class="section">
            <div class="section-header">👥 MAKLUMAT WARIS</div>
            <div class="field-row">
                <div class="field-label">Nama Waris:</div>
                <div class="field-value">' . $this->escapeHtml($this->application['nama_waris']) . '</div>
            </div>
            <div class="field-row">
                <div class="field-label">Hubungan:</div>
                <div class="field-value">' . $this->escapeHtml($this->application['hubungan_waris']) . '</div>
            </div>
            <div class="field-row">
                <div class="field-label">No. Telefon Waris:</div>
                <div class="field-value">' . $this->escapeHtml($this->application['telefon_waris']) . '</div>
            </div>
        </div>';
        
        // PENGALAMAN PERLAWANAN
        if (!empty($this->application['perlawanan']) && is_array($this->application['perlawanan'])) {
            $html .= '
        <div class="section">
            <div class="section-header">⚽ PENGALAMAN PERLAWANAN</div>
            <div class="match-list">';
            
            $count = 0;
            foreach ($this->application['perlawanan'] as $match) {
                if (empty($match['tarikh'])) continue;
                $count++;
                
                $html .= '
                <div class="match-item">
                    <strong>Perlawanan ' . $count . '</strong>
                    <div class="match-details">
                        <div><strong>Tarikh:</strong> ' . $this->escapeHtml($match['tarikh']) . '</div>';
                
                if (!empty($match['jenis'])) {
                    $html .= '
                        <div><strong>Jenis:</strong> ' . $this->escapeHtml($match['jenis']) . '</div>';
                }
                if (!empty($match['tempat'])) {
                    $html .= '
                        <div><strong>Tempat:</strong> ' . $this->escapeHtml($match['tempat']) . '</div>';
                }
                if (!empty($match['jawatan'])) {
                    $html .= '
                        <div><strong>Jawatan:</strong> ' . $this->escapeHtml($match['jawatan']) . '</div>';
                }
                
                $html .= '
                    </div>
                </div>';
            }
            
            $html .= '
            </div>
        </div>';
        }
        
        // FOOTER
        $html .= '
        <div class="footer">
            <div class="footer-title">✓ Dokumen Rasmi Sistem Pendaftaran Pengadil</div>
            <div class="footer-text">Dokumen ini dijana secara automatik pada ' . $date . '</div>
            <div class="footer-text">Permohonan anda sedang dalam proses semakan oleh pentadbir.</div>
            <div class="footer-text">Anda akan menerima notifikasi emel sekiranya terdapat kemaskini status.</div>
            <div class="footer-contact">
                <strong>Hubungi Kami:</strong> admin@refpahang.com | Persatuan Bola Sepak Pahang
            </div>
        </div>
    </div>
</body>
</html>';
        
        return $html;
    }
    
    /**
     * Escape HTML special characters
     */
    private function escapeHtml(?string $value): string
    {
        return htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8');
    }
    
    /**
     * Get filename for PDF
     */
    public function getFilename(): string
    {
        $refNo = str_pad((string)$this->applicationId, 6, '0', STR_PAD_LEFT);
        return 'Borang_Permohonan_Pengadil_' . $refNo . '.html';
    }
}
