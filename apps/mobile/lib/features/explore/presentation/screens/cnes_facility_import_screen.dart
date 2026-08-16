import 'dart:async';

import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/cnes_facility_candidates_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/facility_location_picker.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/cnes_candidate_row.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/empty_state.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/search_bar_widget.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/skeleton_row.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Importing a clinic from CNES (spec 0015 §6).
///
/// Its own screen, reached from a deliberate action in Explorar → Clínicas and
/// from the no-results state of a clinic search — which is the exact moment §6
/// describes: *the user searches, does not find the clinic*. It reads as **search
/// CNES**, never as "add clinic": hand-typing a clinic is gone (§6.5), so a
/// generic "+" would promise an action that no longer exists.
///
/// Two outcomes behind one list, and they are not variations of one flow:
///
/// - **new to us** → the wizard: confirm what CNES says, complete what it lacks
/// - **already ours** → a single confirmation, no fields
///
/// The second takes no edits on purpose. `location`, name, CNPJ, address and
/// unit type live on the **shared** facility row, so letting this path write
/// them would let one vertical overwrite another's curated record — and moving
/// the pin would move the clinic for every vertical, re-running territory
/// assignment on profiles that are not theirs.
class CnesFacilityImportScreen extends StatefulWidget {
  const CnesFacilityImportScreen({
    super.key,
    this.repository,
    this.initialQuery = '',
  });

  final CnesFacilityCandidatesRepository? repository;
  final String initialQuery;

  @override
  State<CnesFacilityImportScreen> createState() =>
      _CnesFacilityImportScreenState();
}

class _CnesFacilityImportScreenState extends State<CnesFacilityImportScreen> {
  late final CnesFacilityCandidatesRepository _repository =
      widget.repository ?? CnesFacilityCandidatesRepository();
  /*
   * The query is state, not a controller: `SearchBarWidget` is value-driven —
   * it rebuilds its own controller from `value` — which is what lets the clear
   * button and the debounce agree on one source of truth.
   */
  late String _query = widget.initialQuery;

  Timer? _debounce;
  bool _loading = false;
  String? _error;
  List<CnesFacilityCandidate> _results = const [];
  bool _searched = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialQuery.trim().isNotEmpty) _search(widget.initialQuery);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onChanged(String value) {
    setState(() => _query = value);
    _debounce?.cancel();
    // The index holds ~373 000 documents; a request per keystroke is a request
    // per keystroke against all of them.
    _debounce = Timer(const Duration(milliseconds: 350), () => _search(value));
  }

  Future<void> _search(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      setState(() {
        _results = const [];
        _searched = false;
        _error = null;
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await _repository.search(query: trimmed);
      if (!mounted) return;
      setState(() {
        _results = results;
        _searched = true;
        _loading = false;
      });
    } on CnesFacilityImportException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _open(CnesFacilityCandidate candidate) async {
    final imported = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => _CnesFacilityImportDetail(
          repository: _repository,
          candidate: candidate,
        ),
      ),
    );
    if (imported == true && mounted) {
      /*
       * Dropped locally first. Meilisearch indexes an update asynchronously, so
       * a search fired the instant the import returns still sees the old
       * document — and the clinic the user just imported sits at the top of the
       * list as though nothing happened. Re-running the search afterwards is
       * what makes the list agree with the server rather than with what it
       * remembers.
       */
      setState(() {
        _results = _results
            .where((c) => c.cnesCode != candidate.cnesCode)
            .toList(growable: false);
      });
      await _search(_query);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceTertiary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.gray900,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: const Text(
          'Buscar no CNES',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: SearchBarWidget(
              key: const ValueKey('cnes-search-field'),
              value: _query,
              onChanged: _onChanged,
              hintText: 'Buscar clínica, CNPJ ou CNES…',
            ),
          ),
          const Divider(height: 1, color: AppColors.surfaceSecondary),
          if (_loading)
            const LinearProgressIndicator(
              minHeight: 2,
              backgroundColor: AppColors.surfaceSecondary,
            ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_error != null) {
      return _Message(icon: Icons.error_outline, text: _error!);
    }
    if (!_searched && !_loading) {
      return const _Message(
        icon: Icons.travel_explore,
        text: 'Busque uma clínica pelo nome, CNPJ ou código CNES.',
      );
    }
    /*
     * Explorar's skeleton, not a progress bar. A list that is about to hold rows
     * should be shaped like rows while it loads — the same reason Explorar does
     * it, and the same widget so the two cannot drift.
     */
    if (_loading && _results.isEmpty) {
      return ListView.builder(
        itemCount: 6,
        itemBuilder: (_, _) => const SkeletonRow(),
      );
    }
    if (_results.isEmpty) {
      return EmptyState(query: _query, kind: 'clinic');
    }
    return ListView.builder(
      itemCount: _results.length,
      itemBuilder: (context, index) {
        final candidate = _results[index];
        return CnesCandidateRow(
          key: ValueKey('cnes-candidate-${candidate.cnesCode}'),
          candidate: candidate,
          onTap: () => _open(candidate),
        );
      },
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: AppColors.gray100,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 28, color: AppColors.gray400),
            ),
            const SizedBox(height: 14),
            Text(
              text,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.gray500,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One establishment: what CNES holds, and the action that fits its case.
class _CnesFacilityImportDetail extends StatefulWidget {
  const _CnesFacilityImportDetail({
    required this.repository,
    required this.candidate,
  });

  final CnesFacilityCandidatesRepository repository;
  final CnesFacilityCandidate candidate;

  @override
  State<_CnesFacilityImportDetail> createState() =>
      _CnesFacilityImportDetailState();
}

class _CnesFacilityImportDetailState extends State<_CnesFacilityImportDetail> {
  CnesFacilityPreview? _preview;
  String? _error;
  bool _submitting = false;

  final _name = TextEditingController();
  final _street = TextEditingController();
  final _number = TextEditingController();
  final _neighborhood = TextEditingController();
  final _postalCode = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();

  /// Where the clinic sits. Null means nobody has placed it — importable, but
  /// the clinic lands outside every territory until someone does.
  MapCoordinate? _point;

  /// What reverse geocoding said is at [_point] after it was moved by hand.
  String? _pinAddress;
  bool _geocoding = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    for (final c in [
      _name,
      _street,
      _number,
      _neighborhood,
      _postalCode,
      _phone,
      _email,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final preview = await widget.repository.preview(
        widget.candidate.cnesCode,
      );
      if (!mounted) return;
      setState(() {
        _preview = preview;
        _name.text = preview.suggestedName;
        _street.text = preview.streetAddress ?? '';
        _number.text = preview.streetNumber ?? '';
        _neighborhood.text = preview.neighborhood ?? '';
        _postalCode.text = preview.postalCode ?? '';
        _phone.text = preview.phoneNumber ?? '';
        _email.text = preview.email ?? '';
        final lat = preview.latitude;
        final lng = preview.longitude;
        _point = lat == null || lng == null
            ? null
            : MapCoordinate(longitude: lng, latitude: lat);
      });
    } on CnesFacilityImportException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _submit() async {
    final preview = _preview;
    if (preview == null) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final body = <String, dynamic>{};
      if (!preview.alreadyImported) {
        body.addAll({
          'name': _name.text.trim(),
          'streetAddress': _nullIfBlank(_street.text),
          'streetNumber': _nullIfBlank(_number.text),
          'neighborhood': _nullIfBlank(_neighborhood.text),
          'postalCode': _nullIfBlank(_postalCode.text),
          'phoneNumber': _nullIfBlank(_phone.text),
          'email': _nullIfBlank(_email.text),
          if (_point != null) 'lat': _point!.latitude,
          if (_point != null) 'lng': _point!.longitude,
        });
      }

      final result = await widget.repository.import(
        cnesCode: widget.candidate.cnesCode,
        body: body,
      );
      if (!mounted) return;

      final message = switch (result.outcome) {
        CnesImportOutcome.created => 'Clínica importada do CNES.',
        CnesImportOutcome.profileAdded => 'Clínica adicionada à sua vertical.',
        CnesImportOutcome.alreadyVisible =>
          'Esta clínica já está na sua lista.',
      };
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
      Navigator.of(context).pop(true);
    } on CnesFacilityImportException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _submitting = false;
      });
    }
  }

  bool get _hasAddressToGeocode =>
      _street.text.trim().isNotEmpty || _postalCode.text.trim().isNotEmpty;

  /// Address → pin. The server does this, not the app: it runs the CEP lookup
  /// and the candidate scoring, so the wizard lands where the backfill would.
  Future<void> _geocodeFromAddress() async {
    final preview = _preview;
    if (preview == null || _geocoding) return;

    setState(() => _geocoding = true);
    try {
      final point = await widget.repository.geocodeAddress(
        streetAddress: _street.text,
        streetNumber: _number.text,
        neighborhood: _neighborhood.text,
        city: preview.municipalityName,
        state: preview.stateAbbreviation,
        postalCode: _postalCode.text,
      );
      if (!mounted) return;
      setState(() {
        _geocoding = false;
        if (point != null) {
          _point = MapCoordinate(
            longitude: point.longitude,
            latitude: point.latitude,
          );
          // Derived from what is already in the fields, so echoing it back
          // would just repeat the form at the reader.
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
      setState(() => _geocoding = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  /// Pin → address. Spec 0009 decision 4: an address and a pin are two views of
  /// one fact, so moving the pin rewrites the address rather than leaving it
  /// describing where the clinic used to be.
  Future<void> _pickOnMap() async {
    final picked = await FacilityPinPickerScreen.show(
      context,
      initial: _point,
      title: widget.candidate.name,
    );
    if (picked == null || !mounted) return;

    // Marked busy across the lookup, and the submit button reads the same flag.
    // Confirming a pin and importing straight away used to send the new
    // coordinates with the old address — the pair spec 0009 decision 4 exists
    // to keep together, split by a request that had not come back yet.
    setState(() {
      _point = picked;
      _geocoding = true;
    });

    try {
      final described = await widget.repository.reverseGeocode(
        latitude: picked.latitude,
        longitude: picked.longitude,
      );
      if (!mounted) return;
      if (described == null || described.isEmpty) {
        setState(() => _geocoding = false);
        return;
      }
      setState(() {
        _geocoding = false;
        _pinAddress = described.fullAddress;
        if (described.streetAddress != null) {
          _street.text = described.streetAddress!;
        }
        if (described.streetNumber != null) {
          _number.text = described.streetNumber!;
        }
        if (described.neighborhood != null) {
          _neighborhood.text = described.neighborhood!;
        }
        if (described.postalCode != null) {
          _postalCode.text = described.postalCode!;
        }
      });
    } on CnesFacilityImportException {
      // The pin is authoritative and it is already set. A failed lookup leaves
      // the address as typed rather than blocking the move.
      if (mounted) setState(() => _geocoding = false);
    }
  }

  String? _nullIfBlank(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  @override
  Widget build(BuildContext context) {
    final preview = _preview;

    return Scaffold(
      backgroundColor: AppColors.surfaceTertiary,
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.gray900,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.candidate.name,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            Text(
              preview == null
                  ? 'CNES ${widget.candidate.cnesCode}'
                  : preview.alreadyImported
                  ? 'Já cadastrada · adicionar à sua vertical'
                  : 'Confira os dados antes de importar',
              style: const TextStyle(fontSize: 12, color: AppColors.gray500),
            ),
          ],
        ),
      ),
      body: preview == null
          ? (_error != null
                ? _Message(icon: Icons.error_outline, text: _error!)
                : const Center(child: CircularProgressIndicator()))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_error != null) ...[
                  _ErrorBanner(message: _error!),
                  const SizedBox(height: 16),
                ],
                if (preview.alreadyImported)
                  ..._alreadyOursBody(preview)
                else
                  ..._wizardBody(preview),
              ],
            ),
      /*
       * Pinned, not the last child of the form. The wizard is longer than a
       * phone screen, and a primary action you have to scroll to find is one
       * people miss — and one a lazy ListView has not even built yet.
       */
      bottomNavigationBar: preview == null
          ? null
          : Container(
              color: AppColors.cardBg,
              child: SafeArea(
                minimum: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: SizedBox(
                  height: 48,
                  child: FilledButton(
                    key: const ValueKey('cnes-import-submit'),
                    // Also off while a pin is being described: importing then
                    // would send the new coordinates with the old address.
                    onPressed: _submitting || _geocoding ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.navyBright,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
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
                            preview.alreadyImported
                                ? 'Adicionar à minha vertical'
                                : 'Importar clínica',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
              ),
            ),
    );
  }

  /// §6.1 case 2. One confirmation, and deliberately no fields: the record is
  /// already ours and is not this user's to rewrite.
  List<Widget> _alreadyOursBody(CnesFacilityPreview preview) {
    return [
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.surfaceSecondary),
        ),
        child: const Text(
          'Esta clínica já está cadastrada na AtlasMed, mas não aparece para a '
          'sua vertical. Adicioná-la não altera o cadastro existente — apenas '
          'passa a exibi-la para você.',
          style: TextStyle(fontSize: 13, color: AppColors.gray700, height: 1.5),
        ),
      ),
      const SizedBox(height: 16),
      _ReadOnlyRow(label: 'CNES', value: preview.cnesCode),
      _ReadOnlyRow(label: 'Nome', value: preview.suggestedName),
      if ((preview.municipalityName ?? '').isNotEmpty)
        _ReadOnlyRow(
          label: 'Município',
          value:
              '${preview.municipalityName} / ${preview.stateAbbreviation ?? ''}',
        ),
    ];
  }

  /// One shape for every editable field, so the form reads as one form.
  Widget _field(
    TextEditingController controller,
    String label, {
    bool numeric = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: TextField(
        controller: controller,
        keyboardType: numeric
            ? const TextInputType.numberWithOptions(decimal: true, signed: true)
            : null,
        style: const TextStyle(fontSize: 14, color: AppColors.gray900),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(fontSize: 13, color: AppColors.gray500),
          filled: true,
          fillColor: AppColors.cardBg,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 12,
            vertical: 14,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.surfaceSecondary),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.surfaceSecondary),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.navyBright),
          ),
        ),
      ),
    );
  }

  List<Widget> _wizardBody(CnesFacilityPreview preview) {
    return [
      const Text(
        'Confira os dados do CNES antes de importar. Tudo pode ser corrigido, '
        'exceto o CNPJ.',
        style: TextStyle(fontSize: 13, color: AppColors.gray500, height: 1.5),
      ),
      const SizedBox(height: 14),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.cardBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.surfaceSecondary),
        ),
        child: Column(
          children: [
            _ReadOnlyRow(label: 'CNES', value: preview.cnesCode),
            /*
       * Read-only when CNES supplied it: it is the legal identity of the
       * establishment, and a retyped CNPJ is how two clinics collide. When CNES
       * has none — 18.9 % of establishments, almost all public units under a
       * prefeitura — nothing is asked, because the field is empty for a reason.
       */
            if ((preview.legalDocument ?? '').isNotEmpty)
              _ReadOnlyRow(
                label: preview.legalDocumentType ?? 'Documento',
                value: preview.legalDocument!,
              )
            else if ((preview.maintainerTaxId ?? '').isNotEmpty)
              _ReadOnlyRow(
                label: 'CNPJ da mantenedora',
                value: preview.maintainerTaxId!,
              ),
            if ((preview.municipalityName ?? '').isNotEmpty)
              _ReadOnlyRow(
                label: 'Município (sugerido pelo CNES)',
                value:
                    '${preview.municipalityName} / ${preview.stateAbbreviation ?? ''}',
              ),
          ],
        ),
      ),
      const SizedBox(height: 20),
      const _StepHeader(
        number: 1,
        title: 'Identificação',
        detail: 'Como a clínica aparece para a equipe.',
      ),
      const SizedBox(height: 12),
      _field(_name, 'Nome'),
      const SizedBox(height: 20),
      const _StepHeader(
        number: 2,
        title: 'Endereço e contato',
        detail: 'O que o CNES trouxe. Corrija o que estiver errado.',
      ),
      const SizedBox(height: 12),
      // Número beside Logradouro: they are one line of an address, and stacking
      // them made the form look longer than it is.
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 3, child: _field(_street, 'Logradouro')),
          const SizedBox(width: 10),
          Expanded(child: _field(_number, 'Número')),
        ],
      ),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 2, child: _field(_neighborhood, 'Bairro')),
          const SizedBox(width: 10),
          Expanded(child: _field(_postalCode, 'CEP')),
        ],
      ),
      _field(_phone, 'Telefone'),
      _field(_email, 'E-mail'),
      const SizedBox(height: 20),
      /*
       * Its own section, and a map rather than two number boxes. The point is
       * load-bearing — territory ownership is geometric, so the pin decides
       * which manager zone the clinic falls in and whether it sits inside a
       * rep's patch — and the old form asked for that by having someone type
       * "-23.550520" into a text field.
       */
      const _StepHeader(
        number: 3,
        title: 'Localização',
        detail: 'O pino define o território responsável pela clínica.',
      ),
      const SizedBox(height: 12),
      FacilityLocationCard(
        point: _point,
        addressLabel: _pinAddress,
        geocoding: _geocoding,
        canUseAddress: _hasAddressToGeocode,
        note: preview.requiresLocation && _point == null
            ? 'O CNES não informou onde fica esta clínica. Sem um pino ela '
                  'entra sem território — dá para importar assim e ajustar '
                  'depois.'
            : null,
        onUseAddress: _geocodeFromAddress,
        onPickOnMap: _pickOnMap,
      ),
    ];
  }
}

/// A numbered section heading.
///
/// The wizard was one unbroken column of identical boxes — name, street,
/// number, bairro, CEP, phone, email, two coordinates — so nothing told you how
/// much was left or which parts belong together.
class _StepHeader extends StatelessWidget {
  const _StepHeader({
    required this.number,
    required this.title,
    required this.detail,
  });

  final int number;
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 22,
          height: 22,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: AppColors.navyDeep,
            shape: BoxShape.circle,
          ),
          child: Text(
            '$number',
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.gray900,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                detail,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.gray500,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ReadOnlyRow extends StatelessWidget {
  const _ReadOnlyRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 132,
            child: Text(
              label,
              style: const TextStyle(fontSize: 12, color: AppColors.gray500),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.gray900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.red50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.red100),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.error_outline, size: 18, color: AppColors.red),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.red,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
