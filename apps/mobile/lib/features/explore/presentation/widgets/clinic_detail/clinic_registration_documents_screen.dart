import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_cadastro_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_registration_document_detail_screen.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Clinic Cadastro: one card per document type (+ billing email).
class ClinicRegistrationDocumentsScreen extends ConsumerStatefulWidget {
  const ClinicRegistrationDocumentsScreen({
    super.key,
    required this.facilityId,
    required this.facilityName,
  });

  final int facilityId;
  final String facilityName;

  @override
  ConsumerState<ClinicRegistrationDocumentsScreen> createState() =>
      _ClinicRegistrationDocumentsScreenState();
}

class _ClinicRegistrationDocumentsScreenState
    extends ConsumerState<ClinicRegistrationDocumentsScreen> {
  @override
  Widget build(BuildContext context) {
    final checklistAsync = ref.watch(
      facilityCadastroProvider(widget.facilityId),
    );

    return Scaffold(
      backgroundColor: AppColors.surfaceTertiary,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceTertiary,
        elevation: 0,
        foregroundColor: AppColors.gray900,
        title: Text(
          checklistAsync.when(
            // Counts the rows below, which are `documents` — file documents
            // *and* the billing email. It counted `fileDocuments` instead, so a
            // clinic showing three cards was titled "Cadastro · 2" under a
            // shortcut that said "3 pendentes": three numbers on one path, two
            // of them describing sets nobody was looking at.
            data: (c) => 'Cadastro · ${c.documents.length}',
            loading: () => 'Cadastro',
            error: (_, _) => 'Cadastro',
          ),
        ),
      ),
      body: checklistAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  error.toString().replaceFirst('Exception: ', ''),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.gray500),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => ref.invalidate(
                    facilityCadastroProvider(widget.facilityId),
                  ),
                  child: const Text('Tentar novamente'),
                ),
              ],
            ),
          ),
        ),
        data: (checklist) {
          final documents = checklist.documents;
          final hasTaxType =
              checklist.legalDocumentType == 'CPF' ||
              checklist.legalDocumentType == 'CNPJ';
          final fileDocs = checklist.fileDocuments;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Text(
                'Documentos do estabelecimento. Toque em um tipo para ver '
                'o status atual, histórico de envios e enviar um novo.',
                style: TextStyle(
                  fontSize: 12.5,
                  height: 1.4,
                  color: AppColors.gray500,
                ),
              ),
              const SizedBox(height: 14),
              if (!hasTaxType) ...[
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.amber50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Defina se o estabelecimento é Pessoa Física (CPF) ou '
                    'Pessoa Jurídica (CNPJ) em Dados administrativos para '
                    'carregar a lista correta de documentos.',
                    style: TextStyle(
                      fontSize: 12.5,
                      height: 1.35,
                      color: AppColors.amber,
                    ),
                  ),
                ),
              ] else if (fileDocs.isEmpty) ...[
                const Padding(
                  padding: EdgeInsets.only(bottom: 12),
                  child: Text(
                    'Nenhum documento de arquivo aplicável para este tipo.',
                    style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
                  ),
                ),
              ],
              for (final (i, doc) in documents.indexed) ...[
                if (i > 0) const SizedBox(height: 10),
                _DocumentTypeCard(document: doc, onTap: () => _openItem(doc)),
              ],
            ],
          );
        },
      ),
    );
  }

  Future<void> _openItem(EstablishmentDocument document) async {
    if (document.isBillingEmail) {
      await _editBillingEmail(document);
      return;
    }

    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => ClinicRegistrationDocumentDetailScreen(
          facilityId: widget.facilityId,
          initialDocument: document,
        ),
      ),
    );
    if (mounted) {
      ref.invalidate(facilityCadastroProvider(widget.facilityId));
    }
  }

  Future<void> _editBillingEmail(EstablishmentDocument document) async {
    final email = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) =>
          _BillingEmailSheet(initialEmail: document.billingEmail ?? ''),
    );
    if (email == null || email.isEmpty || !mounted) return;

    try {
      await ref
          .read(facilityCadastroControllerProvider(widget.facilityId))
          .updateBillingEmail(email);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Email administrativo salvo'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}

class _BillingEmailSheet extends StatefulWidget {
  const _BillingEmailSheet({required this.initialEmail});

  final String initialEmail;

  @override
  State<_BillingEmailSheet> createState() => _BillingEmailSheetState();
}

class _BillingEmailSheetState extends State<_BillingEmailSheet> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.initialEmail,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Email Administrativo',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.gray900,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Informe o email administrativo do estabelecimento.',
            style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _controller,
            keyboardType: TextInputType.emailAddress,
            autofocus: true,
            decoration: InputDecoration(
              hintText: 'financeiro@clinica.com.br',
              filled: true,
              fillColor: AppColors.surfaceTertiary,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () =>
                  Navigator.of(context).pop(_controller.text.trim()),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.navyBright,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text('Salvar'),
            ),
          ),
        ],
      ),
    );
  }
}

/// The expiry warning, straight from the server's derived `expiry` block.
///
/// Nothing here is computed from the date: `status` and `daysRemaining` arrive
/// derived (ADR 0008 §4), so a device with a wrong clock cannot disagree with
/// the reviewer about whether a licence is still valid.
class _ExpiryLine extends StatelessWidget {
  const _ExpiryLine({required this.expiry});

  final CadastroExpiry expiry;

  @override
  Widget build(BuildContext context) {
    final color = expiry.isExpired
        ? AppColors.red
        : expiry.isExpiringSoon
        ? AppColors.amber
        : AppColors.gray500;
    final formatted = formatCadastroDate(expiry.validUntil);
    return Row(
      children: [
        Icon(
          expiry.isExpired
              ? Icons.error_outline
              : expiry.isExpiringSoon
              ? Icons.schedule_outlined
              : Icons.verified_outlined,
          size: 13,
          color: color,
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            formatted == null ? expiry.label : '${expiry.label} · $formatted',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ),
      ],
    );
  }
}

class _DocumentTypeCard extends StatelessWidget {
  const _DocumentTypeCard({required this.document, required this.onTap});

  final EstablishmentDocument document;
  final VoidCallback onTap;

  EstablishmentDocumentStatus get _listStatus {
    if (document.isBillingEmail) return document.status;
    if (document.currentApproved != null) {
      return EstablishmentDocumentStatus.approved;
    }
    switch (document.latestSubmittedStatus) {
      case 'UNDER_REVIEW':
      case 'SUBMITTED':
        return EstablishmentDocumentStatus.pending;
      case 'REJECTED':
      case 'CHANGES_REQUESTED':
        return EstablishmentDocumentStatus.rejected;
      case 'APPROVED':
        return EstablishmentDocumentStatus.approved;
      default:
        return EstablishmentDocumentStatus.missing;
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = _listStatus;
    final subtitle = document.isBillingEmail
        ? (document.billingEmail?.isNotEmpty == true
              ? document.billingEmail!
              : '+ Completar')
        : (document.latestSubmittedStatus != null
              ? _subtitleForSubmitted(document)
              : 'Nenhum envio ainda');

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
                  document.isBillingEmail
                      ? Icons.email_outlined
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
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        color:
                            document.isBillingEmail &&
                                document.billingEmail?.isNotEmpty != true
                            ? AppColors.navyBright
                            : AppColors.gray500,
                        fontWeight:
                            document.isBillingEmail &&
                                document.billingEmail?.isNotEmpty != true
                            ? FontWeight.w600
                            : FontWeight.w400,
                      ),
                    ),
                    if (document.expiry != null) ...[
                      const SizedBox(height: 4),
                      _ExpiryLine(expiry: document.expiry!),
                    ],
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
              const SizedBox(width: 4),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.gray400,
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _subtitleForSubmitted(EstablishmentDocument document) {
    if (document.currentApproved != null) {
      return 'Aprovado · v${document.currentApproved!.version}';
    }
    final status = document.latestSubmittedStatus;
    switch (status) {
      case 'UNDER_REVIEW':
      case 'SUBMITTED':
        return 'Em análise';
      case 'REJECTED':
        return 'Rejeitado — reenvie se necessário';
      case 'CHANGES_REQUESTED':
        return 'Correção solicitada';
      case 'APPROVED':
        return 'Aprovado';
      case 'READY':
      case 'DRAFT':
      case 'PROCESSING':
        return 'Nenhum envio ainda';
      default:
        return 'Nenhum envio ainda';
    }
  }
}
