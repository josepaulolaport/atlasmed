import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_representatives_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/create_admin_professional_sheet.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/relationship_stars.dart';

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
  final String? facilityId;

  @override
  ConsumerState<RepresentativeDetailScreen> createState() =>
      _RepresentativeDetailScreenState();
}

class _RepresentativeDetailScreenState
    extends ConsumerState<RepresentativeDetailScreen> {
  late AdministrativeProfessional _professional = widget.professional;
  bool _savingRelationship = false;

  bool get _useApi {
    final id = widget.facilityId;
    if (id == null || id.isEmpty) return false;
    return !id.startsWith('near-') && !id.endsWith(':empty');
  }

  @override
  Widget build(BuildContext context) {
    final chips = _professional.roleChipLabels;
    final canEdit = ref.watch(canMutateProfessionalProvider);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        Navigator.of(context).pop(_professional);
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFf8f9fb),
        appBar: AppBar(
          backgroundColor: const Color(0xFFf8f9fb),
          elevation: 0,
          foregroundColor: const Color(0xFF0f1729),
          title: const Text('Perfil do profissional'),
          actions: [
            if (canEdit)
              TextButton(onPressed: _edit, child: const Text('Editar')),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 40,
                    backgroundColor: const Color(0xFFeef4ff),
                    child: Text(
                      _initials(_professional.name),
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1e40af),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    _professional.name,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0f1729),
                    ),
                  ),
                  if (_professional.roleTitle != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      _professional.roleTitle!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                  ],
                  if (chips.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      alignment: WrapAlignment.center,
                      children: [
                        for (final label in chips) _Chip(label: label),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            _SectionCard(
              title: 'Relacionamento',
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: RelationshipStars(
                    score: _professional.relationshipScore,
                    onChanged: _savingRelationship ? null : _setRelationship,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Toque nas estrelas para definir (segure para limpar).',
                  style: TextStyle(fontSize: 11.5, color: Color(0xFF9ca3af)),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _SectionCard(
              title: 'Contato',
              children: [
                _InfoRow(
                  icon: Icons.phone_outlined,
                  label: 'Telefone',
                  value: _professional.phone,
                  onTap: _professional.phone != null
                      ? () => launchContactUrl(
                          context,
                          url: callUrl(_professional.phone),
                          contactLabel: 'telefone',
                        )
                      : null,
                  onLongPress: _professional.phone != null
                      ? () => _copy(context, _professional.phone!, 'Telefone')
                      : null,
                ),
                _InfoRow(
                  icon: Icons.email_outlined,
                  label: 'E-mail',
                  value: _professional.email,
                  onTap: _professional.email != null
                      ? () => launchContactUrl(
                          context,
                          url: emailUrl(_professional.email),
                          contactLabel: 'e-mail',
                        )
                      : null,
                  onLongPress: _professional.email != null
                      ? () => _copy(context, _professional.email!, 'E-mail')
                      : null,
                ),
              ],
            ),
            const SizedBox(height: 16),
            _SectionCard(
              title: 'Estabelecimento',
              children: [
                _InfoRow(
                  icon: Icons.local_hospital_outlined,
                  label: 'Clínica',
                  value: widget.facilityName,
                ),
              ],
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

class _Chip extends StatelessWidget {
  const _Chip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFeef4ff),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: Color(0xFF1e40af),
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
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
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: Color(0xFF9ca3af),
            ),
          ),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.onTap,
    this.onLongPress,
  });

  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      onLongPress: onLongPress,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Icon(icon, size: 17, color: const Color(0xFF9ca3af)),
            const SizedBox(width: 10),
            SizedBox(
              width: 80,
              child: Text(
                label,
                style: const TextStyle(fontSize: 13, color: Color(0xFF6b7280)),
              ),
            ),
            Expanded(
              child: Text(
                value ?? '—',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: value != null
                      ? const Color(0xFF1e40af)
                      : const Color(0xFF9ca3af),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
