import 'package:atlasmed_mobile_app/core/json/crm_id.dart';
import 'package:atlasmed_mobile_app/features/map/data/models/territory.dart';

/// One territory with its geometry (spec 0015 §6).
class TerritoryMapFeature {
  const TerritoryMapFeature({
    required this.id,
    required this.name,
    this.geometry,
    this.holderName,
  });

  final int id;
  final String name;
  final TerritoryGeometry? geometry;

  /// Who holds it, where that is worth drawing — a rival manager's zone.
  final String? holderName;

  factory TerritoryMapFeature.fromJson(Map<String, dynamic> json) {
    final raw = json['boundary'];
    return TerritoryMapFeature(
      id: readCrmId(json['id'], 'id'),
      name: json['name'] as String? ?? '',
      geometry: raw is Map<String, dynamic>
          ? TerritoryGeometry.tryFromGeoJson(raw)
          : null,
      holderName: json['holderName'] as String?,
    );
  }
}

/// What a member's territory map draws (spec 0015 §6).
///
/// Three sets, because the map answers three questions at once: what this
/// person holds, what encloses it, and what is already taken. Which are
/// populated depends on who is looking at whom — the server decides, so the
/// screen never has to re-derive a rule that lives in spec 0015 R9.
class MemberTerritoryMap {
  const MemberTerritoryMap({
    required this.subject,
    required this.context,
    required this.taken,
    required this.canEdit,
  });

  /// This person's own ground: a rep's patches, a manager's zones.
  final List<TerritoryMapFeature> subject;

  /// The zone that encloses them. Empty when looking at a manager — a zone
  /// encloses nothing.
  final List<TerritoryMapFeature> context;

  /// Other managers' zones, shaded as unavailable. I3 forbids overlap, so a
  /// zone grows only into unclaimed ground.
  final List<TerritoryMapFeature> taken;

  /// Whether this viewer may redraw what they are looking at. A manager may
  /// redraw a patch and never a zone; OPS redraws nothing.
  final bool canEdit;

  bool get isEmpty => subject.isEmpty && context.isEmpty && taken.isEmpty;

  factory MemberTerritoryMap.fromJson(Map<String, dynamic> json) {
    List<TerritoryMapFeature> read(String key) =>
        (json[key] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(TerritoryMapFeature.fromJson)
            .toList(growable: false);

    return MemberTerritoryMap(
      subject: read('subject'),
      context: read('context'),
      taken: read('taken'),
      canEdit: json['canEdit'] as bool? ?? false,
    );
  }
}
