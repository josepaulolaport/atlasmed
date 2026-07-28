import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_detail_card.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/shared/clinica_empty_section.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// "Fotos da clínica" row — kept for a future manage-photos entry point.
/// The live gallery opens from the header avatar (`openClinicPhotoViewer`).
class ClinicPhotosSection extends StatelessWidget {
  const ClinicPhotosSection({super.key, required this.photos});

  final PhotoGallerySummary? photos;

  @override
  Widget build(BuildContext context) {
    final p = photos;
    if (p == null || p.count == 0) {
      return ClinicaEmptySection(
        icon: Icons.photo_library_outlined,
        title: 'Nenhuma foto cadastrada',
        description: 'Adicione fotos da clínica para enriquecer o perfil.',
        onAction: () => _showComingSoon(context),
        actionLabel: const Text('Adicionar'),
      );
    }

    return ClinicDetailCard(
      child: InkWell(
        onTap: () => _showComingSoon(context),
        borderRadius: BorderRadius.circular(12),
        child: Row(
          children: [
            _ThumbnailStack(colors: p.thumbnailColors),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Fotos da clínica · ${p.count}',
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.gray900,
                    ),
                  ),
                  if (p.lastUpdatedAt != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Última: ${_formatMonthYear(p.lastUpdatedAt!)}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.gray400,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: AppColors.gray400,
            ),
          ],
        ),
      ),
    );
  }

  void _showComingSoon(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Galeria de fotos — disponível em breve'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  String _formatMonthYear(DateTime d) {
    const months = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ];
    return '${months[d.month - 1]}/${d.year}';
  }
}

class _ThumbnailStack extends StatelessWidget {
  const _ThumbnailStack({required this.colors});

  final List<Color> colors;

  @override
  Widget build(BuildContext context) {
    if (colors.isEmpty) {
      return const Icon(
        Icons.photo_library_outlined,
        size: 32,
        color: AppColors.gray400,
      );
    }

    return SizedBox(
      width: 56,
      height: 40,
      child: Stack(
        children: List.generate(colors.length.clamp(0, 3), (i) {
          return Positioned(
            left: i * 14.0,
            child: Container(
              width: 32,
              height: 40,
              decoration: BoxDecoration(
                color: colors[i],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.white, width: 2),
              ),
            ),
          );
        }).reversed.toList(),
      ),
    );
  }
}
