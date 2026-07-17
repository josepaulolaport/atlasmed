import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/contact_actions.dart';

/// Full list of confirmed CRM doctors at an establishment — pushed from the
/// "Ver todos" affordance on the Médicos section, so users can scan every
/// doctor quickly instead of swiping through the card carousel.
class DoctorsListScreen extends StatelessWidget {
  const DoctorsListScreen({
    super.key,
    required this.doctors,
    required this.facilityName,
  });

  final List<FacilityCrmDoctor> doctors;
  final String facilityName;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFf8f9fb),
      appBar: AppBar(
        backgroundColor: const Color(0xFFf8f9fb),
        elevation: 0,
        foregroundColor: const Color(0xFF0f1729),
        title: Text('Médicos · ${doctors.length}'),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: doctors.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _DoctorRow(doctor: doctors[i]),
      ),
    );
  }
}

class _DoctorRow extends StatelessWidget {
  const _DoctorRow({required this.doctor});

  final FacilityCrmDoctor doctor;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push('/workspace/doctor/${doctor.id}'),
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
                color: HSLColor.fromAHSL(1, doctor.hue, 0.2, 0.9).toColor(),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(
                  doctor.initials,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: HSLColor.fromAHSL(
                      1,
                      doctor.hue,
                      0.6,
                      0.35,
                    ).toColor(),
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
                    doctor.name,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0f1729),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (doctor.specialty != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      doctor.specialty!,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF6b7280),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (doctor.crm != null) ...[
                    const SizedBox(height: 1),
                    Text(
                      doctor.crm!,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF9ca3af),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (_badges.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Wrap(spacing: 4, runSpacing: 4, children: _badges),
                  ],
                ],
              ),
            ),
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (doctor.phone != null)
                  IconButton(
                    icon: const Icon(Icons.phone_outlined, size: 18),
                    color: const Color(0xFF1e40af),
                    onPressed: () => launchContactUrl(
                      context,
                      url: callUrl(doctor.phone),
                      contactLabel: 'telefone',
                    ),
                  ),
                if (doctor.email != null)
                  IconButton(
                    icon: const Icon(Icons.email_outlined, size: 18),
                    color: const Color(0xFF1e40af),
                    onPressed: () => launchContactUrl(
                      context,
                      url: emailUrl(doctor.email),
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

  List<Widget> get _badges {
    final badges = <Widget>[];
    if (doctor.roleBadge != null) {
      badges.add(_MiniBadge(label: doctor.roleBadge!, emphasized: true));
    }
    if (doctor.isPrescriber) badges.add(const _MiniBadge(label: 'Prescritor'));
    if (doctor.isBuyer) badges.add(const _MiniBadge(label: 'Comprador'));
    if (doctor.isDecisionMaker) badges.add(const _MiniBadge(label: 'Decisor'));
    return badges;
  }
}

class _MiniBadge extends StatelessWidget {
  const _MiniBadge({required this.label, this.emphasized = false});

  final String label;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final color = emphasized
        ? const Color(0xFF7c3aed)
        : const Color(0xFF1e40af);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
