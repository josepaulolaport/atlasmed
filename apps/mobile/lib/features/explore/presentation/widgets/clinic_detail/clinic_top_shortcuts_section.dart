import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/clinic_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_admin_info_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_registration_documents_screen.dart';

/// Two "Título · Badge · >" shortcut cards, right below the quick actions
/// strip — entry points to the dedicated "Cadastro" (registration
/// documents) and "Dados administrativos" (contact/admin fields) screens.
/// Each badge is a completeness signal so the rep can see at a glance
/// whether anything needs attention without opening the screen.
class ClinicTopShortcutsSection extends StatefulWidget {
  const ClinicTopShortcutsSection({
    super.key,
    required this.facilityName,
    required this.detail,
    this.documents,
  });

  final String facilityName;
  final ClinicDetail detail;

  /// `null` while the sections provider is still loading — badge stays
  /// neutral instead of flashing a false "Completo".
  final List<EstablishmentDocument>? documents;

  @override
  State<ClinicTopShortcutsSection> createState() =>
      _ClinicTopShortcutsSectionState();
}

class _ClinicTopShortcutsSectionState extends State<ClinicTopShortcutsSection> {
  List<EstablishmentDocument>? _documents;

  @override
  void initState() {
    super.initState();
    _documents = widget.documents == null ? null : List.of(widget.documents!);
  }

  @override
  void didUpdateWidget(covariant ClinicTopShortcutsSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.documents != widget.documents) {
      _documents = widget.documents == null ? null : List.of(widget.documents!);
    }
  }

  @override
  Widget build(BuildContext context) {
    final docs = _documents;
    final pendingDocs = docs?.where((d) => d.status.needsAction).length;
    final adminPending = _adminInfoPendingCount(widget.detail);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      child: Column(
        children: [
          _ShortcutCard(
            icon: Icons.assignment_outlined,
            title: 'Cadastro',
            badge: pendingDocs == null
                ? const _ShortcutBadge.neutral('…')
                : pendingDocs == 0
                ? const _ShortcutBadge.complete('Completo')
                : _ShortcutBadge.pending(
                    '$pendingDocs pendente${pendingDocs == 1 ? '' : 's'}',
                  ),
            onTap: () async {
              final updated = await Navigator.of(context)
                  .push<List<EstablishmentDocument>>(
                    MaterialPageRoute(
                      builder: (_) => ClinicRegistrationDocumentsScreen(
                        facilityName: widget.facilityName,
                        initialDocuments: docs ?? const [],
                      ),
                    ),
                  );
              if (updated != null && mounted) {
                setState(() => _documents = updated);
              }
            },
          ),
          const SizedBox(height: 8),
          _ShortcutCard(
            icon: Icons.admin_panel_settings_outlined,
            title: 'Dados administrativos',
            badge: adminPending == 0
                ? const _ShortcutBadge.complete('Completo')
                : _ShortcutBadge.pending(
                    '$adminPending pendente${adminPending == 1 ? '' : 's'}',
                  ),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ClinicAdminInfoScreen(detail: widget.detail),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Counts empty fields among the ones shown on `ClinicAdminInfoSection` —
/// tax ID, address, phone, email, website, responsible doctor, hours.
/// "Cliente desde" is excluded: it's a system field, not something a rep
/// fills in, so it shouldn't count against completeness.
int _adminInfoPendingCount(ClinicDetail detail) {
  bool empty(String? v) => v == null || v.trim().isEmpty;
  final hasTaxId =
      (detail.cnpj?.trim().isNotEmpty ?? false) ||
      (detail.cpf?.trim().isNotEmpty ?? false);
  final fields = <bool>[
    !hasTaxId,
    empty(detail.streetAddress),
    empty(detail.phone),
    empty(detail.email),
    empty(detail.website),
    empty(detail.responsibleDoctor),
    empty(detail.openingHours),
  ];
  return fields.where((isEmpty) => isEmpty).length;
}

class _ShortcutCard extends StatelessWidget {
  const _ShortcutCard({
    required this.icon,
    required this.title,
    required this.badge,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final _ShortcutBadge badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
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
          children: [
            Icon(icon, size: 19, color: const Color(0xFF1e40af)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0f1729),
                ),
              ),
            ),
            const SizedBox(width: 8),
            badge,
            const SizedBox(width: 6),
            const Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: Color(0xFF9ca3af),
            ),
          ],
        ),
      ),
    );
  }
}

class _ShortcutBadge extends StatelessWidget {
  const _ShortcutBadge.complete(this.label) : _tone = _BadgeTone.complete;

  const _ShortcutBadge.pending(this.label) : _tone = _BadgeTone.pending;

  const _ShortcutBadge.neutral(this.label) : _tone = _BadgeTone.neutral;

  final String label;
  final _BadgeTone _tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (_tone) {
      _BadgeTone.complete => (const Color(0xFFe7f6ec), const Color(0xFF1f9254)),
      _BadgeTone.pending => (const Color(0xFFfef3d5), const Color(0xFFc6861b)),
      _BadgeTone.neutral => (const Color(0xFFf3f4f6), const Color(0xFF9ca3af)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
      ),
    );
  }
}

enum _BadgeTone { complete, pending, neutral }
