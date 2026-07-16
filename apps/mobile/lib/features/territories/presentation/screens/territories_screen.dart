import 'dart:math' as math;

import 'package:atlasmed_mobile_app/core/config/app_config.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/bounds.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/coordinate.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory.dart';
import 'package:atlasmed_mobile_app/features/territories/data/models/territory_type.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/providers/territories_providers.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/sector_selector.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/territory_detail_sheet.dart';
import 'package:atlasmed_mobile_app/features/territories/presentation/widgets/territory_kind_switch.dart';
import 'package:atlasmed_mobile_app/shared/widgets/app_shell.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart' hide Size;

class TerritoriesScreen extends ConsumerWidget {
  const TerritoriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final token = AppConfig.mapboxAccessToken;
    if (token.isEmpty) {
      return const _TerritoriesPage(
        child: _StateMessage(
          icon: Icons.key_off_outlined,
          title: 'Mapa indisponível',
          message: 'A configuração do mapa não foi encontrada.',
        ),
      );
    }
    return _TerritoriesPage(child: _TerritoriesBody(accessToken: token));
  }
}

class _TerritoriesPage extends StatelessWidget {
  final Widget child;

  const _TerritoriesPage({required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FB),
      body: SafeArea(
        // The map should bleed all the way to the bottom edge — only the
        // top inset (status bar) is reserved, via AtlasTopBar itself.
        bottom: false,
        child: Column(
          children: [
            const AtlasTopBar(page: 'Territórios'),
            Expanded(child: child),
          ],
        ),
      ),
    );
  }
}

class _TerritoriesBody extends ConsumerWidget {
  final String accessToken;

  const _TerritoriesBody({required this.accessToken});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kind = ref.watch(selectedTerritoryKindProvider);
    final sectorsAsync = ref.watch(sectorsProvider);
    final effectiveSectorId = ref.watch(effectiveSectorIdProvider).valueOrNull;
    final territoriesAsync = ref.watch(territoriesProvider);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TerritoryKindSwitch(
                value: kind,
                onChanged: (newKind) {
                  if (newKind == kind) return;
                  ref.read(selectedTerritoryIdProvider.notifier).state = null;
                  ref.read(selectedTerritoryKindProvider.notifier).state =
                      newKind;
                },
              ),
              const SizedBox(height: 10),
              sectorsAsync.when(
                data: (sectors) => SectorSelector(
                  sectors: sectors,
                  selectedSectorId: effectiveSectorId,
                  onChanged: (sectorId) {
                    if (sectorId == effectiveSectorId) return;
                    ref.read(selectedTerritoryIdProvider.notifier).state = null;
                    ref.read(selectedSectorIdProvider.notifier).state =
                        sectorId;
                  },
                ),
                loading: () => const SizedBox(height: 34),
                error: (_, _) => const SizedBox.shrink(),
              ),
            ],
          ),
        ),
        Expanded(
          child: territoriesAsync.when(
            skipLoadingOnReload: true,
            loading: () => const _StateMessage(
              icon: Icons.map_outlined,
              title: 'Carregando mapa',
              message: 'Buscando os territórios cadastrados…',
              loading: true,
            ),
            error: (error, _) => _StateMessage(
              icon: Icons.error_outline,
              title: 'Não foi possível carregar os territórios',
              message: 'Verifique sua conexão e tente novamente.',
              actionLabel: 'Tentar novamente',
              onAction: () => ref.invalidate(territoriesProvider),
            ),
            data: (territories) {
              if (territories.isEmpty) {
                return const _StateMessage(
                  icon: Icons.layers_clear_outlined,
                  title: 'Nenhum território encontrado',
                  message:
                      'Não há territórios cadastrados para esse setor e tipo.',
                );
              }
              return _TerritoriesMap(
                accessToken: accessToken,
                territories: territories,
              );
            },
          ),
        ),
      ],
    );
  }
}

class _TerritoriesMap extends ConsumerStatefulWidget {
  final String accessToken;
  final List<Territory> territories;

  const _TerritoriesMap({required this.accessToken, required this.territories});

  @override
  ConsumerState<_TerritoriesMap> createState() => _TerritoriesMapState();
}

class _TerritoriesMapState extends ConsumerState<_TerritoriesMap> {
  // Kind-colored so the map reads with some life on top of the colorful
  // Mapbox Standard basemap; a single amber accent calls out the
  // selection regardless of kind. Every border is drawn twice — a wider
  // white "casing" underneath a narrower colored line on top — so it
  // stays legible against any basemap color.
  static const _managerZoneColor = 0xFF2563EB;
  static const _repPatchColor = 0xFF059669;
  static const _selectedColor = 0xFFF59E0B;
  static const _haloColor = 0xFFFFFFFF;

  // The selected territory's name tag is a real Mapbox point annotation
  // anchored to its map coordinate — Mapbox itself keeps it glued to
  // that spot through every pan/zoom/rotation, so there is no Flutter-
  // side position tracking to get wrong. We only rescale its text (and
  // halo) as zoom changes, by the same power-of-two factor the map
  // itself uses, so the tag grows and shrinks in lockstep with the
  // territory shapes beneath it instead of staying a fixed pixel size.
  static const _tagBaseTextSize = 12.5;
  static const _tagBaseHaloWidth = 6.0;
  static const _tagBaseZoom = 14.0;

  static const _saoPauloCenter = MapCoordinate(
    longitude: -46.6333,
    latitude: -23.5505,
  );

  MapboxMap? _mapboxMap;
  PolygonAnnotationManager? _polygonManager;
  PolylineAnnotationManager? _borderManager;
  PointAnnotationManager? _tagManager;
  PointAnnotation? _tag;
  bool _mapUnavailable = false;
  double _zoom = 11;

  // The Mapbox plugin resets the camera to [viewport] on every rebuild
  // where it receives a "different" viewport value — and, since
  // CameraViewportState has no value equality, a brand new instance
  // built during `build()` always counts as different. So the initial
  // viewport is only ever supplied once; after that we pass `null` and
  // drive the camera ourselves (`_fitBounds` / `_focusOnTerritory`).
  bool _viewportApplied = false;

  // The tap that lands on a polygon fires both the annotation-specific
  // tap handler (which selects it) and the general map tap handler
  // (which would otherwise deselect, since the tap wasn't caught by a
  // widget). This flag lets the polygon tap "claim" that gesture so the
  // general handler skips it instead of immediately undoing the
  // selection it just made.
  bool _suppressNextMapTapDeselect = false;

  @override
  void initState() {
    super.initState();
    MapboxOptions.setAccessToken(widget.accessToken);
  }

  @override
  void didUpdateWidget(covariant _TerritoriesMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    final oldIds = oldWidget.territories.map((t) => t.id).toSet();
    final newIds = widget.territories.map((t) => t.id).toSet();
    if (oldIds.length != newIds.length || !oldIds.containsAll(newIds)) {
      _renderAnnotations();
      _fitBounds();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_mapUnavailable) {
      return const _StateMessage(
        icon: Icons.map_outlined,
        title: 'Mapa indisponível',
        message:
            'Não foi possível carregar o mapa agora. Tente novamente mais tarde.',
      );
    }

    final selectedId = ref.watch(selectedTerritoryIdProvider);
    final selectedTerritory = _findTerritory(selectedId);

    return Stack(
      children: [
        MapWidget(
          key: const ValueKey('mapa-territorios'),
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
        ),
        // The name tag itself is a native map annotation (see above), so
        // the only Flutter UI left for a selection is this fixed action
        // bar — it doesn't track anything on the map, it just appears.
        if (selectedTerritory != null)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: SafeArea(
              top: false,
              child: _TerritoryActionBar(
                territory: selectedTerritory,
                onViewDetails: () => _openDetails(selectedTerritory),
                onEdit: () =>
                    context.push('/territorios/${selectedTerritory.id}/editar'),
                onDelete: () => _showComingSoon('A exclusão de territórios'),
                onClose: _deselectTerritory,
              ),
            ),
          ),
      ],
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

      _polygonManager!.tapEvents(onTap: _handleTap);

      await _renderAnnotations();
      await _fitBounds();
    } catch (_) {
      if (mounted) setState(() => _mapUnavailable = true);
    }
  }

  void _handleTap(PolygonAnnotation annotation) {
    final territoryId = annotation.customData?['territoryId'] as String?;
    final territory = _findTerritory(territoryId);
    if (territory == null) return;

    _suppressNextMapTapDeselect = true;
    _selectTerritory(territory);
  }

  Territory? _findTerritory(String? id) {
    if (id == null) return null;
    for (final territory in widget.territories) {
      if (territory.id == id) return territory;
    }
    return null;
  }

  /// Tapping anywhere on the map that *isn't* a territory (caught by
  /// [_handleTap] instead) dismisses whatever is selected — same as the
  /// action bar's own close button.
  void _handleMapTap(MapContentGestureContext context) {
    if (_suppressNextMapTapDeselect) {
      _suppressNextMapTapDeselect = false;
      return;
    }
    if (ref.read(selectedTerritoryIdProvider) != null) {
      _deselectTerritory();
    }
  }

  /// Rescales the selected territory's map tag as the camera zooms, by
  /// the same doubling-per-zoom-level factor the map itself uses for
  /// real geometry — so the tag's size stays proportional to the
  /// territory shapes instead of sitting at a fixed pixel size.
  void _handleCameraChanged(CameraChangedEventData event) {
    _zoom = event.cameraState.zoom;

    final tagManager = _tagManager;
    final tag = _tag;
    if (tagManager == null || tag == null) return;

    tag.textSize = _tagTextSizeForZoom(_zoom);
    tag.textHaloWidth = _tagHaloWidthForZoom(_zoom);
    tagManager.update(tag);
  }

  double _zoomScale(double zoom) =>
      math.pow(2, zoom - _tagBaseZoom).toDouble().clamp(0.45, 2.5);

  double _tagTextSizeForZoom(double zoom) =>
      _tagBaseTextSize * _zoomScale(zoom);

  double _tagHaloWidthForZoom(double zoom) =>
      _tagBaseHaloWidth * _zoomScale(zoom);

  /// Selects the territory, highlights it on the map, drops a name tag
  /// pinned to it (a real annotation — Mapbox keeps it in place through
  /// any pan/zoom on its own), and eases the camera so the whole
  /// territory fits on screen. Tapping no longer opens the details
  /// sheet directly; that's now an explicit action in the fixed bar
  /// that appears alongside the selection.
  Future<void> _selectTerritory(Territory territory) async {
    ref.read(selectedTerritoryIdProvider.notifier).state = territory.id;
    _renderAnnotations();
    _showTag(territory);
    await _focusOnTerritory(territory);
  }

  void _deselectTerritory() {
    ref.read(selectedTerritoryIdProvider.notifier).state = null;
    _renderAnnotations();
    _hideTag();
  }

  Future<void> _showTag(Territory territory) async {
    final tagManager = _tagManager;
    if (tagManager == null) return;

    await tagManager.deleteAll();
    final anchor = territory.boundary.labelAnchor ?? territory.centroid;
    _tag = await tagManager.create(
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

  void _hideTag() {
    _tag = null;
    _tagManager?.deleteAll();
  }

  void _openDetails(Territory territory) {
    TerritoryDetailSheet.show(context, territory);
  }

  void _showComingSoon(String feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$feature estará disponível em breve.')),
    );
  }

  /// Eases the camera so the *entire* territory is visible, with extra
  /// bottom padding reserved for the fixed action bar that sits below.
  Future<void> _focusOnTerritory(Territory territory) async {
    final mapboxMap = _mapboxMap;
    if (mapboxMap == null) return;

    final bounds = territory.boundary.bounds;
    try {
      if (bounds != null) {
        final coordinateBounds = CoordinateBounds(
          southwest: _point(bounds.southwest),
          northeast: _point(bounds.northeast),
          infiniteBounds: false,
        );
        final camera = await mapboxMap.cameraForCoordinateBounds(
          coordinateBounds,
          MbxEdgeInsets(top: 56, left: 56, bottom: 190, right: 56),
          null,
          null,
          null,
          null,
        );
        await mapboxMap.easeTo(camera, MapAnimationOptions(duration: 550));
      } else {
        final anchor = territory.boundary.labelAnchor ?? territory.centroid;
        await mapboxMap.easeTo(
          CameraOptions(center: _point(anchor), zoom: 14),
          MapAnimationOptions(duration: 550),
        );
      }
    } catch (_) {
      // Best-effort camera move — the selection itself already succeeded.
    }
  }

  Future<void> _renderAnnotations() async {
    final polygonManager = _polygonManager;
    final borderManager = _borderManager;
    if (polygonManager == null || borderManager == null) return;

    final territories = widget.territories;
    final selectedId = ref.read(selectedTerritoryIdProvider);

    await polygonManager.deleteAll();
    await borderManager.deleteAll();

    final polygonOptions = <PolygonAnnotationOptions>[];
    final haloOptions = <PolylineAnnotationOptions>[];
    final borderOptions = <PolylineAnnotationOptions>[];

    for (final territory in territories) {
      final selected = territory.id == selectedId;
      final baseColor = territory.kind == TerritoryKind.managerZone
          ? _managerZoneColor
          : _repPatchColor;
      final lineColor = selected ? _selectedColor : baseColor;
      final haloWidth = selected ? 5.0 : 3.4;
      final lineWidth = selected ? 3.0 : 1.8;

      for (final polygonRings in territory.boundary.coordinates) {
        polygonOptions.add(
          PolygonAnnotationOptions(
            geometry: Polygon.fromPoints(
              points: polygonRings.map(_ringToPoints).toList(),
            ),
            fillColor: baseColor,
            fillOpacity: selected ? 0.40 : 0.22,
            fillOutlineColor: lineColor,
            customData: {'territoryId': territory.id},
          ),
        );

        // Drawn as real polylines (not just fill-outline) so borders stay
        // crisp and visible at every zoom level and against any basemap
        // color — a white casing underneath, then the colored line on
        // top of it.
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

    await polygonManager.createMulti(polygonOptions);
    await borderManager.createMulti([...haloOptions, ...borderOptions]);
  }

  Future<void> _fitBounds() async {
    final mapboxMap = _mapboxMap;
    if (mapboxMap == null || widget.territories.isEmpty) return;

    final bounds = _combinedBounds(widget.territories);
    if (bounds == null) return;

    try {
      final coordinateBounds = CoordinateBounds(
        southwest: _point(bounds.southwest),
        northeast: _point(bounds.northeast),
        infiniteBounds: false,
      );
      final camera = await mapboxMap.cameraForCoordinateBounds(
        coordinateBounds,
        MbxEdgeInsets(top: 40, left: 32, bottom: 96, right: 32),
        null,
        null,
        null,
        null,
      );
      await mapboxMap.easeTo(camera, MapAnimationOptions(duration: 500));
    } catch (_) {
      // Best-effort camera fit — ignore failures.
    }
  }

  MapBounds? _combinedBounds(List<Territory> territories) {
    MapBounds? combined;
    for (final territory in territories) {
      final bounds = territory.boundary.bounds;
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

/// Fixed action bar shown above the bottom edge whenever a territory is
/// selected. It never tracks the map — the on-map name tag (a real
/// Mapbox annotation) already shows where the territory is; this just
/// offers "ver detalhes" / "editar" / "excluir" and a way to dismiss
/// the selection.
class _TerritoryActionBar extends StatelessWidget {
  final Territory territory;
  final VoidCallback onViewDetails;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onClose;

  const _TerritoryActionBar({
    required this.territory,
    required this.onViewDetails,
    required this.onEdit,
    required this.onDelete,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final roleLabel = territory.kind == TerritoryKind.managerZone
        ? 'Gerente'
        : 'Representante';

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.fromLTRB(14, 12, 10, 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x3A111827),
            blurRadius: 20,
            offset: Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      territory.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                        color: Color(0xFF0f1729),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.person_rounded,
                          size: 14,
                          color: Color(0xFF9CA3AF),
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(
                                  text: '$roleLabel: ',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color: Color(0xFF6b7280),
                                  ),
                                ),
                                TextSpan(
                                  text: territory.assignedUserName ?? 'Nenhum',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF374151),
                                  ),
                                ),
                              ],
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: onClose,
                behavior: HitTestBehavior.opaque,
                child: const Padding(
                  padding: EdgeInsets.only(left: 6),
                  child: Icon(
                    Icons.close_rounded,
                    size: 18,
                    color: Color(0xFF9CA3AF),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, color: Color(0xFFE5E7EB)),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _ActionButton(
                icon: Icons.visibility_outlined,
                label: 'Detalhes',
                onTap: onViewDetails,
              ),
              _ActionButton(
                icon: Icons.edit_outlined,
                label: 'Editar',
                onTap: onEdit,
              ),
              _ActionButton(
                icon: Icons.delete_outline,
                label: 'Excluir',
                onTap: onDelete,
                color: const Color(0xFFDC2626),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Color? color;

  const _ActionButton({
    required this.icon,
    required this.label,
    this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final tint = color ?? const Color(0xFF374151);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: tint),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: tint,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StateMessage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final bool loading;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _StateMessage({
    required this.icon,
    required this.title,
    required this.message,
    this.loading = false,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (loading)
              const SizedBox(
                width: 32,
                height: 32,
                child: CircularProgressIndicator(strokeWidth: 3),
              )
            else
              Icon(icon, size: 42, color: const Color(0xFF6B7280)),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
            ),
            if (actionLabel != null) ...[
              const SizedBox(height: 20),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}
