import 'dart:io';

import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_document_viewer_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/registration_document_pick.dart';

/// Dedicated page for one Cadastro document requirement — preview,
/// status, and send/resend. Pushed from the Cadastro list.
class ClinicRegistrationDocumentDetailScreen extends StatefulWidget {
  const ClinicRegistrationDocumentDetailScreen({
    super.key,
    required this.initialDocument,
  });

  final EstablishmentDocument initialDocument;

  @override
  State<ClinicRegistrationDocumentDetailScreen> createState() =>
      _ClinicRegistrationDocumentDetailScreenState();
}

class _ClinicRegistrationDocumentDetailScreenState
    extends State<ClinicRegistrationDocumentDetailScreen> {
  late EstablishmentDocument _document = widget.initialDocument;

  @override
  Widget build(BuildContext context) {
    final status = _document.status;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        Navigator.of(context).pop(_document);
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFf8f9fb),
        appBar: AppBar(
          backgroundColor: const Color(0xFFf8f9fb),
          elevation: 0,
          foregroundColor: const Color(0xFF0f1729),
          title: Text(
            _document.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            Row(
              children: [
                _StatusPill(status: status),
                const Spacer(),
                if (_document.submittedAt != null)
                  Text(
                    'Enviado em ${_formatDate(_document.submittedAt!)}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF9ca3af),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              _document.description,
              style: const TextStyle(
                fontSize: 13.5,
                height: 1.4,
                color: Color(0xFF4b5563),
              ),
            ),
            if (status == EstablishmentDocumentStatus.rejected &&
                _document.reviewerNote != null) ...[
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFfde8e8),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.info_outline_rounded,
                      size: 18,
                      color: Color(0xFFb84545),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _document.reviewerNote!,
                        style: const TextStyle(
                          fontSize: 12.5,
                          height: 1.35,
                          color: Color(0xFFb84545),
                        ),
                      ),
                    ),
                  ],
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
                color: Color(0xFF9ca3af),
              ),
            ),
            const SizedBox(height: 8),
            if (_document.hasAttachment)
              _AttachmentPreview(
                document: _document,
                onOpen: () => _openViewer(context),
              )
            else
              const _EmptyAttachmentCard(),
            if (status == EstablishmentDocumentStatus.pending) ...[
              const SizedBox(height: 12),
              const Text(
                'Documento em análise — você pode visualizar o arquivo '
                'enviado, mas só poderá substituí-lo depois da aprovação '
                '(ou reenviar se for rejeitado).',
                style: TextStyle(
                  fontSize: 12,
                  height: 1.35,
                  color: Color(0xFF6b7280),
                ),
              ),
            ],
            const SizedBox(height: 20),
            // Upload rules:
            // - missing → first send
            // - rejected → resend (after viewing the rejected file)
            // - approved → substitute only
            // - pending → view only (no replace while in analysis)
            if (status == EstablishmentDocumentStatus.missing ||
                status == EstablishmentDocumentStatus.rejected)
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _submit,
                  icon: const Icon(Icons.upload_file_rounded, size: 18),
                  label: Text(
                    status == EstablishmentDocumentStatus.rejected
                        ? 'Reenviar documento'
                        : 'Enviar documento',
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF1e40af),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            if (status == EstablishmentDocumentStatus.approved)
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _submit,
                  icon: const Icon(Icons.upload_file_rounded, size: 18),
                  label: const Text('Substituir documento'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF1e40af),
                    side: const BorderSide(color: Color(0xFFdbeafe)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    final picked = await pickRegistrationDocument(context);
    if (picked == null || !mounted) return;

    setState(() {
      _document = _document.copyWith(
        status: EstablishmentDocumentStatus.pending,
        submittedAt: DateTime.now(),
        fileName: picked.fileName,
        localPath: picked.localPath,
        mimeType: picked.mimeType,
        clearReviewerNote: true,
      );
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Documento enviado para análise'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _openViewer(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ClinicDocumentViewerScreen(document: _document),
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
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

class _EmptyAttachmentCard extends StatelessWidget {
  const _EmptyAttachmentCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFe5e7eb)),
      ),
      child: const Column(
        children: [
          Icon(Icons.cloud_upload_outlined, size: 36, color: Color(0xFF9ca3af)),
          SizedBox(height: 10),
          Text(
            'Nenhum documento enviado',
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: Color(0xFF6b7280),
            ),
          ),
          SizedBox(height: 4),
          Text(
            'Envie uma foto ou arquivo (PDF) para análise.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Color(0xFF9ca3af)),
          ),
        ],
      ),
    );
  }
}

class _AttachmentPreview extends StatelessWidget {
  const _AttachmentPreview({required this.document, required this.onOpen});

  final EstablishmentDocument document;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFe5e7eb)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(15),
                ),
                child: SizedBox(
                  height: 200,
                  child: document.canPreviewImage
                      ? Image.file(
                          File(document.localPath!),
                          fit: BoxFit.cover,
                          width: double.infinity,
                          errorBuilder: (_, _, _) =>
                              _FileTypeBanner(document: document),
                        )
                      : _FileTypeBanner(document: document),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
                child: Row(
                  children: [
                    Icon(
                      document.isPdf
                          ? Icons.picture_as_pdf_rounded
                          : Icons.attach_file_rounded,
                      size: 18,
                      color: document.isPdf
                          ? const Color(0xFFb84545)
                          : const Color(0xFF1e40af),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        document.fileName ?? 'Documento',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0f1729),
                        ),
                      ),
                    ),
                    const Text(
                      'Ver completo',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF1e40af),
                      ),
                    ),
                    const SizedBox(width: 2),
                    const Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: Color(0xFF1e40af),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FileTypeBanner extends StatelessWidget {
  const _FileTypeBanner({required this.document});

  final EstablishmentDocument document;

  @override
  Widget build(BuildContext context) {
    final isPdf = document.isPdf;
    return ColoredBox(
      color: const Color(0xFFf1f5f9),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isPdf
                  ? Icons.picture_as_pdf_rounded
                  : Icons.insert_drive_file_rounded,
              size: 48,
              color: isPdf ? const Color(0xFFb84545) : const Color(0xFF1e40af),
            ),
            const SizedBox(height: 10),
            Text(
              isPdf ? 'Pré-visualização do PDF' : 'Arquivo anexado',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF4b5563),
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Toque para abrir em tela cheia',
              style: TextStyle(fontSize: 12, color: Color(0xFF9ca3af)),
            ),
          ],
        ),
      ),
    );
  }
}
