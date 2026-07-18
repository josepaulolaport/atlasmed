import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';

/// Full profile of an administrative representative — pushed from the
/// "Profissionais administrativos" section. Mock-only in this phase: the
/// representative data comes from the already-loaded facility sections
/// rather than a dedicated by-id endpoint.
class RepresentativeDetailScreen extends StatelessWidget {
  const RepresentativeDetailScreen({
    super.key,
    required this.professional,
    required this.facilityName,
  });

  final AdministrativeProfessional professional;
  final String facilityName;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFf8f9fb),
      appBar: AppBar(
        backgroundColor: const Color(0xFFf8f9fb),
        elevation: 0,
        foregroundColor: const Color(0xFF0f1729),
        title: const Text('Perfil do profissional'),
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
                    _initials(professional.name),
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1e40af),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  professional.name,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0f1729),
                  ),
                ),
                if (professional.roleTitle != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    professional.roleTitle!,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF6b7280),
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFf3f4f6),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    professional.contactTypeLabel,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF4b5563),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _SectionCard(
            title: 'Contato',
            children: [
              _InfoRow(
                icon: Icons.phone_outlined,
                label: 'Telefone',
                value: professional.phone,
                onTap: professional.phone != null
                    ? () => launchContactUrl(
                        context,
                        url: callUrl(professional.phone),
                        contactLabel: 'telefone',
                      )
                    : null,
                onLongPress: professional.phone != null
                    ? () => _copy(context, professional.phone!, 'Telefone')
                    : null,
              ),
              _InfoRow(
                icon: Icons.email_outlined,
                label: 'E-mail',
                value: professional.email,
                onTap: professional.email != null
                    ? () => launchContactUrl(
                        context,
                        url: emailUrl(professional.email),
                        contactLabel: 'e-mail',
                      )
                    : null,
                onLongPress: professional.email != null
                    ? () => _copy(context, professional.email!, 'E-mail')
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
                value: facilityName,
              ),
            ],
          ),
        ],
      ),
    );
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
