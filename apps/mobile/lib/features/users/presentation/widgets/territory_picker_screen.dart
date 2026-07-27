import 'dart:math' as math;

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/bounds.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/users/data/models/assignment_option.dart';
import 'package:atlasmed_mobile_app/features/users/presentation/providers/users_repository_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import 'package:atlasmed_mobile_app/shared/theme/app_theme.dart';

/// Full-screen multi-select map picker for invite / assignment flows.
///
/// Entry points:
/// - [pickForVertical] — `GET /territories?verticalId=` (Manager invite).
/// - [pickForManager] — `GET /territories?managerId=&verticalId=` (REP),
///   outlines the manager zone. Scope filtering is server-side.
///
/// Tapping toggles selection; confirm returns the full selected list.
class TerritoryPickerScreen extends ConsumerStatefulWidget {
  const TerritoryPickerScreen._({
    this.verticalId,
    this.managerId,
    this.initiallySelectedIds = const {},
  });

  final String? verticalId;
  final String? managerId;
  final Set<String> initiallySelectedIds;

  /// Manager invite — territories in [verticalId].
  static Future<List<TerritoryOption>?> pickForVertical(
    BuildContext context, {
    required String verticalId,
    Set<String> initiallySelectedIds = const {},
  }) {
    return Navigator.of(context).push<List<TerritoryOption>>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => TerritoryPickerScreen._(
          verticalId: verticalId,
          initiallySelectedIds: initiallySelectedIds,
        ),
      ),
    );
  }

  /// REP picker — patches valid for [managerId] (and optional [verticalId]).
  static Future<List<TerritoryOption>?> pickForManager(
    BuildContext context, {
    required String managerId,
    String? verticalId,
    Set<String> initiallySelectedIds = const {},
  }) {
    return Navigator.of(context).push<List<TerritoryOption>>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => TerritoryPickerScreen._(
          managerId: managerId,
          verticalId: verticalId,
          initiallySelectedIds: initiallySelectedIds,
        ),
      ),
    );
  }

  @override
  ConsumerState<TerritoryPickerScreen> createState() =>
      _TerritoryPickerScreenState();
}

class _TerritoryPickerScreenState extends ConsumerState<TerritoryPickerScreen> {
  static const _freeColor = 0xFF059669;
  static const _occupiedColor = 0xFF9CA3AF;
  static const _selectedColor = 0xFFF59E0B;
  static const _managerZoneColor = 0xFF2563EB;
  static const _haloColor = 0xFFFFFFFF;

  static const _saoPauloCenter = MapCoordinate(
    longitude: -46.6333,
    latitude: -23.5505,
  );

  MapboxMap? _mapboxMap;
  PolygonAnnotationManager? _polygonManager;
  PolylineAnnotationManager? _borderManager;
  PointAnnotationManager? _tagManager;
  bool _mapUnavailable = false;
  bool _viewportApplied = false;
  bool _suppressNextMapTapDeselect = false;
  bool _mapReady = false;
  double _zoom = 11;
  late final Set<String> _selectedIds = {...widget.initiallySelectedIds};

  List<TerritoryOption> _territories = const [];
  ManagerTerritoryScope? _managerScope;
  Object? _loadError;
  bool _loading = true;

  bool get _isRepScoped => widget.managerId != null;

  List<TerritoryOption> get _selectedTerritories => _territories
      .where((t) => !t.isOccupied && _selectedIds.contains(t.id))
      .toList(growable: false);

  @override
  void initState() {
    super.initState();
    MapboxOptions.setAccessToken(AppConfig.mapboxAccessToken);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadTerritories());
  }

  Future<void> _loadTerritories() async {
    try {
      final repo = ref.read(usersRepositoryProvider);
      final managerId = widget.managerId;
      late final List<TerritoryOption> list;
      ManagerTerritoryScope? scope;
      if (managerId != null) {
        scope = await repo.getTerritoriesForManager(
          managerId,
          verticalId: widget.verticalId,
        );
        list = scope.territories;
      } else {
        list = await repo.getTerritoryOptions(verticalId: widget.verticalId);
      }
      if (!mounted) return;
      final occupiedIds = list
          .where((t) => t.isOccupied)
          .map((t) => t.id)
          .toSet();
      setState(() {
        _managerScope = scope;
        _territories = list;
        _selectedIds.removeWhere(occupiedIds.contains);
        _loading = false;
        _loadError = null;
      });
      if (_mapReady) {
        await _renderAnnotations();
        await _fitBounds();
        await _refreshSelectionTags();
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final token = AppConfig.mapboxAccessToken;
    final scope = _managerScope;
    final selectedCount = _selectedIds.length;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 4, 10, 4),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(
                      Icons.close_rounded,
                      color: AppColors.gray900,
                    ),
                  ),
                  const Expanded(
                    child: Text(
                      'Selecionar territórios',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.gray900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_isRepScoped)
              _ManagerScopeBanner(
                loading: _loading,
                managerName: scope?.managerName,
                territoryName: scope?.managerTerritoryName,
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Wrap(
                spacing: 14,
                runSpacing: 6,
                children: [
                  if (_isRepScoped)
                    const _LegendDot(
                      color: Color(_managerZoneColor),
                      label: 'Área do gerente',
                    ),
                  const _LegendDot(
                    color: Color(_freeColor),
                    label: 'Disponível',
                  ),
                  const _LegendDot(
                    color: Color(_occupiedColor),
                    label: 'Ocupado',
                  ),
                  const _LegendDot(
                    color: Color(_selectedColor),
                    label: 'Selecionado',
                  ),
                ],
              ),
            ),
            Expanded(child: _buildMapBody(token)),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: const AppColors.navyDeep,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: _loading
                        ? null
                        : () => Navigator.of(context).pop(_selectedTerritories),
                    child: Text(
                      selectedCount == 0
                          ? 'Confirmar seleção'
                          : 'Confirmar ($selectedCount)',
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMapBody(String token) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_loadError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Não foi possível carregar os territórios.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.gray500),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () {
                  setState(() {
                    _loading = true;
                    _loadError = null;
                  });
                  _loadTerritories();
                },
                child: const Text('Tentar novamente'),
              ),
            ],
          ),
        ),
      );
    }
    if (_territories.isEmpty) {
      return const Center(
        child: Text(
          'Nenhum território disponível nesta seleção.',
          style: TextStyle(color: AppColors.gray500),
        ),
      );
    }
    if (token.isEmpty || _mapUnavailable) {
      return const Center(
        child: Text(
          'Mapa indisponível.',
          style: TextStyle(color: AppColors.gray500),
        ),
      );
    }

    return MapWidget(
      key: ValueKey(
        'mapa-selecao-${widget.managerId ?? 'sector'}-${widget.verticalId}',
      ),
      styleUri: MapboxStyles.STANDARD,
      viewport: _viewportApplied
          ? null
          : CameraViewportState(center: _point(_saoPauloCenter), zoom: 11),
      onMapCreated: (mapboxMap) {
        _mapboxMap = mapboxMap;
        _viewportApplied = true;
        mapboxMap.scaleBar.updateSettings(ScaleBarSettings(enabled: false));
      },
      onStyleLoadedListener: (_) => _configureMap(),
      onMapLoadErrorListener: (_) => setState(() => _mapUnavailable = true),
      onCameraChangeListener: _handleCameraChanged,
      // ignore: deprecated_member_use
      onTapListener: _handleMapTap,
    );
  }

  Future<void> _configureMap() async {
    final mapboxMap = _mapboxMap;
    if (mapboxMap == null || !mounted) return;

    try {
      _polygonManager = await mapboxMap.annotations
          .createPolygonAnnotationManager();
      _borderManager = await mapboxMap.annotations
          .createPolylineAnnotationManager();
      _tagManager = await mapboxMap.annotations.createPointAnnotationManager();
      _polygonManager!.tapEvents(onTap: _handlePolygonTap);
      _mapReady = true;

      if (_loading) return;

      await _renderAnnotations();
      await _fitBounds();
    } catch (_) {
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }

  void _handlePolygonTap(PolygonAnnotation annotation) {
    final kind = annotation.customData?['kind'] as String?;
    // Manager zone outline and occupied patches are not selectable.
    if (kind == 'managerZone' || kind == 'occupied') return;
    final territoryId = annotation.customData?['territoryId'] as String?;
    final territory = _find(territoryId);
    if (territory == null || territory.isOccupied) return;
    _suppressNextMapTapDeselect = true;
    _toggle(territory);
  }

  void _handleMapTap(MapContentGestureContext context) {
    if (_suppressNextMapTapDeselect) {
      _suppressNextMapTapDeselect = false;
    }
  }

  void _handleCameraChanged(CameraChangedEventData event) {
    _zoom = event.cameraState.zoom;
    // Multi-select tags are recreated on toggle; skip per-frame updates.
  }

  TerritoryOption? _find(String? id) {
    if (id == null) return null;
    for (final t in _territories) {
      if (t.id == id) return t;
    }
    return null;
  }

  Future<void> _toggle(TerritoryOption territory) async {
    if (territory.isOccupied) return;
    setState(() {
      if (_selectedIds.contains(territory.id)) {
        _selectedIds.remove(territory.id);
      } else {
        _selectedIds.add(territory.id);
      }
    });
    await _renderAnnotations();
    await _refreshSelectionTags();
  }

  Future<void> _refreshSelectionTags() async {
    final tagManager = _tagManager;
    if (tagManager == null) return;
    await tagManager.deleteAll();
    for (final territory in _selectedTerritories) {
      final boundary = territory.boundary;
      final anchor =
          boundary?.labelAnchor ?? territory.centroid ?? _saoPauloCenter;
      await tagManager.create(
        PointAnnotationOptions(
          geometry: _point(anchor),
          textField: territory.name,
          textSize: _tagTextSizeForZoom(_zoom),
          textColor: Colors.white.toARGB32(),
          textHaloColor: const Color(_selectedColor).toARGB32(),
          textHaloWidth: _tagHaloWidthForZoom(_zoom),
        ),
      );
    }
  }

  double _zoomScale(double zoom) =>
      math.pow(2, zoom - 14.0).toDouble().clamp(0.45, 2.5);

  double _tagTextSizeForZoom(double zoom) => 12.5 * _zoomScale(zoom);

  double _tagHaloWidthForZoom(double zoom) => 6.0 * _zoomScale(zoom);

  Future<void> _renderAnnotations() async {
    final polygonManager = _polygonManager;
    final borderManager = _borderManager;
    if (polygonManager == null || borderManager == null) return;

    await polygonManager.deleteAll();
    await borderManager.deleteAll();

    final polygonOptions = <PolygonAnnotationOptions>[];
    final haloOptions = <PolylineAnnotationOptions>[];
    final borderOptions = <PolylineAnnotationOptions>[];

    // Manager zone first — outline only (light fill), not tappable as a patch.
    final zoneBoundary = _managerScope?.managerZoneBoundary;
    if (zoneBoundary != null) {
      _appendGeometry(
        boundary: zoneBoundary,
        fillColor: _managerZoneColor,
        fillOpacity: 0.08,
        lineColor: _managerZoneColor,
        haloWidth: 6.0,
        lineWidth: 2.6,
        customData: const {'kind': 'managerZone'},
        polygonOptions: polygonOptions,
        haloOptions: haloOptions,
        borderOptions: borderOptions,
      );
    }

    for (final territory in _territories) {
      final boundary = territory.boundary;
      if (boundary == null) continue;

      final selected =
          !territory.isOccupied && _selectedIds.contains(territory.id);
      final baseColor = territory.isOccupied ? _occupiedColor : _freeColor;
      final lineColor = selected ? _selectedColor : baseColor;

      _appendGeometry(
        boundary: boundary,
        fillColor: baseColor,
        fillOpacity: selected ? 0.42 : (territory.isOccupied ? 0.28 : 0.22),
        lineColor: lineColor,
        haloWidth: selected ? 5.0 : 3.4,
        lineWidth: selected ? 3.0 : 1.8,
        customData: {
          'kind': territory.isOccupied ? 'occupied' : 'patch',
          'territoryId': territory.id,
        },
        polygonOptions: polygonOptions,
        haloOptions: haloOptions,
        borderOptions: borderOptions,
      );
    }

    await polygonManager.createMulti(polygonOptions);
    await borderManager.createMulti([...haloOptions, ...borderOptions]);
  }

  void _appendGeometry({
    required TerritoryGeometry boundary,
    required int fillColor,
    required double fillOpacity,
    required int lineColor,
    required double haloWidth,
    required double lineWidth,
    required Map<String, Object> customData,
    required List<PolygonAnnotationOptions> polygonOptions,
    required List<PolylineAnnotationOptions> haloOptions,
    required List<PolylineAnnotationOptions> borderOptions,
  }) {
    for (final polygonRings in boundary.coordinates) {
      polygonOptions.add(
        PolygonAnnotationOptions(
          geometry: Polygon.fromPoints(
            points: polygonRings.map(_ringToPoints).toList(),
          ),
          fillColor: fillColor,
          fillOpacity: fillOpacity,
          fillOutlineColor: lineColor,
          customData: customData,
        ),
      );

      for (final ring in polygonRings) {
        final points = _ringToPoints(ring);
        haloOptions.add(
          PolylineAnnotationOptions(
            geometry: LineString.fromPoints(points: points),
            lineColor: _haloColor,
            lineWidth: haloWidth,
            lineJoin: LineJoin.ROUND,
          ),
        );
        borderOptions.add(
          PolylineAnnotationOptions(
            geometry: LineString.fromPoints(points: points),
            lineColor: lineColor,
            lineWidth: lineWidth,
            lineJoin: LineJoin.ROUND,
          ),
        );
      }
    }
  }

  Future<void> _fitBounds() async {
    final mapboxMap = _mapboxMap;
    if (mapboxMap == null) return;

    final zoneBounds = _managerScope?.managerZoneBoundary?.bounds;
    final patchBounds = _combinedBounds(_territories);
    final bounds = zoneBounds ?? patchBounds;
    if (bounds == null) return;

    try {
      final camera = await mapboxMap.cameraForCoordinateBounds(
        CoordinateBounds(
          southwest: _point(bounds.southwest),
          northeast: _point(bounds.northeast),
          infiniteBounds: false,
        ),
        MbxEdgeInsets(top: 40, left: 32, bottom: 96, right: 32),
        null,
        null,
        null,
        null,
      );
      await mapboxMap.easeTo(camera, MapAnimationOptions(duration: 500));
    } catch (_) {
      // Best-effort camera fit.
    }
  }

  MapBounds? _combinedBounds(List<TerritoryOption> territories) {
    MapBounds? combined;
    for (final territory in territories) {
      final bounds = territory.boundary?.bounds;
      if (bounds == null) continue;
      combined = combined == null
          ? bounds
          : MapBounds(
              southwest: MapCoordinate(
                longitude:
                    bounds.southwest.longitude < combined.southwest.longitude
                    ? bounds.southwest.longitude
                    : combined.southwest.longitude,
                latitude:
                    bounds.southwest.latitude < combined.southwest.latitude
                    ? bounds.southwest.latitude
                    : combined.southwest.latitude,
              ),
              northeast: MapCoordinate(
                longitude:
                    bounds.northeast.longitude > combined.northeast.longitude
                    ? bounds.northeast.longitude
                    : combined.northeast.longitude,
                latitude:
                    bounds.northeast.latitude > combined.northeast.latitude
                    ? bounds.northeast.latitude
                    : combined.northeast.latitude,
              ),
            );
    }
    return combined;
  }

  List<Point> _ringToPoints(List<MapCoordinate> ring) =>
      ring.map(_point).toList();

  Point _point(MapCoordinate coordinate) =>
      Point(coordinates: Position(coordinate.longitude, coordinate.latitude));
}

class _ManagerScopeBanner extends StatelessWidget {
  const _ManagerScopeBanner({
    required this.loading,
    this.managerName,
    this.territoryName,
  });

  final bool loading;
  final String? managerName;
  final String? territoryName;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF2563EB).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFF2563EB).withValues(alpha: 0.25),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.account_tree_outlined,
            size: 20,
            color: Color(0xFF2563EB),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: loading
                ? const Text(
                    'Carregando territórios do gerente…',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1e3a8a),
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        managerName ?? 'Gerente',
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1e3a8a),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        territoryName == null
                            ? 'Selecione um patch dentro da área deste gerente'
                            : 'Área: $territoryName',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF334155),
                        ),
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: AppColors.gray500,
          ),
        ),
      ],
    );
  }
}
