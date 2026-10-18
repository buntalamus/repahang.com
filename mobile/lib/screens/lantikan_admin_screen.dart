import 'package:flutter/material.dart';

import '../api.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'lantik_screen.dart';

/// Appointments for Admin and PP Daerah: tournaments → matches → appoint
/// officials (LantikScreen). Bulk actions stay on the website.
class LantikanAdminScreen extends StatefulWidget {
  const LantikanAdminScreen({super.key});

  @override
  State<LantikanAdminScreen> createState() => _LantikanAdminScreenState();
}

class _LantikanAdminScreenState extends State<LantikanAdminScreen> {
  bool _activeOnly = true;

  String get _webPath => Api.instance.user.value?.isAdmin == true ? '/admin/lantikan' : '/pp-daerah/lantikan';

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<Map<String, dynamic>>>(
      loadingMessage: 'Memuatkan kejohanan...',
      load: () async {
        final body = await Api.instance.get('/api/kejohanan.php');
        return (body['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      },
      builder: (context, all, reload) {
        final items = _activeOnly ? all.where((k) => k['status'] != 'Selesai').toList() : all;
        return RefreshIndicator(
          color: Tw.pahangBlack,
          onRefresh: reload,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            WebCard(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                _toggle('Aktif', _activeOnly, () => setState(() => _activeOnly = true)),
                const SizedBox(width: 8),
                _toggle('Semua', !_activeOnly, () => setState(() => _activeOnly = false)),
                const Spacer(),
                YellowButton(label: 'Urus', icon: Icons.open_in_new, onPressed: () => openWebsite(context, _webPath)),
              ]),
            ),
            if (items.isEmpty) const EmptyCard(icon: Icons.emoji_events_outlined, message: 'Tiada kejohanan.'),
            for (final k in items) _tournamentCard(k),
          ]),
        );
      },
    );
  }

  Widget _toggle(String label, bool selected, VoidCallback onTap) => Material(
        color: selected ? Tw.slate900 : Tw.slate100,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Text(label,
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: selected ? Colors.white : Tw.slate600)),
          ),
        ),
      );

  Widget _tournamentCard(Map<String, dynamic> k) {
    final status = text(k['status']);
    return WebCard(
      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => _JadualScreen(tournament: k))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Text(text(k['nama']), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Tw.slate900)),
          ),
          const SizedBox(width: 8),
          StatusBadge(status, status == 'Aktif' ? (Tw.green100, Tw.green700) : (Tw.gray100, Tw.gray600), pill: true),
        ]),
        const SizedBox(height: 6),
        Row(children: [
          StatusBadge(text(k['jenis_kejohanan'], 'Persahabatan'), tournamentTone(text(k['jenis_kejohanan'], '')), small: true),
          const SizedBox(width: 4),
          if (text(k['peringkat_kejohanan'], '').isNotEmpty)
            StatusBadge(text(k['peringkat_kejohanan']), (Tw.amber50, Tw.amber600), small: true),
        ]),
        const SizedBox(height: 6),
        Text('${formatDate(k['tarikh_mula'])} – ${formatDate(k['tarikh_akhir'])} · ${text(k['tempat'])}',
            style: const TextStyle(fontSize: 12, color: Tw.slate500)),
        Text('${text(k['jumlah_perlawanan'], '0')} perlawanan${text(k['anjuran'], '').isEmpty ? '' : ' · ${k['anjuran']}'}',
            style: const TextStyle(fontSize: 12, color: Tw.slate500)),
      ]),
    );
  }
}

class _JadualScreen extends StatelessWidget {
  const _JadualScreen({required this.tournament});
  final Map<String, dynamic> tournament;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(text(tournament['nama']), style: const TextStyle(fontSize: 16))),
      body: AsyncView<List<Map<String, dynamic>>>(
        loadingMessage: 'Memuatkan jadual...',
        load: () async {
          final body = await Api.instance.get('/api/jadual-perlawanan.php', {'kejohanan_id': tournament['id']});
          return (body['data'] as List? ?? []).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        },
        builder: (context, matches, reload) => RefreshIndicator(
          color: Tw.pahangBlack,
          onRefresh: reload,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            if (matches.isEmpty) const EmptyCard(icon: Icons.event_busy, message: 'Tiada jadual perlawanan.'),
            for (final m in matches) _matchCard(context, m, reload),
          ]),
        ),
      ),
    );
  }

  Widget _matchCard(BuildContext context, Map<String, dynamic> m, Future<void> Function() reload) {
    final assigned = int.tryParse('${m['jumlah_lantikan'] ?? 0}') ?? 0;
    final accepted = int.tryParse('${m['jumlah_terima'] ?? 0}') ?? 0;
    final tone = assigned == 0
        ? (Tw.slate100, Tw.slate500)
        : accepted >= assigned
            ? (Tw.emerald50, Tw.emerald700)
            : (Tw.amber50, Tw.amber700);
    final matchStatus = text(m['status'], '');
    return WebCard(
      onTap: () async {
        await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LantikScreen(match: m)));
        await reload();
      },
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Text('${text(m['no_perlawanan'])} — ${text(m['kumpulan_tahap'] ?? m['kategori'], '')}',
                style: const TextStyle(fontSize: 12, color: Tw.slate500)),
          ),
          StatusBadge(assigned == 0 ? 'Belum dilantik' : '$accepted/$assigned diterima', tone),
        ]),
        const SizedBox(height: 6),
        Text('${text(m['pasukan_home'])} vs ${text(m['pasukan_away'])}',
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Tw.slate800)),
        const SizedBox(height: 4),
        Text('${formatDate(m['tarikh'])}, ${text(m['hari'], '')}, ${formatTime(m['masa'])}',
            style: const TextStyle(fontSize: 12, color: Tw.slate500)),
        Text(text(m['tempat']), style: const TextStyle(fontSize: 12, color: Tw.slate500)),
        if (matchStatus.isNotEmpty && matchStatus != 'Dijadualkan')
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: StatusBadge(matchStatus, appointmentTone(matchStatus), small: true),
          ),
      ]),
    );
  }
}
