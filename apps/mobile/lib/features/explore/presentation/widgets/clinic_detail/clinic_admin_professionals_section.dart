import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/relationship_stars.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/representative_detail_screen.dart';

/// "Profissionais administrativos" — snapping PageView of compact cards,
/// mirroring the Médicos section: essential contact info (phone/email), a
/// badge area, and a relationship rating. The "Ver todos" link to the full
/// list lives on the section header.
class ClinicAdminProfessionalsSection extends StatefulWidget {
  const ClinicAdminProfessionalsSection({
    super.key,
    required this.professionals,
    required this.facilityName,
  });

  final List<AdministrativeProfessional> professionals;
  final String facilityName;

  @override
  State<ClinicAdminProfessionalsSection> createState() =>
      _ClinicAdminProfessionalsSectionState();
}

class _ClinicAdminProfessionalsSectionState
    extends State<ClinicAdminProfessionalsSection> {
  final PageController _controller = PageController(viewportFraction: 0.86);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.professionals.isEmpty) {
      return const ClinicDetailCard(
        child: Center(
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'Nenhum contato administrativo cadastrado',
              style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)),
            ),
          ),
        ),
      );
    }

    return SizedBox(
      height: 220,
      child: PageView.builder(
        controller: _controller,
        itemCount: widget.professionals.length,
        itemBuilder: (_, i) => Padding(
          padding: EdgeInsets.only(
            left: i == 0 ? 20 : 6,
            right: i == widget.professionals.length - 1 ? 20 : 6,
          ),
          child: _ProfessionalCard(
            professional: widget.professionals[i],
            facilityName: widget.facilityName,
          ),
        ),
      ),
    );
  }
}

class _ProfessionalCard extends StatelessWidget {
  const _ProfessionalCard({
    required this.professional,
    required this.facilityName,
  });

  final AdministrativeProfessional professional;
  final String facilityName;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
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
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFeef4ff),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    _initials(professional.name),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1e40af),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      professional.name,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0f1729),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (professional.roleTitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        professional.roleTitle!,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF6b7280),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [_Flag(label: professional.contactTypeLabel)],
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, color: Color(0xFFf3f4f6)),
          const SizedBox(height: 8),
          _ContactRow(
            icon: Icons.phone_outlined,
            value: professional.phone,
            onTap: professional.phone != null
                ? () => launchContactUrl(
                    context,
                    url: callUrl(professional.phone),
                    contactLabel: 'telefone',
                  )
                : null,
          ),
          const SizedBox(height: 6),
          _ContactRow(
            icon: Icons.email_outlined,
            value: professional.email,
            onTap: professional.email != null
                ? () => launchContactUrl(
                    context,
                    url: emailUrl(professional.email),
                    contactLabel: 'e-mail',
                  )
                : null,
          ),
          const SizedBox(height: 8),
          RelationshipStars(score: professional.relationshipScore),
          const Spacer(),
          const Divider(height: 1, color: Color(0xFFf3f4f6)),
          const SizedBox(height: 8),
          InkWell(
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => RepresentativeDetailScreen(
                  professional: professional,
                  facilityName: facilityName,
                ),
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Ver perfil completo',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF1e40af),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 16,
                    color: Color(0xFF1e40af),
                  ),
                ],
              ),
            ),
          ),
        ],
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

class _ContactRow extends StatelessWidget {
  const _ContactRow({required this.icon, required this.value, this.onTap});

  final IconData icon;
  final String? value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Row(
        children: [
          Icon(
            icon,
            size: 15,
            color: value != null
                ? const Color(0xFF1e40af)
                : const Color(0xFFcbd5e1),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value ?? 'Não informado',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: value != null ? FontWeight.w500 : FontWeight.w400,
                color: value != null
                    ? const Color(0xFF0f1729)
                    : const Color(0xFF9ca3af),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _Flag extends StatelessWidget {
  const _Flag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFeef4ff),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: Color(0xFF1e40af),
        ),
      ),
    );
  }
}
