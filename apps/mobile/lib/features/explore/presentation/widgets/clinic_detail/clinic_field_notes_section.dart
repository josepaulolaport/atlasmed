import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_notes_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_notes_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';

/// "Notas de campo" — private, facility-scoped notes only the current user sees.
class ClinicFieldNotesSection extends ConsumerWidget {
  const ClinicFieldNotesSection({super.key, required this.facilityId});

  final String facilityId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notesAsync = ref.watch(facilityNotesProvider(facilityId));

    return notesAsync.when(
      loading: () => const ClinicDetailCard(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 16),
          child: Center(
            child: SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
      ),
      error: (err, _) => ClinicDetailCard(
        child: Column(
          children: [
            const Text(
              'Não foi possível carregar as notas.',
              style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
            ),
            TextButton(
              onPressed: () => ref.invalidate(facilityNotesProvider(facilityId)),
              child: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
      data: (notes) => _NotesBody(facilityId: facilityId, notes: notes),
    );
  }
}

class _NotesBody extends ConsumerStatefulWidget {
  const _NotesBody({required this.facilityId, required this.notes});

  final String facilityId;
  final List<FacilityFieldNote> notes;

  @override
  ConsumerState<_NotesBody> createState() => _NotesBodyState();
}

class _NotesBodyState extends ConsumerState<_NotesBody> {
  bool _saving = false;

  bool get _useApi {
    final id = widget.facilityId;
    return !id.startsWith('near-') && !id.endsWith(':empty');
  }

  @override
  Widget build(BuildContext context) {
    final notes = widget.notes;

    return ClinicDetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (notes.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 4),
              child: Text(
                'Nenhuma nota registrada — só você verá as notas adicionadas aqui.',
                style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
              ),
            )
          else
            for (final (i, note) in notes.indexed) ...[
              if (i > 0) const SizedBox(height: 10),
              _NoteRow(index: i + 1, note: note),
            ],
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: _saving ? null : _addNote,
            icon: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.add_rounded, size: 18),
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
    final text = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _AddFieldNoteSheet(),
    );

    if (text == null || text.isEmpty || !mounted) return;

    if (!_useApi) {
      // Mock facilities stay local-only for the session via provider invalidate
      // isn't needed — mock provider returns static mock data.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Nota salva localmente (clínica de demonstração)'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      // Use the shared repository — createNote() refreshes its cache. A
      // throwaway repo would refresh a different instance while the provider
      // kept serving stale currentValue via currentValueOrResolve().
      await ref
          .read(facilityNotesRepositoryProvider(widget.facilityId))
          .createNote(text);
      if (!mounted) return;
      ref.invalidate(facilityNotesProvider(widget.facilityId));
      await ref.read(facilityNotesProvider(widget.facilityId).future);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Nota salva'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is FacilityNotesException
                ? (e.message ?? 'Falha ao salvar nota')
                : 'Falha ao salvar nota',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

/// Owns its [TextEditingController] so dismiss-while-empty cannot race
/// InheritedWidget teardown (`_dependents.isEmpty`).
class _AddFieldNoteSheet extends StatefulWidget {
  const _AddFieldNoteSheet();

  @override
  State<_AddFieldNoteSheet> createState() => _AddFieldNoteSheetState();
}

class _AddFieldNoteSheetState extends State<_AddFieldNoteSheet> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
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
            controller: _controller,
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
                  Navigator.of(context).pop(_controller.text.trim()),
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
    );
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
