import 'package:flutter/material.dart';
import 'package:atlasmed_mobile_app/features/explore/data/doctor_detail.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/doctors_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';

/// API keys on `PATCH /api/v1/professionals/:id` that the doctor detail UI can edit.
enum DoctorEditableField {
  mobilePhone('mobilePhone', 'Telefone'),
  email('email', 'E-mail'),
  birthDate('birthDate', 'Aniversário'),
  favoriteTeam('favoriteTeam', 'Time'),
  hobbies('hobbies', 'Interesses'),
  languages('languages', 'Idiomas');

  const DoctorEditableField(this.apiKey, this.label);
  final String apiKey;
  final String label;
}

/// Single-field editor for a doctor profile attribute.
///
/// Returns the updated [DoctorDetail] on success, or `null` if dismissed.
Future<DoctorDetail?> showEditDoctorFieldSheet(
  BuildContext context, {
  required DoctorDetail detail,
  required DoctorEditableField field,
}) {
  return showModalBottomSheet<DoctorDetail>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _EditDoctorFieldSheet(detail: detail, field: field),
  );
}

class _EditDoctorFieldSheet extends StatefulWidget {
  const _EditDoctorFieldSheet({required this.detail, required this.field});

  final DoctorDetail detail;
  final DoctorEditableField field;

  @override
  State<_EditDoctorFieldSheet> createState() => _EditDoctorFieldSheetState();
}

class _EditDoctorFieldSheetState extends State<_EditDoctorFieldSheet> {
  late final TextEditingController _controller;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: _initialValue());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _initialValue() {
    final d = widget.detail;
    return switch (widget.field) {
      DoctorEditableField.mobilePhone => d.phone ?? '',
      DoctorEditableField.email => d.email ?? '',
      DoctorEditableField.birthDate => d.birthday ?? '',
      DoctorEditableField.favoriteTeam => d.team ?? '',
      DoctorEditableField.hobbies => d.interests ?? '',
      DoctorEditableField.languages => d.language ?? '',
    };
  }

  TextInputType get _keyboardType => switch (widget.field) {
    DoctorEditableField.mobilePhone => TextInputType.phone,
    DoctorEditableField.email => TextInputType.emailAddress,
    DoctorEditableField.birthDate => TextInputType.datetime,
    DoctorEditableField.favoriteTeam ||
    DoctorEditableField.hobbies ||
    DoctorEditableField.languages => TextInputType.text,
  };

  String get _hint => switch (widget.field) {
    DoctorEditableField.birthDate => 'AAAA-MM-DD ou DD/MM/AAAA',
    DoctorEditableField.email => 'nome@exemplo.com',
    DoctorEditableField.mobilePhone => 'Telefone com DDD',
    _ => 'Novo valor para ${widget.field.label}',
  };

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 16 + bottom),
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
                color: const Color(0xFFe5e7eb),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const Text(
            'Editar campo',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0f1729),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            widget.field.label.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: Color(0xFF9ca3af),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _controller,
            autofocus: true,
            keyboardType: _keyboardType,
            textCapitalization: widget.field == DoctorEditableField.email
                ? TextCapitalization.none
                : TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: _hint,
              filled: true,
              fillColor: const Color(0xFFf8f9fb),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.all(14),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Deixe em branco para limpar o valor.',
            style: TextStyle(fontSize: 11.5, color: Color(0xFF9ca3af)),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF1e40af),
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Salvar'),
          ),
        ],
      ),
    );
  }

  Future<void> _save() async {
    var raw = _controller.text.trim();

    if (widget.field == DoctorEditableField.birthDate && raw.isNotEmpty) {
      final normalized = _normalizeBirthDate(raw);
      if (normalized == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Use a data no formato AAAA-MM-DD ou DD/MM/AAAA'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
      raw = normalized;
    }

    if (widget.field == DoctorEditableField.email && raw.isNotEmpty) {
      if (!raw.contains('@')) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Informe um e-mail válido'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
    }

    setState(() => _saving = true);
    final repo = DoctorsRepository(resolveOnCreate: false);
    try {
      final updated = await repo.patchProfessionalField(
        id: widget.detail.id,
        fieldKey: widget.field.apiKey,
        value: raw.isEmpty ? null : raw,
      );
      if (!mounted) return;
      Navigator.of(context).pop(doctorDetailFromApi(updated));
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is Exception
                ? e.toString().replaceFirst('Exception: ', '')
                : 'Falha ao salvar campo',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      repo.dispose();
    }
  }

  String? _normalizeBirthDate(String raw) {
    final iso = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(raw);
    if (iso != null) return raw;

    final brFull = RegExp(r'^(\d{1,2})/(\d{1,2})/(\d{4})$').firstMatch(raw);
    if (brFull != null) {
      final d = brFull.group(1)!.padLeft(2, '0');
      final m = brFull.group(2)!.padLeft(2, '0');
      return '${brFull.group(3)}-$m-$d';
    }

    final brShort = RegExp(r'^(\d{1,2})/(\d{1,2})$').firstMatch(raw);
    if (brShort != null) {
      final d = brShort.group(1)!.padLeft(2, '0');
      final m = brShort.group(2)!.padLeft(2, '0');
      return '2000-$m-$d';
    }

    return null;
  }
}
