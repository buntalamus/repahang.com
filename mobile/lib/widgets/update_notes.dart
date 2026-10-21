import 'package:flutter/material.dart';

import '../release_notes.dart';
import '../theme.dart';
import 'common.dart';

/// Shared by the banner, notification, profile and APK update prompts.
class UpdateNotes extends StatefulWidget {
  const UpdateNotes({super.key, required this.load});
  final Future<List<MobileReleaseNote>> Function() load;

  @override
  State<UpdateNotes> createState() => _UpdateNotesState();
}

class _UpdateNotesState extends State<UpdateNotes> {
  late Future<List<MobileReleaseNote>> _notes = widget.load();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 20),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('Apa yang baharu', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      FutureBuilder<List<MobileReleaseNote>>(
        future: _notes,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Text('Memuatkan catatan perubahan...', style: TextStyle(color: AppColors.muted));
          }
          final notes = snapshot.data ?? [];
          if (notes.isEmpty) {
            return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(snapshot.hasError ? 'Catatan perubahan tidak dapat dimuatkan.' : 'Catatan perubahan belum tersedia.',
                  style: const TextStyle(color: AppColors.muted)),
              TextButton(onPressed: () => setState(() { _notes = widget.load(); }), child: const Text('Cuba lagi')),
            ]);
          }
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final note in notes) ...[
              Text('${note.releaseVersion}${note.patch > 0 ? ' • Patch ${note.patch}' : ''} • ${formatDate(note.date)}',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              const SizedBox(height: 6),
              for (final change in note.changes)
                Padding(padding: const EdgeInsets.only(bottom: 8), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('•  '),
                  Expanded(child: Text(change, style: const TextStyle(height: 1.5))),
                ])),
              const SizedBox(height: 8),
            ],
          ]);
        },
      ),
    ]),
  );
}
