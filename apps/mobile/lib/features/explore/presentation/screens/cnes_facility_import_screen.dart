import 'dart:async';

import 'package:flutter/material.dart';

import 'package:atlasmed_mobile_app/features/explore/data/repositories/cnes_facility_candidates_repository.dart';

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
  late final TextEditingController _controller = TextEditingController(
    text: widget.initialQuery,
  );

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
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
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
      // It is no longer a candidate. Re-running the search is how the list
      // agrees with the server rather than with what it remembers.
      await _search(_controller.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Buscar no CNES')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _controller,
              onChanged: _onChanged,
              autofocus: widget.initialQuery.trim().isEmpty,
              textInputAction: TextInputAction.search,
              onSubmitted: _search,
              decoration: const InputDecoration(
                labelText: 'Nome, CNPJ ou código CNES',
                helperText: 'Clínicas registradas no CNES em todo o Brasil',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          if (_loading) const LinearProgressIndicator(),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_error != null) {
      return _Message(icon: Icons.error_outline, text: _error!);
    }
    if (!_searched) {
      return const _Message(
        icon: Icons.travel_explore,
        text: 'Busque uma clínica pelo nome, CNPJ ou código CNES.',
      );
    }
    if (_results.isEmpty && !_loading) {
      return const _Message(
        icon: Icons.search_off,
        text:
            'Nenhuma clínica encontrada no CNES.\n'
            'Clínicas muito novas podem levar até um mês para aparecer.',
      );
    }
    return ListView.separated(
      itemCount: _results.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final candidate = _results[index];
        return ListTile(
          key: ValueKey('cnes-candidate-${candidate.cnesCode}'),
          title: Text(candidate.name),
          subtitle: Text(
            [
              if (candidate.whereLabel.isNotEmpty) candidate.whereLabel,
              'CNES ${candidate.cnesCode}',
            ].join(' · '),
          ),
          /*
           * The one thing the row must say: importing this adds a vertical
           * profile to a clinic we already hold, rather than creating one. The
           * outcome differs, so the label does.
           */
          trailing: candidate.imported
              ? const Chip(label: Text('Já cadastrada'))
              : const Icon(Icons.chevron_right),
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
            Icon(icon, size: 40),
            const SizedBox(height: 12),
            Text(text, textAlign: TextAlign.center),
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
        _lat.text = preview.latitude?.toString() ?? '';
        _lng.text = preview.longitude?.toString() ?? '';
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

  String? _nullIfBlank(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  @override
  Widget build(BuildContext context) {
    final preview = _preview;

    return Scaffold(
      appBar: AppBar(title: Text(widget.candidate.name)),
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
          : SafeArea(
              minimum: const EdgeInsets.all(16),
              child: FilledButton(
                key: const ValueKey('cnes-import-submit'),
                onPressed: _submitting ? null : _submit,
                child: Text(
                  preview.alreadyImported
                      ? 'Adicionar à minha vertical'
                      : 'Importar clínica',
                ),
              ),
            ),
    );
  }

  /// §6.1 case 2. One confirmation, and deliberately no fields: the record is
  /// already ours and is not this user's to rewrite.
  List<Widget> _alreadyOursBody(CnesFacilityPreview preview) {
    return [
      const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Text(
            'Esta clínica já está cadastrada na AtlasMed, mas não aparece para a '
            'sua vertical. Adicioná-la não altera o cadastro existente — apenas '
            'passa a exibi-la para você.',
          ),
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

  List<Widget> _wizardBody(CnesFacilityPreview preview) {
    return [
      const Text(
        'Confira os dados do CNES antes de importar. Tudo pode ser corrigido, '
        'exceto o CNPJ.',
      ),
      const SizedBox(height: 16),
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
      const SizedBox(height: 8),
      TextField(
        controller: _name,
        decoration: const InputDecoration(labelText: 'Nome'),
      ),
      TextField(
        controller: _street,
        decoration: const InputDecoration(labelText: 'Logradouro'),
      ),
      TextField(
        controller: _number,
        decoration: const InputDecoration(labelText: 'Número'),
      ),
      TextField(
        controller: _neighborhood,
        decoration: const InputDecoration(labelText: 'Bairro'),
      ),
      TextField(
        controller: _postalCode,
        decoration: const InputDecoration(labelText: 'CEP'),
      ),
      TextField(
        controller: _phone,
        decoration: const InputDecoration(labelText: 'Telefone'),
      ),
      TextField(
        controller: _email,
        decoration: const InputDecoration(labelText: 'E-mail'),
      ),
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
        style: Theme.of(context).textTheme.bodySmall,
      ),
      Row(
        children: [
          Expanded(
            child: TextField(
              controller: _lat,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
                signed: true,
              ),
              decoration: const InputDecoration(labelText: 'Latitude'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: _lng,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
                signed: true,
              ),
              decoration: const InputDecoration(labelText: 'Longitude'),
            ),
          ),
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
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 140,
            child: Text(label, style: Theme.of(context).textTheme.bodySmall),
          ),
          Expanded(child: Text(value)),
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
    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Text(
          message,
          style: TextStyle(
            color: Theme.of(context).colorScheme.onErrorContainer,
          ),
        ),
      ),
    );
  }
}
