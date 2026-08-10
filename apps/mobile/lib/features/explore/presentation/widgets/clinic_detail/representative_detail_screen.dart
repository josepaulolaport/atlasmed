import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_representatives_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/create_admin_professional_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/relationship_stars.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Full profile of an administrative representative.
class RepresentativeDetailScreen extends ConsumerStatefulWidget {
  const RepresentativeDetailScreen({
    super.key,
    required this.professional,
    required this.facilityName,
    this.facilityId,
  });

  final AdministrativeProfessional professional;
  final String facilityName;
  final int? facilityId;

  @override
  ConsumerState<RepresentativeDetailScreen> createState() =>
      _RepresentativeDetailScreenState();
}

class _RepresentativeDetailScreenState
    extends ConsumerState<RepresentativeDetailScreen> {
  late AdministrativeProfessional _professional = widget.professional;
  bool _savingRelationship = false;
  bool _ending = false;

  bool get _useApi {
    final id = widget.facilityId;
    return id != null && id > 0;
  }

  @override
  Widget build(BuildContext context) {
    final chips = _professional.roleChipLabels;
    final canEdit = ref.watch(canMutateProfessionalProvider);
    final relationshipScore = _professional.relationshipScore;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        Navigator.of(context).pop(_professional);
      },
      child: Scaffold(
        backgroundColor: AppColors.surfaceTertiary,
        appBar: AppBar(
          backgroundColor: AppColors.navyDeep,
          elevation: 0,
          foregroundColor: Colors.white,
          title: const Text(
            'Contato administrativo',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
          ),
          actions: [
            if (canEdit)
              IconButton(
                tooltip: 'Editar contato',
                onPressed: _edit,
                icon: const Icon(Icons.edit_outlined),
              ),
          ],
        ),
        body: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _ProfileHeader(
                initials: _initials(_professional.name),
                name: _professional.name,
                roleTitle: _professional.roleTitle,
                chips: chips,
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
              sliver: SliverList.list(
                children: [
                  _ContactActions(
                    phone: _professional.phone,
                    email: _professional.email,
                    onCall: _professional.phone == null
                        ? null
                        : () => launchContactUrl(
                            context,
                            url: callUrl(_professional.phone),
                            contactLabel: 'telefone',
                          ),
                    onEmail: _professional.email == null
                        ? null
                        : () => launchContactUrl(
                            context,
                            url: emailUrl(_professional.email),
                            contactLabel: 'e-mail',
                          ),
                  ),
                  const SizedBox(height: 24),
                  _SectionTitle(
                    title: 'Relacionamento',
                    trailing: _savingRelationship
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : _ScoreBadge(score: relationshipScore),
                  ),
                  const SizedBox(height: 10),
                  _Surface(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        RelationshipStars(
                          score: relationshipScore,
                          onChanged: _savingRelationship
                              ? null
                              : _setRelationship,
                          showLabel: false,
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Toque no lado esquerdo ou direito da estrela para avaliar de 1 a 10. Segure para limpar.',
                          style: TextStyle(
                            fontSize: 13,
                            height: 1.4,
                            color: AppColors.gray600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  const _SectionTitle(title: 'Dados de contato'),
                  const SizedBox(height: 10),
                  _Surface(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        _InfoRow(
                          icon: Icons.phone_outlined,
                          label: 'Telefone',
                          value: _professional.phone,
                          onTap: _professional.phone == null
                              ? null
                              : () => launchContactUrl(
                                  context,
                                  url: callUrl(_professional.phone),
                                  contactLabel: 'telefone',
                                ),
                          onCopy: _professional.phone == null
                              ? null
                              : () => _copy(
                                  context,
                                  _professional.phone!,
                                  'Telefone',
                                ),
                        ),
                        const Divider(height: 1, indent: 64),
                        _InfoRow(
                          icon: Icons.email_outlined,
                          label: 'E-mail',
                          value: _professional.email,
                          onTap: _professional.email == null
                              ? null
                              : () => launchContactUrl(
                                  context,
                                  url: emailUrl(_professional.email),
                                  contactLabel: 'e-mail',
                                ),
                          onCopy: _professional.email == null
                              ? null
                              : () => _copy(
                                  context,
                                  _professional.email!,
                                  'E-mail',
                                ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  const _SectionTitle(title: 'Vínculo'),
                  const SizedBox(height: 10),
                  _Surface(
                    padding: EdgeInsets.zero,
                    child: _InfoRow(
                      icon: Icons.local_hospital_outlined,
                      label: 'Clínica',
                      value: widget.facilityName,
                    ),
                  ),
                  if (canEdit && _useApi) ...[
                    const SizedBox(height: 32),
                    TextButton.icon(
                      onPressed: _ending ? null : _endAffiliation,
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.redDark,
                        minimumSize: const Size.fromHeight(48),
                      ),
                      icon: _ending
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.redDark,
                              ),
                            )
                          : const Icon(Icons.link_off_rounded),
                      label: const Text('Encerrar vínculo com a clínica'),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _edit() async {
    final updated = await showCreateAdminProfessionalSheet(
      context,
      facilityId: widget.facilityId,
      existing: _professional,
    );
    if (updated == null || !mounted) return;
    setState(() => _professional = updated);
  }

  Future<void> _endAffiliation() async {
    final facilityId = widget.facilityId;
    if (facilityId == null || facilityId <= 0) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Encerrar vínculo?'),
        content: Text(
          '${_professional.name} deixará de aparecer como contato desta clínica. '
          'O cadastro da pessoa permanece.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFFB42318),
            ),
            child: const Text('Encerrar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _ending = true);
    final repo = FacilityRepresentativesRepository(facilityId);
    try {
      await repo.endAffiliation(_professional.id);
    } on FacilityRepresentativesException catch (e) {
      if (!mounted) return;
      setState(() => _ending = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message ?? 'Falha ao encerrar vínculo'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    } finally {
      repo.dispose();
    }

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${_professional.name} desvinculado da clínica'),
        behavior: SnackBarBehavior.floating,
      ),
    );
    // List screen removes by personFacilityId when result is int.
    Navigator.of(context).pop<Object>(_professional.id);
  }

  Future<void> _setRelationship(int? level) async {
    final previous = _professional;
    setState(() {
      _professional = _professional.copyWith(
        relationshipScore: level,
        clearRelationshipScore: level == null,
      );
      _savingRelationship = true;
    });

    if (!_useApi) {
      setState(() => _savingRelationship = false);
      return;
    }

    final repo = FacilityRepresentativesRepository(widget.facilityId!);
    try {
      final saved = await repo.updateRepresentative(
        representativeId: _professional.id,
        relationshipLevel: level,
        clearRelationshipLevel: level == null,
      );
      if (!mounted) return;
      setState(() {
        _professional = saved;
        _savingRelationship = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _professional = previous;
        _savingRelationship = false;
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

  void _copy(BuildContext context, String value, String label) {
    Clipboard.setData(ClipboardData(text: value));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label copiado'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.initials,
    required this.name,
    required this.roleTitle,
    required this.chips,
  });

  final String initials;
  final String name;
  final String? roleTitle;
  final List<String> chips;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.navyDeep,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 72,
              height: 72,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.14),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
              ),
              child: Text(
                initials,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      fontSize: 23,
                      height: 1.15,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  if (roleTitle != null && roleTitle!.trim().isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      roleTitle!,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.35,
                        color: Colors.white.withValues(alpha: 0.76),
                      ),
                    ),
                  ],
                  if (chips.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final label in chips) _Chip(label: label),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
      ),
    );
  }
}

class _ContactActions extends StatelessWidget {
  const _ContactActions({
    required this.phone,
    required this.email,
    required this.onCall,
    required this.onEmail,
  });

  final String? phone;
  final String? email;
  final VoidCallback? onCall;
  final VoidCallback? onEmail;

  @override
  Widget build(BuildContext context) {
    final textScale = MediaQuery.textScalerOf(context).scale(1);
    return LayoutBuilder(
      builder: (context, constraints) {
        final stack = constraints.maxWidth < 300 || textScale > 1.3;
        final call = _ContactActionButton(
          icon: Icons.phone_rounded,
          label: phone == null ? 'Sem telefone' : 'Ligar',
          onPressed: onCall,
          primary: true,
        );
        final emailAction = _ContactActionButton(
          icon: Icons.email_outlined,
          label: email == null ? 'Sem e-mail' : 'Enviar e-mail',
          onPressed: onEmail,
        );

        if (stack) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [call, const SizedBox(height: 10), emailAction],
          );
        }

        return Row(
          children: [
            Expanded(child: call),
            const SizedBox(width: 10),
            Expanded(child: emailAction),
          ],
        );
      },
    );
  }
}

class _ContactActionButton extends StatelessWidget {
  const _ContactActionButton({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.primary = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final child = Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 19),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );

    if (primary) {
      return FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(50),
          backgroundColor: AppColors.navyBright,
          foregroundColor: Colors.white,
        ),
        child: child,
      );
    }

    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(50),
        foregroundColor: AppColors.navyBright,
        side: const BorderSide(color: AppColors.gray300),
      ),
      child: child,
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.trailing});

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 17,
              height: 1.2,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 12), trailing!],
      ],
    );
  }
}

class _ScoreBadge extends StatelessWidget {
  const _ScoreBadge({required this.score});

  final int? score;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: score == null ? AppColors.gray100 : AppColors.amber50,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        score == null ? 'Não avaliado' : '$score/10',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: score == null ? AppColors.gray600 : AppColors.amberDark,
        ),
      ),
    );
  }
}

class _Surface extends StatelessWidget {
  const _Surface({
    required this.child,
    this.padding = const EdgeInsets.all(16),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: AppColors.cardBg,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.navyDeep.withValues(alpha: 0.06),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.onTap,
    this.onCopy,
  });

  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback? onTap;
  final VoidCallback? onCopy;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: AppColors.blueLight,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 18, color: AppColors.navyBright),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray500,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    value ?? 'Não informado',
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.3,
                      fontWeight: FontWeight.w600,
                      color: value != null
                          ? AppColors.gray900
                          : AppColors.gray400,
                    ),
                  ),
                ],
              ),
            ),
            if (onCopy != null)
              IconButton(
                tooltip: 'Copiar $label',
                onPressed: onCopy,
                color: AppColors.gray500,
                icon: const Icon(Icons.copy_rounded, size: 19),
              )
            else if (onTap != null)
              const Icon(Icons.chevron_right_rounded, color: AppColors.gray400),
          ],
        ),
      ),
    );
  }
}
