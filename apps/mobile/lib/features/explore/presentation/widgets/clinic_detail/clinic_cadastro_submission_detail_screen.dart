import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_cadastro_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/cadastro_document_pages_preview.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Read-only detail for one past Cadastro submission of a document type.
class ClinicCadastroSubmissionDetailScreen extends ConsumerWidget {
  const ClinicCadastroSubmissionDetailScreen({
    super.key,
    required this.facilityId,
    required this.submission,
  });

  final String facilityId;
  final CadastroRequirementSubmission submission;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final date = submission.submittedAt ?? submission.createdAt;
    final dateLabel = date == null
        ? '—'
        : '${date.day.toString().padLeft(2, '0')}/'
              '${date.month.toString().padLeft(2, '0')}/'
              '${date.year} '
              '${date.hour.toString().padLeft(2, '0')}:'
              '${date.minute.toString().padLeft(2, '0')}';

    final submittedAt =
        submission.submittedAt ?? submission.createdAt ?? DateTime.now();
    final files = submission.files
        .where((f) => f.fileAssetId.isNotEmpty)
        .toList(growable: false);
    final pages = [
      for (var i = 0; i < files.length; i++)
        CadastroPreviewPage(
          id: files[i].fileAssetId,
          fileName: buildCadastroDocumentFileName(
            documentType: submission.title,
            version: submission.version,
            submittedBy: 'representante',
            submittedAt: submittedAt,
            pageIndex: i + 1,
            extension: extensionFromMimeOrName(
              mimeType: files[i].contentType,
              fileName: files[i].fileName,
            ),
          ),
          mimeType: files[i].contentType,
        ),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFf8f9fb),
      appBar: AppBar(
        backgroundColor: const Color(0xFFf8f9fb),
        elevation: 0,
        foregroundColor: const AppColors.gray900,
        title: Text(
          'Envio v${submission.version}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFe5e7eb)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  submission.title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.gray900,
                  ),
                ),
                const SizedBox(height: 10),
                _MetaRow(label: 'Status', value: submission.statusLabel),
                _MetaRow(label: 'Versão', value: 'v${submission.version}'),
                _MetaRow(label: 'Enviado em', value: dateLabel),
                _MetaRow(label: 'Arquivos', value: '${submission.fileCount}'),
              ],
            ),
          ),
          if (submission.reviewComment != null &&
              submission.reviewComment!.trim().isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFfde8e8),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                submission.reviewComment!,
                style: const TextStyle(
                  fontSize: 12.5,
                  height: 1.35,
                  color: AppColors.red,
                ),
              ),
            ),
          ],
          const SizedBox(height: 20),
          const Text(
            'DOCUMENTO',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: AppColors.gray400,
            ),
          ),
          const SizedBox(height: 8),
          CadastroDocumentPagesPreview(
            pages: pages,
            resolveUrl: (fileId) => ref
                .read(facilityCadastroControllerProvider(facilityId))
                .signedFileUrl(fileId),
            height: 240,
            emptyLabel: 'Nenhum arquivo listado neste envio.',
          ),
        ],
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: const TextStyle(fontSize: 12.5, color: AppColors.gray500),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
