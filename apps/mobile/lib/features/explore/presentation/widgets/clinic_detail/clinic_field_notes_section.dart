import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';

/// "Notas de campo" — private, facility-scoped notes only the current user
/// sees. Mocked in V1 (in-memory only): no `facility_notes` table yet.
class ClinicFieldNotesSection extends StatefulWidget {
  const ClinicFieldNotesSection({super.key, required this.initialNotes});

  final List<FacilityFieldNote> initialNotes;

  @override
  State<ClinicFieldNotesSection> createState() =>
      _ClinicFieldNotesSectionState();
}

class _ClinicFieldNotesSectionState extends State<ClinicFieldNotesSection> {
  late List<FacilityFieldNote> _notes = List.of(widget.initialNotes);

  @override
  Widget build(BuildContext context) {
    return ClinicDetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_notes.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 4),
              child: Text(
                'Nenhuma nota registrada — só você verá as notas adicionadas aqui.',
                style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
              ),
            )
          else
            for (final (i, note) in _notes.indexed) ...[
              if (i > 0) const SizedBox(height: 10),
              _NoteRow(index: i + 1, note: note),
            ],
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: _addNote,
            icon: const Icon(Icons.add_rounded, size: 18),
            label: const Text('Adicionar nota'),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF1e40af),
              side: const BorderSide(color: Color(0xFFdbeafe)),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _addNote() async {
    final controller = TextEditingController();
    final text = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 16,
          bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Nova nota de campo',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0f1729),
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Só você verá esta nota.',
              style: TextStyle(fontSize: 12, color: Color(0xFF9ca3af)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              maxLines: 4,
              minLines: 2,
              decoration: InputDecoration(
                hintText: 'Ex.: Estacionamento difícil, usar Zona Azul...',
                filled: true,
                fillColor: const Color(0xFFf8f9fb),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.all(14),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () =>
                    Navigator.of(sheetContext).pop(controller.text.trim()),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF1e40af),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Salvar nota'),
              ),
            ),
          ],
        ),
      ),
    );
    controller.dispose();

    if (text != null && text.isNotEmpty && mounted) {
      setState(() {
        _notes = [
          ..._notes,
          FacilityFieldNote(
            id: 'local-${DateTime.now().microsecondsSinceEpoch}',
            text: text,
            createdAt: DateTime.now(),
          ),
        ];
      });
    }
  }
}

class _NoteRow extends StatelessWidget {
  const _NoteRow({required this.index, required this.note});

  final int index;
  final FacilityFieldNote note;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 20,
          height: 20,
          margin: const EdgeInsets.only(top: 1),
          decoration: BoxDecoration(
            color: const Color(0xFFeef4ff),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Center(
            child: Text(
              '$index',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1e40af),
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            note.text,
            style: const TextStyle(fontSize: 13, color: Color(0xFF374151)),
          ),
        ),
      ],
    );
  }
}
