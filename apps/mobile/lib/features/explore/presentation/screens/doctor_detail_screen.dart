import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/features/explore/data/professional_note.dart';
import 'package:atlasmed_mobile_app/features/explore/data/doctor_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/editable_field_row.dart';

// ======================================================================
// DoctorDetailScreen — full doctor profile with multiple sections
// ======================================================================

class DoctorDetailScreen extends ConsumerWidget {
  final String doctorId;

  const DoctorDetailScreen({super.key, required this.doctorId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(doctorDetailProvider(doctorId));

    return Scaffold(
      backgroundColor: const Color(0xFFf8f9fb),
      body: detailAsync.when(
        loading: () => _loadingSkeleton(context),
        error: (err, _) => _errorView(context, err.toString()),
        data: (detail) =>
            _DoctorDetailContent(detail: detail, doctorId: doctorId),
      ),
    );
  }

  Widget _loadingSkeleton(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          _buildHeaderShimmer(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: List.generate(
                6,
                (_) => Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Container(
                    height: 80,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
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

  Widget _buildHeaderShimmer() {
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
              const Icon(
                Icons.error_outline,
                size: 48,
                color: Color(0xFFb84545),
              ),
              const SizedBox(height: 12),
              const Text(
                'Erro ao carregar',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF0f1729),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: Color(0xFF6b7280)),
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
  final DoctorDetail detail;
  final String doctorId;
  const _DoctorDetailContent({required this.detail, required this.doctorId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notesAsync = ref.watch(professionalNotesProvider(doctorId));

    return SafeArea(
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _DoctorHeader(detail: detail),
            _DoctorQuickActions(detail: detail),
            const SizedBox(height: 16),
            _DoctorProfileFields(detail: detail, doctorId: doctorId),
            const SizedBox(height: 16),
            _DoctorClinics(clinics: detail.clinics),
            const SizedBox(height: 16),
            _DoctorNotes(
              notes: notesAsync.valueOrNull ?? const [],
              isLoading: notesAsync.isLoading,
              onAddNote: () => _showAddNoteSheet(context, ref, doctorId),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

Future<void> _showAddNoteSheet(
  BuildContext context,
  WidgetRef ref,
  String professionalId,
) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    builder: (_) =>
        _AddDoctorNoteSheet(professionalId: professionalId, ref: ref),
  );
}

/// Owns its controllers so dismissing an empty sheet cannot race
/// InheritedWidget teardown (`_dependents.isEmpty`).
class _AddDoctorNoteSheet extends StatefulWidget {
  const _AddDoctorNoteSheet({required this.professionalId, required this.ref});

  final String professionalId;
  final WidgetRef ref;

  @override
  State<_AddDoctorNoteSheet> createState() => _AddDoctorNoteSheetState();
}

class _AddDoctorNoteSheetState extends State<_AddDoctorNoteSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _controller;
  var _isSaving = false;
  String? _errorMessage;

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

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });
    try {
      await widget.ref
          .read(professionalNotesRepositoryProvider(widget.professionalId))
          .createNote(_controller.text.trim());
      widget.ref.invalidate(professionalNotesProvider(widget.professionalId));
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
            const Text(
              'Adicionar nota',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            const Text(
              'Esta nota ficará visível somente para você.',
              style: TextStyle(fontSize: 13, color: Color(0xFF6b7280)),
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
                style: const TextStyle(color: Color(0xFFb84545), fontSize: 13),
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
  final DoctorDetail detail;
  const _DoctorHeader({required this.detail});

  @override
  Widget build(BuildContext context) {
    final h = detail.hue;
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            HSLColor.fromAHSL(1, h, 0.58, 0.24).toColor(),
            HSLColor.fromAHSL(1, h, 0.52, 0.38).toColor(),
            HSLColor.fromAHSL(1, h, 0.48, 0.48).toColor(),
          ],
        ),
      ),
      child: Stack(
        children: [
          // Decorative glow
          Positioned(
            top: -60,
            right: -60,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    HSLColor.fromAHSL(0.35, h, 0.80, 0.85).toColor(),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top bar
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 4, 8, 0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _GlassButton(
                        child: const Icon(
                          Icons.arrow_back_rounded,
                          color: Colors.white,
                          size: 18,
                        ),
                        onTap: () => context.pop(),
                      ),
                      _GlassButton(
                        child: const Icon(
                          Icons.more_horiz_rounded,
                          color: Colors.white,
                          size: 18,
                        ),
                        onTap: () {},
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                // Avatar + name
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
                          color: HSLColor.fromAHSL(1, h, 0.45, 0.72).toColor(),
                        ),
                        child: Center(
                          child: Text(
                            detail.initials,
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.5,
                              color: HSLColor.fromAHSL(
                                1,
                                h,
                                0.60,
                                0.22,
                              ).toColor(),
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
                            const SizedBox(height: 4),
                            Text(
                              detail.crm,
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.white.withValues(alpha: 0.78),
                              ),
                            ),
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
                const SizedBox(height: 22),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GlassButton extends StatelessWidget {
  final Widget child;
  final VoidCallback onTap;
  const _GlassButton({required this.child, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(19),
        onTap: onTap,
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
            color: Colors.white.withValues(alpha: 0.12),
          ),
          child: child,
        ),
      ),
    );
  }
}

// ======================================================================
// 2. DoctorQuickActions — call, whatsapp, email, new visit
// ======================================================================

class _DoctorQuickActions extends StatelessWidget {
  final DoctorDetail detail;
  const _DoctorQuickActions({required this.detail});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      transform: Matrix4.translationValues(0, -14, 0),
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFedeff3)),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0f1729).withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          _QuickAction(
            label: 'Ligar',
            icon: Icons.phone_rounded,
            hue: detail.hue,
            onTap: () => launchContactUrl(
              context,
              url: callUrl(detail.phone),
              contactLabel: 'telefone',
            ),
          ),
          _QuickAction(
            label: 'WhatsApp',
            icon: Icons.chat_rounded,
            hue: detail.hue,
            onTap: () => launchContactUrl(
              context,
              url: whatsappUrl(detail.whatsapp),
              contactLabel: 'WhatsApp',
            ),
          ),
          _QuickAction(
            label: 'E-mail',
            icon: Icons.email_rounded,
            hue: detail.hue,
            onTap: () => launchContactUrl(
              context,
              url: emailUrl(detail.email),
              contactLabel: 'e-mail',
            ),
          ),
          _QuickAction(
            label: 'Nova visita',
            icon: Icons.event_rounded,
            hue: detail.hue,
            onTap: () {},
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final String label;
  final IconData icon;
  final double hue;
  final VoidCallback? onTap;
  const _QuickAction({
    required this.label,
    required this.icon,
    required this.hue,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDisabled = onTap == null;
    return Expanded(
      child: InkWell(
        onTap: isDisabled ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isDisabled
                      ? const Color(0xFFf3f4f6)
                      : HSLColor.fromAHSL(1, hue, 0.60, 0.94).toColor(),
                ),
                child: Icon(
                  icon,
                  size: 18,
                  color: isDisabled
                      ? const Color(0xFFd1d5db)
                      : HSLColor.fromAHSL(1, hue, 0.55, 0.30).toColor(),
                ),
              ),
              const SizedBox(height: 5),
              Text(
                label,
                style: TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.1,
                  color: isDisabled
                      ? const Color(0xFFd1d5db)
                      : const Color(0xFF0f1729),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ======================================================================
// 4. DoctorProfileFields — editable profile via direct PATCH
// ======================================================================

class _DoctorProfileFields extends ConsumerWidget {
  final DoctorDetail detail;
  final String doctorId;
  const _DoctorProfileFields({required this.detail, required this.doctorId});

  void _edit(
    BuildContext context,
    WidgetRef ref, {
    required String label,
    required String? value,
    required Future<Map<String, dynamic>> Function(String raw) buildPatch,
    TextInputType keyboardType = TextInputType.text,
    int? maxLength,
    String? hint,
  }) {
    _showDirectEditSheet(
      context,
      ref: ref,
      professionalId: doctorId,
      label: label,
      initialValue: value,
      keyboardType: keyboardType,
      maxLength: maxLength,
      hint: hint,
      buildPatch: buildPatch,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFedeff3)),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0f1729).withValues(alpha: 0.03),
              blurRadius: 2,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 14, 16, 4),
              child: Text(
                'DADOS DO PROFISSIONAL',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: Color(0xFF8a94a6),
                ),
              ),
            ),
            EditableFieldRow(
              label: 'Nome',
              value: detail.name,
              icon: Icons.person_outline_rounded,
              onEdit: () => _edit(
                context,
                ref,
                label: 'Nome',
                value: detail.name,
                buildPatch: (raw) async {
                  final trimmed = raw.trim();
                  if (trimmed.isEmpty) {
                    throw const FormatException('Informe o nome.');
                  }
                  final parts = trimmed
                      .split(RegExp(r'\s+'))
                      .where((p) => p.isNotEmpty)
                      .toList();
                  final first = parts.first;
                  final last = parts.length > 1
                      ? parts.sublist(1).join(' ')
                      : detail.lastName.trim().isNotEmpty
                      ? detail.lastName
                      : first;
                  return {
                    'firstName': first,
                    'lastName': last,
                    'fullName': trimmed,
                  };
                },
              ),
            ),
            EditableFieldRow(
              label: 'Especialidade',
              value: detail.specialty.isEmpty ? null : detail.specialty,
              icon: Icons.medical_services_outlined,
              onEdit: () => _edit(
                context,
                ref,
                label: 'Especialidade',
                value: detail.specialty,
                buildPatch: (raw) async => {
                  'primarySpecialtyLabel': _nullableTrim(raw),
                },
              ),
            ),
            EditableFieldRow(
              label: 'CRM',
              value: detail.crmNumber,
              icon: Icons.badge_outlined,
              onEdit: () => _edit(
                context,
                ref,
                label: 'Número do CRM',
                value: detail.crmNumber,
                keyboardType: TextInputType.number,
                maxLength: 30,
                buildPatch: (raw) async => {
                  'crmNumber': _nullableTrim(raw),
                },
              ),
            ),
            EditableFieldRow(
              label: 'UF do CRM',
              value: detail.crmState,
              icon: Icons.map_outlined,
              onEdit: () => _edit(
                context,
                ref,
                label: 'UF do CRM',
                value: detail.crmState,
                maxLength: 2,
                hint: 'Ex: SP',
                buildPatch: (raw) async {
                  final trimmed = raw.trim().toUpperCase();
                  if (trimmed.isEmpty) return {'crmState': null};
                  if (trimmed.length != 2) {
                    throw const FormatException('UF deve ter 2 letras.');
                  }
                  return {'crmState': trimmed};
                },
              ),
            ),
            EditableFieldRow(
              label: 'Formação',
              value: detail.faculty,
              icon: Icons.school_outlined,
              onEdit: () => _edit(
                context,
                ref,
                label: 'Formação',
                value: detail.faculty,
                buildPatch: (raw) async => {'faculty': _nullableTrim(raw)},
              ),
            ),
            EditableFieldRow(
              label: 'Residência',
              value: detail.residency,
              icon: Icons.local_hospital_outlined,
              onEdit: () => _edit(
                context,
                ref,
                label: 'Residência',
                value: detail.residency,
                buildPatch: (raw) async => {'residency': _nullableTrim(raw)},
              ),
            ),
            EditableFieldRow(
              label: 'Aniversário',
              value: detail.birthday,
              icon: Icons.cake_outlined,
              onEdit: () => _edit(
                context,
                ref,
                label: 'Aniversário',
                value: detail.birthday,
                keyboardType: TextInputType.datetime,
                hint: 'dd/mm/aaaa',
                buildPatch: (raw) async {
                  final iso = _parseBirthDateToIso(raw);
                  return {'birthDate': iso};
                },
              ),
            ),
            EditableFieldRow(
              label: 'Time',
              value: detail.team,
              icon: Icons.sports_soccer_outlined,
              onEdit: () => _edit(
                context,
                ref,
                label: 'Time',
                value: detail.team,
                buildPatch: (raw) async => {'favoriteTeam': _nullableTrim(raw)},
              ),
            ),
            EditableFieldRow(
              label: 'Interesses',
              value: detail.interests,
              icon: Icons.favorite_outline_rounded,
              onEdit: () => _edit(
                context,
                ref,
                label: 'Interesses',
                value: detail.interests,
                buildPatch: (raw) async => {'hobbies': _nullableTrim(raw)},
              ),
            ),
            EditableFieldRow(
              label: 'Idiomas',
              value: detail.language,
              icon: Icons.translate_rounded,
              onEdit: () => _edit(
                context,
                ref,
                label: 'Idiomas',
                value: detail.language,
                buildPatch: (raw) async => {'languages': _nullableTrim(raw)},
              ),
            ),
            EditableFieldRow(
              label: 'Telefone',
              value: detail.phone,
              icon: Icons.phone_outlined,
              onEdit: () => _edit(
                context,
                ref,
                label: 'Telefone',
                value: detail.phone,
                keyboardType: TextInputType.phone,
                maxLength: 30,
                buildPatch: (raw) async => {'mobilePhone': _nullableTrim(raw)},
              ),
            ),
            EditableFieldRow(
              label: 'WhatsApp',
              value: detail.whatsapp,
              icon: Icons.chat_outlined,
              onEdit: () => _edit(
                context,
                ref,
                label: 'WhatsApp',
                value: detail.whatsapp,
                keyboardType: TextInputType.phone,
                maxLength: 30,
                buildPatch: (raw) async => {
                  'whatsappNumber': _nullableTrim(raw),
                },
              ),
            ),
            EditableFieldRow(
              label: 'E-mail',
              value: detail.email,
              icon: Icons.email_outlined,
              showDivider: false,
              onEdit: () => _edit(
                context,
                ref,
                label: 'E-mail',
                value: detail.email,
                keyboardType: TextInputType.emailAddress,
                buildPatch: (raw) async => {'email': _nullableTrim(raw)},
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String? _nullableTrim(String raw) {
  final trimmed = raw.trim();
  return trimmed.isEmpty ? null : trimmed;
}

/// Accepts `dd/mm/yyyy` or `yyyy-mm-dd`. Empty clears.
String? _parseBirthDateToIso(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;
  final isoMatch = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(trimmed);
  if (isoMatch != null) return trimmed;
  final brMatch = RegExp(r'^(\d{2})/(\d{2})/(\d{4})$').firstMatch(trimmed);
  if (brMatch != null) {
    return '${brMatch.group(3)}-${brMatch.group(2)}-${brMatch.group(1)}';
  }
  throw const FormatException('Use o formato dd/mm/aaaa.');
}

Future<void> _showDirectEditSheet(
  BuildContext context, {
  required WidgetRef ref,
  required String professionalId,
  required String label,
  required String? initialValue,
  required Future<Map<String, dynamic>> Function(String raw) buildPatch,
  TextInputType keyboardType = TextInputType.text,
  int? maxLength,
  String? hint,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    builder: (_) => _DirectEditProfessionalSheet(
      professionalId: professionalId,
      label: label,
      initialValue: initialValue,
      buildPatch: buildPatch,
      keyboardType: keyboardType,
      maxLength: maxLength,
      hint: hint,
      ref: ref,
    ),
  );
}

class _DirectEditProfessionalSheet extends StatefulWidget {
  const _DirectEditProfessionalSheet({
    required this.professionalId,
    required this.label,
    required this.initialValue,
    required this.buildPatch,
    required this.ref,
    this.keyboardType = TextInputType.text,
    this.maxLength,
    this.hint,
  });

  final String professionalId;
  final String label;
  final String? initialValue;
  final Future<Map<String, dynamic>> Function(String raw) buildPatch;
  final WidgetRef ref;
  final TextInputType keyboardType;
  final int? maxLength;
  final String? hint;

  @override
  State<_DirectEditProfessionalSheet> createState() =>
      _DirectEditProfessionalSheetState();
}

class _DirectEditProfessionalSheetState
    extends State<_DirectEditProfessionalSheet> {
  late final TextEditingController _controller;
  var _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue ?? '');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });
    try {
      final patch = await widget.buildPatch(_controller.text);
      await widget.ref
          .read(professionalsRepositoryProvider(widget.professionalId))
          .updateProfessional(patch);
      widget.ref.invalidate(doctorDetailProvider(widget.professionalId));
      if (mounted) Navigator.pop(context);
    } on FormatException catch (e) {
      if (!mounted) return;
      setState(() {
        _isSaving = false;
        _errorMessage = e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isSaving = false;
        _errorMessage = 'Não foi possível salvar. Tente novamente.';
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Editar ${widget.label.toLowerCase()}',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            autofocus: true,
            keyboardType: widget.keyboardType,
            maxLength: widget.maxLength,
            textCapitalization: widget.keyboardType == TextInputType.emailAddress
                ? TextCapitalization.none
                : TextCapitalization.sentences,
            decoration: InputDecoration(
              labelText: widget.label,
              hintText: widget.hint,
              border: const OutlineInputBorder(),
            ),
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 8),
            Text(
              _errorMessage!,
              style: const TextStyle(color: Color(0xFFb84545), fontSize: 13),
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
    );
  }
}

// ======================================================================
// 6. DoctorClinics — clinics where they work
// ======================================================================

class _DoctorClinics extends StatelessWidget {
  final List<DoctorClinic> clinics;
  const _DoctorClinics({required this.clinics});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          title: clinics.isEmpty ? 'CLÍNICAS' : 'CLÍNICAS · ${clinics.length}',
          subtitle: 'somente leitura — associe na página da clínica',
        ),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: clinics.isEmpty
              ? const _EmptySectionCard(
                  message: 'Nenhuma clínica associada ainda.',
                )
              : Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: const Color(0xFFedeff3)),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF0f1729).withValues(alpha: 0.03),
                        blurRadius: 2,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Column(
                    children: List.generate(clinics.length, (i) {
                      final c = clinics[i];
                      return InkWell(
                        onTap: () {
                          context.push('/workspace/clinic/${c.id}');
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            border: i > 0
                                ? const Border(
                                    top: BorderSide(color: Color(0xFFeef0f3)),
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
                                      ? const Color(0xFFeef2ff)
                                      : const Color(0xFFf3f4f6),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Icon(
                                  Icons.local_hospital_rounded,
                                  size: 16,
                                  color: c.isMain
                                      ? const Color(0xFF1e40af)
                                      : const Color(0xFF6b7280),
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
                                              color: Color(0xFF0f1729),
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
                                              color: const Color(
                                                0xFF1e40af,
                                              ).withValues(alpha: 0.10),
                                              borderRadius:
                                                  BorderRadius.circular(999),
                                            ),
                                            child: const Text(
                                              'principal',
                                              style: TextStyle(
                                                fontSize: 9,
                                                fontWeight: FontWeight.w700,
                                                letterSpacing: 0.3,
                                                color: Color(0xFF1e40af),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 1),
                                    Text(
                                      '${c.role} · ${c.days}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: Color(0xFF6b7280),
                                      ),
                                    ),
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
// 8. DoctorNotes — field notes
// ======================================================================

class _DoctorNotes extends StatelessWidget {
  final List<ProfessionalNote> notes;
  final bool isLoading;
  final VoidCallback onAddNote;

  const _DoctorNotes({
    required this.notes,
    required this.isLoading,
    required this.onAddNote,
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
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: const Color(0xFFedeff3)),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0f1729).withValues(alpha: 0.03),
                  blurRadius: 2,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
            child: Column(
              children: [
                if (isLoading)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (notes.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      'Nenhuma nota adicionada ainda.',
                      style: TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                  )
                else
                  ...List.generate(notes.length, (i) {
                    return Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        border: i < notes.length - 1
                            ? const Border(
                                bottom: BorderSide(color: Color(0xFFeef0f3)),
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
                              color: const Color(0xFFeef2ff),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Center(
                              child: Text(
                                '${i + 1}',
                                style: const TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF1e40af),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              notes[i].note,
                              style: const TextStyle(
                                fontSize: 12.5,
                                color: Color(0xFF374151),
                                height: 1.45,
                              ),
                            ),
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
                        color: const Color(0xFFc7d2fe),
                        width: 1,
                        style: BorderStyle.solid,
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Center(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.add_rounded,
                            size: 14,
                            color: Color(0xFF1e40af),
                          ),
                          SizedBox(width: 4),
                          Text(
                            'Adicionar nota',
                            style: TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF1e40af),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ======================================================================
// Shared empty section card
// ======================================================================

class _EmptySectionCard extends StatelessWidget {
  final String message;
  const _EmptySectionCard({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFedeff3)),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0f1729).withValues(alpha: 0.03),
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Text(
        message,
        style: const TextStyle(fontSize: 12.5, color: Color(0xFF6b7280)),
      ),
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
                  color: Color(0xFF8a94a6),
                ),
              ),
              if (subtitle != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    subtitle!,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: Color(0xFF6b7280),
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
