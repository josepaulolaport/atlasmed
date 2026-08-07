import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_cadastro_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/facility_cadastro_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_document_viewer_screen.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/registration_document_merge.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/registration_document_pick.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Opens compose screen where each picked file is uploaded and processed
/// immediately. Returns `true` when the user taps Enviar and the document
/// is submitted for review; `false`/`null` when they leave without sending.
Future<bool?> composeRegistrationDocument(
  BuildContext context, {
  required int facilityId,
  required int requirementId,
  required String documentTitle,
}) {
  return Navigator.of(context).push<bool>(
    MaterialPageRoute(
      builder: (_) => RegistrationDocumentComposeScreen(
        facilityId: facilityId,
        requirementId: requirementId,
        documentTitle: documentTitle,
      ),
    ),
  );
}

enum _ItemPhase { queued, uploading, processing, ready, failed }

class _ComposeItem {
  _ComposeItem({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.localPath,
    required this.isPdf,
  }) : phase = _ItemPhase.queued,
       progress = 0.05;

  final int id;
  final String fileName;
  final String mimeType;
  final String localPath;
  final bool isPdf;
  _ItemPhase phase;
  double progress;
  int? fileAssetId;

  bool get isBusy =>
      phase == _ItemPhase.queued ||
      phase == _ItemPhase.uploading ||
      phase == _ItemPhase.processing;

  bool get canView => phase == _ItemPhase.ready;

  String get statusLabel {
    switch (phase) {
      case _ItemPhase.queued:
        return 'Na fila…';
      case _ItemPhase.uploading:
        return 'Enviando…';
      case _ItemPhase.processing:
        return 'Processando…';
      case _ItemPhase.ready:
        return 'Pronto';
      case _ItemPhase.failed:
        return 'Falhou';
    }
  }
}

class RegistrationDocumentComposeScreen extends ConsumerStatefulWidget {
  const RegistrationDocumentComposeScreen({
    super.key,
    required this.facilityId,
    required this.requirementId,
    required this.documentTitle,
  });

  final int facilityId;
  final int requirementId;
  final String documentTitle;

  @override
  ConsumerState<RegistrationDocumentComposeScreen> createState() =>
      _RegistrationDocumentComposeScreenState();
}

class _RegistrationDocumentComposeScreenState
    extends ConsumerState<RegistrationDocumentComposeScreen> {
  final _picker = ImagePicker();
  final List<_ComposeItem> _items = [];
  final List<_ComposeItem> _uploadQueue = [];
  bool _uploading = false;
  bool _pickingLocked = false;
  bool _submitting = false;
  int? _documentId;
  Timer? _pollTimer;
  int _idSeq = 0;

  bool get _hasItems => _items.isNotEmpty;
  bool get _allReady =>
      _hasItems && _items.every((i) => i.phase == _ItemPhase.ready);
  bool get _anyBusy => _items.any((i) => i.isBusy) || _uploading;

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  void _syncPolling() {
    final needPoll = _items.any(
      (i) =>
          i.phase == _ItemPhase.processing ||
          (i.phase == _ItemPhase.uploading && i.fileAssetId != null),
    );
    if (needPoll) {
      _pollTimer ??= Timer.periodic(const Duration(seconds: 2), (_) {
        unawaited(_refreshStatuses());
      });
    } else {
      _pollTimer?.cancel();
      _pollTimer = null;
    }
  }

  Future<void> _refreshStatuses() async {
    if (!mounted) return;
    try {
      await ref
          .read(facilityCadastroControllerProvider(widget.facilityId))
          .refresh();
      final checklist = await ref.read(
        facilityCadastroProvider(widget.facilityId).future,
      );
      if (!mounted) return;

      EstablishmentDocument? doc;
      for (final d in checklist.documents) {
        if (d.requirementId == widget.requirementId ||
            d.id == widget.requirementId) {
          doc = d;
          break;
        }
      }
      if (doc == null) return;

      var changed = false;
      for (final item in _items) {
        if (item.fileAssetId == null) continue;
        CadastroDocumentFile? match;
        for (final f in doc.files) {
          if (f.fileAssetId == item.fileAssetId) {
            match = f;
            break;
          }
        }
        if (match == null) continue;
        if (match.isReady && item.phase != _ItemPhase.ready) {
          item.phase = _ItemPhase.ready;
          item.progress = 1;
          changed = true;
        } else if (match.isFailed && item.phase != _ItemPhase.failed) {
          item.phase = _ItemPhase.failed;
          item.progress = 0;
          changed = true;
        } else if (match.isProcessing && item.phase == _ItemPhase.uploading) {
          item.phase = _ItemPhase.processing;
          item.progress = match.progressValue;
          changed = true;
        } else if (match.isProcessing && item.phase == _ItemPhase.processing) {
          final next = match.progressValue;
          if ((next - item.progress).abs() > 0.01) {
            item.progress = next;
            changed = true;
          }
        }
      }
      if (changed && mounted) {
        setState(() {});
        _syncPolling();
      } else {
        _syncPolling();
      }
    } catch (_) {
      // Ignore transient poll errors.
    }
  }

  Future<void> _enqueueUpload(_ComposeItem item) async {
    _uploadQueue.add(item);
    if (_uploading) return;
    _uploading = true;
    while (_uploadQueue.isNotEmpty && mounted) {
      final current = _uploadQueue.removeAt(0);
      await _uploadOne(current);
    }
    _uploading = false;
    if (mounted) _syncPolling();
  }

  Future<void> _uploadOne(_ComposeItem item) async {
    if (!mounted) return;
    setState(() {
      item.phase = _ItemPhase.uploading;
      item.progress = 0.1;
    });

    try {
      int? completedFileId;
      String? completedStatus;
      final uploaded = await ref
          .read(facilityCadastroControllerProvider(widget.facilityId))
          .submitDocument(
            requirementId: widget.requirementId,
            files: [
              (
                localPath: item.localPath,
                fileName: item.fileName,
                contentType: item.mimeType,
              ),
            ],
            onFileProgress: (index, total, progress) {
              if (!mounted) return;
              setState(() {
                item.progress = progress.clamp(0.05, 0.9);
                item.phase = _ItemPhase.uploading;
              });
            },
            onFileCompleted: (index, total, {fileId, status}) async {
              completedFileId = fileId;
              completedStatus = status;
            },
          );
      final nextDocumentId = uploaded.recordId;
      if (nextDocumentId != null && nextDocumentId > 0) {
        _documentId = nextDocumentId;
      }

      if (!mounted) return;
      setState(() {
        item.fileAssetId = completedFileId ??
            item.fileAssetId;
        if (completedStatus == 'FAILED') {
          item.phase = _ItemPhase.failed;
          item.progress = 0;
        } else if (completedStatus == 'READY' || completedStatus == null) {
          // Inline API processing returns READY on complete.
          item.phase = _ItemPhase.ready;
          item.progress = 1;
        } else {
          item.phase = _ItemPhase.processing;
          item.progress = 0.78;
        }
      });
      _syncPolling();
    } on FacilityCadastroException catch (error) {
      if (!mounted) return;
      setState(() {
        item.phase = _ItemPhase.failed;
        item.progress = 0;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message ?? 'Falha no envio'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        item.phase = _ItemPhase.failed;
        item.progress = 0;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível enviar. Tente novamente.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  _ComposeItem _newItem({
    required String fileName,
    required String localPath,
    required String mimeType,
  }) {
    final isPdf =
        mimeType.contains('pdf') || fileName.toLowerCase().endsWith('.pdf');
    return _ComposeItem(
      id: _idSeq++,
      fileName: fileName,
      mimeType: mimeType,
      localPath: localPath,
      isPdf: isPdf,
    );
  }

  Future<void> _addAndUpload(List<PickedRegistrationFile> picked) async {
    final created = <_ComposeItem>[];
    for (final p in picked) {
      final path = p.localPath;
      if (path == null || path.isEmpty) continue;
      created.add(
        _newItem(
          fileName: p.fileName,
          localPath: path,
          mimeType:
              p.mimeType ??
              mimeFromFileName(p.fileName) ??
              'application/octet-stream',
        ),
      );
    }
    if (created.isEmpty) return;
    setState(() => _items.addAll(created));
    for (final item in created) {
      unawaited(_enqueueUpload(item));
    }
  }

  @override
  Widget build(BuildContext context) {
    final canPick = !_pickingLocked && !_submitting;
    final canSend = _allReady && !_anyBusy && !_submitting;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_submitting) return;
        Navigator.of(context).pop(false);
      },
      child: Scaffold(
        backgroundColor: AppColors.surfaceTertiary,
        appBar: AppBar(
          backgroundColor: AppColors.surfaceTertiary,
          elevation: 0,
          foregroundColor: AppColors.gray900,
          title: const Text('Preparar envio'),
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            Text(
              widget.documentTitle,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Adicione fotos ou um PDF. O processamento começa na hora. '
              'Quando todos estiverem prontos, toque em Enviar para mandar '
              'à análise.',
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                color: AppColors.gray500,
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _ActionChip(
                  icon: Icons.camera_alt_outlined,
                  label: 'Tirar foto',
                  onTap: canPick ? _addCameraPhoto : null,
                ),
                _ActionChip(
                  icon: Icons.photo_library_outlined,
                  label: 'Galeria',
                  onTap: canPick ? _addGalleryPhotos : null,
                ),
                _ActionChip(
                  icon: Icons.insert_drive_file_outlined,
                  label: 'Arquivo PDF',
                  onTap: canPick ? _pickDocumentFile : null,
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (!_hasItems) const _EmptyComposeCard(),
            if (_hasItems) ...[
              Row(
                children: [
                  const Text(
                    'ARQUIVOS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.4,
                      color: AppColors.gray400,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${_items.where((i) => i.phase == _ItemPhase.ready).length}'
                    '/${_items.length} prontos',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.gray500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              for (var i = 0; i < _items.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _items[i].isPdf
                      ? _DocumentProgressTile(
                          item: _items[i],
                          onOpen: _items[i].canView
                              ? () => _openItem(_items[i])
                              : null,
                        )
                      : _ImageProgressTile(
                          item: _items[i],
                          onOpen: _items[i].canView
                              ? () => _openItem(_items[i])
                              : null,
                        ),
                ),
            ],
          ],
        ),
        bottomNavigationBar: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _submitting
                        ? null
                        : () => Navigator.of(context).pop(false),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.gray600,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Voltar'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: canSend ? _submitForReview : null,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.navyBright,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: AppColors.gray300,
                      disabledForegroundColor: Colors.white70,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            _anyBusy
                                ? 'Processando…'
                                : _hasItems
                                ? 'Enviar'
                                : 'Adicione um arquivo',
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _submitForReview() async {
    if (!_allReady || _submitting) return;
    setState(() => _submitting = true);
    try {
      await ref
          .read(facilityCadastroControllerProvider(widget.facilityId))
          .submitRequirement(
            requirementId: widget.requirementId,
            documentId: _documentId,
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on FacilityCadastroException catch (error) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message ?? 'Falha ao enviar'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível enviar. Tente novamente.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _openItem(_ComposeItem item) async {
    if (!item.canView) return;
    try {
      // Prefer the local file we just uploaded — avoids MinIO signed-URL issues
      // on device (localhost endpoint / signature headers).
      final local = File(item.localPath);
      if (await local.exists()) {
        if (!mounted) return;
        if (item.isPdf) {
          await openLocalAttachmentViewer(
            context,
            path: item.localPath,
            fileName: item.fileName,
            mimeType: item.mimeType,
          );
        } else {
          await openLocalImageGallery(
            context,
            title: widget.documentTitle,
            paths: [item.localPath],
            initialIndex: 0,
          );
        }
        return;
      }

      if (item.fileAssetId == null) return;
      final url = await ref
          .read(facilityCadastroControllerProvider(widget.facilityId))
          .signedFileUrl(item.fileAssetId!);
      if (!mounted) return;
      await openDocumentViewer(
        context,
        document: EstablishmentDocument(
          id: item.fileAssetId!,
          title: item.fileName,
          description: '',
          fileName: item.fileName,
          remoteUrl: url,
          mimeType: item.mimeType,
          status: EstablishmentDocumentStatus.ready,
        ),
      );
    } on FacilityCadastroException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message ?? 'Não foi possível abrir'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _addCameraPhoto() async {
    try {
      setState(() => _pickingLocked = true);
      final xFile = await _picker.pickImage(
        source: ImageSource.camera,
        requestFullMetadata: false,
      );
      if (xFile == null || !mounted) return;
      await _addAndUpload([
        PickedRegistrationFile(
          fileName: xFile.name,
          localPath: xFile.path,
          mimeType:
              xFile.mimeType ?? mimeFromFileName(xFile.name) ?? 'image/jpeg',
        ),
      ]);
    } catch (_) {
      _showPickerError();
    } finally {
      if (mounted) setState(() => _pickingLocked = false);
    }
  }

  Future<void> _addGalleryPhotos() async {
    try {
      setState(() => _pickingLocked = true);
      final files = await _picker.pickMultiImage(requestFullMetadata: false);
      if (files.isEmpty || !mounted) return;
      await _addAndUpload([
        for (final xFile in files)
          PickedRegistrationFile(
            fileName: xFile.name,
            localPath: xFile.path,
            mimeType:
                xFile.mimeType ?? mimeFromFileName(xFile.name) ?? 'image/jpeg',
          ),
      ]);
    } catch (_) {
      _showPickerError();
    } finally {
      if (mounted) setState(() => _pickingLocked = false);
    }
  }

  Future<void> _pickDocumentFile() async {
    try {
      setState(() => _pickingLocked = true);
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic'],
        withData: false,
      );
      if (result == null || result.files.isEmpty || !mounted) return;
      final file = result.files.single;
      final path = file.path;
      if (path == null || path.isEmpty) {
        _showPickerError();
        return;
      }

      final name = file.name;
      final mime =
          (file.extension != null
              ? mimeFromExtension(file.extension!)
              : mimeFromFileName(name)) ??
          'application/octet-stream';

      // Image via file picker → same as photo upload.
      if (isMergeableImagePath(path)) {
        await _addAndUpload([
          PickedRegistrationFile(
            fileName: name,
            localPath: path,
            mimeType: mime,
          ),
        ]);
        return;
      }

      await _addAndUpload([
        PickedRegistrationFile(fileName: name, localPath: path, mimeType: mime),
      ]);
    } catch (_) {
      _showPickerError();
    } finally {
      if (mounted) setState(() => _pickingLocked = false);
    }
  }

  void _showPickerError() {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Não foi possível abrir o seletor de arquivo'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  const _ActionChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: onTap == null ? AppColors.gray200 : AppColors.blue100,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 18,
                color: onTap == null ? AppColors.gray400 : AppColors.navyBright,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: onTap == null
                      ? AppColors.gray400
                      : AppColors.navyBright,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyComposeCard extends StatelessWidget {
  const _EmptyComposeCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.gray200),
      ),
      child: const Column(
        children: [
          Icon(
            Icons.add_photo_alternate_outlined,
            size: 36,
            color: AppColors.gray400,
          ),
          SizedBox(height: 10),
          Text(
            'Nenhum arquivo ainda',
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: AppColors.gray500,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'Tire uma foto, escolha da galeria ou envie um PDF. '
            'O processamento começa na hora.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: AppColors.gray400),
          ),
        ],
      ),
    );
  }
}

class _DocumentProgressTile extends StatelessWidget {
  const _DocumentProgressTile({required this.item, this.onOpen});

  final _ComposeItem item;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final grayed = item.isBusy || item.phase == _ItemPhase.failed;
    return Opacity(
      opacity: grayed ? 0.62 : 1,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onOpen,
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.gray200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.picture_as_pdf_rounded,
                      color: AppColors.red,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.fileName,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w600,
                              color: AppColors.gray900,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            item.canView
                                ? 'Toque para visualizar'
                                : item.statusLabel,
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: item.phase == _ItemPhase.failed
                                  ? AppColors.red
                                  : item.canView
                                  ? AppColors.navyBright
                                  : AppColors.navyBright,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (item.isBusy)
                      SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          value: item.progress > 0 && item.progress < 1
                              ? item.progress
                              : null,
                        ),
                      ),
                  ],
                ),
                if (item.isBusy || item.phase == _ItemPhase.failed) ...[
                  const SizedBox(height: 10),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: item.phase == _ItemPhase.failed
                          ? 0
                          : item.progress.clamp(0.05, 1),
                      minHeight: 4,
                      backgroundColor: AppColors.gray200,
                      color: item.phase == _ItemPhase.failed
                          ? AppColors.red
                          : AppColors.navyBright,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ImageProgressTile extends StatelessWidget {
  const _ImageProgressTile({required this.item, this.onOpen});

  final _ComposeItem item;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final grayed = item.isBusy || item.phase == _ItemPhase.failed;
    return Opacity(
      opacity: grayed ? 0.55 : 1,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onOpen,
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.gray200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(13),
                  ),
                  child: ColorFiltered(
                    colorFilter: grayed
                        ? const ColorFilter.mode(
                            Colors.grey,
                            BlendMode.saturation,
                          )
                        : const ColorFilter.mode(
                            Colors.transparent,
                            BlendMode.dst,
                          ),
                    child: SizedBox(
                      height: 180,
                      child: Image.file(
                        File(item.localPath),
                        fit: BoxFit.cover,
                        width: double.infinity,
                        errorBuilder: (_, _, _) => const ColoredBox(
                          color: AppColors.gray100,
                          child: Center(
                            child: Icon(
                              Icons.broken_image_outlined,
                              color: AppColors.gray400,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.fileName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.gray900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.canView ? 'Toque para ampliar' : item.statusLabel,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: item.phase == _ItemPhase.failed
                              ? AppColors.red
                              : AppColors.navyBright,
                        ),
                      ),
                      if (item.isBusy || item.phase == _ItemPhase.failed) ...[
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: item.phase == _ItemPhase.failed
                                ? 0
                                : item.progress.clamp(0.05, 1),
                            minHeight: 4,
                            backgroundColor: AppColors.gray200,
                            color: item.phase == _ItemPhase.failed
                                ? AppColors.red
                                : AppColors.navyBright,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
