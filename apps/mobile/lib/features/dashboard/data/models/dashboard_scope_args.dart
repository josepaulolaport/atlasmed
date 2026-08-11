/// The scope + filter set every Desempenho metric is fetched with
/// (spec 0014 §3 and §5).
///
/// One object, shared by every metric request, because the spec requires the
/// filters to apply uniformly: a screen where cobertura is filtered by state
/// and penetração is not would be reporting two different populations side by
/// side.
///
/// Every filter is multi-select. [verticalId] is never null once resolved — a
/// dashboard never mixes two linhas, so there is no "todas" option to
/// represent.
class DashboardScopeArgs {
  const DashboardScopeArgs({
    required this.verticalId,
    this.subjectUserId,
    this.unitTypeIds = const [],
    this.managerIds = const [],
    this.repIds = const [],
    this.stateIds = const [],
    this.municipalityIds = const [],
  });

  final int verticalId;

  /// Whose desempenho — null means the signed-in user's own (spec 0014 §2).
  final int? subjectUserId;

  final List<int> unitTypeIds;
  final List<int> managerIds;
  final List<int> repIds;
  final List<int> stateIds;
  final List<int> municipalityIds;

  bool get hasFilters =>
      unitTypeIds.isNotEmpty ||
      managerIds.isNotEmpty ||
      repIds.isNotEmpty ||
      stateIds.isNotEmpty ||
      municipalityIds.isNotEmpty;

  int get filterCount =>
      unitTypeIds.length +
      managerIds.length +
      repIds.length +
      stateIds.length +
      municipalityIds.length;

  DashboardScopeArgs copyWith({
    int? verticalId,
    int? subjectUserId,
    List<int>? unitTypeIds,
    List<int>? managerIds,
    List<int>? repIds,
    List<int>? stateIds,
    List<int>? municipalityIds,
    bool clearSubject = false,
  }) {
    return DashboardScopeArgs(
      verticalId: verticalId ?? this.verticalId,
      subjectUserId: clearSubject
          ? null
          : (subjectUserId ?? this.subjectUserId),
      unitTypeIds: unitTypeIds ?? this.unitTypeIds,
      managerIds: managerIds ?? this.managerIds,
      repIds: repIds ?? this.repIds,
      stateIds: stateIds ?? this.stateIds,
      municipalityIds: municipalityIds ?? this.municipalityIds,
    );
  }

  /// Clears every filter but keeps the linha and the subject — "limpar filtros"
  /// must not silently change whose numbers are on screen.
  DashboardScopeArgs cleared() =>
      DashboardScopeArgs(verticalId: verticalId, subjectUserId: subjectUserId);

  static String _csv(List<int> ids) => ids.join(',');

  Map<String, String> toQuery() => {
    'verticalId': '$verticalId',
    if (subjectUserId != null) 'subjectUserId': '$subjectUserId',
    if (unitTypeIds.isNotEmpty) 'unitTypeIds': _csv(unitTypeIds),
    if (managerIds.isNotEmpty) 'managerIds': _csv(managerIds),
    if (repIds.isNotEmpty) 'repIds': _csv(repIds),
    if (stateIds.isNotEmpty) 'stateIds': _csv(stateIds),
    if (municipalityIds.isNotEmpty) 'municipalityIds': _csv(municipalityIds),
  };

  static bool _sameIds(List<int> a, List<int> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  @override
  bool operator ==(Object other) =>
      other is DashboardScopeArgs &&
      other.verticalId == verticalId &&
      other.subjectUserId == subjectUserId &&
      _sameIds(other.unitTypeIds, unitTypeIds) &&
      _sameIds(other.managerIds, managerIds) &&
      _sameIds(other.repIds, repIds) &&
      _sameIds(other.stateIds, stateIds) &&
      _sameIds(other.municipalityIds, municipalityIds);

  // Order-sensitive on purpose, matching `==`: these lists are built by the
  // drawers in a stable order, and treating [33, 35] and [35, 33] as different
  // costs one extra fetch where treating them as equal would risk a stale card.
  @override
  int get hashCode => Object.hash(
    verticalId,
    subjectUserId,
    Object.hashAll(unitTypeIds),
    Object.hashAll(managerIds),
    Object.hashAll(repIds),
    Object.hashAll(stateIds),
    Object.hashAll(municipalityIds),
  );
}
