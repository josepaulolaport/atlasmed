import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../data/clinic_detail.dart';
import '../../data/models.dart';
import '../providers/explore_provider.dart';

// ======================================================================
// ClinicDetailScreen — 15+ sections of clinic information
// ======================================================================

class ClinicDetailScreen extends ConsumerWidget {
  final String clinicId;

  const ClinicDetailScreen({super.key, required this.clinicId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(clinicDetailProvider(clinicId));

    return Scaffold(
      backgroundColor: const Color(0xFFf8f9fb),
      body: detailAsync.when(
        loading: () => _loadingSkeleton(context),
        error: (err, _) => _errorView(context, err.toString()),
        data: (detail) => _ClinicDetailContent(detail: detail),
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
                child: _ShimmerBlock(height: 100),
              )),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderShimmer() {
    return Container(
      height: 280,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1e40af), Color(0xFF2563eb)],
        ),
      ),
      child: const Center(child: CircularProgressIndicator(color: Colors.white)),
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
              const Icon(Icons.error_outline_rounded, size: 48, color: Color(0xFFb84545)),
              const SizedBox(height: 16),
              Text(message, textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF6b7280))),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => context.pop(),
                icon: const Icon(Icons.arrow_back_rounded),
                label: const Text('Voltar'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ======================================================================
// Main content body
// ======================================================================

class _ClinicDetailContent extends StatelessWidget {
  final ClinicDetail detail;

  const _ClinicDetailContent({required this.detail});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _ClinicHeader(detail: detail),
        Expanded(
          child: ListView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.only(bottom: 32),
            children: [
              _QuickActions(detail: detail),
              _SuggestEditBanner(),
              _ClinicContextCard(detail: detail),
              _AddToRouteButton(),
              // _PhotosButton(),
              if (detail.signals.isNotEmpty)
                _ClinicSignals(signals: detail.signals),
              _SectionHeader(title: 'Saúde da clínica'),
              _ClinicHealth(detail: detail),
              if (detail.productPerformance.isNotEmpty) ...[
                _SectionHeader(title: 'Produtos'),
                _ClinicProducts(items: detail.productPerformance),
              ],
              if (detail.payers.isNotEmpty) ...[
                _SectionHeader(title: 'Convênios'),
                _ClinicPayers(items: detail.payers),
              ],
              if (detail.nearbyClinics.isNotEmpty) ...[
                _SectionHeader(title: 'Clínicas próximas'),
                _NearbyClinics(items: detail.nearbyClinics),
              ],
              if (detail.visits.isNotEmpty) ...[
                _SectionHeader(title: 'Histórico de visitas'),
                _ClinicVisits(visits: detail.visits),
              ],
              if (detail.clinicDoctors.isNotEmpty) ...[
                _SectionHeader(title: 'Médicos'),
                _ClinicDoctors(doctors: detail.clinicDoctors),
              ],
              if (detail.fieldNotes != null && detail.fieldNotes!.isNotEmpty) ...[
                _SectionHeader(title: 'Observações de campo'),
                _ClinicNotes(notes: detail.fieldNotes!),
              ],
              _SectionHeader(title: 'Dados administrativos'),
              _ClinicAdmin(detail: detail),
            ],
          ),
        ),
      ],
    );
  }
}

// ======================================================================
// Section header
// ======================================================================

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 12),
      child: Text(title,
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: Color(0xFF0f1729),
          letterSpacing: -0.3,
        ),
      ),
    );
  }
}

// ======================================================================
// 1. ClinicHeader — gradient hero with avatar, name, status, address
// ======================================================================

class _ClinicHeader extends StatelessWidget {
  final ClinicDetail detail;
  const _ClinicHeader({required this.detail});

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(4, top + 4, 4, 24),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1e40af), Color(0xFF2563eb)],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(24),
          bottomRight: Radius.circular(24),
        ),
      ),
      child: Column(
        children: [
          // Top bar — back + kebab menu
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                  onPressed: () => context.pop(),
                ),
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert_rounded, color: Colors.white),
                  color: Colors.white,
                  onSelected: (value) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('$value — em breve'), behavior: SnackBarBehavior.floating),
                    );
                  },
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'Editar', child: ListTile(tileColor: Colors.white, leading: Icon(Icons.edit_rounded), title: Text('Editar'), dense: true, visualDensity: VisualDensity.compact)),
                    PopupMenuItem(value: 'Compartilhar', child: ListTile(tileColor: Colors.white, leading: Icon(Icons.share_rounded), title: Text('Compartilhar'), dense: true, visualDensity: VisualDensity.compact)),
                    PopupMenuItem(value: 'Reportar', child: ListTile(tileColor: Colors.white, leading: Icon(Icons.flag_rounded), title: Text('Reportar problema'), dense: true, visualDensity: VisualDensity.compact)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Avatar
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 8, offset: const Offset(0, 2))],
            ),
            child: const Center(
              child: Icon(Icons.local_hospital_rounded, size: 36, color: Color(0xFF1e40af)),
            ),
          ),
          const SizedBox(height: 14),
          // Name
          Text(detail.name,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              letterSpacing: -0.5,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 10),
          // Status + distance row
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _StatusBadge(status: detail.status),
              const SizedBox(width: 10),
              Container(width: 4, height: 4, decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white38)),
              const SizedBox(width: 10),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.location_on_rounded, size: 14, color: Colors.white70),
                  const SizedBox(width: 2),
                  Text('${detail.distanceKm.toStringAsFixed(1)} km',
                    style: const TextStyle(fontSize: 13, color: Colors.white70)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Address
          if (detail.streetAddress != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: Text(
                '${detail.streetAddress} — ${detail.neighborhood}',
                style: const TextStyle(fontSize: 12, color: Colors.white60),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          const SizedBox(height: 10),
          // Last interaction ribbon
          if (detail.lastVisitDays != null)
            _InteractionRibbon(days: detail.lastVisitDays!),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final ClinicStatus status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: status.color.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
      ),
      child: Text(status.label,
        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Colors.white)),
    );
  }
}

class _InteractionRibbon extends StatelessWidget {
  final int days;
  const _InteractionRibbon({required this.days});

  @override
  Widget build(BuildContext context) {
    final isRecent = days <= 7;
    final bg = isRecent ? const Color(0xFFea580c) : const Color(0xFFb84545);
    final text = days == 0 ? 'Hoje' : 'Há $days dia${days > 1 ? 's' : ''}';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: bg.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.access_time_rounded, size: 14, color: Colors.white.withValues(alpha: 0.9)),
          const SizedBox(width: 6),
          Text('Última interação: $text',
            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500, color: Colors.white.withValues(alpha: 0.95))),
        ],
      ),
    );
  }
}

// ======================================================================
// 2. QuickActions — Ligar, WhatsApp, Rota, Nova visita, Novo pedido
// ======================================================================

class _QuickActions extends StatelessWidget {
  final ClinicDetail detail;
  const _QuickActions({required this.detail});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _ActionButton(icon: Icons.phone_rounded, label: 'Ligar', onTap: () {}),
          _ActionButton(icon: Icons.chat_rounded, label: 'WhatsApp', onTap: () {}),
          _ActionButton(icon: Icons.directions_rounded, label: 'Rota', onTap: () {}),
          _ActionButton(icon: Icons.calendar_month_rounded, label: 'Visita', onTap: () {}),
          _ActionButton(icon: Icons.note_add_rounded, label: 'Pedido', onTap: () {}),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionButton({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFFeef4ff),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 20, color: const Color(0xFF1e40af)),
            ),
            const SizedBox(height: 6),
            Text(label,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(0xFF4b5563))),
          ],
        ),
      ),
    );
  }
}

// ======================================================================
// 3. SuggestEditBanner
// ======================================================================

class _SuggestEditBanner extends StatelessWidget {
  const _SuggestEditBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFfef3d5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFfde68a)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline_rounded, size: 18, color: Color(0xFFc6861b)),
          const SizedBox(width: 10),
          const Expanded(
            child: Text('Sabia que você pode sugerir edições nos dados da clínica?',
              style: TextStyle(fontSize: 12.5, color: Color(0xFF92400e))),
          ),
          InkWell(
            onTap: () {},
            child: const Text('Saiba mais',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFFc6861b))),
          ),
        ],
      ),
    );
  }
}

// ======================================================================
// 4. ClinicContextCard — consultant, client type, region
// ======================================================================

class _ClinicContextCard extends StatelessWidget {
  final ClinicDetail detail;
  const _ClinicContextCard({required this.detail});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        children: [
          _ContextRow(icon: Icons.person_outline_rounded, label: 'Consultor', value: detail.consultantName ?? '—'),
          if (detail.clientType != null)
            _ContextRow(icon: Icons.star_outline_rounded, label: 'Tipo', value: detail.clientType!),
          _ContextRow(icon: Icons.map_outlined, label: 'Região', value: detail.region ?? '—'),
          _ContextRow(icon: Icons.business_rounded, label: 'Segmento', value: detail.segment ?? '—'),
        ],
      ),
    );
  }
}

class _ContextRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _ContextRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: const Color(0xFF9ca3af)),
          const SizedBox(width: 10),
          SizedBox(
            width: 72,
            child: Text(label,
              style: const TextStyle(fontSize: 13, color: Color(0xFF6b7280))),
          ),
          Expanded(
            child: Text(value,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF0f1729))),
          ),
        ],
      ),
    );
  }
}

// ======================================================================
// 5. AddToRouteButton
// ======================================================================

class _AddToRouteButton extends StatelessWidget {
  const _AddToRouteButton();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      height: 48,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {},
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                const Icon(Icons.add_rounded, size: 20, color: Color(0xFF1e40af)),
                const SizedBox(width: 10),
                const Text('Adicionar à rota de hoje',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Color(0xFF1e40af))),
                const Spacer(),
                Icon(Icons.chevron_right_rounded, size: 20, color: const Color(0xFF9ca3af)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ======================================================================
// 7. ClinicSignals
// ======================================================================

class _ClinicSignals extends StatelessWidget {
  final List<ClinicSignal> signals;
  const _ClinicSignals({required this.signals});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
      child: Column(
        children: signals.map((s) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: _SignalCard(signal: s),
        )).toList(),
      ),
    );
  }
}

class _SignalCard extends StatelessWidget {
  final ClinicSignal signal;
  const _SignalCard({required this.signal});

  @override
  Widget build(BuildContext context) {
    final isWarning = signal.type == 'warning';
    final bg = isWarning ? const Color(0xFFfef3d5) : signal.type == 'info' ? const Color(0xFFeef4ff) : const Color(0xFFe6f7f0);
    final iconColor = isWarning ? const Color(0xFFc6861b) : signal.type == 'info' ? const Color(0xFF1e40af) : const Color(0xFF16a373);
    final icon = isWarning ? Icons.warning_amber_rounded : signal.type == 'info' ? Icons.info_outline_rounded : Icons.check_circle_outline_rounded;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: bg),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: iconColor),
          const SizedBox(width: 10),
          Expanded(
            child: Text(signal.message,
              style: TextStyle(fontSize: 12.5, color: iconColor.withValues(alpha: 0.9)),
            ),
          ),
        ],
      ),
    );
  }
}

// ======================================================================
// 8. ClinicHealth — LTV, Avg Ticket, Frequency
// ======================================================================

class _ClinicHealth extends StatelessWidget {
  final ClinicDetail detail;
  const _ClinicHealth({required this.detail});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Row(
        children: [
          Expanded(child: _HealthCard(label: 'LTV', value: detail.ltv != null ? 'R\$ ${_formatNumber(detail.ltv!)}' : '—', icon: Icons.trending_up_rounded, color: const Color(0xFF1e40af))),
          _divider(),
          Expanded(child: _HealthCard(label: 'Ticket médio', value: detail.avgTicket != null ? 'R\$ ${_formatNumber(detail.avgTicket!)}' : '—', icon: Icons.attach_money_rounded, color: const Color(0xFF16a373))),
          _divider(),
          Expanded(child: _HealthCard(label: 'Frequência', value: detail.avgPurchaseDays != null ? '${detail.avgPurchaseDays} dias' : '—', icon: Icons.date_range_rounded, color: const Color(0xFF7c3aed))),
        ],
      ),
    );
  }

  Widget _divider() {
    return Container(width: 1, height: 48, color: const Color(0xFFeef0f3));
  }

  String _formatNumber(double n) {
    if (n >= 1000) {
      return '${(n / 1000).toStringAsFixed(n >= 10000 ? 0 : 1)}k';
    }
    return n.toStringAsFixed(0);
  }
}

class _HealthCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const _HealthCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, size: 20, color: color.withValues(alpha: 0.7)),
        const SizedBox(height: 6),
        Text(value,
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: color),
        ),
        const SizedBox(height: 2),
        Text(label,
          style: const TextStyle(fontSize: 11, color: Color(0xFF9ca3af))),
      ],
    );
  }
}

// ======================================================================
// 9. ClinicProducts — product performance with trend bars
// ======================================================================

class _ClinicProducts extends StatelessWidget {
  final List<ProductPerformance> items;
  const _ClinicProducts({required this.items});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        children: items.map((p) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _ProductRow(item: p),
        )).toList(),
      ),
    );
  }
}

class _ProductRow extends StatelessWidget {
  final ProductPerformance item;
  const _ProductRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final trendIcon = item.trend == 'up'
        ? Icons.trending_up_rounded
        : item.trend == 'down' ? Icons.trending_down_rounded : Icons.trending_flat_rounded;
    final trendColor = item.trend == 'up'
        ? const Color(0xFF16a373)
        : item.trend == 'down' ? const Color(0xFFb84545) : const Color(0xFF6b7280);

    return Row(
      children: [
        SizedBox(
          width: 90,
          child: Text(item.name,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF0f1729))),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 8,
                decoration: BoxDecoration(
                  color: const Color(0xFFeef0f3),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: item.share / 100,
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF1e40af),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Text('${item.share.toStringAsFixed(0)}%',
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF6b7280))),
        const SizedBox(width: 8),
        Icon(trendIcon, size: 16, color: trendColor),
        const SizedBox(width: 4),
        Text(
          '${item.percentageChange >= 0 ? '+' : ''}${item.percentageChange.toStringAsFixed(1)}%',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: trendColor),
        ),
      ],
    );
  }
}

// ======================================================================
// 10. ClinicPayers — payer breakdown (simplified list)
// ======================================================================

class _ClinicPayers extends StatelessWidget {
  final List<PayerInfo> items;
  const _ClinicPayers({required this.items});

  static const _colors = [
    Color(0xFF1e40af), Color(0xFF2563eb), Color(0xFF3b82f6),
    Color(0xFF60a5fa), Color(0xFF93c5fd),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        children: items.asMap().entries.map((e) => Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: _PayerRow(payer: e.value, index: e.key, totalColors: _colors),
        )).toList(),
      ),
    );
  }
}

class _PayerRow extends StatelessWidget {
  final PayerInfo payer;
  final int index;
  final List<Color> totalColors;
  const _PayerRow({
    required this.payer,
    required this.index,
    required this.totalColors,
  });

  @override
  Widget build(BuildContext context) {
    final color = totalColors[index % totalColors.length];

    return Row(
      children: [
        Container(
          width: 10, height: 10,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(payer.name,
            style: const TextStyle(fontSize: 13, color: Color(0xFF0f1729))),
        ),
        SizedBox(
          width: 120,
          child: Container(
            height: 8,
            decoration: BoxDecoration(
              color: const Color(0xFFeef0f3),
              borderRadius: BorderRadius.circular(4),
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: payer.percentage / 100,
              child: Container(
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 36,
          child: Text('${payer.percentage.toStringAsFixed(0)}%',
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF6b7280)),
            textAlign: TextAlign.right,
          ),
        ),
      ],
    );
  }
}

// ======================================================================
// 11. NearbyClinics — list of nearby clinics
// ======================================================================

class _NearbyClinics extends StatelessWidget {
  final List<NearbyClinic> items;
  const _NearbyClinics({required this.items});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        children: items.map((n) => ListTile(
          tileColor: Colors.white,
          dense: true,
          leading: Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFeef4ff),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.local_hospital_rounded, size: 18, color: Color(0xFF1e40af)),
          ),
          title: Text(n.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
          trailing: Text('${n.distanceKm.toStringAsFixed(1)} km',
            style: const TextStyle(fontSize: 12, color: Color(0xFF6b7280))),
          onTap: () {},
        )).toList(),
      ),
    );
  }
}

// ======================================================================
// 12. ClinicVisits — visit history with filter pills
// ======================================================================

class _ClinicVisits extends StatefulWidget {
  final List<ClinicVisit> visits;
  const _ClinicVisits({required this.visits});

  @override
  State<_ClinicVisits> createState() => _ClinicVisitsState();
}

class _ClinicVisitsState extends State<_ClinicVisits> {
  String _filter = 'todas';

  @override
  Widget build(BuildContext context) {
    final filtered = _filter == 'todas'
        ? widget.visits
        : widget.visits.where((v) => v.type == _filter).toList();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Filter pills
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _FilterPill(label: 'Todas', value: 'todas', selected: _filter == 'todas', onTap: () => setState(() => _filter = 'todas')),
                const SizedBox(width: 8),
                _FilterPill(label: 'Visitas', value: 'visita', selected: _filter == 'visita', onTap: () => setState(() => _filter = 'visita')),
                const SizedBox(width: 8),
                _FilterPill(label: 'Entregas', value: 'entrega', selected: _filter == 'entrega', onTap: () => setState(() => _filter = 'entrega')),
                const SizedBox(width: 8),
                _FilterPill(label: 'Retornos', value: 'retorno', selected: _filter == 'retorno', onTap: () => setState(() => _filter = 'retorno')),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // List
          if (filtered.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: Text('Nenhum registro encontrado', style: TextStyle(fontSize: 13, color: Color(0xFF9ca3af)))),
            )
          else
            ...filtered.map((v) => _VisitItem(visit: v)),
        ],
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  final String label;
  final String value;
  final bool selected;
  final VoidCallback onTap;
  const _FilterPill({required this.label, required this.value, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF1e40af) : const Color(0xFFeef0f3),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: selected ? Colors.white : const Color(0xFF6b7280),
          ),
        ),
      ),
    );
  }
}

class _VisitItem extends StatelessWidget {
  final ClinicVisit visit;
  const _VisitItem({required this.visit});

  @override
  Widget build(BuildContext context) {
    final color = visit.type == 'visita'
        ? const Color(0xFF1e40af)
        : visit.type == 'entrega' ? const Color(0xFF16a373)
        : visit.type == 'retorno' ? const Color(0xFFc6861b)
        : const Color(0xFF7c3aed);
    final monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Date column
            SizedBox(
              width: 44,
              child: Column(
                children: [
                  Text('${visit.date.day}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF0f1729))),
                  Text(monthNames[visit.date.month - 1],
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF6b7280))),
                ],
              ),
            ),
            // Timeline indicator
            SizedBox(
              width: 24,
              child: Column(
                children: [
                  Container(
                    width: 10, height: 10,
                    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                  ),
                  Expanded(child: Container(width: 1, color: const Color(0xFFeef0f3))),
                ],
              ),
            ),
          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(visit.type[0].toUpperCase() + visit.type.substring(1),
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
                    ),
                    if (visit.consultantName != null) ...[
                      const SizedBox(width: 6),
                      Text(visit.consultantName!,
                        style: const TextStyle(fontSize: 11, color: Color(0xFF9ca3af))),
                    ],
                    if (visit.hasPendingOrder) ...[
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFfef3d5),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('Pedido pendente',
                          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: Color(0xFFc6861b))),
                      ),
                    ],
                  ],
                ),
                if (visit.summary != null) ...[
                  const SizedBox(height: 4),
                  Text(visit.summary!,
                    style: const TextStyle(fontSize: 12.5, color: Color(0xFF4b5563)),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
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

// ======================================================================
// 13. ClinicDoctors — doctor mini-cards
// ======================================================================

class _ClinicDoctors extends StatelessWidget {
  final List<DoctorInfo> doctors;
  const _ClinicDoctors({required this.doctors});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        children: doctors.map((d) => _DoctorMiniCard(doctor: d)).toList(),
      ),
    );
  }
}

class _DoctorMiniCard extends StatelessWidget {
  final DoctorInfo doctor;
  const _DoctorMiniCard({required this.doctor});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      tileColor: Colors.white,
      dense: true,
      leading: Stack(
        children: [
          Container(
            width: 40, height: 40,
            decoration: BoxDecoration(
              color: HSLColor.fromAHSL(1, doctor.hue, 0.2, 0.9).toColor(),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(doctor.initials,
                style: TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w700,
                  color: HSLColor.fromAHSL(1, doctor.hue, 0.6, 0.35).toColor(),
                ),
              ),
            ),
          ),
          if (doctor.isKeyOpinionLeader)
            Positioned(
              top: -2, right: -2,
              child: Container(
                width: 14, height: 14,
                decoration: BoxDecoration(
                  color: const Color(0xFF7c3aed),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
                child: const Icon(Icons.star_rounded, size: 8, color: Colors.white),
              ),
            ),
          if (doctor.hasPendingInteraction)
            Positioned(
              bottom: -2, right: -2,
              child: Container(
                width: 12, height: 12,
                decoration: BoxDecoration(
                  color: const Color(0xFFea580c),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
              ),
            ),
        ],
      ),
      title: Text(doctor.name,
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF0f1729))),
      subtitle: Text('${doctor.specialty ?? ''}${doctor.crm != null ? ' • ${doctor.crm}' : ''}',
        style: const TextStyle(fontSize: 11.5, color: Color(0xFF6b7280))),
      trailing: const Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFF9ca3af)),
      onTap: () => context.push('/workspace/doctor/${doctor.id}'),
    );
  }
}

// ======================================================================
// 14. ClinicNotes — field notes
// ======================================================================

class _ClinicNotes extends StatelessWidget {
  final String notes;
  const _ClinicNotes({required this.notes});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: const Color(0xFFeef4ff),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.notes_rounded, size: 18, color: Color(0xFF1e40af)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(notes,
              style: const TextStyle(fontSize: 13, color: Color(0xFF4b5563), height: 1.5)),
          ),
        ],
      ),
    );
  }
}

// ======================================================================
// 15. ClinicAdmin — administrative data
// ======================================================================

class _ClinicAdmin extends StatelessWidget {
  final ClinicDetail detail;
  const _ClinicAdmin({required this.detail});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        children: [
          _AdminRow(icon: Icons.badge_outlined, label: 'CNPJ', value: detail.cnpj ?? '—'),
          _AdminRow(icon: Icons.phone_outlined, label: 'Telefone', value: detail.phone ?? '—'),
          _AdminRow(icon: Icons.email_outlined, label: 'E-mail', value: detail.email ?? '—'),
          if (detail.website != null)
            _AdminRow(icon: Icons.language_outlined, label: 'Site', value: detail.website!),
          if (detail.responsibleDoctor != null)
            _AdminRow(icon: Icons.medical_services_outlined, label: 'Responsável', value: detail.responsibleDoctor!),
          if (detail.openingHours != null)
            _AdminRow(icon: Icons.schedule_outlined, label: 'Horários', value: detail.openingHours!),
          if (detail.registeredSince != null)
            _AdminRow(icon: Icons.date_range_outlined, label: 'Cliente desde',
                value: '${detail.registeredSince!.day}/${detail.registeredSince!.month}/${detail.registeredSince!.year}'),
        ],
      ),
    );
  }
}

class _AdminRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _AdminRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF9ca3af)),
          const SizedBox(width: 10),
          SizedBox(
            width: 80,
            child: Text(label,
              style: const TextStyle(fontSize: 12.5, color: Color(0xFF6b7280))),
          ),
          Expanded(
            child: Text(value,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: Color(0xFF0f1729))),
          ),
        ],
      ),
    );
  }
}

// ======================================================================
// Shimmer block for loading skeleton
// ======================================================================

class _ShimmerBlock extends StatelessWidget {
  final double height;
  const _ShimmerBlock({required this.height});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFeef0f3),
        borderRadius: BorderRadius.circular(16),
      ),
    );
  }
}
