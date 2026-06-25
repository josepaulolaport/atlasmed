import 'package:flutter/material.dart';
import 'bottom_sheet.dart';

class SortSheet extends StatefulWidget {
  final bool open;
  final VoidCallback onClose;
  final String kind;
  final String sort;
  final ValueChanged<String> onApply;

  const SortSheet({
    super.key,
    required this.open,
    required this.onClose,
    required this.kind,
    required this.sort,
    required this.onApply,
  });

  @override
  State<SortSheet> createState() => _SortSheetState();
}

class _SortSheetState extends State<SortSheet>
    with SingleTickerProviderStateMixin {
  late String _selected;
  late AnimationController _animController;
  late Animation<double> _overlayAnim;
  late Animation<double> _sheetAnim;

  @override
  void initState() {
    super.initState();
    _selected = widget.sort;
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 320),
    );
    _overlayAnim = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _animController, curve: Curves.ease),
    );
    _sheetAnim = Tween<double>(begin: 1, end: 0).animate(
      CurvedAnimation(
        parent: _animController,
        curve: const Cubic(0.2, 0.8, 0.2, 1),
      ),
    );
    if (widget.open) _animController.forward();
  }

  @override
  void didUpdateWidget(SortSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.open && !oldWidget.open) {
      _selected = widget.sort;
      _animController.forward();
    } else if (!widget.open && oldWidget.open) {
      _animController.reverse();
    }
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  List<_SortOption> get _options {
    if (widget.kind == 'clinic') {
      return [
        _SortOption('name-asc', 'Nome A–Z', 'Ordem alfabética'),
        _SortOption('distance', 'Mais próximos', 'Menor distância primeiro'),
        _SortOption('oldest-visit', 'Sem visita há mais tempo', 'Priorize clínicas ativas sem atenção'),
      ];
    }
    return [
      _SortOption('name-asc', 'Nome A–Z', 'Ordem alfabética'),
      _SortOption('distance', 'Mais próximos', 'Menor distância primeiro'),
      _SortOption('last-contact', 'Sem contato há mais tempo', 'Retome relacionamentos'),
    ];
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.open && _animController.isDismissed) return const SizedBox.shrink();

    return Stack(
      children: [
        FadeTransition(
          opacity: _overlayAnim,
          child: GestureDetector(
            onTap: widget.onClose,
            child: Container(color: const Color(0x803B82F6).withValues(alpha: 0.5)),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: AnimatedBuilder(
            animation: _animController,
            builder: (context, child) {
              return Transform.translate(
                offset: Offset(0, _sheetAnim.value * MediaQuery.of(context).size.height * 0.5),
                child: child,
              );
            },
            child: BottomSheetWidget(
              title: 'Ordenar por',
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: _options.map((opt) {
                    final on = _selected == opt.key;
                    return GestureDetector(
                      onTap: () {
                        setState(() => _selected = opt.key);
                        widget.onApply(opt.key);
                        widget.onClose();
                      },
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        margin: const EdgeInsets.only(bottom: 4),
                        decoration: BoxDecoration(
                          color: on ? const Color(0xFFeef2ff) : Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 20,
                              height: 20,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: on ? const Color(0xFF1e40af) : const Color(0xFFd1d5db),
                                  width: 2,
                                ),
                                color: on ? const Color(0xFF1e40af) : Colors.white,
                              ),
                              child: on
                                  ? const Center(
                                      child: Icon(Icons.circle, size: 8, color: Colors.white),
                                    )
                                  : null,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    opt.label,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF0f1729),
                                    ),
                                  ),
                                  const SizedBox(height: 1),
                                  Text(
                                    opt.subtitle,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF6b7280),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _SortOption {
  final String key;
  final String label;
  final String subtitle;
  const _SortOption(this.key, this.label, this.subtitle);
}
