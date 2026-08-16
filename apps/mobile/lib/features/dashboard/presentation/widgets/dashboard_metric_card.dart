import 'package:atlasmed_mobile_app/repository/repository_flutter.dart';
import 'package:atlasmed_mobile_app/repository/repositories/http_repository.dart';
import 'package:flutter/material.dart';

/// One metric, one card, one request (spec 0014 §4).
///
/// A slow endpoint shows a skeleton beside its finished neighbours rather than
/// blanking the screen the way one fat summary request did.
///
/// **A failing one still does not degrade to this card alone.** `RepositoryState`
/// has only `empty` and `ready` — there is no error variant — so a non-2xx
/// throws out of `Repository.resolve` as an unhandled exception and takes the
/// screen with it. §4's "independently able to fail" is therefore only half
/// true: the requests are independent, the failures are not. Giving the
/// repository layer an error state is the fix, and it is bigger than this
/// widget.
class DashboardMetricCard<T> extends StatelessWidget {
  const DashboardMetricCard({
    super.key,
    required this.title,
    required this.repository,
    required this.builder,
    this.subtitle,
    this.onTap,
  });

  final String title;
  final String? subtitle;
  final Repository<T> repository;
  final Widget Function(BuildContext context, T value) builder;

  /// Opens the metric's per-clinic breakdown (spec 0014 §4.1).
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _CardShell(
      title: title,
      subtitle: subtitle,
      onTap: onTap,
      child: RepositoryBuilder<Repository<T>, T>(
        repository: repository,
        builder: (context, value, repo) {
          if (value == null) return const _MetricSkeleton();
          return builder(context, value);
        },
      ),
    );
  }
}

class _CardShell extends StatelessWidget {
  const _CardShell({
    required this.title,
    required this.child,
    this.subtitle,
    this.onTap,
  });

  final String title;
  final String? subtitle;
  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFeef0f3)),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.3,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                  ),
                  if (onTap != null)
                    const Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: Color(0xFF9ca3af),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              child,
              if (subtitle != null) ...[
                const SizedBox(height: 6),
                Text(
                  subtitle!,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF6b7280),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MetricSkeleton extends StatelessWidget {
  const _MetricSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 72,
          height: 26,
          decoration: BoxDecoration(
            color: const Color(0xFFf3f4f6),
            borderRadius: BorderRadius.circular(6),
          ),
        ),
        const SizedBox(height: 8),
        Container(
          width: 110,
          height: 12,
          decoration: BoxDecoration(
            color: const Color(0xFFf3f4f6),
            borderRadius: BorderRadius.circular(6),
          ),
        ),
      ],
    );
  }
}

/// The headline number of a card.
///
/// [value] is null when the API declined to compute the figure — an empty
/// denominator, or a mean with no clinic to average. It renders as an em dash,
/// never as 0: "no data" and "zero" are different facts and the screen must not
/// conflate them (spec 0013 §4.3).
class MetricValue extends StatelessWidget {
  const MetricValue({super.key, required this.value, this.caption, this.color});

  final String? value;
  final String? caption;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value ?? '—',
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            color: value == null
                ? const Color(0xFF9ca3af)
                : (color ?? const Color(0xFF111827)),
          ),
        ),
        if (caption != null)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              caption!,
              style: const TextStyle(fontSize: 12, color: Color(0xFF6b7280)),
            ),
          ),
      ],
    );
  }
}

String formatPercent(double? ratio) =>
    ratio == null ? '—' : '${(ratio * 100).round()}%';

/// Two metric cards a row, both the height of the taller one.
///
/// This was a `Wrap`, which sizes each child to its own content: "Clínicas
/// atribuídas" carried a bare number and no caption, so it sat visibly shorter
/// than "Cobertura" beside it. The caption is fixed at the call site; pairing
/// the cards is what stops the same gap reappearing whenever one caption runs
/// onto a second line and its neighbour's does not.
class MetricCardGrid extends StatelessWidget {
  const MetricCardGrid({super.key, required this.cards, this.spacing = 12.0});

  final List<Widget> cards;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < cards.length; i += 2) {
      final right = i + 1 < cards.length ? cards[i + 1] : null;
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: cards[i]),
              SizedBox(width: spacing),
              // An odd card keeps its half of the row rather than stretching
              // across it, so the grid stays a grid.
              Expanded(child: right ?? const SizedBox.shrink()),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) SizedBox(height: spacing),
          rows[i],
        ],
      ],
    );
  }
}
