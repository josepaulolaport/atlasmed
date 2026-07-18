import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_registration_document_detail_screen.dart';

/// "Cadastro" — list of registration document requirements.
///
/// Tap a row → dedicated detail screen with preview + send/resend.
/// Mocked in V1: no `facility_documents` table or upload endpoint yet;
/// the updated list is returned via `Navigator.pop` so the shortcut
/// card's badge refreshes immediately.
class ClinicRegistrationDocumentsScreen extends StatefulWidget {
  const ClinicRegistrationDocumentsScreen({
    super.key,
    required this.facilityName,
    required this.initialDocuments,
  });

  final String facilityName;
  final List<EstablishmentDocument> initialDocuments;

  @override
  State<ClinicRegistrationDocumentsScreen> createState() =>
      _ClinicRegistrationDocumentsScreenState();
}

class _ClinicRegistrationDocumentsScreenState
    extends State<ClinicRegistrationDocumentsScreen> {
  late List<EstablishmentDocument> _documents = List.of(
    widget.initialDocuments,
  );

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        Navigator.of(context).pop(_documents);
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFf8f9fb),
        appBar: AppBar(
          backgroundColor: const Color(0xFFf8f9fb),
          elevation: 0,
          foregroundColor: const Color(0xFF0f1729),
          title: Text('Cadastro · ${_documents.length}'),
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Padding(
              padding: EdgeInsets.only(bottom: 12),
              child: Text(
                'Documentos exigidos para manter o cadastro deste '
                'estabelecimento ativo. Toque em um item para ver o '
                'arquivo, enviar foto ou PDF — a análise é feita pela '
                'equipe administrativa.',
                style: TextStyle(fontSize: 12.5, color: Color(0xFF6b7280)),
              ),
            ),
            for (final (i, doc) in _documents.indexed) ...[
              if (i > 0) const SizedBox(height: 10),
              _DocumentListCard(document: doc, onTap: () => _openDetail(doc)),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _openDetail(EstablishmentDocument document) async {
    final updated = await Navigator.of(context).push<EstablishmentDocument>(
      MaterialPageRoute(
        builder: (_) =>
            ClinicRegistrationDocumentDetailScreen(initialDocument: document),
      ),
    );
    if (updated == null || !mounted) return;
    setState(() {
      _documents = _documents
          .map((d) => d.id == updated.id ? updated : d)
          .toList(growable: false);
    });
  }
}

/// Compact summary row — title, status, attachment hint, chevron.
/// All send/preview actions live on the detail screen.
class _DocumentListCard extends StatelessWidget {
  const _DocumentListCard({required this.document, required this.onTap});

  final EstablishmentDocument document;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = document.status;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
          decoration: BoxDecoration(
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
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: status.backgroundColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  document.hasAttachment
                      ? (document.isPdf
                            ? Icons.picture_as_pdf_rounded
                            : Icons.image_outlined)
                      : Icons.description_outlined,
                  size: 20,
                  color: status.color,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      document.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0f1729),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      document.hasAttachment
                          ? (document.fileName ?? 'Arquivo anexado')
                          : 'Nenhum arquivo enviado',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: status.backgroundColor,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status.label,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: status.color,
                  ),
                ),
              ),
              const SizedBox(width: 2),
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: Color(0xFF9ca3af),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
