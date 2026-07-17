import 'dart:io';

import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';

/// Full-screen document viewer opened from the Cadastro detail preview.
///
/// - Images with a local path → pinch-zoom [InteractiveViewer]
/// - PDFs / other files (or mock attachments without a local file) → a
///   clear file-type canvas so the rep can confirm what was attached
class ClinicDocumentViewerScreen extends StatelessWidget {
  const ClinicDocumentViewerScreen({super.key, required this.document});

  final EstablishmentDocument document;

  @override
  Widget build(BuildContext context) {
    final title = document.fileName ?? document.title;

    return Scaffold(
      backgroundColor: const Color(0xFF0f1729),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0f1729),
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      body: document.canPreviewImage
          ? _ImageViewer(path: document.localPath!)
          : _FileViewerCanvas(document: document),
    );
  }
}

class _ImageViewer extends StatelessWidget {
  const _ImageViewer({required this.path});

  final String path;

  @override
  Widget build(BuildContext context) {
    return InteractiveViewer(
      minScale: 0.8,
      maxScale: 4,
      child: Center(
        child: Image.file(
          File(path),
          fit: BoxFit.contain,
          errorBuilder: (_, _, _) => const _ViewerFallback(
            icon: Icons.broken_image_outlined,
            message: 'Não foi possível carregar a imagem',
          ),
        ),
      ),
    );
  }
}

class _FileViewerCanvas extends StatelessWidget {
  const _FileViewerCanvas({required this.document});

  final EstablishmentDocument document;

  @override
  Widget build(BuildContext context) {
    final isPdf = document.isPdf;
    final icon = isPdf
        ? Icons.picture_as_pdf_rounded
        : Icons.insert_drive_file_rounded;
    final accent = isPdf ? const Color(0xFFb84545) : const Color(0xFF93c5fd);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Expanded(
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFF1e293b),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Icon(icon, size: 36, color: accent),
                    ),
                    const SizedBox(height: 20),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Text(
                        document.fileName ?? document.title,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      isPdf ? 'Documento PDF' : 'Arquivo anexado',
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.white.withValues(alpha: 0.65),
                      ),
                    ),
                    if (document.submittedAt != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Enviado em ${_formatDate(document.submittedAt!)}',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.45),
                        ),
                      ),
                    ],
                    const SizedBox(height: 28),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 32),
                      child: Text(
                        document.localPath != null
                            ? 'Pré-visualização nativa de PDF chegará '
                                  'com o backend de armazenamento. O arquivo '
                                  'está anexado a este cadastro.'
                            : 'Este é um anexo de referência (mock). Após o '
                                  'envio real, a pré-visualização completa '
                                  'ficará disponível aqui.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12.5,
                          height: 1.4,
                          color: Colors.white.withValues(alpha: 0.5),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: TextButton(
                onPressed: () => Navigator.of(context).pop(),
                style: TextButton.styleFrom(
                  foregroundColor: Colors.white,
                  backgroundColor: const Color(0xFF1e40af),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Fechar'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}

class _ViewerFallback extends StatelessWidget {
  const _ViewerFallback({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, size: 48, color: Colors.white54),
        const SizedBox(height: 12),
        Text(
          message,
          style: const TextStyle(color: Colors.white70, fontSize: 13),
        ),
      ],
    );
  }
}
