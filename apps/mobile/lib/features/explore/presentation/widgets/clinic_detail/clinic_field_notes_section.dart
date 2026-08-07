import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_notes_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_notes_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/clinica_empty_section.dart';
import 'package:atlasmed_mobile_app/shared/widgets/atlas_button.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// "Notas de campo" — private, facility-scoped notes only the current user sees.
class ClinicFieldNotesSection extends ConsumerWidget {
  const ClinicFieldNotesSection({super.key, required this.facilityId});

  final int facilityId;

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
              style: TextStyle(fontSize: 13, color: AppColors.gray400),
            ),
            TextButton(
              onPressed: () =>
                  ref.invalidate(facilityNotesProvider(facilityId)),
              child: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
      data: (notes) => _NotesBody(
        facilityId: facilityId,
        notes: notes,
        canAdd: ref.watch(canMutateFacilityProvider),
      ),
    );
  }
}

class _NotesBody extends ConsumerStatefulWidget {
  const _NotesBody({
    required this.facilityId,
    required this.notes,
    required this.canAdd,
  });

  final int facilityId;
  final List<FacilityFieldNote> notes;
  final bool canAdd;

  @override
  ConsumerState<_NotesBody> createState() => _NotesBodyState();
}

class _NotesBodyState extends ConsumerState<_NotesBody> {
  bool _saving = false;

  bool get _useApi => widget.facilityId > 0;

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
            _NoteRow(
              index: i + 1,
              note: note,
              canMutate: widget.canAdd,
              onEdit: () => _editNote(note),
              onDelete: () => _deleteNote(note),
            ),
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
    final text = await _showNoteSheet();
    if (text == null || text.isEmpty || !mounted) return;
    await _persist(
      action: () => ref
          .read(facilityNotesRepositoryProvider(widget.facilityId))
          .createNote(text),
      successMessage: 'Nota salva',
      failureMessage: 'Falha ao salvar nota',
    );
  }

  Future<void> _editNote(FacilityFieldNote note) async {
    final text = await _showNoteSheet(initial: note.text);
    if (text == null || text.isEmpty || !mounted) return;
    await _persist(
      action: () => ref
          .read(facilityNotesRepositoryProvider(widget.facilityId))
          .updateNote(note.id, text),
      successMessage: 'Nota atualizada',
      failureMessage: 'Falha ao atualizar nota',
    );
  }

  Future<void> _deleteNote(FacilityFieldNote note) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Excluir nota?'),
        content: const Text('Esta ação não pode ser desfeita.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: const Color(0xFFB42318)),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _persist(
      action: () => ref
          .read(facilityNotesRepositoryProvider(widget.facilityId))
          .deleteNote(note.id),
      successMessage: 'Nota excluída',
      failureMessage: 'Falha ao excluir nota',
    );
  }

  Future<String?> _showNoteSheet({String? initial}) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _AddFieldNoteSheet(initialText: initial),
    );
  }

  Future<void> _persist({
    required Future<void> Function() action,
    required String successMessage,
    required String failureMessage,
  }) async {
    if (!_useApi) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Estabelecimento inválido.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      await action();
      if (!mounted) return;
      ref.invalidate(facilityNotesProvider(widget.facilityId));
      await ref.read(facilityNotesProvider(widget.facilityId).future);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(successMessage),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is FacilityNotesException
                ? (e.message ?? failureMessage)
                : failureMessage,
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
  const _AddFieldNoteSheet({this.initialText});

  final String? initialText;

  @override
  State<_AddFieldNoteSheet> createState() => _AddFieldNoteSheetState();
}

class _AddFieldNoteSheetState extends State<_AddFieldNoteSheet> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialText ?? '');
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
          Text(
            widget.initialText == null ? 'Nova nota de campo' : 'Editar nota',
            style: const TextStyle(
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
  const _NoteRow({
    required this.index,
    required this.note,
    required this.canMutate,
    required this.onEdit,
    required this.onDelete,
  });

  final int index;
  final FacilityFieldNote note;
  final bool canMutate;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

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
        if (canMutate)
          PopupMenuButton<String>(
            padding: EdgeInsets.zero,
            icon: const Icon(
              Icons.more_vert_rounded,
              size: 18,
              color: AppColors.gray400,
            ),
            onSelected: (value) {
              if (value == 'edit') onEdit();
              if (value == 'delete') onDelete();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'edit', child: Text('Editar')),
              PopupMenuItem(value: 'delete', child: Text('Excluir')),
            ],
          ),
      ],
    );
  }
}
