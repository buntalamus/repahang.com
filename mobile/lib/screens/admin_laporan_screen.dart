import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'laporan_view.dart';
import 'rekod_screen.dart' show markahTone;

List<Map<String, dynamic>> _rows(Object? list) => (list as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();

/// Like the website's getLaporanWorkflowLabel: the chair's decision wins over
/// the report status.
String _workflow(Map<String, dynamic> r) {
  final approval = (r['pengesahan'] as Map?)?['pengesahan_status'];
  if (approval == 'Override Admin') return 'Override Admin';
  if (approval == 'Disahkan') return 'Disahkan Pengerusi';
  if (r['status'] == 'Dihantar') return 'Menunggu Pengerusi';
  return text(r['status']);
}

Tone _workflowTone(String label) => switch (label) {
  'Disahkan' || 'Disahkan Pengerusi' => (Tw.emerald50, Tw.emerald700),
  'Override Admin' => (Tw.rose50, Tw.rose700),
  'Dihantar' || 'Menunggu Pengerusi' => (Tw.blue50, Tw.blue700),
  _ => (Tw.amber50, Tw.amber700),
};

String _short(Object? jawatan) => switch ('$jawatan') {
  'Pengadil' => 'R',
  'Penolong Pengadil 1' => 'AR1',
  'Penolong Pengadil 2' => 'AR2',
  _ => 'P4',
};

/// Admin: RA reports (/api/laporan-penilaian.php) with the chair approval
/// state, the audited Admin override and the printable report, plus the RA
/// duties still missing a report — the website's Lantikan › Penilaian tab.
class AdminLaporanScreen extends StatefulWidget {
  const AdminLaporanScreen({super.key});

  @override
  State<AdminLaporanScreen> createState() => _AdminLaporanScreenState();
}

class _AdminLaporanScreenState extends State<AdminLaporanScreen> {
  final _view = GlobalKey<AsyncViewState<List<Map<String, dynamic>>>>();
  String _tab = 'laporan';
  String _status = '';

  Future<void> _open(Map<String, dynamic> report) async {
    // The sheet can change the approval state however it is closed.
    await showAppSheet<void>(context, builder: (_) => _ReportSheet(id: report['id']));
    await _view.currentState?.reload();
  }

  void _filter(VoidCallback change) {
    setState(change);
    _view.currentState?.reload();
  }

  Future<void> _copyFormLink(Map<String, dynamic> row) async {
    await Clipboard.setData(ClipboardData(text: text(row['ra_form_url'])));
    try {
      await Api.instance.post('/api/lantikan-audit.php', {
        'action': 'record_copy',
        'lantikan_id': row['lantikan_id'],
        'link_type': 'ra_form_url',
      });
      if (mounted) showToast(context, 'Pautan disalin dan direkodkan.');
    } on ApiException catch (error) {
      if (mounted) {
        showToast(context, error.message.isEmpty ? 'Pautan disalin tetapi log salinan gagal direkodkan.' : error.message,
            ToastType.error);
      }
    }
  }

  Future<void> _prepareFormLink(Map<String, dynamic> row) async {
    try {
      final result = await Api.instance.post('/api/lantikan-audit.php', {
        'action': 'prepare_links',
        'lantikan_id': row['lantikan_id'],
      });
      if (mounted) showToast(context, text(result['message'], 'Pautan disediakan.'));
      await _view.currentState?.reload();
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Laporan RA')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: FilterChips<String>(
              options: const [('laporan', 'Laporan'), ('tertunggak', 'Belum dihantar RA')],
              value: _tab,
              onChanged: (v) => _filter(() => _tab = v),
            ),
          ),
          if (_tab == 'laporan')
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: FilterChips<String>(
                options: const [('', 'Semua'), ('Dihantar', 'Menunggu'), ('Disahkan', 'Disahkan')],
                value: _status,
                onChanged: (v) => _filter(() => _status = v),
              ),
            ),
          Expanded(
            child: AsyncView<List<Map<String, dynamic>>>(
              key: _view,
              load: () async => _rows(
                (await Api.instance.get(
                  '/api/laporan-penilaian.php',
                  _tab == 'tertunggak' ? {'tertunggak': 1} : {if (_status.isNotEmpty) 'status': _status},
                ))['data'],
              ),
              builder: (context, items, reload) => RefreshList(
                onRefresh: reload,
                children: [
                  if (items.isEmpty)
                    EmptyState(
                      icon: Icons.task_alt_rounded,
                      title: _tab == 'tertunggak' ? 'Semua laporan RA telah dihantar' : 'Tiada laporan',
                    ),
                  for (final r in items) _tab == 'tertunggak' ? _outstandingCard(r) : _reportCard(r),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _reportCard(Map<String, dynamic> r) {
    final label = _workflow(r);
    return AppCard(
      onTap: () => _open(r),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DateBlock(r['tarikh']),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${text(r['nama_kejohanan'])} · ${text(r['no_perlawanan'])}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted),
                    ),
                    Text(
                      '${text(r['pasukan_home'])} vs ${text(r['pasukan_away'])}',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
                    Text('Penilai: ${text(r['nama_penilai'])}', style: const TextStyle(fontSize: 12.5, color: AppColors.muted)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              Pill(label, _workflowTone(label)),
              for (final o in _rows(r['pegawai'])) Pill('${_short(o['jawatan'])}: ${text(o['markah'])}', markahTone(o['markah'])),
            ],
          ),
        ],
      ),
    );
  }

  Widget _outstandingCard(Map<String, dynamic> r) {
    final days = parseDate(r['tarikh']) == null
        ? null
        : DateTime.now().toUtc().add(const Duration(hours: 8)).difference(parseDate(r['tarikh'])!).inDays;
    return AppCard(
      accent: Tw.pahangYellow,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DateBlock(r['tarikh'], highlight: true),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${text(r['nama_kejohanan'])} · ${text(r['no_perlawanan'])}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.muted),
                    ),
                    Text(
                      '${text(r['pasukan_home'])} vs ${text(r['pasukan_away'])}',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
                    Text(
                      'RA: ${text(r['nama_penilai'])}${r['pegawai_luar'] == 1 ? ' (Luar)' : ''}',
                      style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Pill(text(r['status']), r['status'] == 'Draf' ? (Tw.amber50, Tw.amber800) : (Tw.red100, Tw.red700)),
                  if (days != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      days <= 0 ? 'Hari ini' : '$days hari lalu',
                      style: const TextStyle(fontSize: 12, color: AppColors.muted),
                    ),
                  ],
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              if (text(r['no_telefon'], '').isNotEmpty) ...[
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => callNumber(context, text(r['no_telefon'])),
                    icon: const Icon(Icons.call_outlined, size: 18),
                    label: const Text('Hubungi'),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: r['ra_form_url'] != null
                    ? OutlinedButton.icon(
                        onPressed: () => _copyFormLink(r),
                        icon: const Icon(Icons.copy_rounded, size: 18),
                        label: const Text('Salin pautan borang'),
                      )
                    : OutlinedButton.icon(
                        onPressed: () => _prepareFormLink(r),
                        icon: const Icon(Icons.link_rounded, size: 18),
                        label: const Text('Sediakan pautan'),
                      ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// One report: details, chair approval state and, while it waits for the
/// chair, the audited Admin override.
class _ReportSheet extends StatefulWidget {
  const _ReportSheet({required this.id});
  final Object? id;

  @override
  State<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<_ReportSheet> {
  final _view = GlobalKey<AsyncViewState<Map<String, dynamic>>>();
  final _reason = TextEditingController();
  final _note = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _reason.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> _load() async =>
      Map<String, dynamic>.from((await Api.instance.get('/api/laporan-penilaian.php', {'id': widget.id}))['laporan'] as Map);

  Future<void> _put(Map<String, dynamic> body, {bool close = false}) async {
    setState(() => _busy = true);
    try {
      final result = await Api.instance.put('/api/laporan-penilaian.php', {...body, 'id': widget.id});
      if (!mounted) return;
      showToast(context, text(result['message'], 'Dikemaskini.'));
      if (close) {
        Navigator.of(context).pop();
        return;
      }
      await _view.currentState?.reload();
    } on ApiException catch (error) {
      if (mounted) showToast(context, error.message, ToastType.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _override() async {
    if (_reason.text.trim().isEmpty) {
      showToast(context, 'Sebab override Admin diperlukan.', ToastType.warning);
      return;
    }
    await _put({'action': 'sahkan', 'override_reason': _reason.text.trim(), 'catatan_admin': _note.text.trim()}, close: true);
  }

  Future<void> _copyApprovalLink(String url) async {
    await Clipboard.setData(ClipboardData(text: url));
    await _put({'action': 'log_pengerusi_link_copy'});
  }

  @override
  Widget build(BuildContext context) {
    return AsyncView<Map<String, dynamic>>(
      key: _view,
      load: _load,
      builder: (context, d, _) {
        final approval = d['pengesahan'] is Map ? Map<String, dynamic>.from(d['pengesahan'] as Map) : null;
        final label = _workflow(d);
        final waiting = approval?['pengesahan_status'] == 'Menunggu';
        final canRetry =
            waiting &&
            ((approval?['email_applicable'] == 1 && approval?['email_sent_at'] == null) ||
                (approval?['telegram_applicable'] == 1 && approval?['telegram_sent_at'] == null));
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Align(alignment: Alignment.centerLeft, child: Pill(label, _workflowTone(label))),
            const SizedBox(height: 10),
            LaporanDetail(report: d),
            const SizedBox(height: 12),
            AppCard(
              color: approval == null ? Tw.amber50 : Tw.purple50,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Pengesahan Pengerusi Pengadil', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  if (approval == null)
                    const Text('Status pengesahan belum disediakan.', style: TextStyle(fontSize: 13, color: AppColors.muted))
                  else ...[
                    Text(
                      text(approval['pengesah_nama'], 'Belum ditetapkan'),
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      '${text(approval['pengesah_jawatan'], 'Pengerusi Pengadil')} · ${text(approval['pengesah_negeri'])}',
                      style: const TextStyle(fontSize: 12.5, color: AppColors.muted),
                    ),
                    if (waiting) ...[
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          Pill(
                            'Emel ${approval['email_sent_at'] != null ? 'dihantar' : 'belum dihantar'}',
                            approval['email_sent_at'] != null ? (Tw.emerald50, Tw.emerald700) : (Tw.amber50, Tw.amber700),
                          ),
                          Pill(
                            'Telegram ${approval['telegram_sent_at'] != null ? 'dihantar' : 'tidak dihantar'}',
                            approval['telegram_sent_at'] != null ? (Tw.emerald50, Tw.emerald700) : (Tw.gray100, Tw.gray600),
                          ),
                        ],
                      ),
                      if (text(approval['approval_url'], '').isNotEmpty) ...[
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          onPressed: _busy ? null : () => _copyApprovalLink(text(approval['approval_url'])),
                          icon: const Icon(Icons.copy_rounded, size: 18),
                          label: const Text('Salin pautan pengesahan'),
                        ),
                      ],
                      if (canRetry)
                        OutlinedButton.icon(
                          onPressed: _busy ? null : () => _put({'action': 'retry_pengerusi_notification'}),
                          icon: const Icon(Icons.send_outlined, size: 18),
                          label: const Text('Cuba hantar semula'),
                        ),
                    ],
                    if (text(approval['catatan_pengerusi'], '').isNotEmpty)
                      DetailRow(
                        Icons.comment_outlined,
                        approval['pengesahan_status'] == 'Override Admin' ? 'Catatan Override Admin' : 'Komen Pengerusi',
                        text(approval['catatan_pengerusi']),
                      ),
                    if (text(approval['alasan_override'], '').isNotEmpty)
                      DetailRow(Icons.gavel_rounded, 'Sebab override', text(approval['alasan_override'])),
                  ],
                ],
              ),
            ),
            if (d['status'] == 'Disahkan')
              FilledButton.icon(
                onPressed: () => openReportPdf(context, d['id']),
                icon: const Icon(Icons.picture_as_pdf_outlined, size: 20),
                label: const Text('Lihat PDF'),
              ),
            if (d['status'] == 'Dihantar') ...[
              const SizedBox(height: 4),
              const Text('Override Admin', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              const Text(
                'Gunakan hanya jika Pengerusi Pengadil tidak dapat membuat pengesahan. Identiti Admin, sebab, masa dan tindakan akan direkodkan dalam audit.',
                style: TextStyle(fontSize: 13, color: AppColors.muted, height: 1.4),
              ),
              const SizedBox(height: 12),
              LabeledField(
                label: 'Sebab override',
                controller: _reason,
                maxLines: 2,
                required: true,
                hint: 'Nyatakan sebab Admin mengambil alih pengesahan...',
              ),
              LabeledField(
                label: 'Catatan kepada pegawai (pilihan)',
                controller: _note,
                maxLines: 3,
                hint: 'Tambah catatan atau maklum balas kepada penilai...',
              ),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: Tw.rose600, foregroundColor: Colors.white),
                onPressed: _busy ? null : _override,
                child: Text(_busy ? 'Memproses...' : 'Override & Sahkan Laporan'),
              ),
            ],
          ],
        );
      },
    );
  }
}
