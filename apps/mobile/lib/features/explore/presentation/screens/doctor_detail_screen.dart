import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../data/doctor_detail.dart';
import '../providers/explore_provider.dart';

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
        data: (detail) => _DoctorDetailContent(detail: detail),
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
              children: List.generate(6, (_) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Container(
                  height: 80,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              )),
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
              const Icon(Icons.error_outline, size: 48, color: Color(0xFFb84545)),
              const SizedBox(height: 12),
              const Text('Erro ao carregar',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF0f1729))),
              const SizedBox(height: 8),
              Text(message, textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: Color(0xFF6b7280))),
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

class _DoctorDetailContent extends StatelessWidget {
  final DoctorDetail detail;
  const _DoctorDetailContent({required this.detail});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _DoctorHeader(detail: detail),
            _DoctorQuickActions(detail: detail),
            const SizedBox(height: 16),
            if (detail.signals.isNotEmpty) ...[
              _DoctorSignals(signals: detail.signals),
              const SizedBox(height: 16),
            ],
            _DoctorPersonalCard(detail: detail),
            const SizedBox(height: 16),
            if (detail.prescribing.isNotEmpty) ...[
              _DoctorPrescribing(items: detail.prescribing),
              const SizedBox(height: 16),
            ],
            if (detail.clinics.isNotEmpty) ...[
              _DoctorClinics(clinics: detail.clinics),
              const SizedBox(height: 16),
            ],
            if (detail.visits.isNotEmpty) ...[
              _DoctorVisits(visits: detail.visits),
              const SizedBox(height: 16),
            ],
            if (detail.notes.isNotEmpty) ...[
              _DoctorNotes(notes: detail.notes),
              const SizedBox(height: 24),
            ],
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
            top: -60, right: -60,
            child: Container(
              width: 220, height: 220,
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
                        child: const Icon(Icons.arrow_back_rounded, color: Colors.white, size: 18),
                        onTap: () => context.pop(),
                      ),
                      _GlassButton(
                        child: const Icon(Icons.more_horiz_rounded, color: Colors.white, size: 18),
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
                        width: 72, height: 72,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 3),
                          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.22), blurRadius: 18, offset: const Offset(0, 6))],
                          color: HSLColor.fromAHSL(1, h, 0.45, 0.72).toColor(),
                        ),
                        child: Center(
                          child: Text(detail.initials,
                            style: TextStyle(
                              fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: -0.5,
                              color: HSLColor.fromAHSL(1, h, 0.60, 0.22).toColor(),
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
                              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.18),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(width: 5, height: 5, decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white)),
                                  const SizedBox(width: 6),
                                  Text('${detail.statusLabel} · ${detail.specialty}',
                                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.3, color: Colors.white)),
                                ],
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(detail.name,
                              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, letterSpacing: -0.5, height: 1.15, color: Colors.white)),
                            const SizedBox(height: 4),
                            Text(detail.crm,
                              style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.78))),
                            if (detail.residency != null) ...[
                              const SizedBox(height: 2),
                              Text(detail.residency!,
                                style: TextStyle(fontSize: 11.5, color: Colors.white.withValues(alpha: 0.72))),
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
          width: 38, height: 38,
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
        boxShadow: [BoxShadow(color: const Color(0xFF0f1729).withValues(alpha: 0.08), blurRadius: 24, offset: const Offset(0, 8))],
      ),
      child: Row(
        children: [
          _QuickAction(label: 'Ligar', icon: Icons.phone_rounded, hue: detail.hue, onTap: detail.phone != null ? () {} : null),
          _QuickAction(label: 'WhatsApp', icon: Icons.chat_rounded, hue: detail.hue, onTap: detail.whatsapp != null ? () {} : null),
          _QuickAction(label: 'E-mail', icon: Icons.email_rounded, hue: detail.hue, onTap: detail.email != null ? () {} : null),
          _QuickAction(label: 'Nova visita', icon: Icons.event_rounded, hue: detail.hue, onTap: () {}),
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
  const _QuickAction({required this.label, required this.icon, required this.hue, this.onTap});

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
                width: 36, height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isDisabled
                      ? const Color(0xFFf3f4f6)
                      : HSLColor.fromAHSL(1, hue, 0.60, 0.94).toColor(),
                ),
                child: Icon(icon, size: 18,
                  color: isDisabled
                      ? const Color(0xFFd1d5db)
                      : HSLColor.fromAHSL(1, hue, 0.55, 0.30).toColor()),
              ),
              const SizedBox(height: 5),
              Text(label,
                style: TextStyle(
                  fontSize: 10.5, fontWeight: FontWeight.w600, letterSpacing: 0.1,
                  color: isDisabled ? const Color(0xFFd1d5db) : const Color(0xFF0f1729),
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
// 3. DoctorSignals — info/warning/success cards
// ======================================================================

class _DoctorSignals extends StatelessWidget {
  final List<DoctorSignal> signals;
  const _DoctorSignals({required this.signals});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: signals.map((s) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: _SignalCard(signal: s),
        )).toList(),
      ),
    );
  }
}

class _SignalCard extends StatelessWidget {
  final DoctorSignal signal;
  const _SignalCard({required this.signal});

  @override
  Widget build(BuildContext context) {
    final (Color color, Color bg, IconData icon) = switch (signal.kind) {
      'good' => (const Color(0xFF16a373), const Color(0xFFe6f7f0), Icons.trending_up_rounded),
      'warn' => (const Color(0xFFc6861b), const Color(0xFFfef3d5), Icons.info_outline_rounded),
      _ => (const Color(0xFF1e40af), const Color(0xFFeef4ff), Icons.lightbulb_outline_rounded),
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
                Text(signal.title,
                  style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: color, height: 1.3)),
                if (signal.body.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(signal.body,
                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF4b5563), height: 1.35)),
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
  final DoctorDetail detail;
  const _DoctorPersonalCard({required this.detail});

  @override
  Widget build(BuildContext context) {
    final rows = [
      _InfoRow(icon: '🎓', label: 'Formação', value: detail.faculty),
      _InfoRow(icon: '🏥', label: 'Residência', value: detail.residency),
      _InfoRow(icon: '🎂', label: 'Aniversário', value: detail.birthday),
      _InfoRow(icon: '⚽', label: 'Time', value: detail.team),
      _InfoRow(icon: '♡', label: 'Interesses', value: detail.interests),
      _InfoRow(icon: '🗣', label: 'Idiomas', value: detail.language),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFedeff3)),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [BoxShadow(color: const Color(0xFF0f1729).withValues(alpha: 0.03), blurRadius: 2, offset: const Offset(0, 1))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Section header
            Row(
              children: [
                const Text('PESSOAL',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Color(0xFF8a94a6))),
                const SizedBox(width: 12),
                Expanded(child: Container(height: 1, color: const Color(0xFFeef0f3))),
              ],
            ),
            const SizedBox(height: 12),
            // Personal info grid
            Wrap(
              spacing: 12,
              runSpacing: 10,
              children: rows.where((r) => r.value != null).map((r) => SizedBox(
                width: (MediaQuery.of(context).size.width - 60) / 2,
                child: r,
              )).toList(),
            ),
            if (detail.phone != null || detail.email != null || detail.whatsapp != null) ...[
              Container(height: 1, color: const Color(0xFFeef0f3), margin: const EdgeInsets.symmetric(vertical: 14)),
              // Contacts
              if (detail.phone != null)
                _ContactRow(label: 'TELEFONE', value: detail.phone!, mono: true),
              if (detail.whatsapp != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: _ContactRow(label: 'WHATSAPP', value: detail.whatsapp!, mono: true),
                ),
              if (detail.email != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: _ContactRow(label: 'E-MAIL', value: detail.email!),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String icon;
  final String label;
  final String? value;
  const _InfoRow({required this.icon, required this.label, this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(icon, style: const TextStyle(fontSize: 14, height: 1)),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: Color(0xFF8a94a6))),
              const SizedBox(height: 2),
              Text(value ?? '',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF0f1729)),
                maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ],
    );
  }
}

class _ContactRow extends StatelessWidget {
  final String label;
  final String value;
  final bool mono;
  const _ContactRow({required this.label, required this.value, this.mono = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
          width: 68,
          child: Text(label,
            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: Color(0xFF8a94a6))),
        ),
        Expanded(
          child: Text(value,
            style: TextStyle(
              fontSize: 12.5, color: const Color(0xFF0f1729),
              fontFamily: mono ? 'monospace' : null,
            )),
        ),
      ],
    );
  }
}

// ======================================================================
// 5. DoctorPrescribing — product trends with share bars
// ======================================================================

class _DoctorPrescribing extends StatelessWidget {
  final List<DoctorPrescribingItem> items;
  const _DoctorPrescribing({required this.items});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(title: 'PRESCRIÇÃO · 6 MESES', subtitle: 'volume atribuído a esta médica'),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: const Color(0xFFedeff3)),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [BoxShadow(color: const Color(0xFF0f1729).withValues(alpha: 0.03), blurRadius: 2, offset: const Offset(0, 1))],
            ),
            child: Column(
              children: List.generate(items.length, (i) {
                final item = items[i];
                final max = item.trend.reduce((a, b) => a > b ? a : b);
                final positive = item.growth >= 0;
                return Column(
                  children: [
                    if (i > 0) Container(height: 1, color: const Color(0xFFeef0f3)),
                    Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Header row
                          Row(
                            children: [
                              Text(item.product,
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF0f1729), letterSpacing: -0.1)),
                              if (item.isNew) ...[
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFe6f7f0),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: const Text('novo',
                                    style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.3, color: Color(0xFF117a55))),
                                ),
                              ],
                              const Spacer(),
                              Text(item.volume,
                                style: const TextStyle(fontSize: 11, color: Color(0xFF6b7280))),
                              const SizedBox(width: 8),
                              Text(
                                '${positive ? '▲' : '▼'} ${item.growth.toStringAsFixed(0)}%',
                                style: TextStyle(
                                  fontSize: 11.5, fontWeight: FontWeight.w700,
                                  color: positive ? const Color(0xFF117a55) : const Color(0xFFb84545),
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
                                      width: 5, margin: const EdgeInsets.symmetric(horizontal: 1.5),
                                      height: pct * 28,
                                      decoration: BoxDecoration(
                                        color: v == item.trend.last
                                            ? const Color(0xFF1e40af)
                                            : const Color(0xFFc7d2fe),
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
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        const Text('Share da médica',
                                          style: TextStyle(fontSize: 10.5, color: Color(0xFF6b7280))),
                                        Text('${item.share}%',
                                          style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: Color(0xFF0f1729))),
                                      ],
                                    ),
                                    const SizedBox(height: 3),
                                    Container(
                                      height: 5,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFeef0f3),
                                        borderRadius: BorderRadius.circular(3),
                                      ),
                                      child: FractionallySizedBox(
                                        widthFactor: item.share / 100,
                                        child: Container(
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF1e40af),
                                            borderRadius: BorderRadius.circular(3),
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
        _SectionHeader(title: 'CLÍNICAS · ${clinics.length}', subtitle: 'onde atende'),
        const SizedBox(height: 6),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: const Color(0xFFedeff3)),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [BoxShadow(color: const Color(0xFF0f1729).withValues(alpha: 0.03), blurRadius: 2, offset: const Offset(0, 1))],
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
                      border: i > 0 ? const Border(top: BorderSide(color: Color(0xFFeef0f3))) : null,
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 34, height: 34,
                          decoration: BoxDecoration(
                            color: c.isMain ? const Color(0xFFeef2ff) : const Color(0xFFf3f4f6),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(Icons.local_hospital_rounded, size: 16,
                            color: c.isMain ? const Color(0xFF1e40af) : const Color(0xFF6b7280)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Flexible(
                                    child: Text(c.name,
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0f1729), letterSpacing: -0.1),
                                      overflow: TextOverflow.ellipsis),
                                  ),
                                  if (c.isMain) ...[
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF1e40af).withValues(alpha: 0.10),
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      child: const Text('principal',
                                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.3, color: Color(0xFF1e40af))),
                                    ),
                                  ],
                                ],
                              ),
                              const SizedBox(height: 1),
                              Text('${c.role} · ${c.days}',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF6b7280))),
                            ],
                          ),
                        ),
                        Icon(Icons.chevron_right_rounded, size: 18, color: const Color(0xFF8a94a6).withValues(alpha: 0.7)),
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
// 7. DoctorVisits — visit history
// ======================================================================

class _DoctorVisits extends StatelessWidget {
  final List<DoctorVisit> visits;
  const _DoctorVisits({required this.visits});

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
              border: Border.all(color: const Color(0xFFedeff3)),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [BoxShadow(color: const Color(0xFF0f1729).withValues(alpha: 0.03), blurRadius: 2, offset: const Offset(0, 1))],
            ),
            child: Column(
              children: List.generate(visits.length, (i) {
                final v = visits[i];
                final outcomeColor = switch (v.outcome) {
                  'positivo' => const Color(0xFF16a373),
                  'misto' => const Color(0xFFc6861b),
                  'neutro' => const Color(0xFF6b7280),
                  _ => const Color(0xFF6b7280),
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
                            Text(v.date.split(' · ').first,
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0f1729))),
                            Text(v.time,
                              style: const TextStyle(fontSize: 10, color: Color(0xFF9ca3af))),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Outcome indicator
                      Container(
                        width: 8, height: 8, margin: const EdgeInsets.only(top: 3),
                        decoration: BoxDecoration(color: outcomeColor, shape: BoxShape.circle),
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
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFf3f4f6),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(v.kind,
                                    style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: Color(0xFF6b7280))),
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(v.location,
                                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF9ca3af)),
                                    overflow: TextOverflow.ellipsis),
                                ),
                              ],
                            ),
                            if (v.note.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(v.note,
                                style: const TextStyle(fontSize: 11.5, color: Color(0xFF4b5563), height: 1.35),
                                maxLines: 3, overflow: TextOverflow.ellipsis),
                            ],
                            if (v.duration.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(Icons.access_time_rounded, size: 11, color: Color(0xFF9ca3af)),
                                  const SizedBox(width: 3),
                                  Text(v.duration,
                                    style: const TextStyle(fontSize: 10, color: Color(0xFF9ca3af))),
                                  if (v.orderValue != null) ...[
                                    const SizedBox(width: 8),
                                    const Icon(Icons.attach_money_rounded, size: 11, color: Color(0xFF16a373)),
                                    Text(v.orderValue!,
                                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF16a373))),
                                  ],
                                  // Consultant
                                  const Spacer(),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Container(
                                        width: 16, height: 16,
                                        decoration: BoxDecoration(
                                          shape: BoxShape.circle,
                                          color: HSLColor.fromAHSL(1, v.consultantHue, 0.40, 0.72).toColor(),
                                        ),
                                        child: Center(
                                          child: Text(v.consultantInitials,
                                            style: TextStyle(fontSize: 7, fontWeight: FontWeight.w700,
                                              color: HSLColor.fromAHSL(1, v.consultantHue, 0.60, 0.22).toColor()),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 3),
                                      Text(v.consultant,
                                        style: const TextStyle(fontSize: 9.5, color: Color(0xFF6b7280))),
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
  final List<String> notes;
  const _DoctorNotes({required this.notes});

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
              boxShadow: [BoxShadow(color: const Color(0xFF0f1729).withValues(alpha: 0.03), blurRadius: 2, offset: const Offset(0, 1))],
            ),
            child: Column(
              children: [
                ...List.generate(notes.length, (i) {
                  return Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      border: i < notes.length - 1 ? const Border(bottom: BorderSide(color: Color(0xFFeef0f3))) : null,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 18, height: 18,
                          decoration: BoxDecoration(
                            color: const Color(0xFFeef2ff),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Center(
                            child: Text('${i + 1}',
                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF1e40af))),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(notes[i],
                            style: const TextStyle(fontSize: 12.5, color: Color(0xFF374151), height: 1.45)),
                        ),
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 4),
                InkWell(
                  onTap: () {},
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFFc7d2fe), width: 1, style: BorderStyle.solid),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Center(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.add_rounded, size: 14, color: Color(0xFF1e40af)),
                          SizedBox(width: 4),
                          Text('Adicionar nota',
                            style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF1e40af))),
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
              Text(title,
                style: const TextStyle(
                  fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: 1.4,
                  color: Color(0xFF8a94a6),
                ),
              ),
              if (subtitle != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(subtitle!,
                    style: const TextStyle(fontSize: 12.5, color: Color(0xFF6b7280))),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
