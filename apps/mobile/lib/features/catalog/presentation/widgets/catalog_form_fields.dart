import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// The form controls the Administração panel is built from.
///
/// These lived as private copies inside `variant_form_screen.dart` and
/// `competitor_form_screen.dart` — the same widget written twice — while the
/// two sheet forms (fontes pagadoras, catálogos) used Material's default
/// `TextField` with a floating `labelText` and a 4px outline. Three form styles
/// across five forms in one panel, which reads as three different products.
///
/// One set, used by all five. The style is the product form's, because that is
/// the one that already matched `TerritoryInfoForm`: a label above the field,
/// a filled white box, 12px corners, and the app's gray palette rather than the
/// seeded Material primary.

/// The decoration behind [CatalogTextInput] and [CatalogDropdown], exposed so a
/// one-off `DropdownButtonFormField` can wear the panel's field rather than
/// Material's.
const catalogInputDecoration = InputDecoration(
  filled: true,
  fillColor: Colors.white,
  isDense: true,
  contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 14),
  border: OutlineInputBorder(
    borderRadius: BorderRadius.all(Radius.circular(12)),
    borderSide: BorderSide(color: AppColors.gray200),
  ),
  enabledBorder: OutlineInputBorder(
    borderRadius: BorderRadius.all(Radius.circular(12)),
    borderSide: BorderSide(color: AppColors.gray200),
  ),
  // Without this the focused ring is the seeded Material primary — a
  // purple-ish blue that appears nowhere else in the app.
  focusedBorder: OutlineInputBorder(
    borderRadius: BorderRadius.all(Radius.circular(12)),
    borderSide: BorderSide(color: AppColors.navyDeep, width: 1.5),
  ),
);

/// The label above a single field.
class CatalogFieldLabel extends StatelessWidget {
  const CatalogFieldLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w700,
        color: AppColors.gray700,
      ),
    );
  }
}

/// The heading above a group of fields, e.g. `PREÇOS`. Written in caps by the
/// caller — it is a label, not a sentence, and `letterSpacing` does the rest.
class CatalogSectionLabel extends StatelessWidget {
  const CatalogSectionLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: AppColors.gray400,
        letterSpacing: 0.5,
      ),
    );
  }
}

/// A labelled field: [CatalogFieldLabel] over [CatalogTextInput], with the
/// 6px gap the panel uses between the two.
///
/// Most call sites want exactly this pair, and writing it out by hand is how
/// one of them ends up with 8px.
class CatalogField extends StatelessWidget {
  const CatalogField({
    super.key,
    required this.label,
    required this.controller,
    this.hint = '',
    this.capitalization = TextCapitalization.none,
    this.keyboardType,
    this.autofocus = false,
    this.maxLines = 1,
    this.onSubmitted,
  });

  final String label;
  final TextEditingController controller;
  final String hint;
  final TextCapitalization capitalization;
  final TextInputType? keyboardType;
  final bool autofocus;
  final int maxLines;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        CatalogFieldLabel(label),
        const SizedBox(height: 6),
        CatalogTextInput(
          controller: controller,
          hint: hint,
          capitalization: capitalization,
          keyboardType: keyboardType,
          autofocus: autofocus,
          maxLines: maxLines,
          onSubmitted: onSubmitted,
        ),
      ],
    );
  }
}

/// The panel's text field.
class CatalogTextInput extends StatelessWidget {
  const CatalogTextInput({
    super.key,
    required this.controller,
    this.hint = '',
    this.capitalization = TextCapitalization.none,
    this.keyboardType,
    this.autofocus = false,
    this.maxLines = 1,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String hint;
  final TextCapitalization capitalization;
  final TextInputType? keyboardType;
  final bool autofocus;
  final int maxLines;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      textCapitalization: capitalization,
      keyboardType: keyboardType,
      autofocus: autofocus,
      maxLines: maxLines,
      onSubmitted: onSubmitted,
      style: const TextStyle(fontSize: 14, color: AppColors.gray900),
      decoration: catalogInputDecoration.copyWith(
        hintText: hint,
        hintStyle: const TextStyle(color: AppColors.gray400),
      ),
    );
  }
}

/// A dropdown that matches [CatalogTextInput] rather than Material's default.
class CatalogDropdown<T> extends StatelessWidget {
  const CatalogDropdown({
    super.key,
    required this.value,
    required this.items,
    required this.onChanged,
    required this.labelOf,
  });

  final T value;
  final List<T> items;
  final ValueChanged<T> onChanged;
  final String Function(T) labelOf;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      initialValue: value,
      isDense: true,
      style: const TextStyle(fontSize: 14, color: AppColors.gray900),
      decoration: catalogInputDecoration,
      items: [
        for (final item in items)
          DropdownMenuItem(value: item, child: Text(labelOf(item))),
      ],
      onChanged: (picked) {
        if (picked != null) onChanged(picked);
      },
    );
  }
}

/// The "Ativo" switch every catalogue form ends with, and the sentence under it
/// explaining what deactivation actually does.
///
/// Spec 0016 §6.2 makes deactivation the answer whenever delete is refused, so
/// the explanation is not decoration — it is the instruction the blocked-delete
/// dialog points at.
class CatalogActiveSwitch extends StatelessWidget {
  const CatalogActiveSwitch({
    super.key,
    required this.value,
    required this.onChanged,
    required this.explanation,
    this.label = 'Ativo',
  });

  final bool value;
  final ValueChanged<bool> onChanged;
  final String explanation;
  final String label;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile.adaptive(
      contentPadding: EdgeInsets.zero,
      dense: true,
      value: value,
      onChanged: onChanged,
      activeThumbColor: Colors.white,
      activeTrackColor: AppColors.navyDeep,
      title: Text(
        label,
        style: const TextStyle(
          fontSize: 13.5,
          fontWeight: FontWeight.w600,
          color: AppColors.gray900,
        ),
      ),
      subtitle: Text(
        explanation,
        style: const TextStyle(fontSize: 11.5, color: AppColors.gray400),
      ),
    );
  }
}

/// The bottom "Salvar" bar: full width, 48 high, navy, spinner while saving.
///
/// [error] renders above it, because a validation message that appears at the
/// top of a scrolled form is a message the admin never sees.
class CatalogSaveBar extends StatelessWidget {
  const CatalogSaveBar({
    super.key,
    required this.onSave,
    required this.saving,
    this.error,
    this.label = 'Salvar',
  });

  /// Null disables the button — the form is incomplete.
  final VoidCallback? onSave;
  final bool saving;
  final String? error;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  size: 16,
                  color: AppColors.error,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    error!,
                    style: const TextStyle(
                      fontSize: 12.5,
                      color: AppColors.error,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: FilledButton(
            onPressed: saving ? null : onSave,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.navyDeep,
              disabledBackgroundColor: AppColors.gray200,
              disabledForegroundColor: AppColors.gray400,
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Text(
                    label,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14.5,
                    ),
                  ),
          ),
        ),
      ],
    );
  }
}

/// The app bar every catalogue form uses.
///
/// The panel's five forms each wrote out the same four properties by hand, and
/// the theme already supplies all of them (`AppTheme.light.appBarTheme`). This
/// keeps the one thing that genuinely varies — the trailing action — and drops
/// the rest.
class CatalogFormAppBar extends StatelessWidget implements PreferredSizeWidget {
  const CatalogFormAppBar({super.key, required this.title, this.action});

  final String title;
  final Widget? action;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(title),
      actions: action == null ? null : [action!],
    );
  }
}

/// The bottom-sheet form: grabber, title, fields, save bar.
///
/// The two sheet forms in the panel each built this by hand, and they disagreed
/// — one had a grabber and rounded top, the other opened square against the
/// screen edge with the title flush to it. They also let the keyboard cover the
/// save button on a short phone; the sheet scrolls now, and the button stays
/// pinned below the fields.
class CatalogFormSheet extends StatelessWidget {
  const CatalogFormSheet({
    super.key,
    required this.title,
    required this.children,
    required this.onSave,
    required this.saving,
    this.error,
    this.saveLabel = 'Salvar',
  });

  final String title;
  final List<Widget> children;

  /// Null while the form is incomplete — the button shows, disabled.
  final VoidCallback? onSave;
  final bool saving;
  final String? error;
  final String saveLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.background,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 10, bottom: 6),
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.gray200,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray900,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Fechar',
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(
                      Icons.close_rounded,
                      size: 20,
                      color: AppColors.gray500,
                    ),
                  ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: children,
                ),
              ),
            ),
            CatalogSaveBar(
              onSave: onSave,
              saving: saving,
              error: error,
              label: saveLabel,
            ),
          ],
        ),
      ),
    );
  }
}
