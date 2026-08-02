import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_notes_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_section_header.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/clinica_empty_section.dart';
import 'package:atlasmed_mobile_app/shared/widgets/atlas_button.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';

/// "Notas de campo" — private, facility-scoped notes only the current user sees.
class ClinicFieldNotesSection extends StatelessWidget {
  const ClinicFieldNotesSection({
    super.key,
    required this.facilityId,
    required this.notes,
    required this.canAdd,
    required this.onCreate,
  });

  final String facilityId;
  final List<FacilityFieldNote>? notes;
  final bool canAdd;
  final Future<void> Function(String text) onCreate;

  @override
  Widget build(BuildContext context) {
    final loadedNotes = notes;
    return Column(
      children: [
        const ClinicSectionHeader(title: 'Notas de campo'),
        if (loadedNotes == null)
          ClinicDetailCard(
            child: AtlasShimmer(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    height: 14,
                    color: Colors.white,
                  ),
                  const SizedBox(height: 12),
                  Container(width: 220, height: 14, color: Colors.white),
                ],
              ),
            ),
          )
        else
          _NotesBody(
            facilityId: facilityId,
            notes: loadedNotes,
            canAdd: canAdd,
            onCreate: onCreate,
          ),
      ],
    );
  }
}

class _NotesBody extends StatefulWidget {
  const _NotesBody({
    required this.facilityId,
    required this.notes,
    required this.canAdd,
    required this.onCreate,
  });

  final String facilityId;
  final List<FacilityFieldNote> notes;
  final bool canAdd;
  final Future<void> Function(String text) onCreate;

  @override
  State<_NotesBody> createState() => _NotesBodyState();
}

class _NotesBodyState extends State<_NotesBody> {
  bool _saving = false;

  bool get _useApi {
    final id = widget.facilityId;
    return !id.startsWith('near-') && !id.endsWith(':empty');
  }

  @override
  Widget build(BuildContext context) {
    final notes = widget.notes;

    if (notes.isEmpty) {
      return ClinicaEmptySection(
        icon: Icons.note_alt_outlined,
        title: 'Nenhuma nota registrada',
        description: 'Adicione notas internas sobre a clínica.',
        onAction: widget.canAdd ? _addNote : null,
        actionLabel: const Text('Adicionar nota'),
      );
    }

    return ClinicDetailCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, note) in notes.indexed) ...[
            if (i > 0) const SizedBox(height: 10),
            _NoteRow(index: i + 1, note: note),
          ],
          if (widget.canAdd) ...[
            const SizedBox(height: 14),
            AtlasButton.outline(
              onPressed: _saving ? () {} : _addNote,
              icon: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.add_rounded, size: 18),
              label: const Text('Adicionar nota'),
            ),
          ],
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
      await widget.onCreate(text);
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
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Só você verá esta nota.',
            style: TextStyle(fontSize: 12, color: AppColors.gray400),
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
              fillColor: AppColors.surfaceTertiary,
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
                backgroundColor: AppColors.navyBright,
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
            color: AppColors.blueLight,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Center(
            child: Text(
              '$index',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.navyBright,
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            note.text,
            style: const TextStyle(fontSize: 13, color: AppColors.gray700),
          ),
        ),
      ],
    );
  }
}
