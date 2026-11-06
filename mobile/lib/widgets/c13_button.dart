import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api.dart';
import 'common.dart';

/// Opens only this appointed match's C13, including on phones whose browser
/// does not share the app's login. The server rechecks the original session.
class C13Button extends StatefulWidget {
  const C13Button({super.key, required this.matchId, this.submitted = false});
  final String matchId;
  final bool submitted;

  @override
  State<C13Button> createState() => _C13ButtonState();
}

class _C13ButtonState extends State<C13Button> {
  bool _opening = false;

  Future<void> _open() async {
    setState(() => _opening = true);
    try {
      final result = await Api.instance.post('/api/jfa-c13.php?view=launch&match=${Uri.encodeQueryComponent(widget.matchId)}', {});
      final url = Uri.tryParse(text(result['url'], ''));
      final origin = Uri.parse(Api.instance.absoluteUrl('/'));
      if (url == null || !url.hasScheme || url.origin != origin.origin || url.path != '/api/jfa-c13.php') {
        throw ApiException('Pautan C13 belum tersedia. Cuba semula.');
      }
      final opened = await launchUrl(url,
          mode: kIsWeb ? LaunchMode.platformDefault : LaunchMode.externalApplication,
          webOnlyWindowName: kIsWeb ? '_self' : null);
      if (!opened) throw ApiException('Tidak dapat membuka C13. Cuba semula.');
    } catch (error) {
      if (mounted) showToast(context, error is ApiException ? error.message : 'Tidak dapat membuka C13. Cuba semula.', ToastType.error);
    } finally {
      if (mounted) setState(() => _opening = false);
    }
  }

  @override
  Widget build(BuildContext context) => FilledButton.icon(
        onPressed: _opening ? null : _open,
        icon: const Icon(Icons.edit_note_rounded, size: 18),
        label: Text(_opening ? 'Membuka C13…' : widget.submitted ? 'Lihat C13' : 'Isi C13'),
        style: FilledButton.styleFrom(minimumSize: const Size(0, 48)),
      );
}
