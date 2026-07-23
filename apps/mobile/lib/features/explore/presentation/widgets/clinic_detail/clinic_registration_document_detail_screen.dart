import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_cadastro_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/cadastro_document_pages_preview.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_cadastro_submission_detail_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/registration_document_compose_screen.dart';

/// Document-type hub: current approved/latest state, history, new submission.
class ClinicRegistrationDocumentDetailScreen extends ConsumerStatefulWidget {
  const ClinicRegistrationDocumentDetailScreen({
    super.key,
    required this.facilityId,
    required this.initialDocument,
  });

  final String facilityId;
  final EstablishmentDocument initialDocument;

  @override
  ConsumerState<ClinicRegistrationDocumentDetailScreen> createState() =>
      _ClinicRegistrationDocumentDetailScreenState();
}

class _ClinicRegistrationDocumentDetailScreenState
    extends ConsumerState<ClinicRegistrationDocumentDetailScreen> {
  late EstablishmentDocument _document = widget.initialDocument;
  List<CadastroRequirementSubmission> _history = const [];
  bool _loadingHistory = true;
  String? _historyError;

  @override
  void initState() {
    super.initState();
    ref.listenManual(facilityCadastroProvider(widget.facilityId), (_, next) {
      next.whenData((data) {
        if (!mounted) return;
        for (final doc in data.documents) {
          if (doc.requirementId == _document.requirementId ||
              doc.id == _document.id) {
            setState(() => _document = doc);
            break;
          }
        }
      });
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadHistory());
  }

  Future<void> _loadHistory() async {
    final requirementId = _document.requirementId ?? _document.id;
    setState(() {
      _loadingHistory = true;
      _historyError = null;
    });
    try {
      final items = await ref
          .read(facilityCadastroControllerProvider(widget.facilityId))
          .listRequirementSubmissions(requirementId);
      if (!mounted) return;
      setState(() {
        _history = items;
        _loadingHistory = false;
      });
    } on FacilityCadastroException catch (error) {
      if (!mounted) return;
      setState(() {
        _loadingHistory = false;
        _historyError = error.message ?? 'Falha ao carregar histórico';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingHistory = false;
        _historyError = 'Falha ao carregar histórico';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final approved = _document.currentApproved;
    final hasApproved = approved != null;
    final submittedAt =
        approved?.submittedAt ?? _document.latestSubmittedAt ?? DateTime.now();
    final version = approved?.version ?? 1;
    final viewable = _document.files
        .where((f) => f.canView && f.fileAssetId.isNotEmpty)
        .toList(growable: false);
    final previewPages = [
      for (var i = 0; i < viewable.length; i++)
        CadastroPreviewPage(
          id: viewable[i].fileAssetId,
          fileName: buildCadastroDocumentFileName(
            documentType: _document.title,
            version: version,
            submittedBy: 'representante',
            submittedAt: submittedAt,
            pageIndex: i + 1,
            extension: extensionFromMimeOrName(
              mimeType: viewable[i].contentType,
              fileName: viewable[i].fileName,
            ),
          ),
          mimeType: viewable[i].contentType,
        ),
    ];

    return Scaffold(
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
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _startNewSubmission,
              icon: const Icon(Icons.upload_file_outlined, size: 18),
              label: Text(hasApproved ? 'Enviar novo' : 'Enviar documento'),
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
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await ref
              .read(facilityCadastroControllerProvider(widget.facilityId))
              .refresh();
          await _loadHistory();
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            Text(
              _document.description,
              style: const TextStyle(
                fontSize: 13.5,
                height: 1.4,
                color: Color(0xFF4b5563),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'DOCUMENTO ATUAL',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.4,
                color: Color(0xFF9ca3af),
              ),
            ),
            const SizedBox(height: 8),
            _CurrentDocumentCard(
              document: _document,
              hasApproved: hasApproved,
              previewPages: previewPages,
              resolveUrl: (fileId) => ref
                  .read(facilityCadastroControllerProvider(widget.facilityId))
                  .signedFileUrl(fileId),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                const Text(
                  'ENVIOS',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                    color: Color(0xFF9ca3af),
                  ),
                ),
                const Spacer(),
                if (!_loadingHistory)
                  Text(
                    '${_history.length}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6b7280),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (_loadingHistory)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_historyError != null)
              Text(
                _historyError!,
                style: const TextStyle(fontSize: 13, color: Color(0xFFb84545)),
              )
            else if (_history.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  vertical: 28,
                  horizontal: 16,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFe5e7eb)),
                ),
                child: const Text(
                  'Nenhum envio ainda. Toque em Enviar documento para começar.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: Color(0xFF6b7280)),
                ),
              )
            else
              for (final item in _history)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _HistoryCard(
                    submission: item,
                    onTap: () => _openSubmission(item),
                  ),
                ),
          ],
        ),
      ),
    );
  }

  Future<void> _startNewSubmission() async {
    final requirementId = _document.requirementId ?? _document.id;
    final sent = await composeRegistrationDocument(
      context,
      facilityId: widget.facilityId,
      requirementId: requirementId,
      documentTitle: _document.title,
    );
    if (!mounted) return;
    await ref
        .read(facilityCadastroControllerProvider(widget.facilityId))
        .refresh();
    await _loadHistory();
    if (!mounted) return;
    if (sent == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Documento enviado para análise'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _openSubmission(CadastroRequirementSubmission submission) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => ClinicCadastroSubmissionDetailScreen(
          facilityId: widget.facilityId,
          submission: submission,
        ),
      ),
    );
  }
}

class _CurrentDocumentCard extends StatelessWidget {
  const _CurrentDocumentCard({
    required this.document,
    required this.hasApproved,
    required this.previewPages,
    required this.resolveUrl,
  });

  final EstablishmentDocument document;
  final bool hasApproved;
  final List<CadastroPreviewPage> previewPages;
  final Future<String> Function(String fileId) resolveUrl;

  EstablishmentDocumentStatus get _badgeStatus {
    if (hasApproved) return EstablishmentDocumentStatus.approved;
    final latest = document.latestSubmittedStatus;
    if (latest == 'UNDER_REVIEW' || latest == 'SUBMITTED') {
      return EstablishmentDocumentStatus.pending;
    }
    if (latest == 'REJECTED' || latest == 'CHANGES_REQUESTED') {
      return EstablishmentDocumentStatus.rejected;
    }
    return EstablishmentDocumentStatus.missing;
  }

  @override
  Widget build(BuildContext context) {
    final status = _badgeStatus;
    final body = hasApproved
        ? 'Versão aprovada v${document.currentApproved!.version}'
              '${document.currentApproved!.fileCount > 0 ? ' · ${document.currentApproved!.fileCount} arquivo(s)' : ''}'
        : status == EstablishmentDocumentStatus.pending
        ? 'Há um envio em análise.'
        : status == EstablishmentDocumentStatus.rejected
        ? 'Último envio precisa de correção. Envie uma nova versão.'
        : 'Ainda não há documento aprovado para este tipo.';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
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
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
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
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                body,
                style: const TextStyle(
                  fontSize: 13,
                  height: 1.35,
                  color: Color(0xFF4b5563),
                ),
              ),
            ],
          ),
        ),
        if (hasApproved && previewPages.isNotEmpty) ...[
          const SizedBox(height: 12),
          CadastroDocumentPagesPreview(
            pages: previewPages,
            resolveUrl: resolveUrl,
            height: 210,
          ),
        ],
      ],
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.submission, required this.onTap});

  final CadastroRequirementSubmission submission;
  final VoidCallback onTap;

  Color get _statusColor {
    if (submission.isApproved) return const Color(0xFF1f9254);
    if (submission.isRejected) return const Color(0xFFb84545);
    if (submission.isUnderReview) return const Color(0xFFc2661b);
    return const Color(0xFF6b7280);
  }

  Color get _statusBg {
    if (submission.isApproved) return const Color(0xFFe7f6ec);
    if (submission.isRejected) return const Color(0xFFfde8e8);
    if (submission.isUnderReview) return const Color(0xFFfef3d5);
    return const Color(0xFFf1f5f9);
  }

  @override
  Widget build(BuildContext context) {
    final date = submission.submittedAt ?? submission.createdAt;
    final dateLabel = date == null
        ? '—'
        : '${date.day.toString().padLeft(2, '0')}/'
              '${date.month.toString().padLeft(2, '0')}/'
              '${date.year}';

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFe5e7eb)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Versão ${submission.version} · $dateLabel',
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0f1729),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${submission.fileCount} '
                      '${submission.fileCount == 1 ? 'arquivo' : 'arquivos'}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF6b7280),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: _statusBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  submission.statusLabel,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700,
                    color: _statusColor,
                  ),
                ),
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: Color(0xFF9ca3af),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
