import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/cnes_facility_candidates_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facility_geocoding_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/facility_location_picker.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/nao_conformidades/presentation/providers/nao_conformidade_provider.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Bottom sheet to suggest edits for the address — text, CEP and the pin.
///
/// It used to collect four text fields and nothing else, and the reviewer's
/// approval re-derived the point by geocoding what had been typed. That is the
/// weaker half of the correction: somebody standing outside the clinic knows
/// where it is, and a forward lookup of a street they just corrected does not.
/// The sheet now offers the same geocode-and-drag the CNES import wizard has,
/// and the pin travels with the address so one approval moves CEP, address and
/// location together.
///
/// The standalone `coordinates` suggestion still exists for the case where only
/// the pin is wrong.
Future<void> showAddressEditSuggestionSheet(
  BuildContext context, {
  required WidgetRef ref,
  required int facilityId,
  required String? neighborhood,
  required String? streetAddress,
  required String? streetNumber,
  required String? addressComplement,
  String? city,
  String? state,
  String? postalCode,
  double? lat,
  double? lng,
}) async {
  await Future<void>.delayed(Duration.zero);
  if (!context.mounted) return;

  final messenger = ScaffoldMessenger.maybeOf(context);
  final submitted = await showModalBottomSheet<Map<String, Object?>>(
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
      postalCode: postalCode,
      city: city,
      state: state,
      initialLat: lat,
      initialLng: lng,
    ),
  );

  if (submitted == null || !context.mounted) return;

  try {
    await ref
        .read(naoConformidadeActionsProvider)
        .submitFieldChange(
          facilityId: facilityId,
          fieldKey: 'address',
          proposedValue: {
            'neighborhood': submitted['neighborhood'],
            'streetAddress': submitted['streetAddress'],
            'streetNumber': submitted['streetNumber'],
            'addressComplement': submitted['addressComplement'],
            'city': city,
            'state': state,
            // Edited here now rather than carried through untouched: a street
            // correction almost always comes with a CEP correction, and the two
            // arriving in separate suggestions meant the pair could be approved
            // apart and disagree in between.
            'postalCode': submitted['postalCode'],
            // Absent when the submitter never placed one, in which case the
            // server geocodes the text exactly as before.
            if (submitted['lat'] != null) 'lat': submitted['lat'],
            if (submitted['lng'] != null) 'lng': submitted['lng'],
          },
        );
    if (!context.mounted) return;
    messenger?.showSnackBar(
      const SnackBar(
        content: Text('Sugestão enviada para revisão'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  } catch (e) {
    if (!context.mounted) return;
    messenger?.showSnackBar(
      SnackBar(
        content: Text('Falha ao enviar sugestão: $e'),
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
    required this.postalCode,
    required this.city,
    required this.state,
    required this.initialLat,
    required this.initialLng,
  });

  final String? neighborhood;
  final String? streetAddress;
  final String? streetNumber;
  final String? addressComplement;
  final String? postalCode;
  final String? city;
  final String? state;
  final double? initialLat;
  final double? initialLng;

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
  late final TextEditingController _postalCodeCtrl;

  final _geocoding = FacilityGeocodingRepository();
  MapCoordinate? _point;
  String? _pinAddress;
  bool _resolving = false;

  @override
  void initState() {
    super.initState();
    _postalCodeCtrl = TextEditingController(
      text: widget.postalCode?.trim() ?? '',
    );
    if (widget.initialLat != null && widget.initialLng != null) {
      _point = MapCoordinate(
        latitude: widget.initialLat!,
        longitude: widget.initialLng!,
      );
    }
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
    _postalCodeCtrl.dispose();
    super.dispose();
  }

  bool get _hasAddressToGeocode =>
      _streetCtrl.text.trim().isNotEmpty ||
      _postalCodeCtrl.text.trim().isNotEmpty;

  /// Address → pin, server-side, so the sheet lands on the same coordinates the
  /// reviewer's approval would have derived — with the difference that the
  /// submitter gets to see them and correct them first.
  Future<void> _geocodeFromAddress() async {
    if (_resolving) return;
    setState(() => _resolving = true);
    try {
      final point = await _geocoding.geocodeAddress(
        streetAddress: _streetCtrl.text,
        streetNumber: _numberCtrl.text,
        neighborhood: _neighborhoodCtrl.text,
        city: widget.city,
        state: widget.state,
        postalCode: _postalCodeCtrl.text,
      );
      if (!mounted) return;
      setState(() {
        _resolving = false;
        if (point != null) {
          _point = MapCoordinate(
            latitude: point.latitude,
            longitude: point.longitude,
          );
          // Derived from the fields above, so echoing it back would just repeat
          // the form at the reader.
          _pinAddress = null;
        }
      });
      if (point == null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Não encontramos esse endereço no mapa. Marque o ponto à mão.',
            ),
          ),
        );
      }
    } on CnesFacilityImportException catch (e) {
      if (!mounted) return;
      setState(() => _resolving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  /// Roughly where this clinic is, for a map with no pin to open on.
  Future<MapCoordinate?> _approximateFromAddress() async {
    try {
      final point = await _geocoding.geocodeAddress(
        city: widget.city,
        state: widget.state,
        postalCode: _postalCodeCtrl.text,
      );
      if (point == null) return null;
      return MapCoordinate(
        latitude: point.latitude,
        longitude: point.longitude,
      );
    } on CnesFacilityImportException {
      return null;
    }
  }

  /// Pin → address. Spec 0009 decision 4: an address and a pin are two views of
  /// one fact, so moving the pin rewrites the fields rather than leaving them
  /// describing where the clinic used to be.
  ///
  /// The picker resolves the address before it returns and refuses to confirm a
  /// point it cannot name, so what comes back is always a place — there is no
  /// window here where new coordinates sit beside the old address.
  Future<void> _pickOnMap() async {
    // A clinic normally has a point, so `initial` carries it and the picker
    // opens where the clinic already is. The fallback only matters if it
    // somehow does not: then open on its município rather than another state.
    final fallback = _point == null ? await _approximateFromAddress() : null;
    if (!mounted) return;

    final picked = await FacilityPinPickerScreen.show(
      context,
      initial: _point,
      fallback: fallback,
      title: 'Endereço da clínica',
      resolve: (lat, lng) =>
          _geocoding.reverseGeocode(latitude: lat, longitude: lng),
    );
    if (picked == null || !mounted) return;

    final address = picked.address;
    setState(() {
      _point = picked.point;
      _pinAddress = address.fullAddress;
      if (address.streetAddress != null) {
        _streetCtrl.text = address.streetAddress!;
      }
      if (address.streetNumber != null) {
        _numberCtrl.text = address.streetNumber!;
      }
      if (address.neighborhood != null) {
        _neighborhoodCtrl.text = address.neighborhood!;
      }
      // A five-digit prefix must not overwrite a full CEP already on file.
      if (isCompleteCep(address.postalCode) ||
          (address.postalCode != null && _postalCodeCtrl.text.trim().isEmpty)) {
        _postalCodeCtrl.text = address.postalCode!;
      }
    });
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
                  color: AppColors.gray200,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const Text(
              'Sugerir alteração',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.gray900,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'ENDEREÇO',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.4,
                color: AppColors.gray400,
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
            const SizedBox(height: 10),
            _AddressField(
              label: 'CEP',
              controller: _postalCodeCtrl,
              textInputAction: TextInputAction.done,
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 14),
            const Text(
              'LOCALIZAÇÃO',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.4,
                color: AppColors.gray400,
              ),
            ),
            const SizedBox(height: 8),
            FacilityLocationCard(
              point: _point,
              geocoding: _resolving,
              addressLabel: _pinAddress,
              canUseAddress: _hasAddressToGeocode,
              onUseAddress: _geocodeFromAddress,
              onPickOnMap: _pickOnMap,
              note:
                  'O ponto vai junto com o endereço: aprovar a sugestão move os '
                  'dois de uma vez.',
            ),
            const SizedBox(height: 10),
            const Text(
              'Sua sugestão passa por revisão administrativa antes de entrar no perfil.',
              style: TextStyle(fontSize: 11.5, color: AppColors.gray400),
            ),
            const SizedBox(height: 16),
            // Paired with Cancelar: the logradouro field autofocuses, so this
            // sheet opens with the keyboard over its lower half, and "Enviar"
            // alone left somebody who opened it by mistake no way out but to
            // submit.
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text('Cancelar'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: () {
                      Navigator.of(context).pop(<String, Object?>{
                        'neighborhood': _neighborhoodCtrl.text.trim().isEmpty
                            ? null
                            : _neighborhoodCtrl.text.trim(),
                        'streetAddress': _streetCtrl.text.trim().isEmpty
                            ? null
                            : _streetCtrl.text.trim(),
                        'streetNumber': _numberCtrl.text.trim().isEmpty
                            ? null
                            : _numberCtrl.text.trim(),
                        'addressComplement': _complementCtrl.text.trim().isEmpty
                            ? null
                            : _complementCtrl.text.trim(),
                        'postalCode': _postalCodeCtrl.text.trim().isEmpty
                            ? null
                            : _postalCodeCtrl.text.trim(),
                        'lat': _point?.latitude,
                        'lng': _point?.longitude,
                      });
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.navyBright,
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
            color: AppColors.gray500,
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
            fillColor: AppColors.surfaceTertiary,
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
