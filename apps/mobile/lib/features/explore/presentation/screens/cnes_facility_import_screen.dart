import 'dart:async';

import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/cnes_facility_candidates_repository.dart';
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
  final _lat = TextEditingController();
  final _lng = TextEditingController();

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
      _lat,
      _lng,
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
        _lat.text = _coordinate(preview.latitude);
        _lng.text = _coordinate(preview.longitude);
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
          if (double.tryParse(_lat.text.trim()) != null)
            'lat': double.parse(_lat.text.trim()),
          if (double.tryParse(_lng.text.trim()) != null)
            'lng': double.parse(_lng.text.trim()),
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

  /// Six decimals is roughly 11 cm. CNES ships up to fourteen, which overflows
  /// a half-width field and reads as truncated data rather than a long number.
  String _coordinate(double? value) =>
      value == null ? '' : value.toStringAsFixed(6);

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
                    onPressed: _submitting ? null : _submit,
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
      const SizedBox(height: 16),
      _field(_name, 'Nome'),
      _field(_street, 'Logradouro'),
      _field(_number, 'Número'),
      _field(_neighborhood, 'Bairro'),
      _field(_postalCode, 'CEP'),
      _field(_phone, 'Telefone'),
      _field(_email, 'E-mail'),
      const SizedBox(height: 16),
      /*
       * The point is load-bearing and the user should be told so: territory
       * ownership is geometric, so the pin decides which manager zone the clinic
       * falls in and whether it sits inside a rep's patch. A pin on the wrong
       * side of a street is not a cosmetic error.
       */
      Text(
        preview.requiresLocation
            ? 'O CNES não informou a localização desta clínica. Informe as '
                  'coordenadas — elas definem o território responsável.'
            : 'Localização informada pelo CNES. Corrija se estiver errada: ela '
                  'define o território responsável.',
        style: const TextStyle(
          fontSize: 12,
          color: AppColors.gray500,
          height: 1.4,
        ),
      ),
      const SizedBox(height: 10),
      Row(
        children: [
          Expanded(child: _field(_lat, 'Latitude', numeric: true)),
          const SizedBox(width: 12),
          Expanded(child: _field(_lng, 'Longitude', numeric: true)),
        ],
      ),
    ];
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
