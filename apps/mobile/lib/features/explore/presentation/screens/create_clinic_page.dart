import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/explore/data/establishment_detail_models.dart';
import 'package:atlasmed_mobile_app/features/explore/data/repositories/facilities_write_repository.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/providers/explore_provider.dart';
import 'package:atlasmed_mobile_app/features/explore/presentation/widgets/clinic_detail/clinic_location_map_screen.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;

const _kUfOptions = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE',
  'TO',
];

class CreateClinicPage extends ConsumerStatefulWidget {
  const CreateClinicPage({super.key});

  @override
  ConsumerState<CreateClinicPage> createState() => _CreateClinicPageState();
}

class _CreateClinicPageState extends ConsumerState<CreateClinicPage> {
  final _nameCtrl = TextEditingController();
  final _legalNameCtrl = TextEditingController();
  final _tradeNameCtrl = TextEditingController();
  final _cnpjCtrl = TextEditingController();
  final _cpfCtrl = TextEditingController();
  final _streetCtrl = TextEditingController();
  final _numberCtrl = TextEditingController();
  final _complementCtrl = TextEditingController();
  final _neighborhoodCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _postalCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _whatsappCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();

  String _taxIdType = 'PJ';
  String? _state;
  double? _lat;
  double? _lng;
  String? _geocodeLabel;
  bool _geocoding = false;
  bool _saving = false;
  bool _mapExpandedOpen = false;
  int _miniMapGeneration = 0;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _legalNameCtrl.dispose();
    _tradeNameCtrl.dispose();
    _cnpjCtrl.dispose();
    _cpfCtrl.dispose();
    _streetCtrl.dispose();
    _numberCtrl.dispose();
    _complementCtrl.dispose();
    _neighborhoodCtrl.dispose();
    _cityCtrl.dispose();
    _postalCtrl.dispose();
    _phoneCtrl.dispose();
    _whatsappCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Scaffold(
      backgroundColor: const Color(0xFFf8f9fb),
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(4, top + 4, 8, 8),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back_rounded),
                  onPressed: () => context.pop(),
                ),
                const Expanded(
                  child: Text(
                    'Nova clínica',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0f1729),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
              children: [
                _sectionTitle('Identidade'),
                _field(_nameCtrl, 'Nome *', TextInputType.name),
                const SizedBox(height: 10),
                _field(_legalNameCtrl, 'Razão social', TextInputType.name),
                const SizedBox(height: 10),
                _field(_tradeNameCtrl, 'Nome fantasia', TextInputType.name),
                const SizedBox(height: 18),
                _sectionTitle('Documento'),
                Row(
                  children: [
                    ChoiceChip(
                      label: const Text('CNPJ'),
                      selected: _taxIdType == 'PJ',
                      onSelected: (_) => setState(() => _taxIdType = 'PJ'),
                    ),
                    const SizedBox(width: 8),
                    ChoiceChip(
                      label: const Text('CPF'),
                      selected: _taxIdType == 'PF',
                      onSelected: (_) => setState(() => _taxIdType = 'PF'),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (_taxIdType == 'PJ')
                  _field(
                    _cnpjCtrl,
                    'CNPJ',
                    TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  )
                else
                  _field(
                    _cpfCtrl,
                    'CPF',
                    TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  ),
                const SizedBox(height: 18),
                _sectionTitle('Endereço'),
                _field(_streetCtrl, 'Logradouro *', TextInputType.streetAddress),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _field(_numberCtrl, 'Número *', TextInputType.text),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 2,
                      child: _field(
                        _complementCtrl,
                        'Complemento',
                        TextInputType.text,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                _field(_neighborhoodCtrl, 'Bairro *', TextInputType.text),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: _field(_cityCtrl, 'Cidade *', TextInputType.text),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: _ufField()),
                  ],
                ),
                const SizedBox(height: 10),
                _field(
                  _postalCtrl,
                  'CEP *',
                  TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                ),
                const SizedBox(height: 14),
                _locationSection(),
                const SizedBox(height: 18),
                _sectionTitle('Contato'),
                _field(_phoneCtrl, 'Telefone', TextInputType.phone),
                const SizedBox(height: 10),
                _field(_whatsappCtrl, 'WhatsApp', TextInputType.phone),
                const SizedBox(height: 10),
                _field(_emailCtrl, 'E-mail', TextInputType.emailAddress),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _saving ? null : _submit,
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
                      : const Text('Criar clínica'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
          color: Color(0xFF6b7280),
        ),
      ),
    );
  }

  Widget _locationSection() {
    final hasCoords = _lat != null && _lng != null;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFe5e7eb)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Localização',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0f1729),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            hasCoords
                ? 'Confira o pin no mapa antes de criar a clínica.'
                : 'Geocodifique o endereço para posicionar a clínica no mapa.',
            style: const TextStyle(fontSize: 12.5, color: Color(0xFF6b7280)),
          ),
          const SizedBox(height: 12),
          FilledButton.tonalIcon(
            onPressed: _geocoding ? null : _geocode,
            icon: _geocoding
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.my_location_rounded, size: 18),
            label: Text(_geocoding ? 'Geocodificando…' : 'Geocodificar endereço'),
            style: FilledButton.styleFrom(
              foregroundColor: const Color(0xFF1e40af),
              minimumSize: const Size.fromHeight(44),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          if (hasCoords) ...[
            const SizedBox(height: 12),
            Text(
              _geocodeLabel ??
                  '${_lat!.toStringAsFixed(5)}, ${_lng!.toStringAsFixed(5)}',
              style: const TextStyle(
                fontSize: 12.5,
                color: Color(0xFF6b7280),
              ),
            ),
            const SizedBox(height: 10),
            _buildMinimap(),
          ],
        ],
      ),
    );
  }

  Widget _ufField() {
    final selected = _state;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: _pickUf,
      child: InputDecorator(
        decoration: _decoration('UF *').copyWith(
          suffixIcon: const Icon(
            Icons.keyboard_arrow_down_rounded,
            color: Color(0xFF6b7280),
          ),
        ),
        child: Text(
          selected ?? 'Selecione',
          style: TextStyle(
            fontSize: 16,
            color: selected == null
                ? const Color(0xFF9ca3af)
                : const Color(0xFF0f1729),
          ),
        ),
      ),
    );
  }

  Future<void> _pickUf() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
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
                  'UF',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0f1729),
                  ),
                ),
                const SizedBox(height: 12),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 5,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 1.4,
                  children: _kUfOptions.map((uf) {
                    final selected = uf == _state;
                    return Material(
                      color: selected
                          ? const Color(0xFF1e40af)
                          : const Color(0xFFf3f4f6),
                      borderRadius: BorderRadius.circular(10),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(10),
                        onTap: () => Navigator.of(context).pop(uf),
                        child: Center(
                          child: Text(
                            uf,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: selected
                                  ? Colors.white
                                  : const Color(0xFF0f1729),
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (!mounted || picked == null) return;
    setState(() => _state = picked);
  }

  InputDecoration _decoration(String label) {
    return InputDecoration(
      labelText: label,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFe5e7eb)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFe5e7eb)),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label,
    TextInputType type, {
    List<TextInputFormatter>? inputFormatters,
  }) {
    return TextField(
      controller: controller,
      keyboardType: type,
      inputFormatters: inputFormatters,
      textCapitalization:
          type == TextInputType.name || type == TextInputType.text
          ? TextCapitalization.words
          : TextCapitalization.none,
      decoration: _decoration(label),
    );
  }

  Widget _buildMinimap() {
    final location = EstablishmentLocation(
      latitude: _lat!,
      longitude: _lng!,
      formattedAddress: _geocodeLabel,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: () => _openFullMap(location),
            icon: const Icon(Icons.open_in_full_rounded, size: 14),
            label: const Text('Expandir'),
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFF1e40af),
              visualDensity: VisualDensity.compact,
            ),
          ),
        ),
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: SizedBox(
            height: 160,
            child: _mapExpandedOpen
                ? _MapPlaceholder(location: location)
                : _MiniMapPreview(
                    key: ValueKey('create-clinic-mini-$_miniMapGeneration'),
                    location: location,
                  ),
          ),
        ),
      ],
    );
  }

  Future<void> _openFullMap(EstablishmentLocation location) async {
    setState(() => _mapExpandedOpen = true);
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ClinicLocationMapScreen(
          facilityName: _nameCtrl.text.trim().isEmpty
              ? 'Nova clínica'
              : _nameCtrl.text.trim(),
          location: location,
        ),
      ),
    );
    if (!mounted) return;
    setState(() {
      _mapExpandedOpen = false;
      _miniMapGeneration++;
    });
  }

  String? _validate() {
    if (_nameCtrl.text.trim().isEmpty) return 'Informe o nome da clínica';
    if (_taxIdType == 'PJ') {
      final digits = _cnpjCtrl.text.replaceAll(RegExp(r'\D'), '');
      if (digits.isNotEmpty && digits.length != 14) {
        return 'CNPJ inválido';
      }
    } else {
      final digits = _cpfCtrl.text.replaceAll(RegExp(r'\D'), '');
      if (digits.isNotEmpty && digits.length != 11) {
        return 'CPF inválido';
      }
    }
    if (_streetCtrl.text.trim().isEmpty ||
        _numberCtrl.text.trim().isEmpty ||
        _neighborhoodCtrl.text.trim().isEmpty ||
        _cityCtrl.text.trim().isEmpty ||
        _state == null ||
        _postalCtrl.text.trim().isEmpty) {
      return 'Preencha o endereço completo para geocodificar';
    }
    if (_lat == null || _lng == null) {
      return 'Geocodifique o endereço antes de salvar';
    }
    final email = _emailCtrl.text.trim();
    if (email.isNotEmpty && !email.contains('@')) {
      return 'E-mail inválido';
    }
    return null;
  }

  Future<void> _geocode() async {
    final err = () {
      if (_streetCtrl.text.trim().isEmpty ||
          _numberCtrl.text.trim().isEmpty ||
          _neighborhoodCtrl.text.trim().isEmpty ||
          _cityCtrl.text.trim().isEmpty ||
          _state == null ||
          _postalCtrl.text.trim().isEmpty) {
        return 'Preencha logradouro, número, bairro, cidade, UF e CEP';
      }
      return null;
    }();
    if (err != null) {
      _snack(err);
      return;
    }

    final query = [
      '${_streetCtrl.text.trim()}, ${_numberCtrl.text.trim()}',
      if (_complementCtrl.text.trim().isNotEmpty) _complementCtrl.text.trim(),
      _neighborhoodCtrl.text.trim(),
      '${_cityCtrl.text.trim()} - $_state',
      _postalCtrl.text.trim(),
      'Brasil',
    ].join(', ');

    setState(() => _geocoding = true);
    final repo = FacilitiesWriteRepository();
    try {
      final result = await repo.geocodeForward(query);
      if (!mounted) return;
      setState(() {
        _lat = result.latitude;
        _lng = result.longitude;
        _geocodeLabel = result.placeName;
        _miniMapGeneration++;
      });
    } catch (e) {
      if (!mounted) return;
      _snack(
        e is FacilitiesWriteException
            ? (e.message ?? 'Falha ao geocodificar')
            : 'Falha ao geocodificar',
      );
    } finally {
      repo.dispose();
      if (mounted) setState(() => _geocoding = false);
    }
  }

  Future<void> _submit() async {
    final err = _validate();
    if (err != null) {
      _snack(err);
      return;
    }

    setState(() => _saving = true);
    final repo = FacilitiesWriteRepository();
    try {
      final body = <String, dynamic>{
        'name': _nameCtrl.text.trim(),
        'taxIdType': _taxIdType,
        'country': 'BR',
        'lat': _lat,
        'lng': _lng,
        if (_legalNameCtrl.text.trim().isNotEmpty)
          'legalName': _legalNameCtrl.text.trim(),
        if (_tradeNameCtrl.text.trim().isNotEmpty)
          'tradeName': _tradeNameCtrl.text.trim(),
        if (_taxIdType == 'PJ' && _cnpjCtrl.text.trim().isNotEmpty)
          'cnpj': _cnpjCtrl.text.replaceAll(RegExp(r'\D'), ''),
        if (_taxIdType == 'PF' && _cpfCtrl.text.trim().isNotEmpty)
          'cpf': _cpfCtrl.text.replaceAll(RegExp(r'\D'), ''),
        'streetAddress': _streetCtrl.text.trim(),
        'streetNumber': _numberCtrl.text.trim(),
        if (_complementCtrl.text.trim().isNotEmpty)
          'addressComplement': _complementCtrl.text.trim(),
        'neighborhood': _neighborhoodCtrl.text.trim(),
        'city': _cityCtrl.text.trim(),
        'state': _state,
        'postalCode': _postalCtrl.text.replaceAll(RegExp(r'\D'), ''),
        if (_phoneCtrl.text.trim().isNotEmpty)
          'phoneNumber': _phoneCtrl.text.trim(),
        if (_whatsappCtrl.text.trim().isNotEmpty)
          'whatsappNumber': _whatsappCtrl.text.trim(),
        if (_emailCtrl.text.trim().isNotEmpty) 'email': _emailCtrl.text.trim(),
      };

      final id = await repo.createFacility(body);
      await ref.read(exploreProvider.notifier).loadData();
      if (!mounted) return;
      context.pushReplacement('/workspace/clinic/$id');
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      _snack(
        e is FacilitiesWriteException
            ? (e.message ?? 'Falha ao criar clínica')
            : 'Falha ao criar clínica',
      );
    } finally {
      repo.dispose();
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }
}

class _MiniMapPreview extends StatefulWidget {
  const _MiniMapPreview({super.key, required this.location});

  final EstablishmentLocation location;

  @override
  State<_MiniMapPreview> createState() => _MiniMapPreviewState();
}

class _MiniMapPreviewState extends State<_MiniMapPreview> {
  bool _unavailable = false;
  MapboxMap? _mapboxMap;

  @override
  Widget build(BuildContext context) {
    final token = AppConfig.mapboxAccessToken;
    if (token.isEmpty || _unavailable) {
      return _MapPlaceholder(location: widget.location);
    }

    MapboxOptions.setAccessToken(token);
    return MapWidget(
      key: ValueKey(
        'create-mini-${widget.location.latitude}-${widget.location.longitude}',
      ),
      styleUri: MapboxStyles.STANDARD,
      viewport: CameraViewportState(
        center: Point(
          coordinates: Position(
            widget.location.longitude,
            widget.location.latitude,
          ),
        ),
        zoom: 13.5,
      ),
      onMapCreated: (map) {
        _mapboxMap = map;
        map.scaleBar.updateSettings(ScaleBarSettings(enabled: false));
      },
      onMapLoadErrorListener: (_) => setState(() => _unavailable = true),
      onStyleLoadedListener: (_) => _addPin(),
    );
  }

  Future<void> _addPin() async {
    final map = _mapboxMap;
    if (map == null || !mounted) return;
    try {
      final manager = await map.annotations.createCircleAnnotationManager();
      await manager.create(
        CircleAnnotationOptions(
          geometry: Point(
            coordinates: Position(
              widget.location.longitude,
              widget.location.latitude,
            ),
          ),
          circleColor: const Color(0xFF1e40af).toARGB32(),
          circleRadius: 10,
          circleStrokeColor: Colors.white.toARGB32(),
          circleStrokeWidth: 3,
        ),
      );
    } catch (_) {
      if (mounted) setState(() => _unavailable = true);
    }
  }
}

class _MapPlaceholder extends StatelessWidget {
  const _MapPlaceholder({required this.location});

  final EstablishmentLocation location;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFe8eef5),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Icon(
            Icons.map_outlined,
            size: 64,
            color: const Color(0xFF1e40af).withValues(alpha: 0.15),
          ),
          const Icon(
            Icons.location_on_rounded,
            size: 36,
            color: Color(0xFF1e40af),
          ),
          Positioned(
            bottom: 8,
            left: 8,
            right: 8,
            child: Text(
              '${location.latitude.toStringAsFixed(4)}, ${location.longitude.toStringAsFixed(4)}',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 10, color: Color(0xFF6b7280)),
            ),
          ),
        ],
      ),
    );
  }
}
