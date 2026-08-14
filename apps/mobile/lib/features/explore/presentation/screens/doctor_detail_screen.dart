import 'dart:async';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/professional_notes_repository.dart';
import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/shared/widgets/loading/atlas_shimmer.dart';
import 'package:flutter/cupertino.dart'
    show CupertinoSliverRefreshControl, CupertinoTheme;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/api/professional_api.dart';
import 'package:atlasmed_mobile_app/features/explore/data/professional_note.dart';
import 'package:atlasmed_mobile_app/features/explore/data/domain/professional.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctor_detail_repository.dart';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_associate_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/doctor_detail_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/professional_notes_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/edit_doctor_profile_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/editable_field_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/professional_registrations_section.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/relationship_stars.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/quick_actions.dart';
import 'package:atlasmed_mobile_app/repository/domain/entities/repository_state.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/bookmarks_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/bookmark_icon_button.dart';
import 'package:atlasmed_mobile_app/router/routes.dart';

// ======================================================================
// DoctorDetailScreen — full doctor profile with multiple sections
// ======================================================================

class DoctorDetailScreen extends ConsumerWidget {
  final int doctorId;

  /// When set (facility roster navigation), relationship can be edited.
  final int? facilityId;

  const DoctorDetailScreen({
    super.key,
    required this.doctorId,
    this.facilityId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repository = ref.watch(doctorDetailRepositoryProvider(doctorId));
    final initialLoad = repository.currentValueOrResolve();

    return StreamBuilder<RepositoryState<ProfessionalDTO>>(
      stream: repository.stream,
      initialData: repository.currentState,
      builder: (context, repositorySnapshot) {
        final detail = _doctorDetailFromRepository(
          repositorySnapshot.data ?? repository.currentState,
        );

        return Scaffold(
          backgroundColor: AppColors.surfaceTertiary,
          appBar: AppBar(
            backgroundColor: detail?.primaryColor ?? AppColors.navyBright,
            foregroundColor: Colors.white,
            actions: [
              BookmarkIconButton(kind: BookmarkKind.doctor, id: doctorId),
              const SizedBox(width: 6),
            ],
          ),
          body: FutureBuilder<ProfessionalDTO?>(
            future: initialLoad,
            builder: (context, initialSnapshot) {
              if (detail != null) {
                return _DoctorDetailContent(
                  detail: detail,
                  repository: repository,
                  doctorId: doctorId,
                  facilityId: facilityId,
                );
              }

              final error = initialSnapshot.error ?? repositorySnapshot.error;
              if (error != null) {
                return _errorView(context, error.toString());
              }

              return _loadingSkeleton(context);
            },
          ),
        );
      },
    );
  }

  Professional? _doctorDetailFromRepository(
    RepositoryState<ProfessionalDTO> state,
  ) {
    return state.map(
      empty: (_) => null,
      ready: (ready) => Professional.fromDTO(ready.data),
    );
  }

  Widget _loadingSkeleton(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          _buildHeaderSkeleton(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: List.generate(
                6,
                (_) => Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: AtlasShimmer(
                    child: Container(
                      height: 80,
                      decoration: BoxDecoration(
                        color: const Color(0xFFeef0f3),
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderSkeleton() {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.grey.withValues(alpha: 0.3),
            Colors.grey.withValues(alpha: 0.1),
          ],
        ),
      ),
    );
  }

  Widget _errorView(BuildContext context, String message) {
    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.red),
              const SizedBox(height: 12),
              const Text(
                'Erro ao carregar',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.gray900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: AppColors.gray500),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ======================================================================
// Content — full doctor profile
// ======================================================================

class _DoctorDetailContent extends ConsumerWidget {
  final Professional detail;
  final DoctorDetailRepository repository;
  final int doctorId;
  final int? facilityId;
  const _DoctorDetailContent({
    required this.detail,
    required this.repository,
    required this.doctorId,
    this.facilityId,
  });

  Future<void> _editField(
    BuildContext context,
    WidgetRef ref,
    DoctorEditableField field,
  ) async {
    final updated = await showEditDoctorFieldSheet(
      context,
      detail: detail,
      field: field,
      ref: ref,
    );
    if (updated == null) return;
    await repository.refresh();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notesRepository = ref.watch(
      professionalNotesRepositoryProvider(doctorId),
    );

    return CustomScrollView(
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      slivers: [
        CupertinoSliverRefreshControl(
          onRefresh: () async {
            await Future.wait([
              repository.refresh(),
              notesRepository.refresh(),
            ]);
          },
          builder:
              (
                context,
                refreshState,
                pulledExtent,
                refreshTriggerPullDistance,
                refreshIndicatorExtent,
              ) => ColoredBox(
                color: detail.primaryColor,
                child: CupertinoTheme(
                  data: CupertinoTheme.of(
                    context,
                  ).copyWith(brightness: Brightness.dark),
                  child: CupertinoSliverRefreshControl.buildRefreshIndicator(
                    context,
                    refreshState,
                    pulledExtent,
                    refreshTriggerPullDistance,
                    refreshIndicatorExtent,
                  ),
                ),
              ),
        ),
        SliverToBoxAdapter(
          child: ColoredBox(
            color: AppColors.surfaceTertiary,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _DoctorHeader(detail: detail),
                DetailQuickActions(
                  themeColor: detail.primaryColor,
                  actions: [
                    QuickActionItem(
                      icon: CircleAvatar(
                        backgroundColor: detail.primaryColor.createSecondary(),
                        radius: 18,
                        child: Icon(
                          Icons.phone_rounded,
                          size: 18,
                          color: detail.primaryColor,
                        ),
                      ),
                      label: const Text('Ligar'),
                      onTap: () => launchContactUrl(
                        context,
                        url: callUrl(detail.phone),
                        contactLabel: 'telefone',
                      ),
                    ),
                    QuickActionItem(
                      icon: CircleAvatar(
                        backgroundColor: detail.primaryColor.createSecondary(),
                        radius: 18,
                        child: Icon(
                          Icons.chat_rounded,
                          size: 18,
                          color: detail.primaryColor,
                        ),
                      ),
                      label: const Text('WhatsApp'),
                      onTap: () => launchContactUrl(
                        context,
                        url: whatsappUrl(detail.whatsapp),
                        contactLabel: 'WhatsApp',
                      ),
                    ),
                    QuickActionItem(
                      icon: CircleAvatar(
                        backgroundColor: detail.primaryColor.createSecondary(),
                        radius: 18,
                        child: Icon(
                          Icons.email_rounded,
                          size: 18,
                          color: detail.primaryColor,
                        ),
                      ),
                      label: const Text('E-mail'),
                      onTap: () => launchContactUrl(
                        context,
                        url: emailUrl(detail.email),
                        contactLabel: 'e-mail',
                      ),
                    ),
                    QuickActionItem(
                      icon: CircleAvatar(
                        backgroundColor: detail.primaryColor.createSecondary(),
                        radius: 18,
                        child: Icon(
                          Icons.event_rounded,
                          size: 18,
                          color: detail.primaryColor,
                        ),
                      ),
                      label: const Text('Nova visita'),
                      onTap: null,
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (facilityId != null && facilityId! > 0) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: _DoctorRelationshipCard(
                      facilityId: facilityId!,
                      professionalId: doctorId,
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                if (detail.signals.isNotEmpty) ...[
                  _ProfessionalSignals(detail: detail, signals: detail.signals),
                  const SizedBox(height: 16),
                ],
                _DoctorPersonalCard(
                  detail: detail,
                  onEditField: (field) => _editField(context, ref, field),
                ),
                const SizedBox(height: 16),
                ProfessionalRegistrationsSection(
                  personId: doctorId,
                  onChanged: () => repository.refresh(),
                ),
                const SizedBox(height: 16),
                if (detail.prescribing.isNotEmpty) ...[
                  _DoctorPrescribing(detail: detail, items: detail.prescribing),
                  const SizedBox(height: 16),
                ],
                _ProfessionalClinics(detail: detail, clinics: detail.clinics),
                const SizedBox(height: 16),
                if (detail.visits.isNotEmpty) ...[
                  _ProfessionalVisits(visits: detail.visits),
                  const SizedBox(height: 16),
                ],
                RepositoryBuilder(
                  repository: notesRepository,
                  builder: (context, notes, repository) {
                    return _DoctorNotes(
                      detail: detail,
                      notes: notes,
                      onAddNote: () => _showNoteSheet(context, ref, repository),
                      onEditNote: (note) => _showNoteSheet(
                        context,
                        ref,
                        repository,
                        existing: note,
                      ),
                      onDeleteNote: (note) =>
                          _confirmDeleteNote(context, repository, note),
                    );
                  },
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _DoctorRelationshipCard extends StatefulWidget {
  const _DoctorRelationshipCard({
    required this.facilityId,
    required this.professionalId,
  });

  final int facilityId;
  final int professionalId;

  @override
  State<_DoctorRelationshipCard> createState() =>
      _DoctorRelationshipCardState();
}

class _DoctorRelationshipCardState extends State<_DoctorRelationshipCard> {
  int? _score;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repo = FacilityAssociateRepository(widget.facilityId);
    try {
      final level = await repo.fetchRelationshipLevel(widget.professionalId);
      if (!mounted) return;
      setState(() {
        _score = level;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    } finally {
      repo.dispose();
    }
  }

  Future<void> _set(int? level) async {
    final previous = _score;
    setState(() {
      _score = level;
      _saving = true;
    });
    final repo = FacilityAssociateRepository(widget.facilityId);
    try {
      final saved = await repo.updateRelationshipLevel(
        widget.professionalId,
        relationshipLevel: level,
      );
      if (!mounted) return;
      setState(() {
        _score = saved;
        _saving = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _score = previous;
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível salvar o relacionamento'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      repo.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'RELACIONAMENTO',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: AppColors.gray400,
            ),
          ),
          const SizedBox(height: 10),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Carregando…',
                style: TextStyle(fontSize: 13, color: AppColors.gray500),
              ),
            )
          else ...[
            RelationshipStars(
              score: _score,
              onChanged: _saving ? null : _set,
              showLabel: false,
            ),
            const SizedBox(height: 6),
            const Text(
              'Toque à esquerda da estrela para meia, à direita para cheia. Segure para limpar.',
              style: TextStyle(fontSize: 11.5, color: AppColors.gray400),
            ),
          ],
        ],
      ),
    );
  }
}

Future<void> _showNoteSheet(
  BuildContext context,
  WidgetRef ref,
  ProfessionalNotesRepository repository, {
  ProfessionalNote? existing,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    builder: (_) => _AddDoctorNoteSheet(
      repository: repository,
      ref: ref,
      existing: existing,
    ),
  );
}

Future<void> _confirmDeleteNote(
  BuildContext context,
  ProfessionalNotesRepository repository,
  ProfessionalNote note,
) async {
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
  if (confirmed != true) return;

  try {
    await repository.deleteNote(note.id);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Nota excluída'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  } catch (_) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Não foi possível excluir a nota.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

/// Owns its controllers so dismissing an empty sheet cannot race
/// InheritedWidget teardown (`_dependents.isEmpty`).
class _AddDoctorNoteSheet extends StatefulWidget {
  const _AddDoctorNoteSheet({
    required this.repository,
    required this.ref,
    this.existing,
  });

  final ProfessionalNotesRepository repository;
  final WidgetRef ref;
  final ProfessionalNote? existing;

  @override
  State<_AddDoctorNoteSheet> createState() => _AddDoctorNoteSheetState();
}

class _AddDoctorNoteSheetState extends State<_AddDoctorNoteSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _controller;
  var _isSaving = false;
  String? _errorMessage;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.existing?.note ?? '');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });
    try {
      final text = _controller.text.trim();
      final existing = widget.existing;
      if (existing != null) {
        await widget.repository.updateNote(existing.id, text);
      } else {
        await widget.repository.createNote(text);
      }
      if (mounted) Navigator.pop(context);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isSaving = false;
        _errorMessage = 'Não foi possível salvar a nota. Tente novamente.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _isEdit ? 'Editar nota' : 'Adicionar nota',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            const Text(
              'Esta nota ficará visível somente para você.',
              style: TextStyle(fontSize: 13, color: AppColors.gray500),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _controller,
              autofocus: true,
              minLines: 4,
              maxLines: 8,
              maxLength: 2000,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Nota',
                alignLabelWithHint: true,
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Digite uma nota para salvar.';
                }
                return null;
              },
            ),
            if (_errorMessage != null) ...[
              const SizedBox(height: 8),
              Text(
                _errorMessage!,
                style: const TextStyle(color: AppColors.red, fontSize: 13),
              ),
            ],
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: _isSaving ? null : () => Navigator.pop(context),
                  child: const Text('Cancelar'),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: _isSaving ? null : _save,
                  child: _isSaving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Salvar'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ======================================================================
// 1. DoctorHeader — gradient background + avatar + name + badge
// ======================================================================

class _DoctorHeader extends StatelessWidget {
  final Professional detail;
  const _DoctorHeader({required this.detail});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: detail.primaryColor,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Avatar
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.9),
                        width: 3,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.22),
                          blurRadius: 18,
                          offset: const Offset(0, 6),
                        ),
                      ],
                      color: detail.primaryColor,
                    ),
                    child: Center(
                      child: Text(
                        detail.initials,
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.5,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  // Name + badges
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Status badge
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 9,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.28),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 5,
                                height: 5,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                '${detail.statusLabel} · ${detail.specialty}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.3,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          detail.name,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.5,
                            height: 1.15,
                            color: Colors.white,
                          ),
                        ),
                        if (detail.crm.trim().isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            detail.crm,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.white.withValues(alpha: 0.78),
                            ),
                          ),
                        ],
                        if (detail.residency != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            detail.residency!,
                            style: TextStyle(
                              fontSize: 11.5,
                              color: Colors.white.withValues(alpha: 0.72),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ======================================================================
// 3. ProfessionalSignals — info/warning/success cards
// ======================================================================

class _ProfessionalSignals extends StatelessWidget {
  final Professional detail;
  final List<ProfessionalSignal> signals;
  const _ProfessionalSignals({required this.detail, required this.signals});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: signals
            .map(
              (s) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _SignalCard(detail: detail, signal: s),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _SignalCard extends StatelessWidget {
  final Professional detail;
  final ProfessionalSignal signal;
  const _SignalCard({required this.detail, required this.signal});

  @override
  Widget build(BuildContext context) {
    final (Color color, Color bg, IconData icon) = switch (signal.kind) {
      'good' => (AppColors.green, AppColors.green50, Icons.trending_up_rounded),
      'warn' => (
        AppColors.amber,
        AppColors.amber50,
        Icons.info_outline_rounded,
      ),
      _ => (
        detail.primaryColor,
        detail.primaryBg,
        Icons.lightbulb_outline_rounded,
      ),
    };

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  signal.title,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: color,
                    height: 1.3,
                  ),
                ),
                if (signal.body.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    signal.body,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.gray600,
                      height: 1.35,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ======================================================================
// 4. DoctorPersonalCard — personal info + contacts
// ======================================================================

class _DoctorPersonalCard extends StatelessWidget {
  final Professional detail;
  final ValueChanged<DoctorEditableField>? onEditField;
  const _DoctorPersonalCard({required this.detail, this.onEditField});

  static String? _displayBirthday(String? isoOrLabel) {
    if (isoOrLabel == null || isoOrLabel.isEmpty) return null;
    final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(isoOrLabel);
    if (match == null) return isoOrLabel;
    const months = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ];
    final month = int.tryParse(match.group(2)!) ?? 1;
    final day = match.group(3)!;
    return '$day/${months[month - 1]}';
  }

  @override
  Widget build(BuildContext context) {
    final canEdit = onEditField != null;
    final fields =
        <
          ({
            String label,
            String? value,
            IconData icon,
            DoctorEditableField? field,
          })
        >[
          (
            label: 'Formação',
            value: detail.faculty,
            icon: Icons.school_outlined,
            field: null,
          ),
          (
            label: 'Residência',
            value: detail.residency,
            icon: Icons.local_hospital_outlined,
            field: null,
          ),
          (
            label: 'Aniversário',
            value: _displayBirthday(detail.birthday),
            icon: Icons.cake_outlined,
            field: DoctorEditableField.birthDate,
          ),
          (
            label: 'Time',
            value: detail.team,
            icon: Icons.sports_soccer_outlined,
            field: DoctorEditableField.favoriteTeam,
          ),
          (
            label: 'Interesses',
            value: detail.interests,
            icon: Icons.favorite_outline,
            field: DoctorEditableField.hobbies,
          ),
          (
            label: 'Idiomas',
            value: detail.language,
            icon: Icons.translate_outlined,
            field: DoctorEditableField.languages,
          ),
          (
            label: 'Telefone',
            value: detail.phone,
            icon: Icons.phone_outlined,
            field: DoctorEditableField.mobilePhone,
          ),
          (
            label: 'WhatsApp',
            value: detail.whatsapp ?? detail.phone,
            icon: Icons.chat_outlined,
            field: DoctorEditableField.mobilePhone,
          ),
          (
            label: 'E-mail',
            value: detail.email,
            icon: Icons.email_outlined,
            field: DoctorEditableField.email,
          ),
        ];

    return ClinicDetailCard(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 14, 16, 4),
              child: Text(
                'PESSOAL',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: AppColors.gray400,
                ),
              ),
            ),
            if (canEdit)
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 4),
                child: Text(
                  'Toque no lápis ou em + Completar para editar um campo',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                    color: AppColors.gray400,
                  ),
                ),
              ),
            for (var i = 0; i < fields.length; i++)
              EditableFieldRow(
                label: fields[i].label,
                value: fields[i].value,
                icon: fields[i].icon,
                emptyActionLabel: '+ Completar',
                showDivider: i < fields.length - 1,
                showEditButton: canEdit && fields[i].field != null,
                onEdit: fields[i].field == null
                    ? null
                    : () => onEditField!(fields[i].field!),
              ),
          ],
        ),
      ),
    );
  }
}

// ======================================================================
// 5. DoctorPrescribing — product trends with share bars
// ======================================================================

class _DoctorPrescribing extends StatelessWidget {
  final Professional detail;
  final List<PrescribingItem> items;
  const _DoctorPrescribing({required this.detail, required this.items});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          title: 'PRESCRIÇÃO · 6 MESES',
          subtitle: 'volume atribuído a esta médica',
        ),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: AppColors.surfaceSecondary),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: AppColors.gray900.withValues(alpha: 0.03),
                  blurRadius: 2,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: Column(
              children: List.generate(items.length, (i) {
                final item = items[i];
                final max = item.trend.reduce((a, b) => a > b ? a : b);
                final positive = item.growth >= 0;
                return Column(
                  children: [
                    if (i > 0)
                      Container(height: 1, color: AppColors.surfaceSecondary),
                    Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Header row
                          Row(
                            children: [
                              Text(
                                item.product,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.gray900,
                                  letterSpacing: -0.1,
                                ),
                              ),
                              if (item.isNew) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 1,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.green50,
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: const Text(
                                    'novo',
                                    style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 0.3,
                                      color: AppColors.green600,
                                    ),
                                  ),
                                ),
                              ],
                              const Spacer(),
                              Text(
                                item.volume,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: AppColors.gray500,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '${positive ? '▲' : '▼'} ${item.growth.toStringAsFixed(0)}%',
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: positive
                                      ? AppColors.green600
                                      : AppColors.red,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          // Trend bars + share
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              // Trend mini-bars
                              SizedBox(
                                height: 28,
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: item.trend.map((v) {
                                    final pct = max > 0 ? v / max : 0.0;
                                    return Container(
                                      width: 5,
                                      margin: const EdgeInsets.symmetric(
                                        horizontal: 1.5,
                                      ),
                                      height: pct * 28,
                                      decoration: BoxDecoration(
                                        color: v == item.trend.last
                                            ? detail.primaryColor
                                            : AppColors.blueLight,
                                        borderRadius: BorderRadius.circular(2),
                                      ),
                                    );
                                  }).toList(),
                                ),
                              ),
                              const SizedBox(width: 12),
                              // Share bar
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        const Text(
                                          'Share da médica',
                                          style: TextStyle(
                                            fontSize: 10.5,
                                            color: AppColors.gray500,
                                          ),
                                        ),
                                        Text(
                                          '${item.share}%',
                                          style: const TextStyle(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w600,
                                            color: AppColors.gray900,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 3),
                                    Container(
                                      height: 5,
                                      decoration: BoxDecoration(
                                        color: AppColors.surfaceSecondary,
                                        borderRadius: BorderRadius.circular(3),
                                      ),
                                      child: FractionallySizedBox(
                                        widthFactor: item.share / 100,
                                        child: Container(
                                          decoration: BoxDecoration(
                                            color: detail.primaryColor,
                                            borderRadius: BorderRadius.circular(
                                              3,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              }),
            ),
          ),
        ),
      ],
    );
  }
}

// ======================================================================
// 6. ProfessionalClinics — clinics where they work
// ======================================================================

class _ProfessionalClinics extends StatelessWidget {
  final Professional detail;
  final List<ProfessionalClinic> clinics;
  const _ProfessionalClinics({required this.detail, required this.clinics});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          title: clinics.isEmpty ? 'CLÍNICAS' : 'CLÍNICAS · ${clinics.length}',
          subtitle: 'onde atende (no seu território)',
        ),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: 16,
              vertical: clinics.isEmpty ? 16 : 0,
            ),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: AppColors.surfaceSecondary),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: AppColors.gray900.withValues(alpha: 0.03),
                  blurRadius: 2,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: clinics.isEmpty
                ? const Text(
                    'Nenhuma clínica do seu território vinculada a este médico.',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.gray400,
                      height: 1.35,
                    ),
                  )
                : Column(
                    children: List.generate(clinics.length, (i) {
                      final c = clinics[i];
                      final meta = [
                        if (c.role.trim().isNotEmpty) c.role.trim(),
                        if (c.days.trim().isNotEmpty) c.days.trim(),
                      ].join(' · ');
                      return InkWell(
                        onTap: () {
                          ClinicDetailRoute(id: c.id).push(context);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            border: i > 0
                                ? const Border(
                                    top: BorderSide(
                                      color: AppColors.surfaceSecondary,
                                    ),
                                  )
                                : null,
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 34,
                                height: 34,
                                decoration: BoxDecoration(
                                  color: c.isMain
                                      ? AppColors.blue50
                                      : AppColors.gray100,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Icon(
                                  Icons.local_hospital_rounded,
                                  size: 16,
                                  color: c.isMain
                                      ? detail.primaryColor
                                      : AppColors.gray500,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Flexible(
                                          child: Text(
                                            c.name,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.gray900,
                                              letterSpacing: -0.1,
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        if (c.isMain) ...[
                                          const SizedBox(width: 6),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 6,
                                              vertical: 1,
                                            ),
                                            decoration: BoxDecoration(
                                              color: detail.primaryAccent,
                                              borderRadius:
                                                  BorderRadius.circular(999),
                                            ),
                                            child: Text(
                                              'principal',
                                              style: TextStyle(
                                                fontSize: 9,
                                                fontWeight: FontWeight.w700,
                                                letterSpacing: 0.3,
                                                color: detail.primaryColor,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                    if (meta.isNotEmpty) ...[
                                      const SizedBox(height: 1),
                                      Text(
                                        meta,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: AppColors.gray500,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              Icon(
                                Icons.chevron_right_rounded,
                                size: 18,
                                color: const Color(
                                  0xFF8a94a6,
                                ).withValues(alpha: 0.7),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                  ),
          ),
        ),
      ],
    );
  }
}

// ======================================================================
// 7. ProfessionalVisits — visit history
// ======================================================================

class _ProfessionalVisits extends StatelessWidget {
  final List<ProfessionalVisit> visits;
  const _ProfessionalVisits({required this.visits});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(title: 'HISTÓRICO DE VISITAS'),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: AppColors.surfaceSecondary),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: AppColors.gray900.withValues(alpha: 0.03),
                  blurRadius: 2,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: Column(
              children: List.generate(visits.length, (i) {
                final v = visits[i];
                final outcomeColor = switch (v.outcome) {
                  'positivo' => AppColors.green,
                  'misto' => AppColors.amber,
                  'neutro' => AppColors.gray500,
                  _ => AppColors.gray500,
                };
                return Padding(
                  padding: EdgeInsets.only(top: i > 0 ? 14 : 0),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Date column
                      SizedBox(
                        width: 52,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              v.date.split(' · ').first,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.gray900,
                              ),
                            ),
                            Text(
                              v.time,
                              style: const TextStyle(
                                fontSize: 10,
                                color: AppColors.gray400,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Outcome indicator
                      Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.only(top: 3),
                        decoration: BoxDecoration(
                          color: outcomeColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 10),
                      // Content
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 1,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.gray100,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    v.kind,
                                    style: const TextStyle(
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.gray500,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    v.location,
                                    style: const TextStyle(
                                      fontSize: 10.5,
                                      color: AppColors.gray400,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            if (v.note.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                v.note,
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: AppColors.gray600,
                                  height: 1.35,
                                ),
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                            if (v.duration.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.access_time_rounded,
                                    size: 11,
                                    color: AppColors.gray400,
                                  ),
                                  const SizedBox(width: 3),
                                  Text(
                                    v.duration,
                                    style: const TextStyle(
                                      fontSize: 10,
                                      color: AppColors.gray400,
                                    ),
                                  ),
                                  if (v.orderValue != null) ...[
                                    const SizedBox(width: 8),
                                    const Icon(
                                      Icons.attach_money_rounded,
                                      size: 11,
                                      color: AppColors.green,
                                    ),
                                    Text(
                                      v.orderValue!,
                                      style: const TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.green,
                                      ),
                                    ),
                                  ],
                                  // Consultant
                                  const Spacer(),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Container(
                                        width: 16,
                                        height: 16,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: HSLColor.fromAHSL(
                                            1,
                                            v.consultantHue,
                                            0.40,
                                            0.72,
                                          ).toColor(),
                                        ),
                                        child: Center(
                                          child: Text(
                                            v.consultantInitials,
                                            style: TextStyle(
                                              fontSize: 7,
                                              fontWeight: FontWeight.w700,
                                              color: HSLColor.fromAHSL(
                                                1,
                                                v.consultantHue,
                                                0.60,
                                                0.22,
                                              ).toColor(),
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 3),
                                      Text(
                                        v.consultant,
                                        style: const TextStyle(
                                          fontSize: 9.5,
                                          color: AppColors.gray500,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ),
          ),
        ),
      ],
    );
  }
}

// ======================================================================
// 8. DoctorNotes — field notes
// ======================================================================

class _DoctorNotes extends StatelessWidget {
  final Professional detail;
  final List<ProfessionalNote>? notes;
  final VoidCallback onAddNote;
  final ValueChanged<ProfessionalNote> onEditNote;
  final ValueChanged<ProfessionalNote> onDeleteNote;

  const _DoctorNotes({
    required this.detail,
    required this.notes,
    required this.onAddNote,
    required this.onEditNote,
    required this.onDeleteNote,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(title: 'NOTAS DE CAMPO', subtitle: 'só você vê'),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: AppColors.surfaceSecondary),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: AppColors.gray900.withValues(alpha: 0.03),
                  blurRadius: 2,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: Builder(
              builder: (context) {
                final notes = this.notes;
                if (notes == null) {
                  return ListTile(
                    leading: AtlasShimmer.size(.square(24)),
                    title: AtlasShimmer.size(.new(120, 12)),
                    subtitle: AtlasShimmer.size(.new(120, 12)),
                  );
                }

                return Column(
                  children: [
                    if (notes.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Text('Nenhuma nota adicionada ainda.'),
                      ),

                    ...List.generate(notes.length, (i) {
                      final item = notes[i];
                      return Container(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          border: i < notes.length - 1
                              ? const Border(
                                  bottom: BorderSide(
                                    color: AppColors.surfaceSecondary,
                                  ),
                                )
                              : null,
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 18,
                              height: 18,
                              decoration: BoxDecoration(
                                color: detail.primaryBg,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Center(
                                child: Text(
                                  '${i + 1}',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: detail.primaryColor,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                item.note,
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  color: AppColors.gray700,
                                  height: 1.45,
                                ),
                              ),
                            ),
                            PopupMenuButton<String>(
                              padding: EdgeInsets.zero,
                              icon: const Icon(
                                Icons.more_vert_rounded,
                                size: 18,
                                color: AppColors.gray400,
                              ),
                              onSelected: (value) {
                                if (value == 'edit') onEditNote(item);
                                if (value == 'delete') onDeleteNote(item);
                              },
                              itemBuilder: (_) => const [
                                PopupMenuItem(
                                  value: 'edit',
                                  child: Text('Editar'),
                                ),
                                PopupMenuItem(
                                  value: 'delete',
                                  child: Text('Excluir'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 4),
                    InkWell(
                      onTap: onAddNote,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: AppColors.blueLight,
                            width: 1,
                            style: BorderStyle.solid,
                          ),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Center(
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.add_rounded,
                                size: 14,
                                color: detail.primaryColor,
                              ),
                              SizedBox(width: 4),
                              Text(
                                'Adicionar nota',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                  color: detail.primaryColor,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

// ======================================================================
// Shared section header
// ======================================================================

class _SectionHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  const _SectionHeader({required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.4,
                  color: AppColors.gray400,
                ),
              ),
              if (subtitle != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    subtitle!,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.gray500,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
