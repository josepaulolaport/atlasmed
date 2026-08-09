import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/core/user/role_capability_providers.dart';
import 'package:atlasmed_mobile_app/features/cadastros/data/cadastro_review_models.dart';
import 'package:atlasmed_mobile_app/features/cadastros/presentation/providers/cadastro_review_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/cadastro_document_pages_preview.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Review one Cadastro submission: clinic snapshot + document + decide.
class CadastroReviewDetailScreen extends ConsumerWidget {
  const CadastroReviewDetailScreen({super.key, required this.submissionId});

  final int submissionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final submission = ref.watch(cadastroReviewByIdProvider(submissionId));

    if (submission == null) {
      return Scaffold(
        appBar: const AtlasAppBar(page: 'Cadastros', compact: true),
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Column(
            children: [
              const Expanded(
                child: Center(
                  child: Text(
                    'Submissão não encontrada',
                    style: TextStyle(color: AppColors.gray500),
                  ),
                ),
              ),
              TextButton(
                onPressed: () => context.pop(),
                child: const Text('Voltar'),
              ),
            ],
          ),
        ),
      );
    }

    final status = submission.status;
    final pending =
        submission.isPending && ref.watch(canReviewCadastroProvider);

    return Scaffold(
      appBar: const AtlasAppBar(page: 'Cadastros', compact: true),
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: () => context.pop(),
                      icon: const Icon(Icons.arrow_back_rounded, size: 18),
                      label: const Text('Fila'),
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.navyBright,
                        padding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          submission.documentTitle,
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: AppColors.navyDeep,
                          ),
                        ),
                      ),
                      _StatusPill(status: status),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Enviado por ${submission.submittedByName} · '
                    '${_formatDateTime(submission.submittedAt)}',
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.gray500,
                    ),
                  ),
                  if (submission.reviewedAt != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      '${status == EstablishmentDocumentStatus.approved ? 'Aprovado' : 'Rejeitado'}'
                      ' por ${submission.reviewedByName ?? '—'} · '
                      '${_formatDateTime(submission.reviewedAt!)}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.gray400,
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  const _SectionLabel('ESTABELECIMENTO'),
                  const SizedBox(height: 8),
                  _ClinicSnapshotCard(submission: submission),
                  if (status == EstablishmentDocumentStatus.rejected &&
                      submission.reviewerNote != null) ...[
                    const SizedBox(height: 14),
                    _RejectNoteBanner(note: submission.reviewerNote!),
                  ],
                  const SizedBox(height: 18),
                  const _SectionLabel('DOCUMENTO PARA ANÁLISE'),
                  const SizedBox(height: 8),
                  Text(
                    submission.documentDescription,
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.35,
                      color: AppColors.gray600,
                    ),
                  ),
                  const SizedBox(height: 10),
                  CadastroDocumentPagesPreview(
                    pages: _previewPagesFor(submission),
                    height: 240,
                    emptyLabel: 'Nenhum arquivo disponível para visualização',
                  ),
                ],
              ),
            ),
            if (pending)
              _DecisionBar(
                onApprove: () => _approve(context, ref, submission),
                onReject: () => _reject(context, ref, submission),
              ),
          ],
        ),
      ),
    );
  }

  List<CadastroPreviewPage> _previewPagesFor(
    CadastroReviewSubmission submission,
  ) {
    if (submission.files.isNotEmpty) {
      final files = submission.files
          .where((f) => f.fileAssetId > 0)
          .toList(growable: false);
      return [
        for (var i = 0; i < files.length; i++)
          CadastroPreviewPage(
            id: files[i].fileAssetId,
            fileName: buildCadastroDocumentFileName(
              documentType: submission.documentTitle,
              version: 1,
              submittedBy: submission.submittedByName,
              submittedAt: submission.submittedAt,
              pageIndex: i + 1,
              extension: extensionFromMimeOrName(
                mimeType: files[i].contentType,
                fileName: files[i].fileName,
              ),
            ),
            mimeType: files[i].contentType,
            remoteUrl: files[i].remoteUrl,
          ),
      ];
    }
    if (submission.remoteUrl != null && submission.remoteUrl!.isNotEmpty) {
      return [
        CadastroPreviewPage(
          id: submission.id,
          fileName: buildCadastroDocumentFileName(
            documentType: submission.documentTitle,
            version: 1,
            submittedBy: submission.submittedByName,
            submittedAt: submission.submittedAt,
            extension: extensionFromMimeOrName(
              mimeType: submission.documentMimeType,
              fileName: submission.documentFileName,
            ),
          ),
          mimeType: submission.documentMimeType,
          remoteUrl: submission.remoteUrl,
          localPath: submission.documentLocalPath,
        ),
      ];
    }
    return const [];
  }

  Future<void> _approve(
    BuildContext context,
    WidgetRef ref,
    CadastroReviewSubmission submission,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Aprovar documento?'),
        content: Text(
          'Confirmar aprovação de "${submission.documentTitle}" '
          'para ${submission.facilityName}.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.greenDark),
            child: const Text('Aprovar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    try {
      await ref.read(cadastroReviewActionsProvider).approve(submission);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Documento aprovado'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      context.pop();
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _reject(
    BuildContext context,
    WidgetRef ref,
    CadastroReviewSubmission submission,
  ) async {
    final note = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      // Owns its TextEditingController so it is disposed only after
      // the TextField is unmounted — disposing earlier trips
      // InheritedElement '_dependents.isEmpty'.
      builder: (_) => const _RejectNoteSheet(),
    );
    if (note == null || note.isEmpty || !context.mounted) return;

    try {
      await ref
          .read(cadastroReviewActionsProvider)
          .reject(submission, note: note);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Documento rejeitado'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      context.pop();
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  String _formatDateTime(DateTime d) {
    final dd = d.day.toString().padLeft(2, '0');
    final mm = d.month.toString().padLeft(2, '0');
    final hh = d.hour.toString().padLeft(2, '0');
    final min = d.minute.toString().padLeft(2, '0');
    return '$dd/$mm/${d.year} · $hh:$min';
  }
}

/// Bottom sheet body that owns the reject-note controller for its full
/// lifetime (including the dismiss animation).
class _RejectNoteSheet extends StatefulWidget {
  const _RejectNoteSheet();

  @override
  State<_RejectNoteSheet> createState() => _RejectNoteSheetState();
}

class _RejectNoteSheetState extends State<_RejectNoteSheet> {
  late final TextEditingController _noteController = TextEditingController();

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppColors.gray200,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const Text(
            'Rejeitar documento',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Explique o motivo para o representante poder corrigir '
            'e reenviar.',
            style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _noteController,
            maxLines: 4,
            autofocus: true,
            decoration: InputDecoration(
              hintText: 'Ex.: Documento ilegível, envie nova foto…',
              filled: true,
              fillColor: AppColors.surfaceTertiary,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.gray200),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: AppColors.gray200),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancelar'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: () {
                    final text = _noteController.text.trim();
                    if (text.isEmpty) return;
                    Navigator.of(context).pop(text);
                  },
                  style: FilledButton.styleFrom(backgroundColor: AppColors.red),
                  child: const Text('Rejeitar'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.4,
        color: AppColors.gray400,
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final EstablishmentDocumentStatus status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: status.backgroundColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          color: status.color,
        ),
      ),
    );
  }
}

class _ClinicSnapshotCard extends StatelessWidget {
  const _ClinicSnapshotCard({required this.submission});

  final CadastroReviewSubmission submission;

  @override
  Widget build(BuildContext context) {
    final taxLabel =
        submission.legalDocumentType == FacilityLegalDocumentType.cpf
        ? 'CPF'
        : 'CNPJ';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceSecondary),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            submission.facilityName,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          if (submission.specialtyLabel != null) ...[
            const SizedBox(height: 2),
            Text(
              submission.specialtyLabel!,
              style: const TextStyle(fontSize: 12.5, color: AppColors.gray500),
            ),
          ],
          const SizedBox(height: 12),
          _InfoRow(
            icon: Icons.badge_outlined,
            label: taxLabel,
            value: submission.legalDocument ?? '—',
          ),
          _InfoRow(
            icon: Icons.location_on_outlined,
            label: 'Endereço',
            value: [
              if (submission.address != null) submission.address!,
              if (submission.city != null) submission.city!,
            ].join(' · ').ifEmpty('—'),
          ),
          _InfoRow(
            icon: Icons.phone_outlined,
            label: 'Telefone',
            value: submission.phone ?? '—',
          ),
          _InfoRow(
            icon: Icons.email_outlined,
            label: 'E-mail',
            value: submission.email ?? '—',
          ),
          _InfoRow(
            icon: Icons.person_outline_rounded,
            label: 'Consultor',
            value: submission.consultantName ?? '—',
            isLast: true,
          ),
        ],
      ),
    );
  }
}

extension on String {
  String ifEmpty(String fallback) => trim().isEmpty ? fallback : this;
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.isLast = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: AppColors.gray400),
          const SizedBox(width: 8),
          SizedBox(
            width: 78,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.gray500,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 12.5, color: AppColors.gray900),
            ),
          ),
        ],
      ),
    );
  }
}

class _RejectNoteBanner extends StatelessWidget {
  const _RejectNoteBanner({required this.note});

  final String note;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.red50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline_rounded,
            size: 18,
            color: AppColors.red,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              note,
              style: const TextStyle(
                fontSize: 12.5,
                height: 1.35,
                color: AppColors.red,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DecisionBar extends StatelessWidget {
  const _DecisionBar({required this.onApprove, required this.onReject});

  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottom),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.gray200)),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: onReject,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.red,
                side: const BorderSide(color: AppColors.red100),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('Rejeitar'),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: FilledButton(
              onPressed: onApprove,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.greenDark,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('Aprovar'),
            ),
          ),
        ],
      ),
    );
  }
}
