import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/representative_detail_screen.dart';

/// Full list of administrative professionals at an establishment — pushed
/// from the "Ver todos" affordance on the Profissionais administrativos
/// section, so users can scan every contact quickly instead of swiping
/// through the card carousel.
class AdministrativeProfessionalsListScreen extends StatelessWidget {
  const AdministrativeProfessionalsListScreen({
    super.key,
    required this.professionals,
    required this.facilityName,
  });

  final List<AdministrativeProfessional> professionals;
  final String facilityName;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFf8f9fb),
      appBar: AppBar(
        backgroundColor: const Color(0xFFf8f9fb),
        elevation: 0,
        foregroundColor: const Color(0xFF0f1729),
        title: Text('Profissionais administrativos · ${professionals.length}'),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: professionals.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _ProfessionalRow(
          professional: professionals[i],
          facilityName: facilityName,
        ),
      ),
    );
  }
}

class _ProfessionalRow extends StatelessWidget {
  const _ProfessionalRow({
    required this.professional,
    required this.facilityName,
  });

  final AdministrativeProfessional professional;
  final String facilityName;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => RepresentativeDetailScreen(
            professional: professional,
            facilityName: facilityName,
          ),
        ),
      ),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(12),
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
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFeef4ff),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(
                  _initials(professional.name),
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF1e40af),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
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
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: [
                      _MiniBadge(label: professional.contactTypeLabel),
                    ],
                  ),
                ],
              ),
            ),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (professional.phone != null)
                  IconButton(
                    icon: const Icon(Icons.phone_outlined, size: 18),
                    color: const Color(0xFF1e40af),
                    onPressed: () => launchContactUrl(
                      context,
                      url: callUrl(professional.phone),
                      contactLabel: 'telefone',
                    ),
                  ),
                if (professional.email != null)
                  IconButton(
                    icon: const Icon(Icons.email_outlined, size: 18),
                    color: const Color(0xFF1e40af),
                    onPressed: () => launchContactUrl(
                      context,
                      url: emailUrl(professional.email),
                      contactLabel: 'e-mail',
                    ),
                  ),
              ],
            ),
          ],
        ),
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

class _MiniBadge extends StatelessWidget {
  const _MiniBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFF1e40af).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w600,
          color: Color(0xFF1e40af),
        ),
      ),
    );
  }
}
