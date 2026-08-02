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

/// Map picker modes for invite / assignment flows.
enum TerritoryPickerMode {
  /// REP invite — single parent manager zone (occupied OK).
  repParentZone,

  /// MANAGER invite — one or more empty zones.
  managerEmptyZones,

  /// REP invite — free patches under a manager zone.
  repFreePatches,

  /// Legacy — patches scoped to a manager user id.
  patchesForManagerUser,
}

/// Full-screen map picker for invite / assignment flows.
///
/// Prefer the typed entry points:
/// - [pickRepParentZone]
/// - [pickManagerEmptyZones]
/// - [pickForZone]
/// - [pickForManager]
class TerritoryPickerScreen extends ConsumerStatefulWidget {
  const TerritoryPickerScreen._({
    required this.mode,
    this.verticalId,
    this.managerId,
    this.managerZoneId,
    this.initiallySelectedIds = const {},
  });

  final TerritoryPickerMode mode;
  final String? verticalId;
  final String? managerId;
  final String? managerZoneId;
  final Set<String> initiallySelectedIds;

  bool get allowOccupied => mode == TerritoryPickerMode.repParentZone;

  bool get singleSelect => mode == TerritoryPickerMode.repParentZone;

  String get title => switch (mode) {
        TerritoryPickerMode.repParentZone => 'Zona do gerente',
        TerritoryPickerMode.managerEmptyZones => 'Zonas vazias',
        TerritoryPickerMode.repFreePatches => 'Áreas livres',
        TerritoryPickerMode.patchesForManagerUser => 'Selecionar territórios',
      };

  /// REP invite — pick one parent manager zone.
  static Future<TerritoryOption?> pickRepParentZone(
    BuildContext context, {
    required String verticalId,
    String? initiallySelectedId,
  }) async {
    final picked = await Navigator.of(context).push<List<TerritoryOption>>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => TerritoryPickerScreen._(
          mode: TerritoryPickerMode.repParentZone,
          verticalId: verticalId,
          initiallySelectedIds: {
            ?initiallySelectedId,
          },
        ),
      ),
    );
    if (picked == null || picked.isEmpty) return null;
    return picked.first;
  }

  /// MANAGER invite — pick empty zones (multi).
  static Future<List<TerritoryOption>?> pickManagerEmptyZones(
    BuildContext context, {
    required String verticalId,
    Set<String> initiallySelectedIds = const {},
  }) {
    return Navigator.of(context).push<List<TerritoryOption>>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => TerritoryPickerScreen._(
          mode: TerritoryPickerMode.managerEmptyZones,
          verticalId: verticalId,
          initiallySelectedIds: initiallySelectedIds,
        ),
      ),
    );
  }

  /// @Deprecated — use [pickRepParentZone] or [pickManagerEmptyZones].
  static Future<List<TerritoryOption>?> pickForVertical(
    BuildContext context, {
    required String verticalId,
    Set<String> initiallySelectedIds = const {},
    bool allowOccupied = false,
  }) {
    if (allowOccupied) {
      return Navigator.of(context).push<List<TerritoryOption>>(
        MaterialPageRoute(
          fullscreenDialog: true,
          builder: (_) => TerritoryPickerScreen._(
            mode: TerritoryPickerMode.repParentZone,
            verticalId: verticalId,
            initiallySelectedIds: initiallySelectedIds,
          ),
        ),
      );
    }
    return pickManagerEmptyZones(
      context,
      verticalId: verticalId,
      initiallySelectedIds: initiallySelectedIds,
    );
  }

  /// REP invite — patches under [managerZoneId].
  static Future<List<TerritoryOption>?> pickForZone(
    BuildContext context, {
    required String managerZoneId,
    String? verticalId,
    Set<String> initiallySelectedIds = const {},
  }) {
    return Navigator.of(context).push<List<TerritoryOption>>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => TerritoryPickerScreen._(
          mode: TerritoryPickerMode.repFreePatches,
          managerZoneId: managerZoneId,
          verticalId: verticalId,
          initiallySelectedIds: initiallySelectedIds,
        ),
      ),
    );
  }

  /// Legacy REP picker — patches valid for [managerId].
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
          mode: TerritoryPickerMode.patchesForManagerUser,
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

  bool get _isRepScoped =>
      widget.mode == TerritoryPickerMode.repFreePatches ||
      widget.mode == TerritoryPickerMode.patchesForManagerUser;

  /// Free patches under a manager zone — hide occupied for invite UX.
  bool get _freeOnlyMode => widget.mode == TerritoryPickerMode.repFreePatches;

  /// Picking manager zones (REP parent or MANAGER empty zones).
  bool get _pickingManagerZones =>
      widget.mode == TerritoryPickerMode.repParentZone ||
      widget.mode == TerritoryPickerMode.managerEmptyZones;

  bool _isSelectable(TerritoryOption territory) =>
      widget.allowOccupied || !territory.isOccupied;

  List<TerritoryOption> get _selectedTerritories => _territories
      .where((t) => _isSelectable(t) && _selectedIds.contains(t.id))
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
      final managerZoneId = widget.managerZoneId;
      late final List<TerritoryOption> list;
      ManagerTerritoryScope? scope;
      if (managerZoneId != null) {
        list = await repo.getPatchesForZone(
          managerZoneId: managerZoneId,
          verticalId: widget.verticalId,
        );
        final zones = await repo.getTerritoryOptions(
          verticalId: widget.verticalId,
        );
        TerritoryOption? zone;
        for (final z in zones) {
          if (z.id == managerZoneId) {
            zone = z;
            break;
          }
        }
        scope = ManagerTerritoryScope(
          managerId: '',
          managerName: zone?.name ?? '',
          managerTerritoryId: managerZoneId,
          managerTerritoryName: zone?.name,
          managerZoneCentroid: zone?.centroid,
          managerZoneBoundary: zone?.boundary,
          territories: list,
        );
      } else if (managerId != null) {
        scope = await repo.getTerritoriesForManager(
          managerId,
          verticalId: widget.verticalId,
        );
        list = scope.territories;
      } else {
        list = await repo.getTerritoryOptions(verticalId: widget.verticalId);
      }
      if (!mounted) return;
      final filtered = _freeOnlyMode
          ? list.where((t) => !t.isOccupied).toList(growable: false)
          : list;
      final blockedIds = widget.allowOccupied
          ? const <String>{}
          : list.where((t) => t.isOccupied).map((t) => t.id).toSet();
      setState(() {
        _managerScope = scope;
        _territories = filtered;
        _selectedIds.removeWhere(blockedIds.contains);
        _selectedIds.removeWhere(
          (id) => !filtered.any((t) => t.id == id),
        );
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
                  Expanded(
                    child: Text(
                      widget.title,
                      style: const TextStyle(
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
                  if (widget.mode == TerritoryPickerMode.repParentZone) ...[
                    const _LegendDot(
                      color: Color(_managerZoneColor),
                      label: 'Zona do gerente',
                    ),
                  ] else if (widget.mode ==
                      TerritoryPickerMode.managerEmptyZones) ...[
                    const _LegendDot(
                      color: Color(_managerZoneColor),
                      label: 'Zona vazia',
                    ),
                    const _LegendDot(
                      color: Color(_occupiedColor),
                      label: 'Ocupada',
                    ),
                  ] else ...[
                    const _LegendDot(
                      color: Color(_freeColor),
                      label: 'Disponível',
                    ),
                    if (!_freeOnlyMode)
                      const _LegendDot(
                        color: Color(_occupiedColor),
                        label: 'Ocupado',
                      ),
                  ],
                  const _LegendDot(
                    color: Color(_selectedColor),
                    label: 'Selecionado',
                  ),
                ],
              ),
            ),
            Expanded(child: _buildMapBody(token)),
            if (_freeOnlyMode && !_loading && _loadError == null)
              _FreePatchList(
                territories: _territories,
                selectedIds: _selectedIds,
                onToggle: _toggle,
              ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.navyDeep,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: _loading
                        ? null
                        : () => Navigator.of(context).pop(_selectedTerritories),
                    child: Text(
                      widget.mode == TerritoryPickerMode.repParentZone
                          ? (selectedCount == 0
                              ? 'Selecionar zona'
                              : 'Confirmar zona')
                          : widget.mode ==
                                  TerritoryPickerMode.managerEmptyZones
                              ? (selectedCount == 0
                                  ? 'Selecionar zonas'
                                  : 'Confirmar ($selectedCount)')
                              : (selectedCount == 0
                                  ? 'Confirmar seleção'
                                  : 'Confirmar ($selectedCount)'),
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
    if (_territories.isEmpty &&
        !(_freeOnlyMode && _managerScope?.managerZoneBoundary != null)) {
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
    // Parent zone outline (patch mode) and occupied patches not selectable.
    if (kind == 'managerZone' || kind == 'occupied') return;
    final territoryId = annotation.customData?['territoryId'] as String?;
    final territory = _find(territoryId);
    if (territory == null || !_isSelectable(territory)) return;
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
    if (!_isSelectable(territory)) return;
    setState(() {
      if (_selectedIds.contains(territory.id)) {
        _selectedIds.remove(territory.id);
      } else if (widget.singleSelect) {
        _selectedIds
          ..clear()
          ..add(territory.id);
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

      final selectable = _isSelectable(territory);
      final selected =
          selectable && _selectedIds.contains(territory.id);
      final baseColor = _pickingManagerZones
          ? _managerZoneColor
          : (selectable ? _freeColor : _occupiedColor);
      final lineColor = selected ? _selectedColor : baseColor;

      _appendGeometry(
        boundary: boundary,
        fillColor: baseColor,
        fillOpacity: selected
            ? 0.42
            : (selectable ? 0.22 : 0.28),
        lineColor: lineColor,
        haloWidth: selected ? 5.0 : 3.4,
        lineWidth: selected ? 3.0 : 1.8,
        customData: {
          'kind': selectable
              ? (_pickingManagerZones ? 'zone' : 'patch')
              : 'occupied',
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
        color: AppColors.blue600.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.blue600.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.account_tree_outlined,
            size: 20,
            color: AppColors.blue600,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: loading
                ? const Text(
                    'Carregando territórios do gerente…',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.blueDarker,
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
                          color: AppColors.blueDarker,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        territoryName == null
                            ? 'Selecione um patch dentro da área deste gerente'
                            : 'Área: $territoryName',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.gray700,
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

/// List of free patches under the map — unambiguous when polygons overlap.
class _FreePatchList extends StatelessWidget {
  const _FreePatchList({
    required this.territories,
    required this.selectedIds,
    required this.onToggle,
  });

  final List<TerritoryOption> territories;
  final Set<String> selectedIds;
  final Future<void> Function(TerritoryOption territory) onToggle;

  @override
  Widget build(BuildContext context) {
    if (territories.isEmpty) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(16, 0, 16, 4),
        child: Text(
          'Nenhuma área livre nesta zona. Desenhe uma nova área no convite.',
          style: TextStyle(fontSize: 12.5, color: AppColors.gray500),
        ),
      );
    }

    return SizedBox(
      height: 112,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, 6),
            child: Text(
              'Áreas livres',
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: AppColors.gray500,
              ),
            ),
          ),
          Expanded(
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: territories.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final territory = territories[index];
                final selected = selectedIds.contains(territory.id);
                return FilterChip(
                  selected: selected,
                  showCheckmark: true,
                  label: Text(territory.name),
                  selectedColor: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                  checkmarkColor: const Color(0xFFF59E0B),
                  onSelected: (_) => onToggle(territory),
                );
              },
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
