import 'package:flutter/material.dart';

/// Bottom sheet to suggest edits for the street-address components.
/// Display on the admin card stays as one composed "Endereço" line; editing
/// opens this multi-field form (bairro / logradouro / número / complemento).
///
/// Phase 1 (mocked): submission shows a confirmation snackbar — no network.
Future<void> showAddressEditSuggestionSheet(
  BuildContext context, {
  required String? neighborhood,
  required String? streetAddress,
  required String? streetNumber,
  required String? addressComplement,
}) async {
  await Future<void>.delayed(Duration.zero);
  if (!context.mounted) return;

  final messenger = ScaffoldMessenger.maybeOf(context);
  final submitted = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useRootNavigator: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _AddressEditSuggestionSheetBody(
      neighborhood: neighborhood,
      streetAddress: streetAddress,
      streetNumber: streetNumber,
      addressComplement: addressComplement,
    ),
  );

  if (submitted == true && messenger != null) {
    messenger.showSnackBar(
      const SnackBar(
        content: Text('Sugestão enviada para revisão'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class _AddressEditSuggestionSheetBody extends StatefulWidget {
  const _AddressEditSuggestionSheetBody({
    required this.neighborhood,
    required this.streetAddress,
    required this.streetNumber,
    required this.addressComplement,
  });

  final String? neighborhood;
  final String? streetAddress;
  final String? streetNumber;
  final String? addressComplement;

  @override
  State<_AddressEditSuggestionSheetBody> createState() =>
      _AddressEditSuggestionSheetBodyState();
}

class _AddressEditSuggestionSheetBodyState
    extends State<_AddressEditSuggestionSheetBody> {
  late final TextEditingController _neighborhoodCtrl;
  late final TextEditingController _streetCtrl;
  late final TextEditingController _numberCtrl;
  late final TextEditingController _complementCtrl;

  @override
  void initState() {
    super.initState();
    _neighborhoodCtrl = TextEditingController(
      text: widget.neighborhood?.trim() ?? '',
    );
    _streetCtrl = TextEditingController(
      text: widget.streetAddress?.trim() ?? '',
    );
    _numberCtrl = TextEditingController(
      text: widget.streetNumber?.trim() ?? '',
    );
    _complementCtrl = TextEditingController(
      text: widget.addressComplement?.trim() ?? '',
    );
  }

  @override
  void dispose() {
    _neighborhoodCtrl.dispose();
    _streetCtrl.dispose();
    _numberCtrl.dispose();
    _complementCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
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
              'Sugerir alteração',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0f1729),
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'ENDEREÇO',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.4,
                color: Color(0xFF9ca3af),
              ),
            ),
            const SizedBox(height: 12),
            _AddressField(
              label: 'Bairro',
              controller: _neighborhoodCtrl,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 10),
            _AddressField(
              label: 'Logradouro',
              controller: _streetCtrl,
              textInputAction: TextInputAction.next,
              autofocus: true,
            ),
            const SizedBox(height: 10),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 2,
                  child: _AddressField(
                    label: 'Número',
                    controller: _numberCtrl,
                    textInputAction: TextInputAction.next,
                    keyboardType: TextInputType.text,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 3,
                  child: _AddressField(
                    label: 'Complemento',
                    controller: _complementCtrl,
                    textInputAction: TextInputAction.done,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Sua sugestão passa por revisão administrativa antes de entrar no perfil.',
              style: TextStyle(fontSize: 11.5, color: Color(0xFF9ca3af)),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF1e40af),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Enviar sugestão'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddressField extends StatelessWidget {
  const _AddressField({
    required this.label,
    required this.controller,
    this.textInputAction,
    this.keyboardType,
    this.autofocus = false,
  });

  final String label;
  final TextEditingController controller;
  final TextInputAction? textInputAction;
  final TextInputType? keyboardType;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: Color(0xFF6b7280),
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          autofocus: autofocus,
          textInputAction: textInputAction,
          keyboardType: keyboardType,
          decoration: InputDecoration(
            hintText: label,
            filled: true,
            fillColor: const Color(0xFFf8f9fb),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 12,
            ),
          ),
        ),
      ],
    );
  }
}
