/// Client-side preflight of the per-requirement upload limits the API already
/// publishes (spec 0011 §7).
///
/// The API is authoritative: `initiate` re-checks the MIME type, the per-file
/// size, the file count and the combined size, and does so under a lock. This
/// mirrors those rules for one reason only — so the rep learns "este PDF tem
/// 62 MB" the instant they pick the file, instead of after uploading nothing
/// and waiting for a round trip to fail.
///
/// It is deliberately conservative: it only refuses what the server would
/// certainly refuse. Anything it cannot know it lets through, because a false
/// refusal blocks a rep in front of a clinic, while a false pass merely lands
/// on the server error it would have hit anyway.
library;

class CadastroUploadLimits {
  const CadastroUploadLimits({
    required this.allowedMimeTypes,
    required this.maxFiles,
    required this.maxFileSizeBytes,
    required this.maxCombinedSizeBytes,
  });

  final List<String> allowedMimeTypes;
  final int maxFiles;
  final int maxFileSizeBytes;
  final int maxCombinedSizeBytes;

  bool get allowsImages =>
      allowedMimeTypes.any((m) => m.toLowerCase().startsWith('image/'));

  bool allows(String mimeType) => allowedMimeTypes
      .map((m) => m.toLowerCase())
      .contains(mimeType.toLowerCase().trim());

  /// Reads the `requirement` block of a cadastro document response. Returns
  /// null when the payload is missing a limit rather than inventing one — a
  /// guessed limit would reject valid files.
  static CadastroUploadLimits? fromRequirementJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final mimes = (json['allowedMimeTypes'] as List<dynamic>?)
        ?.whereType<String>()
        .toList(growable: false);
    final maxFiles = (json['maxFiles'] as num?)?.toInt();
    final maxFileSize = (json['maxFileSizeBytes'] as num?)?.toInt();
    final maxCombined = (json['maxCombinedSizeBytes'] as num?)?.toInt();
    if (mimes == null ||
        mimes.isEmpty ||
        maxFiles == null ||
        maxFileSize == null ||
        maxCombined == null) {
      return null;
    }
    return CadastroUploadLimits(
      allowedMimeTypes: mimes,
      maxFiles: maxFiles,
      maxFileSizeBytes: maxFileSize,
      maxCombinedSizeBytes: maxCombined,
    );
  }
}

/// One file the rep just picked, before any upload starts.
class CadastroUploadCandidate {
  const CadastroUploadCandidate({
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
    required this.isImage,
  });

  final String fileName;
  final String mimeType;
  final int sizeBytes;

  /// Images are re-encoded before upload, so neither their picked MIME type nor
  /// their picked size is what the server will see. For those, only the
  /// question "does this requirement accept images at all?" can be answered
  /// honestly here; type and size are left to `initiate`.
  final bool isImage;
}

class CadastroPreflightRejection {
  const CadastroPreflightRejection({
    required this.index,
    required this.fileName,
    required this.message,
  });

  /// Position of the rejected file in the candidate list handed to
  /// [preflightCadastroUpload].
  final int index;
  final String fileName;
  final String message;
}

/// Rejects the picked files the server would certainly reject.
///
/// [existingFileCount] and [existingKnownBytes] describe what is already
/// attached to the document. Candidates are evaluated in order, and an accepted
/// one counts against the limits for the ones after it — otherwise picking five
/// files at once would pass a `maxFiles: 3` check five times over.
List<CadastroPreflightRejection> preflightCadastroUpload({
  required CadastroUploadLimits limits,
  required List<CadastroUploadCandidate> candidates,
  int existingFileCount = 0,
  int existingKnownBytes = 0,
}) {
  final rejections = <CadastroPreflightRejection>[];
  var fileCount = existingFileCount;
  var combined = existingKnownBytes;

  for (var i = 0; i < candidates.length; i++) {
    final candidate = candidates[i];

    void reject(String message) {
      rejections.add(
        CadastroPreflightRejection(
          index: i,
          fileName: candidate.fileName,
          message: message,
        ),
      );
    }

    if (fileCount >= limits.maxFiles) {
      reject(
        'Máximo de ${limits.maxFiles} '
        '${limits.maxFiles == 1 ? 'arquivo' : 'arquivos'} neste documento.',
      );
      continue;
    }

    if (candidate.isImage) {
      if (!limits.allowsImages) {
        reject(
          'Este documento aceita apenas '
          '${_describeAllowedTypes(limits.allowedMimeTypes)}.',
        );
        continue;
      }
      // Size and final MIME type are decided by normalisation, not by the pick.
      fileCount++;
      continue;
    }

    if (!limits.allows(candidate.mimeType)) {
      reject(
        'Tipo não aceito. Envie '
        '${_describeAllowedTypes(limits.allowedMimeTypes)}.',
      );
      continue;
    }
    if (candidate.sizeBytes <= 0) {
      reject('Arquivo vazio.');
      continue;
    }
    if (candidate.sizeBytes > limits.maxFileSizeBytes) {
      reject(
        '${_typeLabel(candidate.mimeType)} de até '
        '${formatByteSize(limits.maxFileSizeBytes)} — este tem '
        '${formatByteSize(candidate.sizeBytes)}.',
      );
      continue;
    }
    if (combined + candidate.sizeBytes > limits.maxCombinedSizeBytes) {
      reject(
        'Somando os arquivos deste documento o limite é '
        '${formatByteSize(limits.maxCombinedSizeBytes)}.',
      );
      continue;
    }

    fileCount++;
    combined += candidate.sizeBytes;
  }

  return rejections;
}

/// Human size in the units a rep reads on their phone (KB/MB), never bytes.
String formatByteSize(int bytes) {
  const kb = 1024;
  const mb = 1024 * 1024;
  if (bytes >= mb) {
    final value = bytes / mb;
    return '${_trimDecimal(value)} MB';
  }
  if (bytes >= kb) {
    final value = bytes / kb;
    return '${_trimDecimal(value)} KB';
  }
  return '$bytes B';
}

String _trimDecimal(double value) {
  if (value >= 10 || value == value.roundToDouble()) {
    return value.round().toString();
  }
  return value.toStringAsFixed(1).replaceAll('.', ',');
}

String _typeLabel(String mimeType) {
  final mime = mimeType.toLowerCase().trim();
  if (mime == 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'Imagem';
  return 'Arquivo';
}

String _describeAllowedTypes(List<String> mimeTypes) {
  final labels = <String>[];
  for (final mime in mimeTypes) {
    final label = _typeLabel(mime);
    if (!labels.contains(label)) labels.add(label);
  }
  if (labels.isEmpty) return 'outro formato';
  if (labels.length == 1) return labels.single;
  return '${labels.sublist(0, labels.length - 1).join(', ')} ou ${labels.last}';
}
